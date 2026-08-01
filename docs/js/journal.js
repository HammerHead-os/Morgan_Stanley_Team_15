/* Love 21 role journal reader, adapted from team15-philip. */

(function () {
  const root = document.querySelector("[data-profile-root]");
  if (!root) return;

  const PASSPORTS = {
    family: {
      label: "Family",
      title: "Our journey together",
      description: "Family activities, programmes, and milestones in one place.",
      code: "L21-F-1001",
      joined: "March 2022",
      summary: [
        ["18", "activities joined"],
        ["4", "programmes explored"],
        ["2", "family members"],
      ],
      details: [
        ["Family member", "Alex Chen"],
        ["Home district", "Kowloon"],
        ["Favourite programme", "Inclusive swimming"],
      ],
      badges: [
        ["10", "Active family", "10 activities joined"],
        ["3", "Programme explorer", "3 programmes completed"],
        ["★", "Milestone maker", "First 50m swim"],
        ["♥", "Community regular", "One year of activities"],
      ],
      activities: [
        ["24 Jul 2026", "Family Summer Sports Day", "Community event", "Attended with Alex · Kowloon Cricket Club", "Attended"],
        ["18 Jun 2026", "Inclusive Swimming", "Weekly class", "Alex completed 50 metres without stopping", "Milestone"],
        ["07 Jun 2026", "Parent Coffee Morning", "Family support", "Peer sharing session · Love 21 Space", "Attended"],
        ["21 May 2026", "Healthy Cooking Together", "Nutrition", "Family workshop · 2 hours", "Completed"],
      ],
    },
    volunteer: {
      label: "Volunteer",
      title: "Time given with purpose",
      description: "Completed shifts, contributed hours, and community skills.",
      code: "L21-V-1001",
      joined: "November 2023",
      summary: [
        ["42", "hours contributed"],
        ["12", "activities joined"],
        ["4", "days volunteered"],
      ],
      details: [
        ["Volunteer since", "November 2023"],
        ["Skills", "Events · Photography"],
        ["Languages", "English · Cantonese"],
      ],
      badges: [
        ["25h", "Helping hands", "25 volunteer hours"],
        ["10", "Reliable teammate", "10 shifts completed"],
        ["4", "Programme supporter", "4 teams supported"],
        ["★", "Skills sharer", "Photography volunteer"],
      ],
      activities: [
        ["12 Jul 2026", "Nutrition Workshop Support", "Event support", "Set-up, registration, and family welcome", "4 hrs"],
        ["28 Jun 2026", "Sunday Football Assistant", "Sports programme", "Warm-up and small-group activity support", "3 hrs"],
        ["14 Jun 2026", "Love 21 Open Day", "Community event", "Visitor guide and activity-station support", "6 hrs"],
        ["31 May 2026", "Family Photography Session", "Skills sharing", "Portrait photography and photo selection", "5 hrs"],
      ],
    },
    donor: {
      label: "Donor",
      title: "A record of your impact",
      description: "Donation history, supported programmes, and giving milestones.",
      code: "L21-D-1001",
      joined: "May 2024",
      summary: [
        ["HKD 6,800", "total donated"],
        ["15", "gifts made"],
        ["3", "giving occasions"],
      ],
      details: [
        ["Supporter since", "May 2024"],
        ["Regular gift", "HKD 500 monthly"],
        ["Primary fund", "Sports programmes"],
      ],
      badges: [
        ["5k", "Impact maker", "HKD 5,000 donated"],
        ["12", "One full year", "12 monthly gifts"],
        ["3", "Broad supporter", "3 programmes funded"],
        ["♥", "Family champion", "Summer appeal supporter"],
      ],
      activities: [
        ["01 Jul 2026", "Monthly programme gift", "Sports programmes", "Receipt L21-0726-184 · Tax deductible", "HKD 500"],
        ["01 Jun 2026", "Monthly programme gift", "Sports programmes", "Receipt L21-0626-151 · Tax deductible", "HKD 500"],
        ["17 May 2026", "Family Summer Programme", "Special appeal", "Receipt L21-0526-098 · Tax deductible", "HKD 1,800"],
        ["01 May 2026", "Monthly programme gift", "Sports programmes", "Receipt L21-0526-012 · Tax deductible", "HKD 500"],
      ],
    },
  };

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
  let activeRole = "family";
  let activeSpread = 0;

  if (!roleButtons.length || !stage || !spread || !prevButton || !nextButton) return;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function holderName() {
    const coverName = document.querySelector("[data-cover-name]");
    const name = coverName ? coverName.textContent.trim() : "";
    return name && name !== "Loading…" && name !== "Profile offline"
      ? name
      : "Jamie Chen";
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
    const badges = data.badges.map(function (badge) {
      return '<article class="book-badge"><span aria-hidden="true">' + escapeHtml(badge[0]) + '</span><div><h4>' + escapeHtml(badge[1]) + '</h4><p>' + escapeHtml(badge[2]) + "</p></div></article>";
    }).join("");

    return (
      '<article class="book-page book-page-left">' +
      pageHeader(data, 1, "Personal profile") +
      '<div class="book-profile"><div class="book-profile-photo">' + escapeHtml(holderInitials()) + '</div><div><p class="book-overline">Journal holder</p><h3>' + escapeHtml(holderName()) + '<\/h3><p>Hong Kong · Member since ' +
      escapeHtml(data.joined) +
      "</p></div></div>" +
      '<div class="book-role-summary">' + stats + "</div>" +
      '<div class="book-profile-details">' + details + "</div>" +
      '<footer class="book-page-footer"><span>Journal no.</span><strong>' +
      escapeHtml(data.code) +
      "</strong></footer></article>" +
      '<article class="book-page book-page-right">' +
      pageHeader(data, 2, "Achievements") +
      '<div class="book-page-title"><p class="book-overline">Collected stamps</p><h3>Your badges</h3><p>Milestones earned through your ' +
      escapeHtml(data.label.toLowerCase()) +
      " journey.</p></div>" +
      '<div class="book-badge-grid">' + badges + "</div>" +
      '<div class="book-stamp-note"><span aria-hidden="true">21</span><p>Every activity adds another mark to your Love 21 story.</p></div>' +
      "</article>"
    );
  }

  function activityCard(activity, index, data) {
    return (
      '<article class="book-activity"><div class="book-activity-date"><span>' +
      escapeHtml(activity[0]) +
      '</span><strong>' +
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

  function activitySpread(data) {
    const left = data.activities.slice(0, 2).map(function (item, index) {
      return activityCard(item, index, data);
    }).join("");
    const right = data.activities.slice(2, 4).map(function (item, index) {
      return activityCard(item, index + 2, data);
    }).join("");
    return (
      '<article class="book-page book-page-left">' +
      pageHeader(data, 3, "Recent activities") +
      '<div class="book-page-title"><p class="book-overline">Recent records</p><h3>Latest entries</h3></div>' +
      '<div class="book-activity-list">' + left + "</div></article>" +
      '<article class="book-page book-page-right">' +
      pageHeader(data, 4, "Recent activities") +
      '<div class="book-page-title"><p class="book-overline">Continued</p><h3>More from your journey</h3></div>' +
      '<div class="book-activity-list">' + right + "</div></article>"
    );
  }

  function renderBook(roleChanged) {
    const data = PASSPORTS[activeRole];
    stage.dataset.role = activeRole;
    spread.classList.remove("role-change");
    if (roleChanged) {
      void spread.offsetWidth;
      spread.classList.add("role-change");
    }
    spread.innerHTML = activeSpread === 0 ? identitySpread(data) : activitySpread(data);

    document.querySelector("[data-book-kicker]").textContent = data.label + " journal";
    document.querySelector("[data-book-title]").textContent = data.title;
    document.querySelector("[data-book-description]").textContent = data.description;
    document.querySelector("[data-page-label]").textContent = activeSpread === 0 ? "Pages 01–02 of 04" : "Pages 03–04 of 04";
    document.querySelector("[data-page-dots]").innerHTML = '<span class="active"></span><span></span>';
    if (activeSpread === 1) {
      const dots = document.querySelectorAll("[data-page-dots] span");
      dots[0].classList.remove("active");
      dots[1].classList.add("active");
    }
    prevButton.disabled = activeSpread === 0;
    nextButton.disabled = activeSpread === 1;
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
    activeRole = PASSPORTS[role] ? role : "family";
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
    if (activeSpread !== 0) turnTo(0, "back");
  });
  nextButton.addEventListener("click", function () {
    if (activeSpread !== 1) turnTo(1, "forward");
  });
  window.addEventListener("hashchange", function () {
    const raw = location.hash.slice(1);
    selectRole(legacyRoles[raw] || raw, false);
  });

  const coverName = document.querySelector("[data-cover-name]");
  if (coverName) {
    new MutationObserver(function () {
      if (activeSpread === 0) renderBook(false);
    }).observe(coverName, { childList: true, characterData: true, subtree: true });
  }

  const initial = location.hash.slice(1);
  selectRole(legacyRoles[initial] || initial || "family", false);
})();
