/* Bank-style spotlight tour: blur page, highlight one target at a time */

(function () {
  const steps = Array.from(document.querySelectorAll("[data-tour]"));
  if (!steps.length) return;

  const SKIP_KEY =
    "love21_tour_skip_" + (document.body.getAttribute("data-hub") || "hub");

  let index = 0;
  let overlay;
  let tip;
  let ring;
  let running = false;

  function buildUi() {
    if (overlay) overlay.remove();
    if (ring) ring.remove();
    if (tip) tip.remove();

    overlay = document.createElement("div");
    overlay.className = "tour-overlay";
    overlay.setAttribute("aria-hidden", "true");

    ring = document.createElement("div");
    ring.className = "tour-ring";

    tip = document.createElement("div");
    tip.className = "tour-tip";
    tip.setAttribute("role", "dialog");
    tip.setAttribute("aria-modal", "true");
    tip.innerHTML =
      '<p class="tour-step" data-tour-step></p>' +
      "<h3 data-tour-title></h3>" +
      '<p class="tour-copy" data-tour-copy></p>' +
      '<div class="tour-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-tour-skip>Skip demo</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-tour-next>Next</button>' +
      "</div>";

    document.body.appendChild(overlay);
    document.body.appendChild(ring);
    document.body.appendChild(tip);

    tip.querySelector("[data-tour-skip]").addEventListener("click", function () {
      endTour(false);
    });
    tip.querySelector("[data-tour-next]").addEventListener("click", function () {
      if (index >= steps.length - 1) endTour(true);
      else {
        index += 1;
        showStep();
      }
    });
  }

  function clearSpotlight() {
    steps.forEach(function (el) {
      el.classList.remove("tour-spotlight");
    });
  }

  function placeTip(rect) {
    const tipH = tip.offsetHeight || 160;
    const tipW = Math.min(340, window.innerWidth - 24);
    tip.style.width = tipW + "px";

    let top = rect.bottom + 14;
    let left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - tipW - 12
    );

    if (top + tipH > window.innerHeight - 12) {
      top = Math.max(12, rect.top - tipH - 14);
    }
    tip.style.top = top + "px";
    tip.style.left = left + "px";
  }

  function showStep() {
    clearSpotlight();
    const el = steps[index];
    if (!el) {
      endTour(true);
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center" });

    window.setTimeout(function () {
      if (!running || !tip) return;
      const rect = el.getBoundingClientRect();
      el.classList.add("tour-spotlight");

      const pad = 8;
      ring.style.display = "block";
      ring.style.top = rect.top + window.scrollY - pad + "px";
      ring.style.left = rect.left + window.scrollX - pad + "px";
      ring.style.width = rect.width + pad * 2 + "px";
      ring.style.height = rect.height + pad * 2 + "px";

      tip.querySelector("[data-tour-step]").textContent =
        "Demo " + (index + 1) + " / " + steps.length;
      tip.querySelector("[data-tour-title]").textContent =
        el.getAttribute("data-tour-title") || "Look here";
      tip.querySelector("[data-tour-copy]").textContent =
        el.getAttribute("data-tour-text") || "";

      const nextBtn = tip.querySelector("[data-tour-next]");
      nextBtn.textContent = index >= steps.length - 1 ? "Done" : "Next";

      tip.style.display = "block";
      placeTip(rect);
    }, 280);
  }

  function endTour(finished) {
    running = false;
    localStorage.setItem(SKIP_KEY, "1");
    clearSpotlight();
    document.body.classList.remove("tour-active");
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (ring) {
      ring.remove();
      ring = null;
    }
    if (tip) {
      tip.remove();
      tip = null;
    }
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onResize, true);
    if (finished === true && window.Love21) {
      window.Love21.showToast("Okay, you are done with the walkthrough.");
    }
  }

  function onResize() {
    if (!running) return;
    showStep();
  }

  function startTour() {
    if (running) return;
    running = true;
    buildUi();
    document.body.classList.add("tour-active");
    overlay.style.display = "block";
    tip.style.display = "block";
    ring.style.display = "block";
    index = 0;
    showStep();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
  }

  document.querySelectorAll("[data-tour-start]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      localStorage.removeItem(SKIP_KEY);
      startTour();
    });
  });

  // Auto-start only the first time on this hub (unless already skipped)
  if (localStorage.getItem(SKIP_KEY) !== "1") {
    window.setTimeout(startTour, 500);
  }
})();
