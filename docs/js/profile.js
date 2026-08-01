/* Love 21 Profile — unified activity + role actions */

(function () {
  const L = window.Love21;
  if (!L || !document.querySelector("[data-profile-root]")) return;

  let profileData = null;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "-";
    }
  }

  function roleLabel(role, householdRole) {
    if (householdRole) {
      const map = {
        mom: "Mom",
        dad: "Dad",
        caregiver: "Caregiver",
        helper: "Helper",
        child: "Child / member",
      };
      return map[householdRole] || householdRole;
    }
    return (
      {
        family: "Family carer",
        member: "Member",
        donor: "Supporter",
        volunteer: "Volunteer",
        corporate: "Company",
      }[role] || role
    );
  }

  function setPrefsOpen(open) {
    const drawer = document.querySelector("[data-prefs-drawer]");
    const btn = document.querySelector("[data-prefs-toggle]");
    if (!drawer) return;
    drawer.hidden = !open;
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function personRoles(data) {
    const p = data.person || {};
    const roles = p.roles && p.roles.length ? p.roles.slice() : [];
    if (p.role_primary && roles.indexOf(p.role_primary) < 0) {
      roles.unshift(p.role_primary);
    }
    return roles;
  }

  function hasRole(data, role) {
    return personRoles(data).indexOf(role) >= 0;
  }

  function renderActions(data) {
    const el = document.querySelector("[data-role-actions]");
    if (!el) return;
    const links = [];
    const seen = {};

    function add(href, label, primary) {
      if (seen[href + label]) return;
      seen[href + label] = true;
      links.push({ href: href, label: label, primary: !!primary });
    }

    add("impact.html", "Give monthly", true);
    add("profile.html#calendar", "Open calendar");

    if (hasRole(data, "family") || hasRole(data, "member") || data.family) {
      add("activity-finder.html", "Browse classes");
      add("family.html", "Family hub");
    }
    if (hasRole(data, "volunteer") || hasRole(data, "corporate")) {
      add("volunteer.html", "Volunteer tasks");
      add("explore.html#marketplace", "Hire talent");
      add("opportunity.html", "Current needs");
      add("contributor.html", "Contributor hub");
    }
    if (hasRole(data, "donor")) {
      add("impact.html#achievements", "What we achieved");
    }

    el.innerHTML = links
      .map(function (l) {
        return (
          '<a class="btn' +
          (l.primary ? " btn-primary" : "") +
          '" href="' +
          l.href +
          '">' +
          escapeHtml(l.label) +
          "</a>"
        );
      })
      .join("");
  }

  function renderRoleToggles(data) {
    const box = document.querySelector("[data-role-toggles]");
    if (!box) return;
    const roles = personRoles(data);
    box.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.checked = roles.indexOf(input.value) >= 0;
      if (data.person.household_role === "child" && input.value === "family") {
        input.disabled = true;
      }
    });
  }

  function renderFamily(data) {
    const section = document.querySelector("[data-family-section]");
    const list = document.querySelector("[data-family-members]");
    if (!section || !list) return;
    const family = data.family;
    const show =
      !!family &&
      (hasRole(data, "family") ||
        hasRole(data, "member") ||
        !!data.person.household_id);
    section.hidden = !show;
    if (!show) return;

    const canAdd = data.person.household_role !== "child";
    const form = document.querySelector("[data-add-member-form]");
    if (form) form.hidden = !canAdd;

    const members = family.members || [];
    if (!members.length) {
      list.innerHTML = '<p class="muted">No members yet.</p>';
      return;
    }
    list.innerHTML =
      '<ul class="family-member-list">' +
      members
        .map(function (m) {
          return (
            "<li><strong>" +
            escapeHtml(m.name) +
            "</strong> · " +
            escapeHtml(roleLabel(m.role_primary, m.household_role)) +
            ' <span class="muted">(' +
            escapeHtml(m.profile_code || "") +
            ")</span></li>"
          );
        })
        .join("") +
      "</ul>" +
      '<p class="muted" style="font-size:0.88rem;margin-top:0.75rem">Everyone listed here sees Alex’s class records on this household.</p>';
  }

  function renderGiftManage(data) {
    const manage = document.querySelector("[data-gift-manage]");
    if (!manage) return;
    const hasGift =
      data.impact &&
      data.impact.commitments &&
      data.impact.commitments.length;
    manage.hidden = !(hasRole(data, "donor") || hasGift);
  }

  let calCursor = new Date();
  calCursor.setDate(1);

  function renderCalendar(data) {
    const grid = document.querySelector("[data-cal-grid]");
    const label = document.querySelector("[data-cal-label]");
    const dayList = document.querySelector("[data-cal-day-list]");
    if (!grid || !label) return;

    const events = data.calendar_events || [];
    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    label.textContent = calCursor.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const byDay = {};
    events.forEach(function (ev) {
      const d = String(ev.date).slice(0, 10);
      const parts = d.split("-");
      if (Number(parts[0]) !== y || Number(parts[1]) !== m + 1) return;
      const day = Number(parts[2]);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ev);
    });

    let html =
      '<div class="cal-dow">Sun</div><div class="cal-dow">Mon</div><div class="cal-dow">Tue</div><div class="cal-dow">Wed</div><div class="cal-dow">Thu</div><div class="cal-dow">Fri</div><div class="cal-dow">Sat</div>';
    for (let i = 0; i < firstDow; i++) {
      html += '<div class="cal-cell empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const evs = byDay[day] || [];
      const kinds = evs
        .map(function (e) {
          return e.kind;
        })
        .join(" ");
      html +=
        '<button type="button" class="cal-cell' +
        (evs.length ? " has-event" : "") +
        '" data-cal-day="' +
        day +
        '"><span class="cal-num">' +
        day +
        "</span>";
      if (evs.length) {
        html += '<span class="cal-marks ' + escapeHtml(kinds) + '"></span>';
      }
      html += "</button>";
    }
    grid.innerHTML = html;

    function showDay(day) {
      if (!dayList) return;
      const evs = byDay[day] || [];
      if (!evs.length) {
        dayList.innerHTML =
          '<li class="muted">No classes or shifts on this day.</li>';
        return;
      }
      dayList.innerHTML = evs
        .map(function (e) {
          return (
            "<li><strong>" +
            escapeHtml(e.title) +
            "</strong> · " +
            escapeHtml(e.kind) +
            (e.detail ? " · " + escapeHtml(e.detail) : "") +
            (e.status ? " · " + escapeHtml(e.status) : "") +
            "</li>"
          );
        })
        .join("");
    }

    grid.querySelectorAll("[data-cal-day]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showDay(Number(btn.getAttribute("data-cal-day")));
      });
    });

    const today = new Date();
    if (today.getFullYear() === y && today.getMonth() === m) {
      showDay(today.getDate());
    } else if (dayList) {
      dayList.innerHTML =
        '<li class="muted">Tap a day to see classes and volunteer shifts.</li>';
    }
  }

  function feedItem(dateIso, title, body, tag) {
    return {
      t: dateIso ? new Date(dateIso).getTime() : 0,
      html:
        '<article class="feed-item">' +
        '<div class="feed-meta"><span class="tag">' +
        escapeHtml(tag) +
        "</span> · " +
        escapeHtml(fmtDate(dateIso)) +
        "</div>" +
        "<h3>" +
        escapeHtml(title) +
        "</h3>" +
        (body ? "<p>" + body + "</p>" : "") +
        "</article>",
    };
  }

  function renderFeed(data) {
    const el = document.querySelector("[data-activity-feed]");
    if (!el) return;
    const items = [];

    const family = data.family;
    if (family && family.registrations) {
      family.registrations.forEach(function (r) {
        items.push(
          feedItem(
            r.created_at,
            (r.activity_title || "Class") +
              (r.member_name ? " · " + r.member_name : ""),
            escapeHtml(r.status_label || r.status) +
              (r.feedback
                ? "<br/>Note: " + escapeHtml(r.feedback)
                : ""),
            "Class"
          )
        );
      });
    }

    if (data.achievement && data.achievement.achievements) {
      data.achievement.achievements.forEach(function (a) {
        items.push(
          feedItem(
            a.approved_at || a.created_at,
            a.title,
            escapeHtml(a.status_label || a.status) +
              (a.coach_name ? " · " + escapeHtml(a.coach_name) : ""),
            "Milestone"
          )
        );
      });
    }

    if (data.volunteer && data.volunteer.claims) {
      data.volunteer.claims.forEach(function (c) {
        items.push(
          feedItem(
            c.completed_at || c.claimed_at,
            c.shift_title || "Volunteer shift",
            escapeHtml(c.status_label || c.status) +
              (c.hours ? " · " + c.hours + " hrs" : ""),
            "Volunteer"
          )
        );
      });
    }

    if (data.impact && data.impact.receipts) {
      data.impact.receipts.forEach(function (r) {
        const story = r.story_back
          ? escapeHtml(r.story_back)
          : "HKD " + r.amount_hkd + " gift recorded.";
        items.push(
          feedItem(r.paid_at, "Gift · HKD " + r.amount_hkd, story, "Give")
        );
      });
    }

    if (data.hire_enquiries) {
      data.hire_enquiries.forEach(function (h) {
        items.push(
          feedItem(
            h.created_at,
            "Hire · " + (h.creator_label || "Creator"),
            h.preferred_date
              ? "Requested date: " + escapeHtml(h.preferred_date)
              : escapeHtml(h.status || "received"),
            "Hire"
          )
        );
      });
    }

    if (data.journey_events) {
      data.journey_events.forEach(function (ev) {
        items.push(
          feedItem(
            ev.created_at,
            ev.event_label || ev.event_type,
            escapeHtml(ev.payload || ""),
            "Update"
          )
        );
      });
    }

    items.sort(function (a, b) {
      return b.t - a.t;
    });

    if (!items.length) {
      el.innerHTML =
        '<p class="muted">No activity yet. Use the actions above to get started.</p>';
      return;
    }
    el.innerHTML = items
      .slice(0, 40)
      .map(function (i) {
        return i.html;
      })
      .join("");
  }

  function paint(data) {
    profileData = data;
    const p = data.person;
    const nameEl = document.querySelector("[data-cover-name]");
    const roleEl = document.querySelector("[data-cover-role]");
    const codeEl = document.querySelector("[data-cover-code]");
    if (nameEl) nameEl.textContent = p.name;
    if (roleEl) {
      const roles = personRoles(data);
      const bits = roles.map(function (r) {
        return roleLabel(r, r === "family" || r === "member" ? p.household_role : null);
      });
      roleEl.textContent = bits.join(" · ");
    }
    if (codeEl) codeEl.textContent = p.profile_code || data.profile_code || "";

    if (data.prefs) {
      ["email_on", "sms_on", "whatsapp_on"].forEach(function (key) {
        const btn = document.querySelector('[data-toggle="' + key + '"]');
        if (!btn) return;
        const on = !!data.prefs[key];
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }

    renderActions(data);
    renderRoleToggles(data);
    renderFamily(data);
    renderGiftManage(data);
    renderCalendar(data);
    renderFeed(data);
  }

  async function reloadProfile() {
    const data = await L.api("/api/profile");
    paint(data);
    return data;
  }

  window.reloadProfile = reloadProfile;

  const prefsToggle = document.querySelector("[data-prefs-toggle]");
  if (prefsToggle) {
    prefsToggle.addEventListener("click", function () {
      const drawer = document.querySelector("[data-prefs-drawer]");
      setPrefsOpen(drawer && drawer.hidden);
    });
  }
  const prefsClose = document.querySelector("[data-prefs-close]");
  if (prefsClose) {
    prefsClose.addEventListener("click", function () {
      setPrefsOpen(false);
    });
  }

  const accountSel = document.querySelector("[data-account-select]");
  if (accountSel) {
    accountSel.addEventListener("change", async function () {
      if (!accountSel.value) return;
      try {
        await L.demoLogin(accountSel.value);
        await reloadProfile();
        L.showToast("Switched account");
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
    });
  }

  const addForm = document.querySelector("[data-add-member-form]");
  if (addForm) {
    addForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const name = (addForm.name && addForm.name.value) || "";
      const household_role =
        (addForm.household_role && addForm.household_role.value) || "helper";
      const email = (addForm.email && addForm.email.value) || "";
      try {
        await L.api("/api/family/members", {
          method: "POST",
          body: {
            name: name.trim(),
            household_role: household_role,
            email: email.trim() || null,
            is_child: household_role === "child",
          },
        });
        addForm.reset();
        L.showToast("Family member added. They share the child records.");
        await reloadProfile();
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
    });
  }

  const saveRoles = document.querySelector("[data-save-roles]");
  if (saveRoles) {
    saveRoles.addEventListener("click", async function () {
      const box = document.querySelector("[data-role-toggles]");
      if (!box) return;
      const roles = [];
      box.querySelectorAll('input[type="checkbox"]:checked').forEach(function (input) {
        roles.push(input.value);
      });
      if (!roles.length) {
        L.showToast("Pick at least one role");
        return;
      }
      try {
        await L.api("/api/profile/roles", {
          method: "PATCH",
          body: { roles: roles },
        });
        L.showToast("Roles updated");
        await reloadProfile();
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
    });
  }

  const calPrev = document.querySelector("[data-cal-prev]");
  const calNext = document.querySelector("[data-cal-next]");
  if (calPrev) {
    calPrev.addEventListener("click", function () {
      calCursor.setMonth(calCursor.getMonth() - 1);
      if (profileData) renderCalendar(profileData);
    });
  }
  if (calNext) {
    calNext.addEventListener("click", function () {
      calCursor.setMonth(calCursor.getMonth() + 1);
      if (profileData) renderCalendar(profileData);
    });
  }

  document.addEventListener("click", async function (e) {
    const commitAction = e.target.closest("[data-commitment-action]");
    if (commitAction && document.querySelector("[data-gift-manage]")) {
      e.preventDefault();
      const action = commitAction.getAttribute("data-commitment-action");
      const fundSel = document.querySelector("[data-fund-select]");
      const fund = fundSel ? fundSel.value : "Sports programmes";
      const confirmMsg =
        action === "pause"
          ? "Pause your monthly gift?"
          : action === "renew"
            ? "Renew your monthly gift?"
            : 'Change fund to "' + fund + '"?';
      if (!window.confirm(confirmMsg)) return;
      try {
        await L.requireLogin(async function () {
          const list = await L.api("/api/impact/commitments");
          if (!list.length) {
            L.showToast("No gift yet. Start one from Give");
            return;
          }
          const body =
            action === "pause"
              ? { status: "paused" }
              : action === "renew"
                ? { status: "active" }
                : { fund_category: fund };
          await L.api("/api/impact/commitments/" + list[0].id, {
            method: "PATCH",
            body: body,
          });
          L.showToast("Gift updated");
          await reloadProfile();
        });
      } catch (err) {
        if (!err.cancelled) L.showToast(L.friendlyError(err));
      }
    }
  });

  function showLoggedOutState() {
    const nameEl = document.querySelector("[data-cover-name]");
    if (nameEl) nameEl.textContent = "You're not logged in";
    const accountSel = document.querySelector("[data-account-select]");
    if (accountSel) accountSel.value = "";
    const feed = document.querySelector("[data-activity-feed]");
    if (feed) {
      feed.innerHTML =
        '<p class="muted">Log in to see your classes, giving, and volunteer hours in one place.</p>' +
        '<button type="button" class="btn btn-primary mt-1" data-profile-login-prompt>Log in</button>';
    }
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-profile-login-prompt]")) return;
    L.requireLogin(async function () {
      const data = await reloadProfile();
      if (accountSel && data.person && data.person.email) {
        accountSel.value = data.person.email;
      }
    }).catch(function (err) {
      if (!err.cancelled) L.showToast(L.friendlyError(err));
    });
  });

  (async function init() {
    if (!L.getPerson()) {
      showLoggedOutState();
      return;
    }
    try {
      const data = await reloadProfile();
      if (accountSel && data.person && data.person.email) {
        accountSel.value = data.person.email;
      }
      const flash = sessionStorage.getItem("love21_flash");
      const flashEl = document.querySelector("[data-profile-flash]");
      if (flash && flashEl) {
        flashEl.hidden = false;
        flashEl.textContent = flash;
        sessionStorage.removeItem("love21_flash");
      }
    } catch (err) {
      const feed = document.querySelector("[data-activity-feed]");
      if (feed) {
        feed.innerHTML =
          '<p class="muted">Profile needs the local API. Run the backend, then refresh.</p>';
      }
    }
  })();
})();
