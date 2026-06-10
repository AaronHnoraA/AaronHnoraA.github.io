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
          ["graph",    "Open the knowledge graph (archive page)"],
          ["archive",  "Go to the full notes archive"],
          ["cv",       "Open CV (PDF)"],
          ["github",   "Open GitHub profile"],
          ["neofetch", "Show system information"],
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
          ["Name",       "Aaron He (何浩晨)"],
          ["Role",       "Mathematics undergraduate, UNSW Sydney"],
          ["Program",    "Talented Students Program"],
          ["Supervisor", "Youming Qiao"],
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

    graph(_args) {
      window.open("notes.html#graph", "_self");
      return line("out-ok", "Opening knowledge graph…");
    },

    archive(_args) {
      window.open("notes.html", "_self");
      return line("out-ok", "Opening archive…");
    },

    cv(_args) {
      window.open("CV/Aaron_He_CV.pdf", "_blank");
      return line("out-ok", "Opening CV/Aaron_He_CV.pdf in new tab.");
    },

    github(_args) {
      window.open("https://github.com/AaronHnoraA", "_blank");
      return line("out-ok", "Opening GitHub profile in new tab.");
    },

    neofetch(_args) {
      return buildNeofetch();
    },

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
        "about.txt": () => COMMANDS.about([]),
        "research.txt": () => COMMANDS.research([]),
        "hostname": () => line("t-line", "Aaron-MBP.local"),
        "/etc/hostname": () => line("t-line", "Aaron-MBP.local"),
      };
      if (map[target]) return map[target]();
      return line("out-error", `cat: ${escHtml(target)}: No such file or directory`);
    },

    open(args) {
      const target = args[0] || "";
      if (target === "notes" || target === "notes.html") return COMMANDS.archive([]);
      if (target === "graph") return COMMANDS.graph([]);
      if (target === "cv" || target === "cv.pdf" || target === "CV") return COMMANDS.cv([]);
      if (target === "github") return COMMANDS.github([]);
      return line("out-error", `open: ${escHtml(target)}: not found`);
    },
  };

  /* ── Neofetch generator ──────────────────────────────────────────────── */

  /* Nerd font codepoints — renders correctly if visitor has a nerd font,
     degrades gracefully to blank glyph otherwise. */
  const NF = {
    apple:   "",  /* nf-fa-apple */
    laptop:  "󰌢",  /* nf-md-laptop  U+F0322 */
    kernel:  "",  /* nf-dev-apple_full */
    box:     "󰏖",  /* nf-md-package_variant U+F03D6 */
    clock:   "󰅐",  /* nf-md-clock_time_four_outline U+F0150 */
    monitor: "󰍹",  /* nf-md-monitor U+F0379 */
    wm:      "󰧢",  /* nf-cod-window U+F08E2 */
    shell:   "",  /* nf-pl-left_hard_divider */
    term:    "",  /* nf-fa-terminal */
    cpu:     "󰿠",  /* nf-md-cpu_64_bit U+F0FE0 */
    gpu:     "󰅛",  /* nf-md-memory U+F035B */
    mem:     "󰅭",  /* nf-md-memory U+F046D */
    ip:      "\uDB82\uDA5F",  /* nf-md-ip_network U+F0A5F */
    globe:   "\uDB82\uDA60",  /* nf-md-ip_network_outline U+F0A60 */
  };

  function buildNeofetch() {
    const siteAge = Math.floor(
      (Date.now() - new Date("2025-06-01").getTime()) / (1000 * 60 * 60 * 24),
    );
    const k = getKnowledge();
    const noteCount = k ? (k.publicNotes || k.notes || []).length : "—";

    /* key width aligns all arrows */
    const KW = 12;

    function kv(icon, key, val, valCls = "nf-val") {
      const iconHtml = icon
        ? `<span class="nf-icon">${icon}</span> `
        : `  `;
      const paddedKey = key.padEnd(KW);
      return (
        `    ${iconHtml}` +
        `<span class="nf-key">${escHtml(paddedKey)}</span>` +
        `<span class="nf-arrow">-&gt;   </span>` +
        `<span class="${valCls}">${val}</span>`
      );
    }

    const W = 80;
    const title = " System Information ";
    const rem = W - title.length - 2;
    const bL = "─".repeat(Math.floor(rem / 2));
    const bR = "─".repeat(Math.ceil(rem / 2));

    function tline(inner) {
      return `<span class="t-line">${inner}</span>`;
    }

    const lineData = [
      `<span class="nf-border">┌${bL}</span><span class="nf-title">${title}</span><span class="nf-border">${bR}┐</span>`,
      ``,
      kv(NF.apple,   "OS",           "macOS Tahoe 26.5.1 (25F80) arm64"),
      kv(NF.laptop,  "Machine",      "MacBook Pro (14-inch, 2023)"),
      kv(NF.kernel,  "Kernel",       "Darwin 25.5.0"),
      kv(NF.box,     "Packages",     "465 (brew), 26 (brew-cask), 146 (nix-system), 359 (nix-user)"),
      kv(NF.monitor, "Resolution",   "6016x3384 @ 60Hz, 3600x2338 @ 120Hz"),
      kv(NF.wm,      "WM",           "Quartz Compositor 1.600.0 (with Yabai)"),
      kv(NF.shell,   "Shell",        "zsh 5.9"),
      kv(NF.term,    "Terminal",     "kitty 0.47.1"),
      kv(NF.cpu,     "CPU",          "Apple M2 Max (12) @ 3.50 GHz"),
      kv(NF.gpu,     "GPU",          "Apple M2 Max (30) @ 1.40 GHz [Integrated]"),
      kv(NF.mem,     "Memory",       "25.03 GiB / 32.00 GiB (78%)"),
      kv(NF.globe,   "Location",     "Sydney, AU"),
      kv("",         "Site age",     `${siteAge} days`, "nf-val-hi"),
      kv("",         "Notes",        `${noteCount} published`, "nf-val-hi"),
      ``,
      `<span class="nf-border">└${"─".repeat(W)}┘</span>`,
    ];

    const palette = tline(
      `\n                                  ` +
      [0,1,2,3,4,5,6,7].map((i) => `<span class="swatch swatch-${i}">  </span>`).join(""),
    );

    return lineData.map(tline).join("") + palette;
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

    return line("out-error", `${escHtml(cmd)}: command not found  (type <span class="t-cmd">help</span> for available commands)`);
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

  // Render static neofetch and fortune
  const nfEl = document.getElementById("neofetch-static");
  if (nfEl) nfEl.innerHTML = buildNeofetch();
  const ftEl = document.getElementById("fortune-static");
  if (ftEl) ftEl.innerHTML = buildFortune();

  setTimeout(() => {
    const hint = document.getElementById("terminal-hint");
    if (hint) hint.style.visibility = "visible";
    input.focus();
    scrollBottom();
  }, 100);

})();
