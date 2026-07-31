/* Home interactions: hire + needs + task preview */

(function () {
  const L = window.Love21;

  function toast(msg) {
    if (L) L.showToast(msg);
  }

  document.addEventListener("click", async function (e) {
    const hire = e.target.closest("[data-hire]");
    if (hire) {
      e.preventDefault();
      const label = hire.getAttribute("data-hire");
      if (!L) {
        toast("Enquiry noted for " + label);
        return;
      }
      try {
        if (!L.getPerson()) {
          await L.ensureLogin("donor@demo.love21");
        }
        await L.api("/api/hire", {
          method: "POST",
          body: { creator_label: label },
        });
        L.goToProfile("impact", "Hire enquiry sent for " + label);
      } catch (err) {
        toast(L.friendlyError(err));
      }
      return;
    }
    const need = e.target.closest("[data-need-help]");
    if (need) {
      e.preventDefault();
      toast("Thanks — noted: " + need.getAttribute("data-need-help"));
    }
  });

  const taskBox = document.querySelector("[data-home-tasks]");
  if (taskBox && L) {
    L.api("/api/volunteers/shifts")
      .then(function (shifts) {
        taskBox.innerHTML = shifts
          .slice(0, 3)
          .map(function (s) {
            return (
              '<div class="task"><div><div class="task-meta">' +
              s.duration_min +
              " min</div><h3>" +
              escapeHtml(s.title) +
              "</h3><p>" +
              escapeHtml(s.description) +
              '</p></div><button type="button" class="btn btn-sm btn-mint" data-claim-shift="' +
              s.id +
              '">Claim</button></div>'
            );
          })
          .join("");
      })
      .catch(function () {
        taskBox.innerHTML =
          '<div class="task"><div><h3>Cantonese flyer check</h3><p>45 min · start the API to claim live.</p></div>' +
          '<a class="btn btn-sm btn-mint" href="volunteer.html">Open tasks</a></div>';
      });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();
