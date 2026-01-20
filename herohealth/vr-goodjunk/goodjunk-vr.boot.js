// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Chooses pack via ?pack=fair|boss (default fair)
// ✅ Imports either ./goodjunk.safe.js (fair) or ./goodjunk.safe.boss.js (boss)
// ✅ Pass-through payload to boot(): view/run/diff/time/seed/hub/studyId/phase/conditionGroup
// ✅ Fallback: if boss import fails -> fair

'use strict';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); } catch { return false; } };

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function normalizePack(p){
  p = String(p||'').toLowerCase();
  if(p==='boss' || p==='b') return 'boss';
  return 'fair';
}

function payloadFromUrl(){
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();     // play|research|practice
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||80) || 80;

  // seed: research should be deterministic; play can be Date.now if missing
  const seedParam = qs('seed', null);
  const seed = seedParam ?? (run==='research' ? (qs('ts', null) ?? 'RESEARCH-SEED') : String(Date.now()));

  return {
    view,
    run,
    diff,
    time,
    seed,

    // research passthrough (logger will pick up via hha:start/hha:end)
    hub: qs('hub', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };
}

async function boot(){
  const pack = normalizePack(qs('pack', 'fair'));
  const payload = payloadFromUrl();

  // mirror meta chip if exists
  try{
    const meta = DOC.getElementById('gjChipMeta');
    if(meta){
      meta.textContent = `view=${payload.view} · run=${payload.run} · diff=${payload.diff} · time=${payload.time} · pack=${pack}`;
    }
  }catch(_){}

  // choose module
  if(pack === 'boss'){
    try{
      const mod = await import('./goodjunk.safe.boss.js');
      if(mod && typeof mod.boot === 'function'){
        mod.boot(payload);
        return;
      }
    }catch(err){
      console.warn('[GoodJunkVR] boss pack import failed, fallback to fair', err);
    }
  }

  // fair default
  try{
    const mod = await import('./goodjunk.safe.js');
    if(mod && typeof mod.boot === 'function'){
      mod.boot(payload);
      return;
    }
  }catch(err){
    console.error('[GoodJunkVR] fair pack import failed', err);
  }

  // last resort message
  try{
    const m = DOC.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#020617;color:#e5e7eb;font:900 16px/1.4 system-ui;padding:18px;text-align:center;';
    m.textContent = 'โหลดเกมไม่สำเร็จ (boot/import). ตรวจ path ไฟล์ goodjunk.safe.js / goodjunk.safe.boss.js';
    DOC.body.appendChild(m);
  }catch(_){}
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}