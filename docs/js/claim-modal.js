/* Love 21 — "Bring people along" pop-up shown before claiming a volunteer
   shift. The claimant is always the logged-in volunteer; this only collects
   any extra people joining them (each tagged guardian/participant). */

(function (global) {
  const L = global.Love21;
  if (!L) return;

  let backdrop = null;
  let pendingResolve = null;

  function escapeAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function attendeeRow(i, name, phone, role, email) {
    const isGuardian = role === "guardian";
    return (
      '<div class="l21-attendee-row" data-row="' +
      i +
      '"><strong>Person ' +
      (i + 1) +
      "</strong>" +
      '<label class="l21-field"><span>Full name</span><input type="text" name="name_' +
      i +
      '" value="' +
      escapeAttr(name) +
      '" required /></label>' +
      '<label class="l21-field"><span>Phone (optional)</span><input type="tel" name="phone_' +
      i +
      '" value="' +
      escapeAttr(phone) +
      '" /></label>' +
      '<label class="l21-field"><span>Email (optional — lets us notify them if the shift changes)</span><input type="email" name="email_' +
      i +
      '" value="' +
      escapeAttr(email) +
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
      "<h2>Bring people along?</h2>" +
      '<p class="muted">Volunteering solo is fine — only add anyone joining you.</p>' +
      '<p class="l21-modal-error" data-l21-error></p>' +
      '<form data-l21-claim-form>' +
      '<label class="l21-field"><span>How many people total (including you)?</span><input type="number" name="party_size" min="1" max="10" value="1" /></label>' +
      '<div data-l21-attendees></div>' +
      '<div class="l21-modal-actions"><button type="submit" class="btn btn-primary">Claim shift</button></div>' +
      "</form>"
    );
  }

  function renderAttendees(form, extraCount) {
    const box = form.querySelector("[data-l21-attendees]");
    const existing = [];
    box.querySelectorAll("[data-row]").forEach(function (row) {
      const inputs = row.querySelectorAll("input");
      const select = row.querySelector("select");
      existing.push({
        name: inputs[0].value,
        phone: inputs[1].value,
        email: inputs[2] ? inputs[2].value : "",
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
    const form = backdrop.querySelector("[data-l21-claim-form]");
    form.party_size.addEventListener("input", function () {
      const n = Math.max(1, Math.min(10, parseInt(form.party_size.value, 10) || 1));
      renderAttendees(form, n - 1);
    });
    form.addEventListener("submit", onSubmit);
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const partySize = Math.max(1, Math.min(10, parseInt(form.party_size.value, 10) || 1));
    const attendees = [];
    for (let i = 0; i < partySize - 1; i++) {
      const roleSel = form["role_" + i];
      attendees.push({
        full_name: form["name_" + i].value.trim(),
        phone: form["phone_" + i].value.trim() || null,
        email: (form["email_" + i] && form["email_" + i].value.trim()) || null,
        role: roleSel ? roleSel.value : "participant",
      });
    }
    backdrop.hidden = true;
    if (pendingResolve) pendingResolve({ attendees: attendees });
    pendingResolve = null;
  }

  function open() {
    ensureBuilt();
    const form = backdrop.querySelector("[data-l21-claim-form]");
    form.reset();
    backdrop.querySelector("[data-l21-error]").textContent = "";
    renderAttendees(form, 0);
    backdrop.hidden = false;
    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  }

  global.Love21Claim = { open: open };
})(window);
