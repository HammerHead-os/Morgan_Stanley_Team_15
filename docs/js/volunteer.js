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
      description: "Proofread banquet flyers. Do anytime this week.",
      duration_min: 15,
      skills_needed: "cantonese",
      remote: true,
      requires_onboarding: false,
      scheduled_date: null,
    },
    {
      id: null,
      title: "Photo sort",
      description: "Sort July hike photos. Async.",
      duration_min: 30,
      skills_needed: "photos",
      remote: true,
      requires_onboarding: false,
      scheduled_date: null,
    },
    {
      id: null,
      title: "Voice cheers",
      description: "Record a few short cheers. Upload when ready.",
      duration_min: 45,
      skills_needed: "voice",
      remote: true,
      requires_onboarding: false,
      scheduled_date: null,
    },
    {
      id: null,
      title: "Kitchen prep · Saturday",
      description: "Help set tables before the banquet.",
      duration_min: 90,
      skills_needed: "sports",
      remote: false,
      requires_onboarding: false,
      scheduled_date: "soon",
    },
    {
      id: null,
      title: "Track day helper",
      description: "Hand out water at San Po Kong.",
      duration_min: 120,
      skills_needed: "sports",
      remote: false,
      requires_onboarding: false,
      scheduled_date: "soon",
    },
    {
      id: null,
      title: "Session buddy · swimming",
      description: "Help one swim lane. Onboarded volunteers only.",
      duration_min: 120,
      skills_needed: "sports",
      remote: false,
      requires_onboarding: true,
      scheduled_date: "soon",
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

  function fmtDate(iso) {
    if (!iso || iso === "soon") return "Date on claim";
    try {
      return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch (e) {
      return String(iso);
    }
  }

  function cardHtml(s) {
    const when = s.remote
      ? "Remote · async"
      : "In person · " + fmtDate(s.scheduled_date);
    const tags =
      '<div class="activity-meta">' +
      '<span class="tag">' +
      s.duration_min +
      " min</span>" +
      '<span class="tag">' +
      when +
      "</span></div>";
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
  }

  function renderShifts(shifts) {
    const rows = shifts && shifts.length ? shifts : FALLBACK;
    const remote = rows.filter(function (s) {
      return !!s.remote;
    });
    const onsite = rows.filter(function (s) {
      return !s.remote;
    });
    let html = "";
    if (remote.length) {
      html +=
        '<h3 class="task-split-title">Remote · async</h3>' +
        '<div class="activity-grid">' +
        remote.map(cardHtml).join("") +
        "</div>";
    }
    if (onsite.length) {
      html +=
        '<h3 class="task-split-title">In person · dated</h3>' +
        '<div class="activity-grid">' +
        onsite.map(cardHtml).join("") +
        "</div>";
    }
    grid.innerHTML = html || '<p class="empty-hint">No tasks open right now.</p>';
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
