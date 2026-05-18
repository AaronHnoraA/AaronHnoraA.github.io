# Roam Lookup

Aaronnote plugin for interactive read-only lookup over the local Roam knowledge base.

The plugin adds a `Roam lookup` tab under the Notes page. Opening it starts a lightweight server-side session. Each query runs Codex with `agent/skill/lookup.md`, `--sandbox read-only`, and the same Codex auth/token available to the Aaronnote server process.

Resources are released when:

- the panel has no user interaction for 60 seconds
- the user clicks `Close`
- the plugin is disabled or unloaded
- the Aaronnote server shuts down

Server API:

- `POST /api/roamlookup/start`
- `POST /api/roamlookup/query`
- `POST /api/roamlookup/close`
- `GET /api/roamlookup/status`
