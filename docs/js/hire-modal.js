/* Love 21 — "Hire a creator" pop-up form. */

(function (global) {
  const L = global.Love21;
  if (!L) return;

  let backdrop = null;
  let pendingResolve = null;
  let creatorLabel = "";
  let preferredDate = "";

  function html() {
    return (
      '<button type="button" class="btn btn-ghost btn-sm l21-modal-close" data-l21-cancel>Close</button>' +
      "<h2>Hire<span data-l21-hire-title></span></h2>" +
      '<p class="muted">Tell us about your event — we\'ll follow up by email.</p>' +
      '<p class="l21-modal-error" data-l21-error></p>' +
      '<form data-l21-hire-form>' +
      '<label class="l21-field"><span>Your name</span><input type="text" name="requester_name" required /></label>' +
      '<label class="l21-field"><span>Company / organisation</span><input type="text" name="company_name" /></label>' +
      '<label class="l21-field"><span>Tell us about the event</span><textarea name="event_description" rows="3" required></textarea></label>' +
      '<label class="l21-field"><span>Contact email (optional)</span><input type="email" name="contact_email" /></label>' +
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
          preferred_date: preferredDate || null,
          requester_name: f.requester_name.value.trim(),
          company_name: f.company_name.value.trim(),
          event_description: f.event_description.value.trim(),
          contact_email: f.contact_email.value.trim() || null,
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

  function open(label, dateStr) {
    creatorLabel = label || "";
    preferredDate = dateStr || "";
    ensureBuilt();
    backdrop.querySelector("[data-l21-hire-title]").textContent = creatorLabel
      ? " " + creatorLabel
      : "";
    backdrop.querySelector("[data-l21-error]").textContent = "";
    backdrop.querySelector("[data-l21-hire-form]").reset();
    backdrop.hidden = false;
    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  }

  global.Love21Hire = { open: open };
})(window);
