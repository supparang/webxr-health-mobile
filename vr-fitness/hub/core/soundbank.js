(function () {
  // Simple SoundBank for BGM/SFX with caching & shared AudioContext
  // Folder structure (recommended):
  // /vr-fitness/assets/audio/
  //   bgm_shadow_breaker.ogg
  //   bgm_rhythm_boxer.ogg
  //   bgm_jump_duck.ogg
  //   bgm_balance_hold.ogg
  //   fx_hit_01.wav
  //   fx_miss_01.wav
  //   fx_ui_01.wav

  window.APP = window.APP || {};

  const MANIFEST = {
    base: "../assets/audio/", // relative to each game's folder
    bgm: {
      "shadow-breaker": "bgm_shadow_breaker.ogg",
      "rhythm-boxer":   "bgm_rhythm_boxer.ogg",
      "jump-duck":      "bgm_jump_duck.ogg",
      "balance-hold":   "bgm_balance_hold.ogg",
    },
    sfx: {
      hit1:  "fx_hit_01.wav",
      miss1: "fx_miss_01.wav",
      ui1:   "fx_ui_01.wav",
    },
    volume: { bgm: 0.35, sfx: 0.85 },
  };

  let ctx = null;
  let master = null;
  let bgmGain = null;
  let sfxGain = null;
  let currentBGM = null;

  const cache = new Map(); // key -> AudioBuffer

  async function ensureCtx() {
    if (ctx) return;
    // Try to reuse context from APP.audio if available
    try { if (APP && APP.audio && APP.audio._ctx) ctx = APP.audio._ctx; } catch (e) {}
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();

    // expose for others (optional)
    try { APP.audio = APP.audio || {}; if (!APP.audio._ctx) APP.audio._ctx = ctx; } catch (e) {}

    master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);

    bgmGain = ctx.createGain();
    bgmGain.gain.value = MANIFEST.volume.bgm;
    bgmGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = MANIFEST.volume.sfx;
    sfxGain.connect(master);

    // Some browsers require resume after user gesture; game Start button should call APP.audio.init(), but just in case:
    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch (e) {}
    }
  }

  function setBase(path) {
    if (typeof path === "string" && path.trim()) MANIFEST.base = path.replace(/\/+$/, "") + "/";
  }

  async function loadBuffer(relPath) {
    await ensureCtx();
    const key = relPath;
    if (cache.has(key)) return cache.get(key);

    const url = MANIFEST.base + relPath;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sound fetch failed: ${url} (${res.status})`);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    cache.set(key, buf);
    return buf;
  }

  async function play(name) {
    // One-shot SFX
    const file = MANIFEST.sfx[name];
    if (!file) return;
    const buf = await loadBuffer(file);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(sfxGain);
    src.start();
    return src;
  }

  async function playBGM(gameKey) {
    stopBGM();
    const file = MANIFEST.bgm[gameKey];
    if (!file) return null;
    const buf = await loadBuffer(file);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(bgmGain);
    // Safari sometimes needs resume after set up
    if (ctx.state === "suspended") { try { await ctx.resume(); } catch (e) {} }
    src.start();
    currentBGM = src;
    return src;
  }

  function stopBGM() {
    if (currentBGM) {
      try { currentBGM.stop(); } catch (e) {}
      try { currentBGM.disconnect(); } catch (e) {}
      currentBGM = null;
    }
  }

  function setVolume({ bgm, sfx }) {
    if (bgmGain && typeof bgm === "number") bgmGain.gain.value = Math.max(0, Math.min(1, bgm));
    if (sfxGain && typeof sfx === "number") sfxGain.gain.value = Math.max(0, Math.min(1, sfx));
  }

  async function preloadAll() {
    const tasks = [];
    for (const k in MANIFEST.bgm) tasks.push(loadBuffer(MANIFEST.bgm[k]));
    for (const k in MANIFEST.sfx) tasks.push(loadBuffer(MANIFEST.sfx[k]));
    await Promise.allSettled(tasks);
  }

  // Public API
  APP.soundbank = {
    setBase,          // optional: APP.soundbank.setBase("../assets/audio/")
    play,             // APP.soundbank.play("hit1")
    playBGM,          // APP.soundbank.playBGM("shadow-breaker")
    stopBGM,          // APP.soundbank.stopBGM()
    setVolume,        // APP.soundbank.setVolume({bgm:0.3, sfx:0.9})
    preloadAll,       // optional warmup
  };
})();
