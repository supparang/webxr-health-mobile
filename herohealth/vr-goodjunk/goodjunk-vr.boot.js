// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack + Food5 + Mini + End Summary)
// ✅ Sets body view classes: view-pc / view-mobile / view-vr / view-cvr
// ✅ Never override if URL has ?view=...
// ✅ Boots engine from ./goodjunk.safe.js
// ✅ End Summary overlay + Back HUB + Play again
// ✅ Flush-hardened (best-effort) before leaving page
//
// Requires in HTML:
// <script defer src="../vr/vr-ui.js"></script>        (emits hha:shoot)
// <script defer src="../vr/hha-cloud-logger.js"></script> (optional)
// <script type="module" defer src="./goodjunk-vr.boot.js"></script>

import { boot as engineBoot } from './goodjunk.safe.js';

'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

function isLikelyMobileUA(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile|silk/.test(ua);
}

function normView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='view-cvr') return 'cvr';
  if(v==='cvr') return 'cvr';
  if(v==='vr') return 'vr';
  if(v==='mobile') return 'mobile';
  if(v==='pc') return 'pc';
  return 'auto';
}

async function detectViewSoft(){
  // do NOT override if view explicitly provided
  if(has('view')) return normView(qs('view','auto'));

  // otherwise: guess
  let guess = isLikelyMobileUA() ? 'mobile' : 'pc';

  // if WebXR VR supported on mobile => suggest vr
  try{
    if(navigator.xr && typeof navigator.xr.isSessionSupported === 'function'){
      const ok = await navigator.xr.isSessionSupported('immersive-vr');
      if(ok && isLikelyMobileUA()) guess = 'vr';
    }
  }catch(_){}

  return normView(guess);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='mobile') b.classList.add('view-mobile');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
}

function bestEffortFlush(){
  // รองรับหลายชื่อ (เผื่อ logger เปลี่ยน)
  try{ WIN.HHACloudLogger?.flush?.(); }catch(_){}
  try{ WIN.HHA_CLOUD_LOGGER?.flush?.(); }catch(_){}
  try{ WIN.__HHA_LOGGER__?.flush?.(); }catch(_){}
  try{ WIN.HHA_LOG?.flush?.(); }catch(_){}
}

function saveSummaryHistory(summary){
  try{
    const raw = localStorage.getItem(LS_HIST);
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift({ ...summary, savedAt: new Date().toISOString() });
    while(arr.length > 20) arr.pop();
    localStorage.setItem(LS_HIST, JSON.stringify(arr));
  }catch(_){}
}

function buildEndOverlay(){
  const el = DOC.createElement('div');
  el.id = 'gjEnd';
  el.style.cssText = `
    position:fixed; inset:0; z-index:999;
    display:none; align-items:center; justify-content:center;
    padding: calc(18px + env(safe-area-inset-top,0px)) 16px calc(18px + env(safe-area-inset-bottom,0px)) 16px;
    background: rgba(2,6,23,.72);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  `;
  el.innerHTML = `
    <div style="
      width:min(760px, 94vw);
      border-radius:22px;
      border:1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.78);
      box-shadow: 0 24px 70px rgba(0,0,0,.55);
      padding: 16px;
      color:#e5e7eb;
      font-family: system-ui,-apple-system,'Segoe UI','Noto Sans Thai',sans-serif;
    ">
      <div style="font-weight:1200; font-size:20px;">สรุปผล GoodJunkVR</div>
      <div id="gjEndSub" style="margin-top:6px; color:#94a3b8; font-weight:900; font-size:12px;">—</div>

      <div style="margin-top:12px; display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:8px;">
        <div style="padding:10px 12px; border-radius:16px; border:1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.55);">
          <div style="font-size:11px; color:#94a3b8; font-weight:1000;">SCORE</div>
          <div id="gjEndScore" style="margin-top:2px; font-size:18px; font-weight:1200;">0</div>
        </div>
        <div style="padding:10px 12px; border-radius:16px; border:1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.55);">
          <div style="font-size:11px; color:#94a3b8; font-weight:1000;">MISS</div>
          <div id="gjEndMiss" style="margin-top:2px; font-size:18px; font-weight:1200;">0</div>
        </div>
        <div style="padding:10px 12px; border-radius:16px; border:1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.55);">
          <div style="font-size:11px; color:#94a3b8; font-weight:1000;">GRADE</div>
          <div id="gjEndGrade" style="margin-top:2px; font-size:18px; font-weight:1200;">—</div>
        </div>
        <div style="padding:10px 12px; border-radius:16px; border:1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.55);">
          <div style="font-size:11px; color:#94a3b8; font-weight:1000;">GOALS</div>
          <div id="gjEndGoals" style="margin-top:2px; font-size:18px; font-weight:1200;">0/0</div>
        </div>
      </div>

      <div style="margin-top:12px; padding:12px; border-radius:18px; border:1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.45);">
        <div style="font-weight:1100; font-size:13px;">ทิป</div>
        <div id="gjEndTip" style="margin-top:6px; color:#cbd5e1; font-weight:900; font-size:12px; line-height:1.35;">
          — 
        </div>
      </div>

      <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
        <button id="gjBtnReplay" style="
          height:46px; padding:0 14px; border-radius:16px;
          border:1px solid rgba(148,163,184,.22);
          background: rgba(2,6,23,.55);
          color:#e5e7eb; font-weight:1100; cursor:pointer;
        ">เล่นอีกครั้ง</button>

        <button id="gjBtnHub" style="
          height:46px; padding:0 14px; border-radius:16px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.14);
          color:#eafff3; font-weight:1200; cursor:pointer;
        ">↩ กลับ HUB</button>
      </div>
    </div>
  `;
  DOC.body.appendChild(el);
  return el;
}

function showEnd(overlay, summary){
  if(!overlay) return;
  overlay.style.display = 'flex';

  const sub = DOC.getElementById('gjEndSub');
  const sc  = DOC.getElementById('gjEndScore');
  const mi  = DOC.getElementById('gjEndMiss');
  const gr  = DOC.getElementById('gjEndGrade');
  const gl  = DOC.getElementById('gjEndGoals');
  const tip = DOC.getElementById('gjEndTip');

  if(sub){
    const v = summary?.view || qs('view','—');
    const d = summary?.diff || qs('diff','—');
    const t = summary?.durationPlayedSec ?? 0;
    sub.textContent = `view=${v} · diff=${d} · เล่นไป ${t}s`;
  }
  if(sc) sc.textContent = String(summary?.scoreFinal ?? summary?.scoreFinal ?? summary?.scoreFinal ?? summary?.scoreFinal ?? summary?.scoreFinal ?? summary?.scoreFinal ?? summary?.scoreFinal ?? 0);
  // safe.js ใช้ key scoreFinal / miss / grade / goalsCleared/goalsTotal
  if(sc) sc.textContent = String(summary?.scoreFinal ?? 0);
  if(mi) mi.textContent = String(summary?.miss ?? 0);
  if(gr) gr.textContent = String(summary?.grade ?? '—');
  if(gl) gl.textContent = `${summary?.goalsCleared ?? 0}/${summary?.goalsTotal ?? 0}`;

  // tip based on miss (kid-friendly)
  const miss = Number(summary?.miss ?? 0);
  let tmsg = 'พยายามรักษาคอมโบ และใช้ 🛡️ บล็อคของเสีย!';
  if(miss <= 2) tmsg = 'โหดมาก! คุมพลาดได้สุดยอด 👏';
  else if(miss <= 5) tmsg = 'ดีมาก! ลองเก็บ ⭐ เพื่อลด MISS และทำคอมโบยาวขึ้น';
  if(tip) tip.textContent = tmsg;
}

function wireOverlayButtons(overlay){
  const btnReplay = DOC.getElementById('gjBtnReplay');
  const btnHub    = DOC.getElementById('gjBtnHub');

  const hub = qs('hub', null);

  btnReplay?.addEventListener('click', ()=>{
    bestEffortFlush();
    // reload keeping params (same run)
    location.reload();
  });

  btnHub?.addEventListener('click', ()=>{
    bestEffortFlush();
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  });

  // harden: before leaving
  WIN.addEventListener('beforeunload', ()=>{ bestEffortFlush(); }, { capture:true });
}

async function main(){
  // view 결정
  const view = await detectViewSoft();
  setBodyView(view);

  // configure vr-ui (optional)
  WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG||{});

  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||80);
  const seed = String(qs('seed', Date.now()));

  // build end overlay
  const overlay = buildEndOverlay();
  wireOverlayButtons(overlay);

  // listen end -> show summary
  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || {};
    // persist last summary + history
    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
    saveSummaryHistory(summary);

    // show overlay
    showEnd(overlay, summary);

    // flush logger
    bestEffortFlush();
  }, { passive:true });

  // boot game engine
  engineBoot({
    view,
    run,
    diff,
    time,
    seed
  });
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
}else{
  main();
}