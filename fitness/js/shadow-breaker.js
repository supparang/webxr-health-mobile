// === shadow-breaker.js — DOM Targets + Boss Phases ===
'use strict';

(function () {

  // ----- Utils -----
  function $(sel) { return document.querySelector(sel); }

  function getQuery() {
    var q = {};
    var s = window.location.search.slice(1).split('&');
    for (var i = 0; i < s.length; i++) {
      if (!s[i]) continue;
      var p = s[i].split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    }
    return q;
  }

  function clamp(v, min, max) {
    return v < min ? min : (v > max ? max : v);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  // ----- Config -----

  var DIFF = {
    easy:   { targetSize: 160, spawnInterval: 1100, lifetime: 1400, bossHP: 30, playerHP: 6, badChance: 0.18 },
    normal: { targetSize: 130, spawnInterval:  900, lifetime: 1200, bossHP: 40, playerHP: 5, badChance: 0.25 },
    hard:   { targetSize: 110, spawnInterval:  750, lifetime: 1000, bossHP: 50, playerHP: 4, badChance: 0.30 }
  };

  var BOSSES = [
    { emoji: '🥊', name: 'Rookie Bruiser' },
    { emoji: '🐯', name: 'Tiger Striker' },
    { emoji: '🐉', name: 'Dragon Fist' },
    { emoji: '👑', name: 'Champion King' }
  ];

  var SCORE_PER_HIT = 10;
  var SCORE_PER_PERFECT = 15;
  var SCORE_MISS_PENALTY = 0;

  // ----- State -----

  var wrap, field, portrait;
  var hpPlayerFill, hpBossFill, hpPlayerVal, hpBossVal;
  var metaTime, metaScore;
  var centerPanel, startButton;

  var currentDiffKey = 'easy';
  var cfg = DIFF.easy;

  var bossIdx = 0;
  var bossHP = 0;
  var bossHPMax = 0;
  var playerHP = 0;
  var playerHPMax = 0;

  var running = false;
  var spawnTimer = null;
  var gameTimer = null;
  var remainMs = 60000;
  var score = 0;
  var hits = 0;
  var misses = 0;
  var startTimeMs = 0;

  // ----- DOM -----

  function ensureDOM() {
    wrap = $('#sbWrap') || (function () {
      var w = document.createElement('div');
      w.id = 'sbWrap';
      w.className = 'sb-wrap';
      document.body.appendChild(w);
      return w;
    })();

    field = $('#sbField');
    if (!field) {
      field = document.createElement('div');
      field.id = 'sbField';
      field.className = 'sb-field';
      wrap.appendChild(field);
    }

    // HUD
    var hud = $('#sbHud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'sbHud';
      hud.className = 'sb-hud';
      hud.innerHTML = [
        '<div class="sb-hp sb-hp-player">',
        ' <div class="sb-hp-label">',
        '  <span class="sb-hp-name">Player</span>',
        '  <span class="sb-hp-val" id="sbHpPlayerVal">0/0</span>',
        ' </div>',
        ' <div class="sb-hp-bar"><div class="sb-hp-fill" id="sbHpPlayerFill"></div></div>',
        '</div>',
        '<div class="sb-hp sb-hp-boss">',
        ' <div class="sb-hp-label">',
        '  <span class="sb-hp-name" id="sbBossName">Boss</span>',
        '  <span class="sb-hp-val" id="sbHpBossVal">0/0</span>',
        ' </div>',
        ' <div class="sb-hp-bar"><div class="sb-hp-fill" id="sbHpBossFill"></div></div>',
        '</div>'
      ].join('');
      wrap.appendChild(hud);
    }

    hpPlayerFill = $('#sbHpPlayerFill');
    hpBossFill   = $('#sbHpBossFill');
    hpPlayerVal  = $('#sbHpPlayerVal');
    hpBossVal    = $('#sbHpBossVal');

    // Boss portrait
    portrait = $('#sbBossPortrait');
    if (!portrait) {
      portrait = document.createElement('div');
      portrait.id = 'sbBossPortrait';
      portrait.className = 'sb-boss-portrait';
      wrap.appendChild(portrait);
    }

    // Meta
    var meta = $('#sbMeta');
    if (!meta) {
      meta = document.createElement('div');
      meta.id = 'sbMeta';
      meta.className = 'sb-meta';
      meta.innerHTML = [
        '<div class="sb-meta-row"><span>⏱ เวลา</span><span id="sbMetaTime">00:00</span></div>',
        '<div class="sb-meta-row"><span>⭐ คะแนน</span><span id="sbMetaScore">0</span></div>'
      ].join('');
      wrap.appendChild(meta);
    }
    metaTime = $('#sbMetaTime');
    metaScore = $('#sbMetaScore');

    // Center panel
    centerPanel = $('#sbCenter');
    if (!centerPanel) {
      centerPanel = document.createElement('div');
      centerPanel.id = 'sbCenter';
      centerPanel.className = 'sb-center-panel';
      centerPanel.innerHTML = [
        '<h1>Shadow Breaker</h1>',
        '<p>ชกเป้า 🥊 ให้ทันก่อนที่มันจะหายไป</p>',
        '<button id="sbStartBtn" class="sb-btn">เริ่มเกม</button>'
      ].join('');
      wrap.appendChild(centerPanel);
    }
    startButton = $('#sbStartBtn');
    if (startButton) {
      startButton.onclick = function () {
        if (!running) startGame();
      };
    }
  }

  // ----- HP / Boss -----

  function updateHPBars() {
    if (!hpPlayerFill || !hpBossFill) return;

    var pRatio = playerHPMax > 0 ? playerHP / playerHPMax : 0;
    var bRatio = bossHPMax   > 0 ? bossHP   / bossHPMax   : 0;

    hpPlayerFill.style.transform = 'scaleX(' + clamp(pRatio, 0, 1) + ')';
    hpBossFill.style.transform   = 'scaleX(' + clamp(bRatio, 0, 1) + ')';

    if (pRatio <= 0.3) hpPlayerFill.style.backgroundColor = '#ef4444';
    else hpPlayerFill.style.backgroundColor = '';

    if (bRatio <= 0.3) {
      hpBossFill.style.backgroundColor = '#fb923c';
      if (portrait) portrait.classList.add('sb-shake');
    } else {
      hpBossFill.style.backgroundColor = '';
      if (portrait) portrait.classList.remove('sb-shake');
    }

    if (hpPlayerVal) hpPlayerVal.textContent = playerHP + '/' + playerHPMax;
    if (hpBossVal)   hpBossVal.textContent   = bossHP   + '/' + bossHPMax;
  }

  function setBoss(idx) {
    bossIdx = clamp(idx, 0, BOSSES.length - 1);
    var b = BOSSES[bossIdx];
    if (portrait) portrait.textContent = b.emoji;
    var nameEl = $('#sbBossName');
    if (nameEl) nameEl.textContent = b.name;
    if (wrap) wrap.setAttribute('data-boss', String(bossIdx));
  }

  // ----- Score FX -----

  function showScoreFx(x, y, type) {
    var el = document.createElement('div');
    el.className = 'sb-fx-score';
    if (type === 'perfect') el.classList.add('sb-perfect');
    else if (type === 'miss') el.classList.add('sb-miss');
    else el.classList.add('sb-good');

    var text = '+10';
    if (type === 'perfect') text = '+15';
    if (type === 'miss') text = 'MISS';

    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    document.body.appendChild(el);

    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 600);
  }

  function updateScore(delta) {
    score = Math.max(0, score + delta);
    if (metaScore) metaScore.textContent = String(score);
  }

  // ----- Targets -----

  var targetIdCounter = 0;

  function spawnTarget() {
    if (!running || !field) return;

    var id = ++targetIdCounter;
    var isBad = Math.random() < cfg.badChance;
    var sz = cfg.targetSize;

    // phase speedup
    var ratio = bossHPMax > 0 ? bossHP / bossHPMax : 1;
    var phase = 1;
    if      (ratio <= 0.33) phase = 3;
    else if (ratio <= 0.66) phase = 2;

    var lifetime = cfg.lifetime;
    if (phase === 2) lifetime *= 0.9;
    if (phase === 3) lifetime *= 0.8;

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = sz * 0.6;

    var x = rand(margin, vw - margin);
    var y = rand(margin + 50, vh - margin - 40);

    var target = document.createElement('div');
    target.className = 'sb-target';
    target.dataset.id = String(id);
    target.dataset.type = isBad ? 'bad' : 'good';
    target.style.width  = sz + 'px';
    target.style.height = sz + 'px';
    target.style.left   = x + 'px';
    target.style.top    = y + 'px';

    var inner = document.createElement('div');
    inner.className = 'sb-target-inner';
    inner.textContent = isBad ? '💥' : '🥊';
    target.appendChild(inner);

    var clicked = false;
    var bornAt = performance.now();

    function onHit(ev) {
      if (!running || clicked) return;
      clicked = true;

      var cx = (ev && ev.clientX) || x;
      var cy = (ev && ev.clientY) || y;

      if (isBad) {
        target.classList.add('sb-miss');
        playerHP = clamp(playerHP - 1, 0, playerHPMax);
        misses++;
        updateHPBars();
        updateScore(SCORE_MISS_PENALTY);
        showScoreFx(cx, cy, 'miss');
        checkGameOver();
      } else {
        var age = performance.now() - bornAt;
        var tRatio = age / lifetime;
        var type = tRatio < 0.3 ? 'perfect' : 'good';
        var gain = (type === 'perfect') ? SCORE_PER_PERFECT : SCORE_PER_HIT;

        hits++;
        bossHP = clamp(bossHP - 1, 0, bossHPMax);
        updateHPBars();
        updateScore(gain);
        showScoreFx(cx, cy, type);
        target.classList.add('sb-hit');
        if (bossHP <= 0) nextBossOrFinish();
      }

      target.removeEventListener('click', onHit);
      setTimeout(function () {
        if (target.parentNode) target.parentNode.removeChild(target);
      }, 220);
    }

    target.addEventListener('click', onHit);
    field.appendChild(target);

    setTimeout(function () {
      if (!running || clicked) return;
      clicked = true;
      if (!isBad) {
        target.classList.add('sb-miss');
        playerHP = clamp(playerHP - 1, 0, playerHPMax);
        misses++;
        updateHPBars();
        updateScore(SCORE_MISS_PENALTY);
        showScoreFx(x, y, 'miss');
        checkGameOver();
      } else {
        target.classList.add('sb-miss');
      }
      setTimeout(function () {
        if (target.parentNode) target.parentNode.removeChild(target);
      }, 180);
    }, lifetime);
  }

  // ----- Game flow -----

  function clearField() {
    if (!field) return;
    while (field.firstChild) field.removeChild(field.firstChild);
  }

  function startSpawning() {
    stopSpawning();
    spawnTimer = setInterval(spawnTarget, cfg.spawnInterval);
  }

  function stopSpawning() {
    if (spawnTimer) {
      clearInterval(spawnTimer);
      spawnTimer = null;
    }
  }

  function formatTime(ms) {
    ms = Math.max(0, ms);
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }

  function startTimer() {
    if (gameTimer) clearInterval(gameTimer);
    startTimeMs = performance.now();
    var total = remainMs;
    if (metaTime) metaTime.textContent = formatTime(total);

    gameTimer = setInterval(function () {
      if (!running) return;
      var elapsed = performance.now() - startTimeMs;
      remainMs = clamp(total - elapsed, 0, total);
      if (metaTime) metaTime.textContent = formatTime(remainMs);
      if (remainMs <= 0) {
        finishGame('หมดเวลาแล้ว ⏱', 'ชกได้ดีเลย! พร้อมไปต่อด่านอื่นแล้ว');
      }
    }, 200);
  }

  function checkGameOver() {
    if (playerHP <= 0) {
      finishGame('พลังหมดแล้ว 💥', 'ลองใหม่อีกครั้ง แล้วชกให้แม่นกว่านี้!');
    }
  }

  function nextBossOrFinish() {
    clearField();
    if (bossIdx < BOSSES.length - 1) {
      bossIdx++;
      setupBoss();
    } else {
      finishGame('ชนะทุกบอสแล้ว! 👑', 'สุดยอดนักชก Shadow Breaker!');
    }
  }

  function setupBoss() {
    setBoss(bossIdx);
    bossHPMax = cfg.bossHP + bossIdx * 5;
    bossHP = bossHPMax;
    updateHPBars();
  }

  function showCenter(title, message, btnText, btnHandler) {
    if (!centerPanel) return;
    centerPanel.innerHTML = '';
    var h = document.createElement('h1');
    h.textContent = title;
    var p = document.createElement('p');
    p.textContent = message;
    var btn = document.createElement('button');
    btn.className = 'sb-btn';
    btn.textContent = btnText;
    btn.onclick = btnHandler;

    centerPanel.appendChild(h);
    centerPanel.appendChild(p);
    centerPanel.appendChild(btn);
    centerPanel.style.display = 'block';
  }

  function hideCenter() {
    if (centerPanel) centerPanel.style.display = 'none';
  }

  function startGame() {
    running = true;
    wrap.classList.remove('sb-finished');
    hideCenter();
    clearField();
    score = 0;
    hits = 0;
    misses = 0;
    if (metaScore) metaScore.textContent = '0';

    playerHPMax = cfg.playerHP;
    playerHP = playerHPMax;

    bossIdx = 0;
    setupBoss();
    updateHPBars();

    startSpawning();
    startTimer();
  }

  function finishGame(title, subtitle) {
    running = false;
    wrap.classList.add('sb-finished');
    stopSpawning();
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    clearField();

    var summary = 'คะแนน ' + score +
      ' • ชกโดน ' + hits +
      ' • พลาด ' + misses;

    showCenter(
      title,
      subtitle + '\n' + summary,
      'เล่นอีกครั้ง',
      function () { startGame(); }
    );
  }

  // ----- Boot -----

  function boot() {
    ensureDOM();

    var q = getQuery();
    var diff = (q.diff || q.difficulty || '').toLowerCase();
    if (!DIFF[diff]) diff = 'easy';
    currentDiffKey = diff;
    cfg = DIFF[diff];

    var t = parseInt(q.time, 10);
    if (isNaN(t) || t <= 0) t = 60;
    remainMs = t * 1000;

    if (centerPanel) {
      centerPanel.innerHTML = [
        '<h1>Shadow Breaker</h1>',
        '<p>ระดับ: ' + diff.toUpperCase() + ' • เวลา: ' + t + ' วินาที</p>',
        '<button id="sbStartBtn" class="sb-btn">เริ่มเกม</button>'
      ].join('');
      startButton = $('#sbStartBtn');
      if (startButton) {
        startButton.onclick = function () {
          if (!running) startGame();
        };
      }
    }

    setBoss(0);
    updateHPBars();
    if (metaTime) metaTime.textContent = formatTime(remainMs);

    // pause on blur
    window.addEventListener('blur', function () {
      if (!running) return;
      running = false;
      stopSpawning();
      showCenter('หยุดชั่วคราว ⏸', 'กลับมาหน้าจอแล้วค่อยเริ่มต่ออีกครั้งนะ', 'เล่นต่อ', function () {
        startGame();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();