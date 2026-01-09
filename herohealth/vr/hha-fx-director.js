// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Universal)
// ✅ Unifies CSS FX across ALL games (GoodJunk/Hydration/Plate/Groups)
// ✅ Listens on BOTH window + document for events:
//    - hha:judge {label, kind, x, y}
//    - hha:coach {msg, kind}
//    - hha:score {score}
//    - hha:time {t}
//    - hha:end  {...}
//    - quest:update {goal, mini}
// ✅ Toggles body FX classes (pulse) safely:
//    fx-hit fx-good fx-bad fx-block fx-perfect fx-combo fx-storm fx-boss fx-rage fx-end fx-miss fx-mini fx-goal fx-lowtime
// ✅ Rate-limit popText so mobile won't drop frames
// ✅ Uses window.Particles.popText if available (particles.js)
// ✅ No dependencies

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const BODY = doc.body || doc.documentElement;

  // ----------------- helpers -----------------
  const now = ()=> (root.performance ? performance.now() : Date.now());
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };

  function getParticles(){
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function safeText(x){ return (x==null) ? '' : String(x); }

  function centerXY(){
    const W = doc.documentElement.clientWidth || 0;
    const H = doc.documentElement.clientHeight || 0;
    return { x: Math.floor(W/2), y: Math.floor(H*0.42) };
  }

  function popText(x,y,text){
    const P = getParticles();
    if(!P) return;
    try{
      if(typeof P.popText === 'function') P.popText(x,y,text);
      else if(typeof P.scorePop === 'function') P.scorePop(x,y,text);
    }catch(_){}
  }

  // ----------------- FX pulse (body classes) -----------------
  const pulseTimers = new Map();
  function pulse(cls, ms){
    ms = clamp(Number(ms)||0, 60, 1600);
    try{
      BODY.classList.add(cls);
      const prev = pulseTimers.get(cls);
      if(prev) clearTimeout(prev);
      const t = setTimeout(()=>{
        try{ BODY.classList.remove(cls); }catch(_){}
        pulseTimers.delete(cls);
      }, ms);
      pulseTimers.set(cls, t);
    }catch(_){}
  }

  // ----------------- Rate limit popText -----------------
  // mobile-friendly: at most N pops per window
  let lastPopAt = 0;
  let popBurst = 0;
  let popWindowStart = 0;

  const POP_CFG = {
    minGapMs: 70,       // gap between pops
    burstWindowMs: 700, // burst window
    burstMax: 6,        // max pops per window
  };

  function canPop(){
    const t = now();
    if(t - lastPopAt < POP_CFG.minGapMs) return false;

    if(t - popWindowStart > POP_CFG.burstWindowMs){
      popWindowStart = t;
      popBurst = 0;
    }
    if(popBurst >= POP_CFG.burstMax) return false;

    lastPopAt = t;
    popBurst++;
    return true;
  }

  // ----------------- FX mapping -----------------
  function normalizeKind(k){
    k = String(k||'').toLowerCase();
    // accept many labels
    if(k.includes('good')) return 'good';
    if(k.includes('bad')) return 'bad';
    if(k.includes('miss')) return 'miss';
    if(k.includes('block')) return 'block';
    if(k.includes('combo')) return 'combo';
    if(k.includes('perfect')) return 'perfect';
    if(k.includes('storm')) return 'storm';
    if(k.includes('boss')) return 'boss';
    if(k.includes('rage')) return 'rage';
    if(k.includes('mini')) return 'mini';
    if(k.includes('goal')) return 'goal';
    if(k.includes('lowtime')) return 'lowtime';
    if(k.includes('end')) return 'end';
    return k || 'hit';
  }

  function pulseByKind(kind){
    const k = normalizeKind(kind);

    // universal short pulses
    if(k==='good')      return pulse('fx-good', 160);
    if(k==='bad')       return pulse('fx-bad', 180);
    if(k==='miss')      return pulse('fx-miss', 240);
    if(k==='block')     return pulse('fx-block', 170);
    if(k==='perfect')   return pulse('fx-perfect', 180);
    if(k==='combo')     return pulse('fx-combo', 200);
    if(k==='mini')      return pulse('fx-mini', 240);
    if(k==='goal')      return pulse('fx-goal', 320);
    if(k==='lowtime')   return pulse('fx-lowtime', 140);
    if(k==='end')       return pulse('fx-end', 900);

    if(k==='storm')     return pulse('fx-storm', 500);
    if(k==='boss')      return pulse('fx-boss', 520);
    if(k==='rage')      return pulse('fx-rage', 520);

    // default hit
    pulse('fx-hit', 140);
  }

  // ----------------- Coach bubble (optional) -----------------
  // If your CSS already has a coach panel, we can fill it.
  const coachEl = doc.getElementById('coachText') || doc.querySelector('[data-hha-coach]');
  let coachHideTimer = 0;

  function showCoach(msg, kind){
    if(!coachEl) return;
    try{
      coachEl.textContent = msg;
      BODY.classList.add('show-coach');
      // kind class (optional)
      const k = normalizeKind(kind);
      coachEl.setAttribute('data-kind', k);

      clearTimeout(coachHideTimer);
      coachHideTimer = setTimeout(()=>{
        try{ BODY.classList.remove('show-coach'); }catch(_){}
      }, 2400);
    }catch(_){}
  }

  // ----------------- Phase classes from URL (optional) -----------------
  // This is only a helper; game engines should control phases themselves.
  // But if someone opens with ?fx=storm etc, it won't break.
  (function bootFxFromUrl(){
    const fx = String(qs('fx','')||'').toLowerCase();
    if(!fx) return;
    if(fx.includes('storm')) BODY.classList.add('gj-storm');
    if(fx.includes('boss'))  BODY.classList.add('gj-boss');
    if(fx.includes('rage'))  BODY.classList.add('gj-rage');
  })();

  // ----------------- event handlers -----------------
  function onJudge(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const label = safeText(d.label || d.text || d.msg || '');
    const kind  = safeText(d.kind || d.type || d.fx || '');

    // pulse
    pulseByKind(kind || label);

    // pop text
    if(label && canPop()){
      const p = centerXY();
      const x = Number.isFinite(+d.x) ? +d.x : p.x;
      const y = Number.isFinite(+d.y) ? +d.y : p.y;
      popText(x,y,label);
    }
  }

  function onCoach(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const msg = safeText(d.msg || d.text || '');
    const kind = safeText(d.kind || d.type || 'tip');
    if(!msg) return;

    // mild pulse for coach
    pulse('fx-hit', 120);
    showCoach(msg, kind);

    // optional pop on warn
    if(kind === 'warn' && canPop()){
      const p = centerXY();
      popText(p.x, Math.floor(p.y * 0.85), '⚠️');
    }
  }

  function onScore(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const score = d.score;
    if(!Number.isFinite(+score)) return;

    // combo-ish pulse for big jumps
    if(+score > 0 && (+score % 100) < 10){
      pulse('fx-combo', 200);
    }
  }

  function onTime(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const t = Number(d.t);
    if(!Number.isFinite(t)) return;

    if(t <= 10.01){
      pulse('fx-lowtime', 140);
    }
    if(t <= 30.01){
      // gentle storm hint (visual only)
      pulse('fx-storm', 220);
    }
  }

  function onEnd(ev){
    pulse('fx-end', 950);
    // one last pop
    const d = ev && ev.detail ? ev.detail : {};
    const grade = safeText(d.grade || '');
    if(grade && canPop()){
      const p = centerXY();
      popText(p.x, p.y, `GRADE ${grade}`);
    }
  }

  function onQuest(ev){
    // optional: tiny pulse on quest changes
    pulse('fx-hit', 90);
  }

  // ----------------- bind both window + document -----------------
  function bind(target){
    if(!target || !target.addEventListener) return;
    target.addEventListener('hha:judge', onJudge, { passive:true });
    target.addEventListener('hha:coach', onCoach, { passive:true });
    target.addEventListener('hha:score', onScore, { passive:true });
    target.addEventListener('hha:time',  onTime,  { passive:true });
    target.addEventListener('hha:end',   onEnd,   { passive:true });
    target.addEventListener('quest:update', onQuest, { passive:true });
  }

  bind(root);
  bind(doc);

  // ----------------- debug hook -----------------
  root.HHA_FX = {
    pulse,
    popText: (x,y,t)=>{ if(canPop()) popText(x,y,t); },
  };

  // tiny console hint
  try{ console.info('[HHA FX Director] loaded'); }catch(_){}
})(window);