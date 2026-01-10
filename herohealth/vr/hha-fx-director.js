// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — shared, game-agnostic

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  const FX = { storm:false, boss:false, rage:false };

  function particles(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }
  function burst(kind){
    const P = particles(); if(!P) return;
    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);
    try{ P.ringPulse(kind); }catch(_){}
    try{ P.burstAt(cx, cy, kind); }catch(_){}
  }
  function shake(i, ms){
    const P = particles();
    try{ P && P.shake && P.shake(i, ms); }catch(_){}
  }

  function setMode(mode, on){
    const b = DOC.body; if(!b) return;

    if(mode === 'storm'){
      FX.storm = !!on; b.classList.toggle('fx-storm', FX.storm);
      if(FX.storm){ burst('storm'); shake(6, 220); }
      return;
    }
    if(mode === 'boss'){
      FX.boss = !!on; b.classList.toggle('fx-boss', FX.boss);
      if(FX.boss){ burst('boss'); shake(10, 280); }
      return;
    }
    if(mode === 'rage'){
      FX.rage = !!on; b.classList.toggle('fx-rage', FX.rage);
      if(FX.rage){ burst('rage'); shake(14, 340); }
      return;
    }
  }

  function onJudge(ev){
    const label = (ev?.detail?.label) ? String(ev.detail.label) : '';
    const P = particles(); if(!P) return;

    const cx = Math.floor(DOC.documentElement.clientWidth/2);
    const cy = Math.floor(DOC.documentElement.clientHeight/2);

    if(/GOAL|MINI/.test(label)){
      try{ P.scorePop(cx, cy-120, label, 'good'); }catch(_){}
      try{ P.celebrate('mini'); }catch(_){}
      return;
    }
    if(/BLOCK/.test(label)){
      try{ P.scorePop(cx, cy-110, 'BLOCK!', 'block'); }catch(_){}
      return;
    }
    if(/OOPS|MISS/.test(label)){
      try{ P.scorePop(cx, cy-110, label, 'bad'); }catch(_){}
      shake(6, 180);
      return;
    }
  }

  function onCelebrate(ev){
    const kind = String(ev?.detail?.kind || 'end');
    const grade = String(ev?.detail?.grade || '');
    const P = particles(); if(!P) return;

    if(kind === 'end'){
      try{ P.celebrate('end'); }catch(_){}
      if(grade && grade !== '—'){
        const cx = Math.floor(DOC.documentElement.clientWidth/2);
        const cy = Math.floor(DOC.documentElement.clientHeight/2);
        try{ P.scorePop(cx, cy-140, `GRADE ${grade}`, 'diamond'); }catch(_){}
      }
    }else{
      try{ P.celebrate(kind); }catch(_){}
    }
  }

  function onFx(ev){
    const d = ev?.detail || {};
    const mode = String(d.mode || '').toLowerCase();
    const on = !!d.on;
    if(mode) setMode(mode, on);
  }

  const st = DOC.createElement('style');
  st.textContent = `
    body.fx-storm .gj-field{ filter: saturate(1.12) contrast(1.03); }
    body.fx-boss  .gj-field{ filter: saturate(1.20) contrast(1.08); }
    body.fx-rage  .gj-field{ filter: saturate(1.28) contrast(1.12); }

    body.fx-storm::before,
    body.fx-boss::before,
    body.fx-rage::before{
      content:""; position:fixed; inset:0;
      pointer-events:none; z-index:70;
      mix-blend-mode: screen;
    }

    body.fx-storm::before{
      opacity:.14;
      background:
        radial-gradient(circle at 50% 40%, rgba(34,211,238,.22), transparent 55%),
        radial-gradient(circle at 15% 85%, rgba(167,139,250,.12), transparent 60%);
      animation: hhaStormGlow 1.2s ease-in-out infinite alternate;
    }
    @keyframes hhaStormGlow{ from{opacity:.10;} to{opacity:.18;} }

    body.fx-boss::before{
      opacity:.16;
      background:
        radial-gradient(circle at 50% 40%, rgba(245,158,11,.22), transparent 55%),
        radial-gradient(circle at 70% 86%, rgba(239,68,68,.10), transparent 60%);
      animation: hhaBossGlow .9s ease-in-out infinite alternate;
    }
    @keyframes hhaBossGlow{ from{opacity:.12;} to{opacity:.20;} }

    body.fx-rage::before{
      opacity:.18;
      background:
        radial-gradient(circle at 50% 42%, rgba(239,68,68,.24), transparent 55%),
        radial-gradient(circle at 20% 84%, rgba(245,158,11,.10), transparent 60%);
      animation: hhaRageGlow .65s ease-in-out infinite alternate;
    }
    @keyframes hhaRageGlow{ from{opacity:.14;} to{opacity:.22;} }
  `;
  DOC.head.appendChild(st);

  WIN.addEventListener('hha:judge', onJudge, { passive:true });
  WIN.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  WIN.addEventListener('hha:fx', onFx, { passive:true });

})();