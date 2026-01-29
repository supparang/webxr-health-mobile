// === /fitness/js/audio-cues.js — WebAudio Synth cues (no assets) ===
'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

export function createAudioCues(){
  let ctx = null;
  let master = null;
  let enabled = true;
  let unlocked = false;

  function ensure(){
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }

  async function unlock(){
    try{
      ensure();
      if (!ctx) return false;
      if (ctx.state === 'suspended') await ctx.resume();
      // tiny click to unlock on iOS
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      o.frequency.value = 220;
      o.connect(g); g.connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.02);
      unlocked = true;
      return true;
    }catch(_){
      return false;
    }
  }

  function setEnabled(v){
    enabled = !!v;
    if (master) master.gain.value = enabled ? 0.35 : 0.0;
  }

  function beep(freq=440, dur=0.06, type='sine', vol=0.25){
    if (!enabled) return;
    ensure();
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(clamp(vol,0.02,0.8), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function chirpUp(){
    if (!enabled) return;
    ensure();
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(420, t0);
    o.frequency.exponentialRampToValueAtTime(980, t0 + 0.10);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(master);
    o.start(); o.stop(t0 + 0.13);
  }

  function thud(){
    // bomb / fail
    beep(120, 0.10, 'sawtooth', 0.18);
    beep(70, 0.14, 'square', 0.12);
  }

  function tick(){
    beep(820, 0.03, 'sine', 0.12);
  }

  function feverOn(){
    beep(660, 0.06, 'triangle', 0.18);
    beep(990, 0.08, 'triangle', 0.18);
  }

  function phaseUp(){
    chirpUp();
    beep(540, 0.07, 'sine', 0.14);
  }

  function bossClear(){
    beep(523.25, 0.08, 'triangle', 0.22);
    beep(659.25, 0.08, 'triangle', 0.22);
    beep(783.99, 0.10, 'triangle', 0.22);
  }

  return {
    unlock,
    setEnabled,
    tick,
    thud,
    feverOn,
    phaseUp,
    bossClear
  };
}