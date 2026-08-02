/* Love 21 role-aware AI Agent */
(function () {
  if (window.__love21AgentBooted) return;
  window.__love21AgentBooted = true;

  const script = document.currentScript;
  const scriptUrl = new URL(script ? script.src : "js/agent.js", location.href);
  const assetBase = new URL("../", scriptUrl);

  if (window.LOVE21_AGENT_MODE === "n8n") {
    const legacy = document.createElement("script");
    legacy.src = new URL("n8n-agent-legacy.js", scriptUrl).href;
    document.head.appendChild(legacy);
    return;
  }

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("../css/agent.css", scriptUrl).href;
  document.head.appendChild(stylesheet);

  const TOKEN_KEY = "love21_token";
  const PERSON_KEY = "love21_person";
  const DASHBOARD_KEY = "love21.dashboard.v1";
  const conversation = [];
  let dock = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function currentPerson() {
    try {
      if (!localStorage.getItem(TOKEN_KEY)) return null;
      return JSON.parse(localStorage.getItem(PERSON_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function accessLevel() {
    const person = currentPerson();
    if (!person) return "guest";
    return Array.isArray(person.roles) && person.roles.indexOf("admin") !== -1
      ? "admin"
      : "member";
  }

  function isTraditionalChinese() {
    return document.documentElement.lang === "zh-Hant";
  }

  function copyFor(level) {
    const zh = isTraditionalChinese();
    if (zh) {
      if (level === "admin") {
        return {
          badge: "職員資料",
          welcome: "## 職員 AI 助手\n\n你可以查詢網站訪客、活動、捐款、參加者及管理儀表板內的 demo 資料。",
          suggestions: ["網站記錄了多少次瀏覽？", "總結管理儀表板", "有哪些活動參加記錄？"],
          placeholder: "查詢網站及管理資料…",
        };
      }
      if (level === "member") {
        return {
          badge: "我的帳戶",
          welcome: "## 歡迎回來\n\n你可以查詢自己的活動記錄、家庭成員、捐款、義工時數，以及公開的 Love 21 資訊。",
          suggestions: ["我的家人有哪些？", "我參加過哪些活動？", "財務報告在哪裡？"],
          placeholder: "查詢你的帳戶及 Love 21…",
        };
      }
      return {
        badge: "公開資料",
        welcome: "## 有甚麼可以幫你？\n\n你可以搜尋 Love 21 的介紹、聯絡方法、活動、財務及公開資訊。登入後可查詢個人記錄。",
        suggestions: ["財務報告在哪裡？", "有哪些活動？", "如何聯絡 Love 21？"],
        placeholder: "搜尋 Love 21…",
      };
    }

    if (level === "admin") {
      return {
        badge: "Staff data",
        welcome: "## Staff AI assistant\n\nAsk about website visits, activities, donations, people, or any demo data in the admin dashboard.",
        suggestions: ["How many website visits are recorded?", "Summarise the admin dashboard.", "Show registration totals."],
        placeholder: "Search website and staff data…",
      };
    }
    if (level === "member") {
      return {
        badge: "My account",
        welcome: "## Welcome back\n\nAsk about your activity records, family, donations, volunteer history, or any public Love 21 information.",
        suggestions: ["Which activities has my family joined?", "Show my family members.", "Where are the financial reports?"],
        placeholder: "Search your account and Love 21…",
      };
    }
    return {
      badge: "Public search",
      welcome: "## How can I help?\n\nSearch Love 21's story, contact details, programmes, finances, and other public information. Log in to search your own records.",
      suggestions: ["Where are the financial reports?", "What programmes are available?", "How can I contact Love 21?"],
      placeholder: "Search Love 21…",
    };
  }

  function robotIcon() {
    return (
      '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
      '<path d="M16 5V2.5M13.5 2.5h5" />' +
      '<rect x="6" y="8" width="20" height="16" rx="6" />' +
      '<path d="M6 15H3.5v5H6M26 15h2.5v5H26M11 27h10" />' +
      '<circle cx="12" cy="15" r="1.5" class="fill" />' +
      '<circle cx="20" cy="15" r="1.5" class="fill" />' +
      '<path d="M11.5 20c2.6 1.8 6.4 1.8 9 0" />' +
      "</svg>"
    );
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || "").split(/\r?\n/);
    const output = [];
    let paragraph = [];
    let listType = null;

    function inline(text) {
      let safe = escapeHtml(text);
      safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
      safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      safe = safe.replace(
        /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g,
        '<a href="$2">$1<span aria-hidden="true"> ↗</span></a>'
      );
      return safe;
    }

    function flushParagraph() {
      if (!paragraph.length) return;
      output.push("<p>" + paragraph.map(inline).join("<br />") + "</p>");
      paragraph = [];
    }

    function closeList() {
      if (!listType) return;
      output.push("</" + listType + ">");
      listType = null;
    }

    function openList(type) {
      if (listType === type) return;
      closeList();
      output.push("<" + type + ">");
      listType = type;
    }

    function tableCells(line) {
      let row = line.trim();
      if (row.startsWith("|")) row = row.slice(1);
      if (row.endsWith("|")) row = row.slice(0, -1);
      return row.split("|").map(function (cell) { return cell.trim(); });
    }

    function isDivider(line) {
      const cells = tableCells(line);
      return cells.length > 0 && cells.every(function (cell) {
        return /^:?-{3,}:?$/.test(cell);
      });
    }

    function renderTable(start) {
      const headings = tableCells(lines[start]);
      const rows = [];
      let index = start + 2;
      while (index < lines.length && lines[index].includes("|")) {
        const cells = tableCells(lines[index]);
        if (!cells.some(Boolean)) break;
        rows.push(cells);
        index += 1;
      }
      output.push(
        '<div class="love21-agent-table-scroll"><table><thead><tr>' +
        headings.map(function (heading) { return '<th scope="col">' + inline(heading) + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        rows.map(function (row) {
          return "<tr>" + headings.map(function (_, cellIndex) {
            return "<td>" + inline(row[cellIndex] || "") + "</td>";
          }).join("") + "</tr>";
        }).join("") +
        "</tbody></table></div>"
      );
      return index - 1;
    }

    lines.forEach(function (line, index) {
      if (line.includes("|") && isDivider(lines[index + 1] || "")) {
        flushParagraph();
        closeList();
        lines[index + 1] = "";
        const last = renderTable(index);
        for (let cursor = index; cursor <= last; cursor += 1) lines[cursor] = "";
        return;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if (heading) {
        flushParagraph(); closeList();
        const level = Math.min(4, heading[1].length + 1);
        output.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
      } else if (bullet) {
        flushParagraph(); openList("ul"); output.push("<li>" + inline(bullet[1]) + "</li>");
      } else if (ordered) {
        flushParagraph(); openList("ol"); output.push("<li>" + inline(ordered[1]) + "</li>");
      } else if (/^>\s+/.test(line)) {
        flushParagraph(); closeList(); output.push("<blockquote>" + inline(line.replace(/^>\s+/, "")) + "</blockquote>");
      } else if (!line.trim()) {
        flushParagraph(); closeList();
      } else {
        paragraph.push(line);
      }
    });
    flushParagraph();
    closeList();
    return output.join("");
  }

  function renderMessages(waiting) {
    if (!dock) return;
    const root = dock.querySelector("[data-love21-agent-messages]");
    root.innerHTML = conversation.map(function (message) {
      const body = message.role === "assistant"
        ? renderMarkdown(message.content)
        : "<p>" + escapeHtml(message.content) + "</p>";
      const trace = message.tools && message.tools.length
        ? '<div class="love21-agent-trace">' + message.tools.map(function (tool) {
            return "<span>" + escapeHtml(tool.name.replace(/_/g, " ")) + " · " + Number(tool.result_count || 0) + "</span>";
          }).join("") + "</div>"
        : "";
      const notice = message.notice
        ? '<p class="love21-agent-notice">' + escapeHtml(message.notice) + "</p>"
        : "";
      return (
        '<article class="love21-agent-message ' + message.role + '">' +
        "<small>" + (message.role === "assistant" ? "Love 21 AI" : "You") + "</small>" +
        '<div class="love21-agent-markdown">' + body + "</div>" + notice + trace +
        "</article>"
      );
    }).join("");
    if (waiting) {
      root.insertAdjacentHTML(
        "beforeend",
        '<article class="love21-agent-message assistant waiting"><small>Love 21 AI</small><p>' +
        (isTraditionalChinese() ? "正在搜尋你有權查看的資料…" : "Searching the data you can access…") +
        "</p><span class=\"love21-agent-dots\"><i></i><i></i><i></i></span></article>"
      );
    }
    root.scrollTop = root.scrollHeight;
  }

  function dashboardData() {
    if (accessLevel() !== "admin") return null;
    try {
      return JSON.parse(localStorage.getItem(DASHBOARD_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  async function apiChat(messages) {
    const body = {
      messages: messages.map(function (message) {
        return { role: message.role, content: message.content };
      }),
      client_context: {
        current_path: location.pathname + location.search + location.hash,
        dashboard_data: dashboardData(),
      },
    };
    if (window.Love21 && typeof window.Love21.api === "function") {
      return window.Love21.api("/api/agent/chat", { method: "POST", body: body });
    }
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers["X-Demo-Token"] = token;
    const response = await fetch("/api/agent/chat", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Request failed");
    return data;
  }

  function updateAccessUi(resetWelcome) {
    if (!dock) return;
    const level = accessLevel();
    const copy = copyFor(level);
    const badge = dock.querySelector("[data-love21-agent-access]");
    const input = dock.querySelector("textarea");
    badge.textContent = copy.badge;
    badge.className = "love21-agent-access " + level;
    input.placeholder = copy.placeholder;
    const suggestions = dock.querySelector("[data-love21-agent-suggestions]");
    suggestions.innerHTML = copy.suggestions.map(function (suggestion) {
      return '<button type="button">' + escapeHtml(suggestion) + "</button>";
    }).join("");
    suggestions.querySelectorAll("button").forEach(function (button) {
      button.addEventListener("click", function () {
        input.value = button.textContent;
        dock.querySelector("form").requestSubmit();
      });
    });
    if (resetWelcome || !conversation.length) {
      conversation.length = 0;
      conversation.push({ role: "assistant", content: copy.welcome });
      renderMessages(false);
    }
  }

  function setOpen(open) {
    if (!dock) return;
    const panel = dock.querySelector("[data-love21-agent-panel]");
    const launcher = dock.querySelector("[data-love21-agent-launcher]");
    panel.hidden = !open;
    launcher.hidden = open;
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) dock.querySelector("textarea").focus();
  }

  function build() {
    if (document.querySelector("[data-love21-agent]")) return;
    dock = document.createElement("aside");
    dock.className = "love21-agent";
    dock.setAttribute("data-love21-agent", "");
    dock.innerHTML =
      '<button class="love21-agent-launcher" type="button" data-love21-agent-launcher aria-label="Open Love 21 AI Agent" aria-expanded="false">' +
      robotIcon() + '<span class="love21-agent-launcher-pulse" aria-hidden="true"></span></button>' +
      '<section class="love21-agent-panel" data-love21-agent-panel hidden aria-label="Love 21 AI Agent">' +
      '<header class="love21-agent-header"><div class="love21-agent-identity"><span class="love21-agent-mini-icon">' + robotIcon() +
      '</span><div><strong>Ask Love 21</strong><span class="love21-agent-access guest" data-love21-agent-access>Public search</span></div></div>' +
      '<button class="love21-agent-close" type="button" data-love21-agent-close aria-label="Close AI Agent">×</button></header>' +
      '<div class="love21-agent-suggestions" data-love21-agent-suggestions></div>' +
      '<div class="love21-agent-messages" data-love21-agent-messages aria-live="polite"></div>' +
      '<form class="love21-agent-form"><label class="love21-agent-sr-only" for="love21-agent-question">Ask a question</label>' +
      '<textarea id="love21-agent-question" rows="2" maxlength="6000"></textarea>' +
      '<button type="submit" aria-label="Send question"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 15-7-5.5 14-2.2-5.1L4 12Z"/><path d="m11.3 13.9 3.2-3.4"/></svg></button></form>' +
      '<p class="love21-agent-footnote">Read-only demo · access follows your login</p>' +
      "</section>";
    document.body.appendChild(dock);

    dock.querySelector("[data-love21-agent-launcher]").addEventListener("click", function () { setOpen(true); });
    dock.querySelector("[data-love21-agent-close]").addEventListener("click", function () { setOpen(false); });
    const form = dock.querySelector("form");
    const input = dock.querySelector("textarea");
    const submit = form.querySelector('button[type="submit"]');
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const content = input.value.trim();
      if (!content || submit.disabled) return;
      conversation.push({ role: "user", content: content });
      input.value = "";
      submit.disabled = true;
      renderMessages(true);
      try {
        const response = await apiChat(conversation.slice(-16));
        conversation.push({
          role: "assistant",
          content: response.answer,
          tools: response.tools || [],
          notice: response.notice || "",
        });
        const serverLevel = response.access_level;
        if (serverLevel && serverLevel !== accessLevel()) {
          updateAccessUi(false);
        }
      } catch (error) {
        const routeMissing = error && (error.status === 404 || error.status === 405);
        const message = routeMissing
          ? (isTraditionalChinese()
              ? "## AI 路由尚未載入\n\n目前運行的是舊版 FastAPI 進程。請重新啟動後端，讓 `/api/agent/chat` 生效。"
              : "## The AI route is not loaded\n\nThe running FastAPI process is out of date. Restart the backend to load `/api/agent/chat`.")
          : (isTraditionalChinese()
              ? "## 暫時未能連接 AI\n\n請確認 FastAPI 服務正在運行，然後再試一次。"
              : "## I could not reach the AI service\n\nPlease make sure the FastAPI server is running, then try again.");
        conversation.push({
          role: "assistant",
          content: message,
        });
      } finally {
        submit.disabled = false;
        renderMessages(false);
        input.focus();
      }
    });
    updateAccessUi(true);
  }

  window.addEventListener("love21:session-changed", function () {
    updateAccessUi(true);
  });
  document.addEventListener("love21:languagechange", function () {
    updateAccessUi(true);
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build, { once: true });
  } else {
    build();
  }
})();
