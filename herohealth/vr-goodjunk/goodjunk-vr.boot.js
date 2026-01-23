// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Sets body view classes
// ✅ Boots goodjunk.safe.js
// ✅ Renders End Summary Overlay (topmost) + Restart + Back Hub
// ✅ Adds body.ended to prevent VR UI stealing clicks

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}
function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','view-auto');
  b.classList.add('view-' + (view || 'auto'));
}
function getView(){
  const v = String(qs('view','auto')||'auto').toLowerCase();
  if(v==='cardboard' || v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'auto';
}
function getHub(){
  return qs('hub', null);
}
function restartUrl(){
  // restart by reloading same URL but without any end flags
  return location.href;
}

function createEndOverlay(){
  let root = DOC.getElementById('gjEnd');
  if(root) return root;

  root = DOC.createElement('div');
  root.id = 'gjEnd';
  root.className = 'gj-end';
  root.innerHTML = `
    <div class="gj-end-card" role="dialog" aria-label="สรุปผล">
      <div class="end-title">สรุปผล</div>
      <div class="end-sub" id="endSub">บันทึกผลไว้แล้ว</div>

      <div class="end-grid" id="endGrid"></div>

      <div class="end-actions">
        <button class="end-btn primary" id="btnReplay" type="button">เล่นอีกครั้ง</button>
        <button class="end-btn" id="btnBackHub2" type="button">↩ กลับ HUB</button>
        <button class="end-btn" id="btnCloseEnd" type="button">ปิด</button>
      </div>
    </div>
  `;
  DOC.body.appendChild(root);

  // actions
  root.querySelector('#btnReplay')?.addEventListener('click', ()=> location.href = restartUrl());
  root.querySelector('#btnCloseEnd')?.addEventListener('click', ()=>{
    DOC.body.classList.remove('ended');
  });
  root.querySelector('#btnBackHub2')?.addEventListener('click', ()=>{
    const hub = getHub();
    if(hub) location.href = hub;
    else alert('ยังไม่ได้ใส่ hub url');
  });

  // click backdrop closes
  root.addEventListener('click', (e)=>{
    if(e.target === root) DOC.body.classList.remove('ended');
  });

  return root;
}

function renderSummary(summary){
  const root = createEndOverlay();
  const sub = root.querySelector('#endSub');
  const grid = root.querySelector('#endGrid');

  if(sub){
    sub.textContent = `mode=${summary?.runMode||'-'} · diff=${summary?.diff||'-'} · view=${summary?.view||'-'} · time=${summary?.durationPlayedSec||0}s`;
  }
  if(grid){
    const items = [
      ['SCORE', summary?.scoreFinal ?? 0],
      ['MISS', summary?.miss ?? 0],
      ['GRADE', summary?.grade ?? '—'],
      ['COMBO MAX', summary?.comboMax ?? 0],
      ['HIT GOOD', summary?.hitGood ?? 0],
      ['HIT JUNK', summary?.hitJunk ?? 0],
      ['EXPIRE GOOD', summary?.expireGood ?? 0],
      ['SHIELD', summary?.shieldRemaining ?? 0],
    ];
    grid.innerHTML = items.map(([k,v])=>`
      <div class="end-item">
        <div class="end-k">${k}</div>
        <div class="end-v">${String(v)}</div>
      </div>
    `).join('');
  }

  // ✅ สำคัญ: ทำให้ “ไปต่อได้” (overlay อยู่บนสุด + กันชั้นหลังแย่งคลิก)
  DOC.body.classList.add('ended');
}

function onEnd(ev){
  try{
    const summary = ev?.detail || null;
    if(!summary) return;
    renderSummary(summary);
  }catch(_){}
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(()=>{
  const view = getView();
  setBodyView(view);

  // listen end
  WIN.addEventListener('hha:end', onEnd);

  // boot engine (FAIR PACK)
  engineBoot({
    view,
    run: String(qs('run','play')||'play').toLowerCase(),
    diff: String(qs('diff','normal')||'normal').toLowerCase(),
    time: Number(qs('time','80')||80),
    seed: String(qs('seed', Date.now())),
  });
});