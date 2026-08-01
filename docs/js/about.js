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
