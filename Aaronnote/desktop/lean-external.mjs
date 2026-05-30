/**
 * Build the argv for opening a Lean source location in a fresh Kitty window
 * running Neovim at the target position. Kept electron-free and pure so it is
 * unit-testable. LSP line/character are 0-based; Neovim `cursor()` is 1-based.
 * Paths are returned as an argv array — callers must never shell-concatenate.
 */
import { dirname } from "node:path";

export function leanExternalNvimCommand({ kitty, nvim, file, line = 0, character = 0 }) {
  const safeLine = Math.max(0, Math.floor(Number(line) || 0));
  const safeChar = Math.max(0, Math.floor(Number(character) || 0));
  return {
    command: kitty,
    args: [
      "--directory", dirname(file),
      nvim,
      `+call cursor(${safeLine + 1}, ${safeChar + 1})`,
      "--",
      file,
    ],
  };
}
