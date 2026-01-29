// === /herohealth/vr-groups/effects-pack.js ===
// Effects Pack — PRODUCTION
// ✅ Hooks to HHA events -> Particles FX + micro feedback
// ✅ Safe on low-end (throttle + caps)
// ✅ Works even if Particles not loaded (no-throw)
// Events listened:
//  - hha:score, hha:rank, quest:update, groups:progress, hha:end
//
// Notes:
// - Requires ../vr/particles.js (optional, best-effort)
// - Uses viewport pixel positions (HUD anchors) for FX

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.EffectsPack && WIN.GroupsVR.EffectsPack.__loaded) return;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  const CFG = {
    // global throttles
    minGapMs: 90,
    textGapMs: 120,
    burstGapMs: 220,
    // intensity caps
    maxBurstPerSec: 6,
    // HUD anchors
    anchorScore: '#vScore',
    anchorCombo: '#vCombo',
    anchorMiss:  '#vMiss',
    anchorGoal:  '#goalTitle',
    anchorMini:  '#miniTitle',
    anchorBanner:'#bigBanner'
  };

  const STATE = {
    lastFxAt: 0,
    lastTextAt: 0,
    lastBurstAt: 0,
    burstCountWinStart: 0,
    burstCount: 0,
    lastScore: 0,
    lastCombo: 0,
    lastMiss: 0,
    lastAcc: 0,
    lastGrade: 'C',
    lastQuestKey: '',
    miniUrg: false,
    storm: false
  };

  function hasParticles(){
    return !!(WIN.Particles && (WIN.Particles.popText || WIN.Particles.pop));
  }

  function canFx(){
    const t = nowMs();
    if (t - STATE.lastFxAt < CFG.minGapMs) return false;
    STATE.lastFxAt = t;
    return true;
  }

  function canText(){
    const t = nowMs();
    if (t - STATE.lastTextAt < CFG.textGapMs) return false;
    STATE.lastTextAt = t;
    return true;
  }

  function canBurst(){
    const t = nowMs();
    if (!STATE.burstCountWinStart || (t - STATE.burstCountWinStart) > 1000){
      STATE.burstCountWinStart = t;
      STATE.burstCount = 0;
    }
    if (STATE.burstCount >= CFG.maxBurstPerSec) return false;
    if (t - STATE.lastBurstAt < CFG.burstGapMs) return false;
    STATE.lastBurstAt = t;
    STATE.burstCount++;
    return true;
  }

  function rectCenter(sel, fallback){
    try{
      const el = DOC.querySelector(sel);
      if (!el) return fallback;
      const r = el.getBoundingClientRect();
      if (!r || !r.width || !r.height) return fallback;
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }catch(_){
      return fallback;
    }
  }

  function screenCenter(){
    const w = Math.max(1, WIN.innerWidth||1);
    const h = Math.max(1, WIN.innerHeight||1);
    return { x: w/2, y: h/2 };
  }

  function popTextAt(sel, text, cls){
    if (!hasParticles()) return;
    if (!canText()) return;
    const p = rectCenter(sel, screenCenter());
    try{
      if (WIN.Particles.popText) WIN.Particles.popText(p.x, p.y, String(text||''), cls);
      else if (WIN.Particles.pop) WIN.Particles.pop(p.x, p.y, String(text||''));
    }catch(_){}
  }

  function burstAt(sel, opts){
    if (!WIN.Particles || !WIN.Particles.burst) return;
    if (!canBurst()) return;
    const p = rectCenter(sel, screenCenter());
    try{ WIN.Particles.burst(p.x, p.y, opts||{}); }catch(_){}
  }

  function shake(el, ms=140){
    try{
      if (!el) return;
      const dur = clamp(ms, 80, 280);
      el.classList.add('fx-shake');
      setTimeout(()=>{ try{ el.classList.remove('fx-shake'); }catch(_){} }, dur);
    }catch(_){}
  }

  function flash(cls, ms=120){
    // creates/uses a lightweight full-screen flash layer
    try{
      let el = DOC.getElementById('fxFlash');
      if (!el){
        el = DOC.createElement('div');
        el.id = 'fxFlash';
        el.style.position = 'fixed';
        el.style.inset = '0';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '9999';
        el.style.opacity = '0';
        el.style.transition = 'opacity 120ms ease';
        DOC.body.appendChild(el);
      }
      el.className = 'fx-flash ' + String(cls||'');
      el.style.opacity = '1';
      setTimeout(()=>{ el.style.opacity = '0'; }, clamp(ms, 80, 240));
    }catch(_){}
  }

  function ensureCss(){
    // inject minimal CSS once
    if (DOC.getElementById('effectsPackCss')) return;
    const st = DOC.createElement('style');
    st.id = 'effectsPackCss';
    st.textContent = `
      .fx-shake{ animation: hhaShake 140ms ease-in-out 1; }
      @keyframes hhaShake{
        0%{ transform: translate3d(0,0,0) }
        25%{ transform: translate3d(-2px,0,0) }
        50%{ transform: translate3d(2px,0,0) }
        75%{ transform: translate3d(-1px,0,0) }
        100%{ transform: translate3d(0,0,0) }
      }
      #fxFlash.fx-flash.good{ background: rgba(34,197,94,.14); }
      #fxFlash.fx-flash.warn{ background: rgba(245,158,11,.16); }
      #fxFlash.fx-flash.bad { background: rgba(239,68,68,.16); }
      #fxFlash.fx-flash.neu { background: rgba(148,163,184,.12); }
    `;
    DOC.head.appendChild(st);
  }

  ensureCss();

  // ------------------------------------------
  // Hook events
  // ------------------------------------------

  // score updates -> hit/miss feedback
  WIN.addEventListener('hha:score', (ev)=>{
    if (!canFx()) return;
    const d = ev.detail || {};
    const score = Number(d.score ?? STATE.lastScore) || 0;
    const combo = Number(d.combo ?? STATE.lastCombo) || 0;
    const miss  = Number(d.misses ?? STATE.lastMiss) || 0;

    const dScore = score - (STATE.lastScore|0);
    const dCombo = combo - (STATE.lastCombo|0);
    const dMiss  = miss  - (STATE.lastMiss|0);

    STATE.lastScore = score|0;
    STATE.lastCombo = combo|0;
    STATE.lastMiss  = miss|0;

    // MISS bump
    if (dMiss > 0){
      popTextAt(CFG.anchorMiss, `MISS +${dMiss}`, 'bad');
      burstAt(CFG.anchorMiss, { n: 10, spread: 28, life: 520, cls:'bad' });
      flash('bad', 110);
      return;
    }

    // HIT / score gain
    if (dScore > 0){
      popTextAt(CFG.anchorScore, `+${dScore}`, 'good');
      if (dCombo > 0 && combo >= 3){
        popTextAt(CFG.anchorCombo, `COMBO ${combo}`, 'warn');
        burstAt(CFG.anchorCombo, { n: 12, spread: 34, life: 560, cls:'warn' });
      }else{
        burstAt(CFG.anchorScore, { n: 8, spread: 26, life: 480, cls:'good' });
      }
      return;
    }
  }, { passive:true });

  // rank updates -> celebratory feedback on grade improvements
  WIN.addEventListener('hha:rank', (ev)=>{
    if (!canFx()) return;
    const d = ev.detail || {};
    const grade = String(d.grade ?? STATE.lastGrade ?? 'C');
    const acc   = Number(d.accuracy ?? STATE.lastAcc) || 0;

    const prevG = String(STATE.lastGrade || 'C');
    const prevA = Number(STATE.lastAcc || 0);

    STATE.lastGrade = grade;
    STATE.lastAcc = acc;

    const improved = (grade !== prevG) || (acc > prevA + 2);

    if (improved){
      popTextAt(CFG.anchorBanner, `RANK ${grade}`, 'good');
      flash('good', 110);
      burstAt(CFG.anchorBanner, { n: 14, spread: 42, life: 640, cls:'good' });
    }
  }, { passive:true });

  // quest updates -> mini urgency & group switches
  WIN.addEventListener('quest:update', (ev)=>{
    if (!canFx()) return;
    const d = ev.detail || {};
    const key = String(d.groupKey || '');
    const name= String(d.groupName || '');
    const miniLeft = Number(d.miniTimeLeftSec || 0);

    const questKey = key ? (key + '|' + name) : '';
    if (questKey && questKey !== STATE.lastQuestKey){
      STATE.lastQuestKey = questKey;
      popTextAt(CFG.anchorGoal, `หมู่: ${name||key}`, 'good');
      burstAt(CFG.anchorGoal, { n: 10, spread: 34, life: 520, cls:'neu' });
    }

    const urgent = (miniLeft > 0 && miniLeft <= 3);
    if (urgent && !STATE.miniUrg){
      STATE.miniUrg = true;
      popTextAt(CFG.anchorMini, `MINI ${miniLeft}s!`, 'warn');
      flash('warn', 110);
      const el = DOC.querySelector('.questTop');
      shake(el, 180);
    }
    if (!urgent && STATE.miniUrg){
      STATE.miniUrg = false;
    }
  }, { passive:true });

  // progress events -> storm/boss etc
  WIN.addEventListener('groups:progress', (ev)=>{
    if (!canFx()) return;
    const d = ev.detail || {};
    const k = String(d.kind || '');

    if (k === 'storm_on'){
      STATE.storm = true;
      popTextAt(CFG.anchorBanner, '🌪️ STORM!', 'warn');
      flash('warn', 120);
      burstAt(CFG.anchorBanner, { n: 16, spread: 52, life: 680, cls:'warn' });
      return;
    }

    if (k === 'storm_off'){
      STATE.storm = false;
      popTextAt(CFG.anchorBanner, '✨ CLEAR!', 'good');
      flash('good', 110);
      burstAt(CFG.anchorBanner, { n: 12, spread: 46, life: 620, cls:'good' });
      return;
    }

    if (k === 'boss_spawn'){
      popTextAt(CFG.anchorBanner, '👊 BOSS!', 'warn');
      flash('warn', 120);
      return;
    }

    if (k === 'boss_down'){
      popTextAt(CFG.anchorBanner, '💥 BOSS DOWN!', 'good');
      flash('good', 120);
      burstAt(CFG.anchorBanner, { n: 18, spread: 58, life: 760, cls:'good' });
      return;
    }

    if (k === 'perfect_switch'){
      popTextAt(CFG.anchorBanner, '🔄 SWITCH!', 'neu');
      burstAt(CFG.anchorBanner, { n: 10, spread: 42, life: 520, cls:'neu' });
      return;
    }
  }, { passive:true });

  // end -> celebrate once
  WIN.addEventListener('hha:end', (ev)=>{
    if (!canFx()) return;
    const d = ev.detail || {};
    const reason = String(d.reason || 'end');
    const grade  = String(d.grade || STATE.lastGrade || 'C');
    popTextAt(CFG.anchorBanner, `🏁 ${reason} • RANK ${grade}`, 'good');
    burstAt(CFG.anchorBanner, { n: 18, spread: 62, life: 860, cls:'good' });
    flash('good', 120);
  }, { passive:true });

  // expose tiny api
  WIN.GroupsVR.EffectsPack = {
    __loaded: true,
    popTextAt,
    burstAt,
    flash
  };

})();