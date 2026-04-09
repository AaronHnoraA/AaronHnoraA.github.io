document.addEventListener("DOMContentLoaded", () => {
  const knowledge = window.KNOWLEDGE_DATA;
  const app = document.getElementById("app-tabs");
  const searchWrapper = document.querySelector(".search-wrapper");
  const searchInput = document.getElementById("note-search");
  const resetBtn = document.getElementById("reset-search");
  const tagCloud = document.getElementById("tag-cloud");
  const sortSelect = document.getElementById("sort-select");
  const summary = document.getElementById("notes-summary");
  const activeFilters = document.getElementById("active-filters");

  if (!knowledge || !app || !searchWrapper || !searchInput || !resetBtn || !tagCloud || !sortSelect) {
    return;
  }

  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  const suggestionBox = document.createElement("div");
  suggestionBox.className = "autocomplete-suggestions";
  searchWrapper.appendChild(suggestionBox);

  const state = {
    text: "",
    tags: new Set(),
    sort: "date-desc",
    tab: "",
    focusedKey: "",
  };

  let isComposing = false;
  let debounceTimer = null;
  let pendingScrollKey = "";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlightText(text, keyword) {
    if (!keyword) {
      return escapeHtml(text);
    }

    const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${safeKeyword})`, "gi");
    return escapeHtml(text).replace(regex, "<mark>$1</mark>");
  }

  function applyHighlights(text, query) {
    const terms = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    if (terms.length === 0) {
      return escapeHtml(text);
    }

    const regex = new RegExp(`(${terms.join("|")})`, "gi");
    return escapeHtml(text).replace(regex, "<mark>$1</mark>");
  }

  function debounce(fn, wait) {
    return (...args) => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => fn(...args), wait);
    };
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    state.text = params.get("q") || "";
    state.sort = params.get("sort") || "date-desc";
    state.tab = params.get("tab") || "";
    state.focusedKey = params.get("focus") || "";

    state.tags.clear();
    (params.get("tags") || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .forEach((tag) => state.tags.add(tag));

    searchInput.value = state.text;
    sortSelect.value = state.sort;
  }

  function syncUrlState() {
    const params = new URLSearchParams();

    if (state.text) params.set("q", state.text);
    if (state.tags.size > 0) params.set("tags", Array.from(state.tags).join(","));
    if (state.sort !== "date-desc") params.set("sort", state.sort);
    if (state.tab) params.set("tab", state.tab);
    if (state.focusedKey) params.set("focus", state.focusedKey);

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function sortFiles(files) {
    return files.slice().sort((a, b) => {
      if (state.sort === "date-desc") return b.dateValue - a.dateValue || collator.compare(a.title, b.title);
      if (state.sort === "date-asc") return a.dateValue - b.dateValue || collator.compare(a.title, b.title);
      return collator.compare(a.title, b.title);
    });
  }

  function filterFiles() {
    return knowledge.filterNotes({ text: state.text, tags: Array.from(state.tags) });
  }

  function switchTab(groupKey) {
    state.tab = groupKey;

    document.querySelectorAll(".tab-btn").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === groupKey);
    });

    document.querySelectorAll(".tab-content").forEach((pane) => {
      pane.classList.toggle("active", pane.dataset.tab === groupKey);
    });
  }

  function renderSummary(filtered) {
    if (!summary) {
      return;
    }

    const cards = [
      {
        label: "Notes",
        value: knowledge.stats.totalNotes,
        hint: `${knowledge.stats.connectedNotes} connected`,
      },
      {
        label: "Visible",
        value: filtered.length,
        hint: state.text || state.tags.size ? "current filter" : "all notes",
      },
      {
        label: "Tags",
        value: knowledge.stats.totalTags,
        hint: `${knowledge.stats.totalReferenceEdges} references`,
      },
      {
        label: "Updated",
        value: knowledge.stats.latestDate || "--",
        hint: knowledge.stats.generatedAt ? "generated index" : "content date",
      },
    ];

    summary.innerHTML = cards
      .map(
        (card) => `
          <article class="summary-card">
            <span class="summary-label">${escapeHtml(card.label)}</span>
            <strong class="summary-value">${escapeHtml(String(card.value))}</strong>
            <span class="summary-hint">${escapeHtml(card.hint)}</span>
          </article>
        `,
      )
      .join("");
  }

  function renderActiveFilters() {
    if (!activeFilters) {
      return;
    }

    const chips = [];

    if (state.text) {
      chips.push(`
        <button class="filter-chip" type="button" data-filter-kind="text">
          Search: ${escapeHtml(state.text)}
        </button>
      `);
    }

    Array.from(state.tags)
      .sort((a, b) => collator.compare(a, b))
      .forEach((tag) => {
        chips.push(`
          <button class="filter-chip" type="button" data-filter-kind="tag" data-tag="${escapeHtml(tag)}">
            #${escapeHtml(tag)}
          </button>
        `);
      });

    activeFilters.innerHTML =
      chips.length > 0
        ? `<div class="active-filter-list">${chips.join("")}</div>`
        : `<div class="active-filter-empty">No active filters.</div>`;

    activeFilters.querySelectorAll("[data-filter-kind='tag']").forEach((button) => {
      button.addEventListener("click", () => {
        state.tags.delete(button.dataset.tag || "");
        render();
      });
    });

    const textChip = activeFilters.querySelector("[data-filter-kind='text']");
    if (textChip) {
      textChip.addEventListener("click", () => {
        state.text = "";
        searchInput.value = "";
        render();
      });
    }
  }

  function renderTags(filtered) {
    const visibleTagCounts = new Map();

    filtered.forEach((file) => {
      file.tags.forEach((tag) => {
        visibleTagCounts.set(tag, (visibleTagCounts.get(tag) || 0) + 1);
      });
    });

    tagCloud.innerHTML = knowledge.tags
      .map((tag) => {
        const isActive = state.tags.has(tag.name);
        const visibleCount = visibleTagCounts.get(tag.name) || 0;
        const muted = !isActive && visibleCount === 0 && (state.text || state.tags.size > 0);

        return `
          <button
            type="button"
            class="tag-chip ${isActive ? "active" : ""} ${muted ? "muted" : ""}"
            data-tag="${escapeHtml(tag.name)}"
            aria-pressed="${isActive ? "true" : "false"}"
          >
            <span>#${escapeHtml(tag.name)}</span>
            <span class="tag-chip-count">${visibleCount || tag.count}</span>
          </button>
        `;
      })
      .join("");

    tagCloud.querySelectorAll(".tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const tag = chip.dataset.tag || "";
        if (state.tags.has(tag)) {
          state.tags.delete(tag);
        } else {
          state.tags.add(tag);
        }
        render();
      });
    });
  }

  function renderTabs(filesToRender) {
    app.innerHTML = "";

    if (filesToRender.length === 0) {
      app.innerHTML = `
        <div class="empty-state">
          <p>No notes match the current filter.</p>
          <button type="button" class="empty-state-action">Clear filters</button>
        </div>
      `;

      app.querySelector(".empty-state-action").addEventListener("click", () => {
        state.text = "";
        state.tags.clear();
        state.focusedKey = "";
        searchInput.value = "";
        render();
      });
      return;
    }

    const grouped = new Map();
    filesToRender.forEach((file) => {
      if (!grouped.has(file.groupKey)) {
        grouped.set(file.groupKey, []);
      }
      grouped.get(file.groupKey).push(file);
    });

    const groups = knowledge.groups.filter((group) => grouped.has(group.key));
    const btnContainer = document.createElement("div");
    btnContainer.className = "tab-buttons";
    const contentContainer = document.createElement("div");
    contentContainer.className = "tab-contents";

    app.appendChild(btnContainer);
    app.appendChild(contentContainer);

    if (!state.tab || !grouped.has(state.tab)) {
      state.tab = groups[0].key;
    }

    groups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tab-btn ${group.key === state.tab ? "active" : ""}`;
      button.dataset.tab = group.key;
      button.innerHTML = `${escapeHtml(group.label)} <span class="badge">${grouped.get(group.key).length}</span>`;
      button.addEventListener("click", () => {
        switchTab(group.key);
        syncUrlState();
      });
      btnContainer.appendChild(button);

      const pane = document.createElement("div");
      pane.className = `tab-content ${group.key === state.tab ? "active" : ""}`;
      pane.dataset.tab = group.key;

      const list = document.createElement("ul");
      list.className = "file-list";

      sortFiles(grouped.get(group.key)).forEach((file) => {
        const item = document.createElement("li");
        item.dataset.noteKey = file.key;
        item.className = state.focusedKey === file.key ? "is-focused" : "";

        const titleHtml = state.text ? applyHighlights(file.title, state.text) : escapeHtml(file.title);
        const summaryHtml = state.text
          ? applyHighlights(file.summary || "No summary yet.", state.text)
          : escapeHtml(file.summary || "No summary yet.");

        const tagHtml = file.tags
          .map(
            (tag) => `
              <button type="button" class="tag-small ${state.tags.has(tag) ? "highlight" : ""}" data-inline-tag="${escapeHtml(tag)}">
                #${escapeHtml(tag)}
              </button>
            `,
          )
          .join("");

        item.innerHTML = `
          <article class="file-card">
            <div class="file-card-main">
              <div class="file-row">
                <a href="${escapeHtml(file.link)}" class="file-link">${titleHtml}</a>
                <span class="file-date">${escapeHtml(file.date || "--")}</span>
              </div>
              <p class="file-summary">${summaryHtml}</p>
              <div class="file-meta">
                <span class="group-pill">${escapeHtml(file.groupLabel)}</span>
                <span class="relation-pill">${file.refs.length} refs</span>
                <span class="relation-pill">${file.backlinks.length} backlinks</span>
              </div>
            </div>
            <div class="file-tags">${tagHtml}</div>
          </article>
        `;

        item.querySelectorAll("[data-inline-tag]").forEach((tagButton) => {
          tagButton.addEventListener("click", () => {
            state.tags.add((tagButton.dataset.inlineTag || "").toLowerCase());
            render();
          });
        });

        list.appendChild(item);
      });

      pane.appendChild(list);
      contentContainer.appendChild(pane);
    });
  }

  function showSuggestions(query) {
    const trimmed = query.trim().toLowerCase();
    suggestionBox.innerHTML = "";

    if (!trimmed) {
      suggestionBox.style.display = "none";
      return;
    }

    const matchedTags = knowledge.tags
      .filter((tag) => tag.name.includes(trimmed))
      .slice(0, 6);

    const matchedNotes = knowledge.notes
      .filter((note) => note.title.toLowerCase().includes(trimmed))
      .slice(0, 6);

    if (matchedTags.length === 0 && matchedNotes.length === 0) {
      suggestionBox.style.display = "none";
      return;
    }

    matchedTags.forEach((tag) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "suggestion-item tag-suggestion";
      option.innerHTML = `<span>#${escapeHtml(tag.name)}</span><span>${tag.count}</span>`;
      option.addEventListener("click", () => {
        state.tags.add(tag.name);
        state.text = "";
        searchInput.value = "";
        suggestionBox.style.display = "none";
        render();
      });
      suggestionBox.appendChild(option);
    });

    if (matchedTags.length > 0 && matchedNotes.length > 0) {
      const divider = document.createElement("div");
      divider.className = "suggestion-divider";
      divider.textContent = "Notes";
      suggestionBox.appendChild(divider);
    }

    matchedNotes.forEach((note) => {
      const option = document.createElement("a");
      option.className = "suggestion-item note-suggestion";
      option.href = note.link;
      option.innerHTML = `<span>${escapeHtml(note.title)}</span><span>${escapeHtml(note.groupLabel)}</span>`;
      suggestionBox.appendChild(option);
    });

    suggestionBox.style.display = "block";
  }

  function emitState(filtered) {
    document.dispatchEvent(
      new CustomEvent("knowledge:filters-changed", {
        detail: {
          text: state.text,
          tags: Array.from(state.tags),
          visibleKeys: filtered.map((file) => file.key),
          focusedKey: state.focusedKey,
        },
      }),
    );
  }

  function scrollFocusedNoteIntoView() {
    if (!pendingScrollKey) {
      return;
    }

    const target = document.querySelector(`[data-note-key="${CSS.escape(pendingScrollKey)}"]`);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    pendingScrollKey = "";
  }

  function render() {
    const filtered = filterFiles();

    if (state.focusedKey && !filtered.some((file) => file.key === state.focusedKey)) {
      state.focusedKey = "";
    }

    renderSummary(filtered);
    renderActiveFilters();
    renderTags(filtered);
    renderTabs(filtered);

    resetBtn.style.display = state.text || state.tags.size > 0 ? "block" : "none";
    if (!state.text) {
      suggestionBox.style.display = "none";
    }

    syncUrlState();
    emitState(filtered);
    scrollFocusedNoteIntoView();
  }

  const handleSearchInput = debounce((value) => {
    state.text = value.trim();
    state.focusedKey = "";
    showSuggestions(value);
    render();
  }, 150);

  searchInput.addEventListener("compositionstart", () => {
    isComposing = true;
  });

  searchInput.addEventListener("compositionend", (event) => {
    isComposing = false;
    handleSearchInput(event.target.value);
  });

  searchInput.addEventListener("input", (event) => {
    if (isComposing) {
      return;
    }
    handleSearchInput(event.target.value);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      suggestionBox.style.display = "none";
      searchInput.blur();
    }
  });

  document.addEventListener("click", (event) => {
    if (!searchWrapper.contains(event.target)) {
      suggestionBox.style.display = "none";
    }
  });

  resetBtn.addEventListener("click", () => {
    state.text = "";
    state.tags.clear();
    state.focusedKey = "";
    searchInput.value = "";
    render();
  });

  sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  window.addEventListener("popstate", () => {
    readUrlState();
    render();
  });

  document.addEventListener("knowledge:apply-tag", (event) => {
    const tag = String(event.detail && event.detail.tag ? event.detail.tag : "").toLowerCase();
    if (!tag) {
      return;
    }

    state.tags.add(tag);
    state.text = "";
    searchInput.value = "";
    render();
  });

  document.addEventListener("knowledge:focus-note", (event) => {
    const key = event.detail && event.detail.key;
    const note = key ? knowledge.byKey.get(key) : null;
    if (!note) {
      return;
    }

    state.tab = note.groupKey;
    state.focusedKey = note.key;
    pendingScrollKey = note.key;
    render();
  });

  readUrlState();
  render();
});
