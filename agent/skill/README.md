# Agent Skills

Reusable AI maintenance tools live here.

- `llm-maintenance.md`: prompt used by `make llm` to delegate targeted maintenance to Codex.
- `maintain.py`: scans `roam/**/*.org` and regenerates `agent/index/` plus `agent/wiki/`.
- `read_org_roam_db.py`: read-only CLI helper for inspecting the linked org-roam SQLite database.
- `check_agent_text_limits.py`: verifies the 500-character limits for `agent/project-overview.md` and `agent/growth-log.md`.

Run the full maintenance workflow through:

```sh
make llm
```
