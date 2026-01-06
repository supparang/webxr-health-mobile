// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — ULTRA (PRODUCTION)
// Listens to HHA events and triggers visual feedback consistently.
// Requires: ../vr/particles.js (recommended)

(function(){
  'use strict';
  const ROOT = window;
  const DOC = document;
  if(!DOC || ROOT.__HHA_FX_DIRECTOR_ULTRA__) return;
  ROOT.__HHA_FX_DIRECTOR_ULTRA__ = true;

  // ---------- inject CSS ----------
  (function injectCss(){
    const id = 'hha-fx-director-style-ultra';
    if (DOC.getElementById(id)) return;

    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-vignette{
        position:fixed; inset:-22px; pointer-events:none; z-index:9998;
        opacity:0; transition: opacity 160ms ease;
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 45%,
          rgba(0,0,0,0) 42%,
          rgba(0,0,0,.25) 70%,
          rgba(0,0,0,.58) 100%);
      }

      body.fx-hit-good .hha-fx-vignette{ opacity: .18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .34; }
      body.fx-miss     .hha-fx-vignette{ opacity: .30; }

      /* screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        35%{ transform: translate3d(1px,-1px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* storm/boss/rage light overlays (works even if game css absent) */
      .hha-fx-state{
        position:fixed; inset:0; pointer-events:none; z-index:9997;
        opacity:0; transition: opacity 180ms ease;
        background: radial-gradient(circle at 50% 45%,
          rgba(255,255,255,0) 40%,
          rgba(255,255,255,.06) 70%,
          rgba(255,255,255,.10) 100%);
        mix-blend-mode: screen;
        filter: blur(.15px);
      }
      body.fx-storm .hha-fx-state{ opacity:.18; }
      body.fx-boss  .hha-fx-state{ opacity:.26; }
      body.fx-rage  .hha-fx-state{ opacity:.32; }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 720ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        30%{ filter: brightness(1.16) contrast(1.06); }
        100%{ filter:none; }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);

    const st2 = DOC.createElement('div');
    st2.className = 'hha-fx-state';
    DOC.body.appendChild(st2);
  })();

  // ---------- helpers ----------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }
  function setBodyState(c, on){
    try{ DOC.body.classList.toggle(c, !!on); }catch(_){}
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
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || d.label || '').toString().toLowerCase();
    if (t.includes('perfect')) return 'perfect';
    if (t.includes('good') || t.includes('correct')) return 'good';
    if (t.includes('bad') || t.includes('junk') || t.includes('wrong') || t.includes('oops')) return 'bad';
    if (t.includes('miss') || t.includes('expire')) return 'miss';
    if (t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    if (t.includes('boss')) return 'boss';
    if (t.includes('storm')) return 'storm';
    if (t.includes('rage')) return 'rage';
    return t || 'good';
  }

  function P(){ return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null; }
  function fxBurst(x,y,r){ try{ P()?.burst?.(x,y,{r}); }catch(_){ } }
  function fxShock(x,y,r){ try{ P()?.shockwave?.(x,y,{r}); }catch(_){ fxBurst(x,y,r); } }
  function fxPop(x,y,text,cls){ try{ P()?.popText?.(x,y,text,cls); }catch(_){ } }
  function fxCelebrate(){ try{ P()?.celebrate?.(); }catch(_){ } }

  // ---------- core listeners ----------
  DOC.addEventListener('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 62);
      const combo = Number(d.combo || d.comboNow || d.comboCount || 0);
      if (combo >= 5) fxBurst(x,y, 38);
    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 210);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 86);
      fxPop(x,y,'PERFECT!','perfect');
    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 76);
    } else if (t === 'miss'){
      addBodyCls('fx-miss', 240);
      fxShock(x,y, 72);
      fxPop(x,y,'MISS','bad');
    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 150);
      fxBurst(x,y, 52);
      fxPop(x,y,'BLOCK','score');
    } else if (t === 'boss'){
      addBodyCls('fx-hit-bad', 220);
      fxShock(innerWidth/2, innerHeight*0.28, 110);
      fxPop(innerWidth/2, innerHeight*0.22, 'BOSS!', 'big');
    } else {
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y, 52);
    }
  }, { passive:true });

  DOC.addEventListener('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const sc = Number(d.delta ?? d.score ?? d.add ?? d.value ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      fxPop(x, y, (sc>0?`+${sc}`:`${sc}`), Math.abs(sc)>=50?'big':'score');
    }
  }, { passive:true });

  DOC.addEventListener('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 240);
    fxShock(x,y, 78);
  }, { passive:true });

  DOC.addEventListener('hha:celebrate', ()=>{
    fxCelebrate();
  }, { passive:true });

  DOC.addEventListener('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate(), 220);
  }, { passive:true });

  // ---------- intensity state events ----------
  DOC.addEventListener('hha:storm', ()=> setBodyState('fx-storm', true), { passive:true });
  DOC.addEventListener('hha:storm-end', ()=> setBodyState('fx-storm', false), { passive:true });
  DOC.addEventListener('hha:boss', ()=> setBodyState('fx-boss', true), { passive:true });
  DOC.addEventListener('hha:boss-end', ()=> setBodyState('fx-boss', false), { passive:true });
  DOC.addEventListener('hha:rage', ()=> setBodyState('fx-rage', true), { passive:true });
  DOC.addEventListener('hha:rage-end', ()=> setBodyState('fx-rage', false), { passive:true });

  // dev test
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+80, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:storm')), 360);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:boss')), 520);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:rage')), 700);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 980);
  };

})();