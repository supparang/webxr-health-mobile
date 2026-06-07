/* === /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-hard-block-v849p.js === */
/* PATCH v20260606-GOODJUNK-SOLO-BOSS-SUMMARY-HARD-BLOCK-V849P
   Purpose:
   - กัน summary modal เด้งก่อนจบจริง
   - บล็อกกรณี score ต่ำ / goodHits ต่ำ / เล่นยังไม่นาน / bossHp ยังไม่ยืนยันว่าตายจริง
   - ใช้ร่วมกับ v849k/v849n/v849o/v849l
*/

(function(){
  'use strict';

  var PATCH = 'v20260606-GOODJUNK-SOLO-BOSS-SUMMARY-HARD-BLOCK-V849P';

  if(window.GJ_SUMMARY_HARD_BLOCK_V849P_LOADED){
    return;
  }
  window.GJ_SUMMARY_HARD_BLOCK_V849P_LOADED = true;

  var startedAt = Date.now();
  var realPlayStartedAt = 0;
  var lastGoodHits = 0;
  var lastScore = 0;
  var lastCombo = 0;
  var lastBossHp = null;
  var realWinConfirmed = false;

  var MIN_PLAY_MS = 20000;
  var REQUIRED_GOOD_HITS = 40;
  var MIN_REAL_SCORE = 300;

  function now(){
    return Date.now();
  }

  function qs(){
    return new URLSearchParams(location.search || '');
  }

  function isGoodJunk(){
    var q = qs();
    var game = String(q.get('game') || q.get('gameId') || q.get('theme') || '').toLowerCase();
    return game === 'goodjunk' || location.pathname.indexOf('/vr-goodjunk/') !== -1;
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

  function readNumberFromEl(id){
    var el = document.getElementById(id);
    if(!el) return 0;
    var t = textOf(el);
    var m = t.match(/-?\d+(\.\d+)?/);
    return m ? n(m[0], 0) : 0;
  }

  function readGameState(){
    var score = readNumberFromEl('gjmScore');
    var comboText = textOf(document.getElementById('gjmCombo'));
    var comboMatch = comboText.match(/x?\s*(\d+)/i);
    var combo = comboMatch ? n(comboMatch[1], 0) : 0;

    var detail = {};

    try{
      if(window.GJ_SOLO_BOSS_STATE && typeof window.GJ_SOLO_BOSS_STATE === 'object'){
        detail = window.GJ_SOLO_BOSS_STATE;
      }
    }catch(_){}

    var goodHits =
      n(detail.goodHits, NaN);

    if(!Number.isFinite(goodHits)){
      goodHits = n(detail.good, NaN);
    }

    if(!Number.isFinite(goodHits)){
      goodHits = n(window.GJ_GOOD_HITS, NaN);
    }

    if(!Number.isFinite(goodHits)){
      goodHits = n(window.goodHits, NaN);
    }

    if(!Number.isFinite(goodHits)){
      goodHits = lastGoodHits;
    }

    var bossHp =
      detail.bossHp ?? detail.hp ?? window.GJ_BOSS_HP ?? window.bossHp ?? lastBossHp;

    if(bossHp !== null && bossHp !== undefined && bossHp !== ''){
      bossHp = n(bossHp, null);
    }else{
      bossHp = null;
    }

    lastScore = Math.max(lastScore, score);
    lastCombo = Math.max(lastCombo, combo);
    lastGoodHits = Math.max(lastGoodHits, n(goodHits, 0));

    if(bossHp !== null){
      lastBossHp = bossHp;
    }

    return {
      score: lastScore,
      combo: lastCombo,
      goodHits: lastGoodHits,
      bossHp: lastBossHp
    };
  }

  function markRealPlay(reason){
    if(!realPlayStartedAt){
      realPlayStartedAt = now();
      console.log('[GoodJunk Summary Hard Block V849P] real play started:', reason);
    }
  }

  function isBadReason(reason){
    reason = String(reason || '').toLowerCase();

    return (
      reason.indexOf('early') !== -1 ||
      reason.indexOf('interval') !== -1 ||
      reason.indexOf('scan-not-real') !== -1 ||
      reason.indexOf('boot') !== -1 ||
      reason.indexOf('restore') !== -1 ||
      reason.indexOf('summary-event') !== -1 ||
      reason.indexOf('fallback') !== -1 ||
      reason.indexOf('boss-defeated-text') !== -1
    );
  }

  function canAllowSummary(reason, detail){
    var s = readGameState();

    detail = detail || {};

    var dGood = n(detail.goodHits ?? detail.good, NaN);
    if(Number.isFinite(dGood)){
      s.goodHits = Math.max(s.goodHits, dGood);
      lastGoodHits = s.goodHits;
    }

    var dScore = n(detail.score, NaN);
    if(Number.isFinite(dScore)){
      s.score = Math.max(s.score, dScore);
      lastScore = s.score;
    }

    var dCombo = n(detail.combo ?? detail.bestCombo, NaN);
    if(Number.isFinite(dCombo)){
      s.combo = Math.max(s.combo, dCombo);
      lastCombo = s.combo;
    }

    var dBossHp = detail.bossHp ?? detail.hp;
    if(dBossHp !== null && dBossHp !== undefined && dBossHp !== ''){
      s.bossHp = n(dBossHp, s.bossHp);
      lastBossHp = s.bossHp;
    }

    var playedMs = realPlayStartedAt ? now() - realPlayStartedAt : 0;
    var pageMs = now() - startedAt;

    var bossDead =
      s.bossHp !== null &&
      Number.isFinite(Number(s.bossHp)) &&
      Number(s.bossHp) <= 0;

    var enoughGood =
      s.goodHits >= REQUIRED_GOOD_HITS;

    var enoughScore =
      s.score >= MIN_REAL_SCORE;

    var enoughTime =
      playedMs >= MIN_PLAY_MS || pageMs >= MIN_PLAY_MS + 5000;

    var explicitReal =
      realWinConfirmed === true ||
      detail.realWin === true ||
      detail.finalWin === true ||
      detail.bossDefeated === true ||
      detail.result === 'win-final';

    if(isBadReason(reason) && !explicitReal){
      return {
        ok:false,
        why:'bad-reason',
        state:s,
        playedMs:playedMs,
        pageMs:pageMs,
        reason:reason
      };
    }

    if(!enoughTime){
      return {
        ok:false,
        why:'too-soon',
        state:s,
        playedMs:playedMs,
        pageMs:pageMs,
        reason:reason
      };
    }

    if(!enoughGood && !bossDead && !explicitReal){
      return {
        ok:false,
        why:'not-enough-goodhits-and-boss-not-dead',
        state:s,
        playedMs:playedMs,
        pageMs:pageMs,
        reason:reason
      };
    }

    if(!enoughScore && !explicitReal){
      return {
        ok:false,
        why:'score-too-low',
        state:s,
        playedMs:playedMs,
        pageMs:pageMs,
        reason:reason
      };
    }

    return {
      ok:true,
      why:'real-summary-allowed',
      state:s,
      playedMs:playedMs,
      pageMs:pageMs,
      reason:reason
    };
  }

  function looksSummaryNode(el){
    if(!el || el.nodeType !== 1) return false;

    var t = textOf(el);

    if(!t) return false;

    return (
      t.indexOf('ชนะบอสแบบสุดยอด') !== -1 ||
      t.indexOf('ชนะบอสแล้ว') !== -1 ||
      t.indexOf('เกือบเกือบชนะบอสแล้ว') !== -1 ||
      t.indexOf('Cooldown แล้วกลับเลือกโหมด') !== -1 ||
      t.indexOf('เล่นอีกครั้ง') !== -1 ||
      t.indexOf('ความแม่นยำ') !== -1 && t.indexOf('คะแนน') !== -1 ||
      t.indexOf('เลือกอาหารดี') !== -1 && t.indexOf('/40') !== -1
    );
  }

  function removeNode(el, reason){
    try{
      if(!el || !el.parentNode) return;

      el.setAttribute('data-gj-summary-hard-blocked', PATCH);
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');

      setTimeout(function(){
        try{
          if(el && el.parentNode){
            el.parentNode.removeChild(el);
          }
        }catch(_){}
      }, 10);

      console.warn('[GoodJunk Summary Hard Block V849P] removed early summary node:', reason);
    }catch(e){}
  }

  function scanAndBlock(reason){
    var decision = canAllowSummary(reason || 'scan', {});

    if(decision.ok){
      return;
    }

    var nodes = document.querySelectorAll(
      'div,section,article,aside,main,[role="dialog"],[aria-modal="true"],.modal,.summary,.gjr-modal,.gjr-card,.gjm-message'
    );

    Array.prototype.forEach.call(nodes, function(el){
      if(looksSummaryNode(el)){
        removeNode(el, decision.why);
      }
    });
  }

  function wrapFunction(name){
    var old = window[name];

    if(typeof old !== 'function') return;

    if(old.__gjSummaryHardBlockV849P) return;

    var wrapped = function(){
      var detail = arguments[0] && typeof arguments[0] === 'object'
        ? arguments[0]
        : {};

      var decision = canAllowSummary(name, detail);

      if(!decision.ok){
        console.warn('[GoodJunk Summary Hard Block V849P] blocked function:', name, decision);
        scanAndBlock('wrapped-' + name);
        return false;
      }

      return old.apply(this, arguments);
    };

    wrapped.__gjSummaryHardBlockV849P = true;
    window[name] = wrapped;
  }

  [
    'showSummary',
    'showRewardSummary',
    'openSummary',
    'openRewardSummary',
    'finishGame',
    'finishBoss',
    'endGame',
    'gameOver',
    'completeGame',
    'completeBoss',
    'showResult',
    'showResults'
  ].forEach(wrapFunction);

  window.addEventListener('pointerdown', function(){
    markRealPlay('pointerdown');
  }, true);

  window.addEventListener('click', function(){
    markRealPlay('click');
  }, true);

  window.addEventListener('touchstart', function(){
    markRealPlay('touchstart');
  }, { capture:true, passive:true });

  window.addEventListener('keydown', function(){
    markRealPlay('keydown');
  }, true);

  window.addEventListener('gj:real-play-start', function(ev){
    markRealPlay(ev && ev.type || 'gj:real-play-start');
  }, true);

  window.addEventListener('gj:boss-hit', function(ev){
    markRealPlay('gj:boss-hit');

    var d = ev && ev.detail ? ev.detail : {};
    if(d.goodHits !== undefined) lastGoodHits = Math.max(lastGoodHits, n(d.goodHits, 0));
    if(d.score !== undefined) lastScore = Math.max(lastScore, n(d.score, 0));
    if(d.bossHp !== undefined) lastBossHp = n(d.bossHp, lastBossHp);
  }, true);

  window.addEventListener('gj:food-hit', function(ev){
    markRealPlay('gj:food-hit');

    var d = ev && ev.detail ? ev.detail : {};
    if(d.type === 'good' || d.kind === 'good' || d.good === true){
      lastGoodHits += 1;
    }

    if(d.goodHits !== undefined){
      lastGoodHits = Math.max(lastGoodHits, n(d.goodHits, 0));
    }

    if(d.score !== undefined){
      lastScore = Math.max(lastScore, n(d.score, 0));
    }
  }, true);

  window.addEventListener('gj:boss-defeated', function(ev){
    var d = ev && ev.detail ? ev.detail : {};
    var decision = canAllowSummary('gj:boss-defeated', d);

    if(decision.ok){
      realWinConfirmed = true;
      console.log('[GoodJunk Summary Hard Block V849P] real win confirmed:', decision);
    }else{
      console.warn('[GoodJunk Summary Hard Block V849P] blocked fake boss defeated:', decision);
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      scanAndBlock('fake-boss-defeated');
    }
  }, true);

  window.addEventListener('gj:reward-summary-shown', function(ev){
    var d = ev && ev.detail ? ev.detail : {};
    var decision = canAllowSummary('gj:reward-summary-shown', d);

    if(!decision.ok){
      console.warn('[GoodJunk Summary Hard Block V849P] blocked reward summary event:', decision);
      ev.stopPropagation();
      if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      setTimeout(function(){
        scanAndBlock('reward-summary-event');
      }, 0);
    }
  }, true);

  var mo = null;

  try{
    mo = new MutationObserver(function(muts){
      var shouldScan = false;

      muts.forEach(function(m){
        Array.prototype.forEach.call(m.addedNodes || [], function(node){
          if(node && node.nodeType === 1 && looksSummaryNode(node)){
            shouldScan = true;
          }
        });
      });

      if(shouldScan){
        scanAndBlock('mutation');
      }
    });

    mo.observe(document.documentElement, {
      childList:true,
      subtree:true
    });
  }catch(e){}

  setInterval(function(){
    readGameState();
    scanAndBlock('interval-check');
  }, 350);

  console.log('[GoodJunk Summary Hard Block V849P] installed');
})();
