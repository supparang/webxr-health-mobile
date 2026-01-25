// === /herohealth/vr-groups/audio.js ===
// Audio — PRODUCTION
// ✅ Simple, punchy, non-annoying sound cues (good/bad/miss/boss/storm/end)
// ✅ Starts only after user gesture (mobile-safe)
// ✅ Disable with ?mute=1
// ✅ Safe: never throws

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  const MUTE = String(qs('mute','0')||'0') === '1';

  let AC = null;
  let master = null;
  let ready = false;

  function ensure(){
    if (MUTE) return false;
    if (ready && AC) return true;
    try{
      const Ctx = WIN.AudioContext || WIN.webkitAudioContext;
      if (!Ctx) return false;
      AC = new Ctx();
      master = AC.createGain();
      master.gain.value = 0.45;
      master.connect(AC.destination);
      ready = true;
      return true;
    }catch(_){
      return false;
    }
  }

  async function resume(){
    if (!ensure()) return false;
    try{
      if (AC.state === 'suspended') await AC.resume();
      return true;
    }catch(_){
      return false;
    }
  }

  function tone(freq, durMs, type, gain){
    if (!ready || !AC || !master) return;
    try{
      const t0 = AC.currentTime;
      const o = AC.createOscillator();
      const g = AC.createGain();

      o.type = type || 'sine';
      o.frequency.value = clamp(freq, 80, 1400);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain||0.20), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (durMs/1000));

      o.connect(g);
      g.connect(master);

      o.start(t0);
      o.stop(t0 + (durMs/1000) + 0.02);
    }catch(_){}
  }

  function blipGood(){
    tone(660, 70, 'triangle', 0.18);
    tone(880, 60, 'triangle', 0.14);
  }
  function blipPerfect(){
    tone(740, 80, 'triangle', 0.20);
    tone(980, 90, 'triangle', 0.16);
  }
  function blipBad(){
    tone(220, 120, 'sawtooth', 0.14);
  }
  function blipMiss(){
    tone(160, 130, 'square', 0.10);
  }
  function blipBoss(){
    tone(260, 90, 'sawtooth', 0.18);
    tone(310, 90, 'sawtooth', 0.16);
  }
  function blipStorm(){
    tone(420, 60, 'square', 0.10);
    tone(520, 60, 'square', 0.10);
  }
  function blipEnd(){
    tone(523, 120, 'triangle', 0.14);
    tone(659, 120, 'triangle', 0.14);
    tone(784, 140, 'triangle', 0.13);
  }

  // Must be started by user gesture
  function hookGesture(){
    if (MUTE) return;
    let done = false;
    const once = async ()=>{
      if (done) return;
      done = true;
      await resume();
      DOC.removeEventListener('pointerdown', once, true);
      DOC.removeEventListener('touchstart', once, true);
      // tiny "ready" cue (very soft)
      try{ tone(440, 45, 'sine', 0.06); }catch(_){}
    };
    DOC.addEventListener('pointerdown', once, true);
    DOC.addEventListener('touchstart', once, true);
  }

  // Event bindings
  WIN.addEventListener('hha:judge', async (ev)=>{
    if (MUTE) return;
    await resume();
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if (k === 'good') blipGood();
    else if (k === 'perfect') blipPerfect();
    else if (k === 'bad') blipBad();
    else if (k === 'miss') blipMiss();
    else if (k === 'boss') blipBoss();
    else if (k === 'storm') blipStorm();
  }, {passive:true});

  WIN.addEventListener('groups:progress', async (ev)=>{
    if (MUTE) return;
    await resume();
    const d = ev.detail||{};
    if (d.kind === 'storm_on') blipStorm();
    if (d.kind === 'boss_spawn') blipBoss();
    if (d.kind === 'boss_down') blipPerfect();
    if (d.kind === 'perfect_switch') blipPerfect();
  }, {passive:true});

  WIN.addEventListener('hha:end', async ()=>{
    if (MUTE) return;
    await resume();
    blipEnd();
  }, {passive:true});

  hookGesture();

  NS.Audio = {
    isMuted(){ return MUTE; },
    resume
  };

})();