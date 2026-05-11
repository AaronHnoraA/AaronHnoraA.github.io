#!/usr/bin/env python3
"""Convert org-roam .org notes to typst .typ notes (one-shot manual port).

Aligned with Typst Note Guide:
- Note IDs use YYYYMMDDTHHMMSS-slug format.
- Cross-note links use #note("id")[text].
- Block macros use #theorem[..], #proof[..], #note[..] etc.
- Quantum bra-ket uses lr(|psi angle.r) form.
- We do NOT touch /_typst/note.typ — `M-x my/note-db-sync` rebuilds it.

Math conversion is best-effort; complex expressions may need manual fixup.
"""
import re
from pathlib import Path

ROOT = Path("/Users/hc/HC/Org")

# Org files to convert.
FILES = [
    "roam/math/inner_product_space.org",
    "roam/math/hilbert_space.org",
    "roam/math/hermitian_matrix.org",
    "roam/QC/variance.org",
    "roam/QC/density_operator.org",
    "roam/QC/observable_expectation.org",
    "roam/QC/quantum_state.org",
    "roam/daily/reading/basic algebra.org",
    "roam/project/UNSW/ISO(202603)/strassen.org",
    "roam/daily/uni/qc/ReadingGroup/20260508.org",
]

# Mapping discovered from PROPERTIES blocks: UUID -> new typst note id.
# Built after a first pass; we keep it static here for stability.
UUID_TO_ID = {
    "8D02B895-719C-42BC-8084-3F7EE98E4D90": "20260127T000000-inner-product-space",
    "FDD92B78-DF6E-44F5-BF77-425C3CF28720": "20260126T000000-hilbert-space",
    "20BE5DF6-29D8-4B26-AA52-BFD8AB02A02F": "20260127T000000-hermitian-matrix",
    "1E7730D4-201D-4698-BE32-3B0DF115CEBC": "20260130T000000-variance",
    "35CB5287-89BD-4C89-A9AC-AF09CE758331": "20260128T000000-density-operator",
    "29E32DDB-8883-43FA-844A-9440C363B90B": "20260128T000000-observable-expectation",
    "ABBA184F-F2BA-40FD-B44F-3A99A7A0F493": "20260128T000000-quantum-state",
    "0953618D-8E10-4011-92E5-8A5246591A14": "20260508T000000-strassen",
}

# org block name -> typst function name (must exist in _typst/note.typ or be builtin)
BLOCK_MAP = {
    "proof": "proof",
    "theorem": "theorem",
    "thm": "theorem",
    "lemma": "lemma",
    "corollary": "corollary",
    "definition": "definition",
    "defn": "definition",
    "attention": "important",   # note.typ has no 'attention'; map to 'important'
    "question": "question",
    "summary": "summary",
    "note": "note",
    "important": "important",
    "prop": "proposition",
    "proposition": "proposition",
    "example": "example",
    "remark": "remark",
    "warning": "warning",
    "tip": "tip",
    "info": "info",
    "solution": "solution",
    "quote": "quote",           # typst builtin
    "answer": "tip",            # closest existing card
}

# Greek / symbol command replacements (matched as whole token).
LATEX_SYMBOLS = {
    r"\\to": " -> ",
    r"\\Rightarrow": " => ",
    r"\\Leftarrow": " <== ",
    r"\\Leftrightarrow": " <=> ",
    r"\\implies": " ==> ",
    r"\\iff": " <==> ",
    r"\\leq": " <= ",
    r"\\le": " <= ",
    r"\\geq": " >= ",
    r"\\ge": " >= ",
    r"\\neq": " != ",
    r"\\ne": " != ",
    r"\\approx": " approx ",
    r"\\equiv": " equiv ",
    r"\\cdot": " dot.op ",
    r"\\dagger": "dagger",
    r"\\otimes": " times.circle ",
    r"\\oplus": " plus.circle ",
    r"\\perp": " perp ",
    r"\\forall": " forall ",
    r"\\exists": " exists ",
    r"\\in": " in ",
    r"\\notin": " in.not ",
    r"\\subset": " subset ",
    r"\\subseteq": " subset.eq ",
    r"\\cap": " inter ",
    r"\\cup": " union ",
    r"\\infty": " infinity ",
    r"\\dots": " dots ",
    r"\\ldots": " dots ",
    r"\\cdots": " dots.c ",
    r"\\therefore": " therefore ",
    r"\\partial": " diff ",
    r"\\circ": " compose ",
    r"\\quad": " quad ",
    r"\\qquad": " wide ",
    r"\\,": " thin ",
    r"\\;": " space ",
    r"\\!": "",
    r"\\unlhd": " lt.tri.eq ",
    r"\\times": " times ",
    r"\\pm": " plus.minus ",
    r"\\mp": " minus.plus ",
    r"\\star": " star ",
    r"\\ast": " ast ",
    r"\\setminus": " without ",
    r"\\emptyset": " emptyset ",
    r"\\nabla": " nabla ",
    r"\\prime": "'",
    r"\\sum": " sum ",
    r"\\prod": " product ",
    r"\\int": " integral ",
    r"\\lim": " lim ",
    r"\\inf": " inf ",
    r"\\sup": " sup ",
    r"\\max": " max ",
    r"\\min": " min ",
    r"\\log": " log ",
    r"\\ln": " ln ",
    r"\\exp": " exp ",
    r"\\sin": " sin ",
    r"\\cos": " cos ",
    r"\\tan": " tan ",
    r"\\arcsin": " arcsin ",
    r"\\arccos": " arccos ",
    r"\\arctan": " arctan ",
    r"\\mapsto": " arrow.r.bar ",
    r"\\cong": " tilde.equiv ",
    r"\\bigoplus": " plus.circle.big ",
    r"\\bigotimes": " times.circle.big ",
    r"\\bigcap": " inter.big ",
    r"\\bigcup": " union.big ",
    r"\\dim": " dim ",
    r"\\det": " det ",
    r"\\ker": " ker ",
    r"\\Re": " Re ",
    r"\\Im": " Im ",
    r"\\gcd": " gcd ",
    r"\\angle": " angle ",
    r"\\varepsilon": " epsilon.alt ",
    r"\\epsilon": " epsilon ",
    r"\\Delta": " Delta ",
    r"\\Gamma": " Gamma ",
    r"\\Lambda": " Lambda ",
    r"\\Omega": " Omega ",
    r"\\Sigma": " Sigma ",
    r"\\Phi": " Phi ",
    r"\\Psi": " Psi ",
    r"\\Theta": " Theta ",
    r"\\Pi": " Pi ",
    r"\\alpha": " alpha ",
    r"\\beta": " beta ",
    r"\\gamma": " gamma ",
    r"\\delta": " delta ",
    r"\\zeta": " zeta ",
    r"\\eta": " eta ",
    r"\\theta": " theta ",
    r"\\iota": " iota ",
    r"\\kappa": " kappa ",
    r"\\lambda": " lambda ",
    r"\\mu": " mu ",
    r"\\nu": " nu ",
    r"\\xi": " xi ",
    r"\\pi": " pi ",
    r"\\rho": " rho ",
    r"\\sigma": " sigma ",
    r"\\tau": " tau ",
    r"\\upsilon": " upsilon ",
    r"\\phi": " phi ",
    r"\\chi": " chi ",
    r"\\psi": " psi ",
    r"\\omega": " omega ",
}


def convert_braket(s: str) -> str:
    """Translate Dirac notation to lr(...) form.

    Body may contain LaTeX commands (backslashes), so the content class only
    excludes the structural delimiters | and $ and forbids another \\langle / \\rangle
    via negative lookahead.
    """
    body_no_bar = r"(?:(?!\\langle|\\rangle)[^|$])+?"  # body with no bar
    body_any = r"(?:(?!\\langle|\\rangle)[^$])+?"      # body that may contain bars

    # \langle a | b | c \rangle
    s = re.sub(
        rf"\\langle\s*({body_no_bar})\s*\|\s*({body_no_bar})\s*\|\s*({body_no_bar})\s*\\rangle",
        r" lr(angle.l \1 | \2 | \3 angle.r) ",
        s,
    )
    # \langle a | b \rangle
    s = re.sub(
        rf"\\langle\s*({body_no_bar})\s*\|\s*({body_no_bar})\s*\\rangle",
        r" lr(angle.l \1 | \2 angle.r) ",
        s,
    )
    # |x\rangle
    s = re.sub(rf"\|\s*({body_no_bar})\s*\\rangle", r" lr(|\1 angle.r) ", s)
    # \langle x|
    s = re.sub(rf"\\langle\s*({body_no_bar})\s*\|", r" lr(angle.l \1|) ", s)
    # \langle x \rangle (no bar inside)
    s = re.sub(rf"\\langle\s*({body_any})\s*\\rangle", r" lr(angle.l \1 angle.r) ", s)
    # Fallback for any leftovers
    s = s.replace(r"\langle", "angle.l").replace(r"\rangle", "angle.r")
    return s


def convert_math(s: str) -> str:
    # Matrix environments first
    def bmatrix_repl(m):
        body = m.group(1)
        rows = [r.strip() for r in body.split(r"\\")]
        rows = [r for r in rows if r]
        rows_t = [", ".join(c.strip() for c in r.split("&")) for r in rows]
        return "mat(" + "; ".join(rows_t) + ")"

    s = re.sub(r"\\begin\{bmatrix\}(.*?)\\end\{bmatrix\}", bmatrix_repl, s, flags=re.DOTALL)
    s = re.sub(r"\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}", bmatrix_repl, s, flags=re.DOTALL)
    s = re.sub(r"\\begin\{vmatrix\}(.*?)\\end\{vmatrix\}", bmatrix_repl, s, flags=re.DOTALL)

    # Symbol commands first (so \in\mathbb X gets split before \mathbb consumes the letter)
    for pat, rep in LATEX_SYMBOLS.items():
        s = re.sub(pat + r"(?![A-Za-z])", rep, s)

    # \mathbb / \mathcal / \mathbf / \mathrm / \operatorname / \text (braced)
    s = re.sub(r"\\mathbb\s*\{([^}]*)\}", r"bb(\1)", s)
    s = re.sub(r"\\mathcal\s*\{([^}]*)\}", r"cal(\1)", s)
    s = re.sub(r"\\mathbf\s*\{([^}]*)\}", r"bold(\1)", s)
    s = re.sub(r"\\mathrm\s*\{([^}]*)\}", r'"\1"', s)
    s = re.sub(r"\\operatorname\s*\{([^}]*)\}", r'op("\1")', s)
    s = re.sub(r"\\text\s*\{([^}]*)\}", r'"\1"', s)
    # Unbraced single-letter fallback (e.g. \mathbb R, \mathcal H, \mathbf x)
    s = re.sub(r"\\mathbb\s+([A-Za-z])\b", r"bb(\1)", s)
    s = re.sub(r"\\mathcal\s+([A-Za-z])\b", r"cal(\1)", s)
    s = re.sub(r"\\mathbf\s+([A-Za-z])\b", r"bold(\1)", s)
    s = re.sub(r"\\mathrm\s+([A-Za-z])\b", r"upright(\1)", s)

    # Decorations: braced form
    s = re.sub(r"\\hat\s*\{([^}]*)\}", r"hat(\1)", s)
    s = re.sub(r"\\overline\s*\{([^}]*)\}", r"overline(\1)", s)
    s = re.sub(r"\\underline\s*\{([^}]*)\}", r"underline(\1)", s)
    s = re.sub(r"\\tilde\s*\{([^}]*)\}", r"tilde(\1)", s)
    s = re.sub(r"\\bar\s*\{([^}]*)\}", r"macron(\1)", s)
    s = re.sub(r"\\widetilde\s*\{([^}]*)\}", r"tilde(\1)", s)
    s = re.sub(r"\\widehat\s*\{([^}]*)\}", r"hat(\1)", s)
    s = re.sub(r"\\vec\s*\{([^}]*)\}", r"arrow(\1)", s)
    s = re.sub(r"\\sqrt\s*\{([^}]*)\}", r"sqrt(\1)", s)
    # Decorations: single-arg unbraced form (e.g. \hat A, \bar x)
    s = re.sub(r"\\hat\s+([A-Za-z])\b", r"hat(\1)", s)
    s = re.sub(r"\\overline\s+([A-Za-z])\b", r"overline(\1)", s)
    s = re.sub(r"\\tilde\s+([A-Za-z])\b", r"tilde(\1)", s)
    s = re.sub(r"\\bar\s+([A-Za-z])\b", r"macron(\1)", s)
    s = re.sub(r"\\widetilde\s+([A-Za-z])\b", r"tilde(\1)", s)
    s = re.sub(r"\\widehat\s+([A-Za-z])\b", r"hat(\1)", s)
    s = re.sub(r"\\vec\s+([A-Za-z])\b", r"arrow(\1)", s)
    s = re.sub(r"\\sqrt\s+([A-Za-z0-9])\b", r"sqrt(\1)", s)
    s = re.sub(r"\\underline\s+([A-Za-z])\b", r"underline(\1)", s)

    # Bra-ket BEFORE generic langle/rangle fallback
    s = convert_braket(s)

    # \frac{a}{b} (non-nested, repeat for shallow nesting)
    def frac_repl(m):
        return f"({m.group(1)})/({m.group(2)})"
    for _ in range(3):
        s = re.sub(r"\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}", frac_repl, s)

    # _{...} / ^{...} -> _(...) / ^(...)
    for _ in range(3):
        s = re.sub(r"_\{([^{}]*)\}", r"_(\1)", s)
        s = re.sub(r"\^\{([^{}]*)\}", r"^(\1)", s)

    # \left( \right) -> ( ) (typst auto-sizes via lr()); user can wrap manually
    s = re.sub(r"\\left\s*\(", "(", s)
    s = re.sub(r"\\right\s*\)", ")", s)
    s = re.sub(r"\\left\s*\[", "[", s)
    s = re.sub(r"\\right\s*\]", "]", s)
    s = re.sub(r"\\left\s*\\\{", "{", s)
    s = re.sub(r"\\right\s*\\\}", "}", s)
    s = re.sub(r"\\left\s*\|", "|", s)
    s = re.sub(r"\\right\s*\|", "|", s)
    s = re.sub(r"\\left\s*\.", "", s)
    s = re.sub(r"\\right\s*\.", "", s)

    # \\ -> typst line break in display math
    s = s.replace("\\\\", " \\\n")

    # literal braces
    s = s.replace(r"\{", "{").replace(r"\}", "}")
    # \|
    s = s.replace(r"\|", "||")

    # Space-separate adjacent variable letters that typst would treat as one identifier.
    s = space_variables(s)
    return s


_LOWER_RESERVED = {
    # Greek
    "alpha","beta","gamma","delta","epsilon","zeta","eta","theta","iota","kappa","lambda",
    "mu","nu","xi","pi","rho","sigma","tau","upsilon","phi","chi","psi","omega",
    # Operators
    "sum","prod","int","integral","oint","lim","sup","inf","max","min","log","ln","exp",
    "sin","cos","tan","sec","csc","cot","arcsin","arccos","arctan","sinh","cosh","tanh",
    "det","dim","ker","gcd","lcm","mod","deg","arg","liminf","limsup","im","tr",
    # Symbols
    "infinity","dots","ldots","cdots","vdots","ddots","quad","qquad","forall","exists",
    "in","subset","supset","cap","cup","perp","top","bot","emptyset","nabla","partial",
    "infty","circ","cdot","pm","mp","star","ast","dagger","ddagger","prime","mapsto",
    "cong","approx","equiv","propto","therefore","because","setminus","ne","neq","le",
    "leq","ge","geq","gg","ll","wide","thin","space","without","union","inter","diff",
    # Decoration/structural functions and named tokens
    "hat","bar","tilde","vec","dot","ddot","overline","underline","sqrt","root","frac",
    "mat","op","bb","cal","frak","mono","bold","upright","italic","abs","norm","floor",
    "ceil","round","binom","cases","stretch","accent","angle","chevron","lr","brace",
    "paren","bracket","plus","minus","times","compose","arrow","tensor","slash","big",
    "alt","double","triple","quad","wide","bar","l","r","c","x","y","n","sq","big",
}

_UPPER_RESERVED = {
    # Capital Greek
    "Alpha","Beta","Gamma","Delta","Epsilon","Zeta","Eta","Theta","Iota","Kappa","Lambda",
    "Mu","Nu","Xi","Pi","Rho","Sigma","Tau","Upsilon","Phi","Chi","Psi","Omega",
    # Common typst-recognized
    "Re","Im","Pr",
}


def _split_letters(token: str) -> str:
    return " ".join(token)


def _walk_split(s: str) -> str:
    """Walk math text, splitting variable-letter runs into spaced form.

    - Skip content inside "..." strings.
    - Outside subscript/superscript (..) groups:
        * uppercase runs of 2+ letters get split (unless in _UPPER_RESERVED)
        * lowercase runs are left alone (could be valid names like cos, psi)
    - Inside subscript/superscript (..) groups (_(..)/^(..)):
        * uppercase pairs split
        * lowercase runs split unless in _LOWER_RESERVED (these are typically tensor indices)
    """
    out = []
    i = 0
    sub_depth = 0  # depth of _( or ^( we're inside
    in_string = False
    while i < len(s):
        c = s[i]
        # toggle string mode
        if c == '"':
            in_string = not in_string
            out.append(c)
            i += 1
            continue
        if in_string:
            out.append(c)
            i += 1
            continue

        # detect _( or ^(  -> entering subscript group
        if (c == "_" or c == "^") and i + 1 < len(s) and s[i + 1] == "(":
            out.append(c)
            out.append("(")
            sub_depth += 1
            i += 2
            continue
        # closing paren that may close our group
        if c == ")" and sub_depth > 0:
            sub_depth -= 1
            out.append(c)
            i += 1
            continue

        # letter run
        if c.isalpha():
            j = i
            while j < len(s) and s[j].isalpha():
                j += 1
            word = s[i:j]
            prev = s[i - 1] if i > 0 else ""
            nxt = s[j] if j < len(s) else ""
            nxt2 = s[j + 1] if j + 1 < len(s) else ""
            # Part of a dotted name (e.g. "plus.circle", "dot.op", "arrow.r.bar")?
            # A trailing "." only counts if followed by another letter (continued name).
            dotted_after = (nxt == ".") and nxt2.isalpha()
            dotted = (prev == ".") or dotted_after
            i = j
            if len(word) <= 1 or dotted:
                out.append(word)
                continue
            is_upper = word[0].isupper()
            mixed = any(ch.isupper() for ch in word) and any(ch.islower() for ch in word)
            if mixed:
                # 2-char [A-Z][a-z] (e.g. Ke, Px) is almost always a product
                if len(word) == 2 and word[0].isupper() and word[1].islower():
                    out.append(_split_letters(word))
                else:
                    out.append(word)
            elif is_upper:
                if word in _UPPER_RESERVED:
                    out.append(word)
                else:
                    out.append(_split_letters(word))
            else:  # all lowercase
                if word in _LOWER_RESERVED:
                    out.append(word)
                elif sub_depth > 0:
                    out.append(_split_letters(word))
                elif len(word) == 2:
                    # top-level 2-letter lowercase (e.g. iy, xy) likely a product
                    out.append(_split_letters(word))
                else:
                    out.append(word)
            continue

        out.append(c)
        i += 1
    return "".join(out)


def space_variables(s: str) -> str:
    return _walk_split(s)


# --- org parsing ---
HEADING_RE = re.compile(r"^\s*(\*+)\s+(.*?)\s*$")
PROPERTIES_BEGIN = ":PROPERTIES:"
PROPERTIES_END = ":END:"
ID_RE = re.compile(r":ID:\s+([A-F0-9-]+)")
TITLE_RE = re.compile(r"^#\+title:\s*(.*)$", re.IGNORECASE)
DATE_RE = re.compile(r"^#\+date:\s*(.*)$", re.IGNORECASE)
FILETAGS_RE = re.compile(r"^#\+filetags:\s*(.*)$", re.IGNORECASE)
ID_LINK_RE = re.compile(r"\[\[id:([A-F0-9-]+)\]\[(.*?)\]\]")
SECTION_LINK_RE = re.compile(r"\[\[\*([^\]]+?)\]\[([^\]]+?)\]\]")
FILE_IMG_RE = re.compile(r"\[\[file:([^\]]+\.(?:png|jpg|jpeg|gif|svg))\]\]")
FILE_LINK_RE = re.compile(r"\[\[([^\]]+?)\]\[([^\]]+?)\]\]")
BARE_LINK_RE = re.compile(r"\[\[([^\]]+?)\]\]")


def slug_from_path(path: Path) -> str:
    name = path.stem
    name = re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-").lower()
    return name


def extract_date(raw: str) -> str:
    m = re.search(r"(\d{4}-\d{2}-\d{2})", raw)
    return m.group(1) if m else ""


def parse_filetags(raw: str) -> list[str]:
    return [p for p in raw.strip().strip(":").split(":") if p]


def make_note_id(date: str, slug: str, fallback: str = "") -> str:
    """date is YYYY-MM-DD. Returns YYYYMMDDT000000-slug."""
    if date:
        d = date.replace("-", "")
        return f"{d}T000000-{slug}"
    return fallback or f"00000000T000000-{slug}"


DOUBLE_STAR_RE = re.compile(r"\*\*([^*\n]+?)\*\*")


def convert_inline(line: str) -> str:
    def id_link_repl(m):
        uuid = m.group(1)
        desc = m.group(2)
        note_id = UUID_TO_ID.get(uuid)
        if note_id:
            return f'#note("{note_id}")[{desc}]'
        return desc

    line = ID_LINK_RE.sub(id_link_repl, line)
    line = SECTION_LINK_RE.sub(lambda m: m.group(2), line)
    line = FILE_IMG_RE.sub(lambda m: f'#image("{m.group(1)}")', line)
    line = FILE_LINK_RE.sub(lambda m: f'#link("{m.group(1)}")[{m.group(2)}]', line)
    line = BARE_LINK_RE.sub(lambda m: f'#link("{m.group(1)}")', line)
    # code: ~code~
    line = re.sub(r"~([^~\n]+)~", r"`\1`", line)
    # **bold** -> *bold* (typst uses single asterisks for strong)
    line = DOUBLE_STAR_RE.sub(r"*\1*", line)
    return line


def split_math_segments(text: str):
    segments = []
    i = 0
    while i < len(text):
        if text[i] == "$":
            j = text.find("$", i + 1)
            if j == -1:
                segments.append(("text", text[i:]))
                break
            body = text[i + 1 : j]
            kind = "math_display" if "\n" in body else "math_inline"
            segments.append((kind, body))
            i = j + 1
        else:
            j = text.find("$", i)
            if j == -1:
                segments.append(("text", text[i:]))
                break
            segments.append(("text", text[i:j]))
            i = j
    return segments


def convert_body(text: str) -> str:
    out_parts = []
    for kind, body in split_math_segments(text):
        if kind == "text":
            lines = body.split("\n")
            out_parts.append("\n".join(convert_inline(l) for l in lines))
        elif kind == "math_inline":
            out_parts.append("$" + convert_math(body) + "$")
        else:
            inner = convert_math(body).strip("\n")
            out_parts.append("$ " + inner + " $")
    return "".join(out_parts)


def convert_tables(text: str) -> str:
    out = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        if lines[i].lstrip().startswith("|"):
            tbl = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                tbl.append(lines[i])
                i += 1
            rows = []
            for r in tbl:
                if re.match(r"^\s*\|[-+]+", r):
                    continue
                cells = [c.strip() for c in r.strip().strip("|").split("|")]
                rows.append(cells)
            if rows:
                ncols = max(len(r) for r in rows)
                flat = []
                for r in rows:
                    for c in r + [""] * (ncols - len(r)):
                        flat.append("[" + c + "]")
                out.append(f"#table(\n  columns: {ncols},")
                out.append("  " + ", ".join(flat) + ",")
                out.append(")")
            continue
        out.append(lines[i])
        i += 1
    return "\n".join(out)


def convert_file(org_path: Path) -> tuple[str, str]:
    text = org_path.read_text(encoding="utf-8")
    lines = text.split("\n")

    title = ""
    date = ""
    tags: list[str] = []
    uuid = ""

    body_lines: list[str] = []
    i = 0
    in_overview = False
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped == PROPERTIES_BEGIN:
            j = i + 1
            while j < len(lines) and lines[j].strip() != PROPERTIES_END:
                m = ID_RE.search(lines[j])
                if m:
                    uuid = m.group(1)
                j += 1
            i = j + 1
            continue

        m = TITLE_RE.match(line)
        if m:
            title = m.group(1).strip()
            i += 1; continue
        m = DATE_RE.match(line)
        if m:
            date = extract_date(m.group(1))
            i += 1; continue
        m = FILETAGS_RE.match(line)
        if m:
            tags = parse_filetags(m.group(1))
            i += 1; continue

        if stripped.lower().startswith(("#+startup:", "#+options:", "#+last_modified:")):
            i += 1; continue
        if stripped.lower().startswith("#+book:"):
            body_lines.append("// " + stripped)
            i += 1; continue
        if stripped.startswith("#+INCLUDE:"):
            body_lines.append("// " + stripped)
            i += 1; continue
        if stripped.startswith("#+DOWNLOADED:"):
            i += 1; continue

        if stripped.startswith("#+begin_overview"):
            in_overview = True
            i += 1; continue
        if in_overview:
            if stripped.startswith("#+end_overview"):
                in_overview = False
            i += 1; continue

        bm = re.match(r"#\+begin_(\w+)", stripped, re.IGNORECASE)
        if bm:
            name = bm.group(1).lower()
            mapped = BLOCK_MAP.get(name)
            if mapped:
                body_lines.append(f"#{mapped}[")
            else:
                body_lines.append(f"// (unhandled block: {name})")
            i += 1; continue
        em = re.match(r"#\+end_(\w+)", stripped, re.IGNORECASE)
        if em:
            if BLOCK_MAP.get(em.group(1).lower()):
                body_lines.append("]")
            i += 1; continue

        hm = HEADING_RE.match(line)
        if hm:
            level = len(hm.group(1))
            text_h = hm.group(2)
            text_h = re.sub(r"^(TODO|DONE|WAITING|CANCELED)\s+", "", text_h)
            body_lines.append("=" * level + " " + convert_inline(text_h))
            i += 1; continue

        body_lines.append(line)
        i += 1

    body_text = "\n".join(body_lines)
    body_text = convert_tables(body_text)
    body_text = convert_body(body_text)
    body_text = re.sub(r"\n{3,}", "\n\n", body_text).strip() + "\n"

    slug = slug_from_path(org_path)
    note_id = UUID_TO_ID.get(uuid) or make_note_id(date, slug)

    tags_field = "(" + ", ".join(f'"{t}"' for t in tags) + ("," if tags else "") + ")"

    header = (
        '#import "/_typst/note.typ": *\n'
        '#set heading(numbering: "1.")\n'
        '#set math.equation(numbering: "(1)")\n'
        "\n"
        "#metadata((\n"
        '  kind: "note",\n'
        f'  id: "{note_id}",\n'
        f'  title: "{title}",\n'
        f'  date: "{date}",\n'
        f'  tags: {tags_field},\n'
        f"  aliases: (),\n"
        ")) <note>\n"
        "\n"
    )

    # If the body's first heading already restates the title, don't double up.
    # Otherwise add a top-level title heading.
    body_stripped = body_text.lstrip()
    first_heading_match = re.match(r"=\s+(.+)", body_stripped.split("\n", 1)[0]) if body_stripped else None
    if first_heading_match is None:
        body_text = f"= {title}\n\n" + body_text

    return note_id, header + body_text


def main():
    written = []
    for rel in FILES:
        org = ROOT / rel
        note_id, content = convert_file(org)
        out = org.with_suffix(".typ")
        out.write_text(content, encoding="utf-8")
        written.append((note_id, out.relative_to(ROOT)))
        print(f"wrote {out} (id={note_id})")
    print("\nDone. Run M-x my/note-db-sync in Emacs to rebuild _typst/note.typ.")


if __name__ == "__main__":
    main()
