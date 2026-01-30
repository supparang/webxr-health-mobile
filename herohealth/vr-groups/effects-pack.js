// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — PRODUCTION
// ✅ Integrates Particles (DOM FX) if present
// ✅ Screen flash + shake (lightweight, throttled)
// ✅ Hooks common events: hha:score / hha:rank / groups:progress / quest:update / hha:end
// ✅ Optional API:
//    - window.GroupsVR.EffectsPack.setSafeRect(rect)
//    - window.GroupsVR.EffectsPack.pop(text, tone, x?, y?)
// Notes: Safe on low-end devices; auto-degrades if fps/telemetry requests.
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  const FX = WIN.GroupsVR.EffectsPack = WIN.GroupsVR.EffectsPack || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch{ return Date.now(); } };

  // ---------------- Safe rect from ViewHelper ----------------
  let SAFE = null; // {x,y,w,h,...}
  FX.setSafeRect = function setSafeRect(r){
    if (!r) return;
    SAFE = r;
  };

  // ---------------- Layer / flash / shake ----------------
  let layer = null;
  let flashEl = null;
  let shakeOn = false;
  let lastShakeAt = 0;
  let lastFlashAt = 0;
  let lastPopAt = 0;

  function ensureLayer(){
    if (layer) return layer;
    layer = DOC.createElement('div');
    layer.id = 'groupsFxLayer';
    layer.style.position = 'fixed';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '9998';
    layer.style.overflow = 'hidden';
    DOC.body.appendChild(layer);

    flashEl = DOC.createElement('div');
    flashEl.id = 'groupsFxFlash';
    flashEl.style.position = 'fixed';
    flashEl.style.inset = '0';
    flashEl.style.pointerEvents = 'none';
    flashEl.style.zIndex = '9999';
    flashEl.style.opacity = '0';
    flashEl.style.transition = 'opacity 120ms ease';
    flashEl.style.background = 'rgba(255,255,255,.14)';
    DOC.body.appendChild(flashEl);

    // shake via body class
    const st = DOC.createElement('style');
    st.textContent = `
      @keyframes hhaShake { 0%{transform:translate(0,0)} 20%{transform:translate(-2px,1px)} 40%{transform:translate(2px,-1px)} 60%{transform:translate(-1px,-2px)} 80%{transform:translate(1px,2px)} 100%{transform:translate(0,0)} }
      body.hha-shake { animation: hhaShake 180ms linear; }
      .fx-pop{
        position:absolute; left:0; top:0;
        transform: translate(-50%,-50%);
        padding:8px 10px;
        border-radius:999px;
        font-weight:1000;
        font-size:13px;
        letter-spacing:.2px;
        color:#fff;
        background: rgba(2,6,23,.75);
        border:1px solid rgba(148,163,184,.22);
        box-shadow: 0 10px 26px rgba(0,0,0,.25);
        backdrop-filter: blur(8px);
        will-change: transform, opacity;
        opacity:0;
        transition: transform 260ms ease, opacity 260ms ease;
        white-space:nowrap;
      }
      .fx-pop.show{ opacity:1; transform: translate(-50%,-65%); }
      .fx-pop.good{ border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.18); }
      .fx-pop.warn{ border-color: rgba(245,158,11,.35); background: rgba(245,158,11,.16); }
      .fx-pop.bad { border-color: rgba(239,68,68,.40); background: rgba(239,68,68,.18); }
      .fx-pop.neutral{ border-color: rgba(34,211,238,.28); background: rgba(34,211,238,.10); }
    `;
    DOC.head.appendChild(st);
    return layer;
  }

  function flash(intensity=0.14){
    const t = nowMs();
    if (t - lastFlashAt < 110) return;
    lastFlashAt = t;
    ensureLayer();
    if (!flashEl) return;
    flashEl.style.background = `rgba(255,255,255,${clamp(intensity,0.06,0.28)})`;
    flashEl.style.opacity = '1';
    setTimeout(()=>{ if (flashEl) flashEl.style.opacity = '0'; }, 70);
  }

  function shake(){
    const t = nowMs();
    if (t - lastShakeAt < 180) return;
    lastShakeAt = t;
    if (shakeOn) return;
    shakeOn = true;
    try{
      DOC.body.classList.add('hha-shake');
      setTimeout(()=>{
        DOC.body.classList.remove('hha-shake');
        shakeOn = false;
      }, 210);
    }catch(_){ shakeOn = false; }
  }

  function randInSafe(){
    const vw = WIN.innerWidth || 360;
    const vh = WIN.innerHeight || 640;
    const r = SAFE || { x: 24, y: 120, w: vw-48, h: vh-280 };
    const x = r.x + Math.random()*Math.max(40, r.w);
    const y = r.y + Math.random()*Math.max(60, r.h);
    return { x, y };
  }

  function popDom(text, tone='neutral', x=null, y=null){
    const t = nowMs();
    if (t - lastPopAt < 90) return;
    lastPopAt = t;

    ensureLayer();
    const p = DOC.createElement('div');
    p.className = `fx-pop ${tone||'neutral'}`;
    p.textContent = String(text||'');
    const pos = (x==null || y==null) ? randInSafe() : { x, y };
    p.style.left = (pos.x|0) + 'px';
    p.style.top  = (pos.y|0) + 'px';
    layer.appendChild(p);
    requestAnimationFrame(()=> p.classList.add('show'));
    setTimeout(()=>{
      try{ p.style.opacity = '0'; p.style.transform = 'translate(-50%,-90%)'; }catch(_){}
      setTimeout(()=>{ try{ p.remove(); }catch(_){ } }, 240);
    }, 520);
  }

  // ---------------- Particles bridge ----------------
  function popParticles(text, tone='neutral', x=null, y=null){
    const P = WIN.Particles;
    if (!P || !P.popText) return false;
    const pos = (x==null || y==null) ? randInSafe() : { x, y };
    const cls =
      (tone==='good') ? 'hha-good' :
      (tone==='warn') ? 'hha-warn' :
      (tone==='bad')  ? 'hha-bad'  :
                        'hha-neutral';
    try{
      P.popText(pos.x, pos.y, String(text||''), cls);
      return true;
    }catch(_){ return false; }
  }

  FX.pop = function pop(text, tone='neutral', x=null, y=null){
    // prefer Particles if present, fallback to DOM pop
    if (!popParticles(text, tone, x, y)) popDom(text, tone, x, y);
  };

  // ---------------- Behavior toggles ----------------
  let mode = 'full'; // full | lite | off
  FX.setMode = function setMode(m){
    mode = String(m||'full');
  };

  // If telemetry tells us to downgrade, follow it
  WIN.addEventListener('groups:telemetry_auto', (ev)=>{
    const d = ev.detail || {};
    if (d.kind !== 'switch') return;
    if (d.to === 'lite') mode = 'lite';
    if (d.to === 'off')  mode = 'off';
  }, { passive:true });

  // ---------------- Event hooks ----------------
  let lastScore = 0;
  let lastCombo = 0;
  let lastMiss  = 0;
  let lastGrade = 'C';
  let lastAcc   = 0;

  // Score updates -> small pops on milestones
  WIN.addEventListener('hha:score', (ev)=>{
    if (mode === 'off') return;
    const d = ev.detail || {};
    const score = Number(d.score ?? lastScore) || 0;
    const combo = Number(d.combo ?? lastCombo) || 0;
    const miss  = Number(d.misses ?? lastMiss) || 0;

    // combo streak
    if (combo > lastCombo){
      if (mode === 'full'){
        if (combo === 3) FX.pop('🔥 COMBO x3!', 'good');
        else if (combo === 6) FX.pop('⚡ COMBO x6!', 'good');
        else if (combo === 10) FX.pop('💥 COMBO x10!', 'good');
      } else {
        if (combo === 6) FX.pop('⚡ COMBO x6!', 'good');
      }
    }

    // miss spike
    if (miss > lastMiss){
      if (mode === 'full') { FX.pop('❌ พลาด!', 'bad'); shake(); }
      else { FX.pop('❌', 'bad'); }
    }

    // score milestones
    if (score >= lastScore + 100 && mode === 'full'){
      FX.pop('⭐ +100', 'neutral');
    }

    lastScore = score; lastCombo = combo; lastMiss = miss;
  }, { passive:true });

  // Rank/accuracy feedback
  WIN.addEventListener('hha:rank', (ev)=>{
    if (mode === 'off') return;
    const d = ev.detail || {};
    const grade = String(d.grade ?? lastGrade);
    const acc   = Number(d.accuracy ?? lastAcc) || 0;

    if (grade !== lastGrade){
      if (grade === 'S' || grade === 'A'){
        FX.pop('🏅 RANK UP! ' + grade, 'good');
        if (mode === 'full') flash(0.18);
      } else if (grade === 'D'){
        FX.pop('⚠️ โดนลดแรงค์', 'warn');
      }
    } else {
      if (mode === 'full' && acc >= 85 && lastAcc < 85){
        FX.pop('🎯 แม่นมาก!', 'good');
      }
    }

    lastGrade = grade; lastAcc = acc;
  }, { passive:true });

  // Quest updates (mini urgent)
  WIN.addEventListener('quest:update', (ev)=>{
    if (mode !== 'full') return;
    const d = ev.detail || {};
    const left = Number(d.miniTimeLeftSec||0);
    if (left === 3) FX.pop('⏱️ เหลือ 3 วิ!', 'warn');
    if (left === 1) FX.pop('⏱️ 1 วิ!', 'warn');
  }, { passive:true });

  // Progress events from engine (storm/boss/switch)
  WIN.addEventListener('groups:progress', (ev)=>{
    if (mode === 'off') return;
    const d = ev.detail || {};
    const k = String(d.kind||'');

    if (k === 'storm_on'){
      FX.pop('🌪️ STORM!', 'warn');
      if (mode === 'full'){ flash(0.16); }
      return;
    }
    if (k === 'storm_off'){
      FX.pop('✨ พายุจบ!', 'good');
      return;
    }
    if (k === 'boss_spawn'){
      FX.pop('👊 BOSS!', 'warn');
      if (mode === 'full'){ shake(); flash(0.20); }
      return;
    }
    if (k === 'boss_down'){
      FX.pop('💥 BOSS แตก!', 'good');
      if (mode === 'full'){ flash(0.22); }
      return;
    }
    if (k === 'perfect_switch'){
      FX.pop('🔄 สลับหมู่!', 'neutral');
      return;
    }
  }, { passive:true });

  // End
  WIN.addEventListener('hha:end', (ev)=>{
    if (mode === 'off') return;
    const d = ev.detail || {};
    const grade = String(d.grade || 'C');
    const score = Number(d.scoreFinal ?? 0) || 0;

    if (mode === 'full'){
      if (grade === 'S') { FX.pop('🏆 สุดยอด! S', 'good'); flash(0.22); }
      else if (grade === 'A') { FX.pop('🥇 เก่งมาก! A', 'good'); flash(0.18); }
      else if (grade === 'B') FX.pop('👍 ดีมาก! B', 'neutral');
      else FX.pop('😤 ลองใหม่ได้!', 'warn');
    } else {
      FX.pop('🏁 ' + grade + ' • ' + score, (grade==='S'||grade==='A')?'good':'neutral');
    }
  }, { passive:true });

  // expose a tiny helper for debugging
  FX._debug = function(){
    return { mode, safe: SAFE };
  };

  // ensure layer after first user interaction (mobile autoplay policies)
  const kick = ()=>{ ensureLayer(); WIN.removeEventListener('pointerdown', kick); };
  WIN.addEventListener('pointerdown', kick, { once:true, passive:true });

})();