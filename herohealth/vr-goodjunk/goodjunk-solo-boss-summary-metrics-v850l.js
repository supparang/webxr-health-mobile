/* =========================================================
   HeroHealth GoodJunk Solo Boss
   File: /herohealth/vr-goodjunk/goodjunk-solo-boss-summary-metrics-v850l.js
   Version: v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-METRICS-V850L

   Purpose:
   1) ทำ Summary ให้แสดงค่าที่เข้าใจง่ายขึ้น
      - score
      - accuracy
      - goodHits
      - miss
      - junkHits
      - fakeHits
      - bestCombo
      - rank
      - score breakdown แบบอ่านง่าย

   2) ไม่ restore ค่าเก่า
      - ใช้ live state / event detail / DOM ปัจจุบันเท่านั้น
      - ไม่ดึง localStorage เก่ามาเปิด summary

   3) กัน summary เร็วเกินไป
      - ถ้ายังเล่นจริงไม่พอ จะไม่เปิด summary ของ patch นี้
      - ช่วยซ่อน summary เก่าที่เด้งเร็วเกินไปบางกรณี

   4) ทำหน้าสรุปชั้นเดียวของ patch นี้
      - ลดความรู้สึกว่า summary ซ้อนกัน
   ========================================================= */

(function(){
  'use strict';

  var PATCH = 'v20260607-GOODJUNK-SOLO-BOSS-SUMMARY-METRICS-V850L';

  if(window.GJ_SUMMARY_METRICS_V850L_LOADED){
    return;
  }

  window.GJ_SUMMARY_METRICS_V850L_LOADED = true;

  var qs = new URLSearchParams(location.search || '');

  var gameName = String(
    qs.get('game') ||
    qs.get('gameId') ||
    qs.get('theme') ||
    ''
  ).toLowerCase();

  var isGoodJunk =
    gameName === 'goodjunk' ||
    /goodjunk/i.test(location.pathname || '');

  if(!isGoodJunk){
    return;
  }

  var state = {
    patch: PATCH,
    startedAt: Date.now(),
    lastUserActionAt: 0,
    lastFoodActionAt: 0,
    hasRealPlay: false,
    summaryOpened: false,
    lastRaw: {},
    lastMetrics: null
  };

  function num(v, fallback){
    if(v === null || v === undefined || v === '') return fallback;

    if(typeof v === 'string'){
      v = v.replace(/[^\d.\-]/g, '');
    }

    var n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function str(v, fallback){
    v = String(v === null || v === undefined ? '' : v).trim();
    return v || fallback || '';
  }

  function clamp(n, min, max){
    n = Number(n);
    if(!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function round(n){
    return Math.round(Number(n) || 0);
  }

  function pct(n){
    return clamp(round(n), 0, 100);
  }

  function firstNum(){
    for(var i = 0; i < arguments.length; i++){
      var n = num(arguments[i], NaN);
      if(Number.isFinite(n)) return n;
    }
    return 0;
  }

  function firstText(){
    for(var i = 0; i < arguments.length; i++){
      var v = arguments[i];
      if(v !== null && v !== undefined && String(v).trim() !== ''){
        return String(v).trim();
      }
    }
    return '';
  }

  function qp(name, fallback){
    var v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function textOf(id){
    var el = document.getElementById(id);
    return el ? String(el.textContent || '').trim() : '';
  }

  function readDomSnapshot(){
    return {
      score: num(textOf('gjmScore'), undefined),
      timeLeft: num(textOf('gjmTime'), undefined),
      comboText: textOf('gjmCombo')
    };
  }

  function parseCombo(v){
    v = String(v || '').replace(/[^\d.\-]/g, '');
    return num(v, undefined);
  }

  function targetGoodByTime(t){
    t = Number(t) || 90;

    if(t <= 60) return 16;
    if(t <= 90) return 22;
    if(t <= 120) return 30;
    if(t <= 150) return 36;
    return 40;
  }

  function scoreTargetByTime(t){
    t = Number(t) || 90;

    if(t <= 60) return 260;
    if(t <= 90) return 380;
    if(t <= 120) return 520;
    if(t <= 150) return 650;
    return 760;
  }

  function getCandidateObjects(){
    var out = [];

    var names = [
      'GJ_SOLO_BOSS_SUMMARY_LIVE',
      'GJ_SOLO_BOSS_SUMMARY',
      'GJ_SUMMARY_LIVE_ONLY_V850K',
      'GJ_SOLO_BOSS_LAST_LIVE',
      'GJ_SOLO_BOSS_LAST_SUMMARY_LIVE',
      'GJ_SOLO_BOSS_LAST_SUMMARY',
      'GJ_FULL_3D_VR_LAST_SUMMARY',
      'GJ_SOLO_BOSS_STATE',
      'GJ_STATE',
      'GJ'
    ];

    names.forEach(function(name){
      try{
        var v = window[name];
        if(v && typeof v === 'object'){
          out.push(v);
        }
      }catch(_){}
    });

    try{
      if(window.state && typeof window.state === 'object'){
        out.push(window.state);
      }
    }catch(_){}

    return out;
  }

  function flattenUsefulObjects(rootList){
    var out = [];
    var seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

    function hasMetricKey(obj){
      if(!obj || typeof obj !== 'object') return false;

      var keys = [
        'score',
        'totalScore',
        'points',
        'accuracy',
        'acc',
        'goodHits',
        'good',
        'junkHits',
        'junk',
        'fakeHits',
        'fake',
        'miss',
        'misses',
        'bestCombo',
        'combo',
        'maxCombo',
        'rank',
        'stars',
        'bossHp',
        'bossDefeated',
        'win',
        'timeLeft'
      ];

      return keys.some(function(k){
        return Object.prototype.hasOwnProperty.call(obj, k);
      });
    }

    function walk(obj, depth){
      if(!obj || typeof obj !== 'object') return;
      if(depth > 2) return;

      if(seen){
        if(seen.has(obj)) return;
        seen.add(obj);
      }

      if(hasMetricKey(obj)){
        out.push(obj);
      }

      Object.keys(obj).slice(0, 80).forEach(function(k){
        var v;

        try{
          v = obj[k];
        }catch(_){
          return;
        }

        if(v && typeof v === 'object'){
          walk(v, depth + 1);
        }
      });
    }

    rootList.forEach(function(obj){
      walk(obj, 0);
    });

    return out;
  }

  function mergeRaw(extra){
    var dom = readDomSnapshot();
    var globals = flattenUsefulObjects(getCandidateObjects());
    var raw = {};

    Object.assign(raw, dom);

    globals.forEach(function(obj){
      Object.assign(raw, obj || {});
    });

    Object.assign(raw, state.lastRaw || {});
    Object.assign(raw, extra || {});

    return raw;
  }

  function normalizeMetrics(extra){
    var raw = mergeRaw(extra || {});

    var timeLimit = firstNum(
      raw.timeLimit,
      raw.totalTime,
      raw.duration,
      qp('time', 90)
    );

    var targetGoodHits = firstNum(
      raw.targetGoodHits,
      raw.requiredGoodHits,
      raw.goodTarget,
      raw.targetGood,
      targetGoodByTime(timeLimit)
    );

    var targetScore = firstNum(
      raw.targetScore,
      raw.scoreTarget,
      scoreTargetByTime(timeLimit)
    );

    var score = firstNum(
      raw.score,
      raw.totalScore,
      raw.points,
      raw.finalScore,
      0
    );

    var goodHits = firstNum(
      raw.goodHits,
      raw.good,
      raw.goodCount,
      raw.goodSelected,
      raw.correct,
      raw.correctHits,
      raw.foodGood,
      0
    );

    var junkHits = firstNum(
      raw.junkHits,
      raw.junk,
      raw.junkCount,
      raw.junkTouched,
      raw.badHits,
      0
    );

    var fakeHits = firstNum(
      raw.fakeHits,
      raw.fake,
      raw.fakeCount,
      raw.fakeTouched,
      raw.trapHits,
      raw.decoyHits,
      0
    );

    var miss = num(
      firstText(raw.miss, raw.misses, raw.missCount, raw.goodMissed, raw.expiredGood),
      NaN
    );

    var combo = firstNum(
      raw.bestCombo,
      raw.maxCombo,
      raw.comboMax,
      raw.combo,
      parseCombo(raw.comboText),
      0
    );

    var accuracy = num(
      firstText(raw.accuracy, raw.acc, raw.accuracyPct),
      NaN
    );

    /*
      miss รวม = good expired + junk hit
      fakeHits แยกต่างหาก
      ถ้าไม่มี miss แต่มี accuracy จากระบบเดิม ให้ estimate miss
      เพื่ออธิบายว่าทำไม accuracy ไม่ใช่ 100%
    */
    if(!Number.isFinite(miss)){
      if(Number.isFinite(accuracy) && accuracy > 0 && accuracy < 100 && goodHits > 0){
        var denomEstimate = goodHits / (accuracy / 100);
        miss = Math.max(0, Math.round(denomEstimate - goodHits - fakeHits));
      }else{
        miss = 0;
      }
    }

    miss = Math.max(0, round(miss));

    if(!Number.isFinite(accuracy)){
      var denom = goodHits + miss + fakeHits;
      accuracy = denom > 0 ? (goodHits / denom) * 100 : 0;
    }

    accuracy = pct(accuracy);

    var expiredGood = Math.max(0, miss - junkHits);

    var bossHp = num(firstText(raw.bossHp, raw.hp, raw.bossHealth), NaN);
    var bossDefeated = Boolean(
      raw.bossDefeated ||
      raw.bossDead ||
      raw.win ||
      raw.victory ||
      raw.result === 'win' ||
      raw.result === 'victory' ||
      raw.outcome === 'win' ||
      (Number.isFinite(bossHp) && bossHp <= 0)
    );

    var timeLeft = num(firstText(raw.timeLeft, raw.remainingTime, raw.remaining), NaN);

    var attempts = goodHits + miss + fakeHits;

    var scoreFromGood = goodHits * 10;
    var visiblePenalty = (junkHits + fakeHits) * 5;
    var bonusEstimate = Math.max(0, round(score - scoreFromGood + visiblePenalty));

    var stars = num(raw.stars, NaN);

    if(!Number.isFinite(stars)){
      if(bossDefeated && accuracy >= 90 && goodHits >= targetGoodHits && miss <= 2 && fakeHits <= 1){
        stars = 5;
      }else if((bossDefeated || score >= targetScore * 0.8) && accuracy >= 80 && goodHits >= targetGoodHits * 0.75){
        stars = 4;
      }else if((bossDefeated || score >= targetScore * 0.55 || goodHits >= targetGoodHits * 0.55) && accuracy >= 65){
        stars = 3;
      }else if(score > 0 || goodHits > 0){
        stars = 2;
      }else{
        stars = 1;
      }
    }

    stars = clamp(round(stars), 1, 5);

    var rank = firstText(raw.rank, raw.levelName, raw.title);

    if(!rank){
      if(stars >= 5) rank = 'Nutrition Champion';
      else if(stars >= 4) rank = 'Food Hero';
      else if(stars >= 3) rank = 'Good Choice Hero';
      else if(stars >= 2) rank = 'Food Learner';
      else rank = 'Try Again Hero';
    }

    var badge = firstText(raw.badge, raw.badgeName);

    if(!badge){
      if(stars >= 5) badge = '🏆 Nutrition Champion';
      else if(stars >= 4) badge = '🥗 Smart Eater';
      else if(stars >= 3) badge = '💚 Good Choice Hero';
      else badge = '🌱 Keep Practicing';
    }

    var metrics = {
      patch: PATCH,

      score: round(score),
      accuracy: accuracy,

      goodHits: round(goodHits),
      junkHits: round(junkHits),
      fakeHits: round(fakeHits),
      miss: miss,
      expiredGood: round(expiredGood),

      bestCombo: round(combo),
      attempts: round(attempts),

      timeLimit: round(timeLimit),
      timeLeft: Number.isFinite(timeLeft) ? round(timeLeft) : null,

      targetGoodHits: round(targetGoodHits),
      targetScore: round(targetScore),

      scoreFromGood: round(scoreFromGood),
      visiblePenalty: round(visiblePenalty),
      bonusEstimate: round(bonusEstimate),

      stars: stars,
      rank: rank,
      badge: badge,

      bossHp: Number.isFinite(bossHp) ? bossHp : null,
      bossDefeated: bossDefeated,

      raw: raw,
      savedAt: new Date().toISOString()
    };

    state.lastMetrics = metrics;

    return metrics;
  }

  function hasEnoughRealPlay(metrics, reason){
    var elapsedMs = Date.now() - state.startedAt;
    var elapsedSec = elapsedMs / 1000;

    var reasonText = String(reason || '');

    /*
      เงื่อนไขเปิด summary ที่ถือว่าปลอดภัย:
      - หมดเวลา
      - บอสตายจริงและเล่นไปพอสมควร
      - goodHits ถึงระดับที่ไม่ใช่เพิ่งเริ่ม
      - score สูงพอ
    */
    if(metrics.timeLeft !== null && metrics.timeLeft <= 0){
      return true;
    }

    if(metrics.goodHits >= Math.max(8, Math.ceil(metrics.targetGoodHits * 0.45))){
      return true;
    }

    if(metrics.score >= Math.max(120, metrics.targetScore * 0.35)){
      return true;
    }

    if(metrics.bossDefeated && elapsedSec >= 12 && metrics.goodHits >= 5){
      return true;
    }

    if(/manual|force|cooldown|final-button/i.test(reasonText) && metrics.score > 0){
      return true;
    }

    return false;
  }

  function hideLikelyEarlySummary(){
    try{
      var nodes = Array.prototype.slice.call(
        document.querySelectorAll('div, section, article, aside')
      );

      nodes.forEach(function(el){
        if(!el || el.id === 'gj850lOverlay') return;
        if(el.closest && el.closest('#gj850lOverlay')) return;

        var text = String(el.innerText || '').replace(/\s+/g, ' ').trim();

        var looksSummary =
          text.includes('สรุปผล GoodJunk') ||
          text.includes('ชนะบอสแบบ') ||
          text.includes('Cooldown แล้วกลับเลือกโหมด');

        if(!looksSummary) return;

        var r = el.getBoundingClientRect();
        var looksLikeCard =
          r.width > 180 &&
          r.height > 120 &&
          r.width < window.innerWidth * 0.96 &&
          r.height < window.innerHeight * 0.96;

        if(!looksLikeCard) return;

        el.dataset.gj850lHiddenEarly = '1';
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      });
    }catch(e){}
  }

  function starText(n){
    n = clamp(round(n), 1, 5);
    return '⭐'.repeat(n) + '☆'.repeat(5 - n);
  }

  function escapeHtml(v){
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function explainAccuracy(m){
    if(m.miss > 0 || m.fakeHits > 0){
      return 'ความแม่นยำคิดจาก อาหารดี ÷ (อาหารดี + พลาด + อาหารหลอกตา)';
    }

    if(m.junkHits === 0 && m.fakeHits === 0 && m.miss === 0 && m.accuracy < 100){
      return 'ค่าความแม่นยำต่ำกว่า 100% เพราะระบบเดิมส่งค่า accuracy มาแล้ว แต่ไม่มีรายละเอียด miss ครบ';
    }

    return 'ไม่มีพลาดและไม่มีอาหารหลอกตา ความแม่นยำจึงสูง';
  }

  function renderSummary(metrics, reason){
    state.summaryOpened = true;

    var old = document.getElementById('gj850lOverlay');
    if(old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'gj850lOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML =
      '<style>' +
      '#gj850lOverlay{' +
        'position:fixed;inset:0;z-index:2147483500;' +
        'display:grid;place-items:center;' +
        'padding:calc(16px + env(safe-area-inset-top,0px)) 14px calc(16px + env(safe-area-inset-bottom,0px));' +
        'background:rgba(15,23,42,.58);' +
        'backdrop-filter:blur(9px);' +
        'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
        'color:#0f172a;' +
      '}' +
      '#gj850lOverlay *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}' +
      '.gj850l-card{' +
        'width:min(560px,calc(100vw - 24px));' +
        'max-height:calc(100dvh - 28px);' +
        'overflow:auto;' +
        'border-radius:30px;' +
        'background:rgba(255,255,255,.97);' +
        'border:3px solid rgba(255,255,255,.95);' +
        'box-shadow:0 30px 90px rgba(15,23,42,.38);' +
        'padding:20px;' +
        'text-align:center;' +
      '}' +
      '.gj850l-cup{font-size:52px;line-height:1;margin-bottom:4px;}' +
      '.gj850l-title{margin:0;font-size:clamp(30px,7vw,46px);line-height:1.04;font-weight:1000;letter-spacing:-.04em;}' +
      '.gj850l-stars{margin-top:8px;font-size:28px;letter-spacing:1px;}' +
      '.gj850l-sub{margin:8px auto 0;max-width:460px;color:#64748b;font-size:14px;font-weight:900;line-height:1.35;}' +
      '.gj850l-grid{' +
        'display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-top:14px;' +
      '}' +
      '.gj850l-cell{' +
        'min-height:78px;border-radius:18px;' +
        'display:grid;place-items:center;padding:10px 8px;' +
        'background:linear-gradient(180deg,#fff,#f8fafc);' +
        'border:2px solid #e5edf6;' +
      '}' +
      '.gj850l-cell b{display:block;font-size:clamp(25px,6vw,34px);line-height:1;font-weight:1000;color:#0f172a;}' +
      '.gj850l-cell span{display:block;margin-top:5px;color:#64748b;font-size:12px;font-weight:1000;line-height:1.15;}' +
      '.gj850l-note{' +
        'margin-top:12px;text-align:left;border-radius:18px;padding:12px 13px;' +
        'background:linear-gradient(180deg,#fff8dc,#fffdf4);' +
        'border:2px solid rgba(250,204,21,.22);' +
        'color:#334155;font-size:13px;font-weight:850;line-height:1.5;' +
      '}' +
      '.gj850l-note b{color:#0f172a;}' +
      '.gj850l-actions{' +
        'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;' +
      '}' +
      '.gj850l-btn{' +
        'min-height:58px;border:0;border-radius:18px;padding:12px 14px;' +
        'font:1000 15px system-ui,-apple-system,"Segoe UI",sans-serif;' +
        'color:#fff;cursor:pointer;box-shadow:0 14px 30px rgba(15,23,42,.16);' +
      '}' +
      '.gj850l-btn.green{background:linear-gradient(135deg,#22c55e,#16a34a);}' +
      '.gj850l-btn.blue{background:linear-gradient(135deg,#38bdf8,#2563eb);}' +
      '.gj850l-btn:active{transform:scale(.97);}' +
      '@media(max-width:520px){' +
        '.gj850l-card{border-radius:28px;padding:17px;}' +
        '.gj850l-grid{gap:8px;}' +
        '.gj850l-cell{min-height:70px;border-radius:17px;}' +
        '.gj850l-actions{grid-template-columns:1fr;}' +
        '.gj850l-btn{min-height:56px;font-size:16px;}' +
      '}' +
      '</style>' +

      '<div class="gj850l-card">' +
        '<div class="gj850l-cup">🏆</div>' +
        '<h1 class="gj850l-title">สรุปผล GoodJunk</h1>' +
        '<div class="gj850l-stars">' + starText(metrics.stars) + '</div>' +
        '<p class="gj850l-sub">จบเกมแล้ว แสดงผลหลังเล่นจริง พร้อมแยก “พลาด” ออกจาก “แตะ junk” เพื่อให้อ่านผลไม่งง</p>' +

        '<div class="gj850l-grid">' +
          '<div class="gj850l-cell"><b>' + metrics.score + '</b><span>คะแนนรวม</span></div>' +
          '<div class="gj850l-cell"><b>' + metrics.accuracy + '%</b><span>ความแม่นยำ</span></div>' +

          '<div class="gj850l-cell"><b>' + metrics.goodHits + '</b><span>อาหารดี</span></div>' +
          '<div class="gj850l-cell"><b>' + metrics.miss + '</b><span>พลาด / miss</span></div>' +

          '<div class="gj850l-cell"><b>' + metrics.junkHits + '</b><span>แตะ junk</span></div>' +
          '<div class="gj850l-cell"><b>' + metrics.fakeHits + '</b><span>อาหารหลอกตา</span></div>' +

          '<div class="gj850l-cell"><b>x' + metrics.bestCombo + '</b><span>คอมโบสูงสุด</span></div>' +
          '<div class="gj850l-cell"><b style="font-size:clamp(20px,5vw,28px);">' + escapeHtml(metrics.rank) + '</b><span>Rank</span></div>' +
        '</div>' +

        '<div class="gj850l-note">' +
          '<b>อธิบายผล:</b><br>' +
          '• ' + escapeHtml(explainAccuracy(metrics)) + '<br>' +
          '• คะแนนอาหารดีประมาณ ' + metrics.scoreFromGood + ' คะแนน' +
          (metrics.bonusEstimate > 0 ? ' + โบนัส/บอส/คอมโบประมาณ ' + metrics.bonusEstimate + ' คะแนน' : '') +
          (metrics.visiblePenalty > 0 ? ' − โทษจาก junk/หลอกตาประมาณ ' + metrics.visiblePenalty + ' คะแนน' : '') +
          '<br>• เป้าหมายอาหารดีรอบนี้ประมาณ ' + metrics.targetGoodHits + ' ชิ้น' +
        '</div>' +

        '<div class="gj850l-actions">' +
          '<button class="gj850l-btn green" id="gj850lReplayBtn" type="button">🔁 เล่นอีกครั้ง</button>' +
          '<button class="gj850l-btn blue" id="gj850lCooldownBtn" type="button">🧘 Cooldown แล้วกลับเลือกโหมด</button>' +
        '</div>' +
      '</div>';

    document.documentElement.appendChild(overlay);

    try{
      localStorage.setItem('GJ_SOLO_BOSS_LAST_SUMMARY_V850L', JSON.stringify({
        patch: PATCH,
        reason: reason || '',
        metrics: {
          score: metrics.score,
          accuracy: metrics.accuracy,
          goodHits: metrics.goodHits,
          junkHits: metrics.junkHits,
          fakeHits: metrics.fakeHits,
          miss: metrics.miss,
          expiredGood: metrics.expiredGood,
          bestCombo: metrics.bestCombo,
          stars: metrics.stars,
          rank: metrics.rank,
          badge: metrics.badge
        },
        savedAt: new Date().toISOString()
      }));
    }catch(e){}

    var replayBtn = document.getElementById('gj850lReplayBtn');
    var cooldownBtn = document.getElementById('gj850lCooldownBtn');

    if(replayBtn){
      replayBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        var u = new URL(location.href);

        u.searchParams.set('run', 'play');
        u.searchParams.set('phase', 'main');
        u.searchParams.set('replay', String(Date.now()));

        [
          'summary',
          'result',
          'end',
          'win',
          'cooldown',
          'score',
          'accuracy',
          'acc',
          'goodHits',
          'junkHits',
          'fakeHits',
          'miss',
          'misses',
          'bestCombo',
          'stars',
          'rank'
        ].forEach(function(k){
          u.searchParams.delete(k);
        });

        location.href = u.toString();
      }, true);
    }

    if(cooldownBtn){
      cooldownBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        var payload = {
          reason: 'summary-metrics-v850l',
          score: metrics.score,
          accuracy: metrics.accuracy,
          goodHits: metrics.goodHits,
          junkHits: metrics.junkHits,
          fakeHits: metrics.fakeHits,
          miss: metrics.miss,
          bestCombo: metrics.bestCombo,
          stars: metrics.stars,
          rank: metrics.rank,
          badge: metrics.badge
        };

        if(window.GJ_SOLO_BOSS_SHELL && typeof window.GJ_SOLO_BOSS_SHELL.goCooldown === 'function'){
          window.GJ_SOLO_BOSS_SHELL.goCooldown(payload);
          return;
        }

        var launcher = new URL(
          'https://supparang.github.io/webxr-health-mobile/herohealth/goodjunk-launcher.html'
        );

        launcher.searchParams.set('pid', qp('pid', 'anon'));
        launcher.searchParams.set('name', qp('name', qp('nick', 'Hero')));
        launcher.searchParams.set('diff', qp('diff', 'normal'));
        launcher.searchParams.set('time', qp('time', '90'));
        launcher.searchParams.set('view', qp('view', 'mobile'));
        launcher.searchParams.set('zone', 'nutrition');
        launcher.searchParams.set('cat', 'nutrition');
        launcher.searchParams.set('game', 'goodjunk');
        launcher.searchParams.set('gameId', 'goodjunk');
        launcher.searchParams.set('mode', 'solo');

        var gate = new URL(
          'https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html'
        );

        gate.searchParams.set('phase', 'cooldown');
        gate.searchParams.set('zone', 'nutrition');
        gate.searchParams.set('cat', 'nutrition');
        gate.searchParams.set('game', 'goodjunk');
        gate.searchParams.set('gameId', 'goodjunk');
        gate.searchParams.set('mode', 'solo_boss');

        gate.searchParams.set('pid', qp('pid', 'anon'));
        gate.searchParams.set('name', qp('name', qp('nick', 'Hero')));
        gate.searchParams.set('diff', qp('diff', 'normal'));
        gate.searchParams.set('time', qp('time', '90'));
        gate.searchParams.set('view', qp('view', 'mobile'));

        gate.searchParams.set('hub', launcher.toString());
        gate.searchParams.set('next', launcher.toString());
        gate.searchParams.set('back', launcher.toString());
        gate.searchParams.set('launcher', launcher.toString());
        gate.searchParams.set('return', launcher.toString());

        Object.keys(payload).forEach(function(k){
          gate.searchParams.set(k, String(payload[k]));
        });

        location.href = gate.toString();
      }, true);
    }

    console.info('[GoodJunk Summary Metrics v850L] shown', metrics, reason);
  }

  function openSummary(extra, reason){
    var metrics = normalizeMetrics(extra || {});

    if(!hasEnoughRealPlay(metrics, reason)){
      hideLikelyEarlySummary();

      console.warn('[GoodJunk Summary Metrics v850L] blocked early summary', {
        reason: reason || '',
        score: metrics.score,
        goodHits: metrics.goodHits,
        miss: metrics.miss,
        fakeHits: metrics.fakeHits,
        bossDefeated: metrics.bossDefeated,
        timeLeft: metrics.timeLeft,
        targetGoodHits: metrics.targetGoodHits
      });

      return false;
    }

    renderSummary(metrics, reason || 'unknown');

    try{
      window.dispatchEvent(new CustomEvent('gj:summary-metrics-v850l-shown', {
        detail: metrics
      }));
    }catch(e){}

    return true;
  }

  function noteRaw(detail){
    if(detail && typeof detail === 'object'){
      Object.assign(state.lastRaw, detail);
    }
  }

  /*
    Track real play: คลิก/แตะอาหารจริง ไม่ใช่ปุ่มเริ่ม
  */
  ['pointerdown', 'click', 'touchstart'].forEach(function(type){
    document.addEventListener(type, function(ev){
      state.lastUserActionAt = Date.now();

      var target = ev.target && ev.target.closest
        ? ev.target.closest('.gjpu-item,[data-food],[data-kind],[data-type],[data-gj-food],.food-card,.target-card')
        : null;

      if(target){
        state.lastFoodActionAt = Date.now();
        state.hasRealPlay = true;
      }
    }, {
      capture: true,
      passive: true
    });
  });

  /*
    Listen known summary events
  */
  [
    'gj:reward-summary-shown',
    'gj:summary',
    'gj:summary-open',
    'gj:game-end',
    'gj:game-over',
    'gj:boss-defeated',
    'gj:win'
  ].forEach(function(type){
    window.addEventListener(type, function(ev){
      var detail = ev && ev.detail ? ev.detail : {};
      noteRaw(detail);

      setTimeout(function(){
        openSummary(detail, type);
      }, 80);
    }, true);
  });

  /*
    Intercept CustomEvent dispatch เพื่อเก็บ detail ของ event ที่เกี่ยวกับ summary/win/end
  */
  if(!window.GJ_SUMMARY_METRICS_V850L_DISPATCH_PATCHED){
    window.GJ_SUMMARY_METRICS_V850L_DISPATCH_PATCHED = true;

    var nativeDispatch = EventTarget.prototype.dispatchEvent;

    EventTarget.prototype.dispatchEvent = function(ev){
      try{
        if(ev && ev.type && /summary|reward|game-end|game-over|boss-defeated|win/i.test(ev.type)){
          if(ev.detail && typeof ev.detail === 'object'){
            noteRaw(ev.detail);

            setTimeout(function(){
              openSummary(ev.detail, 'dispatch:' + ev.type);
            }, 90);
          }
        }
      }catch(_){}

      return nativeDispatch.call(this, ev);
    };
  }

  /*
    DOM watcher: ถ้า summary เก่าเด้งขึ้นมา ให้ patch นี้อ่านค่าจริงแล้วเปิด summary ชั้นเดียว
  */
  var scanTimer = 0;

  function scheduleScan(){
    if(scanTimer) return;

    scanTimer = setTimeout(function(){
      scanTimer = 0;

      if(document.getElementById('gj850lOverlay')) return;

      var text = String((document.body && document.body.innerText) || '')
        .replace(/\s+/g, ' ')
        .trim();

      var looksSummary =
        text.includes('สรุปผล GoodJunk') ||
        text.includes('ชนะบอสแบบสุดยอด') ||
        text.includes('Cooldown แล้วกลับเลือกโหมด');

      if(!looksSummary) return;

      var metrics = normalizeMetrics({
        reason: 'dom-summary-detected'
      });

      if(!hasEnoughRealPlay(metrics, 'dom-summary-detected')){
        hideLikelyEarlySummary();
        return;
      }

      openSummary({
        reason: 'dom-summary-detected'
      }, 'dom-summary-detected');
    }, 120);
  }

  try{
    var mo = new MutationObserver(scheduleScan);
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });
  }catch(e){}

  /*
    Public API สำหรับเรียกเองจาก console ได้
  */
  window.GJ_SUMMARY_METRICS_V850L = {
    patch: PATCH,
    state: state,
    compute: normalizeMetrics,
    open: function(extra){
      return openSummary(extra || {}, 'manual');
    },
    close: function(){
      var el = document.getElementById('gj850lOverlay');
      if(el) el.remove();
      state.summaryOpened = false;
    }
  };

  console.info('[GoodJunk Summary Metrics v850L] installed');
})();