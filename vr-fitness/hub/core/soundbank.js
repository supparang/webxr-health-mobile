(function () {
  window.APP = window.APP || {};
  const SB = {};
  let ctx, master, bgmGain, sfxGain, currentBGM = null;
  const cache = new Map();

  const MANIFEST = {
    // จัดวางไฟล์ตามนี้ในโปรเจกต์: /vr-fitness/assets/audio/...
    base: "../assets/audio/",
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
    volume: { bgm: 0.35, sfx: 0.85 }
  };

  async function ensureCtx() {
    if (!ctx) {
      await APP.audio.init(); // ใช้ AudioContext เดิม
      ctx = (window.AudioContext && APP && APP.audio && APP.audio._ctx) || null;
      // ถ้า audio.js เดิมไม่ได้ expose ctx — สร้างใหม่:
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (!master) {
        master = ctx.createGain(); master.gain.value = 1.0; master.connect(ctx.destination);
        bgmGain = ctx.createGain(); bgmGain.gain.value = MANIFEST.volume.bgm; bgmGain.connect(master);
        sfxGain = ctx.createGain(); sfxGain.gain.value = MANIFEST.volume.sfx; sfxGain.connect(master);
      }
    }
  }

  async function loadBuffer(relPath) {
    const key = relPath;
    if (cache.has(key)) return cache.get(key);
    const res = await fetch(MANIFEST.base + relPath);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    cache.set(key, buf);
    return buf;
  }

  async function playOneShot(name) {
    await ensureCtx();
    const path = MANIFEST.sfx[name];
    if (!path) return;
    const buf = await loadBuffer(path);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(sfxGain); src.start();
  }

  async function playBGM(gameKey) {
    await ensureCtx();
    stopBGM();
    const path = MANIFEST.bgm[gameKey];
    if (!path) return;
    const buf = await loadBuffer(path);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.connect(bgmGain); src.start();
    currentBGM = src;
  }

  function stopBGM() {
    if (currentBGM) { try { currentBGM.stop(); } catch (e) {} currentBGM.disconnect(); currentBGM = null; }
  }

  function setVolume({ bgm, sfx }) {
    if (typeof bgm === "number") bgmGain.gain.value = bgm;
    if (typeof sfx === "number") sfxGain.gain.value = sfx;
  }

  // เผย ctx ให้ audio.js ใช้ร่วม (ถ้าต้องการ)
  SB.play = playOneShot;
  SB.playBGM = playBGM;
  SB.stopBGM = stopBGM;
  SB.setVolume = setVolume;

  APP.soundbank = SB;
})();
