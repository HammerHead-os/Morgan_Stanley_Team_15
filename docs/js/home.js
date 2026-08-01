/* Home interactions: hire + needs + task preview */

(function () {
  const L = window.Love21;

  function toast(msg) {
    if (L) L.showToast(msg);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function volunteerHref() {
    return /\/pages\//.test(location.pathname)
      ? "volunteer.html"
      : "pages/volunteer.html";
  }

  function loadHomeTasks() {
    const taskBox = document.querySelector("[data-home-tasks]");
    if (!taskBox || !L) return;
    const skillLabels = {
      cantonese: "Cantonese reading",
      photos: "basic photo sorting",
      voice: "phone mic, English or Cantonese",
      sports: "on-site sports help",
    };
    function pointsGiven(mins) {
      if (mins <= 15) return 20;
      if (mins <= 30) return 35;
      if (mins <= 45) return 40;
      return mins + 5;
    }
    L.api("/api/volunteers/shifts")
      .then(function (shifts) {
        taskBox.innerHTML = shifts
          .slice(0, 3)
          .map(function (s) {
            const skill = String(s.skills_needed || "")
              .split(",")
              .map(function (x) {
                x = x.trim().toLowerCase();
                return skillLabels[x] || x;
              })
              .filter(Boolean)
              .join(", ");
            return (
              '<div class="task"><div><div class="task-meta">' +
              s.duration_min +
              " min</div><h3>" +
              escapeHtml(s.title) +
              "</h3><p>" +
              escapeHtml(s.description) +
              "</p>" +
              (skill
                ? '<p class="task-meta-line">Skills needed: ' +
                  escapeHtml(skill) +
                  "</p>"
                : "") +
              '<p class="task-meta-line">Points given: ' +
              pointsGiven(s.duration_min) +
              '</p></div><button type="button" class="btn btn-sm btn-mint" data-claim-shift="' +
              s.id +
              '">Claim</button></div>'
            );
          })
          .join("");
      })
      .catch(function () {
        taskBox.innerHTML =
          '<div class="task"><div><h3>Cantonese flyer check</h3>' +
          "<p>Proofread banquet flyers.</p>" +
          '<p class="task-meta-line">Skills needed: Cantonese reading</p>' +
          '<p class="task-meta-line">Points given: 20</p></div>' +
          '<a class="btn btn-sm btn-mint" href="' +
          volunteerHref() +
          '">Open tasks</a></div>';
      });
  }

  window.loadHomeTasks = loadHomeTasks;

  function pointsFor(mins) {
    if (mins <= 15) return 20;
    if (mins <= 30) return 35;
    if (mins <= 45) return 40;
    return mins + 5;
  }

  function skillLabel(raw) {
    const map = {
      cantonese: "Cantonese reading",
      photos: "basic photo sorting",
      voice: "phone mic, English or Cantonese",
      sports: "on-site sports help",
    };
    return String(raw || "")
      .split(",")
      .map(function (x) {
        x = x.trim().toLowerCase();
        return map[x] || x;
      })
      .filter(Boolean)
      .join(", ");
  }

  function loadMicroBoard() {
    const board = document.querySelector("[data-micro-board]");
    if (!board) return;

    const fallback = [
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
    ];

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
      const skill = skillLabel(s.skills_needed);
      const btn = s.id
        ? '<button type="button" class="btn btn-sm btn-primary" data-claim-shift="' +
          s.id +
          '" data-claim-stay>Claim</button>'
        : '<button type="button" class="btn btn-sm btn-primary" data-demo-claim>Claim</button>';
      const when = s.remote
        ? "Async · do anytime"
        : "In person · " + fmtDate(s.scheduled_date);
      return (
        '<article class="micro-task">' +
        '<p class="micro-task-time">' +
        s.duration_min +
        " min · " +
        when +
        "</p><h3>" +
        escapeHtml(s.title) +
        "</h3><p>" +
        escapeHtml(s.description) +
        "</p>" +
        (skill
          ? '<p class="task-meta-line">Skills needed: ' +
            escapeHtml(skill) +
            "</p>"
          : "") +
        '<p class="task-meta-line">Points given: ' +
        pointsFor(s.duration_min) +
        "</p>" +
        btn +
        "</article>"
      );
    }

    function render(shifts) {
      const list = (shifts || []).filter(function (s) {
        return !s.requires_onboarding;
      });
      const rows = list.length ? list : fallback;
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
          '<div class="micro-task-grid">' +
          remote.map(cardHtml).join("") +
          "</div>";
      }
      if (onsite.length) {
        html +=
          '<h3 class="task-split-title">In person · dated</h3>' +
          '<div class="micro-task-grid">' +
          onsite.map(cardHtml).join("") +
          "</div>";
      }
      board.innerHTML = html || '<p class="empty-hint">No tasks open right now.</p>';
    }

    if (!L) {
      render(fallback);
      return;
    }
    L.api("/api/volunteers/shifts")
      .then(render)
      .catch(function () {
        render(fallback);
      });
  }

  window.loadMicroBoard = loadMicroBoard;

  document.addEventListener("click", function (e) {
    const demo = e.target.closest("[data-demo-claim]");
    if (!demo) return;
    e.preventDefault();
    const card = demo.closest(".micro-task");
    if (card) card.remove();
    toast("Claimed. Start the API to save it on your profile.");
  });

  // Hire: click person → show date/time slots
  document.addEventListener("click", function (e) {
    const select = e.target.closest("[data-hire-select]");
    if (select) {
      e.preventDefault();
      const person = select.closest("[data-hire-person]");
      if (!person) return;
      document.querySelectorAll("[data-hire-person]").forEach(function (card) {
        const slots = card.querySelector("[data-hire-slots]");
        if (!slots) return;
        if (card === person) {
          const open = slots.hidden;
          slots.hidden = !open;
          card.classList.toggle("open", open);
        } else {
          slots.hidden = true;
          card.classList.remove("open");
        }
      });
      return;
    }
  });

  document.addEventListener("click", async function (e) {
    const hire = e.target.closest("[data-hire]");
    if (hire) {
      e.preventDefault();
      const label = hire.getAttribute("data-hire");
      const card =
        hire.closest("[data-hire-person]") ||
        hire.closest(".creator") ||
        hire.closest("article") ||
        hire.parentElement;
      const dateSel = card ? card.querySelector("[data-hire-date]") : null;
      const preferred = dateSel ? dateSel.value : "";
      if (dateSel && !preferred) {
        toast("Pick a date and time first");
        return;
      }
      if (!L) {
        toast("Request noted for " + label + (preferred ? " · " + preferred : ""));
        return;
      }
      try {
        await L.requireLogin(async function () {
          await L.api("/api/hire", {
            method: "POST",
            body: { creator_label: label, preferred_date: preferred || null },
          });
          if (typeof L.goToProfile === "function") {
            L.goToProfile(
              null,
              "Request sent for " + label + (preferred ? " · " + preferred : "")
            );
          } else {
            toast("Request sent for " + label);
          }
        });
      } catch (err) {
        if (!err.cancelled) toast(L.friendlyError ? L.friendlyError(err) : err.message);
      }
      return;
    }
    const need = e.target.closest("[data-need-help]");
    if (need) {
      e.preventDefault();
      toast("Got it. Noted: " + need.getAttribute("data-need-help"));
    }
  });

  if (document.querySelector("[data-home-tasks]")) {
    loadHomeTasks();
  }
  if (document.querySelector("[data-micro-board]")) {
    loadMicroBoard();
  }
})();
