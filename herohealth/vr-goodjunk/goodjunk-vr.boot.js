// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (PACK-FAIR)
// ✅ Reads query params + auto view fallback (but respects existing ?view=)
// ✅ Sets body classes: view-pc | view-mobile | view-vr | view-cvr
// ✅ Ensures safe-zone measure has time to set --gj-top-safe/--gj-bottom-safe
// ✅ Boots goodjunk.safe.js (your SAFE file, Boss++ A+B+C version)
// ✅ VR hint stays in vr-ui.js; this file just boots reliably

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
};
const has = (k)=>{
  try{ return new URL(location.href).searchParams.has(k); }
  catch(_){ return false; }
};

function normView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='view-cvr') return 'cvr';
  if(v==='cvr') return 'cvr';
  if(v==='vr') return 'vr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectViewSoft(){
  // If user passed view=... => never override
  if(has('view')) return normView(qs('view','mobile'));

  // else: lightweight guess (do not hard force)
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // If immersive-vr supported, treat mobile as 'vr' (cardboard/vr button)
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok && isLikelyMobileUA()) guess = 'vr';
    }
  }catch(_){}

  return normView(guess);
}

function setBodyViewClasses(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // also keep legacy hint class (optional)
  try{ b.dataset.view = view; }catch(_){}
}

function updateChipMeta(){
  const chip = DOC.getElementById('gjChipMeta');
  if(!chip) return;
  const v = qs('view','auto');
  const run = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  chip.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

/**
 * Ensure safe vars exist before engine reads them:
 * - goodjunk-vr.html runs updateSafe() at 0/120/360ms
 * - we wait a bit + verify CSS vars are non-empty
 */
async function waitForSafeVars(){
  // minimum short wait (let inline script run)
  await wait(50);

  const root = DOC.documentElement;
  if(!root) return;

  function getVar(name){
    try{
      const v = getComputedStyle(root).getPropertyValue(name);
      return String(v||'').trim();
    }catch(_){ return ''; }
  }

  // poll quickly up to ~600ms
  const t0 = Date.now();
  while(Date.now() - t0 < 650){
    const top = getVar('--gj-top-safe');
    const bot = getVar('--gj-bottom-safe');
    if(top && bot) return;
    await wait(80);
  }
}

function buildPayload(view){
  return {
    view,                               // pc|mobile|vr|cvr
    run: qs('run','play'),              // play|research
    diff: qs('diff','normal'),          // easy|normal|hard
    time: Number(qs('time','80'))||80,

    hub: qs('hub', null),
    seed: qs('seed', null),
    ts: qs('ts', null),

    // research fields passthrough
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };
}

async function main(){
  updateChipMeta();

  // Decide view (soft detect, but respect explicit view=)
  const view = await detectViewSoft();
  setBodyViewClasses(view);

  // Wait for safe vars measure (prevents spawn behind HUD)
  await waitForSafeVars();

  // Boot engine
  try{
    engineBoot(buildPayload(view));
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed:', err);

    // fallback: show a lightweight overlay
    try{
      const ov = DOC.createElement('div');
      ov.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        display:flex; align-items:center; justify-content:center;
        background: rgba(2,6,23,.92); color:#e5e7eb;
        padding:24px; font: 1000 14px/1.4 system-ui;
      `;
      ov.innerHTML = `
        <div style="max-width:720px">
          <div style="font-size:18px;font-weight:1200">GoodJunkVR โหลดไม่สำเร็จ</div>
          <div style="margin-top:10px;color:#94a3b8">
            ดู Console เพื่อหาสาเหตุ แล้วลองรีเฟรชอีกครั้ง
          </div>
          <div style="margin-top:12px;opacity:.9">error: ${String(err||'')}</div>
          <button id="gjRetry" style="
            margin-top:16px; height:48px; width:220px;
            border-radius:14px; border:1px solid rgba(34,197,94,.35);
            background: rgba(34,197,94,.14); color:#eafff3;
            font-weight:1200; cursor:pointer;
          ">Retry</button>
        </div>
      `;
      DOC.body.appendChild(ov);
      DOC.getElementById('gjRetry')?.addEventListener('click', ()=>location.reload());
    }catch(_){}
  }
}

// DOM ready (robust)
if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  main();
}else{
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
}