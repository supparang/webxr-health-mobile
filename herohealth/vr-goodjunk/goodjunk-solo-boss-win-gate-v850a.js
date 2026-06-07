/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-win-gate-v850a.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-WIN-GATE-V850A
   Purpose:
   - กันข้อความชนะบอส/จบเกมเร็วเกินจริง
   - ส่ง event final-win เฉพาะเมื่อผ่าน rule จาก balance-v850a
*/

(function(){
  'use strict';

  if (window.GJ_SOLO_BOSS_WIN_GATE_V850A_LOADED) return;
  window.GJ_SOLO_BOSS_WIN_GATE_V850A_LOADED = true;

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-WIN-GATE-V850A';
  var finalWinSent = false;
  var lastBlockedAt = 0;

  function textOf(el){
    return String(
      (el && (el.textContent || el.innerText)) || ''
    ).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function pageText(){
    return textOf(document.body);
  }

  function balance(){
    return window.GJ_BOSS_BALANCE_V850A || null;
  }

  function canOpenSummary(){
    var b = balance();
    if (b && typeof b.canOpenSummary === 'function'){
      return !!b.canOpenSummary();
    }

    return false;
  }

  function whyBlocked(){
    var b = balance();
    if (b && typeof b.whyBlocked === 'function'){
      return b.whyBlocked();
    }

    return 'no-balance';
  }

  function hasBossWinText(){
    var t = pageText();

    return (
      t.includes('Boss Defeated') ||
      t.includes('บอสพ่าย') ||
      t.includes('บอสแพ้') ||
      t.includes('ชนะบอสแล้ว') ||
      t.includes('ชนะบอสแบบสุดยอด')
    );
  }

  function markBossCandidate(){
    var b = balance();
    if (b && typeof b.markBossCandidate === 'function'){
      b.markBossCandidate('win-gate-text');
    }
  }

  function removeEarlyWinMessages(){
    var now = Date.now();
    if (now - lastBlockedAt < 250) return;
    lastBlockedAt = now;

    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('div,section,article,aside')
    );

    nodes.forEach(function(el){
      if (!el || el.id === 'gjFinalSummaryV850A') return;

      var t = textOf(el);
      if (!t) return;

      var looksEarlyWin =
        t.includes('ชนะบอสแล้ว') ||
        t.includes('Boss Defeated') ||
        t.includes('บอสพ่าย') ||
        t.includes('บอสแพ้');

      if (!looksEarlyWin) return;

      /*
        อย่าลบ boss bar ทั้งหมดแรงเกินไป
        ลบเฉพาะกล่อง toast/message/summary ที่มีลักษณะเป็นข้อความจบเกม
      */
      var cls = String(el.className || '').toLowerCase();
      var id = String(el.id || '').toLowerCase();

      var removable =
        cls.includes('message') ||
        cls.includes('toast') ||
        cls.includes('summary') ||
        cls.includes('modal') ||
        id.includes('message') ||
        id.includes('toast') ||
        id.includes('summary') ||
        t.includes('เลือกอาหารดี') ||
        t.includes('Cooldown') ||
        t.includes('เล่นอีกครั้ง');

      if (removable){
        try{
          el.remove();
        }catch(_){
          el.style.setProperty('display', 'none', 'important');
        }
      }
    });

    console.warn('[GoodJunk Win Gate v850a] blocked early win:', whyBlocked());
  }

  function sendFinalWin(){
    if (finalWinSent) return;
    finalWinSent = true;

    try{
      window.dispatchEvent(new CustomEvent('gj:final-win', {
        detail:{
          patch: PATCH,
          source: 'win-gate-v850a',
          sentAt: Date.now()
        }
      }));
    }catch(_){}

    console.log('[GoodJunk Win Gate v850a] final win allowed');
  }

  function tick(){
    if (!hasBossWinText()) return;

    markBossCandidate();

    if (canOpenSummary()){
      sendFinalWin();
      return;
    }

    removeEarlyWinMessages();
  }

  var mo = new MutationObserver(tick);

  try{
    mo.observe(document.documentElement, {
      childList:true,
      subtree:true,
      characterData:true
    });
  }catch(_){}

  setInterval(tick, 700);
  setTimeout(tick, 600);
  setTimeout(tick, 1600);
  setTimeout(tick, 3000);

  window.GJ_SOLO_BOSS_WIN_GATE_V850A = {
    patch: PATCH,
    tick: tick,
    state: function(){
      return {
        patch: PATCH,
        finalWinSent: finalWinSent,
        hasBossWinText: hasBossWinText(),
        canOpenSummary: canOpenSummary(),
        whyBlocked: whyBlocked()
      };
    }
  };

  console.log('[GoodJunk Win Gate v850a] installed');
})();