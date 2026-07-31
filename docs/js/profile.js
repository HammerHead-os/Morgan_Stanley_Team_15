/* Love 21 Profile */

(function () {
  const L = window.Love21;
  if (!L || !document.querySelector("[data-profile-root]")) return;

  const TAB_META = {
    ability: { label: "Ability", chapter: "01" },
    contribution: { label: "Contribution", chapter: "02" },
    impact: { label: "Impact", chapter: "03" },
  };

  const ROLE_HOME = {
    family: "ability",
    member: "ability",
    donor: "impact",
    volunteer: "contribution",
  };

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

  function roleLabel(role) {
    return (
      {
        family: "Family carer",
        member: "Member",
        donor: "Supporter",
        volunteer: "Volunteer",
      }[role] || role
    );
  }

  function ownsChapter(role, id) {
    if (id === "ability") return role === "family" || role === "member";
    if (id === "contribution") return role === "volunteer";
    if (id === "impact") return role === "donor";
    return false;
  }

  function setPrefsOpen(open) {
    const drawer = document.querySelector("[data-prefs-drawer]");
    const btn = document.querySelector("[data-prefs-toggle]");
    if (!drawer) return;
    drawer.hidden = !open;
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function activateTab(id) {
    const tabs = document.querySelectorAll("[data-profile-tab]");
    const panels = document.querySelectorAll("[data-profile-panel]");
    let found = false;
    tabs.forEach(function (t) {
      const on = t.getAttribute("data-profile-tab") === id;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      if (on) found = true;
    });
    panels.forEach(function (p) {
      const on = p.getAttribute("data-profile-panel") === id;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    if (found) history.replaceState(null, "", "#" + id);
  }

  function buildTabs(visible, homeTab) {
    const list = document.querySelector("[data-tablist]");
    if (!list) return;
    list.innerHTML = visible
      .map(function (id) {
        const meta = TAB_META[id] || { label: id };
        return (
          '<button type="button" class="profile-tab" role="tab" data-profile-tab="' +
          id +
          '" aria-selected="false" aria-controls="panel-' +
          id +
          '">' +
          escapeHtml(meta.label) +
          "</button>"
        );
      })
      .join("");

    list.querySelectorAll("[data-profile-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateTab(tab.getAttribute("data-profile-tab"));
      });
    });

    const hash = (location.hash || "").replace("#", "");
    const legacy = {
      family: "ability",
      achievement: "ability",
      volunteer: "contribution",
      settings: homeTab || "ability",
    };
    const mapped = legacy[hash] || hash;
    const start =
      mapped && visible.indexOf(mapped) >= 0
        ? mapped
        : homeTab && visible.indexOf(homeTab) >= 0
          ? homeTab
          : visible[0];
    activateTab(start);
  }

  function renderCover(data) {
    const p = data.person;
    const nameEl = document.querySelector("[data-cover-name]");
    const codeEl = document.querySelector("[data-cover-code]");
    const roleEl = document.querySelector("[data-cover-role]");
    if (nameEl) nameEl.textContent = p.name;
    if (roleEl) roleEl.textContent = roleLabel(p.role_primary);
    if (codeEl)
      codeEl.textContent =
        p.passport_code || p.profile_code || "L21-" + p.id;
  }

  function emptyChapter(title, body, ctaHref, ctaLabel) {
    return (
      '<div class="chapter-empty">' +
      "<h3>" +
      escapeHtml(title) +
      "</h3>" +
      '<p class="muted">' +
      escapeHtml(body) +
      "</p>" +
      (ctaHref
        ? '<a class="btn btn-sm btn-primary mt-1" href="' +
          ctaHref +
          '">' +
          escapeHtml(ctaLabel || "Continue") +
          "</a>"
        : "") +
      "</div>"
    );
  }

  function renderFamily(data) {
    const el = document.querySelector("[data-family-panel]");
    if (!el) return;
    const role = data.person.role_primary;
    if (!ownsChapter(role, "ability") || !data.family) {
      el.innerHTML = emptyChapter(
        "Ability",
        "Class bookings and notes show up here. Switch to a family demo account, or browse classes to start.",
        "activity-finder.html",
        "Browse classes"
      );
      return;
    }
    const f = data.family;
    const regs = (f.registrations || [])
      .map(function (r) {
        const pendingFeedback = r.status === "attended" && !r.feedback;
        return (
          '<div class="timeline-item' +
          (pendingFeedback ? " pending" : "") +
          '">' +
          '<div class="timeline-date">' +
          escapeHtml(r.status_label || r.status) +
          "</div>" +
          '<div class="timeline-title">' +
          escapeHtml(r.activity_title || "Activity") +
          " · " +
          escapeHtml(r.member_name || "") +
          "</div>" +
          (r.activity_location
            ? '<p class="muted" style="margin:0;font-size:0.85rem">' +
              escapeHtml(r.activity_location) +
              "</p>"
            : "") +
          (pendingFeedback
            ? '<form class="feedback-form mt-1" data-feedback-form="' +
              r.id +
              '">' +
              '<textarea name="feedback" rows="2" required maxlength="2000" placeholder="How was the session?"></textarea>' +
              '<button type="submit" class="btn btn-sm btn-primary mt-1">Save feedback</button></form>'
            : r.feedback
              ? '<p class="muted" style="margin:0.35rem 0 0;font-size:0.9rem">' +
                escapeHtml(r.feedback) +
                "</p>"
              : "") +
          "</div>"
        );
      })
      .join("");

    el.innerHTML =
      "<h3>Classes · " +
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
      (regs || '<p class="muted">No bookings yet.</p>') +
      "</div>";
  }

  function renderAchievement(data) {
    const el = document.querySelector("[data-achievement-panel]");
    if (!el) return;
    const role = data.person.role_primary;
    if (!ownsChapter(role, "ability") || !data.achievement) {
      el.innerHTML = "";
      return;
    }
    const a = data.achievement;
    const stamps = (a.achievements || [])
      .map(function (x) {
        return (
          '<div class="stamp-card' +
          (x.share_consent ? " shared" : "") +
          '">' +
          '<div class="stamp-seal" aria-hidden="true">' +
          escapeHtml((x.pillar || "L21").slice(0, 4)) +
          "</div>" +
          "<div>" +
          '<div class="timeline-date">' +
          escapeHtml(x.status_label || x.status) +
          "</div>" +
          '<div class="timeline-title">' +
          escapeHtml(x.title) +
          "</div>" +
          '<p class="muted" style="margin:0.25rem 0 0;font-size:0.85rem">' +
          escapeHtml(x.coach_name || "Coach") +
          (x.approved_at ? " · " + fmtDate(x.approved_at) : "") +
          "</p>" +
          '<label class="consent-row">' +
          '<input type="checkbox" data-consent="' +
          x.id +
          '"' +
          (x.share_consent ? " checked" : "") +
          " /> Share this milestone</label>" +
          "</div></div>"
        );
      })
      .join("");

    const goals = (a.goals || [])
      .map(function (g) {
        return (
          '<div class="timeline-item pending">' +
          '<div class="timeline-date">' +
          escapeHtml(g.status_label || g.status) +
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
      " · milestones</h3>" +
      '<div class="stamp-grid">' +
      (stamps || '<p class="muted">No milestones yet. Set a goal.</p>') +
      "</div>" +
      (goals
        ? '<h3 class="mt-2">Goals</h3><div class="timeline">' + goals + "</div>"
        : "");
  }

  function renderImpact(data) {
    const el = document.querySelector("[data-impact-panel]");
    const manage = document.querySelector("[data-gift-manage]");
    if (!el) return;
    const role = data.person.role_primary;
    const impact = data.impact || {};
    const c = (impact.commitments || [])[0];
    const receipt = (impact.receipts || [])[0];
    const badges = impact.badges || [];

    if (!ownsChapter(role, "impact") && !c) {
      el.innerHTML = emptyChapter(
        "Impact",
        "Gifts and receipts show up here. Switch to the supporter demo, or start a gift from Give.",
        "impact.html",
        "See what HKD 300 covers"
      );
      if (manage) manage.hidden = true;
      const hireEl = document.querySelector("[data-hire-panel]");
      if (hireEl) hireEl.innerHTML = "";
      return;
    }

    if (manage) manage.hidden = false;

    if (!c) {
      el.innerHTML =
        '<p class="muted">No monthly gift yet.</p>' +
        '<a class="btn btn-sm btn-primary" href="impact.html">Start giving</a>';
    } else {
      el.innerHTML =
        '<div class="impact-tile" style="border:none;padding:0">' +
        "<h3>Monthly · HKD " +
        c.amount_hkd +
        " · " +
        escapeHtml(c.status_label || c.status) +
        "</h3>" +
        '<p class="muted" style="font-size:0.88rem;margin:0">Fund: ' +
        escapeHtml(c.fund_category) +
        "</p>" +
        '<div class="meter" style="--pct:74.6%"><div class="meter-fill"></div></div>' +
        '<p class="muted" style="font-size:0.8rem;margin:0">74.6% of gifts go to programmes</p>' +
        (c.office_perk_unlocked
          ? '<p class="badge-stamp mt-1">Office workshop perk available</p>'
          : "") +
        (receipt && receipt.story_back
          ? '<p class="mt-1" style="font-size:0.9rem">' +
            escapeHtml(receipt.story_back) +
            "</p>"
          : "") +
        (badges.length
          ? '<div class="badge-row mt-1">' +
            badges
              .map(function (b) {
                return (
                  '<span class="badge-stamp">' +
                  escapeHtml(b.title) +
                  " · " +
                  escapeHtml(b.level) +
                  "</span>"
                );
              })
              .join("") +
            "</div>"
          : "") +
        "</div>";

      const fundSel = document.querySelector("[data-fund-select]");
      if (fundSel && c.fund_category) fundSel.value = c.fund_category;
    }

    const hireEl = document.querySelector("[data-hire-panel]");
    if (hireEl) {
      const hires = data.hire_enquiries || [];
      if (!hires.length) {
        hireEl.innerHTML = "";
      } else {
        hireEl.innerHTML =
          "<h3>Hire enquiries</h3>" +
          '<div class="timeline">' +
          hires
            .map(function (h) {
              return (
                '<div class="timeline-item">' +
                '<div class="timeline-date">' +
                escapeHtml(h.status) +
                "</div>" +
                '<div class="timeline-title">' +
                escapeHtml(h.creator_label) +
                "</div>" +
                '<p class="muted" style="margin:0;font-size:0.85rem">' +
                fmtDate(h.created_at) +
                "</p></div>"
              );
            })
            .join("") +
          "</div>";
      }
    }
  }

  function renderVolunteer(data) {
    const el = document.querySelector("[data-volunteer-panel]");
    const hoursEl = document.querySelector("[data-volunteer-hours]");
    if (!el) return;
    const role = data.person.role_primary;
    const v = data.volunteer || {};
    const claims = v.claims || [];

    if (!ownsChapter(role, "contribution") && !claims.length) {
      if (hoursEl) hoursEl.textContent = "0";
      el.innerHTML = emptyChapter(
        "Contribution",
        "Shifts and hours show up here. Switch to the volunteer demo, or claim a short task.",
        "volunteer.html",
        "See open shifts"
      );
      return;
    }

    if (hoursEl && v.profile) {
      hoursEl.textContent = String(v.profile.hours_logged || 0);
    } else if (hoursEl) {
      hoursEl.textContent = "0";
    }

    const claimHtml = claims
      .map(function (c) {
        const open = c.status === "claimed";
        return (
          '<div class="timeline-item' +
          (open ? " pending" : "") +
          '">' +
          '<div class="timeline-date">' +
          escapeHtml(c.status_label || c.status) +
          "</div>" +
          '<div class="timeline-title">' +
          escapeHtml(c.shift_title || "Shift") +
          "</div>" +
          '<p class="muted" style="margin:0;font-size:0.9rem">' +
          c.hours +
          " hrs" +
          (c.reflection ? " · " + escapeHtml(c.reflection) : "") +
          "</p>" +
          (open
            ? '<form class="feedback-form mt-1" data-complete-claim="' +
              c.id +
              '">' +
              '<textarea name="reflection" rows="2" required placeholder="Quick reflection…"></textarea>' +
              '<button type="submit" class="btn btn-sm btn-primary mt-1">Mark complete</button></form>'
            : "") +
          "</div>"
        );
      })
      .join("");

    let next = "";
    if (v.suggested_next && ownsChapter(role, "contribution")) {
      next =
        '<div class="timeline-item pending">' +
        '<div class="timeline-date">Suggested for you</div>' +
        '<div class="timeline-title">' +
        escapeHtml(v.suggested_next.title) +
        "</div>" +
        '<p class="muted" style="margin:0;font-size:0.85rem">' +
        escapeHtml(v.suggested_next.description || "") +
        "</p>" +
        '<button type="button" class="btn btn-sm btn-primary mt-1" data-claim-shift="' +
        v.suggested_next.id +
        '">Claim this shift</button></div>';
    }
    el.innerHTML =
      '<div class="timeline">' +
      (claimHtml || next
        ? claimHtml + next
        : '<p class="muted">No shifts yet. Claim one from Volunteer.</p>') +
      "</div>";
  }

  function renderPrefs(prefs) {
    if (!prefs) return;
    document.querySelectorAll("[data-toggle]").forEach(function (btn) {
      const key = btn.getAttribute("data-toggle");
      const on = !!prefs[key];
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const opt = document.querySelector("[data-opt-out]");
    if (opt && prefs.opt_out_token) {
      opt.textContent =
        "One-click opt-out token (demo): " + prefs.opt_out_token.slice(0, 8) + "…";
    }
  }

  function renderJourney(data) {
    const el = document.querySelector("[data-journey-panel]");
    if (!el) return;
    const events = data.journey_events || [];
    if (!events.length) {
      el.innerHTML =
        "<h3>Recent activity</h3><p class=\"muted\">Your recent activity shows up here.</p>";
      return;
    }
    el.innerHTML =
      "<h3>Recent activity</h3>" +
      '<div class="timeline">' +
      events
        .map(function (ev) {
          return (
            '<div class="timeline-item">' +
            '<div class="timeline-date">' +
            fmtDate(ev.created_at) +
            "</div>" +
            '<div class="timeline-title">' +
            escapeHtml(ev.event_label || ev.event_type) +
            "</div>" +
            (ev.payload
              ? '<p class="muted" style="margin:0;font-size:0.85rem">' +
                escapeHtml(ev.payload) +
                "</p>"
              : "") +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  }

  async function reloadProfile() {
    try {
      if (!L.getPerson() || !L.getToken()) {
        await L.ensureLogin("carer@chen.demo");
      }
      const data = await L.api("/api/profile");
      profileData = data;
      renderCover(data);
      const home =
        data.home_tab ||
        ROLE_HOME[data.person.role_primary] ||
        "ability";
      buildTabs(data.visible_tabs || ["ability", "contribution", "impact"], home);
      renderFamily(data);
      renderAchievement(data);
      renderImpact(data);
      renderVolunteer(data);
      renderPrefs(data.prefs);
      renderJourney(data);

      const select = document.querySelector("[data-account-select]");
      if (select && data.person && data.person.email) {
        select.value = data.person.email;
      }

      const slot = document.querySelector("[data-session]");
      if (slot) {
        slot.textContent = data.person.name;
        slot.title = data.person.email;
      }
    } catch (err) {
      const cover = document.querySelector("[data-cover-name]");
      if (cover) cover.textContent = "Profile offline";
      L.showToast(L.friendlyError(err));
    }
  }

  window.reloadProfile = reloadProfile;

  try {
    const flash = sessionStorage.getItem("love21_flash");
    if (flash) {
      sessionStorage.removeItem("love21_flash");
      const el = document.querySelector("[data-profile-flash]");
      if (el) {
        el.hidden = false;
        el.textContent = flash;
        setTimeout(function () {
          el.hidden = true;
        }, 5000);
      }
      L.showToast(flash);
    }
  } catch (e) {}

  const prefsToggle = document.querySelector("[data-prefs-toggle]");
  if (prefsToggle) {
    prefsToggle.addEventListener("click", function () {
      const drawer = document.querySelector("[data-prefs-drawer]");
      setPrefsOpen(drawer && drawer.hidden);
    });
  }
  document.querySelectorAll("[data-prefs-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPrefsOpen(false);
    });
  });

  const select = document.querySelector("[data-account-select]");
  if (select) {
    select.addEventListener("change", async function () {
      try {
        await L.demoLogin(select.value);
        setPrefsOpen(false);
        await reloadProfile();
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
    });
  }

  const goalForm = document.querySelector("[data-goal-form]");
  if (goalForm) {
    goalForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const title = (goalForm.title && goalForm.title.value) || "";
      if (!title.trim()) return;
      try {
        const memberId =
          (profileData &&
            profileData.achievement &&
            profileData.achievement.member.id) ||
          L.getPerson().id;
        await L.api("/api/achievements/goals", {
          method: "POST",
          body: { title: title.trim(), member_person_id: memberId },
        });
        goalForm.reset();
        L.showToast("Goal saved. A coach will review it next.");
        await reloadProfile();
        activateTab("ability");
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
    });
  }

  document.addEventListener("submit", async function (e) {
    const fb = e.target.closest("[data-feedback-form]");
    if (fb && L) {
      e.preventDefault();
      const regId = Number(fb.getAttribute("data-feedback-form"));
      const text = (fb.feedback && fb.feedback.value) || "";
      try {
        await L.api("/api/family/registrations/" + regId + "/feedback", {
          method: "POST",
          body: { feedback: text.trim() },
        });
        L.showToast("Feedback saved");
        await reloadProfile();
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

    const complete = e.target.closest("[data-complete-claim]");
    if (complete && L) {
      e.preventDefault();
      const claimId = Number(complete.getAttribute("data-complete-claim"));
      const reflection =
        (complete.reflection && complete.reflection.value) || "";
      try {
        await L.api("/api/volunteers/claims/" + claimId + "/complete", {
          method: "POST",
          body: { reflection: reflection.trim() },
        });
        L.showToast("Shift complete. Hours logged.");
        await reloadProfile();
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
    }
  });

  document.addEventListener("change", async function (e) {
    const consent = e.target.closest("[data-consent]");
    if (!consent || !L) return;
    const id = Number(consent.getAttribute("data-consent"));
    try {
      await L.api("/api/achievements/" + id + "/consent", {
        method: "PATCH",
        body: { share_consent: !!consent.checked },
      });
      L.showToast(consent.checked ? "Sharing on" : "Sharing off");
      await reloadProfile();
    } catch (err) {
      consent.checked = !consent.checked;
      L.showToast(L.friendlyError(err));
    }
  });

  document.addEventListener("click", async function (e) {
    const claimBtn = e.target.closest("[data-claim-shift]");
    if (claimBtn && L && document.querySelector("[data-profile-root]")) {
      e.preventDefault();
      e.stopPropagation();
      const shiftId = Number(claimBtn.getAttribute("data-claim-shift"));
      try {
        await L.api("/api/volunteers/claims", {
          method: "POST",
          body: { shift_id: shiftId },
        });
        L.showToast("Shift claimed");
        await reloadProfile();
        activateTab("contribution");
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
      return;
    }

    const commitAction = e.target.closest("[data-commitment-action]");
    if (commitAction && document.querySelector("[data-gift-manage]")) {
      e.preventDefault();
      e.stopPropagation();
      const action = commitAction.getAttribute("data-commitment-action");
      const fundSel = document.querySelector("[data-fund-select]");
      const fund = fundSel ? fundSel.value : "Sports programmes";
      const confirmMsg =
        action === "pause"
          ? "Pause your monthly gift?"
          : action === "renew"
            ? "Renew / reactivate your monthly gift?"
            : "Change fund to “" + fund + "”?";
      if (!window.confirm(confirmMsg)) return;
      try {
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
        L.showToast(
          action === "pause"
            ? "Gift paused"
            : action === "renew"
              ? "Gift active again"
              : "Fund updated"
        );
        await reloadProfile();
      } catch (err) {
        L.showToast(L.friendlyError(err));
      }
    }
  });

  reloadProfile();
})();
