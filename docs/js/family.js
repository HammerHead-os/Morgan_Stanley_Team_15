/* Family hub — swap the illustrative example for the real household once someone is logged in */

(function () {
  const L = window.Love21;
  if (!L) return;

  const eyebrowEl = document.querySelector("[data-family-eyebrow]");
  const leadEl = document.querySelector("[data-family-lead]");
  const loginCta = document.querySelector("[data-family-login-cta]");
  const bookedTag = document.querySelector("[data-family-booked-tag]");
  const bookedList = document.querySelector("[data-family-booked-list]");
  const waitlistTag = document.querySelector("[data-family-waitlist-tag]");
  const waitlistList = document.querySelector("[data-family-waitlist-list]");
  const membersTag = document.querySelector("[data-family-members-tag]");
  const membersList = document.querySelector("[data-family-members-list]");
  const fundsTag = document.querySelector("[data-family-funds-tag]");
  const fundsList = document.querySelector("[data-family-funds-list]");
  const calTitle = document.querySelector("[data-family-calendar-title]");
  const calList = document.querySelector("[data-family-calendar-list]");

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
    if (eyebrowEl) eyebrowEl.textContent = "Example family";
    if (leadEl)
      leadEl.textContent =
        "Example: Alex is 9 and needs a beginners swim lane on Saturday at " +
        "the San Po Kong pool. Jamie and Chris both see the booking on the same profile.";
    if (bookedTag) bookedTag.textContent = "Example bookings";
    if (waitlistTag) waitlistTag.textContent = "Example waitlist";
    if (membersTag) membersTag.textContent = "Example household";
    if (fundsTag) fundsTag.textContent = "Example giving";
    if (calTitle) calTitle.textContent = "Coming up (example)";
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
          (booked[0].member_name || "A member") +
          " is booked into " +
          (booked[0].activity_title || "a class") +
          ". Everyone on the household sees it on the same profile.";
      } else if (waitlisted.length) {
        leadEl.textContent =
          (waitlisted[0].member_name || "A member") +
          " is on the waitlist for " +
          (waitlisted[0].activity_title || "a class") +
          ". You get an email when a spot opens.";
      } else {
        leadEl.textContent =
          "No classes booked yet. Browse open classes below to get started.";
      }
    }

    function partySuffix(r) {
      return r.party_size > 1 ? " +" + (r.party_size - 1) + " more" : "";
    }

    function cancelBtn(r) {
      return (
        '<button type="button" class="btn btn-sm btn-ghost" data-l21-cancel-reg="' +
        r.id +
        '">Cancel</button>'
      );
    }

    if (bookedTag) bookedTag.textContent = booked.length ? "Your bookings" : "No bookings yet";
    if (bookedList) {
      bookedList.innerHTML = booked.length
        ? booked
            .map(function (r) {
              return (
                "<li>" +
                escapeHtml(r.activity_title || "Class") +
                " · " +
                escapeHtml(r.member_name || "") +
                escapeHtml(partySuffix(r)) +
                " " +
                cancelBtn(r) +
                "</li>"
              );
            })
            .join("")
        : "<li>No classes booked yet. Browse open classes to get started.</li>";
    }

    if (waitlistTag) waitlistTag.textContent = waitlisted.length ? "Your waitlist" : "No waitlist";
    if (waitlistList) {
      waitlistList.innerHTML = waitlisted.length
        ? waitlisted
            .map(function (r) {
              return (
                "<li>" +
                escapeHtml(r.activity_title || "Class") +
                "</li><li>" +
                escapeHtml(r.member_name || "") +
                " · " +
                escapeHtml(r.status_label || "Waitlist") +
                " " +
                cancelBtn(r) +
                "</li>"
              );
            })
            .join("")
        : "<li>No one is on a waitlist right now</li><li>Browse classes to join one</li>";
    }

    const members = (data.family && data.family.members) || [];
    if (membersTag) membersTag.textContent = members.length ? "Your household" : "No household yet";
    if (membersList) {
      membersList.innerHTML = members.length
        ? members
            .map(function (m) {
              return (
                "<li>" +
                escapeHtml(m.name) +
                " · " +
                escapeHtml(ROLE_LABELS[m.household_role] || "Member") +
                "</li>"
              );
            })
            .join("")
        : "<li>Add family members from your Profile</li>";
    }

    const funds = (data.family && data.family.shared_funds) || null;
    const byCategory = (funds && funds.by_fund_category) || [];
    if (fundsTag) {
      fundsTag.textContent = funds && funds.gift_count ? "Household giving" : "No gifts yet";
    }
    if (fundsList) {
      fundsList.innerHTML =
        funds && funds.gift_count
          ? "<li>HKD " +
            Math.round(funds.total_hkd).toLocaleString() +
            " given across " +
            funds.gift_count +
            (funds.gift_count === 1 ? " gift" : " gifts") +
            "</li>" +
            byCategory
              .map(function (f) {
                return (
                  "<li>" +
                  escapeHtml(f.fund_category) +
                  " · HKD " +
                  Math.round(f.total_hkd).toLocaleString() +
                  "</li>"
                );
              })
              .join("")
          : "<li>No gifts from this household yet</li>";
    }

    const calEvents = (data.calendar_events || []).filter(function (e) {
      return e.kind === "class";
    });
    if (calTitle) calTitle.textContent = "Coming up";
    if (calList) {
      calList.innerHTML = calEvents.length
        ? calEvents
            .slice(0, 4)
            .map(function (e) {
              return "<li>" + escapeHtml(e.title) + " · " + escapeHtml(e.status || "") + "</li>";
            })
            .join("")
        : "<li>Nothing booked yet</li>";
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

  document.addEventListener("click", async function (e) {
    const btn = e.target.closest("[data-l21-cancel-reg]");
    if (!btn) return;
    e.preventDefault();
    if (!window.confirm("Cancel this booking?")) return;
    const id = Number(btn.getAttribute("data-l21-cancel-reg"));
    try {
      await L.api("/api/family/registrations/" + id + "/cancel", { method: "POST" });
      L.showToast("Booking cancelled");
      await showReal();
    } catch (err) {
      L.showToast(L.friendlyError(err));
    }
  });

  init();
})();
