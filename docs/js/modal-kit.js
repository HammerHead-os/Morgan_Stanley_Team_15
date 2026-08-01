/* Love 21 — tiny reusable modal shell used by hire/register/onboard/payment
   pop-ups. Each feature-specific modal file builds its own inner HTML and
   wires its own submit/cancel logic on top of this. */

(function (global) {
  function create(innerHtml) {
    const backdrop = document.createElement("div");
    backdrop.className = "l21-modal-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<div class="l21-modal panel-soft" role="dialog" aria-modal="true">' +
      innerHtml +
      "</div>";
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) backdrop.hidden = true;
    });
    return backdrop;
  }

  global.Love21ModalKit = { create: create };
})(window);
