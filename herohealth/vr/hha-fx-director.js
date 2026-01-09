// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (shared across all games)
// ✅ Standardize FX calls (Particles.scorePop / burstAt / celebrate)
// ✅ Body flags helpers: tempClass / setFlag
// ✅ Listens to events:
//    - hha:judge {label}
//    - hha:celebrate {kind,grade}
//    - hha:fx {type,x,y,text,kind}
// ✅ Safe even if Particles missing

(function(root){
  'use strict';
  const DOC = root.document;
  if(!DOC || root.__HHA_FX_DIRECTOR__) return;
  root.__HHA_FX_DIRECTOR__ = true;

  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function setFlag(cls, on){
    try{ DOC.body.classList.toggle(cls, !!on); }catch(_){}
  }

  function tempClass(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>DOC.body.classList.remove(cls), Math.max(60, ms||220));
    }catch(_){}
  }

  function P(){
    return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || null;
  }

  function pop(x,y,text,cls){
    const p = P();
    try{
      if(p && typeof p.popText === 'function') p.popText(x,y,text,cls);
      else if(p && typeof p.scorePop === 'function') p.scorePop(x,y,text,cls);
    }catch(_){}
  }

  function scorePop(x,y,text,cls){
    const p = P();
    try{
      if(p && typeof p.scorePop === 'function') p.scorePop(x,y,text,cls);
      else pop(x,y,text,cls);
    }catch(_){}
  }

  function burstAt(x,y,kind){
    const p = P();
    try{
      if(p && typeof p.burstAt === 'function') p.burstAt(x,y,kind);
    }catch(_){}
  }

  function celebrate(kind){
    const p = P();
    try{
      if(p && typeof p.celebrate === 'function') p.celebrate(kind);
      else {
        // fallback vibe
        tempClass('hha-celebrate', 520);
      }
    }catch(_){}
  }

  // ---------------- event handlers ----------------
  function onJudge(ev){
    const d = ev?.detail || {};
    const label = String(d.label || '').trim();
    if(!label) return;

    // screen position: top center
    const x = Math.floor(DOC.documentElement.clientWidth/2);
    const y = Math.floor(DOC.documentElement.clientHeight*0.22);

    scorePop(x,y,label,'hha-judge');
    tempClass('hha-judge-pulse', 180);
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind || 'end');
    celebrate(kind);

    // End grade pop
    if(d.grade){
      const x = Math.floor(DOC.documentElement.clientWidth/2);
      const y = Math.floor(DOC.documentElement.clientHeight*0.28);
      pop(x,y,`GRADE ${d.grade}`,'hha-grade');
    }
  }

  function onFx(ev){
    const d = ev?.detail || {};
    const type = String(d.type||'').toLowerCase();
    const x = Number(d.x);
    const y = Number(d.y);
    const text = d.text;

    const okXY = Number.isFinite(x) && Number.isFinite(y);
    const xx = okXY ? x : Math.floor(DOC.documentElement.clientWidth/2);
    const yy = okXY ? y : Math.floor(DOC.documentElement.clientHeight*0.22);

    if(type === 'pop' && text!=null) pop(xx,yy,String(text),'hha-pop');
    else if(type === 'score' && text!=null) scorePop(xx,yy,String(text),'hha-score');
    else if(type === 'burst') burstAt(xx,yy,String(d.kind||'good'));
    else if(type === 'shake') tempClass('hha-shake', Number(d.ms)||220);
  }

  // Bind listeners
  root.addEventListener('hha:judge', onJudge, { passive:true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  root.addEventListener('hha:fx', onFx, { passive:true });

  // expose small API
  root.HHA_FX = root.HHA_FX || {};
  root.HHA_FX.setFlag = setFlag;
  root.HHA_FX.tempClass = tempClass;
  root.HHA_FX.pop = pop;
  root.HHA_FX.scorePop = scorePop;
  root.HHA_FX.burstAt = burstAt;
  root.HHA_FX.celebrate = celebrate;

})(window);