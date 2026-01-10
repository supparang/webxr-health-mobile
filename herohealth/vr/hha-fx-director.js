// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Standard, shared across all games)
// ✅ Listens: hha:judge, hha:boss, hha:celebrate, hha:end
// ✅ Uses: window.Particles (or window.GAME_MODULES.Particles) if present
// ✅ Adds: body classes for boss/phase/rage/stun/armor (CSS hooks)
// ✅ Rate-limit to prevent spam in mobile
//
// Usage: include AFTER particles.js
// <script src="./vr/particles.js" defer></script>
// <script src="./vr/hha-fx-director.js" defer></script>

(function (root) {
  'use strict';
  const WIN = root;
  const DOC = root.document;
  if (!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const CFG = Object.assign({
    judgeCooldownMs: 90,
    bigCooldownMs: 420,
    debug: false
  }, WIN.HHA_FX_CFG || {});

  function log(...a){ if(CFG.debug) console.log('[FX]', ...a); }

  function getParticles(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }

  function now(){ return performance.now(); }

  // ---- rate limit ----
  let lastJudgeAt = 0;
  let lastBigAt = 0;

  function allowJudge(){
    const t = now();
    if(t - lastJudgeAt < CFG.judgeCooldownMs) return false;
    lastJudgeAt = t;
    return true;
  }
  function allowBig(){
    const t = now();
    if(t - lastBigAt < CFG.bigCooldownMs) return false;
    lastBigAt = t;
    return true;
  }

  function centerXY(){
    const w = DOC.documentElement.clientWidth || 360;
    const h = DOC.documentElement.clientHeight || 640;
    return { x: w/2, y: h/2 };
  }

  function setBodyFlag(cls, on){
    try{ DOC.body.classList.toggle(cls, !!on); }catch(_){}
  }

  // ------------------------------------------------------------
  // 1) hha:judge (micro feedback)
  // detail: {label, kind, x, y}
  // kind: good/bad/miss/block/fever/boss/rage/phase/armor/decoy/start/...
  // ------------------------------------------------------------
  function onJudge(ev){
    if(!allowJudge()) return;
    const d = ev?.detail || {};
    const P = getParticles();
    if(!P) return;

    const c = centerXY();
    const x = Number(d.x ?? c.x);
    const y = Number(d.y ?? c.y);
    const kind = String(d.kind || '').toLowerCase();
    const label = (d.label == null) ? '' : String(d.label);

    // text
    if(label){
      try{
        if(P.popText) P.popText(x, y, label, kind ? ('fx-' + kind) : '');
        else if(P.pop) P.pop(x, y, label);
      }catch(_){}
    }

    // bursts
    try{
      if(P.burstAt){
        if(kind === 'good') P.burstAt(x,y,'good');
        else if(kind === 'bad' || kind === 'miss') P.burstAt(x,y,'bad');
        else if(kind === 'block') P.burstAt(x,y,'block');
        else if(kind === 'fever') P.burstAt(x,y,'perfect');
        else if(kind === 'boss' || kind === 'rage') P.burstAt(x,y,'boss');
      }
    }catch(_){}

    // tiny class pulse for CSS
    if(kind){
      const cls = 'hha-judge-' + kind;
      setBodyFlag(cls, true);
      setTimeout(()=>setBodyFlag(cls,false), 180);
    }

    log('judge', d);
  }

  // ------------------------------------------------------------
  // 2) hha:boss (state -> CSS hooks)
  // detail: {active,hp,hpMax,phase,armorOpen,decoyOn,stunT,rage}
  // ------------------------------------------------------------
  function onBoss(ev){
    const d = ev?.detail || {};
    const active = !!d.active;

    setBodyFlag('hha-boss', active);
    setBodyFlag('hha-rage',  active && !!d.rage);
    setBodyFlag('hha-armor', active && !!d.armorOpen);
    setBodyFlag('hha-decoy', active && !!d.decoyOn);
    setBodyFlag('hha-stun',  active && (Number(d.stunT||0) > 0.02));

    // phase hooks
    const ph = Number(d.phase || 0);
    setBodyFlag('hha-phase1', active && ph === 1);
    setBodyFlag('hha-phase2', active && ph === 2);

    log('boss', d);
  }

  // ------------------------------------------------------------
  // 3) celebrate / end (big FX)
  // ------------------------------------------------------------
  function onCelebrate(ev){
    if(!allowBig()) return;
    const d = ev?.detail || {};
    const P = getParticles();
    if(!P) return;

    const c = centerXY();
    const kind = String(d.kind || 'win').toLowerCase();

    try{
      if(P.celebrate) P.celebrate(kind);
      if(P.burstAt){
        P.burstAt(c.x, c.y, (kind==='boss') ? 'boss' : 'perfect');
      }
    }catch(_){}

    setBodyFlag('hha-celebrate', true);
    setTimeout(()=>setBodyFlag('hha-celebrate', false), 650);

    log('celebrate', d);
  }

  function onEnd(ev){
    if(!allowBig()) return;
    const d = ev?.detail || {};
    const P = getParticles();
    if(!P) return;

    const c = centerXY();
    const reason = String(d.reason || '').toLowerCase();

    try{
      if(reason === 'misslimit' || reason === 'gameover'){
        if(P.burstAt) P.burstAt(c.x, c.y, 'bad');
        if(P.popText) P.popText(c.x, c.y, 'GAME OVER', 'fx-end fx-bad');
      }else{
        if(P.burstAt) P.burstAt(c.x, c.y, 'perfect');
        if(P.popText) P.popText(c.x, c.y, 'COMPLETED!', 'fx-end fx-good');
      }
    }catch(_){}

    log('end', d);
  }

  // ------------------------------------------------------------
  // bind (window + document for safety)
  // ------------------------------------------------------------
  function bind(tgt){
    try{
      tgt.addEventListener('hha:judge', onJudge, { passive:true });
      tgt.addEventListener('hha:boss', onBoss, { passive:true });
      tgt.addEventListener('hha:celebrate', onCelebrate, { passive:true });
      tgt.addEventListener('hha:end', onEnd, { passive:true });
    }catch(_){}
  }
  bind(WIN);
  bind(DOC);

})(window);