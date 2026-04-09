document.addEventListener("DOMContentLoaded", () => {
  const knowledge = window.KNOWLEDGE_DATA;
  const container = document.getElementById("graph-container");
  const focusPanel = document.getElementById("graph-focus");
  const resetButton = document.getElementById("graph-reset");
  const focusVisibleButton = document.getElementById("graph-focus-visible");

  if (!container) {
    return;
  }

  if (typeof d3 === "undefined") {
    container.innerHTML = '<div class="graph-message">D3 failed to load.</div>';
    return;
  }

  if (!knowledge || knowledge.notes.length === 0) {
    container.innerHTML = '<div class="graph-message">No notes available yet.</div>';
    return;
  }

  const noteNodes = knowledge.notes.map((note) => ({
    id: note.key,
    key: note.key,
    label: note.title,
    kind: "note",
    note,
  }));

  const tagNodes = knowledge.tags.map((tag) => ({
    id: `tag:${tag.name}`,
    label: tag.name,
    kind: "tag",
    tag,
  }));

  const nodes = [...noteNodes, ...tagNodes];
  const links = [];
  const linkKeys = new Set();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  function pushLink(source, target, kind) {
    const key = `${source}::${target}::${kind}`;
    if (linkKeys.has(key)) {
      return;
    }
    linkKeys.add(key);
    links.push({ source, target, kind });
  }

  knowledge.notes.forEach((note) => {
    note.refs.forEach((targetKey) => {
      pushLink(note.key, targetKey, "reference");
    });

    note.tags.forEach((tag) => {
      pushLink(note.key, `tag:${tag}`, "tag");
    });
  });

  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, new Set()));
  links.forEach((link) => {
    adjacency.get(link.source).add(link.target);
    adjacency.get(link.target).add(link.source);
  });

  const visibleKeys = new Set(knowledge.notes.map((note) => note.key));
  let selectedId = "";
  let width = 0;
  let height = 0;
  let svg;
  let canvas;
  let linkSelection;
  let nodeSelection;
  let labelSelection;
  let simulation;
  let zoomBehavior;

  const groupPalette = d3.scaleOrdinal()
    .domain(knowledge.groups.map((group) => group.key))
    .range(["#1756ff", "#f05454", "#0ea5a3", "#c2410c", "#6d28d9", "#15803d", "#b91c1c"]);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nodeColor(node) {
    if (node.kind === "tag") {
      return "#f59e0b";
    }

    return groupPalette(node.note.groupKey);
  }

  function updateFocusPanel(node) {
    if (!focusPanel) {
      return;
    }

    if (!node) {
      focusPanel.classList.add("empty");
      focusPanel.innerHTML = `
        <p class="graph-focus-copy">Select a node to inspect its links.</p>
      `;
      return;
    }

    focusPanel.classList.remove("empty");

    if (node.kind === "tag") {
      const related = node.tag.notes
        .slice(0, 5)
        .map((key) => knowledge.byKey.get(key))
        .filter(Boolean)
        .map(
          (note) => `<a class="graph-related-link" href="${escapeHtml(note.link)}">${escapeHtml(note.title)}</a>`,
        )
        .join("");

      focusPanel.innerHTML = `
        <div class="graph-focus-header">
          <span class="graph-focus-type">Tag</span>
          <strong>#${escapeHtml(node.label)}</strong>
        </div>
        <p class="graph-focus-copy">${node.tag.count} notes currently use this tag.</p>
        <div class="graph-related-list">${related || "<span class='graph-related-empty'>No linked notes.</span>"}</div>
      `;
      return;
    }

    const note = node.note;
    const tags = note.tags.map((tag) => `<button type="button" class="graph-inline-tag" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("");

    focusPanel.innerHTML = `
      <div class="graph-focus-header">
        <span class="graph-focus-type">${escapeHtml(note.groupLabel)}</span>
        <strong>${escapeHtml(note.title)}</strong>
      </div>
      <p class="graph-focus-copy">${escapeHtml(note.summary || "No summary yet.")}</p>
      <div class="graph-focus-meta">
        <span>${escapeHtml(note.date || "--")}</span>
        <span>${note.refs.length} refs</span>
        <span>${note.backlinks.length} backlinks</span>
      </div>
      <div class="graph-inline-tags">${tags}</div>
      <a class="graph-open-link" href="${escapeHtml(note.link)}">Open note</a>
    `;

    focusPanel.querySelectorAll(".graph-inline-tag").forEach((button) => {
      button.addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("knowledge:apply-tag", {
            detail: { tag: button.dataset.tag || "" },
          }),
        );
      });
    });
  }

  function isNodeVisible(node) {
    if (node.kind === "tag") {
      return node.tag.notes.some((key) => visibleKeys.has(key));
    }

    return visibleKeys.has(node.key);
  }

  function applyStyles() {
    const activeNeighbors = selectedId ? adjacency.get(selectedId) || new Set() : new Set();

    nodeSelection
      .style("opacity", (node) => {
        if (!isNodeVisible(node)) return 0.18;
        if (!selectedId) return 1;
        if (node.id === selectedId || activeNeighbors.has(node.id)) return 1;
        return 0.28;
      })
      .attr("r", (node) => {
        if (node.kind === "tag") {
          return selectedId === node.id ? 11 : 8;
        }

        const base = 7 + Math.min(node.note.refs.length + node.note.backlinks.length, 4);
        return selectedId === node.id ? base + 3 : base;
      })
      .attr("fill", nodeColor)
      .attr("stroke", (node) => (selectedId === node.id ? "#111827" : "#ffffff"))
      .attr("stroke-width", (node) => (selectedId === node.id ? 2.4 : 1.4));

    labelSelection.style("opacity", (node) => {
      if (!isNodeVisible(node)) return 0.15;
      if (!selectedId) return node.kind === "note" ? 0.9 : 0.72;
      if (node.id === selectedId || activeNeighbors.has(node.id)) return 1;
      return 0.2;
    });

    linkSelection
      .style("opacity", (link) => {
        const sourceId = typeof link.source === "string" ? link.source : link.source.id;
        const targetId = typeof link.target === "string" ? link.target : link.target.id;
        const visible = isNodeVisible(nodeById.get(sourceId)) && isNodeVisible(nodeById.get(targetId));

        if (!visible) return 0.05;
        if (!selectedId) return link.kind === "reference" ? 0.55 : 0.22;
        if (sourceId === selectedId || targetId === selectedId) return 0.9;
        if (activeNeighbors.has(sourceId) && activeNeighbors.has(targetId)) return 0.5;
        return 0.08;
      })
      .attr("stroke-width", (link) => (link.kind === "reference" ? 1.8 : 1.1))
      .attr("stroke", (link) => (link.kind === "reference" ? "#64748b" : "#cbd5e1"));
  }

  function setSelected(node) {
    selectedId = node ? node.id : "";
    updateFocusPanel(node || null);
    applyStyles();

    if (node && node.kind === "note") {
      document.dispatchEvent(
        new CustomEvent("knowledge:focus-note", {
          detail: { key: node.key },
        }),
      );
    }
  }

  function fitToNodes(predicate) {
    const matching = nodes.filter((node) => predicate(node) && typeof node.x === "number" && typeof node.y === "number");
    if (matching.length === 0) {
      return;
    }

    const minX = d3.min(matching, (node) => node.x);
    const maxX = d3.max(matching, (node) => node.x);
    const minY = d3.min(matching, (node) => node.y);
    const maxY = d3.max(matching, (node) => node.y);
    const boxWidth = Math.max(maxX - minX, 80);
    const boxHeight = Math.max(maxY - minY, 80);
    const scale = Math.min(2.2, 0.88 / Math.max(boxWidth / width, boxHeight / height));
    const translateX = width / 2 - scale * (minX + maxX) / 2;
    const translateY = height / 2 - scale * (minY + maxY) / 2;

    svg.transition().duration(300).call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale),
    );
  }

  function refitGraph(predicate, clearSelection = false) {
    if (clearSelection) {
      setSelected(null);
    }

    simulation.alpha(0.55).restart();
    window.setTimeout(() => fitToNodes(predicate), 180);
  }

  function buildGraph() {
    container.innerHTML = "";
    width = container.clientWidth || 900;
    height = container.clientHeight || 520;

    svg = d3.select(container)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, width, height]);

    canvas = svg.append("g");

    zoomBehavior = d3.zoom().scaleExtent([0.35, 3]).on("zoom", (event) => {
      canvas.attr("transform", event.transform);
    });

    svg.call(zoomBehavior);
    svg.on("click", () => setSelected(null));

    simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((node) => node.id).distance((link) => (link.kind === "reference" ? 96 : 68)))
      .force("charge", d3.forceManyBody().strength((node) => (node.kind === "tag" ? -360 : -480)))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((node) => (node.kind === "tag" ? 18 : 22)))
      .alpha(1)
      .alphaDecay(0.06);

    linkSelection = canvas.append("g")
      .attr("class", "graph-links")
      .selectAll("line")
      .data(links)
      .join("line");

    nodeSelection = canvas.append("g")
      .attr("class", "graph-nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("tabindex", 0)
      .attr("cursor", "pointer")
      .on("click", (event, node) => {
        event.stopPropagation();

        if (node.kind === "tag") {
          document.dispatchEvent(
            new CustomEvent("knowledge:apply-tag", {
              detail: { tag: node.label },
            }),
          );
        }

        setSelected(node);
      })
      .on("dblclick", (event, node) => {
        event.stopPropagation();
        if (node.kind === "note") {
          window.location.href = node.note.link;
        }
      })
      .call(
        d3.drag()
          .on("start", (event) => {
            if (!event.active) simulation.alphaTarget(0.18).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
          })
          .on("drag", (event) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
          })
          .on("end", (event) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
          }),
      );

    labelSelection = canvas.append("g")
      .attr("class", "graph-labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((node) => node.label)
      .attr("font-size", (node) => (node.kind === "tag" ? 10 : 11))
      .attr("font-weight", (node) => (node.kind === "tag" ? 500 : 600))
      .attr("pointer-events", "none");

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (link) => link.source.x)
        .attr("y1", (link) => link.source.y)
        .attr("x2", (link) => link.target.x)
        .attr("y2", (link) => link.target.y);

      nodeSelection
        .attr("cx", (node) => node.x)
        .attr("cy", (node) => node.y);

      labelSelection
        .attr("x", (node) => node.x + (node.kind === "tag" ? 11 : 13))
        .attr("y", (node) => node.y + 4);
    });

    applyStyles();
    updateFocusPanel(null);

    window.setTimeout(() => refitGraph(() => true, true), 240);
  }

  function resizeGraph() {
    if (!simulation || !svg) {
      return;
    }

    width = container.clientWidth || 900;
    height = container.clientHeight || 520;
    svg.attr("viewBox", [0, 0, width, height]);
    simulation.force("center", d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.4).restart();
  }

  document.addEventListener("knowledge:filters-changed", (event) => {
    visibleKeys.clear();
    (event.detail && Array.isArray(event.detail.visibleKeys) ? event.detail.visibleKeys : []).forEach((key) => {
      visibleKeys.add(key);
    });

    if (!visibleKeys.has(selectedId) && selectedId && !String(selectedId).startsWith("tag:")) {
      setSelected(null);
      return;
    }

    applyStyles();
  });

  if (resetButton) {
    resetButton.addEventListener("click", () => refitGraph(() => true, true));
  }

  if (focusVisibleButton) {
    focusVisibleButton.addEventListener("click", () => refitGraph((node) => isNodeVisible(node)));
  }

  const resizeObserver = new ResizeObserver(() => resizeGraph());
  resizeObserver.observe(container);

  buildGraph();
});
