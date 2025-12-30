/* === /herohealth/vr-groups/audio.js ===
Simple WebAudio SFX for GroupsVR
Provides: GroupsVR.Audio.good/bad/boss/storm/tick
*/
(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const Audio = (NS.Audio = NS.Audio || {});
  let ctx = null;

  function ensure(){
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function beep(freq=440, dur=0.06, type='sine', gain=0.06){
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(()=>{});
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;

    o.connect(g); g.connect(c.destination);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0);
    o.stop(t0 + dur + 0.01);
  }

  Audio.good = ()=>{ beep(720,0.055,'triangle',0.055); beep(980,0.05,'triangle',0.035); };
  Audio.bad  = ()=>{ beep(220,0.08,'sawtooth',0.06); };
  Audio.boss = ()=>{ beep(520,0.09,'square',0.05); beep(310,0.08,'square',0.035); };
  Audio.storm= ()=>{ beep(410,0.09,'sawtooth',0.035); beep(660,0.07,'sawtooth',0.03); };
  Audio.tick = ()=>{ beep(1200,0.03,'square',0.03); };

})(typeof window!=='undefined'?window:globalThis);