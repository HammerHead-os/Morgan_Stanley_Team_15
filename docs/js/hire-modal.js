/* Love 21 — "Hire a creator" pop-up form. Hiring requires being signed in
   (the caller already gates this via L.requireLogin), so the requester's
   name and contact email come straight from the account instead of being
   retyped — only the event-specific details are asked here. */

(function (global) {
  const L = global.Love21;
  if (!L) return;

  let backdrop = null;
  let pendingResolve = null;
  let creatorLabel = "";
  let currentPerson = null;

  function escapeAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function html() {
    return (
      '<button type="button" class="btn btn-ghost btn-sm l21-modal-close" data-l21-cancel>Close</button>' +
      "<h2>Hire<span data-l21-hire-title></span></h2>" +
      '<p class="muted">Tell us about your event — we\'ll follow up by email.</p>' +
      '<p class="l21-modal-error" data-l21-error></p>' +
      '<form data-l21-hire-form>' +
      '<label class="l21-field"><span>Your name</span><input type="text" name="requester_name" readonly required /></label>' +
      '<label class="l21-field"><span>Contact email</span><input type="email" name="contact_email" required /></label>' +
      '<label class="l21-field"><span>Company / organisation</span><input type="text" name="company_name" /></label>' +
      '<label class="l21-field"><span>Tell us about the event</span><textarea name="event_description" rows="3" required></textarea></label>' +
      '<label class="l21-field"><span>Preferred date</span><input type="date" name="preferred_date" required /></label>' +
      '<label class="l21-field"><span>Contact phone (optional)</span><input type="tel" name="contact_phone" /></label>' +
      '<div class="l21-modal-actions"><button type="submit" class="btn btn-primary">Send enquiry</button></div>' +
      "</form>"
    );
  }

  function ensureBuilt() {
    if (backdrop) return;
    backdrop = Love21ModalKit.create(html());
    backdrop.querySelector("[data-l21-cancel]").addEventListener("click", function () {
      backdrop.hidden = true;
      if (pendingResolve) pendingResolve(null);
      pendingResolve = null;
    });
    backdrop.querySelector("[data-l21-hire-form]").addEventListener("submit", onSubmit);
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return iso;
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const f = e.target;
    const errEl = backdrop.querySelector("[data-l21-error]");
    errEl.textContent = "";
    try {
      const result = await L.api("/api/hire", {
        method: "POST",
        body: {
          creator_label: creatorLabel,
          preferred_date: fmtDate(f.preferred_date.value) || null,
          requester_name: f.requester_name.value.trim(),
          company_name: f.company_name.value.trim(),
          event_description: f.event_description.value.trim(),
          contact_email: f.contact_email.value.trim(),
          contact_phone: f.contact_phone.value.trim() || null,
        },
      });
      backdrop.hidden = true;
      if (pendingResolve) pendingResolve(result);
      pendingResolve = null;
    } catch (err) {
      errEl.textContent = L.friendlyError(err);
    }
  }

  function open(label, person) {
    creatorLabel = label || "";
    currentPerson = person || {};
    ensureBuilt();
    backdrop.querySelector("[data-l21-hire-title]").textContent = creatorLabel
      ? " " + creatorLabel
      : "";
    backdrop.querySelector("[data-l21-error]").textContent = "";
    const form = backdrop.querySelector("[data-l21-hire-form]");
    form.reset();
    form.requester_name.value = currentPerson.name || "";
    form.contact_email.value = currentPerson.email || "";
    backdrop.hidden = false;
    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  }

  global.Love21Hire = { open: open };
})(window);
