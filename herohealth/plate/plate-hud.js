// === /herohealth/plate/plate-hud.js ===
// Plate HUD FX Binder — PRODUCTION (H++)
// ✅ PERFECT spark burst at click point (hha:perfect)
// ✅ Slow-mo visual vibe 0.25s (hha:slowmo)
// ✅ Judge toast overlay (hha:judge)
// ✅ Celebrate (hha:celebrate) fallback flash

(function(root){
  'use strict';
  const doc = root.document;
  if(!doc) return;

  const qs = (id)=>doc.getElementById(id);

  let lastPt = { x: innerWidth/2, y: innerHeight/2 };

  // Track pointer position for fallback perfect location
  root.addEventListener('pointermove', (e)=>{
    lastPt.x = e.clientX;
    lastPt.y = e.clientY;
  }, { passive:true });

  root.addEventListener('pointerdown', (e)=>{
    lastPt.x = e.clientX;
    lastPt.y = e.clientY;
  }, { passive:true });

  // ---- Judge toast ----
  let judgeEl = null;
  function ensureJudge(){
    if(judgeEl) return judgeEl;
    judgeEl = doc.createElement('div');
    judgeEl.className = 'hha-judge';
    judgeEl.textContent = '';
    doc.body.appendChild(judgeEl);
    return judgeEl;
  }

  function showJudge(text, kind){
    const el = ensureJudge();
    el.classList.remove('good','warn','bad','perfect','info','show');
    if(kind === 'good' || kind === 'warn' || kind === 'bad' || kind === 'perfect'){
      el.classList.add(kind);
    }
    el.textContent = String(text || '');
    // animate
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(showJudge._t);
    showJudge._t = setTimeout(()=> el.classList.remove('show'), 620);
  }

  // ---- PERFECT pop + spark ----
  function perfectPop(x, y, label){
    const el = doc.createElement('div');
    el.className = 'hha-perfect';
    el.textContent = label || '⚡ PERFECT!';
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
    doc.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 650);
  }

  function perfectSpark(x,y){
    try{
      const s = doc.createElement('div');
      s.className = 'hha-spark';
      s.style.left = Math.round(x) + 'px';
      s.style.top  = Math.round(y) + 'px';
      doc.body.appendChild(s);
      setTimeout(()=>{ try{s.remove();}catch(e){} }, 520);
    }catch(e){}

    // If particles.js exposes helpers, use them
    try{
      const P = root.Particles || root.GAME_MODULES?.Particles;
      if(P && typeof P.burst === 'function') P.burst(x,y);
      if(P && typeof P.popText === 'function') P.popText(x,y,'⚡','');
    }catch(e){}
  }

  function onPerfect(d){
    const x = (d && typeof d.x==='number') ? d.x : lastPt.x;
    const y = (d && typeof d.y==='number') ? d.y : lastPt.y;
    perfectPop(x, y, '⚡ PERFECT!');
    perfectSpark(x, y);
    showJudge('⚡ PERFECT!', 'perfect');
  }

  // ---- Slowmo ----
  function onSlowmo(d){
    const dur = (d && Number(d.durationMs)) ? Number(d.durationMs) : 250;
    doc.body.classList.add('hha-slowmo');
    clearTimeout(onSlowmo._t);
    onSlowmo._t = setTimeout(()=>doc.body.classList.remove('hha-slowmo'), Math.max(80, dur));
  }

  // ---- Celebrate fallback ----
  function onCelebrate(d){
    // Try particles celebrate if available
    try{
      const P = root.Particles || root.GAME_MODULES?.Particles;
      if(P && typeof P.celebrate === 'function'){
        P.celebrate();
        return;
      }
    }catch(e){}
    // Fallback: quick judge pulse
    const kind = (d && d.kind) ? String(d.kind) : 'celebrate';
    if(kind === 'end') showJudge('🎉 CLEAR!', 'good');
    else if(kind === 'goal') showJudge('🎯 GOAL!', 'good');
    else if(kind === 'mini') showJudge('⚡ MINI!', 'warn');
  }

  // ---- Grade chip crown/shimmer driver (data-grade) ----
  function onScore(d){
    try{
      const grade = String(d?.grade || '').toUpperCase();
      const chip = doc.querySelector('.hudStat.gradeChip');
      if(chip) chip.setAttribute('data-grade', grade || 'C');
    }catch(e){}
  }

  // Bind events
  root.addEventListener('hha:perfect', (e)=> onPerfect(e.detail), { passive:true });
  root.addEventListener('hha:slowmo',  (e)=> onSlowmo(e.detail), { passive:true });
  root.addEventListener('hha:judge',   (e)=> showJudge(e.detail?.text || e.detail?.msg || '', e.detail?.kind || 'info'), { passive:true });
  root.addEventListener('hha:celebrate',(e)=> onCelebrate(e.detail), { passive:true });
  root.addEventListener('hha:score',   (e)=> onScore(e.detail), { passive:true });

})(window);