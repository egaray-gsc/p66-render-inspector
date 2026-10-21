/**
 * Content script: lee lo que solo se ve desde la página (clase del body,
 * assets en el HTML, ggPageData) y se lo pasa al service worker, que lo junta
 * con la cabecera X-Backend-Response. Con la respuesta pinta el widget
 * flotante de la esquina: plegado, el semáforo con P66 o Xalok; desplegado,
 * todo el detalle.
 */
(() => {
  const { extractAssets, ASSET_TYPES, contentIdFromPath, jsonUrlFor } = globalThis.P66Render;

  const COLORS = {
    p66: "#15803d",
    fallback: "#ea580c",
    xalok: "#1d4ed8",
    mismatch: "#b91c1c",
    unknown: "#6b7280",
  };

  /**
   * ggPageData es una variable de un script inline. El content script vive en
   * un mundo aislado y no ve las variables de la página, así que se lee el
   * objeto del texto del script.
   */
  function readPageData() {
    for (const script of document.scripts) {
      const text = script.textContent;
      const at = text.indexOf("ggPageData");
      if (at === -1) continue;
      const start = text.indexOf("{", at);
      if (start === -1) continue;
      const json = balancedObject(text, start);
      if (!json) continue;
      try {
        return JSON.parse(json);
      } catch {
        // No era JSON estricto; se prueba con el siguiente script.
      }
    }
    return null;
  }

  /** Recorta "{…}" desde start respetando llaves dentro de strings. */
  function balancedObject(text, start) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === "\\") i++;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
    }
    return null;
  }

  /**
   * DAI, la librería de publicidad. Dos piezas, las dos en dai.grupogodo.com
   * (pro) o dai.grupogodo.biz (tes):
   *  - /{carpeta}/adloader.js: el cargador. El ?v=02 de su URL no es su versión.
   *  - /{carpeta}/{versión}/{minified|unminified}/index.js: DAI en sí. El
   *    cargador lo pide después, así que puede no estar todavía al leer la página.
   */
  const DAI_INDEX_RE =
    /^https?:\/\/dai\.grupogodo\.(com|biz)\/([\w-]+)\/(\d+\.\d+\.\d+[\w.-]*)\/(minified|unminified)\/index\.js/;
  const DAI_LOADER_RE = /^https?:\/\/dai\.grupogodo\.(?:com|biz)\/[\w-]+\/adloader\.js[^\s"']*/;

  function collectAds(urls) {
    const loaderUrl = urls.find((u) => DAI_LOADER_RE.test(u)) ?? null;
    const index = urls.map((u) => DAI_INDEX_RE.exec(u)).find(Boolean);
    let localConfig = null;
    try {
      localConfig = localStorage.getItem("adloaderConfig");
    } catch {}
    return {
      loaderUrl,
      daiVersion: index?.[3] ?? null,
      env: index ? (index[1] === "biz" ? "tes" : "pro") : null,
      folder: index?.[2] ?? null,
      build: index?.[4] ?? null,
      // El cargador mezcla esta configuración con la suya: si hay, DAI no es
      // el de serie (avisa en consola con "[Loader] Config from …").
      overrideParam: new URL(location.href).searchParams.get("dai"),
      overrideLocal: localConfig,
    };
  }

  /** Versión del cargador: la constante que asigna a adloaderVersion. */
  const loaderVersions = new Map();

  async function loaderVersion(url) {
    if (!loaderVersions.has(url)) {
      loaderVersions.set(url, (async () => {
        try {
          // dai.grupogodo.* responde con Access-Control-Allow-Origin: *.
          const text = await (await fetch(url)).text();
          const name = /adloaderVersion:([\w$]+)/.exec(text)?.[1];
          if (!name) return null;
          const esc = name.replace(/\$/g, "\\$");
          return new RegExp(`(?:var|let|const)\\s+${esc}\\s*=\\s*[\`'"]([^\`'"]+)[\`'"]`).exec(text)?.[1] ?? null;
        } catch {
          return null;
        }
      })());
    }
    return loaderVersions.get(url);
  }

  function collectPage() {
    const html = document.documentElement.outerHTML;
    // Los JS que gg.registry carga después no siempre están en el HTML inicial.
    const resourceUrls = performance.getEntriesByType("resource").map((r) => r.name);
    const scriptUrls = [...document.scripts].map((s) => s.src).filter(Boolean);
    const resources = resourceUrls.join("\n");
    const data = readPageData();
    const esiErrors = [...html.matchAll(/<!-- esi:error \[xid=(\d+)([^\]]*)\] -->/g)]
      .map(([, xid, src]) => ({ xid, src }));

    return {
      bodyClass: document.body?.className ?? null,
      assets: extractAssets(html, resources),
      ads: collectAds([...scriptUrls, ...resourceUrls]),
      esiErrors,
      pageData: data && {
        contentId: data.contentId ?? null,
        webType: data.webType ?? null,
        template: data.template ?? null,
        facet: data.facet ?? null,
        environment: data.environment ?? null,
        accessType: data.accessType ?? null,
      },
    };
  }

  async function send(message) {
    try {
      return await chrome.runtime.sendMessage({ ...message, url: location.href });
    } catch {
      // Extensión recargada o desactivada: el contexto ya no existe.
      return null;
    }
  }

  /** Segunda opinión cuando la navegación no se llegó a capturar. */
  async function fetchBackendHeader() {
    try {
      const res = await fetch(location.href, {
        method: "HEAD",
        cache: "no-store",
        credentials: "include",
      });
      return {
        backendHeader: res.headers.get("x-backend-response"),
        statusCode: res.status,
      };
    } catch {
      return null;
    }
  }

  // --- Widget flotante ----------------------------------------------------

  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .box {
      width: max-content; max-width: min(380px, calc(100vw - 24px));
      max-height: calc(100vh - 24px); overflow: auto;
      border-radius: 18px; color: #e5e7eb; background: rgba(17, 24, 39, 0.96);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .box.open { width: min(380px, calc(100vw - 24px)); border-radius: 10px; }
    .head {
      all: unset; box-sizing: border-box; cursor: pointer; width: 100%;
      display: flex; align-items: center; gap: 8px; padding: 6px 10px 6px 8px;
    }
    .head:focus-visible { outline: 2px solid #fff; outline-offset: -2px; border-radius: inherit; }
    .open .head { padding: 10px 12px; border-bottom: 1px solid #2a2d3a; }
    .dot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
    .open .dot { width: 12px; height: 12px; }
    .short { font-weight: 600; }
    .title { display: none; flex: 1; min-width: 0; }
    .label { font-size: 14px; font-weight: 700; }
    .detail { color: #9ca3af; }
    .chevron { display: none; color: #9ca3af; font-size: 14px; }
    .open .short { display: none; }
    .open .title, .open .chevron { display: block; }
    .body { display: none; padding: 2px 12px 8px; }
    .open .body { display: block; }
    section { padding: 8px 0; border-bottom: 1px solid #2a2d3a; }
    section:last-child { border-bottom: 0; }
    h2 {
      margin: 0 0 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
      text-transform: uppercase; color: #9ca3af;
    }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 1px 12px; margin: 0; }
    dt { color: #9ca3af; }
    dd { margin: 0; overflow-wrap: anywhere; }
    code, .mono { font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 11px; }
    ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; }
    a { color: #93c5fd; }
    details summary { cursor: pointer; }
    details ul { margin-top: 3px; padding-left: 14px; color: #9ca3af; gap: 0; }
    .chip {
      display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px;
      border: 1px solid currentColor; font-size: 10px;
    }
    .ok { color: #4ade80; }
    .bad { color: #f87171; }
    .warn { color: #fb923c; }
    .muted { color: #9ca3af; }
  `;

  /** Crea un elemento. Todo el texto entra como textContent, nunca como HTML. */
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    node.append(...children.flat().filter((c) => c != null && c !== false && c !== ""));
    return node;
  }

  /** Lista de pares etiqueta/valor; se salta los valores vacíos. */
  function list(rows) {
    const dl = el("dl");
    for (const [label, value] of rows) {
      if (value == null || value === "") continue;
      dl.append(el("dt", {}, label), el("dd", {}, value));
    }
    return dl.childElementCount ? dl : null;
  }

  function section(title, ...content) {
    const items = content.flat().filter(Boolean);
    return items.length ? el("section", {}, el("h2", {}, title), ...items) : null;
  }

  const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener" }, text);

  function withFacet(facet) {
    const u = new URL(location.href);
    u.hash = "";
    u.searchParams.set("facet", facet);
    return u.toString();
  }

  /** /slug.html ↔ /slug.amp.html. Los settings solo se ven en AMP. */
  function otherFormat() {
    const u = new URL(location.href);
    u.hash = "";
    if (u.pathname.endsWith(".amp.html")) {
      u.pathname = u.pathname.replace(/\.amp\.html$/, ".html");
      return { href: u.toString(), label: "Versión web" };
    }
    u.pathname = u.pathname.replace(/\.html$/, ".amp.html");
    return { href: u.toString(), label: "Versión AMP (con settings)" };
  }

  /**
   * Código de respuesta del JSON. La petición la hace el service worker: el
   * host p66.* no manda cabeceras CORS. Si el mensaje no llega (el service
   * worker arrancando, la extensión recién recargada) se reintenta, y solo se
   * guarda un resultado con código.
   */
  const linkStatuses = new Map();

  async function checkLink(href) {
    let result = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 700));
      result = await send({ type: "check-link", href });
      if (result?.status != null) {
        linkStatuses.set(href, result);
        return result;
      }
    }
    return result ?? { status: null, error: "Sin respuesta de la extensión. Recarga la página." };
  }

  function statusChip(href) {
    const chip = el("span", { class: "chip muted", title: "Comprobando…" }, "…");
    const cached = linkStatuses.get(href);
    (cached ? Promise.resolve(cached) : checkLink(href)).then(({ status, error }) => {
      chip.textContent = status == null ? "error" : String(status);
      chip.className = `chip ${status >= 200 && status < 300 ? "ok" : "bad"}`;
      chip.title = status == null ? `No se pudo comprobar: ${error}` : `HTTP ${status}`;
    });
    return chip;
  }

  function assetRows(assets) {
    return ASSET_TYPES.filter((t) => assets?.[t]).map((type) => {
      const { versions, files } = assets[type];
      const names = Object.keys(files).sort();
      return [type, el("details", {},
        el("summary", {},
          el("span", { class: "mono" }, versions.join(" · ")),
          versions.length > 1 ? el("span", { class: "chip warn" }, "varias versiones") : null,
          ` — ${names.length} fichero${names.length === 1 ? "" : "s"}`,
        ),
        el("ul", {}, names.map((f) =>
          el("li", { class: "mono" }, versions.length > 1 ? `${f} (${files[f]})` : f))),
      )];
    });
  }

  function adsSection(ads) {
    if (!ads?.loaderUrl && !ads?.daiVersion) {
      return section("Publicidad", el("div", { class: "muted" }, "No se ha cargado DAI"));
    }
    const loader = el("span", { class: "mono" }, "…");
    if (ads.loaderUrl) {
      loaderVersion(ads.loaderUrl).then((v) => (loader.textContent = v ?? "no encontrada"));
    }
    return section("Publicidad", list([
      ["DAI", ads.daiVersion
        ? el("span", {}, el("span", { class: "mono" }, ads.daiVersion),
            /-/.test(ads.daiVersion) ? el("span", { class: "chip warn" }, "prerelease") : null)
        : el("span", { class: "muted" }, "cargador sin DAI todavía")],
      ["Entorno", ads.env],
      ["Carpeta", ads.folder],
      ["Build", ads.build],
      ["Adloader", ads.loaderUrl ? el("span", {}, loader, " ", link(ads.loaderUrl, "js")) : null],
      ["Override", ads.overrideParam != null
        ? el("span", { class: "warn" }, "?dai=", el("code", {}, ads.overrideParam))
        : null],
      ["Override", ads.overrideLocal
        ? el("span", { class: "warn" }, "localStorage.adloaderConfig ", el("code", {}, ads.overrideLocal))
        : null],
    ]));
  }

  function buildBody(state, render) {
    const page = state.page;
    const data = page?.pageData;
    const id =
      contentIdFromPath(location.pathname) ??
      /^article-(\d+)$/.exec(data?.contentId ?? "")?.[1] ??
      null;
    const jsonUrl = jsonUrlFor(location.href, id);
    const other = id ? otherFormat() : null;
    const bodyText = render.bodyRender
      ? `${render.bodyRender === "p66" ? "P66" : "Xalok"} (clase ${render.bodyRender === "p66" ? "gg" : "xk"})`
      : "sin marca";
    const assets = assetRows(page?.assets);

    return [
      section("Respuesta", list([
        ["Backend", render.backend ? el("code", {}, render.backend) : "— (sin cabecera)"],
        ["Cabecera", state.backendHeader ? el("code", {}, state.backendHeader) : null],
        ["Body", bodyText],
        ["HTTP", state.statusCode != null ? String(state.statusCode) : null],
        ["Origen", [state.headerSource, state.fromCache ? "caché del navegador" : null]
          .filter(Boolean).join(" · ")],
      ])),
      section("Página", list([
        ["Contenido", data?.contentId],
        ["Tipo", data?.webType],
        ["Plantilla", data?.template],
        ["Facet", data?.facet],
        ["Entorno", data?.environment],
        ["Acceso", data?.accessType],
      ])),
      section("Enlaces", el("ul", {},
        jsonUrl
          ? el("li", {}, link(jsonUrl, "Versión JSON"), statusChip(jsonUrl))
          : el("li", { class: "muted" }, "Versión JSON: sin id de contenido (portada o sección)"),
        el("li", {}, link(withFacet("cwvp"), "Pedir P66"), el("code", {}, " ?facet=cwvp")),
        el("li", {}, link(withFacet("cwvx"), "Pedir Xalok"), el("code", {}, " ?facet=cwvx")),
        other && el("li", {}, link(other.href, other.label)),
      )),
      section("Assets", assets.length
        ? list(assets)
        : el("div", { class: "muted" }, "Sin assets de ggcstatic")),
      adsSection(page?.ads),
      page?.esiErrors?.length
        ? section("Errores ESI", el("ul", { class: "bad" },
            page.esiErrors.map((e) => el("li", { class: "mono" }, `xid ${e.xid} ${e.src}`))))
        : null,
    ];
  }

  let widget = null;

  function ensureWidget() {
    if (widget) return widget;
    const host = document.createElement("p66-render-inspector");
    host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; top: 12px; right: 12px;";
    const root = host.attachShadow({ mode: "closed" });
    const style = el("style");
    style.textContent = STYLE;
    const dot = el("span", { class: "dot" });
    const short = el("span", { class: "short" });
    const label = el("div", { class: "label" });
    const detail = el("div", { class: "detail" });
    const head = el("button", { type: "button", class: "head", title: "Plegar o desplegar" },
      dot, short, el("span", { class: "title" }, label, detail), el("span", { class: "chevron" }, "▴"));
    const body = el("div", { class: "body" });
    const box = el("div", { class: "box" }, head, body);
    root.append(style, box);
    head.addEventListener("click", () => setOpen(!box.classList.contains("open")));
    document.documentElement.append(host);
    widget = { host, box, head, dot, short, label, detail, body };
    return widget;
  }

  /** Abierto o plegado; se recuerda para las siguientes páginas. */
  async function setOpen(open) {
    if (!widget) return;
    widget.box.classList.toggle("open", open);
    widget.head.setAttribute("aria-expanded", String(open));
    try {
      await chrome.storage.local.set({ widgetOpen: open });
    } catch {}
  }

  async function paintWidget(state, render) {
    if (render.kind === "unknown") {
      widget?.host.remove();
      widget = null;
      return;
    }

    let corner = "top-right";
    let open = false;
    try {
      ({ pillCorner: corner } = await chrome.storage.sync.get({ pillCorner: corner }));
      ({ widgetOpen: open = false } = await chrome.storage.local.get("widgetOpen"));
    } catch {}

    const w = ensureWidget();
    const [vertical, horizontal] = corner.split("-");
    w.host.style.top = vertical === "top" ? "12px" : "auto";
    w.host.style.bottom = vertical === "bottom" ? "12px" : "auto";
    w.host.style.left = horizontal === "left" ? "12px" : "auto";
    w.host.style.right = horizontal === "right" ? "12px" : "auto";
    w.dot.style.background = COLORS[render.kind];
    w.short.textContent = render.short;
    w.label.textContent = [render.label, render.backend].filter(Boolean).join(" · ");
    w.detail.textContent = render.detail;
    w.body.replaceChildren(...buildBody(state, render).filter(Boolean));
    w.box.classList.toggle("open", open);
    w.head.setAttribute("aria-expanded", String(open));
  }

  // --- Arranque ------------------------------------------------------------

  let last = null;
  let refreshPending = false;

  async function run() {
    let response = await send({ type: "page", page: collectPage() });
    if (!response?.ok) return;

    if (!response.state.headerSeen) {
      const header = await fetchBackendHeader();
      if (header) {
        response = (await send({ type: "header", ...header })) ?? response;
      }
    }
    last = response;
    await paintWidget(response.state, response.render);
    if (refreshPending) {
      refreshPending = false;
      scheduleRefresh();
    }
  }

  /** Vuelve a leer la página y repinta, sin repetir la petición HEAD. */
  let refreshTimer = null;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      const response = await send({ type: "page", page: collectPage() });
      if (!response?.ok) return;
      last = response;
      await paintWidget(response.state, response.render);
    }, 300);
  }

  // DAI se pide cuando el cargador arranca, a menudo después de document_idle.
  try {
    new PerformanceObserver((entries) => {
      if (entries.getEntries().some((e) => DAI_INDEX_RE.test(e.name) || DAI_LOADER_RE.test(e.name))) {
        // Si la primera lectura aún no ha acabado, se repite al terminar.
        if (last) scheduleRefresh();
        else refreshPending = true;
      }
    }).observe({ type: "resource", buffered: false });
  } catch {}

  // Clic en el icono de la extensión.
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "toggle" && widget) setOpen(!widget.box.classList.contains("open"));
  });

  // Al volver de la bfcache no se ejecuta de nuevo el script: se repite a mano.
  addEventListener("pageshow", (e) => {
    if (e.persisted) run();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && "pillCorner" in changes && last) paintWidget(last.state, last.render);
  });

  run();
})();
