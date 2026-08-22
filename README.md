# Personal site — Chang He (Aaron)

The source of my personal academic homepage, and the artifact that gets served.
Hand-written HTML, CSS and JavaScript: no framework, no bundler, no build step
for the pages themselves.

## One document, two layouts

`index.html` is a complete, readable document whose sections stay in normal flow.
That is what you get with JavaScript off, without WebGL, or with `?flat=1`.
The top-bar switch moves explicitly between the document and the 3D view.

When the conditions allow, JavaScript lifts those same sections into a 3D
world built on a continuously sampled, double-lobed loop. Eight restrained
qubit forms move in two sparse groups; a precomputed visual-state table stays
behind the scenes. Lightweight CSS3D annotations attach that fixed ten-step
Shor playback, its gate formulae, and each qubit expression directly to the
objects they describe; the plain personal document contains none of this
circuit annotation.
The first view follows the lead qubit. The sections become CSS3D panels standing in that world: still real
HTML, still selectable, still reachable by a screen reader. Click one and the
camera flies square to it so its text has no perspective left in it.

The top navigation and the bottom HUD both address the personal sections. The
HUD also follows the lead qubit, scrubs the closed world, and pauses motion;
algorithm notation stays in the scene instead of competing with site
navigation. While a panel is focused, its links,
selection and scrolling stay interactive; only Escape, browser history, or a
click outside the card exits it. Anime.js choreographs the
interface and reading transitions; camera and circuit motion stay in the
deterministic render loop.

Nothing is duplicated between the two layouts. There is no second copy of the
content to keep in sync.

## Changing content

Visitor-facing prose lives only in `index.html`. Editing text or links there
updates both layouts because the 3D view moves the original section elements;
it does not copy or template them.

Every direct `section.panel` under `main[data-world]` is automatically
registered as a flat section, a CSS3D card, and a bottom route node. To add one:

1. Add a section with a unique `id`, a heading, `.panel-preview`, and
   `.panel-detail`.
2. Optionally set `data-world-label` for the short route label.
3. Optionally set `data-world-t="0..1"`, `data-world-lift`, and
   `data-world-side="-1|1"` to art-direct its position. With no
   `data-world-t`, the runtime uses the largest free arc.
4. Add a masthead link only when the section should be permanent primary
   navigation.

No JavaScript registry, fallback copy, or deployment manifest changes are
needed for a content-only card. The maintenance note beside the first section
in `index.html` is the compact reference.

```
index.html            the whole site
assets/css/site.css   both layouts, one stylesheet
assets/js/site.js     decides document or world
assets/js/world/      curve, circuit, precomputed states, qubits, rig, panels
assets/img/           favicon
vendor/               three.js, anime.js and KaTeX, each with its licence
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

Legal metadata and third-party notices stay in the repository rather than in
the academic homepage content.
