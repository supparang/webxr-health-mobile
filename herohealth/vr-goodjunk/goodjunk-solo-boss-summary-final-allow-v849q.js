/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-final-allow-v849q.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-FINAL-ALLOW-V849Q
   Purpose:
   - แก้ v849p บล็อก summary แรงเกินไป
   - อนุญาต summary เมื่อเกมจบจริง แม้ goodHits tracker ต่ำหรือ bossHp เป็น null
   - ใช้ score/combo/ข้อความ win/timeout เป็นหลักฐานเสริม
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-FINAL-ALLOW-V849Q';

  if(window.GJ_SUMMARY_FINAL_ALLOW_V849Q_LOADED){
    return;
  }
  window.GJ_SUMMARY_FINAL_ALLOW_V849Q_LOADED = true;

  var installedAt = Date.now();
  var finalUnlocked = false;
  var lastState = {
    score:0,
    combo:0,
    goodHits:0,
    allowedAt:0,
    reason:''
  };

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function isGoodJunk(){
    var q = qs();
    var game = String(q.get('game') || q.get('gameId') || q.get('theme') || '').toLowerCase();

    return (
      game === 'goodjunk' ||
      location.pathname.indexOf('/vr-goodjunk/') !== -1
    );
  }

  if(!isGoodJunk()){
    return;
  }

  function n(v, d){
    var x = Number(v);
    return Number.isFinite(x) ? x : (d || 0);
  }

  function textOf(el){
    return String(
      el && (
        el.textContent ||
        el.innerText ||
        el.getAttribute && (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          ''
        ) ||
        ''
      ) || ''
    ).replace(/\s+/g, ' ').trim();
  }

  function readNum(id){
    var el = document.getElementById(id);
    if(!el) return 0;

    var t = textOf(el);
    var m = t.match(/-?\d+(\.\d+)?/);

    return m ? n(m[0], 0) : 0;
  }

  function readCombo(){
    var t = textOf(document.getElementById('gjmCombo'));
    var m = t.match(/x?\s*(\d+)/i);
    return m ? n(m[1], 0) : 0;
  }

  function pageText(){
    return String(document.body && document.body.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function updateState(extra){
    extra = extra || {};

    var score = Math.max(
      lastState.score,
      readNum('gjmScore'),
      n(extra.score, 0)
    );

    var combo = Math.max(
      lastState.combo,
      readCombo(),
      n(extra.combo, 0),
      n(extra.bestCombo, 0)
    );

    var goodHits = Math.max(
      lastState.goodHits,
      n(extra.goodHits, 0),
      n(extra.good, 0),
      n(window.GJ_GOOD_HITS, 0),
      n(window.goodHits, 0)
    );

    lastState.score = score;
    lastState.combo = combo;
    lastState.goodHits = goodHits;

    return lastState;
  }

  function hasWinText(){
    var t = pageText();

    return (
      t.indexOf('ชนะบอสแล้ว') !== -1 ||
      t.indexOf('ชนะบอสแบบสุดยอด') !== -1 ||
      t.indexOf('Boss Defeated') !== -1 ||
      t.indexOf('บอสพ่ายแพ้') !== -1 ||
      t.indexOf('เก็บชนะบอสแล้ว') !== -1 ||
      t.indexOf('Cooldown แล้วกลับเลือกโหมด') !== -1
    );
  }

  function hasTimeoutText(){
    var t = pageText();

    return (
      t.indexOf('หมดเวลา') !== -1 ||
      t.indexOf('Time Up') !== -1 ||
      t.indexOf('จบเกม') !== -1 ||
      t.indexOf('ภารกิจเสร็จ') !== -1
    );
  }

  function shouldAllowFinal(reason, detail){
    var s = updateState(detail || {});
    var age = Date.now() - installedAt;

    var reasonText = String(reason || '').toLowerCase();

    var looksWinReason =
      reasonText.indexOf('boss') !== -1 ||
      reasonText.indexOf('win') !== -1 ||
      reasonText.indexOf('defeat') !== -1 ||
      reasonText.indexOf('final') !== -1 ||
      reasonText.indexOf('time') !== -1 ||
      reasonText.indexOf('summary') !== -1;

    var enoughScoreCombo =
      s.score >= 450 &&
      s.combo >= 10;

    var enoughScoreOnly =
      s.score >= 650;

    var enoughPlayable =
      age >= 12000 &&
      s.score >= 250 &&
      s.combo >= 5;

    var ok =
      finalUnlocked ||
      hasWinText() ||
      hasTimeoutText() ||
      enoughScoreCombo ||
      enoughScoreOnly ||
      (looksWinReason && enoughPlayable);

    return {
      ok:ok,
      state:s,
      age:age,
      reason:reason || '',
      hasWinText:hasWinText(),
      hasTimeoutText:hasTimeoutText(),
      enoughScoreCombo:enoughScoreCombo,
      enoughScoreOnly:enoughScoreOnly,
      enoughPlayable:enoughPlayable
    };
  }

  function unlock(reason, detail){
    var decision = shouldAllowFinal(reason, detail);

    if(!decision.ok){
      return false;
    }

    finalUnlocked = true;
    lastState.allowedAt = Date.now();
    lastState.reason = reason || 'final-allow';

    window.GJ_SUMMARY_FINAL_ALLOWED_V849Q = true;
    window.GJ_REAL_SUMMARY_ALLOWED = true;
    window.GJ_REAL_WIN_CONFIRMED = true;
    window.GJ_ALLOW_REWARD_SUMMARY = true;

    try{
      localStorage.setItem('GJ_SUMMARY_FINAL_ALLOW_V849Q', JSON.stringify({
        patch:PATCH,
        decision:decision,
        savedAt:new Date().toISOString()
      }));
    }catch(_){}

    console.warn('[GoodJunk Summary Final Allow V849Q] unlocked:', decision);

    return true;
  }

  function patchBlockers(){
    /*
      v849p อ่าน global เหล่านี้ได้ในบางกรณี
      ตั้งค่าไว้ให้ patch หลัง ๆ เห็นว่า final summary อนุญาตแล้ว
    */
    if(finalUnlocked){
      window.GJ_SUMMARY_HARD_BLOCK_ALLOW = true;
      window.GJ_SUMMARY_ALLOW_FINAL = true;
      window.GJ_BOSS_DEFEATED_CONFIRMED = true;
    }
  }

  function findSummaryButtons(){
    return Array.prototype.slice.call(
      document.querySelectorAll('button,a,[role="button"]')
    ).filter(function(el){
      var t = textOf(el);

      return (
        t.indexOf('Cooldown') !== -1 ||
        t.indexOf('เล่นอีกครั้ง') !== -1 ||
        t.indexOf('กลับเลือกโหมด') !== -1
      );
    });
  }

  function looksTinyRemovedSummary(){
    var t = pageText();

    return (
      t.indexOf('คะแนน') !== -1 &&
      t.indexOf('ความแม่นยำ') !== -1 &&
      t.indexOf('คอมโบสูงสุด') !== -1
    );
  }

  function restoreSummaryIfNeeded(reason){
    if(!unlock(reason || 'restore-check', {})){
      return;
    }

    patchBlockers();

    var existing = document.querySelector('[data-gj-summary-v849q="1"]');

    if(existing){
      existing.style.setProperty('display', 'grid', 'important');
      existing.style.setProperty('visibility', 'visible', 'important');
      existing.style.setProperty('opacity', '1', 'important');
      return;
    }

    /*
      ถ้า summary เก่าถูก v849p ลบไปแล้ว ให้สร้าง summary เบื้องต้นขึ้นใหม่
    */
    if(findSummaryButtons().length > 0 || looksTinyRemovedSummary()){
      return;
    }

    var s = updateState({});

    var overlay = document.createElement('section');
    overlay.setAttribute('data-gj-summary-v849q', '1');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483000',
      'display:grid',
      'place-items:center',
      'background:rgba(15,23,42,.38)',
      'backdrop-filter:blur(5px)',
      'padding:18px'
    ].join(';');

    overlay.innerHTML =
      '<div style="width:min(520px,calc(100vw - 28px));border-radius:28px;background:rgba(255,255,255,.96);box-shadow:0 30px 80px rgba(15,23,42,.32);padding:22px;text-align:center;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">' +
        '<div style="font-size:52px;line-height:1;">🏆</div>' +
        '<h1 style="margin:8px 0 4px;font-size:clamp(28px,6vw,42px);line-height:1.05;">ชนะบอสแบบสุดยอด!</h1>' +
        '<div style="font-size:26px;margin:6px 0 12px;">⭐️⭐️⭐️⭐️⭐️</div>' +
        '<p style="margin:0 0 14px;color:#64748b;font-weight:900;">เลือกอาหารดีและหลบอาหารขยะได้เยี่ยมมาก</p>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0;">' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">' + s.score + '</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">คะแนน</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">100%</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">ความแม่นยำ</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">x' + s.combo + '</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">คอมโบสูงสุด</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">+' + Math.max(20, Math.round(s.score / 10)) + ' 🪙</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">เหรียญ</span></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">' +
          '<button id="gjV849qReplayBtn" type="button" style="border:0;border-radius:16px;padding:13px 12px;background:#22c55e;color:white;font-weight:1000;">🔁 เล่นอีกครั้ง</button>' +
          '<button id="gjV849qCooldownBtn" type="button" style="border:0;border-radius:16px;padding:13px 12px;background:#2563eb;color:white;font-weight:1000;">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</div>';

    document.documentElement.appendChild(overlay);

    var replay = document.getElementById('gjV849qReplayBtn');
    var cooldown = document.getElementById('gjV849qCooldownBtn');

    if(replay){
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        location.reload();
      }, true);
    }

    if(cooldown){
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        try{
          if(window.GJ_SOLO_BOSS_SHELL && typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'){
            window.GJ_SOLO_BOSS_SHELL.goCooldown({
              reason:'v849q-summary',
              score:s.score,
              bestCombo:s.combo,
              goodHits:s.goodHits,
              stars:5,
              rank:'Legend Hero',
              badge:'Nutrition Champion'
            });
            return;
          }
        }catch(_){}

        location.href = '../warmup-gate.html?game=goodjunk&phase=cooldown';
      }, true);
    }

    console.warn('[GoodJunk Summary Final Allow V849Q] restored fallback summary');
  }

  [
    'gj:boss-defeated',
    'gj:final-win',
    'gj:game-complete',
    'gj:time-up',
    'gj:reward-summary-ready',
    'gj:reward-summary-shown'
  ].forEach(function(name){
    window.addEventListener(name, function(ev){
      var detail = ev && ev.detail ? ev.detail : {};
      unlock(name, detail);
      patchBlockers();

      setTimeout(function(){
        restoreSummaryIfNeeded(name);
      }, 80);
    }, true);
  });

  var oldDispatch = EventTarget.prototype.dispatchEvent;

  if(!oldDispatch.__gjFinalAllowV849Q){
    EventTarget.prototype.dispatchEvent = function(event){
      try{
        if(event && event.type){
          var t = String(event.type || '');

          if(
            t.indexOf('boss-defeated') !== -1 ||
            t.indexOf('final-win') !== -1 ||
            t.indexOf('game-complete') !== -1 ||
            t.indexOf('time-up') !== -1 ||
            t.indexOf('summary') !== -1
          ){
            unlock('dispatch:' + t, event.detail || {});
            patchBlockers();
          }
        }
      }catch(_){}

      return oldDispatch.apply(this, arguments);
    };

    EventTarget.prototype.dispatchEvent.__gjFinalAllowV849Q = true;
  }

  var mo = new MutationObserver(function(){
    if(hasWinText() || hasTimeoutText()){
      restoreSummaryIfNeeded('mutation-win-text');
    }
  });

  try{
    mo.observe(document.documentElement, {
      childList:true,
      subtree:true,
      characterData:true
    });
  }catch(_){}

  setInterval(function(){
    updateState({});

    if(finalUnlocked){
      patchBlockers();
      restoreSummaryIfNeeded('interval-final-unlocked');
      return;
    }

    if(shouldAllowFinal('interval-check', {}).ok){
      restoreSummaryIfNeeded('interval-auto-final');
    }
  }, 500);

  console.log('[GoodJunk Summary Final Allow V849Q] installed');
})();
