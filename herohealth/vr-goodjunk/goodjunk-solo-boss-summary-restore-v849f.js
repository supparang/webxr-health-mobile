/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-restore-v849f.js === */
/* FULL PATCH v20260606-GOODJUNK-SOLO-SUMMARY-RESTORE-V849F
   Purpose:
   - แก้เคสชนะบอสแล้ว แต่หน้า Summary ไม่ขึ้น
   - จับสถานะ Boss Defeated / ชนะบอสแล้ว จาก DOM
   - เรียก/ยิง event summary ให้ระบบ reward เดิมทำงาน
   - ไม่ยุ่งกับ warmup/cooldown path
*/

(function(){
  'use strict';

  var PATCH = 'v20260606-GOODJUNK-SOLO-SUMMARY-RESTORE-V849F';

  if(window.GJ_SOLO_SUMMARY_RESTORE_V849F_LOADED){
    return;
  }
  window.GJ_SOLO_SUMMARY_RESTORE_V849F_LOADED = true;

  var fired = false;
  var observer = null;
  var intervalId = 0;
  var startedAt = Date.now();

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function num(v, d){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function textOfPage(){
    return String((document.body && document.body.innerText) || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function byId(id){
    return document.getElementById(id);
  }

  function readIntFrom(id, fallback){
    var el = byId(id);
    if(!el) return fallback;
    var t = String(el.textContent || '').replace(/[^\d.-]/g, '');
    var n = Number(t);
    return Number.isFinite(n) ? n : fallback;
  }

  function readCombo(){
    var el = byId('gjmCombo');
    if(!el) return 0;
    var t = String(el.textContent || '').replace(/[^\d.-]/g, '');
    var n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }

  function readLives(){
    var el = byId('gjmLives');
    if(!el) return 0;
    var t = String(el.textContent || '');
    var m = t.match(/💚/g);
    return m ? m.length : 0;
  }

  function readLatestSummary(){
    var out = {};

    try{
      out = JSON.parse(
        localStorage.getItem('GJ_SOLO_BOSS_LAST_SUMMARY') ||
        localStorage.getItem('GJ_FULL_3D_VR_LAST_SUMMARY') ||
        '{}'
      ) || {};
    }catch(_){
      out = {};
    }

    return out;
  }

  function saveSummary(summary){
    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('GJ_SOLO_BOSS_SUMMARY_RESTORE_LAST', JSON.stringify({
        patch: PATCH,
        savedAt: new Date().toISOString(),
        summary: summary
      }));
    }catch(_){}
  }

  function buildSummary(){
    var q = qs();
    var latest = readLatestSummary();

    var score = num(latest.score, readIntFrom('gjmScore', 0));
    var bestCombo = num(
      latest.bestCombo || latest.combo,
      readCombo()
    );

    var goodHits =
      num(latest.goodHits || latest.good || latest.hitGood || latest.correct, 0);

    var junkHits =
      num(latest.junkHits || latest.junk || latest.hitJunk, 0);

    var fakeHits =
      num(latest.fakeHits || latest.fake || latest.hitFake, 0);

    var miss =
      num(latest.miss || latest.misses, junkHits + fakeHits);

    /*
      ถ้า core ไม่ส่ง goodHits มา ให้ประมาณจาก score/combo
      เพื่อให้ summary ไม่เป็น 0 ทั้งหน้า
    */
    if(goodHits <= 0){
      goodHits = Math.max(
        1,
        Math.round(score / 60),
        bestCombo || 1
      );
    }

    var total = Math.max(1, goodHits + junkHits + fakeHits + miss);
    var accuracy = latest.accuracy || latest.acc;

    if(accuracy === undefined || accuracy === null || accuracy === ''){
      accuracy = Math.round((goodHits / total) * 100);
    }

    var stars = latest.stars;
    if(stars === undefined || stars === null || stars === ''){
      stars = accuracy >= 90 ? 5 :
              accuracy >= 80 ? 4 :
              accuracy >= 65 ? 3 :
              accuracy >= 50 ? 2 : 1;
    }

    var rank = latest.rank || (
      accuracy >= 90 ? 'Legend Hero' :
      accuracy >= 80 ? 'Nutrition Champion' :
      accuracy >= 65 ? 'Food Defender' :
      'Food Learner'
    );

    var badge = latest.badge || (
      accuracy >= 90 ? '🏆 Nutrition Champion' :
      accuracy >= 80 ? '🥗 Healthy Hero' :
      '🍎 Food Learner'
    );

    var coins = latest.coins;
    if(coins === undefined || coins === null || coins === ''){
      coins = Math.max(20, Math.round(score / 6) + Number(stars) * 5);
    }

    return {
      patch: PATCH,
      game: 'goodjunk',
      mode: 'solo_boss',
      result: 'win',
      win: true,
      bossDefeated: true,

      pid: q.get('pid') || 'anon',
      name: q.get('name') || q.get('nick') || 'Hero',
      diff: q.get('diff') || 'normal',
      time: q.get('time') || '90',
      view: q.get('view') || 'mobile',

      score: score,
      accuracy: Number(accuracy) || 0,
      stars: Number(stars) || 1,
      rank: rank,
      badge: badge,
      coins: Number(coins) || 0,

      goodHits: Number(goodHits) || 0,
      junkHits: Number(junkHits) || 0,
      fakeHits: Number(fakeHits) || 0,
      miss: Number(miss) || 0,
      misses: Number(miss) || 0,
      bestCombo: Number(bestCombo) || 0,
      combo: Number(bestCombo) || 0,
      livesLeft: readLives(),

      missionDone: latest.missionDone || latest.mission || 2,
      endedReason: 'boss-defeated-summary-restore',
      endedAt: new Date().toISOString()
    };
  }

  function callKnownSummaryFunctions(summary){
    var names = [
      'GJ_SHOW_REWARD_SUMMARY',
      'GJ_SHOW_SUMMARY',
      'GJ_REWARD_SHOW_SUMMARY',
      'showGoodJunkRewardSummary',
      'showGoodJunkSummary',
      'showRewardSummary',
      'renderRewardSummary',
      'renderSummary'
    ];

    for(var i = 0; i < names.length; i++){
      var fn = window[names[i]];
      if(typeof fn === 'function'){
        try{
          fn(summary);
          return true;
        }catch(e){
          console.warn('[GoodJunk summary restore] function failed:', names[i], e);
        }
      }
    }

    return false;
  }

  function dispatchSummaryEvents(summary){
    var events = [
      'gj:game-ended',
      'gj:boss-defeated',
      'gj:summary-ready',
      'gj:reward-summary-ready',
      'gj:reward-summary-shown'
    ];

    events.forEach(function(name){
      try{
        window.dispatchEvent(new CustomEvent(name, { detail: summary }));
      }catch(_){}
    });
  }

  function forceClickRewardIfExists(){
    var candidates = [
      '#gjrOpenBtn',
      '#gjRewardBtn',
      '#gjmSummaryBtn',
      '[data-open-summary="1"]',
      '[data-action="summary"]'
    ];

    for(var i = 0; i < candidates.length; i++){
      var el = document.querySelector(candidates[i]);
      if(el && typeof el.click === 'function'){
        try{
          el.click();
          return true;
        }catch(_){}
      }
    }

    return false;
  }

  function showFallbackSummary(summary){
    if(document.getElementById('gjSummaryRestoreModal')) return;

    var modal = document.createElement('section');
    modal.id = 'gjSummaryRestoreModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483000',
      'display:grid',
      'place-items:center',
      'padding:18px',
      'background:rgba(15,23,42,.42)',
      'backdrop-filter:blur(5px)',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'
    ].join(';');

    var stars = '⭐'.repeat(Math.max(1, Math.min(5, Number(summary.stars || 1))));

    modal.innerHTML =
      '<div style="' +
        'width:min(560px,calc(100vw - 28px));' +
        'max-height:calc(100dvh - 28px);' +
        'overflow:auto;' +
        'border-radius:30px;' +
        'background:rgba(255,255,255,.97);' +
        'border:3px solid rgba(255,255,255,.92);' +
        'box-shadow:0 30px 80px rgba(15,23,42,.34);' +
        'padding:22px;' +
        'text-align:center;' +
        'color:#172033;' +
      '">' +
        '<div style="font-size:54px;line-height:1;">🏆</div>' +
        '<h1 style="margin:8px 0 0;font-size:clamp(28px,7vw,44px);line-height:1.05;color:#0f172a;">ชนะบอสแบบสุดยอด!</h1>' +
        '<div style="margin-top:8px;font-size:26px;">' + stars + '</div>' +
        '<p style="margin:8px auto 0;color:#64748b;font-weight:900;">เลือกอาหารดีและหลบอาหารขยะได้เยี่ยมมาก</p>' +

        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:16px;">' +
          card('คะแนน', summary.score) +
          card('ความแม่นยำ', summary.accuracy + '%') +
          card('อาหารดี', summary.goodHits) +
          card('พลาดรวม', summary.miss) +
          card('คอมโบสูงสุด', 'x' + summary.bestCombo) +
          card('เหรียญ', '+' + summary.coins + ' 🪙') +
        '</div>' +

        '<div style="margin-top:16px;display:grid;gap:10px;grid-template-columns:1fr 1fr;">' +
          '<button id="gjSummaryRestoreReplay" type="button" style="' + btnStyle('#22c55e','#16a34a') + '">🔁 เล่นอีกครั้ง</button>' +
          '<button id="gjSummaryRestoreCooldown" type="button" style="' + btnStyle('#3b82f6','#2563eb') + '">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</div>';

    document.documentElement.appendChild(modal);

    var replay = document.getElementById('gjSummaryRestoreReplay');
    var cooldown = document.getElementById('gjSummaryRestoreCooldown');

    if(replay){
      replay.addEventListener('click', function(){
        location.reload();
      });
    }

    if(cooldown){
      cooldown.addEventListener('click', function(){
        if(window.GJ_SOLO_BOSS_SHELL && typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'){
          window.GJ_SOLO_BOSS_SHELL.goCooldown(summary);
        }else{
          location.href = './goodjunk-launcher.html';
        }
      });
    }
  }

  function card(label, value){
    return '<div style="' +
      'border-radius:18px;' +
      'background:linear-gradient(180deg,#fff,#f8fafc);' +
      'border:2px solid rgba(226,232,240,.86);' +
      'padding:12px 10px;' +
      'min-height:74px;' +
    '">' +
      '<b style="display:block;font-size:24px;color:#0f172a;line-height:1;">' + String(value) + '</b>' +
      '<span style="display:block;margin-top:5px;color:#64748b;font-size:12px;font-weight:1000;">' + String(label) + '</span>' +
    '</div>';
  }

  function btnStyle(a,b){
    return [
      'border:0',
      'border-radius:18px',
      'min-height:54px',
      'padding:12px 14px',
      'background:linear-gradient(135deg,' + a + ',' + b + ')',
      'color:#fff',
      'font:1000 15px system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 14px 28px rgba(15,23,42,.18)',
      'cursor:pointer'
    ].join(';');
  }

  function looksWon(){
    var text = textOfPage();

    return (
      text.indexOf('ชนะบอสแล้ว') !== -1 ||
      text.indexOf('Boss Defeated') !== -1 ||
      text.indexOf('boss defeated') !== -1 ||
      text.indexOf('ชนะบอสแบบสุดยอด') !== -1
    );
  }

  function openSummary(reason){
    if(fired) return;
    fired = true;

    try{
      if(observer) observer.disconnect();
    }catch(_){}

    if(intervalId){
      clearInterval(intervalId);
      intervalId = 0;
    }

    var summary = buildSummary();
    summary.reason = reason || 'detected-win';

    saveSummary(summary);
    dispatchSummaryEvents(summary);

    setTimeout(function(){
      var ok = callKnownSummaryFunctions(summary);

      if(!ok){
        forceClickRewardIfExists();
      }

      setTimeout(function(){
        var text = textOfPage();

        /*
          ถ้า reward เดิมไม่ขึ้นจริง ให้ fallback modal เอง
        */
        if(
          !document.getElementById('gjrSummary') &&
          !document.getElementById('gjRewardSummary') &&
          !document.getElementById('gjSummaryRestoreModal') &&
          text.indexOf('ชนะบอสแบบสุดยอด!') === -1
        ){
          showFallbackSummary(summary);
        }
      }, 450);
    }, 180);

    console.log('[GoodJunk Summary Restore V849F] opened:', reason, summary);
  }

  function tick(){
    if(fired) return;

    if(looksWon()){
      openSummary('boss-defeated-dom');
      return;
    }

    if(Date.now() - startedAt > 240000){
      if(intervalId){
        clearInterval(intervalId);
        intervalId = 0;
      }
    }
  }

  try{
    observer = new MutationObserver(tick);
    observer.observe(document.documentElement, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true
    });
  }catch(_){}

  intervalId = setInterval(tick, 350);

  window.addEventListener('load', tick);
  window.addEventListener('pageshow', tick);
  document.addEventListener('DOMContentLoaded', tick);

  setTimeout(tick, 300);
  setTimeout(tick, 900);
  setTimeout(tick, 1800);
})();
