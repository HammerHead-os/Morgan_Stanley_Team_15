/* Love 21 - Part 2 front-end (wired to FastAPI) */

(function () {
  const ROLE_KEY = "love21_role";

  const journeys = {
    family: {
      title: "Find a class",
      note: "Filter by age, day, or language.",
      href: "pages/activity-finder.html",
    },
    contributor: {
      title: "Contribute",
      note: "Claim a task, hire someone, or cover a need.",
      href: "pages/volunteer.html",
    },
    curious: {
      title: "Explore",
      note: "Learn about programmes and where gifts go.",
      href: "pages/curious.html",
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

  // Keep the primary navigation consistent across the public pages. The two
  // informational links stay immediately before the profile/session control.
  const primaryNav = qs(".site-nav .nav-links");
  if (primaryNav) {
    const inPagesDirectory = window.location.pathname.includes("/pages/");
    const pagePrefix = inPagesDirectory ? "" : "pages/";
    const ensureLink = function (label, href) {
      if (Array.from(primaryNav.querySelectorAll("a")).some(function (link) {
        return link.textContent.trim() === label;
      })) return;

      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      if (window.location.pathname.endsWith("/" + href)) {
        link.setAttribute("aria-current", "page");
      }
      item.appendChild(link);
      const contactItem = primaryNav.querySelector('a[href$="contact.html"]')?.parentElement;
      primaryNav.insertBefore(
        item,
        label === "About"
          ? contactItem || primaryNav.querySelector(".nav-session")?.parentElement || null
          : primaryNav.querySelector(".nav-session")?.parentElement || null
      );
    };

    ensureLink("About", pagePrefix + "about.html");
    ensureLink("Contact", pagePrefix + "contact.html");
  }

  function paintSharedSubpageFooter() {
    if (!window.location.pathname.includes("/pages/")) return;
    const footer = qs(".site-footer");
    if (!footer) return;

    footer.innerHTML =
      '<div class="footer-grid">' +
      '<div class="footer-belief-block">' +
      '<div class="footer-brand">Love 21 Foundation</div>' +
      '<p class="footer-belief">We believe that every neurodiverse individual deserves an opportunity to reach their highest potential.</p>' +
      "</div>" +
      "<div>" +
      "<h4>Explore</h4>" +
      '<ul class="footer-links">' +
      '<li><a href="../index.html">Home</a></li>' +
      '<li><a href="about.html">About</a></li>' +
      '<li><a href="contact.html">Contact</a></li>' +
      '<li><a href="impact.html">Donations</a></li>' +
      '<li><a href="profile.html">Profile</a></li>' +
      "</ul>" +
      "</div>" +
      "<div>" +
      "<h4>Visit</h4>" +
      '<p class="footer-contact">Love 21 Space · 2/F, Trium Lab, 21 Luk Hop Street, San Po Kong<br />' +
      '<a href="tel:+85223222121">+852 2322 2121</a><br />' +
      '<a href="mailto:info@love21foundation.com">info@love21foundation.com</a></p>' +
      '<div class="footer-social-links" aria-label="Love 21 social media">' +
      '<a class="footer-social-link" href="https://www.instagram.com/love21foundation/" target="_blank" rel="noopener" aria-label="Love 21 on Instagram">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle class="social-icon-fill" cx="17.5" cy="6.5" r="1"></circle></svg>' +
      "</a>" +
      '<a class="footer-social-link" href="https://www.facebook.com/love21foundation/" target="_blank" rel="noopener" aria-label="Love 21 on Facebook">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="social-icon-fill" d="M13.7 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.5 1.6-1.5H17V4a22 22 0 0 0-2.4-.1c-2.4 0-4.1 1.5-4.1 4.2V10H8v3h2.5v8h3.2Z"></path></svg>' +
      "</a>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="footer-bottom">' +
      "<span>© Love 21 Foundation · Hackathon demo for Code to Give 2026</span>" +
      '<a href="../index.html">← Home</a>' +
      "</div>";

    const currentPage = window.location.pathname.split("/").pop();
    footer.querySelectorAll(".footer-links a").forEach(function (link) {
      if (link.getAttribute("href") === currentPage) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  paintSharedSubpageFooter();

  const brandLogo = qs(".site-nav .brand-logo");
  if (brandLogo) {
    const inPagesDirectory = window.location.pathname.includes("/pages/");
    brandLogo.src = inPagesDirectory
      ? "../assets/media/love21-logo.png"
      : "assets/media/love21-logo.png";
  }

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
  if (roleGrid) {
    roleGrid.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-role]");
      if (!btn) return;
      let role = btn.getAttribute("data-role");
      if (role === "volunteer" || role === "company" || role === "support")
        role = "contributor";
      if (role === "donor") role = "curious";
      localStorage.setItem(ROLE_KEY, role);
      const data = journeys[role];
      if (data && data.href) window.location.href = data.href;
    });
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
        await L.requireLogin(async function () {
          await L.api("/api/prefs", { method: "PATCH", body: body });
          L.showToast(
            (on ? "Enabled" : "Disabled") + " " + channel.replace("_", " ")
          );
        });
      } catch (err) {
        btn.classList.toggle("on");
        if (!err.cancelled) L.showToast(L.friendlyError(err));
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

  function fmtActivityTime(hms) {
    if (!hms) return "";
    const parts = String(hms).split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1] || "00";
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + " " + suffix;
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
        const timeText = fmtActivityTime(a.scheduled_time);
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
          (timeText ? " · " + timeText : "") +
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
          '" data-activity-title="' +
          escapeHtml(a.title) +
          '" data-activity-day="' +
          escapeHtml(a.day) +
          '" data-activity-fixed-date="' +
          escapeHtml(a.fixed_date || "") +
          '" data-activity-time="' +
          escapeHtml(a.scheduled_time || "") +
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
      const activityTitle = regBtn.getAttribute("data-activity-title") || "this class";
      const activityDay = regBtn.getAttribute("data-activity-day") || "weekday";
      const activityFixedDate = regBtn.getAttribute("data-activity-fixed-date") || "";
      const activityScheduledTime = regBtn.getAttribute("data-activity-time") || "";
      const actionLabel = regBtn.textContent.trim();
      try {
        await L.requireLogin(async function (person) {
          // No household required to register — the registrant may be the
          // person the class is for, not necessarily a carer booking a
          // separate dependent. If there IS a household, still offer its
          // other members as options (today's carer-books-a-child flow).
          let householdMembers = [];
          try {
            const profile = await L.api("/api/profile");
            householdMembers = (profile.family && profile.family.members) || [];
          } catch (e) {
            householdMembers = [];
          }
          const defaultMember =
            householdMembers.find(function (m) {
              return m.role_primary === "member";
            }) || person;
          if (!window.Love21Registration) return;
          const result = await window.Love21Registration.open(
            activityId,
            activityTitle,
            defaultMember,
            actionLabel,
            householdMembers,
            person,
            activityDay,
            activityFixedDate,
            activityScheduledTime
          );
          if (!result) return; // cancelled
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
        });
      } catch (err) {
        if (!err.cancelled) L.showToast(L.friendlyError(err));
      }
      return;
    }

    const claimBtn = e.target.closest("[data-claim-shift]");
    if (claimBtn && L && !onProfile) {
      e.preventDefault();
      const shiftId = Number(claimBtn.getAttribute("data-claim-shift"));
      const card = claimBtn.closest(".activity, .micro-task, .task");
      const stayHere = claimBtn.hasAttribute("data-claim-stay");
      try {
        await L.requireLogin(async function () {
          let attendees = [];
          if (window.Love21Claim) {
            const result = await window.Love21Claim.open();
            if (!result) return; // cancelled
            attendees = result.attendees || [];
          }
          const claim = await L.api("/api/volunteers/claims", {
            method: "POST",
            body: { shift_id: shiftId, attendees: attendees },
          });
          if (typeof window.reloadVolunteerShifts === "function") {
            window.reloadVolunteerShifts();
          }
          if (typeof window.loadHomeTasks === "function") window.loadHomeTasks();
          if (typeof window.loadMicroBoard === "function") window.loadMicroBoard();
          if (stayHere) {
            L.showToast(
              "Claimed: " +
                (claim.shift_title || "task") +
                ". Finish it on Profile → My tasks."
            );
            if (card) card.remove();
          } else {
            L.goToProfile(
              null,
              "Claimed: " +
                (claim.shift_title || "task") +
                ". Finish it under My tasks."
            );
          }
        });
      } catch (err) {
        if (!err.cancelled) L.showToast(L.friendlyError(err));
      }
      return;
    }

    const commitBtn = e.target.closest("[data-start-commitment]");
    if (commitBtn && L && window.Love21PaymentModal) {
      e.preventDefault();
      try {
        await L.requireLogin(async function () {
          const amountEl = document.getElementById("gift");
          const amount = amountEl ? Number(amountEl.value) || 300 : 300;
          const result = await window.Love21PaymentModal.open({
            amountHkd: amount,
            cadence: "monthly",
            fundCategory: "Sports programmes",
            method: "payme",
          });
          if (!result) return; // cancelled
          L.goToProfile("impact", "Monthly HKD " + result.amount_hkd + " started");
        });
      } catch (err) {
        if (!err.cancelled) L.showToast(L.friendlyError(err));
      }
      return;
    }

    const commitAction = e.target.closest("[data-commitment-action]");
    if (commitAction && L && !onProfile) {
      e.preventDefault();
      const action = commitAction.getAttribute("data-commitment-action");
      try {
        await L.requireLogin(async function () {
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
        });
      } catch (err) {
        if (!err.cancelled) L.showToast(L.friendlyError(err));
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

  function paintAdminLink(person) {
    const isAdmin = !!person && Array.isArray(person.roles) && person.roles.indexOf("admin") !== -1;
    const slot = qs("[data-session]");
    const sessionLi = slot && slot.closest("li");

    function ensureLink(attr, href, text) {
      let link = qs("[" + attr + "]");
      if (isAdmin) {
        if (link) return;
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = href;
        a.textContent = text;
        a.setAttribute(attr, "");
        li.appendChild(a);
        if (sessionLi && sessionLi.parentNode) {
          sessionLi.parentNode.insertBefore(li, sessionLi);
        }
      } else if (link) {
        const li = link.closest("li");
        (li || link).remove();
      }
    }

    ensureLink("data-admin-link", "admin-dashboard.html", "Admin dashboard");
    ensureLink("data-admin-hire-link", "admin-hire.html", "Hire enquiries");
  }

  async function paintSession() {
    const slot = qs("[data-session]");
    if (!slot || !L) return;
    try {
      await L.api("/api/health");
      const person = L.getToken() ? L.getPerson() : null;
      slot.textContent = person ? person.name : "Profile";
      if (person) slot.title = person.email;
      else slot.removeAttribute("title");
      paintAdminLink(person);
    } catch (e) {
      slot.textContent = "Offline";
    }
  }
  window.addEventListener("love21:session-changed", paintSession);
  paintSession();
})();
