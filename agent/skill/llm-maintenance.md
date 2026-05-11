# Codex LLM Maintenance Task

You are maintaining Aaron's AI-facing layer for a Typst note system.

Typst files under `roam/` are canonical. Note metadata uses `#metadata((kind: "note", id: ..., title: ...)) <note>`, and note links use `#note("id")[Title]`.

## Current Boundary

The old generated `agent/index/` and `agent/wiki/` files are preserved for now. Do not refresh or redesign them until the Typst index migration is explicitly requested.

## Allowed Work

- Keep `agent/` documentation accurate.
- Keep lookup prompts pointed at original `.typ` sources.
- Keep maintenance scripts from referencing org-roam as an active dependency.
- Do not modify human-authored Typst notes unless the user explicitly asked for note edits.

## Checks

```sh
python3 -B -m py_compile agent/skill/check_agent_text_limits.py
python3 agent/skill/check_agent_text_limits.py
```
