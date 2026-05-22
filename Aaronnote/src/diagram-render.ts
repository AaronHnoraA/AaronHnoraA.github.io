import DOMPurify from "dompurify";
import { safeHref } from "./url-safety.ts";
export { supportedDiagramLang } from "./diagram-langs.ts";

type DiagramCacheValue = { html: string; error?: string };

const MERMAID_CACHE_LIMIT = 96;
const MAX_MERMAID_SOURCE_CHARS = 80_000;
const mermaidCache = new Map<string, DiagramCacheValue>();
let renderSeq = 0;

function cachedMermaid(key: string): DiagramCacheValue | undefined {
  const cached = mermaidCache.get(key);
  if (!cached) return undefined;
  mermaidCache.delete(key);
  mermaidCache.set(key, cached);
  return cached;
}

function rememberMermaid(key: string, value: DiagramCacheValue): void {
  mermaidCache.set(key, value);
  while (mermaidCache.size > MERMAID_CACHE_LIMIT) {
    const oldest = mermaidCache.keys().next().value as string | undefined;
    if (oldest == null) break;
    mermaidCache.delete(oldest);
  }
}

export function clearDiagramRenderCache(): void {
  mermaidCache.clear();
}

export function diagramRenderCacheSize(): number {
  return mermaidCache.size;
}

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_ATTR: ["href", "xlink:href", "target", "title"],
  });
}

function sanitizeDiagramLinks(element: HTMLElement): void {
  element.querySelectorAll<SVGElement>("a").forEach((anchor) => {
    const href = anchor.getAttribute("href")
      || anchor.getAttribute("xlink:href")
      || anchor.getAttributeNS("http://www.w3.org/1999/xlink", "href")
      || "";
    if (!href || !safeHref(href)) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("xlink:href");
      anchor.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
      return;
    }
    anchor.setAttribute("href", href);
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
}

const MERMAID_START_RE = /^(?:mindmap|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|timeline|quadrantChart|sankey-beta|xychart-beta|block-beta|packet-beta)\b/i;
const MINDMAP_LANGS = new Set(["mindmap", "marmind", "markmind"]);

function diagramLang(info = ""): string {
  return String(info || "").trim().toLowerCase().split(/\s+/, 1)[0] ?? "";
}

function cleanMindmapText(value: string): string {
  return value
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
}

function normalizeMindmapSource(source: string): string {
  const lines = String(source || "").replace(/\t/g, "  ").split(/\r?\n/);
  const meaningful = lines.filter((line) => line.trim());
  if (meaningful.length === 0) return "";
  if (MERMAID_START_RE.test(meaningful[0]!.trim())) return source.trim();

  const normalized = meaningful.map((line, index) => {
    const rawIndent = line.match(/^\s*/)?.[0].length ?? 0;
    const heading = line.match(/^\s*(#{1,6})\s+(.+)$/);
    const bullet = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.+)$/);
    const level = heading
      ? heading[1]!.length - 1
      : bullet
        ? Math.floor((bullet[1]?.length ?? 0) / 2)
        : Math.floor(rawIndent / 2);
    const text = cleanMindmapText(heading?.[2] ?? bullet?.[2] ?? line);
    return `${"  ".repeat(Math.max(1, level + 1))}${text || `Node ${index + 1}`}`;
  });
  return ["mindmap", ...normalized].join("\n");
}

export function normalizeMermaidSource(source: string, info = ""): string {
  return MINDMAP_LANGS.has(diagramLang(info)) ? normalizeMindmapSource(source) : source;
}

function diagramHrefFromAnchor(anchor: SVGElement): string {
  return anchor.getAttribute("href")
    || anchor.getAttribute("xlink:href")
    || anchor.getAttributeNS("http://www.w3.org/1999/xlink", "href")
    || "";
}

function primaryLinkModifier(event: MouseEvent): boolean {
  if (event.metaKey && !event.ctrlKey) return true;
  return !/Mac/.test(navigator.platform) && event.ctrlKey && !event.metaKey;
}

function dispatchDiagramLink(element: HTMLElement, event: MouseEvent, href: string): void {
  if (!safeHref(href)) return;
  event.preventDefault();
  event.stopPropagation();
  const openEvent = new CustomEvent("aaronnote:open-url", {
    bubbles: true,
    cancelable: true,
    detail: { href, newWindow: event.button === 1 || primaryLinkModifier(event) },
  });
  element.dispatchEvent(openEvent);
  if (!openEvent.defaultPrevented) {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}

function selectedDiagramNode(target: EventTarget | null): SVGElement | null {
  if (!(target instanceof SVGElement)) return null;
  return target.closest<SVGElement>("a, g.node, g.mindmap-node, g[class*='node'], g[id]")
    ?? target.closest<SVGElement>("text");
}

export function enableDiagramInteraction(element: HTMLElement): void {
  const svg = element.querySelector<SVGSVGElement>("svg");
  if (!svg || element.querySelector(".cm-diagram-toolbar")) return;

  element.classList.add("cm-diagram-interactive");
  element.style.overflow = "auto";
  svg.style.maxWidth = "none";
  svg.style.transformOrigin = "0 0";
  sanitizeDiagramLinks(element);

  let scale = 1;
  let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  let suppressNextClick = false;

  const applyScale = (next: number): void => {
    scale = Math.min(2.4, Math.max(0.55, next));
    svg.style.width = `${scale * 100}%`;
  };
  const fitWidth = (): void => {
    try {
      const box = svg.getBBox();
      if (box.width > 0 && element.clientWidth > 0) {
        applyScale(element.clientWidth / box.width);
      } else {
        applyScale(1);
      }
    } catch {
      applyScale(1);
    }
    element.scrollLeft = 0;
    element.scrollTop = 0;
  };

  const toolbar = document.createElement("div");
  toolbar.className = "cm-diagram-toolbar";
  const controls: Array<[string, string, () => void]> = [
    ["+", "Zoom in", () => applyScale(scale + 0.15)],
    ["-", "Zoom out", () => applyScale(scale - 0.15)],
    ["Fit", "Fit width", fitWidth],
    ["1:1", "Reset zoom", () => applyScale(1)],
  ];
  for (const [text, label, action] of controls) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
    toolbar.append(button);
  }
  element.prepend(toolbar);

  element.addEventListener("mousedown", (event) => {
    const target = event.target;
    if (
      target instanceof Element
      && target.closest(".cm-diagram-toolbar, svg")
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop, moved: false };
    svg.setPointerCapture(event.pointerId);
    element.classList.add("is-panning");
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    element.scrollLeft = drag.left - (event.clientX - drag.x);
    element.scrollTop = drag.top - (event.clientY - drag.y);
  });
  const endDrag = (): void => {
    suppressNextClick = Boolean(drag?.moved);
    drag = null;
    element.classList.remove("is-panning");
    if (suppressNextClick) window.setTimeout(() => { suppressNextClick = false; }, 0);
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  element.addEventListener("click", (event) => {
    if (suppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = false;
      return;
    }
    const anchor = (event.target as Element | null)?.closest<SVGElement>("a");
    if (anchor) {
      const href = diagramHrefFromAnchor(anchor);
      if (href) dispatchDiagramLink(element, event, href);
      return;
    }
    const node = selectedDiagramNode(event.target);
    if (!node) return;
    element.querySelectorAll(".cm-diagram-selected").forEach((selected) => {
      selected.classList.remove("cm-diagram-selected");
    });
    node.classList.add("cm-diagram-selected");
  });
  element.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    fitWidth();
  });
  element.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) {
      if (event.shiftKey) {
        event.preventDefault();
        element.scrollLeft += event.deltaY || event.deltaX;
      }
      return;
    }
    event.preventDefault();
    applyScale(scale + (event.deltaY < 0 ? 0.12 : -0.12));
  }, { passive: false });
}

export function renderMermaidLazy(
  source: string,
  element: HTMLElement,
  onError: (message: string) => void,
  options: { lang?: string; onRender?: () => void } = {},
): void {
  const trimmed = normalizeMermaidSource(source, options.lang).trim();
  const key = `mermaid\n${trimmed}`;
  element.setAttribute("data-diagram-render-key", key);
  element.classList.remove("aaronnote-diagram-error");
  if (!trimmed) {
    element.replaceChildren();
    options.onRender?.();
    return;
  }
  if (trimmed.length > MAX_MERMAID_SOURCE_CHARS) {
    onError("Diagram is too large to render inline");
    options.onRender?.();
    return;
  }

  const cached = cachedMermaid(key);
  if (cached) {
    if (cached.error) {
      onError(cached.error);
      options.onRender?.();
    } else {
      element.innerHTML = cached.html;
      enableDiagramInteraction(element);
      options.onRender?.();
    }
    return;
  }

  const seq = ++renderSeq;
  element.textContent = "Rendering diagram...";
  void (async () => {
    await new Promise<void>((resolve) => {
      const idle = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 16));
      idle(() => resolve(), { timeout: 180 });
    });
    if (element.getAttribute("data-diagram-render-key") !== key) return;
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "default",
      });
      const id = `aaronnote-mermaid-${Date.now()}-${seq}`;
      const result = await mermaid.render(id, trimmed);
      if (element.getAttribute("data-diagram-render-key") !== key) return;
      const html = sanitizeSvg(result.svg);
      rememberMermaid(key, { html });
      element.innerHTML = html;
      enableDiagramInteraction(element);
      options.onRender?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rememberMermaid(key, { html: "", error: message });
      if (element.getAttribute("data-diagram-render-key") !== key) return;
      onError(message);
      options.onRender?.();
    }
  })();
}
