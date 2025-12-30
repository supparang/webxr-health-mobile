// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (DUAL-EYE READY) — v2 Hardened
// ✅ starts from Start button OR OK (vrHint) OR Shoot/Stage click (failsafe)
// ✅ touch-look is OPTIONAL (dynamic import). If missing, game still runs.
// ✅ on-screen debug (hudMeta) shows boot status.

'use strict';

function qp(name, fallback=null){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(name);
    return (v == null || v === '') ? fallback : v;
  }catch(_){ return fallback; }
}
function toInt(v, d){ v = Number(v); return Number.isFinite(v) ? (v|0) : d; }
function toStr(v, d){ v = String(v ?? '').trim(); return v ? v : d; }

function isMobileLike(){
  const w = window.innerWidth || 360;
  const h = window.innerHeight || 640;
  const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function setHudMeta(text){
  const el = document.getElementById('hudMeta');
  if (el) el.textContent = text;
}
function logMeta(step, extra=''){
  setHudMeta(`[BOOT] ${step}${extra ? ' • ' + extra : ''}`);
  try{ console.log('[GoodJunkBOOT]', step, extra||''); }catch(_){}
}

function hardFail(msg, err){
  console.error('[GoodJunkBOOT] FAIL:', msg, err || '');
  setHudMeta(`❌ ${msg}`);
  // also show startOverlay with message if exists
  const overlay = document.getElementById('startOverlay');
  const meta = document.getElementById('startMeta');
  if (overlay){
    overlay.style.display = 'flex';
    if (meta) meta.textContent = `ERROR: ${msg}`;
  }
}

function setView(mode){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${mode}`);

  const eyeR = document.getElementById('eyeR');
  if (eyeR){
    eyeR.setAttribute('aria-hidden', (mode === 'pc' || mode === 'mobile') ? 'true' : 'false');
  }
}

function wireViewButtons(begin){
  const btnPC = document.getElementById('btnViewPC');
  const btnM  = document.getElementById('btnViewMobile');
  const btnVR = document.getElementById('btnViewVR');
  const btnCVR= document.getElementById('btnViewCVR');
  const btnFS = document.getElementById('btnEnterFS');
  const btnEnterVR = document.getElementById('btnEnterVR');

  const applyMode = async (m) => {
    setView(m);
    if (m === 'vr' || m === 'cvr') await showVrHintIfNeeded(begin);
  };

  if (btnPC) btnPC.onclick = ()=> applyMode('pc');
  if (btnM)  btnM.onclick  = ()=> applyMode('mobile');
  if (btnVR) btnVR.onclick = ()=> applyMode('vr');
  if (btnCVR)btnCVR.onclick= ()=> applyMode('cvr');

  if (btnFS){
    btnFS.onclick = async ()=>{
      try{
        const el = document.documentElement;
        if (!document.fullscreenElement){
          await el.requestFullscreen?.();
        }
      }catch(_){}
    };
  }

  if (btnEnterVR){
    btnEnterVR.onclick = async ()=>{
      const m = isMobileLike() ? 'cvr' : 'vr';
      await applyMode(m);
      try{
        const el = document.documentElement;
        if (!document.fullscreenElement){
          await el.requestFullscreen?.();
        }
      }catch(_){}
      // ✅ failsafe: entering VR usually implies "start"
      begin?.('enter_vr');
    };
  }
}

function showStartOverlay(metaText, begin){
  const overlay = document.getElementById('startOverlay');
  const btn = document.getElementById('btnStart');
  const meta = document.getElementById('startMeta');
  if (meta) meta.textContent = metaText || '—';

  if (!overlay || !btn){
    // no overlay => autostart
    begin?.('no_start_overlay');
    return;
  }

  overlay.style.display = 'flex';
  btn.onclick = () => {
    overlay.style.display = 'none';
    begin?.('btn_start');
  };
}

function showVrHintIfNeeded(begin){
  const hint = document.getElementById('vrHint');
  const ok = document.getElementById('btnVrOk');
  if (!hint || !ok) return Promise.resolve();

  const portrait = (window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
  if (!(portrait && isMobileLike())) return Promise.resolve();

  hint.hidden = false;
  return new Promise((resolve) => {
    ok.onclick = () => {
      hint.hidden = true;
      // ✅ IMPORTANT: user said "กด OK แล้วเกมไม่เริ่ม"
      // so OK now ALSO triggers begin (failsafe)
      begin?.('vr_ok');
      resolve();
    };
  });
}

function buildContext(){
  const keys = [
    'projectTag','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode',
    'schoolYear','semester','studentKey','schoolCode','schoolName','classRoom','studentNo',
    'nickName','gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
    'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent',
    'gameVersion'
  ];
  const ctx = {};
  for (const k of keys){
    const v = qp(k, null);
    if (v != null) ctx[k] = v;
  }
  ctx.projectTag = ctx.projectTag || 'GoodJunkVR';
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-30.hardened';
  return ctx;
}

async function dynamicTouchLookBind(stageEl, layerEls, hazardEls){
  try{
    const mod = await import('./touch-look-goodjunk.js');
    if (!mod || typeof mod.attachTouchLook !== 'function') return null;
    const api = mod.attachTouchLook({
      stageEl,
      layerEls,
      hazardEls,
      maxShiftPx: 170,
      ease: 0.12
    });
    try{ await api?.enableGyro?.(); }catch(_){}
    return api;
  }catch(err){
    // optional: do not fail boot
    console.warn('[GoodJunkBOOT] touch-look optional import failed:', err);
    return null;
  }
}

(async function main(){
  try{
    logMeta('loading');

    const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
    const time = toInt(qp('time', '80'), 80);
    const run  = toStr(qp('run', 'play'), 'play').toLowerCase();
    const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
    const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

    const seed = qp('seed', null);
    const sessionId = qp('sessionId', null) || qp('sid', null);
    const ctx = buildContext();

    // view
    const initial = qp('view', null);
    if (initial === 'vr' || initial === 'cvr' || initial === 'pc' || initial === 'mobile'){
      setView(initial);
    } else {
      setView(isMobileLike() ? 'mobile' : 'pc');
    }

    // --- elements (dual-eye aware) ---
    const stageEl = document.getElementById('gj-stage');
    const layerL  = document.getElementById('gj-layer-l') || document.getElementById('gj-layer') || document.querySelector('.gj-layer');
    const layerR  = document.getElementById('gj-layer-r') || null;

    const crossL  = document.getElementById('gj-crosshair-l') || document.getElementById('gj-crosshair') || document.querySelector('.gj-crosshair');
    const crossR  = document.getElementById('gj-crosshair-r') || null;

    const ringL   = document.getElementById('atk-ring-l') || document.getElementById('atk-ring') || document.querySelector('.atk-ring');
    const ringR   = document.getElementById('atk-ring-r') || null;
    const laserL  = document.getElementById('atk-laser-l') || document.getElementById('atk-laser') || document.querySelector('.atk-laser');
    const laserR  = document.getElementById('atk-laser-r') || null;

    const shootEl = document.getElementById('btnShoot');

    if (!stageEl) return hardFail('missing #gj-stage');
    if (!layerL)  return hardFail('missing targets layer (gj-layer-l / gj-layer)');
    if (!crossL && !crossR) console.warn('[GoodJunkBOOT] crosshair not found (will fallback to center).');

    // import SAFE (required)
    logMeta('import safe');
    let safeMod = null;
    try{
      safeMod = await import('./goodjunk.safe.js');
    }catch(err){
      return hardFail('cannot import ./goodjunk.safe.js (path or syntax error)', err);
    }
    if (!safeMod || typeof safeMod.boot !== 'function'){
      return hardFail('goodjunk.safe.js has no exported boot()');
    }

    let started = false;
    const begin = async (why) => {
      if (started) return;
      started = true;
      logMeta('starting', why || '');

      // optional touch-look
      await dynamicTouchLookBind(stageEl, [layerL, layerR].filter(Boolean), [ringL, ringR, laserL, laserR].filter(Boolean));

      // start SAFE engine
      safeMod.boot({
        diff, time, run, endPolicy, challenge,
        seed, sessionId,
        context: ctx,

        layerEl: layerL,
        layerElR: layerR,
        crosshairEl: crossL,
        crosshairElR: crossR,
        ringEl: ringL,
        ringElR: ringR,
        laserEl: laserL,
        laserElR: laserR,
        shootEl,

        safeMargins: { top: 128, bottom: 170, left: 18, right: 18 }
      });

      logMeta('running', `dual=${!!layerR}`);
    };

    // buttons (view + vr)
    wireViewButtons(begin);

    // ✅ failsafe: any interaction can start
    if (shootEl){
      shootEl.addEventListener('pointerdown', ()=> begin('shoot_button'), { passive:true });
    }
    stageEl.addEventListener('pointerdown', ()=> begin('stage_touch'), { passive:true });

    const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}` + (seed ? ` • seed=${seed}` : '');
    showStartOverlay(metaText, begin);

    // if already in VR/cVR -> hint; OK will also start
    if (document.body.classList.contains('view-vr') || document.body.classList.contains('view-cvr')){
      await showVrHintIfNeeded(begin);
    }

    logMeta('ready', 'press Start/OK');
  }catch(err){
    hardFail('boot crashed (check console)', err);
  }
})();