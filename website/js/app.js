/* Love 21 — Part 2 front-end (wired to FastAPI) */

(function () {
  const ROLE_KEY = "love21_role";

  const journeys = {
    family: {
      title: "Find a class",
      cta: "Browse classes",
      ctaHref: "pages/activity-finder.html",
      modules: [],
      note: "Filter by age, day, language, and support need. Full classes go on a waitlist with email reminders.",
      loginEmail: "carer@chen.demo",
    },
    volunteer: {
      title: "Volunteer",
      cta: "See open shifts",
      ctaHref: "pages/volunteer.html",
      modules: [],
      note: "Most tasks are 30–90 minutes. Claim a shift, then log hours from your account.",
      loginEmail: "volunteer@demo.love21",
    },
    donor: {
      title: "Give monthly",
      cta: "See what HKD 300 funds",
      ctaHref: "pages/impact.html",
      modules: [],
      note: "Spend breakdown first, then set up a monthly gift you can pause or change.",
      loginEmail: "donor@demo.love21",
    },
    corporate: {
      title: "Company / CSR",
      cta: "See current needs",
      ctaHref: "pages/opportunity.html",
      modules: [],
      note: "Team volunteering dates, in-kind requests, and hiring enquiries — not a blank contact form.",
      loginEmail: "donor@demo.love21",
    },
  };

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  const L = window.Love21;

  /* Mobile nav */
  const toggle = qs(".nav-toggle");
  const links = qs(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
      toggle.setAttribute(
        "aria-expanded",
        links.classList.contains("open") ? "true" : "false"
      );
    });
  }

  /* Role chooser */
  const roleGrid = qs("[data-role-grid]");
  const preview = qs("[data-journey-preview]");
  if (roleGrid && preview) {
    const saved = localStorage.getItem(ROLE_KEY);
    roleGrid.addEventListener("click", async function (e) {
      const btn = e.target.closest("[data-role]");
      if (!btn) return;
      const role = btn.getAttribute("data-role");
      localStorage.setItem(ROLE_KEY, role);
      qsa("[data-role]", roleGrid).forEach(function (el) {
        el.classList.toggle("selected", el === btn);
      });
      showJourney(role);
      if (L && journeys[role]) {
        try {
          await L.demoLogin(journeys[role].loginEmail);
        } catch (err) {
          /* backend may be down — UI still works */
        }
      }
    });
    if (saved && journeys[saved]) {
      const match = qs('[data-role="' + saved + '"]', roleGrid);
      if (match) {
        match.classList.add("selected");
        showJourney(saved);
      }
    }
  }

  function showJourney(role) {
    const data = journeys[role];
    if (!data || !preview) return;
    const base = preview.getAttribute("data-base") || "";
    preview.classList.add("visible");
    preview.innerHTML =
      "<h3>" +
      data.title +
      '</h3><p class="muted">' +
      data.note +
      "</p>" +
      (data.modules && data.modules.length
        ? '<div class="journey-modules">' +
          data.modules
            .map(function (m, i) {
              return (
                '<span class="chip"><span class="chip-num">' +
                (i + 1) +
                "</span>" +
                m +
                "</span>"
              );
            })
            .join("") +
          "</div>"
        : "") +
      '<a class="btn btn-primary" href="' +
      base +
      data.ctaHref +
      '">' +
      data.cta +
      "</a>";
  }

  /* Passport tabs */
  const tabs = qsa("[data-passport-tab]");
  const panels = qsa("[data-passport-panel]");
  if (tabs.length) {
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        const id = tab.getAttribute("data-passport-tab");
        tabs.forEach(function (t) {
          t.classList.toggle("active", t === tab);
        });
        panels.forEach(function (p) {
          p.classList.toggle(
            "active",
            p.getAttribute("data-passport-panel") === id
          );
        });
        history.replaceState(null, "", "#" + id);
      });
    });
    const hash = (location.hash || "").replace("#", "");
    if (hash) {
      const tab = qs('[data-passport-tab="' + hash + '"]');
      if (tab) tab.click();
    }
  }

  /* Channel toggles → API */
  qsa("[data-toggle]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      btn.classList.toggle("on");
      const on = btn.classList.contains("on");
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (!L) return;
      const channel = btn.getAttribute("data-toggle");
      const body = {};
      body[channel] = on;
      try {
        await L.ensureLogin();
        await L.api("/api/prefs", { method: "PATCH", body: body });
        L.showToast((on ? "Enabled" : "Disabled") + " " + channel.replace("_", " "));
      } catch (err) {
        L.showToast(err.message || "Could not save preference");
      }
    });
  });

  /* Activity finder — load from API */
  const filterForm = qs("[data-activity-filters]");
  const activityGrid = qs("[data-activity-grid]");
  if (filterForm && activityGrid) {
    loadActivities();
    filterForm.addEventListener("change", loadActivities);
  }

  async function loadActivities() {
    if (!L || !activityGrid) return;
    const params = new URLSearchParams();
    ["goal", "age", "day", "support", "lang"].forEach(function (name) {
      const el = qs('[name="' + name + '"]', filterForm);
      if (el && el.value) params.set(name, el.value);
    });
    const qsStr = params.toString();
    try {
      const list = await L.api(
        "/api/activities" + (qsStr ? "?" + qsStr : "")
      );
      renderActivities(list);
    } catch (err) {
      activityGrid.innerHTML =
        '<p class="empty-hint">API offline — start the backend on port 8000.</p>';
    }
  }

  function renderActivities(list) {
    const empty = qs("[data-empty]");
    if (!list.length) {
      activityGrid.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    activityGrid.innerHTML = list
      .map(function (a) {
        const full = a.spots_left <= 0;
        const action = full ? "Join waitlist" : "Register";
        const btnClass = full ? "btn-ink" : "btn-primary";
        return (
          '<article class="activity" data-activity-id="' +
          a.id +
          '">' +
          '<div class="activity-meta">' +
          '<span class="tag">' +
          a.goal +
          "</span>" +
          '<span class="tag">' +
          a.day +
          "</span>" +
          (full
            ? '<span class="tag tag-coral">Full</span>'
            : '<span class="tag tag-coral">' + a.spots_left + " spots</span>") +
          "</div>" +
          "<h3>" +
          escapeHtml(a.title) +
          "</h3>" +
          "<p>" +
          escapeHtml(a.description) +
          "</p>" +
          '<button type="button" class="btn btn-sm ' +
          btnClass +
          '" data-register="' +
          a.id +
          '">' +
          action +
          "</button></article>"
        );
      })
      .join("");
  }

  document.addEventListener("click", async function (e) {
    const regBtn = e.target.closest("[data-register]");
    if (regBtn && L) {
      e.preventDefault();
      const activityId = Number(regBtn.getAttribute("data-register"));
      try {
        const person = await L.ensureLogin("carer@chen.demo");
        const passport = await L.api("/api/passport");
        const member =
          (passport.family &&
            passport.family.members.find(function (m) {
              return m.role_primary === "member";
            })) ||
          person;
        const result = await L.api("/api/family/register", {
          method: "POST",
          body: {
            activity_id: activityId,
            member_person_id: member.id,
            reminder_channel: "email",
          },
        });
        L.showToast(
          result.status === "waitlist"
            ? "Waitlist #" + result.waitlist_position + " — reminder set"
            : "Registered · " + (result.activity_title || "activity")
        );
        loadActivities();
      } catch (err) {
        L.showToast(err.message || "Registration failed");
      }
      return;
    }

    const claimBtn = e.target.closest("[data-claim-shift]");
    if (claimBtn && L) {
      e.preventDefault();
      const shiftId = Number(claimBtn.getAttribute("data-claim-shift"));
      try {
        await L.ensureLogin("volunteer@demo.love21");
        const claim = await L.api("/api/volunteers/claims", {
          method: "POST",
          body: { shift_id: shiftId },
        });
        L.showToast("Claimed: " + (claim.shift_title || "shift"));
        if (typeof window.reloadVolunteerShifts === "function") {
          window.reloadVolunteerShifts();
        }
      } catch (err) {
        L.showToast(err.message || "Could not claim shift");
      }
      return;
    }

    const commitBtn = e.target.closest("[data-start-commitment]");
    if (commitBtn && L) {
      e.preventDefault();
      try {
        await L.ensureLogin("donor@demo.love21");
        const amountEl = document.getElementById("gift");
        const amount = amountEl ? Number(amountEl.value) || 300 : 300;
        const c = await L.api("/api/impact/commitments", {
          method: "POST",
          body: {
            amount_hkd: amount,
            fund_category: "Sports programmes",
            cadence: "monthly",
          },
        });
        L.showToast("Monthly HKD " + c.amount_hkd + " started · impact badge on");
      } catch (err) {
        L.showToast(err.message || "Could not start commitment");
      }
      return;
    }

    const commitAction = e.target.closest("[data-commitment-action]");
    if (commitAction && L) {
      e.preventDefault();
      const action = commitAction.getAttribute("data-commitment-action");
      try {
        await L.ensureLogin("donor@demo.love21");
        const list = await L.api("/api/impact/commitments");
        if (!list.length) {
          L.showToast("No commitment yet — start one first");
          return;
        }
        const id = list[0].id;
        const body =
          action === "pause"
            ? { status: "paused" }
            : action === "renew"
              ? { status: "active" }
              : { fund_category: "Nutrition programmes" };
        await L.api("/api/impact/commitments/" + id, {
          method: "PATCH",
          body: body,
        });
        L.showToast(
          action === "pause"
            ? "Paused"
            : action === "renew"
              ? "Renewed / active"
              : "Fund category updated"
        );
        if (typeof window.reloadPassport === "function") window.reloadPassport();
      } catch (err) {
        L.showToast(err.message || "Update failed");
      }
      return;
    }

    const goalBtn = e.target.closest("[data-set-goal]");
    if (goalBtn && L) {
      e.preventDefault();
      try {
        await L.ensureLogin("carer@chen.demo");
        const passport = await L.api("/api/passport");
        const memberId =
          (passport.achievement && passport.achievement.member.id) ||
          L.getPerson().id;
        await L.api("/api/achievements/goals", {
          method: "POST",
          body: {
            title: "New coach goal · " + new Date().toLocaleDateString(),
            member_person_id: memberId,
          },
        });
        L.showToast("Goal set — coach approval next");
        if (typeof window.reloadPassport === "function") window.reloadPassport();
      } catch (err) {
        L.showToast(err.message || "Could not set goal");
      }
      return;
    }

    const feedbackBtn = e.target.closest("[data-feedback]");
    if (feedbackBtn && L) {
      e.preventDefault();
      const regId = Number(feedbackBtn.getAttribute("data-feedback"));
      try {
        await L.ensureLogin("carer@chen.demo");
        await L.api("/api/family/registrations/" + regId + "/feedback", {
          method: "POST",
          body: { feedback: "Great session — Alex was engaged the whole time." },
        });
        L.showToast("Feedback saved");
        if (typeof window.reloadPassport === "function") window.reloadPassport();
      } catch (err) {
        L.showToast(err.message || "Feedback failed");
      }
      return;
    }

    /* legacy data-demo fallback */
    const demo = e.target.closest("[data-demo]");
    if (demo && !demo.hasAttribute("data-register")) {
      e.preventDefault();
      if (L) L.showToast(demo.getAttribute("data-demo"));
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Session chip in nav */
  async function paintSession() {
    const slot = qs("[data-session]");
    if (!slot || !L) return;
    try {
      await L.api("/api/health");
      const person = L.getPerson();
      if (person) {
        slot.textContent = person.name;
        slot.title = person.email;
      } else {
        slot.textContent = "API ready";
      }
    } catch (e) {
      slot.textContent = "API offline";
    }
  }
  paintSession();
})();
