(function () {
  function updateToggle(toggle, isDark) {
    const icon = toggle.querySelector("i");

    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    toggle.title = isDark ? "Light mode" : "Dark mode";

    if (icon) {
      icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
      return;
    }

    toggle.textContent = isDark ? "Light" : "Dark";
  }

  function ensureToggle() {
    let toggle = document.getElementById("theme-toggle");

    if (!toggle) {
      toggle = document.createElement("button");
      toggle.id = "theme-toggle";
      toggle.type = "button";
      document.body.appendChild(toggle);
    }

    return toggle;
  }

  function applyTheme(theme) {
    document.body.classList.toggle("dark-mode", theme === "dark");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = localStorage.getItem("theme") === "dark" ? "dark" : "light";
    const toggle = ensureToggle();

    applyTheme(savedTheme);
    updateToggle(toggle, savedTheme === "dark");

    toggle.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
      applyTheme(nextTheme);
      localStorage.setItem("theme", nextTheme);
      updateToggle(toggle, nextTheme === "dark");
    });
  });
})();
