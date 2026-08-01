/* Park walk · 4 levels → find the correct bag */

(function () {
  const shell = document.querySelector("[data-sim-immerse]");
  if (!shell) return;
  if (shell.parentElement !== document.body) {
    document.body.appendChild(shell);
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const timerEl = shell.querySelector("[data-sim-timer]");
  const clockWrap = timerEl ? timerEl.parentElement : null;
  const debrief = shell.querySelector("[data-sim-debrief]");
  const resultEl = shell.querySelector("[data-sim-result]");
  const reflectEl = shell.querySelector("[data-sim-reflect]");
  const room = shell.querySelector('[data-room="autism"]');
  const titleEl = shell.querySelector("[data-sim-title]");

  let left = 180;
  let tick = null;
  let raf = null;
  let playing = false;

  let audioCtx = null;
  let masterGain = null;
  let crowdGain = null;
  let crowdSrc = null;
  let lastTalk = 0;
  let lastStep = 0;

  const keys = Object.create(null);

  // Park path along +Z. Four bands.
  const LEVELS = [
    {
      id: 1,
      z0: -2,
      z1: 4,
      title: "Level 1 · Crowd",
      hint: "Walk through the people. It gets loud — keep going.",
    },
    {
      id: 2,
      z0: 4,
      z1: 10,
      title: "Level 2 · Haze",
      hint: "Colours get soft and hard to read. Follow the path.",
    },
    {
      id: 3,
      z0: 10,
      z1: 16,
      title: "Level 3 · Dodging",
      hint: "People keep crossing. Move around them.",
    },
    {
      id: 4,
      z0: 16,
      z1: 24,
      title: "Level 4 · Find your bag",
      hint: "Walk up to your bag and press E (or click).",
    },
  ];

  const BAG_CLUE = "Your bag: yellow, with a red 21 on the front";

  const crowdPeople = [
    { x: -2.2, z: 0.2, shirt: "#c44b3c" },
    { x: 1.8, z: 0.8, shirt: "#3d6fb8" },
    { x: -0.5, z: 1.6, shirt: "#2f9e6d" },
    { x: 2.4, z: 2.4, shirt: "#d4a017" },
    { x: -2.6, z: 2.8, shirt: "#7a4fb0" },
    { x: 0.8, z: 3.4, shirt: "#e8743b" },
  ];

  const WALKER_SHIRTS = [
    "#4a90a8",
    "#a85a4a",
    "#5aa86a",
    "#8a5aa8",
    "#c44b3c",
    "#3d6fb8",
    "#d4a017",
    "#e8743b",
  ];

  let walkers = [];

  // Level 4 — many similar bags; only one is correct
  const bags = [
    { x: -3.6, z: 19.6, color: "#f5d76e", label: "Yellow", mark: null, correct: false },
    { x: -1.8, z: 20.2, color: "#e8a838", label: "Gold", mark: null, correct: false },
    { x: 0, z: 19.4, color: "#f0c020", label: "Yellow", mark: "12", correct: false },
    { x: 1.8, z: 20.4, color: "#f0c020", label: "Yellow", mark: "21", correct: true },
    { x: 3.6, z: 19.7, color: "#dde066", label: "Lime", mark: null, correct: false },
    { x: -2.8, z: 21.6, color: "#3d6fb8", label: "Blue", mark: "21", correct: false },
    { x: -0.6, z: 21.8, color: "#e85d4c", label: "Red", mark: null, correct: false },
    { x: 1.2, z: 21.5, color: "#f0c020", label: "Yellow", mark: "2", correct: false },
    { x: 3.0, z: 21.7, color: "#2f9e6d", label: "Green", mark: "21", correct: false },
  ];

  const trees = [
    { x: -8, z: -4, h: 3 },
    { x: 8, z: -3, h: 2.8 },
    { x: -9, z: 3, h: 3.2 },
    { x: 8.5, z: 6, h: 2.7 },
    { x: -8.5, z: 12, h: 3.1 },
    { x: 9, z: 14, h: 2.9 },
    { x: -7.5, z: 19, h: 2.8 },
    { x: 8, z: 21, h: 3.0 },
  ];

  const player = { x: 0, z: -8, yaw: 0 };
  let level = 1;
  let haze = 0;
  let bumpFlash = 0;
  let wrongBagFlash = 0;
  let won = false;
  let focusBlur = 0;
  let focusTimer = 0;

  let onResize = null;
  let onLockChange = null;
  let onMouse = null;

  function clearLoop() {
    if (tick) clearInterval(tick);
    tick = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    stopAudio();
    releasePointer();
    Object.keys(keys).forEach(function (k) {
      delete keys[k];
    });
    if (onResize) window.removeEventListener("resize", onResize);
    if (onLockChange) document.removeEventListener("pointerlockchange", onLockChange);
    if (onMouse) document.removeEventListener("mousemove", onMouse);
    onResize = onLockChange = onMouse = null;
  }

  function releasePointer() {
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (e) {}
    }
  }

  function makeWalker() {
    const fromLeft = Math.random() > 0.5;
    return {
      x: fromLeft ? -7.5 - Math.random() * 2 : 7.5 + Math.random() * 2,
      z: 10.4 + Math.random() * 5.2,
      dir: fromLeft ? 1 : -1,
      speed: 2.0 + Math.random() * 2.2,
      shirt: WALKER_SHIRTS[(Math.random() * WALKER_SHIRTS.length) | 0],
    };
  }

  function fillWalkers() {
    walkers = [];
    for (let i = 0; i < 8; i++) {
      const w = makeWalker();
      // stagger so they aren't all at the edge
      w.x = -6 + Math.random() * 12;
      walkers.push(w);
    }
  }

  function stopAudio() {
    try {
      if (masterGain && audioCtx) {
        masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
      }
    } catch (e) {}
    try {
      if (crowdSrc) crowdSrc.stop();
    } catch (e) {}
    crowdSrc = null;
    crowdGain = null;
    masterGain = null;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function startAudio() {
    if (reduceMotion) return;
    try {
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(audioCtx.destination);

      const n = audioCtx.sampleRate * 2;
      const buf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      crowdSrc = audioCtx.createBufferSource();
      crowdSrc.buffer = buf;
      crowdSrc.loop = true;
      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 700;
      filter.Q.value = 0.7;
      crowdGain = audioCtx.createGain();
      crowdGain.gain.value = 0.0001;
      crowdSrc.connect(filter);
      filter.connect(crowdGain);
      crowdGain.connect(masterGain);
      crowdSrc.start();
    } catch (e) {
      masterGain = null;
    }
  }

  function setCrowdVolume(v) {
    if (!crowdGain || !audioCtx) return;
    crowdGain.gain.setTargetAtTime(
      Math.max(0.0001, v),
      audioCtx.currentTime,
      0.1
    );
  }

  function talkBurst(levelAmt) {
    if (reduceMotion || !window.speechSynthesis || levelAmt < 0.2) return;
    const now = performance.now();
    if (now - lastTalk < 900) return;
    lastTalk = now;
    const phrases = [
      "hey",
      "wait",
      "excuse me",
      "over here",
      "sorry",
      "come on",
      "look",
      "okay",
    ];
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      phrases[(Math.random() * phrases.length) | 0]
    );
    u.rate = 1.15 + Math.random() * 0.4;
    u.pitch = 0.9 + Math.random() * 0.8;
    u.volume = Math.min(1, 0.35 + levelAmt * 0.5);
    window.speechSynthesis.speak(u);
  }

  function footstep() {
    if (!audioCtx || !masterGain || reduceMotion) return;
    const now = performance.now();
    if (now - lastStep < 340) return;
    lastStep = now;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.value = 95 + Math.random() * 30;
    g.gain.value = 0.028;
    o.connect(g);
    g.connect(masterGain);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.07);
    o.stop(audioCtx.currentTime + 0.08);
  }

  function currentLevel() {
    for (let i = 0; i < LEVELS.length; i++) {
      const L = LEVELS[i];
      if (player.z >= L.z0 && player.z < L.z1) return L;
    }
    if (player.z >= LEVELS[3].z1) return LEVELS[3];
    return LEVELS[0];
  }

  function openShell() {
    playing = true;
    left = 180;
    level = 1;
    haze = 0;
    bumpFlash = 0;
    wrongBagFlash = 0;
    won = false;
    focusBlur = 0;
    focusTimer = 0;
    player.x = 0;
    player.z = -8;
    player.yaw = 0;
    fillWalkers();
    shell.hidden = false;
    shell.removeAttribute("hidden");
    shell.classList.add("is-open");
    shell.setAttribute("data-mode", "autism");
    document.body.classList.add("sim-lock");
    if (titleEl) titleEl.textContent = "Park walk";
    if (timerEl) timerEl.textContent = "180";
    if (clockWrap) clockWrap.classList.remove("is-urgent");
    if (debrief) {
      debrief.hidden = true;
      debrief.setAttribute("hidden", "");
      debrief.style.display = "none";
    }
    if (room) {
      room.hidden = false;
      room.removeAttribute("hidden");
      room.style.display = "block";
    }
  }

  function closeShell() {
    clearLoop();
    playing = false;
    shell.classList.remove("is-open");
    shell.hidden = true;
    shell.setAttribute("hidden", "");
    document.body.classList.remove("sim-lock");
    if (room) {
      room.hidden = true;
      room.setAttribute("hidden", "");
      room.style.display = "none";
    }
    if (debrief) {
      debrief.hidden = true;
      debrief.setAttribute("hidden", "");
      debrief.style.display = "none";
    }
  }

  function showDebrief(result, reflect) {
    clearLoop();
    playing = false;
    if (room) {
      room.hidden = true;
      room.style.display = "none";
    }
    if (resultEl) resultEl.textContent = result;
    if (reflectEl) reflectEl.textContent = reflect;
    if (debrief) {
      debrief.hidden = false;
      debrief.removeAttribute("hidden");
      debrief.style.display = "grid";
    }
  }

  function startClock() {
    tick = setInterval(function () {
      left -= 1;
      if (timerEl) timerEl.textContent = String(Math.max(0, left));
      if (clockWrap) clockWrap.classList.toggle("is-urgent", left <= 25);
      if (left <= 0) endSession("timeout");
    }, 1000);
  }

  function endSession(reason) {
    if (!playing) return;
    playing = false;
    if (reason === "win" || won) {
      showDebrief(
        "Good job! You have found your bag.",
        ""
      );
      return;
    }
    if (reason === "quit") {
      showDebrief("Stopped.", "You left the park early.");
      return;
    }
    showDebrief("Time’s up.", "You didn’t find the yellow bag with the 21.");
  }

  function dist2(ax, az, bx, bz) {
    const dx = ax - bx;
    const dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function tryPickBag() {
    if (level < 4 && player.z < 16) return;
    let best = null;
    let bestD = 2.2;
    bags.forEach(function (b) {
      const d = dist2(player.x, player.z, b.x, b.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    });
    if (!best) return;
    if (best.correct) {
      won = true;
      endSession("win");
    } else {
      wrongBagFlash = 1;
    }
  }

  function project(x, z, cos, sin, W, H, horizon, focal) {
    const dx = x - player.x;
    const dz = z - player.z;
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    if (rz < 0.4) return null;
    const scale = focal / rz;
    return {
      sx: W * 0.5 + rx * scale,
      sy: horizon + scale * 0.12,
      scale: scale,
      rz: rz,
    };
  }

  function drawPerson(ctx, p, shirt) {
    const h = p.scale * 1.6;
    const w = p.scale * 0.5;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy + 2, w * 0.7, w * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(p.sx - w * 0.28, p.sy - h * 0.28, w * 0.2, h * 0.3);
    ctx.fillRect(p.sx + w * 0.08, p.sy - h * 0.28, w * 0.2, h * 0.3);
    ctx.fillStyle = shirt;
    ctx.fillRect(p.sx - w * 0.36, p.sy - h * 0.6, w * 0.72, h * 0.36);
    ctx.fillStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - h * 0.76, w * 0.3, w * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    // blank face
    ctx.fillStyle = "#2c2c2c";
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy - h * 0.76, w * 0.24, w * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBag(ctx, bag, cos, sin, W, H, horizon, focal) {
    const p = project(bag.x, bag.z, cos, sin, W, H, horizon, focal);
    if (!p) return null;
    return {
      rz: p.rz,
      bag: bag,
      draw: function () {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy + 2, p.scale * 0.5, p.scale * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = bag.color;
        ctx.fillRect(
          p.sx - p.scale * 0.3,
          p.sy - p.scale * 0.55,
          p.scale * 0.6,
          p.scale * 0.5
        );
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(
          p.sx - p.scale * 0.26,
          p.sy - p.scale * 0.68,
          p.scale * 0.52,
          p.scale * 0.14
        );
        if (bag.mark) {
          ctx.fillStyle = bag.correct ? "#e85d4c" : "#222";
          ctx.font = "bold " + Math.max(13, p.scale * 0.3) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(bag.mark, p.sx, p.sy - p.scale * 0.25);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          p.sx - p.scale * 0.3,
          p.sy - p.scale * 0.55,
          p.scale * 0.6,
          p.scale * 0.5
        );
      },
    };
  }

  function runPark() {
    clearLoop();
    openShell();
    startAudio();
    startClock();

    const canvas = shell.querySelector("[data-auti-canvas]");
    const staticEl = shell.querySelector("[data-auti-static]");
    const loadEl = shell.querySelector("[data-auti-load]");
    const hintEl = shell.querySelector("[data-auti-hint]");
    const goalEl = shell.querySelector("[data-auti-goal]");
    const stepEl = shell.querySelector("[data-auti-step]");
    const vignette = shell.querySelector("[data-auti-vignette]");
    const clueEl = shell.querySelector("[data-auti-bag-clue]");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let last = performance.now();
    let time = 0;
    let dragging = false;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    onResize = resize;
    resize();
    window.addEventListener("resize", onResize);

    // No pointer lock — keep the normal cursor so Exit is easy
    canvas.addEventListener("mousedown", function () {
      if (!playing) return;
      dragging = true;
    });
    window.addEventListener("mouseup", function () {
      dragging = false;
    });
    canvas.addEventListener("click", function () {
      if (!playing) return;
      if (player.z >= 16) tryPickBag();
    });

    onMouse = function (e) {
      if (!playing || !dragging) return;
      player.yaw += e.movementX * 0.003;
    };
    document.addEventListener("mousemove", onMouse);

    // drop unused lock handler
    onLockChange = null;

    canvas.setAttribute("tabindex", "0");
    canvas.focus({ preventScroll: true });

    if (clueEl) clueEl.textContent = BAG_CLUE;

    function updateHud(L) {
      level = L.id;
      if (stepEl) {
        stepEl.textContent = "Level " + L.id + " of 4";
        stepEl.dataset.phase = L.id === 4 ? "bench" : "bag";
      }
      if (goalEl) goalEl.textContent = L.title;
      if (clueEl) {
        clueEl.hidden = false;
        clueEl.textContent = BAG_CLUE;
      }
      if (hintEl) {
        if (wrongBagFlash > 0.3) {
          hintEl.textContent = "Wrong bag — look for yellow with red 21";
        } else {
          hintEl.textContent = L.hint;
        }
      }
      if (loadEl) {
        if (L.id === 1) loadEl.textContent = "Crowd";
        else if (L.id === 2) loadEl.textContent = "Haze";
        else if (L.id === 3) loadEl.textContent = "Dodge";
        else loadEl.textContent = "Find bag";
        loadEl.dataset.level = String(Math.min(3, L.id - 1));
      }
    }

    function drawFrame(now) {
      if (!playing) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      time += dt;
      if (bumpFlash > 0) bumpFlash = Math.max(0, bumpFlash - dt);
      if (wrongBagFlash > 0) wrongBagFlash = Math.max(0, wrongBagFlash - dt);

      let forward = 0;
      let strafe = 0;
      if (keys.KeyW || keys.ArrowUp) forward += 1;
      if (keys.KeyS || keys.ArrowDown) forward -= 1;
      if (keys.KeyA) strafe -= 1;
      if (keys.KeyD) strafe += 1;
      if (keys.ArrowLeft) player.yaw -= 1.7 * dt;
      if (keys.ArrowRight) player.yaw += 1.7 * dt;

      const moving = forward !== 0 || strafe !== 0;
      const speed = 4.4;
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      if (moving) {
        player.x += (forward * sin + strafe * cos) * speed * dt;
        player.z += (forward * cos - strafe * sin) * speed * dt;
        footstep();
      }
      player.x = Math.max(-6.5, Math.min(6.5, player.x));
      player.z = Math.max(-9, Math.min(23, player.z));

      // Walkers always keep crossing — recycle off-screen into new people
      for (let i = walkers.length - 1; i >= 0; i--) {
        const w = walkers[i];
        w.x += w.dir * w.speed * dt;
        if (w.x > 8.5 || w.x < -8.5) {
          walkers[i] = makeWalker();
          continue;
        }
        if (player.z >= 10 && player.z < 16) {
          const d = dist2(player.x, player.z, w.x, w.z);
          if (d < 1.35) {
            // Push the player out of the way
            const push = (1.4 - d) * 10 * dt + 0.55;
            player.x += w.dir * push * 2.8;
            player.z += (Math.random() - 0.5) * 0.35;
            player.x = Math.max(-6.5, Math.min(6.5, player.x));
            bumpFlash = 0.55;
          }
        }
      }
      while (walkers.length < 8) walkers.push(makeWalker());

      const L = currentLevel();
      updateHud(L);

      // Level 3: vision randomly goes in and out of focus
      if (L.id === 3) {
        focusTimer -= dt;
        if (focusTimer <= 0) {
          focusBlur = Math.random() > 0.4 ? 1.2 + Math.random() * 3.5 : 0;
          focusTimer = 0.35 + Math.random() * 1.1;
        }
      } else {
        focusBlur = Math.max(0, focusBlur - dt * 4);
        focusTimer = 0;
      }

      // Level 1 crowd volume + talk
      let crowdAmt = 0;
      if (L.id === 1) {
        const t = (player.z - L.z0) / (L.z1 - L.z0);
        crowdAmt = 0.25 + Math.max(0, Math.min(1, t)) * 0.55;
        talkBurst(crowdAmt);
      }
      setCrowdVolume(crowdAmt);

      // Level 2 haze builds
      if (L.id === 2) {
        const t = (player.z - L.z0) / (L.z1 - L.z0);
        haze = 0.25 + Math.max(0, Math.min(1, t)) * 0.7;
      } else if (L.id > 2) {
        haze = Math.max(0.15, haze * 0.98);
      } else {
        haze = Math.max(0, haze - dt * 0.4);
      }

      if (staticEl) staticEl.style.opacity = String(L.id === 1 ? crowdAmt * 0.25 : 0);
      if (vignette) vignette.style.opacity = String(0.1 + haze * 0.35);

      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const horizon = H * 0.52;
      const focal = W * 0.62;

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#6eb0e0");
      sky.addColorStop(1, "#cfe8f8");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, horizon);

      ctx.fillStyle = "rgba(255,230,150,0.9)";
      ctx.beginPath();
      ctx.arc(W * 0.82, H * 0.14, Math.min(W, H) * 0.04, 0, Math.PI * 2);
      ctx.fill();

      // Ground
      const ground = ctx.createLinearGradient(0, horizon, 0, H);
      ground.addColorStop(0, "#8fbc5a");
      ground.addColorStop(1, "#5a8a35");
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, W, H - horizon);

      // Path strip
      const pathPts = [
        project(-1.6, -8, cos, sin, W, H, horizon, focal),
        project(1.6, -8, cos, sin, W, H, horizon, focal),
        project(1.6, 22, cos, sin, W, H, horizon, focal),
        project(-1.6, 22, cos, sin, W, H, horizon, focal),
      ];
      if (pathPts.every(Boolean)) {
        ctx.beginPath();
        ctx.moveTo(pathPts[0].sx, pathPts[0].sy);
        for (let i = 1; i < 4; i++) ctx.lineTo(pathPts[i].sx, pathPts[i].sy);
        ctx.closePath();
        ctx.fillStyle = "rgba(200, 175, 120, 0.55)";
        ctx.fill();
      }

      const drawList = [];

      trees.forEach(function (tr) {
        const p = project(tr.x, tr.z, cos, sin, W, H, horizon, focal);
        if (!p) return;
        drawList.push({
          rz: p.rz,
          draw: function () {
            ctx.fillStyle = "#6b4a2e";
            ctx.fillRect(
              p.sx - p.scale * 0.08,
              p.sy - p.scale * tr.h * 0.45,
              p.scale * 0.16,
              p.scale * tr.h * 0.45
            );
            ctx.fillStyle = "#2f7a3a";
            ctx.beginPath();
            ctx.arc(p.sx, p.sy - p.scale * tr.h * 0.55, p.scale * 0.65, 0, Math.PI * 2);
            ctx.fill();
          },
        });
      });

      // Level markers on ground
      LEVELS.forEach(function (lv) {
        const midZ = (lv.z0 + lv.z1) / 2;
        const p = project(0, midZ, cos, sin, W, H, horizon, focal);
        if (!p) return;
        drawList.push({
          rz: p.rz + 2,
          draw: function () {
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.font = "bold " + Math.max(11, p.scale * 0.22) + "px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("L" + lv.id, p.sx, p.sy);
          },
        });
      });

      crowdPeople.forEach(function (k) {
        const p = project(k.x, k.z, cos, sin, W, H, horizon, focal);
        if (!p) return;
        drawList.push({
          rz: p.rz,
          draw: function () {
            drawPerson(ctx, p, k.shirt);
          },
        });
      });

      walkers.forEach(function (w) {
        const p = project(w.x, w.z, cos, sin, W, H, horizon, focal);
        if (!p) return;
        drawList.push({
          rz: p.rz,
          draw: function () {
            drawPerson(ctx, p, w.shirt);
          },
        });
      });

      bags.forEach(function (b) {
        const item = drawBag(ctx, b, cos, sin, W, H, horizon, focal);
        if (item) drawList.push(item);
      });

      drawList.sort(function (a, b) {
        return b.rz - a.rz;
      });
      drawList.forEach(function (item) {
        item.draw();
      });

      // Haze overlay (level 2)
      if (haze > 0.05) {
        ctx.fillStyle = "rgba(200, 210, 220, " + (haze * 0.55).toFixed(3) + ")";
        ctx.fillRect(0, 0, W, H);
        // mute colours
        ctx.globalAlpha = haze * 0.35;
        ctx.fillStyle = "#9aa3a8";
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      if (bumpFlash > 0) {
        ctx.fillStyle = "rgba(232, 93, 76, " + bumpFlash * 0.25 + ")";
        ctx.fillRect(0, 0, W, H);
      }
      if (wrongBagFlash > 0) {
        ctx.fillStyle = "rgba(232, 93, 76, " + wrongBagFlash * 0.3 + ")";
        ctx.fillRect(0, 0, W, H);
      }

      // Compass toward end / correct bag
      const target =
        L.id < 4
          ? { x: 0, z: (L.z1 + 0.5) }
          : bags.find(function (b) {
              return b.correct;
            });
      let ang =
        Math.atan2(target.x - player.x, target.z - player.z) - player.yaw;
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      ctx.save();
      ctx.translate(W * 0.5, H * 0.11);
      ctx.rotate(ang);
      ctx.fillStyle = L.id === 4 ? "#f0c020" : "#fff";
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, 9);
      ctx.lineTo(0, 3);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      canvas.style.filter =
        L.id === 2
          ? "saturate(" +
            (1 - haze * 0.75).toFixed(2) +
            ") blur(" +
            (haze * 1.8).toFixed(2) +
            "px)"
          : L.id === 3 && focusBlur > 0.05
            ? "blur(" + focusBlur.toFixed(2) + "px) contrast(1.05)"
            : "none";

      raf = requestAnimationFrame(drawFrame);
    }

    raf = requestAnimationFrame(drawFrame);
  }

  function start() {
    runPark();
  }

  document.querySelectorAll('[data-sim-start="autism"]').forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      start();
    });
  });

  shell.addEventListener("click", function (e) {
    if (e.target.closest("[data-sim-exit]")) {
      e.preventDefault();
      if (playing) endSession("quit");
      else closeShell();
      return;
    }
    if (e.target.closest("[data-sim-retry]")) {
      e.preventDefault();
      start();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && shell.classList.contains("is-open")) {
      if (playing) endSession("quit");
      else closeShell();
      return;
    }
    if (!playing) return;
    keys[e.code] = true;
    if (e.code === "KeyE" || e.code === "Space") {
      e.preventDefault();
      tryPickBag();
    }
    if (
      e.code === "KeyW" ||
      e.code === "KeyA" ||
      e.code === "KeyS" ||
      e.code === "KeyD" ||
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight"
    ) {
      e.preventDefault();
    }
  });

  document.addEventListener("keyup", function (e) {
    delete keys[e.code];
  });
})();
