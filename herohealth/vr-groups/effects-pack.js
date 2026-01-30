// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — UMD (NO ES export) — PRODUCTION
// ✅ Works with <script defer> (non-module)
// ✅ window.GroupsVR.EffectsPack.init({layerEl})
// ✅ Auto-listen: hha:score, quest:update, groups:progress, hha:coach
// ✅ Uses window.Particles if available (../vr/particles.js)
// ✅ Lightweight, mobile-safe, caps + throttles
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};

  // ---------- utils ----------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  // ---------- config ----------
  const CFG = {
    // level: 'full' | 'lite' | 'off'
    level: String(qs('fx','')||'').toLowerCase() || 'full',
    // hard caps
    minGapMs: 90,
    flashGapMs: 240,
    shakeGapMs: 260
  };

  // allow telemetry to downgrade FX too (optional)
  WIN.addEventListener('groups:telemetry_auto', (ev)=>{
    const d = ev.detail||{};
    if (d.kind === 'switch' && (d.to === 'lite' || d.to === 'off')){
      setLevel(d.to);
    }
  }, { passive:true });

  function setLevel(level){
    level = String(level||'full').toLowerCase();
    if (level !== 'full' && level !== 'lite' && level !== 'off') level = 'full';
    CFG.level = level;
    // reflect to banner if available
    try{
      WIN.dispatchEvent(new CustomEvent('groups:fx_level', { detail:{ level } }));
    }catch(_){}
  }

  // ---------- DOM layers ----------
  let wrap = null;
  let flashEl = null;
  let shakeEl = null;
  let layerEl = null;

  function ensureLayers(){
    if (!DOC) return;

    // wrap for shake + flash
    if (!wrap){
      wrap = DOC.createElement('div');
      wrap.id = 'hhaFxWrap';
      wrap.style.cssText =
        'position:fixed; inset:0; pointer-events:none; z-index:9998; ' +
        'contain:layout style paint;';

      // shake root (we apply transform here)
      shakeEl = DOC.createElement('div');
      shakeEl.id = 'hhaShake';
      shakeEl.style.cssText =
        'position:absolute; inset:0; will-change:transform;';

      // flash overlay
      flashEl = DOC.createElement('div');
      flashEl.id = 'hhaFlash';
      flashEl.style.cssText =
        'position:absolute; inset:0; opacity:0; transition:opacity 120ms ease; ' +
        'background: radial-gradient(circle at 50% 45%, rgba(255,255,255,.18), rgba(255,255,255,0) 60%);';

      shakeEl.appendChild(flashEl);
      wrap.appendChild(shakeEl);
      (DOC.body || DOC.documentElement).appendChild(wrap);
    }

    // default effect anchor layer (play layer)
    if (!layerEl){
      layerEl = DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
    }
  }

  function setLayerEl(el){
    layerEl = el || layerEl || DOC.body;
  }

  // ---------- coordinate helper ----------
  function centerOf(el){
    try{
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }catch(_){
      return { x: window.innerWidth/2, y: window.innerHeight/2 };
    }
  }
  function centerScreen(){
    return { x: window.innerWidth/2, y: window.innerHeight/2 };
  }

  // ---------- FX primitives ----------
  let lastPopAt = 0;
  let lastFlashAt = 0;
  let lastShakeAt = 0;

  function canDo(kind){
    const t = nowMs();
    if (CFG.level === 'off') return false;

    if (kind === 'pop'){
      if (t - lastPopAt < CFG.minGapMs) return false;
      lastPopAt = t; return true;
    }
    if (kind === 'flash'){
      if (CFG.level === 'lite') return false;
      if (t - lastFlashAt < CFG.flashGapMs) return false;
      lastFlashAt = t; return true;
    }
    if (kind === 'shake'){
      if (CFG.level !== 'full') return false;
      if (t - lastShakeAt < CFG.shakeGapMs) return false;
      lastShakeAt = t; return true;
    }
    return true;
  }

  function popText(text, x, y, cls){
    if (!canDo('pop')) return;
    if (WIN.Particles && typeof WIN.Particles.popText === 'function'){
      try{ WIN.Particles.popText(x, y, String(text||''), cls||''); return; }catch(_){}
    }
    // fallback minimal bubble
    try{
      const el = DOC.createElement('div');
      el.textContent = String(text||'');
      el.style.cssText =
        `position:fixed; left:${Math.round(x)}px; top:${Math.round(y)}px; transform:translate(-50%,-50%);`+
        `padding:6px 10px; border-radius:999px; font-weight:900; font-size:12px;`+
        `background:rgba(2,6,23,.75); border:1px solid rgba(148,163,184,.25); color:#fff;`+
        `z-index:9999; pointer-events:none; opacity:0; transition:transform 260ms ease, opacity 180ms ease;`;
      (DOC.body||DOC.documentElement).appendChild(el);
      requestAnimationFrame(()=>{
        el.style.opacity = '1';
        el.style.transform = 'translate(-50%,-60%)';
      });
      setTimeout(()=>{
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-90%)';
        setTimeout(()=> el.remove(), 220);
      }, 520);
    }catch(_){}
  }

  function flash(){
    if (!canDo('flash')) return;
    ensureLayers();
    if (!flashEl) return;
    try{
      flashEl.style.opacity = '1';
      setTimeout(()=>{ try{ flashEl.style.opacity = '0'; }catch(_){ } }, 120);
    }catch(_){}
  }

  function shake(){
    if (!canDo('shake')) return;
    ensureLayers();
    if (!shakeEl) return;
    try{
      // tiny shake (safe)
      const dx = (Math.random()*8 - 4);
      const dy = (Math.random()*6 - 3);
      shakeEl.style.transform = `translate(${dx}px, ${dy}px)`;
      setTimeout(()=>{ try{ shakeEl.style.transform = 'translate(0,0)'; }catch(_){ } }, 120);
    }catch(_){}
  }

  // ---------- semantic FX ----------
  function fxHitGood(pos){
    pos = pos || centerScreen();
    popText('✅', pos.x, pos.y, 'good');
    flash();
  }
  function fxHitBad(pos){
    pos = pos || centerScreen();
    popText('❌', pos.x, pos.y, 'bad');
    shake();
  }
  function fxCombo(n){
    if (CFG.level === 'off') return;
    if ((n|0) >= 5){
      const p = centerScreen();
      popText('🔥 COMBO x' + (n|0), p.x, p.y - 70, 'good');
    }
  }
  function fxStorm(on){
    const p = centerScreen();
    popText(on ? '🌪️ STORM!' : '✨ STORM END', p.x, p.y - 90, on ? 'warn' : 'good');
    if (on) shake();
  }
  function fxBoss(kind){
    const p = centerScreen();
    popText(kind === 'spawn' ? '👊 BOSS!' : '💥 BOSS DOWN!', p.x, p.y - 90, kind==='spawn'?'warn':'good');
    if (kind === 'spawn') shake();
    else flash();
  }

  // ---------- auto listeners (จากเกมที่คุณทำไว้แล้ว) ----------
  let prevScore = 0;
  let prevMiss = 0;
  let prevCombo = 0;

  function onScore(ev){
    const d = ev.detail || {};
    const score = Number(d.score ?? prevScore) || 0;
    const miss  = Number(d.misses ?? prevMiss) || 0;
    const combo = Number(d.combo ?? prevCombo) || 0;

    // heuristic: score went up => good hit; miss went up => bad hit
    if (score > prevScore){
      fxHitGood(centerScreen());
    } else if (miss > prevMiss){
      fxHitBad(centerScreen());
    }

    if (combo > prevCombo) fxCombo(combo);

    prevScore = score;
    prevMiss  = miss;
    prevCombo = combo;
  }

  function onQuestUpdate(ev){
    const d = ev.detail||{};
    // group switch banner already in html, here just add tiny pop
    if (d.groupKey && d.groupKey !== WIN.__HHA_LAST_GROUPKEY__){
      WIN.__HHA_LAST_GROUPKEY__ = d.groupKey;
      const p = centerScreen();
      popText('🔄 ' + String(d.groupName||'สลับหมู่'), p.x, p.y - 110, 'neutral');
    }
  }

  function onProgress(ev){
    const d = ev.detail||{};
    const k = String(d.kind||'');
    if (k === 'storm_on') fxStorm(true);
    if (k === 'storm_off') fxStorm(false);
    if (k === 'boss_spawn') fxBoss('spawn');
    if (k === 'boss_down') fxBoss('down');
  }

  // ---------- public API ----------
  function init(opts){
    ensureLayers();
    if (opts && opts.layerEl) setLayerEl(opts.layerEl);

    // attach listeners once
    if (!WIN.__HHA_GROUPS_FX_LISTENERS__){
      WIN.__HHA_GROUPS_FX_LISTENERS__ = true;
      try{
        WIN.addEventListener('hha:score', onScore, { passive:true });
        WIN.addEventListener('quest:update', onQuestUpdate, { passive:true });
        WIN.addEventListener('groups:progress', onProgress, { passive:true });
      }catch(_){}
    }

    // announce ready
    try{ WIN.dispatchEvent(new CustomEvent('groups:fx_ready', { detail:{ level: CFG.level } })); }catch(_){}
    return true;
  }

  WIN.GroupsVR.EffectsPack = {
    init,
    setLayerEl,
    setLevel,
    level: ()=>CFG.level,
    // optional manual triggers
    popText: (text,x,y,cls)=>popText(text,x,y,cls),
    flash,
    shake,
    hitGood: fxHitGood,
    hitBad: fxHitBad,
    storm: fxStorm,
    boss: fxBoss
  };

  // auto-init when DOM ready (safe)
  try{
    if (DOC && (DOC.readyState === 'complete' || DOC.readyState === 'interactive')) init({});
    else DOC.addEventListener('DOMContentLoaded', ()=>init({}), { once:true });
  }catch(_){}

})();