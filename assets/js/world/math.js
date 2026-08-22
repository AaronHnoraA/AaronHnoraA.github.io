/*
 * math.js — 3D-only KaTeX rendering helpers.
 * KaTeX itself is vendored under /vendor/katex and keeps its MIT licence.
 */

import katex from '../../../vendor/katex/katex.mjs';

const STYLE_ID = 'world-katex-style';

export function ensureMathStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement('link');
  link.id = STYLE_ID;
  link.rel = 'stylesheet';
  link.href = new URL('../../../vendor/katex/katex.min.css', import.meta.url).href;
  document.head.appendChild(link);
}

export function renderMath(element, source, { displayMode = false } = {}) {
  if (!element) return;
  katex.render(source, element, {
    displayMode,
    throwOnError: false,
    strict: 'ignore',
    trust: false,
    output: 'htmlAndMathml',
  });
}
