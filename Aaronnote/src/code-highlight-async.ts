import { highlightCode, type CodeHighlightRange } from "./code-highlight.ts";

type HighlightResponse = {
  id: number;
  ranges: CodeHighlightRange[];
};

const WORKER_HIGHLIGHT_THRESHOLD = 12_000;
const ASYNC_CACHE_LIMIT = 192;

const asyncCache = new Map<string, CodeHighlightRange[]>();
const pending = new Map<number, string>();
const pendingKeys = new Set<string>();
const listeners = new Set<() => void>();
let worker: Worker | null | undefined;
let nextRequestId = 1;
let readyVersion = 0;

function cacheKey(lang: string, text: string): string {
  return `${lang.trim().toLowerCase()}\u0000${text}`;
}

function remember(key: string, ranges: CodeHighlightRange[]): CodeHighlightRange[] {
  asyncCache.set(key, ranges);
  while (asyncCache.size > ASYNC_CACHE_LIMIT) {
    const oldest = asyncCache.keys().next().value as string | undefined;
    if (oldest == null) break;
    asyncCache.delete(oldest);
  }
  return ranges;
}

function notifyReady(): void {
  readyVersion++;
  for (const listener of listeners) listener();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === "undefined") {
    worker = null;
    return worker;
  }
  try {
    worker = new Worker(new URL("./code-highlight-worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<HighlightResponse>) => {
      const key = pending.get(event.data.id);
      if (!key) return;
      pending.delete(event.data.id);
      pendingKeys.delete(key);
      remember(key, event.data.ranges);
      notifyReady();
    });
    worker.addEventListener("error", () => {
      for (const key of pending.values()) pendingKeys.delete(key);
      pending.clear();
      worker?.terminate();
      worker = null;
    });
  } catch {
    worker = null;
  }
  return worker;
}

export function onCodeHighlightReady(listener: () => void): () => void {
  listeners.add(listener);
  if (readyVersion > 0) void Promise.resolve().then(listener);
  return () => listeners.delete(listener);
}

export function highlightCodeForEditor(lang: string, text: string): CodeHighlightRange[] {
  if (text.length < WORKER_HIGHLIGHT_THRESHOLD) return highlightCode(lang, text);

  const key = cacheKey(lang, text);
  const cached = asyncCache.get(key);
  if (cached) {
    asyncCache.delete(key);
    asyncCache.set(key, cached);
    return cached;
  }

  const backgroundWorker = getWorker();
  if (!backgroundWorker) return highlightCode(lang, text);
  if (!pendingKeys.has(key)) {
    const id = nextRequestId++;
    pending.set(id, key);
    pendingKeys.add(key);
    backgroundWorker.postMessage({ id, lang, text });
  }
  return [];
}
