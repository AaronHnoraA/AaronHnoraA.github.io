# AI Agent Entry

This repository contains Aaron's Org knowledge base. Human-authored notes are the source of truth; AI-maintained navigation lives under `agent/`.

Start here:

- Read `agent/agent.md` before changing AI index material.
- Read `agent/project-overview.md` and `agent/growth-log.md` for compact long-term context.
- Treat `agent/index/` and `agent/wiki/` as derived files.
- Use `make llm` to refresh AI-facing indexes, commit the AI maintenance output, and push it.
- Use `make lookup QUERY="..."` for read-only note retrieval; precise answers require reading original Org files.
- Do not stage or rewrite user notes unless the user explicitly asks for note edits.

Core map:

- `roam/`: durable org-roam notes.
- `daily/`: fast capture and in-progress notes.
- `agent/index/`: AI-friendly indexes over Org notes.
- `agent/wiki/`: condensed wiki pages generated from Org notes.
- `agent/skill/`: scripts and procedures AI agents may use.
- `agent/db/org-roam.sqlite3`: link to the local org-roam SQLite database.
- `agent/project-overview.md`: 500-character project summary.
- `agent/growth-log.md`: 500-character natural-language growth log.
