export function createBrushAudio(opts = {}) {
  const state = {
    audioEnabled: opts.audioEnabled ?? true,
    voiceEnabled: opts.voiceEnabled ?? true,
    speakRate: opts.speakRate ?? 1.02,
    speakPitch: opts.speakPitch ?? 1.08,
    speakVolume: opts.speakVolume ?? 0.9,
    audioReady: false,
    audioCtx: null,
    lastVoiceAt: 0,
    lastVoiceKey: ''
  };

  const CUES = {
    'demo-start':    { text:'ลองถูตามนิ้ว', type:'ok' },
    'audio-on':      { text:'เปิดเสียงแล้ว', type:'good' },
    'learn-open':    { text:'มาฝึกแปรงฟันกัน', type:'ok' },
    'learn-watch':   { text:'ดูตัวอย่างก่อนนะ', type:'ok' },
    'learn-start':   { text:'เริ่มฝึกได้เลย', type:'good' },
    'wrong-zone':    { text:'ยังไม่ใช่โซนนี้', type:'warn' },
    'dir-good':      { text:'ดีมาก', type:'good' },
    'dir-warn':      { text:'ลองอีกนิด', type:'warn' },
    'zone-clear':    { text:'ผ่านโซนแล้ว', type:'good' },
    'zone-perfect':  { text:'เก่งมาก สามดาว', type:'perfect' },
    'boss-laser':    { text:'หยุดก่อน เลเซอร์มา', type:'bad' },
    'boss-shock':    { text:'แตะตามวงแหวน', type:'ok' },
    'boss-decoy':    { text:'อย่าแตะโซนหลอก', type:'warn' },
    'shock-perfect': { text:'เยี่ยมมาก', type:'perfect' },
    'laser-hit':     { text:'โดนเลเซอร์', type:'bad' },
    'decoy-hit':     { text:'โดนโซนหลอก', type:'bad' },
    'boss-phase':    { text:'ผ่านอีกเฟสแล้ว', type:'boss' },
    'boss-win':      { text:'ชนะบอสแล้ว', type:'perfect' },
    'summary-learn': { text:'ฝึกเสร็จแล้ว เก่งมาก', type:'good' },
    'summary-win':   { text:'จบเกมแล้ว เก่งมาก', type:'perfect' },
    'summary-open':  { text:'สรุปผลรอบนี้', type:'ok' }
  };

  function getCueDef(key){
    return CUES[key] || { text:key, type:'ok' };
  }

  function ensureAudio(){
    if (state.audioReady) return true;
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      state.audioCtx = state.audioCtx || new Ctx();
      if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume?.();
      }
      state.audioReady = true;
      return true;
    }catch{
      return false;
    }
  }

  function beep(type='ok'){
    if (!state.audioEnabled) return;
    if (!ensureAudio() || !state.audioCtx) return;

    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let freq = 620;
    let dur = 0.10;

    if (type === 'good') freq = 740;
    else if (type === 'warn'){ freq = 460; dur = 0.12; }
    else if (type === 'bad'){ freq = 280; dur = 0.16; }
    else if (type === 'boss'){ freq = 180; dur = 0.20; }
    else if (type === 'perfect'){ freq = 880; dur = 0.14; }

    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;

    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function speakShort(text, key=''){
    if (!state.audioEnabled || !state.voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;

    const now = performance.now();
    const dedupeKey = key || text;

    if (state.lastVoiceKey === dedupeKey && now - state.lastVoiceAt < 1400) return;
    if (now - state.lastVoiceAt < 700) return;

    try{
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'th-TH';
      utter.rate = state.speakRate;
      utter.pitch = state.speakPitch;
      utter.volume = state.speakVolume;
      window.speechSynthesis.speak(utter);

      state.lastVoiceAt = now;
      state.lastVoiceKey = dedupeKey;
    }catch{}
  }

  function playCue(key, overrideText=''){
    const def = getCueDef(key);
    const finalText = overrideText || def.text || '';
    const finalType = def.type || 'ok';
    beep(finalType);
    if (finalText) speakShort(finalText, key);
  }

  function setAudioEnabled(v){
    state.audioEnabled = !!v;
  }

  function setVoiceEnabled(v){
    state.voiceEnabled = !!v;
  }

  function toggleAudio(){
    state.audioEnabled = !state.audioEnabled;
    if (!state.audioEnabled) {
      try { window.speechSynthesis?.cancel?.(); } catch {}
    }
    return state.audioEnabled;
  }

  function getState(){
    return { ...state };
  }

  return {
    ensureAudio,
    beep,
    speakShort,
    playCue,
    setAudioEnabled,
    setVoiceEnabled,
    toggleAudio,
    getState
  };
}