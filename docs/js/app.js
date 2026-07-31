/* Love 21 — Part 2 front-end (wired to FastAPI) */

(function () {
  const ROLE_KEY = "love21_role";

  /* Arrival-page roles. "support" fans out into branches (donor /
     volunteer / company) rather than being a role of its own. */
  const journeys = {
    family: {
      title: "Find a class",
      cta: "Browse classes",
      ctaHref: "pages/activity-finder.html",
      note: "Filter by age, day, language, and support need. Full classes go on a waitlist with email reminders.",
    },
    support: {
      title: "Ways to support Love 21",
      note: "Give monthly, claim a volunteer shift, or bring your company on board — pick one to see the details.",
      branches: [
        {
          label: "Donor",
          hint: "See what HKD 300 / month funds",
          href: "pages/impact.html",
        },
        {
          label: "Volunteer",
          hint: "30–90 min tasks — claim a shift",
          href: "pages/volunteer.html",
        },
        {
          label: "Company / CSR",
          hint: "Team days, in-kind needs, hiring",
          href: "pages/opportunity.html",
        },
      ],
    },
    curious: {
      title: "New here? Start with the basics",
      note: "Love 21 runs sport, nutrition, and meaningful-work programmes for the Down syndrome, autistic, and neurodiverse community in Hong Kong.",
      cta: "About Love 21",
      ctaHref: "pages/about.html",
      secondary: [{ label: "Where money goes", href: "pages/transparency.html" }],
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

  /* Role chooser — preview only; does not hijack Profile session */
  const roleGrid = qs("[data-role-grid]");
  const preview = qs("[data-journey-preview]");
  if (roleGrid && preview) {
    const saved = localStorage.getItem(ROLE_KEY);
    roleGrid.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-role]");
      if (!btn) return;
      const role = btn.getAttribute("data-role");
      localStorage.setItem(ROLE_KEY, role);
      qsa("[data-role]", roleGrid).forEach(function (el) {
        el.classList.toggle("selected", el === btn);
      });
      showJourney(role);
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
    let html = "<h3>" + data.title + '</h3><p class="muted">' + data.note + "</p>";

    if (data.branches && data.branches.length) {
      html +=
        '<div class="role-grid mt-1">' +
        data.branches
          .map(function (b) {
            return (
              '<a class="role-option" href="' +
              base +
              b.href +
              '"><span class="role-label">' +
              b.label +
              '</span><span class="role-hint">' +
              b.hint +
              "</span></a>"
            );
          })
          .join("") +
        "</div>";
    } else if (data.cta) {
      html += '<div class="action-bar">';
      html += '<a class="btn btn-primary" href="' + base + data.ctaHref + '">' + data.cta + "</a>";
      if (data.secondary && data.secondary.length) {
        html += data.secondary
          .map(function (s) {
            return '<a class="btn btn-sm" href="' + base + s.href + '">' + s.label + "</a>";
          })
          .join("");
      }
      html += "</div>";
    }

    preview.innerHTML = html;
  }

  /* Channel toggles → API (keep current session) */
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
        if (!person) {
          person = await L.ensureLogin("carer@chen.demo");
        }
        const profile = await L.api("/api/profile");
        if (!profile.family) {
          L.showToast("This account has no household — switch to a family demo in Profile.");
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
            ? "Waitlist #" + result.waitlist_position + " — stamped in Profile"
            : "Booked · " + (result.activity_title || "class") + " — stamped in Profile";
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
        if (!L.getPerson()) {
          await L.ensureLogin("volunteer@demo.love21");
        }
        const claim = await L.api("/api/volunteers/claims", {
          method: "POST",
          body: { shift_id: shiftId },
        });
        const msg = "Claimed: " + (claim.shift_title || "shift");
        if (typeof window.reloadVolunteerShifts === "function") {
          window.reloadVolunteerShifts();
        }
        L.goToProfile("contribution", msg);
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

    const commitBtn = e.target.closest("[data-start-commitment]");
    if (commitBtn && L) {
      e.preventDefault();
      try {
        if (!L.getPerson()) {
          await L.ensureLogin("donor@demo.love21");
        }
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
          "Monthly HKD " + c.amount_hkd + " started · badge unlocked"
        );
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

    /* Commitment manage on non-profile pages only — Profile handles its own */
    const commitAction = e.target.closest("[data-commitment-action]");
    if (commitAction && L && !onProfile) {
      e.preventDefault();
      const action = commitAction.getAttribute("data-commitment-action");
      try {
        if (!L.getPerson()) {
          await L.ensureLogin("donor@demo.love21");
        }
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
        slot.textContent = "Ready";
      }
    } catch (e) {
      slot.textContent = "Offline";
    }
  }
  paintSession();
})();
