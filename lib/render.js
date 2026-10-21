/**
 * Lógica compartida por el service worker y el content script. Es un script
 * clásico (no módulo) para poder cargarlo en los dos: importScripts() en el
 * service worker y "js" en el content script.
 *
 * Qué render sirvió la página, con las mismas señales que
 * scripts/detect-render.js del pipeline de auditoría:
 *  - Cabecera X-Backend-Response del documento (la pone Varnish):
 *      "p66-pro01/468992296", "p66-test02/85909" → P66
 *      "p66-xalok-pro/…", "p66-xalok-test/…"    → P66 falló y Varnish la
 *                                                  reintentó contra Xalok
 *      sin cabecera                              → no pasó por el Varnish de
 *                                                  P66: Xalok directo
 *  - Clase del <body>: "gg" en P66, "xk" en Xalok. Dice qué HTML se pintó.
 */
(() => {
  /** "p66-pro01/468992296" → "p66-pro01". Lo de tras la barra es el xid. */
  function backendName(header) {
    if (typeof header !== "string" || header.trim() === "") return null;
    return header.trim().split("/")[0];
  }

  function renderFromBodyClass(className) {
    if (typeof className !== "string") return null;
    const classes = className.split(/\s+/);
    if (classes.includes("gg")) return "p66";
    if (classes.includes("xk")) return "xalok";
    return null;
  }

  /**
   * Combina cabecera y clase del body en un estado para la UI.
   *
   * kind:
   *  - "p66"       → lo sirve P66
   *  - "fallback"  → P66 falló y Varnish cayó a Xalok
   *  - "xalok"     → Xalok directo (sin pasar por P66)
   *  - "mismatch"  → cabecera y body se contradicen
   *  - "unknown"   → no hay señales (no es una página del grupo o aún no cargó)
   *
   * @param {{ backendHeader?: string|null, bodyClass?: string|null, headerSeen?: boolean }} s
   *   headerSeen: true si se llegó a ver la respuesta del documento. Si es
   *   false, la ausencia de cabecera no permite concluir "Xalok directo".
   */
  function classify(signals) {
    const render = classifySignals(signals);
    // Lo que queda en la etiqueta plegada: el render que se ha pintado. El
    // fallback también es Xalok; el color del semáforo ya dice que lo es.
    render.short =
      render.kind === "unknown" ? "?"
      : render.kind === "mismatch" ? (render.bodyRender === "p66" ? "P66" : "Xalok")
      : render.kind === "p66" ? "P66"
      : "Xalok";
    return render;
  }

  function classifySignals({ backendHeader, bodyClass, headerSeen }) {
    const backend = backendName(backendHeader);
    const fromBody = renderFromBodyClass(bodyClass);

    if (backend?.startsWith("p66-xalok")) {
      return {
        kind: fromBody === "p66" ? "mismatch" : "fallback",
        label: "Xalok (fallback)",
        detail: "P66 falló y Varnish devolvió Xalok",
        backend,
        bodyRender: fromBody,
      };
    }
    if (backend?.startsWith("p66-")) {
      return {
        kind: fromBody === "xalok" ? "mismatch" : "p66",
        label: "P66",
        detail: fromBody === "xalok"
          ? "La cabecera dice P66 pero el body es de Xalok"
          : "Servido por P66",
        backend,
        bodyRender: fromBody,
      };
    }
    if (fromBody === "p66") {
      return {
        kind: "p66",
        label: "P66",
        detail: "Body de P66 (sin cabecera X-Backend-Response)",
        backend,
        bodyRender: fromBody,
      };
    }
    if (fromBody === "xalok") {
      return {
        kind: "xalok",
        label: "Xalok",
        detail: headerSeen
          ? "Xalok directo: no ha pasado por P66"
          : "Body de Xalok (no se pudo leer la cabecera)",
        backend,
        bodyRender: fromBody,
      };
    }
    return {
      kind: "unknown",
      label: "?",
      detail: "Sin marcas de P66 ni de Xalok",
      backend,
      bodyRender: fromBody,
    };
  }

  /** Texto y color del icono de la extensión, por kind. Sin texto, el icono normal. */
  const BADGE = {
    p66: { text: "P66", color: "#15803d" },
    fallback: { text: "FB", color: "#ea580c" },
    xalok: { text: "XK", color: "#1d4ed8" },
    mismatch: { text: "!?", color: "#b91c1c" },
    unknown: { text: "", color: "#6b7280" },
  };

  /**
   * Assets de ggcstatic en el HTML. La versión va en la ruta:
   *   https://ggcstatic.lavanguardia.biz/minified/js/0.1.0/global.js
   * Casi todo el JS no está en <script src>: se registra como texto dentro de
   * scripts inline (gg.registry.register({ src: "…" })), así que se busca en
   * el texto del HTML, no en el DOM.
   */
  const ASSET_RE =
    /https?:\/\/ggcstatic\.(?:lavanguardia|mundodeportivo)\.(?:com|biz)\/(?:minified|unminified)\/(css|js|optimize)\/(\d+\.\d+\.\d+)\/([\w.-]+)/g;

  /**
   * Versiones que solo van en un comentario, sin URL. Solo salen en AMP:
   *  - "<!-- 1.2.34 -->" justo antes del <style> del CSS inline → css
   *  - "<!-- 0.1.31 -->" al principio de cada fragment de settings
   *    (amp-top, amp-end, amp-custom-element) → settings
   */
  const VERSION_COMMENT_RE = /<!--\s*(\d+\.\d+\.\d+)\s*-->\s*<(style|amp-|script)/g;
  const COMMENT_SOURCE = { style: "CSS inline", "amp-": "fragment AMP", script: "fragment AMP" };

  /**
   * @returns {Record<string, {versions: string[], files: Record<string, string>}>}
   *   Por tipo (css, js, optimize, settings): versiones distintas y
   *   fichero → versión. Lo que sale de un comentario lleva como "fichero" de
   *   dónde viene ("CSS inline", "fragment AMP").
   */
  function extractAssets(...texts) {
    const byType = {};
    const add = (type, version, file) => {
      byType[type] ??= { versions: [], files: {} };
      const entry = byType[type];
      if (!entry.versions.includes(version)) entry.versions.push(version);
      entry.files[file] = version;
    };
    for (const text of texts) {
      for (const [, type, version, file] of text.matchAll(ASSET_RE)) add(type, version, file);
      for (const [, version, next] of text.matchAll(VERSION_COMMENT_RE)) {
        add(next === "style" ? "css" : "settings", version, COMMENT_SOURCE[next]);
      }
    }
    return byType;
  }

  /** Tipos de assets en el orden en que se muestran. */
  const ASSET_TYPES = ["css", "js", "optimize", "settings"];

  /** Id numérico del contenido: /seccion/20260605/3528215/slug.html → 3528215. */
  function contentIdFromPath(pathname) {
    return /\/(\d{6,})\/[^/]+\.html$/.exec(pathname)?.[1] ?? null;
  }

  /**
   * Versión JSON del contenido: el documento que P66 tiene en su base de datos.
   *   www.lavanguardia.com/…/11663593/slug.html
   *     → https://p66.lavanguardia.com/contents/Xalok-11663593/json
   */
  function jsonUrlFor(pageUrl, id) {
    const m = /(lavanguardia|mundodeportivo)\.(com|biz)$/.exec(new URL(pageUrl).hostname);
    return m && id ? `https://p66.${m[1]}.${m[2]}/contents/Xalok-${id}/json` : null;
  }

  globalThis.P66Render = {
    backendName,
    renderFromBodyClass,
    classify,
    BADGE,
    extractAssets,
    ASSET_TYPES,
    contentIdFromPath,
    jsonUrlFor,
  };
})();
