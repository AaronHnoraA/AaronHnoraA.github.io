# Project Guide

## Goals

This repository is a local knowledge-base toolchain, not a single application:

- `Aaronnote` handles Markdown editing.
- `roam/` stores long-lived notes.
- `bin/publish-site` converts the note source into a public site.
- `agent/` generates derived indexes for AI retrieval and maintenance.

When making changes, identify which layer you are working in:

1. Editor behavior
2. Data model
3. Publish pipeline
4. AI-assisted indexing

These four layers must not be mixed in a single change.

## Source of Truth

The canonical data source is `roam/**/*.md`.

This means:

- Note IDs, titles, dates, tags, and other metadata come from `#+begin meta` blocks in Markdown file headers.
- Cross-document relationships come from relative Markdown links.
- `public/`, `agent/index/`, and `agent/wiki/` are all derived output and must not be hand-edited as authoritative sources.

The design is closer to "file database + derived read models" than a standalone runtime database service.

## Data Layers

### 1. Persistence layer

- `roam/**/*.md`

Responsibilities:
- Store raw Markdown
- Store metadata
- Store relative link relationships

### 2. Publish layer

- `bin/publish-site`
- `public/`

Responsibilities:
- Render Markdown to HTML
- Generate site-consumable data files
- Copy public static assets
- Seal private paths and private notes

### 3. AI retrieval layer

- `agent/index/`
- `agent/wiki/`
- `agent/skill/maintain.py`

Responsibilities:
- Provide fast index entry points for AI
- Compress document views to reduce context overhead
- Preserve "verify against original Markdown" as the canonical workflow

### 4. Editor layer

- `Aaronnote/src/`
- `Aaronnote/aaronnote/`
- `Aaronnote/server/`
- `Aaronnote/desktop/`

Responsibilities:
- Edit, render, and serialize Markdown
- Provide web and desktop runtime entry points
- Supply the HTML rendering capability used by the publish pipeline

## Directory Ownership

- `Aaronnote/`: Primary development area. Editor logic, tests, desktop shell, and site shell.
- `roam/`: Content and metadata source.
- `roam/.lean/`: Lean mirror-file project for `@@lean4 [tag]` blocks. It owns
  the Lake project files and `.lean/.lake/` cache; `roam/.lake/` is not part of
  the active layout.
- `public/`: Published files. Rebuildable; not a development source of truth.
- `bin/`: Publish script entry points.
- `agent/`: AI maintenance material and derived indexes.
- `CV/`: Independent LaTeX résumé project.

## Maintenance Boundaries

### When changing Aaronnote

Check first:
- `Aaronnote/src/`
- `Aaronnote/tests/`
- `Aaronnote/specs/`
- `Aaronnote/CLAUDE.md`

Do not incidentally modify:
- Published artifacts under `public/`
- Derived content under `agent/index/` and `agent/wiki/`

…unless the change explicitly requires a sync publish or index refresh.

### When changing the data model or publish pipeline

Check first:
- `bin/publish-site`
- The output structure in `public/js/data.js`
- The consumer logic in `js/knowledge.js` / `public/js/knowledge.js`

The core concern is compatibility:
- Do new fields break existing site read logic?
- Is private content still correctly sealed?
- Do snapshot and incremental publish still work?

### When changing the AI maintenance layer

Read first:
- [agent/develop.md](../agent/develop.md)
- [agent/skill/README.md](../agent/skill/README.md)

That layer has a development gate. Refreshing derived indexes is normally allowed; changing maintenance tools themselves requires an explicit human request, a severe defect, or sufficient autonomous votes.

## Common Workflows

### Editor development

```sh
cd Aaronnote
npm install
npm test
npm run start:vite
```

### Site publish

```sh
make publish
```

### AI derived index refresh

```sh
make maintain
```

### Desktop build

```sh
make build
```

## Key Facts

- The repository uses a file-first "database" design, not SQL-first.
- `public/js/data.js` is the site frontend's read model, not the primary store.
- Private content sealing happens at the publish stage, not by duplicating content in the source.
- `agent/` is a retrieval optimization layer, not a content layer.
