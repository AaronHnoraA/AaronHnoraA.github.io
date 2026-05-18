#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });
window.document.write("<!doctype html><html><head></head><body></body></html>");
Object.defineProperty(window.document, "compatMode", {
  value: "CSS1Compat",
  configurable: true,
});

for (const [key, value] of Object.entries({
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  HTMLImageElement: window.HTMLImageElement,
  Image: window.Image,
  Element: window.Element,
  Node: window.Node,
  Text: window.Text,
  DOMParser: window.DOMParser,
  XMLSerializer: window.XMLSerializer,
  MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  performance: window.performance,
})) {
  Object.defineProperty(globalThis, key, { value, configurable: true });
}

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const { renderMarkdownHTML } = await import("../src/render-html.ts");

const html = renderMarkdownHTML(String(input.markdown ?? ""));
process.stdout.write(JSON.stringify({ html }));
