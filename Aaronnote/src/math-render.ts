import temml, { type Options as TemmlOptions } from "temml";

type KatexRenderOptions = {
  displayMode?: boolean;
  throwOnError?: boolean;
  strict?: boolean | "error" | "ignore" | "warn";
  trust?: boolean;
  output?: "html" | "mathml" | "htmlAndMathml";
};

const mathHtmlCache = new Map<string, { html: string; error?: string }>();

export function renderMathLazy(
  tex: string,
  element: HTMLElement,
  options: KatexRenderOptions,
  onError: () => void,
): void {
  const key = `${options.displayMode ? "display" : "inline"}\n${tex}`;
  element.setAttribute("data-math-render-key", key);
  const cached = mathHtmlCache.get(key);
  if (cached) {
    element.innerHTML = cached.html;
    if (cached.error) element.setAttribute("data-temml-error", cached.error);
    return;
  }

  try {
    temml.render(tex, element, temmlOptions(options));
    mathHtmlCache.set(key, { html: element.innerHTML });
  } catch (temmlError) {
    if (element.getAttribute("data-math-render-key") !== key) return;
    void renderKatexFallback(tex, element, options, key, onError, temmlError);
  }
}

function temmlOptions(options: KatexRenderOptions): TemmlOptions {
  return {
    displayMode: options.displayMode,
    throwOnError: true,
    strict: options.strict === true || options.strict === "error",
    trust: options.trust,
  };
}

async function renderKatexFallback(
  tex: string,
  element: HTMLElement,
  options: KatexRenderOptions,
  key: string,
  onError: () => void,
  temmlError: unknown,
): Promise<void> {
  try {
    const [{ default: katex }, { default: katexCssUrl }] = await Promise.all([
      import("katex"),
      import("katex/dist/katex.min.css?url"),
    ]);
    if (element.getAttribute("data-math-render-key") !== key) return;
    ensureKatexCss(katexCssUrl);
    katex.render(tex, element, { ...options, throwOnError: true });
    mathHtmlCache.set(key, { html: element.innerHTML });
  } catch {
    if (element.getAttribute("data-math-render-key") !== key) return;
    if (temmlError instanceof Error) element.setAttribute("data-temml-error", temmlError.message);
    onError();
    mathHtmlCache.set(key, {
      html: element.innerHTML,
      error: temmlError instanceof Error ? temmlError.message : String(temmlError),
    });
  }
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
