// === Hero Health — game/main.js (Multi-mode DOM Engine: Research + Production) ===
// รองรับโหมดจาก window.HH_MODES (เช่น goodjunk, groups)
// ฟีเจอร์หลัก:
// 1) Multi-mode (Good vs Junk / Food Groups ...)
// 2) Goal + Mini Quest (API จากแต่ละ mode)
// 3) CSV Export สำหรับครู/วิจัย
// 4) B-Mode Visual (Fever glow, quest highlight, mission bar)
// 5) Stability: pause เมื่อ tab หาย, watchdog DOM

(function () {
  'use strict';

  // ---------- URL & Player Profile ----------
  var url        = new URL(window.location.href);
  var MODE_KEY   = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();
  var DIFF       = (url.searchParams.get('diff') || 'normal').toLowerCase();
  var timeParam  = parseInt(url.searchParams.get('time'), 10);
  if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
  if (timeParam < 20) timeParam = 20;
  if (timeParam > 180) timeParam = 180;
  var GAME_DURATION = timeParam;

  var PLAYER_NAME = url.searchParams.get('name') || '';
  var PLAYER_ROOM = url.searchParams.get('room') || '';
  var PLAYER_AGE  = url.searchParams.get('age') || '';

  // ---------- Mode Resolve ----------
  var ALL_MODES = window.HH_MODES || {};
  var MODE_IMPL = ALL_MODES[MODE_KEY] || null;

  if (!MODE_IMPL) {
    console.warn('[HHA] ไม่พบโหมดเกม:', MODE_KEY, 'มีโหมดที่ใช้ได้:', Object.keys(ALL_MODES || {}));
    // fallback stub
    MODE_IMPL = {
      id: MODE_KEY,
      label: MODE_KEY,
      setupForDiff: function () {
        return {
          SPAWN_INTERVAL: 800,
          ITEM_LIFETIME: 1500,
          MAX_ACTIVE: 4,
          MISSION_GOOD_TARGET: 15,
          SIZE_FACTOR: 1.0,
          TYPE_WEIGHTS: {
            good: 60,
            junk: 40
          },
          FEVER_DURATION: 0,
          DIAMOND_TIME_BONUS: 0
        };
      },
      missionText: function (target) {
        return 'โหมด "' + MODE_KEY + '" ยังไม่ได้ตั้งค่า ใช้โหมดทดสอบแทน (' + target + ' ชิ้น)';
      },
      goalDefs: function () { return []; },
      questDefs: function () { return []; },
      sessionInfo: function () { return {}; },
      pickEmoji: function (type) {
        if (type === 'good') return '🍏';
        if (type === 'junk') return '❌';
        return '❓';
      }
    };
  }

  // ---------- Config from Mode ----------
  var BASE_CFG = MODE_IMPL.setupForDiff ? MODE_IMPL.setupForDiff(DIFF) : {};
  BASE_CFG = BASE_CFG || {};

  var SPAWN_INTERVAL      = BASE_CFG.SPAWN_INTERVAL      != null ? BASE_CFG.SPAWN_INTERVAL      : 700;
  var ITEM_LIFETIME       = BASE_CFG.ITEM_LIFETIME       != null ? BASE_CFG.ITEM_LIFETIME       : 1500;
  var MAX_ACTIVE          = BASE_CFG.MAX_ACTIVE          != null ? BASE_CFG.MAX_ACTIVE          : 4;
  var MISSION_GOOD_TARGET = BASE_CFG.MISSION_GOOD_TARGET != null ? BASE_CFG.MISSION_GOOD_TARGET : 20;
  var SIZE_FACTOR         = BASE_CFG.SIZE_FACTOR         != null ? BASE_CFG.SIZE_FACTOR         : 1.0;
  var TYPE_WEIGHTS        = BASE_CFG.TYPE_WEIGHTS        || { good: 60, junk: 40 };
  var FEVER_DURATION      = BASE_CFG.FEVER_DURATION      != null ? BASE_CFG.FEVER_DURATION      : 0;
  var DIAMOND_TIME_BONUS  = BASE_CFG.DIAMOND_TIME_BONUS  != null ? BASE_CFG.DIAMOND_TIME_BONUS  : 0;

  var GOALS = (typeof MODE_IMPL.goalDefs === 'function') ? (MODE_IMPL.goalDefs(DIFF) || []) : [];
  var QUESTS = (typeof MODE_IMPL.questDefs === 'function') ? (MODE_IMPL.questDefs(DIFF) || []) : [];

  var SESSION_INFO = (typeof MODE_IMPL.sessionInfo === 'function') ? (MODE_IMPL.sessionInfo() || {}) : {};

  console.log('[HHA engine] mode =', MODE_KEY, 'diff =', DIFF, 'config =', BASE_CFG);
  console.log('[HHA engine] goals =', GOALS);
  console.log('[HHA engine] quests =', QUESTS);
  console.log('[HHA engine] sessionInfo =', SESSION_INFO);

  // ---------- Global State ----------
  var running      = false;
  var isPaused     = false;
  var spawnTimer   = null;
  var tickTimer    = null;

  var score        = 0;
  var combo        = 0;
  var maxCombo     = 0;
  var timeLeft     = GAME_DURATION;
  var missionGoodCount = 0;
  var activeItems  = 0;

  var shieldCharges   = 0;
  var feverTicksLeft  = 0;

  var totalGoodHits   = 0;
  var totalJunkHits   = 0;
  var totalPowerHits  = 0;
  var totalFeverEnter = 0;

  var firstHitTs      = null;

  var goalStatus = {};   // id -> { target, value, status }
  var questState = {};   // id -> { status: 'pending'|'done', meta:{} }

  var hostLayer  = null;
  var fxLayer    = null;
  var hudCreated = false;

  // ---------- Helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return document.querySelectorAll(sel); }

  function now() { return performance.now(); }

  function currentMultiplier() {
    return feverTicksLeft > 0 ? 2 : 1;
  }

  function clamp01(x) {
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }

  function initGoalStatus() {
    goalStatus = {};
    for (var i = 0; i < GOALS.length; i++) {
      var g = GOALS[i];
      goalStatus[g.id] = {
        id: g.id,
        label: g.label,
        target: g.target,
        type: g.type || 'count',
        weight: g.weight || 1,
        value: 0,
        status: 'pending'
      };
    }
  }

  function initQuestState() {
    questState = {};
    for (var i = 0; i < QUESTS.length; i++) {
      var q = QUESTS[i];
      questState[q.id] = {
        id: q.id,
        text: q.text,
        icon: q.icon || '🎯',
        kind: q.kind || 'custom',
        threshold: q.threshold != null ? q.threshold : 1,
        status: 'pending',
        meta: {}
      };
    }
  }

  // ---------- DOM Layers ----------
  function createHost() {
    if (hostLayer && document.body.contains(hostLayer)) return hostLayer;
    hostLayer = document.createElement('div');
    hostLayer.id = 'hha-dom-host';
    hostLayer.style.position = 'fixed';
    hostLayer.style.inset = '0';
    hostLayer.style.pointerEvents = 'none';
    hostLayer.style.zIndex = '9000';
    document.body.appendChild(hostLayer);
    return hostLayer;
  }

  function createFXLayer() {
    if (fxLayer && document.body.contains(fxLayer)) return fxLayer;
    fxLayer = document.createElement('div');
    fxLayer.id = 'hha-fx-layer';
    fxLayer.style.position = 'fixed';
    fxLayer.style.inset = '0';
    fxLayer.style.pointerEvents = 'none';
    fxLayer.style.zIndex = '9050';
    fxLayer.style.overflow = 'hidden';
    document.body.appendChild(fxLayer);
    return fxLayer;
  }

  function ensureGameCSS() {
    if (document.getElementById('hha-game-css')) return;
    var st = document.createElement('style');
    st.id = 'hha-game-css';
    st.textContent = [
      '/* เป้าเด้งลอยนิด ๆ */',
      '@keyframes hha-float {',
      '  0%   { transform: translate3d(0,0,0); }',
      '  50%  { transform: translate3d(0,-10px,0); }',
      '  100% { transform: translate3d(0,0,0); }',
      '}',

      '/* quest done pulse */',
      '@keyframes hha-quest-pop {',
      '  0%   { transform: scale(0.9); opacity: 0; }',
      '  40%  { transform: scale(1.05); opacity: 1; }',
      '  100% { transform: scale(1.0); opacity: 1; }',
      '}',

      'body.hha-fever::before {',
      '  content: "";',
      '  position: fixed;',
      '  inset: 0;',
      '  pointer-events: none;',
      '  box-shadow: 0 0 80px rgba(248,113,113,0.7) inset;',
      '  z-index: 8990;',
      '}',

      '@media (max-width: 720px) {',
      '  #hha-hud-inner {',
      '    padding: 8px 12px;',
      '    font-size: 12px;',
      '    min-width: 220px;',
      '  }',
      '  #hha-hud-inner #hha-score,',
      '  #hha-hud-inner #hha-combo {',
      '    font-size: 16px;',
      '  }',
      '  #hha-timebox {',
      '    font-size: 11px;',
      '    padding: 4px 10px;',
      '  }',
      '}',

      '@media (max-width: 480px) {',
      '  #hha-hud-inner {',
      '    padding: 6px 10px;',
      '    font-size: 11px;',
      '    min-width: 200px;',
      '  }',
      '  #hha-hud-inner #hha-score,',
      '  #hha-hud-inner #hha-combo {',
      '    font-size: 14px;',
      '  }',
      '  #hha-buffs {',
      '    font-size: 10px;',
      '  }',
      '  #hha-timebox {',
      '    font-size: 10px;',
      '    padding: 3px 8px;',
      '  }',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---------- HUD ----------
  function createHUD() {
    // กันกรณีมี HUD เก่าจากเวอร์ชันก่อน / script ตัวอื่น → ลบทิ้งให้หมดก่อน
    var oldHud = document.getElementById('hha-hud');
    if (oldHud && oldHud.parentNode) {
      oldHud.parentNode.removeChild(oldHud);
    }

    hudCreated = true;

    var hud = document.createElement('div');
    hud.id = 'hha-hud';

    var modeLabel = (MODE_IMPL && MODE_IMPL.label) ? MODE_IMPL.label : MODE_KEY;
    var diffLabel = DIFF.toUpperCase();

    var profileLine = '';
    if (PLAYER_NAME || PLAYER_ROOM) {
      profileLine =
        '👤 ' + (PLAYER_NAME || 'ไม่ระบุชื่อ') +
        (PLAYER_ROOM ? (' • ' + PLAYER_ROOM) : '');
      if (PLAYER_AGE) {
        profileLine += ' • ' + PLAYER_AGE + ' ปี';
      }
    }

    var missionText = (typeof MODE_IMPL.missionText === 'function')
      ? MODE_IMPL.missionText(MISSION_GOOD_TARGET)
      : ('ภารกิจ: เก็บให้ครบ ' + MISSION_GOOD_TARGET + ' ชิ้น');

    hud.innerHTML = [
      '<div id="hha-hud-inner"',
      '  style="',
      '    position:fixed;top:16px;left:50%;transform:translateX(-50%);',
      '    background:linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98));',
      '    border-radius:18px;padding:10px 18px;',
      '    display:flex;flex-direction:column;gap:6px;',
      '    box-shadow:0 18px 40px rgba(0,0,0,0.65);',
      '    border:1px solid rgba(56,189,248,0.4);',
      '    z-index:9100;font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;',
      '    font-size:14px;min-width:260px;max-width:480px;',
      '  ">',
      '  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">',
      '    <div>',
      '      <div>คะแนน</div>',
      '      <div id="hha-score" style="text-align:left;font-weight:700;font-size:20px;">0</div>',
      '    </div>',
      '    <div>',
      '      <div>คอมโบ</div>',
      '      <div id="hha-combo" style="text-align:right;font-weight:700;font-size:20px;">0</div>',
      '    </div>',
      '  </div>',

      '  <div style="font-size:12px;color:#cbd5f5;display:flex;flex-direction:column;gap:4px;">',
      '    <div id="hha-mission-text">' + missionText + '</div>',
      '    <div style="width:100%;height:6px;border-radius:999px;background:rgba(15,23,42,0.9);overflow:hidden;border:1px solid rgba(148,163,184,0.7);">',
      '      <div id="hha-mission-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#16a34a);"></div>',
      '    </div>',
      '    <div id="hha-buffs" style="margin-top:2px;">',
      '      ⭐ คอมโบสูงสุด: <span id="hha-buff-star">0</span>',
      '      &nbsp;|&nbsp; 🛡 เกราะ: <span id="hha-buff-shield">0</span>',
      '      &nbsp;|&nbsp; 🔥 Fever: <span id="hha-buff-fever">0</span>s',
      '    </div>',
      '  </div>',

      '  <div id="hha-quest-row" style="margin-top:4px;font-size:11px;color:#e5e7ff;display:flex;flex-wrap:wrap;gap:4px;"></div>',

      (profileLine
        ? '<div style="margin-top:4px;font-size:11px;color:#9ca3af;">' + profileLine + '</div>'
        : ''),

      '</div>',

      '<div id="hha-timebox"',
      '  style="position:fixed;top:16px;right:16px;',
      '         background:rgba(15,23,42,0.96);border-radius:999px;',
      '         padding:6px 14px;border:1px solid rgba(148,163,184,0.9);',
      '         font-size:13px;z-index:9100;font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;">',
      '  <span id="hha-timebox-label">' + modeLabel + ' • ' + diffLabel + '</span>',
      '  &nbsp;•&nbsp;<span id="hha-time">0</span>s',
      '</div>',

      '<div id="hha-result" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9200;">',
      '  <div style="background:rgba(15,23,42,0.97);border-radius:18px;padding:20px 26px;min-width:260px;',
      '              border:1px solid rgba(34,197,94,0.8);text-align:center;box-shadow:0 18px 40px rgba(0,0,0,0.75);',
      '              font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;">',
      '    <h2 id="hha-result-title" style="margin-top:0;margin-bottom:8px;font-size:18px;">จบรอบแล้ว 🎉</h2>',
      '    <div style="margin-bottom:4px;">คะแนนรวม: <b id="hha-final-score">0</b></div>',
      '    <div style="margin-bottom:4px;">คอมโบสูงสุด: <b id="hha-final-combo">0</b></div>',
      '    <div style="margin-bottom:4px;">ของดีที่เก็บได้: <b id="hha-final-good">0</b> / ' + MISSION_GOOD_TARGET + '</div>',
      '    <div style="margin-bottom:8px;">',
      '      Rank: <span id="hha-rank-badge" style="display:inline-flex;align-items:center;justify-content:center;',
      '          min-width:38px;height:24px;border-radius:999px;',
      '          background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:700;">–</span>',
      '    </div>',
      '    <div id="hha-result-goals" style="margin-bottom:8px;font-size:12px;color:#cbd5f5;text-align:left;"></div>',
      '    <div id="hha-result-quests" style="margin-bottom:10px;font-size:12px;color:#e5e7ff;text-align:left;"></div>',
      '    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">',
      '      <button id="hha-restart"',
      '        style="border-radius:999px;border:0;cursor:pointer;padding:8px 18px;',
      '               background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff;font-weight:600;font-size:14px;">',
      '        เล่นอีกครั้ง',
      '      </button>',
      '      <button id="hha-download-csv"',
      '        style="border-radius:999px;border:0;cursor:pointer;padding:7px 16px;font-size:12px;',
      '               background:rgba(15,23,42,0.96);color:#e5e7eb;border:1px solid rgba(148,163,184,0.8);">',
      '        📄 ดาวน์โหลดข้อมูล (CSV)',
      '      </button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(hud);

    renderQuestChips();
  }


  function renderQuestChips() {
    var row = $('#hha-quest-row');
    if (!row) return;
    row.innerHTML = '';
    var maxShow = Math.min(3, QUESTS.length);
    for (var i = 0; i < maxShow; i++) {
      var q = QUESTS[i];
      var st = questState[q.id];
      if (!st) continue;
      var span = document.createElement('div');
      span.setAttribute('data-quest-id', q.id);
      span.style.display = 'inline-flex';
      span.style.alignItems = 'center';
      span.style.gap = '4px';
      span.style.padding = '2px 8px';
      span.style.borderRadius = '999px';
      span.style.border = '1px solid rgba(148,163,184,0.7)';
      span.style.background = 'rgba(15,23,42,0.8)';
      span.style.opacity = '0.9';

      var icon = document.createElement('span');
      icon.textContent = q.icon || '🎯';
      var text = document.createElement('span');
      text.textContent = q.text;

      span.appendChild(icon);
      span.appendChild(text);

      if (st.status === 'done') {
        span.style.borderColor = 'rgba(250,204,21,0.9)';
        span.style.background = 'rgba(21,128,61,0.85)';
        span.style.animation = 'hha-quest-pop 380ms ease-out';
      }

      row.appendChild(span);
    }
  }

  function updateQuestChipStyle(id) {
    var chips = $all('#hha-quest-row [data-quest-id="' + id + '"]');
    for (var i = 0; i < chips.length; i++) {
      var el = chips[i];
      el.style.borderColor = 'rgba(250,204,21,0.9)';
      el.style.background = 'rgba(21,128,61,0.85)';
      el.style.animation = 'hha-quest-pop 380ms ease-out';
    }
  }

  function updateHUD() {
    var sEl     = $('#hha-score');
    var cEl     = $('#hha-combo');
    var tEl     = $('#hha-time');
    var mBar    = $('#hha-mission-bar');
    var starEl  = $('#hha-buff-star');
    var shieldEl= $('#hha-buff-shield');
    var feverEl = $('#hha-buff-fever');

    if (sEl) sEl.textContent = String(score);
    if (cEl) cEl.textContent = String(combo);
    if (tEl) tEl.textContent = String(timeLeft);

    if (mBar) {
      var ratio = clamp01(missionGoodCount / MISSION_GOOD_TARGET);
      mBar.style.width = (ratio * 100).toFixed(1) + '%';
    }

    if (starEl)   starEl.textContent   = String(maxCombo);
    if (shieldEl) shieldEl.textContent = String(shieldCharges);
    if (feverEl)  feverEl.textContent  = String(Math.max(0, feverTicksLeft));

    if (feverTicksLeft > 0) {
      document.body.classList.add('hha-fever');
    } else {
      document.body.classList.remove('hha-fever');
    }
  }

  // ---------- FX ----------
  function burstAt(x, y, kind) {
    var fx = createFXLayer();
    var container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = x + 'px';
    container.style.top = y + 'px';
    container.style.width = '0';
    container.style.height = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9060';

    var base;
    switch (kind) {
      case 'good':    base = 'rgba(34,197,94,'; break;
      case 'star':
      case 'gold':
      case 'diamond':
        base = 'rgba(250,204,21,'; break;
      case 'shield':  base = 'rgba(59,130,246,'; break;
      case 'fever':   base = 'rgba(248,113,113,'; break;
      default:        base = 'rgba(239,68,68,'; break; // bad
    }

    var shardCount = 12;
    for (var i = 0; i < shardCount; i++) {
      var shard = document.createElement('div');
      var size = 6 + Math.random() * 6;
      shard.style.position = 'absolute';
      shard.style.left = '0';
      shard.style.top = '0';
      shard.style.width = size + 'px';
      shard.style.height = size + 'px';
      shard.style.borderRadius = '999px';
      shard.style.background = base + (0.6 + Math.random() * 0.3) + ')';
      shard.style.transform = 'translate3d(0,0,0) scale(0.6)';
      shard.style.opacity = '1';
      shard.style.transition = 'transform 260ms ease-out, opacity 260ms ease-out';

      container.appendChild(shard);

      (function (sh) {
        var angle = Math.random() * Math.PI * 2;
        var distance = 30 + Math.random() * 40;
        var dx = Math.cos(angle) * distance;
        var dy = Math.sin(angle) * distance;
        requestAnimationFrame(function () {
          sh.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.1)';
          sh.style.opacity = '0';
        });
      })(shard);
    }

    fx.appendChild(container);
    setTimeout(function () {
      if (container.parentNode) container.parentNode.removeChild(container);
    }, 320);
  }

  // ---------- Spawn & Weights ----------
  function pickTypeFromWeights() {
    var entries = [];
    var key;
    for (key in TYPE_WEIGHTS) {
      if (Object.prototype.hasOwnProperty.call(TYPE_WEIGHTS, key)) {
        entries.push([key, TYPE_WEIGHTS[key]]);
      }
    }
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      total += entries[i][1];
    }
    if (total <= 0) return 'good';
    var r = Math.random() * total;
    var acc = 0;
    for (var j = 0; j < entries.length; j++) {
      acc += entries[j][1];
      if (r <= acc) return entries[j][0];
    }
    return 'good';
  }

  function spawnOne(host) {
    if (!running || isPaused) return;
    if (activeItems >= MAX_ACTIVE) return;

    var type = pickTypeFromWeights();
    var emo;
    if (typeof MODE_IMPL.pickEmoji === 'function') {
      emo = MODE_IMPL.pickEmoji(type);
    } else {
      emo = (type === 'good' ? '🍏' : (type === 'junk' ? '❌' : '❓'));
    }

    var item = document.createElement('button');
    item.type = 'button';
    item.textContent = emo;
    item.setAttribute('data-type', type);
    item.style.position = 'absolute';
    item.style.borderRadius = '999px';
    item.style.border = '0';
    item.style.cursor = 'pointer';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'center';
    item.style.pointerEvents = 'auto';
    item.style.animation = 'hha-float 1.3s ease-in-out infinite';

    var shortest = Math.min(window.innerWidth, window.innerHeight);
    var baseSize = shortest < 700 ? 72 : 80;
    var size = Math.round(baseSize * SIZE_FACTOR);
    item.style.width = size + 'px';
    item.style.height = size + 'px';
    item.style.fontSize = String(size * 0.52) + 'px';
    item.style.boxShadow = '0 8px 22px rgba(15,23,42,0.85)';
    item.style.transition = 'transform 0.12s ease, opacity 0.12s ease';

    if (type === 'gold' || type === 'diamond' || type === 'star' || type === 'rainbow') {
      item.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #f97316)';
      item.style.boxShadow = '0 0 25px rgba(250,204,21,0.9)';
    } else if (type === 'shield') {
      item.style.background = 'radial-gradient(circle at 30% 20%, #60a5fa, #1d4ed8)';
      item.style.boxShadow = '0 0 22px rgba(59,130,246,0.8)';
    } else if (type === 'fever') {
      item.style.background = 'radial-gradient(circle at 30% 20%, #fb923c, #b91c1c)';
      item.style.boxShadow = '0 0 26px rgba(248,113,113,0.9)';
    } else if (type === 'good') {
      item.style.background = 'rgba(15,23,42,0.96)';
    } else if (type === 'junk') {
      item.style.background = 'rgba(30,27,75,0.96)';
    }

    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var x = 0.1 * vw + Math.random() * 0.8 * vw;
    var y = 0.18 * vh + Math.random() * 0.7 * vh;
    item.style.left = String(x - size / 2) + 'px';
    item.style.top  = String(y - size / 2) + 'px';

    var spawnTs = now();
    item.setAttribute('data-spawn-ts', String(spawnTs));

    activeItems++;

    function removeItem() {
      if (item.parentNode) {
        item.parentNode.removeChild(item);
        activeItems = Math.max(0, activeItems - 1);
      }
    }

    item.addEventListener('click', function (ev) {
      if (!running || isPaused) return;

      var clickTs = now();
      var spawnVal = parseFloat(item.getAttribute('data-spawn-ts') || '0');
      var reactionSec = spawnVal > 0 ? (clickTs - spawnVal) / 1000 : 999;

      if (!firstHitTs) firstHitTs = clickTs;

      if (navigator.vibrate) {
        if (type === 'junk') navigator.vibrate(60);
        else if (type === 'shield' || type === 'fever') navigator.vibrate(40);
        else navigator.vibrate(25);
      }

      var fxKind = (type === 'junk' ? 'bad' : type);
      burstAt(ev.clientX, ev.clientY, fxKind);

      handleHit(type, reactionSec);

      item.style.opacity = '0';
      item.style.transform = 'scale(0.7)';
      setTimeout(removeItem, 100);
    });

    host.appendChild(item);

    // watchdog: อย่าปล่อยให้ DOM โตเกินไป
    if (host.childNodes.length > 180) {
      while (host.childNodes.length > 140) {
        host.removeChild(host.firstChild);
      }
    }

    setTimeout(function () {
      if (!item.parentNode) return;
      item.style.opacity = '0';
      item.style.transform = 'scale(0.7)';
      setTimeout(removeItem, 120);
    }, ITEM_LIFETIME);
  }

  // ---------- Quest & Goal Update ----------
  function markQuestDone(id) {
    var st = questState[id];
    if (!st || st.status === 'done') return;
    st.status = 'done';
    st.meta.completedAt = now();
    updateQuestChipStyle(id);
  }

  function updateGoalsOnHit(hitType) {
    // ใช้ได้กับ goal แบบ count ง่าย ๆ เช่น good count
    var key;
    for (key in goalStatus) {
      if (!Object.prototype.hasOwnProperty.call(goalStatus, key)) continue;
      var g = goalStatus[key];
      if (g.type === 'count' && hitType === 'good') {
        g.value += 1;
        if (g.value >= g.target && g.status !== 'done') {
          g.status = 'done';
        }
      }
    }
  }

  function updateQuestOnHit(hitType, reactionSec) {
    var key;
    for (key in questState) {
      if (!Object.prototype.hasOwnProperty.call(questState, key)) continue;
      var st = questState[key];
      var def;
      var i;
      for (i = 0; i < QUESTS.length; i++) {
        if (QUESTS[i].id === key) { def = QUESTS[i]; break; }
      }
      if (!def || st.status === 'done') continue;

      var kind = def.kind || 'custom';
      var thr  = def.threshold != null ? def.threshold : 1;

      if (kind === 'streak') {
        if (combo >= thr) {
          markQuestDone(key);
        }
      } else if (kind === 'fast') {
        if (reactionSec <= thr) {
          markQuestDone(key);
        }
      } else if (kind === 'power') {
        if (hitType === 'star' || hitType === 'gold' || hitType === 'diamond' || hitType === 'shield' || hitType === 'fever' || hitType === 'rainbow') {
          markQuestDone(key);
        }
      } else if (kind === 'fever') {
        if (hitType === 'fever') {
          markQuestDone(key);
        }
      } else if (kind === 'powerType') {
        if (def.powerType === 'rainbow' && hitType === 'rainbow') {
          markQuestDone(key);
        }
      }
    }
  }

  // ---------- Hit Logic ----------
  function handleHit(type, reactionSec) {
    var mult = currentMultiplier();

    if (type === 'good') {
      score += 10 * mult;
      combo += 1;
      missionGoodCount += 1;
      totalGoodHits += 1;
      if (combo > maxCombo) maxCombo = combo;
    } else if (type === 'star') {
      score += 15 * mult;
      combo += 2;
      missionGoodCount += 1;
      totalGoodHits += 1;
      totalPowerHits += 1;
      if (combo > maxCombo) maxCombo = combo;
    } else if (type === 'gold') {
      score += 20 * mult;
      combo += 2;
      missionGoodCount += 2;
      totalGoodHits += 2;
      totalPowerHits += 1;
      if (combo > maxCombo) maxCombo = combo;
    } else if (type === 'diamond') {
      score += 30 * mult;
      combo += 3;
      missionGoodCount += 2;
      timeLeft += DIAMOND_TIME_BONUS;
      totalGoodHits += 2;
      totalPowerHits += 1;
      if (combo > maxCombo) maxCombo = combo;
    } else if (type === 'shield') {
      shieldCharges += 1;
      totalPowerHits += 1;
    } else if (type === 'fever') {
      feverTicksLeft = Math.max(feverTicksLeft, FEVER_DURATION);
      totalFeverEnter += 1;
      totalPowerHits += 1;
    } else if (type === 'rainbow') {
      score += 40 * mult;
      combo += 4;
      missionGoodCount += 3;
      totalGoodHits += 3;
      totalPowerHits += 1;
      if (combo > maxCombo) maxCombo = combo;
    } else if (type === 'junk') {
      if (shieldCharges > 0) {
        shieldCharges -= 1;
      } else {
        score = Math.max(0, score - 5);
        combo = 0;
        totalJunkHits += 1;
        var oldBg = document.body.style.backgroundColor || '';
        document.body.style.backgroundColor = '#450a0a';
        setTimeout(function () {
          document.body.style.backgroundColor = oldBg || '';
        }, 80);
      }
    }

    if (type !== 'junk' || shieldCharges > 0) {
      updateGoalsOnHit(type === 'junk' ? 'bad' : 'good');
    }

    updateQuestOnHit(type, reactionSec);
    updateHUD();
  }

  // ---------- Timers ----------
  function stopTimers() {
    if (spawnTimer) clearInterval(spawnTimer);
    if (tickTimer) clearInterval(tickTimer);
    spawnTimer = null;
    tickTimer = null;
  }

  function scheduleTimers() {
    stopTimers();
    var host = createHost();
    spawnTimer = setInterval(function () {
      spawnOne(host);
    }, SPAWN_INTERVAL);

    tickTimer = setInterval(function () {
      if (!running || isPaused) return;
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHUD();
        endGame();
        return;
      }

      if (feverTicksLeft > 0) {
        feverTicksLeft -= 1;
        if (feverTicksLeft < 0) feverTicksLeft = 0;
      }

      updateHUD();
    }, 1000);
  }

  function pauseGame(reason) {
    if (!running || isPaused) return;
    console.log('[HHA] pauseGame:', reason);
    isPaused = true;
    stopTimers();
  }

  function resumeGame(reason) {
    if (!running || !isPaused) return;
    console.log('[HHA] resumeGame:', reason);
    isPaused = false;
    scheduleTimers();
  }

  // ---------- CSV Export ----------
  function downloadCSV() {
    var headers = [
      'timestamp',
      'player_name',
      'player_room',
      'player_age',
      'mode',
      'diff',
      'time_limit',
      'time_left',
      'score',
      'max_combo',
      'mission_good_count',
      'mission_target',
      'good_hits',
      'junk_hits',
      'power_hits',
      'fever_enter'
    ];

    var values = [
      new Date().toISOString(),
      PLAYER_NAME,
      PLAYER_ROOM,
      PLAYER_AGE,
      MODE_KEY,
      DIFF,
      GAME_DURATION,
      timeLeft,
      score,
      maxCombo,
      missionGoodCount,
      MISSION_GOOD_TARGET,
      totalGoodHits,
      totalJunkHits,
      totalPowerHits,
      totalFeverEnter
    ];

    var key;
    for (key in goalStatus) {
      if (!Object.prototype.hasOwnProperty.call(goalStatus, key)) continue;
      headers.push('goal_' + key + '_value');
      headers.push('goal_' + key + '_target');
      headers.push('goal_' + key + '_status');
      var g = goalStatus[key];
      values.push(g.value);
      values.push(g.target);
      values.push(g.status);
    }

    var qkey;
    for (qkey in questState) {
      if (!Object.prototype.hasOwnProperty.call(questState, qkey)) continue;
      headers.push('quest_' + qkey + '_status');
      var qs = questState[qkey];
      values.push(qs.status);
    }

    if (SESSION_INFO && SESSION_INFO.groupId) {
      headers.push('group_id');
      headers.push('group_label');
      headers.push('group_icon');
      values.push(SESSION_INFO.groupId || '');
      values.push(SESSION_INFO.groupLabel || '');
      values.push(SESSION_INFO.groupIcon || '');
    }

    function csvEscape(v) {
      var s = String(v == null ? '' : v);
      if (s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }

    var row1 = headers.map(csvEscape).join(',');
    var row2 = values.map(csvEscape).join(',');
    var csv = row1 + '\r\n' + row2 + '\r\n';

    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'herohealth_' + MODE_KEY + '_' + Date.now() + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 0);
  }

  // ---------- Rank & Summary ----------
  function computeRank() {
    var missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET;
    var r = 'C';
    if (!missionSuccess) {
      if (score < 120) r = 'D';
      else r = 'C';
    } else {
      if (score >= 600 || maxCombo >= 12) r = 'S';
      else if (score >= 450 || maxCombo >= 9) r = 'A';
      else if (score >= 320 || maxCombo >= 7) r = 'B';
      else r = 'C';
    }
    return { rank: r, success: missionSuccess };
  }

  function renderSummary() {
    var fs = $('#hha-final-score');
    var fc = $('#hha-final-combo');
    var fg = $('#hha-final-good');
    if (fs) fs.textContent = String(score);
    if (fc) fc.textContent = String(maxCombo);
    if (fg) fg.textContent = String(missionGoodCount);

    var rankInfo = computeRank();
    var rankBadge = $('#hha-rank-badge');
    if (rankBadge) {
      rankBadge.textContent = rankInfo.rank;
      if (rankInfo.rank === 'S') {
        rankBadge.style.background = 'linear-gradient(135deg,#f97316,#facc15)';
      } else if (rankInfo.rank === 'A') {
        rankBadge.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
      } else if (rankInfo.rank === 'B') {
        rankBadge.style.background = 'linear-gradient(135deg,#38bdf8,#2563eb)';
      } else if (rankInfo.rank === 'C') {
        rankBadge.style.background = 'linear-gradient(135deg,#64748b,#475569)';
      } else {
        rankBadge.style.background = 'linear-gradient(135deg,#4b5563,#111827)';
      }
    }

    var goalBox = $('#hha-result-goals');
    if (goalBox) {
      var html = '';
      var key;
      for (key in goalStatus) {
        if (!Object.prototype.hasOwnProperty.call(goalStatus, key)) continue;
        var g = goalStatus[key];
        var ok = g.status === 'done';
        var icon = ok ? '✅' : '⬜';
        html += '<div>' + icon + ' ' + g.label + ' (' + g.value + '/' + g.target + ')</div>';
      }
      goalBox.innerHTML = html || '<div>ยังไม่มี Goal เฉพาะโหมดนี้</div>';
    }

    var questBox = $('#hha-result-quests');
    if (questBox) {
      var qhtml = '';
      var id;
      for (id in questState) {
        if (!Object.prototype.hasOwnProperty.call(questState, id)) continue;
        var qs = questState[id];
        var qIcon = qs.icon || '🎯';
        var qDef;
        var i;
        for (i = 0; i < QUESTS.length; i++) {
          if (QUESTS[i].id === id) { qDef = QUESTS[i]; break; }
        }
        var text = (qDef && qDef.text) ? qDef.text : id;
        if (qs.status === 'done') {
          qhtml += '<div>✅ ' + qIcon + ' ' + text + '</div>';
        } else {
          qhtml += '<div>⬜ ' + qIcon + ' ' + text + '</div>';
        }
      }
      questBox.innerHTML = qhtml || '<div>ยังไม่มี Mini Quest สำหรับโหมดนี้</div>';
    }

    var titleEl = $('#hha-result-title');
    if (titleEl) {
      titleEl.textContent = rankInfo.success
        ? 'ภารกิจสำเร็จ! 🎉'
        : 'ยังไม่ผ่านภารกิจ ลองอีกทีนะ 💪';
    }
  }

  // ---------- Game Control ----------
  function startGame() {
    if (running) return;
    running = true;
    isPaused = false;

    score = 0;
    combo = 0;
    maxCombo = 0;
    timeLeft = GAME_DURATION;
    missionGoodCount = 0;
    activeItems = 0;
    shieldCharges = 0;
    feverTicksLeft = 0;
    totalGoodHits = 0;
    totalJunkHits = 0;
    totalPowerHits = 0;
    totalFeverEnter = 0;
    firstHitTs = null;

    initGoalStatus();
    initQuestState();
    renderQuestChips();
    updateHUD();

    createHost();
    createFXLayer();
    ensureGameCSS();
    scheduleTimers();
  }

  function endGame() {
    if (!running) return;
    running = false;
    stopTimers();
    updateHUD();
    renderSummary();
    var result = $('#hha-result');
    if (result) result.style.display = 'flex';
  }

  // ---------- Bootstrap ----------
  function bootstrap() {
    ensureGameCSS();
    createHUD();
    createHost();
    createFXLayer();
    initGoalStatus();
    initQuestState();
    renderQuestChips();
    updateHUD();

    var restartBtn = $('#hha-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        var panel = $('#hha-result');
        if (panel) panel.style.display = 'none';
        startGame();
      });
    }

    var csvBtn = $('#hha-download-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        downloadCSV();
      });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pauseGame('hidden');
      } else {
        resumeGame('visible');
      }
    });

    startGame();

    console.log('[HHA engine] bootstrap complete.', {
      mode: MODE_KEY,
      diff: DIFF,
      duration: GAME_DURATION
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

})();
