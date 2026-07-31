/* Love 21 — Part 2 front-end (wired to FastAPI) */

(function () {
  const ROLE_KEY = "love21_role";

  const journeys = {
    family: {
      title: "Classes for your household",
      note: "Browse by age, day, and language. Full classes go on a waitlist with email reminders.",
      loginEmail: "carer@chen.demo",
      actions: [
        {
          label: "Browse classes",
          href: "pages/activity-finder.html",
          primary: true,
        },
        { label: "Open Ability profile", href: "pages/profile.html#ability" },
      ],
    },
    donor: {
      title: "Give monthly",
      note: "HKD 300 / month funds about two coach-led sessions. Pause or change fund anytime from your Impact profile.",
      loginEmail: "donor@demo.love21",
      actions: [
        { label: "Start giving", href: "pages/impact.html", primary: true },
        { label: "Tax calculator", href: "pages/impact.html#tax" },
        { label: "Impact profile", href: "pages/profile.html#impact" },
      ],
    },
    volunteer: {
      title: "Short volunteer tasks",
      note: "Most shifts are 30–90 minutes. Claim one, then log hours in your Contribution profile.",
      loginEmail: "volunteer@demo.love21",
      actions: [
        { label: "See all tasks", href: "pages/volunteer.html", primary: true },
        {
          label: "Contribution profile",
          href: "pages/profile.html#contribution",
        },
      ],
      showTasks: true,
    },
    company: {
      title: "Partner with Love 21",
      note: "Hire member creators for your office, bring a CSR team day, or cover an in-kind need.",
      loginEmail: "donor@demo.love21",
      actions: [
        {
          label: "Hire talent",
          href: "pages/explore.html#marketplace",
          primary: true,
        },
        { label: "Current needs", href: "pages/opportunity.html" },
        { label: "Contact partnerships", href: "pages/contact.html" },
      ],
      showHire: true,
    },
  };

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  const L = window.Love21;
  const onProfile = !!qs("[data-profile-root]");

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
      const email = journeys[role] && journeys[role].loginEmail;
      if (L && email) {
        try {
          await L.demoLogin(email);
        } catch (err) {}
      }
      preview.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    preview.hidden = false;
    preview.classList.add("visible");

    let html =
      "<h2>" + data.title + '</h2><p class="muted">' + data.note + "</p>";

    if (data.showHire) {
      html +=
        '<div class="arrival-hire">' +
        '<button type="button" class="btn btn-sm btn-primary" data-hire="Mei · swimming coach">Hire Mei · swim</button>' +
        '<button type="button" class="btn btn-sm" data-hire="Jordan · kitchen demo">Hire Jordan · kitchen</button>' +
        '<button type="button" class="btn btn-sm" data-need-help="CSR kitchen session">Book CSR kitchen</button>' +
        "</div>";
    }

    if (data.showTasks) {
      html +=
        '<div class="task-list mt-1" data-home-tasks><p class="muted">Loading tasks…</p></div>';
    }

    html += '<div class="action-bar">';
    (data.actions || []).forEach(function (a) {
      html +=
        '<a class="btn' +
        (a.primary ? " btn-primary" : "") +
        '" href="' +
        base +
        a.href +
        '">' +
        a.label +
        "</a>";
    });
    html += "</div>";

    preview.innerHTML = html;

    if (data.showTasks && typeof window.loadHomeTasks === "function") {
      window.loadHomeTasks();
    }
  }

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
        L.showToast(
          (on ? "Enabled" : "Disabled") + " " + channel.replace("_", " ")
        );
      } catch (err) {
        btn.classList.toggle("on");
        L.showToast(L.friendlyError(err));
      }
    });
  });

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
        '<p class="empty-hint">Can\'t load classes — start the Love 21 server, then refresh.</p>';
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
        let person = L.getPerson();
        if (!person) person = await L.ensureLogin("carer@chen.demo");
        const passport = await L.api("/api/passport");
        if (!passport.family) {
          L.showToast(
            "This account has no household — switch demo account in Profile."
          );
          return;
        }
        const member =
          passport.family.members.find(function (m) {
            return m.role_primary === "member";
          }) || person;
        const result = await L.api("/api/family/register", {
          method: "POST",
          body: {
            activity_id: activityId,
            member_person_id: member.id,
            reminder_channel: "email",
          },
        });
        const msg =
          result.status === "waitlist"
            ? "Waitlist #" + result.waitlist_position + " — saved to profile"
            : "Booked · " + (result.activity_title || "class");
        if (onProfile && typeof window.reloadProfile === "function") {
          L.showToast(msg);
          window.reloadProfile();
        } else if (typeof window.reloadPassport === "function") {
          L.showToast(msg);
          window.reloadPassport();
        } else {
          L.goToProfile("ability", msg);
        }
        loadActivities();
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

    const claimBtn = e.target.closest("[data-claim-shift]");
    if (claimBtn && L && !onProfile) {
      e.preventDefault();
      const shiftId = Number(claimBtn.getAttribute("data-claim-shift"));
      try {
        if (!L.getPerson()) await L.ensureLogin("volunteer@demo.love21");
        const claim = await L.api("/api/volunteers/claims", {
          method: "POST",
          body: { shift_id: shiftId },
        });
        if (typeof window.reloadVolunteerShifts === "function") {
          window.reloadVolunteerShifts();
        }
        if (typeof window.loadHomeTasks === "function") window.loadHomeTasks();
        L.goToProfile("contribution", "Claimed: " + (claim.shift_title || "shift"));
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

    const commitBtn = e.target.closest("[data-start-commitment]");
    if (commitBtn && L) {
      e.preventDefault();
      try {
        if (!L.getPerson()) await L.ensureLogin("donor@demo.love21");
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
        L.goToProfile(
          "impact",
          "Monthly HKD " + c.amount_hkd + " started"
        );
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

    const commitAction = e.target.closest("[data-commitment-action]");
    if (commitAction && L && !onProfile) {
      e.preventDefault();
      const action = commitAction.getAttribute("data-commitment-action");
      try {
        if (!L.getPerson()) await L.ensureLogin("donor@demo.love21");
        const list = await L.api("/api/impact/commitments");
        if (!list.length) {
          L.showToast("No commitment yet — start one first");
          return;
        }
        const body =
          action === "pause"
            ? { status: "paused" }
            : action === "renew"
              ? { status: "active" }
              : { fund_category: "Nutrition programmes" };
        await L.api("/api/impact/commitments/" + list[0].id, {
          method: "PATCH",
          body: body,
        });
        L.goToProfile(
          "impact",
          action === "pause"
            ? "Gift paused"
            : action === "renew"
              ? "Gift renewed"
              : "Fund updated"
        );
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

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

  async function paintSession() {
    const slot = qs("[data-session]");
    if (!slot || !L) return;
    try {
      await L.api("/api/health");
      const person = L.getPerson();
      slot.textContent = person ? person.name : "Ready";
      if (person) slot.title = person.email;
    } catch (e) {
      slot.textContent = "Offline";
    }
  }
  paintSession();
})();
