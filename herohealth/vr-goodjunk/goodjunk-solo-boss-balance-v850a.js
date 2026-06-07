/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-balance-v850a.js === */
/* PATCH v20260607-GOODJUNK-SOLO-BOSS-BALANCE-V850A
   Purpose:
   - กำหนดเงื่อนไขจบเกมให้ชัด
   - กันชนะบอสเร็วเกินจริง
   - ใช้เป็น shared rule ให้ summary / win gate อ่านร่วมกัน
*/

(function(){
  'use strict';

  if (window.GJ_BOSS_BALANCE_V850A_LOADED) return;
  window.GJ_BOSS_BALANCE_V850A_LOADED = true;

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-BALANCE-V850A';
  var QS = new URLSearchParams(location.search || '');

  var installedAt = Date.now();
  var startedAt = 0;
  var realPlayAt = 0;
  var lastScore = 0;
  var lastCombo = 0;
  var estimatedGoodHits = 0;
  var manualGoodHits = 0;
  var gameStarted = false;
  var bossCandidateAt = 0;
  var forcedTimeUp = false;

  function q(name, fallback){
    var v = QS.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function clamp(n, min, max){
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function readRequestedTime(){
    return clamp(Number(q('time', '90')) || 90, 45, 240);
  }

  function readDiff(){
    return String(q('diff', 'normal') || 'normal').toLowerCase();
  }

  function requiredGoodHits(){
    var t = readRequestedTime();
    var diff = readDiff();

    var base =
      t <= 60  ? 24 :
      t <= 90  ? 40 :
      t <= 120 ? 52 :
      t <= 150 ? 64 :
      76;

    if (diff === 'easy') base = Math.max(18, base - 8);
    if (diff === 'hard') base = base + 6;
    if (diff === 'challenge') base = base + 10;

    return base;
  }

  function minimumPlayMs(){
    var t = readRequestedTime();

    if (t <= 60) return 22000;
    if (t <= 90) return 30000;
    if (t <= 120) return 38000;
    return 45000;
  }

  function $(id){
    return document.getElementById(id);
  }

  function textOf(el){
    return String(
      (el && (el.textContent || el.innerText)) || ''
    ).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function pageText(){
    return textOf(document.body);
  }

  function numFromText(s){
    var m = String(s || '').match(/-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function readScore(){
    return Math.max(0, numFromText(textOf($('gjmScore'))));
  }

  function readTimeLeft(){
    return Math.max(0, numFromText(textOf($('gjmTime'))));
  }

  function readCombo(){
    var t = textOf($('gjmCombo'));
    var m = t.match(/x?\s*(\d+)/i);
    return m ? Math.max(0, Number(m[1])) : 0;
  }

  function parseProgressGoodHits(){
    var t = pageText();

    var m =
      t.match(/เลือกอาหารดี\s*(\d+)\s*\/\s*(\d+)/) ||
      t.match(/อาหารดี\s*(\d+)\s*\/\s*(\d+)/);

    if (m) return Math.max(0, Number(m[1]) || 0);

    return 0;
  }

  function markStart(reason){
    if (!gameStarted){
      gameStarted = true;
      startedAt = Date.now();
    }

    if (!realPlayAt) realPlayAt = Date.now();

    try{
      console.log('[GoodJunk balance v850a] markStart', reason || '');
    }catch(_){}
  }

  function markRealPlay(reason){
    markStart(reason || 'real-play');
    realPlayAt = Date.now();
  }

  function updateMetrics(){
    var score = readScore();
    var combo = readCombo();
    var parsedHits = parseProgressGoodHits();

    if (score > lastScore){
      markRealPlay('score-up');
      lastScore = score;
    }

    if (combo > lastCombo){
      markRealPlay('combo-up');
      lastCombo = combo;
    }

    if (parsedHits > manualGoodHits){
      manualGoodHits = parsedHits;
      markRealPlay('progress-good-hit');
    }

    /*
      คะแนน GoodJunk เดิมมักได้ประมาณ 14 คะแนนต่อ good hit
      ใช้เป็น fallback เมื่อไม่มีตัวเลข progress ชัดเจน
    */
    estimatedGoodHits = Math.max(
      estimatedGoodHits,
      manualGoodHits,
      Math.floor(score / 14)
    );

    return {
      score: score,
      combo: combo,
      goodHits: estimatedGoodHits,
      timeLeft: readTimeLeft()
    };
  }

  function playAgeMs(){
    if (!startedAt) return 0;
    return Date.now() - startedAt;
  }

  function isTimeUp(){
    return forcedTimeUp || readTimeLeft() <= 0;
  }

  function hasBossDefeatedText(){
    var t = pageText();
    return (
      t.includes('Boss Defeated') ||
      t.includes('บอสพ่าย') ||
      t.includes('บอสแพ้') ||
      t.includes('ชนะบอสแล้ว') ||
      t.includes('ชนะบอสแบบสุดยอด')
    );
  }

  function markBossCandidate(reason){
    if (!bossCandidateAt){
      bossCandidateAt = Date.now();
    }

    try{
      console.log('[GoodJunk balance v850a] boss candidate:', reason || '');
    }catch(_){}
  }

  function hasEnoughRealPlay(){
    var m = updateMetrics();

    return (
      gameStarted &&
      playAgeMs() >= minimumPlayMs() &&
      (
        m.goodHits >= Math.max(4, Math.floor(requiredGoodHits() * 0.28)) ||
        m.score >= 100 ||
        m.combo >= 3
      )
    );
  }

  function canFinishByBoss(){
    var m = updateMetrics();

    if (!gameStarted) return false;
    if (playAgeMs() < minimumPlayMs()) return false;

    /*
      สำคัญ:
      บอสจะถือว่าชนะจริงเมื่อเก็บอาหารดีถึงเป้าขั้นต่ำ
      ไม่ใช่แค่ HP bar ขึ้น Boss Defeated เร็ว ๆ
    */
    if (m.goodHits < requiredGoodHits()) return false;

    return true;
  }

  function canFinishByTime(){
    return gameStarted && isTimeUp() && hasEnoughRealPlay();
  }

  function canOpenSummary(){
    updateMetrics();

    if (canFinishByTime()) return true;

    if (hasBossDefeatedText()){
      markBossCandidate('text-detected');
      return canFinishByBoss();
    }

    return false;
  }

  function whyBlocked(){
    var m = updateMetrics();

    if (!gameStarted) return 'not-started';
    if (playAgeMs() < minimumPlayMs()) return 'too-early';
    if (m.goodHits < requiredGoodHits() && !isTimeUp()){
      return 'not-enough-goodhits-and-not-timeup';
    }

    return 'not-final';
  }

  function state(){
    var m = updateMetrics();

    return {
      patch: PATCH,
      time: readRequestedTime(),
      diff: readDiff(),
      requiredGoodHits: requiredGoodHits(),
      minimumPlayMs: minimumPlayMs(),
      gameStarted: gameStarted,
      startedAt: startedAt,
      playAgeMs: playAgeMs(),
      realPlayAt: realPlayAt,
      score: m.score,
      combo: m.combo,
      goodHits: m.goodHits,
      timeLeft: m.timeLeft,
      forcedTimeUp: forcedTimeUp,
      bossCandidateAt: bossCandidateAt,
      canOpenSummary: canOpenSummary(),
      whyBlocked: whyBlocked()
    };
  }

  function installInteractionHooks(){
    ['pointerdown','click','touchstart','keydown'].forEach(function(type){
      window.addEventListener(type, function(ev){
        var target = ev && ev.target;

        if (target && target.closest){
          if (
            target.closest('#gjSoloBossArea') ||
            target.closest('.gjpu-item') ||
            target.closest('.gjm-area') ||
            target.closest('#gjmStartBtn')
          ){
            markStart(type);
          }
        }
      }, { capture:true, passive:true });
    });

    window.addEventListener('gj:boss-defeated', function(){
      markBossCandidate('event:gj:boss-defeated');
    }, true);

    window.addEventListener('gj:final-win', function(){
      markBossCandidate('event:gj:final-win');
    }, true);

    window.addEventListener('gj:time-up', function(){
      forcedTimeUp = true;
      markRealPlay('event:gj:time-up');
    }, true);
  }

  setInterval(updateMetrics, 600);
  installInteractionHooks();

  window.GJ_BOSS_BALANCE_V850A = {
    patch: PATCH,
    markStart: markStart,
    markRealPlay: markRealPlay,
    markBossCandidate: markBossCandidate,
    forceTimeUp: function(){
      forcedTimeUp = true;
    },
    requiredGoodHits: requiredGoodHits,
    minimumPlayMs: minimumPlayMs,
    canOpenSummary: canOpenSummary,
    canFinishByBoss: canFinishByBoss,
    canFinishByTime: canFinishByTime,
    whyBlocked: whyBlocked,
    state: state
  };

  console.log('[GoodJunk balance v850a] installed', state());
})();