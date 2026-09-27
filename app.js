(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const CYCLE = 10000;  // one breath: 4s in, 6s out
  const INHALE = 4000;
  const HOME_TINT = "#a894ff";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem("orbit." + k); return v === null ? d : JSON.parse(v); }
      catch { return d; }
    },
    set(k, v) { try { localStorage.setItem("orbit." + k, JSON.stringify(v)); } catch {} },
  };

  const setTint = (c) => document.documentElement.style.setProperty("--tint", c);
  const show = (id) => document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
  const ease = (x) => (1 - Math.cos(Math.PI * x)) / 2;

  // ---------- Starfield ----------

  const Stars = (() => {
    const c = $("#stars"), g = c.getContext("2d");
    let w, h, stars = [], speed = 1, target = 1, shoot = null;
    let nextShoot = performance.now() + 9000, last = performance.now();

    function make() {
      const z = Math.random(), r = Math.random();
      return {
        x: Math.random() * w, y: Math.random() * h, z,
        size: 0.3 + z * 1.3,
        a: 0.25 + Math.random() * 0.7,
        tw: 0.4 + Math.random() * 1.6,
        ph: Math.random() * 6.283,
        rgb: r < 0.08 ? "200,210,255" : r < 0.14 ? "255,214,236" : "255,255,255",
      };
    }

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth; h = innerHeight;
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + "px"; c.style.height = h + "px";
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: Math.min(420, Math.round((w * h) / 2600)) }, make);
    }

    function frame(now) {
      const dt = Math.min(64, now - last);
      last = now;
      speed += (target - speed) * 0.02;
      g.clearRect(0, 0, w, h);
      const t = now / 1000;
      for (const s of stars) {
        if (!reduceMotion) {
          s.x -= (0.004 + s.z * 0.012) * dt * speed;
          s.y -= (0.001 + s.z * 0.003) * dt * speed;
          if (s.x < -2) s.x = w + 2;
          if (s.y < -2) s.y = h + 2;
        }
        g.fillStyle = `rgba(${s.rgb},${s.a * (0.65 + 0.35 * Math.sin(t * s.tw + s.ph))})`;
        g.beginPath();
        g.arc(s.x, s.y, s.size, 0, 6.283);
        g.fill();
      }

      if (!reduceMotion && !shoot && now > nextShoot) {
        shoot = { x: w * (0.4 + Math.random() * 0.6), y: h * Math.random() * 0.4, life: 0 };
        nextShoot = now + 15000 + Math.random() * 30000;
      }
      if (shoot) {
        shoot.life += dt;
        const p = shoot.life / 1100;
        if (p >= 1) shoot = null;
        else {
          const x = shoot.x - p * 260, y = shoot.y + p * 100;
          const grad = g.createLinearGradient(x, y, x + 90, y - 35);
          grad.addColorStop(0, `rgba(255,255,255,${0.8 * Math.sin(p * Math.PI)})`);
          grad.addColorStop(1, "rgba(255,255,255,0)");
          g.strokeStyle = grad;
          g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + 90, y - 35); g.stroke();
        }
      }
      requestAnimationFrame(frame);
    }

    addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
    return { setSpeed(v) { target = v; } };
  })();

  // ---------- Home ----------

  const hour = new Date().getHours();
  $("#greeting").textContent =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 22 ? "Good evening" : "Good night";

  for (const t of THEMES) {
    const b = document.createElement("button");
    b.className = "card";
    b.dataset.theme = t.id;
    b.style.setProperty("--c", t.color);
    b.innerHTML = `<span class="dot"></span><span class="name">${t.name}</span><span class="tag">${t.tagline}</span>`;
    $("#grid").appendChild(b);
  }
  document.querySelectorAll("[data-theme]").forEach((b) =>
    b.addEventListener("click", () => startSession(b.dataset.theme)));

  let minutes = store.get("minutes", 5);
  const segBtns = document.querySelectorAll(".seg button");
  function renderSeg() {
    segBtns.forEach((b) => {
      const on = +b.dataset.min === minutes;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", on);
    });
  }
  segBtns.forEach((b) => b.addEventListener("click", () => {
    minutes = +b.dataset.min;
    store.set("minutes", minutes);
    renderSeg();
  }));
  renderSeg();

  // ---------- Session builder ----------

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // n items from an ordered list, evenly spaced, order kept.
  const spread = (list, n) =>
    Array.from({ length: Math.min(n, list.length) }, (_, i) => list[Math.floor((i * list.length) / Math.min(n, list.length))]);
  // n items drawn at random, reshuffling (and so repeating) when the list runs out.
  function draw(list, n) {
    const out = [];
    let bag = [];
    while (out.length < n) {
      if (!bag.length) bag = shuffle(list);
      out.push(bag.pop());
    }
    return out;
  }
  const split = (n, parts) => Array.from({ length: parts }, (_, i) => Math.floor(n / parts) + (i < n % parts ? 1 : 0));
  const tag = (color) => (text) => ({ text, color });

  // The Daily Orbit takes a share of lines from every theme, in order.
  function lines(theme, key, n, pick) {
    if (theme.id !== "daily") return pick(theme[key], n).map(tag(theme.color));
    const counts = split(n, THEMES.length);
    return THEMES.flatMap((t, i) => pick(t[key], counts[i]).map(tag(t.color)));
  }

  function phase(items, breaths, name, maxShow) {
    const per = split(breaths, items.length);
    return items.map((it, i) => ({ ...it, phase: name, breaths: per[i], show: Math.min(per[i], maxShow) }));
  }

  // Arrive 20% · Visualize 40% · Affirm 30% · Return 10%, measured in breaths.
  function buildSession(theme, mins) {
    const total = mins * 6, long = mins >= 10;
    const nArrive = Math.round(total * 0.2);
    const nReturn = Math.max(2, Math.round(total * 0.1));
    const nVis = Math.round(total * 0.4);
    const nAff = total - nArrive - nReturn - nVis;
    const per = long ? 2 : 1;

    const arrive = [theme.intro, ...spread(ARRIVE, Math.round(nArrive / (long ? 1.5 : 1)) - 1)].map(tag(theme.color));
    const vis = lines(theme, "visualize", Math.round(nVis / per), spread);
    const aff = lines(theme, "affirm", Math.round(nAff / per), draw);
    const nBack = Math.min(nReturn, RETURN.length + 1);
    const back = [theme.closing, ...RETURN.slice(RETURN.length - (nBack - 1))].map(tag(theme.color));

    return [
      ...phase(arrive, nArrive, "arrive", 2),
      ...phase(vis, nVis, "visualize", 3),
      ...phase(aff, nAff, "affirm", 2),
      ...phase(back, nReturn, "return", 2),
    ];
  }

  // ---------- Session runner ----------

  const session = $("#session"), orb = $("#orb"), line = $("#line"), cue = $("#cue"), remaining = $("#remaining");
  const pauseBtn = $("#pauseBtn"), muteBtn = $("#muteBtn"), vol = $("#vol");
  const ICON = {
    pause: '<svg viewBox="0 0 24 24"><rect class="fill" x="6.5" y="5" width="3.5" height="14" rx="1.2"/><rect class="fill" x="14" y="5" width="3.5" height="14" rx="1.2"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path class="fill" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    muted: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  };

  let S = null, wake = null, hideTimer = 0;

  async function lockScreen() {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") wake = await navigator.wakeLock.request("screen");
    } catch {}
  }
  function unlockScreen() {
    try { if (wake) wake.release(); } catch {}
    wake = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (S && document.visibilityState === "visible") lockScreen();
  });

  function startSession(id) {
    const theme = id === "daily" ? DAILY : THEMES.find((t) => t.id === id);
    const slides = buildSession(theme, minutes);
    let b = 0;
    for (const s of slides) {
      s.start = b * CYCLE;
      s.showEnd = (b + s.show) * CYCLE;
      b += s.breaths;
    }
    const sess = { theme, slides, total: b * CYCLE, elapsed: 0, last: performance.now(), paused: false, idx: -1, sec: -1 };
    S = sess;

    line.textContent = "";
    line.style.opacity = 0;
    cue.style.opacity = 0;
    orb.style.transform = "scale(0.7)";
    OrbitAudio.start(theme.root);
    renderPause();
    show("session");
    Stars.setSpeed(0.35);
    lockScreen();
    pokeControls();

    const tick = (now) => {
      if (S !== sess) return;
      const dt = now - sess.last;
      sess.last = now;
      if (!sess.paused) sess.elapsed += dt;
      const e = sess.elapsed;
      if (e >= sess.total) return finish();

      // Breath: ease in over 4s, ease out over 6s.
      const bt = e % CYCLE;
      const k = bt < INHALE ? ease(bt / INHALE) : 1 - ease((bt - INHALE) / (CYCLE - INHALE));
      orb.style.transform = `scale(${0.7 + 0.3 * k})`;

      while (sess.idx < sess.slides.length - 1 && e >= sess.slides[sess.idx + 1].start) {
        const s = sess.slides[++sess.idx];
        line.textContent = s.text;
        setTint(s.color);
      }
      const sl = sess.slides[sess.idx];
      const local = e - sl.start, dur = sl.showEnd - sl.start;
      line.style.opacity = Math.max(0, Math.min(1, (local - 500) / 1800, (dur - local) / 1800));

      if (sl.phase === "arrive") {
        const inhale = bt < INHALE;
        cue.textContent = inhale ? "breathe in" : "breathe out";
        cue.style.opacity = 0.85 * Math.sin(Math.PI * (inhale ? bt / INHALE : (bt - INHALE) / (CYCLE - INHALE)));
      } else {
        cue.style.opacity = 0;
      }

      const left = Math.ceil((sess.total - e) / 1000);
      if (left !== sess.sec) {
        sess.sec = left;
        remaining.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function finish() {
    const theme = S.theme;
    S = null;
    line.style.opacity = 0;
    cue.style.opacity = 0;
    OrbitAudio.end();
    unlockScreen();
    setTint(theme.color);
    $("#endLine").textContent = END_LINES[(Math.random() * END_LINES.length) | 0];
    Stars.setSpeed(0.6);
    show("end");
    setTimeout(() => $("#homeBtn").focus({ preventScroll: true }), 1300);
  }

  function leave() {
    if (!S) return;
    S = null;
    OrbitAudio.stop();
    unlockScreen();
    goHome();
  }

  function goHome() {
    clearTimeout(hideTimer);
    session.classList.remove("calm");
    setTint(HOME_TINT);
    Stars.setSpeed(1);
    show("home");
  }

  // ---------- Controls ----------

  function pokeControls() {
    session.classList.remove("calm");
    clearTimeout(hideTimer);
    if (S && !S.paused) hideTimer = setTimeout(() => session.classList.add("calm"), 3500);
  }

  session.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".bar") || session.classList.contains("calm")) pokeControls();
    else if (S && !S.paused) session.classList.add("calm");
  });
  session.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") pokeControls();
  });

  function renderPause() {
    const p = S && S.paused;
    pauseBtn.innerHTML = p ? ICON.play : ICON.pause;
    pauseBtn.setAttribute("aria-label", p ? "Resume" : "Pause");
  }
  function togglePause() {
    if (!S) return;
    S.paused = !S.paused;
    S.paused ? OrbitAudio.pause() : OrbitAudio.resume();
    renderPause();
    pokeControls();
  }

  let muted = store.get("muted", false);
  function renderMute() {
    muteBtn.innerHTML = muted ? ICON.muted : ICON.sound;
    muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    OrbitAudio.setMuted(muted);
  }
  function setMuted(m) {
    muted = m;
    store.set("muted", m);
    renderMute();
  }

  vol.value = store.get("volume", 0.8);
  OrbitAudio.setVolume(+vol.value);
  renderMute();

  vol.addEventListener("input", () => {
    OrbitAudio.setVolume(+vol.value);
    store.set("volume", +vol.value);
    if (muted && +vol.value > 0) setMuted(false);
    pokeControls();
  });
  muteBtn.addEventListener("click", () => setMuted(!muted));
  pauseBtn.addEventListener("click", togglePause);
  $("#endBtn").addEventListener("click", leave);
  $("#homeBtn").addEventListener("click", goHome);

  document.addEventListener("keydown", (e) => {
    if (!S) return;
    if (e.code === "Space") { e.preventDefault(); togglePause(); }
    else if (e.key === "Escape") leave();
  });

  // ---------- Offline ----------

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
