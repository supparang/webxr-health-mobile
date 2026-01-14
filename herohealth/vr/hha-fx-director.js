// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (Boss++ / Storm / Rage)
// ✅ Listens: hha:judge, hha:boss, hha:storm, hha:celebrate, hha:end
// ✅ Adds non-blocking FX overlay layer (vignette + flash + shake + glitch-lite)
// ✅ Uses Particles module if available (optional)
// ✅ Safe: idempotent load, no hard dependencies, never blocks input
//
// Works best with:
// - ../vr/particles.js loaded first
// - safe.js emits events as described in GoodJunkVR SAFE

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if(!WIN || !DOC) return;

  if(WIN.__HHA_FX_DIRECTOR_LOADED__) return;
  WIN.__HHA_FX_DIRECTOR_LOADED__ = true;

  // -------------------- helpers --------------------
  const now = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

  function fxModule(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }
  function popText(x,y,t,cls=null,opts=null){
    const P = fxModule();
    try{
      if(P && typeof P.popText === 'function') P.popText(x,y,t,cls,opts);
      else if(P && typeof P.scorePop === 'function') P.scorePop(x,y,t);
    }catch(_){}
  }
  function ringPulse(x,y,kind='good',opts=null){
    const P = fxModule();
    try{
      if(P && typeof P.ringPulse === 'function') P.ringPulse(x,y,kind,opts);
    }catch(_){}
  }
  function burstAt(x,y,kind='good',opts=null){
    const P = fxModule();
    try{
      if(P && typeof P.burstAt === 'function') P.burstAt(x,y,kind,opts);
    }catch(_){}
  }
  function celebrate(kind='win',opts=null){
    const P = fxModule();
    try{
      if(P && typeof P.celebrate === 'function') P.celebrate(kind,opts);
    }catch(_){}
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-fx-style')) return;

    const css = `
      .hha-fx-layer{
        position:fixed; inset:0;
        z-index:160;
        pointer-events:none;
        overflow:hidden;
      }
      .hha-fx-vignette{
        position:absolute; inset:-2px;
        opacity:0;
        transition: opacity 120ms ease;
        background:
          radial-gradient(circle at center,
            rgba(0,0,0,0) 45%,
            rgba(0,0,0,0.10) 60%,
            rgba(0,0,0,0.38) 78%,
            rgba(0,0,0,0.62) 100%);
        filter: blur(0.2px);
      }
      .hha-fx-vignette.danger{
        opacity:1;
        background:
          radial-gradient(circle at center,
            rgba(0,0,0,0) 42%,
            rgba(239,68,68,0.10) 60%,
            rgba(239,68,68,0.18) 75%,
            rgba(239,68,68,0.28) 100%),
          radial-gradient(circle at center,
            rgba(0,0,0,0) 50%,
            rgba(0,0,0,0.20) 80%,
            rgba(0,0,0,0.55) 100%);
      }
      .hha-fx-vignette.storm{
        opacity:1;
        background:
          radial-gradient(circle at center,
            rgba(0,0,0,0) 44%,
            rgba(245,158,11,0.10) 60%,
            rgba(245,158,11,0.16) 75%,
            rgba(245,158,11,0.22) 100%),
          radial-gradient(circle at center,
            rgba(0,0,0,0) 52%,
            rgba(0,0,0,0.25) 82%,
            rgba(0,0,0,0.58) 100%);
      }

      .hha-fx-flash{
        position:absolute; inset:0;
        opacity:0;
        background: rgba(255,255,255,0.16);
        transition: opacity 80ms ease;
      }
      .hha-fx-flash.on{ opacity:1; }
      .hha-fx-flash.bad{ background: rgba(239,68,68,0.20); }
      .hha-fx-flash.warn{ background: rgba(245,158,11,0.18); }
      .hha-fx-flash.good{ background: rgba(34,197,94,0.16); }
      .hha-fx-flash.violet{ background: rgba(167,139,250,0.18); }
      .hha-fx-flash.cyan{ background: rgba(34,211,238,0.14); }

      .hha-fx-shake{
        will-change: transform;
      }
      @keyframes hhaShakeA{
        0%{transform:translate3d(0,0,0)}
        15%{transform:translate3d(-2px,1px,0)}
        30%{transform:translate3d(2px,-1px,0)}
        45%{transform:translate3d(-2px,-1px,0)}
        60%{transform:translate3d(2px,1px,0)}
        75%{transform:translate3d(-1px,1px,0)}
        100%{transform:translate3d(0,0,0)}
      }
      @keyframes hhaShakeB{
        0%{transform:translate3d(0,0,0)}
        18%{transform:translate3d(-4px,2px,0)}
        36%{transform:translate3d(4px,-2px,0)}
        54%{transform:translate3d(-3px,-2px,0)}
        72%{transform:translate3d(3px,2px,0)}
        90%{transform:translate3d(-2px,2px,0)}
        100%{transform:translate3d(0,0,0)}
      }

      .hha-fx-banner{
        position:absolute;
        left:50%; top: calc(14px + env(safe-area-inset-top, 0px));
        transform: translateX(-50%) translateY(-6px);
        padding:10px 14px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.66);
        color:#e5e7eb;
        font: 900 13px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        letter-spacing:.2px;
        box-shadow: 0 10px 28px rgba(0,0,0,.35);
        opacity:0;
        transition: opacity 140ms ease, transform 160ms ease;
        z-index:1;
      }
      .hha-fx-banner.on{
        opacity:1;
        transform: translateX(-50%) translateY(0);
      }
      .hha-fx-banner.bad{ border-color: rgba(239,68,68,.35); background: rgba(127,29,29,.35); }
      .hha-fx-banner.warn{ border-color: rgba(245,158,11,.35); background: rgba(120,53,15,.34); }
      .hha-fx-banner.good{ border-color: rgba(34,197,94,.35); background: rgba(20,83,45,.32); }
      .hha-fx-banner.violet{ border-color: rgba(167,139,250,.40); background: rgba(91,33,182,.22); }
      .hha-fx-banner.cyan{ border-color: rgba(34,211,238,.35); background: rgba(22,78,99,.22); }

      /* Boss HUD (top-center, below banner) */
      .hha-boss-hud{
        position:absolute;
        left:50%;
        top: calc(58px + env(safe-area-inset-top, 0px));
        transform: translateX(-50%);
        width: min(520px, 92vw);
        padding:10px 12px;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.60);
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        opacity:0;
        transition: opacity 160ms ease, transform 160ms ease;
      }
      .hha-boss-hud.on{
        opacity:1;
        transform: translateX(-50%) translateY(0);
      }
      .hha-boss-top{
        display:flex; align-items:center; justify-content:space-between; gap:10px;
        font: 900 12px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif;
        color:#e5e7eb;
      }
      .hha-boss-top .meta{ color:#94a3b8; font-weight:900; }
      .hha-boss-bar{
        margin-top:8px;
        height:12px;
        border-radius: 999px;
        background: rgba(148,163,184,.18);
        overflow:hidden;
        border:1px solid rgba(148,163,184,.16);
      }
      .hha-boss-fill{
        height:100%;
        width: 0%;
        transition: width 120ms ease;
        background: linear-gradient(90deg, rgba(34,197,94,.85), rgba(245,158,11,.80), rgba(239,68,68,.80));
      }
      .hha-boss-hud.phase2{
        border-color: rgba(239,68,68,.36);
        box-shadow: 0 14px 42px rgba(239,68,68,.12), 0 10px 30px rgba(0,0,0,.35);
      }
      .hha-boss-hud.rage{
        border-color: rgba(239,68,68,.50);
        box-shadow: 0 16px 56px rgba(239,68,68,.14), 0 12px 34px rgba(0,0,0,.35);
      }

      /* reduce motion option */
      @media (prefers-reduced-motion: reduce){
        .hha-fx-banner, .hha-boss-hud, .hha-fx-vignette, .hha-fx-flash { transition:none !important; }
      }
    `;

    const style = DOC.createElement('style');
    style.id = 'hha-fx-style';
    style.textContent = css;
    DOC.head.appendChild(style);
  }

  function ensureLayer(){
    let layer = DOC.querySelector('.hha-fx-layer');
    if(layer) return layer;

    ensureStyle();

    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    DOC.body.appendChild(layer);

    // vignette + flash
    const vig = DOC.createElement('div');
    vig.className = 'hha-fx-vignette';
    layer.appendChild(vig);

    const flash = DOC.createElement('div');
    flash.className = 'hha-fx-flash';
    layer.appendChild(flash);

    // banner
    const banner = DOC.createElement('div');
    banner.className = 'hha-fx-banner';
    banner.textContent = '';
    layer.appendChild(banner);

    // boss HUD
    const boss = DOC.createElement('div');
    boss.className = 'hha-boss-hud';
    boss.innerHTML = `
      <div class="hha-boss-top">
        <div><span style="font-size:14px">🧟‍♂️</span> BOSS <span class="meta" id="hhaBossMeta">—</span></div>
        <div class="meta" id="hhaBossHp">HP —/—</div>
      </div>
      <div class="hha-boss-bar"><div class="hha-boss-fill" id="hhaBossFill"></div></div>
    `;
    layer.appendChild(boss);

    return layer;
  }

  function getNodes(){
    const layer = ensureLayer();
    return {
      layer,
      vignette: layer.querySelector('.hha-fx-vignette'),
      flash: layer.querySelector('.hha-fx-flash'),
      banner: layer.querySelector('.hha-fx-banner'),
      bossHud: layer.querySelector('.hha-boss-hud'),
      bossFill: layer.querySelector('#hhaBossFill'),
      bossHp: layer.querySelector('#hhaBossHp'),
      bossMeta: layer.querySelector('#hhaBossMeta'),
    };
  }

  // -------------------- FX primitives --------------------
  let lastFlashAt = 0;
  function flash(kind='good', ms=90){
    const n = getNodes();
    const t = now();
    if(t - lastFlashAt < 45) return;
    lastFlashAt = t;

    if(!n.flash) return;
    n.flash.className = 'hha-fx-flash on ' + (kind || '');
    setTimeout(()=>{ try{ n.flash.className = 'hha-fx-flash'; }catch(_){ } }, ms);
  }

  let shakeTimer = 0;
  function shake(strength='a', ms=160){
    // apply shake to body (but safe if game uses transforms elsewhere)
    try{
      const b = DOC.body;
      if(!b) return;

      // prevent permanent stack
      clearTimeout(shakeTimer);

      // use animation not continuous transform
      b.classList.add('hha-fx-shake');
      b.style.animation = `none`;
      // restart
      void b.offsetHeight; // reflow
      b.style.animation = (strength==='b')
        ? `hhaShakeB ${ms}ms ease both`
        : `hhaShakeA ${ms}ms ease both`;

      shakeTimer = setTimeout(()=>{
        try{
          b.style.animation = '';
          b.classList.remove('hha-fx-shake');
        }catch(_){}
      }, ms + 40);
    }catch(_){}
  }

  let bannerTimer = 0;
  function banner(text, kind='good', ms=900){
    const n = getNodes();
    if(!n.banner) return;
    clearTimeout(bannerTimer);
    n.banner.textContent = String(text || '');
    n.banner.className = 'hha-fx-banner on ' + (kind || '');
    bannerTimer = setTimeout(()=>{
      try{ n.banner.className = 'hha-fx-banner'; }catch(_){}
    }, ms);
  }

  function setVignette(mode){
    const n = getNodes();
    if(!n.vignette) return;
    n.vignette.className = 'hha-fx-vignette' + (mode ? (' ' + mode) : '');
  }

  // -------------------- Boss HUD control --------------------
  let bossOn = false;
  let bossHp = 0, bossHpMax = 1, bossPhase = 0, bossRage = false;

  function renderBossHud(){
    const n = getNodes();
    if(!n.bossHud) return;

    if(!bossOn){
      n.bossHud.className = 'hha-boss-hud';
      n.bossHud.classList.remove('on','phase2','rage');
      return;
    }

    const pct = clamp((bossHpMax>0) ? (bossHp / bossHpMax) : 0, 0, 1);
    const pct100 = Math.round(pct * 1000) / 10;

    if(n.bossHp) n.bossHp.textContent = `HP ${bossHp}/${bossHpMax}`;
    if(n.bossMeta){
      const p = (bossPhase===2) ? 'P2' : 'P1';
      n.bossMeta.textContent = `(${p}${bossRage ? ' · RAGE' : ''} · ${pct100}%)`;
    }
    if(n.bossFill) n.bossFill.style.width = `${Math.round(pct*100)}%`;

    n.bossHud.className = 'hha-boss-hud on';
    if(bossPhase===2) n.bossHud.classList.add('phase2');
    if(bossRage) n.bossHud.classList.add('rage');
  }

  // -------------------- Event handlers --------------------
  function center(){
    return {
      x: Math.floor(DOC.documentElement.clientWidth/2),
      y: Math.floor(DOC.documentElement.clientHeight*0.28)
    };
  }

  function onJudge(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    const type = String(d.type || '').toLowerCase();
    const label = String(d.label || '').trim();

    // coordinate for particle text
    const x = Number.isFinite(+d.x) ? +d.x : center().x;
    const y = Number.isFinite(+d.y) ? +d.y : center().y;

    if(type === 'good'){
      flash('good', 70);
      // small shake only in boss/late game (optional). Here keep gentle:
      if(qs('fx','1') !== '0') shake('a', 120);
      if(label) popText(x,y,label,'good',{ size: 14 });
      burstAt(x,y,'good');
      return;
    }

    if(type === 'perfect'){
      flash('cyan', 80);
      if(label) popText(x,y,label,'cyan',{ size: 16 });
      ringPulse(x,y,'star',{ size: 160 });
      return;
    }

    if(type === 'block'){
      flash('cyan', 70);
      if(label) popText(x,y,label,'cyan',{ size: 14 });
      ringPulse(x,y,'shield',{ size: 160 });
      return;
    }

    if(type === 'bad'){
      flash('bad', 90);
      shake('b', 180);
      if(label) popText(x,y,label,'bad',{ size: 16 });
      burstAt(x,y,'bad');
      return;
    }

    if(type === 'miss'){
      flash('warn', 80);
      shake('a', 150);
      if(label) popText(x,y,label,'warn',{ size: 14 });
      return;
    }

    // fallback
    if(label){
      popText(x,y,label,null,{ size: 14 });
    }
  }

  function onStorm(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;

    if(on){
      setVignette('storm');
      banner('🌪️ STORM! เป้าเยอะขึ้น ระวังขยะ!', 'warn', 1200);
      flash('warn', 110);
      shake('b', 220);
      const c = center();
      ringPulse(c.x, c.y, 'star', { size: 240 });
      popText(c.x, c.y, 'STORM!', 'warn', { size: 22 });
    }else{
      // if boss still on, leave danger vignette to boss handler
      if(bossOn) setVignette('danger');
      else setVignette('');
      banner('✅ STORM CLEAR', 'good', 900);
      flash('good', 80);
    }
  }

  function onBoss(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;

    bossOn = on;
    bossHp = clamp(Number(d.hp ?? bossHp), 0, 9999);
    bossHpMax = Math.max(1, Number(d.hpMax ?? bossHpMax) || 1);
    bossPhase = Number(d.phase ?? bossPhase) || 0;
    bossRage = !!d.rage;

    renderBossHud();

    if(on){
      setVignette('danger');

      // show big entrance only when first turns on
      if(d.why === 'good-hit' || d.why === 'junk-hit') {
        // hp updates: keep subtle (no banner spam)
        return;
      }

      banner(`🧟‍♂️ BOSS! HP ${bossHpMax}  (เก็บของดีเพื่อลด HP)`, 'violet', 1300);
      flash('violet', 120);
      shake('b', 240);
      const c = center();
      ringPulse(c.x, c.y, 'violet', { size: 280 });
    }else{
      // boss ended
      bossOn = false;
      bossPhase = 0;
      bossRage = false;
      renderBossHud();

      // if storm still on, storm handler controls vignette; else clear
      setVignette('');
      banner('🏆 BOSS DOWN! เก่งมาก!', 'good', 1200);
      flash('good', 100);
      celebrate('boss', { count: 18 });
    }
  }

  function onCelebrate(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    const kind = String(d.kind || '').toLowerCase();

    if(kind === 'mini'){
      banner('✨ MINI CLEAR!', 'cyan', 850);
      flash('cyan', 90);
      return;
    }
    if(kind === 'boss'){
      banner('🏆 BOSS CLEAR!', 'good', 950);
      flash('good', 100);
      return;
    }
    if(kind === 'end'){
      // handled in onEnd
      return;
    }
  }

  function onEnd(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    const reason = String(d.reason || '');
    const grade  = String(d.grade || '');

    // stop boss overlay & vignette
    bossOn = false;
    bossPhase = 0;
    bossRage = false;
    renderBossHud();
    setVignette('');

    if(reason === 'missLimit'){
      banner('💥 GAME OVER (MISS เต็ม)', 'bad', 1300);
      flash('bad', 140);
      shake('b', 260);
      const c = center();
      popText(c.x, c.y, 'GAME OVER', 'bad', { size: 26 });
      return;
    }

    // win / timeup
    banner(`🎉 DONE! GRADE ${grade || '—'}`, 'good', 1400);
    flash('good', 110);
    celebrate('win', { count: 18 });
  }

  // -------------------- bind events (window + document) --------------------
  function bind(target, name, fn){
    try{ target.addEventListener(name, fn, { passive:true }); }catch(_){}
  }

  // Main list
  ['hha:judge','hha:boss','hha:storm','hha:celebrate','hha:end'].forEach((name)=>{
    // no-op: just to show we intend to listen on both
  });

  bind(WIN, 'hha:judge', onJudge);
  bind(DOC, 'hha:judge', onJudge);

  bind(WIN, 'hha:storm', onStorm);
  bind(DOC, 'hha:storm', onStorm);

  bind(WIN, 'hha:boss', onBoss);
  bind(DOC, 'hha:boss', onBoss);

  bind(WIN, 'hha:celebrate', onCelebrate);
  bind(DOC, 'hha:celebrate', onCelebrate);

  bind(WIN, 'hha:end', onEnd);
  bind(DOC, 'hha:end', onEnd);

  // initial create (so CSS is ready early)
  ensureLayer();

  // optional: allow disable via ?fx=0
  const fxEnabled = (qs('fx','1') !== '0');
  if(!fxEnabled){
    try{
      const layer = DOC.querySelector('.hha-fx-layer');
      if(layer) layer.style.display = 'none';
    }catch(_){}
  }
})();