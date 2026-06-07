/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-restore-v849i.js === */
/* FULL PATCH v20260606-GOODJUNK-SOLO-SUMMARY-RESTORE-V849I
   Fix:
   - ไม่ให้ Summary โผล่เร็วตอนเริ่มเกม
   - ถ้า boss-defeated จริง + hasRealPlay/score/combo มีจริง ให้เปิด Summary
   - ไม่เอา requiredGoodHits=40 มาบล็อกการชนะบอส
   - ลด spam restore loop
*/

(function(){
  'use strict';

  var PATCH = 'v20260606-GOODJUNK-SOLO-SUMMARY-RESTORE-V849I';

  if(window.GJ_SOLO_SUMMARY_RESTORE_V849I_LOADED){
    return;
  }
  window.GJ_SOLO_SUMMARY_RESTORE_V849I_LOADED = true;

  var fired = false;
  var pageLoadedAt = Date.now();
  var realPlayAt = 0;
  var hasRealPlay = false;
  var actionCount = 0;
  var lastBlockedAt = 0;

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function q(name, fallback){
    var v = qs().get(name);
    return v === null || v === '' ? fallback : v;
  }

  function num(v, d){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function byId(id){
    return document.getElementById(id);
  }

  function readInt(id, fallback){
    var el = byId(id);
    if(!el) return fallback;

    var n = Number(
      String(el.textContent || '')
        .replace(/[^\d.-]/g, '')
    );

    return Number.isFinite(n) ? n : fallback;
  }

  function readScore(){
    return readInt('gjmScore', 0);
  }

  function readCombo(){
    return readInt('gjmCombo', 0);
  }

  function startOverlayVisible(){
    var el = byId('gjmStartOverlay');
    if(!el) return false;

    var cs = getComputedStyle(el);

    return (
      cs.display !== 'none' &&
      cs.visibility !== 'hidden' &&
      Number(cs.opacity || 1) > 0.05 &&
      cs.pointerEvents !== 'none'
    );
  }

  function summaryAlreadyVisible(){
    return !!(
      document.getElementById('gjSummaryRestoreModal') ||
      document.getElementById('gjrSummary') ||
      document.getElementById('gjRewardSummary') ||
      document.querySelector('[data-goodjunk-summary="1"]') ||
      document.querySelector('.gjr-summary')
    );
  }

  function markRealPlay(reason){
    if(!hasRealPlay){
      hasRealPlay = true;
      realPlayAt = Date.now();

      try{
        sessionStorage.setItem('GJ_SOLO_CURRENT_RUN_STARTED_AT', String(realPlayAt));
        sessionStorage.setItem('GJ_SOLO_CURRENT_RUN_REASON', reason || '');
      }catch(_){}
    }

    if(reason){
      console.log('[GoodJunk Summary Restore V849I] real play:', reason);
    }
  }

  function clearOldSummaryOnFreshRun(){
    try{
      localStorage.removeItem('GJ_SOLO_BOSS_LAST_SUMMARY');
      localStorage.removeItem('GJ_FULL_3D_VR_LAST_SUMMARY');
      localStorage.removeItem('GJ_SOLO_BOSS_SUMMARY_RESTORE_LAST');
      sessionStorage.removeItem('GJ_SOLO_LAST_WIN_EVENT');
    }catch(_){}
  }

  function detailOf(ev){
    return ev && ev.detail && typeof ev.detail === 'object'
      ? ev.detail
      : {};
  }

  function getGoodHits(d){
    return num(
      d.goodHits ??
      d.good ??
      d.correct ??
      d.hitGood ??
      d.goodCount ??
      d.hits ??
      d.foodHits,
      0
    );
  }

  function getMiss(d){
    return num(
      d.miss ??
      d.misses ??
      d.junkHits ??
      d.junk ??
      0,
      0
    );
  }

  function isBossDefeatedDetail(d, reason){
    return (
      reason === 'gj:boss-defeated' ||
      d.reason === 'boss-defeated' ||
      d.endedReason === 'boss-defeated' ||
      d.type === 'boss-defeated' ||
      d.bossDefeated === true ||
      d.win === true ||
      d.result === 'win'
    );
  }

  function hasRealBossWinEvidence(d, reason){
    var score = num(d.score, readScore());
    var combo = num(d.bestCombo ?? d.combo, readCombo());
    var goodHits = getGoodHits(d);
    var elapsed = Date.now() - pageLoadedAt;

    /*
      จุดสำคัญของ v849i:
      ถ้าบอสแพ้จริงแล้ว ไม่ต้องรอ goodHits 40
      เพราะ 40 คือภารกิจรอบหน้า ไม่ใช่เงื่อนไขชนะบอส
    */
    if(isBossDefeatedDetail(d, reason)){
      if(hasRealPlay && score >= 180 && combo >= 2) return true;
      if(hasRealPlay && goodHits >= 6 && score >= 120) return true;
      if(actionCount >= 2 && score >= 180 && combo >= 2) return true;
      if(score >= 300 && combo >= 3) return true;
    }

    /*
      กัน Summary ปลอมตอนโหลดหน้า:
      ต้องมีอย่างน้อยคะแนนหรือการกระทำที่เกิดจริง
    */
    if(hasRealPlay && elapsed >= 5000 && score >= 220 && combo >= 3){
      return true;
    }

    if(hasRealPlay && elapsed >= 5000 && goodHits >= 10 && score >= 180){
      return true;
    }

    return false;
  }

  function shouldOpenSummary(d, reason){
    if(fired) return false;
    if(summaryAlreadyVisible()) return false;
    if(!isBossDefeatedDetail(d, reason)) return false;

    var score = num(d.score, readScore());
    var combo = num(d.bestCombo ?? d.combo, readCombo());

    /*
      ถ้ายังอยู่หน้าเริ่มเกม ห้ามเปิด ยกเว้นมีหลักฐานชนะจริงแรงมาก
    */
    if(startOverlayVisible()){
      if(!(score >= 300 && combo >= 3 && hasRealPlay)){
        return false;
      }
    }

    return hasRealBossWinEvidence(d, reason);
  }

  function normalizeSummary(d, reason){
    var score = num(d.score, readScore());
    var goodHits = getGoodHits(d);
    var miss = getMiss(d);
    var combo = num(d.bestCombo ?? d.combo, readCombo());

    if(goodHits <= 0 && score > 0){
      goodHits = Math.max(1, Math.round(score / 24));
    }

    var accuracy = d.accuracy ?? d.acc;

    if(accuracy === undefined || accuracy === null || accuracy === ''){
      var total = Math.max(1, goodHits + miss);
      accuracy = Math.round((goodHits / total) * 100);
    }

    var stars = d.stars;

    if(stars === undefined || stars === null || stars === ''){
      stars =
        accuracy >= 90 ? 5 :
        accuracy >= 80 ? 4 :
        accuracy >= 65 ? 3 :
        accuracy >= 50 ? 2 :
        1;
    }

    var rank = d.rank || (
      accuracy >= 90 ? 'Legend Hero' :
      accuracy >= 80 ? 'Nutrition Champion' :
      accuracy >= 65 ? 'Food Defender' :
      'Food Learner'
    );

    var badge = d.badge || (
      accuracy >= 90 ? '🏆 Nutrition Champion' :
      accuracy >= 80 ? '🥗 Healthy Hero' :
      '🍎 Food Learner'
    );

    var coins = d.coins;

    if(coins === undefined || coins === null || coins === ''){
      coins = Math.max(20, Math.round(score / 6) + Number(stars) * 5);
    }

    return {
      patch: PATCH,
      reason: reason || 'boss-defeated',
      game: 'goodjunk',
      mode: 'solo_boss',
      result: 'win',
      win: true,
      bossDefeated: true,

      pid: q('pid', 'anon'),
      name: q('name', q('nick', 'Hero')),
      diff: q('diff', 'normal'),
      time: q('time', '90'),
      view: q('view', 'mobile'),

      score: score,
      accuracy: Number(accuracy) || 0,
      stars: Number(stars) || 1,
      rank: rank,
      badge: badge,
      coins: Number(coins) || 0,

      goodHits: Number(goodHits) || 0,
      junkHits: num(d.junkHits ?? d.junk, 0),
      fakeHits: num(d.fakeHits ?? d.fake, 0),
      miss: Number(miss) || 0,
      misses: Number(miss) || 0,
      bestCombo: Number(combo) || 0,
      combo: Number(combo) || 0,

      missionDone: d.missionDone || d.mission || 2,
      endedReason: 'boss-defeated',
      endedAt: new Date().toISOString()
    };
  }

  function saveSummary(summary){
    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('GJ_FULL_3D_VR_LAST_SUMMARY', JSON.stringify(summary));
      localStorage.setItem('GJ_SOLO_BOSS_SUMMARY_RESTORE_LAST', JSON.stringify({
        patch: PATCH,
        savedAt: new Date().toISOString(),
        summary: summary
      }));
    }catch(_){}
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
          console.log('[GoodJunk Summary Restore V849I] called:', names[i]);
          return true;
        }catch(e){
          console.warn('[GoodJunk Summary Restore V849I] function failed:', names[i], e);
        }
      }
    }

    return false;
  }

  function card(label, value){
    return '' +
      '<div style="border-radius:18px;background:linear-gradient(180deg,#fff,#f8fafc);border:2px solid rgba(226,232,240,.86);padding:12px 10px;min-height:74px;">' +
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

  function showFallbackSummary(summary){
    if(summaryAlreadyVisible()) return;

    var modal = document.createElement('section');
    modal.id = 'gjSummaryRestoreModal';
    modal.dataset.goodjunkSummary = '1';
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
      '<div style="width:min(560px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;border-radius:30px;background:rgba(255,255,255,.97);border:3px solid rgba(255,255,255,.92);box-shadow:0 30px 80px rgba(15,23,42,.34);padding:22px;text-align:center;color:#172033;">' +
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
          location.href = 'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html';
        }
      });
    }
  }

  function blockLog(reason, detail){
    var now = Date.now();

    if(now - lastBlockedAt < 1200){
      return;
    }

    lastBlockedAt = now;

    console.warn('[GoodJunk Summary Restore V849I] blocked summary:', {
      reason: reason,
      score: num(detail.score, readScore()),
      combo: num(detail.bestCombo ?? detail.combo, readCombo()),
      goodHits: getGoodHits(detail),
      hasRealPlay: hasRealPlay,
      actionCount: actionCount,
      elapsed: Date.now() - pageLoadedAt
    });
  }

  function openSummaryFromDetail(detail, reason){
    detail = detail || {};

    if(!shouldOpenSummary(detail, reason)){
      blockLog(reason, detail);
      return;
    }

    fired = true;
    markRealPlay('summary-open-' + reason);

    var summary = normalizeSummary(detail, reason);

    saveSummary(summary);

    setTimeout(function(){
      var ok = callKnownSummaryFunctions(summary);

      setTimeout(function(){
        if(!summaryAlreadyVisible()){
          showFallbackSummary(summary);
        }
      }, ok ? 500 : 120);
    }, 80);

    console.log('[GoodJunk Summary Restore V849I] opened:', reason, summary);
  }

  function onRealAction(reason){
    actionCount++;

    if(startOverlayVisible()){
      return;
    }

    markRealPlay(reason);
  }

  document.addEventListener('click', function(ev){
    actionCount++;

    var startBtn = ev.target && ev.target.closest
      ? ev.target.closest('#gjmStartBtn,.gjm-start-btn,[data-force-start="1"]')
      : null;

    if(startBtn){
      clearOldSummaryOnFreshRun();
      markRealPlay('start-click');
      return;
    }

    if(!startOverlayVisible()){
      markRealPlay('game-click');
    }
  }, true);

  document.addEventListener('pointerdown', function(){
    onRealAction('pointerdown-game');
  }, true);

  window.addEventListener('gj:game-started', function(){
    clearOldSummaryOnFreshRun();
    markRealPlay('gj:game-started');
  });

  window.addEventListener('gj:start', function(){
    clearOldSummaryOnFreshRun();
    markRealPlay('gj:start');
  });

  window.addEventListener('gj:boss-start', function(){
    markRealPlay('gj:boss-start');
  });

  window.addEventListener('gj:hit-good', function(){
    markRealPlay('gj:hit-good');
  });

  window.addEventListener('gj:food-hit', function(){
    markRealPlay('gj:food-hit');
  });

  window.addEventListener('gj:score', function(){
    markRealPlay('gj:score');
  });

  window.addEventListener('gj:boss-defeated', function(ev){
    openSummaryFromDetail(detailOf(ev), 'gj:boss-defeated');
  });

  window.addEventListener('gj:game-ended', function(ev){
    var d = detailOf(ev);

    if(isBossDefeatedDetail(d, 'gj:game-ended')){
      openSummaryFromDetail(d, 'gj:game-ended');
    }
  });

  window.addEventListener('gj:summary-ready', function(ev){
    var d = detailOf(ev);

    if(isBossDefeatedDetail(d, 'gj:summary-ready')){
      openSummaryFromDetail(d, 'gj:summary-ready');
    }
  });

  /*
    เสริม: ถ้าบอสแพ้แล้ว แต่ event detail ไม่ครบ ให้ตรวจจากข้อความ/HP boss
  */
  var fallbackTimer = setInterval(function(){
    if(fired) {
      clearInterval(fallbackTimer);
      return;
    }

    var text = String(document.body && document.body.innerText || '');

    if(
      hasRealPlay &&
      (
        text.includes('Boss Defeated') ||
        text.includes('บอสแพ้') ||
        text.includes('ชนะบอสแล้ว')
      )
    ){
      var detail = {
        reason: 'boss-defeated',
        endedReason: 'boss-defeated',
        bossDefeated: true,
        win: true,
        result: 'win',
        score: readScore(),
        combo: readCombo()
      };

      openSummaryFromDetail(detail, 'fallback-boss-defeated-text');
    }
  }, 600);

  setTimeout(function(){
    clearInterval(fallbackTimer);
  }, 180000);

  clearOldSummaryOnFreshRun();

  console.log('[GoodJunk Summary Restore V849I] installed');
})();
