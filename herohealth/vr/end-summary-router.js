// === /herohealth/vr/end-summary-router.js ===
// HHA End Summary Router — PRODUCTION (flush-hardened + boss-aware)
// - saves HHA_LAST_SUMMARY
// - routes to Boss Summary Card if boss mode detected
// - provides unified Back to HUB behavior

'use strict';

import { showBossSummary } from '../../fitness/js/boss-summary.js'; // ปรับ path ให้ตรง repo คุณ

const KEY_LAST = 'HHA_LAST_SUMMARY';

function safeStr(x){ return (x==null)?'':String(x); }

function qs(k, d=''){
  try{ return new URLSearchParams(location.search).get(k) ?? d; }catch(_){ return d; }
}

function nowIso(){
  const d = new Date();
  return d.toISOString();
}

function safeJson(x){
  try{ return JSON.stringify(x); }catch(_){ return '{}'; }
}

function saveLastSummary(summary){
  try{ localStorage.setItem(KEY_LAST, safeJson(summary)); }catch(_){}
}

function flushLogger(flushFn){
  // flushFn may be async; tolerate errors
  try{
    const r = flushFn?.();
    if(r && typeof r.then === 'function'){
      return r.catch(()=>null);
    }
  }catch(_){}
  return Promise.resolve(null);
}

function defaultHubUrl(){
  const hub = qs('hub','');
  return hub || '../hub.html';
}

function detectBossMode(){
  return (qs('boss','0') === '1');
}

function detectSessionId(){
  return qs('sid','') || qs('sessionId','') || ''; // fallback
}

// Provide a unified exit
function goHub(){
  const hub = defaultHubUrl();
  try{ location.href = hub; }catch(_){ history.back(); }
}

// PUBLIC API
export async function endSessionRouter(opts){
  const o = Object.assign({
    gameName: 'Game',
    gameId: 'unknown',
    mode: qs('run','play'),            // play|research
    diff: qs('diff','normal'),
    durationSec: Number(qs('time','0')||0) || 0,
    // summary payload from your game
    summary: null,                    // object
    // event/session flushers from your game (optional)
    flush: null,                      // () => Promise|void
    // sessionId (prefer explicit from game)
    sessionId: '',
    // how to start retest (optional)
    onRetest: null,                   // () => void
  }, opts||{});

  const sid = safeStr(o.sessionId || detectSessionId());
  const bossOn = detectBossMode();

  // 1) flush hardened BEFORE UI/exit
  await flushLogger(o.flush);

  // 2) save last summary (hub shows it)
  const payload = Object.assign({
    ts: nowIso(),
    gameId: o.gameId,
    gameName: o.gameName,
    mode: o.mode,
    diff: o.diff,
    durationSec: o.durationSec,
    bossOn: bossOn ? 1 : 0,
    sessionId: sid
  }, (o.summary || {}));

  saveLastSummary(payload);

  // 3) route end UI
  if(bossOn && sid){
    // Boss summary card
    showBossSummary({
      sessionId: sid,
      gameName: o.gameName,
      hubUrl: defaultHubUrl(),
      onRetest: ()=>{
        if(typeof o.onRetest === 'function') o.onRetest();
        else location.reload();
      },
      onExit: ()=> goHub()
    });
    return;
  }

  // 4) fallback: simple end panel (ถ้าเกมไม่มีของตัวเอง)
  // ถ้าเกมคุณมี end summary อยู่แล้ว ให้ game เรียกเอง แล้วไม่ต้องใช้ fallback นี้
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML = `
    <div style="width:min(620px,96vw);background:rgba(15,23,42,.92);border:1px solid rgba(255,255,255,.16);border-radius:18px;color:#fff;overflow:hidden;font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;">
      <div style="padding:14px;border-bottom:1px solid rgba(255,255,255,.10);font-weight:900;">🏁 สรุปผล — ${o.gameName}</div>
      <div style="padding:14px;opacity:.92;line-height:1.4;white-space:pre-line;">
        mode: ${safeStr(o.mode)} | diff: ${safeStr(o.diff)}${bossOn?' | boss:1':''}
        \nsession: ${sid || '-'}
      </div>
      <div style="padding:12px 14px;border-top:1px solid rgba(255,255,255,.10);display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button id="hhaRetest" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(59,130,246,.35);color:#fff;font-weight:900;">🔁 Retest</button>
        <button id="hhaHub" style="padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.20);color:#fff;font-weight:900;">🏠 Back to HUB</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#hhaRetest')?.addEventListener('click', ()=>{
    overlay.remove();
    if(typeof o.onRetest === 'function') o.onRetest();
    else location.reload();
  });
  overlay.querySelector('#hhaHub')?.addEventListener('click', ()=>{
    overlay.remove();
    goHub();
  });
}