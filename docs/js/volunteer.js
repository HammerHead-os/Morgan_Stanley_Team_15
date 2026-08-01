/* Volunteer shifts from API, with offline fallback */

(function () {
  const L = window.Love21;
  const grid = document.querySelector("[data-shift-grid]");
  if (!grid) return;

  const SKILL_LABELS = {
    cantonese: "Cantonese reading",
    photos: "basic photo sorting",
    voice: "phone mic, English or Cantonese",
    sports: "on-site sports help",
  };

  const FALLBACK = [
    {
      id: null,
      title: "Cantonese flyer check",
      description: "Proofread banquet flyers.",
      duration_min: 15,
      skills_needed: "cantonese",
      remote: true,
      requires_onboarding: false,
    },
    {
      id: null,
      title: "Photo sort",
      description: "Sort July hike photos into swim, kitchen, and track folders.",
      duration_min: 30,
      skills_needed: "photos",
      remote: true,
      requires_onboarding: false,
    },
    {
      id: null,
      title: "Voice cheers",
      description: "Record a few short cheers for Saturday track.",
      duration_min: 45,
      skills_needed: "voice",
      remote: true,
      requires_onboarding: false,
    },
    {
      id: null,
      title: "Session buddy · swimming",
      description: "Help one swim lane. Onboarded volunteers only.",
      duration_min: 120,
      skills_needed: "sports",
      remote: false,
      requires_onboarding: true,
    },
  ];

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
    if (durationMin <= 15) return 20;
    if (durationMin <= 30) return 35;
    if (durationMin <= 45) return 40;
    return durationMin + 5;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderShifts(shifts) {
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
        let btn;
        if (s.requires_onboarding) {
          btn =
            '<button type="button" class="btn btn-sm btn-ink" data-onboard>Start onboarding</button>';
        } else if (s.id) {
          btn =
            '<button type="button" class="btn btn-sm btn-primary" data-claim-shift="' +
            s.id +
            '" data-claim-stay>Claim</button>';
        } else {
          btn =
            '<button type="button" class="btn btn-sm btn-primary" data-demo-claim>Claim</button>';
        }
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
  }

  async function reloadVolunteerShifts() {
    if (!L || !L.api) {
      renderShifts(FALLBACK);
      return;
    }
    try {
      const shifts = await L.api("/api/volunteers/shifts");
      if (!shifts || !shifts.length) {
        renderShifts(FALLBACK);
        return;
      }
      renderShifts(shifts);
    } catch (err) {
      renderShifts(FALLBACK);
    }
  }

  window.reloadVolunteerShifts = reloadVolunteerShifts;

  document.addEventListener("click", async function (e) {
    const demo = e.target.closest("[data-demo-claim]");
    if (demo) {
      e.preventDefault();
      const card = demo.closest(".activity");
      if (card) card.remove();
      if (L && L.showToast) {
        L.showToast("Claimed. Run the local API to save it on your profile.");
      }
      return;
    }

    if (!e.target.closest("[data-onboard]")) return;
    e.preventDefault();
    if (!L) return;
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

  reloadVolunteerShifts();
})();
