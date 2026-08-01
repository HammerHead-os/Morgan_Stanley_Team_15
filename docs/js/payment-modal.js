/* Love 21 — donor payment checkout demo (PayMe / Apple Pay / Google Pay).
   No real payment SDK integration: this simulates a method-select ->
   processing -> confirmation flow, then writes one real commitment row via
   the existing /api/impact/commitments endpoint. */

(function (global) {
  const L = global.Love21;
  if (!L) return;

  const METHODS = [
    { key: "payme", label: "PayMe", icon: "💳", btnClass: "l21-pay-btn-payme", cta: "Confirm in PayMe app" },
    { key: "apple_pay", label: "Apple Pay", icon: "🍎", btnClass: "l21-pay-btn-apple", cta: " Pay" },
    { key: "google_pay", label: "Google Pay", icon: "G", btnClass: "l21-pay-btn-google", cta: "Pay with G Pay" },
  ];

  let backdrop = null;
  let pendingResolve = null;
  let state = "select"; // "select" | "processing" | "success"
  let selectedMethod = "payme";
  let ctx = { amountHkd: 300, cadence: "monthly", fundCategory: "Sports programmes" };
  let lastResult = null;

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function methodByKey(key) {
    return METHODS.find(function (m) { return m.key === key; }) || METHODS[0];
  }

  function selectPanel() {
    const m = methodByKey(selectedMethod);
    return (
      '<button type="button" class="btn btn-ghost btn-sm l21-modal-close" data-l21-cancel>Close</button>' +
      "<h2>Confirm your gift</h2>" +
      '<p class="muted">Demo checkout — no real payment is sent.</p>' +
      '<div class="l21-pay-summary">' +
      '<div class="big">HKD ' + Math.round(ctx.amountHkd).toLocaleString() +
      ' <span style="font-size:0.85rem;font-weight:500">/ ' + escapeHtml(ctx.cadence) + '</span></div>' +
      '<p class="l21-pay-detail">Fund: ' + escapeHtml(ctx.fundCategory) + '</p>' +
      "</div>" +
      '<p class="l21-modal-error" data-l21-error></p>' +
      '<div class="l21-pay-methods">' +
      METHODS.map(function (mm) {
        return '<button type="button" class="l21-pay-method' + (mm.key === selectedMethod ? " active" : "") +
          '" data-l21-method="' + mm.key + '"><span class="icon">' + mm.icon + '</span>' + mm.label + '</button>';
      }).join("") +
      "</div>" +
      '<div class="l21-modal-actions" style="justify-content:stretch">' +
      '<button type="button" class="btn ' + m.btnClass + '" data-l21-confirm>' +
      m.cta + " · HKD " + Math.round(ctx.amountHkd).toLocaleString() + "</button>" +
      "</div>"
    );
  }

  function processingPanel() {
    const m = methodByKey(selectedMethod);
    return (
      '<div class="l21-pay-processing">' +
      '<div class="l21-pay-spinner"></div>' +
      "<p>Processing via " + escapeHtml(m.label) + "…</p>" +
      "</div>"
    );
  }

  function successPanel() {
    const m = methodByKey(selectedMethod);
    const ref = "L21-PAY-" + Date.now().toString(36).toUpperCase();
    return (
      '<div class="l21-pay-success">' +
      '<div class="l21-pay-check">&#10003;</div>' +
      "<h2>Gift confirmed</h2>" +
      '<p class="muted">HKD ' + Math.round(ctx.amountHkd).toLocaleString() + " / " + escapeHtml(ctx.cadence) +
      " via " + escapeHtml(m.label) + "</p>" +
      '<p class="l21-pay-ref">Demo reference ' + ref + "</p>" +
      '<div class="l21-modal-actions" style="justify-content:center;margin-top:1.25rem">' +
      '<button type="button" class="btn btn-primary" data-l21-done>Done</button>' +
      "</div>" +
      "</div>"
    );
  }

  function render() {
    const modalEl = backdrop.querySelector(".l21-modal");
    if (state === "select") modalEl.innerHTML = selectPanel();
    else if (state === "processing") modalEl.innerHTML = processingPanel();
    else modalEl.innerHTML = successPanel();
    bind();
  }

  function bind() {
    if (state === "select") {
      const closeBtn = backdrop.querySelector("[data-l21-cancel]");
      if (closeBtn) closeBtn.addEventListener("click", function () { close(null); });
      backdrop.querySelectorAll("[data-l21-method]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          selectedMethod = btn.getAttribute("data-l21-method");
          render();
        });
      });
      const confirmBtn = backdrop.querySelector("[data-l21-confirm]");
      if (confirmBtn) confirmBtn.addEventListener("click", onConfirm);
    } else if (state === "success") {
      const doneBtn = backdrop.querySelector("[data-l21-done]");
      if (doneBtn) doneBtn.addEventListener("click", function () { close(lastResult); });
    }
  }

  async function onConfirm() {
    state = "processing";
    render();
    // Simulated gateway latency so the "processing via X" state is visible.
    // Replace this whole function with a real payment SDK call if this ever
    // needs to move real money — everything below the delay is the part
    // that actually persists to the database and is not a simulation.
    await new Promise(function (resolve) { setTimeout(resolve, 900); });
    try {
      const commitment = await L.api("/api/impact/commitments", {
        method: "POST",
        body: {
          amount_hkd: ctx.amountHkd,
          fund_category: ctx.fundCategory,
          cadence: ctx.cadence,
          payment_method: methodByKey(selectedMethod).label,
        },
      });
      lastResult = commitment;
      state = "success";
      render();
    } catch (err) {
      state = "select";
      render();
      const errEl = backdrop.querySelector("[data-l21-error]");
      if (errEl) errEl.textContent = L.friendlyError(err);
    }
  }

  function close(result) {
    if (!backdrop) return;
    backdrop.hidden = true;
    state = "select";
    const resolve = pendingResolve;
    pendingResolve = null;
    if (resolve) resolve(result);
  }

  function ensureBuilt() {
    if (backdrop) return;
    backdrop = Love21ModalKit.create("");
    // modal-kit's own backdrop-click handler just hides the modal; add our
    // own so clicking outside also resolves the pending promise with null
    // instead of leaving the caller's `await` hanging forever.
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) close(null);
    });
  }

  function open(options) {
    options = options || {};
    ctx = {
      amountHkd: options.amountHkd || 300,
      cadence: options.cadence || "monthly",
      fundCategory: options.fundCategory || "Sports programmes",
    };
    selectedMethod = options.method || "payme";
    state = "select";
    lastResult = null;
    ensureBuilt();
    render();
    backdrop.hidden = false;
    return new Promise(function (resolve) { pendingResolve = resolve; });
  }

  global.Love21PaymentModal = { open: open };
})(window);
