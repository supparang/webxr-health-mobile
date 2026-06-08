/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-single-owner-v850l.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-SINGLE-OWNER-V850L
   หน้าที่:
   - ให้ summary-live-only-v850k เป็นเจ้าของ summary ตัวเดียว
   - ลบ/ซ่อน summary เก่าที่เปิดจาก reward.js / reward-polish / final-polish
   - กัน modal ซ้อน เบลอซ้อน ปุ่มซ้อน
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-SINGLE-OWNER-V850L';
  var OWNER = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-LIVE-ONLY-V850K';

  if(window.GJ_SUMMARY_SINGLE_OWNER_V850L_LOADED){
    return;
  }
  window.GJ_SUMMARY_SINGLE_OWNER_V850L_LOADED = true;

  function textOf(el){
    return String(
      el && (
        el.textContent ||
        el.getAttribute && el.getAttribute('aria-label') ||
        el.getAttribute && el.getAttribute('title') ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function looksLikeOldSummary(el){
    if(!el || !el.style) return false;

    if(el.getAttribute && el.getAttribute('data-summary-owner') === OWNER){
      return false;
    }

    var id = String(el.id || '').toLowerCase();
    var cls = String(el.className || '').toLowerCase();
    var txt = textOf(el);

    if(id.includes('gjr') || id.includes('summary') || id.includes('reward')){
      return true;
    }

    if(cls.includes('gjr') || cls.includes('summary') || cls.includes('reward') || cls.includes('modal') || cls.includes('overlay')){
      return (
        txt.includes('ชนะบอส') ||
        txt.includes('สรุปผล') ||
        txt.includes('เล่นอีกครั้ง') ||
        txt.includes('Cooldown') ||
        txt.includes('คะแนน') ||
        txt.includes('ความแม่นยำ')
      );
    }

    return (
      txt.includes('ชนะบอสแบบสุดยอด') ||
      txt.includes('ชนะบอสแบบสุดยอด!') ||
      txt.includes('ชนะบอสแล้ว') ||
      txt.includes('สรุปผล GoodJunk') ||
      (
        txt.includes('เล่นอีกครั้ง') &&
        txt.includes('Cooldown') &&
        txt.includes('คะแนน')
      )
    );
  }

  function removeOldSummaries(){
    var nodes = [];

    try{
      nodes = Array.prototype.slice.call(document.querySelectorAll(
        [
          '.gjr-overlay',
          '.gjr-modal',
          '.gjr-card',
          '.gj-summary',
          '.gj-summary-overlay',
          '.gjSummary',
          '.summaryOverlay',
          '.summary-modal',
          '.reward-overlay',
          '.reward-modal',
          '[data-gj-summary]',
          '[data-reward-summary]',
          '[data-summary]',
          '[role="dialog"]'
        ].join(',')
      ));
    }catch(_){
      nodes = [];
    }

    try{
      Array.prototype.slice.call(document.body.children).forEach(function(el){
        if(nodes.indexOf(el) < 0 && looksLikeOldSummary(el)){
          nodes.push(el);
        }
      });
    }catch(_){}

    nodes.forEach(function(el){
      try{
        if(!el || !el.parentNode) return;

        if(el.getAttribute && el.getAttribute('data-summary-owner') === OWNER){
          return;
        }

        if(looksLikeOldSummary(el)){
          el.remove();
        }
      }catch(_){}
    });
  }

  function keepOwnerOnTop(){
    var owner = document.querySelector('[data-summary-owner="' + OWNER + '"]');
    if(owner){
      owner.style.setProperty('z-index', '2147483600', 'important');
      owner.style.setProperty('display', 'grid', 'important');
      owner.style.setProperty('visibility', 'visible', 'important');
      owner.style.setProperty('opacity', '1', 'important');
      owner.style.setProperty('pointer-events', 'auto', 'important');
    }
  }

  function sweep(){
    removeOldSummaries();
    keepOwnerOnTop();
  }

  /*
    ดัก event summary เก่าที่ไฟล์เดิมยิงมา
    ไม่ block event แต่ sweep ทันทีหลังมันสร้าง DOM
  */
  [
    'gj:reward-summary-shown',
    'gj:summary-shown',
    'gj:summary-opened',
    'gj:game-over',
    'gj:boss-defeated'
  ].forEach(function(name){
    window.addEventListener(name, function(){
      setTimeout(sweep, 0);
      setTimeout(sweep, 30);
      setTimeout(sweep, 120);
      setTimeout(sweep, 350);
    }, true);
  });

  document.addEventListener('click', function(){
    setTimeout(sweep, 0);
    setTimeout(sweep, 80);
  }, true);

  try{
    var mo = new MutationObserver(function(){
      sweep();
    });

    mo.observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','style','data-summary-owner','role']
    });
  }catch(_){}

  setInterval(sweep, 700);

  window.GJ_SUMMARY_SINGLE_OWNER_V850L = {
    patch: PATCH,
    owner: OWNER,
    sweep: sweep
  };

  setTimeout(sweep, 80);
  setTimeout(sweep, 400);
  setTimeout(sweep, 1000);

  console.info('[GoodJunk Summary Single Owner v850l] installed');
})();
