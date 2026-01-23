// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack)
// ✅ Set body view classes (pc/mobile/vr/cvr) without overriding explicit ?view=
// ✅ Pass-through ctx (hub/run/diff/time/seed/log/style...)
// ✅ Wait DOM + safe-zone measured; then boot safe engine
// ✅ End summary overlay (HHA Standard-ish) + Back to HUB
// ✅ Flush-hardened: try send log before leaving

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch{ return false; }
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'auto';
}

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

async function detectView(){
  // If URL already has view=... DO NOT override
  if(has('view')) return normalizeView(qs('view','auto'));

  // soft remember
  try{
    const last = localStorage.getItem('HHA_LAST_VIEW');
    if(last) return normalizeView(last);
  }catch(_){}

  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // best-effort WebXR check: if immersive-vr supported on mobile, prefer vr
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok) guess = isLikelyMobileUA() ? 'vr' : 'pc';
    }
  }catch(_){}

  return normalizeView(guess);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='mobile') b.classList.add('view-mobile');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
  else b.classList.add(isLikelyMobileUA() ? 'view-mobile' : 'view-pc');
}

function buildCtx(view){
  const hub  = qs('hub', null);
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = String(qs('seed', Date.now()));
  const log  = qs('log', null);
  const style = qs('style', null);

  return {
    view, hub,
    run, diff,
    time, seed,
    log, style,

    // optional research passthrough
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
    ts: qs('ts', null),
  };
}

function ensureSummaryLayer(){
  let wrap = DOC.getElementById('hhaSummary');
  if(wrap) return wrap;

  wrap = DOC.createElement('section');
  wrap.id = 'hhaSummary';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = [
    'position:fixed','inset:0','z-index:60',
    'display:none','align-items:center','justify-content:center',
    'padding:calc(18px + env(safe-area-inset-top,0px)) 16px calc(18px + env(safe-area-inset-bottom,0px)) 16px',
    'background:rgba(2,6,23,.62)','backdrop-filter:blur(10px)'
  ].join(';');

  const card = DOC.createElement('div');
  card.style.cssText = [
    'width:min(640px, 94vw)',
    'border-radius:22px',
    'border:1px solid rgba(148,163,184,.18)',
    'background:rgba(2,6,23,.80)',
    'box-shadow:0 26px 100px rgba(0,0,0,.55)',
    'padding:14px 14px'
  ].join(';');

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
      <div style="font-weight:1400;font-size:18px;">สรุปผล GoodJunkVR</div>
      <div id="sumGrade" style="font-weight:1500;font-size:18px;opacity:.92;">—</div>
    </div>

    <div id="sumMeta" style="margin-top:6px;color:rgba(148,163,184,.95);font-weight:900;font-size:12px;">—</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
      <div style="border:1px solid rgba(148,163,184,.14);border-radius:18px;background:rgba(2,6,23,.45);padding:10px 12px;">
        <div style="font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:rgba(148,163,184,.92);font-weight:1100;">SCORE</div>
        <div id="sumScore" style="font-size:22px;font-weight:1500;margin-top:2px;">0</div>
      </div>
      <div style="border:1px solid rgba(148,163,184,.14);border-radius:18px;background:rgba(2,6,23,.45);padding:10px 12px;">
        <div style="font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:rgba(148,163,184,.92);font-weight:1100;">MISS</div>
        <div id="sumMiss" style="font-size:22px;font-weight:1500;margin-top:2px;">0</div>
      </div>
      <div style="border:1px solid rgba(148,163,184,.14);border-radius:18px;background:rgba(2,6,23,.45);padding:10px 12px;">
        <div style="font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:rgba(148,163,184,.92);font-weight:1100;">COMBO MAX</div>
        <div id="sumCombo" style="font-size:22px;font-weight:1500;margin-top:2px;">0</div>
      </div>
      <div style="border:1px solid rgba(148,163,184,.14);border-radius:18px;background:rgba(2,6,23,.45);padding:10px 12px;">
        <div style="font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:rgba(148,163,184,.92);font-weight:1100;">TIME</div>
        <div id="sumTime" style="font-size:22px;font-weight:1500;margin-top:2px;">0s</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
      <button id="sumBackHub" type="button"
        style="flex:1;min-width:180px;height:48px;border-radius:16px;border:1px solid rgba(34,197,94,.32);background:rgba(34,197,94,.14);color:#eafff3;font-weight:1400;cursor:pointer;">
        ↩ กลับ HUB
      </button>
      <button id="sumReplay" type="button"
        style="flex:1;min-width:180px;height:48px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.55);color:#e5e7eb;font-weight:1400;cursor:pointer;">
        เล่นอีกครั้ง
      </button>
    </div>

    <div style="margin-top:10px;font-size:12px;font-weight:900;color:rgba(148,163,184,.95);line-height:1.4;">
      * โหมดวิจัย (run=research) ควรปิดการปรับยากอัตโนมัติ และใช้ seed เดิมเพื่อความทำซ้ำได้
    </div>
  `;

  wrap.appendChild(card);
  DOC.body.appendChild(wrap);
  return wrap;
}

function showSummary(summary, ctx){
  const wrap = ensureSummaryLayer();
  wrap.style.display = 'flex';
  wrap.setAttribute('aria-hidden','false');

  const $ = (id)=>DOC.getElementById(id);

  const grade = summary?.grade ?? '—';
  const score = summary?.scoreFinal ?? 0;
  const miss  = summary?.miss ?? 0;
  const combo = summary?.comboMax ?? 0;
  const timePlayed = summary?.durationPlayedSec ?? 0;

  $('sumGrade').textContent = grade;
  $('sumScore').textContent = String(score);
  $('sumMiss').textContent  = String(miss);
  $('sumCombo').textContent = String(combo);
  $('sumTime').textContent  = `${timePlayed}s`;

  const meta = `view=${ctx.view} · run=${ctx.run} · diff=${ctx.diff} · seed=${ctx.seed}`;
  $('sumMeta').textContent = meta;

  const hub = ctx.hub;

  $('sumBackHub').onclick = async ()=>{
    await tryFlushLogs();
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  };

  $('sumReplay').onclick = async ()=>{
    await tryFlushLogs();
    location.reload();
  };
}

async function tryFlushLogs(){
  // best effort: if hha-cloud-logger exposes flush method
  try{
    if(WIN.HHA_LOGGER && typeof WIN.HHA_LOGGER.flush === 'function'){
      await WIN.HHA_LOGGER.flush();
    }
  }catch(_){}
}

function waitForMeasuredSafe(){
  // goodjunk-vr.html has updateSafe() scheduled at 0/120/360ms,
  // here we wait a bit to let --gj-top-safe / --gj-bottom-safe be set.
  return new Promise((resolve)=>{
    const t0 = performance.now();
    const tick = ()=>{
      const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 0;
      const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 0;
      const ok = (top >= 90 && bot >= 90);
      if(ok || (performance.now() - t0) > 650) resolve();
      else setTimeout(tick, 40);
    };
    tick();
  });
}

async function main(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = await detectView();
  setBodyView(view);
  try{ if(!has('view')) localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}

  const ctx = buildCtx(view);

  // listen end -> summary
  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || null;
    if(summary){
      try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
      showSummary(summary, ctx);
    }
  });

  // leave protection (flush logs)
  WIN.addEventListener('beforeunload', ()=>{
    try{ tryFlushLogs(); }catch(_){}
  });

  // wait safe rect measured, then boot
  await waitForMeasuredSafe();

  // boot safe engine
  engineBoot({
    view: ctx.view,
    run: ctx.run,
    diff: ctx.diff,
    time: ctx.time,
    seed: ctx.seed
  });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
}else{
  main();
}