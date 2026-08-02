/* Love 21 — Volunteer onboarding pop-up. Replaces the old hardcoded
   POST with a real form; option values line up with the skill/language
   vocabulary volunteer.js and the shift-matching logic already use. */

(function (global) {
  const L = global.Love21;
  if (!L) return;

  const SKILLS = [
    { value: "cantonese", label: "Cantonese reading" },
    { value: "photos", label: "Photo/video editing" },
    { value: "voice", label: "Phone mic (English or Cantonese)" },
    { value: "sports", label: "On-site sports help" },
    { value: "events", label: "Event setup & logistics" },
    { value: "kitchen", label: "Kitchen / cooking help" },
    { value: "childcare", label: "Childcare experience" },
    { value: "first-aid", label: "First aid trained" },
    { value: "social-media", label: "Social media / marketing" },
    { value: "admin", label: "Admin / data entry" },
    { value: "driving", label: "Driving (own transport)" },
  ];
  const LANGS = [
    { value: "yue", label: "Cantonese" },
    { value: "en", label: "English" },
    { value: "cmn", label: "Mandarin" },
    { value: "hi-ur", label: "Hindi / Urdu" },
    { value: "tl", label: "Filipino / Tagalog" },
  ];
  const AVAIL = [
    "weekday mornings",
    "weekday afternoons",
    "weekday evenings",
    "saturday",
    "sunday",
    "remote-only",
    "on-call / last-minute",
  ];

  let backdrop = null;
  let pendingResolve = null;

  function checkboxGroup(name, options) {
    const items = options
      .map(function (o) {
        const value = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        return (
          '<label><input type="checkbox" name="' +
          name +
          '" value="' +
          value +
          '" /> ' +
          label +
          "</label>"
        );
      })
      .join("");
    return '<div class="l21-checkbox-options">' + items + "</div>";
  }

  function html() {
    return (
      '<button type="button" class="btn btn-ghost btn-sm l21-modal-close" data-l21-cancel>Close</button>' +
      "<h2>Volunteer onboarding</h2>" +
      '<p class="muted">Quick profile so we can match you to shifts.</p>' +
      '<p class="l21-modal-error" data-l21-error></p>' +
      '<form data-l21-onboard-form>' +
      '<div class="l21-field l21-checkbox-group"><span>Skills</span>' +
      checkboxGroup("skills", SKILLS) +
      "</div>" +
      '<div class="l21-field l21-checkbox-group"><span>Languages</span>' +
      checkboxGroup("languages", LANGS) +
      "</div>" +
      '<div class="l21-field l21-checkbox-group"><span>Availability</span>' +
      checkboxGroup("availability", AVAIL) +
      "</div>" +
      '<div class="l21-modal-actions"><button type="submit" class="btn btn-primary">Finish onboarding</button></div>' +
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
    backdrop.querySelector("[data-l21-onboard-form]").addEventListener("submit", onSubmit);
  }

  function checkedValues(form, name) {
    return Array.from(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (el) {
      return el.value;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const errEl = backdrop.querySelector("[data-l21-error]");
    errEl.textContent = "";
    try {
      const result = await L.api("/api/volunteers/onboard", {
        method: "POST",
        body: {
          skills: checkedValues(form, "skills").join(","),
          languages: checkedValues(form, "languages").join(","),
          availability: checkedValues(form, "availability").join(","),
        },
      });
      backdrop.hidden = true;
      if (pendingResolve) pendingResolve(result);
      pendingResolve = null;
    } catch (err) {
      errEl.textContent = L.friendlyError(err);
    }
  }

  function open() {
    ensureBuilt();
    backdrop.querySelector("[data-l21-error]").textContent = "";
    backdrop.querySelector("[data-l21-onboard-form]").reset();
    backdrop.hidden = false;
    return new Promise(function (resolve) {
      pendingResolve = resolve;
    });
  }

  global.Love21Onboard = { open: open };
})(window);
