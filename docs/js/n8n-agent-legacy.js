/* Preserved version of the n8n chat experience that previously lived in index.html. */
(function () {
  if (window.__love21N8nAgentLoaded) return;
  window.__love21N8nAgentLoaded = true;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css";
  document.head.appendChild(stylesheet);

  const theme = document.createElement("style");
  theme.textContent =
    ":root{" +
    "--chat--color--primary:#e85d4c;" +
    "--chat--color--primary-shade-50:#d1503f;" +
    "--chat--color--primary--shade-100:#b84532;" +
    "--chat--color-dark:#14231f" +
    "}";
  document.head.appendChild(theme);

  import("https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js")
    .then(function (module) {
      const traditionalChinese = document.documentElement.lang === "zh-Hant";
      module.createChat({
        webhookUrl:
          "https://cllaiaj.app.n8n.cloud/webhook/78545d1e-8801-449c-a75e-5f8e0fb68ed9/chat",
        initialMessages: traditionalChinese
          ? ["你好！👋 歡迎來到 Love 21 基金會。", "今天可以怎樣幫助你？"]
          : ["Hi! 👋 Welcome to Love 21 Foundation.", "How can I help you today?"],
      });
    })
    .catch(function (error) {
      console.error("The legacy n8n agent could not be loaded.", error);
    });
})();
