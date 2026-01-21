/* === /herohealth/vr-groups/groups.banner.js ===
GroupsVR Big Banner (Kid-friendly)
✅ Uses existing .bigBanner / .bigBannerText from groups-vr.css
✅ Listens: groups:progress + hha:judge (fallback)
✅ Shows short, punchy banners: STORM / BOSS / FOCUS / SWITCH / MINI
*/

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;
  if(!DOC || WIN.__GROUPS_BANNER__) return;
  WIN.__GROUPS_BANNER__ = true;

  function ensureBanner(){
    let wrap = DOC.querySelector('.bigBanner');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'bigBanner';
    wrap.innerHTML = '<div class="bigBannerText"></div>';
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function setVariant(wrap, variant){
    wrap.classList.remove('b-focus','b-boss','b-storm','b-mini','b-good','b-bad');
    if (variant) wrap.classList.add('b-' + variant);
  }

  let hideTmr = 0;

  function show(text, ms, variant){
    try{
      const wrap = ensureBanner();
      const el = wrap.querySelector('.bigBannerText');
      if(!el) return;

      // text
      el.textContent = String(text || '');

      // style variant
      setVariant(wrap, variant || '');

      // restart animation
      wrap.classList.remove('show');
      // force reflow
      void wrap.offsetWidth;
      wrap.classList.add('show');

      // auto hide
      clearTimeout(hideTmr);
      hideTmr = setTimeout(()=>{ try{ wrap.classList.remove('show'); }catch(_){} }, ms ?? 900);
    }catch(_){}
  }

  // --- Primary: groups:progress ---
  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail || {};
    const k = String(d.kind || '');

    // Focus / Switch
    if (k === 'focus_start')      return show('⚡ FOCUS!', 900, 'focus');
    if (k === 'focus_end_switch') return show('🔁 SWITCH!', 900, 'focus');

    // Boss
    if (k === 'boss_spawn') return show('👾 BOSS!', 1000, 'boss');
    if (k === 'boss_down')  return show('💥 BOSS DOWN!', 950, 'boss');

    // Storm
    if (k === 'storm_on')  return show('🌪️ STORM!', 900, 'storm');
    if (k === 'storm_off') return show('✨ CLEAR!', 800, 'storm');

    // Mini (ถ้าคุณเพิ่ม emit mini_start/mini_clear/mini_fail ใน safe.js ตาม 4B ด้านล่าง)
    if (k === 'mini_start') return show('⏱️ MINI!', 900, 'mini');
    if (k === 'mini_clear') return show('🎉 MINI CLEAR!', 950, 'mini');
    if (k === 'mini_fail')  return show('😤 MINI FAIL!', 950, 'mini');

  }, { passive:true });

  // --- Fallback: hha:judge (ถ้าบาง event ไม่ได้ emit groups:progress) ---
  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    const kind = String(d.kind || '');
    const text = String(d.text || '');

    if (kind === 'boss' && /BOSS/i.test(text)) return show('👾 BOSS!', 900, 'boss');
    if (kind === 'storm') return show('🌪️ STORM!', 900, 'storm');
    if (kind === 'perfect' && /FOCUS/i.test(text)) return show('⚡ FOCUS!', 850, 'focus');
    if (kind === 'perfect' && /SWITCH/i.test(text)) return show('🔁 SWITCH!', 850, 'focus');
    if (kind === 'good' && /GOAL CLEAR/i.test(text)) return show('✅ GOAL!', 900, 'good');
    if (kind === 'miss') return; // กันเด้งถี่
  }, { passive:true });

})();