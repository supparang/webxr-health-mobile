// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — ULTRA (shared)
// ✅ Bridges game events -> Particles FX + body pulse classes
// ✅ Safe if Particles missing
// ✅ Rate-limit for spam events (kid-proof)
// ✅ Works across all games (GoodJunk/Groups/Hydration/Plate)
//
// Events expected (soft):
// - hha:judge {label, x,y, kind}   kind: good|bad|star|shield|diamond|boss|storm|rage|miss
// - hha:coach {msg, kind}         kind: tip|warn|praise|boss|storm|rage
// - hha:celebrate {kind, grade}   kind: mini|goal|end|boss
// - hha:end {scoreFinal, misses, grade, reason}
// - hha:time {t}  (optional)
// - hha:score {score} (optional)
//
// Adds body classes briefly:
//  fx-good, fx-bad, fx-star, fx-shield, fx-diamond, fx-boss, fx-storm, fx-rage, fx-miss, fx-ping
//
// Note: CSS animations live in game css (e.g., goodjunk-vr.css) but this file works even without them.

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  const now = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  const CFG = Object.assign({
    // rate limit
    judgeCooldownMs: 70,
    coachCooldownMs: 900,
    celebrateCooldownMs: 450,
    pingMs: 120,

    // default FX position when not provided
    defaultX: ()=> Math.floor((DOC.documentElement.clientWidth || innerWidth || 800) * 0.5),
    defaultY: ()=> Math.floor((DOC.documentElement.clientHeight || innerHeight || 600) * 0.45),

    // pop text
    popGood: '+',
    popBad:  '−',
  }, root.HHA_FX_CONFIG || {});

  // --- helpers ---
  function P(){ return root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles) || null; }

  function bodyPulse(cls, ms=CFG.pingMs){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){} }, ms);
    }catch(_){}
  }

  function pickXY(d){
    const x = Number(d && (d.x ?? d.clientX)) || CFG.defaultX();
    const y = Number(d && (d.y ?? d.clientY)) || CFG.defaultY();
    return {
      x: clamp(x, 0, (root.innerWidth||DOC.documentElement.clientWidth||9999)),
      y: clamp(y, 0, (root.innerHeight||DOC.documentElement.clientHeight||9999)),
    };
  }

  // --- cooldown buckets ---
  let tJudge=0, tCoach=0, tCele=0;

  function canJudge(){
    const t = now();
    if(t - tJudge < CFG.judgeCooldownMs) return false;
    tJudge = t; return true;
  }
  function canCoach(){
    const t = now();
    if(t - tCoach < CFG.coachCooldownMs) return false;
    tCoach = t; return true;
  }
  function canCele(){
    const t = now();
    if(t - tCele < CFG.celebrateCooldownMs) return false;
    tCele = t; return true;
  }

  // --- fx mapping ---
  function fxForKind(kind){
    kind = String(kind||'').toLowerCase();
    if(kind==='good') return { cls:'fx-good', textCls:'fx-good' };
    if(kind==='bad') return { cls:'fx-bad', textCls:'fx-bad' };
    if(kind==='miss') return { cls:'fx-miss', textCls:'fx-warn' };
    if(kind==='star') return { cls:'fx-star', textCls:'fx-warn' };
    if(kind==='shield') return { cls:'fx-shield', textCls:'fx-good' };
    if(kind==='diamond') return { cls:'fx-diamond', textCls:'fx-violet' };
    if(kind==='boss') return { cls:'fx-boss', textCls:'fx-warn' };
    if(kind==='storm') return { cls:'fx-storm', textCls:'fx-warn' };
    if(kind==='rage') return { cls:'fx-rage', textCls:'fx-bad' };
    return { cls:'fx-ping', textCls:'' };
  }

  function judgeToKind(label){
    const s = String(label||'').toLowerCase();
    if(s.includes('good')) return 'good';
    if(s.includes('oops') || s.includes('bad')) return 'bad';
    if(s.includes('miss')) return 'miss';
    if(s.includes('star')) return 'star';
    if(s.includes('shield') || s.includes('block')) return 'shield';
    if(s.includes('diamond')) return 'diamond';
    if(s.includes('boss')) return 'boss';
    if(s.includes('storm')) return 'storm';
    if(s.includes('rage')) return 'rage';
    if(s.includes('goal')) return 'star';
    if(s.includes('mini')) return 'star';
    return 'good';
  }

  // --- handlers ---
  function onJudge(ev){
    if(!canJudge()) return;
    const d = ev && ev.detail ? ev.detail : {};
    const label = d.label ?? d.text ?? '';
    const kind = d.kind || judgeToKind(label);
    const map = fxForKind(kind);
    const {x,y} = pickXY(d);

    // body pulse
    bodyPulse(map.cls, 140);

    const p = P();
    if(!p) return;

    // decide which FX to show
    try{
      if(kind==='good'){
        p.burst && p.burst(x,y,{ n: 10, spread: 150, life: 520 });
        p.popText && p.popText(x,y, label || CFG.popGood, map.textCls);
      }else if(kind==='bad' || kind==='miss'){
        p.shockwave && p.shockwave(x,y,{ r: 190, life: 420, alpha: 0.30, thick: 3 });
        p.burst && p.burst(x,y,{ n: 12, spread: 170, life: 600, grav: 1.05 });
        p.popText && p.popText(x,y, label || CFG.popBad, map.textCls);
      }else if(kind==='star'){
        p.sparkle && p.sparkle(x,y,{ n: 18, spread: 240, life: 700 });
        p.popText && p.popText(x,y, label || '⭐', map.textCls);
      }else if(kind==='shield'){
        p.shockwave && p.shockwave(x,y,{ r: 160, life: 360, alpha: 0.34, thick: 3 });
        p.sparkle && p.sparkle(x,y,{ n: 12, spread: 180, life: 520 });
        p.popText && p.popText(x,y, label || 'BLOCK', map.textCls);
      }else if(kind==='diamond'){
        p.celebrate && p.celebrate({ n: 34, y: y });
        p.popText && p.popText(x,y, label || '💎', map.textCls);
      }else if(kind==='boss' || kind==='storm' || kind==='rage'){
        p.shockwave && p.shockwave(x,y,{ r: 260, life: 520, alpha: 0.34, thick: 4 });
        p.burst && p.burst(x,y,{ n: 22, spread: 260, life: 820, grav: 1.15, drift: 0.7 });
        p.popText && p.popText(x,y, label || kind.toUpperCase(), map.textCls);
      }else{
        p.popText && p.popText(x,y, label || '!', map.textCls);
      }
    }catch(_){}
  }

  function onCoach(ev){
    if(!canCoach()) return;
    const d = ev && ev.detail ? ev.detail : {};
    const kind = String(d.kind||'tip').toLowerCase();
    const msg  = String(d.msg||d.text||'').trim();
    if(!msg) return;

    const {x,y} = pickXY(d);
    const p = P();

    if(kind==='warn' || kind==='storm'){
      bodyPulse('fx-storm', 180);
      try{
        p && p.popText && p.popText(x, y-20, msg, 'fx-warn');
        p && p.shockwave && p.shockwave(x, y, { r: 210, life: 520, alpha: 0.22, thick: 3 });
      }catch(_){}
      return;
    }

    if(kind==='rage'){
      bodyPulse('fx-rage', 180);
      try{
        p && p.popText && p.popText(x, y-20, msg, 'fx-bad');
        p && p.burst && p.burst(x,y,{ n: 16, spread: 220, life: 720, grav: 1.2 });
      }catch(_){}
      return;
    }

    if(kind==='boss'){
      bodyPulse('fx-boss', 180);
      try{
        p && p.popText && p.popText(x, y-20, msg, 'fx-warn');
        p && p.shockwave && p.shockwave(x,y,{ r: 240, life: 560, alpha: 0.26, thick: 4 });
      }catch(_){}
      return;
    }

    // tip / praise
    bodyPulse('fx-ping', 120);
    try{
      p && p.popText && p.popText(x, y-30, msg, (kind==='praise') ? 'fx-good' : '');
      if(kind==='praise'){
        p && p.sparkle && p.sparkle(x,y,{ n: 12, spread: 170, life: 560 });
      }
    }catch(_){}
  }

  function onCelebrate(ev){
    if(!canCele()) return;
    const d = ev && ev.detail ? ev.detail : {};
    const kind = String(d.kind||'').toLowerCase();
    const grade = String(d.grade||'').toUpperCase();

    const p = P();
    if(!p) return;

    try{
      if(kind==='mini' || kind==='goal'){
        bodyPulse('fx-star', 220);
        p.celebrate && p.celebrate({ n: 26, y: Math.floor((DOC.documentElement.clientHeight||innerHeight||600)*0.35) });
      }else if(kind==='boss'){
        bodyPulse('fx-boss', 260);
        p.celebrate && p.celebrate({ n: 38, y: Math.floor((DOC.documentElement.clientHeight||innerHeight||600)*0.38), r: 280 });
      }else if(kind==='end'){
        bodyPulse('fx-star', 260);
        p.celebrate && p.celebrate({ n: 44, y: Math.floor((DOC.documentElement.clientHeight||innerHeight||600)*0.34), r: 320 });
        if(grade){
          p.popText && p.popText(CFG.defaultX(), Math.floor(CFG.defaultY()*0.8), `GRADE ${grade}`, 'fx-violet');
        }
      }else{
        bodyPulse('fx-ping', 180);
        p.celebrate && p.celebrate({ n: 22 });
      }
    }catch(_){}
  }

  function onEnd(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const grade = String(d.grade||'').toUpperCase();
    const reason = String(d.reason||'');
    const p = P();

    // tiny end pulse (not too noisy)
    bodyPulse('fx-ping', 140);

    try{
      if(p && p.popText){
        const msg = grade ? `จบเกม! เกรด ${grade}` : 'จบเกม!';
        p.popText(CFG.defaultX(), Math.floor(CFG.defaultY()*0.75), msg, 'fx-violet');
        if(reason) p.popText(CFG.defaultX(), Math.floor(CFG.defaultY()*0.82), `reason: ${reason}`, '');
      }
    }catch(_){}
  }

  // Bind events (window + document for safety)
  function on(name, fn){
    try{ root.addEventListener(name, fn, { passive:true }); }catch(_){}
    try{ DOC.addEventListener(name, fn, { passive:true }); }catch(_){}
  }

  on('hha:judge', onJudge);
  on('hha:coach', onCoach);
  on('hha:celebrate', onCelebrate);
  on('hha:end', onEnd);

  // Optional: debugging ping
  root.HHA_FX_PING = function(label='PING'){
    try{
      const p = P();
      const x = CFG.defaultX(), y = CFG.defaultY();
      bodyPulse('fx-ping', 140);
      p && p.popText && p.popText(x,y,label,'fx-good');
      p && p.burst && p.burst(x,y,{ n: 12, spread: 180, life: 600 });
    }catch(_){}
  };

})(window);