// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK ready)
// ✅ Boots goodjunk.safe.js once DOM ready
// ✅ Creates AI FAIR PACK (goodjunk.ai-pack.js) and passes via opts.aiPack
// ✅ Safe error overlay (no white screen)

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';
import { createGoodJunkAIPack } from './goodjunk.ai-pack.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function emit(n, d){
  try{ WIN.dispatchEvent(new CustomEvent(n, { detail:d })); }catch{}
}

function once(fn){
  let done = false;
  return (...args)=>{
    if(done) return;
    done = true;
    return fn(...args);
  };
}

function showBootError(err){
  try{
    const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err||'Boot error');
    const wrap = DOC.createElement('div');
    wrap.style.cssText = [
      'position:fixed','inset:0','z-index:999999',
      'background:rgba(2,6,23,.92)','color:#e5e7eb',
      'display:flex','align-items:center','justify-content:center',
      'padding:18px','font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif'
    ].join(';');
    wrap.innerHTML = `
      <div style="max-width:860px;width:min(860px,96vw);border:1px solid rgba(148,163,184,.22);
                  border-radius:18px;padding:16px;background:rgba(15,23,42,.55)">
        <div style="font-weight:900;font-size:18px">GoodJunkVR — Boot Error</div>
        <div style="opacity:.75;font-weight:800;margin-top:6px">รายละเอียดด้านล่าง (คัดลอกส่งมาได้)</div>
        <pre style="white-space:pre-wrap;word-break:break-word;margin-top:10px;
                    background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.18);
                    border-radius:14px;padding:12px;max-height:56vh;overflow:auto">${escapeHtml(msg)}</pre>
        <button id="gjReload" style="margin-top:10px;height:46px;width:100%;
          border-radius:14px;border:1px solid rgba(34,197,94,.35);
          background:rgba(34,197,94,.18);color:#eafff3;font-weight:900;cursor:pointer">Reload</button>
      </div>
    `;
    DOC.body.appendChild(wrap);
    wrap.querySelector('#gjReload')?.addEventListener('click', ()=> location.reload());
  }catch{}
}

function escapeHtml(s){
  return String(s||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function readCtx(){
  const view = String(qs('view','auto')).toLowerCase();
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;

  // seed: prefer explicit seed param, else ts, else now
  const seed = String(qs('seed', qs('ts', Date.now())));

  // passthrough research-ish (engine may ignore, logger may use)
  const hub = qs('hub', null);
  const log = qs('log', null);
  const style = qs('style', null);

  return { view, run, diff, time, seed, hub, log, style };
}

function ensureSafeZoneRecalc(){
  // run.html already measures, but we kick it once more after layout settles
  try{
    WIN.dispatchEvent(new Event('resize'));
    setTimeout(()=>WIN.dispatchEvent(new Event('resize')), 120);
    setTimeout(()=>WIN.dispatchEvent(new Event('resize')), 360);
  }catch{}
}

const bootOnce = once(()=> {
  try{
    const ctx = readCtx();

    // seeded rng (same as safe.js)
    let x = (Number(ctx.seed)||Date.now()) % 2147483647;
    if(x <= 0) x += 2147483646;
    const rng = ()=> (x = x * 16807 % 2147483647) / 2147483647;

    // AI FAIR PACK (play: ON, research: OFF)
    const aiPack = createGoodJunkAIPack({
      mode: ctx.run,
      seed: ctx.seed,
      rng,
      nowMs: ()=> (performance?.now?.() ?? Date.now()),
      emit
    });

    // expose (debug) — optional
    WIN.__GJ_AI_PACK__ = aiPack;

    ensureSafeZoneRecalc();

    // boot engine
    engineBoot({
      view: ctx.view,
      run: ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
      aiPack // safe.js vถัดไปจะใช้งานจริง
    });

  }catch(err){
    showBootError(err);
  }
});

function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    setTimeout(fn, 0);
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

onReady(bootOnce);