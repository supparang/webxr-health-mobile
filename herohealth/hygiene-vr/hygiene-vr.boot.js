// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// Boot HygieneVR — PRODUCTION (anti-stall + readable diagnostics)
//
// ✅ Imports engine: ./hygiene.safe.js (must export boot)
// ✅ If missing DOM / import fails / crash -> show readable error on screen
// ✅ Warn if CSS missing / Quiz bank missing / Particles missing
//
'use strict';

function $id(id){ return document.getElementById(id); }

function setBanner(text){
  const banner = $id('banner');
  if(!banner) return;
  banner.textContent = String(text || '');
  banner.classList.add('show');
}

function setHudSub(text){
  const sub = $id('hudSub');
  if(sub) sub.textContent = String(text || '');
}

function showOverlayError(title, detail){
  const startOverlay = $id('startOverlay');
  if(!startOverlay) return;

  const sub = startOverlay.querySelector('.hw-card-sub');
  if(sub){
    sub.innerHTML = `
      <b style="color:#fca5a5">${title}</b><br>
      <span style="color:#94a3b8">${detail || ''}</span><br>
      <span style="color:#94a3b8">เปิด DevTools → Console/Network เพื่อตรวจ 404 หรือ path ผิด</span>
    `;
  }
  startOverlay.style.display = 'grid';
}

function showFatal(msg, err){
  console.error('[HygieneBoot] FATAL:', msg, err || '');
  setHudSub(`BOOT ERROR: ${msg}`);
  setBanner(`❌ ${msg}`);
  showOverlayError('เกิดปัญหาโหลดเกม', msg);
}

function warn(msg){
  console.warn('[HygieneBoot] WARN:', msg);
  // ไม่บล็อกเกม แค่เตือนให้เห็น
  const sub = $id('hudSub');
  if(sub && (sub.textContent || '').includes('ready')) sub.textContent = `⚠️ ${msg}`;
}

function cssLooksLoaded(){
  // best-effort: check any stylesheet href contains hygiene-vr.css
  try{
    const sheets = Array.from(document.styleSheets || []);
    return sheets.some(s => {
      try{ return (s.href || '').includes('hygiene-vr.css'); }catch{ return false; }
    });
  }catch{ return false; }
}

function domHasCore(){
  // ถ้า id ไม่ครบ จะดูเหมือนค้าง
  const need = ['stage','hudSub','startOverlay','banner','btnStart'];
  return need.every(id => !!$id(id));
}

function stableTickDelay(fn){
  // requestAnimationFrame then microtask to avoid "DOM not ready" edge cases
  requestAnimationFrame(()=> Promise.resolve().then(fn));
}

async function main(){
  // 1) DOM sanity
  if(!domHasCore()){
    showFatal('DOM ของ hygiene-vr.html ไม่ครบ (เช็ค id: stage/hudSub/startOverlay/banner/btnStart)');
    return;
  }

  // 2) Quick non-blocking diagnostics
  if(!cssLooksLoaded()){
    warn('CSS อาจไม่ถูกโหลด (เช็ค Network: hygiene-vr.css)');
  }
  // FX / Quiz bank are optional แต่ถ้าหายจะรู้สึก “โล่ง”
  if(!window.Particles){
    warn('Particles FX ไม่ขึ้น (เช็ค ../vr/particles.js)');
  }
  // bank ชื่อไฟล์คุณคือ hygiene-quiz-bank.js และตั้ง window.HHA_HYGIENE_QUIZ_BANK
  if(!window.HHA_HYGIENE_QUIZ_BANK){
    warn('Quiz bank ไม่พบ (เช็ค ./hygiene-quiz-bank.js)');
  }

  // 3) Import engine safely (module)
  let engine;
  try{
    engine = await import('./hygiene.safe.js');
  }catch(err){
    showFatal('import hygiene.safe.js ไม่สำเร็จ (ไฟล์หาย/พาธผิด/ไม่ได้เป็น module)', err);
    return;
  }

  if(!engine || typeof engine.boot !== 'function'){
    showFatal('hygiene.safe.js ต้อง export function boot()');
    return;
  }

  // 4) Anti-stall: ถ้า boot ไม่ทำงานหรือ throw ให้แสดงบนจอ
  let booted = false;

  // watchdog: ถ้า 1.8s แล้วยังไม่ booted ให้เตือน (แต่ไม่บล็อก)
  const watchdog = setTimeout(()=>{
    if(!booted){
      warn('Boot ช้า/เหมือนค้าง (เช็ค Console/Network ว่ามี 404 หรือ error)');
      setBanner('⏳ กำลังโหลด... (ถ้าค้าง เปิด Console ดู error)');
    }
  }, 1800);

  try{
    stableTickDelay(()=>{
      try{
        engine.boot();
        booted = true;
        clearTimeout(watchdog);
        console.log('[HygieneBoot] engine.boot OK');
      }catch(err){
        clearTimeout(watchdog);
        showFatal('engine.boot() crash', err);
      }
    });
  }catch(err){
    clearTimeout(watchdog);
    showFatal('boot wrapper crash', err);
  }
}

main();
