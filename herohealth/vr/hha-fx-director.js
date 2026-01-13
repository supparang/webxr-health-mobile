// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (UNIFIED)
// ✅ Unifies effects across all games (GoodJunk/Groups/Hydration/Plate)
// ✅ Listens: hha:judge, hha:score, hha:time, quest:update, hha:celebrate
// ✅ Uses: window.Particles OR window.GAME_MODULES.Particles
// ✅ Safe: no hard dependency; graceful fallback
// ✅ Adds bodyPulse helpers + micro-shake + low-time ticks
//
// Usage (HTML):
// <script src="./vr/particles.js" defer></script>
// <script src="./vr/hha-fx-director.js" defer></script>

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> (root.performance ? performance.now() : Date.now());

  // --- particles bridge ---
  function P(){
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }
  function pop(x,y,text,cls){
    const p = P();
    try{
      if(!p) return;
      if(typeof p.scorePop === 'function') return p.scorePop(x,y,text,cls);
      if(typeof p.popText === 'function') return p.popText(x,y,text);
    }catch(_){}
  }
  function burst(x,y,kind){
    const p = P();
    try{
      if(p && typeof p.burstAt === 'function') p.burstAt(x,y,kind);
    }catch(_){}
  }

  // --- body pulse / shake ---
  function bodyPulse(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){ } }, ms||180);
    }catch(_){}
  }

  // small screen shake (CSS-less fallback)
  let shakeT = 0;
  function shake(ms=200, px=3){
    const t0 = now();
    shakeT = t0 + ms;
    const b = DOC.body;
    if(!b) return;
    const amp = clamp(px, 1, 10);

    function step(){
      if(now() > shakeT){ b.style.transform=''; return; }
      const dx = (Math.random()*2-1)*amp;
      const dy = (Math.random()*2-1)*amp;
      b.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // --- event helpers ---
  function getXYFromEvent(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const x = Number(d.x ?? d.clientX);
    const y = Number(d.y ?? d.clientY);
    if(Number.isFinite(x) && Number.isFinite(y)) return {x,y};
    // fallback center
    const W = DOC.documentElement.clientWidth || 800;
    const H = DOC.documentElement.clientHeight || 600;
    return { x: Math.floor(W/2), y: Math.floor(H/2) };
  }

  // --- low time ticker (unified) ---
  let lastTimeInt = null;
  function onTime(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const t = Number(d.t ?? d.timeLeftSec ?? d.timeLeft ?? d.time);
    if(!Number.isFinite(t)) return;

    const ti = Math.ceil(t);
    // do a tiny tick when 5..1 and changes
    if(ti <= 5 && ti >= 1 && ti !== lastTimeInt){
      lastTimeInt = ti;
      bodyPulse('hha-tick', 120);
      shake(90, 1.5);
      const {x,y} = getXYFromEvent(ev);
      pop(x,y, String(ti));
    }
    if(ti > 6) lastTimeInt = null;
  }

  // --- judge unified (GOOD/OOPS/BLOCK/MISS/STAR/SHIELD/DIAMOND/GOAL/MINI/BOSS/etc) ---
  function onJudge(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const label = String(d.label || d.kind || '').toUpperCase();
    const {x,y} = getXYFromEvent(ev);

    // normalize
    if(label.includes('GOOD')){
      bodyPulse('hha-good', 160);
      burst(x,y,'good');
      pop(x,y,'+','good');
      return;
    }
    if(label.includes('BLOCK')){
      bodyPulse('hha-block', 160);
      burst(x,y,'block');
      pop(x,y,'BLOCK','block');
      return;
    }
    if(label.includes('OOPS') || label.includes('BAD') || label.includes('JUNK')){
      bodyPulse('hha-bad', 180);
      shake(160, 2.4);
      burst(x,y,'bad');
      pop(x,y,'-','bad');
      return;
    }
    if(label.includes('MISS')){
      bodyPulse('hha-miss', 160);
      shake(140, 2.0);
      pop(x,y,'MISS','bad');
      return;
    }
    if(label.includes('STAR')){
      bodyPulse('hha-star', 180);
      burst(x,y,'star');
      pop(x,y,'⭐','star');
      return;
    }
    if(label.includes('SHIELD')){
      bodyPulse('hha-shield', 180);
      burst(x,y,'shield');
      pop(x,y,'🛡️','shield');
      return;
    }
    if(label.includes('DIAMOND')){
      bodyPulse('hha-diamond', 220);
      shake(160, 2.2);
      burst(x,y,'diamond');
      pop(x,y,'💎','diamond');
      return;
    }
    if(label.includes('GOAL')){
      bodyPulse('hha-goal', 220);
      burst(x,y,'good');
      pop(x,y,'GOAL!','good');
      return;
    }
    if(label.includes('MINI')){
      bodyPulse('hha-mini', 220);
      burst(x,y,'good');
      pop(x,y,'MINI!','good');
      return;
    }
    if(label.includes('BOSS')){
      bodyPulse('hha-boss', 520);
      shake(320, 3.0);
      pop(x,y,'BOSS!','bad');
      return;
    }
  }

  // --- celebrate unified (end/mini/etc) ---
  function onCelebrate(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const kind = String(d.kind || '').toLowerCase();
    const grade = String(d.grade || '').toUpperCase();
    const {x,y} = getXYFromEvent(ev);

    if(kind === 'mini'){
      bodyPulse('hha-mini', 260);
      pop(x,y,'✨','good');
      return;
    }
    if(kind === 'end'){
      bodyPulse('hha-end', 520);
      shake(260, 2.2);
      pop(x,y, grade ? `GRADE ${grade}` : 'FINISH');
      return;
    }
  }

  // --- quest update (optional small hint pop) ---
  let lastQuestAt = 0;
  function onQuest(ev){
    const t = now();
    if(t - lastQuestAt < 850) return;
    lastQuestAt = t;

    const d = ev && ev.detail ? ev.detail : {};
    const g = d.goal || null;
    const m = d.mini || null;

    // only subtle nudge (avoid spam)
    if(g && g.done){
      bodyPulse('hha-goal', 200);
    }
    if(m && m.done){
      bodyPulse('hha-mini', 200);
    }
  }

  // --- score event (optional sparkle) ---
  let lastScoreAt = 0;
  function onScore(ev){
    const t = now();
    if(t - lastScoreAt < 220) return;
    lastScoreAt = t;
    const d = ev && ev.detail ? ev.detail : {};
    const s = Number(d.score);
    if(!Number.isFinite(s)) return;
    // micro pulse only when big jumps
    if(s % 100 === 0){
      bodyPulse('hha-score', 160);
    }
  }

  // --- attach listeners (window + document safe) ---
  root.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:judge', onJudge, { passive:true });

  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  DOC.addEventListener('hha:celebrate', onCelebrate, { passive:true });

  root.addEventListener('quest:update', onQuest, { passive:true });
  DOC.addEventListener('quest:update', onQuest, { passive:true });

  root.addEventListener('hha:time', onTime, { passive:true });
  DOC.addEventListener('hha:time', onTime, { passive:true });

  root.addEventListener('hha:score', onScore, { passive:true });
  DOC.addEventListener('hha:score', onScore, { passive:true });

  // --- inject minimal css (if game css missing, still see pulses) ---
  const st = DOC.createElement('style');
  st.textContent = `
    body.hha-tick{ outline: 0 solid transparent; }
    body.hha-good{ box-shadow: inset 0 0 0 9999px rgba(34,197,94,.03); }
    body.hha-bad{  box-shadow: inset 0 0 0 9999px rgba(239,68,68,.04); }
    body.hha-miss{ box-shadow: inset 0 0 0 9999px rgba(245,158,11,.03); }
    body.hha-star{ box-shadow: inset 0 0 0 9999px rgba(245,158,11,.03); }
    body.hha-shield{ box-shadow: inset 0 0 0 9999px rgba(34,211,238,.03); }
    body.hha-diamond{ box-shadow: inset 0 0 0 9999px rgba(167,139,250,.03); }
    body.hha-goal{ box-shadow: inset 0 0 0 9999px rgba(34,197,94,.03); }
    body.hha-mini{ box-shadow: inset 0 0 0 9999px rgba(34,197,94,.03); }
    body.hha-boss{ box-shadow: inset 0 0 0 9999px rgba(239,68,68,.03); }
    body.hha-end{  box-shadow: inset 0 0 0 9999px rgba(34,211,238,.03); }
  `;
  DOC.head.appendChild(st);

})(window);