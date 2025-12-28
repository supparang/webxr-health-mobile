/* === /herohealth/plate/plate.safe.js ===
Balanced Plate VR — SAFE (PRODUCTION) — HHA Standard (FULL + FLUSH-HARDENED + Satisfying Pack)
- IIFE (NO export) ✅ fixes "Unexpected token 'export'"
- catch(e) everywhere ✅ avoids "Unexpected token 'catch'" on older parsers
- HHA Standard: goal+mini chain, deterministic seed, end summary, last summary, rank SSS..C
- FUN PACK: Storm waves + danger FX (tick/beep + flash + edge shake), Decoy/Trap, Boss + Laser dodge via world-shift, Perfect/Critical, ⭐⭐ Overdrive x2
- Goal3 gate: accuracyGoodPct >= 88%
- Flush-hardened: before HUB/end/retry/pagehide/visibility/beforeunload
*/

(function (root) {
  'use strict';

  var DOC = root.document;
  if (!DOC) return;

  // --------------------------- Root modules ---------------------------
  var Particles = (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || {
    scorePop: function(){},
    burstAt: function(){},
    celebrate: function(){}
  };

  // FeverUI is optional — we still keep our own fever/shield logic
  var FeverUI = (root.GAME_MODULES && root.GAME_MODULES.FeverUI) || root.FeverUI || null;

  // Optional cloud logger (any of these names)
  function getLogger(){
    return (root.GAME_MODULES && (root.GAME_MODULES.CloudLogger || root.GAME_MODULES.Logger)) ||
           root.HHACloudLogger || root.hhaCloudLogger || root.HHA_LOGGER || null;
  }

  function emit(name, detail){
    try { root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (e) {}
  }

  function nowMs(){
    return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
  }

  function clamp(v,a,b){
    v = Number(v);
    if (!Number.isFinite(v)) v = 0;
    return v < a ? a : (v > b ? b : v);
  }

  function qs(name, def){
    try {
      var u = new URL(root.location.href);
      var v = u.searchParams.get(name);
      return (v === null || v === undefined) ? def : v;
    } catch (e) {
      return def;
    }
  }

  function intQ(name, def){
    var v = parseInt(qs(name, def), 10);
    return Number.isFinite(v) ? v : def;
  }

  // --------------------------- Seeded RNG ---------------------------
  function xmur3(str){
    str = String(str || 'seed');
    var h = 1779033703 ^ str.length;
    for (var i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return (h >>> 0);
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return ((t >>> 0) / 4294967296);
    };
  }
  function makeRng(seed){
    var gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }

  // --------------------------- Layer ---------------------------
  var layer = DOC.getElementById('plate-layer') || DOC.querySelector('.plate-layer') || DOC.querySelector('#plateLayer');
  if (!layer) return;

  // --------------------------- Simple SFX (WebAudio) ---------------------------
  var SFX = {
    ctx: null,
    nextTickAt: 0,
    ensure: function(){
      if (this.ctx) return this.ctx;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); return this.ctx; } catch (e) { return null; }
    },
    beep: function(freq, dur, gain){
      var ctx = this.ensure();
      if (!ctx) return;
      try{
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.value = 0.0001;
        o.connect(g); g.connect(ctx.destination);
        var t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain || 0.05), t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.06));
        o.start(t0);
        o.stop(t0 + (dur || 0.06) + 0.02);
      } catch (e) {}
    },
    good: function(){ this.beep(680, 0.045, 0.040); },
    bad: function(){ this.beep(220, 0.070, 0.055); },
    perfect: function(){ this.beep(980, 0.055, 0.050); this.beep(1240, 0.050, 0.045); },
    power: function(){ this.beep(820, 0.070, 0.050); this.beep(1040, 0.060, 0.045); },
    tick: function(leftMs){
      var t = nowMs();
      if (t < this.nextTickAt) return;
      var left = Math.max(0, leftMs|0);
      var rate = (left <= 1200) ? 85 : (left <= 2200 ? 135 : 210);
      this.nextTickAt = t + rate;
      this.beep(980, 0.045, 0.045);
    }
  };

  // --------------------------- Spawn Rect (avoid HUD) ---------------------------
  function safeRect(){
    var W = root.innerWidth || 360;
    var H = root.innerHeight || 640;

    // Conservative: avoid HUD top + bottom + sides
    var top = 160;
    var bot = 180;
    var side = 16;

    // If mobile single-column HUD, give more top
    if (W < 760) top = 260;

    return { W:W, H:H, x0:side, x1:W-side, y0:top, y1:H-bot };
  }

  function randPos(rng){
    var r = safeRect();
    var x = r.x0 + rng() * (r.x1 - r.x0);
    var y = r.y0 + rng() * (r.y1 - r.y0);
    return { x:x, y:y };
  }

  // --------------------------- Food sets (Plate portions) ---------------------------
  var FOOD = {
    veg:   { key:'veg',   label:'ผัก',     emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    fruit: { key:'fruit', label:'ผลไม้',   emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    prot:  { key:'prot',  label:'โปรตีน',  emoji:['🐟','🍗','🥚','🥜','🫘','🥛'] },
    grain: { key:'grain', label:'แป้ง',    emoji:['🍚','🍞','🍜','🥔','🍠','🥖'] }
  };

  var JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  var DECOY = ['🎭','🌀','✨','🌈','🎈'];

  function pick(rng, arr){
    if (!arr || !arr.length) return '';
    return arr[(rng() * arr.length) | 0];
  }

  // --------------------------- Difficulty ---------------------------
  function diffParams(diff){
    diff = String(diff || 'normal').toLowerCase();
    if (diff === 'easy'){
      return { spawnMs: 920, ttl: 1800, size: 1.06, junk: 0.10, decoy: 0.08, stormDur: 6, bossHp: 3 };
    }
    if (diff === 'hard'){
      return { spawnMs: 690, ttl: 1480, size: 0.92, junk: 0.16, decoy: 0.12, stormDur: 7, bossHp: 4 };
    }
    return { spawnMs: 790, ttl: 1620, size: 1.00, junk: 0.12, decoy: 0.10, stormDur: 6, bossHp: 3 };
  }

  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // --------------------------- Engine state ---------------------------
  var engine = {
    running:false,
    ended:false,

    runMode:'play',
    diff:'normal',
    timeSec:90,
    seed:'seed',
    rng: Math.random,

    left:90,

    score:0,
    combo:0,
    comboMax:0,
    misses:0,

    nSpawnGood:0,
    nSpawnJunk:0,
    nSpawnDecoy:0,
    nSpawnStar:0,
    nSpawnBoss:0,

    nHitGood:0,
    nHitJunk:0,
    nHitDecoy:0,
    nHitBoss:0,

    fever: 0,      // 0..100
    shield: 0,     // 0/1 blocks next junk/hazard hit

    ttlMs:1600,
    sizeBase:1.0,

    // plate counters
    plate: { veg:0, fruit:0, prot:0, grain:0 },
    plateNeed: { veg:5, fruit:3, prot:4, grain:4 }, // total 16 (tuned for 90s)

    // adaptive (play only)
    adapt: { spawnMs:790, ttl:1620, size:1.0, junk:0.12, decoy:0.10, bossEvery: 19000 },

    // view shift
    vx:0, vy:0,
    dragOn:false, dragX:0, dragY:0,

    // storm
    storm:false,
    stormUntil:0,
    nextStormAt:0,
    stormDurSec:6,

    // boss + hazard laser
    bossAlive:false,
    bossHp:0,
    bossHpMax:3,
    nextBossAt:0,
    laser: { on:false, y:0, h:24, warnUntil:0, until:0 },

    // ⭐⭐ overdrive x2
    overCharge:0,
    overWindowUntil:0,
    overUntil:0,

    // timers
    spawnTimer:0,
    tickTimer:0,
    hazardTimer:0,

    // perf
    startMs:0
  };

  function scoreMult(){
    return (nowMs() < engine.overUntil) ? 2 : 1;
  }

  function accPct(){
    var denom = engine.nHitGood + engine.nHitJunk + engine.nHitDecoy;
    if (denom <= 0) return 0;
    return Math.round((engine.nHitGood / denom) * 100);
  }

  function updateScore(){
    emit('hha:score', {
      score: engine.score|0,
      combo: engine.combo|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0
    });
    emit('hha:rank', { grade: rankFromAcc(accPct()), accuracy: accPct() });
  }
  function updateTime(){
    emit('hha:time', { left: engine.left|0 });
  }

  // --------------------------- World-shift feel (drag + gyro) ---------------------------
  function applyView(){
    layer.style.setProperty('--vx', engine.vx.toFixed(1) + 'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1) + 'px');
    // also apply transform directly (in case CSS not set)
    layer.style.transform = 'translate(' + engine.vx.toFixed(1) + 'px,' + engine.vy.toFixed(1) + 'px)';
  }

  function setupView(){
    layer.style.willChange = 'transform';

    layer.addEventListener('pointerdown', function(e){
      engine.dragOn = true;
      engine.dragX = e.clientX;
      engine.dragY = e.clientY;
    }, { passive:true });

    root.addEventListener('pointermove', function(e){
      if (!engine.dragOn) return;
      var dx = e.clientX - engine.dragX;
      var dy = e.clientY - engine.dragY;
      engine.dragX = e.clientX;
      engine.dragY = e.clientY;
      engine.vx = clamp(engine.vx + dx * 0.22, -95, 95);
      engine.vy = clamp(engine.vy + dy * 0.22, -95, 95);
      applyView();
    }, { passive:true });

    root.addEventListener('pointerup', function(){
      engine.dragOn = false;
    }, { passive:true });

    root.addEventListener('deviceorientation', function(ev){
      var gx = Number(ev.gamma) || 0;
      var gy = Number(ev.beta) || 0;
      engine.vx = clamp(engine.vx + gx * 0.06, -95, 95);
      engine.vy = clamp(engine.vy + (gy - 20) * 0.02, -95, 95);
      applyView();
    }, { passive:true });
  }

  // --------------------------- Target DOM helpers ---------------------------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1) + 'px');
    el.style.setProperty('--y', y.toFixed(1) + 'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }
  function getXY(el){
    var x = Number(el.dataset._x);
    var y = Number(el.dataset._y);
    if (Number.isFinite(x) && Number.isFinite(y)) return {x:x, y:y};
    var sx = (el.style.getPropertyValue('--x') || '').trim().replace('px','');
    var sy = (el.style.getPropertyValue('--y') || '').trim().replace('px','');
    return { x: Number(sx) || 0, y: Number(sy) || 0 };
  }

  function mkEl(tag, cls){
    var el = DOC.createElement(tag);
    el.className = cls;
    return el;
  }

  // Minimal CSS for targets if you don't have external css
  (function ensureLocalCSS(){
    if (DOC.getElementById('plate-safe-css')) return;
    var st = DOC.createElement('style');
    st.id = 'plate-safe-css';
    st.textContent =
      '#plate-layer{position:fixed;inset:0;z-index:2;}' +
      '.pl-target{position:absolute;left:var(--x);top:var(--y);transform:translate(-50%,-50%) scale(var(--s,1));' +
      'width:74px;height:74px;border-radius:999px;display:flex;align-items:center;justify-content:center;' +
      'font-size:36px;cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;' +
      'background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.18);' +
      'box-shadow:0 18px 70px rgba(0,0,0,.35), inset 0 0 0 1px rgba(148,163,184,.06);' +
      'backdrop-filter:blur(8px);' +
      '}' +
      '.pl-good{border-color:rgba(34,197,94,.28);box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 18px rgba(34,197,94,.12);}' +
      '.pl-junk{border-color:rgba(239,68,68,.30);box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 18px rgba(239,68,68,.14);}' +
      '.pl-decoy{border-color:rgba(245,158,11,.28);box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 18px rgba(245,158,11,.12);}' +
      '.pl-star{border-color:rgba(34,211,238,.30);box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 22px rgba(34,211,238,.14);}' +
      '.pl-boss{width:92px;height:92px;font-size:42px;border-color:rgba(167,139,250,.28);box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 26px rgba(167,139,250,.14);}' +
      '.pl-target.hit{transform:translate(-50%,-50%) scale(calc(var(--s,1) * 1.06));filter:brightness(1.22);opacity:.92;}' +
      '.pl-target.out{opacity:0;transform:translate(-50%,-50%) scale(calc(var(--s,1) * 0.90));transition:opacity .18s ease, transform .18s ease;}' +
      '.plate-storm .pl-target{filter:saturate(1.25) contrast(1.05);}' +
      '.plate-storm-urgent{animation:plateUrg .14s linear infinite;}' +
      '@keyframes plateUrg{0%{filter:brightness(1)}50%{filter:brightness(1.08)}100%{filter:brightness(1)}}' +
      '.plate-overdrive .pl-target{box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 26px rgba(34,197,94,.18);}' +
      '.plate-shake{animation:plateShake .16s ease-in-out 1;}' +
      '@keyframes plateShake{0%{transform:translate(0,0)}25%{transform:translate(2px,-1px)}50%{transform:translate(-2px,1px)}75%{transform:translate(1px,2px)}100%{transform:translate(0,0)}}' +
      '.plate-laser{position:absolute;left:50%;top:var(--ly);transform:translate(-50%,-50%);width: min(92vw, 860px);height: var(--lh);' +
      'border-radius:999px;background:linear-gradient(90deg, rgba(239,68,68,.0), rgba(239,68,68,.55), rgba(239,68,68,.0));' +
      'box-shadow:0 0 24px rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.22);opacity:.92;pointer-events:none;}' +
      '.plate-laser.warn{opacity:.55;filter:saturate(1.2);}';
    DOC.head.appendChild(st);
  })();

  function logEvent(type, data){
    // Fire a standard event (cloud logger can listen)
    emit('hha:log_event', { type: type, data: data || {} });

    // If there is a logger object, try to pass it too
    var L = getLogger();
    try{
      if (L && typeof L.logEvent === 'function') L.logEvent(type, data || {});
      else if (L && typeof L.push === 'function') L.push({ type:type, data:data||{} });
    } catch (e) {}
  }

  // --------------------------- Quest Director (Goals sequential + Minis chain) ---------------------------
  var Quest = (function(){
    // Concept 1-5 mapping for Plate:
    // 1) Fill plate counts (balanced target amounts)
    // 2) Keep ratio within tolerance (no extreme skew)
    // 3) Accuracy gate >= 88%  ✅ per user
    // 4) Survive Storm + avoid junk
    // 5) Beat Boss + dodge Laser (world-shift)

    var goals = [
      { id:'goal1', title:'เติมจานให้ครบ (ครบตามสัดส่วน)', kind:'fill_plate' },
      { id:'goal2', title:'สัดส่วนต้อง “บาลานซ์”', kind:'balance_ratio' },
      { id:'goal3', title:'ความแม่นยำ ≥ 88%', kind:'acc_gate_88' }
    ];

    // Minis are deterministic chain (equal exposure => “เฉลี่ยเท่า ๆ กัน”)
    var minis = [
      { id:'mini_rush',  title:'Plate Rush: ครบ 5 ใน 8 วิ และห้ามโดนขยะ', kind:'rush', total:5, ms:8000, noJunk:true },
      { id:'mini_clean', title:'Clean Streak: 10 วิห้าม MISS/โดนขยะ', kind:'clean', ms:10000 },
      { id:'mini_perfect', title:'Perfect x3: ยิงเร็วจัด 3 ครั้ง', kind:'perfect3', total:3, ms:9000 },
      { id:'mini_storm', title:'Storm Survivor: รอด Storm 1 รอบแบบไม่พลาด', kind:'storm_survive', total:1 },
      { id:'mini_star2', title:'Double Star: เก็บ ⭐ ให้ครบ 2 ใน 8 วิ', kind:'star2', total:2, ms:8000 },
      { id:'mini_laser', title:'Laser Dodge: หลบเลเซอร์ 2 ครั้งติด', kind:'laser2', total:2, ms:12000 },
      { id:'mini_boss',  title:'Boss Down: ล้มบอส 1 ตัว', kind:'boss_down', total:1 }
    ];

    var st = {
      goalIndex: 0,
      miniIndex: 0,

      goalsCleared: 0,
      minisCleared: 0,

      activeGoal: null,
      activeMini: null,

      miniNow: 0,
      miniTotal: 0,
      miniEndAt: 0,
      miniFailHard: false
    };

    function goal(){ return st.activeGoal; }
    function mini(){ return st.activeMini; }

    function reset(){
      st.goalIndex = 0;
      st.miniIndex = 0;
      st.goalsCleared = 0;
      st.minisCleared = 0;
      st.activeGoal = goals[0];
      st.activeMini = null;
      st.miniNow = 0;
      st.miniTotal = 0;
      st.miniEndAt = 0;
      st.miniFailHard = false;
      pushUpdate();
    }

    function pushUpdate(extra){
      var g = st.activeGoal || goals[0];
      var m = st.activeMini;

      emit('quest:update', {
        goalTitle: g ? g.title : '—',
        goalNow: st.goalsCleared|0,
        goalTotal: goals.length,

        miniTitle: m ? m.title : '—',
        miniNow: st.miniNow|0,
        miniTotal: st.miniTotal|0,
        miniLeftMs: (m && st.miniEndAt) ? Math.max(0, st.miniEndAt - nowMs()) : 0,

        extra: extra || {}
      });
    }

    function startMini(idx){
      var m = minis[idx];
      if (!m) return false;
      st.activeMini = m;
      st.miniNow = 0;
      st.miniTotal = (m.total != null) ? (m.total|0) : 1;
      st.miniEndAt = (m.ms != null) ? (nowMs() + (m.ms|0)) : 0;
      st.miniFailHard = false;

      logEvent('mini_start', { miniId:m.id, title:m.title });
      emit('hha:judge', { kind:'good', text:'MINI START!' });
      emit('hha:celebrate', { kind:'mini', title:m.title });

      pushUpdate({ miniStart:true });
      return true;
    }

    function clearMini(){
      var m = st.activeMini;
      if (!m) return;

      st.minisCleared++;
      logEvent('mini_clear', { miniId:m.id, title:m.title });

      emit('hha:judge', { kind:'good', text:'MINI CLEAR!' });
      emit('hha:celebrate', { kind:'mini', title:'MINI CLEAR!' });

      st.activeMini = null;
      st.miniNow = 0;
      st.miniTotal = 0;
      st.miniEndAt = 0;
      st.miniFailHard = false;

      // Next mini (chain) if we still have time
      st.miniIndex++;
      pushUpdate({ miniEnd:true });

      // Start next mini after a short beat (feels good)
      root.setTimeout(function(){
        if (!engine.running || engine.ended) return;
        if (st.miniIndex < minis.length) startMini(st.miniIndex);
      }, 650);
    }

    function failMini(reason){
      var m = st.activeMini;
      if (!m) return;

      logEvent('mini_fail', { miniId:m.id, reason: String(reason||'fail') });

      emit('hha:judge', { kind:'warn', text:'MINI FAIL!' });
      Particles.burstAt(safeRect().W*0.5, safeRect().H*0.55, 'warn');

      st.activeMini = null;
      st.miniNow = 0;
      st.miniTotal = 0;
      st.miniEndAt = 0;
      st.miniFailHard = false;

      // Continue chain (but you lost one)
      st.miniIndex++;
      pushUpdate({ miniEnd:true });

      root.setTimeout(function(){
        if (!engine.running || engine.ended) return;
        if (st.miniIndex < minis.length) startMini(st.miniIndex);
      }, 650);
    }

    function clearGoal(){
      var g = st.activeGoal;
      if (!g) return;

      st.goalsCleared++;
      logEvent('goal_clear', { goalId:g.id, title:g.title });

      emit('hha:judge', { kind:'good', text:'GOAL CLEAR!' });
      emit('hha:celebrate', { kind:'goal', title:g.title });

      st.goalIndex++;
      st.activeGoal = (st.goalIndex < goals.length) ? goals[st.goalIndex] : null;
      pushUpdate({ goalEnd:true });

      if (!st.activeGoal){
        emit('hha:celebrate', { kind:'all', title:'ALL GOALS COMPLETE!' });
      }
    }

    function getState(){
      return {
        goalsCleared: st.goalsCleared|0,
        goalsTotal: goals.length,
        miniCleared: st.minisCleared|0,
        miniTotal: minis.length
      };
    }

    // Called by engine on relevant events
    function onTick(){
      var m = st.activeMini;
      if (m && st.miniEndAt && nowMs() >= st.miniEndAt){
        failMini('timeout');
      }
      pushUpdate();
    }

    function onGoodHit(meta){
      // Mini tracking
      var m = st.activeMini;
      if (m){
        if (m.kind === 'rush'){
          st.miniNow++;
          if (st.miniNow >= st.miniTotal) clearMini();
        } else if (m.kind === 'perfect3'){
          if (meta && meta.perfect) {
            st.miniNow++;
            if (st.miniNow >= st.miniTotal) clearMini();
          }
        }
      }

      // Goal tracking
      var g = st.activeGoal;
      if (!g) return;

      if (g.kind === 'fill_plate'){
        if (plateFilled()) clearGoal();
      } else if (g.kind === 'balance_ratio'){
        if (plateFilled() && plateBalanced()) clearGoal();
      } else if (g.kind === 'acc_gate_88'){
        if (plateFilled() && plateBalanced() && accPct() >= 88) clearGoal();
      }
    }

    function onBadHit(meta){
      var m = st.activeMini;
      if (!m) return;

      if (m.kind === 'rush' && m.noJunk){
        failMini('junk_in_rush');
      } else if (m.kind === 'clean'){
        failMini('broke_clean');
      } else if (m.kind === 'storm_survive'){
        failMini('storm_miss');
      }
    }

    function onStormEnd(clean){
      var m = st.activeMini;
      if (m && m.kind === 'storm_survive'){
        if (clean) clearMini();
        else failMini('storm_not_clean');
      }
    }

    function onStar(){
      var m = st.activeMini;
      if (!m) return;
      if (m.kind === 'star2'){
        st.miniNow++;
        if (st.miniNow >= st.miniTotal) clearMini();
      }
    }

    function onLaserDodged(){
      var m = st.activeMini;
      if (!m) return;
      if (m.kind === 'laser2'){
        st.miniNow++;
        if (st.miniNow >= st.miniTotal) clearMini();
      }
    }

    function onBossDown(){
      var m = st.activeMini;
      if (!m) return;
      if (m.kind === 'boss_down'){
        st.miniNow = 1;
        clearMini();
      }
    }

    function startAll(){
      reset();
      st.miniIndex = 0;
      startMini(0);
    }

    // Plate utilities (read engine state)
    function plateFilled(){
      var need = engine.plateNeed;
      var p = engine.plate;
      return (p.veg >= need.veg && p.fruit >= need.fruit && p.prot >= need.prot && p.grain >= need.grain);
    }

    function plateBalanced(){
      // Balance rule: no category exceeds others by too much once filled
      // Use normalized ratio distance to target proportions: veg 5, fruit 3, prot 4, grain 4
      var need = engine.plateNeed;
      var p = engine.plate;

      // if not close to filled, don't gate too early
      var totalNeed = need.veg + need.fruit + need.prot + need.grain;
      var totalNow = p.veg + p.fruit + p.prot + p.grain;
      if (totalNow < Math.floor(totalNeed * 0.75)) return false;

      function dist(now, target){
        var t = Math.max(1, target);
        return Math.abs(now - target) / t;
      }
      var d = dist(p.veg, need.veg) + dist(p.fruit, need.fruit) + dist(p.prot, need.prot) + dist(p.grain, need.grain);
      // tuned tolerance
      return d <= 1.15;
    }

    return {
      reset: reset,
      startAll: startAll,
      onTick: onTick,
      onGoodHit: onGoodHit,
      onBadHit: onBadHit,
      onStormEnd: onStormEnd,
      onStar: onStar,
      onLaserDodged: onLaserDodged,
      onBossDown: onBossDown,
      getState: getState
    };
  })();

  // --------------------------- Fever / Shield logic ---------------------------
  function addFever(delta){
    engine.fever = clamp(engine.fever + (delta|0), 0, 100);

    // sync optional UI
    try{
      if (FeverUI && typeof FeverUI.set === 'function') FeverUI.set(engine.fever);
      if (FeverUI && typeof FeverUI.setFever === 'function') FeverUI.setFever(engine.fever);
    } catch (e) {}

    if (engine.fever >= 100){
      engine.shield = 1;
      engine.fever = 42;
      emit('hha:judge', { kind:'good', text:'SHIELD READY!' });
      emit('hha:celebrate', { kind:'mini', title:'🛡️ SHIELD READY!' });
      SFX.power();
    }
  }

  // --------------------------- Spawn / Types ---------------------------
  function chooseType(){
    var base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;

    var j = clamp(base.junk + (engine.storm ? 0.05 : 0), 0.06, 0.30);
    var d = clamp(base.decoy + (engine.storm ? 0.03 : 0), 0.05, 0.25);

    // Powerup chance
    var pu = engine.storm ? 0.020 : 0.012;
    if (engine.rng() < pu) return 'star';

    // Boss occasional (engine spawns separately)

    var r = engine.rng();
    if (r < j) return 'junk';
    if (r < j + d) return 'decoy';
    return 'good';
  }

  function chooseGoodKind(){
    // weighted to encourage balance (pull toward missing portions)
    var need = engine.plateNeed;
    var p = engine.plate;

    var weights = [
      {k:'veg',   w: Math.max(0.15, (need.veg   - p.veg)   / Math.max(1, need.veg))},
      {k:'fruit', w: Math.max(0.15, (need.fruit - p.fruit) / Math.max(1, need.fruit))},
      {k:'prot',  w: Math.max(0.15, (need.prot  - p.prot)  / Math.max(1, need.prot))},
      {k:'grain', w: Math.max(0.15, (need.grain - p.grain) / Math.max(1, need.grain))}
    ];
    // normalize
    var sum = 0;
    for (var i=0;i<weights.length;i++) sum += weights[i].w;
    var t = engine.rng() * sum;
    var acc = 0;
    for (var j=0;j<weights.length;j++){
      acc += weights[j].w;
      if (t <= acc) return weights[j].k;
    }
    return 'veg';
  }

  function makeTarget(tp, meta, x, y, s){
    var el = mkEl('div', 'pl-target');
    el.dataset.type = tp;

    el.style.setProperty('--s', s.toFixed(3));
    setXY(el, x, y);

    el._spawnAt = nowMs();

    if (tp === 'good'){
      var kind = meta && meta.kind ? meta.kind : 'veg';
      el.dataset.kind = kind;
      el.dataset.emoji = pick(engine.rng, FOOD[kind].emoji);
      el.classList.add('pl-good');
      el.textContent = el.dataset.emoji;
    } else if (tp === 'junk'){
      el.dataset.emoji = pick(engine.rng, JUNK);
      el.classList.add('pl-junk');
      el.textContent = el.dataset.emoji;
    } else if (tp === 'decoy'){
      el.dataset.emoji = pick(engine.rng, DECOY);
      el.classList.add('pl-decoy');
      el.textContent = el.dataset.emoji;
    } else if (tp === 'star'){
      el.dataset.emoji = '⭐';
      el.classList.add('pl-star');
      el.textContent = '⭐';
    } else if (tp === 'boss'){
      el.dataset.emoji = '👑';
      el.classList.add('pl-boss');
      el.textContent = '👑';
      el.dataset.hp = String(meta && meta.hp ? meta.hp : 3);
    }

    // TTL
    var ttlBase = engine.ttlMs;
    var ttl = engine.storm ? Math.max(880, ttlBase * 0.85) : ttlBase;

    el._ttlTimer = root.setTimeout(function(){
      if (!el.isConnected) return;

      // Expire miss only for GOOD
      if (tp === 'good'){
        engine.misses++;
        engine.combo = 0;
        emit('hha:judge', { kind:'warn', text:'MISS!' });
        Particles.burstAt(safeRect().W*0.5, safeRect().H*0.55, 'warn');
        addFever(-10);
        updateScore();
        logEvent('miss_expire', { kind: el.dataset.kind || '', emoji: el.dataset.emoji || '' });

        // Mini/goal penalty
        Quest.onBadHit({ reason:'expire' });
      }

      el.classList.add('out');
      root.setTimeout(function(){ try{ el.remove(); } catch(e){} }, 220);
    }, ttl);

    el.addEventListener('pointerdown', function(ev){
      try { ev.preventDefault(); } catch (e) {}
      hitTarget(el);
    }, { passive:false });

    return el;
  }

  function removeTarget(el){
    try { root.clearTimeout(el._ttlTimer); } catch (e) {}
    el.classList.add('hit');
    root.setTimeout(function(){
      try { el.remove(); } catch (e) {}
    }, 180);
  }

  // --------------------------- Overdrive (⭐⭐ => x2 for 5s) ---------------------------
  function activateOverdrive(){
    engine.overUntil = nowMs() + 5000;
    DOC.body.classList.add('plate-overdrive');
    SFX.power();
    emit('hha:celebrate', { kind:'goal', title:'OVERDRIVE x2!' });

    root.setTimeout(function(){
      if (nowMs() >= engine.overUntil){
        DOC.body.classList.remove('plate-overdrive');
      }
    }, 5100);
  }

  function onStarCollected(){
    var t = nowMs();

    if (t > engine.overWindowUntil){
      engine.overCharge = 0;
      engine.overWindowUntil = t + 8000;
    }
    engine.overCharge++;

    Quest.onStar();

    if (engine.overCharge >= 2){
      engine.overCharge = 0;
      engine.overWindowUntil = 0;
      activateOverdrive();
    }
  }

  // --------------------------- Storm waves + danger FX ---------------------------
  function enterStorm(){
    engine.storm = true;
    engine.stormUntil = nowMs() + engine.stormDurSec * 1000;
    DOC.body.classList.add('plate-storm');
    emit('plate:storm', { on:true, durSec: engine.stormDurSec|0 });
    logEvent('storm_start', { durSec: engine.stormDurSec|0 });

    if (engine.runMode === 'play'){
      engine.adapt.spawnMs = Math.max(430, engine.adapt.spawnMs * 0.78);
      engine.adapt.size = Math.max(0.82, engine.adapt.size * 0.94);
      engine.adapt.junk = clamp(engine.adapt.junk + 0.05, 0.08, 0.25);
      engine.adapt.decoy = clamp(engine.adapt.decoy + 0.03, 0.06, 0.22);
    }
  }

  function exitStorm(clean){
    engine.storm = false;
    engine.stormUntil = 0;
    DOC.body.classList.remove('plate-storm');
    DOC.body.classList.remove('plate-storm-urgent');
    emit('plate:storm', { on:false, durSec:0 });
    logEvent('storm_end', { clean: !!clean });

    // Mini storm-survive check
    Quest.onStormEnd(!!clean);
  }

  function maybeStormTick(){
    if (!engine.storm) return;
    var leftMs = engine.stormUntil - nowMs();
    if (leftMs <= 0){
      DOC.body.classList.remove('plate-storm-urgent');
      exitStorm(true);
      engine.nextStormAt = nowMs() + (15000 + engine.rng() * 12000);
      return;
    }

    // danger zone: last 3.2s
    if (leftMs <= 3200){
      DOC.body.classList.add('plate-storm-urgent');
      SFX.tick(leftMs);
      // subtle edge shake
      if (leftMs <= 1200){
        DOC.body.classList.add('plate-shake');
        root.setTimeout(function(){ DOC.body.classList.remove('plate-shake'); }, 180);
      }
    } else {
      DOC.body.classList.remove('plate-storm-urgent');
    }
  }

  // --------------------------- Boss + Laser hazard (dodge via world-shift) ---------------------------
  var laserEl = null;
  function ensureLaser(){
    if (laserEl) return laserEl;
    laserEl = mkEl('div', 'plate-laser warn');
    laserEl.style.setProperty('--ly', '50%');
    laserEl.style.setProperty('--lh', '24px');
    layer.appendChild(laserEl);
    laserEl.style.display = 'none';
    return laserEl;
  }

  function scheduleLaser(){
    // laser appears more in storm / when boss alive
    var base = engine.storm ? 4600 : 6200;
    var jitter = engine.rng() * 2800;
    try { root.clearTimeout(engine.hazardTimer); } catch(e) {}
    engine.hazardTimer = root.setTimeout(function(){
      if (!engine.running || engine.ended) return;
      startLaser();
      scheduleLaser();
    }, base + jitter);
  }

  function startLaser(){
    var r = safeRect();
    var y = r.y0 + engine.rng() * (r.y1 - r.y0);
    var h = engine.storm ? 26 : 22;

    engine.laser.on = true;
    engine.laser.y = y;
    engine.laser.h = h;
    engine.laser.warnUntil = nowMs() + 520;
    engine.laser.until = nowMs() + 1150;

    var el = ensureLaser();
    el.style.display = '';
    el.classList.add('warn');
    el.style.setProperty('--ly', y.toFixed(1) + 'px');
    el.style.setProperty('--lh', h.toFixed(1) + 'px');

    logEvent('hazard_spawn', { kind:'laser', y:y });

    // warning beep
    SFX.beep(520, 0.05, 0.04);
  }

  function stopLaser(){
    engine.laser.on = false;
    var el = ensureLaser();
    el.style.display = 'none';
    el.classList.remove('warn');
  }

  function checkLaserHit(){
    if (!engine.laser.on) return;

    var t = nowMs();
    var el = ensureLaser();

    if (t < engine.laser.warnUntil){
      el.classList.add('warn');
      return;
    }
    el.classList.remove('warn');

    if (t >= engine.laser.until){
      // if survived (didn't get hit during active), count dodge
      Quest.onLaserDodged();
      stopLaser();
      return;
    }

    // ACTIVE: compute crosshair (screen center) vs laser bar position (shifted with world)
    // laser lives inside layer; since layer is translated by vx/vy, effective laser center is y + vy.
    var r = safeRect();
    var cx = r.W * 0.5;
    var cy = r.H * 0.5;

    var ly = engine.laser.y + engine.vy; // shift affects hazard relative to center
    var distY = Math.abs(cy - ly);

    if (distY <= (engine.laser.h * 0.5)){
      // hit by laser
      if (engine.shield > 0){
        engine.shield = 0;
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        logEvent('shield_block', { kind:'laser' });
        stopLaser();
        return;
      }

      engine.misses++;
      engine.combo = 0;
      addFever(-16);

      emit('hha:judge', { kind:'bad', text:'LASER HIT!' });
      DOC.body.classList.add('plate-shake');
      root.setTimeout(function(){ DOC.body.classList.remove('plate-shake'); }, 220);

      SFX.bad();
      logEvent('hazard_hit', { kind:'laser' });

      // Mini penalty
      Quest.onBadHit({ reason:'laser' });

      updateScore();
      stopLaser();
    }
  }

  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (nowMs() < engine.nextBossAt) return;

    engine.bossAlive = true;
    engine.bossHp = engine.bossHpMax;

    var p = randPos(engine.rng);
    var s = (engine.storm ? 1.18 : 1.28) * engine.sizeBase * ((engine.runMode === 'research') ? 1 : engine.adapt.size);

    var el = makeTarget('boss', { hp: engine.bossHp }, p.x, p.y, s);
    layer.appendChild(el);

    engine.nSpawnBoss++;
    logEvent('spawn', { kind:'boss', emoji:'👑' });

    emit('hha:judge', { kind:'boss', text:'BOSS!' });
    emit('hha:celebrate', { kind:'goal', title:'BOSS 등장!' });

    // next boss (play: depends on adapt)
    engine.nextBossAt = nowMs() + (engine.runMode === 'research' ? 21000 : clamp(engine.adapt.bossEvery, 14000, 25000));
  }

  // --------------------------- Perfect / Critical ---------------------------
  function judgePerfect(rtMs){
    // Perfect: fast reaction
    return (rtMs <= 330);
  }
  function judgeCritical(rtMs){
    // Critical: ultra fast
    return (rtMs <= 220);
  }

  // --------------------------- Hit logic ---------------------------
  function hitBoss(el){
    engine.nHitBoss++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    el.dataset.hp = String(engine.bossHp);

    var mult = scoreMult();
    engine.score += Math.round((160 + engine.combo * 2) * mult);

    emit('hha:judge', { kind:'boss', text:'HIT!' });
    SFX.good();
    updateScore();
    logEvent('hit', { kind:'boss', emoji:'👑', hpLeft: engine.bossHp });

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      emit('hha:judge', { kind:'boss', text:'BOSS DOWN!' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });
      SFX.power();
      addFever(18);

      // reward: shield + score burst
      engine.shield = 1;
      engine.score += 420 * mult;

      // Mini boss down
      Quest.onBossDown();

      logEvent('boss_down', { });
    }

    removeTarget(el);
  }

  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    var tp = String(el.dataset.type || '').toLowerCase();
    var rt = Math.max(0, nowMs() - (Number(el._spawnAt) || nowMs()));

    // boss
    if (tp === 'boss'){
      hitBoss(el);
      return;
    }

    // star powerup
    if (tp === 'star'){
      engine.nHitGood++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      var multS = scoreMult();
      engine.score += 140 * multS;
      emit('hha:judge', { kind:'good', text:'⭐ STAR!' });
      Particles.burstAt(safeRect().W*0.5, safeRect().H*0.55, 'good');
      SFX.power();
      onStarCollected();
      updateScore();
      logEvent('hit', { kind:'star', emoji:'⭐', rtMs: rt|0 });
      removeTarget(el);
      return;
    }

    // GOOD
    if (tp === 'good'){
      engine.nHitGood++;

      var perfect = judgePerfect(rt);
      var critical = judgeCritical(rt);

      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      var mult = scoreMult();
      var base = 110 + engine.combo * 3;
      if (perfect) base += 70;
      if (critical) base += 90;

      engine.score += Math.round(base * mult);

      // update plate counters
      var kind = String(el.dataset.kind || 'veg');
      if (engine.plate[kind] != null) engine.plate[kind]++;

      // fever
      addFever(perfect ? 9 : 7);

      // effects
      if (critical){
        emit('hha:judge', { kind:'good', text:(mult>1?'CRIT x2!':'CRITICAL!') });
        SFX.perfect();
      } else if (perfect){
        emit('hha:judge', { kind:'good', text:(mult>1?'PERF x2!':'PERFECT!') });
        SFX.perfect();
      } else {
        emit('hha:judge', { kind:'good', text:(mult>1?'OVER x2!':'GOOD!') });
        SFX.good();
      }

      // particles (if available)
      try{
        var pxy = getXY(el);
        Particles.scorePop(pxy.x, pxy.y, '+' + Math.round(base * mult));
        Particles.burstAt(pxy.x, pxy.y, critical ? 'boss' : (perfect ? 'gold' : 'good'));
      } catch (e) {}

      updateScore();
      logEvent('hit', {
        kind: kind, isGood:true, emoji: el.dataset.emoji || '',
        rtMs: rt|0, perfect: !!perfect, critical: !!critical,
        totalScore: engine.score|0, combo: engine.combo|0,
        feverValue: engine.fever|0, shield: engine.shield|0
      });

      // Quest updates
      Quest.onGoodHit({ perfect: !!perfect, critical: !!critical });

      removeTarget(el);
      return;
    }

    // BAD-like: junk / decoy
    var badLike = (tp === 'junk' || tp === 'decoy');

    if (badLike){
      if (tp === 'junk' && engine.shield > 0){
        engine.shield = 0;
        engine.combo = Math.max(0, engine.combo - 1);
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        SFX.power();

        logEvent('shield_block', { kind:'junk', emoji: el.dataset.emoji || '' });
        updateScore();
        removeTarget(el);
        return;
      }

      engine.misses++;
      engine.combo = 0;
      addFever(tp === 'junk' ? -18 : -14);

      if (tp === 'junk') engine.nHitJunk++;
      else engine.nHitDecoy++;

      emit('hha:judge', { kind:'bad', text: (tp === 'junk' ? 'JUNK!' : 'TRAP!') });
      SFX.bad();

      // storm harsher: extend a bit when you get hit
      if (engine.storm) engine.stormUntil += 650;

      DOC.body.classList.add('plate-shake');
      root.setTimeout(function(){ DOC.body.classList.remove('plate-shake'); }, 220);

      logEvent('hit', { kind: tp, isGood:false, emoji: el.dataset.emoji || '', rtMs: rt|0 });

      // Mini penalty
      Quest.onBadHit({ reason: tp });

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // --------------------------- Spawn loop ---------------------------
  function spawnOne(){
    if (!engine.running || engine.ended) return;

    tryBossSpawn();

    var tp = chooseType();
    var p = randPos(engine.rng);

    var base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;
    var stormScale = engine.storm ? 0.92 : 1.0;

    var size = engine.sizeBase * base.size * stormScale;
    if (tp === 'junk') size *= 0.95;
    if (tp === 'decoy') size *= 0.98;
    if (tp === 'star') size *= 0.98;

    var el;
    if (tp === 'good'){
      var k = chooseGoodKind();
      el = makeTarget('good', { kind:k }, p.x, p.y, size);
      engine.nSpawnGood++;
      logEvent('spawn', { kind:k, emoji: el.dataset.emoji || '', isGood:true });
    } else if (tp === 'junk'){
      el = makeTarget('junk', null, p.x, p.y, size);
      engine.nSpawnJunk++;
      logEvent('spawn', { kind:'junk', emoji: el.dataset.emoji || '', isGood:false });
    } else if (tp === 'decoy'){
      el = makeTarget('decoy', null, p.x, p.y, size);
      engine.nSpawnDecoy++;
      logEvent('spawn', { kind:'decoy', emoji: el.dataset.emoji || '', isGood:false });
    } else if (tp === 'star'){
      el = makeTarget('star', null, p.x, p.y, size);
      engine.nSpawnStar++;
      logEvent('spawn', { kind:'star', emoji:'⭐', isGood:true });
    }

    if (el) layer.appendChild(el);
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;

    spawnOne();

    var base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;
    var sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // --------------------------- Tick loop (adaptive + storm + laser + quest) ---------------------------
  function loopTick(){
    if (!engine.running || engine.ended) return;

    // storm schedule
    if (!engine.storm && nowMs() >= engine.nextStormAt) enterStorm();
    if (engine.storm) maybeStormTick();

    // laser checks
    checkLaserHit();

    // adaptive (play only)
    if (engine.runMode === 'play'){
      var denom = engine.nHitGood + engine.nHitJunk + engine.nHitDecoy;
      var acc = denom > 0 ? (engine.nHitGood / denom) : 0;
      var heat = clamp((engine.combo / 18) + (acc - 0.65), 0, 1);

      engine.adapt.spawnMs = clamp(830 - heat * 270, 480, 920);
      engine.adapt.ttl = clamp(1700 - heat * 280, 1250, 1850);
      engine.ttlMs = engine.adapt.ttl;
      engine.adapt.size = clamp(1.02 - heat * 0.10, 0.86, 1.06);

      engine.adapt.junk = clamp(0.11 + heat * 0.06, 0.08, 0.22);
      engine.adapt.decoy = clamp(0.09 + heat * 0.05, 0.06, 0.20);
      engine.adapt.bossEvery = clamp(20000 - heat * 6500, 14000, 23000);
    } else {
      engine.ttlMs = diffParams(engine.diff).ttl;
    }

    // time
    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();

    // quest tick (mini timer)
    Quest.onTick();

    if (engine.left <= 0){
      endGame('time');
      return;
    }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    var list = layer.querySelectorAll('.pl-target');
    for (var i=0;i<list.length;i++){
      var el = list[i];
      try { root.clearTimeout(el._ttlTimer); } catch (e) {}
      try { el.remove(); } catch (e2) {}
    }
  }

  // --------------------------- End overlay (reuse existing HTML) ---------------------------
  function ensureEndOverlay(){
    var end = DOC.getElementById('endOverlay');
    if (!end) return null;

    // bind buttons once
    if (end.dataset.bound === '1') return end;
    end.dataset.bound = '1';

    var btnRetry = DOC.getElementById('btnRetry');
    var btnBack = DOC.getElementById('btnBackHub');

    if (btnRetry){
      btnRetry.addEventListener('click', function(){
        // flush then reload
        PlateBoot.flushThen(function(){
          try { root.location.reload(); } catch (e) {}
        }, 'retry');
      }, { passive:true });
    }

    if (btnBack){
      btnBack.addEventListener('click', function(){
        PlateBoot.goHub();
      }, { passive:true });
    }

    return end;
  }

  function showEnd(detail){
    var end = ensureEndOverlay();
    if (!end) return;

    function setText(id, v){
      var el = DOC.getElementById(id);
      if (el) el.textContent = String(v);
    }

    setText('endScore', detail.scoreFinal || 0);
    setText('endRank', detail.grade || 'C');
    setText('endAcc', (detail.accuracyGoodPct || 0) + '%');
    setText('endComboMax', detail.comboMax || 0);
    setText('endMiss', detail.misses || 0);
    setText('endGoals', (detail.goalsCleared || 0) + '/' + (detail.goalsTotal || 0));
    setText('endMinis', (detail.miniCleared || 0) + '/' + (detail.miniTotal || 0));

    end.style.display = 'flex';
  }

  // --------------------------- Flush-hardened ---------------------------
  function flushNow(reason){
    reason = String(reason || 'flush');

    // Allow any listeners to push final logs
    emit('hha:flush', { reason: reason });

    var L = getLogger();
    var p = null;

    try{
      if (L && typeof L.flush === 'function') p = L.flush({ reason: reason });
      else if (L && typeof L.flushNow === 'function') p = L.flushNow({ reason: reason });
    } catch (e) { p = null; }

    // Always resolve quickly (do not block)
    return new Promise(function(resolve){
      var done = false;
      function finish(){
        if (done) return;
        done = true;
        resolve(true);
      }
      // timeout hard cap
      root.setTimeout(finish, 850);

      if (p && typeof p.then === 'function'){
        p.then(finish).catch(function(_e){ finish(); });
      } else {
        finish();
      }
    });
  }

  // --------------------------- End game ---------------------------
  function endGame(reason){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    DOC.body.classList.remove('plate-storm','plate-storm-urgent','plate-overdrive');
    try { root.clearTimeout(engine.spawnTimer); } catch (e) {}
    try { root.clearTimeout(engine.tickTimer); } catch (e) {}
    try { root.clearTimeout(engine.hazardTimer); } catch (e) {}

    stopLaser();
    clearAllTargets();

    var acc = accPct();
    var grade = rankFromAcc(acc);
    var q = null;
    try { q = Quest.getState(); } catch (e2) { q = null; }

    var detail = {
      reason: String(reason || 'end'),
      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,
      accuracyGoodPct: acc|0,
      grade: grade,

      goalsCleared: q ? (q.goalsCleared|0) : 0,
      goalsTotal:   q ? (q.goalsTotal|0)   : 0,
      miniCleared:  q ? (q.miniCleared|0)  : 0,
      miniTotal:    q ? (q.miniTotal|0)    : 0,

      // spawn/hit stats
      nTargetGoodSpawned: engine.nSpawnGood|0,
      nTargetJunkSpawned: engine.nSpawnJunk|0,
      nTargetDecoySpawned: engine.nSpawnDecoy|0,
      nTargetStarSpawned: engine.nSpawnStar|0,
      nTargetBossSpawned: engine.nSpawnBoss|0,

      nHitGood: engine.nHitGood|0,
      nHitJunk: engine.nHitJunk|0,
      nHitDecoy: engine.nHitDecoy|0,
      nHitBoss: engine.nHitBoss|0,

      // plate state
      plate: {
        veg: engine.plate.veg|0,
        fruit: engine.plate.fruit|0,
        prot: engine.plate.prot|0,
        grain: engine.plate.grain|0
      },

      diff: engine.diff,
      runMode: engine.runMode,
      seed: engine.seed
    };

    // persist last summary (both keys)
    try {
      root.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(detail || {}));
      root.localStorage.setItem('hha_last_summary', JSON.stringify(detail || {}));
    } catch (e3) {}

    logEvent('session_end', detail);
    emit('hha:end', detail);

    // Flush BEFORE showing overlay (still quick-capped)
    PlateBoot.flushThen(function(){
      showEnd(detail);
    }, 'end');
  }

  // --------------------------- Public boot API ---------------------------
  function start(runMode, cfg){
    cfg = cfg || {};
    engine.runMode = (String(runMode || 'play').toLowerCase() === 'research') ? 'research' : 'play';

    engine.diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
    engine.timeSec = clamp(cfg.time != null ? cfg.time : intQ('time', 90), 30, 600);

    var sid = String(qs('sessionId', qs('studentKey','')) || '');
    var ts = String(qs('ts', Date.now()));
    var seed = String(cfg.seed || qs('seed', sid ? (sid + '|' + ts) : ts));
    engine.seed = seed;
    engine.rng = makeRng(seed);

    SFX.ensure();

    var dp = diffParams(engine.diff);

    engine.running = true;
    engine.ended = false;

    engine.left = engine.timeSec;
    engine.score = 0;
    engine.combo = 0;
    engine.comboMax = 0;
    engine.misses = 0;

    engine.nSpawnGood = 0;
    engine.nSpawnJunk = 0;
    engine.nSpawnDecoy = 0;
    engine.nSpawnStar = 0;
    engine.nSpawnBoss = 0;

    engine.nHitGood = 0;
    engine.nHitJunk = 0;
    engine.nHitDecoy = 0;
    engine.nHitBoss = 0;

    engine.fever = 0;
    engine.shield = 0;

    engine.ttlMs = dp.ttl;
    engine.sizeBase = dp.size;

    engine.plate.veg = 0;
    engine.plate.fruit = 0;
    engine.plate.prot = 0;
    engine.plate.grain = 0;

    engine.adapt.spawnMs = dp.spawnMs;
    engine.adapt.ttl = dp.ttl;
    engine.adapt.size = dp.size;
    engine.adapt.junk = dp.junk;
    engine.adapt.decoy = dp.decoy;
    engine.adapt.bossEvery = 19000;

    engine.storm = false;
    engine.stormDurSec = dp.stormDur;
    engine.nextStormAt = nowMs() + (12000 + engine.rng() * 11000);

    engine.bossAlive = false;
    engine.bossHpMax = dp.bossHp;
    engine.bossHp = dp.bossHp;
    engine.nextBossAt = nowMs() + 15000;

    engine.laser.on = false;

    engine.overCharge = 0;
    engine.overWindowUntil = 0;
    engine.overUntil = 0;
    DOC.body.classList.remove('plate-overdrive');

    engine.vx = 0;
    engine.vy = 0;
    applyView();

    // Quest reset + start minis chain (equal exposure)
    Quest.startAll();

    // Initial UI
    updateTime();
    updateScore();

    // Log session start
    logEvent('session_start', {
      runMode: engine.runMode,
      diff: engine.diff,
      timeSec: engine.timeSec|0,
      seed: engine.seed
    });

    // Start loops
    loopSpawn();
    loopTick();
    scheduleLaser();
  }

  function goHub(){
    // use hub query param if present
    var hub = String(qs('hub', '../hub.html') || '../hub.html');
    PlateBoot.flushThen(function(){
      try{
        var u = new URL(hub, root.location.href);
        u.searchParams.set('ts', String(Date.now()));
        root.location.href = u.toString();
      } catch (e) {
        root.location.href = hub;
      }
    }, 'hub');
  }

  function flushThen(fn, reason){
    flushNow(reason || 'flush').then(function(){
      try { if (typeof fn === 'function') fn(); } catch (e) {}
    });
  }

  // Expose API
  var PlateBoot = (root.PlateBoot = root.PlateBoot || {});
  PlateBoot.start = start;
  PlateBoot.goHub = goHub;
  PlateBoot.flushNow = flushNow;
  PlateBoot.flushThen = flushThen;

  // --------------------------- Flush hooks (hardened) ---------------------------
  function hookFlush(){
    // pagehide is the most reliable on mobile
    root.addEventListener('pagehide', function(){
      try { flushNow('pagehide'); } catch (e) {}
    }, { passive:true });

    root.addEventListener('visibilitychange', function(){
      try{
        if (DOC.visibilityState === 'hidden') flushNow('hidden');
      } catch (e) {}
    }, { passive:true });

    root.addEventListener('beforeunload', function(){
      try { flushNow('beforeunload'); } catch (e) {}
    });

    // back button safety: flush quickly (do not block)
    root.addEventListener('popstate', function(){
      try { flushNow('popstate'); } catch (e) {}
    }, { passive:true });
  }

  // --------------------------- Boot once ---------------------------
  setupView();
  hookFlush();
  ensureEndOverlay();

})(typeof window !== 'undefined' ? window : globalThis);