CV_ORG := CV/main.org
CV_TEX := CV/main.tex
CV_DIR := CV
CV_JOBNAME := Aaron_He_CV
LATEXMK_XELATEX := latexmk --xelatex -interaction=nonstopmode -synctex=1
CODEX ?= codex
LLM_PROMPT ?= agent/skill/llm-maintenance.md
LOOKUP_PROMPT ?= agent/skill/lookup.md
LOOKUP_QUERY ?= $(or $(QUERY),$(Q))

.PHONY: all force sync git dryrun clean cv llm lookup

all: cv
	emacs --batch --load publish.el --eval '(org-publish-all t)'
	rsync -avh --progress -e ssh ./ Aaron-nas:/volume1/web
	git add -A
	git diff --cached --quiet || git commit -m "site update: $$(date '+%Y-%m-%d %H:%M:%S')"
	git push

force: cv
	emacs --batch --load publish.el --eval '(org-publish-all t)'

sync:
	rsync -avh --progress -e ssh ./ Aaron-nas:/volume1/web

git:
	lazygit

dryrun:
	emacs --batch --visit $(CV_ORG) --eval '(require (quote ox-latex))' --funcall org-latex-export-to-latex
	cd $(CV_DIR) && $(LATEXMK_XELATEX) -jobname=$(CV_JOBNAME) $$(basename $(CV_TEX))
	emacs --batch --load publish.el --eval '(org-publish-all t)'
	rsync -avh --progress -e ssh ./ Aaron-nas:/volume1/web

cv:
	emacs --batch --visit $(CV_ORG) --eval '(require (quote ox-latex))' --funcall org-latex-export-to-latex
	cd $(CV_DIR) && $(LATEXMK_XELATEX) -jobname=$(CV_JOBNAME) $$(basename $(CV_TEX))

llm:
	$(CODEX) exec --cd . --sandbox workspace-write --ask-for-approval never - < $(LLM_PROMPT)

lookup:
	@test -n "$(LOOKUP_QUERY)" || (printf 'Usage: make lookup QUERY="your question"\n'; exit 2)
	@(cat $(LOOKUP_PROMPT); printf '\n\n## User Query\n\n%s\n' "$(LOOKUP_QUERY)") | $(CODEX) exec --cd . --sandbox read-only --ask-for-approval never -


clean:
	rm -rf public/*
	rm -f index.org
	rm -f sitemap-log.org
