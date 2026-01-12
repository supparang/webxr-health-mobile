// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (ULTRA)
// ✅ Shared across ALL games
// ✅ Listens: hha:judge, hha:score, hha:miss, hha:celebrate, hha:end
// ✅ Triggers: body classes + vignette + particles (optional)
// Requires (recommended): ./particles.js

(function(){
  'use strict';
  const ROOT = window;
  const DOC  = document;
  if (!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // ---------------------------
  // minimal CSS injection (so every game works even without extra CSS)
  // ---------------------------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if (DOC.getElementById(id)) return;

    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      /* Vignette layer */
      .hha-fx-vignette{
        position:fixed;
        inset:-20px;
        pointer-events:none;
        z-index: 9998;
        opacity:0;
        transition: opacity 160ms ease;
        filter: blur(0.2px);
      }
      .hha-fx-vignette::before{
        content:"";
        position:absolute; inset:0;
        background:
          radial-gradient(circle at 50% 50%,
            rgba(0,0,0,0) 45%,
            rgba(0,0,0,.28) 74%,
            rgba(0,0,0,.55) 100%);
      }

      /* Body-class driven intensity */
      body.fx-hit-good .hha-fx-vignette{ opacity: .18; }
      body.fx-hit-bad  .hha-fx-vignette{ opacity: .36; }
      body.fx-miss     .hha-fx-vignette{ opacity: .30; }
      body.fx-boss     .hha-fx-vignette{ opacity: .42; }
      body.fx-storm    .hha-fx-vignette{ opacity: .26; }

      /* subtle screen kick */
      body.fx-kick{ animation: hhaKick 120ms ease; }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        35%{ transform: translate3d(0.9px,-0.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* pulse for "perfect" feel */
      body.fx-perfect{ animation: hhaPerfect 220ms ease; }
      @keyframes hhaPerfect{
        0%{ filter: none; }
        35%{ filter: brightness(1.10) contrast(1.05); }
        100%{ filter: none; }
      }

      /* end blink */
      body.fx-endblink{ animation: hhaEndBlink 760ms ease; }
      @keyframes hhaEndBlink{
        0%{ filter:none; }
        28%{ filter: brightness(1.16) contrast(1.06) saturate(1.06); }
        100%{ filter:none; }
      }
    `;
    DOC.head.appendChild(st);

    const vg = DOC.createElement('div');
    vg.className = 'hha-fx-vignette';
    DOC.body.appendChild(vg);
  })();

  // ---------------------------
  // helpers
  // ---------------------------
  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }

  function num(v){
    v = Number(v);
    return Number.isFinite(v) ? v : null;
  }

  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if (x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const raw = (d.type || d.kind || d.result || d.judge || d.hitType || d.label || '').toString().toLowerCase();

    // Normalize common words
    if (raw.includes('perfect')) return 'perfect';
    if (raw.includes('good') || raw.includes('correct') || raw.includes('hitgood')) return 'good';
    if (raw.includes('bad') || raw.includes('junk') || raw.includes('wrong') || raw.includes('hitjunk') || raw.includes('oops')) return 'bad';
    if (raw.includes('miss') || raw.includes('expire')) return 'miss';
    if (raw.includes('block') || raw.includes('guard') || raw.includes('shield')) return 'block';
    if (raw.includes('boss')) return 'boss';
    if (raw.includes('storm')) return 'storm';
    return raw || 'good';
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }

  function fxBurst(x,y, kind){
    const P = particles();
    if (!P) return;
    try{
      if (P.burstAt) {
        const emoji =
          kind === 'good' ? '✨' :
          kind === 'perfect' ? '💥' :
          kind === 'bad' ? '💢' :
          kind === 'block' ? '🛡️' :
          kind === 'boss' ? '🔥' :
          kind === 'storm' ? '🌪️' : '✨';
        P.burstAt(x,y, emoji, kind==='boss'?12:8, kind==='boss'?64:46, kind==='boss'?720:520);
      }
    }catch(_){}
  }

  function fxShock(x,y, size){
    const P = particles();
    if (!P) return;
    try{
      if (P.shockwave) P.shockwave(x,y, size || 240, 520);
      else fxBurst(x,y,'good');
    }catch(_){}
  }

  function fxPop(x,y, text, cls){
    const P = particles();
    if (!P) return;
    try{
      if (P.popText) P.popText(x,y, text, cls);
    }catch(_){}
  }

  function fxCelebrate(kind){
    const P = particles();
    if (P?.celebrate){
      try{
        if(kind==='end') P.celebrate({ count: 34, dur: 980, emojis:['🎉','✨','⭐','💎','🌈'] });
        else P.celebrate({ count: 22, dur: 820, emojis:['✨','⭐','🎉'] });
      }catch(_){}
    } else {
      // fallback: do nothing (vignette + endblink already handled)
    }
  }

  // ---------------------------
  // unified event binding
  // (some engines emit on window, some on document)
  // ---------------------------
  function onAny(target, name, fn){
    try{ target.addEventListener(name, fn, { passive:true }); }catch(_){}
  }

  function bind(name, fn){
    onAny(ROOT, name, fn);
    onAny(DOC,  name, fn);
  }

  // ---------------------------
  // event listeners
  // ---------------------------

  bind('hha:judge', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);

    // combo amplifier (if provided)
    const combo = Number(d.combo || d.comboNow || d.comboCount || 0);

    if (t === 'good'){
      addBodyCls('fx-hit-good', 180);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 220);
      fxBurst(x,y,'good');
      if (combo >= 5) fxBurst(x,y,'good');

    } else if (t === 'perfect'){
      addBodyCls('fx-hit-good', 220);
      addBodyCls('fx-kick', 120);
      addBodyCls('fx-perfect', 240);
      fxShock(x,y, 280);
      fxBurst(x,y,'perfect');
      fxPop(x,y, 'PERFECT!', 'perfect');

    } else if (t === 'bad'){
      addBodyCls('fx-hit-bad', 240);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 260);
      fxBurst(x,y,'bad');

    } else if (t === 'miss'){
      addBodyCls('fx-miss', 240);
      fxShock(x,y, 300);
      const P = particles();
      if (P?.missX) { try{ P.missX(x,y,'✖'); }catch(_){ } }
      else fxBurst(x,y,'bad');

    } else if (t === 'block'){
      addBodyCls('fx-hit-good', 160);
      fxBurst(x,y,'block');
      fxPop(x,y,'BLOCK','block');

    } else if (t === 'boss'){
      addBodyCls('fx-boss', 420);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 340);
      fxBurst(x,y,'boss');

    } else if (t === 'storm'){
      addBodyCls('fx-storm', 420);
      fxShock(x,y, 320);
      fxBurst(x,y,'storm');

    } else {
      // unknown -> mild good
      addBodyCls('fx-hit-good', 140);
      fxBurst(x,y,'good');
    }
  });

  bind('hha:score', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);

    // score delta or direct
    const sc = Number(d.delta ?? d.add ?? d.value ?? d.score ?? 0);
    if (Number.isFinite(sc) && sc !== 0){
      const text = (sc > 0) ? `+${Math.round(sc)}` : `${Math.round(sc)}`;
      fxPop(x, y, text, (sc >= 50) ? 'big' : 'score');
    }
  });

  bind('hha:miss', (e)=>{
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    addBodyCls('fx-miss', 260);
    fxShock(x,y, 320);
    const P = particles();
    if (P?.missX) { try{ P.missX(x,y,'✖'); }catch(_){ } }
  });

  bind('hha:celebrate', (e)=>{
    const d = e?.detail || {};
    const kind = (d.kind || '').toString().toLowerCase();
    fxCelebrate(kind || 'mini');
  });

  bind('hha:end', ()=>{
    addBodyCls('fx-endblink', 760);
    setTimeout(()=>fxCelebrate('end'), 220);
  });

  // dev probe
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+90, y:y-12 } })), 140);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-70, y:y+16 } })), 280);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'perfect', x:x, y:y-60 } })), 420);
    setTimeout(()=>ROOT.dispatchEvent(new CustomEvent('hha:end')), 720);
  };
})();