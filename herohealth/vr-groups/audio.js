// === /herohealth/vr-groups/audio.js ===
// GroupsVR SFX — SAFE (no external assets)
// ✅ WebAudio synth (no mp3 required)
// ✅ Unlock on first user gesture
// ✅ Toggle: ?sfx=0 to disable
// Exposes: window.GroupsVR.Audio = { unlock(), play(name, strength), enabled }

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  function qs(k,d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  const enabled = !(['0','false','off'].includes(String(qs('sfx','1')).toLowerCase()));

  let ctx = null;
  let unlocked = false;
  let gain = null;

  function ensure(){
    if(!enabled) return null;
    if(ctx) return ctx;
    try{
      ctx = new (root.AudioContext || root.webkitAudioContext)();
      gain = ctx.createGain();
      gain.gain.value = 0.18; // master volume
      gain.connect(ctx.destination);
    }catch(_){ ctx=null; }
    return ctx;
  }

  async function unlock(){
    if(!enabled) return false;
    const c = ensure();
    if(!c) return false;
    try{
      if(c.state === 'suspended') await c.resume();
      // tiny silent blip to fully unlock
      const o = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(gain);
      o.start(); o.stop(c.currentTime + 0.01);
      unlocked = true;
      return true;
    }catch(_){ return false; }
  }

  function beep(freq, durMs, type, vol){
    const c = ensure();
    if(!c || !enabled) return;
    if(!unlocked) return; // keep silent until gesture
    try{
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime);
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.12), c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (durMs/1000));

      o.connect(g); g.connect(gain);
      o.start();
      o.stop(c.currentTime + (durMs/1000) + 0.02);
    }catch(_){}
  }

  function sweep(f1, f2, durMs, type, vol){
    const c = ensure();
    if(!c || !enabled || !unlocked) return;
    try{
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(f1, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(20,f2), c.currentTime + (durMs/1000));
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.14), c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (durMs/1000));
      o.connect(g); g.connect(gain);
      o.start();
      o.stop(c.currentTime + (durMs/1000) + 0.02);
    }catch(_){}
  }

  // Sound map (short + punchy)
  function play(name, strength){
    if(!enabled) return;
    strength = Math.max(0.6, Math.min(1.6, Number(strength)||1));
    switch(String(name||'')){
      case 'good':      beep(660, 90, 'sine', 0.10*strength); break;
      case 'perfect':   sweep(520, 1100, 140, 'triangle', 0.14*strength); break;
      case 'hit':       beep(820, 70, 'square', 0.08*strength); break;
      case 'bad':       beep(160, 130, 'sawtooth', 0.10*strength); break;
      case 'miss':      beep(220, 120, 'square', 0.08*strength); break;

      case 'storm_on':  sweep(280, 520, 240, 'sawtooth', 0.10*strength); break;
      case 'storm_off': sweep(520, 320, 180, 'triangle', 0.09*strength); break;

      case 'boss':      sweep(180, 90, 220, 'square', 0.11*strength); break;
      case 'boss_down': sweep(220, 880, 220, 'triangle', 0.15*strength); break;

      case 'mini':      sweep(420, 760, 160, 'sine', 0.10*strength); break;
      case 'mini_clear':sweep(520, 980, 180, 'triangle', 0.13*strength); break;
      case 'mini_fail': beep(140, 160, 'sawtooth', 0.11*strength); break;
      default: break;
    }
  }

  // Auto-unlock on first gesture
  function bindUnlock(){
    if(!DOC) return;
    const once = async ()=>{
      DOC.removeEventListener('pointerdown', once, true);
      DOC.removeEventListener('touchstart', once, true);
      DOC.removeEventListener('keydown', once, true);
      await unlock();
    };
    DOC.addEventListener('pointerdown', once, true);
    DOC.addEventListener('touchstart', once, true);
    DOC.addEventListener('keydown', once, true);
  }
  bindUnlock();

  NS.Audio = { unlock, play, get enabled(){ return enabled; } };
})(window);