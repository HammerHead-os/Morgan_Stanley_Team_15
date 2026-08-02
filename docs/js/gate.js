/* Arrival gate: background video + IAM role popup */

(function () {
  const ROLE_KEY = "love21_role";
  const ROLE_PAGES = {
    family: "activity-finder.html",
    contributor: "contributor.html",
    volunteer: "volunteer.html",
    donor: "impact.html",
    company: "explore.html#marketplace",
    curious: "curious.html",
  };
  // gate.js loads on every page now (not just index.html at the docs root),
  // so role destinations need to resolve relative to wherever we currently are.
  const inPagesDir = /\/pages\//.test(location.pathname);
  function resolveRolePage(role) {
    const page = ROLE_PAGES[role];
    if (!page) return null;
    return inPagesDir ? page : "pages/" + page;
  }
  const overlay = document.querySelector("[data-iam-overlay]");
  const video = document.querySelector(".gate-video");
  const soundBtn = document.querySelector("[data-gate-sound]");

  function openIam() {
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add("iam-open");
    const first = overlay.querySelector(".iam-role");
    if (first) first.focus();
  }

  function closeIam() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("iam-open");
  }

  document.querySelectorAll("[data-open-iam]").forEach(function (btn) {
    btn.addEventListener("click", openIam);
  });

  document.querySelectorAll("[data-iam-close]").forEach(function (el) {
    el.addEventListener("click", closeIam);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && !overlay.hidden) closeIam();
  });

  document.addEventListener("click", function (e) {
    const roleBtn = e.target.closest("[data-role]");
    if (!roleBtn) return;
    const role = roleBtn.getAttribute("data-role");
    const dest = resolveRolePage(role);
    if (!dest) return;
    localStorage.setItem(ROLE_KEY, role);
    window.location.href = dest;
  });

  const homeDropdown = document.querySelector("[data-home-dropdown]");
  const homeDropdownToggle = document.querySelector("[data-home-dropdown-toggle]");
  const homeDropdownMenu = document.querySelector("[data-home-dropdown-menu]");
  const contributorToggle = document.querySelector("[data-contributor-toggle]");
  const contributorSubmenu = document.querySelector("[data-contributor-submenu]");

  function closeContributorSubmenu() {
    if (!contributorToggle || !contributorSubmenu) return;
    contributorSubmenu.hidden = true;
    contributorToggle.setAttribute("aria-expanded", "false");
  }

  function closeHomeDropdown() {
    if (!homeDropdown || !homeDropdownMenu) return;
    homeDropdownMenu.hidden = true;
    homeDropdown.classList.remove("open");
    if (homeDropdownToggle) homeDropdownToggle.setAttribute("aria-expanded", "false");
    closeContributorSubmenu();
  }

  if (contributorToggle && contributorSubmenu) {
    contributorToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      const willOpen = contributorSubmenu.hidden;
      contributorSubmenu.hidden = !willOpen;
      contributorToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  }

  if (homeDropdown && homeDropdownToggle && homeDropdownMenu) {
    homeDropdownToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      const willOpen = homeDropdownMenu.hidden;
      homeDropdownMenu.hidden = !willOpen;
      homeDropdown.classList.toggle("open", willOpen);
      homeDropdownToggle.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    document.addEventListener("click", function (e) {
      if (!homeDropdown.contains(e.target)) closeHomeDropdown();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeHomeDropdown();
    });
  }

  if (soundBtn && video) {
    soundBtn.addEventListener("click", function () {
      video.muted = !video.muted;
      const on = !video.muted;
      soundBtn.setAttribute("aria-pressed", on ? "true" : "false");
      soundBtn.textContent = on ? "Sound on" : "Sound off";
      if (on) video.play().catch(function () {});
    });
  }
})();
