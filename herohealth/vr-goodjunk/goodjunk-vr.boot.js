// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Folder-run)
// ✅ Reads query params + passthrough context
// ✅ Sets body view classes (pc/mobile/vr/cvr)
// ✅ Waits for DOM + safe-zone measure
// ✅ Boots engine (goodjunk.safe.js)
// ✅ End summary overlay + Back HUB
// ✅ Best-effort flush before leaving

import { boot as engineBoot } from './goodjunk.safe.js';

'use strict';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function has(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function emit(name, detail){
  try { WIN.dispatchEvent(new CustomEvent(name, { detail })); }
  catch(_){}
}

function normView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function waitFor(ms){
  return new Promise(res=>setTimeout(res, ms));
}

async function waitForDomReady(){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') return;
  await new Promise(res=>DOC.addEventListener('DOMContentLoaded', res, { once:true }));
}

function readCtx(){
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||80) || 80;

  // seed priority: ?seed -> ?ts -> Date.now
  const seed = String(qs('seed', qs('ts', Date.now())));

  const hub = qs('hub', null);

  // additional passthrough for research logs (kept here for summary display)
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));
  const style = qs('style', null);
  const log = qs('log', null);

  return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup, style, log };
}

function ensureSummaryUI(){
  // build only once
  if(DOC.getElementById('gjEndOverlay')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'gjEndOverlay';
  wrap.setAttribute('aria-hidden','true');
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:99;
    display:none; align-items:center; justify-content:center;
    padding: calc(18px + env(safe-area-inset-top,0px)) 16px calc(18px + env(safe-area-inset-bottom,0px)) 16px;
    background: rgba(2,6,23,.70);
    backdrop-filter: blur(10px);
  `;

  const card = DOC.createElement('div');
  card.style.cssText = `
    width: min(640px, 94vw);
    border-radius: 22px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.82);
    box-shadow: 0 28px 90px rgba(0,0,0,.60);
    padding: 16px;
    color: #e5e7eb;
    font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
  `;

  const title = DOC.createElement('div');
  title.textContent = 'สรุปผล GoodJunkVR';
  title.style.cssText = `font-weight:1200; font-size:18px;`;

  const meta = DOC.createElement('div');
  meta.id = 'gjEndMeta';
  meta.style.cssText = `margin-top:8px; color: rgba(148,163,184,.95); font-weight:900; font-size:12px; line-height:1.4;`;

  const grid = DOC.createElement('div');
  grid.id = 'gjEndGrid';
  grid.style.cssText = `
    margin-top:12px;
    display:grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap:10px;
  `;

  const tip = DOC.createElement('div');
  tip.id = 'gjEndTip';
  tip.style.cssText = `margin-top:10px; color: rgba(148,163,184,.95); font-weight:900; font-size:12px; line-height:1.45;`;
  tip.textContent = 'กด “กลับ HUB” เพื่อกลับไปหน้าเมนู (ระบบจะพยายามส่ง log ให้ครบก่อนออก)';

  const actions = DOC.createElement('div');
  actions.style.cssText = `margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;`;

  const btnAgain = DOC.createElement('button');
  btnAgain.type = 'button';
  btnAgain.textContent = 'เล่นอีกครั้ง';
  btnAgain.style.cssText = `
    height:46px; padding:0 14px; border-radius:16px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(15,23,42,.65);
    color:#e5e7eb; font-weight:1100; cursor:pointer;
  `;

  const btnHub = DOC.createElement('button');
  btnHub.type = 'button';
  btnHub.textContent = '↩ กลับ HUB';
  btnHub.style.cssText = `
    height:46px; padding:0 14px; border-radius:16px;
    border:1px solid rgba(34,197,94,.35);
    background: rgba(34,197,94,.14);
    color:#eafff3; font-weight:1200; cursor:pointer;
  `;

  btnAgain.addEventListener('click', ()=>{
    // reload preserving query
    location.reload();
  });

  btnHub.addEventListener('click', async ()=>{
    await bestEffortFlush();
    const hub = qs('hub', null);
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  });

  actions.appendChild(btnAgain);
  actions.appendChild(btnHub);

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(grid);
  card.appendChild(tip);
  card.appendChild(actions);
  wrap.appendChild(card);
  DOC.body.appendChild(wrap);
}

function showSummary(summary, ctx){
  ensureSummaryUI();

  const ov = DOC.getElementById('gjEndOverlay');
  const meta = DOC.getElementById('gjEndMeta');
  const grid = DOC.getElementById('gjEndGrid');
  if(!ov || !meta || !grid) return;

  const played = Number(summary?.durationPlayedSec ?? 0);
  const planned = Number(summary?.durationPlannedSec ?? ctx.time ?? 0);
  const grade = String(summary?.grade ?? '—');

  meta.textContent =
    `view=${ctx.view} · run=${ctx.run} · diff=${ctx.diff} · time=${played}/${planned}s · seed=${ctx.seed}` +
    (ctx.studyId ? ` · studyId=${ctx.studyId}` : '') +
    (ctx.phase ? ` · phase=${ctx.phase}` : '') +
    (ctx.conditionGroup ? ` · cond=${ctx.conditionGroup}` : '');

  grid.innerHTML = '';

  const items = [
    ['SCORE', summary?.scoreFinal ?? summary?.score ?? 0],
    ['MISS', summary?.miss ?? 0],
    ['GRADE', grade],
    ['COMBO MAX', summary?.comboMax ?? 0],
    ['HIT GOOD', summary?.hitGood ?? 0],
    ['HIT JUNK', summary?.hitJunk ?? 0],
    ['EXPIRE GOOD', summary?.expireGood ?? 0],
    ['SHIELD', summary?.shieldRemaining ?? summary?.shield ?? 0],
  ];

  for(const [k,v] of items){
    const box = DOC.createElement('div');
    box.style.cssText = `
      border-radius:18px;
      border:1px solid rgba(148,163,184,.16);
      background: rgba(15,23,42,.55);
      padding: 10px 12px;
    `;
    const kk = DOC.createElement('div');
    kk.textContent = k;
    kk.style.cssText = `font-weight:1100; font-size:11px; color: rgba(148,163,184,.95); letter-spacing:.4px;`;
    const vv = DOC.createElement('div');
    vv.textContent = String(v);
    vv.style.cssText = `margin-top:4px; font-weight:1300; font-size:18px; color:#e5e7eb;`;
    box.appendChild(kk);
    box.appendChild(vv);
    grid.appendChild(box);
  }

  ov.style.display = 'flex';
  ov.setAttribute('aria-hidden','false');
}

async function bestEffortFlush(){
  try{
    emit('hha:flush', { why:'leave', ts: Date.now() });
  }catch(_){}
  // give sendBeacon/keepalive a moment
  await waitFor(220);
}

function hookBackHubButton(ctx){
  const btnBack = DOC.getElementById('btnBackHub');
  if(!btnBack) return;
  btnBack.addEventListener('click', async ()=>{
    await bestEffortFlush();
    if(ctx.hub) location.href = ctx.hub;
    else location.href = '../hub.html';
  });
}

function persistLastSummary(summary){
  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
}

(async function main(){
  await waitForDomReady();

  const ctx = readCtx();
  setBodyView(ctx.view);

  // show meta chip if exists
  try{
    const chipMeta = DOC.getElementById('gjChipMeta');
    if(chipMeta) chipMeta.textContent = `view=${ctx.view} · run=${ctx.run} · diff=${ctx.diff} · time=${ctx.time}`;
  }catch(_){}

  hookBackHubButton(ctx);

  // Wait a bit so HTML can measure HUD -> set --gj-top-safe / --gj-bottom-safe
  // This avoids "target pop then disappear" from spawning under HUD or outside safe rect.
  await waitFor(80);
  await waitFor(160);

  // if user already has a previous summary, keep it but do not show automatically
  // (optional) You can show it if run=demo etc.

  // Listen for end
  WIN.addEventListener('hha:end', async (ev)=>{
    const summary = ev?.detail || {};
    persistLastSummary(summary);
    await bestEffortFlush();
    showSummary(summary, ctx);
  });

  // Start engine
  try{
    engineBoot({
      view: ctx.view,
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed
    });
  }catch(err){
    console.error('[GoodJunkVR] boot failed:', err);
    // show a simple alert-like UI
    alert('Boot error: ' + (err?.message || err));
  }

  // Flush on pagehide (mobile safari friendly)
  WIN.addEventListener('pagehide', ()=>{ try{ emit('hha:flush',{ why:'pagehide', ts:Date.now() }); }catch(_){ } });
  WIN.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden'){
      try{ emit('hha:flush',{ why:'hidden', ts:Date.now() }); }catch(_){}
    }
  });

})();