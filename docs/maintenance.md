# Aaronnote Maintenance Guide

This guide is for keeping Aaronnote reliable while changing editor behavior, Roam links, performance, or native APIs.

## Setup

```sh
cd Aaronnote
npm install
npm test
npm run build:aaronnote
```

Use `npm run start:vite` for the renderer dev server and `npm run build:desktop` for the Electron bundle.

## Before Changing Code

Identify the layer first:

- Editor source behavior: `Aaronnote/src/cm6/`
- App UX and navigation: `Aaronnote/aaronnote/`
- Save/index/API behavior: `Aaronnote/server/lib/` and the Electron IPC bridge in `Aaronnote/desktop/`
- Desktop menu/window lifecycle: `Aaronnote/desktop/`
- Publish output: `bin/publish-site`
- Plugin behavior: `plugin/<id>/`

Do not mix unrelated layers unless the feature contract crosses them. A Roam link feature often does cross layers: editor rendering, app navigation, server ref detection, and docs all need to agree.

## Test Strategy

Use focused tests while iterating, then broader checks before finishing.

Focused examples:

```sh
cd Aaronnote
npm test -- tests/server-refs.test.ts
npm test -- tests/server-save.test.ts
npm test -- tests/cm6/roundtrip.test.ts
npm test -- tests/cm6/commands.test.ts
```

Broader checks:

```sh
cd Aaronnote
npm test
npm run build:aaronnote
```

If a change touches Electron-only behavior, at minimum run:

```sh
cd Aaronnote
node --check desktop/main.mjs
node --check desktop/preload.cjs
node --check server/lib/runtime.mjs
```

## Save And Conflict Safety

The save path must preserve external edits:

- Client sends `baseMtimeMs`.
- Server compares against current file mtime.
- If mtime differs and `force` is not set, return `409` with `conflict: true`.
- Client exposes force save as an explicit action.
- Normal saves can request `refresh: "deferred"` to avoid rebuilding the whole notes list in the input path.

When editing this code, verify both the success and conflict paths.

## Roam Link Maintenance

Whenever a Roam link convention changes, update all of these together:

- App parser/navigation in `Aaronnote/aaronnote/main.ts`
- Server ref extraction in `Aaronnote/server/lib/index.mjs` and its current
  implementation exports
- Live-preview styling in `Aaronnote/src/cm6/live-preview.ts`
- HTML rendering in `Aaronnote/src/render-html.ts`
- Tests in `Aaronnote/tests/server-refs.test.ts` and CM6 tests if click behavior changes
- [api.md](api.md) and [software-design.md](software-design.md)

Current canonical conventions:

- `id#tag` for inline anchor targets.
- `id@dom` for title/heading/DOM targets.
- `./#tag` and `./@dom` for current-file targets.
- `roam://id#tag` and `roam://id@dom` for explicit Roam-id links.

Legacy `#tag-...` links should remain readable.

## Performance Maintenance

Performance changes should move work out of the active input path. Prefer:

- Debounce for find, snippets, graph, notes refresh, and index refresh.
- Idle or deferred rendering for heavyweight previews.
- Lightweight save responses followed by deferred notes refresh.
- Decoration mapping/reuse for transactions that do not affect a feature.
- Local source-window payloads for external services instead of full document payloads.

Record new performance work in [performance-optimization.md](performance-optimization.md), including risk and verification.

## Reliability Checklist

Before completing a change, check:

- Does it preserve Markdown source round-trip?
- Does it keep save conflicts recoverable?
- Does it avoid full workspace scans on keystrokes?
- Does it clean up timers, child processes, event listeners, and panels?
- Does it work with multiple windows?
- Does it avoid breaking standalone Markdown files?
- Does it update tests and docs when a public convention changes?

## Release/Build Notes

The package build and desktop build have different scopes:

- `npm run build:aaronnote` validates TypeScript and web app bundling.
- `npm run build:desktop` also validates Electron and packages a macOS directory build.
- Root `make build` delegates to the project-level build flow.

Do not treat files under `public/`, `agent/index/`, or `agent/wiki/` as authoritative source. They are derived outputs and should only be changed by the relevant generation step.

## Operational Notes

Recent notes and cursor positions are convenience state. If they fail to persist, the Markdown files are still authoritative.

Roam lookup sessions are server-side child processes. They should be idle-closed and explicitly terminated when the user closes the panel. The client must not show a plugin panel under the wrong notes tab; use `data-notes-panel` so the app-level tab switcher can hide it.
