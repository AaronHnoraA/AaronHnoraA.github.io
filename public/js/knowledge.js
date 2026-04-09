(function () {
  function titleize(segment) {
    if (!segment || segment === "Root") {
      return "Root";
    }

    if (/^[A-Z0-9-]+$/.test(segment)) {
      return segment;
    }

    return segment
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function normalizeTag(tag) {
    return String(tag || "").trim().toLowerCase();
  }

  function inferGroupLabel(groupKey) {
    if (!groupKey || groupKey === "Root") {
      return "Root";
    }

    const parts = String(groupKey).split("/").filter(Boolean);
    return titleize(parts[parts.length - 1] || groupKey);
  }

  function flattenLegacyData(raw) {
    return Object.entries(raw || {}).flatMap(([groupKey, items]) =>
      (Array.isArray(items) ? items : []).map((item) => ({
        ...item,
        groupKey,
        groupLabel: inferGroupLabel(groupKey),
        key: item.id || item.link || `${groupKey}:${item.title}`,
        refs: [],
        backlinks: [],
        summary: item.desc || "",
      })),
    );
  }

  function normalizeNote(note) {
    const groupKey = note.groupKey || note.folder || "Root";
    const tags = Array.from(
      new Set((Array.isArray(note.tags) ? note.tags : []).map(normalizeTag).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    return {
      key: note.key || note.id || note.link || `${groupKey}:${note.title}`,
      id: note.id || null,
      title: String(note.title || "Untitled"),
      link: String(note.link || "#"),
      date: String(note.date || ""),
      dateValue: Date.parse(note.date || "") || 0,
      summary: String(note.summary || note.desc || "").trim(),
      groupKey,
      groupLabel: inferGroupLabel(note.groupLabel || groupKey),
      section: note.section || (groupKey.includes("/") ? groupKey.split("/")[0] : groupKey),
      tags,
      refs: Array.from(new Set(Array.isArray(note.refs) ? note.refs.filter(Boolean) : [])),
      backlinks: Array.from(new Set(Array.isArray(note.backlinks) ? note.backlinks.filter(Boolean) : [])),
    };
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase();
  }

  function buildKnowledgeData() {
    if (typeof SITE_DATA === "undefined") {
      window.KNOWLEDGE_DATA = null;
      return;
    }

    const rawNotes = Array.isArray(SITE_DATA.notes) ? SITE_DATA.notes : flattenLegacyData(SITE_DATA);
    const notes = rawNotes.map(normalizeNote);
    const byKey = new Map(notes.map((note) => [note.key, note]));

    notes.forEach((note) => {
      note.refs = note.refs.filter((key) => byKey.has(key) && key !== note.key);
      note.backlinks = note.backlinks.filter((key) => byKey.has(key) && key !== note.key);
      note.searchBlob = normalizeText(
        [note.title, note.summary, note.groupLabel, note.section, ...note.tags].join(" "),
      );
    });

    const groupMap = new Map();
    const tagMap = new Map();
    let latestDate = "";
    let totalReferenceEdges = 0;

    notes.forEach((note) => {
      if (!groupMap.has(note.groupKey)) {
        groupMap.set(note.groupKey, []);
      }
      groupMap.get(note.groupKey).push(note);

      note.tags.forEach((tag) => {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { name: tag, count: 0, notes: [] });
        }

        const entry = tagMap.get(tag);
        entry.count += 1;
        entry.notes.push(note.key);
      });

      totalReferenceEdges += note.refs.length;

      if (note.date && (!latestDate || note.date > latestDate)) {
        latestDate = note.date;
      }
    });

    const groups = Array.from(groupMap.entries())
      .map(([key, items]) => ({
        key,
        label: inferGroupLabel(key),
        items: items.slice().sort((a, b) => b.dateValue - a.dateValue || a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => {
        if (a.key === "Root") return -1;
        if (b.key === "Root") return 1;
        return a.label.localeCompare(b.label);
      });

    const tags = Array.from(tagMap.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const connectedNotes = notes.filter((note) => note.refs.length > 0 || note.backlinks.length > 0).length;

    window.KNOWLEDGE_DATA = {
      raw: SITE_DATA,
      notes,
      byKey,
      groups,
      tags,
      stats: {
        totalNotes: notes.length,
        totalTags: tags.length,
        connectedNotes,
        totalReferenceEdges,
        latestDate: latestDate || (SITE_DATA.meta && SITE_DATA.meta.generatedAt) || "",
        generatedAt: (SITE_DATA.meta && SITE_DATA.meta.generatedAt) || "",
      },
      filterNotes({ text = "", tags: activeTags = [] } = {}) {
        const terms = normalizeText(text).split(/\s+/).filter(Boolean);
        const requiredTags = Array.from(activeTags).map(normalizeTag).filter(Boolean);

        return notes.filter((note) => {
          const matchesText =
            terms.length === 0 || terms.every((term) => note.searchBlob.includes(term));
          const matchesTags =
            requiredTags.length === 0 || requiredTags.every((tag) => note.tags.includes(tag));

          return matchesText && matchesTags;
        });
      },
      inferGroupLabel,
    };
  }

  buildKnowledgeData();
})();
