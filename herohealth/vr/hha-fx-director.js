// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION
// Listens: hha:judge, hha:score, hha:miss, hha:celebrate
// Requires: ../vr/particles.js (Particles / GAME_MODULES.Particles)
//
// ✅ Works across all games (GoodJunk/Hydration/Plate/Groups)
// ✅ Safe: no-throw, no dependencies
// ✅ Small rate-limit to prevent FX spam

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();

  function P(){
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function getXY(d){
    const W = DOC.documentElement.clientWidth || innerWidth || 1;
    const H = DOC.documentElement.clientHeight || innerHeight || 1;
    let x = Number(d?.x);
    let y = Number(d?.y);

    if(!Number.isFinite(x)) x = W * 0.5;
    if(!Number.isFinite(y)) y = H * 0.42;

    // keep inside screen a bit
    x = clamp(x, 18, W-18);
    y = clamp(y, 18, H-18);
    return { x,y };
  }

  // small rate limit per channel
  const RL = {
    scoreAt: 0,
    judgeAt: 0,
    missAt: 0,
    celebAt: 0
  };

  function safeCall(fn, ...args){
    try{ fn && fn(...args); }catch(_){}
  }

  function onScore(ev){
    const t = now();
    if(t - RL.scoreAt < 60) return; // avoid spam
    RL.scoreAt = t;

    const d = ev?.detail || {};
    const {x,y} = getXY(d);
    const delta = Number(d.delta || 0);

    const p = P();
    if(!p) return;

    const text = (delta>0) ? `+${delta}` : String(delta);
    safeCall(p.scorePop || p.popText, x, y, text, delta>0 ? 'good' : 'bad');
  }

  function onMiss(ev){
    const t = now();
    if(t - RL.missAt < 90) return;
    RL.missAt = t;

    const d = ev?.detail || {};
    const {x,y} = getXY(d);
    const p = P();
    if(!p) return;

    safeCall(p.burstAt, x, y, 'bad');
    safeCall(p.popText, x, y, 'MISS');
  }

  function onJudge(ev){
    const t = now();
    if(t - RL.judgeAt < 40) return;
    RL.judgeAt = t;

    const d = ev?.detail || {};
    const type = String(d.type || '').toLowerCase();
    const label = String(d.label || '');

    const {x,y} = getXY(d);
    const combo = Number(d.combo || 0);

    const p = P();
    if(!p) return;

    if(type === 'perfect'){
      safeCall(p.burstAt, x, y, 'perfect');
      safeCall(p.popText, x, y, label || 'PERFECT');
      if(combo >= 10) safeCall(p.popText, x, y-26, `COMBO ${combo}`);
      return;
    }
    if(type === 'good'){
      safeCall(p.burstAt, x, y, 'good');
      if(label) safeCall(p.popText, x, y, label);
      return;
    }
    if(type === 'bad'){
      safeCall(p.burstAt, x, y, 'bad');
      if(label) safeCall(p.popText, x, y, label);
      return;
    }
    if(type === 'block'){
      safeCall(p.burstAt, x, y, 'block');
      safeCall(p.popText, x, y, label || 'BLOCK');
      return;
    }
    if(type === 'miss'){
      safeCall(p.burstAt, x, y, 'bad');
      return;
    }

    // default: tiny hint
    if(label) safeCall(p.popText, x, y, label);
  }

  function onCelebrate(ev){
    const t = now();
    if(t - RL.celebAt < 350) return;
    RL.celebAt = t;

    const d = ev?.detail || {};
    const kind = String(d.kind || 'end');
    const grade = String(d.grade || '');

    const p = P();
    if(!p) return;

    safeCall(p.celebrate, { kind, grade });
  }

  // Listen on BOTH window + document (you already use both in your ecosystem)
  root.addEventListener('hha:score', onScore, { passive:true });
  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:miss',  onMiss,  { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });

  DOC.addEventListener('hha:score', onScore, { passive:true });
  DOC.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:miss',  onMiss,  { passive:true });
  DOC.addEventListener('hha:celebrate', onCelebrate, { passive:true });

  // quick test helper
  root.HHA_FX_TEST = function(){
    const W = DOC.documentElement.clientWidth || innerWidth || 360;
    const H = DOC.documentElement.clientHeight || innerHeight || 640;
    const x = W*0.5, y = H*0.45;

    try{ root.dispatchEvent(new CustomEvent('hha:score',{detail:{delta:+12,x,y}})); }catch(_){}
    try{ root.dispatchEvent(new CustomEvent('hha:judge',{detail:{type:'perfect',x,y: y-40, combo:12, label:'PERFECT'}})); }catch(_){}
    try{ root.dispatchEvent(new CustomEvent('hha:miss',{detail:{x:x+40,y:y+30}})); }catch(_){}
    try{ root.dispatchEvent(new CustomEvent('hha:celebrate',{detail:{kind:'end', grade:'A'}})); }catch(_){}
    return 'FX_TEST fired';
  };
})(window);