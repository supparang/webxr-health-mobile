// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (universal, DOM-safe)
// ✅ Adds body classes: has-storm / has-boss / has-rage
// ✅ Screen shake + flash + vignette pulses
// ✅ Hooks: hha:judge, hha:celebrate, hha:phase, hha:time, hha:score
// ✅ Works with particles.js if present (optional)
// ✅ Rate-limited to keep it kid-friendly & not nauseating
//
// Expected by games (recommended):
// - dispatchEvent('hha:phase', { detail:{ phase:'storm'|'boss'|'rage'|'clear', hp?, hpMax?, ttlMs? } })
// - dispatchEvent('hha:judge', { detail:{ label:'GOOD!'|'OOPS!'|'MISS!'|'BLOCK!'|'BOSS HIT!'|'BOSS DOWN!' ... } })
// - dispatchEvent('hha:celebrate', { detail:{ kind:'mini'|'end'|'boss'|'perfect' ... } })

(function () {
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // --------------------- helpers ---------------------
  const now = () => (performance && performance.now) ? performance.now() : Date.now();
  const clamp = (v, a, b) => (v < a ? a : (v > b ? b : v));
  const qs = (s, el = DOC) => el.querySelector(s);

  function getParticles(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }

  function ensureFxLayer(){
    let layer = qs('.hha-fx-layer');
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.className = 'hha-fx-layer';
    layer.style.cssText = `
      position:fixed; inset:0;
      pointer-events:none;
      z-index:120;
      overflow:hidden;
    `;
    DOC.body.appendChild(layer);
    return layer;
  }

  function ensureStyle(){
    if (qs('#hhaFxDirectorStyle')) return;
    const st = DOC.createElement('style');
    st.id = 'hhaFxDirectorStyle';
    st.textContent = `
      /* FX Director core */
      .hha-fx-flash{
        position:absolute; inset:0;
        background: rgba(255,255,255,.12);
        opacity:0;
        will-change: opacity;
      }
      .hha-fx-flash.on{ animation: hhaFlash 160ms ease-out; }
      @keyframes hhaFlash{
        0%{opacity:0;}
        40%{opacity:1;}
        100%{opacity:0;}
      }

      .hha-fx-vignette{
        position:absolute; inset:0;
        background: radial-gradient(circle at 50% 50%, transparent 54%, rgba(0,0,0,.38) 92%, rgba(0,0,0,.62) 100%);
        opacity:0;
        will-change: opacity, transform;
        transform: scale(1);
      }
      .hha-fx-vignette.on{ animation: hhaVig 520ms ease-in-out; }
      @keyframes hhaVig{
        0%{opacity:0; transform:scale(.98);}
        45%{opacity:1; transform:scale(1.01);}
        100%{opacity:0; transform:scale(1);}
      }

      .hha-fx-hitRing{
        position:absolute;
        left: var(--x, 50%); top: var(--y, 50%);
        width: 180px; height: 180px;
        border-radius: 999px;
        border: 10px solid rgba(34,197,94,.18);
        box-shadow: 0 0 0 10px rgba(34,197,94,.06);
        transform: translate(-50%,-50%) scale(.82);
        opacity:0;
        will-change: transform, opacity;
      }
      .hha-fx-hitRing.good{ border-color: rgba(34,197,94,.18); box-shadow: 0 0 0 10px rgba(34,197,94,.06); }
      .hha-fx-hitRing.bad{  border-color: rgba(239,68,68,.18); box-shadow: 0 0 0 10px rgba(239,68,68,.06); }
      .hha-fx-hitRing.warn{ border-color: rgba(245,158,11,.18); box-shadow: 0 0 0 10px rgba(245,158,11,.06); }
      .hha-fx-hitRing.on{ animation: hhaRing 260ms ease-out; }
      @keyframes hhaRing{
        0%{ opacity:0; transform:translate(-50%,-50%) scale(.78); }
        45%{ opacity:1; transform:translate(-50%,-50%) scale(1.03); }
        100%{ opacity:0; transform:translate(-50%,-50%) scale(1.18); }
      }

      /* screen shake: apply to body */
      body.hha-shake{ animation: hhaShake var(--shake-ms, 180ms) ease-in-out; }
      @keyframes hhaShake{
        0%{ transform: translate(0,0) rotate(0deg); }
        20%{ transform: translate(calc(var(--sx)*1px), calc(var(--sy)*1px)) rotate(calc(var(--sr)*1deg)); }
        40%{ transform: translate(calc(var(--sx)*-1px), calc(var(--sy)*.7px)) rotate(calc(var(--sr)*-1deg)); }
        60%{ transform: translate(calc(var(--sx)*.8px), calc(var(--sy)*-1px)) rotate(calc(var(--sr)*.8deg)); }
        80%{ transform: translate(calc(var(--sx)*-.6px), calc(var(--sy)*.6px)) rotate(calc(var(--sr)*-.6deg)); }
        100%{ transform: translate(0,0) rotate(0deg); }
      }

      /* phase banner chip (optional) */
      .hha-phase-chip{
        position:fixed;
        left: calc(12px + env(safe-area-inset-left,0px));
        bottom: calc(12px + env(safe-area-inset-bottom,0px));
        z-index: 210;
        pointer-events:none;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.62);
        color: #e5e7eb;
        font: 900 12px/1.1 system-ui;
        letter-spacing: .2px;
        opacity: 0;
        transform: translateY(6px);
        transition: opacity .18s ease-out, transform .18s ease-out;
      }
      .hha-phase-chip.on{
        opacity: 1;
        transform: translateY(0);
      }
      .hha-phase-chip.storm{ border-color: rgba(245,158,11,.30); }
      .hha-phase-chip.boss{ border-color: rgba(239,68,68,.30); }
      .hha-phase-chip.rage{ border-color: rgba(239,68,68,.45); box-shadow: 0 0 0 8px rgba(239,68,68,.06); }
    `;
    DOC.head.appendChild(st);
  }

  ensureStyle();
  const fxLayer = ensureFxLayer();

  // static fx nodes
  const flash = DOC.createElement('div');
  flash.className = 'hha-fx-flash';
  fxLayer.appendChild(flash);

  const vig = DOC.createElement('div');
  vig.className = 'hha-fx-vignette';
  fxLayer.appendChild(vig);

  const ring = DOC.createElement('div');
  ring.className = 'hha-fx-hitRing';
  fxLayer.appendChild(ring);

  const phaseChip = DOC.createElement('div');
  phaseChip.className = 'hha-phase-chip';
  phaseChip.textContent = '';
  DOC.body.appendChild(phaseChip);

  // --------------------- rate limit ---------------------
  const RL = {
    flash: 0,
    ring: 0,
    shake: 0,
    chip: 0,
  };
  const cool = {
    flash: 110,
    ring: 120,
    shake: 160,
    chip: 220,
  };

  function can(key){
    const t = now();
    if (t - RL[key] >= cool[key]) { RL[key] = t; return true; }
    return false;
  }

  // --------------------- FX primitives ---------------------
  function doFlash(intensity = 1){
    if (!can('flash')) return;
    try{
      flash.style.background = `rgba(255,255,255,${0.08 + 0.06*clamp(intensity,0,2)})`;
      flash.classList.remove('on');
      // restart animation
      void flash.offsetWidth;
      flash.classList.add('on');
    }catch(_){}
  }

  function doVignette(){
    if (!can('flash')) return;
    try{
      vig.classList.remove('on');
      void vig.offsetWidth;
      vig.classList.add('on');
    }catch(_){}
  }

  function doRing(clientX, clientY, kind='good'){
    if (!can('ring')) return;
    try{
      const x = (Number(clientX)||0);
      const y = (Number(clientY)||0);
      if (x && y){
        ring.style.setProperty('--x', `${x}px`);
        ring.style.setProperty('--y', `${y}px`);
      }else{
        ring.style.setProperty('--x', `50%`);
        ring.style.setProperty('--y', `50%`);
      }
      ring.classList.remove('good','bad','warn','on');
      ring.classList.add(kind === 'bad' ? 'bad' : (kind==='warn'?'warn':'good'));
      void ring.offsetWidth;
      ring.classList.add('on');
    }catch(_){}
  }

  function doShake(power=1, ms=180){
    if (!can('shake')) return;
    try{
      const p = clamp(power, 0.3, 2.2);
      DOC.body.style.setProperty('--sx', String(Math.round(6*p)));
      DOC.body.style.setProperty('--sy', String(Math.round(5*p)));
      DOC.body.style.setProperty('--sr', String((0.8*p).toFixed(2)));
      DOC.body.style.setProperty('--shake-ms', `${Math.round(ms)}ms`);
      DOC.body.classList.remove('hha-shake');
      void DOC.body.offsetWidth;
      DOC.body.classList.add('hha-shake');
      setTimeout(()=>{ try{ DOC.body.classList.remove('hha-shake'); }catch(_){} }, Math.round(ms)+40);
    }catch(_){}
  }

  function setPhaseChip(kind='clear', text=''){
    if (!can('chip')) return;
    try{
      phaseChip.classList.remove('storm','boss','rage','on');
      if (kind && kind !== 'clear'){
        phaseChip.classList.add(kind);
        phaseChip.textContent = text || kind.toUpperCase();
        phaseChip.classList.add('on');
        setTimeout(()=>{ try{ phaseChip.classList.remove('on'); }catch(_){} }, 1400);
      }else{
        phaseChip.textContent = '';
      }
    }catch(_){}
  }

  // --------------------- phase class control ---------------------
  function applyPhase(phase){
    const b = DOC.body;
    b.classList.remove('has-storm','has-boss','has-rage');
    if (phase === 'storm') b.classList.add('has-storm');
    if (phase === 'boss')  b.classList.add('has-boss');
    if (phase === 'rage')  b.classList.add('has-boss','has-rage');
  }

  // --------------------- event handlers ---------------------
  function onJudge(ev){
    const d = ev?.detail || {};
    const label = String(d.label || '').toUpperCase();

    // Use optional position
    const x = d.clientX ?? d.x ?? 0;
    const y = d.clientY ?? d.y ?? 0;

    // Map labels
    if (label.includes('GOOD')){
      doRing(x,y,'good');
      doFlash(0.8);
      // optional particles
      const P = getParticles();
      try{
        if (P?.popText) P.popText(x||innerWidth/2, y||innerHeight/2, d.text || '+');
      }catch(_){}
      return;
    }

    if (label.includes('BLOCK')){
      doRing(x,y,'warn');
      doFlash(0.6);
      doShake(0.7, 150);
      return;
    }

    if (label.includes('MISS') || label.includes('OOPS') || label.includes('BAD')){
      doRing(x,y,'bad');
      doFlash(1.2);
      doVignette();
      doShake(1.2, 190);
      return;
    }

    if (label.includes('BOSS')){
      doRing(x,y,'bad');
      doFlash(1.4);
      doVignette();
      doShake(1.6, 220);
      return;
    }
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind || '').toLowerCase();

    if (kind === 'mini'){
      doFlash(1.0);
      doRing(innerWidth/2, innerHeight/2, 'good');
      doShake(0.8, 160);
      setPhaseChip('clear', 'MINI CLEAR!');
      return;
    }

    if (kind === 'boss'){
      doFlash(1.4);
      doVignette();
      doShake(1.6, 220);
      setPhaseChip('boss', 'BOSS DOWN!');
      return;
    }

    if (kind === 'end'){
      doFlash(1.2);
      doRing(innerWidth/2, innerHeight/2, 'good');
      doShake(0.9, 180);
      return;
    }
  }

  function onPhase(ev){
    const d = ev?.detail || {};
    const phase = String(d.phase || d.kind || 'clear').toLowerCase();

    applyPhase(phase);

    if (phase === 'storm'){
      setPhaseChip('storm', 'STORM!');
      doVignette();
      doFlash(0.7);
      doShake(0.7, 160);
      return;
    }
    if (phase === 'boss'){
      const hp = d.hp ?? '';
      const hpMax = d.hpMax ?? '';
      setPhaseChip('boss', hpMax ? `BOSS (${hp}/${hpMax})` : 'BOSS!');
      doVignette();
      doFlash(1.0);
      doShake(1.2, 190);
      return;
    }
    if (phase === 'rage'){
      setPhaseChip('rage', 'RAGE!');
      doVignette();
      doFlash(1.4);
      doShake(1.6, 220);
      return;
    }

    // clear
    setPhaseChip('clear','');
  }

  // optional hooks (time/score) if game sends
  function onTime(ev){
    // (Optional) can be used to auto storm at low time, but GoodJunk safe.js already does
    // Keep here for other games to reuse.
    void ev;
  }
  function onScore(ev){
    void ev;
  }

  // --------------------- bind (window + document) ---------------------
  function bindAll(target){
    try{
      target.addEventListener('hha:judge', onJudge, { passive:true });
      target.addEventListener('hha:celebrate', onCelebrate, { passive:true });
      target.addEventListener('hha:phase', onPhase, { passive:true });
      target.addEventListener('hha:time', onTime, { passive:true });
      target.addEventListener('hha:score', onScore, { passive:true });
    }catch(_){}
  }
  bindAll(WIN);
  bindAll(DOC);

  // --------------------- public minimal API ---------------------
  WIN.HHA_FX = WIN.HHA_FX || {};
  WIN.HHA_FX.phase = (p)=> applyPhase(String(p||'clear').toLowerCase());
  WIN.HHA_FX.flash = (i)=> doFlash(i);
  WIN.HHA_FX.shake = (p,ms)=> doShake(p,ms);
})();