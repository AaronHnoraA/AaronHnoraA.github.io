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

  const heights = [280, 320, 300, 360, 310, 290, 330, 305, 275, 345];
  const widths = [168, 188, 174, 206, 182, 172, 198, 176, 164, 194];

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function closeAllBooks() {
    books.forEach((book) => {
      book.classList.remove("is-open");
      const trigger = book.querySelector(".bookshelf-cover");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  function openBook(book, { pushHash = true, scroll = true } = {}) {
    if (!book) {
      return;
    }

    const isOpen = book.classList.contains("is-open");
    closeAllBooks();

    if (!isOpen) {
      book.classList.add("is-open");
      const trigger = book.querySelector(".bookshelf-cover");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "true");
      }
      if (pushHash && book.id) {
        window.history.replaceState(null, "", `#${book.id}`);
      }
      if (scroll) {
        book.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else if (pushHash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }

  books.forEach((book, index) => {
    const title = book.dataset.book || book.querySelector("h2")?.textContent?.trim() || `Book ${index + 1}`;
    const titleSlug = slugify(title);
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
    cover.setAttribute("aria-controls", `${titleSlug || `book-${index}`}-pages`);
    cover.innerHTML = `
      <span class="bookshelf-cover-kicker">${index + 1 < 10 ? `0${index + 1}` : index + 1}</span>
      <span class="bookshelf-cover-title">${title}</span>
      <span class="bookshelf-cover-subtitle">open volume</span>
    `;

    pageWrapper.id = `${titleSlug || `book-${index}`}-pages`;
    book.appendChild(cover);
    book.appendChild(pageWrapper);

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

  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target && target.classList.contains("shelf-book")) {
      window.setTimeout(() => openBook(target, { pushHash: false, scroll: false }), 80);
    }
  }
});
