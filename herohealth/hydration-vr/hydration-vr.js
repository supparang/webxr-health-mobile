// === /herohealth/hydration-vr/hydration-vr.js ===
// Loader for HydrationVR
// ✅ bootstrap Firebase compat if available
// ✅ import hydration.safe.js
// ✅ call boot()
// ✅ install Post-game Evaluate/Create/Analyze without touching core engine
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
      const post = await import('./hydration-postgame.js');
      if (post && typeof post.installHydrationPostgame === 'function') {
        post.installHydrationPostgame();
      }
    }catch(postErr){
      console.warn('[hydration-vr.js] postgame module failed:', postErr);
      showHydrationToast('โหลด Post-game module ไม่สำเร็จ: ' + (postErr?.message || postErr), 'warn');
    }

    console.log('[hydration-vr.js] HydrationVR booted successfully');

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

function showHydrationToast(text, level){
  try{
    const el = document.createElement('div');
    el.textContent = String(text || '');
    el.style.position = 'fixed';
    el.style.left = '12px';
    el.style.right = '12px';
    el.style.bottom = '12px';
    el.style.zIndex = '3100';
    el.style.padding = '10px 12px';
    el.style.borderRadius = '16px';
    el.style.color = '#fff';
    el.style.font = '13px system-ui, sans-serif';
    el.style.boxShadow = '0 14px 34px rgba(0,0,0,.28)';
    el.style.border = '1px solid rgba(255,255,255,.14)';
    el.style.background = level === 'warn'
      ? 'rgba(146,64,14,.94)'
      : 'rgba(7,18,38,.94)';
    document.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 3600);
  }catch(_){}
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootHydrationVR, { once:true });
} else {
  bootHydrationVR();
}