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
        await L.requireLogin(async function (person) {
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
          const claim = await L.api("/api/volunteers/claims", {
            method: "POST",
            body: { shift_id: shiftId },
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
    if (commitBtn && L) {
      e.preventDefault();
      try {
        await L.requireLogin(async function () {
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
          L.goToProfile("impact", "Monthly HKD " + c.amount_hkd + " started");
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
    let link = qs("[data-admin-link]");
    if (isAdmin) {
      if (link) return;
      const slot = qs("[data-session]");
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "admin-dashboard.html";
      a.textContent = "Admin dashboard";
      a.setAttribute("data-admin-link", "");
      li.appendChild(a);
      const sessionLi = slot && slot.closest("li");
      if (sessionLi && sessionLi.parentNode) {
        sessionLi.parentNode.insertBefore(li, sessionLi);
      }
    } else if (link) {
      const li = link.closest("li");
      (li || link).remove();
    }
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
