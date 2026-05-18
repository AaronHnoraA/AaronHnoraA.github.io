import DOMPurify from "dompurify";

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

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().split(/\s+/, 1)[0] ?? "";
}

export function supportedDiagramLang(lang: string): boolean {
  return normalizeLang(lang) === "mermaid";
}

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
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
    else element.innerHTML = cached.html;
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
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rememberMermaid(key, { html: "", error: message });
      if (element.getAttribute("data-diagram-render-key") !== key) return;
      onError(message);
    }
  })();
}
