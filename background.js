/**
 * Service worker: captura la cabecera X-Backend-Response de cada documento y
 * junta lo que manda el content script, para pintar el badge del icono y
 * devolvérselo al widget de la página.
 *
 * El estado vive en chrome.storage.session, una entrada por pestaña
 * ("tab:{id}"): el service worker se para tras unos segundos sin eventos y
 * cualquier variable global se pierde.
 */
importScripts("lib/render.js");

const { classify, BADGE } = globalThis.P66Render;

const SITE_URLS = [
  "*://*.lavanguardia.com/*",
  "*://*.lavanguardia.biz/*",
  "*://*.mundodeportivo.com/*",
  "*://*.mundodeportivo.biz/*",
];

const keyOf = (tabId) => `tab:${tabId}`;

/** La URL sin el #hash, que no forma parte de la petición. */
const sameDocument = (a, b) =>
  typeof a === "string" && typeof b === "string" &&
  a.split("#")[0] === b.split("#")[0];

async function getTabState(tabId) {
  const key = keyOf(tabId);
  return (await chrome.storage.session.get(key))[key] ?? null;
}

async function setTabState(tabId, state) {
  await chrome.storage.session.set({ [keyOf(tabId)]: state });
}

const DEFAULT_ICON = { 16: "icons/icon-16.png", 32: "icons/icon-32.png" };

/**
 * Icono con el estado: cuadrado del color del semáforo con el texto centrado.
 * Se dibuja aquí en vez de usar setBadgeText porque Chrome no deja colocar el
 * texto del badge, y en Windows sale descentrado.
 */
function drawBadgeIcon(size, { text, color }) {
  const ctx = new OffscreenCanvas(size, size).getContext("2d");
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // La fuente más grande que quepa con un margen de 1 px por lado (a 16 px).
  const maxWidth = size - size / 8;
  let px = Math.round(size * 0.65);
  let m;
  do {
    ctx.font = `bold ${px}px "Segoe UI", system-ui, sans-serif`;
    m = ctx.measureText(text);
    px--;
  } while (m.actualBoundingBoxLeft + m.actualBoundingBoxRight > maxWidth && px > 4);

  // Centrado sobre la caja real de los glifos, no sobre la métrica de la
  // fuente, y en píxeles enteros para que el texto salga nítido.
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const x = Math.round((size - w) / 2 + m.actualBoundingBoxLeft);
  const y = Math.round((size - h) / 2 + m.actualBoundingBoxAscent);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
  return ctx.getImageData(0, 0, size, size);
}

async function paintBadge(tabId, state) {
  const render = classify({
    backendHeader: state.backendHeader,
    bodyClass: state.page?.bodyClass ?? null,
    headerSeen: state.headerSeen,
  });
  const badge = BADGE[render.kind];
  try {
    await chrome.action.setIcon(
      badge.text
        ? { tabId, imageData: { 16: drawBadgeIcon(16, badge), 32: drawBadgeIcon(32, badge) } }
        : { tabId, path: DEFAULT_ICON },
    );
    await chrome.action.setTitle({
      tabId,
      title: `P66 Render Inspector — ${render.label}: ${render.detail}`,
    });
  } catch {
    // La pestaña se cerró mientras tanto.
  }
  return render;
}

// onResponseStarted también salta con respuestas servidas desde la caché del
// navegador (fromCache), cosa que onHeadersReceived no hace.
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const header = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === "x-backend-response",
    );
    const state = {
      url: details.url,
      statusCode: details.statusCode,
      fromCache: details.fromCache,
      backendHeader: header?.value ?? null,
      headerSeen: true,
      headerSource: "navegación",
      time: Date.now(),
      page: null,
    };
    (async () => {
      await setTabState(details.tabId, state);
      await paintBadge(details.tabId, state);
    })();
  },
  { urls: SITE_URLS, types: ["main_frame"] },
  ["responseHeaders"],
);

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(keyOf(tabId));
});

// El icono pliega o despliega el widget de la página.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "toggle" });
  } catch {
    // No es una página de LV/MD, o se abrió antes de instalar la extensión.
  }
});

/**
 * Código de respuesta de un enlace. Lo hace el service worker porque el
 * content script está sujeto al CORS de la página, y el JSON vive en otro
 * host (p66.lavanguardia.com).
 */
async function linkStatus(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return { status: res.status };
  } catch (error) {
    return { status: null, error: String(error?.message ?? error) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  if (tabId == null) return false;

  if (message.type === "check-link") {
    (async () => sendResponse(await linkStatus(message.href)))();
    return true;
  }

  (async () => {
    try {
      let state = await getTabState(tabId);
      // Sin respuesta capturada para este documento (pestaña abierta antes de
      // instalar la extensión, página restaurada de la bfcache…): el content
      // script tendrá que volver a pedir la cabecera.
      if (!state || !sameDocument(state.url, message.url)) {
        state = {
          url: message.url,
          statusCode: null,
          fromCache: null,
          backendHeader: null,
          headerSeen: false,
          headerSource: null,
          time: Date.now(),
          page: null,
        };
      }

      if (message.type === "page") {
        state.page = message.page;
      } else if (message.type === "header") {
        // Cabecera obtenida con una petición HEAD desde el content script.
        state.backendHeader = message.backendHeader;
        state.statusCode = message.statusCode;
        state.headerSeen = true;
        state.headerSource = "petición HEAD";
      }

      await setTabState(tabId, state);
      const render = await paintBadge(tabId, state);
      sendResponse({ ok: true, state, render });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();
  return true;
});
