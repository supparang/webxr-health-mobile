// === /herohealth/vr/hha-fx-director.js ===
// HHA Global FX Director — PRODUCTION (HARD+)
// ✅ One file = works across all games (GoodJunk / Hydration / Plate / Groups)
// ✅ No dependency hard-fail: if particles missing -> still shows CSS FX
// ✅ Robust event intake: listens on window + document (บางเกมยิงคนละที่)
// ✅ FX channels:
//    - Screen vignette / kick / shake / chroma pulse
//    - Hit sparks (via Particles if available)
//    - Score pop (via Particles.popText)
//    - Phase banners (storm/boss/rage) with safe z-index
// ✅ Safe: does not block UI clicks (pointer-events:none), does not create overlays that hide HUD
//
// Expected events (any game can emit):
// - hha:judge {type/kind/judge/result, x/y/clientX/clientY, combo}
// - hha:score {score|delta|add|value, x/y}
// - hha:celebrate
// - hha:end
// Optional phase events (recommended):
// - hha:phase {name:'storm'|'boss'|'rage'|'calm', reason, level}
//   (OR hha:storm / hha:boss / hha:rage as convenience)

(function(){
  'use strict';
  const ROOT = window;
  const DOC  = document;
  if(!DOC || ROOT.__HHA_FX_DIRECTOR__) return;
  ROOT.__HHA_FX_DIRECTOR__ = true;

  // --------------------- CSS injection (global, minimal, safe) ---------------------
  (function injectCss(){
    const id = 'hha-fx-director-style';
    if(DOC.getElementById(id)) return;

    const st = DOC.createElement('style');
    st.id = id;
    st.textContent = `
      .hha-fx-layer2{
        position:fixed; inset:0; pointer-events:none; z-index:9996;
        overflow:hidden;
      }

      /* vignette overlay (very light default) */
      .hha-fx-vignette{
        position:absolute; inset:-24px;
        opacity:0;
        transition: opacity 140ms ease, transform 140ms ease;
        transform: scale(1);
        filter: blur(.2px);
      }
      .hha-fx-vignette::before{
        content:""; position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%,
          rgba(0,0,0,0) 43%,
          rgba(0,0,0,.28) 70%,
          rgba(0,0,0,.62) 100%);
      }

      /* short hit flashes (body classes) */
      body.fx-good .hha-fx-vignette{ opacity:.22; }
      body.fx-bad  .hha-fx-vignette{ opacity:.42; }
      body.fx-miss .hha-fx-vignette{ opacity:.34; }
      body.fx-block .hha-fx-vignette{ opacity:.18; }

      /* micro kick */
      body.fx-kick{
        animation: hhaKick 120ms ease;
      }
      @keyframes hhaKick{
        0%{ transform: translate3d(0,0,0); }
        35%{ transform: translate3d(.9px,-.9px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* stronger shake (boss / rage moments) */
      body.fx-shake{
        animation: hhaShake 240ms ease;
      }
      @keyframes hhaShake{
        0%{ transform: translate3d(0,0,0); }
        15%{ transform: translate3d(-1.4px, .8px,0); }
        35%{ transform: translate3d( 1.6px,-1.2px,0); }
        55%{ transform: translate3d(-1.2px,-.9px,0); }
        75%{ transform: translate3d( 1.2px, .7px,0); }
        100%{ transform: translate3d(0,0,0); }
      }

      /* chroma/contrast pulse (storm/boss) */
      body.fx-chroma{
        animation: hhaChroma 520ms ease;
      }
      @keyframes hhaChroma{
        0%{ filter:none; }
        35%{ filter: contrast(1.06) saturate(1.18) brightness(1.05); }
        100%{ filter:none; }
      }

      /* end blink */
      body.fx-end{
        animation: hhaEnd 700ms ease;
      }
      @keyframes hhaEnd{
        0%{ filter:none; }
        30%{ filter: brightness(1.18) contrast(1.06); }
        100%{ filter:none; }
      }

      /* phase banner */
      .hha-phase{
        position:absolute; left:50%; top:14%;
        transform: translate(-50%,-50%) scale(.98);
        opacity:0;
        padding: 10px 14px;
        border-radius: 999px;
        font: 900 14px/1.1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        letter-spacing:.2px;
        color:#e5e7eb;
        background: rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.22);
        box-shadow: 0 16px 44px rgba(0,0,0,.42);
        backdrop-filter: blur(10px);
        text-shadow: 0 8px 22px rgba(0,0,0,.55);
        transition: opacity 140ms ease, transform 140ms ease;
        will-change: opacity, transform;
      }
      .hha-phase.show{
        opacity:1;
        transform: translate(-50%,-50%) scale(1);
      }
      .hha-phase small{
        display:block;
        font-size:11px;
        font-weight:900;
        opacity:.75;
        margin-top:4px;
      }
    `;
    DOC.head.appendChild(st);

    // mount layer
    const layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer2';
    layer.innerHTML = `
      <div class="hha-fx-vignette" aria-hidden="true"></div>
      <div class="hha-phase" id="hhaPhaseBanner" aria-hidden="true"></div>
    `;
    DOC.body.appendChild(layer);
  })();

  // --------------------- helpers ---------------------
  const qs = (s)=> DOC.querySelector(s);
  const banner = ()=> DOC.getElementById('hhaPhaseBanner');

  function addBodyCls(c, ms){
    try{
      DOC.body.classList.add(c);
      setTimeout(()=>DOC.body.classList.remove(c), ms||180);
    }catch(_){}
  }

  function num(v){ v = Number(v); return Number.isFinite(v) ? v : null; }

  function pickXY(detail){
    const d = detail || {};
    const x = num(d.x) ?? num(d.px) ?? num(d.clientX) ?? num(d.cx);
    const y = num(d.y) ?? num(d.py) ?? num(d.clientY) ?? num(d.cy);
    if(x != null && y != null) return { x, y };
    return { x: innerWidth/2, y: innerHeight/2 };
  }

  function pickType(detail){
    const d = detail || {};
    const t = (d.type || d.kind || d.result || d.judge || d.hitType || '').toString().toLowerCase();
    if(t.includes('perfect')) return 'perfect';
    if(t.includes('good') || t.includes('correct') || t.includes('hitgood')) return 'good';
    if(t.includes('bad') || t.includes('junk') || t.includes('wrong') || t.includes('hitjunk')) return 'bad';
    if(t.includes('miss') || t.includes('expire')) return 'miss';
    if(t.includes('block') || t.includes('guard') || t.includes('shield')) return 'block';
    return t || 'good';
  }

  function particles(){
    return ROOT.Particles || ROOT.GAME_MODULES?.Particles || null;
  }

  function fxPop(x,y,text,cls){
    const P = particles();
    try{
      // support both minimal and full particles
      if(P?.popText) P.popText(x,y,text,cls);
      else if(P?.scorePop) P.scorePop(x,y,text);
    }catch(_){}
  }

  function fxBurst(x,y,r){
    const P = particles();
    try{
      if(P?.burst) P.burst(x,y,{r});
      else if(P?.burstAt) P.burstAt(x,y,'good');
    }catch(_){}
  }

  function fxShock(x,y,r){
    const P = particles();
    try{
      if(P?.shockwave) P.shockwave(x,y,{r});
      else fxBurst(x,y,r);
    }catch(_){}
  }

  let bannerTimer = 0;
  function showPhase(name, subtitle){
    const el = banner();
    if(!el) return;
    clearTimeout(bannerTimer);

    const n = String(name||'').toUpperCase();
    const sub = subtitle ? String(subtitle) : '';
    el.innerHTML = `${n}${sub ? `<small>${sub}</small>` : ''}`;
    el.classList.add('show');
    el.setAttribute('aria-hidden','false');

    bannerTimer = setTimeout(()=>{
      try{
        el.classList.remove('show');
        el.setAttribute('aria-hidden','true');
      }catch(_){}
    }, 1400);
  }

  // --------------------- unified listener attach ---------------------
  function on(target, evt, fn){
    try{ target.addEventListener(evt, fn, { passive:true }); }catch(_){}
  }

  // --------------------- core reactions ---------------------
  function onJudge(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);
    const t = pickType(d);
    const combo = Number(d.combo || d.comboNow || d.comboCount || 0);

    if(t === 'good'){
      addBodyCls('fx-good', 170);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 56);
      if(combo >= 5) fxBurst(x,y, 36);
      if(combo >= 10) addBodyCls('fx-chroma', 520);
      return;
    }

    if(t === 'perfect'){
      addBodyCls('fx-good', 200);
      addBodyCls('fx-kick', 120);
      addBodyCls('fx-chroma', 520);
      fxShock(x,y, 74);
      fxPop(x,y,'PERFECT!','perfect');
      return;
    }

    if(t === 'bad'){
      addBodyCls('fx-bad', 220);
      addBodyCls('fx-kick', 120);
      fxShock(x,y, 66);
      // bad feels heavier
      addBodyCls('fx-chroma', 520);
      return;
    }

    if(t === 'miss'){
      addBodyCls('fx-miss', 220);
      fxBurst(x,y, 62);
      return;
    }

    if(t === 'block'){
      addBodyCls('fx-block', 150);
      fxBurst(x,y, 48);
      fxPop(x,y,'BLOCK','block');
      return;
    }

    // unknown => mild
    addBodyCls('fx-good', 140);
    fxBurst(x,y, 48);
  }

  function onScore(e){
    const d = e?.detail || {};
    const { x, y } = pickXY(d);

    // prefer delta/add/value; fallback score (but score is absolute)
    const delta = Number(d.delta ?? d.add ?? d.value ?? d.score ?? 0);
    if(!Number.isFinite(delta) || delta === 0) return;

    const txt = (delta > 0) ? `+${delta}` : `${delta}`;
    fxPop(x, y, txt, delta >= 50 ? 'big' : 'score');
  }

  function onCelebrate(){
    // no hard dependence; just a phase banner + chroma pulse
    addBodyCls('fx-chroma', 520);
    showPhase('NICE!', 'สุดยอด!');
  }

  function onEnd(){
    addBodyCls('fx-end', 760);
    addBodyCls('fx-chroma', 520);
    showPhase('FINISH', 'จบเกมแล้ว!');
    // optional small shake for drama
    setTimeout(()=> addBodyCls('fx-shake', 260), 160);
  }

  function onPhase(e){
    const d = e?.detail || {};
    const name = String(d.name || d.phase || d.type || '').toLowerCase();
    const reason = d.reason ? String(d.reason) : '';
    const level = (d.level != null) ? String(d.level) : '';

    if(name.includes('storm')){
      addBodyCls('fx-chroma', 520);
      showPhase('STORM', reason || 'เวลาใกล้หมด!');
      return;
    }
    if(name.includes('boss')){
      addBodyCls('fx-shake', 260);
      addBodyCls('fx-chroma', 520);
      showPhase('BOSS', level ? `HP ${level}` : 'บอสมาแล้ว!');
      return;
    }
    if(name.includes('rage')){
      addBodyCls('fx-shake', 260);
      addBodyCls('fx-chroma', 520);
      showPhase('RAGE', reason || 'โหมดโหด!');
      return;
    }
    if(name.includes('calm')){
      showPhase('CALM', 'กลับสู่ปกติ');
    }
  }

  // --------------------- Attach listeners (window + document) ---------------------
  on(DOC,  'hha:judge', onJudge);
  on(ROOT, 'hha:judge', onJudge);

  on(DOC,  'hha:score', onScore);
  on(ROOT, 'hha:score', onScore);

  on(DOC,  'hha:celebrate', onCelebrate);
  on(ROOT, 'hha:celebrate', onCelebrate);

  on(DOC,  'hha:end', onEnd);
  on(ROOT, 'hha:end', onEnd);

  // phase events (recommended)
  on(DOC,  'hha:phase', onPhase);
  on(ROOT, 'hha:phase', onPhase);

  // convenience phase aliases
  on(DOC, 'hha:storm', (e)=> onPhase({ detail:{ name:'storm', reason:(e?.detail?.reason||'') }}));
  on(DOC, 'hha:boss',  (e)=> onPhase({ detail:{ name:'boss',  level:(e?.detail?.level||''), reason:(e?.detail?.reason||'') }}));
  on(DOC, 'hha:rage',  (e)=> onPhase({ detail:{ name:'rage',  reason:(e?.detail?.reason||'') }}));

  // --------------------- Dev probe ---------------------
  ROOT.HHA_FX_TEST = function(){
    const x = innerWidth/2, y = innerHeight/2;
    DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'good', x, y, combo:6 } }));
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:score',{ detail:{ delta:25, x:x+80, y:y-20 } })), 120);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:judge',{ detail:{ type:'bad', x:x-80, y:y+20 } })), 260);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ name:'storm', reason:'30s left' } })), 420);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ name:'boss', level:'12', reason:'miss>=4' } })), 650);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:phase',{ detail:{ name:'rage', reason:'miss>=5' } })), 920);
    setTimeout(()=>DOC.dispatchEvent(new CustomEvent('hha:end')), 1200);
  };

})();