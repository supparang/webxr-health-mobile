// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (HHA Standard)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Auto-detect view (BUT do NOT override if ?view= exists)
// ✅ Sets body classes: view-pc/view-mobile/view-vr/view-cvr
// ✅ Wires topbar buttons (optional fallback if inline missing)
// ✅ Boots engine: import { boot } from './goodjunk.safe.js'
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/ts/log/style
// ✅ Safe against double-boot

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function normView(v){
  v = String(v || '').toLowerCase().trim();
  if (v === 'cardboard') return 'vr';
  if (v === 'vr') return 'vr';
  if (v === 'cvr' || v === 'view-cvr') return 'cvr';
  if (v === 'pc') return 'pc';
  if (v === 'mobile') return 'mobile';
  return 'auto';
}
function isLikelyMobileUA(){
  const ua = (navigator.userAgent || '').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectView(){
  // IMPORTANT: never override explicit ?view=
  if (has('view')) return normView(qs('view', 'auto'));

  // soft remember (optional)
  try{
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if (last) return normView(last);
  }catch(_){}

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // If WebXR immersive-vr supported, consider 'vr' (mostly for mobile cardboard/vr)
  try{
    if (navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if (ok){
        guess = isLikelyMobileUA() ? 'vr' : 'pc';
      }
    }
  }catch(_){}

  return normView(guess);
}

function setBodyViewClass(view){
  const b = DOC.body;
  if (!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function wireTopbarFallback(){
  // If inline handlers exist already, this won’t break—just adds redundancy.
  const hub = qs('hub', null);

  const btnBack = DOC.getElementById('btnBackHub');
  const btnHide = DOC.getElementById('btnHideHud');
  const btnMis  = DOC.getElementById('btnMissions');

  const peek = DOC.getElementById('missionsPeek');
  const peekGoal = DOC.getElementById('peekGoal');
  const peekMini = DOC.getElementById('peekMini');

  function toggleMissions(){
    DOC.body.classList.toggle('show-missions');
    const shown = DOC.body.classList.contains('show-missions');
    if (peek) peek.setAttribute('aria-hidden', shown ? 'false' : 'true');
    if (shown){
      if (peekGoal) peekGoal.textContent = (DOC.getElementById('hud-goal')?.textContent || '—');
      if (peekMini) peekMini.textContent = (DOC.getElementById('hud-mini')?.textContent || '—');
    }
  }

  btnBack?.addEventListener('click', ()=>{
    try{
      if (hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    }catch(_){}
  });

  btnHide?.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
    // HTML inline updateSafe() will update safe vars; if missing, it’s ok
    try{ WIN.dispatchEvent(new Event('resize')); }catch(_){}
  });

  btnMis?.addEventListener('click', toggleMissions);
  peek?.addEventListener('click', toggleMissions);
}

function setChipMeta(view){
  const chipMeta = DOC.getElementById('gjChipMeta');
  if (!chipMeta) return;
  const run  = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  chipMeta.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

function setVrUiConfig(view){
  // optional: tune lockPx per view
  // (vr-ui.js reads window.HHA_VRUI_CONFIG)
  const cfg = { lockPx: 28, cooldownMs: 90 };
  if (view === 'cvr') cfg.lockPx = 30;
  if (view === 'vr')  cfg.lockPx = 30;
  if (view === 'pc')  cfg.lockPx = 26;
  WIN.HHA_VRUI_CONFIG = Object.assign({}, WIN.HHA_VRUI_CONFIG || {}, cfg);
}

function buildPayload(view){
  const payload = {
    // engine config
    view,
    run: qs('run','play'),
    diff: qs('diff','normal'),
    time: Number(qs('time','80') || 80),
    seed: qs('seed', null),

    // ctx passthrough
    hub: qs('hub', null),
    ts: qs('ts', null),
    log: qs('log', null),
    style: qs('style', null),

    // study params
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  // normalize
  payload.run = String(payload.run || 'play').toLowerCase();
  payload.diff = String(payload.diff || 'normal').toLowerCase();
  payload.time = Math.max(20, Math.min(300, Number(payload.time) || 80));
  if (!payload.seed){
    // in research allow deterministic if seed not provided
    if (payload.run === 'research') payload.seed = (payload.ts || 'RESEARCH-SEED');
    else payload.seed = String(Date.now());
  }

  return payload;
}

async function main(){
  if (!DOC || WIN.__GOODJUNK_BOOTED__) return;
  WIN.__GOODJUNK_BOOTED__ = true;

  // wait DOM ready (safe)
  if (DOC.readyState === 'loading'){
    await new Promise(res => DOC.addEventListener('DOMContentLoaded', res, { once:true }));
  }

  const view = await detectView();
  setBodyViewClass(view);
  setVrUiConfig(view);
  setChipMeta(view);

  // remember view only if not explicitly set by URL
  if (!has('view') && view && view !== 'auto'){
    try{ localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}
  }

  wireTopbarFallback();

  // boot engine
  const payload = buildPayload(view);
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR] boot error', err);
    // show minimal error overlay
    try{
      const ov = DOC.createElement('div');
      ov.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        background:rgba(2,6,23,.92); color:#e5e7eb;
        display:flex; align-items:center; justify-content:center;
        padding:24px; font-family:system-ui;
      `;
      ov.innerHTML = `
        <div style="width:min(720px,95vw); border:1px solid rgba(148,163,184,.22);
          border-radius:18px; padding:16px; background:rgba(15,23,42,.65);">
          <div style="font-size:18px; font-weight:1200;">GoodJunkVR เปิดไม่สำเร็จ</div>
          <div style="margin-top:8px; color:rgba(148,163,184,.95); font-weight:900; font-size:12px;">
            ดู console เพื่อรายละเอียด error
          </div>
        </div>
      `;
      DOC.body.appendChild(ov);
    }catch(_){}
  }
}

main();