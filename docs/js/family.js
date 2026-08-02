/* Family hub — swap the illustrative example for the real household once someone is logged in */

(function () {
  const L = window.Love21;
  if (!L) return;

  const eyebrowEl = document.querySelector("[data-family-eyebrow]");
  const leadEl = document.querySelector("[data-family-lead]");
  const loginCta = document.querySelector("[data-family-login-cta]");
  const waitlistTag = document.querySelector("[data-family-waitlist-tag]");
  const waitlistList = document.querySelector("[data-family-waitlist-list]");
  const membersTag = document.querySelector("[data-family-members-tag]");
  const membersList = document.querySelector("[data-family-members-list]");
  const calTitle = document.querySelector("[data-family-calendar-title]");
  const calList = document.querySelector("[data-family-calendar-list]");

  function tr(value) {
    return window.Love21I18n ? window.Love21I18n.translate(value) : value;
  }

  function sentenceEnd() {
    return document.documentElement.lang === "zh-Hant" ? "。" : ".";
  }

  const ROLE_LABELS = {
    mom: "Mom",
    dad: "Dad",
    caregiver: "Caregiver",
    helper: "Helper",
    child: "Child / member",
  };

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function showExample() {
    if (eyebrowEl) eyebrowEl.textContent = tr("Example family");
    if (leadEl)
      leadEl.textContent = tr(
        "Example: Alex is 9 and needs a beginners swim lane on Saturday at the San Po Kong pool. Jamie and Chris both see the booking on the same profile."
      );
    if (waitlistTag) waitlistTag.textContent = tr("Example waitlist");
    if (membersTag) membersTag.textContent = tr("Example household");
    if (calTitle) calTitle.textContent = tr("Coming up (example)");
    if (loginCta) loginCta.hidden = false;
  }

  async function showReal() {
    let data;
    try {
      data = await L.api("/api/profile");
    } catch (err) {
      showExample();
      return;
    }
    if (loginCta) loginCta.hidden = true;

    const householdName = (data.family && data.family.household_name) || data.person.name + "’s family";
    if (eyebrowEl) eyebrowEl.textContent = householdName;

    const regs = (data.family && data.family.registrations) || [];
    const waitlisted = regs.filter(function (r) {
      return r.status === "waitlist";
    });
    const booked = regs.filter(function (r) {
      return r.status === "registered";
    });

    if (leadEl) {
      if (booked.length) {
        leadEl.textContent =
          (booked[0].member_name || tr("A member")) +
          " " +
          tr("is booked into") +
          " " +
          (booked[0].activity_title || tr("a class")) +
          sentenceEnd() +
          " " +
          tr("Everyone on the household sees it on the same profile.");
      } else if (waitlisted.length) {
        leadEl.textContent =
          (waitlisted[0].member_name || tr("A member")) +
          " " +
          tr("is on the waitlist for") +
          " " +
          (waitlisted[0].activity_title || tr("a class")) +
          sentenceEnd() +
          " " +
          tr("You get an email when a spot opens.");
      } else {
        leadEl.textContent = tr(
          "No classes booked yet. Browse open classes below to get started."
        );
      }
    }

    if (waitlistTag)
      waitlistTag.textContent = waitlisted.length ? tr("Your waitlist") : tr("No waitlist");
    if (waitlistList) {
      waitlistList.innerHTML = waitlisted.length
        ? waitlisted
            .map(function (r) {
              return (
                "<li>" +
                escapeHtml(tr(r.activity_title || "Class")) +
                "</li><li>" +
                escapeHtml(r.member_name || "") +
                " · " +
                escapeHtml(tr(r.status_label || "Waitlist")) +
                "</li>"
              );
            })
            .join("")
        : "<li>" +
          tr("No one is on a waitlist right now") +
          "</li><li>" +
          tr("Browse classes to join one") +
          "</li>";
    }

    const members = (data.family && data.family.members) || [];
    if (membersTag)
      membersTag.textContent = members.length ? tr("Your household") : tr("No household yet");
    if (membersList) {
      membersList.innerHTML = members.length
        ? members
            .map(function (m) {
              return (
                "<li>" +
                escapeHtml(m.name) +
                " · " +
                escapeHtml(tr(ROLE_LABELS[m.household_role] || "Member")) +
                "</li>"
              );
            })
            .join("")
        : "<li>" + tr("Add family members from your Profile") + "</li>";
    }

    const calEvents = (data.calendar_events || []).filter(function (e) {
      return e.kind === "class";
    });
    if (calTitle) calTitle.textContent = tr("Coming up");
    if (calList) {
      calList.innerHTML = calEvents.length
        ? calEvents
            .slice(0, 4)
            .map(function (e) {
              return (
                "<li>" +
                escapeHtml(tr(e.title)) +
                " · " +
                escapeHtml(tr(e.status || "")) +
                "</li>"
              );
            })
            .join("")
        : "<li>" + tr("Nothing booked yet") + "</li>";
    }
  }

  function init() {
    if (L.getPerson()) {
      showReal();
    } else {
      showExample();
    }
  }

  if (loginCta) {
    loginCta.addEventListener("click", function () {
      L.requireLogin(async function () {
        await showReal();
        L.showToast("Showing your family's classes");
      }).catch(function (err) {
        if (!err.cancelled) L.showToast(L.friendlyError(err));
      });
    });
  }

  document.addEventListener("love21:languagechange", function () {
    if (L.getPerson()) {
      showReal();
    } else {
      showExample();
    }
  });

  init();
})();
