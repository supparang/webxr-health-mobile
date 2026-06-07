/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-rescue-v849s.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-RESCUE-V849S
   Fix:
   - กัน summary โผล่เองตอนยังไม่ได้เล่น
   - ไม่เปิด summary ถ้า score=0 และ combo=0
   - เปิด summary เฉพาะเมื่อมีหลักฐานว่าเล่นจริงแล้วเท่านั้น
   - ลบ summary ผิดพลาดจาก v849r ถ้ามันเปิดด้วยคะแนน 0
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-RESCUE-V849S';

  if(window.GJ_SUMMARY_RESCUE_V849S_LOADED){
    return;
  }
  window.GJ_SUMMARY_RESCUE_V849S_LOADED = true;

  var installedAt = Date.now();
  var opened = false;
  var userActions = 0;
  var lastTargetSeenAt = Date.now();

  var state = {
    score:0,
    combo:0,
    timeLeft:0,
    targetCount:0
  };

  function isGoodJunk(){
    var qs = new URLSearchParams(location.search || '');
    var game = String(qs.get('game') || qs.get('gameId') || qs.get('theme') || '').toLowerCase();

    return (
      game === 'goodjunk' ||
      location.pathname.indexOf('/vr-goodjunk/') !== -1
    );
  }

  if(!isGoodJunk()){
    return;
  }

  function num(v, d){
    var n = Number(v);
    return Number.isFinite(n) ? n : (d || 0);
  }

  function cleanText(v){
    return String(v || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function textOf(el){
    if(!el) return '';
    return cleanText(
      el.textContent ||
      el.innerText ||
      (el.getAttribute && (
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        ''
      )) ||
      ''
    );
  }

  function pageText(){
    return cleanText(document.body && document.body.innerText || '');
  }

  function readNumberFrom(id){
    var el = document.getElementById(id);
    if(!el) return 0;

    var t = textOf(el);
    var m = t.match(/-?\d+(\.\d+)?/);

    return m ? num(m[0], 0) : 0;
  }

  function readCombo(){
    var t = textOf(document.getElementById('gjmCombo'));
    var m = t.match(/x?\s*(\d+)/i);
    return m ? num(m[1], 0) : 0;
  }

  function visible(el){
    if(!el) return false;

    try{
      var st = getComputedStyle(el);
      var r = el.getBoundingClientRect();

      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number(st.opacity || 1) > 0.05 &&
        r.width > 8 &&
        r.height > 8 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < innerHeight &&
        r.left < innerWidth
      );
    }catch(_){
      return false;
    }
  }

  function countTargets(){
    var selectors = [
      '.gjpu-item',
      '.gjm-food',
      '.food',
      '.target',
      '[data-food]',
      '[data-goodjunk-target]',
      '[data-gj-target]',
      '[data-kind="good"]',
      '[data-kind="junk"]',
      '[data-kind="fake"]'
    ].join(',');

    var nodes = Array.prototype.slice.call(document.querySelectorAll(selectors));
    var count = 0;

    nodes.forEach(function(el){
      if(visible(el)) count++;
    });

    return count;
  }

  function updateState(){
    var score = readNumberFrom('gjmScore');
    var combo = readCombo();
    var timeLeft = readNumberFrom('gjmTime');
    var targets = countTargets();

    if(score > state.score) state.score = score;
    if(combo > state.combo) state.combo = combo;
    if(timeLeft > 0) state.timeLeft = timeLeft;

    state.targetCount = targets;

    if(targets > 0){
      lastTargetSeenAt = Date.now();
    }

    return state;
  }

  function hasWinText(){
    var t = pageText();

    return (
      t.indexOf('ชนะบอสแล้ว') !== -1 ||
      t.indexOf('ชนะบอสแบบสุดยอด') !== -1 ||
      t.indexOf('Boss Defeated') !== -1 ||
      t.indexOf('Boss defeated') !== -1 ||
      t.indexOf('บอสพ่ายแพ้') !== -1
    );
  }

  function hasEndText(){
    var t = pageText();

    return (
      t.indexOf('หมดเวลา') !== -1 ||
      t.indexOf('Time Up') !== -1 ||
      t.indexOf('จบเกม') !== -1 ||
      t.indexOf('ภารกิจสำเร็จ') !== -1
    );
  }

  function summaryAlreadyOpen(){
    return !!(
      document.querySelector('[data-gj-summary-rescue-v849s="1"]') ||
      document.getElementById('gjrZoneBtn') ||
      document.querySelector('.gjr-summary') ||
      document.querySelector('.gjRewardSummary')
    );
  }

  function hasRealPlayEvidence(){
    updateState();

    var age = Date.now() - installedAt;

    /*
      เงื่อนไขสำคัญ:
      - ห้ามเปิด summary ถ้า score=0 และ combo=0
      - ต้องมีคะแนนหรือคอมโบจริงพอสมควร
    */
    if(state.score <= 0 && state.combo <= 0){
      return false;
    }

    return (
      age >= 12000 &&
      (
        state.score >= 80 ||
        state.combo >= 5 ||
        userActions >= 12
      )
    );
  }

  function canOpenSummary(reason){
    if(opened) return false;
    if(summaryAlreadyOpen()) return false;

    updateState();

    var age = Date.now() - installedAt;
    var noTargetMs = Date.now() - lastTargetSeenAt;
    var evidence = hasRealPlayEvidence();

    if(!evidence){
      return false;
    }

    if((hasWinText() || reason === 'boss-event') && age >= 12000){
      return true;
    }

    if((hasEndText() || reason === 'end-event') && age >= 15000){
      return true;
    }

    if(state.targetCount === 0 && noTargetMs >= 7000 && age >= 18000){
      return true;
    }

    if(state.timeLeft === 0 && age >= 20000){
      return true;
    }

    return false;
  }

  function buildCooldownUrl(summary){
    summary = summary || {};

    try{
      if(
        window.GJ_SOLO_BOSS_SHELL &&
        typeof window.GJ_SOLO_BOSS_SHELL.buildCooldownUrl === 'function'
      ){
        return window.GJ_SOLO_BOSS_SHELL.buildCooldownUrl(summary);
      }
    }catch(_){}

    var qs = new URLSearchParams(location.search || '');
    var base = 'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html';
    var launcher = 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';

    var keep = new URLSearchParams();

    keep.set('zone', 'nutrition');
    keep.set('cat', 'nutrition');
    keep.set('game', 'goodjunk');
    keep.set('gameId', 'goodjunk');
    keep.set('mode', 'solo_boss');
    keep.set('phase', 'cooldown');

    keep.set('pid', qs.get('pid') || 'anon');
    keep.set('name', qs.get('name') || qs.get('nick') || 'Hero');
    keep.set('diff', qs.get('diff') || 'normal');
    keep.set('time', qs.get('time') || '90');
    keep.set('view', qs.get('view') || 'mobile');

    keep.set('hub', launcher);
    keep.set('next', launcher);
    keep.set('back', launcher);
    keep.set('launcher', launcher);
    keep.set('return', launcher);

    keep.set('score', String(summary.score || 0));
    keep.set('bestCombo', String(summary.bestCombo || 0));
    keep.set('stars', String(summary.stars || 1));
    keep.set('reason', 'summary-rescue-v849s');

    return base + '?' + keep.toString();
  }

  function openSummary(reason, force){
    updateState();

    if(!force && !canOpenSummary(reason || 'watchdog')){
      return false;
    }

    if(opened) return false;
    opened = true;

    var score = state.score;
    var combo = state.combo;

    /*
      Hard stop:
      ต่อให้มี event แปลก ๆ ยิงมา ก็ห้ามเปิด summary คะแนน 0
    */
    if(!force && score <= 0 && combo <= 0){
      opened = false;
      return false;
    }

    var stars = 1;

    if(score >= 450 || combo >= 10) stars = 5;
    else if(score >= 300 || combo >= 8) stars = 4;
    else if(score >= 180 || combo >= 5) stars = 3;
    else if(score >= 80) stars = 2;

    var accuracy = score > 0 ? 100 : 0;
    var coins = Math.max(20, Math.round(score / 10));

    var summary = {
      reason:reason || 'summary-rescue-v849s',
      score:score,
      accuracy:accuracy,
      bestCombo:combo,
      combo:combo,
      stars:stars,
      coins:coins,
      rank:stars >= 5 ? 'Legend Hero' : 'Food Hero',
      badge:stars >= 5 ? 'Nutrition Champion' : 'Good Food Learner'
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('GJ_SUMMARY_RESCUE_V849S_LAST', JSON.stringify({
        patch:PATCH,
        summary:summary,
        openedAt:new Date().toISOString()
      }));
    }catch(_){}

    var old = document.querySelector('[data-gj-summary-rescue-v849s="1"]');
    if(old) old.remove();

    var overlay = document.createElement('section');
    overlay.setAttribute('data-gj-summary-rescue-v849s', '1');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483000',
      'display:grid',
      'place-items:center',
      'background:rgba(15,23,42,.38)',
      'backdrop-filter:blur(5px)',
      'padding:18px',
      'font-family:system-ui,-apple-system,Segoe UI,sans-serif'
    ].join(';');

    overlay.innerHTML =
      '<div style="width:min(520px,calc(100vw - 28px));border-radius:28px;background:rgba(255,255,255,.97);box-shadow:0 30px 80px rgba(15,23,42,.32);padding:22px;text-align:center;color:#0f172a;">' +
        '<div style="font-size:54px;line-height:1;">🏆</div>' +
        '<h1 style="margin:8px 0 4px;font-size:clamp(28px,6vw,42px);line-height:1.05;">ชนะบอสแบบสุดยอด!</h1>' +
        '<div style="font-size:25px;margin:6px 0 12px;">' + '⭐'.repeat(stars) + '</div>' +
        '<p style="margin:0 0 14px;color:#64748b;font-weight:900;line-height:1.35;">เลือกอาหารดีและหลบอาหารขยะได้เยี่ยมมาก</p>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0;">' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">' + score + '</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">คะแนน</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">' + accuracy + '%</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">ความแม่นยำ</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">x' + combo + '</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">คอมโบสูงสุด</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">+' + coins + ' 🪙</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">เหรียญ</span></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">' +
          '<button id="gjV849sReplayBtn" type="button" style="border:0;border-radius:16px;padding:13px 10px;background:#22c55e;color:white;font-weight:1000;">🔁 เล่นอีกครั้ง</button>' +
          '<button id="gjV849sCooldownBtn" type="button" style="border:0;border-radius:16px;padding:13px 10px;background:#2563eb;color:white;font-weight:1000;">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</div>';

    document.documentElement.appendChild(overlay);

    var replay = document.getElementById('gjV849sReplayBtn');
    var cooldown = document.getElementById('gjV849sCooldownBtn');

    if(replay){
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        var u = new URL(location.href);
        u.searchParams.set('replay', String(Date.now()));
        u.searchParams.set('run', 'play');
        u.searchParams.set('phase', 'main');

        location.href = u.toString();
      }, true);
    }

    if(cooldown){
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        try{
          if(
            window.GJ_SOLO_BOSS_SHELL &&
            typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'
          ){
            window.GJ_SOLO_BOSS_SHELL.goCooldown(summary);
            return;
          }
        }catch(_){}

        location.href = buildCooldownUrl(summary);
      }, true);
    }

    console.warn('[GoodJunk Summary Rescue V849S] opened:', summary);

    return true;
  }

  function killBadZeroSummary(){
    updateState();

    /*
      ลบ summary ผิดพลาดจาก v849r หรือ fallback เก่าที่เปิดตอน score=0
    */
    if(state.score > 0 || state.combo > 0 || userActions >= 12){
      return;
    }

    var nodes = Array.prototype.slice.call(document.querySelectorAll(
      '[data-gj-summary-rescue-v849r="1"], [data-gj-summary-rescue-v849s="1"]'
    ));

    nodes.forEach(function(el){
      var t = textOf(el);

      if(
        t.indexOf('0') !== -1 &&
        (
          t.indexOf('คะแนน') !== -1 ||
          t.indexOf('ความแม่นยำ') !== -1 ||
          t.indexOf('คอมโบสูงสุด') !== -1
        )
      ){
        console.warn('[GoodJunk Summary Rescue V849S] removed false zero summary');
        el.remove();
        opened = false;
      }
    });
  }

  function tick(){
    updateState();
    killBadZeroSummary();

    if(canOpenSummary('watchdog')){
      openSummary('watchdog', false);
    }
  }

  document.addEventListener('click', function(){
    userActions++;
  }, true);

  document.addEventListener('pointerdown', function(){
    userActions++;
  }, true);

  document.addEventListener('touchstart', function(){
    userActions++;
  }, { passive:true, capture:true });

  [
    'gj:boss-defeated',
    'gj:final-win',
    'gj:game-complete',
    'gj:time-up',
    'gj:reward-summary-ready'
  ].forEach(function(name){
    window.addEventListener(name, function(){
      setTimeout(function(){
        var reason =
          name === 'gj:boss-defeated' || name === 'gj:final-win'
            ? 'boss-event'
            : 'end-event';

        openSummary(reason, false);
      }, 700);
    }, true);
  });

  setInterval(tick, 700);

  window.GJ_SUMMARY_RESCUE_V849S = {
    patch:PATCH,
    open:function(reason, force){
      return openSummary(reason || 'manual', !!force);
    },
    state:function(){
      updateState();

      return {
        patch:PATCH,
        state:state,
        userActions:userActions,
        age:Date.now() - installedAt,
        noTargetMs:Date.now() - lastTargetSeenAt,
        canOpen:canOpenSummary('manual-check'),
        opened:opened
      };
    },
    killBadZeroSummary:killBadZeroSummary
  };

  console.log('[GoodJunk Summary Rescue V849S] installed');
})();