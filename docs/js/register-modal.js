/* Love 21 — Register / Join waitlist pop-up (multi-person). The primary
   registrant is always the household member passed into open(); the
   party-size input controls how many *additional* attendees to collect. */

(function (global) {
  const L = global.Love21;
  if (!L) return;

  let backdrop = null;
  let pendingResolve = null;
  let activityId = null;
  let memberPerson = null;

  // Attendee name/phone values typed by the user are re-inserted into
  // value="..." attributes whenever the party-size input changes (so people
  // don't lose what they typed). Escape them, or a stray `"` in someone's
  // own name field could break out of the attribute and inject markup into
  // their own page render (self-XSS only, but a one-line fix).
  function escapeAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function attendeeRow(i, name, phone) {
    return (
      '<div class="l21-attendee-row" data-row="' +
      i +
      '"><strong>Additional person ' +
      (i + 1) +
      "</strong>" +
      '<label class="l21-field"><span>Full name</span><input type="text" name="name_' +
      i +
      '" value="' +
      escapeAttr(name) +
      '" required /></label>' +
      '<label class="l21-field"><span>Phone</span><input type="tel" name="phone_' +
      i +
      '" value="' +
      escapeAttr(phone) +
      '" required /></label>' +
      '<label class="l21-field"><span>Email (optional)</span><input type="email" name="email_' +
      i +
      '" /></label>' +
      '<label class="l21-field"><span>Age (optional)</span><input type="number" min="0" max="120" name="age_' +
      i +
      '" /></label></div>'
    );
  }

  function html() {
    return (
      '<button type="button" class="btn btn-ghost btn-sm l21-modal-close" data-l21-cancel>Close</button>' +
      '<h2 data-l21-reg-title>Register</h2>' +
      '<p class="l21-modal-error" data-l21-error></p>' +
      '<form data-l21-register-form>' +
      '<label class="l21-field"><span>How many people (including you)?</span><input type="number" name="party_size" min="1" max="10" value="1" /></label>' +
      '<div data-l21-attendees></div>' +
      '<div class="l21-modal-actions"><button type="submit" class="btn btn-primary" data-l21-submit-label>Register</button></div>' +
      "</form>"
    );
  }

  function renderAttendees(form, extraCount) {
    const box = form.querySelector("[data-l21-attendees]");
    const existing = [];
    box.querySelectorAll("[data-row]").forEach(function (row) {
      const inputs = row.querySelectorAll("input");
      existing.push({ name: inputs[0].value, phone: inputs[1].value });
    });
    let out = "";
    for (let i = 0; i < extraCount; i++) {
      const prev = existing[i] || {};
      out += attendeeRow(i, prev.name, prev.phone);
    }
    box.innerHTML = out;
  }

  function ensureBuilt() {
    if (backdrop) return;
    backdrop = Love21ModalKit.create(html());
    backdrop.querySelector("[data-l21-cancel]").addEventListener("click", function () {
      backdrop.hidden = true;
      if (pendingResolve) pendingResolve(null);
      pendingResolve = null;
    });
    const form = backdrop.querySelector("[data-l21-register-form]");
    form.party_size.addEventListener("input", function () {
      const n = Math.max(1, Math.min(10, parseInt(form.party_size.value, 10) || 1));
      renderAttendees(form, n - 1);
    });
    form.addEventListener("submit", onSubmit);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const errEl = backdrop.querySelector("[data-l21-error]");
    errEl.textContent = "";
    const partySize = Math.max(1, Math.min(10, parseInt(form.party_size.value, 10) || 1));
    const attendees = [];
    for (let i = 0; i < partySize - 1; i++) {
      attendees.push({
        full_name: form["name_" + i].value.trim(),
        phone: form["phone_" + i].value.trim(),
        email: (form["email_" + i] && form["email_" + i].value.trim()) || null,
        age: form["age_" + i] && form["age_" + i].value ? Number(form["age_" + i].value) : null,
      });
    }
    try {
      const result = await L.api("/api/family/register", {
        method: "POST",
        body: {
          activity_id: activityId,
          member_person_id: memberPerson.id,
          reminder_channel: "email",
          attendees: attendees,
        },
      });
      backdrop.hidden = true;
      if (pendingResolve) pendingResolve(result);
      pendingResolve = null;
    } catch (err) {
      errEl.textContent = L.friendlyError(err);
    }
  }

  function open(id, activityTitle, member, actionLabel) {
    activityId = id;
    memberPerson = member;
    ensureBuilt();
    const form = backdrop.querySelector("[data-l21-register-form]");
    form.reset();
    backdrop.querySelector("[data-l21-reg-title]").textContent =
      (actionLabel || "Register") + " · " + (activityTitle || "class");
    backdrop.querySelector("[data-l21-submit-label]").textContent = actionLabel || "Register";
    backdrop.querySelector("[data-l21-error]").textContent = "";
    renderAttendees(form, 0);
    backdrop.hidden = false;
    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  }

  global.Love21Registration = { open: open };
})(window);
