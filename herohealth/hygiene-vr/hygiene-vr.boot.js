// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION — PATCH v20260308d
// ✅ Wait for deferred globals (Particles + Quiz bank) then boot engine safely
// ✅ Wire Handwash end overlay -> cooldown gate
// ✅ Auto-relabel end button to cooldown
'use strict';

import { buildCooldownUrlForCurrentGame } from '../gate/helpers/gate-link.js';

function $id(id){ return document.getElementById(id); }

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }
  catch{ return d; }
}

function showBanner(msg){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1600);
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  const sub = $id('hudSub');
  const banner = $id('banner');
  const startOverlay = $id('startOverlay');

  if(sub) sub.textContent = `BOOT ERROR: ${msg}`;
  if(banner){
    banner.textContent = `❌ ${msg}`;
    banner.classList.add('show');
  }
  if(startOverlay){
    const card = startOverlay.querySelector('.hw-card-sub');
    if(card){
      card.innerHTML = `
        <b style="color:#fca5a5">เกิดปัญหาโหลดเกม</b><br>
        <span style="color:#94a3b8">${msg}</span><br>
        <span style="color:#94a3b8">เปิด Console/Network ดูว่าไฟล์ 404 หรือ import ผิด</span>
      `;
    }
    startOverlay.style.display = 'grid';
  }
}

function waitForGlobal(getter, ms){
  const t0 = Date.now();
  return new Promise((resolve)=>{
    (function tick(){
      try{
        const v = getter();
        if(v) return resolve(v);
      }catch{}
      if(Date.now() - t0 >= ms) return resolve(null);
      setTimeout(tick, 50);
    })();
  });
}

function goHub(){
  const hub = qs('hub', '../hub.html');
  location.href = hub;
}

function buildHandwashCooldownUrl(){
  const endTitle = $id('endTitle')?.textContent?.trim() || '';
  const endSub   = $id('endSub')?.textContent?.trim() || '';
  const sumAcc   = $id('sumAcc')?.textContent?.trim() || '';
  const sumMiss  = $id('sumMiss')?.textContent?.trim() || '';
  const sumTop   = $id('sumTop')?.textContent?.trim() || '';
  const sumTip   = $id('sumTip')?.textContent?.trim() || '';

  return buildCooldownUrlForCurrentGame({
    cat: 'hygiene',
    game: 'handwash',
    theme: 'handwash',
    fallbackHub: '../hub.html',
    extras: {
      endTitle,
      endSub,
      sumAcc,
      sumMiss,
      sumTop,
      sumTip
    }
  });
}

function goHandwashCooldown(){
  location.href = buildHandwashCooldownUrl();
}

function wireStaticButtons(){
  $id('btnBack2')?.addEventListener('click', goHub);
}

function wireEndOverlayButtons(){
  const btnBackEnd = $id('btnBackEnd');
  if(btnBackEnd && !btnBackEnd.dataset.cooldownWired){
    btnBackEnd.dataset.cooldownWired = '1';
    btnBackEnd.textContent = '➡ ไปคูลดาวน์';
    btnBackEnd.addEventListener('click', (ev)=>{
      ev.preventDefault();
      goHandwashCooldown();
    });
  }

  const endOverlay = $id('endOverlay');
  if(!endOverlay) return;

  const mo = new MutationObserver(()=>{
    const btn = $id('btnBackEnd');
    if(btn && !btn.dataset.cooldownWired){
      btn.dataset.cooldownWired = '1';
      btn.textContent = '➡ ไปคูลดาวน์';
      btn.addEventListener('click', (ev)=>{
        ev.preventDefault();
        goHandwashCooldown();
      });
    }
  });

  mo.observe(endOverlay, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });
}

async function main(){
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  wireStaticButtons();
  wireEndOverlayButtons();

  const P = await waitForGlobal(()=>window.Particles, 900);
  if(!P) showBanner('⚠️ FX ไม่พร้อม (particles.js อาจหาย/404)');

  const bank = await waitForGlobal(()=>window.HHA_HYGIENE_QUIZ_BANK, 900);
  if(!bank) showBanner('⚠️ Quiz bank ไม่พร้อม (hygiene-quiz-bank.js อาจหาย/404)');

  let engine;
  try{
    engine = await import('./hygiene.safe.js');
  }catch(err){
    showFatal('import hygiene.safe.js ไม่สำเร็จ (ไฟล์หาย/พาธผิด/ไม่ใช่ module)', err);
    return;
  }

  if(!engine || typeof engine.boot !== 'function'){
    showFatal('hygiene.safe.js ต้อง export function boot()');
    return;
  }

  try{
    engine.boot();
    console.log('[HygieneBoot] engine.boot OK');

    // กันกรณี engine สร้าง/แก้ปุ่มหลัง boot
    setTimeout(wireEndOverlayButtons, 0);
    setTimeout(wireEndOverlayButtons, 300);
    setTimeout(wireEndOverlayButtons, 1000);
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}
main();
