/* === /herohealth/vr-goodjunk/goodjunk-mobile-start-oneclick-v849e.js === */
/* FULL PATCH v20260606-GOODJUNK-MOBILE-START-ONECLICK-V849E
   Purpose:
   - แก้ปัญหาต้องกด "เริ่มสู้บอส" 2 ครั้ง
   - กัน bridge หลายตัวเรียก start ซ้ำ
   - รอ core พร้อม แล้ว start จากคลิกแรกให้สำเร็จ
   - ซ่อน overlay/loading แบบปลอดภัย
*/

(function(){
  'use strict';

  const PATCH = 'v20260606-GOODJUNK-MOBILE-START-ONECLICK-V849E';

  if(window.GJ_MOBILE_START_ONECLICK_V849E_LOADED) return;
  window.GJ_MOBILE_START_ONECLICK_V849E_LOADED = true;

  let starting = false;
  let started = false;
  let internalRetry = false;

  function qs(sel){
    try{ return document.querySelector(sel); }
    catch(_){ return null; }
  }

  function qsa(sel){
    try{ return Array.from(document.querySelectorAll(sel)); }
    catch(_){ return []; }
  }

  function hideStartUI(){
    const loading = document.getElementById('shellLoading');
    const overlay = document.getElementById('gjmStartOverlay');
    const main = document.getElementById('gjSoloBossMain');
    const area = document.getElementById('gjSoloBossArea');

    if(loading){
      loading.style.setProperty('display','none','important');
      loading.style.setProperty('visibility','hidden','important');
      loading.style.setProperty('opacity','0','important');
      loading.style.setProperty('pointer-events','none','important');
      try{ loading.remove(); }catch(_){}
    }

    if(overlay){
      overlay.style.setProperty('display','none','important');
      overlay.style.setProperty('visibility','hidden','important');
      overlay.style.setProperty('opacity','0','important');
      overlay.style.setProperty('pointer-events','none','important');
    }

    if(main){
      main.style.setProperty('display','block','important');
      main.style.setProperty('visibility','visible','important');
      main.style.setProperty('opacity','1','important');
    }

    if(area){
      area.style.setProperty('display','block','important');
      area.style.setProperty('visibility','visible','important');
      area.style.setProperty('opacity','1','important');
      area.style.setProperty('pointer-events','auto','important');
    }

    document.body.classList.add('gj-started-v849e');
    document.documentElement.classList.add('gj-started-v849e');
  }

  function looksStarted(){
    const overlay = document.getElementById('gjmStartOverlay');
    const text = String(document.body && document.body.innerText || '');

    if(window.GJ_GAME_STARTED || window.GJ_SOLO_BOSS_STARTED || window.GJ_MOBILE_STARTED) return true;
    if(overlay && getComputedStyle(overlay).display === 'none') return true;

    return (
      text.includes('เกือบชนะบอสแล้ว') ||
      text.includes('Combo') ||
      text.includes('Fair Pressure') ||
      text.includes('Shield') ||
      text.includes('Magnet') ||
      text.includes('Fever')
    );
  }

  function callStartCandidates(){
    const candidates = [
      function(){ return window.GoodJunkSoloBossMain && window.GoodJunkSoloBossMain.startGame; },
      function(){ return window.GoodJunkSoloBossMain && window.GoodJunkSoloBossMain.start; },
      function(){ return window.GJ_SOLO_BOSS_START; },
      function(){ return window.GJ_START_GAME; },
      function(){ return window.startGame; },
      function(){ return window.startGoodJunkSoloBoss; },
      function(){ return window.forceStartGoodJunk; }
    ];

    for(const getFn of candidates){
      try{
        const fn = getFn();
        if(typeof fn === 'function'){
          fn.call(window);
          return true;
        }
      }catch(e){
        console.warn('[GoodJunk Start OneClick] start candidate failed', e);
      }
    }

    return false;
  }

  function clickNativeStartButton(){
    const btn =
      document.getElementById('gjmStartBtn') ||
      qs('.gjm-start-btn') ||
      qsa('button').find(function(b){
        return String(b.textContent || '').includes('เริ่มสู้บอส');
      });

    if(!btn) return false;

    if(internalRetry) return false;

    internalRetry = true;

    try{
      btn.disabled = false;
      btn.style.setProperty('pointer-events','auto','important');

      const ev = new MouseEvent('click', {
        bubbles:true,
        cancelable:true,
        view:window
      });

      btn.dispatchEvent(ev);
      return true;
    }catch(e){
      console.warn('[GoodJunk Start OneClick] native button retry failed', e);
      return false;
    }finally{
      setTimeout(function(){
        internalRetry = false;
      }, 120);
    }
  }

  function forceStart(reason){
    if(started) return true;

    if(starting && reason !== 'retry') return false;
    starting = true;

    console.log('[GoodJunk Start OneClick] start requested', {
      patch: PATCH,
      reason: reason || ''
    });

    const tries = [0, 80, 180, 360, 650, 950];

    tries.forEach(function(ms, idx){
      setTimeout(function(){
        if(started) return;

        let ok = false;

        ok = callStartCandidates();

        if(!ok && idx >= 1){
          ok = clickNativeStartButton();
        }

        if(ok || looksStarted()){
          started = true;
          starting = false;

          window.GJ_GAME_STARTED = true;
          window.GJ_SOLO_BOSS_STARTED = true;
          window.GJ_MOBILE_STARTED = true;

          hideStartUI();

          console.log('[GoodJunk Start OneClick] started', {
            patch: PATCH,
            reason: reason || '',
            tryIndex: idx
          });
        }
      }, ms);
    });

    setTimeout(function(){
      if(!started){
        /*
          ถึง core จะไม่ประกาศ function แต่ถ้ามี bridge เก่าทำงานแล้ว
          ให้ซ่อน overlay และปล่อย gameplay ต่อ
        */
        if(looksStarted()){
          started = true;
          hideStartUI();
        }

        starting = false;
      }
    }, 1300);

    return true;
  }

  function bind(){
    const btn =
      document.getElementById('gjmStartBtn') ||
      qs('.gjm-start-btn');

    if(btn){
      btn.dataset.gjOneClickV849e = '1';
      btn.disabled = false;
      btn.style.setProperty('pointer-events','auto','important');

      btn.addEventListener('click', function(ev){
        if(internalRetry) return;

        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        forceStart('main-start-button');
      }, true);

      btn.addEventListener('pointerup', function(ev){
        if(internalRetry) return;

        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        forceStart('main-start-pointerup');
      }, true);
    }
  }

  /*
    กันข้อความ summary/reward หลุดมากองบน gameplay
  */
  function hideFloatingSummaryTextDuringGame(){
    if(!started && !looksStarted()) return;

    qsa('body > div, body > section, body > article').forEach(function(el){
      if(!el || el.id === 'gjSoloBossMain') return;

      const text = String(el.textContent || '');

      const looksLeakedSummary =
        text.includes('วันนี้ได้เรียนรู้อะไร') ||
        text.includes('ภารกิจรอบหน้า') ||
        text.includes('Cooldown แล้วกลับเลือกโหมด') ||
        text.includes('เล่นอีกครั้ง') ||
        text.includes('ชนะบอสแบบสุดยอด') ||
        text.includes('เกือบชนะบอสแล้ว');

      if(looksLeakedSummary && !el.closest('#gjSoloBossMain')){
        el.style.setProperty('display','none','important');
        el.style.setProperty('visibility','hidden','important');
        el.style.setProperty('pointer-events','none','important');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    bind();
    setTimeout(bind, 120);
    setTimeout(bind, 450);
    setTimeout(bind, 900);
  });

  if(document.readyState !== 'loading'){
    bind();
    setTimeout(bind, 120);
    setTimeout(bind, 450);
    setTimeout(bind, 900);
  }

  document.addEventListener('click', function(ev){
    const el = ev.target && ev.target.closest
      ? ev.target.closest('#gjmStartBtn,.gjm-start-btn')
      : null;

    if(!el) return;
    if(internalRetry) return;

    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

    forceStart('captured-document-click');
  }, true);

  setInterval(hideFloatingSummaryTextDuringGame, 700);

  window.GJ_MOBILE_START_ONECLICK_V849E = {
    patch: PATCH,
    forceStart: forceStart,
    hideStartUI: hideStartUI
  };

  console.log('[GoodJunk Mobile Start OneClick v849e ready]');
})();
