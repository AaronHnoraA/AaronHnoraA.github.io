# Roam Lookup

Aaronnote plugin for interactive read-only lookup over the local Roam knowledge base.

The plugin adds a `Roam lookup` tab under the Notes page. Opening it starts a
lightweight local session through the Electron native bridge. Each query runs
Codex with `agent/skill/lookup.md`, `--sandbox read-only`, and the same Codex
auth/token available to the AaronNote app process.

Resources are released when:

- the panel has no user interaction for 60 seconds
- the user clicks `Close`
- the plugin is disabled or unloaded
- the AaronNote app shuts down

Native bridge:

- `aaronnoteApi.roamlookup.start`
- `aaronnoteApi.roamlookup.query`
- `aaronnoteApi.roamlookup.close`
- `aaronnoteApi.roamlookup.status`
