/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-no-flicker-v850m.js === */
/* FULL PATCH v20260608-GOODJUNK-SOLO-BOSS-SUMMARY-NO-FLICKER-V850M */
/*
  Purpose:
  - ใช้เป็น Summary owner ตัวเดียว
  - กัน summary กระพริบ / ซ้อน / เปิดซ้ำ
  - ไม่ restore ค่าเก่าจากรอบก่อน
  - เปิด summary เฉพาะเมื่อจบจริง: หมดเวลา / บอสแพ้ / lives หมด / event end จริง
  - ล็อก overlay หลังเปิดแล้ว ไม่ให้ patch อื่นเปิดทับ
*/

(function(){
  'use strict';

  var PATCH = 'v20260608-GOODJUNK-SOLO-BOSS-SUMMARY-NO-FLICKER-V850M';

  if(window.GJ_SUMMARY_NO_FLICKER_V850M_LOADED){
    console.warn('[GoodJunk Summary v850m] already loaded');
    return;
  }
  window.GJ_SUMMARY_NO_FLICKER_V850M_LOADED = true;

  var startedAt = Date.now();
  var summaryOpened = false;
  var hardLocked = false;
  var openTimer = 0;
  var observer = null;

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function num(v, d){
    v = Number(v);
    return Number.isFinite(v) ? v : (d || 0);
  }

  function textNum(id, d){
    var el = document.getElementById(id);
    if(!el) return d || 0;
    var s = String(el.textContent || '').replace(/[^\d.-]/g, '');
    return num(s, d || 0);
  }

  function readTimeLimit(){
    var q = qs();
    return Math.max(45, num(q.get('time'), 90));
  }

  function readView(){
    var q = qs();
    return String(q.get('view') || q.get('device') || 'mobile').toLowerCase();
  }

  function nowSec(){
    return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  }

  function findAnyText(patterns){
    var txt = String(document.body && document.body.innerText || '');
    return patterns.some(function(p){
      return p.test ? p.test(txt) : txt.indexOf(String(p)) >= 0;
    });
  }

  function readGameState(){
    var score = textNum('gjmScore', 0);
    var timeLeft = textNum('gjmTime', readTimeLimit());
    var comboText = '';
    var comboEl = document.getElementById('gjmCombo');

    if(comboEl){
      comboText = String(comboEl.textContent || '');
    }

    var combo = num(comboText.replace(/[^\d.-]/g, ''), 0);

    var livesText = '';
    var livesEl = document.getElementById('gjmLives');
    if(livesEl){
      livesText = String(livesEl.textContent || '');
    }

    var liveHearts = (livesText.match(/💚/g) || []).length;

    var candidates = [
      window.GJ_SOLO_BOSS_LIVE,
      window.GJ_SOLO_BOSS_STATE,
      window.GJ_STATE,
      window.GJ_GAME_STATE,
      window.GJ_METRICS,
      window.HHA_GJ_METRICS
    ].filter(Boolean);

    var goodHits = 0;
    var junkHits = 0;
    var fakeHits = 0;
    var miss = 0;
    var bestCombo = combo;
    var bossHp = null;
    var bossDefeated = false;
    var ended = false;

    candidates.forEach(function(s){
      if(!s || typeof s !== 'object') return;

      score = Math.max(score, num(s.score, score));
      goodHits = Math.max(goodHits, num(s.goodHits ?? s.good ?? s.goodCount ?? s.correct, goodHits));
      junkHits = Math.max(junkHits, num(s.junkHits ?? s.junk ?? s.junkCount, junkHits));
      fakeHits = Math.max(fakeHits, num(s.fakeHits ?? s.fake ?? s.fakeCount, fakeHits));
      miss = Math.max(miss, num(s.miss ?? s.misses ?? s.missed ?? s.badHits, miss));
      bestCombo = Math.max(bestCombo, num(s.bestCombo ?? s.maxCombo ?? s.combo, bestCombo));

      if(s.bossHp !== undefined) bossHp = num(s.bossHp, bossHp);
      if(s.bossHP !== undefined) bossHp = num(s.bossHP, bossHp);
      if(s.bossDefeated || s.win || s.result === 'win') bossDefeated = true;
      if(s.ended || s.gameOver || s.done || s.finished) ended = true;
    });

    var bossTextDefeated = findAnyText([
      /Boss Defeated/i,
      /บอสแพ้/,
      /ชนะบอส/,
      /ชนะบอสแล้ว/,
      /Junk Boss.*แพ้/,
      /จบเกมแล้ว/
    ]);

    if(bossTextDefeated) bossDefeated = true;

    if(bossHp !== null && bossHp <= 0) bossDefeated = true;

    if(score > 0 && goodHits <= 0){
      goodHits = Math.max(0, Math.round(score / 14));
    }

    if(bestCombo <= 0) bestCombo = combo;

    miss = Math.max(miss, junkHits + fakeHits);

    var totalAttempts = Math.max(0, goodHits + miss);
    var accuracy = totalAttempts > 0
      ? Math.round((goodHits / totalAttempts) * 100)
      : 0;

    var timeLimit = readTimeLimit();
    var playedSec = Math.min(timeLimit, nowSec());

    var timeExpired = timeLeft <= 0;
    var noLives = liveHearts === 0 && livesText.length > 0;

    return {
      patch: PATCH,
      score: score,
      timeLeft: timeLeft,
      playedSec: playedSec,
      timeLimit: timeLimit,
      goodHits: goodHits,
      junkHits: junkHits,
      fakeHits: fakeHits,
      miss: miss,
      combo: combo,
      bestCombo: bestCombo,
      accuracy: accuracy,
      bossHp: bossHp,
      bossDefeated: bossDefeated,
      ended: ended,
      timeExpired: timeExpired,
      noLives: noLives,
      view: readView()
    };
  }

  function isRealEnd(state, reason){
    if(!state) state = readGameState();

    if(state.timeExpired) return true;
    if(state.noLives) return true;

    if(state.bossDefeated && state.goodHits >= 8) return true;

    if(state.ended && state.playedSec >= 20 && state.goodHits >= 5) return true;

    if(String(reason || '').match(/time|expired|gameover|boss-defeated|defeated|win|finish|complete|end/i)){
      if(state.playedSec >= 20 || state.goodHits >= 8 || state.timeExpired || state.bossDefeated){
        return true;
      }
    }

    return false;
  }

  function starsOf(state){
    if(state.bossDefeated && state.accuracy >= 90 && state.junkHits === 0) return 5;
    if(state.bossDefeated && state.accuracy >= 75) return 4;
    if(state.goodHits >= 18 && state.accuracy >= 70) return 3;
    if(state.goodHits >= 10) return 2;
    return 1;
  }

  function rankOf(state){
    if(state.bossDefeated && state.accuracy >= 90 && state.junkHits === 0) return 'Nutrition Champion';
    if(state.bossDefeated || state.goodHits >= 20) return 'Food Hero';
    if(state.goodHits >= 10) return 'Good Choice Hero';
    return 'Food Learner';
  }

  function titleOf(state){
    if(state.bossDefeated) return 'ชนะบอสแบบสุดยอด!';
    if(state.timeExpired) return 'หมดเวลาแล้ว!';
    if(state.noLives) return 'พลังหมดแล้ว!';
    return 'สรุปผล GoodJunk';
  }

  function subtitleOf(state){
    if(state.bossDefeated){
      return 'เลือกอาหารดีและหลบอาหารขยะได้เยี่ยมมาก';
    }
    if(state.accuracy >= 80){
      return 'ทำได้ดีมาก รอบหน้าเก็บอาหารดีให้ครบเป้าหมาย';
    }
    return 'รอบหน้าลองโฟกัสอาหารดีและหลบ junk ให้มากขึ้น';
  }

  function removeOldSummaryLayers(){
    var selectors = [
      '#gjRewardOverlay',
      '#gjrOverlay',
      '#gjSummaryOverlay',
      '#gjSummaryModal',
      '#gjResultOverlay',
      '.gjr-overlay',
      '.gj-summary-overlay',
      '.gj-result-overlay',
      '.gj-reward-overlay',
      '[data-gj-summary-layer]',
      '[data-gj-reward-layer]'
    ];

    selectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(el){
        if(el && el.id !== 'gjSummaryV850mOverlay'){
          try{ el.remove(); }catch(e){}
        }
      });
    });
  }

  function buildLauncherUrl(){
    var q = qs();
    var u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html');

    u.searchParams.set('pid', q.get('pid') || 'anon');
    u.searchParams.set('name', q.get('name') || q.get('nick') || 'Hero');
    u.searchParams.set('diff', q.get('diff') || 'normal');
    u.searchParams.set('time', q.get('time') || '90');
    u.searchParams.set('view', q.get('view') || q.get('device') || 'mobile');
    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo');
    u.searchParams.set('entry', 'summary-return');

    return u.toString();
  }

  function buildCooldownUrl(state){
    var q = qs();
    var launcher = buildLauncherUrl();
    var u = new URL('https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html');

    u.searchParams.set('zone', 'nutrition');
    u.searchParams.set('cat', 'nutrition');
    u.searchParams.set('game', 'goodjunk');
    u.searchParams.set('gameId', 'goodjunk');
    u.searchParams.set('mode', 'solo_boss');
    u.searchParams.set('phase', 'cooldown');

    u.searchParams.set('pid', q.get('pid') || 'anon');
    u.searchParams.set('name', q.get('name') || q.get('nick') || 'Hero');
    u.searchParams.set('diff', q.get('diff') || 'normal');
    u.searchParams.set('time', q.get('time') || '90');
    u.searchParams.set('view', q.get('view') || q.get('device') || 'mobile');

    u.searchParams.set('hub', launcher);
    u.searchParams.set('next', launcher);
    u.searchParams.set('back', launcher);
    u.searchParams.set('launcher', launcher);
    u.searchParams.set('return', launcher);
    u.searchParams.set('returnUrl', launcher);
    u.searchParams.set('done', launcher);
    u.searchParams.set('doneUrl', launcher);
    u.searchParams.set('cdnext', launcher);

    u.searchParams.set('score', state.score);
    u.searchParams.set('accuracy', state.accuracy);
    u.searchParams.set('goodHits', state.goodHits);
    u.searchParams.set('junkHits', state.junkHits);
    u.searchParams.set('fakeHits', state.fakeHits);
    u.searchParams.set('miss', state.miss);
    u.searchParams.set('bestCombo', state.bestCombo);
    u.searchParams.set('rank', rankOf(state));
    u.searchParams.set('stars', starsOf(state));
    u.searchParams.set('from', 'goodjunk-summary-v850m');

    return u.toString();
  }

  function css(){
    if(document.getElementById('gjSummaryV850mStyle')) return;

    var style = document.createElement('style');
    style.id = 'gjSummaryV850mStyle';
    style.textContent = `
      #gjSummaryV850mOverlay{
        position:fixed;
        inset:0;
        z-index:2147483600;
        display:grid;
        place-items:center;
        padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px));
        background:rgba(15,23,42,.48);
        backdrop-filter:blur(10px);
        overflow:auto;
      }
      #gjSummaryV850mCard{
        width:min(560px, calc(100vw - 28px));
        max-height:calc(100dvh - 28px);
        overflow:auto;
        border-radius:32px;
        background:rgba(255,255,255,.98);
        border:2px solid rgba(255,255,255,.92);
        box-shadow:0 30px 90px rgba(15,23,42,.34);
        padding:22px;
        color:#111827;
        text-align:center;
      }
      #gjSummaryV850mCard .trophy{
        font-size:52px;
        line-height:1;
      }
      #gjSummaryV850mCard h2{
        margin:8px 0 4px;
        font-size:clamp(30px,7vw,44px);
        line-height:1.05;
        letter-spacing:-.035em;
      }
      #gjSummaryV850mCard .stars{
        font-size:30px;
        margin:8px 0;
        letter-spacing:2px;
      }
      #gjSummaryV850mCard .sub{
        margin:0 auto 14px;
        color:#64748b;
        font-size:15px;
        font-weight:900;
        line-height:1.35;
      }
      #gjSummaryV850mCard .grid{
        display:grid;
        grid-template-columns:repeat(2,1fr);
        gap:10px;
        margin:12px 0;
      }
      #gjSummaryV850mCard .box{
        border-radius:18px;
        border:2px solid #e2e8f0;
        background:linear-gradient(180deg,#fff,#f8fafc);
        padding:13px 8px;
        min-height:78px;
      }
      #gjSummaryV850mCard .box b{
        display:block;
        font-size:28px;
        line-height:1.05;
        color:#0f172a;
      }
      #gjSummaryV850mCard .box span{
        display:block;
        margin-top:5px;
        font-size:12px;
        font-weight:1000;
        color:#64748b;
      }
      #gjSummaryV850mCard .explain{
        margin:10px 0 0;
        padding:11px 12px;
        border-radius:18px;
        background:#f8fafc;
        border:1px solid #e2e8f0;
        color:#475569;
        font-size:13px;
        line-height:1.45;
        font-weight:850;
        text-align:left;
      }
      #gjSummaryV850mCard .actions{
        position:sticky;
        bottom:-22px;
        margin:14px -22px -22px;
        padding:12px 22px 22px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        background:linear-gradient(180deg,rgba(255,255,255,.72),#fff 35%);
      }
      #gjSummaryV850mCard button{
        border:0;
        border-radius:18px;
        min-height:58px;
        padding:12px;
        color:#fff;
        font:1000 16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        cursor:pointer;
      }
      #gjSummaryV850mReplay{
        background:linear-gradient(180deg,#22c55e,#16a34a);
      }
      #gjSummaryV850mCooldown{
        background:linear-gradient(180deg,#38bdf8,#2563eb);
      }
      @media (max-width:480px){
        #gjSummaryV850mOverlay{
          align-items:start;
          padding:12px 10px calc(12px + env(safe-area-inset-bottom,0px));
        }
        #gjSummaryV850mCard{
          width:calc(100vw - 20px);
          border-radius:28px;
          padding:18px;
        }
        #gjSummaryV850mCard .grid{
          gap:8px;
        }
        #gjSummaryV850mCard .box{
          min-height:72px;
          padding:11px 6px;
        }
        #gjSummaryV850mCard .box b{
          font-size:25px;
        }
        #gjSummaryV850mCard .actions{
          margin:12px -18px -18px;
          padding:10px 18px 18px;
        }
        #gjSummaryV850mCard button{
          min-height:60px;
          font-size:15px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function openSummary(reason){
    if(summaryOpened || hardLocked) return;

    var state = readGameState();

    if(!isRealEnd(state, reason)){
      console.warn('[GoodJunk Summary v850m] blocked early summary', {
        reason: reason,
        state: state
      });
      return;
    }

    summaryOpened = true;
    hardLocked = true;

    try{
      window.GJ_SUMMARY_OPENED = true;
      window.GJ_SUMMARY_LOCKED = true;
      window.GJ_DISABLE_LEGACY_SUMMARY = true;
    }catch(e){}

    clearTimeout(openTimer);
    removeOldSummaryLayers();
    css();

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify({
        patch: PATCH,
        reason: reason || 'unknown',
        savedAt: new Date().toISOString(),
        state: state
      }));
    }catch(e){}

    var overlay = document.createElement('div');
    overlay.id = 'gjSummaryV850mOverlay';
    overlay.dataset.gjSummaryLayer = 'v850m';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var stars = '⭐'.repeat(starsOf(state));
    var rank = rankOf(state);

    overlay.innerHTML =
      '<section id="gjSummaryV850mCard">' +
        '<div class="trophy">🏆</div>' +
        '<h2>' + titleOf(state) + '</h2>' +
        '<div class="stars">' + stars + '</div>' +
        '<p class="sub">' + subtitleOf(state) + '</p>' +

        '<div class="grid">' +
          '<div class="box"><b>' + state.score + '</b><span>คะแนน</span></div>' +
          '<div class="box"><b>' + state.accuracy + '%</b><span>ความแม่นยำ</span></div>' +
          '<div class="box"><b>' + state.goodHits + '</b><span>อาหารดี</span></div>' +
          '<div class="box"><b>x' + state.bestCombo + '</b><span>คอมโบสูงสุด</span></div>' +
          '<div class="box"><b>' + state.miss + '</b><span>miss = แตะ junk + หลุด/พลาด</span></div>' +
          '<div class="box"><b>' + rank + '</b><span>Rank</span></div>' +
        '</div>' +

        '<div class="explain">' +
          'สรุปผลรอบนี้: อาหารดี ' + state.goodHits +
          ' ครั้ง, แตะ junk ' + state.junkHits +
          ' ครั้ง, อาหารหลอกตา/พลาด ' + state.fakeHits +
          ' ครั้ง, miss รวม ' + state.miss +
          ' ครั้ง — ความแม่นยำคำนวณจาก อาหารดี ÷ (อาหารดี + miss)' +
        '</div>' +

        '<div class="actions">' +
          '<button id="gjSummaryV850mReplay" type="button">🔁 เล่นอีกครั้ง</button>' +
          '<button id="gjSummaryV850mCooldown" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</section>';

    document.body.appendChild(overlay);

    var replay = document.getElementById('gjSummaryV850mReplay');
    var cooldown = document.getElementById('gjSummaryV850mCooldown');

    if(replay){
      replay.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        location.href = location.pathname + location.search.replace(/([?&])run=play(&?)/, '$1') + (location.search ? '&' : '?') + 'run=play&restart=1&x=' + Date.now();
      }, true);
    }

    if(cooldown){
      cooldown.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        location.href = buildCooldownUrl(state);
      }, true);
    }

    try{
      window.dispatchEvent(new CustomEvent('gj:summary-v850m-opened', {
        detail: state
      }));
    }catch(e){}

    console.info('[GoodJunk Summary v850m] opened', {
      reason: reason,
      state: state
    });
  }

  function scheduleOpen(reason, delay){
    if(summaryOpened || hardLocked) return;
    clearTimeout(openTimer);
    openTimer = setTimeout(function(){
      openSummary(reason);
    }, delay || 350);
  }

  function scanForEnd(){
    if(summaryOpened || hardLocked) return;

    var state = readGameState();

    if(isRealEnd(state, 'scan')){
      scheduleOpen('scan-real-end', 350);
    }
  }

  function hookEvents(){
    [
      'gj:game-over',
      'gj:game:end',
      'gj:boss-defeated',
      'gj:boss-defeated-real',
      'gj:finish',
      'gj:complete',
      'gj:time-expired',
      'gj:lives-empty',
      'gj:reward-summary-shown'
    ].forEach(function(name){
      window.addEventListener(name, function(ev){
        var reason = name;
        var state = readGameState();

        if(ev && ev.detail && typeof ev.detail === 'object'){
          if(ev.detail.reason) reason += ':' + ev.detail.reason;
          if(ev.detail.result) reason += ':' + ev.detail.result;
        }

        if(isRealEnd(state, reason)){
          scheduleOpen(reason, 250);
        }else{
          console.warn('[GoodJunk Summary v850m] ignored early event', {
            event: name,
            state: state
          });
        }
      }, true);
    });
  }

  function protectAgainstDuplicateLayers(){
    if(observer) return;

    observer = new MutationObserver(function(){
      if(!summaryOpened) return;

      document.querySelectorAll(
        '#gjRewardOverlay,#gjrOverlay,#gjSummaryOverlay,#gjSummaryModal,#gjResultOverlay,.gjr-overlay,.gj-summary-overlay,.gj-result-overlay,.gj-reward-overlay,[data-gj-reward-layer]'
      ).forEach(function(el){
        if(el && el.id !== 'gjSummaryV850mOverlay'){
          try{ el.remove(); }catch(e){}
        }
      });

      var main = document.getElementById('gjSummaryV850mOverlay');
      if(main){
        main.style.setProperty('display', 'grid', 'important');
        main.style.setProperty('visibility', 'visible', 'important');
        main.style.setProperty('opacity', '1', 'important');
      }
    });

    observer.observe(document.documentElement, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['style','class','hidden']
    });
  }

  function boot(){
    hookEvents();
    protectAgainstDuplicateLayers();

    setInterval(scanForEnd, 700);

    window.GJ_OPEN_SUMMARY_V850M = openSummary;
    window.GJ_SUMMARY_V850M_STATE = readGameState;

    console.info('[GoodJunk Summary v850m] installed');
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
