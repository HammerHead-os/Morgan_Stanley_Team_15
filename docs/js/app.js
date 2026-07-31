/* Love 21 — Part 2 front-end (wired to FastAPI) */

(function () {
  const ROLE_KEY = "love21_role";

  const journeys = {
    family: {
      title: "Find a class",
      note: "Filter by age, day, or language. If a class is full, join the waitlist and we email you.",
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
    support: {
      title: "Ways to support Love 21",
      note: "Give monthly, claim a volunteer shift, or bring your company on board — pick one to see the details.",
      actions: [
        { label: "Give monthly", href: "pages/impact.html", primary: true },
        { label: "See all tasks", href: "pages/volunteer.html" },
        { label: "Hire talent / current needs", href: "pages/opportunity.html" },
      ],
      showTasks: true,
    },
    curious: {
      title: "New here? Start with the basics",
      note: "Love 21 runs sport, nutrition, and meaningful-work programmes for the Down syndrome, autistic, and neurodiverse community in Hong Kong.",
      actions: [
        { label: "About Love 21", href: "pages/about.html", primary: true },
        { label: "Where money goes", href: "pages/transparency.html" },
      ],
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

    html += '<div class="action-bar arrival-actions">';
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

    if (data.showTasks) {
      html +=
        '<div class="task-list arrival-tasks" data-home-tasks><p class="muted">Loading tasks…</p></div>';
    }

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
        '<p class="empty-hint">Classes will not load. Run the local server, then refresh.</p>';
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
        const profile = await L.api("/api/profile");
        if (!profile.family) {
          L.showToast(
            "This account has no household — switch demo account in Profile."
          );
          return;
        }
        const member =
          profile.family.members.find(function (m) {
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
