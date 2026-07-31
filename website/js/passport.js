/* Render My Love21 passport from API */

(function () {
  const L = window.Love21;
  if (!L || !document.querySelector("[data-passport-root]")) return;

  const ROLE_EMAIL = {
    family: "carer@chen.demo",
    member: "alex@chen.demo",
    donor: "donor@demo.love21",
    volunteer: "volunteer@demo.love21",
  };

  async function reloadPassport() {
    const root = document.querySelector("[data-passport-root]");
    const status = document.querySelector("[data-passport-status]");
    try {
      const role = localStorage.getItem("love21_role") || "family";
      const email = ROLE_EMAIL[role] || ROLE_EMAIL.family;
      // Prefer existing session; switch account via select
      const select = document.querySelector("[data-account-select]");
      const loginEmail = (select && select.value) || email;
      await L.ensureLogin(loginEmail);
      const data = await L.api("/api/passport");
      if (status) status.textContent = "Signed in as " + data.person.name;
      renderFamily(data);
      renderAchievement(data);
      renderImpact(data);
      renderVolunteer(data);
      renderPrefs(data.prefs);
    } catch (err) {
      if (status) status.textContent = "API offline — run backend on :8000";
      L.showToast(err.message || "Passport load failed");
    }
  }

  window.reloadPassport = reloadPassport;

  function renderFamily(data) {
    const el = document.querySelector("[data-family-panel]");
    if (!el || !data.family) {
      if (el)
        el.innerHTML =
          "<p class=\"muted\">Switch to the Chen family account to see household data.</p>";
      return;
    }
    const f = data.family;
    const regs = f.registrations
      .map(function (r) {
        const pendingFeedback = r.status === "attended" && !r.feedback;
        return (
          '<div class="timeline-item' +
          (pendingFeedback ? " pending" : "") +
          '">' +
          '<div class="timeline-date">' +
          r.status +
          (r.waitlist_position ? " #" + r.waitlist_position : "") +
          "</div>" +
          '<div class="timeline-title">' +
          escapeHtml(r.activity_title || "Activity") +
          " · " +
          escapeHtml(r.member_name || "") +
          "</div>" +
          (pendingFeedback
            ? '<button type="button" class="btn btn-sm btn-sea mt-1" data-feedback="' +
              r.id +
              '">Leave feedback</button>'
            : r.feedback
              ? '<p class="muted" style="margin:0;font-size:0.9rem">' +
                escapeHtml(r.feedback) +
                "</p>"
              : "") +
          "</div>"
        );
      })
      .join("");

    el.innerHTML =
      "<h3>" +
      escapeHtml(f.household_name) +
      "</h3>" +
      '<p class="muted" style="font-size:0.9rem">Members: ' +
      f.members
        .map(function (m) {
          return escapeHtml(m.name);
        })
        .join(", ") +
      "</p>" +
      '<div class="timeline">' +
      regs +
      "</div>";
  }

  function renderAchievement(data) {
    const el = document.querySelector("[data-achievement-panel]");
    if (!el || !data.achievement) return;
    const a = data.achievement;
    const stamps = a.achievements
      .map(function (x) {
        return (
          '<div class="timeline-item' +
          (x.status === "pending" ? " pending" : "") +
          '">' +
          '<div class="timeline-date">' +
          x.status.replace("_", " ") +
          "</div>" +
          '<div class="timeline-title">' +
          escapeHtml(x.title) +
          "</div>" +
          '<span class="badge-stamp">Stamp · ' +
          escapeHtml(x.pillar) +
          "</span>" +
          '<p class="muted" style="margin:0.35rem 0 0;font-size:0.85rem">Sharing: ' +
          (x.share_consent ? "consented" : "not consented") +
          "</p></div>"
        );
      })
      .join("");
    const goals = a.goals
      .map(function (g) {
        return (
          '<div class="timeline-item pending">' +
          '<div class="timeline-date">' +
          g.status +
          "</div>" +
          '<div class="timeline-title">' +
          escapeHtml(g.title) +
          "</div></div>"
        );
      })
      .join("");
    el.innerHTML =
      "<h3>" +
      escapeHtml(a.member.name) +
      " · stamps</h3>" +
      '<div class="timeline">' +
      stamps +
      goals +
      "</div>";
  }

  function renderImpact(data) {
    const el = document.querySelector("[data-impact-panel]");
    if (!el) return;
    const c = data.impact.commitments[0];
    const receipt = data.impact.receipts[0];
    if (!c) {
      el.innerHTML =
        '<p class="muted">No active commitment. Start HKD 300 monthly from the Impact page, or switch to the supporter demo account.</p>';
      return;
    }
    el.innerHTML =
      '<div class="impact-tile" style="border:none;padding:0">' +
      "<h3>Monthly · HKD " +
      c.amount_hkd +
      " · " +
      escapeHtml(c.status) +
      "</h3>" +
      '<p class="muted" style="font-size:0.88rem;margin:0">Fund: ' +
      escapeHtml(c.fund_category) +
      "</p>" +
      '<div class="meter" style="--pct:74.6%"><div class="meter-fill"></div></div>' +
      '<p class="muted" style="font-size:0.8rem;margin:0">74.6% of gifts go to programmes</p>' +
      (receipt && receipt.story_back
        ? "<p class=\"mt-1\" style=\"font-size:0.9rem\">" +
          escapeHtml(receipt.story_back) +
          "</p>"
        : "") +
      "</div>";
  }

  function renderVolunteer(data) {
    const el = document.querySelector("[data-volunteer-panel]");
    const hoursEl = document.querySelector("[data-volunteer-hours]");
    if (!el) return;
    const v = data.volunteer;
    if (hoursEl && v.profile) {
      hoursEl.textContent = String(v.profile.hours_logged);
    }
    const claims = (v.claims || [])
      .map(function (c) {
        return (
          '<div class="timeline-item' +
          (c.status === "claimed" ? " pending" : "") +
          '">' +
          '<div class="timeline-date">' +
          c.status +
          "</div>" +
          '<div class="timeline-title">' +
          escapeHtml(c.shift_title || "Shift") +
          "</div>" +
          '<p class="muted" style="margin:0;font-size:0.9rem">' +
          c.hours +
          " hrs" +
          (c.reflection ? " · " + escapeHtml(c.reflection) : "") +
          "</p></div>"
        );
      })
      .join("");
    let next = "";
    if (v.suggested_next) {
      next =
        '<div class="timeline-item pending">' +
        '<div class="timeline-date">Suggested next</div>' +
        '<div class="timeline-title">' +
        escapeHtml(v.suggested_next.title) +
        "</div>" +
        '<button type="button" class="btn btn-sm btn-sea mt-1" data-claim-shift="' +
        v.suggested_next.id +
        '">Claim this shift</button></div>';
    }
    el.innerHTML = '<div class="timeline">' + claims + next + "</div>";
  }

  function renderPrefs(prefs) {
    if (!prefs) return;
    document.querySelectorAll("[data-toggle]").forEach(function (btn) {
      const key = btn.getAttribute("data-toggle");
      const on = !!prefs[key];
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const select = document.querySelector("[data-account-select]");
  if (select) {
    select.addEventListener("change", async function () {
      await L.demoLogin(select.value);
      reloadPassport();
    });
  }

  reloadPassport();
})();
