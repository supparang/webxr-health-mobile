// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + diagnostics + readable fatal)
//
// ✅ Imports engine: ./hygiene.safe.js (must export boot)
// ✅ Waits a moment for defer scripts to register globals (Particles, Quiz bank)
// ✅ If missing DOM / CSS / quiz / fx: show warnings (non-fatal except engine import)
// ✅ If import fails: show fatal on screen (not "stuck")
//
'use strict';

function $id(id){ return document.getElementById(id); }
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

function setBanner(msg, isBad){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = msg;
  banner.classList.add('show');
  banner.style.borderColor = isBad ? 'rgba(239,68,68,.35)' : 'rgba(34,197,94,.25)';
  banner.style.background  = isBad ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.08)';
  clearTimeout(setBanner._t);
  setBanner._t = setTimeout(()=>{ try{ banner.classList.remove('show'); }catch{} }, isBad ? 6000 : 1400);
}

function showFatal(msg, err){
  console.error('[HygieneBoot]', msg, err||'');
  const sub = $id('hudSub');
  const startOverlay = $id('startOverlay');
  const startSub = $id('startSub');

  if(sub) sub.textContent = `BOOT ERROR: ${msg}`;
  setBanner(`❌ ${msg}`, true);

  if(startOverlay){
    startOverlay.style.display = 'grid';
    if(startSub){
      startSub.innerHTML = `
        <b style="color:#fecaca">เกิดปัญหาโหลดเกม</b><br>
        <span style="color:#94a3b8">${msg}</span><br>
        <span style="color:#94a3b8">เช็ค Console/Network ว่าไฟล์ 404 หรือ import ผิด</span>
      `;
    }
  }
}

function showWarn(msg){
  console.warn('[HygieneBoot]', msg);
  // ไม่ fatal — แค่เตือนบนจอให้ครู/เด็กเห็น
  const sub = $id('hudSub');
  if(sub){
    const t = sub.textContent || '';
    if(!t.includes('⚠️')) sub.textContent = `⚠️ ${msg}`;
  }
  setBanner(`⚠️ ${msg}`, false);
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

function cssLoadedHint(){
  // ตรวจว่ามี stylesheet ที่ชื่อ hygiene-vr.css จริงไหม
  try{
    return Array.from(document.styleSheets||[]).some(s=>{
      try{ return (s.href||'').includes('hygiene-vr.css'); }catch{ return false; }
    });
  }catch{ return false; }
}

function quizLoadedHint(){
  const bank = window.HHA_HYGIENE_QUIZ_BANK;
  return Array.isArray(bank) && bank.length>0;
}

function particlesLoadedHint(){
  return !!(window.Particles && typeof window.Particles.popText === 'function');
}

function updateDiag(){
  // อัปเดต diagnostics บน start overlay (ถ้ามี)
  const cssOk = cssLoadedHint();
  const fxOk  = particlesLoadedHint();
  const quizOk= quizLoadedHint();

  const elCss = $id('diagCss');
  const elFx  = $id('diagFx');
  const elQz  = $id('diagQuiz');

  if(elCss){
    elCss.textContent = cssOk ? '✅ css ok' : '⚠️ css missing?';
    elCss.style.color = cssOk ? 'rgba(34,197,94,.92)' : 'rgba(245,158,11,.92)';
  }
  if(elFx){
    elFx.textContent = fxOk ? '✅ fx ok' : '⚠️ fx missing?';
    elFx.style.color = fxOk ? 'rgba(34,197,94,.92)' : 'rgba(245,158,11,.92)';
  }
  if(elQz){
    const bank = window.HHA_HYGIENE_QUIZ_BANK;
    elQz.textContent = quizOk ? `✅ quiz ${bank.length}` : '⚠️ quiz missing?';
    elQz.style.color = quizOk ? 'rgba(34,197,94,.92)' : 'rgba(245,158,11,.92)';
  }

  return { cssOk, fxOk, quizOk };
}

async function main(){
  // 0) DOM presence
  const stage = $id('stage');
  if(!stage){
    showFatal('ไม่พบ #stage (hygiene-vr.html ไม่ครบหรือ id ไม่ตรง)');
    return;
  }

  // 1) set basic labels early
  const hudSub = $id('hudSub');
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  if(hudSub) hudSub.textContent = `booting… (${runMode}/${diff}/${view})`;

  // 2) wait a little for defer scripts (particles/quiz) to register
  //    (สำคัญ! ไม่งั้นคุณจะเห็นเหมือน "Effect หาย" ทั้งที่โหลดช้ากว่า)
  await sleep(120);
  // และรอ DOMContentLoaded ให้แน่ใจ (บางเครื่อง)
  if(document.readyState === 'loading'){
    await new Promise(res=>document.addEventListener('DOMContentLoaded', res, { once:true }));
  }
  await sleep(60);

  // 3) diagnostics (non-fatal)
  const diag = updateDiag();

  // CSS missing -> เกมอาจดูเหมือนค้าง (เป้าไม่มีสไตล์/ตำแหน่ง/ชั้น)
  if(!diag.cssOk){
    showWarn('CSS อาจไม่ถูกโหลด (เช็ค Network: hygiene-vr.css 404?)');
  }

  // Particles missing -> Effect หาย
  if(!diag.fxOk){
    showWarn('Particles (FX) ยังไม่มา (เช็ค ../vr/particles.js 404?)');
  }

  // Quiz missing -> เกมเล่นได้ แต่ quiz ไม่ขึ้น
  if(!diag.quizOk){
    // เฉพาะเตือน — ไม่ fatal
    showWarn('Quiz bank ยังไม่มา (เช็ค ./hygiene-quiz-bank.js 404?)');
  }

  // 4) Import engine safely
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

  // 5) Run engine boot
  try{
    engine.boot();
    if(hudSub) hudSub.textContent = `ready ✓ (${runMode}/${diff}/${view})`;
    console.log('[HygieneBoot] engine.boot OK');
    setBanner('✅ โหลดเกมสำเร็จ', false);
  }catch(err){
    showFatal('engine.boot() crash', err);
  }
}

main();