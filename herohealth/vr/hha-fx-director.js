// === /herohealth/vr/hha-fx-director.js ===
// HHA FX Director — PRODUCTION (ULTRA, shared across all games)
// ✅ Works with ../vr/particles.js (Particles layer) if present
// ✅ Safe if Particles is missing (no crash)
// ✅ Listens: hha:judge, hha:celebrate, hha:phase, hha:coach
// ✅ Adds body classes for CSS-driven effects:
//    gj-storm / gj-boss / gj-rage (GoodJunk) + hha-storm/hha-boss/hha-rage (global)
// ✅ Adds banners + screen shakes (light) + vignette flashes
// ✅ Rate-limited to avoid overload on mobile

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_FX_DIRECTOR__) return;
  WIN.__HHA_FX_DIRECTOR__ = true;

  // ---------------- utils ----------------
  const now = ()=> performance.now();
  const clamp = (v,a,b)=> (v<a?a:(v>b?b:v));
  const safe = (fn)=> { try{ fn(); }catch(_){ } };

  function emit(name, detail){
    safe(()=> WIN.dispatchEvent(new CustomEvent(name, { detail })));
  }

  // ---------------- Particles bridge ----------------
  function P(){
    return (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles || null;
  }
  function pop(x,y,t){
    const p = P();
    if(!p) return;
    safe(()=>{
      if(typeof p.popText === 'function') p.popText(x,y,t);
      else if(typeof p.scorePop === 'function') p.scorePop(x,y,t);
    });
  }
  function burst(x,y,kind){
    const p = P();
    if(!p) return;
    safe(()=>{
      if(typeof p.burstAt === 'function') p.burstAt(x,y,kind||'good');
    });
  }

  // ---------------- FX layer (DOM) ----------------
  function ensureOverlay(){
    let ov = DOC.getElementById('hhaFxOverlay');
    if(ov) return ov;
    ov = DOC.createElement('div');
    ov.id = 'hhaFxOverlay';
    ov.style.cssText = `
      position:fixed; inset:0; pointer-events:none;
      z-index: 200; overflow:hidden;
    `;
    DOC.body.appendChild(ov);
    return ov;
  }

  // quick banner
  let bannerEl = null;
  let bannerT = 0;

  function ensureBanner(){
    if(bannerEl) return bannerEl;
    const ov = ensureOverlay();
    bannerEl = DOC.createElement('div');
    bannerEl.id = 'hhaFxBanner';
    bannerEl.style.cssText = `
      position:absolute;
      left:50%; top: calc(14px + var(--sat, 0px));
      transform: translate(-50%, 0);
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.58);
      color: #e5e7eb;
      font: 1200 14px/1 system-ui, -apple-system, "Segoe UI", "Noto Sans Thai";
      letter-spacing: .02em;
      box-shadow: 0 18px 55px rgba(0,0,0,.35);
      opacity: 0;
      will-change: transform, opacity, filter;
      backdrop-filter: blur(10px);
    `;
    ov.appendChild(bannerEl);
    return bannerEl;
  }

  function banner(text, opts={}){
    const el = ensureBanner();
    const t = String(text || '').trim();
    if(!t) return;

    const kind = (opts.kind || '').toLowerCase();
    const ms = clamp(Number(opts.ms || 900), 420, 2400);

    // styles by kind
    let border = 'rgba(148,163,184,.22)';
    let bg = 'rgba(2,6,23,.58)';
    if(kind === 'good') { border='rgba(34,197,94,.35)'; bg='rgba(34,197,94,.14)'; }
    if(kind === 'bad')  { border='rgba(239,68,68,.35)'; bg='rgba(239,68,68,.14)'; }
    if(kind === 'warn') { border='rgba(245,158,11,.38)'; bg='rgba(245,158,11,.14)'; }
    if(kind === 'boss') { border='rgba(239,68,68,.42)'; bg='rgba(2,6,23,.72)'; }
    if(kind === 'storm'){ border='rgba(34,211,238,.42)'; bg='rgba(2,6,23,.72)'; }
    if(kind === 'rage') { border='rgba(239,68,68,.55)'; bg='rgba(2,6,23,.78)'; }

    el.textContent = t;
    el.style.borderColor = border;
    el.style.background = bg;

    bannerT = now();
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, -6px) scale(.98)';
    requestAnimationFrame(()=>{
      el.style.transition = 'opacity 140ms ease, transform 140ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%, 0) scale(1)';
    });

    setTimeout(()=>{
      // only hide if not replaced by newer banner
      const age = now() - bannerT;
      if(age < (ms - 60)) return;
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -10px) scale(.98)';
    }, ms);
  }

  // vignette flash
  let vignetteEl = null;
  function ensureVignette(){
    if(vignetteEl) return vignetteEl;
    const ov = ensureOverlay();
    vignetteEl = DOC.createElement('div');
    vignetteEl.id = 'hhaVignette';
    vignetteEl.style.cssText = `
      position:absolute; inset:0;
      background: radial-gradient(circle at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.35) 92%);
      opacity: 0;
      transition: opacity 140ms ease;
      will-change: opacity;
    `;
    ov.appendChild(vignetteEl);
    return vignetteEl;
  }
  function vignette(ms=180, strength=0.55){
    const el = ensureVignette();
    el.style.transition = 'none';
    el.style.opacity = String(clamp(strength, 0.08, 0.85));
    requestAnimationFrame(()=>{
      el.style.transition = 'opacity 160ms ease';
      setTimeout(()=>{ el.style.opacity='0'; }, ms);
    });
  }

  // screen shake (light)
  let shakeUntil = 0;
  function shake(ms=160, px=1.6){
    const t = now();
    shakeUntil = Math.max(shakeUntil, t + clamp(ms, 60, 420));
    const amp = clamp(px, 0.8, 3.2);

    function step(){
      const tt = now();
      if(tt >= shakeUntil){
        DOC.body.style.transform = '';
        return;
      }
      const dx = (Math.random()*2-1) * amp;
      const dy = (Math.random()*2-1) * amp;
      DOC.body.style.transform = `translate3d(${dx}px,${dy}px,0)`;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // body class pulse
  function pulseClass(cls, ms=200){
    safe(()=>{
      DOC.body.classList.add(cls);
      setTimeout(()=> DOC.body.classList.remove(cls), ms);
    });
  }

  // phase state classes (global + per game like gj-*)
  function setPhase(phase){
    const p = String(phase||'').toLowerCase();
    const b = DOC.body;

    // global remove
    b.classList.remove('hha-storm','hha-boss','hha-rage');
    // goodjunk remove
    b.classList.remove('gj-storm','gj-boss','gj-rage');

    if(p === 'storm'){
      b.classList.add('hha-storm','gj-storm');
      banner('⚡ STORM!', { kind:'storm', ms: 1100 });
      vignette(220, 0.45);
    }else if(p === 'boss'){
      b.classList.add('hha-boss','gj-boss');
      banner('👹 BOSS!', { kind:'boss', ms: 1200 });
      vignette(260, 0.55);
      shake(180, 1.9);
    }else if(p === 'rage'){
      b.classList.add('hha-rage','gj-rage');
      banner('🔥 RAGE!!', { kind:'rage', ms: 1400 });
      vignette(300, 0.68);
      shake(240, 2.4);
    }
  }

  // ---------------- rate limit ----------------
  const RL = {
    judge: 0,
    celebrate: 0,
    coach: 0,
  };
  function ok(key, gapMs){
    const t = now();
    const last = RL[key] || 0;
    if(t - last < gapMs) return false;
    RL[key] = t;
    return true;
  }

  // ---------------- event handlers ----------------
  function onJudge(ev){
    const d = ev?.detail || {};
    const label = String(d.label || '').trim();
    if(!label) return;

    // rate limit
    if(!ok('judge', 80)) return;

    // position hint (center-ish)
    const W = DOC.documentElement.clientWidth || 360;
    const H = DOC.documentElement.clientHeight || 640;
    const x = (d.x != null) ? Number(d.x) : Math.round(W*0.5);
    const y = (d.y != null) ? Number(d.y) : Math.round(H*0.52);

    const L = label.toLowerCase();

    // GOOD
    if(L.includes('good') || L.includes('perfect') || L.includes('great') || L.includes('nice')){
      burst(x,y,'good');
      pop(x,y, label);
      pulseClass('hha-good', 160);
      return;
    }

    // MINI / GOAL
    if(L.includes('mini') || L.includes('goal') || L.includes('pass')){
      burst(x,y,'star');
      pop(x,y, label);
      pulseClass('hha-win', 220);
      vignette(180, 0.35);
      return;
    }

    // BLOCK
    if(L.includes('block') || L.includes('shield')){
      burst(x,y,'block');
      pop(x,y, label);
      pulseClass('hha-block', 160);
      return;
    }

    // BAD / MISS
    if(L.includes('oops') || L.includes('miss') || L.includes('bad') || L.includes('fail')){
      burst(x,y,'bad');
      pop(x,y, label);
      pulseClass('hha-bad', 200);
      vignette(220, 0.55);
      shake(140, 1.7);
      return;
    }

    // default
    pop(x,y,label);
  }

  function onCelebrate(ev){
    const d = ev?.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    const grade = String(d.grade||'').toUpperCase();

    if(!ok('celebrate', 160)) return;

    if(kind === 'end'){
      const msg =
        (grade === 'S') ? '🏆 S RANK!' :
        (grade === 'A') ? '✨ A RANK!' :
        (grade === 'B') ? '💪 B RANK!' :
        (grade === 'C') ? '🙂 C RANK!' : '🧩 KEEP TRYING!';
      banner(msg, { kind:'good', ms: 1400 });
      vignette(260, 0.45);
      return;
    }

    if(kind === 'mini'){
      banner('✅ MINI CLEAR!', { kind:'good', ms: 980 });
      vignette(200, 0.35);
      return;
    }

    banner('🎉 NICE!', { kind:'good', ms: 900 });
  }

  function onPhase(ev){
    const d = ev?.detail || {};
    const phase = d.phase || d.state || d.kind || d.name;
    if(!phase) return;
    setPhase(phase);
  }

  function onCoach(ev){
    const d = ev?.detail || {};
    const msg = String(d.msg || '').trim();
    if(!msg) return;

    if(!ok('coach', 1200)) return; // coach rate-limit hard
    banner('💡 ' + msg, { kind:'warn', ms: 1700 });
  }

  // ---------------- styles for global body pulses ----------------
  const st = DOC.createElement('style');
  st.textContent = `
    body.hha-good{ filter: brightness(1.05) saturate(1.03); }
    body.hha-win { filter: brightness(1.08) saturate(1.06); }
    body.hha-block{ filter: brightness(1.02) saturate(1.02); }
    body.hha-bad { filter: contrast(1.04) saturate(1.08); }

    /* Global phase ambience (if a game has no game-specific css) */
    body.hha-storm{ box-shadow: inset 0 0 0 9999px rgba(34,211,238,.035); }
    body.hha-boss { box-shadow: inset 0 0 0 9999px rgba(239,68,68,.040); }
    body.hha-rage { box-shadow: inset 0 0 0 9999px rgba(239,68,68,.075); }
  `;
  DOC.head.appendChild(st);

  // ---------------- bind listeners ----------------
  WIN.addEventListener('hha:judge', onJudge, { passive:true });
  WIN.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  WIN.addEventListener('hha:phase', onPhase, { passive:true });
  WIN.addEventListener('hha:coach', onCoach, { passive:true });

  // also listen on document (some games dispatch there)
  DOC.addEventListener('hha:judge', onJudge, { passive:true });
  DOC.addEventListener('hha:celebrate', onCelebrate, { passive:true });
  DOC.addEventListener('hha:phase', onPhase, { passive:true });
  DOC.addEventListener('hha:coach', onCoach, { passive:true });

  // expose helper for debug
  WIN.HHA_FX = WIN.HHA_FX || {};
  WIN.HHA_FX.setPhase = setPhase;
  WIN.HHA_FX.banner = banner;

})();