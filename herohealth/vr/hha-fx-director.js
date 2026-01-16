// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (shared across all games)
// ✅ Listens: hha:judge, hha:storm, hha:boss, hha:end, hha:celebrate, hha:score, hha:miss
// ✅ Uses: window.GAME_MODULES.Particles or window.Particles (compatible with minimal particles.js)
// ✅ Safe: idempotent load guard, rate-limit, prefers event x/y, falls back to center/top
// ✅ Adds small screen shakes via body class (optional CSS hooks)
// ✅ Keeps effects consistent across games (but you can still theme via CSS classes per game)

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();

  function fx(){
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function centerPos(){
    const W = DOC.documentElement.clientWidth || innerWidth || 0;
    const H = DOC.documentElement.clientHeight || innerHeight || 0;
    return { x: Math.floor(W/2), y: Math.floor(H*0.32) };
  }

  function bodyPulse(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){} }, ms||180);
    }catch(_){}
  }

  function hasFn(P, name){ return !!(P && typeof P[name]==='function'); }

  function popText(x,y,text,cls=null,opts=null){
    const P = fx();
    try{
      if(hasFn(P,'popText')) P.popText(x,y,text,cls,opts);
      else if(hasFn(P,'scorePop')) P.scorePop(x,y,text); // older
    }catch(_){}
  }

  function burstAt(x,y,kind='good',opts=null){
    const P = fx();
    try{
      if(hasFn(P,'burstAt')) P.burstAt(x,y,kind,opts);
    }catch(_){}
  }

  function ringPulse(x,y,kind='good',opts=null){
    const P = fx();
    try{
      if(hasFn(P,'ringPulse')) P.ringPulse(x,y,kind,opts);
    }catch(_){}
  }

  function celebrate(kind='win', opts=null){
    const P = fx();
    try{
      if(hasFn(P,'celebrate')) P.celebrate(kind, opts);
    }catch(_){}
  }

  // ---------------- rate limit ----------------
  const RL = {
    judge: 0,
    score: 0,
    miss: 0,
    boss: 0,
    storm: 0,
  };
  function allow(key, ms){
    const t = now();
    if(t - (RL[key]||0) < ms) return false;
    RL[key] = t;
    return true;
  }

  // ---------------- mapping ----------------
  function kindFromJudgeType(t){
    t = String(t||'').toLowerCase();
    if(t==='good') return 'good';
    if(t==='perfect') return 'star';
    if(t==='bad') return 'bad';
    if(t==='miss') return 'bad';
    if(t==='block') return 'shield';
    return 'good';
  }

  function clsFromJudgeType(t){
    t = String(t||'').toLowerCase();
    if(t==='good') return 'good';
    if(t==='perfect') return 'warn';
    if(t==='bad') return 'bad';
    if(t==='miss') return 'bad';
    if(t==='block') return 'cyan';
    return null;
  }

  function defaultTextForJudge(t){
    t = String(t||'').toLowerCase();
    if(t==='good') return 'GOOD!';
    if(t==='perfect') return 'NICE!';
    if(t==='bad') return 'OOPS!';
    if(t==='miss') return 'MISS';
    if(t==='block') return 'BLOCK';
    return 'OK';
  }

  // ---------------- listeners ----------------
  function onJudge(ev){
    if(!allow('judge', 60)) return; // frequent, keep lightweight
    const d = ev?.detail || {};
    const type = d.type || '';
    const label = d.label || defaultTextForJudge(type);

    const pos = {
      x: Math.floor(Number(d.x) || 0),
      y: Math.floor(Number(d.y) || 0),
    };
    if(!(pos.x>0 && pos.y>0)){
      const c = centerPos();
      pos.x = c.x; pos.y = c.y;
    }

    const kind = kindFromJudgeType(type);
    const cls  = clsFromJudgeType(type);

    // Core FX
    burstAt(pos.x, pos.y, kind);
    ringPulse(pos.x, pos.y, kind, { size: (type==='perfect') ? 180 : (type==='bad'||type==='miss') ? 170 : 140 });

    // Text (rate-limit heavier)
    if(allow('score', 90)){
      popText(pos.x, pos.y - 8, String(label), cls, { size: (type==='perfect')?20:(type==='bad'||type==='miss')?18:16 });
    }

    // Screen pulses
    if(type==='perfect'){
      bodyPulse('hha-fx-perfect', 160);
    }else if(type==='bad' || type==='miss'){
      bodyPulse('hha-fx-bad', 180);
    }else if(type==='block'){
      bodyPulse('hha-fx-block', 140);
    }else{
      bodyPulse('hha-fx-good', 120);
    }
  }

  function onStorm(ev){
    if(!allow('storm', 250)) return;
    const d = ev?.detail || {};
    const on = !!d.on;
    const c = centerPos();
    if(on){
      ringPulse(c.x, Math.floor(c.y*0.9), 'star', { size: 260 });
      popText(c.x, Math.floor(c.y*0.75), 'STORM!', 'warn', { size: 22 });
      bodyPulse('hha-fx-storm', 420);
    }else{
      popText(c.x, Math.floor(c.y*0.75), 'STORM CLEAR', 'good', { size: 16 });
      bodyPulse('hha-fx-storm-clear', 260);
    }
  }

  function onBoss(ev){
    if(!allow('boss', 180)) return;
    const d = ev?.detail || {};
    const on = !!d.on;
    const hp = Number(d.hp ?? 0);
    const hpMax = Number(d.hpMax ?? 0);
    const phase = Number(d.phase ?? 0);
    const rage = !!d.rage;

    const c = centerPos();
    if(on){
      const tag = `BOSS${phase?(' P'+phase):''}${rage?' RAGE':''}`;
      ringPulse(c.x, Math.floor(c.y*1.02), rage ? 'bad' : 'violet', { size: rage ? 320 : 280 });
      popText(c.x, Math.floor(c.y*0.78), `${tag} · HP ${hp}/${hpMax}`, rage?'bad':'violet', { size: 20 });
      bodyPulse(rage?'hha-fx-rage':'hha-fx-boss', 520);
    }else{
      popText(c.x, Math.floor(c.y*0.78), 'BOSS DOWN!', 'good', { size: 22 });
      celebrate('boss', { count: 18 });
      bodyPulse('hha-fx-boss-down', 520);
    }
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = d.kind || 'win';
    celebrate(kind, d || null);
  }

  function onEnd(ev){
    // Keep this subtle; avoid double overlay visuals
    const d = ev?.detail || {};
    const grade = d.grade || '';
    const c = centerPos();
    if(allow('boss', 600)){
      popText(c.x, Math.floor(c.y*0.70), grade ? `GRADE ${grade}` : 'END', 'good', { size: 22 });
      celebrate('win', { count: 16 });
      bodyPulse('hha-fx-end', 520);
    }
  }

  // optional tiny FX on score/miss changes (if emitted)
  function onScore(ev){
    if(!allow('score', 110)) return;
    const d = ev?.detail || {};
    const delta = Number(d.delta || 0);
    if(!delta) return;
    const x = Number(d.x||0), y = Number(d.y||0);
    if(!(x>0 && y>0)) return;
    popText(x, y - 10, (delta>0?`+${delta}`:`${delta}`), delta>0?'good':'bad', { size: 14 });
  }
  function onMiss(ev){
    if(!allow('miss', 140)) return;
    const d = ev?.detail || {};
    const dm = Number(d.deltaMiss || 0);
    if(!dm) return;
    const x = Number(d.x||0), y = Number(d.y||0);
    if(!(x>0 && y>0)) return;
    popText(x, y - 10, `MISS +${Math.abs(dm)}`, 'bad', { size: 14 });
  }

  // ---------------- attach ----------------
  root.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:judge', onJudge, { passive:true });

  root.addEventListener('hha:storm', onStorm, { passive:true });
  DOC.addEventListener('hha:storm', onStorm, { passive:true });

  root.addEventListener('hha:boss', onBoss, { passive:true });
  DOC.addEventListener('hha:boss', onBoss, { passive:true });

  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  DOC.addEventListener('hha:celebrate', onCelebrate, { passive:true });

  root.addEventListener('hha:end', onEnd, { passive:true });
  DOC.addEventListener('hha:end', onEnd, { passive:true });

  root.addEventListener('hha:score', onScore, { passive:true });
  DOC.addEventListener('hha:score', onScore, { passive:true });

  root.addEventListener('hha:miss', onMiss, { passive:true });
  DOC.addEventListener('hha:miss', onMiss, { passive:true });

})(window);