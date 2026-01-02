/* === /herohealth/vr-groups/audio.js ===
GroupsVR — Audio Pack (PACK 25)
✅ WebAudio (osc + noise) lightweight, no external assets
✅ Mobile unlock: pointerdown/touchstart/keydown (best effort)
✅ API: GroupsVR.Audio = { unlock, good, bad, boss, storm, tick }
✅ Safe if audio context blocked (silent fallback)
*/

(function (root) {
  'use strict';

  const NS = root.GroupsVR = root.GroupsVR || {};

  // ----------------- Helpers -----------------
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function now() { return (root.performance && performance.now) ? performance.now() : Date.now(); }

  // ----------------- WebAudio Core -----------------
  const A = {
    ctx: null,
    master: null,
    masterGain: 0.28,     // overall loudness (keep safe)
    unlocked: false,
    lastTickAt: 0,
    lastSfxAt: 0
  };

  function getCtx() {
    if (A.ctx) return A.ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      A.ctx = new AC();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.masterGain;
      A.master.connect(A.ctx.destination);
      return A.ctx;
    } catch (_) {
      return null;
    }
  }

  function resumeCtx() {
    const ctx = getCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (_) {}
    }
    return (ctx.state === 'running');
  }

  function pingUnlock() {
    const ctx = getCtx();
    if (!ctx) return false;
    if (!resumeCtx()) return false;

    // play a near-silent blip to satisfy some mobile policies
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 220;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(A.master);
      const t0 = ctx.currentTime;
      o.start(t0);
      o.stop(t0 + 0.02);
    } catch (_) {}

    A.unlocked = true;
    return true;
  }

  function wireUnlock() {
    const DOC = root.document;
    if (!DOC) return;

    const once = { passive: true, once: true };
    const unlockTry = () => {
      pingUnlock();
      // also remove extra listeners if any remain
    };

    DOC.addEventListener('pointerdown', unlockTry, once);
    DOC.addEventListener('touchstart', unlockTry, once);
    DOC.addEventListener('keydown', unlockTry, once);
  }

  // ----------------- SFX Building Blocks -----------------
  function mkEnv(gainNode, t0, a, d, s, r, peak) {
    // ADSR-ish
    const g = gainNode.gain;
    const p = clamp(peak, 0, 2);
    a = Math.max(0.001, a || 0.01);
    d = Math.max(0.001, d || 0.04);
    s = clamp(s || 0.2, 0, 1);
    r = Math.max(0.001, r || 0.08);

    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.00001, t0);
    g.linearRampToValueAtTime(p, t0 + a);
    g.linearRampToValueAtTime(p * s, t0 + a + d);
    g.linearRampToValueAtTime(0.00001, t0 + a + d + r);
  }

  function playTone(freq, dur, type, peak, pan) {
    const ctx = getCtx();
    if (!ctx || !resumeCtx()) return;

    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(40, freq || 220), t0);

    // simple pitch slide for punch
    o.frequency.linearRampToValueAtTime(Math.max(40, (freq || 220) * 0.92), t0 + Math.min(0.08, dur || 0.12));

    mkEnv(g, t0, 0.008, 0.03, 0.22, 0.09, peak || 0.35);

    // optional stereo pan
    let out = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan || 0, -0.9, 0.9);
      g.connect(p);
      out = p;
    }

    o.connect(g);
    out.connect(A.master);

    o.start(t0);
    o.stop(t0 + (dur || 0.14));
  }

  function playNoise(dur, peak, pan, hpFreq) {
    const ctx = getCtx();
    if (!ctx || !resumeCtx()) return;

    const t0 = ctx.currentTime;

    // noise buffer
    const len = Math.max(256, Math.floor(ctx.sampleRate * (dur || 0.12)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.9;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const g = ctx.createGain();
    mkEnv(g, t0, 0.004, 0.02, 0.18, 0.08, peak || 0.26);

    // highpass to make it crisp
    let chain = g;
    if (ctx.createBiquadFilter) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = Math.max(120, hpFreq || 900);
      src.connect(hp);
      hp.connect(g);
    } else {
      src.connect(g);
    }

    // optional pan
    let out = chain;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan || 0, -0.9, 0.9);
      chain.connect(p);
      out = p;
    }

    out.connect(A.master);
    src.start(t0);
    src.stop(t0 + (dur || 0.12));
  }

  function rateLimit(minMs) {
    const t = now();
    if (t - A.lastSfxAt < (minMs || 18)) return false;
    A.lastSfxAt = t;
    return true;
  }

  // ----------------- Public SFX API -----------------
  function sfxGood() {
    if (!rateLimit(14)) return;
    // sparkle: 2 quick tones
    playTone(720, 0.10, 'triangle', 0.34, -0.12);
    playTone(980, 0.08, 'sine', 0.22, 0.18);
  }

  function sfxBad() {
    if (!rateLimit(18)) return;
    // thud + hiss
    playTone(150, 0.14, 'square', 0.32, 0);
    playNoise(0.11, 0.22, 0, 650);
  }

  function sfxBoss() {
    if (!rateLimit(22)) return;
    // heavy hit: low punch + noise
    playTone(92, 0.18, 'sawtooth', 0.38, 0);
    playTone(180, 0.10, 'square', 0.18, -0.05);
    playNoise(0.14, 0.26, 0.04, 420);
  }

  function sfxStorm() {
    if (!rateLimit(40)) return;
    // wind whoosh (noise sweep illusion)
    playNoise(0.22, 0.22, -0.15, 320);
    playNoise(0.22, 0.22, 0.15, 520);
  }

  function sfxTick() {
    const t = now();
    if (t - A.lastTickAt < 180) return; // avoid spam
    A.lastTickAt = t;
    playTone(880, 0.05, 'sine', 0.14, 0);
  }

  // ----------------- Export -----------------
  NS.Audio = {
    unlock: function () {
      const ok = pingUnlock();
      return !!ok;
    },
    good: sfxGood,
    bad: sfxBad,
    boss: sfxBoss,
    storm: sfxStorm,
    tick: sfxTick
  };

  // auto-wire unlock attempts
  wireUnlock();

})(typeof window !== 'undefined' ? window : globalThis);