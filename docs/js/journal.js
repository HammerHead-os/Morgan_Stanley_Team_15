/* Love 21 role passport reader - populated from GET /api/profile. */

(function (global) {
  const root = document.querySelector("[data-profile-root]");
  if (!root) return;

  const legacyRoles = {
    ability: "family",
    contribution: "volunteer",
    impact: "donor",
    overview: "family",
  };
  const roleButtons = Array.from(document.querySelectorAll("[data-role-passport]"));
  const stage = document.querySelector("[data-book-stage]");
  const spread = document.querySelector("[data-book-spread]");
  const prevButton = document.querySelector("[data-page-prev]");
  const nextButton = document.querySelector("[data-page-next]");
  let profileData = null;
  let passports = buildPassports(null);
  let activeRole = "family";
  let activeSpread = 0;

  if (!roleButtons.length || !stage || !spread || !prevButton || !nextButton) return;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function formatDate(value) {
    if (!value) return "Date not set";
    const raw = String(value);
    const parsed = new Date(raw.length === 10 ? raw + "T12:00:00" : raw);
    if (isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatMonth(value) {
    if (!value) return "Not recorded";
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) return "Not recorded";
    return parsed.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-HK", { maximumFractionDigits: 1 }).format(
      Number(value || 0)
    );
  }

  function joinWords(value) {
    if (!value) return "Not added yet";
    return String(value)
      .split(",")
      .map(function (part) { return part.trim(); })
      .filter(Boolean)
      .join(" · ");
  }

  function sortNewest(items, dateAt) {
    return items.slice().sort(function (a, b) {
      return String(dateAt(b) || "").localeCompare(String(dateAt(a) || ""));
    });
  }

  function badgeRows(items) {
    return (items || []).map(function (badge) {
      return [badge.icon || "★", badge.title, badge.description];
    });
  }

  function emptyPassport(role, label, title, description) {
    return {
      role: role,
      label: label,
      title: title,
      description: description,
      code: "-",
      joined: "Not recorded",
      summary: [["0", "records"]],
      details: [["Status", profileData ? "No data yet" : "Sign in to view"]],
      badges: [],
      activities: [],
      emptyMessage: profileData ? "No records yet." : "Sign in to see this passport.",
    };
  }

  function familyPassport(data) {
    const family = data.family;
    const metrics = (family && family.metrics) || {};
    const childNames = metrics.child_names || [];
    const childIds = new Set(
      ((family && family.members) || [])
        .filter(function (member) {
          return member.household_role === "child" || member.role_primary === "member";
        })
        .map(function (member) { return member.id; })
    );
    const registrations = ((family && family.registrations) || []).filter(function (item) {
      return childIds.has(item.member_person_id) &&
        (item.status === "registered" || item.status === "attended");
    });
    const activities = sortNewest(registrations, function (item) {
      return item.session_date || item.created_at;
    }).map(function (item) {
      const detail = [item.member_name, item.activity_location]
        .filter(Boolean)
        .join(" · ");
      return [
        formatDate(item.session_date || item.created_at),
        item.activity_title || "Love 21 activity",
        item.activity_goal || "Programme",
        detail || "Household activity",
        item.status_label || item.status,
      ];
    });

    return {
      role: "family",
      label: "Family",
      title: "Our journey together",
      description: "Family activities, programmes, and milestones in one place.",
      code: data.person.profile_code,
      joined: formatMonth(data.person.issued_at),
      summary: [
        [metrics.activities_joined || 0, "activities joined"],
        [metrics.programmes_explored || 0, "programmes explored"],
        [childNames.length, childNames.length === 1 ? "child member" : "child members"],
      ],
      details: [
        ["Family member", childNames.length ? childNames.join(", ") : "No child members yet"],
        ["Home district", "Hong Kong"],
        ["Favourite programme", metrics.favourite_programme || "Not enough activity yet"],
      ],
      badges: badgeRows(metrics.badges),
      activities: activities,
      emptyMessage: "No confirmed or attended child activities yet.",
    };
  }

  function volunteerPassport(data) {
    const volunteer = data.volunteer || {};
    const profile = volunteer.profile || {};
    const metrics = volunteer.metrics || {};
    const claims = (volunteer.claims || []).filter(function (item) {
      return item.status !== "cancelled";
    });
    const activities = sortNewest(claims, function (item) {
      return item.completed_at || item.scheduled_date || item.claimed_at;
    }).map(function (item) {
      const where = item.remote || !item.scheduled_date ? "Remote · async" : "In person";
      const detail = [where, item.duration_min ? item.duration_min + " min" : "", item.reflection]
        .filter(Boolean)
        .join(" · ");
      return [
        formatDate(item.completed_at || item.scheduled_date || item.claimed_at),
        item.shift_title || "Volunteer task",
        item.remote ? "Remote task" : "Volunteer shift",
        detail,
        item.status_label || item.status,
      ];
    });
    const hours = Number(profile.hours_logged || 0);

    return {
      role: "volunteer",
      label: "Volunteer",
      title: "Time given with purpose",
      description: "Completed shifts, contributed hours, and community skills.",
      code: data.person.profile_code,
      joined: formatMonth(data.person.issued_at),
      summary: [
        [formatNumber(hours), "hours contributed"],
        [metrics.completed_shifts || 0, "shifts completed"],
        [metrics.days_volunteered || 0, "days volunteered"],
      ],
      details: [
        ["Volunteer since", formatMonth(data.person.issued_at)],
        ["Skills", joinWords(profile.skills)],
        ["Languages", joinWords(profile.languages)],
      ],
      badges: badgeRows(metrics.badges),
      activities: activities,
      emptyMessage: "No volunteer shifts or tasks yet.",
    };
  }

  function donorPassport(data) {
    const impact = data.impact || {};
    const metrics = impact.metrics || {};
    const commitments = impact.commitments || [];
    const commitmentById = {};
    commitments.forEach(function (item) { commitmentById[item.id] = item; });
    const active = commitments
      .filter(function (item) { return item.status === "active"; })
      .sort(function (a, b) { return String(b.updated_at).localeCompare(String(a.updated_at)); })[0];
    const receipts = impact.receipts || [];
    const activities = sortNewest(receipts, function (item) { return item.paid_at; })
      .map(function (item) {
        const commitment = commitmentById[item.commitment_id] || {};
        return [
          formatDate(item.paid_at),
          "Gift · HKD " + formatNumber(item.amount_hkd),
          commitment.fund_category || metrics.primary_fund || "Love 21 programmes",
          item.story_back || "Donation recorded",
          "Paid",
        ];
      });

    return {
      role: "donor",
      label: "Donor",
      title: "A record of your impact",
      description: "Donation history, supported programmes, and giving milestones.",
      code: data.person.profile_code,
      joined: formatMonth(data.person.issued_at),
      summary: [
        ["HKD " + formatNumber(metrics.total_donated), "total donated"],
        [metrics.gift_count || 0, "gifts made"],
        [metrics.giving_occasions || 0, "giving occasions"],
      ],
      details: [
        ["Supporter since", formatMonth(data.person.issued_at)],
        [
          "Regular gift",
          active
            ? "HKD " + formatNumber(active.amount_hkd) + " " + active.cadence
            : "No active regular gift",
        ],
        ["Primary fund", metrics.primary_fund || "Not recorded"],
      ],
      badges: badgeRows(metrics.badges),
      activities: activities,
      emptyMessage: "No paid gifts recorded yet.",
    };
  }

  function buildPassports(data) {
    if (!data || !data.person) {
      return {
        family: emptyPassport("family", "Family", "Our journey together", "Family activities, programmes, and milestones in one place."),
        volunteer: emptyPassport("volunteer", "Volunteer", "Time given with purpose", "Completed shifts, contributed hours, and community skills."),
        donor: emptyPassport("donor", "Donor", "A record of your impact", "Donation history, supported programmes, and giving milestones."),
      };
    }
    return {
      family: familyPassport(data),
      volunteer: volunteerPassport(data),
      donor: donorPassport(data),
    };
  }

  function holderName() {
    return profileData && profileData.person ? profileData.person.name : "Profile holder";
  }

  function holderInitials() {
    return holderName()
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0); })
      .join("")
      .toUpperCase();
  }

  function pageHeader(data, pageNumber, section) {
    return (
      '<header class="book-page-header"><span>' +
      escapeHtml(data.label) +
      " journal</span><strong>" +
      escapeHtml(section) +
      '</strong><span class="book-page-number">' +
      String(pageNumber).padStart(2, "0") +
      "</span></header>"
    );
  }

  function identitySpread(data) {
    const stats = data.summary.map(function (item) {
      return '<div><strong>' + escapeHtml(item[0]) + '</strong><span>' + escapeHtml(item[1]) + "</span></div>";
    }).join("");
    const details = data.details.map(function (item) {
      return '<div><span>' + escapeHtml(item[0]) + '</span><strong>' + escapeHtml(item[1]) + "</strong></div>";
    }).join("");
    const badges = data.badges.length
      ? data.badges.map(function (badge) {
          return '<article class="book-badge"><span aria-hidden="true">' + escapeHtml(badge[0]) + '</span><div><h4>' + escapeHtml(badge[1]) + '</h4><p>' + escapeHtml(badge[2]) + "</p></div></article>";
        }).join("")
      : '<p class="muted">Keep taking part to earn your first badge.</p>';

    return (
      '<article class="book-page book-page-left">' +
      pageHeader(data, 1, "Personal profile") +
      '<div class="book-profile"><div class="book-profile-photo">' + escapeHtml(holderInitials()) + '</div><div><p class="book-overline">Journal holder</p><h3>' + escapeHtml(holderName()) + '</h3><p>Hong Kong · Member since ' +
      escapeHtml(data.joined) +
      "</p></div></div>" +
      '<div class="book-role-summary">' + stats + "</div>" +
      '<div class="book-profile-details">' + details + "</div>" +
      '<footer class="book-page-footer"><span>Journal no.</span><strong>' +
      escapeHtml(data.code) +
      "</strong></footer></article>" +
      '<article class="book-page book-page-right">' +
      pageHeader(data, 2, "Achievements") +
      '<div class="book-page-title"><p class="book-overline">Collected stamps</p><h3>Your badges</h3><p>Badges are earned automatically from your real activity.</p></div>' +
      '<div class="book-badge-grid">' + badges + "</div>" +
      '<div class="book-stamp-note"><span aria-hidden="true">21</span><p>Every activity adds another mark to your Love 21 story.</p></div>' +
      "</article>"
    );
  }

  function activityCard(activity, index, data) {
    return (
      '<article class="book-activity"><div class="book-activity-date"><span>' +
      escapeHtml(activity[0]) +
      "</span><strong>" +
      String(index + 1).padStart(2, "0") +
      '</strong></div><div class="book-activity-copy"><p class="book-overline">' +
      escapeHtml(activity[2]) +
      "</p><h4>" +
      escapeHtml(activity[1]) +
      "</h4><p>" +
      escapeHtml(activity[3]) +
      '</p><span class="book-activity-result">' +
      escapeHtml(activity[4]) +
      '</span></div><div class="book-record-stamp" aria-hidden="true">' +
      escapeHtml(data.label.slice(0, 1)) +
      "<small>21</small></div></article>"
    );
  }

  function activitySpread(data, activitySpreadIndex) {
    const start = activitySpreadIndex * 4;
    const activities = data.activities.slice(start, start + 4);
    const left = activities.slice(0, 2).map(function (item, index) {
      return activityCard(item, start + index, data);
    }).join("");
    const right = activities.slice(2, 4).map(function (item, index) {
      return activityCard(item, start + index + 2, data);
    }).join("");
    const empty = activities.length
      ? ""
      : '<p class="muted">' + escapeHtml(data.emptyMessage) + "</p>";
    const leftPage = activitySpreadIndex * 2 + 3;
    return (
      '<article class="book-page book-page-left">' +
      pageHeader(data, leftPage, "Recent activities") +
      '<div class="book-page-title"><p class="book-overline">Recent records</p><h3>Latest entries</h3></div>' +
      '<div class="book-activity-list">' + (left || empty) + "</div></article>" +
      '<article class="book-page book-page-right">' +
      pageHeader(data, leftPage + 1, "Recent activities") +
      '<div class="book-page-title"><p class="book-overline">Continued</p><h3>More from your journey</h3></div>' +
      '<div class="book-activity-list">' + right + "</div></article>"
    );
  }

  function spreadCount(data) {
    return 1 + Math.max(1, Math.ceil(data.activities.length / 4));
  }

  function renderSelectorSummaries() {
    const values = {
      family: passports.family.summary[0][0] + " activities joined",
      volunteer: passports.volunteer.summary[0][0] + " hours given",
      donor: passports.donor.summary[0][0] + " donated",
    };
    roleButtons.forEach(function (button) {
      const small = button.querySelector("small");
      if (small) small.textContent = values[button.dataset.rolePassport] || "No data";
    });
  }

  function renderBook(roleChanged) {
    const data = passports[activeRole];
    const totalSpreads = spreadCount(data);
    if (activeSpread >= totalSpreads) activeSpread = totalSpreads - 1;
    stage.dataset.role = activeRole;
    spread.classList.remove("role-change");
    if (roleChanged) {
      void spread.offsetWidth;
      spread.classList.add("role-change");
    }
    spread.innerHTML = activeSpread === 0
      ? identitySpread(data)
      : activitySpread(data, activeSpread - 1);

    document.querySelector("[data-book-kicker]").textContent = data.label + " journal";
    document.querySelector("[data-book-title]").textContent = data.title;
    document.querySelector("[data-book-description]").textContent = data.description;
    const totalPages = totalSpreads * 2;
    const firstPage = activeSpread * 2 + 1;
    document.querySelector("[data-page-label]").textContent =
      "Pages " + String(firstPage).padStart(2, "0") + "–" +
      String(firstPage + 1).padStart(2, "0") + " of " +
      String(totalPages).padStart(2, "0");
    document.querySelector("[data-page-dots]").innerHTML = Array.from(
      { length: totalSpreads },
      function (_, index) { return '<span' + (index === activeSpread ? ' class="active"' : "") + "></span>"; }
    ).join("");
    prevButton.disabled = activeSpread === 0;
    nextButton.disabled = activeSpread === totalSpreads - 1;
  }

  function turnTo(targetSpread, direction) {
    if (stage.classList.contains("is-turning") || targetSpread === activeSpread) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      activeSpread = targetSpread;
      renderBook(false);
      return;
    }

    stage.classList.add("is-turning");
    const leaf = document.createElement("div");
    leaf.className = "passport-turning-leaf " + direction;
    leaf.setAttribute("aria-hidden", "true");
    stage.appendChild(leaf);
    requestAnimationFrame(function () { leaf.classList.add("is-turning"); });

    const mobile = window.matchMedia("(max-width: 860px)").matches;
    window.setTimeout(function () {
      activeSpread = targetSpread;
      renderBook(false);
    }, mobile ? 120 : 310);
    window.setTimeout(function () {
      leaf.remove();
      stage.classList.remove("is-turning");
    }, mobile ? 260 : 640);
  }

  function selectRole(role, updateHash) {
    activeRole = passports[role] ? role : "family";
    activeSpread = 0;
    roleButtons.forEach(function (button) {
      const selected = button.dataset.rolePassport === activeRole;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
      button.tabIndex = selected ? 0 : -1;
    });
    renderBook(true);
    if (updateHash) history.replaceState(null, "", "#" + activeRole);
  }

  function update(data) {
    profileData = data && data.person ? data : null;
    passports = buildPassports(profileData);
    renderSelectorSummaries();
    renderBook(false);
  }

  roleButtons.forEach(function (button, index) {
    button.addEventListener("click", function () {
      selectRole(button.dataset.rolePassport, true);
    });
    button.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = (index + direction + roleButtons.length) % roleButtons.length;
      roleButtons[next].focus();
      selectRole(roleButtons[next].dataset.rolePassport, true);
    });
  });

  prevButton.addEventListener("click", function () {
    if (activeSpread > 0) turnTo(activeSpread - 1, "back");
  });
  nextButton.addEventListener("click", function () {
    const total = spreadCount(passports[activeRole]);
    if (activeSpread < total - 1) turnTo(activeSpread + 1, "forward");
  });
  global.addEventListener("hashchange", function () {
    const raw = location.hash.slice(1);
    selectRole(legacyRoles[raw] || raw, false);
  });

  global.Love21Passports = { update: update };
  const initial = location.hash.slice(1);
  selectRole(legacyRoles[initial] || initial || "family", false);
})(window);
