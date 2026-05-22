PUBLISH := bin/publish-site
CODEX ?= codex
LLM_PROMPT ?= agent/skill/llm-maintenance.md
LOOKUP_PROMPT ?= agent/skill/lookup.md
LOOKUP_QUERY ?= $(or $(QUERY),$(Q))
RSYNC_EXCLUDES := --exclude .deps/ --exclude .publish-state.json --exclude .DS_Store
ROAM_DIR := $(HOME)/Documents/AaronNote

# Org repo role: Aaronnote source + published site distribution.
# roam/ is a symlink → ~/Documents/AaronNote (its own git repo, gitignored here).
# Notes are managed inside Aaronnote (auto-commit, version control menu).

.PHONY: all force sync git dryrun clean cv llm lookup maintain publish build roam-push roam-log roam-status

# Publish site, rsync to NAS, commit Org/Aaronnote changes, push.
# roam/ is gitignored so git add -A never touches note files.
all: publish
	rsync -avh --delete $(RSYNC_EXCLUDES) --progress -e ssh public/ Aaron-nas:/volume1/web/public/
	git add -A
	git diff --cached --quiet || git commit -m "site update: $$(date '+%Y-%m-%d %H:%M:%S')"
	$(PUBLISH) --record-state
	git push

force:
	PUBLISH_FORCE=1 $(PUBLISH)

sync:
	rsync -avh --delete $(RSYNC_EXCLUDES) --progress -e ssh public/ Aaron-nas:/volume1/web/public/

git:
	lazygit

dryrun: publish
	rsync -avh --delete --dry-run $(RSYNC_EXCLUDES) --progress -e ssh public/ Aaron-nas:/volume1/web/public/

publish:
	$(PUBLISH)

# --- Roam / AaronNote note repo management ---

roam-push:
	git -C $(ROAM_DIR) push

roam-log:
	git -C $(ROAM_DIR) log --oneline -20

roam-status:
	git -C $(ROAM_DIR) status --short

# --------------------------------------------

cv:
	cd CV && latexmk -xelatex -interaction=nonstopmode -halt-on-error -jobname=Aaron_He_CV main.tex

llm:
	$(CODEX) exec --cd . --sandbox workspace-write --full-auto - < $(LLM_PROMPT)

lookup:
	@LOOKUP_QUERY="$(LOOKUP_QUERY)"; \
	$(CODEX) --cd . --sandbox read-only --ask-for-approval never "$$(cat $(LOOKUP_PROMPT); if [ -n "$$LOOKUP_QUERY" ]; then printf '\n\n## Initial User Query\n\n%s\n' "$$LOOKUP_QUERY"; else printf '\n\n## Interactive Mode\n\nAsk the user for the first lookup query before searching. Keep the session read-only and verify precise claims against original Markdown files.\n'; fi)"

maintain:
	python3 agent/skill/maintain.py

build:
	$(MAKE) -C Aaronnote build

clean:
	rm -rf public/*
