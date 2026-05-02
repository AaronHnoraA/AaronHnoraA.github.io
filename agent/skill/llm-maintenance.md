# Codex LLM Maintenance Task

You are maintaining Aaron's Org knowledge base AI layer. This target delegates judgment to Codex: inspect the repository, decide what the AI layer needs now, make targeted updates, then commit and push only the AI-maintenance result.

## Mission

Keep `agent/` as a long-lived, self-improving retrieval and maintenance layer for the Org knowledge base. The system should become easier for future agents to understand, search, verify, and safely upgrade.

Org files are the source of truth. `agent/` is an AI-facing layer built around those notes.

## First Context

Read these files first, in this order:

- `agent.md`
- `agent/project-overview.md`
- `agent/growth-log.md`
- `agent/agent.md`
- `agent/skill/README.md`
- `README.md`
- `Makefile`

Then inspect only the relevant Org files under `roam/` and `daily/`. Use `agent/db/org-roam.sqlite3` as a read-only helper when it is useful, not as the canonical source.

## Operating Loop

1. Run `git status --short` and identify user changes.
2. Read the compact context and current AI index/wiki state.
3. Decide whether this run needs regeneration, script improvement, documentation adjustment, log compaction, or no content change.
4. Make the smallest useful update that improves future AI retrieval or maintenance.
5. Run the relevant checks.
6. Stage only AI-maintenance files.
7. Commit if staged changes exist.
8. Push.

## Maintenance Targets

- `agent/index/`: lookup indexes by title, path, tag, outgoing links, backlinks, and other stable retrieval keys when useful.
- `agent/wiki/`: condensed Markdown views of important Org notes for fast reading.
- `agent/skill/`: reusable procedures, scripts, and prompts that reduce future agent work.
- `agent/db/`: read-only database links and DB usage notes.
- `agent/project-overview.md`: living project summary, maximum 500 non-space body characters.
- `agent/growth-log.md`: living natural-language growth log, maximum 500 non-space body characters.

## Growth Rules

- Update `project-overview.md` only when the repository purpose, scope, or operating model changes.
- Update `growth-log.md` when the AI layer gains a durable capability or changes its maintenance model.
- Rewrite and compress these two files instead of appending forever.
- Keep both files human-readable natural language, not a dense changelog table.
- Verify the limit with `python3 agent/skill/check_agent_text_limits.py`.

## Available Tools

- `python3 agent/skill/maintain.py` incrementally refreshes the derived index/wiki set, remembering the last processed `git` head, checking only `roam/` and `daily/` deltas plus current Org worktree changes, and reparsing a random sample of unchanged notes.
- `python3 agent/skill/check_agent_text_limits.py` checks the 500-character context limits.
- `python3 agent/skill/read_org_roam_db.py summary`
- `python3 agent/skill/read_org_roam_db.py nodes`
- `python3 agent/skill/read_org_roam_db.py links`
- Normal shell tools such as `rg`, `find`, `sqlite3`, and `git`.

You may edit or add tools when the current structure is not enough. If you change a tool, run it afterward.

## Safety Boundaries

- Do not modify human-authored Org notes unless the user explicitly asked for note edits.
- Do not revert user changes.
- Do not turn generated files into the source of truth.
- Do not manually write org-roam DB rows.
- Do not commit unrelated files outside the AI-maintenance layer.
- Prefer deterministic generated output and concise Markdown.

## Required Checks

Run at least:

```sh
python3 agent/skill/check_agent_text_limits.py
python3 -B -m py_compile agent/skill/maintain.py agent/skill/read_org_roam_db.py agent/skill/check_agent_text_limits.py
```

If index/wiki output should change, also run:

```sh
python3 agent/skill/maintain.py
```

## Git Rules

Check status before staging:

```sh
git status --short
```

Stage only AI-maintenance files by default:

```sh
git add agent.md agent Makefile
```

If staged changes exist, commit with:

```sh
git commit -m "llm index update: $(date '+%Y-%m-%d %H:%M:%S')"
```

Push after the commit step:

```sh
git push
```

## Final Response

Briefly report:

- What changed.
- Checks run.
- Whether a commit was created.
- Whether push succeeded.
