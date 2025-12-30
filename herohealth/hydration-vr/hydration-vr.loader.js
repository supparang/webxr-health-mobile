// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION
// ✅ Start overlay gate (#startOverlay)
// ✅ Toggle Cardboard (dual layer L/R) + landscape lock best-effort
// ✅ Buttons: Cardboard / Shoot / Stop
// ✅ Boots hydration.safe.js once DOM ready
// ✅ Provides window.HHA_VIEW for engine (active layers/playfield)

'use strict';

import './hydration.safe.js';

const D = document;

const startOverlay = D.getElementById('startOverlay');
const btnStart     = D.getElementById('btnStart');
const btnEnterVR   = D.getElementById('btnEnterVR');

const btnCardboard = D.getElementById('btnCardboard');
const btnShoot     = D.getElementById('btnShoot');
const btnStop      = D.getElementById('btnStop');

const playfield    = D.getElementById('playfield');
const cbPlayfield  = D.getElementById('cbPlayfield');

const layerMain    = D.getElementById('hydration-layer');
const layerL       = D.getElementById('hydration-layerL');
const layerR       = D.getElementById('hydration-layerR');

function isCardboard(){
  return D.body.classList.contains('cardboard');
}

async function lockLandscape(){
  try{
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
      return true;
    }
  }catch(_){}
  return false;
}
async function unlockOrientation(){
  try{
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  }catch(_){}
}

function syncViewConfig(){
  // ให้ engine รู้ว่าใช้ layer ไหน
  const cb = isCardboard() && layerL && layerR;
  window.HHA_VIEW = {
    cardboard: !!cb,
    playfieldId: cb ? 'cbPlayfield' : 'playfield',
    layers: cb ? ['hydration-layerL','hydration-layerR'] : ['hydration-layer']
  };
}

async function enterCardboard(){
  D.body.classList.add('cardboard');
  await lockLandscape();
  syncViewConfig();
}
async function exitCardboard(){
  D.body.classList.remove('cardboard');
  await unlockOrientation();
  syncViewConfig();
}

function hideStart(){
  if (!startOverlay) return;
  startOverlay.style.display = 'none';
}

function clickNearestTarget(){
  // ช่วยยิงแบบ Cardboard: ยิงเป้าใกล้กลางจอที่สุด
  const L = (isCardboard() ? layerL : layerMain) || layerMain || layerL;
  if (!L) return;

  const targets = Array.from(L.querySelectorAll('.hvr-target, .hha-target, [data-target="1"]'));
  if (!targets.length) return;

  const rect = L.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;

  let best=null, bestD=1e18;
  for (const t of targets){
    const r = t.getBoundingClientRect();
    const tx = r.left + r.width/2;
    const ty = r.top + r.height/2;
    const d = (tx-cx)*(tx-cx) + (ty-cy)*(ty-cy);
    if (d < bestD){ bestD=d; best=t; }
  }
  if (!best) return;

  try{
    best.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, pointerType:'mouse', isPrimary:true }));
  }catch(_){}
}

function holdButton(btn, fn, holdMs=650){
  if (!btn) return;
  let t=null;
  const clear=()=>{ if(t){ clearTimeout(t); t=null; } btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown',(ev)=>{
    try{ ev.preventDefault(); }catch(_){}
    btn.classList.add('holding');
    t=setTimeout(()=>{ clear(); fn(); }, holdMs);
  },{passive:false});
  btn.addEventListener('pointerup', clear, {passive:true});
  btn.addEventListener('pointercancel', clear, {passive:true});
  btn.addEventListener('mouseleave', clear, {passive:true});
}

function boot(){
  // default config
  syncViewConfig();

  btnStart?.addEventListener('click', ()=>{
    hideStart();
    syncViewConfig();
    window.dispatchEvent(new CustomEvent('hha:start'));
  }, {passive:true});

  btnEnterVR?.addEventListener('click', async ()=>{
    await enterCardboard();
    hideStart();
    window.dispatchEvent(new CustomEvent('hha:start'));
  }, {passive:true});

  btnCardboard?.addEventListener('click', async ()=>{
    if (!isCardboard()) await enterCardboard();
    else await exitCardboard();
  }, {passive:true});

  btnShoot?.addEventListener('click', clickNearestTarget, {passive:true});

  holdButton(btnStop, ()=>{
    window.dispatchEvent(new CustomEvent('hha:force_end', { detail:{ reason:'stop' } }));
  }, 650);

  // ถ้า body มี cardboard มาจาก query/เดิม ให้ sync
  syncViewConfig();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once:true });
} else {
  boot();
}