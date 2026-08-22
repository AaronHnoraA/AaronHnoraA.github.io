# Personal site — Chang He (Aaron)

The source of my personal academic homepage, and the artifact that gets served.
Hand-written HTML, CSS and JavaScript: no framework, no bundler, no build step
for the pages themselves.

## One document, two layouts

`index.html` is a complete, readable document: five sections in normal flow.
That is what you get with JavaScript off, without WebGL, or with `?flat=1`.
The top-bar switch moves explicitly between the document and the 3D view.

When the conditions allow, JavaScript lifts those same sections into a 3D
world built on a continuously sampled, double-lobed loop. Eight restrained
qubit forms move in two sparse groups; a precomputed visual-state table stays
behind the scenes rather than turning the homepage into an algorithm lesson.
The first view follows the lead qubit. The sections become CSS3D panels standing in that world: still real
HTML, still selectable, still reachable by a screen reader. Click one and the
camera flies square to it so its text has no perspective left in it.

The top navigation and the flight HUD share the same five stations. Follow the
lead qubit, scroll or drag for manual flight, scrub the route, or pause motion.
While a panel is focused, world input stays locked until Return, Escape, a new
station, or browser history explicitly exits it. Anime.js choreographs the
interface and reading transitions; camera and circuit motion stay in the
deterministic render loop.

Nothing is duplicated between the two layouts. There is no second copy of the
content to keep in sync.

```
index.html            the whole site
assets/css/site.css   both layouts, one stylesheet
assets/js/site.js     decides document or world
assets/js/world/      curve, circuit, precomputed states, qubits, rig, panels
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

### Looking at it locally

The page uses ES modules and an import map, so `file://` will not do:

```sh
python3 -m http.server 8137 -d .
```

`?flat=1` forces the plain document, `?static=1` renders a single frame, and
`?debug=1` exposes the running scene on `window.__world`. For repeatable visual
tests, `?head=0.25&flow=0.5` selects camera and quantum-flow positions.

## Licensing

* Site code (HTML, CSS, JavaScript, SVG written for this site) — MIT, see
  [LICENSE](LICENSE).
* Prose, the CV, and images — © Chang He, all rights reserved.
* `vendor/` — third-party, each under its own licence, shipped unmodified with
  the licence file intact.

The visual references and software acknowledgements are in the Credits section
of the site itself.
