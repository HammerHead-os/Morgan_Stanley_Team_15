/* About page · looping picture→pixel preview */

(function () {
  const canvas = document.getElementById("about-dust-preview");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const URLS = [
    "https://picsum.photos/seed/aboutpix1/600/800",
    "https://picsum.photos/seed/aboutpix2/600/800",
    "https://picsum.photos/seed/aboutpix3/600/800",
    "https://picsum.photos/seed/aboutpix4/600/800",
  ];

  const CAP = 2200;
  const STEP = 4;
  let w = canvas.width;
  let h = canvas.height;
  let particles = [];
  let targets = [];
  let index = 0;
  let morph = null;
  let ready = false;

  function load(src) {
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

  function fit(img) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const o = off.getContext("2d");
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    o.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return off;
  }

  function fallback(i) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const o = off.getContext("2d");
    o.fillStyle = i % 2 ? "#0d7c6b" : "#e85d4c";
    o.fillRect(0, 0, w, h);
    o.fillStyle = "rgba(255,255,255,0.25)";
    o.beginPath();
    o.arc(w * 0.5, h * 0.45, 80 + i * 10, 0, Math.PI * 2);
    o.fill();
    return off;
  }

  function sample(c) {
    const d = c.getContext("2d").getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y += STEP) {
      for (let x = 0; x < w; x += STEP) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 40) continue;
        pts.push({
          x: x,
          y: y,
          r: d[i],
          g: d[i + 1],
          b: d[i + 2],
          size: 1.4 + (d[i] / 255) * 1.8,
        });
      }
    }
    if (pts.length > CAP) {
      const keep = [];
      const stride = Math.ceil(pts.length / CAP);
      for (let i = 0; i < pts.length; i += stride) keep.push(pts[i]);
      return { pts: keep, canvas: c };
    }
    return { pts: pts, canvas: c };
  }

  function make(pts) {
    return pts.map(function (p) {
      return {
        x: p.x,
        y: p.y,
        tx: p.x,
        ty: p.y,
        vx: 0,
        vy: 0,
        r: p.r,
        g: p.g,
        b: p.b,
        tr: p.r,
        tg: p.g,
        tb: p.b,
        size: p.size,
        tsize: p.size,
        dust: 0,
      };
    });
  }

  function align(nextPts) {
    while (particles.length < nextPts.length) {
      const s = particles[0] || {
        x: w / 2,
        y: h / 2,
        r: 100,
        g: 100,
        b: 100,
        size: 1.5,
      };
      particles.push({
        x: s.x,
        y: s.y,
        tx: s.x,
        ty: s.y,
        vx: 0,
        vy: 0,
        r: s.r,
        g: s.g,
        b: s.b,
        tr: s.r,
        tg: s.g,
        tb: s.b,
        size: s.size,
        tsize: s.size,
        dust: 0,
      });
    }
    if (particles.length > nextPts.length) particles.length = nextPts.length;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const t = nextPts[i];
      p.tx = t.x;
      p.ty = t.y;
      p.tr = t.r;
      p.tg = t.g;
      p.tb = t.b;
      p.tsize = t.size;
    }
  }

  function go(next) {
    const t = targets[next];
    if (!t) return;
    align(t.pts);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 10;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.dust = 1;
    }
    morph = {
      t: 0,
      duration: 1.25,
      from: targets[index].canvas,
      to: t.canvas,
    };
    index = next;
  }

  function step(dt) {
    if (!morph) return;
    morph.t += dt / morph.duration;
    const u = Math.min(1, morph.t);
    const explode = u < 0.45;
    const at = explode ? 0 : (u - 0.45) / 0.55;
    const ease = at * at * (3 - 2 * at);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (explode) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.dust = 1;
      } else {
        p.x += (p.tx - p.x) * (0.1 + ease * 0.25);
        p.y += (p.ty - p.y) * (0.1 + ease * 0.25);
        p.r += (p.tr - p.r) * 0.15;
        p.g += (p.tg - p.g) * 0.15;
        p.b += (p.tb - p.b) * 0.15;
        p.size += (p.tsize - p.size) * 0.15;
        p.dust = 1 - ease;
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
        p.dust = 0;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const under = morph
      ? morph.t < 0.45
        ? morph.from
        : morph.to
      : targets[index]
        ? targets[index].canvas
        : null;
    if (under) {
      let a = 0.4;
      if (morph) {
        const u = Math.min(1, morph.t);
        a = u < 0.45 ? 0.4 * (1 - u / 0.45) : 0.1 + 0.3 * ((u - 0.45) / 0.55);
      }
      ctx.globalAlpha = a;
      ctx.drawImage(under, 0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const dust = p.dust || 0;
      ctx.fillStyle =
        "rgba(" +
        (p.r | 0) +
        "," +
        (p.g | 0) +
        "," +
        (p.b | 0) +
        "," +
        (0.45 + (1 - dust) * 0.5) +
        ")";
      const s = p.size * (1 + dust * 2);
      if (dust > 0.2) ctx.fillRect(p.x, p.y, s, s);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  let last = performance.now();
  let hold = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (ready) {
      if (!morph) {
        hold += dt;
        if (hold > 2.2) {
          hold = 0;
          go((index + 1) % targets.length);
        }
      } else step(dt);
      draw();
    }
    requestAnimationFrame(loop);
  }

  async function init() {
    const imgs = await Promise.all(URLS.map(load));
    targets = imgs.map(function (img, i) {
      return sample(img ? fit(img) : fallback(i));
    });
    particles = make(targets[0].pts);
    ready = true;
    requestAnimationFrame(loop);
  }

  init();
})();
