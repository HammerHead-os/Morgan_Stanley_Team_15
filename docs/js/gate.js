/* Arrival gate: background video + IAM role popup */

(function () {
  const ROLE_KEY = "love21_role";
  const ROLE_PAGES = {
    family: "pages/family.html",
    contributor: "pages/contributor.html",
    curious: "pages/curious.html",
  };

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

  const roles = document.querySelector("[data-iam-roles]");
  if (roles) {
    roles.addEventListener("click", async function (e) {
      const btn = e.target.closest("[data-role]");
      if (!btn) return;
      const role = btn.getAttribute("data-role");
      if (!ROLE_PAGES[role]) return;
      localStorage.setItem(ROLE_KEY, role);
      const L = window.Love21;
      const emails = {
        family: "carer@chen.demo",
        contributor: "volunteer@demo.love21",
      };
      if (L && emails[role]) {
        try {
          await L.demoLogin(emails[role]);
        } catch (err) {}
      }
      window.location.href = ROLE_PAGES[role];
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
