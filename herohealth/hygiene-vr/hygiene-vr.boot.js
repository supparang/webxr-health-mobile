// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// HygieneVR BOOT — PRODUCTION
// ✅ Starts hygiene.safe.js boot() safely after DOM ready
// ✅ Never crashes: global error traps + guarded boot
// ✅ Logs version + confirms quiz bank/particles availability

import { boot } from './hygiene.safe.js';

const WIN = window;

function log(...a){ try{ console.log('[HygieneVR.boot]', ...a); }catch{} }

function safeRun(fn){
  try{ fn(); }catch(err){
    try{ console.error('[HygieneVR.boot] error:', err); }catch{}
  }
}

function ready(cb){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>cb(), { once:true });
  } else cb();
}

function attachGlobalTraps(){
  // uncaught errors
  WIN.addEventListener('error', (e)=>{
    try{
      console.error('[HygieneVR] uncaught error:', e?.message || e, e?.error || '');
    }catch{}
  });

  // unhandled promise rejections
  WIN.addEventListener('unhandledrejection', (e)=>{
    try{
      console.error('[HygieneVR] unhandledrejection:', e?.reason || e);
    }catch{}
  });
}

function bootOnce(){
  if(WIN.__HHA_HYGIENE_BOOTED__) return;
  WIN.__HHA_HYGIENE_BOOTED__ = true;

  // quick sanity logs
  const hasParticles = !!WIN.Particles;
  const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
  log('v=20260201b', 'Particles=', hasParticles ? 'yes' : 'no',
      'QuizBank=', Array.isArray(bank) ? bank.length : 'missing');

  safeRun(()=>boot());
}

attachGlobalTraps();

// Boot after DOM ready (defer scripts should already be executed by then)
ready(()=>{
  // micro-delay helps on some mobile WebView ordering
  setTimeout(()=>bootOnce(), 0);
});