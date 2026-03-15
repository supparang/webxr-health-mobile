// === /herohealth/hygiene-common/cues.js ===
// HeroHealth Hygiene Common Cue Standard
// PATCH v20260315a-HYGIENE-COMMON-CUES
// ใช้ร่วมกันได้กับ Brush / Handwash / Bath / Germ Detective / MaskCough

const DEFAULT_STANDARD = {
  'intro-welcome':   { text:'มาเริ่มกัน', type:'ok',      audio:'' },
  'intro-watch':     { text:'ดูตัวอย่างก่อนนะ', type:'ok', audio:'' },
  'intro-start':     { text:'เริ่มได้เลย', type:'good',   audio:'' },

  'guide-here':      { text:'ทำตรงนี้', type:'ok',        audio:'' },
  'guide-follow':    { text:'ลองทำตามนี้', type:'ok',     audio:'' },
  'guide-next':      { text:'ไปต่อกัน', type:'good',      audio:'' },

  'good-small':      { text:'ดีมาก', type:'good',         audio:'' },
  'good-great':      { text:'เก่งมาก', type:'perfect',    audio:'' },
  'good-perfect':    { text:'เยี่ยมมาก', type:'perfect',  audio:'' },

  'warn-try-again':  { text:'ลองอีกนิด', type:'warn',     audio:'' },
  'warn-not-this':   { text:'ยังไม่ใช่ตรงนี้', type:'warn', audio:'' },
  'warn-slower':     { text:'ค่อย ๆ ทำ', type:'warn',     audio:'' },

  'clear-step':      { text:'ผ่านแล้ว', type:'good',      audio:'' },
  'clear-zone':      { text:'ทำส่วนนี้เสร็จแล้ว', type:'good', audio:'' },
  'clear-all':       { text:'ทำครบแล้ว', type:'perfect',  audio:'' },

  'stop-now':        { text:'หยุดก่อน', type:'bad',       audio:'' },
  'avoid-this':      { text:'อย่าแตะตรงนี้', type:'warn', audio:'' },

  'summary-open':    { text:'มาดูสรุปกัน', type:'ok',     audio:'' },
  'summary-win':     { text:'วันนี้ทำได้ดีมาก', type:'perfect', audio:'' }
};

const DEFAULT_OPTIONS = {
  audioEnabled: true,
  voiceEnabled: true,
  speakRate: 1.02,
  speakPitch: 1.08,
  speakVolume: 0.9,
  lang: 'th-TH',
  beepVolume: 0.05,
  dedupeMs: 1400,
  minGapMs: 700
};

function safeNow() {
  try { return performance.now(); }
  catch { return Date.now(); }
}

function makeAudioEngine(opts = {}) {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  return {
    audioEnabled: !!options.audioEnabled,
    voiceEnabled: !!options.voiceEnabled,
    audioReady: false,
    audioCtx: null,
    audioMap: Object.create(null),
    lastVoiceAt: 0,
    lastVoiceKey: '',
    lastCueAt: 0,

    ensureAudio() {
      if (this.audioReady) return true;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        this.audioCtx = this.audioCtx || new Ctx();
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume?.();
        }
        this.audioReady = true;
        return true;
      } catch {
        return false;
      }
    },

    beep(type = 'ok') {
      if (!this.audioEnabled) return false;
      if (!this.ensureAudio() || !this.audioCtx) return false;

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      let freq = 620;
      let dur = 0.10;

      if (type === 'good') freq = 740;
      else if (type === 'warn') { freq = 460; dur = 0.12; }
      else if (type === 'bad') { freq = 280; dur = 0.16; }
      else if (type === 'boss') { freq = 180; dur = 0.20; }
      else if (type === 'perfect') { freq = 880; dur = 0.14; }

      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;

      osc.connect(gain);
      gain.connect(ctx.destination);

      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(options.beepVolume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.start(t);
      osc.stop(t + dur + 0.02);
      return true;
    },

    speak(text, key = '') {
      if (!this.audioEnabled || !this.voiceEnabled) return false;
      if (!('speechSynthesis' in window)) return false;

      const now = safeNow();
      const dedupeKey = key || text;

      if (this.lastVoiceKey === dedupeKey && now - this.lastVoiceAt < options.dedupeMs) return false;
      if (now - this.lastVoiceAt < options.minGapMs) return false;

      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = options.lang;
        u.rate = options.speakRate;
        u.pitch = options.speakPitch;
        u.volume = options.speakVolume;
        window.speechSynthesis.speak(u);
        this.lastVoiceAt = now;
        this.lastVoiceKey = dedupeKey;
        return true;
      } catch {
        return false;
      }
    },

    getAudio(url) {
      if (!url) return null;
      if (this.audioMap[url]) return this.audioMap[url];

      try {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.audioMap[url] = audio;
        return audio;
      } catch {
        return null;
      }
    },

    playAsset(url) {
      if (!this.audioEnabled || !url) return false;
      const audio = this.getAudio(url);
      if (!audio) return false;

      try {
        const node = audio.cloneNode();
        node.volume = 1;
        node.play?.();
        return true;
      } catch {
        return false;
      }
    },

    preload(urls = []) {
      urls.forEach((url) => {
        if (url) this.getAudio(url);
      });
    },

    stopSpeech() {
      try { window.speechSynthesis?.cancel?.(); }
      catch {}
    }
  };
}

export function createCueSystem(config = {}) {
  const standard = { ...DEFAULT_STANDARD, ...(config.standard || {}) };
  const engine = makeAudioEngine(config.options || {});

  function getCue(key) {
    return standard[key] || { text: key, type: 'ok', audio: '' };
  }

  function setAudioEnabled(enabled) {
    engine.audioEnabled = !!enabled;
  }

  function setVoiceEnabled(enabled) {
    engine.voiceEnabled = !!enabled;
  }

  function isAudioEnabled() {
    return !!engine.audioEnabled;
  }

  function isVoiceEnabled() {
    return !!engine.voiceEnabled;
  }

  function ensureAudio() {
    return engine.ensureAudio();
  }

  function play(key, overrideText = '', overrideType = '') {
    const cue = getCue(key);
    const text = overrideText || cue.text || '';
    const type = overrideType || cue.type || 'ok';
    const audio = cue.audio || '';

    const playedAsset = audio ? engine.playAsset(audio) : false;

    if (!playedAsset) {
      engine.beep(type);
      if (text) engine.speak(text, key);
    }

    return { key, text, type, playedAsset };
  }

  function playRaw({ text = '', type = 'ok', audio = '', key = '' } = {}) {
    const playedAsset = audio ? engine.playAsset(audio) : false;
    if (!playedAsset) {
      engine.beep(type);
      if (text) engine.speak(text, key || text);
    }
    return { key: key || text, text, type, playedAsset };
  }

  function preload(keys = []) {
    const urls = keys
      .map((k) => getCue(k)?.audio || '')
      .filter(Boolean);
    engine.preload(urls);
  }

  function extendStandard(extra = {}) {
    Object.assign(standard, extra);
  }

  function stopSpeech() {
    engine.stopSpeech();
  }

  return {
    standard,
    getCue,
    play,
    playRaw,
    preload,
    ensureAudio,
    setAudioEnabled,
    setVoiceEnabled,
    isAudioEnabled,
    isVoiceEnabled,
    extendStandard,
    stopSpeech
  };
}

// ตัวช่วยพร้อมใช้ทันที ถ้าอยาก import ไปใช้ตรง ๆ
export function createBrushCueSystem(options = {}) {
  return createCueSystem({
    ...options,
    standard: {
      ...DEFAULT_STANDARD,
      ...(options.standard || {}),

      'demo-start':    { text:'ลองถูตามนิ้ว', type:'ok',      audio:'' },
      'audio-on':      { text:'เปิดเสียงแล้ว', type:'good',   audio:'' },
      'learn-open':    { text:'มาฝึกแปรงฟันกัน', type:'ok',   audio:'' },
      'learn-watch':   { text:'ดูตัวอย่างก่อนนะ', type:'ok', audio:'' },
      'learn-start':   { text:'เริ่มฝึกได้เลย', type:'good', audio:'' },

      'wrong-zone':    { text:'ยังไม่ใช่โซนนี้', type:'warn', audio:'' },
      'dir-good':      { text:'ดีมาก', type:'good', audio:'' },
      'dir-warn':      { text:'ลองอีกนิด', type:'warn', audio:'' },

      'zone-clear':    { text:'ผ่านโซนแล้ว', type:'good', audio:'' },
      'zone-perfect':  { text:'เก่งมาก สามดาว', type:'perfect', audio:'' },

      'boss-laser':    { text:'หยุดก่อน เลเซอร์มา', type:'bad', audio:'' },
      'boss-shock':    { text:'แตะตามวงแหวน', type:'ok', audio:'' },
      'boss-decoy':    { text:'อย่าแตะโซนหลอก', type:'warn', audio:'' },
      'shock-perfect': { text:'เยี่ยมมาก', type:'perfect', audio:'' },
      'laser-hit':     { text:'โดนเลเซอร์', type:'bad', audio:'' },
      'decoy-hit':     { text:'โดนโซนหลอก', type:'bad', audio:'' },

      'boss-phase':    { text:'ผ่านอีกเฟสแล้ว', type:'boss', audio:'' },
      'boss-win':      { text:'ชนะบอสแล้ว', type:'perfect', audio:'' },

      'summary-learn': { text:'ฝึกเสร็จแล้ว เก่งมาก', type:'good', audio:'' },
      'summary-win':   { text:'จบเกมแล้ว เก่งมาก', type:'perfect', audio:'' },
      'summary-open':  { text:'สรุปผลรอบนี้', type:'ok', audio:'' }
    }
  });
}