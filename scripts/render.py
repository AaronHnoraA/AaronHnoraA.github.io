#!/usr/bin/env python3
"""Render db.json into the generated regions of the CV and the homepage.

    python3 scripts/render.py            rewrite regions that are out of date
    python3 scripts/render.py --check    exit 1 if any region is out of date

db.json holds the content (profile, entries) and the layout (which sections or
blocks each target has, in which order, fed by which entry types). Only the
text between the markers is touched:

    CV/main.tex   %% BEGIN GENERATED ... %% END GENERATED
    index.html    <!-- db:NAME ... -->  ...  <!-- /db:NAME -->   (one per region)

Standard library only.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "db.json"

SHOW = {"cv": {"both", "cv"}, "web": {"both", "web"}}


class RenderError(Exception):
    pass

# --------------------------------------------------------------- data access


class Db:
    def __init__(self, raw: dict):
        self.raw = raw
        self.profile = raw["profile"]
        self.entries = raw["entries"]
        self.by_id: dict[str, dict] = {}
        for e in self.entries:
            for key in ("id", "type", "show"):
                if key not in e:
                    raise RenderError(f"entry {e.get('id', e)!r} lacks '{key}'")
            if e["show"] not in ("both", "cv", "web", "none"):
                raise RenderError(f"entry {e['id']}: show must be both|cv|web|none")
            if e["id"] in self.by_id or e["id"] == "profile":
                raise RenderError(f"duplicate entry id {e['id']!r}")
            self.by_id[e["id"]] = e

    def select(self, target: str, slot_id: str, types: list[str]) -> list[dict]:
        """Entries visible on `target` that belong to section/block `slot_id`."""
        out = []
        for e in self.entries:
            if e["show"] not in SHOW[target]:
                continue
            override = (e.get("slot") or {}).get(target)
            if override == slot_id or (override is None and e["type"] in types):
                out.append(e)
        return out


def pick(value, target: str):
    """A field may be a plain value or {"cv": ..., "web": ...}."""
    if isinstance(value, dict) and set(value) <= {"cv", "web"} and value:
        return value.get(target, "")
    return value


_TEMPLATE = re.compile(r"\{([A-Za-z][\w-]*(?:\.[\w-]+)+)\}")


def expand(s: str, db: Db, target: str) -> str:
    """Replace {entry-id.field.sub} / {profile.field} with the referenced value."""
    def lookup(m: re.Match) -> str:
        head, *path = m[1].split(".")
        node = db.profile if head == "profile" else db.by_id.get(head)
        if node is None:
            raise RenderError(f"template {m[0]}: no entry {head!r}")
        for part in path:
            node = pick(node, target)
            try:
                node = node[int(part)] if isinstance(node, list) else node[part]
            except (KeyError, IndexError, ValueError, TypeError):
                raise RenderError(f"template {m[0]}: no field {part!r}") from None
        node = pick(node, target)
        if isinstance(node, dict) and "url" in node:
            return f"[{node.get('name') or node.get('label')}]({node['url']})"
        if not isinstance(node, (str, int, float)):
            raise RenderError(f"template {m[0]} does not resolve to text")
        return str(node)
    return _TEMPLATE.sub(lookup, s)

# --------------------------------------------------------------- inline markup


_TOKEN = re.compile(
    r"\$(?P<math>[^$]+)\$"
    r"|\[(?P<ltext>[^\]]+)\]\((?P<url>[^)\s]+)\)"
    r"|\*\*(?P<bold>.+?)\*\*"
    r"|\*(?P<ital>.+?)\*"
)

_TEX_ESCAPE = {
    "\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "#": r"\#", "_": r"\_",
    "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
    "$": r"\$",
}


def tex_escape(s: str) -> str:
    return "".join(_TEX_ESCAPE.get(c, c) for c in s)


def _render(s: str, plain, math, link, bold, ital) -> str:
    out, pos = [], 0
    for m in _TOKEN.finditer(s):
        out.append(plain(s[pos:m.start()]))
        rec = lambda t: _render(t, plain, math, link, bold, ital)  # noqa: E731
        if m["math"] is not None:
            out.append(math(m["math"]))
        elif m["url"] is not None:
            out.append(link(rec(m["ltext"]), m["url"]))
        elif m["bold"] is not None:
            out.append(bold(rec(m["bold"])))
        else:
            out.append(ital(rec(m["ital"])))
        pos = m.end()
    out.append(plain(s[pos:]))
    return "".join(out)


def to_tex(s: str) -> str:
    return _render(
        s, tex_escape,
        lambda m: f"${m}$",
        lambda t, u: rf"\href{{{u.replace('%', chr(92) + '%').replace('#', chr(92) + '#')}}}{{{t}}}",
        lambda t: rf"\textbf{{{t}}}",
        lambda t: rf"\textit{{{t}}}",
    )


def to_html(s: str) -> str:
    esc = lambda t: html.escape(t, quote=False)  # noqa: E731
    rel = lambda u: "" if u.startswith(("mailto:", "#")) else ' rel="noopener"'  # noqa: E731
    return _render(
        s, esc,
        lambda m: f"<var>{esc(m)}</var>",
        lambda t, u: f'<a href="{html.escape(u)}"{rel(u)}>{t}</a>',
        lambda t: f"<strong>{t}</strong>",
        lambda t: f"<em>{t}</em>",
    )


def join_names(names: list[str]) -> str:
    if len(names) <= 2:
        return " and ".join(names)
    return ", ".join(names[:-1]) + ", and " + names[-1]


def link_md(obj: dict) -> str:
    return f"[{obj.get('name') or obj.get('label')}]({obj['url']})"


class Text:
    """Per-target field access: pick the side's wording, expand templates."""

    def __init__(self, db: Db, target: str):
        self.db, self.target = db, target

    def md(self, value) -> str:
        value = pick(value, self.target)
        return expand(value, self.db, self.target) if isinstance(value, str) else ""

    def field(self, e: dict, key: str) -> str:
        return self.md(e.get(key, ""))

    def role(self, e: dict) -> str:
        if "role" in e:
            return self.field(e, "role")
        if "degree" in e:
            code = f" ({link_md(e['code'])})" if e.get("code") else ""
            return self.field(e, "degree") + code
        if e.get("supervisors"):
            return "Supervised by " + join_names([link_md(s) for s in e["supervisors"]])
        return ""

    def points(self, e: dict) -> list[str]:
        return [self.md(p) for p in pick(e.get("points", []), self.target)]

    def authors(self, e: dict, bold_self: bool) -> str:
        me = f"{self.db.profile['given']} {self.db.profile['family']}"
        return join_names([f"**{a}**" if bold_self and a == me else a for a in e["authors"]])

# ----------------------------------------------------------------------- LaTeX


def render_cv(db: Db, layout: dict) -> str:
    t = Text(db, "cv")
    p = db.profile
    L: list[str] = []
    add = L.append

    def itemize(points: list[str]) -> None:
        add(r"\begin{itemize}")
        for x in points:
            add(rf"  \item {to_tex(x)}")
        add(r"\end{itemize}")

    def description(items: list[dict], key: str) -> None:
        add(r"\begin{description}[leftmargin=0pt, labelsep=0.5em, topsep=0pt, itemsep=3pt,")
        add(r"                    parsep=0pt, font=\normalfont]")
        for e in items:
            add(rf"  \interest{{{to_tex(t.field(e, 'area'))}.}}")
            add(f"    {{{to_tex(t.field(e, key))}}}")
        add(r"\end{description}")

    def header(_items) -> None:
        add(r"\begin{center}")
        full = tex_escape(f"{p['given']} {p['family']}".lower())
        add(rf"  {{\huge\scshape\addfontfeatures{{LetterSpace=8.0}}{full}}}%")
        add(rf"  \hspace{{0.5em}}{{\Large\itshape ({tex_escape(p['preferred'])})}}\\[9pt]")
        add(r"  {\small\color{quietink}%")
        add(f"   {to_tex(t.md(p['role']) + ', ' + link_md(p['institution']))}%")
        add(rf"   \sep {to_tex(t.md(p['location']))}}}\\[5pt]")
        links = [to_tex(link_md(c)) for c in p["contact"].values()]
        add(r"  {\small")
        add("%\n   \\sep\n".join(f"   {x}" for x in links) + "}")
        add(r"\end{center}")

    def entries(items) -> None:
        for i, e in enumerate(items):
            if i:
                add("")
                add(r"\vspace{4pt}")
                add("")
            add(r"\cventry")
            for key in ("heading", "place"):
                add(f"  {{{to_tex(t.field(e, key))}}}")
            add(f"  {{{to_tex(t.role(e))}}}")
            add(f"  {{{to_tex(t.field(e, 'dates'))}}}")
            pts = t.points(e)
            if pts:
                add("")
                itemize(pts)

    def manuscripts(items) -> None:
        add(r"\begin{itemize}")
        for e in items:
            add(rf"  \item {to_tex(t.authors(e, bold_self=True))}.")
            add(rf"        \textit{{{to_tex(t.field(e, 'title'))}}}")
            add(f"        {to_tex(t.field(e, 'status'))}")
        add(r"\end{itemize}")

    styles = {
        "header": header,
        "entries": entries,
        "description": lambda items: description(items, "text"),
        "manuscripts": manuscripts,
        "list": lambda items: itemize([t.field(e, "text") for e in items]),
    }

    first = True
    for sec in layout["sections"]:
        if not sec.get("show", True):
            continue
        style = sec.get("style")
        if style not in styles:
            raise RenderError(f"cv section {sec.get('id')!r}: unknown style {style!r}")
        items = db.select("cv", sec["id"], sec.get("types", []))
        if style != "header" and not items:
            continue
        if not first:
            add("")
        first = False
        title = sec.get("title", sec["id"].title())
        add(f"%% ── {title} " + "─" * max(4, 74 - len(title)))
        if style != "header":
            add(rf"\section{{{tex_escape(title)}}}")
            add("")
        styles[style](items)
    return "\n".join(L)

# ------------------------------------------------------------------------ HTML


def render_web_region(db: Db, blocks: list[dict], region: str) -> str:
    t = Text(db, "web")
    I6, I8 = " " * 6, " " * 8
    chunks: list[list[str]] = []

    def interests(items, _title):
        out = []
        for i, e in enumerate(items):
            if i:
                out.append("")
            out.append(f"{I6}<h3>{to_html(t.field(e, 'area'))}</h3>")
            out.append(f"{I6}<p>{to_html(t.field(e, 'text'))}</p>")
        return out

    def titled(title):
        return [f"{I6}<h3>{html.escape(title)}</h3>"] if title else []

    def manuscripts(items, title):
        out = titled(title)
        for e in items:
            out += [f"{I6}<p>",
                    f"{I8}{to_html(t.authors(e, bold_self=False))}.",
                    f"{I8}<cite>{to_html(t.field(e, 'title'))}</cite> {to_html(t.field(e, 'status'))}",
                    f"{I6}</p>"]
        return out

    def entries(items, title):
        out = titled(title)
        for e in items:
            meta = " · ".join(x for x in (to_html(t.role(e)), to_html(t.field(e, "dates"))) if x)
            out.append(f"{I6}<p><strong>{to_html(t.field(e, 'heading'))}</strong>"
                       + (f"<br>{meta}" if meta else "") + "</p>")
            pts = t.points(e)
            if pts:
                out.append(f"{I6}<ul>")
                out += [f"{I8}<li>{to_html(x)}</li>" for x in pts]
                out.append(f"{I6}</ul>")
        return out

    def plain_list(items, title):
        out = titled(title) + [f"{I6}<ul>"]
        out += [f"{I8}<li>{to_html(t.field(e, 'text'))}</li>" for e in items]
        return out + [f"{I6}</ul>"]

    def facts(items, _title):
        out = []
        for e in items:
            value = t.field(e, "html") if "html" in e else to_html(t.field(e, "value"))
            out.append(f"{I8}<div><dt>{html.escape(t.field(e, 'label'))}</dt><dd>{value}</dd></div>")
        return out

    styles = {"interests": interests, "manuscripts": manuscripts, "entries": entries,
              "list": plain_list, "facts": facts}
    for b in blocks:
        if not b.get("show", True):
            continue
        if b.get("style") not in styles:
            raise RenderError(f"web region {region!r} block {b.get('id')!r}: "
                              f"unknown style {b.get('style')!r}")
        items = db.select("web", b["id"], b.get("types", []))
        if items:
            chunks.append(styles[b["style"]](items, b.get("title")))
    sep = [] if any(b.get("style") == "facts" for b in blocks) else [""]
    out: list[str] = []
    for i, c in enumerate(chunks):
        out += (sep if i else []) + c
    return "\n".join(out)

# --------------------------------------------------------------------- regions


def replace_region(text: str, begin: str, end: str, body: str, where: str) -> str:
    pat = re.compile(rf"(^[^\n]*{re.escape(begin)}[^\n]*\n)(.*?)(^[^\n]*{re.escape(end)})",
                     re.S | re.M)
    n = len(pat.findall(text))
    if n != 1:
        raise RenderError(f"expected one '{begin}' … '{end}' region in {where}, found {n}")
    body = body.rstrip("\n")
    return pat.sub(lambda m: m[1] + (body + "\n" if body else "") + m[3], text)


def main() -> int:
    ap = argparse.ArgumentParser(description="Render db.json into the CV and homepage.")
    ap.add_argument("--check", action="store_true", help="fail if anything is stale")
    args = ap.parse_args()

    try:
        raw = json.loads(DB.read_text(encoding="utf-8"))
        db = Db(raw)
        layout = raw["layout"]
        jobs: dict[Path, list[tuple[str, str, str]]] = {}
        cv, web = layout.get("cv", {}), layout.get("web", {})
        if cv.get("enabled", True):
            jobs[ROOT / cv["file"]] = [("%% BEGIN GENERATED", "%% END GENERATED",
                                        render_cv(db, cv))]
        if web.get("enabled", True):
            jobs[ROOT / web["file"]] = [
                (f"<!-- db:{name} ", f"<!-- /db:{name} -->", render_web_region(db, blocks, name))
                for name, blocks in web.get("regions", {}).items()
            ]
        stale = []
        for path, regions in jobs.items():
            old = path.read_text(encoding="utf-8")
            new = old
            for begin, end, body in regions:
                new = replace_region(new, begin, end, body, path.name)
            if new != old:
                stale.append(path.relative_to(ROOT))
                if not args.check:
                    path.write_text(new, encoding="utf-8")
    except (RenderError, KeyError, json.JSONDecodeError, OSError) as err:
        print(f"render.py: error: {err}", file=sys.stderr)
        return 2

    for p in stale:
        print(f"render.py: {p} {'out of date' if args.check else 'updated'}")
    if not stale:
        print("render.py: up to date")
    return 1 if (args.check and stale) else 0


if __name__ == "__main__":
    sys.exit(main())
