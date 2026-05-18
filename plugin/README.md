# Aaronnote Plugin Workspace

This directory is reserved for local Aaronnote plugins and plugin API drafts.

The current stable parser surface is command syntax:

- inline command: `@@cmd(switch) [context]{arg: value}`
- block command: `#+begin kind title` ... `#+end kind`

Core code currently exposes these parser primitives in `Aaronnote/src/command-syntax.ts`.
Server-side indexing mirrors the inline command scanner for agenda and future APIs.

## Proposed Plugin Shape

```text
plugin/
  my-plugin/
    plugin.json
    index.ts
    README.md
```

`plugin.json` should stay small:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "entry": "index.ts",
  "commands": ["my-command"],
  "blocks": ["my-block"]
}
```

No runtime loader is wired yet. Until then, plugins should be treated as local experiments that can be promoted into `Aaronnote/src/features/` once their parser/UI contract is clear.
