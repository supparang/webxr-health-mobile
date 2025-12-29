/* === /herohealth/vr-groups/audio.js ===
Groups VR — Audio (PRODUCTION)
✅ listens:
 - groups:progress { type:'hit', correct:boolean }
 - hha:judge {kind:'MISS'|'bad'|'boss'|'good' }
 - groups:storm {on:boolean}
✅ WebAudio safe (resume on user gesture)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  let AC = null;
  let unlocked = false;
  let stormTickTimer = 0;

  function ensureAC(){
    if (AC) return AC;
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    AC = new Ctx();
    return AC;
  }

  function unlock(){
    if (unlocked) return;
    const ac = ensureAC();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(()=>{});
    unlocked = true;
  }

  function tone(freq, dur=0.07, type='sine', gain=0.06){
    const ac = ensureAC();
    if (!ac) return;
    try{
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ac.destination);
      const t0 = ac.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start();
      o.stop(t0 + dur + 0.02);
    }catch{}
  }

  function good(){ tone(740, 0.06, 'triangle', 0.07); }
  function bad(){ tone(220, 0.08, 'sawtooth', 0.08); }
  function miss(){ tone(140, 0.10, 'square', 0.08); }
  function boss(){ tone(520, 0.12, 'sawtooth', 0.10); }
  function bonus(){ tone(980, 0.07, 'triangle', 0.08); }
  function tick(){ tone(880, 0.03, 'sine', 0.03); }

  function startStormTicks(){
    stopStormTicks();
    stormTickTimer = setInterval(()=>tick(), 320);
  }
  function stopStormTicks(){
    if (stormTickTimer) clearInterval(stormTickTimer);
    stormTickTimer = 0;
  }

  // unlock on first interaction
  ['pointerdown','touchstart','keydown'].forEach(ev=>{
    root.addEventListener(ev, unlock, {passive:true, once:true});
  });

  root.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    if (String(d.type||'') === 'hit'){
      unlock();
      if (d.correct) good();
      else bad();
    }
  }, {passive:true});

  root.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail||{};
    const k = String(d.kind||'').toLowerCase();
    unlock();
    if (k === 'miss') miss();
    else if (k === 'bad') bad();
    else if (k === 'boss') boss();
    else if (k === 'good') bonus();
  }, {passive:true});

  root.addEventListener('groups:storm', (ev)=>{
    const d = ev.detail||{};
    if (d.on) startStormTicks();
    else stopStormTicks();
  }, {passive:true});

  NS.Audio = { good, bad, miss, boss, bonus, tick, unlock };
})(typeof window !== 'undefined' ? window : globalThis);