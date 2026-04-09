all:
	emacs --batch --load publish.el --eval '(org-publish-all t)'
	rsync -avh --progress -e ssh ./ Aaron-nas:/volume1/web
	git add -A
	git diff --cached --quiet || git commit -m "site update: $$(date '+%Y-%m-%d %H:%M:%S')"
	git push

force:
	emacs --batch --load publish.el --eval '(org-publish-all t)'

sync:
	rsync -avh --progress -e ssh ./ Aaron-nas:/volume1/web

git:
	lazygit

clean:
	rm -rf public/*
	rm -f index.org
	rm -f sitemap-log.org
