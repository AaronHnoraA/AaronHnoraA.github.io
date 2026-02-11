all:
	emacs --batch --load publish.el --eval '(org-publish-all t)'
	rsync -avh --progress -e ssh ./ Aaron-nas:/volume1/web

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
