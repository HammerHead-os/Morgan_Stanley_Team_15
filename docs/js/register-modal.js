/* Love 21 — Register / Join waitlist pop-up (multi-person). No household is
   required: by default you register yourself, but if you have other
   household members, a picker lets you register one of them instead
   (today's carer-books-a-child flow). The party-size input controls how
   many *additional* attendees to collect, each tagged guardian/participant. */

(function (global) {
  const L = global.Love21;
  if (!L) return;

  let backdrop = null;
  let pendingResolve = null;
  let activityId = null;
  let memberOptions = []; // [{id, label}]
  let selectedMemberId = null;
  let sessionDateText = "";

  // Classes run on a fixed recurring schedule (the activity's "day" —
  // weekday/saturday/sunday), so the specific date is computed, never
  // picked by the registrant. Mirrors the server-side logic in
  // backend/app/routers/family.py's _next_occurrence — this copy is only
  // for display before submitting; the backend always computes its own.
  function nextOccurrence(day) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targets = { saturday: 6, sunday: 0 }; // JS getDay(): Sun=0 ... Sat=6
    if (day in targets) {
      const delta = (targets[day] - today.getDay() + 7) % 7;
      const d = new Date(today);
      d.setDate(d.getDate() + delta);
      return d;
    }
    const d = new Date(today);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  function fmtSessionDate(d) {
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function fmtTime(hms) {
    if (!hms) return "";
    const parts = String(hms).split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1] || "00";
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + " " + suffix;
  }

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

  function escapeHtml(s) {
    return escapeAttr(s).replace(/'/g, "&#39;");
  }

  function attendeeRow(i, name, phone, role, email) {
    const isGuardian = role === "guardian";
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
      '<label class="l21-field"><span>Email</span><input type="email" name="email_' +
      i +
      '" value="' +
      escapeAttr(email) +
      '" required /></label>' +
      '<label class="l21-field"><span>Phone (optional)</span><input type="tel" name="phone_' +
      i +
      '" value="' +
      escapeAttr(phone) +
      '" /></label>' +
      '<label class="l21-field"><span>Age (optional)</span><input type="number" min="0" max="120" name="age_' +
      i +
      '" /></label>' +
      '<label class="l21-field"><span>Relationship</span><select name="role_' +
      i +
      '">' +
      '<option value="participant"' + (isGuardian ? "" : " selected") + ">Participant</option>" +
      '<option value="guardian"' + (isGuardian ? " selected" : "") + ">Guardian</option>" +
      "</select></label></div>"
    );
  }

  function html() {
    return (
      '<button type="button" class="btn btn-ghost btn-sm l21-modal-close" data-l21-cancel>Close</button>' +
      '<h2 data-l21-reg-title>Register</h2>' +
      '<p class="l21-modal-error" data-l21-error></p>' +
      '<form data-l21-register-form>' +
      '<div data-l21-member-picker></div>' +
      '<div class="l21-field"><span>Session date</span>' +
      '<div data-l21-session-date style="font-size:0.95rem;font-weight:700;color:var(--ink)"></div></div>' +
      '<label class="l21-field"><span>How many people (including you)?</span><input type="number" name="party_size" min="1" max="10" value="1" /></label>' +
      '<div data-l21-attendees></div>' +
      '<div class="l21-modal-actions"><button type="submit" class="btn btn-primary" data-l21-submit-label>Register</button></div>' +
      "</form>"
    );
  }

  function renderMemberPicker(form) {
    const box = form.querySelector("[data-l21-member-picker]");
    if (memberOptions.length <= 1) {
      box.innerHTML = "";
      selectedMemberId = memberOptions.length ? memberOptions[0].id : selectedMemberId;
      return;
    }
    box.innerHTML =
      '<label class="l21-field"><span>Who is this booking for?</span>' +
      '<select data-l21-member-select>' +
      memberOptions
        .map(function (m) {
          return (
            '<option value="' +
            m.id +
            '"' +
            (m.id === selectedMemberId ? " selected" : "") +
            ">" +
            escapeHtml(m.label) +
            "</option>"
          );
        })
        .join("") +
      "</select></label>";
    box.querySelector("[data-l21-member-select]").addEventListener("change", function (e) {
      selectedMemberId = Number(e.target.value);
    });
  }

  function renderAttendees(form, extraCount) {
    const box = form.querySelector("[data-l21-attendees]");
    const existing = [];
    box.querySelectorAll("[data-row]").forEach(function (row) {
      const inputs = row.querySelectorAll("input");
      const select = row.querySelector("select");
      existing.push({
        name: inputs[0].value,
        email: inputs[1].value,
        phone: inputs[2].value,
        role: select ? select.value : "participant",
      });
    });
    let out = "";
    for (let i = 0; i < extraCount; i++) {
      const prev = existing[i] || {};
      out += attendeeRow(i, prev.name, prev.phone, prev.role, prev.email);
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
      const roleSel = form["role_" + i];
      attendees.push({
        full_name: form["name_" + i].value.trim(),
        phone: (form["phone_" + i] && form["phone_" + i].value.trim()) || null,
        email: (form["email_" + i] && form["email_" + i].value.trim()) || null,
        age: form["age_" + i] && form["age_" + i].value ? Number(form["age_" + i].value) : null,
        role: roleSel ? roleSel.value : "participant",
      });
    }
    try {
      const result = await L.api("/api/family/register", {
        method: "POST",
        body: {
          activity_id: activityId,
          member_person_id: selectedMemberId,
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

  function buildMemberOptions(defaultMember, householdMembers, selfPerson) {
    const seen = {};
    const opts = [];
    (householdMembers || []).forEach(function (m) {
      if (seen[m.id]) return;
      seen[m.id] = true;
      opts.push({
        id: m.id,
        label: m.id === selfPerson.id ? "Myself (" + m.name + ")" : m.name,
      });
    });
    if (!seen[selfPerson.id]) {
      opts.unshift({ id: selfPerson.id, label: "Myself" });
    }
    return opts;
  }

  function open(
    id,
    activityTitle,
    defaultMember,
    actionLabel,
    householdMembers,
    selfPerson,
    activityDay,
    activityFixedDate,
    activityScheduledTime
  ) {
    activityId = id;
    memberOptions = buildMemberOptions(
      defaultMember,
      householdMembers,
      selfPerson || defaultMember
    );
    selectedMemberId = defaultMember ? defaultMember.id : (selfPerson || {}).id;
    const sessionDate = activityFixedDate
      ? new Date(activityFixedDate + "T12:00:00")
      : nextOccurrence(activityDay || "weekday");
    const timeText = fmtTime(activityScheduledTime);
    sessionDateText = fmtSessionDate(sessionDate) + (timeText ? " · " + timeText : "");
    ensureBuilt();
    const form = backdrop.querySelector("[data-l21-register-form]");
    form.reset();
    backdrop.querySelector("[data-l21-reg-title]").textContent =
      (actionLabel || "Register") + " · " + (activityTitle || "class");
    backdrop.querySelector("[data-l21-submit-label]").textContent = actionLabel || "Register";
    backdrop.querySelector("[data-l21-error]").textContent = "";
    backdrop.querySelector("[data-l21-session-date]").textContent = sessionDateText;
    renderMemberPicker(form);
    renderAttendees(form, 0);
    backdrop.hidden = false;
    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  }

  global.Love21Registration = { open: open };
})(window);
