'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk.safe.race.js
 * GoodJunk Race Core
 * FULL PATCH v20260404-race-core-playable-full
 * ========================================================= */
(function(){
  if (window.__GJ_RACE_CORE_LOADED__) return;
  window.__GJ_RACE_CORE_LOADED__ = true;

  var W = window;
  var D = document;

  function qs(key, fallback) {
    try {
      var u = new URL(location.href);
      var v = u.searchParams.get(key);
      return v == null ? (fallback || '') : v;
    } catch (_) {
      return fallback || '';
    }
  }

  function now() {
    return Date.now();
  }

  function num(v, d) {
    v = Number(v);
    return Number.isFinite(v) ? v : (d || 0);
  }

  function clamp(v, a, b) {
    v = num(v, a);
    if (v < a) return a;
    if (v > b) return b;
    return v;
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function pick(arr) {
    if (!arr || !arr.length) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clean(v) {
    return String(v == null ? '' : v).trim();
  }

  function emit(name, detail) {
    try {
      W.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  var ctx = W.__GJ_RUN_CTX__ || W.__GJ_MULTI_RUN_CTX__ || {
    mode: 'race',
    pid: qs('pid', 'anon'),
    name: qs('name', qs('nick', 'Player')),
    roomId: qs('roomId', qs('room', '')),
    role: qs('role', 'player'),
    diff: qs('diff', 'normal'),
    time: qs('time', '120'),
    seed: qs('seed', String(now())),
    startAt: num(qs('startAt', '0'), 0),
    hub: qs('hub', '../hub.html'),
    wait: qs('wait', '0'),
    host: qs('host', '0'),
    view: qs('view', 'mobile')
  };

  var ROOT = null;
  var LAYER = null;
  var HUD = null;
  var COUNTDOWN = null;
  var READY = false;

  var GOOD_POOL = ['🍎','🥕','🍉','🍇','🥦','🍌','🥛','🐟','🥚','🍓'];
  var JUNK_POOL = ['🍟','🍔','🍩','🍰','🍫','🧃','🥤','🍭','🍕','🌭'];

  var CONFIG = {
    easy:   { spawnMs: 820, lifeMs: 1800, size: 96, junkRate: 0.24, scoreGood: 12, scoreJunk: -8 },
    normal: { spawnMs: 620, lifeMs: 1450, size: 86, junkRate: 0.30, scoreGood: 10, scoreJunk: -10 },
    hard:   { spawnMs: 500, lifeMs: 1180, size: 76, junkRate: 0.36, scoreGood: 10, scoreJunk: -12 }
  };

  var GAME = {
    booted: false,
    running: false,
    paused: false,
    ended: false,
    raf: 0,
    startAtMs: 0,
    durationMs: clamp(num(ctx.time, 120), 30, 300) * 1000,
    timeLeftMs: clamp(num(ctx.time, 120), 30, 300) * 1000,
    lastTs: 0,
    nextSpawnAt: 0,
    score: 0,
    goodHit: 0,
    junkHit: 0,
    miss: 0,
    streak: 0,
    bestStreak: 0,
    targets: [],
    summarySent: false
  };

  function getCfg() {
    return CONFIG[clean(ctx.diff).toLowerCase()] || CONFIG.normal;
  }

  function ensureMount() {
    if (ROOT) return ROOT;

    var mount = D.getElementById('gameMount') || D.body;

    ROOT = D.createElement('div');
    ROOT.id = 'gjRaceRoot';
    ROOT.style.position = 'absolute';
    ROOT.style.inset = '0';
    ROOT.style.zIndex = '1';
    ROOT.style.pointerEvents = 'auto';
    ROOT.style.overflow = 'hidden';
    ROOT.style.touchAction = 'manipulation';
    ROOT.style.userSelect = 'none';

    LAYER = D.createElement('div');
    LAYER.id = 'gjRaceLayer';
    LAYER.style.position = 'absolute';
    LAYER.style.inset = '0';
    LAYER.style.overflow = 'hidden';
    LAYER.style.pointerEvents = 'auto';

    HUD = D.createElement('div');
    HUD.id = 'gjRaceHud';
    HUD.style.position = 'absolute';
    HUD.style.left = '12px';
    HUD.style.bottom = '12px';
    HUD.style.display = 'flex';
    HUD.style.flexWrap = 'wrap';
    HUD.style.gap = '8px';
    HUD.style.zIndex = '4';
    HUD.style.pointerEvents = 'none';

    COUNTDOWN = D.createElement('div');
    COUNTDOWN.id = 'gjRaceCountdown';
    COUNTDOWN.style.position = 'absolute';
    COUNTDOWN.style.left = '50%';
    COUNTDOWN.style.top = '50%';
    COUNTDOWN.style.transform = 'translate(-50%, -50%)';
    COUNTDOWN.style.minWidth = '180px';
    COUNTDOWN.style.padding = '18px 20px';
    COUNTDOWN.style.borderRadius = '28px';
    COUNTDOWN.style.border = '3px solid #bfe3f2';
    COUNTDOWN.style.background = 'rgba(255,253,248,.94)';
    COUNTDOWN.style.boxShadow = '0 18px 40px rgba(86,155,194,.18)';
    COUNTDOWN.style.textAlign = 'center';
    COUNTDOWN.style.fontWeight = '1000';
    COUNTDOWN.style.color = '#4d4a42';
    COUNTDOWN.style.zIndex = '5';
    COUNTDOWN.style.display = 'none';
    COUNTDOWN.style.pointerEvents = 'none';

    ROOT.appendChild(LAYER);
    ROOT.appendChild(HUD);
    ROOT.appendChild(COUNTDOWN);
    mount.appendChild(ROOT);

    ensureStyle();
    refreshHud();

    return ROOT;
  }

  function ensureStyle() {
    if (D.getElementById('gjRaceCoreStyle')) return;

    var style = D.createElement('style');
    style.id = 'gjRaceCoreStyle';
    style.textContent = [
      '#gjRaceHud .chip{',
      'display:inline-flex;',
      'align-items:center;',
      'justify-content:center;',
      'min-height:42px;',
      'padding:10px 14px;',
      'border-radius:999px;',
      'border:2px solid #bfe3f2;',
      'background:#fff;',
      'color:#5a5850;',
      'font-size:12px;',
      'font-weight:1000;',
      'box-shadow:0 8px 18px rgba(86,155,194,.10);',
      '}',
      '.gj-race-target{',
      'position:absolute;',
      'display:grid;',
      'place-items:center;',
      'border-radius:999px;',
      'border:4px solid #fff;',
      'box-shadow:0 12px 24px rgba(86,155,194,.18);',
      'cursor:pointer;',
      'transform:translate(-50%,-50%);',
      'touch-action:manipulation;',
      'will-change:transform,left,top;',
      '}',
      '.gj-race-target.good{',
      'background:linear-gradient(180deg,#ffffff,#f1fff1);',
      'box-shadow:0 14px 26px rgba(76,175,80,.18);',
      '}',
      '.gj-race-target.junk{',
      'background:linear-gradient(180deg,#fff4f4,#ffe5e5);',
      'box-shadow:0 14px 26px rgba(239,68,68,.16);',
      '}',
      '.gj-race-target .emoji{',
      'line-height:1;',
      'pointer-events:none;',
      '}',
      '.gj-race-pop{',
      'position:absolute;',
      'transform:translate(-50%,-50%);',
      'font-weight:1000;',
      'font-size:22px;',
      'pointer-events:none;',
      'z-index:6;',
      'animation:gjRacePop .55s ease-out forwards;',
      '}',
      '.gj-race-pop.good{color:#3f9f2b;}',
      '.gj-race-pop.bad{color:#d14b4b;}',
      '@keyframes gjRacePop{',
      '0%{opacity:0; transform:translate(-50%,-20%) scale(.9);}',
      '20%{opacity:1; transform:translate(-50%,-50%) scale(1);}',
      '100%{opacity:0; transform:translate(-50%,-110%) scale(1.05);}',
      '}'
    ].join('');
    D.head.appendChild(style);
  }

  function hudChip(label, value) {
    return '<div class="chip">' + label + ' • ' + value + '</div>';
  }

  function refreshHud() {
    if (!HUD) return;

    HUD.innerHTML =
      hudChip('SCORE', GAME.score) +
      hudChip('GOOD', GAME.goodHit) +
      hudChip('JUNK', GAME.junkHit) +
      hudChip('MISS', GAME.miss) +
      hudChip('TIME', Math.max(0, Math.ceil(GAME.timeLeftMs / 1000)));
  }

  function showCountdown(text, sub) {
    if (!COUNTDOWN) return;
    COUNTDOWN.style.display = 'block';
    COUNTDOWN.innerHTML =
      '<div style="font-size:14px;color:#79aeca;margin-bottom:8px;">' + String(sub || 'เตรียมพร้อม') + '</div>' +
      '<div style="font-size:72px;line-height:1;color:#5c9b28;">' + String(text || '3') + '</div>';
  }

  function hideCountdown() {
    if (!COUNTDOWN) return;
    COUNTDOWN.style.display = 'none';
  }

  function getBounds() {
    ensureMount();
    var rect = ROOT.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;

    var left = Math.max(70, Math.min(150, w * 0.12));
    var right = Math.max(70, Math.min(150, w * 0.12));
    var top = Math.max(150, Math.min(210, h * 0.20));
    var bottom = Math.max(120, Math.min(190, h * 0.18));

    return {
      width: w,
      height: h,
      minX: left,
      maxX: Math.max(left + 20, w - right),
      minY: top,
      maxY: Math.max(top + 20, h - bottom)
    };
  }

  function makePop(x, y, text, good) {
    if (!LAYER) return;
    var p = D.createElement('div');
    p.className = 'gj-race-pop ' + (good ? 'good' : 'bad');
    p.textContent = text;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    LAYER.appendChild(p);
    setTimeout(function(){
      if (p && p.parentNode) p.parentNode.removeChild(p);
    }, 650);
  }

  function removeTarget(target) {
    if (!target) return;
    var idx = GAME.targets.indexOf(target);
    if (idx >= 0) GAME.targets.splice(idx, 1);
    if (target.el && target.el.parentNode) {
      target.el.parentNode.removeChild(target.el);
    }
  }

  function scoreGood() {
    var cfg = getCfg();
    var bonus = GAME.streak >= 8 ? 4 : (GAME.streak >= 4 ? 2 : 0);
    var gain = cfg.scoreGood + bonus;
    GAME.score += gain;
    GAME.goodHit += 1;
    GAME.streak += 1;
    if (GAME.streak > GAME.bestStreak) GAME.bestStreak = GAME.streak;
    return gain;
  }

  function hitJunkPenalty() {
    var cfg = getCfg();
    GAME.score = Math.max(0, GAME.score + cfg.scoreJunk);
    GAME.junkHit += 1;
    GAME.miss += 1;
    GAME.streak = 0;
    return cfg.scoreJunk;
  }

  function missGoodPenalty() {
    GAME.miss += 1;
    GAME.streak = 0;
  }

  function createTarget(kind) {
    ensureMount();
    if (!LAYER) return null;

    var cfg = getCfg();
    var bounds = getBounds();
    var size = cfg.size + rand(-6, 8);
    var x = rand(bounds.minX, bounds.maxX);
    var y = rand(bounds.minY, bounds.maxY);
    var emoji = kind === 'good' ? pick(GOOD_POOL) : pick(JUNK_POOL);

    var el = D.createElement('button');
    el.type = 'button';
    el.className = 'gj-race-target ' + kind;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = '<span class="emoji" style="font-size:' + Math.max(28, Math.floor(size * 0.42)) + 'px;">' + emoji + '</span>';

    var target = {
      kind: kind,
      bornAt: now(),
      lifeMs: cfg.lifeMs + rand(-180, 180),
      x: x,
      y: y,
      el: el,
      clicked: false
    };

    el.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (!GAME.running || GAME.paused || GAME.ended) return;
      if (target.clicked) return;

      target.clicked = true;

      if (kind === 'good') {
        var gain = scoreGood();
        makePop(x, y, '+' + gain, true);
      } else {
        var loss = hitJunkPenalty();
        makePop(x, y, String(loss), false);
      }

      removeTarget(target);
      refreshHud();
      emit('hha:score', {
        mode: 'race',
        score: GAME.score,
        goodHit: GAME.goodHit,
        junkHit: GAME.junkHit,
        miss: GAME.miss,
        streak: GAME.streak,
        bestStreak: GAME.bestStreak
      });
    });

    LAYER.appendChild(el);
    GAME.targets.push(target);
    return target;
  }

  function clearTargets() {
    while (GAME.targets.length) {
      removeTarget(GAME.targets[0]);
    }
  }

  function maybeSpawn(ts) {
    var cfg = getCfg();
    if (ts < GAME.nextSpawnAt) return;
    GAME.nextSpawnAt = ts + cfg.spawnMs;

    var isJunk = Math.random() < cfg.junkRate;
    createTarget(isJunk ? 'junk' : 'good');
  }

  function expireTargets(ts) {
    var i;
    for (i = GAME.targets.length - 1; i >= 0; i--) {
      var t = GAME.targets[i];
      if (!t || t.clicked) continue;
      if (ts - t.bornAt >= t.lifeMs) {
        if (t.kind === 'good') {
          missGoodPenalty();
          makePop(t.x, t.y, 'MISS', false);
        }
        removeTarget(t);
      }
    }
  }

  function finalizeSummary(reason) {
    if (GAME.summarySent) return;
    GAME.summarySent = true;

    clearTargets();
    GAME.running = false;
    GAME.ended = true;
    refreshHud();

    var summary = {
      mode: 'race',
      pid: ctx.pid,
      name: ctx.name,
      score: GAME.score,
      miss: GAME.miss,
      goodHit: GAME.goodHit,
      junkHit: GAME.junkHit,
      bestStreak: GAME.bestStreak,
      duration: Math.round((GAME.durationMs - GAME.timeLeftMs) / 1000),
      reason: clean(reason || 'timeup'),
      result: 'จบรอบแล้ว'
    };

    try {
      localStorage.setItem('GJ_RACE_LAST_SUMMARY', JSON.stringify(summary));
    } catch (_) {}

    emit('gj:summary', summary);
    emit('hha:summary', summary);
    emit('hha:session-summary', summary);
  }

  function loop(ts) {
    if (!GAME.booted) return;

    if (!GAME.lastTs) GAME.lastTs = ts;
    var dt = ts - GAME.lastTs;
    GAME.lastTs = ts;

    if (!GAME.running || GAME.paused || GAME.ended) {
      GAME.raf = W.requestAnimationFrame(loop);
      return;
    }

    GAME.timeLeftMs -= dt;
    if (GAME.timeLeftMs < 0) GAME.timeLeftMs = 0;

    maybeSpawn(ts);
    expireTargets(now());
    refreshHud();

    if (GAME.timeLeftMs <= 0) {
      finalizeSummary('timeup');
      return;
    }

    GAME.raf = W.requestAnimationFrame(loop);
  }

  function beginPlayNow() {
    if (GAME.running || GAME.ended) return;
    hideCountdown();
    GAME.running = true;
    GAME.paused = false;
    GAME.startAtMs = now();
    GAME.lastTs = 0;
    GAME.nextSpawnAt = 0;
    refreshHud();
    emit('gj:race-start', {
      roomId: ctx.roomId,
      pid: ctx.pid,
      name: ctx.name
    });
  }

  function armCountdown() {
    var target = num(ctx.startAt, 0);
    if (!target || target <= now() + 150) {
      setTimeout(function(){
        beginPlayNow();
      }, 700);
      return;
    }

    function tick() {
      if (GAME.ended || GAME.running) return;
      var left = target - now();
      var sec = Math.max(0, Math.ceil(left / 1000));
      if (left <= 0) {
        showCountdown('GO!', 'เริ่มแล้ว');
        setTimeout(function(){
          beginPlayNow();
        }, 250);
        return;
      }
      showCountdown(sec, 'เตรียมพร้อม');
      setTimeout(tick, 100);
    }

    tick();
  }

  function boot() {
    if (GAME.booted) return;
    GAME.booted = true;
    ensureMount();
    refreshHud();
    GAME.raf = W.requestAnimationFrame(loop);
    armCountdown();
  }

  function setPaused(flag) {
    GAME.paused = !!flag;
    if (!GAME.paused && GAME.running && !GAME.ended) {
      GAME.lastTs = 0;
    }
  }

  function startNow() {
    if (!GAME.booted) boot();
    ctx.startAt = 0;
    beginPlayNow();
  }

  function getScore() {
    return GAME.score;
  }

  function getStats() {
    return {
      score: GAME.score,
      miss: GAME.miss,
      goodHit: GAME.goodHit,
      junkHit: GAME.junkHit,
      streak: GAME.streak,
      bestStreak: GAME.bestStreak,
      timeLeftMs: GAME.timeLeftMs,
      running: GAME.running,
      paused: GAME.paused,
      ended: GAME.ended
    };
  }

  W.__GJ_BOOT__ = boot;
  W.__GJ_START_NOW__ = startNow;
  W.__GJ_SET_PAUSED__ = setPaused;
  W.__GJ_GET_SCORE__ = getScore;
  W.__GJ_GET_STATS__ = getStats;

  W.GJRaceRun = {
    boot: boot,
    start: startNow,
    init: boot,
    getScore: getScore,
    getStats: getStats,
    setPaused: setPaused
  };

  boot();
})();