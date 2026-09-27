// Orbit audio: a generative cosmic drone plus a singing-bowl chime.
// Everything is synthesized live with Web Audio, so it works offline.

const OrbitAudio = (() => {
  let ctx = null, vol = null, fade = null, verb = null, root = 110;
  let nodes = [], closeTimer = 0;
  let volume = 0.8, muted = false;

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function lfo(freq, depth, param) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq;
    g.gain.value = depth;
    o.connect(g).connect(param);
    o.start();
    nodes.push(o);
  }

  function teardown() {
    clearTimeout(closeTimer);
    if (ctx) { try { ctx.close(); } catch {} }
    ctx = null; nodes = [];
  }

  function start(rootHz) {
    teardown();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // Lets iOS play through the silent switch like a music app would.
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}

    ctx = new AC();
    root = rootHz;
    const now = ctx.currentTime;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    comp.connect(ctx.destination);

    vol = ctx.createGain();
    vol.gain.value = muted ? 0 : volume;
    vol.connect(comp);

    // Reverb sits after the fade so tails (and the end chime) ring out naturally.
    verb = ctx.createConvolver();
    verb.buffer = impulse(6, 2.6);
    const wet = ctx.createGain(); wet.gain.value = 0.9;
    verb.connect(wet).connect(vol);

    fade = ctx.createGain();
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + 6);
    const dry = ctx.createGain(); dry.gain.value = 0.5;
    fade.connect(dry).connect(vol);
    fade.connect(verb);

    // Warm pad: an open major voicing, each voice swelling on its own slow cycle.
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 850; filt.Q.value = 0.6;
    filt.connect(fade);
    lfo(0.023, 420, filt.frequency);

    [[0.5, 0.9], [1, 1], [1.5, 0.7], [2, 0.55], [2.25, 0.35], [2.5, 0.3], [3, 0.2]].forEach(([ratio, amp]) => {
      const vg = ctx.createGain();
      vg.gain.value = amp * 0.06;
      vg.connect(filt);
      lfo(0.015 + Math.random() * 0.04, amp * 0.035, vg.gain);
      for (const [type, cents] of [["sawtooth", -5], ["triangle", 5]]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = root * ratio;
        o.detune.value = cents + (Math.random() * 4 - 2);
        o.connect(vg);
        o.start();
        nodes.push(o);
      }
    });

    // Shimmer: faint high partials that drift in and out.
    [4, 6, 8].forEach((m, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = root * m * (1 + i * 0.002);
      g.gain.value = 0.008;
      lfo(0.031 + i * 0.017, 0.008, g.gain);
      o.connect(g).connect(fade);
      o.start();
      nodes.push(o);
    });

    // Space air: soft brown noise, low-passed.
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nd.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      nd[i] = last * 3.5;
    }
    const ns = ctx.createBufferSource();
    ns.buffer = nb; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.value = 500;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    lfo(0.05, 0.03, ng.gain);
    ns.connect(nf).connect(ng).connect(fade);
    ns.start();
    nodes.push(ns);

    chime(0.6);
  }

  function chime(delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay, base = root * 4;
    [[1, 1], [2.76, 0.45], [5.4, 0.2], [8.93, 0.08]].forEach(([ratio, amp]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = base * ratio;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 7 / Math.pow(ratio, 0.3));
      o.connect(g);
      g.connect(vol);
      g.connect(verb);
      o.start(t);
      o.stop(t + 8);
    });
  }

  function fadeOut(seconds) {
    const t = ctx.currentTime;
    fade.gain.cancelScheduledValues(t);
    fade.gain.setValueAtTime(fade.gain.value, t);
    fade.gain.linearRampToValueAtTime(0, t + seconds);
  }

  // Natural ending: chime, let the drone dissolve, then shut down.
  function end() {
    if (!ctx) return;
    ctx.resume();
    chime();
    fadeOut(8);
    closeTimer = setTimeout(teardown, 15000);
  }

  // Leaving early: a quick, soft fade.
  function stop() {
    if (!ctx) return;
    fadeOut(1.5);
    closeTimer = setTimeout(teardown, 2500);
  }

  function apply() {
    if (vol) vol.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.1);
  }

  return {
    start, end, stop,
    pause() { if (ctx) ctx.suspend(); },
    resume() { if (ctx) ctx.resume(); },
    setVolume(v) { volume = v; apply(); },
    setMuted(m) { muted = m; apply(); },
  };
})();
