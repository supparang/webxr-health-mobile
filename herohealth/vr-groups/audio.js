/* === /herohealth/vr-groups/audio.js ===
Simple WebAudio SFX for GroupsVR
✅ tick (mini urgent)
✅ good / bad / boss / storm / overdrive
Expose: window.GroupsVR.Audio.{tick,good,bad,boss,storm,overdrive,unlock}
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});

  let ctx = null;
  let master = null;
  let unlocked = false;

  function ensure(){
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlock(){
    const c = ensure();
    if (!c) return false;
    if (c.state === 'suspended') c.resume().catch(()=>{});
    unlocked = true;
    return true;
  }

  function tone(freq, durMs, type, gain, sweepTo){
    const c = ensure();
    if (!c) return;
    unlock();
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + (durMs/1000));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain||0.12), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));
    o.connect(g); g.connect(master);
    o.start(t0);
    o.stop(t0 + (durMs/1000) + 0.02);
  }

  function tick(){ tone(880, 70, 'square', 0.08, 760); }
  function good(){ tone(660, 90, 'triangle', 0.10, 990); }
  function bad(){ tone(220, 130, 'sawtooth', 0.12, 160); }
  function boss(){ tone(180, 160, 'sawtooth', 0.14, 360); tone(480, 120, 'square', 0.10, 520); }
  function storm(){ tone(420, 120, 'square', 0.10, 250); }
  function overdrive(){ tone(520, 120, 'triangle', 0.12, 980); tone(980, 120, 'triangle', 0.10, 1200); }

  // auto-unlock on first gesture
  function bindUnlock(){
    if (bindUnlock._done) return;
    bindUnlock._done = true;
    const fn = ()=>{ unlock(); root.removeEventListener('pointerdown', fn, true); root.removeEventListener('keydown', fn, true); };
    root.addEventListener('pointerdown', fn, true);
    root.addEventListener('keydown', fn, true);
  }
  bindUnlock();

  NS.Audio = { unlock, tick, good, bad, boss, storm, overdrive };
})(typeof window !== 'undefined' ? window : globalThis);