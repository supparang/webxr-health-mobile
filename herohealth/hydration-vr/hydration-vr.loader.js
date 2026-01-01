// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — FIX: prevent instant Summary (time=0 / engine not started)
// ✅ robust query parsing (time/diff/run/seed)
// ✅ start flow: click START -> import engine -> start
// ✅ if import fails -> show error, NOT summary

'use strict';

const DOC = document;

function qs(key, def=null){
  try { return new URL(location.href).searchParams.get(key) ?? def; }
  catch { return def; }
}

function qsNum(key, def){
  const v = qs(key, null);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function clamp(v,min,max){
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function ensureSeed(){
  const s = qs('seed', null);
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  // deterministic-ish per page load (ยังเป็น random แต่คุมได้ถ้าใส่ seed เอง)
  return Date.now();
}

function setText(id, txt){
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(txt);
}

function showDebug(obj){
  const box = DOC.getElementById('debugBox');
  if (!box) return;
  box.style.display = 'block';
  box.textContent = JSON.stringify(obj, null, 2);
}

function showError(err, params){
  console.error(err);
  const retry = DOC.getElementById('btnRetry');
  if (retry) retry.style.display = 'inline-flex';
  showDebug({
    ERROR: String(err?.message || err),
    params
  });
}

function goHub(){
  const hub = qs('hub', null);
  if (hub) location.href = hub;
  else location.href = './hub.html';
}

function safeRunMode(){
  const run = String(qs('run','play')).toLowerCase();
  // คุณใช้ run=play อยู่แล้ว — รองรับ research ด้วย
  if (run === 'research' || run === 'study') return 'research';
  return 'play';
}

function safeDiff(){
  const d = String(qs('diff','normal')).toLowerCase();
  if (d === 'easy' || d === 'normal' || d === 'hard') return d;
  return 'normal';
}

async function startGame(){
  const run = safeRunMode();
  const diff = safeDiff();
  const time = clamp(qsNum('time', 70), 10, 600); // กัน 0/NaN
  const seed = ensureSeed();
  const hub  = qs('hub', null);

  const params = { run, diff, time, seed, hub, href: location.href };
  console.log('[Hydration params]', params);

  // Update pills
  setText('p-run', run);
  setText('p-diff', diff);
  setText('p-time', time);
  setText('p-seed', qs('seed', null) ? seed : 'auto');

  // Hide overlay only when engine really starts
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  if (btnStart) btnStart.disabled = true;

  try{
    // ✅ IMPORTANT PATH: hydration.safe.js should be in same folder
    const mod = await import('./hydration.safe.js');

    // รองรับหลายรูปแบบ export: { boot } หรือ default
    const bootFn =
      (typeof mod.boot === 'function') ? mod.boot :
      (typeof mod.default === 'function') ? mod.default :
      null;

    if (!bootFn){
      throw new Error('hydration.safe.js has no boot() export (expected named boot or default function).');
    }

    // ให้ engine ได้ params ที่จำเป็น
    // NOTE: ถ้าใน hydration.safe.js ของคุณรับ signature ต่างไป
    // ให้บอกผม แล้วผมจะปรับให้ตรงจริง 100%
    bootFn({
      layerId: 'hz-layer',
      runMode: run,
      diff,
      durationPlannedSec: time,
      seed,
      hub,
      summaryMountId: 'hha-summary'
    });

    if (overlay) overlay.style.display = 'none';

  }catch(err){
    if (btnStart) btnStart.disabled = false;
    showError(err, params);
  }
}

function wireUI(){
  const btnStart = DOC.getElementById('btnStart');
  const btnBack  = DOC.getElementById('btnBackHub');
  const btnRetry = DOC.getElementById('btnRetry');

  if (btnStart) btnStart.addEventListener('click', startGame, { passive:true });
  if (btnBack)  btnBack.addEventListener('click', goHub, { passive:true });
  if (btnRetry) btnRetry.addEventListener('click', () => location.reload(), { passive:true });

  // preload pills from query (ก่อนกด start)
  setText('p-run', safeRunMode());
  setText('p-diff', safeDiff());
  setText('p-time', clamp(qsNum('time', 70), 10, 600));
  setText('p-seed', qs('seed', null) ? ensureSeed() : 'auto');
}

if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', wireUI, { once:true });
}else{
  wireUI();
}