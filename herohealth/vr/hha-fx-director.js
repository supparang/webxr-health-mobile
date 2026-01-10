// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (universal)
// ✅ Standard FX mapping for ALL HeroHealth games
// ✅ Listens: hha:judge / hha:celebrate / hha:coach / hha:time / hha:end
// ✅ Applies: body fx classes (fx-good/bad/miss/block/star/diamond/boss/rage/phase2/storm/end)
// ✅ Optional "point FX": uses x,y to spawn text via Particles.popText (if present)
// ✅ Rate-limit to avoid spam
// ✅ Safe with missing dependencies (Particles optional)

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  const cfg = Object.assign({
    // global throttles
    minGapMs: 70,
    classHoldMs: 140,
    bigHoldMs: 220,
    coachHoldMs: 520,

    // point text
    enablePointText: true,
    // if judge label is too long, trim
    maxLabelLen: 18,
  }, root.HHA_FX_CONFIG || {});

  const BODY = DOC.body || DOC.documentElement;

  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const now = ()=> performance.now();

  function fx(){
    // Prefer GAME_MODULES.Particles (your newer standard), fallback to window.Particles
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function popText(x,y,text,cls){
    if(!cfg.enablePointText) return;
    const P = fx();
    if(!P) return;
    const t = String(text ?? '').trim();
    if(!t) return;

    const safe = (t.length > cfg.maxLabelLen) ? (t.slice(0, cfg.maxLabelLen) + '…') : t;

    try{
      // Compatibility: popText(x,y,text,cls?) or scorePop(x,y,text,cls?)
      if(typeof P.popText === 'function'){
        // some variants accept cls, some not
        try{ P.popText(x,y,safe,cls); } catch(_){ P.popText(x,y,safe); }
      } else if(typeof P.scorePop === 'function'){
        try{ P.scorePop(x,y,safe,cls); } catch(_){ P.scorePop(x,y,safe); }
      }
    }catch(_){}
  }

  // ---- class helpers ----
  let lastAt = 0;

  function pulse(cls, holdMs){
    const t = now();
    if(t - lastAt < cfg.minGapMs) return;
    lastAt = t;

    try{
      BODY.classList.add(cls);
      setTimeout(()=>{ try{ BODY.classList.remove(cls); }catch(_){ } }, holdMs || cfg.classHoldMs);
    }catch(_){}
  }

  function setFlag(cls, on){
    try{
      if(on) BODY.classList.add(cls);
      else BODY.classList.remove(cls);
    }catch(_){}
  }

  // ---- event mappings ----
  function normType(t){
    return String(t || '').toLowerCase().trim();
  }

  function onJudge(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const type = normType(d.type);
    const label = (d.label != null) ? String(d.label) : '';

    // Point position (if any)
    const x = (typeof d.x === 'number') ? d.x : null;
    const y = (typeof d.y === 'number') ? d.y : null;

    // Common aliases
    const kind = normType(d.kind);

    // --- map types to FX classes ---
    // small pulses
    if(type === 'good'){
      pulse('fx-good', cfg.classHoldMs);
      if(x!=null && y!=null) popText(x,y,label || '+', 'fx-good');
      return;
    }

    if(type === 'bad' || type === 'oops' || kind === 'junk'){
      pulse('fx-bad', cfg.classHoldMs);
      pulse('fx-kick', 110);
      if(x!=null && y!=null) popText(x,y,label || 'OOPS', 'fx-bad');
      return;
    }

    if(type === 'miss' || type === 'expire' || type === 'missshot'){
      pulse('fx-miss', cfg.classHoldMs);
      if(x!=null && y!=null) popText(x,y,label || 'MISS', 'fx-miss');
      return;
    }

    if(type === 'block' || type === 'guard'){
      pulse('fx-block', cfg.classHoldMs);
      if(x!=null && y!=null) popText(x,y,label || 'BLOCK', 'fx-block');
      return;
    }

    if(type === 'star'){
      pulse('fx-star', cfg.classHoldMs);
      if(x!=null && y!=null) popText(x,y,label || 'STAR', 'fx-star');
      return;
    }

    if(type === 'shield'){
      pulse('fx-shield', cfg.classHoldMs);
      if(x!=null && y!=null) popText(x,y,label || 'SHIELD', 'fx-shield');
      return;
    }

    if(type === 'diamond'){
      pulse('fx-diamond', cfg.bigHoldMs);
      if(x!=null && y!=null) popText(x,y,label || 'DIAMOND', 'fx-diamond');
      return;
    }

    if(type === 'combo' || type === 'perfect'){
      pulse('fx-combo', cfg.classHoldMs);
      if(x!=null && y!=null) popText(x,y,label || 'COMBO', 'fx-combo');
      return;
    }

    // boss / rage / phase2 / storm are often flags (continuous) BUT can also pulse
    if(type === 'boss'){
      pulse('fx-boss', cfg.bigHoldMs);
      if(x!=null && y!=null && label) popText(x,y,label, 'fx-boss');
      return;
    }

    if(type === 'rage'){
      pulse('fx-rage', cfg.bigHoldMs);
      return;
    }

    if(type === 'phase2'){
      pulse('fx-phase2', cfg.bigHoldMs);
      return;
    }

    if(type === 'storm'){
      pulse('fx-storm', cfg.bigHoldMs);
      return;
    }

    if(type === 'goal'){
      pulse('fx-goal', cfg.bigHoldMs);
      return;
    }

    if(type === 'mini'){
      pulse('fx-mini', cfg.bigHoldMs);
      return;
    }

    if(type === 'warn'){
      pulse('fx-warn', cfg.classHoldMs);
      return;
    }

    // fallback: if label exists, show a tiny pop (optional)
    if(label && x!=null && y!=null){
      popText(x,y,label,'');
    }
  }

  function onCelebrate(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const kind = normType(d.kind);

    if(kind === 'mini'){
      pulse('fx-mini', cfg.bigHoldMs);
      return;
    }
    if(kind === 'end'){
      pulse('fx-end', 520);
      return;
    }
    if(kind === 'perfect'){
      pulse('fx-perfect', cfg.bigHoldMs);
      return;
    }
    // generic celebrate
    pulse('fx-celebrate', cfg.bigHoldMs);
  }

  function onCoach(ev){
    // If you emit hha:coach {msg, kind}
    pulse('fx-coach', cfg.coachHoldMs);
  }

  function onTime(ev){
    // Optional low-time vibe for any game:
    // if time <= 10, add fx-lowtime; if <=5 add fx-lowtime5
    try{
      const d = ev && ev.detail ? ev.detail : {};
      const t = Number(d.t);
      if(!Number.isFinite(t)) return;

      setFlag('fx-lowtime', t <= 10);
      setFlag('fx-lowtime5', t <= 5);
    }catch(_){}
  }

  function onEnd(){
    pulse('fx-end', 520);
  }

  // ---- bind listeners ----
  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  root.addEventListener('hha:coach', onCoach, { passive:true });
  root.addEventListener('hha:time', onTime, { passive:true });
  root.addEventListener('hha:end', onEnd, { passive:true });

  // also support document dispatch (some pages dispatch on document)
  DOC.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  DOC.addEventListener('hha:coach', onCoach, { passive:true });
  DOC.addEventListener('hha:time', onTime, { passive:true });
  DOC.addEventListener('hha:end', onEnd, { passive:true });

})(window);