PUBLISH := bin/publish-site
CODEX ?= codex
LLM_PROMPT ?= agent/skill/llm-maintenance.md
LOOKUP_PROMPT ?= agent/skill/lookup.md
LOOKUP_QUERY ?= $(or $(QUERY),$(Q))
RSYNC_EXCLUDES := --exclude .deps/ --exclude .publish-state.json --exclude .DS_Store

.PHONY: all force sync git dryrun clean cv llm lookup maintain publish start

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

cv:
	typst compile --root CV CV/main.typ CV/Aaron_He_CV.pdf

llm:
	$(CODEX) exec --cd . --sandbox workspace-write --full-auto - < $(LLM_PROMPT)

lookup:
	@LOOKUP_QUERY="$(LOOKUP_QUERY)"; \
	$(CODEX) --cd . --sandbox read-only --ask-for-approval never "$$(cat $(LOOKUP_PROMPT); if [ -n "$$LOOKUP_QUERY" ]; then printf '\n\n## Initial User Query\n\n%s\n' "$$LOOKUP_QUERY"; else printf '\n\n## Interactive Mode\n\nAsk the user for the first lookup query before searching. Keep the session read-only and verify precise claims against original Typst files.\n'; fi)"

maintain:
	python3 agent/skill/maintain.py

start:
	$(MAKE) -C Aaronnote start


clean:
	rm -rf public/*
