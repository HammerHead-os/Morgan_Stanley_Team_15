/* Love 21 — Part 2 front-end (wired to FastAPI) */

(function () {
  const ROLE_KEY = "love21_role";

  const roleExperiences = {
    family: {
      label: "Family or participant",
      kicker: "For families and participants",
      title: "A place to move, grow, and belong.",
      copy: "Find a class that fits, understand the support around it, and keep every booking and milestone inside your Profile Passport.",
      primary: ["Find an activity", "pages/activity-finder.html"],
      secondary: ["Open your Profile Passport", "pages/profile.html#ability"],
      modules: ["activities", "programmes", "story", "login"],
    },
    volunteer: {
      label: "Volunteer",
      kicker: "For volunteers",
      title: "Bring a little time. Leave with a bigger view.",
      copy: "Pick a role that fits your schedule, support a programme, or discover the skills and talent already inside the Love 21 community.",
      primary: ["See volunteer roles", "pages/volunteer.html"],
      secondary: ["Find community talent", "pages/explore.html#marketplace"],
      modules: ["volunteer", "story", "social", "login"],
    },
    donor: {
      label: "Donor",
      kicker: "For donors",
      title: "Give with a clear view of the impact.",
      copy: "Meet the community, read the official reports, estimate the tax-adjusted cost, and keep every contribution inside your Profile Passport.",
      primary: ["See what HKD 300 does", "pages/impact.html#tax"],
      secondary: ["Read the latest report", "pages/about.html#reports"],
      modules: ["story", "reports", "donate", "social"],
    },
    company: {
      label: "Corporate partner",
      kicker: "For corporate partners",
      title: "Make inclusion part of how your team works.",
      copy: "Start with the story, review the evidence, then plan a CSR session, sponsor a programme, or book member-led talent.",
      primary: ["Explore partnership options", "pages/join.html#support"],
      secondary: ["Talk to our team", "pages/contact.html"],
      modules: ["story", "reports", "support", "social"],
    },
    curious: {
      label: "Just curious",
      kicker: "A quick introduction",
      title: "Start with the people, then see the work.",
      copy: "Meet Love 21, explore the programmes, and see how public reporting turns a simple mission into accountable action.",
      primary: ["Meet Love 21", "pages/about.html#story"],
      secondary: ["Explore all ways to join", "pages/join.html"],
      modules: ["story", "programmes", "reports", "social"],
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

  function renderSiteShell() {
    const inPages = /\/pages\//.test(location.pathname);
    const pagePrefix = inPages ? "" : "pages/";
    const homeHref = inPages ? "../index.html" : "index.html";
    const assetPrefix = inPages ? "../" : "";
    const role =
      roleExperiences[localStorage.getItem(ROLE_KEY)] || roleExperiences.curious;
    const nav = qs(".site-nav");
    if (nav) {
      nav.innerHTML =
        '<div class="inner">' +
        '<a class="brand" href="' +
        homeHref +
        '" aria-label="Love 21 home">' +
        '<img src="' +
        assetPrefix +
        'assets/media/love21-logo.png" alt="" />' +
        '<span>Love 21</span></a>' +
        '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu">Menu</button>' +
        '<ul class="nav-links" id="nav-menu">' +
        '<li class="nav-item nav-dropdown"><a class="nav-main" href="' +
        pagePrefix +
        'about.html">About us</a>' +
        '<div class="nav-menu" aria-label="About us sections">' +
        '<a href="' +
        pagePrefix +
        'about.html#story">Our story</a>' +
        '<a href="' +
        pagePrefix +
        'about.html#reports">Our financial reports</a>' +
        '<a href="' +
        pagePrefix +
        'about.html#programmes">Our programmes</a>' +
        '<a href="' +
        pagePrefix +
        'about.html#staff">Our staff</a></div></li>' +
        '<li class="nav-item nav-dropdown"><a class="nav-main" href="' +
        pagePrefix +
        'join.html">Join us</a>' +
        '<div class="nav-menu" aria-label="Join us sections">' +
        '<a href="' +
        pagePrefix +
        'join.html#activities">Find an activity</a>' +
        '<a href="' +
        pagePrefix +
        'join.html#volunteer">Be a volunteer</a>' +
        '<a href="' +
        pagePrefix +
        'join.html#find-volunteer">Find a volunteer</a>' +
        '<a href="' +
        pagePrefix +
        'join.html#donate">Donate</a>' +
        '<a href="' +
        pagePrefix +
        'join.html#support">Support us</a>' +
        '<a href="' +
        pagePrefix +
        'join.html#contact">Contact us</a></div></li>' +
        '<li class="nav-item nav-dropdown"><a class="nav-main" href="' +
        pagePrefix +
        'profile.html">Profile</a>' +
        '<div class="nav-menu" aria-label="Profile sections">' +
        '<a href="' +
        pagePrefix +
        'profile.html#ability">Ability passport</a>' +
        '<a href="' +
        pagePrefix +
        'profile.html#contribution">Contribution passport</a>' +
        '<a href="' +
        pagePrefix +
        'profile.html#impact">Impact passport</a></div></li></ul>' +
        '<div class="nav-tools"><a class="nav-role" href="' +
        homeHref +
        '?chooseRole=1#role-question">For: <span class="nav-role-name">' +
        role.label +
        '</span></a><span class="nav-session" data-session>Ready</span></div>' +
        "</div>";
    }

    const footer = qs(".site-footer");
    if (footer) {
      footer.innerHTML =
        '<div class="footer-grid">' +
        '<div><a class="footer-brand" href="' +
        homeHref +
        '">Love 21 Foundation</a>' +
        "<p>Sport, nutrition, family support, and community in San Po Kong, Hong Kong.</p></div>" +
        '<div><h4>Explore</h4><ul class="footer-links">' +
        '<li><a href="' +
        pagePrefix +
        'about.html">About us</a></li>' +
        '<li><a href="' +
        pagePrefix +
        'join.html">Join us</a></li>' +
        '<li><a href="' +
        pagePrefix +
        'profile.html">Profile</a></li></ul></div>' +
        '<div><h4>Visit</h4><p>Love 21 Space · 2/F, Trium Lab<br />21 Luk Hop Street, San Po Kong<br />' +
        '<a href="tel:+85223222121">+852 2322 2121</a><br />' +
        '<a href="mailto:info@love21foundation.com">info@love21foundation.com</a></p></div></div>' +
        '<div class="footer-bottom"><span>© Love 21 Foundation · Code to Give 2026</span>' +
        '<span><a href="https://love21foundation.com/" target="_blank" rel="noopener">Official website</a> · ' +
        '<a href="https://www.instagram.com/love21foundation/" target="_blank" rel="noopener">Instagram</a></span></div>';
    }
  }

  renderSiteShell();

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
  const roleGate = qs("[data-role-gate]");
  const roleHome = qs("[data-role-home]");
  const roleContent = qs("[data-role-content]");
  if (roleGrid && roleGate && roleHome && roleContent) {
    roleGrid.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-role]");
      if (!btn) return;
      const role = btn.getAttribute("data-role");
      showRoleHome(role, true);
    });

    const skip = qs("[data-role-skip]");
    if (skip) {
      skip.addEventListener("click", function () {
        showRoleHome("curious", true);
      });
    }
    qsa("[data-role-change]").forEach(function (button) {
      button.addEventListener("click", openRoleGate);
    });

    const params = new URLSearchParams(location.search);
    const saved = localStorage.getItem(ROLE_KEY);
    if (params.get("chooseRole") === "1" || !roleExperiences[saved]) {
      openRoleGate();
    } else {
      showRoleHome(saved, false);
    }
  }

  function openRoleGate() {
    if (!roleGate || !roleHome) return;
    roleGate.hidden = false;
    roleHome.hidden = true;
    const heading = qs("#role-question");
    if (heading) heading.focus({ preventScroll: true });
    roleGate.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showRoleHome(role, shouldScroll) {
    const data = roleExperiences[role] || roleExperiences.curious;
    localStorage.setItem(ROLE_KEY, role);
    if (roleGate) roleGate.hidden = true;
    if (roleHome) roleHome.hidden = false;

    qsa("[data-role]", roleGrid).forEach(function (button) {
      button.classList.toggle(
        "selected",
        button.getAttribute("data-role") === role
      );
    });
    qsa(".nav-role-name").forEach(function (slot) {
      slot.textContent = data.label;
    });

    const current = qs("[data-role-current]");
    const kicker = qs("[data-hero-kicker]");
    const title = qs("[data-hero-title]");
    const copy = qs("[data-hero-copy]");
    const primary = qs("[data-hero-primary]");
    const secondary = qs("[data-hero-secondary]");
    if (current) current.textContent = data.label;
    if (kicker) kicker.textContent = data.kicker;
    if (title) title.textContent = data.title;
    if (copy) copy.textContent = data.copy;
    if (primary) {
      primary.textContent = data.primary[0];
      primary.href = data.primary[1];
    }
    if (secondary) {
      secondary.textContent = data.secondary[0];
      secondary.href = data.secondary[1];
    }

    const modules = qsa("[data-home-module]", roleContent);
    modules.forEach(function (module) {
      module.hidden = true;
    });
    data.modules.forEach(function (name, index) {
      const module = qs('[data-home-module="' + name + '"]', roleContent);
      if (!module) return;
      module.hidden = false;
      module.style.setProperty("--module-order", String(index + 1));
      roleContent.appendChild(module);
    });

    loadFeaturedActivities();
    if (
      data.modules.includes("volunteer") &&
      typeof window.loadHomeTasks === "function"
    ) {
      window.loadHomeTasks();
    }
    if (shouldScroll) {
      qs("#top").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function loadFeaturedActivities() {
    const grid = qs("[data-featured-activities]");
    if (!grid || !L || grid.getAttribute("data-loaded") === "true") return;
    try {
      const list = await L.api("/api/activities");
      grid.innerHTML = list
        .slice(0, 3)
        .map(function (activity) {
          const full = activity.spots_left <= 0;
          return (
            '<article class="activity">' +
            '<div class="activity-meta"><span class="tag">' +
            escapeHtml(activity.goal) +
            '</span><span class="tag">' +
            escapeHtml(activity.day) +
            "</span></div>" +
            "<h3>" +
            escapeHtml(activity.title) +
            "</h3><p>" +
            escapeHtml(activity.description) +
            "</p>" +
            '<a class="text-link" href="pages/activity-finder.html">' +
            (full ? "Join the waitlist" : activity.spots_left + " places left") +
            "</a></article>"
          );
        })
        .join("");
      grid.setAttribute("data-loaded", "true");
    } catch (error) {
      grid.innerHTML =
        '<p class="empty-hint">Current activities are available in the Activity Finder.</p>';
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
    const slots = qsa("[data-session]");
    if (!slots.length || !L) return;
    try {
      await L.api("/api/health");
      const person = L.getPerson();
      slots.forEach(function (slot) {
        slot.textContent = person ? person.name : "Ready";
        if (person) slot.title = person.email;
      });
    } catch (e) {
      slots.forEach(function (slot) {
        slot.textContent = "Offline";
      });
    }
  }
  paintSession();
})();
