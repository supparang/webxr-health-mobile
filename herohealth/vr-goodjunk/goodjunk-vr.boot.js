// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Boots ./goodjunk.safe.js (pack=fair)
// ✅ Sets view class (pc/mobile/vr/cvr) for CSS tuning (optional)
// ✅ End Summary Overlay (on hha:end) + Replay + Back HUB
// ✅ Stores: HHA_LAST_SUMMARY already in safe.js; also appends HHA_SUMMARY_HISTORY (light)
// ✅ Does NOT override view if URL has ?view=... (launcher handles it)

import { boot as safeBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function qs(k, def = null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function has(k){
  try{ return new URL(location.href).searchParams.has(k); }
  catch{ return false; }
}

function normView(v){
  v = String(v||'').toLowerCase();
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cardboard') return 'vr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'mobile') return 'mobile';
  if(v === 'pc') return 'pc';
  return 'mobile';
}

function setBodyViewClass(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(
    view === 'pc' ? 'view-pc' :
    view === 'vr' ? 'view-vr' :
    view === 'cvr' ? 'view-cvr' :
    'view-mobile'
  );
}

function pushHistory(summary){
  try{
    const raw = localStorage.getItem(LS_HIST);
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift(summary);
    while(arr.length > 50) arr.pop();
    localStorage.setItem(LS_HIST, JSON.stringify(arr));
  }catch(_){}
}

function ensureOverlay(){
  if(DOC.getElementById('gjEndOverlay')) return;

  const ov = DOC.createElement('div');
  ov.id = 'gjEndOverlay';
  ov.setAttribute('aria-hidden','true');
  ov.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    display:none; align-items:center; justify-content:center;
    padding: calc(14px + env(safe-area-inset-top,0px)) 14px calc(14px + env(safe-area-inset-bottom,0px)) 14px;
    background: rgba(2,6,23,.62);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  `;

  ov.innerHTML = `
    <div style="
      width:min(560px, 94vw);
      border-radius:22px;
      border:1px solid rgba(148,163,184,.22);
      background: rgba(2,6,23,.78);
      box-shadow: 0 28px 90px rgba(0,0,0,.6);
      padding: 16px 16px 14px;
      color:#e5e7eb;
      font-family: system-ui,-apple-system,'Segoe UI','Noto Sans Thai',sans-serif;
    ">
      <div style="font-weight:1200;font-size:20px;letter-spacing:.2px;">สรุปผลการเล่น</div>
      <div id="gjEndSub" style="margin-top:6px;color:rgba(148,163,184,.95);font-weight:900;font-size:12px;">
        GoodJunkVR · FAIR pack
      </div>

      <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:10px 12px;background:rgba(2,6,23,.52)">
          <div style="font-size:10px;letter-spacing:.6px;color:rgba(148,163,184,.95);font-weight:1000;">SCORE</div>
          <div id="gjEndScore" style="margin-top:3px;font-size:22px;font-weight:1300;">0</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:10px 12px;background:rgba(2,6,23,.52)">
          <div style="font-size:10px;letter-spacing:.6px;color:rgba(148,163,184,.95);font-weight:1000;">GRADE</div>
          <div id="gjEndGrade" style="margin-top:3px;font-size:22px;font-weight:1300;">—</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:10px 12px;background:rgba(2,6,23,.52)">
          <div style="font-size:10px;letter-spacing:.6px;color:rgba(148,163,184,.95);font-weight:1000;">MISS</div>
          <div id="gjEndMiss" style="margin-top:3px;font-size:20px;font-weight:1200;">0</div>
        </div>
        <div style="border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:10px 12px;background:rgba(2,6,23,.52)">
          <div style="font-size:10px;letter-spacing:.6px;color:rgba(148,163,184,.95);font-weight:1000;">COMBO MAX</div>
          <div id="gjEndCombo" style="margin-top:3px;font-size:20px;font-weight:1200;">0</div>
        </div>
      </div>

      <div id="gjEndMeta" style="margin-top:10px;color:rgba(148,163,184,.95);font-weight:900;font-size:12px;line-height:1.5;">
        —
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="gjBtnReplay" type="button" style="
          height:48px; padding:0 14px; border-radius:16px;
          border:1px solid rgba(34,197,94,.35);
          background: rgba(34,197,94,.16);
          color:#eafff3; font-weight:1200; cursor:pointer;
        ">▶ เล่นอีกครั้ง</button>

        <button id="gjBtnBack" type="button" style="
          height:48px; padding:0 14px; border-radius:16px;
          border:1px solid rgba(148,163,184,.22);
          background: rgba(2,6,23,.40);
          color:#e5e7eb; font-weight:1200; cursor:pointer;
        ">↩ กลับ HUB</button>

        <button id="gjBtnClose" type="button" style="
          height:48px; padding:0 14px; border-radius:16px;
          border:1px solid rgba(148,163,184,.18);
          background: transparent;
          color: rgba(148,163,184,.95); font-weight:1200; cursor:pointer;
        ">ปิด</button>
      </div>

      <div style="margin-top:10px;color:rgba(148,163,184,.92);font-weight:900;font-size:11px;">
        * บันทึกผลล่าสุดไว้แล้ว (HHA_LAST_SUMMARY)
      </div>
    </div>
  `;

  DOC.body.appendChild(ov);

  const close = ()=>{ ov.style.display='none'; ov.setAttribute('aria-hidden','true'); };
  ov.addEventListener('click', (e)=>{ if(e.target===ov) close(); });
  DOC.getElementById('gjBtnClose')?.addEventListener('click', close);
}

function showOverlay(summary){
  ensureOverlay();
  const ov = DOC.getElementById('gjEndOverlay');
  if(!ov) return;

  const v = normView(summary?.view ?? qs('view','mobile'));
  const run = String(summary?.runMode ?? qs('run','play'));
  const diff = String(summary?.diff ?? qs('diff','normal'));
  const time = summary?.durationPlayedSec ?? null;
  const seed = summary?.seed ?? qs('seed','');

  const score = summary?.scoreFinal ?? 0;
  const miss  = summary?.miss ?? 0;
  const grade = summary?.grade ?? '—';
  const combo = summary?.comboMax ?? 0;

  const hub = qs('hub', null);

  const set = (id,val)=>{ const el=DOC.getElementById(id); if(el) el.textContent=String(val); };
  set('gjEndScore', score);
  set('gjEndMiss', miss);
  set('gjEndGrade', grade);
  set('gjEndCombo', combo);

  const meta = DOC.getElementById('gjEndMeta');
  if(meta){
    meta.textContent = `view=${v} · run=${run} · diff=${diff}` + (time!=null ? ` · played=${time}s` : '') + (seed ? ` · seed=${seed}` : '');
  }

  DOC.getElementById('gjBtnReplay')?.addEventListener('click', ()=>{
    // replay with same params
    location.reload();
  }, { once:true });

  DOC.getElementById('gjBtnBack')?.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  }, { once:true });

  ov.style.display='flex';
  ov.setAttribute('aria-hidden','false');
}

function bootNow(){
  const view = normView(qs('view','mobile'));
  setBodyViewClass(view);

  const opts = {
    view,
    run:  String(qs('run','play')),
    diff: String(qs('diff','normal')),
    time: Number(qs('time','80')) || 80,
    seed: qs('seed', Date.now())
  };

  // Listen end summary
  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || null;

    // append history (light)
    if(summary){
      pushHistory(summary);
      try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
    }else{
      // fallback if safe already stored it
      try{
        const raw = localStorage.getItem(LS_LAST);
        if(raw) pushHistory(JSON.parse(raw));
      }catch(_){}
    }

    showOverlay(summary || (()=>{
      try{ return JSON.parse(localStorage.getItem(LS_LAST) || 'null'); }catch(_){ return null; }
    })());
  }, { passive:true });

  // Boot SAFE pack
  safeBoot(opts);
}

// Give the HUD-safe measurement script time to set --gj-top-safe/--gj-bottom-safe
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', ()=> setTimeout(bootNow, 80), { once:true });
}else{
  setTimeout(bootNow, 80);
}