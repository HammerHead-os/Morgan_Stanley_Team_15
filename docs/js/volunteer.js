/* Volunteer shifts from API */

(function () {
  const L = window.Love21;
  const grid = document.querySelector("[data-shift-grid]");
  if (!L || !grid) return;

  const SKILL_LABELS = {
    cantonese: "Cantonese reading",
    photos: "basic photo sorting",
    voice: "phone mic, English or Cantonese",
    sports: "on-site sports help",
  };

  function skillLine(raw) {
    return String(raw || "")
      .split(",")
      .map(function (s) {
        s = s.trim().toLowerCase();
        return SKILL_LABELS[s] || s;
      })
      .filter(Boolean)
      .join(", ");
  }

  function pointsGiven(durationMin) {
    // Roughly matches the static contributor examples
    if (durationMin <= 15) return 20;
    if (durationMin <= 30) return 35;
    if (durationMin <= 45) return 40;
    return durationMin + 5;
  }

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
            (s.remote
              ? '<span class="tag">Remote</span>'
              : '<span class="tag">On-site</span>') +
            "</div>";
          const btn = s.requires_onboarding
            ? '<button type="button" class="btn btn-sm btn-ink" data-onboard>Start onboarding</button>'
            : '<button type="button" class="btn btn-sm btn-primary" data-claim-shift="' +
              s.id +
              '">Claim task</button>';
          const skills = skillLine(s.skills_needed);
          return (
            '<article class="activity">' +
            tags +
            "<h3>" +
            escapeHtml(s.title) +
            "</h3><p>" +
            escapeHtml(s.description) +
            "</p>" +
            (skills
              ? '<p class="task-meta-line">Skills needed: ' +
                escapeHtml(skills) +
                "</p>"
              : "") +
            '<p class="task-meta-line">Points given: ' +
            pointsGiven(s.duration_min) +
            "</p>" +
            btn +
            "</article>"
          );
        })
        .join("");
    } catch (err) {
      grid.innerHTML =
        '<p class="empty-hint">Tasks will not load. Start the local API, then refresh.</p>';
    }
  }

  window.reloadVolunteerShifts = reloadVolunteerShifts;

  document.addEventListener("click", async function (e) {
    if (!e.target.closest("[data-onboard]")) return;
    e.preventDefault();
    try {
      await L.requireLogin(async function () {
        await L.api("/api/volunteers/onboard", {
          method: "POST",
          body: {
            skills: "cantonese,photos,sports",
            languages: "yue,en",
            availability: "weekends",
          },
        });
        L.goToProfile(null, "Onboarding done");
      });
    } catch (err) {
      if (!err.cancelled) L.showToast(L.friendlyError(err));
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
