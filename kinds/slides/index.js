const CONTROL_CLASS = "aaronnote-slides-controls";
const PROGRESS_CLASS = "aaronnote-slides-progress";
const SURFACE_CLASS = "aaronnote-slides-surface";
const HIDDEN_CLASS = "aaronnote-slide-hidden";

function slideSurface(context) {
  return context?.article
    || context?.host?.querySelector?.(".ProseMirror")
    || document.querySelector("#content")
    || document.querySelector(".ProseMirror");
}

function slideChildren(surface) {
  return Array.from(surface.children).filter((child) => {
    if (!(child instanceof HTMLElement)) return false;
    if (child.classList.contains(CONTROL_CLASS) || child.classList.contains(PROGRESS_CLASS)) return false;
    if (child.matches("script, style")) return false;
    return true;
  });
}

function buildSlides(surface) {
  const slides = [];
  let current = [];
  for (const child of slideChildren(surface)) {
    const isBreak = child.matches("hr");
    const isHeadingStart = child.matches("h1") && current.some((item) => !item.matches('org-env-block[data-kind="meta"]'));
    if (isBreak || isHeadingStart) {
      if (current.length > 0) slides.push(current);
      current = [];
      if (isBreak) continue;
    }
    current.push(child);
  }
  if (current.length > 0) slides.push(current);
  return slides.length > 0 ? slides : [slideChildren(surface)];
}

function makeControls() {
  const controls = document.createElement("div");
  controls.className = CONTROL_CLASS;
  controls.innerHTML = `
    <button type="button" data-slide-action="prev">Prev</button>
    <span class="aaronnote-slides-counter" data-slide-counter></span>
    <button type="button" data-slide-action="next">Next</button>
  `;

  const progress = document.createElement("div");
  progress.className = PROGRESS_CLASS;
  progress.innerHTML = "<span></span>";

  document.body.append(controls, progress);
  return { controls, progress };
}

function editableTarget(event) {
  const target = event.target;
  return target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export default function setup(initialContext = {}) {
  let context = initialContext;
  let surface = null;
  let controls = null;
  let progress = null;
  let slides = [];
  let index = 0;

  function resetSurface() {
    if (!surface) return;
    surface.classList.remove(SURFACE_CLASS);
    for (const child of slideChildren(surface)) {
      child.classList.remove(HIDDEN_CLASS);
      child.removeAttribute("data-slide-index");
      child.removeAttribute("data-slide-active");
    }
  }

  function ensureControls() {
    if (controls && progress) return;
    const created = makeControls();
    controls = created.controls;
    progress = created.progress;
    controls.querySelector('[data-slide-action="prev"]')?.addEventListener("click", () => show(index - 1));
    controls.querySelector('[data-slide-action="next"]')?.addEventListener("click", () => show(index + 1));
  }

  function removeControls() {
    controls?.remove();
    progress?.remove();
    controls = null;
    progress = null;
  }

  function show(nextIndex) {
    if (!surface || slides.length === 0) return;
    index = Math.max(0, Math.min(nextIndex, slides.length - 1));
    slides.forEach((slide, slideIndex) => {
      for (const child of slide) {
        child.classList.toggle(HIDDEN_CLASS, slideIndex !== index);
        child.dataset.slideIndex = String(slideIndex + 1);
        child.dataset.slideActive = slideIndex === index ? "true" : "false";
      }
    });
    const counter = controls?.querySelector("[data-slide-counter]");
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
    controls?.querySelector('[data-slide-action="prev"]')?.toggleAttribute("disabled", index === 0);
    controls?.querySelector('[data-slide-action="next"]')?.toggleAttribute("disabled", index === slides.length - 1);
    progress?.style.setProperty("--slides-progress", `${((index + 1) / slides.length) * 100}%`);
  }

  function rebuild(nextContext = context) {
    context = nextContext;
    resetSurface();
    surface = slideSurface(context);
    if (!surface) {
      removeControls();
      return;
    }
    surface.classList.add(SURFACE_CLASS);
    slides = buildSlides(surface).filter((slide) => slide.length > 0);
    if (slides.length <= 1) {
      removeControls();
    } else {
      ensureControls();
    }
    show(Math.min(index, Math.max(0, slides.length - 1)));
  }

  function onKindReady(event) {
    if (event?.detail?.kind === "slides") rebuild(event.detail);
  }

  function onKeydown(event) {
    if (editableTarget(event) && !event.altKey) return;
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
      event.preventDefault();
      show(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      show(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      show(0);
    } else if (event.key === "End") {
      event.preventDefault();
      show(slides.length - 1);
    }
  }

  window.addEventListener("aaronnote:kind-ready", onKindReady);
  window.addEventListener("keydown", onKeydown);
  rebuild(context);

  return () => {
    window.removeEventListener("aaronnote:kind-ready", onKindReady);
    window.removeEventListener("keydown", onKeydown);
    resetSurface();
    removeControls();
  };
}
