// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Sets body view classes (pc/mobile/vr/cvr)
// ✅ Boots engine: ./goodjunk.safe.js
// ✅ End Summary Overlay (HHA Standard-ish) + Back HUB + Replay
// ✅ Does NOT override ?view= (launcher already handles that)
// Requires:
//  - goodjunk-vr.html loads this as <script type="module" defer ...>
//  - goodjunk.safe.js exports boot(opts)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; } };

function normView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard' || v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'auto';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view==='pc') b.classList.add('view-pc');
  else if(view==='mobile') b.classList.add('view-mobile');
  else if(view==='vr') b.classList.add('view-vr');
  else if(view==='cvr') b.classList.add('view-cvr');
}

function safeDispatchResize(){
  // forces updateSafe() in goodjunk-vr.html to re-measure HUD safe zones
  try{ WIN.dispatchEvent(new Event('resize')); }catch(_){}
}

function getHubUrl(){
  return qs('hub', null);
}

function buildEndOverlay(){
  if(DOC.getElementById('gjEndOverlay')) return;

  const wrap = DOC.createElement('div');
  wrap.id = 'gjEndOverlay';
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:60;
    display:none; align-items:center; justify-content:center;
    padding: calc(22px + env(safe-area-inset-top,0px)) 16px calc(22px + env(safe-area-inset-bottom,0px)) 16px;
    background: rgba(2,6,23,.78);
    backdrop-filter: blur(10px);
  `;

  wrap.innerHTML = `
    <div style="
      width:min(560px, 94vw);
      background: rgba(2,6,23,.82);
      border:1px solid rgba(148,163,184,.22);
      border-radius:22px;
      box-shadow:0 26px 90px rgba(0,0,0,.55);
      padding:16px 16px;
      color:#e5e7eb;
      font-family:system-ui,-apple-system,'Segoe UI','Noto Sans Thai',sans-serif;
    ">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <div style="font-size:18px; font-weight:1200;">สรุปผล GoodJunkVR</div>
          <div style="margin-top:4px; font-size:12px; font-weight:900; color:rgba(148,163,184,.95);" id="gjEndMeta">—</div>
        </div>
        <button id="gjEndClose" type="button" style="
          height:38px; padding:0 12px;
          border-radius:14px;
          border:1px solid rgba(148,163,184,.28);
          background: rgba(2,6,23,.50);
          color:#e5e7eb;
          font-weight:1000;
          cursor:pointer;
        ">ปิด</button>
      </div>

      <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-top:12px;">
        <div style="padding:10px 12px; border-radius:16px; background:rgba(2,6,23,.48); border:1px solid rgba(148,163,184,.18);">
          <div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:rgba(148,163,184,.92); font-weight:1000;">SCORE</div>
          <div style="font-size:22px; font-weight:1400;" id="gjEndScore">0</div>
        </div>
        <div style="padding:10px 12px; border-radius:16px; background:rgba(2,6,23,.48); border:1px solid rgba(148,163,184,.18);">
          <div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:rgba(148,163,184,.92); font-weight:1000;">GRADE</div>
          <div style="font-size:22px; font-weight:1400;" id="gjEndGrade">—</div>
        </div>
        <div style="padding:10px 12px; border-radius:16px; background:rgba(245,158,11,.10); border:1px solid rgba(245,158,11,.22);">
          <div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:rgba(148,163,184,.92); font-weight:1000;">MISS</div>
          <div style="font-size:22px; font-weight:1400;" id="gjEndMiss">0</div>
        </div>
        <div style="padding:10px 12px; border-radius:16px; background:rgba(34,197,94,.10); border:1px solid rgba(34,197,94,.18);">
          <div style="font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:rgba(148,163,184,.92); font-weight:1000;">COMBO MAX</div>
          <div style="font-size:22px; font-weight:1400;" id="gjEndCombo">0</div>
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button id="gjEndReplay" type="button" style="
          flex:1;
          min-width: 180px;
          height:46px;
          border-radius:16px;
          border:1px solid rgba(34,211,238,.25);
          background: rgba(34,211,238,.12);
          color:#eaffff;
          font-weight:1200;
          cursor:pointer;
        ">เล่นอีกครั้ง</button>

        <button id="gjEndHub" type="button" style="
          flex:1;
          min-width: 180px;
          height:46px;
          border-radius:16px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.14);
          color:#eafff3;
          font-weight:1200;
          cursor:pointer;
        ">↩ กลับ HUB</button>
      </div>

      <div style="margin-top:10px; font-size:12px; font-weight:900; color:rgba(148,163,184,.95); line-height:1.35;">
        * บันทึกผลล่าสุดไว้ที่ <b>localStorage: HHA_LAST_SUMMARY</b>
      </div>
    </div>
  `;

  DOC.body.appendChild(wrap);

  const close = DOC.getElementById('gjEndClose');
  close?.addEventListener('click', ()=> hideEndOverlay());

  const replay = DOC.getElementById('gjEndReplay');
  replay?.addEventListener('click', ()=>{
    // keep all query params, just reload
    try{ location.reload(); }catch(_){}
  });

  const hubBtn = DOC.getElementById('gjEndHub');
  hubBtn?.addEventListener('click', ()=>{
    const hub = getHubUrl();
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  });
}

function showEndOverlay(summary){
  buildEndOverlay();

  const wrap = DOC.getElementById('gjEndOverlay');
  if(!wrap) return;

  const meta = DOC.getElementById('gjEndMeta');
  const sScore = DOC.getElementById('gjEndScore');
  const sGrade = DOC.getElementById('gjEndGrade');
  const sMiss  = DOC.getElementById('gjEndMiss');
  const sCombo = DOC.getElementById('gjEndCombo');

  const view = summary?.view ?? qs('view','auto');
  const diff = summary?.diff ?? qs('diff','normal');
  const time = summary?.durationPlayedSec ?? null;

  if(meta){
    meta.textContent = `view=${view} · diff=${diff}${(time!=null?` · เล่น ${time}s`:'')}`;
  }
  if(sScore) sScore.textContent = String(summary?.scoreFinal ?? 0);
  if(sGrade) sGrade.textContent = String(summary?.grade ?? '—');
  if(sMiss)  sMiss.textContent  = String(summary?.miss ?? 0);
  if(sCombo) sCombo.textContent = String(summary?.comboMax ?? 0);

  wrap.style.display = 'flex';
}

function hideEndOverlay(){
  const wrap = DOC.getElementById('gjEndOverlay');
  if(wrap) wrap.style.display = 'none';
}

function wireEndListener(){
  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || null;
    // show overlay after a short beat to ensure UI updated
    setTimeout(()=> showEndOverlay(summary), 120);
  }, { passive:true });
}

function bootOnce(){
  // 1) view class
  const view = normView(qs('view','auto'));
  if(view !== 'auto') setBodyView(view);

  // 2) allow vr-ui.js to mount first, then re-measure safe zones
  setTimeout(safeDispatchResize, 0);
  setTimeout(safeDispatchResize, 120);
  setTimeout(safeDispatchResize, 360);

  // 3) End overlay listener
  wireEndListener();

  // 4) Boot engine
  const opts = {
    view: qs('view','mobile'),
    run:  qs('run','play'),
    diff: qs('diff','normal'),
    time: qs('time','80'),
    seed: qs('seed', Date.now())
  };

  try{
    engineBoot(opts);
  }catch(err){
    console.error('[GoodJunkVR boot] engine error:', err);
    alert('เกิดข้อผิดพลาดตอนเริ่มเกม (ดู console)');
  }
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(bootOnce);