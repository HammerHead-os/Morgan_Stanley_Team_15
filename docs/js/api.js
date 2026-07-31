/* Love 21 API client - Profile backend */

(function (global) {
  const TOKEN_KEY = "love21_token";
  const PERSON_KEY = "love21_person";

  function apiBase() {
    if (location.port === "8765" || location.protocol === "file:") {
      return "http://127.0.0.1:8000";
    }
    return "";
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getPerson() {
    try {
      return JSON.parse(localStorage.getItem(PERSON_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function setSession(token, person) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(PERSON_KEY, JSON.stringify(person));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PERSON_KEY);
  }

  function friendlyError(err) {
    if (!err) return "Something went wrong";
    if (err.status === 0 || err.name === "TypeError") {
      return "Can't reach Love 21 right now. Start the local server and try again.";
    }
    return err.message || "Request failed";
  }

  async function api(path, options) {
    options = options || {};
    const headers = Object.assign(
      { "Content-Type": "application/json", Accept: "application/json" },
      options.headers || {}
    );
    const token = getToken();
    if (token) headers["X-Demo-Token"] = token;

    let res;
    try {
      res = await fetch(apiBase() + path, {
        method: options.method || "GET",
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (networkErr) {
      networkErr.status = 0;
      networkErr.message = friendlyError(networkErr);
      throw networkErr;
    }

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { detail: text };
      }
    }

    if (!res.ok) {
      const detail =
        (data && (data.detail || data.message)) || res.statusText || "Request failed";
      const err = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      err.status = res.status;
      err.data = data;
      err.message = friendlyError(err);
      throw err;
    }
    return data;
  }

  async function demoLogin(email) {
    const data = await api("/api/auth/demo-login", {
      method: "POST",
      body: { email: email },
    });
    setSession(data.token, data.person);
    return data;
  }

  /**
   * Keep the current session unless force is true.
   * Only logs in as preferredEmail when nobody is signed in (or force).
   */
  async function ensureLogin(preferredEmail, opts) {
    opts = opts || {};
    const existing = getPerson();
    if (getToken() && existing && !opts.force) {
      return existing;
    }
    const email = preferredEmail || "carer@chen.demo";
    const data = await demoLogin(email);
    return data.person;
  }

  function profileHref(hash) {
    const inPages = /\/pages\//.test(location.pathname);
    const base = inPages ? "profile.html" : "pages/profile.html";
    return base + (hash ? "#" + hash.replace(/^#/, "") : "");
  }

  function goToProfile(hash, flash) {
    if (flash) {
      try {
        sessionStorage.setItem("love21_flash", flash);
      } catch (e) {}
    }
    location.href = profileHref(hash);
  }

  function showToast(msg) {
    let toast = document.querySelector(".demo-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "demo-toast";
      toast.style.cssText =
        "position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);" +
        "background:#0c1f2e;color:#faf8f5;padding:0.85rem 1.25rem;border-radius:999px;" +
        "font-size:0.9rem;z-index:100;box-shadow:0 10px 30px rgba(0,0,0,0.2);" +
        "opacity:0;transition:opacity 0.25s;max-width:min(92vw,420px);text-align:center;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(function () {
      toast.style.opacity = "1";
    });
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      toast.style.opacity = "0";
    }, 2800);
  }

  global.Love21 = {
    api: api,
    apiBase: apiBase,
    getToken: getToken,
    getPerson: getPerson,
    setSession: setSession,
    clearSession: clearSession,
    demoLogin: demoLogin,
    ensureLogin: ensureLogin,
    showToast: showToast,
    goToProfile: goToProfile,
    profileHref: profileHref,
    friendlyError: friendlyError,
  };
})(window);
