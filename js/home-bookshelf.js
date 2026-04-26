document.addEventListener("DOMContentLoaded", () => {
  if (!document.body.classList.contains("site-home") || document.body.classList.contains("site-archive")) {
    return;
  }

  const homeGrid = document.querySelector(".home-grid");
  if (!homeGrid) {
    return;
  }

  const books = Array.from(homeGrid.querySelectorAll(".shelf-book"));
  if (books.length === 0) {
    return;
  }

  const shelfMap = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2];
  const heights = [278, 304, 288, 326, 296, 278, 306, 286, 274, 314];
  const widths = [164, 180, 170, 196, 176, 164, 188, 172, 162, 186];

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function createShelfRow(index) {
    const row = document.createElement("section");
    row.className = "shelf-row";
    row.dataset.shelfRow = String(index + 1);
    row.innerHTML = `
      <div class="shelf-cavity">
        <div class="shelf-shadow"></div>
        <div class="shelf-books"></div>
        <div class="shelf-floor"></div>
      </div>
    `;
    return row;
  }

  const bookshelfStage = document.createElement("div");
  bookshelfStage.className = "bookshelf-stage";
  const shelfRows = [createShelfRow(0), createShelfRow(1), createShelfRow(2)];
  shelfRows.forEach((row) => bookshelfStage.appendChild(row));
  homeGrid.replaceChildren(bookshelfStage);

  function closeAllBooks() {
    books.forEach((book) => {
      book.classList.remove("is-open");
      const trigger = book.querySelector(".bookshelf-cover");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
      book.style.removeProperty("--paper-left");
      book.style.removeProperty("--paper-width");
    });

    shelfRows.forEach((row) => row.classList.remove("has-open-book"));
  }

  function setOpenGeometry(book) {
    const row = book.closest(".shelf-row");
    const booksContainer = row?.querySelector(".shelf-books");
    const cover = book.querySelector(".bookshelf-cover");
    if (!row || !booksContainer || !cover) {
      return;
    }

    const rowRect = booksContainer.getBoundingClientRect();
    const coverRect = cover.getBoundingClientRect();
    const left = Math.max(coverRect.left - rowRect.left + coverRect.width - 12, 112);
    const width = Math.max(320, rowRect.width - left - 28);

    book.style.setProperty("--paper-left", `${left}px`);
    book.style.setProperty("--paper-width", `${width}px`);
  }

  function openBook(book, { pushHash = true, scroll = true } = {}) {
    if (!book) {
      return;
    }

    const isOpen = book.classList.contains("is-open");
    closeAllBooks();

    if (isOpen) {
      if (pushHash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      return;
    }

    const row = book.closest(".shelf-row");
    if (row) {
      row.classList.add("has-open-book");
    }

    setOpenGeometry(book);
    book.classList.add("is-open");
    const trigger = book.querySelector(".bookshelf-cover");
    if (trigger) {
      trigger.setAttribute("aria-expanded", "true");
    }

    if (pushHash && book.id) {
      window.history.replaceState(null, "", `#${book.id}`);
    }

    if (scroll) {
      book.closest(".shelf-row")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  books.forEach((book, index) => {
    const title = book.dataset.book || book.querySelector("h2")?.textContent?.trim() || `Book ${index + 1}`;
    const titleSlug = slugify(title) || `book-${index + 1}`;
    const rowIndex = shelfMap[index] ?? shelfMap[shelfMap.length - 1];
    const shelfBooks = shelfRows[rowIndex].querySelector(".shelf-books");

    book.style.setProperty("--book-height", `${heights[index % heights.length]}px`);
    book.style.setProperty("--book-width", `${widths[index % widths.length]}px`);
    book.dataset.bookSlug = titleSlug;

    const pageWrapper = document.createElement("div");
    pageWrapper.className = "bookshelf-pages";

    while (book.firstChild) {
      pageWrapper.appendChild(book.firstChild);
    }

    const cover = document.createElement("button");
    cover.type = "button";
    cover.className = "bookshelf-cover";
    cover.setAttribute("aria-expanded", "false");
    cover.setAttribute("aria-controls", `${titleSlug}-pages`);
    cover.innerHTML = `
      <span class="bookshelf-cover-kicker">${index + 1 < 10 ? `0${index + 1}` : index + 1}</span>
      <span class="bookshelf-cover-title">${title}</span>
      <span class="bookshelf-cover-subtitle">open volume</span>
    `;

    pageWrapper.id = `${titleSlug}-pages`;
    book.appendChild(cover);
    book.appendChild(pageWrapper);
    shelfBooks.appendChild(book);

    cover.addEventListener("click", () => openBook(book));
  });

  document.querySelectorAll('.site-nav a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.getAttribute("href")?.slice(1);
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target || !target.classList.contains("shelf-book")) {
        return;
      }

      event.preventDefault();
      openBook(target, { pushHash: true, scroll: true });
    });
  });

  window.addEventListener("resize", () => {
    const openBookEl = books.find((book) => book.classList.contains("is-open"));
    if (openBookEl) {
      setOpenGeometry(openBookEl);
    }
  });

  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target && target.classList.contains("shelf-book")) {
      window.setTimeout(() => openBook(target, { pushHash: false, scroll: false }), 80);
    }
  }
});
