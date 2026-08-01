/* Arrival gate: background video + IAM role popup */

(function () {
  const ROLE_KEY = "love21_role";
  const ROLE_PAGES = {
    family: "pages/activity-finder.html",
    volunteer: "pages/volunteer.html",
    donor: "pages/impact.html",
    company: "pages/explore.html#marketplace",
    curious: "pages/curious.html",
  };
  const STEP_COPY = {
    contributor: {
      eyebrow: "Contributor",
      title: "How do you want to help?",
      copy: "Donor, volunteer, or company are all real, live pages — pick the one that fits.",
    },
  };

  const overlay = document.querySelector("[data-iam-overlay]");
  const video = document.querySelector(".gate-video");
  const soundBtn = document.querySelector("[data-gate-sound]");
  const mainRoles = document.querySelector("[data-iam-roles]");
  const titleEl = document.getElementById("iam-title");
  const eyebrowEl = document.querySelector("[data-iam-eyebrow]");
  const copyEl = document.querySelector("[data-iam-copy]");
  const defaultTitle = titleEl ? titleEl.textContent : "";
  const defaultEyebrow = eyebrowEl ? eyebrowEl.textContent : "";
  const defaultCopy = copyEl ? copyEl.textContent : "";

  function showMainStep() {
    if (mainRoles) mainRoles.hidden = false;
    document.querySelectorAll("[data-iam-roles-sub]").forEach(function (el) {
      el.hidden = true;
    });
    if (titleEl) titleEl.textContent = defaultTitle;
    if (eyebrowEl) eyebrowEl.textContent = defaultEyebrow;
    if (copyEl) copyEl.textContent = defaultCopy;
  }

  function showSubStep(step) {
    const sub = document.querySelector('[data-iam-roles-sub="' + step + '"]');
    if (!sub) return;
    if (mainRoles) mainRoles.hidden = true;
    document.querySelectorAll("[data-iam-roles-sub]").forEach(function (el) {
      el.hidden = el !== sub;
    });
    const info = STEP_COPY[step];
    if (info) {
      if (titleEl) titleEl.textContent = info.title;
      if (eyebrowEl) eyebrowEl.textContent = info.eyebrow;
      if (copyEl) copyEl.textContent = info.copy;
    }
    const first = sub.querySelector(".iam-role");
    if (first) first.focus();
  }

  function openIam() {
    if (!overlay) return;
    showMainStep();
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
    const backBtn = e.target.closest("[data-iam-sub-back]");
    if (backBtn) {
      showMainStep();
      return;
    }
    const stepBtn = e.target.closest("[data-role-step]");
    if (stepBtn) {
      showSubStep(stepBtn.getAttribute("data-role-step"));
      return;
    }
    const roleBtn = e.target.closest("[data-role]");
    if (!roleBtn) return;
    const role = roleBtn.getAttribute("data-role");
    if (!ROLE_PAGES[role]) return;
    localStorage.setItem(ROLE_KEY, role);
    window.location.href = ROLE_PAGES[role];
  });

  const homeDropdown = document.querySelector("[data-home-dropdown]");
  const homeDropdownToggle = document.querySelector("[data-home-dropdown-toggle]");
  const homeDropdownMenu = document.querySelector("[data-home-dropdown-menu]");

  function closeHomeDropdown() {
    if (!homeDropdown || !homeDropdownMenu) return;
    homeDropdownMenu.hidden = true;
    homeDropdown.classList.remove("open");
    if (homeDropdownToggle) homeDropdownToggle.setAttribute("aria-expanded", "false");
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
