/* === /herohealth/vr-groups/audio.js ===
Groups VR Audio — tiny WebAudio SFX
Exports: window.GroupsVRAudio.{tick,ding,fail,roar}
*/

(function(root){
  'use strict';

  function ctx(){
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!root.__HHA_AC) root.__HHA_AC = new AC();
    return root.__HHA_AC;
  }

  function beep(freq, durMs, type, gain){
    const ac = ctx();
    if (!ac) return;
    try{ if (ac.state === 'suspended') ac.resume(); }catch{}
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = Math.max(0.0001, gain ?? 0.06);
    o.connect(g); g.connect(ac.destination);

    const t0 = ac.currentTime;
    const t1 = t0 + (durMs/1000);
    g.gain.setValueAtTime(g.gain.value, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);

    o.start(t0);
    o.stop(t1 + 0.01);
  }

  function tick(){ beep(880, 70, 'square', 0.04); }
  function ding(){ beep(660, 110, 'sine', 0.07); setTimeout(()=>beep(990, 120, 'sine', 0.06), 90); }
  function fail(){ beep(220, 160, 'sawtooth', 0.06); setTimeout(()=>beep(180, 160, 'sawtooth', 0.05), 120); }
  function roar(){ beep(140, 180, 'triangle', 0.05); setTimeout(()=>beep(110, 220, 'triangle', 0.05), 120); }

  root.GroupsVRAudio = { tick, ding, fail, roar };
})(typeof window !== 'undefined' ? window : globalThis);