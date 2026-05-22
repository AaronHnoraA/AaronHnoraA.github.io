# Docs

Developer and maintainer documentation. Not about note content.

- [project.md](project.md): Project goals, directory ownership, data flow, maintenance boundaries
- [codebase.md](codebase.md): Code layout for `Aaronnote` and the publish pipeline
- [architecture.md](architecture.md): Tech stack, core composition, state machines, runtime logic
- [software-design.md](software-design.md): Aaronnote product/runtime design, Roam link model, UX, performance, reliability
- [api.md](api.md): Editor facade (all commands, block context, quick insert, StateEffects), renderer API, snippet system, plugin contract, Roam link conventions, layout attrs
- [maintenance.md](maintenance.md): Setup, tests, safety checks, Roam-link maintenance, release/build notes
- [status.md](status.md): Progress, test state, known bugs / limitations, next steps
- [performance-optimization.md](performance-optimization.md): Performance ledger, numeric thresholds, StateField locality decision table, edge cases, future design
- [aaronnote-html-controls.md](aaronnote-html-controls.md): Note-level CSS, layout attrs, HTML blocks, and common DOM shapes
- [aaronnote-kinds.md](aaronnote-kinds.md): `kind` lazy-load extension, asset layout, and slides demo
- [app-native-migration-plan.md](app-native-migration-plan.md): HTTP → Electron IPC migration plan and progress (Phases 0–4, completed)
- [roam-db-incremental-sync.md](roam-db-incremental-sync.md): Roam DB incremental sync + Git version management design
- [../plugin/README.md](../plugin/README.md): Local plugin directory and command syntax conventions

Recommended reading order:

1. `project.md`
2. `codebase.md`
3. `architecture.md`
4. `software-design.md`
5. `api.md`
6. `maintenance.md`
7. `performance-optimization.md`
8. `aaronnote-html-controls.md`
9. `aaronnote-kinds.md`
10. `../plugin/README.md`
11. `status.md`
