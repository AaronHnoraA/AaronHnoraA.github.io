/* home-cli.js — Terminal CLI for Aaron He's site */

(function () {
  "use strict";

  /* ── DOM ──────────────────────────────────────────────────────────────── */
  const scroll   = document.getElementById("terminal-scroll");
  const history  = document.getElementById("terminal-history");
  const input    = document.getElementById("terminal-input");

  if (!scroll || !history || !input) return;

  /* ── Input history (↑/↓) ─────────────────────────────────────────────── */
  const inputHistory = [];
  let histIdx = -1;
  let savedDraft = "";

  /* ── Auto-scroll ─────────────────────────────────────────────────────── */
  function scrollBottom() {
    scroll.scrollTop = scroll.scrollHeight;
  }

  /* ── Build prompt PS1 HTML ───────────────────────────────────────────── */
  function ps1() {
    return `<span class="p-user">hc</span><span class="p-at">@</span><span class="p-host">Aaron</span> <span class="p-path">~</span> <span class="p-sym">%</span>`;
  }

  /* ── Append a command block (echo + output) ──────────────────────────── */
  function appendBlock(cmdText, outputHtml) {
    const block = document.createElement("div");
    block.className = "cmd-block";

    const echo = document.createElement("div");
    echo.className = "cmd-prompt-echo";
    echo.innerHTML = `<span class="prompt-ps1">${ps1()}</span>&nbsp;<span class="t-cmd">${escHtml(cmdText)}</span>`;

    const out = document.createElement("div");
    out.className = "cmd-output";
    out.innerHTML = outputHtml;

    block.appendChild(echo);
    if (outputHtml) block.appendChild(out);
    history.appendChild(block);
    scrollBottom();
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function line(cls, text) {
    return `<span class="t-line ${cls}">${escHtml(text)}</span>`;
  }

  function blank() { return `<span class="t-blank"></span>`; }

  /* ── Notes data helper ───────────────────────────────────────────────── */
  function getKnowledge() {
    return window.KNOWLEDGE_DATA || null;
  }

  /* ── COMMANDS ─────────────────────────────────────────────────────────── */

  const COMMANDS = {

    help(_args) {
      return [
        line("out-section-title", "Available commands:"),
        blank(),
        `<table class="out-table">` +
        rows([
          ["about",    "Personal information and research profile"],
          ["notes",    "Browse published notes by section"],
          ["ls",       "List top-level sections (alias: dir)"],
          ["search",   "Search notes: search <query>"],
          ["tags",     "List all tags"],
          ["books",    "List books and note series"],
          ["recent",   "Show most recently updated notes"],
          ["random",   "Open a random note"],
          ["graph",    "Open the knowledge graph"],
          ["archive",  "Go to the full notes archive"],
          ["publications", "Publications and preprints"],
          ["neofetch", "Show personal info panel"],
          ["cv",       "Open CV (PDF)"],
          ["github",   "Open GitHub profile"],
          ["clear",    "Clear the terminal"],
          ["help",     "Show this message"],
        ]) +
        `</table>`,
      ].join("\n");
    },

    about(_args) {
      return [
        blank(),
        `<table class="out-table">` +
        rows([
          ["Name",       "Chang He (Aaron)"],
          ["Role",       "Mathematics undergraduate, UNSW Sydney"],
          ["Program",    "Talented Students Program"],
          ["Supervisor", "<a class='out-note-link' href='https://sites.google.com/site/jimmyqiao86/'>Youming Qiao</a>"],
          ["Research",   "Quantum computing · TCS · Linear algebra"],
          ["Email",      "<a class='out-note-link' href='mailto:aaron.he@student.unsw.edu.au'>aaron.he@student.unsw.edu.au</a>"],
          ["GitHub",     "<a class='out-note-link' href='https://github.com/AaronHnoraA' target='_blank'>AaronHnoraA</a>"],
          ["CV",         "<a class='out-note-link' href='CV/Aaron_He_CV.pdf' target='_blank'>Aaron_He_CV.pdf</a>"],
        ]) +
        `</table>`,
        blank(),
        line("out-val", "I keep these notes in public so each topic has to survive"),
        line("out-val", "careful writing, revision, and cross-reference."),
      ].join("\n");
    },

    whoami(_args) { return COMMANDS.about([]); },

    research(_args) {
      return [
        blank(),
        line("out-section-title", "Research interests"),
        blank(),
        line("out-key", "Quantum computing"),
        line("out-val", "  Quantum states, observables, density operators, the linear"),
        line("out-val", "  algebra behind them; quantum information theory."),
        blank(),
        line("out-key", "Theoretical computer science"),
        line("out-val", "  Complexity, algorithms, combinatorics, and communication"),
        line("out-val", "  complexity."),
        blank(),
        line("out-key", "Algebraic structure"),
        line("out-val", "  Galois theory, group theory, linear algebra over general fields."),
      ].join("\n");
    },

    ls(args) {
      const k = getKnowledge();
      if (args[0] === "notes/" || args[0] === "notes") {
        return COMMANDS.notes([]);
      }
      const sections = k
        ? k.groups.map((g) => `<div class="out-note-item">  <span class="out-note-group">${escHtml(g.label)}/</span> <span class="out-note-date">(${g.items.length} notes)</span></div>`).join("")
        : line("out-warn", "Note data not loaded yet. Try again in a moment.");

      return [
        blank(),
        line("out-section-title", "~/notes/"),
        sections,
        blank(),
        line("out-dim", "  CV/          about.txt      research.txt"),
      ].join("\n");
    },

    dir(args) { return COMMANDS.ls(args); },

    notes(args) {
      const k = getKnowledge();
      if (!k) return line("out-warn", "Note data not loaded yet — try again in a moment.");

      const query = args.join(" ").toLowerCase().trim();
      let groups = k.groups;

      if (query) {
        groups = groups
          .map((g) => ({
            ...g,
            items: g.items.filter(
              (n) =>
                n.title.toLowerCase().includes(query) ||
                n.tags.some((t) => t.includes(query)),
            ),
          }))
          .filter((g) => g.items.length > 0);
      }

      if (groups.length === 0) {
        return line("out-warn", `No notes matching "${query}".`);
      }

      const total = groups.reduce((s, g) => s + g.items.length, 0);
      const parts = [
        blank(),
        line("out-section-title", `Public notes (${total} shown${query ? ` · filtered: "${query}"` : ""})`),
      ];

      groups.forEach((g) => {
        parts.push(`<div class="out-note-group">  ${escHtml(g.label)}/</div>`);
        g.items.slice(0, 20).forEach((n) => {
          const date = n.date ? `<span class="out-note-date"> ${escHtml(n.date)}</span>` : "";
          const link = n.link
            ? `<a class="out-note-link" href="${escHtml(n.link)}" target="_blank">${escHtml(n.title)}</a>`
            : escHtml(n.title);
          parts.push(`<div class="out-note-item">    ${link}${date}</div>`);
        });
        if (g.items.length > 20) {
          parts.push(`<div class="out-note-item t-dim">    … and ${g.items.length - 20} more</div>`);
        }
      });

      if (query) {
        parts.push(blank());
        parts.push(line("out-hint", `  Tip: "notes" without arguments shows all sections.`));
      }

      return parts.join("\n");
    },

    search(args) {
      if (args.length === 0) return line("out-warn", "Usage: search <query>");
      return COMMANDS.notes(args);
    },

    tags(_args) {
      const k = getKnowledge();
      if (!k) return line("out-warn", "Note data not loaded yet.");
      const tags = (k.publicTags || k.tags || []).slice(0, 60);
      if (!tags.length) return line("out-warn", "No tags found.");
      return [
        blank(),
        line("out-section-title", `Tags (${tags.length})`),
        `  ` + tags.map((t) => `<span class="t-cmd">${escHtml(t.name || t)}</span><span class="out-note-date">(${t.count || ""})</span>`).join("  "),
      ].join("\n");
    },

    books(_args) {
      const k = getKnowledge();
      if (!k) return line("out-warn", "Note data not loaded yet.");
      const books = k.books || [];
      if (!books.length) return line("out-warn", "No books published yet.");

      const parts = [
        blank(),
        line("out-section-title", "Books & note series"),
        blank(),
      ];

      books.forEach((b) => {
        const linkEl = b.link
          ? `<a class="out-note-link" href="${escHtml(b.link)}" target="_blank">${escHtml(b.title)}</a>`
          : escHtml(b.title);
        const sections = b.toc && b.toc.length
          ? `<span class="out-note-date"> (${b.toc.length} sections)</span>`
          : "";
        const path = b.path
          ? `<span class="out-note-date"> · ${escHtml(b.path)}</span>`
          : "";
        parts.push(`<div class="out-note-item">  ${linkEl}${path}${sections}</div>`);
      });

      return parts.join("\n");
    },

    recent(args) {
      const k = getKnowledge();
      if (!k) return line("out-warn", "Note data not loaded yet.");

      const count = Math.min(parseInt(args[0]) || 10, 50);
      const notes = (k.publicNotes || [])
        .filter((n) => n.date)
        .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
        .slice(0, count);

      if (!notes.length) return line("out-warn", "No notes with dates found.");

      const parts = [
        blank(),
        line("out-section-title", `Recent notes (${notes.length})`),
      ];

      notes.forEach((n) => {
        const link = n.link
          ? `<a class="out-note-link" href="${escHtml(n.link)}" target="_blank">${escHtml(n.title)}</a>`
          : escHtml(n.title);
        const date = n.date ? ` <span class="out-note-date">${escHtml(n.date)}</span>` : "";
        parts.push(`<div class="out-note-item">  ${link}${date}</div>`);
      });

      return parts.join("\n");
    },

    random(_args) {
      const k = getKnowledge();
      const notes = k ? (k.publicNotes || []) : [];
      if (!notes.length) return line("out-warn", "No notes available.");
      const n = notes[Math.floor(Math.random() * notes.length)];
      if (n.link) window.open(n.link, "_blank");
      return line("out-ok", "Opening: " + n.title);
    },

    publications(_args) {
      return [
        blank(),
        line("out-section-title", "Publications & preprints"),
        blank(),
        line("out-dim",  "  No publications yet."),
        blank(),
        line("out-val",  "  Working on research with Youming Qiao (UNSW Sydney)."),
        line("out-val",  "  Results forthcoming."),
      ].join("\n");
    },

    graph(_args) {
      const id = "cli-graph-" + Date.now();
      window.__GRAPH_NO_AUTO_INIT__ = true;
      loadGraphEngine().then(() => {
        const el = document.getElementById(id);
        if (el && window.initKnowledgeGraph) {
          window.initKnowledgeGraph({ container: el, toolbar: false });
        }
      });
      return [
        blank(),
        line("out-dim", "  Loading knowledge graph…"),
        `<div id="${id}" class="cli-graph-container"></div>`,
      ].join("\n");
    },

    archive(_args) {
      return COMMANDS.notes([]);
    },

    cv(_args) {
      window.open("CV/Aaron_He_CV.pdf", "_blank");
      return line("out-ok", "Opening CV/Aaron_He_CV.pdf in new tab.");
    },

    github(_args) {
      window.open("https://github.com/AaronHnoraA", "_blank");
      return line("out-ok", "Opening GitHub profile in new tab.");
    },

    neofetch(_args) { return buildFastfetch(); },
    fastfetch(_args) { return buildFastfetch(); },

    clear(_args) {
      history.innerHTML = "";
      return null;
    },

    cls(args) { return COMMANDS.clear(args); },

    /* Easter eggs */
    sudo(_args) {
      return line("out-error", "hc is not in the sudoers file. This incident will be reported.");
    },

    exit(_args) {
      return [
        line("out-warn", "logout"),
        line("out-dim", "Saving session..."),
        line("out-dim", "...copying shared history..."),
        line("out-dim", "...saving history...truncating history files..."),
        line("out-dim", "...completed."),
      ].join("\n");
    },

    uname(_args) {
      return line("t-line", "Darwin Aaron-MBP.local 25.5.0 Darwin Kernel Version 25.5.0 arm64");
    },

    pwd(_args) {
      return line("t-line", "/Users/hc");
    },

    cat(args) {
      const target = args[0] || "";
      const map = {
        "about.txt":    () => COMMANDS.about([]),
        "research.txt": () => COMMANDS.research([]),
        "hostname":     () => line("t-line", "Aaron-MBP.local"),
        "/etc/hostname":() => line("t-line", "Aaron-MBP.local"),
      };
      if (map[target]) return map[target]();
      return line("out-error", `cat: ${escHtml(target)}: No such file or directory`);
    },

    open(args) {
      const target = args[0] || "";
      if (target === "notes" || target === "notes.html") return COMMANDS.archive([]);
      if (target === "graph")                            return COMMANDS.graph([]);
      if (target === "cv" || target === "CV")           return COMMANDS.cv([]);
      if (target === "github")                          return COMMANDS.github([]);
      if (target === "books")                           return COMMANDS.books([]);
      return line("out-error", `open: ${escHtml(target)}: not found`);
    },
  };

  /* ── Personal fastfetch (boot + neofetch command) ─────────────────────── */

  function buildFastfetch() {
    const k = getKnowledge();
    const stats = k ? k.stats : null;

    const siteAge = Math.floor(
      (Date.now() - new Date("2025-06-01").getTime()) / (1000 * 60 * 60 * 24),
    );

    function daysAgo(dateStr) {
      if (!dateStr) return "—";
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (days === 0) return "today";
      if (days === 1) return "1 day ago";
      return days + " days ago";
    }

    const noteCount = stats
      ? stats.totalNotes
      : k ? (k.publicNotes || []).length : "—";
    const tagCount  = stats ? stats.totalTags  : "—";
    const linkCount = stats ? stats.totalReferenceEdges : "—";
    const updated   = stats ? daysAgo(stats.latestDate) : "—";

    /* ── Bloch-sphere ASCII logo ── */
    function ll(inner) { return `<span class="ff-logo-line">${inner}</span>`; }
    function sp(s)     { return `<span class="ff-sphere">${escHtml(s)}</span>`; }
    function kt(s)     { return `<span class="ff-ket">${escHtml(s)}</span>`; }
    function pl(s)     { return `<span class="ff-plus">${escHtml(s)}</span>`; }
    function cp(s)     { return `<span class="ff-caption">${escHtml(s)}</span>`; }
    function dm(s)     { return `<span class="nf-border">${escHtml(s)}</span>`; }

    const logoHtml = [
      ll(sp("         .----.")),
      ll(sp("        /  |   \\")),
      ll(sp("       |   |    |") + "  " + kt("|0⟩")),
      ll(sp("       | ") + pl("-+-") + sp("   |") + "  " + dm("─────")),
      ll(sp("       |   |    |") + "  " + kt("|1⟩")),
      ll(sp("        \\  |   /")),
      ll(sp("         '----'")),
      ll(cp("  |ψ⟩ = α|0⟩+β|1⟩")),
    ].join("");

    /* ── Info rows ── */
    const KW = 10;
    function kv(key, val, valCls) {
      valCls = valCls || "nf-val";
      return (
        `<div class="ff-row">` +
        `<span class="nf-key">${escHtml(key.padEnd(KW))}</span>` +
        `<span class="nf-arrow"> →  </span>` +
        `<span class="${valCls}">${val}</span>` +
        `</div>`
      );
    }

    function sep() { return `<div class="ff-sep"></div>`; }

    const infoHtml = [
      kv("Name",       escHtml("Chang He (Aaron)")),
      kv("Role",       escHtml("Mathematics undergraduate")),
      kv("Program",    escHtml("Talented Students Program")),
      kv("School",     escHtml("UNSW Sydney")),
      kv("Supervisor", "<a class='out-note-link' href='https://sites.google.com/site/jimmyqiao86/' target='_blank'>Youming Qiao</a>"),
      kv("Research",   escHtml("Quantum · TCS · Algebra")),
      kv("Location",   escHtml("Sydney, AU")),
      sep(),
      kv("Notes",   escHtml(String(noteCount)), "nf-val-hi"),
      kv("Tags",    escHtml(String(tagCount)),  "nf-val-hi"),
      kv("Links",   escHtml(String(linkCount)), "nf-val-hi"),
      kv("Updated", escHtml(String(updated)),   "nf-val-hi"),
      kv("Uptime",  escHtml(siteAge + " days"), "nf-val-hi"),
      sep(),
      kv("Email",  "<a class='out-note-link' href='mailto:aaron.he@student.unsw.edu.au'>aaron.he@student.unsw.edu.au</a>"),
      kv("GitHub", "<a class='out-note-link' href='https://github.com/AaronHnoraA' target='_blank'>AaronHnoraA</a>"),
      kv("CV",     "<a class='out-note-link' href='CV/Aaron_He_CV.pdf' target='_blank'>Aaron_He_CV.pdf</a>"),
    ].join("");

    const palette =
      `<div class="palette-row ff-palette">` +
      [0,1,2,3,4,5,6,7].map((i) => `<span class="swatch swatch-${i}">  </span>`).join("") +
      `</div>`;

    return (
      `<div class="fastfetch">` +
      `<div class="ff-logo">${logoHtml}</div>` +
      `<div class="ff-info">${infoHtml}${palette}</div>` +
      `</div>`
    );
  }

  /* ── Dynamic graph engine loader ────────────────────────────────────── */

  function loadGraphEngine() {
    function loadScript(src) {
      return new Promise((res) => {
        if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
        const s = document.createElement("script");
        s.src = src; s.onload = res; s.onerror = res;
        document.head.appendChild(s);
      });
    }
    const d3Ready = typeof d3 !== "undefined"
      ? Promise.resolve()
      : loadScript("https://d3js.org/d3.v7.min.js");
    return d3Ready.then(() =>
      window.initKnowledgeGraph ? Promise.resolve() : loadScript("js/graph.js")
    );
  }

  /* ── Fortune / cow generator ─────────────────────────────────────────── */

  const FORTUNES = [
    {
      text: "Why you say you no bunny rabbit when you have little powder-puff tail?",
      attr: "-- The Tasmanian Devil",
    },
    {
      text: "There are 10 types of people in the world:\nthose who understand binary, and those who don't.",
      attr: "-- unknown",
    },
    {
      text: "The best way to predict the future is to invent it.",
      attr: "-- Alan Kay",
    },
    {
      text: "A proof is a proof. What kind of a proof? It's a proof.\nA proof is a proof, and when you have a good proof, it's because it's proven.",
      attr: "-- Jean Chrétien",
    },
    {
      text: "Mathematics is the language with which God has written the universe.",
      attr: "-- Galileo Galilei",
    },
    {
      text: "It is not enough to be in the right place at the right time.\nYou should also have an open mind at the right time.",
      attr: "-- Paul Erdős",
    },
  ];

  function buildFortune() {
    const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    const cowLines = [
      `              (__)`,
      `               (oo)`,
      `         /------\\/`,
      `        / |    ||`,
      `       *  /\\---/\\`,
      `          ~~   ~~`,
    ];

    const cowHtml = cowLines
      .map((l) => `<span class="t-line nf-border">${escHtml(l)}</span>`)
      .join("");

    const attrLines = f.text.split("\n")
      .map((l) => `<span class="t-line fortune-quote">${escHtml(l)}</span>`)
      .join("");

    return (
      cowHtml +
      `<span class="t-line fortune-quote">..."Have you mooed today?"...</span>` +
      attrLines +
      `<span class="t-line fortune-attr">        ${escHtml(f.attr)}</span>`
    );
  }

  /* ── Recent notes preview (boot) ─────────────────────────────────────── */

  function buildRecentPreview() {
    const k = getKnowledge();
    if (!k || !(k.publicNotes || []).length) return "";

    const notes = (k.publicNotes || [])
      .filter((n) => n.date)
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      .slice(0, 3);

    if (!notes.length) return "";

    const items = notes.map((n) => {
      const link = n.link
        ? `<a class="out-note-link" href="${escHtml(n.link)}" target="_blank">${escHtml(n.title)}</a>`
        : escHtml(n.title);
      const date = n.date ? ` <span class="out-note-date">${escHtml(n.date)}</span>` : "";
      return `<div class="out-note-item">  ${link}${date}</div>`;
    }).join("");

    return [
      `<span class="t-line out-section-title">Recent:</span>`,
      items,
      `<span class="t-blank"></span>`,
    ].join("");
  }

  /* ── Table builder ───────────────────────────────────────────────────── */

  function rows(pairs) {
    return pairs.map(([k, v]) =>
      `<tr><td class="td-key">${escHtml(k)}</td>` +
      `<td class="td-arrow">  →  </td>` +
      `<td>${v}</td></tr>`
    ).join("");
  }

  /* ── Command dispatcher ──────────────────────────────────────────────── */

  function dispatch(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    if (COMMANDS[cmd]) {
      return COMMANDS[cmd](args);
    }

    return line("out-error", `${escHtml(cmd)}: command not found  (type help for available commands)`);
  }

  /* ── Keyboard handler ─────────────────────────────────────────────────── */

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const raw = input.value;
      input.value = "";
      histIdx = -1;
      savedDraft = "";

      if (raw.trim()) {
        inputHistory.unshift(raw);
        if (inputHistory.length > 200) inputHistory.pop();
      }

      const output = dispatch(raw);
      if (output !== null) {
        appendBlock(raw, output || "");
      } else if (raw.trim() === "clear" || raw.trim() === "cls") {
        /* already cleared */
      } else {
        appendBlock(raw, "");
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx === -1) savedDraft = input.value;
      if (histIdx < inputHistory.length - 1) {
        histIdx++;
        input.value = inputHistory[histIdx];
      }
      moveCursorEnd();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) {
        histIdx--;
        input.value = inputHistory[histIdx];
      } else if (histIdx === 0) {
        histIdx = -1;
        input.value = savedDraft;
      }
      moveCursorEnd();
      return;
    }

    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      history.innerHTML = "";
    }
  });

  function moveCursorEnd() {
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }

  /* ── Click anywhere → focus input ────────────────────────────────────── */

  document.getElementById("terminal-scroll").addEventListener("click", () => {
    if (!window.getSelection().toString()) {
      input.focus();
    }
  });

  /* ── Startup boot sequence ────────────────────────────────────────────── */

  const nfEl = document.getElementById("neofetch-static");
  if (nfEl) nfEl.innerHTML = buildFastfetch();

  const rcEl = document.getElementById("recent-static");
  if (rcEl) rcEl.innerHTML = buildRecentPreview();

  const ftEl = document.getElementById("fortune-static");
  if (ftEl) ftEl.innerHTML = buildFortune();

  setTimeout(() => {
    const hint = document.getElementById("terminal-hint");
    if (hint) hint.style.visibility = "visible";
    input.focus();
    scrollBottom();
  }, 100);

})();
