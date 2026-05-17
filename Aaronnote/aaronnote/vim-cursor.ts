import type { Editor } from "../src/lib.ts";
import type { VimLiteMode } from "./vim-lite.ts";

export function createVimCursor(): HTMLElement {
  const el = document.createElement("div");
  el.className = "aaronnote-vim-cursor";
  el.hidden = true;
  document.body.appendChild(el);
  return el;
}

export function updateVimCursor(
  el: HTMLElement,
  editor: Editor,
  mode: VimLiteMode,
  ctx = editor.cursorContext(1600),
): void {
  if (mode === "insert" || !ctx.rect) {
    el.hidden = true;
    return;
  }
  const height = Math.max(16, ctx.rect.bottom - ctx.rect.top);
  const width = mode === "visual-line" ? 4 : Math.max(8, Math.min(14, height * 0.58));
  el.style.left = `${ctx.rect.left}px`;
  el.style.top = `${ctx.rect.top}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.hidden = false;
}
