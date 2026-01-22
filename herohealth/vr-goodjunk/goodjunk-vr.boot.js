// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — FAIR PACK (calls goodjunk.safe.js)
// ✅ Reads query params + passthrough context
// ✅ Boots SAFE engine once DOM ready
// ✅ Optional end-summary overlay (lightweight)
// Note: Cloud logging handled by ../vr/hha-cloud-logger.js listening to hha:end

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function num(k, def){
  const v = Number(qs(k, def));
  return Number.isFinite(v) ? v : def;
}

function ensureEndOverlay(){
  let wrap = DOC.getElementById('gjEndOverlay');
  if(wrap) return wrap;

  wrap = DOC.createElement('div');
  wrap.id = 'gjEndOverlay';
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:120;
    display:none; align-items:center; justify-content:center;
    padding: calc(18px + env(safe-area-inset-top,0px))
             calc(16px + env(safe-area-inset-right,0px))
             calc(18px + env(safe-area-inset-bottom,0px))
             calc(16px + env(safe-area-inset-left,0px));
    background: rgba(2,6,23,.72);
    backdrop-filter: blur(10px);
  `;

  const card = DOC.createElement('div');
  card.style.cssText = `
    width:min(720px, 94vw);
    border-radius: 22px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.88);
    box-shadow: 0 18px 60px rgba(0,0,0,.55);
    padding: 16px;
    color:#e5e7eb;
    font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
  `;

  card.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <div style="font-weight:1100; font-size:18px;">สรุปผล GoodJunkVR</div>
      <button id="gjEndClose" type="button"
        style="border-radius:999px; border:1px solid rgba(148,163,184,.18);
               background:rgba(15,23,42,.55); color:#e5e7eb;
               padding:8px 12px; font-weight:1000; cursor:pointer;">ปิด</button>
    </div>

    <div id="gjEndBody" style="margin-top:12px; display:grid; gap:10px;">
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div style="padding:10px 12px; border-radius:14px; background:rgba(15,23,42,.55); border:1px solid rgba(148,163,184,.14); font-weight:1000;">
          SCORE: <span id="gjEndScore">0</span>
        </div>
        <div style="padding:10px 12px; border-radius:14px; background:rgba(15,23,42,.55); border:1px solid rgba(148,163,184,.14); font-weight:1000;">
          MISS: <span id="gjEndMiss">0</span>
        </div>
        <div style="padding:10px 12px; border-radius:14px; background:rgba(15,23,42,.55); border:1px solid rgba(148,163,184,.14); font-weight:1000;">
          GRADE: <span id="gjEndGrade">—</span>
        </div>
        <div style="padding:10px 12px; border-radius:14px; background:rgba(15,23,42,.55); border:1px solid rgba(148,163,184,.14); font-weight:1000;">
          COMBO: <span id="gjEndCombo">0</span>
        </div>
      </div>

      <div style="color:rgba(148,163,184,.92); font-weight:900; line-height:1.4;">
        ✅ ระบบบันทึกผลล่าสุด (HHA_LAST_SUMMARY) และส่งขึ้นคลาวด์ จะทำตอนจบอัตโนมัติ
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
        <button id="gjEndBackHub" type="button"
          style="flex:1; min-width:180px; height:46px; border-radius:16px;
                 border:1px solid rgba(34,197,94,.35);
                 background: rgba(34,197,94,.16);
                 color:#eafff3; font-weight:1100; cursor:pointer;">
          ↩ กลับ HUB
        </button>
        <button id="gjEndReplay" type="button"
          style="flex:1; min-width:180px; height:46px; border-radius:16px;
                 border:1px solid rgba(148,163,184,.18);
                 background: rgba(15,23,42,.55);
                 color:#e5e7eb; font-weight:1100; cursor:pointer;">
          เล่นอีกครั้ง
        </button>
      </div>
    </div>
  `;

  wrap.appendChild(card);
  DOC.body.appendChild(wrap);

  // close btn
  wrap.querySelector('#gjEndClose')?.addEventListener('click', ()=>{
    wrap.style.display = 'none';
  });

  return wrap;
}

function showEndOverlay(summary){
  const wrap = ensureEndOverlay();
  const set = (id, v)=>{
    const el = wrap.querySelector(id);
    if(el) el.textContent = String(v ?? '—');
  };
  set('#gjEndScore', summary?.scoreFinal ?? summary?.score ?? 0);
  set('#gjEndMiss',  summary?.miss ?? 0);
  set('#gjEndGrade', summary?.grade ?? '—');
  set('#gjEndCombo', summary?.comboMax ?? 0);

  // buttons
  const hub = summary?.hub || qs('hub', '');
  wrap.querySelector('#gjEndBackHub')?.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  }, { once:true });

  wrap.querySelector('#gjEndReplay')?.addEventListener('click', ()=>{
    location.href = location.href; // preserve params
  }, { once:true });

  wrap.style.display = 'flex';
}

function bootOnce(){
  // Read ctx
  const view = String(qs('view','auto')).toLowerCase();
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = num('time', 80);
  const seed = String(qs('seed', Date.now()));
  const hub  = String(qs('hub','') || '');

  // Boot SAFE engine
  engineBoot({ view, run, diff, time, seed, hub });

  // Listen end -> show overlay (light)
  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || null;
    // ถ้าอยาก “ไม่แสดง” overlay ในโหมด research ก็ปิดได้:
    // if(String(run).toLowerCase()==='research') return;
    showEndOverlay(summary);
  }, { passive:true, once:true });
}

(function init(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    setTimeout(bootOnce, 0);
  }else{
    DOC.addEventListener('DOMContentLoaded', ()=>bootOnce(), { once:true });
  }
})();