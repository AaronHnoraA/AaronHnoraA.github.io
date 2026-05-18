import katex from "katex";
import katexCssUrl from "katex/dist/katex.min.css?url";

type KatexRenderOptions = {
  displayMode?: boolean;
  throwOnError?: boolean;
  strict?: boolean | "error" | "ignore" | "warn";
  trust?: boolean;
  output?: "html" | "mathml" | "htmlAndMathml";
  deferUntilIdle?: boolean;
};

const mathHtmlCache = new Map<string, { html: string; error?: string }>();
const MATH_HTML_CACHE_LIMIT = 320;

function cachedMathHtml(key: string): { html: string; error?: string } | undefined {
  const cached = mathHtmlCache.get(key);
  if (!cached) return undefined;
  mathHtmlCache.delete(key);
  mathHtmlCache.set(key, cached);
  return cached;
}

function rememberMathHtml(key: string, value: { html: string; error?: string }): void {
  mathHtmlCache.set(key, value);
  while (mathHtmlCache.size > MATH_HTML_CACHE_LIMIT) {
    const oldest = mathHtmlCache.keys().next().value as string | undefined;
    if (oldest == null) break;
    mathHtmlCache.delete(oldest);
  }
}

export function clearMathRenderCache(): void {
  mathHtmlCache.clear();
}

export function mathRenderCacheSize(): number {
  return mathHtmlCache.size;
}

export function renderMathHTML(
  tex: string,
  options: KatexRenderOptions,
): { html: string; error?: string } {
  const key = `${options.displayMode ? "display" : "inline"}\n${tex}`;
  const cached = cachedMathHtml(key);
  if (cached) return cached;
  try {
    const html = katex.renderToString(tex, katexOptions(options));
    const rendered = { html };
    rememberMathHtml(key, rendered);
    return rendered;
  } catch (error) {
    return {
      html: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function renderMathLazy(
  tex: string,
  element: HTMLElement,
  options: KatexRenderOptions,
  onError: () => void,
): void {
  const key = `${options.displayMode ? "display" : "inline"}\n${tex}`;
  element.setAttribute("data-math-render-key", key);
  const cached = cachedMathHtml(key);
  if (cached) {
    applyRenderedMath(element, key, cached, onError);
    return;
  }
  if (options.deferUntilIdle === true) {
    element.textContent = tex;
    const idle = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 16));
    idle(() => {
      if (element.getAttribute("data-math-render-key") !== key || !element.isConnected) return;
      applyRenderedMath(element, key, renderMathHTML(tex, options), onError);
    }, { timeout: 500 });
    return;
  }
  applyRenderedMath(element, key, renderMathHTML(tex, options), onError);
}

function applyRenderedMath(
  element: HTMLElement,
  key: string,
  rendered: { html: string; error?: string },
  onError: () => void,
): void {
  if (!rendered.error) {
    ensureKatexCss(katexCssUrl);
    element.innerHTML = rendered.html;
    fitRenderedMath(element);
    return;
  }
  if (element.getAttribute("data-math-render-key") !== key) return;
  onError();
  rememberMathHtml(key, rendered);
  fitRenderedMath(element);
}

function katexOptions(options: KatexRenderOptions): KatexRenderOptions {
  return {
    displayMode: options.displayMode,
    throwOnError: true,
    strict: options.strict,
    trust: options.trust,
    output: options.output,
  };
}

function ensureKatexCss(href: string): void {
  const loaded = Array.from(document.querySelectorAll("link[data-aaronnote-katex-css]"))
    .some((link) => link.getAttribute("data-aaronnote-katex-css") === href);
  if (loaded) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.aaronnoteKatexCss = href;
  document.head.appendChild(link);
}

function fitRenderedMath(element: HTMLElement): void {
  const schedule = window.requestAnimationFrame?.bind(window) ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  schedule(() => {
    if (!element.isConnected) return;
    const child = firstRenderableChild(element);
    if (!child) return;
    child.style.transform = "";
    child.style.transformOrigin = "";
    child.style.display = "";
    child.style.maxWidth = "";
    element.style.minHeight = "";
    element.classList.remove("is-math-scaled");

    const available = Math.max(1, element.clientWidth || element.parentElement?.clientWidth || window.innerWidth - 32);
    const natural = Math.max(child.scrollWidth, child.getBoundingClientRect().width);
    if (!Number.isFinite(natural) || natural <= available) return;

    const scale = Math.max(0.54, Math.min(1, (available - 2) / natural));
    if (scale >= 0.995) return;
    child.style.display = "inline-block";
    child.style.transform = `scale(${scale})`;
    child.style.transformOrigin = "center top";
    child.style.maxWidth = `${100 / scale}%`;
    element.classList.add("is-math-scaled");

    const height = child.getBoundingClientRect().height;
    if (height > 0) element.style.minHeight = `${Math.ceil(height)}px`;
  });
}

function firstRenderableChild(element: HTMLElement): HTMLElement | null {
  const preferred = element.querySelector<HTMLElement>(".katex-display, .katex, math, mjx-container");
  if (preferred) return preferred;
  return element.firstElementChild instanceof HTMLElement ? element.firstElementChild : null;
}
