/* === /herohealth/vr-groups/audio.js ===
GroupsVR Audio — WebAudio SFX (B+++++)
✅ init on first user gesture
✅ tick/tickFast (mini urgent), beat pulse
✅ good/bad/boss/bossHurt/bossHeal/power/freeze
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const AudioNS = (NS.Audio = NS.Audio || {});

  let ctx=null, master=null, ready=false;

  function ensure(){
    if (ready) return true;
    try{
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
      ready = true;
      return true;
    }catch(e){ console.warn('Audio init fail', e); return false; }
  }

  function resume(){
    if (!ensure()) return;
    try{ if (ctx.state === 'suspended') ctx.resume(); }catch{}
  }

  function tone(freq=440, dur=0.06, type='sine', vol=0.22){
    if (!ready) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function chirp(f1, f2, dur=0.09, type='sine', vol=0.24){
    if (!ready) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30,f1), t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30,f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function tick(){ resume(); tone(880, 0.045, 'square', 0.12); }
  function tickFast(){ resume(); tone(980, 0.035, 'square', 0.12); }
  function beat(){ resume(); tone(740, 0.03, 'triangle', 0.08); }

  function good(){ resume(); chirp(520, 980, 0.07, 'sine', 0.20); }
  function bad(){ resume(); chirp(420, 220, 0.08, 'sawtooth', 0.18); }

  function boss(){ resume(); tone(140, 0.09, 'sawtooth', 0.24); tone(210, 0.08, 'sawtooth', 0.18); }
  function bossHurt(){ resume(); chirp(380, 180, 0.06, 'square', 0.20); }
  function bossHeal(){ resume(); chirp(200, 360, 0.08, 'triangle', 0.18); }

  function power(){ resume(); chirp(700, 1200, 0.09, 'triangle', 0.22); }
  function freeze(){ resume(); chirp(620, 310, 0.10, 'triangle', 0.22); }

  function setVolume(v){
    if (!ensure()) return;
    master.gain.value = Math.max(0, Math.min(1, Number(v)||0.18));
  }

  AudioNS.init = function(){ ensure(); resume(); };
  AudioNS.tick = tick;
  AudioNS.tickFast = tickFast;
  AudioNS.beat = beat;
  AudioNS.good = good;
  AudioNS.bad = bad;
  AudioNS.boss = boss;
  AudioNS.bossHurt = bossHurt;
  AudioNS.bossHeal = bossHeal;
  AudioNS.power = power;
  AudioNS.freeze = freeze;
  AudioNS.setVolume = setVolume;

})(typeof window !== 'undefined' ? window : globalThis);