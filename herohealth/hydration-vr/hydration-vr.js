// === /herohealth/hydration-vr/hydration-vr.js ===
// Loader for HydrationVR
// ✅ bootstrap Firebase compat if available
// ✅ import hydration.safe.js
// ✅ call boot()
// ✅ show visible error if boot fails

'use strict';

async function bootHydrationVR(){
  try{
    if (typeof window.HHA_bootstrapFirebaseCompat === 'function') {
      window.HHA_bootstrapFirebaseCompat();
    }

    const mod = await import('./hydration.safe.js');

    if (!mod || typeof mod.boot !== 'function') {
      throw new Error('hydration.safe.js ไม่พบฟังก์ชัน export boot()');
    }

    await mod.boot();

    try{
      console.log('[hydration-vr.js] HydrationVR booted successfully');
    }catch(_){}

  }catch(err){
    console.error('[hydration-vr.js] boot failed:', err);

    const fail = document.createElement('div');
    fail.style.position = 'fixed';
    fail.style.left = '12px';
    fail.style.right = '12px';
    fail.style.bottom = '12px';
    fail.style.zIndex = '3000';
    fail.style.padding = '12px 14px';
    fail.style.borderRadius = '18px';
    fail.style.background = 'rgba(127,29,29,.94)';
    fail.style.border = '1px solid rgba(254,202,202,.28)';
    fail.style.color = '#fff';
    fail.style.font = '14px system-ui, sans-serif';
    fail.style.boxShadow = '0 16px 40px rgba(0,0,0,.28)';
    fail.textContent = 'เปิดเกม Hydration ไม่สำเร็จ: ' + (err?.message || err);

    document.body.appendChild(fail);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootHydrationVR, { once:true });
} else {
  bootHydrationVR();
}