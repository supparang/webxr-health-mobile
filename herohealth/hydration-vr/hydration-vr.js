// === /herohealth/hydration-vr/hydration-vr.js ===
// Loader for HydrationVR
// PATCH v20260427-HYDRATION-LOADER-POSTGAME-CHALLENGE
//
// หน้าที่:
// ✅ bootstrap Firebase compat ถ้ามี
// ✅ import hydration.safe.js
// ✅ call boot()
// ✅ install Post-game Evaluate/Create/Analyze ผ่าน hydration-postgame.js
// ✅ install Challenge Pack ผ่าน hydration-challenge.js
// ✅ ไม่แตะ core engine ใน hydration.safe.js
// ✅ แสดง error ชัดเจนถ้า boot ไม่สำเร็จ

'use strict';

const HYDRATION_VR_LOADER_PATCH = 'v20260427-HYDRATION-LOADER-POSTGAME-CHALLENGE';

async function bootHydrationVR(){
  try{
    // 1) Bootstrap Firebase compat ถ้าหน้า HTML มี helper นี้
    try{
      if (typeof window.HHA_bootstrapFirebaseCompat === 'function') {
        window.HHA_bootstrapFirebaseCompat();
      }
    }catch(firebaseErr){
      console.warn('[hydration-vr.js] Firebase bootstrap warning:', firebaseErr);
    }

    // 2) โหลด core game engine
    const mod = await import('./hydration.safe.js');

    if (!mod || typeof mod.boot !== 'function') {
      throw new Error('hydration.safe.js ไม่พบฟังก์ชัน export boot()');
    }

    // 3) Boot main game
    await mod.boot();

    // 4) โหลด post-game module แบบ safe
    try{
      const post = await import('./hydration-postgame.js');

      if (post && typeof post.installHydrationPostgame === 'function') {
        post.installHydrationPostgame();
      } else {
        console.warn('[hydration-vr.js] hydration-postgame.js loaded but installHydrationPostgame() not found');
      }
    }catch(postErr){
      console.warn('[hydration-vr.js] postgame module failed:', postErr);
      showHydrationToast(
        'โหลด Post-game module ไม่สำเร็จ: ' + (postErr?.message || postErr),
        'warn'
      );
    }

    // 5) โหลด Challenge Pack แบบ safe
    try{
      const ch = await import('./hydration-challenge.js');

      if (ch && typeof ch.installHydrationChallenge === 'function') {
        ch.installHydrationChallenge();
      } else {
        console.warn('[hydration-vr.js] hydration-challenge.js loaded but installHydrationChallenge() not found');
      }
    }catch(chErr){
      console.warn('[hydration-vr.js] challenge module failed:', chErr);
      showHydrationToast(
        'โหลด Challenge Pack ไม่สำเร็จ: ' + (chErr?.message || chErr),
        'warn'
      );
    }

    console.log('[hydration-vr.js] HydrationVR booted successfully', HYDRATION_VR_LOADER_PATCH);

  }catch(err){
    console.error('[hydration-vr.js] boot failed:', err);
    showBootError(err);
  }
}

function showBootError(err){
  try{
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
    fail.style.whiteSpace = 'pre-wrap';
    fail.textContent =
      'เปิดเกม Hydration ไม่สำเร็จ\n' +
      String(err?.message || err || 'Unknown error');

    document.body.appendChild(fail);
  }catch(_){}
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

    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
    }, 3600);
  }catch(_){}
}

// Boot เมื่อ DOM พร้อม
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootHydrationVR, { once:true });
} else {
  bootHydrationVR();
}