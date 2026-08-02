/* Picture → dust cloud → next picture (side stage) */

(function () {
  const canvas = document.getElementById("dust-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const progressEl = document.querySelector("[data-story-progress]");
  const markEl = document.querySelector("[data-story-mark]");
  const hintEl = document.querySelector("[data-stage-hint]");
  const beats = Array.prototype.slice.call(
    document.querySelectorAll(".story-beat[data-scene]")
  );

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const CUTOUT_URLS = [
    "../img/story/1.png",
    "../img/story/2.png",
    "../img/story/3.png",
    "../img/story/4.png",
    "../img/story/5.png",
  ];

  const PLACEHOLDER_URLS = [];

  const SCENE_COUNT = 5;
  // Dense enough to read as dust, light enough to animate smoothly
  const PARTICLE_CAP = 28000;
  const SAMPLE_STEP = 1;

  // Morph phases (share of total duration)
  const EXPLODE_END = 0.38;
  const HOLD_END = 0.48;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let particles = [];
  let sceneIndex = 0;
  let morph = null;
  let targets = [];
  let images = [];
  let ready = false;

  function resize() {
    const stage = canvas.parentElement;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = stage.clientWidth || 400;
    h = stage.clientHeight || 600;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ready) {
      rebuildTargets();
      snapToScene(sceneIndex);
    }
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  function drawImageFitted(img, cw, ch) {
    const off = document.createElement("canvas");
    off.width = cw;
    off.height = ch;
    const o = off.getContext("2d");
    o.clearRect(0, 0, cw, ch);
    const pad = 0.86;
    const scale = Math.min((cw * pad) / img.width, (ch * pad) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    o.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    return off;
  }

  function makeFallback(index, cw, ch) {
    const off = document.createElement("canvas");
    off.width = cw;
    off.height = ch;
    const o = off.getContext("2d");
    const colors = [
      [13, 124, 107],
      [232, 93, 76],
      [9, 92, 80],
      [61, 82, 76],
      [200, 120, 100],
      [20, 35, 31],
    ];
    const [r, g, b] = colors[index % colors.length];
    const cx = cw * 0.5;
    const cy = ch * 0.52;
    const s = Math.min(cw, ch) * 0.4;
    o.clearRect(0, 0, cw, ch);
    o.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
    o.beginPath();
    switch (index % 6) {
      case 0:
        o.ellipse(cx, cy - s * 0.55, s * 0.28, s * 0.28, 0, 0, Math.PI * 2);
        o.moveTo(cx, cy - s * 0.25);
        o.bezierCurveTo(
          cx - s * 0.55,
          cy - s * 0.1,
          cx - s * 0.5,
          cy + s * 0.7,
          cx - s * 0.2,
          cy + s * 0.85
        );
        o.lineTo(cx + s * 0.2, cy + s * 0.85);
        o.bezierCurveTo(
          cx + s * 0.5,
          cy + s * 0.7,
          cx + s * 0.55,
          cy - s * 0.1,
          cx,
          cy - s * 0.25
        );
        break;
      case 1:
        o.moveTo(cx, cy + s * 0.55);
        o.bezierCurveTo(
          cx - s * 1.1,
          cy - s * 0.1,
          cx - s * 0.35,
          cy - s * 0.95,
          cx,
          cy - s * 0.35
        );
        o.bezierCurveTo(
          cx + s * 0.35,
          cy - s * 0.95,
          cx + s * 1.1,
          cy - s * 0.1,
          cx,
          cy + s * 0.55
        );
        break;
      case 2:
        for (let i = 0; i < 4; i++) {
          const bw = s * 0.28;
          const bh = s * (0.35 + i * 0.18);
          o.rect(cx - s * 0.7 + i * (bw + s * 0.08), cy + s * 0.5 - bh, bw, bh);
        }
        break;
      case 3:
        o.arc(cx - s * 0.15, cy, s * 0.7, -0.2, Math.PI * 1.1);
        o.lineTo(cx + s * 0.55, cy + s * 0.35);
        o.quadraticCurveTo(cx, cy + s * 0.1, cx - s * 0.15, cy);
        break;
      case 4:
        o.ellipse(cx - s * 0.35, cy - s * 0.35, s * 0.2, s * 0.2, 0, 0, Math.PI * 2);
        o.ellipse(cx + s * 0.35, cy - s * 0.25, s * 0.18, s * 0.18, 0, 0, Math.PI * 2);
        o.moveTo(cx - s * 0.55, cy + s * 0.7);
        o.quadraticCurveTo(cx - s * 0.35, cy, cx - s * 0.15, cy + s * 0.7);
        o.lineTo(cx + s * 0.15, cy + s * 0.7);
        o.quadraticCurveTo(cx + s * 0.35, cy + s * 0.05, cx + s * 0.55, cy + s * 0.7);
        o.closePath();
        break;
      default:
        o.rect(cx - s * 0.55, cy - s * 0.2, s * 1.1, s * 0.95);
        o.rect(cx - s * 0.35, cy - s * 0.75, s * 0.7, s * 0.55);
        break;
    }
    o.fill();
    return off;
  }

  function samplePixels(sourceCanvas) {
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    const data = sourceCanvas.getContext("2d").getImageData(0, 0, sw, sh).data;
    const pts = [];
    for (let y = 0; y < sh; y += SAMPLE_STEP) {
      for (let x = 0; x < sw; x += SAMPLE_STEP) {
        const i = (y * sw + x) * 4;
        const a = data[i + 3];
        if (a < 40) continue;
        pts.push({
          x: (x / sw) * w,
          y: (y / sh) * h,
          r: data[i],
          g: data[i + 1],
          b: data[i + 2],
          size: 0.55 + (a / 255) * 0.35,
        });
      }
    }
    if (pts.length > PARTICLE_CAP) {
      const keep = [];
      const stride = Math.ceil(pts.length / PARTICLE_CAP);
      for (let i = 0; i < pts.length; i += stride) keep.push(pts[i]);
      return { pts: keep, canvas: sourceCanvas };
    }
    return { pts: pts, canvas: sourceCanvas };
  }

  function sceneSource(index) {
    const cw = Math.max(240, Math.floor(w));
    const ch = Math.max(320, Math.floor(h));
    const img = images[index];
    if (img) return drawImageFitted(img, cw, ch);
    return makeFallback(index, cw, ch);
  }

  function rebuildTargets() {
    targets = [];
    for (let i = 0; i < SCENE_COUNT; i++) {
      targets.push(samplePixels(sceneSource(i)));
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function makeParticles(pts) {
    return pts.map(function (p) {
      return {
        x: p.x,
        y: p.y,
        ox: p.x,
        oy: p.y,
        mx: p.x,
        my: p.y,
        tx: p.x,
        ty: p.y,
        vx: 0,
        vy: 0,
        r: p.r,
        g: p.g,
        b: p.b,
        or: p.r,
        og: p.g,
        ob: p.b,
        tr: p.r,
        tg: p.g,
        tb: p.b,
        size: p.size,
        osize: p.size,
        tsize: p.size,
      };
    });
  }

  function beginMorph(nextIndex) {
    if (!ready || nextIndex === sceneIndex) return;
    const from = targets[sceneIndex];
    const next = targets[nextIndex];
    if (!next || !next.pts.length) return;

    // Accessibility: skip particle morph / image transitions
    if (document.documentElement.getAttribute("data-image-fx") === "off") {
      snapToScene(nextIndex);
      return;
    }

    // Always start from a clean sample of the current image
    const fromPts = from && from.pts.length ? from.pts : next.pts;
    particles = makeParticles(fromPts);

    const dest = shuffle(next.pts.slice());
    const n = Math.max(particles.length, dest.length);

    while (particles.length < n) {
      const src = fromPts[particles.length % fromPts.length];
      particles.push({
        x: src.x,
        y: src.y,
        ox: src.x,
        oy: src.y,
        mx: src.x,
        my: src.y,
        tx: src.x,
        ty: src.y,
        vx: 0,
        vy: 0,
        r: src.r,
        g: src.g,
        b: src.b,
        or: src.r,
        og: src.g,
        ob: src.b,
        tr: src.r,
        tg: src.g,
        tb: src.b,
        size: src.size,
        osize: src.size,
        tsize: src.size,
      });
    }
    if (particles.length > n) particles.length = n;
    while (dest.length < n) {
      const t = next.pts[dest.length % next.pts.length];
      dest.push(t);
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const t = dest[i];
      p.ox = p.x;
      p.oy = p.y;
      p.or = p.r;
      p.og = p.g;
      p.ob = p.b;
      p.osize = p.size;
      p.tx = t.x;
      p.ty = t.y;
      p.tr = t.r;
      p.tg = t.g;
      p.tb = t.b;
      p.tsize = t.size;

      const angle = Math.random() * Math.PI * 2;
      const burst = 18 + Math.random() * 55;
      p.vx = Math.cos(angle) * burst;
      p.vy = Math.sin(angle) * burst * 0.85 - 8 - Math.random() * 18;
      // Mid-cloud waypoint (where dust hangs before reforming)
      p.mx = p.ox + p.vx * 0.42 + (Math.random() - 0.5) * 40;
      p.my = p.oy + p.vy * 0.42 + (Math.random() - 0.5) * 40;
    }

    morph = {
      t: 0,
      duration: reduceMotion ? 0.01 : 0.92,
      fromBg: from ? from.canvas : null,
      toBg: next.canvas,
    };
    sceneIndex = nextIndex;
    if (hintEl) {
      hintEl.textContent =
        "Pixels · " + String(nextIndex + 1).padStart(2, "0");
    }
  }

  function snapToScene(index) {
    const t = targets[index];
    if (!t) return;
    sceneIndex = index;
    particles = makeParticles(t.pts);
    morph = null;
    if (hintEl) {
      hintEl.textContent = "Pixels · " + String(index + 1).padStart(2, "0");
    }
  }

  function stepMorph(dt) {
    if (!morph) return;
    morph.t += dt / morph.duration;
    const u = Math.min(1, morph.t);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (u < EXPLODE_END) {
        // Image → dust: fly out from original pixel
        const te = easeOutCubic(u / EXPLODE_END);
        p.x = p.ox + (p.mx - p.ox) * te;
        p.y = p.oy + (p.my - p.oy) * te;
        p.r = p.or;
        p.g = p.og;
        p.b = p.ob;
        p.size = p.osize * (1 - te * 0.35) + 0.55;
      } else if (u < HOLD_END) {
        // Brief dust cloud drift
        const th = (u - EXPLODE_END) / (HOLD_END - EXPLODE_END);
        p.x = p.mx + Math.sin(th * Math.PI * 2 + i) * 2.5;
        p.y = p.my + Math.cos(th * Math.PI * 2 + i * 0.7) * 2.5;
        p.size = 0.55 + 0.35;
      } else {
        // Dust → next image
        const ta = easeInOutCubic((u - HOLD_END) / (1 - HOLD_END));
        p.x = p.mx + (p.tx - p.mx) * ta;
        p.y = p.my + (p.ty - p.my) * ta;
        p.r = p.or + (p.tr - p.or) * ta;
        p.g = p.og + (p.tg - p.og) * ta;
        p.b = p.ob + (p.tb - p.ob) * ta;
        p.size = 0.55 + (p.tsize - 0.55) * ta;
      }
    }

    if (u >= 1) {
      morph = null;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x = p.tx;
        p.y = p.ty;
        p.r = p.tr;
        p.g = p.tg;
        p.b = p.tb;
        p.size = p.tsize;
      }
    }
  }

  let dustBuf = null;
  let dustData = null;
  let dustCanvas = null;
  let dustCtx = null;
  let dustW = 0;
  let dustH = 0;

  function ensureDustBuf() {
    const bw = Math.max(1, w | 0);
    const bh = Math.max(1, h | 0);
    if (!dustBuf || dustW !== bw || dustH !== bh) {
      dustW = bw;
      dustH = bh;
      dustCanvas = document.createElement("canvas");
      dustCanvas.width = bw;
      dustCanvas.height = bh;
      dustCtx = dustCanvas.getContext("2d");
      dustBuf = dustCtx.createImageData(bw, bh);
      dustData = dustBuf.data;
    }
  }

  function drawFrame() {
    ctx.clearRect(0, 0, w, h);

    const settled = !morph;
    const u = morph ? Math.min(1, morph.t) : 0;

    let under = null;
    let underA = 0;
    if (settled) {
      under = targets[sceneIndex] ? targets[sceneIndex].canvas : null;
      underA = 1;
    } else if (u < EXPLODE_END) {
      under = morph.fromBg;
      underA = 1 - easeOutCubic(u / EXPLODE_END);
    } else if (u > HOLD_END) {
      under = morph.toBg;
      const ta = easeInOutCubic((u - HOLD_END) / (1 - HOLD_END));
      underA = ta * ta;
    }

    if (under && underA > 0.02) {
      ctx.globalAlpha = underA;
      ctx.drawImage(under, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    if (!settled) {
      let dustA = 1;
      if (u < 0.12) dustA = u / 0.12;
      else if (u > 0.88) dustA = (1 - u) / 0.12;
      const alpha = (230 * dustA) | 0;

      ensureDustBuf();
      dustData.fill(0);
      const bw = dustW;
      const bh = dustH;
      const data = dustData;
      const n = particles.length;

      for (let i = 0; i < n; i++) {
        const p = particles[i];
        const x = p.x | 0;
        const y = p.y | 0;
        if (x < 0 || y < 0 || x >= bw || y >= bh) continue;
        const idx = (y * bw + x) << 2;
        data[idx] = p.r | 0;
        data[idx + 1] = p.g | 0;
        data[idx + 2] = p.b | 0;
        data[idx + 3] = alpha;
      }
      dustCtx.putImageData(dustBuf, 0, 0);
      ctx.drawImage(dustCanvas, 0, 0);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stepMorph(dt);
    drawFrame();
    requestAnimationFrame(loop);
  }

  function setActiveBeat(el) {
    beats.forEach(function (b) {
      b.classList.toggle("is-active", b === el);
    });
    if (!el) return;
    const scene = Number(el.getAttribute("data-scene") || 0);
    const mark = el.getAttribute("data-mark");
    if (markEl && mark) markEl.textContent = mark;
    beginMorph(Math.min(scene, SCENE_COUNT - 1));
  }

  function onScroll() {
    if (progressEl) {
      const story = document.getElementById("story");
      let p = 0;
      if (story) {
        const total = story.offsetHeight - window.innerHeight;
        const scrolled = -story.getBoundingClientRect().top;
        p = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
      } else {
        const max =
          document.documentElement.scrollHeight - window.innerHeight;
        p = max > 0 ? window.scrollY / max : 0;
      }
      progressEl.style.width = Math.round(p * 1000) / 10 + "%";
    }

    let best = beats[0];
    let bestScore = Infinity;
    const mid = window.innerHeight * 0.42;
    beats.forEach(function (b) {
      const rect = b.getBoundingClientRect();
      const center = rect.top + rect.height * 0.35;
      const dist = Math.abs(center - mid);
      if (dist < bestScore) {
        bestScore = dist;
        best = b;
      }
    });
    if (best && !best.classList.contains("is-active")) setActiveBeat(best);
    else if (best) best.classList.add("is-active");
  }

  async function init() {
    resize();
    window.addEventListener("resize", resize);

    images = [];
    for (let i = 0; i < SCENE_COUNT; i++) {
      const src = CUTOUT_URLS[i] || PLACEHOLDER_URLS[i];
      images[i] = src ? await loadImage(src) : null;
    }

    rebuildTargets();
    ready = true;
    snapToScene(0);
    if (beats[0]) beats[0].classList.add("is-active");
    last = performance.now();
    requestAnimationFrame(loop);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  init();
})();
