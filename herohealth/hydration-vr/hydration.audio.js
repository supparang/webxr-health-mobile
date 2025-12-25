// === /herohealth/hydration-vr/hydration.audio.js ===
// Tiny safe WebAudio helper (no assets required)
// - unlock() must be called on first user gesture

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

export function createHydrationAudio(opts={}){
  const volume = Math.max(0, Math.min(1, Number(opts.volume ?? 0.22)));

  let ctx = null;
  let unlocked = false;

  function getCtx(){
    if(ctx) return ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    return ctx;
  }

  async function unlock(){
    const c = getCtx();
    if(!c) return;
    if(c.state === 'suspended'){
      try{ await c.resume(); }catch{}
    }
    unlocked = (c.state === 'running');
  }

  function beep(freq=440, dur=0.06, type='sine', gainMul=1){
    const c = getCtx();
    if(!c || !unlocked) return;
    const t0 = c.currentTime;

    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume*gainMul), t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);

    o.connect(g);
    g.connect(c.destination);

    o.start(t0);
    o.stop(t0+dur+0.01);
  }

  function tick(urgent=false){
    beep(urgent ? 980 : 720, urgent ? 0.045 : 0.035, 'square', urgent ? 0.35 : 0.22);
  }
  function good(perfect=false){
    beep(perfect ? 880 : 740, 0.055, 'triangle', perfect ? 0.45 : 0.35);
  }
  function miss(){
    beep(180, 0.08, 'sawtooth', 0.38);
  }
  function power(){
    beep(520, 0.05, 'triangle', 0.35);
    setTimeout(()=>beep(820, 0.05, 'triangle', 0.35), 60);
  }
  function celebrate(){
    beep(660, 0.06, 'triangle', 0.40);
    setTimeout(()=>beep(880, 0.06, 'triangle', 0.42), 70);
    setTimeout(()=>beep(1100,0.06, 'triangle', 0.42), 140);
  }

  return { unlock, tick, good, miss, power, celebrate };
}

export default { createHydrationAudio };
