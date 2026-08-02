/* HK tax saver + one-tap pay demo */

(function () {
  const gift = document.getElementById("gift");
  const rate = document.getElementById("rate");
  const out = document.querySelector("[data-tax-out]");
  const label = document.querySelector("[data-gift-label]");
  const L = window.Love21;

  function recalc() {
    if (!gift || !rate || !out) return;
    const amount = Math.max(0, Number(gift.value) || 0);
    const r = Number(rate.value) || 0;
    const save = Math.round(amount * r);
    const net = Math.round(amount - save);
    out.innerHTML =
      '<div class="muted">Net cost after deduction</div>' +
      '<div class="big">HKD ' +
      net.toLocaleString() +
      "</div>" +
      '<p class="muted" style="margin:0">You give <strong>HKD ' +
      amount.toLocaleString() +
      "</strong> · tax relief about <strong>HKD " +
      save.toLocaleString() +
      "</strong> at " +
      Math.round(r * 100) +
      "%.</p>";
    if (label) label.textContent = String(amount);
  }

  if (gift) gift.addEventListener("input", recalc);
  if (rate) rate.addEventListener("change", recalc);
  recalc();

  document.addEventListener("click", async function (e) {
    const pay = e.target.closest("[data-pay]");
    if (!pay || !L || !window.Love21PaymentModal) return;
    e.preventDefault();
    const amount = gift ? Number(gift.value) || 300 : 300;
    const methodLabel = pay.getAttribute("data-pay"); // "PayMe" | "Apple Pay" | "Google Pay"
    const methodKey =
      methodLabel === "Apple Pay" ? "apple_pay" :
      methodLabel === "Google Pay" ? "google_pay" : "payme";
    try {
      await L.requireLogin(async function () {
        const result = await window.Love21PaymentModal.open({
          amountHkd: amount,
          cadence: "monthly",
          fundCategory: "Sports programmes",
          method: methodKey,
        });
        if (!result) return; // cancelled
        L.goToProfile("impact", methodLabel + " · HKD " + amount + "/mo started");
      });
    } catch (err) {
      if (!err.cancelled) L.showToast(L.friendlyError(err));
    }
  });
})();
