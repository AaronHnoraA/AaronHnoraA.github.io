# Personal site — Chang He (Aaron)

The source of my personal academic homepage, and the artifact that gets served.
Hand-written HTML, CSS and JavaScript: no framework, no bundler, no build step
for the pages themselves.

## Layout

```
index.html            home, with the animated Shor-circuit hero
research.html         interests, publications and preprints
cv.html               CV summary, linking the typeset PDF
links.html            other pages of mine, and pages worth reading
credits.html          licences, dependencies, acknowledgement, references
assets/css/           the single stylesheet
assets/js/            site behaviour, and the three.js hero scene
assets/fallback/      static circuit drawing, used without WebGL
assets/img/           favicon
vendor/               three.js and anime.js, each with its licence
CV/                   the generated CV PDF
```

## Building and deploying

Only one thing is generated: the CV PDF, compiled from LaTeX. Everything else
is committed as written. The commands live in the Emacs configuration that owns
the deployment, and are documented in `docs/publish-workflow.md` there:

```sh
make publish-build     # compile the CV, check the site is complete
make publish           # the above, then commit, push, and rsync to the NAS
make publish-deploy    # deploy only
```

Deployment is a plain file copy: the repository *is* the site, so its root is
what gets served.

## Licensing

* Site code (HTML, CSS, JavaScript, SVG written for this site) — MIT, see
  [LICENSE](LICENSE).
* Prose, the CV, and images — © Chang He, all rights reserved.
* `vendor/` — third-party, each under its own licence, shipped unmodified with
  the licence file intact.

The full picture, including what inspired the hero animation and the papers the
animation depicts, is on [credits.html](credits.html).
