/* Volunteer shifts from API */

(function () {
  const L = window.Love21;
  const grid = document.querySelector("[data-shift-grid]");
  if (!L || !grid) return;

  async function reloadVolunteerShifts() {
    try {
      const shifts = await L.api("/api/volunteers/shifts");
      grid.innerHTML = shifts
        .map(function (s) {
          const tags =
            '<div class="activity-meta">' +
            '<span class="tag">' +
            s.duration_min +
            " min</span>" +
            '<span class="tag">' +
            escapeHtml(s.language) +
            "</span>" +
            (s.remote
              ? '<span class="tag">Remote</span>'
              : '<span class="tag">On-site</span>') +
            "</div>";
          const btn = s.requires_onboarding
            ? '<button type="button" class="btn btn-sm btn-ink" data-onboard>Start onboarding</button>'
            : '<button type="button" class="btn btn-sm btn-primary" data-claim-shift="' +
              s.id +
              '">Claim shift</button>';
          return (
            '<article class="activity">' +
            tags +
            "<h3>" +
            escapeHtml(s.title) +
            "</h3><p>" +
            escapeHtml(s.description) +
            "</p>" +
            btn +
            "</article>"
          );
        })
        .join("");
    } catch (err) {
      grid.innerHTML =
        '<p class="empty-hint">Shifts will not load. Run the local server, then refresh.</p>';
    }
  }

  window.reloadVolunteerShifts = reloadVolunteerShifts;

  document.addEventListener("click", async function (e) {
    if (!e.target.closest("[data-onboard]")) return;
    e.preventDefault();
    try {
      if (!L.getPerson()) {
        await L.ensureLogin("volunteer@demo.love21");
      }
      await L.api("/api/volunteers/onboard", {
        method: "POST",
        body: {
          skills: "cantonese,photos,sports",
          languages: "yue,en",
          availability: "weekends",
        },
      });
      L.goToProfile("contribution", "Onboarding complete");
    } catch (err) {
      L.showToast(L.friendlyError(err));
    }
  });

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  reloadVolunteerShifts();
})();
