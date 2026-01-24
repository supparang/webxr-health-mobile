// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Sets body view class from ?view=
// ✅ Passes opts to goodjunk.safe.js boot()
// ✅ Adds lightweight End Summary overlay + Back HUB + Replay
// ✅ Keeps HUD safe measurement (done in HTML) untouched

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  const v = String(view||'').toLowerCase();
  if(v==='pc') b.classList.add('view-pc');
  else if(v==='vr') b.classList.add('view-vr');
  else if(v==='cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function makeOverlay(){
  const wrap = DOC.createElement('div');
  wrap.id = 'gjEndOverlay';
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:999;
    display:none; align-items:center; justify-content:center;
    padding:24px; background:rgba(2,6,23,.72);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  `;

  const card = DOC.createElement('div');
  card.style.cssText = `
    width:min(720px, 94vw);
    background:rgba(2,6,23,.82);
    border:1px solid rgba(148,163,184,.22);
    border-radius:22px;
    box-shadow:0 18px 55px rgba(0,0,0,.55);
    padding:18px;
    color:#e5e7eb;
    font-family:system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
  `;
  card.innerHTML = `
    <div style="font-weight:1200;font-size:18px;">สรุปผล GoodJunkVR</div>
    <div id="gjEndMeta" style="margin-top:8px;color:rgba(148,163,184,.92);font-weight:900;font-size:12px;line-height:1.45"></div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
      <button id="gjReplay" style="height:44px;padding:0 14px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.55);color:#e5e7eb;font-weight:1100;cursor:pointer">เล่นอีกครั้ง</button>
      <button id="gjBackHub2" style="height:44px;padding:0 14px;border-radius:16px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.16);color:#eafff3;font-weight:1200;cursor:pointer">↩ กลับ HUB</button>
    </div>
  `;

  wrap.appendChild(card);
  DOC.body.appendChild(wrap);

  const hub = qs('hub', null);
  card.querySelector('#gjBackHub2')?.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  });
  card.querySelector('#gjReplay')?.addEventListener('click', ()=>{
    location.reload();
  });

  return wrap;
}

function showOverlay(summary){
  let ov = DOC.getElementById('gjEndOverlay');
  if(!ov) ov = makeOverlay();
  const meta = ov.querySelector('#gjEndMeta');

  const lines = [
    `คะแนน: ${summary?.scoreFinal ?? 0} | MISS: ${summary?.miss ?? 0} | เกรด: ${summary?.grade ?? '—'}`,
    `คอมโบสูงสุด: ${summary?.comboMax ?? 0}`,
    `GOOD: ${summary?.hitGood ?? 0} | JUNK HIT: ${summary?.hitJunk ?? 0} | GOOD EXPIRE: ${summary?.expireGood ?? 0}`,
    `โหมด: view=${summary?.view ?? '-'} · run=${summary?.runMode ?? '-'} · diff=${summary?.diff ?? '-'} · time=${summary?.durationPlayedSec ?? 0}s`,
  ];
  if(meta) meta.innerHTML = lines.map(s=>`<div>${s}</div>`).join('');

  ov.style.display = 'flex';
}

function main(){
  const view = String(qs('view','mobile')).toLowerCase();
  setBodyView(view);

  const opts = {
    view,
    run: String(qs('run','play')).toLowerCase(),
    diff: String(qs('diff','normal')).toLowerCase(),
    time: Number(qs('time','80')) || 80,
    seed: qs('seed', Date.now()),
  };

  WIN.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || null;
    showOverlay(summary);
  });

  engineBoot(opts);
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
} else {
  main();
}