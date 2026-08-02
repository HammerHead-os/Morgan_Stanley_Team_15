/* Love 21 accessibility preferences */

(function () {
  const KEY = "love21_a11y";
  const defaults = {
    fontScale: "md",
    contrast: "default",
    waveMotion: "on",
    imageFx: "on",
    underlineLinks: "off",
    spacing: "default",
  };

  function read() {
    try {
      const raw = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || "{}"));
      // Drop legacy "reduceMotion" — it was killing story image transitions
      delete raw.reduceMotion;
      // Ensure transitions default back on unless user chose Off
      if (raw.imageFx !== "off") raw.imageFx = "on";
      if (raw.waveMotion !== "off") raw.waveMotion = "on";
      return raw;
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }

  function write(prefs) {
    const clean = Object.assign({}, prefs);
    delete clean.reduceMotion;
    localStorage.setItem(KEY, JSON.stringify(clean));
  }

  function apply(prefs) {
    const root = document.documentElement;
    root.setAttribute("data-font-scale", prefs.fontScale || "md");
    root.setAttribute("data-contrast", prefs.contrast || "default");
    root.setAttribute("data-underline-links", prefs.underlineLinks || "off");
    root.setAttribute("data-spacing", prefs.spacing || "default");
    root.setAttribute("data-wave-motion", prefs.waveMotion || "on");
    root.setAttribute("data-image-fx", prefs.imageFx || "on");
    root.removeAttribute("data-reduce-motion");
  }

  const state = read();
  write(state);
  apply(state);

  function syncButtons(panel, prefs) {
    panel.querySelectorAll("[data-a11y-key]").forEach(function (btn) {
      const key = btn.getAttribute("data-a11y-key");
      const val = btn.getAttribute("data-a11y-value");
      btn.setAttribute("aria-pressed", prefs[key] === val ? "true" : "false");
    });
  }

  function initPanel() {
    const toggle = document.querySelector("[data-a11y-toggle]");
    const panel = document.querySelector("[data-a11y-panel]");
    if (!toggle || !panel) return;

    const prefs = read();
    apply(prefs);
    syncButtons(panel, prefs);

    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      const open = panel.hasAttribute("hidden");
      if (open) {
        panel.removeAttribute("hidden");
        toggle.setAttribute("aria-expanded", "true");
      } else {
        panel.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    panel.addEventListener("click", function (e) {
      e.stopPropagation();
      const reset = e.target.closest("[data-a11y-reset]");
      if (reset) {
        write(Object.assign({}, defaults));
        apply(defaults);
        syncButtons(panel, defaults);
        return;
      }
      const btn = e.target.closest("[data-a11y-key]");
      if (!btn) return;
      const key = btn.getAttribute("data-a11y-key");
      const val = btn.getAttribute("data-a11y-value");
      const next = read();
      next[key] = val;
      write(next);
      apply(next);
      syncButtons(panel, next);
    });

    document.addEventListener("click", function (e) {
      if (panel.hasAttribute("hidden")) return;
      if (panel.contains(e.target) || toggle.contains(e.target)) return;
      panel.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", "false");
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hasAttribute("hidden")) {
        panel.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPanel);
  } else {
    initPanel();
  }

  window.Love21A11y = { read: read, apply: apply, defaults: defaults };
})();
