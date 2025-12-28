/* === /herohealth/plate/plate.safe.js ===
Balanced Plate VR — SAFE (PRODUCTION) — HHA Standard (FULL + FLUSH-HARDENED + ALL FUN PACK)
- IIFE (NO export) ✅
- catch(e) ✅
- Fun Pack ALL: Storm waves + danger FX, Decoy/Trap, Boss + Laser dodge (world-shift), Perfect/Critical, ⭐⭐ Overdrive x2,
  + No-Junk Zone (ring), + Perfect Streak Multiplier, + Boss Phase 2 (double lasers)
- Goal3: accuracyGoodPct >= 88%
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

  var FeverUI = (root.GAME_MODULES && root.GAME_MODULES.FeverUI) || root.FeverUI || null;

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

    var top = 160;
    var bot = 180;
    var side = 16;
    if (W < 760) top = 260;

    return { W:W, H:H, x0:side, x1:W-side, y0:top, y1:H-bot };
  }

  function randPos(rng){
    var r = safeRect();
    var x = r.x0 + rng() * (r.x1 - r.x0);
    var y = r.y0 + rng() * (r.y1 - r.y0);
    return { x:x, y:y };
  }

  // --------------------------- No-Junk Zone (ring) ---------------------------
  var zone = {
    on: false,
    until: 0,
    nextAt: 0,
    radius: 170,
    el: null
  };

  function ensureZoneRing(){
    if (zone.el) return zone.el;

    var st = DOC.createElement('style');
    st.id = 'plate-zone-css';
    st.textContent =
      '.plate-zoneRing{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
      'width:calc(var(--zr) * 2px);height:calc(var(--zr) * 2px);border-radius:999px;' +
      'border:2px dashed rgba(34,211,238,.55);box-shadow:0 0 22px rgba(34,211,238,.16), inset 0 0 0 1px rgba(34,211,238,.10);' +
      'pointer-events:none;z-index:6;opacity:.0;transition:opacity .18s ease;}' +
      '.plate-zoneOn .plate-zoneRing{opacity:.92;}' +
      '.plate-zonePulse{animation:plateZonePulse .9s ease-in-out infinite;}' +
      '@keyframes plateZonePulse{0%{filter:brightness(1)}50%{filter:brightness(1.12)}100%{filter:brightness(1)}}';
    DOC.head.appendChild(st);

    var el = DOC.createElement('div');
    el.className = 'plate-zoneRing';
    DOC.body.appendChild(el);
    zone.el = el;
    return el;
  }

  function setZoneOn(sec){
    sec = Math.max(3, sec|0);
    ensureZoneRing();
    zone.on = true;
    zone.until = nowMs() + sec * 1000;
    DOC.body.classList.add('plate-zoneOn');
    DOC.body.classList.add('plate-zonePulse');
    DOC.documentElement.style.setProperty('--zr', String(zone.radius|0));
    emit('hha:judge', { kind:'good', text:'NO-JUNK ZONE!' });
    emit('hha:celebrate', { kind:'mini', title:'NO-JUNK ZONE!' });
    SFX.power();
    logEvent('zone_start', { radius: zone.radius|0, sec: sec|0 });

    root.setTimeout(function(){
      DOC.body.classList.remove('plate-zonePulse');
    }, 1600);
  }

  function setZoneOff(clean){
    zone.on = false;
    zone.until = 0;
    DOC.body.classList.remove('plate-zoneOn');
    DOC.body.classList.remove('plate-zonePulse');
    logEvent('zone_end', { clean: !!clean });
  }

  function isInsideZoneXY(x, y){
    var r = safeRect();
    var cx = r.W * 0.5;
    var cy = r.H * 0.5;

    // target is in "world layer"; layer is shifted by vx/vy => visual position is x+vx, y+vy
    var vx = engine.vx || 0;
    var vy = engine.vy || 0;

    var dx = (x + vx) - cx;
    var dy = (y + vy) - cy;
    return (dx*dx + dy*dy) <= (zone.radius * zone.radius);
  }

  function pickPosInsideZone(rng){
    var r = safeRect();
    var cx = r.W * 0.5 - (engine.vx||0);
    var cy = r.H * 0.5 - (engine.vy||0);

    // rejection sampling (fast)
    for (var i=0;i<12;i++){
      var ang = rng() * Math.PI * 2;
      var rad = Math.sqrt(rng()) * (zone.radius * 0.92);
      var x = cx + Math.cos(ang) * rad;
      var y = cy + Math.sin(ang) * rad;

      if (x < r.x0+40 || x > r.x1-40 || y < r.y0+40 || y > r.y1-40) continue;
      return { x:x, y:y };
    }
    // fallback
    return randPos(rng);
  }

  function pickPosOutsideZone(rng){
    var r = safeRect();
    for (var i=0;i<18;i++){
      var p = randPos(rng);
      if (!isInsideZoneXY(p.x, p.y)) return p;
    }
    return randPos(rng);
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
    plateNeed: { veg:5, fruit:3, prot:4, grain:4 },

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

    // boss + hazards
    bossAlive:false,
    bossHp:0,
    bossHpMax:3,
    bossDownCount:0,
    nextBossAt:0,

    lasers: { list:[] }, // multiple lasers support
    hazardTimer:0,

    // ⭐⭐ overdrive x2
    overCharge:0,
    overWindowUntil:0,
    overUntil:0,

    // Perfect streak multiplier
    streakLvl:0,     // 0..3
    streakHits:0,    // perfect/crit chain count
    streakUntil:0,   // decay timer

    // timers
    spawnTimer:0,
    tickTimer:0
  };

  function scoreMultBase(){
    return (nowMs() < engine.overUntil) ? 2 : 1;
  }

  function streakMult(){
    // L0=1.0, L1=1.2, L2=1.4, L3=1.6
    var lv = clamp(engine.streakLvl|0, 0, 3);
    return 1 + lv * 0.2;
  }

  function scoreMult(){
    return scoreMultBase() * streakMult();
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
      '.pl-boss{width:96px;height:96px;font-size:44px;border-color:rgba(167,139,250,.28);box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 26px rgba(167,139,250,.14);}' +
      '.pl-target.hit{transform:translate(-50%,-50%) scale(calc(var(--s,1) * 1.06));filter:brightness(1.22);opacity:.92;}' +
      '.pl-target.out{opacity:0;transform:translate(-50%,-50%) scale(calc(var(--s,1) * 0.90));transition:opacity .18s ease, transform .18s ease;}' +
      '.plate-storm .pl-target{filter:saturate(1.25) contrast(1.05);}' +
      '.plate-storm-urgent{animation:plateUrg .14s linear infinite;}' +
      '@keyframes plateUrg{0%{filter:brightness(1)}50%{filter:brightness(1.08)}100%{filter:brightness(1)}}' +
      '.plate-overdrive .pl-target{box-shadow:0 18px 70px rgba(0,0,0,.35), 0 0 26px rgba(34,197,94,.18);}' +
      '.plate-shake{animation:plateShake .16s ease-in-out 1;}' +
      '@keyframes plateShake{0%{transform:translate(0,0)}25%{transform:translate(2px,-1px)}50%{transform:translate(-2px,1px)}75%{transform:translate(1px,2px)}100%{transform:translate(0,0)}}' +
      '.plate-laser{position:absolute;left:50%;top:var(--ly);transform:translate(-50%,-50%);width:min(92vw,860px);height:var(--lh);' +
      'border-radius:999px;background:linear-gradient(90deg, rgba(239,68,68,.0), rgba(239,68,68,.55), rgba(239,68,68,.0));' +
      'box-shadow:0 0 24px rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.22);opacity:.92;pointer-events:none;}' +
      '.plate-laser.warn{opacity:.55;filter:saturate(1.2);}';
    DOC.head.appendChild(st);
  })();

  function logEvent(type, data){
    emit('hha:log_event', { type: type, data: data || {} });

    var L = getLogger();
    try{
      if (L && typeof L.logEvent === 'function') L.logEvent(type, data || {});
      else if (L && typeof L.push === 'function') L.push({ type:type, data:data||{} });
    } catch (e) {}
  }

  // --------------------------- Quest Director (Goals + Minis deterministic chain) ---------------------------
  var Quest = (function(){
    var goals = [
      { id:'goal1', title:'เติมจานให้ครบ (ครบตามสัดส่วน)', kind:'fill_plate' },
      { id:'goal2', title:'สัดส่วนต้อง “บาลานซ์”', kind:'balance_ratio' },
      { id:'goal3', title:'ความแม่นยำ ≥ 88%', kind:'acc_gate_88' }
    ];

    // ✅ เพิ่ม mini: No-Junk Zone ให้มาแบบ “เฉลี่ยเท่า ๆ กัน”
    var minis = [
      { id:'mini_rush',  title:'Plate Rush: ครบ 5 ใน 8 วิ และห้ามโดนขยะ', kind:'rush', total:5, ms:8000, noJunk:true },
      { id:'mini_zone',  title:'No-Junk Zone: เก็บดี 6 ในวงภายใน 7 วิ', kind:'zone_collect', total:6, ms:7000 },
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
      miniEndAt: 0
    };

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

      logEvent('mini_start', { miniId:m.id, title:m.title });
      emit('hha:judge', { kind:'good', text:'MINI START!' });
      emit('hha:celebrate', { kind:'mini', title:m.title });

      // Mini that turns on zone immediately
      if (m.kind === 'zone_collect'){
        setZoneOn(Math.ceil((m.ms|0)/1000));
      }

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

      if (m.kind === 'zone_collect'){
        setZoneOff(true);
      }

      st.activeMini = null;
      st.miniNow = 0;
      st.miniTotal = 0;
      st.miniEndAt = 0;

      st.miniIndex++;
      pushUpdate({ miniEnd:true });

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

      if (m.kind === 'zone_collect'){
        setZoneOff(false);
      }

      st.activeMini = null;
      st.miniNow = 0;
      st.miniTotal = 0;
      st.miniEndAt = 0;

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

    function plateFilled(){
      var need = engine.plateNeed;
      var p = engine.plate;
      return (p.veg >= need.veg && p.fruit >= need.fruit && p.prot >= need.prot && p.grain >= need.grain);
    }

    function plateBalanced(){
      var need = engine.plateNeed;
      var p = engine.plate;

      var totalNeed = need.veg + need.fruit + need.prot + need.grain;
      var totalNow = p.veg + p.fruit + p.prot + p.grain;
      if (totalNow < Math.floor(totalNeed * 0.75)) return false;

      function dist(now, target){
        var t = Math.max(1, target);
        return Math.abs(now - target) / t;
      }
      var d = dist(p.veg, need.veg) + dist(p.fruit, need.fruit) + dist(p.prot, need.prot) + dist(p.grain, need.grain);
      return d <= 1.15;
    }

    function onTick(){
      var m = st.activeMini;
      if (m && st.miniEndAt && nowMs() >= st.miniEndAt){
        failMini('timeout');
      }
      pushUpdate();
    }

    function onGoodHit(meta){
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
        } else if (m.kind === 'zone_collect'){
          // only count if inside zone at hit-time (strict)
          if (meta && meta.insideZone) {
            st.miniNow++;
            if (st.miniNow >= st.miniTotal) clearMini();
          }
        }
      }

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
      } else if (m.kind === 'zone_collect'){
        failMini('zone_broke');
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

    return {
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

  // --------------------------- Perfect streak multiplier ---------------------------
  function bumpStreak(isPerfectOrCrit){
    var t = nowMs();
    if (!isPerfectOrCrit){
      engine.streakLvl = 0;
      engine.streakHits = 0;
      engine.streakUntil = 0;
      return;
    }

    // decay window: keep chain alive if next perfect within 2.6s
    if (t > engine.streakUntil){
      engine.streakHits = 0;
      engine.streakLvl = 0;
    }

    engine.streakHits++;
    engine.streakUntil = t + 2600;

    // level up thresholds
    if (engine.streakHits >= 8) engine.streakLvl = 3;
    else if (engine.streakHits >= 5) engine.streakLvl = 2;
    else if (engine.streakHits >= 2) engine.streakLvl = 1;
    else engine.streakLvl = 0;

    if (engine.streakLvl > 0){
      emit('hha:judge', { kind:'good', text:'STREAK x' + (streakMult().toFixed(1)) + '!' });
    }
  }

  function breakStreak(){
    engine.streakLvl = 0;
    engine.streakHits = 0;
    engine.streakUntil = 0;
  }

  // --------------------------- Spawn / Types ---------------------------
  function chooseType(){
    var base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;

    var j = clamp(base.junk + (engine.storm ? 0.05 : 0), 0.06, 0.30);
    var d = clamp(base.decoy + (engine.storm ? 0.03 : 0), 0.05, 0.25);

    var pu = engine.storm ? 0.020 : 0.012;
    if (engine.rng() < pu) return 'star';

    var r = engine.rng();
    if (r < j) return 'junk';
    if (r < j + d) return 'decoy';
    return 'good';
  }

  function chooseGoodKind(){
    var need = engine.plateNeed;
    var p = engine.plate;

    var weights = [
      {k:'veg',   w: Math.max(0.15, (need.veg   - p.veg)   / Math.max(1, need.veg))},
      {k:'fruit', w: Math.max(0.15, (need.fruit - p.fruit) / Math.max(1, need.fruit))},
      {k:'prot',  w: Math.max(0.15, (need.prot  - p.prot)  / Math.max(1, need.prot))},
      {k:'grain', w: Math.max(0.15, (need.grain - p.grain) / Math.max(1, need.grain))}
    ];
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
      el.dataset.phase = String(meta && meta.phase ? meta.phase : 1);
    }

    var ttlBase = engine.ttlMs;
    var ttl = engine.storm ? Math.max(880, ttlBase * 0.85) : ttlBase;

    el._ttlTimer = root.setTimeout(function(){
      if (!el.isConnected) return;

      if (tp === 'good'){
        engine.misses++;
        engine.combo = 0;
        breakStreak();

        emit('hha:judge', { kind:'warn', text:'MISS!' });
        Particles.burstAt(safeRect().W*0.5, safeRect().H*0.55, 'warn');
        addFever(-10);
        updateScore();
        logEvent('miss_expire', { kind: el.dataset.kind || '', emoji: el.dataset.emoji || '' });

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

    if (leftMs <= 3200){
      DOC.body.classList.add('plate-storm-urgent');
      SFX.tick(leftMs);
      if (leftMs <= 1200){
        DOC.body.classList.add('plate-shake');
        root.setTimeout(function(){ DOC.body.classList.remove('plate-shake'); }, 180);
      }
    } else {
      DOC.body.classList.remove('plate-storm-urgent');
    }
  }

  // --------------------------- Laser hazard (supports multi lines) ---------------------------
  var laserEls = [];

  function ensureLaserEl(i){
    if (laserEls[i]) return laserEls[i];
    var el = mkEl('div', 'plate-laser warn');
    el.style.setProperty('--ly', '50%');
    el.style.setProperty('--lh', '24px');
    el.style.display = 'none';
    layer.appendChild(el);
    laserEls[i] = el;
    return el;
  }

  function stopLasers(){
    engine.lasers.list = [];
    for (var i=0;i<laserEls.length;i++){
      if (!laserEls[i]) continue;
      laserEls[i].style.display = 'none';
      laserEls[i].classList.remove('warn');
    }
  }

  function scheduleLaser(){
    var base = engine.storm ? 4600 : 6200;
    var jitter = engine.rng() * 2800;
    try { root.clearTimeout(engine.hazardTimer); } catch(e) {}
    engine.hazardTimer = root.setTimeout(function(){
      if (!engine.running || engine.ended) return;
      startLaserBurst();
      scheduleLaser();
    }, base + jitter);
  }

  function startLaserBurst(){
    var r = safeRect();

    var phase2 = (engine.bossDownCount >= 1); // ✅ boss phase 2 unlocked after first boss down
    var count = phase2 ? (engine.rng() < 0.60 ? 2 : 1) : (engine.rng() < 0.22 ? 2 : 1);
    if (engine.storm && phase2) count = 2;

    var h = engine.storm ? 26 : 22;
    var warnMs = phase2 ? 420 : 520;
    var activeMs = phase2 ? 900 : 1150;

    engine.lasers.list = [];

    for (var i=0;i<count;i++){
      var y = r.y0 + engine.rng() * (r.y1 - r.y0);

      var L = {
        y: y,
        h: h,
        warnUntil: nowMs() + warnMs,
        until: nowMs() + warnMs + activeMs,
        hit: false
      };
      engine.lasers.list.push(L);

      var el = ensureLaserEl(i);
      el.style.display = '';
      el.classList.add('warn');
      el.style.setProperty('--ly', y.toFixed(1) + 'px');
      el.style.setProperty('--lh', h.toFixed(1) + 'px');
    }

    // hide extra els
    for (var k=count;k<laserEls.length;k++){
      if (laserEls[k]) laserEls[k].style.display = 'none';
    }

    logEvent('hazard_spawn', { kind:'laser', count: count, phase2: phase2 });

    SFX.beep(520, 0.05, 0.04);
  }

  function checkLaserTick(){
    if (!engine.lasers.list || !engine.lasers.list.length) return;

    var t = nowMs();
    var r = safeRect();
    var cx = r.W * 0.5;
    var cy = r.H * 0.5;

    var anyAlive = false;

    for (var i=0;i<engine.lasers.list.length;i++){
      var L = engine.lasers.list[i];
      if (!L) continue;

      var el = ensureLaserEl(i);

      if (t < L.warnUntil){
        el.classList.add('warn');
        anyAlive = true;
        continue;
      } else {
        el.classList.remove('warn');
      }

      if (t >= L.until){
        // completed without hit
        if (!L.hit){
          Quest.onLaserDodged();
        }
        continue;
      }

      anyAlive = true;

      // ACTIVE collision (laser shifts by vy)
      var ly = L.y + (engine.vy||0);
      var distY = Math.abs(cy - ly);

      if (!L.hit && distY <= (L.h * 0.5)){
        // HIT
        if (engine.shield > 0){
          engine.shield = 0;
          emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
          logEvent('shield_block', { kind:'laser' });
          L.hit = true; // still counts as “handled”
          continue;
        }

        L.hit = true;

        engine.misses++;
        engine.combo = 0;
        breakStreak();
        addFever(-16);

        emit('hha:judge', { kind:'bad', text:'LASER HIT!' });
        DOC.body.classList.add('plate-shake');
        root.setTimeout(function(){ DOC.body.classList.remove('plate-shake'); }, 220);

        SFX.bad();
        logEvent('hazard_hit', { kind:'laser' });

        Quest.onBadHit({ reason:'laser' });

        updateScore();
      }
    }

    if (!anyAlive){
      stopLasers();
    }
  }

  // --------------------------- Boss spawn (Phase 2) ---------------------------
  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (nowMs() < engine.nextBossAt) return;

    var phase2 = (engine.bossDownCount >= 1);
    engine.bossAlive = true;
    engine.bossHpMax = phase2 ? (engine.bossHpMax + 1) : engine.bossHpMax;
    engine.bossHp = phase2 ? (engine.bossHpMax) : engine.bossHpMax;

    var p = zone.on ? pickPosInsideZone(engine.rng) : randPos(engine.rng);
    var s = (engine.storm ? 1.18 : 1.30) * engine.sizeBase * ((engine.runMode === 'research') ? 1 : engine.adapt.size);

    var el = makeTarget('boss', { hp: engine.bossHp, phase: phase2 ? 2 : 1 }, p.x, p.y, s);
    layer.appendChild(el);

    engine.nSpawnBoss++;
    logEvent('spawn', { kind:'boss', emoji:'👑', phase: phase2 ? 2 : 1 });

    emit('hha:judge', { kind:'boss', text: phase2 ? 'BOSS P2!' : 'BOSS!' });
    emit('hha:celebrate', { kind:'goal', title: phase2 ? 'BOSS PHASE 2!' : 'BOSS 등장!' });

    engine.nextBossAt = nowMs() + (engine.runMode === 'research' ? 21000 : clamp(engine.adapt.bossEvery, 14000, 25000));
  }

  // --------------------------- Perfect / Critical ---------------------------
  function judgePerfect(rtMs){ return (rtMs <= 330); }
  function judgeCritical(rtMs){ return (rtMs <= 220); }

  // --------------------------- Hit logic ---------------------------
  function hitBoss(el){
    engine.nHitBoss++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    el.dataset.hp = String(engine.bossHp);

    var mult = scoreMult();
    engine.score += Math.round((180 + engine.combo * 2) * mult);

    emit('hha:judge', { kind:'boss', text:'HIT!' });
    SFX.good();
    updateScore();
    logEvent('hit', { kind:'boss', emoji:'👑', hpLeft: engine.bossHp });

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      engine.bossDownCount++;

      emit('hha:judge', { kind:'boss', text:'BOSS DOWN!' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });
      SFX.power();
      addFever(18);

      engine.shield = 1;
      engine.score += Math.round(520 * mult);

      Quest.onBossDown();

      logEvent('boss_down', { bossDownCount: engine.bossDownCount|0 });

      // Phase2 pacing: bring next boss a bit sooner
      engine.nextBossAt = nowMs() + (engine.bossDownCount >= 1 ? 16000 : 19000);
    }

    removeTarget(el);
  }

  function hitTarget(el){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    var tp = String(el.dataset.type || '').toLowerCase();
    var rt = Math.max(0, nowMs() - (Number(el._spawnAt) || nowMs()));

    if (tp === 'boss'){
      hitBoss(el);
      return;
    }

    if (tp === 'star'){
      engine.nHitGood++;
      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      // ⭐ breaks nothing; keep streak as-is
      var multS = scoreMult();
      engine.score += Math.round(150 * multS);

      emit('hha:judge', { kind:'good', text:'⭐ STAR!' });
      Particles.burstAt(safeRect().W*0.5, safeRect().H*0.55, 'good');
      SFX.power();

      onStarCollected();
      updateScore();
      logEvent('hit', { kind:'star', emoji:'⭐', rtMs: rt|0 });
      removeTarget(el);
      return;
    }

    // zone check at hit-time (strict)
    var xy = getXY(el);
    var insideZone = zone.on ? isInsideZoneXY(xy.x, xy.y) : false;

    if (tp === 'good'){
      engine.nHitGood++;

      var perfect = judgePerfect(rt);
      var critical = judgeCritical(rt);

      if (perfect || critical) bumpStreak(true);
      else bumpStreak(false);

      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);

      var mult = scoreMult();
      var base = 110 + engine.combo * 3;
      if (perfect) base += 70;
      if (critical) base += 90;

      engine.score += Math.round(base * mult);

      var kind = String(el.dataset.kind || 'veg');
      if (engine.plate[kind] != null) engine.plate[kind]++;

      addFever(perfect ? 9 : 7);

      if (critical){
        emit('hha:judge', { kind:'good', text:(scoreMultBase()>1?'CRIT x2!':'CRITICAL!') });
        SFX.perfect();
      } else if (perfect){
        emit('hha:judge', { kind:'good', text:(scoreMultBase()>1?'PERF x2!':'PERFECT!') });
        SFX.perfect();
      } else {
        emit('hha:judge', { kind:'good', text:(scoreMultBase()>1?'OVER x2!':'GOOD!') });
        SFX.good();
      }

      try{
        Particles.scorePop(xy.x, xy.y, '+' + Math.round(base * mult));
        Particles.burstAt(xy.x, xy.y, critical ? 'boss' : (perfect ? 'gold' : 'good'));
      } catch (e) {}

      updateScore();
      logEvent('hit', {
        kind: kind, isGood:true, emoji: el.dataset.emoji || '',
        rtMs: rt|0, perfect: !!perfect, critical: !!critical,
        insideZone: !!insideZone,
        totalScore: engine.score|0, combo: engine.combo|0,
        feverValue: engine.fever|0, shield: engine.shield|0,
        scoreMult: mult
      });

      Quest.onGoodHit({ perfect: !!perfect, critical: !!critical, insideZone: !!insideZone });

      removeTarget(el);
      return;
    }

    // junk / decoy (penalty)
    var badLike = (tp === 'junk' || tp === 'decoy');
    if (badLike){
      // If NO-JUNK ZONE is on and you hit bad, punish harder (but still shieldable)
      var zonePunish = (zone.on ? 1 : 0);

      if (tp === 'junk' && engine.shield > 0){
        engine.shield = 0;
        engine.combo = Math.max(0, engine.combo - 1);
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        SFX.power();

        logEvent('shield_block', { kind:'junk', emoji: el.dataset.emoji || '', zoneOn: zone.on });
        updateScore();
        removeTarget(el);
        return;
      }

      engine.misses++;
      engine.combo = 0;
      breakStreak();
      addFever(tp === 'junk' ? (-18 - zonePunish*6) : (-14 - zonePunish*5));

      if (tp === 'junk') engine.nHitJunk++;
      else engine.nHitDecoy++;

      emit('hha:judge', { kind:'bad', text: (tp === 'junk' ? (zone.on ? 'JUNK IN ZONE!' : 'JUNK!') : 'TRAP!') });
      SFX.bad();

      if (engine.storm) engine.stormUntil += 650;

      DOC.body.classList.add('plate-shake');
      root.setTimeout(function(){ DOC.body.classList.remove('plate-shake'); }, 220);

      logEvent('hit', { kind: tp, isGood:false, emoji: el.dataset.emoji || '', rtMs: rt|0, zoneOn: zone.on });

      Quest.onBadHit({ reason: tp });

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // --------------------------- Zone schedule tick ---------------------------
  function maybeZoneTick(){
    var t = nowMs();
    if (zone.on){
      if (t >= zone.until){
        setZoneOff(true);
        zone.nextAt = t + (16000 + engine.rng() * 12000);
      }
      return;
    }

    if (t >= zone.nextAt){
      // appear as a “moment” (more often in play mode)
      var sec = engine.storm ? 6 : 7;
      setZoneOn(sec);
      zone.nextAt = t + (20000 + engine.rng() * 14000);
    }
  }

  // --------------------------- Spawn loop (zone-aware) ---------------------------
  function spawnOne(){
    if (!engine.running || engine.ended) return;

    tryBossSpawn();

    var tp = chooseType();

    var base = (engine.runMode === 'research') ? diffParams(engine.diff) : engine.adapt;
    var stormScale = engine.storm ? 0.92 : 1.0;

    var size = engine.sizeBase * base.size * stormScale;
    if (tp === 'junk') size *= 0.95;
    if (tp === 'decoy') size *= 0.98;
    if (tp === 'star') size *= 0.98;

    // ✅ Zone fairness: good/star/boss inside, bad outside
    var p;
    if (zone.on){
      if (tp === 'good' || tp === 'star') p = pickPosInsideZone(engine.rng);
      else p = pickPosOutsideZone(engine.rng);
    } else {
      p = randPos(engine.rng);
    }

    var el;
    if (tp === 'good'){
      var k = chooseGoodKind();
      el = makeTarget('good', { kind:k }, p.x, p.y, size);
      engine.nSpawnGood++;
      logEvent('spawn', { kind:k, emoji: el.dataset.emoji || '', isGood:true, zoneOn: zone.on });
    } else if (tp === 'junk'){
      el = makeTarget('junk', null, p.x, p.y, size);
      engine.nSpawnJunk++;
      logEvent('spawn', { kind:'junk', emoji: el.dataset.emoji || '', isGood:false, zoneOn: zone.on });
    } else if (tp === 'decoy'){
      el = makeTarget('decoy', null, p.x, p.y, size);
      engine.nSpawnDecoy++;
      logEvent('spawn', { kind:'decoy', emoji: el.dataset.emoji || '', isGood:false, zoneOn: zone.on });
    } else if (tp === 'star'){
      el = makeTarget('star', null, p.x, p.y, size);
      engine.nSpawnStar++;
      logEvent('spawn', { kind:'star', emoji:'⭐', isGood:true, zoneOn: zone.on });
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

  // --------------------------- Tick loop (adaptive + storm + zone + lasers + quest) ---------------------------
  function loopTick(){
    if (!engine.running || engine.ended) return;

    // storm schedule
    if (!engine.storm && nowMs() >= engine.nextStormAt) enterStorm();
    if (engine.storm) maybeStormTick();

    // zone schedule
    maybeZoneTick();

    // lasers
    checkLaserTick();

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

    // streak decay (soft)
    if (engine.streakUntil && nowMs() > engine.streakUntil){
      engine.streakHits = 0;
      engine.streakLvl = 0;
      engine.streakUntil = 0;
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

    if (end.dataset.bound === '1') return end;
    end.dataset.bound = '1';

    var btnRetry = DOC.getElementById('btnRetry');
    var btnBack = DOC.getElementById('btnBackHub');

    if (btnRetry){
      btnRetry.addEventListener('click', function(){
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
    emit('hha:flush', { reason: reason });

    var L = getLogger();
    var p = null;

    try{
      if (L && typeof L.flush === 'function') p = L.flush({ reason: reason });
      else if (L && typeof L.flushNow === 'function') p = L.flushNow({ reason: reason });
    } catch (e) { p = null; }

    return new Promise(function(resolve){
      var done = false;
      function finish(){
        if (done) return;
        done = true;
        resolve(true);
      }
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

    DOC.body.classList.remove('plate-storm','plate-storm-urgent','plate-overdrive','plate-zoneOn','plate-zonePulse');
    try { root.clearTimeout(engine.spawnTimer); } catch (e) {}
    try { root.clearTimeout(engine.tickTimer); } catch (e) {}
    try { root.clearTimeout(engine.hazardTimer); } catch (e) {}

    stopLasers();
    clearAllTargets();
    setZoneOff(true);

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

      // stats
      nTargetGoodSpawned: engine.nSpawnGood|0,
      nTargetJunkSpawned: engine.nSpawnJunk|0,
      nTargetDecoySpawned: engine.nSpawnDecoy|0,
      nTargetStarSpawned: engine.nSpawnStar|0,
      nTargetBossSpawned: engine.nSpawnBoss|0,

      nHitGood: engine.nHitGood|0,
      nHitJunk: engine.nHitJunk|0,
      nHitDecoy: engine.nHitDecoy|0,
      nHitBoss: engine.nHitBoss|0,

      bossDownCount: engine.bossDownCount|0,

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

    try {
      root.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(detail || {}));
      root.localStorage.setItem('hha_last_summary', JSON.stringify(detail || {}));
    } catch (e3) {}

    logEvent('session_end', detail);
    emit('hha:end', detail);

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
    ensureZoneRing();

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
    engine.bossDownCount = 0;
    engine.nextBossAt = nowMs() + 15000;

    stopLasers();

    engine.overCharge = 0;
    engine.overWindowUntil = 0;
    engine.overUntil = 0;
    DOC.body.classList.remove('plate-overdrive');

    engine.streakLvl = 0;
    engine.streakHits = 0;
    engine.streakUntil = 0;

    engine.vx = 0;
    engine.vy = 0;
    applyView();

    // zone schedule
    zone.on = false;
    zone.until = 0;
    zone.nextAt = nowMs() + (15000 + engine.rng() * 9000); // first appearance soon
    zone.radius = (root.innerWidth < 420) ? 150 : 170;

    Quest.startAll();

    updateTime();
    updateScore();

    logEvent('session_start', {
      runMode: engine.runMode,
      diff: engine.diff,
      timeSec: engine.timeSec|0,
      seed: engine.seed
    });

    loopSpawn();
    loopTick();
    scheduleLaser();
  }

  function goHub(){
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

  var PlateBoot = (root.PlateBoot = root.PlateBoot || {});
  PlateBoot.start = start;
  PlateBoot.goHub = goHub;
  PlateBoot.flushNow = flushNow;
  PlateBoot.flushThen = flushThen;

  // --------------------------- Flush hooks (hardened) ---------------------------
  function hookFlush(){
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

    root.addEventListener('popstate', function(){
      try { flushNow('popstate'); } catch (e) {}
    }, { passive:true });
  }

  // --------------------------- Boot once ---------------------------
  setupView();
  hookFlush();
  ensureEndOverlay();
  ensureZoneRing();

})(typeof window !== 'undefined' ? window : globalThis);