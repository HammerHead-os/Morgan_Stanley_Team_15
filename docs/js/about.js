/* Love 21 annual-report figures */

(function () {
  const palette = ["#58c746", "#e8c20a", "#ef2b1f"];
  const financials = {
    income: {
      total: 13495000,
      values: [49, 49, 2],
      label: "Income",
    },
    expenditure: {
      total: 11490000,
      values: [86, 8, 6],
      label: "Expenditure",
    },
  };

  function sizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(240, Math.round(rect.width));
    const height = Math.max(220, Math.round(rect.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width, height };
  }

  function compactMoney(value) {
    return "HKD " + (value / 1000000).toFixed(2) + "m";
  }

  function drawDonut(canvas) {
    const kind = canvas.getAttribute("data-finance-donut");
    const data = financials[kind];
    if (!data) return;
    const { context, width, height } = sizeCanvas(canvas);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.31;
    const lineWidth = Math.max(24, radius * 0.28);
    let start = -Math.PI / 2;

    context.clearRect(0, 0, width, height);
    data.values.forEach(function (value, index) {
      const end = start + (Math.PI * 2 * value) / 100;
      context.beginPath();
      context.arc(centerX, centerY, radius, start, end);
      context.strokeStyle = palette[index];
      context.lineWidth = lineWidth;
      context.lineCap = "butt";
      context.stroke();
      start = end;
    });

    context.fillStyle = "#6f6d68";
    context.font = "600 13px Inter, Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("2024–2025", centerX, centerY - 16);
    context.fillStyle = "#191919";
    context.font = "700 17px Inter, Arial, sans-serif";
    context.fillText(data.label, centerX, centerY + 7);
    context.font = "700 14px Inter, Arial, sans-serif";
    context.fillText(compactMoney(data.total), centerX, centerY + 30);
  }

  function drawBars(canvas) {
    const { context, width, height } = sizeCanvas(canvas);
    const groups = [
      { year: "2023–24", income: 8.2506, expenditure: 6.5376 },
      { year: "2024–25", income: 13.495, expenditure: 11.49 },
    ];
    const maximum = 15;
    const top = 28;
    const bottom = 50;
    const left = 42;
    const right = 16;
    const chartHeight = height - top - bottom;
    const chartWidth = width - left - right;
    const groupWidth = chartWidth / groups.length;
    const barWidth = Math.min(58, groupWidth * 0.24);

    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#deddd9";
    context.lineWidth = 1;
    context.fillStyle = "#8f8d88";
    context.font = "11px Inter, Arial, sans-serif";
    context.textAlign = "right";

    [0, 5, 10, 15].forEach(function (tick) {
      const y = top + chartHeight - (tick / maximum) * chartHeight;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();
      context.fillText(tick + "m", left - 8, y + 4);
    });

    groups.forEach(function (group, index) {
      const center = left + groupWidth * index + groupWidth / 2;
      [
        { value: group.income, color: "#58c746", offset: -barWidth - 4 },
        { value: group.expenditure, color: "#191919", offset: 4 },
      ].forEach(function (bar) {
        const barHeight = (bar.value / maximum) * chartHeight;
        const x = center + bar.offset;
        const y = top + chartHeight - barHeight;
        context.fillStyle = bar.color;
        context.fillRect(x, y, barWidth, barHeight);
        context.fillStyle = "#191919";
        context.font = "700 11px Inter, Arial, sans-serif";
        context.textAlign = "center";
        context.fillText(bar.value.toFixed(2) + "m", x + barWidth / 2, y - 7);
      });
      context.fillStyle = "#6f6d68";
      context.font = "600 12px Inter, Arial, sans-serif";
      context.textAlign = "center";
      context.fillText(group.year, center, height - 18);
    });

    context.fillStyle = "#58c746";
    context.fillRect(width - 164, 9, 10, 10);
    context.fillStyle = "#5f5d59";
    context.font = "11px Inter, Arial, sans-serif";
    context.textAlign = "left";
    context.fillText("Income", width - 148, 18);
    context.fillStyle = "#191919";
    context.fillRect(width - 92, 9, 10, 10);
    context.fillStyle = "#5f5d59";
    context.fillText("Expenditure", width - 76, 18);
  }

  function drawAll() {
    document.querySelectorAll("[data-finance-donut]").forEach(drawDonut);
    document.querySelectorAll("[data-finance-bars]").forEach(drawBars);
  }

  drawAll();
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(drawAll);
    document.querySelectorAll(".financial-dashboard").forEach(function (element) {
      observer.observe(element);
    });
  } else {
    window.addEventListener("resize", drawAll);
  }
})();

/* Instagram-style cards for the About page's pinned and recent posts. */
(function () {
  const iconBase =
    "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/";
  const defaultUsername = "love21foundation";

  function icon(name) {
    const image = document.createElement("img");
    image.className = "instagram-ui-icon";
    image.src = iconBase + name + ".svg";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  }

  function staticPost(card) {
    const media = card.querySelector("img");
    const captionElement = card.querySelector("span");
    if (!media || !captionElement) return null;
    return {
      caption: captionElement.textContent.trim(),
      image_url: media.getAttribute("src"),
      permalink: card.getAttribute("href"),
      username: defaultUsername,
    };
  }

  function renderCard(card, post) {
    if (!post || !post.image_url || !post.permalink) return;

    const username = post.username || defaultUsername;
    const caption = (post.caption || "Instagram post").trim();

    const header = document.createElement("div");
    header.className = "instagram-post-header";

    const avatar = document.createElement("img");
    avatar.className = "instagram-avatar";
    avatar.src = "../assets/media/love21-logo.png";
    avatar.alt = "";

    const account = document.createElement("div");
    account.className = "instagram-account";
    const accountName = document.createElement("strong");
    accountName.textContent = username;
    const location = document.createElement("span");
    location.textContent = "Hong Kong";
    account.append(accountName, location);
    header.append(avatar, account, icon("three-dots-vertical"));

    const media = document.createElement("img");
    media.className = "instagram-post-media";
    media.src = post.image_url;
    media.alt = caption;
    media.loading = "lazy";
    media.decoding = "async";

    const actionRow = document.createElement("div");
    actionRow.className = "instagram-post-actions";
    const primaryActions = document.createElement("div");
    primaryActions.append(icon("heart"), icon("chat"), icon("send"));
    actionRow.append(primaryActions, icon("bookmark"));

    const copy = document.createElement("div");
    copy.className = "instagram-post-copy";
    const captionText = document.createElement("p");
    const captionAccount = document.createElement("strong");
    captionAccount.textContent = username;
    captionText.append(captionAccount, document.createTextNode(" " + caption));
    const postLink = document.createElement("span");
    postLink.className = "instagram-post-meta";
    postLink.textContent = "View post on Instagram";
    copy.append(captionText, postLink);

    card.href = post.permalink;
    card.classList.add("instagram-post-card");
    card.setAttribute("aria-label", caption + ". Open this post on Instagram.");
    if (post.id) card.dataset.instagramMediaId = post.id;
    card.replaceChildren(header, media, actionRow, copy);
  }

  function renderRow(name, posts) {
    if (!posts || !posts.length) return;
    const row = document.querySelector('[data-instagram-row="' + name + '"]');
    if (!row) return;
    const cards = Array.from(row.querySelectorAll(".social-wall-about > a"));
    cards.forEach(function (card, index) {
      if (posts[index]) {
        card.hidden = false;
        renderCard(card, posts[index]);
      } else {
        card.hidden = true;
      }
    });
  }

  const cards = Array.from(
    document.querySelectorAll(".social-wall-about > a")
  );
  cards.forEach(function (card) {
    renderCard(card, staticPost(card));
  });

  if (!window.Love21 || typeof window.Love21.api !== "function") return;
  window.Love21.api("/api/instagram/posts")
    .then(function (feed) {
      if (!feed || !feed.connected) return;
      if (feed.pinned && feed.pinned.length) {
        renderRow("pinned", feed.pinned);
      }
      renderRow("recent", feed.recent);
    })
    .catch(function () {
      // The static posts above are the intentional offline/API-error fallback.
    });
})();
