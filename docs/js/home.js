/* Home interactions: hire + needs + task preview */

(function () {
  const L = window.Love21;

  function toast(msg) {
    if (L) L.showToast(msg);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function volunteerHref() {
    return /\/pages\//.test(location.pathname)
      ? "volunteer.html"
      : "pages/volunteer.html";
  }

  function loadHomeTasks() {
    const taskBox = document.querySelector("[data-home-tasks]");
    if (!taskBox || !L) return;
    const skillLabels = {
      cantonese: "Cantonese reading",
      photos: "basic photo sorting",
      voice: "phone mic, English or Cantonese",
      sports: "on-site sports help",
    };
    function pointsGiven(mins) {
      if (mins <= 15) return 20;
      if (mins <= 30) return 35;
      if (mins <= 45) return 40;
      return mins + 5;
    }
    L.api("/api/volunteers/shifts")
      .then(function (shifts) {
        taskBox.innerHTML = shifts
          .slice(0, 3)
          .map(function (s) {
            const skill = String(s.skills_needed || "")
              .split(",")
              .map(function (x) {
                x = x.trim().toLowerCase();
                return skillLabels[x] || x;
              })
              .filter(Boolean)
              .join(", ");
            return (
              '<div class="task"><div><div class="task-meta">' +
              s.duration_min +
              " min</div><h3>" +
              escapeHtml(s.title) +
              "</h3><p>" +
              escapeHtml(s.description) +
              "</p>" +
              (skill
                ? '<p class="task-meta-line">Skills needed: ' +
                  escapeHtml(skill) +
                  "</p>"
                : "") +
              '<p class="task-meta-line">Points given: ' +
              pointsGiven(s.duration_min) +
              '</p></div><button type="button" class="btn btn-sm btn-mint" data-claim-shift="' +
              s.id +
              '">Claim</button></div>'
            );
          })
          .join("");
      })
      .catch(function () {
        taskBox.innerHTML =
          '<div class="task"><div><h3>Cantonese flyer check</h3>' +
          "<p>Proofread banquet flyers.</p>" +
          '<p class="task-meta-line">Skills needed: Cantonese reading</p>' +
          '<p class="task-meta-line">Points given: 20</p></div>' +
          '<a class="btn btn-sm btn-mint" href="' +
          volunteerHref() +
          '">Open tasks</a></div>';
      });
  }

  window.loadHomeTasks = loadHomeTasks;

  // Hire: click person → show date/time slots
  document.addEventListener("click", function (e) {
    const select = e.target.closest("[data-hire-select]");
    if (select) {
      e.preventDefault();
      const person = select.closest("[data-hire-person]");
      if (!person) return;
      document.querySelectorAll("[data-hire-person]").forEach(function (card) {
        const slots = card.querySelector("[data-hire-slots]");
        if (!slots) return;
        if (card === person) {
          const open = slots.hidden;
          slots.hidden = !open;
          card.classList.toggle("open", open);
        } else {
          slots.hidden = true;
          card.classList.remove("open");
        }
      });
      return;
    }
  });

  document.addEventListener("click", async function (e) {
    const hire = e.target.closest("[data-hire]");
    if (hire) {
      e.preventDefault();
      const label = hire.getAttribute("data-hire");
      const card =
        hire.closest("[data-hire-person]") ||
        hire.closest(".creator") ||
        hire.closest("article") ||
        hire.parentElement;
      const dateSel = card ? card.querySelector("[data-hire-date]") : null;
      const preferred = dateSel ? dateSel.value : "";
      if (dateSel && !preferred) {
        toast("Pick a date and time first");
        return;
      }
      if (!L) {
        toast("Request noted for " + label + (preferred ? " · " + preferred : ""));
        return;
      }
      try {
        if (!L.getPerson()) {
          await L.ensureLogin("donor@demo.love21");
        }
        await L.api("/api/hire", {
          method: "POST",
          body: { creator_label: label, preferred_date: preferred || null },
        });
        if (typeof L.goToProfile === "function") {
          L.goToProfile(
            null,
            "Request sent for " + label + (preferred ? " · " + preferred : "")
          );
        } else {
          toast("Request sent for " + label);
        }
      } catch (err) {
        toast(L.friendlyError ? L.friendlyError(err) : err.message);
      }
      return;
    }
    const need = e.target.closest("[data-need-help]");
    if (need) {
      e.preventDefault();
      toast("Got it. Noted: " + need.getAttribute("data-need-help"));
    }
  });

  if (document.querySelector("[data-home-tasks]")) {
    loadHomeTasks();
  }
})();
