// === /herohealth/hydration-vr/hydration.audio.js ===
// Hydration Audio FX (no external files) — PRODUCTION SAFE
'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

export function createHydrationAudio(opts = {}){
  const state = {
    ctx: null,
    enabled: true,
    unlocked: false,
    vol: Math.max(0, Math.min(1, Number(opts.volume ?? 0.22)))
  };

  function ensure(){
    if (!state.enabled) return null;
    if (state.ctx) return state.ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    state.ctx = new AC();
    return state.ctx;
  }

  async function unlock(){
    const ctx = ensure();
    if (!ctx) return false;
    try{
      if (ctx.state === 'suspended') await ctx.resume();
      state.unlocked = true;
      return true;
    }catch{ return false; }
  }

  function tone(freq, dur=0.08, type='sine', gain=0.25){
    const ctx = ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;

    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);

    const g = ctx.createGain();
    const v = state.vol * gain;

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function sweep(f1, f2, dur=0.12, type='triangle', gain=0.22){
    const ctx = ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;

    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f1, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f2), t0 + dur);

    const g = ctx.createGain();
    const v = state.vol * gain;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // public fx
  function good(perfect=false){
    if (perfect) { tone(880, 0.06, 'sine', 0.28); tone(1320, 0.07, 'triangle', 0.18); }
    else tone(740, 0.06, 'sine', 0.22);
  }
  function miss(){
    sweep(260, 120, 0.14, 'sawtooth', 0.28);
  }
  function power(){
    tone(540, 0.05, 'triangle', 0.20);
    tone(980, 0.09, 'sine', 0.24);
  }
  function tick(urgent=false){
    tone(urgent ? 980 : 740, 0.03, 'square', urgent ? 0.18 : 0.12);
  }
  function celebrate(){
    tone(660, 0.06, 'triangle', 0.22);
    tone(990, 0.06, 'triangle', 0.22);
    tone(1320,0.09, 'sine',    0.20);
  }

  return {
    unlock,
    setEnabled(v){ state.enabled = !!v; },
    setVolume(v){ state.vol = Math.max(0, Math.min(1, Number(v)||0)); },
    good,
    miss,
    power,
    tick,
    celebrate
  };
}