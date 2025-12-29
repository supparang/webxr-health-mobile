/* === /herohealth/vr-groups/audio.js ===
GroupsVR Audio (PRODUCTION)
✅ Star melody (⭐) + still supports storm tick
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});

  let ctx = null, master = null, unlocked = false;

  function ensureCtx(){
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
    const c = ensureCtx();
    if (!c) return;
    if (unlocked) return;
    try{ c.resume && c.resume(); }catch{}
    unlocked = true;
  }

  function beep(freq, durMs, type){
    const c = ensureCtx();
    if (!c || !master || !unlocked) return;

    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = Math.max(60, Number(freq)||220);

    const t0 = c.currentTime;
    const dur = Math.max(0.02, (Number(durMs)||80)/1000);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function blipGood(){ beep(880, 65, 'triangle'); beep(1320, 50, 'sine'); }
  function blipBad(){  beep(180, 95, 'sawtooth'); }
  function blipBoss(){ beep(420, 80, 'square'); beep(260, 120, 'square'); }
  function blipIce(){  beep(520, 60, 'sine'); beep(740, 70, 'triangle'); }

  function starMelody(){
    // short cute melody (4 notes + sparkle tail)
    const seq = [
      [1318, 55, 'triangle', 0],
      [1567, 55, 'triangle', 90],
      [1760, 70, 'sine',     170],
      [2093, 75, 'sine',     260],
      [2637, 45, 'sine',     360],
    ];
    seq.forEach(([f,d,t,delay])=>{
      setTimeout(()=> beep(f,d,t), delay);
    });
  }

  let stormTickTimer = null;
  function startStormTick(){
    if (stormTickTimer) return;
    stormTickTimer = setInterval(()=>{ beep(980, 30, 'square'); }, 240);
  }
  function stopStormTick(){
    if (!stormTickTimer) return;
    clearInterval(stormTickTimer);
    stormTickTimer = null;
  }

  root.addEventListener('pointerdown', unlock, { passive:true });
  root.addEventListener('touchstart', unlock, { passive:true });

  root.addEventListener('groups:progress', (ev)=>{
    const d = (ev && ev.detail) || {};
    if (d.type === 'hit'){
      if (d.correct) blipGood();
      else blipBad();
    }
    if (d.kind === 'star_hit') starMelody();
    if (d.kind === 'ice_hit')  blipIce();
  }, { passive:true });

  root.addEventListener('hha:judge', (ev)=>{
    const d = (ev && ev.detail) || {};
    const k = String(d.kind||'').toLowerCase();
    if (k === 'bad' || k === 'miss') blipBad();
    else if (k === 'boss') blipBoss();
    else if (k === 'good') blipGood();
  }, { passive:true });

  root.addEventListener('groups:storm_urgent', (ev)=>{
    const d = (ev && ev.detail) || {};
    if (d.on) startStormTick();
    else stopStormTick();
  }, { passive:true });

  NS.Audio = { unlock };

})(typeof window !== 'undefined' ? window : globalThis);