// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — HARDCORE (PRODUCTION)
// ✅ listens on BOTH document + window
// ✅ uses Particles when available, fallback to CSS body classes
// ✅ supports states: storm/boss/rage via hha:fx-state

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // ---------- inject minimal CSS ----------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;
    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-20px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 120ms ease;
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 44%,
          rgba(0,0,0,.28) 72%,
          rgba(0,0,0,.62) 100%);
      }
      body.fx-hit-good .hha-fx-vignette{ opacity: .18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .34; }
      body.fx-miss     .hha-fx-vignette{ opacity: .30; }

      body.fx-kick{ animation: hhaKick 110ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        45%{ transform: translate3d(1.2px,-1.2px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        35%{ filter: brightness(1.18) contrast(1.06); }
        100%{ filter:none; }
      }

      /* global mode tint (storm/boss/rage) */
      body.hha-storm{ filter: saturate(1.06) contrast(1.03); }
      body.hha-boss { filter: saturate(1.10) contrast(1.05); }
      body.hha-rage { filter: saturate(1.18) contrast(1.08); }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  // ---------- helpers ----------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }

  function setModeCls(st){
    try{
      DOC.body.classList.toggle('hha-storm', !!st?.storm);
      DOC.body.classList.toggle('hha-boss',  !!st?.boss);
      DOC.body.classList.toggle('hha-rage',  !!st?.rage);
    }catch(_){}
  }

  function num(v){ v = Number(v); return Number.isFinite(v) ? v : null; }

  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if (x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || '').toString().toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('good') || t.includes('correct')) return 'good';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong')) return 'bad';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    return t || 'good';
  }

  function P(){ return WIN.Particles || WIN.GAME_MODULES?.Particles || null; }

  function fxBurst(x,y,r,kind){
    const p = P();
    if (p?.burst) p.burst(x,y,{ r, kind });
  }
  function fxShock(x,y,r){
    const p = P();
    if (p?.shockwave) p.shockwave(x,y,{ r });
    else fxBurst(x,y,r,'');
  }
  function fxPop(x,y,text,cls){
    const p = P();
    if (p?.popText) p.popText(x,y,text,cls);
    else if (p?.scorePop) p.scorePop(x,y,text);
  }
  function fxCelebrate(){
    const p = P();
    if (p?.celebrate) p.celebrate();
    else{
      for(let i=0;i<8;i++){
        setTimeout(()=>fxBurst(innerWidth/2 + (Math.random()*2-1)*180, innerHeight*0.35 + (Math.random()*2-1)*110, 28 + Math.random()*46, 'star'), i*50);
      }
    }
  }

  function onJudge(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);
    const combo = Number(d.combo || d.comboNow || 0);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 170);
      addBodyCls('fx-kick', 110);
      fxShock(x,y, 66);
      if (combo >= 5) fxBurst(x,y, 34, 'star');
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 190);
      addBodyCls('fx-kick', 110);
      fxShock(x,y, 86);
      fxPop(x,y,'PERFECT!','perfect');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 210);
      addBodyCls('fx-kick', 110);
      fxShock(x,y, 78);
      fxBurst(x,y, 26, 'bad');
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 230);
      fxShock(x,y, 92);
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 44, 'star');
      fxPop(x,y,'BLOCK','');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 46, '');
    }
  }

  function onScore(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const delta = Number(d.delta ?? d.add ?? d.value ?? 0);
    const score = Number(d.score ?? 0);
    if (Number.isFinite(delta) && delta !== 0){
      fxPop(x,y, (delta>0?`+${delta}`:`${delta}`), Math.abs(delta)>=40 ? 'big' : '');
    } else if (Number.isFinite(score) && score > 0 && d.force){
      fxPop(x,y, `+${score}`, 'big');
    }
  }

  function onEnd(){
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
  }

  function bind(target){
    target.addEventListener('hha:judge', onJudge, { passive:true });
    target.addEventListener('hha:score', onScore, { passive:true });
    target.addEventListener('hha:miss',  onJudge, { passive:true }); // treat as miss burst
    target.addEventListener('hha:celebrate', ()=>fxCelebrate(), { passive:true });
    target.addEventListener('hha:end',  onEnd, { passive:true });
    target.addEventListener('hha:fx-state', (e)=> setModeCls(e?.detail || {}), { passive:true });
  }

  // listen on BOTH
  bind(DOC);
  bind(WIN);

  // dev probe
  WIN.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:fx-state',{ detail:{ storm:true }}));
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+90, y:y-10 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-90, y:y+10 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:fx-state',{ detail:{ boss:true, storm:false }})), 360);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 520);
  };

})();