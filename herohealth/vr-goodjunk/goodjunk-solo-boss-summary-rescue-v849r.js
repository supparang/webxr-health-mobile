/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-rescue-v849r.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-RESCUE-V849R
   Purpose:
   - กู้ summary เมื่อเกมจบแล้ว/หน้าจอว่าง/ไม่มีเป้า แต่ summary ไม่เปิด
   - ไม่ให้ summary โผล่เร็วตอนเริ่มเล่น
*/

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-RESCUE-V849R';

  if(window.GJ_SUMMARY_RESCUE_V849R_LOADED){
    return;
  }
  window.GJ_SUMMARY_RESCUE_V849R_LOADED = true;

  var installedAt = Date.now();
  var lastTargetSeenAt = Date.now();
  var lastActivityAt = Date.now();
  var opened = false;

  var maxState = {
    score:0,
    combo:0,
    timeLeft:0,
    clicks:0
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

  function text(el){
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

  function pageText(){
    return String(document.body && document.body.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readNumberFrom(id){
    var el = document.getElementById(id);
    if(!el) return 0;

    var t = text(el);
    var m = t.match(/-?\d+(\.\d+)?/);

    return m ? num(m[0], 0) : 0;
  }

  function readCombo(){
    var t = text(document.getElementById('gjmCombo'));
    var m = t.match(/x?\s*(\d+)/i);
    return m ? num(m[1], 0) : 0;
  }

  function readTime(){
    return readNumberFrom('gjmTime');
  }

  function updateState(){
    var score = readNumberFrom('gjmScore');
    var combo = readCombo();
    var timeLeft = readTime();

    if(score > maxState.score) maxState.score = score;
    if(combo > maxState.combo) maxState.combo = combo;
    if(timeLeft > 0) maxState.timeLeft = timeLeft;

    return maxState;
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

  function summaryAlreadyOpen(){
    var t = pageText();

    return (
      document.querySelector('[data-gj-summary-rescue-v849r="1"]') ||
      document.getElementById('gjrZoneBtn') ||
      (
        t.indexOf('คะแนน') !== -1 &&
        t.indexOf('Cooldown') !== -1 &&
        (
          t.indexOf('ชนะบอส') !== -1 ||
          t.indexOf('สรุป') !== -1 ||
          t.indexOf('ความแม่นยำ') !== -1
        )
      )
    );
  }

  function hasWinText(){
    var t = pageText();

    return (
      t.indexOf('ชนะบอสแล้ว') !== -1 ||
      t.indexOf('ชนะบอสแบบสุดยอด') !== -1 ||
      t.indexOf('Boss Defeated') !== -1 ||
      t.indexOf('Boss defeated') !== -1 ||
      t.indexOf('บอสพ่ายแพ้') !== -1 ||
      t.indexOf('Junk Boss คลั่ง') !== -1 && t.indexOf('Boss Defeated') !== -1
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

  function hasRealPlay(){
    var s = updateState();
    var age = Date.now() - installedAt;

    return (
      age >= 12000 &&
      (
        s.score >= 120 ||
        s.combo >= 5 ||
        maxState.clicks >= 8
      )
    );
  }

  function shouldRescue(){
    if(opened) return false;
    if(summaryAlreadyOpen()) return false;

    var s = updateState();
    var age = Date.now() - installedAt;
    var targetCount = countTargets();

    if(targetCount > 0){
      lastTargetSeenAt = Date.now();
    }

    var noTargetMs = Date.now() - lastTargetSeenAt;

    var clearWin =
      hasWinText() &&
      age >= 5000;

    var clearEnd =
      hasEndText() &&
      age >= 8000;

    var playedThenBlank =
      hasRealPlay() &&
      noTargetMs >= 6500 &&
      (
        s.score >= 180 ||
        s.combo >= 6 ||
        maxState.clicks >= 12
      );

    var timeLikelyDone =
      age >= 30000 &&
      s.timeLeft === 0 &&
      hasRealPlay();

    return clearWin || clearEnd || playedThenBlank || timeLikelyDone;
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
    keep.set('reason', 'summary-rescue-v849r');

    return base + '?' + keep.toString();
  }

  function openFallbackSummary(reason){
    if(opened) return;
    opened = true;

    var s = updateState();

    window.GJ_SUMMARY_FINAL_ALLOWED_V849Q = true;
    window.GJ_REAL_SUMMARY_ALLOWED = true;
    window.GJ_REAL_WIN_CONFIRMED = true;
    window.GJ_ALLOW_REWARD_SUMMARY = true;
    window.GJ_SUMMARY_RESCUE_OPENED_V849R = true;

    var stars = 1;
    if(s.score >= 450 || s.combo >= 10) stars = 5;
    else if(s.score >= 300 || s.combo >= 8) stars = 4;
    else if(s.score >= 180 || s.combo >= 5) stars = 3;
    else if(s.score >= 80) stars = 2;

    var accuracy = s.score > 0 ? 100 : 0;
    var coins = Math.max(20, Math.round(s.score / 10));

    var summary = {
      reason:reason || 'summary-rescue',
      score:s.score,
      accuracy:accuracy,
      bestCombo:s.combo,
      combo:s.combo,
      stars:stars,
      coins:coins,
      rank:stars >= 5 ? 'Legend Hero' : 'Food Hero',
      badge:stars >= 5 ? 'Nutrition Champion' : 'Good Food Learner'
    };

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('GJ_SUMMARY_RESCUE_V849R_LAST', JSON.stringify({
        patch:PATCH,
        summary:summary,
        openedAt:new Date().toISOString()
      }));
    }catch(_){}

    try{
      window.dispatchEvent(new CustomEvent('gj:reward-summary-shown', {
        detail:summary
      }));
    }catch(_){}

    var old = document.querySelector('[data-gj-summary-rescue-v849r="1"]');
    if(old) old.remove();

    var overlay = document.createElement('section');
    overlay.setAttribute('data-gj-summary-rescue-v849r', '1');
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
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">' + s.score + '</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">คะแนน</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">' + accuracy + '%</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">ความแม่นยำ</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">x' + s.combo + '</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">คอมโบสูงสุด</span></div>' +
          '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:12px;"><b style="font-size:24px;">+' + coins + ' 🪙</b><br><span style="font-size:12px;font-weight:900;color:#64748b;">เหรียญ</span></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">' +
          '<button id="gjV849rReplayBtn" type="button" style="border:0;border-radius:16px;padding:13px 10px;background:#22c55e;color:white;font-weight:1000;">🔁 เล่นอีกครั้ง</button>' +
          '<button id="gjV849rCooldownBtn" type="button" style="border:0;border-radius:16px;padding:13px 10px;background:#2563eb;color:white;font-weight:1000;">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</div>';

    document.documentElement.appendChild(overlay);

    var replay = document.getElementById('gjV849rReplayBtn');
    var cooldown = document.getElementById('gjV849rCooldownBtn');

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

    console.warn('[GoodJunk Summary Rescue V849R] opened:', summary);
  }

  function tick(){
    updateState();

    if(countTargets() > 0){
      lastTargetSeenAt = Date.now();
    }

    if(shouldRescue()){
      openFallbackSummary('watchdog');
    }
  }

  document.addEventListener('click', function(){
    maxState.clicks++;
    lastActivityAt = Date.now();
  }, true);

  document.addEventListener('pointerdown', function(){
    maxState.clicks++;
    lastActivityAt = Date.now();
  }, true);

  [
    'gj:boss-defeated',
    'gj:final-win',
    'gj:game-complete',
    'gj:time-up',
    'gj:reward-summary-ready'
  ].forEach(function(name){
    window.addEventListener(name, function(){
      setTimeout(function(){
        openFallbackSummary(name);
      }, 450);
    }, true);
  });

  var mo = new MutationObserver(function(){
    if(hasWinText() || hasEndText()){
      setTimeout(function(){
        openFallbackSummary('mutation-end-text');
      }, 600);
    }
  });

  try{
    mo.observe(document.documentElement, {
      childList:true,
      subtree:true,
      characterData:true
    });
  }catch(_){}

  setInterval(tick, 700);

  window.GJ_SUMMARY_RESCUE_V849R = {
    patch:PATCH,
    open:function(reason){
      openFallbackSummary(reason || 'manual');
    },
    state:function(){
      updateState();
      return {
        state:maxState,
        age:Date.now() - installedAt,
        noTargetMs:Date.now() - lastTargetSeenAt,
        targets:countTargets(),
        opened:opened
      };
    }
  };

  console.log('[GoodJunk Summary Rescue V849R] installed');
})();