/* Short walkthrough */

(function () {
  const root = document.querySelector("[data-game]");
  if (!root) return;

  const steps = [
    {
      q: "A family wants a Saturday swim class. The WhatsApp group is full and nobody replies. What happens?",
      choices: [
        {
          t: "They wait months with no status",
          next: 1,
          note: "That is the old WhatsApp loop.",
        },
        {
          t: "They filter classes online and join a waitlist with reminders",
          next: 1,
          note: "Use Activity Finder and get waitlist emails.",
          good: true,
        },
      ],
    },
    {
      q: "An office wants to \"do CSR\" this quarter. What's the useful move?",
      choices: [
        {
          t: "Share a sad post and a donate link",
          next: 2,
          note: "That does not create real work for members.",
        },
        {
          t: "Book a member-led kitchen or yoga session for the team",
          next: 2,
          note: "Book a member through the marketplace.",
          good: true,
        },
      ],
    },
    {
      q: "Someone has 20 free minutes on the MTR. How do they help?",
      choices: [
        {
          t: "Promise an all-day Saturday shift they can't keep",
          next: 3,
          note: "Big Saturday shifts are hard to keep.",
        },
        {
          t: "Claim a 15-min task (flyer check or photo sort)",
          next: 3,
          note: "Short task. Done before your next stop.",
          good: true,
        },
      ],
    },
    {
      q: "A donor hits a long donation form. What helps?",
      choices: [
        {
          t: "Ask them to fill a long donation form",
          next: "end",
          note: "Long forms lose people.",
        },
        {
          t: "Show the tax-adjusted cost and pay with PayMe",
          next: "end",
          note: "Tax estimate and PayMe on the Give page.",
          good: true,
        },
      ],
    },
  ];

  let i = 0;
  let score = 0;

  function render() {
    if (i === "end" || i >= steps.length) {
      root.innerHTML =
        '<p class="game-progress">Done · ' +
        score +
        "/" +
        steps.length +
        " right picks</p>" +
        "<h3>Nice. Next step?</h3>" +
        "<p class=\"muted\">Hire someone, claim a short task, or start a monthly gift.</p>" +
        '<div class="game-choices">' +
        '<a class="btn btn-primary" href="explore.html#marketplace">Hire someone</a>' +
        '<a class="btn btn-mint" href="volunteer.html">Short task</a>' +
        '<a class="btn btn-yellow" href="impact.html">Give monthly</a>' +
        "</div>";
      return;
    }

    const step = steps[i];
    root.innerHTML =
      '<p class="game-progress">Beat ' +
      (i + 1) +
      " / " +
      steps.length +
      "</p>" +
      "<h3>" +
      step.q +
      "</h3>" +
      '<div class="game-choices">' +
      step.choices
        .map(function (c, idx) {
          return (
            '<button type="button" class="game-choice" data-choice="' +
            idx +
            '">' +
            c.t +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  }

  root.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-choice]");
    if (!btn) return;
    const step = steps[i];
    const choice = step.choices[Number(btn.getAttribute("data-choice"))];
    if (choice.good) score += 1;
    if (window.Love21) window.Love21.showToast(choice.note);
    i = choice.next === "end" ? "end" : choice.next;
    setTimeout(render, 350);
  });

  render();
})();
