/* 90-second mini-game â€” local barriers â†’ Love 21 path */

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
          note: "Thatâ€™s the old way â€” word-of-mouth only.",
        },
        {
          t: "They filter classes online and join a waitlist with reminders",
          next: 1,
          note: "Love 21 path: Activity Finder + email reminders.",
          good: true,
        },
      ],
    },
    {
      q: "An office wants to â€œdo CSRâ€ this quarter. Whatâ€™s the useful move?",
      choices: [
        {
          t: "Share a sad post and a donate link",
          next: 2,
          note: "That doesnâ€™t create ongoing work for members.",
        },
        {
          t: "Book a member-led kitchen or yoga session for the team",
          next: 2,
          note: "Companies hire creators from the marketplace.",
          good: true,
        },
      ],
    },
    {
      q: "Someone has 20 free minutes on the MTR. How do they help?",
      choices: [
        {
          t: "Promise an all-day Saturday shift they canâ€™t keep",
          next: 3,
          note: "Long shifts scare busy Hongkongers off.",
        },
        {
          t: "Claim a 15-min micro-task (flyer check / photo sort)",
          next: 3,
          note: "Micro-tasks + badge. Done before the next stop.",
          good: true,
        },
      ],
    },
    {
      q: "A donor is about to bounce at a long form. Fix it?",
      choices: [
        {
          t: "Ask them to fill a long donation form",
          next: "end",
          note: "Many people drop off there.",
        },
        {
          t: "Show the tax-adjusted cost and pay with PayMe",
          next: "end",
          note: "Tax calculator + one-tap pay on the Give page.",
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
        '<p class="game-progress">Done Â· ' +
        score +
        "/" +
        steps.length +
        " capability moves</p>" +
        "<h3>Youâ€™re through the barriers</h3>" +
        "<p class=\"muted\">Pick a real next step â€” hire talent, claim a task, or give with tax math.</p>" +
        '<div class="game-choices">' +
        '<a class="btn btn-primary" href="explore.html#marketplace">Hire a creator</a>' +
        '<a class="btn btn-mint" href="volunteer.html">15-min task</a>' +
        '<a class="btn btn-yellow" href="impact.html">Give Â· tax saver</a>' +
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
