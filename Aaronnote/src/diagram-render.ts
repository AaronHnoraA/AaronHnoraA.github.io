import DOMPurify from "dompurify";
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
  });
}

function enableDiagramInteraction(element: HTMLElement): void {
  const svg = element.querySelector<SVGSVGElement>("svg");
  if (!svg || element.querySelector(".cm-diagram-toolbar")) return;

  element.classList.add("cm-diagram-interactive");
  svg.style.maxWidth = "none";
  svg.style.transformOrigin = "0 0";

  let scale = 1;
  let drag: { x: number; y: number; left: number; top: number } | null = null;

  const applyScale = (next: number): void => {
    scale = Math.min(2.4, Math.max(0.55, next));
    svg.style.width = `${scale * 100}%`;
  };

  const toolbar = document.createElement("div");
  toolbar.className = "cm-diagram-toolbar";
  const controls: Array<[string, string, () => void]> = [
    ["+", "Zoom in", () => applyScale(scale + 0.15)],
    ["-", "Zoom out", () => applyScale(scale - 0.15)],
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

  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, left: element.scrollLeft, top: element.scrollTop };
    svg.setPointerCapture(event.pointerId);
    element.classList.add("is-panning");
  });
  svg.addEventListener("pointermove", (event) => {
    if (!drag) return;
    element.scrollLeft = drag.left - (event.clientX - drag.x);
    element.scrollTop = drag.top - (event.clientY - drag.y);
  });
  const endDrag = (): void => {
    drag = null;
    element.classList.remove("is-panning");
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  element.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    applyScale(scale + (event.deltaY < 0 ? 0.12 : -0.12));
  }, { passive: false });
}

export function renderMermaidLazy(
  source: string,
  element: HTMLElement,
  onError: (message: string) => void,
): void {
  const trimmed = source.trim();
  const key = `mermaid\n${trimmed}`;
  element.setAttribute("data-diagram-render-key", key);
  element.classList.remove("aaronnote-diagram-error");
  if (!trimmed) {
    element.replaceChildren();
    return;
  }
  if (trimmed.length > MAX_MERMAID_SOURCE_CHARS) {
    onError("Diagram is too large to render inline");
    return;
  }

  const cached = cachedMermaid(key);
  if (cached) {
    if (cached.error) onError(cached.error);
    else {
      element.innerHTML = cached.html;
      enableDiagramInteraction(element);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rememberMermaid(key, { html: "", error: message });
      if (element.getAttribute("data-diagram-render-key") !== key) return;
      onError(message);
    }
  })();
}
