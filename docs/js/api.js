/* Love 21 API client - Profile backend */

(function (global) {
  const TOKEN_KEY = "love21_token";
  const PERSON_KEY = "love21_person";

  function apiBase() {
    const configured = document
      .querySelector('meta[name="love21-api-base"]')
      ?.getAttribute("content")
      ?.trim();
    if (configured) return configured.replace(/\/$/, "");
    if (
      location.port === "5173" ||
      location.port === "4173" ||
      location.port === "8765" ||
      location.protocol === "file:"
    ) {
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
    global.dispatchEvent(new CustomEvent("love21:session-changed"));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PERSON_KEY);
    global.dispatchEvent(new CustomEvent("love21:session-changed"));
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

  async function login(identifier, password) {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: { identifier: identifier, password: password },
    });
    setSession(data.token, data.person);
    return data;
  }

  async function signup(body) {
    const data = await api("/api/auth/signup", {
      method: "POST",
      body: body,
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

  /* ——— Login/signup modal ——— */

  let authModalEl = null;
  let authMode = "login";
  let authPending = null; // { run, resolve, reject }

  function buildAuthModal() {
    if (authModalEl) return authModalEl;
    const overlay = document.createElement("div");
    overlay.className = "auth-modal-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="auth-modal panel-soft" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">' +
      '<button type="button" class="auth-modal-close" data-auth-close aria-label="Close">×</button>' +
      '<h2 id="auth-modal-title" data-auth-title>Log in to continue</h2>' +
      '<p class="muted" data-auth-note>Log in so we can save this to your account.</p>' +
      '<form class="contact-form stack" data-auth-form>' +
      '<label data-auth-name-field hidden>Name<input type="text" name="name" autocomplete="name" /></label>' +
      '<label>Email or phone<input type="text" name="identifier" autocomplete="username" required /></label>' +
      '<label>Password<input type="password" name="password" autocomplete="current-password" required minlength="6" /></label>' +
      '<p class="auth-modal-error" data-auth-error hidden></p>' +
      '<button type="submit" class="btn btn-primary btn-block" data-auth-submit>Log in</button>' +
      "</form>" +
      '<p class="auth-modal-switch">' +
      '<span data-auth-switch-signup>New here? <button type="button" class="link-btn" data-auth-toggle>Create an account</button></span>' +
      '<span data-auth-switch-login hidden>Already have an account? <button type="button" class="link-btn" data-auth-toggle>Log in</button></span>' +
      "</p>" +
      "</div>";
    document.body.appendChild(overlay);
    authModalEl = overlay;
    wireAuthModal(overlay);
    return overlay;
  }

  function setAuthMode(mode) {
    authMode = mode;
    const el = authModalEl;
    if (!el) return;
    const isSignup = mode === "signup";
    el.querySelector("[data-auth-title]").textContent = isSignup
      ? "Create your account"
      : "Log in to continue";
    el.querySelector("[data-auth-name-field]").hidden = !isSignup;
    el.querySelector("[data-auth-submit]").textContent = isSignup
      ? "Create account"
      : "Log in";
    el.querySelector("[data-auth-switch-signup]").hidden = isSignup;
    el.querySelector("[data-auth-switch-login]").hidden = !isSignup;
    const err = el.querySelector("[data-auth-error]");
    err.hidden = true;
    err.textContent = "";
  }

  function wireAuthModal(overlay) {
    const form = overlay.querySelector("[data-auth-form]");
    const errorEl = overlay.querySelector("[data-auth-error]");
    const submitBtn = overlay.querySelector("[data-auth-submit]");

    overlay.querySelectorAll("[data-auth-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setAuthMode(authMode === "signup" ? "login" : "signup");
      });
    });
    overlay.querySelector("[data-auth-close]").addEventListener("click", function () {
      closeAuthModal(true);
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeAuthModal(true);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeAuthModal(true);
    });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      errorEl.hidden = true;
      const fd = new FormData(form);
      const identifier = String(fd.get("identifier") || "").trim();
      const password = String(fd.get("password") || "");
      const name = String(fd.get("name") || "").trim();
      submitBtn.disabled = true;
      try {
        let data;
        if (authMode === "signup") {
          const body = { name: name, password: password };
          if (identifier.indexOf("@") >= 0) body.email = identifier;
          else body.phone = identifier;
          data = await signup(body);
        } else {
          data = await login(identifier, password);
        }
        form.reset();
        overlay.hidden = true;
        document.body.classList.remove("auth-modal-open");
        const pending = authPending;
        authPending = null;
        if (pending) {
          try {
            pending.resolve(await pending.run(data.person));
          } catch (err) {
            pending.reject(err);
          }
        }
      } catch (err) {
        errorEl.textContent = friendlyError(err);
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function openAuthModal() {
    const el = buildAuthModal();
    setAuthMode("login");
    el.querySelector("[data-auth-form]").reset();
    el.hidden = false;
    document.body.classList.add("auth-modal-open");
    const first = el.querySelector('input[name="identifier"]');
    if (first) first.focus();
  }

  function closeAuthModal(cancelled) {
    const el = authModalEl;
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove("auth-modal-open");
    if (cancelled && authPending) {
      const pending = authPending;
      authPending = null;
      const err = new Error("Login cancelled");
      err.cancelled = true;
      pending.reject(err);
    }
  }

  /**
   * Run `run(person)` now if someone is signed in; otherwise show the
   * login/signup modal and run it once they authenticate, then resolve
   * with its result. Rejects (with err.cancelled = true) if the user
   * closes the modal without logging in.
   */
  function requireLogin(run) {
    const person = getPerson();
    if (person) return Promise.resolve(run(person));
    return new Promise(function (resolve, reject) {
      authPending = { run: run, resolve: resolve, reject: reject };
      openAuthModal();
    });
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
    login: login,
    signup: signup,
    ensureLogin: ensureLogin,
    requireLogin: requireLogin,
    showToast: showToast,
    goToProfile: goToProfile,
    profileHref: profileHref,
    friendlyError: friendlyError,
  };
})(window);
