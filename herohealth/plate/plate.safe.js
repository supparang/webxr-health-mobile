/* === /herohealth/plate-vr/plate/plate.safe.js ===
Balanced Plate VR — SAFE (PRODUCTION) — HHA Standard (FULL + FLUSH)
✅ IIFE (NO export) -> โหลดด้วย <script defer src="...plate.safe.js"></script>
✅ HUD events: hha:score / hha:rank / hha:time / quest:update / hha:end
✅ Start via PlateBoot.start(runMode,cfg) (ถูกเรียกจาก HTML)
✅ Goals 1–5 (Goal3 ต้อง Accuracy >= 88%)
✅ Mini quests 5 แบบ + “กระจายเฉลี่ยเท่า ๆ กัน” (least-used picker)
✅ Plate Rush: 5 ภายใน 8 วิ + ห้ามโดนขยะระหว่างทำ + เอฟเฟกต์ใกล้หมดเวลา
✅ VR-feel: drag + gyro -> layer translate (เป้าไหลตาม)
✅ Spawn safe-zone กันทับ HUD บน/ล่าง/ซ้าย/ขวา (clamp)
✅ Fever -> Shield (กันพลาด 1 ครั้ง) | junk hit while shield => shield_block (ไม่เพิ่ม miss)
✅ End Summary overlay (reuse #endOverlay ids) + Back HUB/Retry => FLUSH ก่อนออก
✅ localStorage: HHA_LAST_SUMMARY / hha_last_summary
✅ flush hardened: end / back hub / pagehide / beforeunload
*/

(function(root){
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  // ------------------------- small utils -------------------------
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_e){}
  }
  function qs(name, def){
    try{ return (new URL(root.location.href)).searchParams.get(name) ?? def; }
    catch(_e){ return def; }
  }

  // ------------------------- RNG (deterministic) -------------------------
  function xmur3(str){
    str = String(str || 'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }
  function pick(rng, arr){
    return (!arr || !arr.length) ? '' : arr[(rng()*arr.length)|0];
  }

  // ------------------------- FX modules (optional) -------------------------
  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    { scorePop:function(){}, burstAt:function(){}, celebrate:function(){} };

  const FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    null;

  // ------------------------- AudioTick (fixed: no stray catch) -------------------------
  const AudioTick = (function(){
    let ctx=null, gain=null;
    let lastBeepAt = 0;

    function ensure(){
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;

      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') { try{ ctx.resume(); }catch(_e){} }

      if (!gain){
        gain = ctx.createGain();
        gain.gain.value = 0.0001;
        gain.connect(ctx.destination);
      }
      return true;
    }

    function beep(strength){
      const tms = now();
      if (tms - lastBeepAt < 90) return;
      lastBeepAt = tms;

      if (!ensure()) return;
      strength = clamp(strength, 0, 1);

      try{
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 520 + strength*180;

        const g = ctx.createGain();
        g.gain.value = 0.0001;

        osc.connect(g);
        g.connect(gain);

        const t0 = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.16 + strength*0.14, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

        osc.start();
        osc.stop(t0 + 0.09);
      }catch(_e){}
    }

    function stop(){
      try{ if (ctx && ctx.state !== 'closed') ctx.close(); }catch(_e){}
      ctx = null; gain = null;
    }

    return { beep:beep, stop:stop };
  })();

  // ------------------------- DOM layer -------------------------
  const layer = DOC.getElementById('plate-layer') || DOC.querySelector('.plate-layer') || DOC.querySelector('#plate-layer');
  if (!layer) return;

  // ------------------------- content (plate groups) -------------------------
  const GROUPS = [
    { id:'veg',     label:'ผัก',     emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    { id:'protein', label:'โปรตีน',  emoji:['🥚','🍗','🐟','🥜','🫘','🥛'] },
    { id:'carb',    label:'คาร์บ',   emoji:['🍚','🍞','🥔','🍠','🍜','🥖'] },
    { id:'fruit',   label:'ผลไม้',   emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] }
  ];
  const JUNK = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭','🥤'];

  // powerups
  const STAR = '⭐';
  const DIAMOND = '💎';
  const SHIELD = '🛡️';

  function groupOfEmoji(em){
    for (let i=0;i<GROUPS.length;i++){
      const g = GROUPS[i];
      if (g.emoji.indexOf(em) >= 0) return g.id;
    }
    return 'unknown';
  }

  // ------------------------- difficulty -------------------------
  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy'){
      return { spawnMs: 820, ttlMs: 1850, size: 1.06, junkBias: 0.12, puBias: 0.030, goalBase: 12 };
    }
    if (diff === 'hard'){
      return { spawnMs: 600, ttlMs: 1500, size: 0.92, junkBias: 0.18, puBias: 0.026, goalBase: 14 };
    }
    return { spawnMs: 700, ttlMs: 1650, size: 1.00, junkBias: 0.15, puBias: 0.028, goalBase: 13 };
  }

  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // ------------------------- Logger (optional + flush hardened) -------------------------
  const Log = (function(){
    const q = [];
    function hasCloud(){
      return !!(root.HHA_Logger || root.hhaCloudLogger || root.hhaLogEvent || root.HHACloudLogger);
    }
    function logEvent(type, data){
      q.push({ type:String(type||'event'), data:data||{}, t: Date.now() });

      // fire to any known logger immediately as well
      try{
        if (typeof root.hhaLogEvent === 'function'){
          root.hhaLogEvent(type, data || {});
        }else if (root.HHA_Logger && typeof root.HHA_Logger.logEvent === 'function'){
          root.HHA_Logger.logEvent(type, data || {});
        }else if (root.hhaCloudLogger && typeof root.hhaCloudLogger.logEvent === 'function'){
          root.hhaCloudLogger.logEvent(type, data || {});
        }else if (root.HHACloudLogger && typeof root.HHACloudLogger.logEvent === 'function'){
          root.HHACloudLogger.logEvent(type, data || {});
        }
      }catch(_e){}
    }

    function flushNow(timeoutMs){
      timeoutMs = clamp(timeoutMs || 450, 120, 2000);

      // try known flush hooks
      const start = now();
      return new Promise(function(resolve){
        function done(){ resolve(true); }
        let finished = false;
        function fin(){ if (finished) return; finished = true; done(); }

        try{
          if (root.HHA_Logger && typeof root.HHA_Logger.flush === 'function'){
            const r = root.HHA_Logger.flush();
            if (r && typeof r.then === 'function'){
              r.then(fin).catch(fin);
            } else fin();
            return;
          }
          if (root.hhaCloudLogger && typeof root.hhaCloudLogger.flush === 'function'){
            const r2 = root.hhaCloudLogger.flush();
            if (r2 && typeof r2.then === 'function'){
              r2.then(fin).catch(fin);
            } else fin();
            return;
          }
          if (root.HHACloudLogger && typeof root.HHACloudLogger.flush === 'function'){
            const r3 = root.HHACloudLogger.flush();
            if (r3 && typeof r3.then === 'function'){
              r3.then(fin).catch(fin);
            } else fin();
            return;
          }
        }catch(_e){}

        // fallback: dispatch event; let external logger listen
        try{ emit('hha:flush', { queued: q.length }); }catch(_e){}

        // timebox
        const tick = function(){
          if (finished) return;
          if ((now() - start) >= timeoutMs) { fin(); return; }
          root.setTimeout(tick, 40);
        };
        tick();
      });
    }

    return { hasCloud:hasCloud, logEvent:logEvent, flushNow:flushNow };
  })();

  // ------------------------- Engine State -------------------------
  const S = {
    running:false,
    ended:false,

    runMode:'play', // play|research
    diff:'normal',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // view shift (VR feel)
    vx:0, vy:0, dragOn:false, dragX:0, dragY:0,

    // timers
    left:90,
    spawnTimer:0,
    tickTimer:0,

    // stats
    score:0,
    combo:0,
    comboMax:0,
    misses:0,

    hitGood:0,
    hitJunk:0,
    hitStar:0,
    hitDiamond:0,

    // plate counts
    cVeg:0, cProtein:0, cCarb:0, cFruit:0,

    // fever/shield
    fever:0,          // 0..100
    shield:0,         // 0/1

    // base params (diff)
    spawnMs:700,
    ttlMs:1650,
    size:1.0,
    junkBias:0.15,
    puBias:0.028,
    goalBase:13,

    // adaptive (play only)
    adapt:{
      spawnMs:700,
      ttlMs:1650,
      size:1.0,
      junkBias:0.15,
      puBias:0.028
    },

    // mini quest runtime
    miniActive:null,
    miniNoJunk:true,
    miniStartMs:0,
    miniEndMs:0,
    miniUrgent:false,

    // quest progress
    goalsCleared:0, goalsTotal:5,
    miniCleared:0,
    miniCounts:{},
    goalIndex:0
  };

  // ------------------------- HUD updates -------------------------
  function accPct(){
    const tot = S.hitGood + S.hitJunk;
    if (tot <= 0) return 0;
    return Math.round((S.hitGood / tot) * 100);
  }

  function ratioScore(){
    // target: veg+fruit 50%, carb 25%, protein 25%
    const total = S.cVeg + S.cFruit + S.cCarb + S.cProtein;
    if (total <= 0) return 0;

    const pVegFruit = (S.cVeg + S.cFruit) / total;
    const pCarb = S.cCarb / total;
    const pProtein = S.cProtein / total;

    const d1 = Math.abs(pVegFruit - 0.50);
    const d2 = Math.abs(pCarb - 0.25);
    const d3 = Math.abs(pProtein - 0.25);

    // convert to 0..1 (1=perfect)
    const score = 1 - clamp((d1 + d2 + d3) / 0.9, 0, 1);
    return score;
  }

  function updateRank(){
    const acc = accPct();
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateScore(){
    emit('hha:score', { score: S.score|0, combo: S.combo|0, comboMax: S.comboMax|0, misses: S.misses|0 });
    updateRank();
  }
  function updateTime(){
    emit('hha:time', { left: S.left|0 });
  }

  function questUpdate(){
    const goal = GOALS[S.goalIndex] || GOALS[GOALS.length-1];
    const mini = S.miniActive;

    const d = {
      goalTitle: goal.title,
      goalNow: goal.now(),
      goalTotal: goal.total(),

      miniTitle: mini ? mini.title : '—',
      miniNow: mini ? mini.now() : 0,
      miniTotal: mini ? mini.total() : 0,
      miniLeftMs: mini ? Math.max(0, S.miniEndMs - now()) : 0
    };
    emit('quest:update', d);
  }

  // ------------------------- fever / shield -------------------------
  function setFever(v){
    S.fever = clamp(v, 0, 100);
    emit('hha:fever', { value:S.fever|0, shield:S.shield|0 });

    if (FeverUI && typeof FeverUI.set === 'function'){
      try{ FeverUI.set(S.fever); }catch(_e){}
    }else if (FeverUI && typeof FeverUI.setFever === 'function'){
      try{ FeverUI.setFever(S.fever); }catch(_e){}
    }
  }

  function addFever(dv){
    const prev = S.fever;
    setFever(prev + dv);

    // grant shield on full
    if (prev < 100 && S.fever >= 100){
      S.shield = 1;
      // reset fever to 0 for next cycle
      setFever(0);
      emit('hha:judge', { kind:'good', text:'SHIELD READY!' });
      Particles.celebrate({ kind:'mini', title:'SHIELD READY!' });
      Log.logEvent('shield_ready', { shield:1 });
    }
  }

  // ------------------------- VR feel: view shift -------------------------
  function applyView(){
    // translate only; targets live inside
    layer.style.transform = 'translate(' + S.vx.toFixed(1) + 'px,' + S.vy.toFixed(1) + 'px)';
  }

  function setupView(){
    layer.addEventListener('pointerdown', function(e){
      S.dragOn = true;
      S.dragX = e.clientX;
      S.dragY = e.clientY;
    }, { passive:true });

    root.addEventListener('pointermove', function(e){
      if (!S.dragOn) return;
      const dx = e.clientX - S.dragX;
      const dy = e.clientY - S.dragY;
      S.dragX = e.clientX;
      S.dragY = e.clientY;
      S.vx = clamp(S.vx + dx*0.22, -90, 90);
      S.vy = clamp(S.vy + dy*0.22, -90, 90);
      applyView();
    }, { passive:true });

    root.addEventListener('pointerup', function(){ S.dragOn=false; }, { passive:true });

    root.addEventListener('deviceorientation', function(ev){
      const gx = Number(ev.gamma)||0;
      const gy = Number(ev.beta)||0;
      // gentle: same feel as Groups/Hydration
      S.vx = clamp(S.vx + gx*0.06, -90, 90);
      S.vy = clamp(S.vy + (gy-20)*0.02, -90, 90);
      applyView();
    }, { passive:true });
  }

  // ------------------------- spawn safe zone (clamp around HUD) -------------------------
  function hudRect(){
    const hud = DOC.querySelector('.hud-top');
    if (!hud) return null;
    try{ return hud.getBoundingClientRect(); }catch(_e){ return null; }
  }

  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    const sideBase = 16;
    const bottomBase = 170;
    let topBase = 150;

    const rHud = hudRect();
    if (rHud && rHud.bottom && rHud.bottom > 30){
      topBase = Math.max(120, Math.min(H*0.55, rHud.bottom + 14));
    }

    // clamp: respect safe-area too (CSS already), but keep physical margins
    const x0 = sideBase;
    const x1 = W - sideBase;
    const y0 = topBase;
    const y1 = H - bottomBase;

    // relax if too small
    if ((x1 - x0) < 180){
      const pad = Math.max(8, Math.floor((W - 180)/2));
      return { W:W, H:H, x0:pad, x1:W-pad, y0:y0, y1:y1 };
    }
    if ((y1 - y0) < 220){
      const extra = Math.max(8, Math.floor((H - 220)/2));
      return { W:W, H:H, x0:x0, x1:x1, y0:extra, y1:H-extra };
    }
    return { W:W, H:H, x0:x0, x1:x1, y0:y0, y1:y1 };
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + S.rng()*(r.x1 - r.x0);
    const y = r.y0 + S.rng()*(r.y1 - r.y0);
    return { x:x, y:y };
  }

  // ------------------------- targets -------------------------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1) + 'px');
    el.style.setProperty('--y', y.toFixed(1) + 'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }
  function makeTarget(type, emoji, x, y, scale){
    const el = DOC.createElement('div');
    el.className = 'plate-target';
    el.dataset.type = String(type||'good');
    el.dataset.emoji = String(emoji||'✨');

    // style
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.transform = 'translate(var(--x), var(--y)) scale(var(--s))';
    el.style.willChange = 'transform, opacity, filter';
    el.style.userSelect = 'none';
    el.style.touchAction = 'none';

    el.style.setProperty('--s', String(scale||1));
    setXY(el, x, y);

    // visual
    const ring = DOC.createElement('div');
    ring.className = 'plate-ring';
    ring.style.position = 'absolute';
    ring.style.inset = '-10px';
    ring.style.borderRadius = '999px';
    ring.style.border = '2px solid rgba(148,163,184,.22)';
    ring.style.boxShadow = '0 12px 40px rgba(0,0,0,.25), inset 0 0 0 1px rgba(148,163,184,.10)';
    ring.style.pointerEvents = 'none';

    const core = DOC.createElement('div');
    core.className = 'plate-core';
    core.textContent = emoji;
    core.style.position = 'relative';
    core.style.width = '68px';
    core.style.height = '68px';
    core.style.display = 'grid';
    core.style.placeItems = 'center';
    core.style.fontSize = '38px';
    core.style.borderRadius = '999px';
    core.style.background = 'rgba(2,6,23,.62)';
    core.style.border = '1px solid rgba(148,163,184,.20)';
    core.style.boxShadow = '0 20px 70px rgba(0,0,0,.45)';
    core.style.pointerEvents = 'none';

    // color accents by type
    if (type === 'junk'){
      ring.style.borderColor = 'rgba(239,68,68,.35)';
      core.style.background = 'rgba(127,29,29,.20)';
    }else if (type === 'star'){
      ring.style.borderColor = 'rgba(34,197,94,.40)';
      core.style.background = 'rgba(34,197,94,.12)';
    }else if (type === 'diamond'){
      ring.style.borderColor = 'rgba(34,211,238,.40)';
      core.style.background = 'rgba(34,211,238,.10)';
    }else if (type === 'shield'){
      ring.style.borderColor = 'rgba(167,139,250,.40)';
      core.style.background = 'rgba(167,139,250,.10)';
    }else{
      ring.style.borderColor = 'rgba(34,197,94,.26)';
      core.style.background = 'rgba(34,197,94,.08)';
    }

    el.appendChild(ring);
    el.appendChild(core);

    // TTL
    const ttl = S.ttlMs;
    el._ttlTimer = root.setTimeout(function(){
      if (!el.isConnected) return;

      // expire => miss only for GOOD
      if (String(el.dataset.type) === 'good'){
        S.misses++;
        S.combo = 0;
        addFever(-10);
        emit('hha:judge', { kind:'warn', text:'MISS!' });
        Log.logEvent('miss_expire', { kind:'good', emoji:el.dataset.emoji||'' });
        updateScore();
        checkGoalProgress();
        checkMiniOnMissOrJunk(true);
        questUpdate();
      }
      el.style.opacity = '0';
      el.style.filter = 'blur(2px)';
      root.setTimeout(function(){ try{ el.remove(); }catch(_e){} }, 220);
    }, ttl);

    el.addEventListener('pointerdown', function(ev){
      ev.preventDefault && ev.preventDefault();
      hitTarget(el);
    }, { passive:false });

    return el;
  }

  function removeTarget(el){
    try{ root.clearTimeout(el._ttlTimer); }catch(_e){}
    el.style.opacity = '0';
    el.style.transform = 'translate(var(--x), var(--y)) scale(var(--s))';
    root.setTimeout(function(){ try{ el.remove(); }catch(_e){} }, 200);
  }

  function clearAllTargets(){
    const list = layer.querySelectorAll('.plate-target');
    for (let i=0;i<list.length;i++){
      const el = list[i];
      try{ root.clearTimeout(el._ttlTimer); }catch(_e){}
      try{ el.remove(); }catch(_e){}
    }
  }

  // ------------------------- choose spawn type -------------------------
  function chooseType(){
    // powerup chance
    const pu = S.puBias;
    const r0 = S.rng();

    if (r0 < pu){
      const r1 = S.rng();
      if (r1 < 0.55) return 'star';
      if (r1 < 0.82) return 'diamond';
      return 'shield';
    }

    // junk
    if (S.rng() < S.junkBias) return 'junk';
    return 'good';
  }

  function chooseEmoji(type){
    if (type === 'junk') return pick(S.rng, JUNK);
    if (type === 'star') return STAR;
    if (type === 'diamond') return DIAMOND;
    if (type === 'shield') return SHIELD;

    // good: bias toward balancing (help player reach ratio)
    const total = S.cVeg + S.cFruit + S.cCarb + S.cProtein;
    if (total < 6){
      const g = pick(S.rng, GROUPS);
      return pick(S.rng, g.emoji);
    }

    // compute deficit vs target
    const tVegFruit = 0.50;
    const tCarb = 0.25;
    const tProtein = 0.25;

    const pVegFruit = (S.cVeg + S.cFruit) / Math.max(1, total);
    const pCarb = S.cCarb / Math.max(1, total);
    const pProtein = S.cProtein / Math.max(1, total);

    const defVegFruit = tVegFruit - pVegFruit;
    const defCarb = tCarb - pCarb;
    const defProtein = tProtein - pProtein;

    // choose category with biggest deficit (ties random)
    let best = 'veg';
    let bestV = defVegFruit;
    if (defCarb > bestV){ bestV = defCarb; best = 'carb'; }
    if (defProtein > bestV){ bestV = defProtein; best = 'protein'; }

    if (best === 'veg'){
      // veg or fruit
      if (S.rng() < 0.60) return pick(S.rng, GROUPS[0].emoji);
      return pick(S.rng, GROUPS[3].emoji);
    }
    if (best === 'carb') return pick(S.rng, GROUPS[2].emoji);
    if (best === 'protein') return pick(S.rng, GROUPS[1].emoji);

    return pick(S.rng, GROUPS[0].emoji);
  }

  // ------------------------- hit logic -------------------------
  function addGoodCount(em){
    const g = groupOfEmoji(em);
    if (g === 'veg') S.cVeg++;
    else if (g === 'fruit') S.cFruit++;
    else if (g === 'carb') S.cCarb++;
    else if (g === 'protein') S.cProtein++;
  }

  function scoreAdd(n){
    S.score += (n|0);
  }

  function hitTarget(el){
    if (!S.running || S.ended) return;
    if (!el || !el.isConnected) return;

    const type = String(el.dataset.type||'good');
    const emoji = String(el.dataset.emoji||'');

    // compute click point for FX
    let cx=0, cy=0;
    try{
      const r = el.getBoundingClientRect();
      cx = r.left + r.width/2;
      cy = r.top + r.height/2;
    }catch(_e){}

    if (type === 'star'){
      S.hitStar++;
      S.combo = clamp(S.combo + 1, 0, 9999);
      S.comboMax = Math.max(S.comboMax, S.combo);

      scoreAdd(120 + (S.combo*2));
      addFever(+18);

      emit('hha:judge', { kind:'good', text:'STAR!' });
      Particles.burstAt(cx, cy, { kind:'star' });
      Particles.scorePop(cx, cy, '+STAR', {});

      Log.logEvent('hit', { kind:'star', emoji:STAR, score:S.score|0, combo:S.combo|0 });
      updateScore();
      checkGoalProgress();
      checkMiniOnStar();
      questUpdate();
      removeTarget(el);
      return;
    }

    if (type === 'diamond'){
      S.hitDiamond++;
      S.combo = clamp(S.combo + 1, 0, 9999);
      S.comboMax = Math.max(S.comboMax, S.combo);

      // small time bonus (feel good)
      S.left = Math.min(S.timeSec, S.left + 2.2);
      scoreAdd(140 + (S.combo*2));
      addFever(+12);

      emit('hha:judge', { kind:'good', text:'+TIME!' });
      Particles.burstAt(cx, cy, { kind:'diamond' });
      Particles.scorePop(cx, cy, '+2s', {});

      Log.logEvent('hit', { kind:'diamond', emoji:DIAMOND, left:S.left, score:S.score|0, combo:S.combo|0 });
      updateScore();
      updateTime();
      checkGoalProgress();
      questUpdate();
      removeTarget(el);
      return;
    }

    if (type === 'shield'){
      S.combo = clamp(S.combo + 1, 0, 9999);
      S.comboMax = Math.max(S.comboMax, S.combo);

      S.shield = 1;
      scoreAdd(90);
      addFever(+8);

      emit('hha:judge', { kind:'good', text:'SHIELD!' });
      Particles.celebrate({ kind:'mini', title:'SHIELD +1' });
      Log.logEvent('hit', { kind:'shield', emoji:SHIELD, shield:1 });

      updateScore();
      questUpdate();
      removeTarget(el);
      return;
    }

    // GOOD/JUNK
    if (type === 'good'){
      S.hitGood++;
      addGoodCount(emoji);

      S.combo = clamp(S.combo + 1, 0, 9999);
      S.comboMax = Math.max(S.comboMax, S.combo);

      const rush = (S.miniActive && S.miniActive.id === 'plate_rush') ? 1.25 : 1.0;
      const add = Math.round((100 + S.combo*3) * rush);
      scoreAdd(add);
      addFever(+7);

      emit('hha:judge', { kind:'good', text:'GOOD!' });
      Particles.burstAt(cx, cy, { kind:'good' });
      Particles.scorePop(cx, cy, '+'+add, {});

      Log.logEvent('hit', { kind:'good', emoji:emoji, score:S.score|0, combo:S.combo|0 });

      updateScore();
      checkGoalProgress();
      checkMiniOnGood();
      questUpdate();
      removeTarget(el);
      return;
    }

    if (type === 'junk'){
      S.hitJunk++;

      // shield block
      if (S.shield > 0){
        S.shield = 0;
        S.combo = Math.max(0, S.combo - 1);
        addFever(-4);

        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        Particles.scorePop(cx, cy, 'BLOCK', {});
        Log.logEvent('shield_block', { kind:'junk', emoji:emoji });

        updateScore();
        checkGoalProgress();
        checkMiniOnMissOrJunk(false); // counts as "junk touched" for mini no-junk
        questUpdate();
        removeTarget(el);
        return;
      }

      // normal junk => miss
      S.misses++;
      S.combo = 0;
      addFever(-12);

      emit('hha:judge', { kind:'bad', text:'JUNK!' });
      Particles.burstAt(cx, cy, { kind:'bad' });
      Particles.scorePop(cx, cy, 'JUNK', {});
      Log.logEvent('hit', { kind:'junk', emoji:emoji, misses:S.misses|0 });

      updateScore();
      checkGoalProgress();
      checkMiniOnMissOrJunk(false);
      questUpdate();
      removeTarget(el);
      return;
    }
  }

  // ------------------------- Goals (Concept 1–5) -------------------------
  // 1) Build Plate: เก็บ good ให้ถึงเป้า
  // 2) Clean Plate: จบ goal2 แบบ junk hit จำกัด
  // 3) Accuracy Gate: ต้อง >= 88% (ตามที่สั่ง)
  // 4) Balance Ratio: สัดส่วนใกล้ 50/25/25
  // 5) Streak Master: ทำ combo ถึงเป้า
  const GOALS = [
    {
      id:'build_plate',
      title:'Goal 1: เติมจานให้ครบ (เก็บอาหารดี)',
      total:function(){ return S.goalBase; },
      now:function(){ return S.hitGood; },
      done:function(){ return S.hitGood >= S.goalBase; }
    },
    {
      id:'clean_plate',
      title:'Goal 2: จานสะอาด (JUNK ≤ 1)',
      total:function(){ return 1; },
      now:function(){ return Math.min(1, S.hitJunk); }, // show 0/1 or 1/1
      done:function(){ return (S.hitGood >= Math.max(8, Math.floor(S.goalBase*0.65))) && (S.hitJunk <= 1); }
    },
    {
      id:'accuracy_88',
      title:'Goal 3: Accuracy ≥ 88%',
      total:function(){ return 88; },
      now:function(){ return accPct(); },
      done:function(){
        // require some volume so it’s not cheesed
        const tot = S.hitGood + S.hitJunk;
        if (tot < 12) return false;
        return accPct() >= 88;
      }
    },
    {
      id:'balance_ratio',
      title:'Goal 4: สัดส่วนสมดุล (2:1:1)',
      total:function(){ return 100; },
      now:function(){ return Math.round(ratioScore()*100); },
      done:function(){
        const total = S.cVeg + S.cFruit + S.cCarb + S.cProtein;
        if (total < 12) return false;
        return ratioScore() >= 0.85;
      }
    },
    {
      id:'streak_master',
      title:'Goal 5: Streak Master (Combo ≥ 10)',
      total:function(){ return 10; },
      now:function(){ return Math.min(10, S.comboMax); },
      done:function(){ return S.comboMax >= 10; }
    }
  ];

  function advanceGoal(){
    if (S.goalIndex >= GOALS.length) return;
    if (!GOALS[S.goalIndex].done()) return;

    S.goalsCleared++;
    const g = GOALS[S.goalIndex];
    Particles.celebrate({ kind:'goal', title:'GOAL CLEARED!' });
    emit('hha:celebrate', { kind:'goal', title:'GOAL CLEARED' });
    Log.logEvent('goal_cleared', { goalId:g.id, goalsCleared:S.goalsCleared|0 });

    S.goalIndex = Math.min(GOALS.length-1, S.goalIndex + 1);

    // coach tease
    emit('hha:coach', { mood:'happy', text:'เยี่ยม! ไปต่อ Goal ถัดไปเลย 🔥' });
  }

  function checkGoalProgress(){
    advanceGoal();
    // if all goals done -> big celebration (but keep playing until time ends)
    if (S.goalsCleared >= S.goalsTotal){
      Particles.celebrate({ kind:'all', title:'ALL GOALS COMPLETE!' });
      emit('hha:celebrate', { kind:'all', title:'ALL GOALS COMPLETE' });
    }
  }

  // ------------------------- Minis (5 types, balanced picker) -------------------------
  function miniRegister(id){
    if (!S.miniCounts[id]) S.miniCounts[id] = 0;
  }
  function miniPickBalanced(ids){
    // pick least-used; tie-break rng
    let best = ids[0], bestC = 1e9;
    for (let i=0;i<ids.length;i++){
      const id = ids[i];
      miniRegister(id);
      const c = S.miniCounts[id] || 0;
      if (c < bestC){ bestC = c; best = id; }
      else if (c === bestC && S.rng() < 0.40){ best = id; }
    }
    S.miniCounts[best] = (S.miniCounts[best]||0) + 1;
    return best;
  }

  function miniStart(mini){
    S.miniActive = mini;
    S.miniNoJunk = true;
    S.miniStartMs = now();
    S.miniEndMs = S.miniStartMs + (mini.durMs|0);
    S.miniUrgent = false;

    // reset mini internal counters
    if (typeof mini.reset === 'function'){ mini.reset(); }

    Particles.celebrate({ kind:'mini', title: mini.title });
    emit('hha:judge', { kind:'good', text:'MINI START!' });
    Log.logEvent('mini_start', { miniId: mini.id });

    questUpdate();
  }

  function miniSucceed(){
    const m = S.miniActive;
    if (!m) return;

    S.miniCleared++;
    Particles.celebrate({ kind:'mini', title:'MINI CLEARED!' });
    emit('hha:judge', { kind:'good', text:'MINI CLEARED!' });
    Log.logEvent('mini_cleared', { miniId:m.id, miniCleared:S.miniCleared|0 });

    S.miniActive = null;
    S.miniUrgent = false;
    questUpdate();

    // start next after a short breath
    root.setTimeout(function(){
      if (!S.running || S.ended) return;
      startNextMini();
    }, 650);
  }

  function miniFail(reason){
    const m = S.miniActive;
    if (!m) return;

    emit('hha:judge', { kind:'warn', text:'MINI FAIL!' });
    Log.logEvent('mini_fail', { miniId:m.id, reason:String(reason||'fail') });

    S.miniActive = null;
    S.miniUrgent = false;
    questUpdate();

    root.setTimeout(function(){
      if (!S.running || S.ended) return;
      startNextMini();
    }, 650);
  }

  const MINI_DEFS = {
    plate_rush: {
      id:'plate_rush',
      title:'Plate Rush ⚡ 5 ภายใน 8 วิ (ห้ามโดนขยะ)',
      durMs: 8000,
      _count:0,
      reset:function(){ this._count = 0; },
      onGood:function(){ this._count++; },
      onJunk:function(){ S.miniNoJunk = false; },
      onStar:function(){},
      now:function(){ return this._count|0; },
      total:function(){ return 5; },
      check:function(){
        if (!S.miniNoJunk) return { ok:false, fail:true, reason:'junk' };
        if ((this._count|0) >= 5) return { ok:true, fail:false };
        return { ok:false, fail:false };
      }
    },
    veg_boost: {
      id:'veg_boost',
      title:'Veg Boost 🥦 เก็บผัก 4 ภายใน 7 วิ',
      durMs: 7000,
      _count:0,
      reset:function(){ this._count = 0; },
      onGood:function(em){
        if (groupOfEmoji(em) === 'veg') this._count++;
      },
      onJunk:function(){},
      onStar:function(){},
      now:function(){ return this._count|0; },
      total:function(){ return 4; },
      check:function(){
        if ((this._count|0) >= 4) return { ok:true, fail:false };
        return { ok:false, fail:false };
      }
    },
    protein_power: {
      id:'protein_power',
      title:'Protein Power 💪 โปรตีน 3 ภายใน 6 วิ',
      durMs: 6000,
      _count:0,
      reset:function(){ this._count = 0; },
      onGood:function(em){
        if (groupOfEmoji(em) === 'protein') this._count++;
      },
      onJunk:function(){},
      onStar:function(){},
      now:function(){ return this._count|0; },
      total:function(){ return 3; },
      check:function(){
        if ((this._count|0) >= 3) return { ok:true, fail:false };
        return { ok:false, fail:false };
      }
    },
    clean_streak: {
      id:'clean_streak',
      title:'Clean Streak ✨ ดีติดกัน 6 (ภายใน 12 วิ)',
      durMs: 12000,
      _count:0,
      reset:function(){ this._count = 0; },
      onGood:function(){ this._count++; },
      onJunk:function(){ this._count = 0; }, // breaks streak
      onStar:function(){},
      now:function(){ return this._count|0; },
      total:function(){ return 6; },
      check:function(){
        if ((this._count|0) >= 6) return { ok:true, fail:false };
        return { ok:false, fail:false };
      }
    },
    star_hunt: {
      id:'star_hunt',
      title:'Star Hunt ⭐ เก็บดาว 2 ภายใน 10 วิ',
      durMs: 10000,
      _count:0,
      reset:function(){ this._count = 0; },
      onGood:function(){},
      onJunk:function(){},
      onStar:function(){ this._count++; },
      now:function(){ return this._count|0; },
      total:function(){ return 2; },
      check:function(){
        if ((this._count|0) >= 2) return { ok:true, fail:false };
        return { ok:false, fail:false };
      }
    }
  };

  const MINI_IDS = ['plate_rush','veg_boost','protein_power','clean_streak','star_hunt'];

  function startNextMini(){
    const id = miniPickBalanced(MINI_IDS);
    const def = MINI_DEFS[id];
    miniStart(def);
  }

  function checkMiniTimer(){
    const m = S.miniActive;
    if (!m) return;

    const t = now();
    const leftMs = S.miniEndMs - t;

    // urgent fx (last 1.4s) + tick sound
    if (leftMs <= 1400 && leftMs > 0){
      if (!S.miniUrgent){
        S.miniUrgent = true;
        DOC.body.classList.add('plate-mini-urgent');
      }
      AudioTick.beep(clamp(1 - (leftMs/1400), 0, 1));
    }else{
      if (S.miniUrgent){
        S.miniUrgent = false;
        DOC.body.classList.remove('plate-mini-urgent');
      }
    }

    // pass/fail check
    const res = m.check();
    if (res && res.ok){ miniSucceed(); return; }
    if (res && res.fail){ miniFail(res.reason || 'fail'); return; }

    if (leftMs <= 0){
      // Plate Rush additional rule: fail if not completed
      miniFail('timeout');
      return;
    }
  }

  function checkMiniOnGood(){
    const m = S.miniActive;
    if (!m) return;
    const lastEmoji = ''; // not needed here
    if (typeof m.onGood === 'function'){
      // pass emoji by reading the last hit from log? we call from hitTarget directly with emoji
    }
  }
  function checkMiniOnGoodDirect(emoji){
    const m = S.miniActive;
    if (!m) return;
    if (typeof m.onGood === 'function') m.onGood(emoji);
  }
  function checkMiniOnStar(){
    const m = S.miniActive;
    if (!m) return;
    if (typeof m.onStar === 'function') m.onStar();
  }
  function checkMiniOnMissOrJunk(isExpire){
    const m = S.miniActive;
    if (!m) return;
    // expire good => breaks "no junk"? not necessarily; we keep no-junk for plate rush only
    // but clean streak should break on junk; expire already handled by combo reset; we just let timer run.
    if (!isExpire){
      if (typeof m.onJunk === 'function') m.onJunk();
    }
    if (m.id === 'plate_rush' && !isExpire){
      // plate rush: no junk rule
      S.miniNoJunk = false;
    }
  }

  // hook mini counters from hit logic (we call direct)
  function miniOnGood(emoji){
    const m = S.miniActive;
    if (!m) return;
    if (typeof m.onGood === 'function') m.onGood(emoji);
  }
  function miniOnJunk(){
    const m = S.miniActive;
    if (!m) return;
    if (typeof m.onJunk === 'function') m.onJunk();
    if (m.id === 'plate_rush') S.miniNoJunk = false;
  }
  function miniOnStar(){
    const m = S.miniActive;
    if (!m) return;
    if (typeof m.onStar === 'function') m.onStar();
  }

  // patch into hitTarget by wrapping (simple, safe)
  const _hitTarget = hitTarget;
  hitTarget = function(el){
    // intercept good/junk/star updates for mini
    if (!el || !el.isConnected) return _hitTarget(el);
    const tp = String(el.dataset.type||'good');
    const em = String(el.dataset.emoji||'');
    _hitTarget(el);
    if (!S.running || S.ended) return;
    if (!S.miniActive) return;

    if (tp === 'good') miniOnGood(em);
    else if (tp === 'junk') miniOnJunk();
    else if (tp === 'star') miniOnStar();
  };

  // ------------------------- spawn loop -------------------------
  function spawnOne(){
    if (!S.running || S.ended) return;

    const tp = chooseType();
    const em = chooseEmoji(tp);
    const p = randPos();

    const baseScale = S.size;
    let sc = baseScale;
    if (tp === 'junk') sc *= 0.96;
    if (tp === 'star' || tp === 'diamond' || tp === 'shield') sc *= 0.98;

    const el = makeTarget(tp, em, p.x, p.y, sc);
    layer.appendChild(el);

    Log.logEvent('spawn', { kind:tp, emoji:em });
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;

    spawnOne();

    const ms = Math.max(380, S.spawnMs);
    S.spawnTimer = root.setTimeout(loopSpawn, ms);
  }

  // ------------------------- tick loop (time + adaptive + fever decay + mini timer) -------------------------
  function adaptiveTick(){
    if (S.runMode !== 'play') return;

    const tot = S.hitGood + S.hitJunk;
    const acc = (tot>0) ? (S.hitGood/tot) : 0;
    const heat = clamp((S.combo/16) + (acc - 0.65), 0, 1);

    // easier when struggling, harder when strong
    S.adapt.spawnMs = clamp(780 - heat*240, 460, 880);
    S.adapt.ttlMs   = clamp(1720 - heat*260, 1280, 1850);
    S.adapt.size    = clamp(1.03 - heat*0.11, 0.86, 1.06);
    S.adapt.junkBias= clamp(0.13 + heat*0.06, 0.10, 0.23);
    S.adapt.puBias  = clamp(0.030 - heat*0.005, 0.020, 0.034);

    S.spawnMs  = S.adapt.spawnMs;
    S.ttlMs    = S.adapt.ttlMs;
    S.size     = S.adapt.size;
    S.junkBias = S.adapt.junkBias;
    S.puBias   = S.adapt.puBias;
  }

  function loopTick(){
    if (!S.running || S.ended) return;

    adaptiveTick();

    // time
    S.left = Math.max(0, S.left - 0.14);
    updateTime();

    // fever decay gentle
    if (S.fever > 0) setFever(S.fever - 0.22);

    // mini timer + urgent fx class
    checkMiniTimer();

    // goals check
    checkGoalProgress();
    questUpdate();

    if (S.left <= 0){
      endGame('time');
      return;
    }

    S.tickTimer = root.setTimeout(loopTick, 140);
  }

  // ------------------------- End Overlay binding (reuse ids) -------------------------
  let endBound = false;
  function ensureEndOverlay(){
    const wrap = DOC.getElementById('endOverlay');
    if (!wrap) return null;

    if (!endBound){
      endBound = true;

      const btnRetry = DOC.getElementById('btnRetry');
      const btnBack = DOC.getElementById('btnBackHub');

      if (btnRetry){
        btnRetry.addEventListener('click', function(){
          // flush then reload
          flushBeforeLeave().then(function(){
            try{ root.location.reload(); }catch(_e){ root.location.href = root.location.href; }
          });
        }, { passive:true });
      }

      if (btnBack){
        btnBack.addEventListener('click', function(){
          PlateBoot.goHub();
        }, { passive:true });
      }
    }

    return wrap;
  }

  function showEnd(detail){
    const wrap = ensureEndOverlay();
    if (!wrap) return;

    // fill ids
    const s = DOC.getElementById('endScore'); if (s) s.textContent = String(detail.scoreFinal ?? 0);
    const r = DOC.getElementById('endRank');  if (r) r.textContent = String(detail.grade ?? 'C');
    const a = DOC.getElementById('endAcc');   if (a) a.textContent = String((detail.accuracyGoodPct ?? 0)|0) + '%';
    const cm= DOC.getElementById('endComboMax'); if (cm) cm.textContent = String(detail.comboMax ?? 0);
    const ms= DOC.getElementById('endMiss');     if (ms) ms.textContent = String(detail.misses ?? 0);

    const gl= DOC.getElementById('endGoals');
    if (gl) gl.textContent = String(detail.goalsCleared ?? 0) + '/' + String(detail.goalsTotal ?? 0);

    const mn= DOC.getElementById('endMinis');
    if (mn) mn.textContent = String(detail.miniCleared ?? 0) + '/' + String(detail.miniTotal ?? 0);

    wrap.style.display = 'flex';
  }

  // ------------------------- Flush hardened navigation -------------------------
  function storeLastSummary(d){
    try{
      root.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(d||{}));
      root.localStorage.setItem('hha_last_summary', JSON.stringify(d||{}));
    }catch(_e){}
  }

  function flushBeforeLeave(){
    // timebox flush; still safe if no logger
    return Log.flushNow(520);
  }

  function hubUrl(){
    const hub = String(qs('hub','../hub.html') || '../hub.html');
    try{
      const u = new URL(hub, root.location.href);
      u.searchParams.set('ts', String(Date.now()));
      return u.toString();
    }catch(_e){
      return hub;
    }
  }

  // pagehide/beforeunload hard flush
  function attachLeaveGuards(){
    root.addEventListener('pagehide', function(){
      try{ Log.flushNow(220); }catch(_e){}
    }, { passive:true });

    root.addEventListener('beforeunload', function(){
      try{ Log.flushNow(220); }catch(_e){}
    });
  }

  // ------------------------- end game -------------------------
  function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    try{ root.clearTimeout(S.spawnTimer); }catch(_e){}
    try{ root.clearTimeout(S.tickTimer); }catch(_e){}
    clearAllTargets();

    DOC.body.classList.remove('plate-mini-urgent');

    // final metrics
    const acc = accPct();
    const grade = rankFromAcc(acc);

    // mini total “attempted so far” = cleared + (active?1:0) but at end no active
    const miniTotal = S.miniCleared;

    const detail = {
      reason: String(reason||'end'),
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,
      accuracyGoodPct: acc|0,
      grade: grade,
      goalsCleared: S.goalsCleared|0,
      goalsTotal: S.goalsTotal|0,
      miniCleared: S.miniCleared|0,
      miniTotal: miniTotal|0,
      diff: S.diff,
      runMode: S.runMode,
      seed: S.seed,
      cVeg:S.cVeg|0, cFruit:S.cFruit|0, cCarb:S.cCarb|0, cProtein:S.cProtein|0,
      ratioScorePct: Math.round(ratioScore()*100)
    };

    storeLastSummary(detail);

    Log.logEvent('end', detail);
    emit('hha:end', detail);

    // flush, then show overlay
    flushBeforeLeave().then(function(){
      showEnd(detail);
    });
  }

  // ------------------------- Start / Boot API -------------------------
  function resetState(runMode, cfg){
    cfg = cfg || {};

    S.runMode = (String(runMode||'play').toLowerCase() === 'research') ? 'research' : 'play';
    S.diff = String(cfg.diff || qs('diff','normal')).toLowerCase();

    S.timeSec = clamp(cfg.time != null ? cfg.time : Number(qs('time', 90)), 30, 600);
    S.left = S.timeSec;

    const sid = String(qs('sessionId', qs('studentKey','')) || '');
    const ts = String(qs('ts', Date.now()));
    const seed = String(cfg.seed || qs('seed', sid ? (sid + '|' + ts) : ts));
    S.seed = seed;
    S.rng = makeRng(seed);

    const dp = diffParams(S.diff);
    S.spawnMs = dp.spawnMs;
    S.ttlMs   = dp.ttlMs;
    S.size    = dp.size;
    S.junkBias= dp.junkBias;
    S.puBias  = dp.puBias;
    S.goalBase= dp.goalBase;

    S.adapt.spawnMs = dp.spawnMs;
    S.adapt.ttlMs   = dp.ttlMs;
    S.adapt.size    = dp.size;
    S.adapt.junkBias= dp.junkBias;
    S.adapt.puBias  = dp.puBias;

    // stats
    S.score=0; S.combo=0; S.comboMax=0; S.misses=0;
    S.hitGood=0; S.hitJunk=0; S.hitStar=0; S.hitDiamond=0;

    S.cVeg=0; S.cFruit=0; S.cCarb=0; S.cProtein=0;

    S.fever=0; S.shield=0;
    setFever(0);

    // view
    S.vx=0; S.vy=0;
    applyView();

    // quests
    S.goalsTotal = GOALS.length;
    S.goalsCleared = 0;
    S.goalIndex = 0;

    S.miniCleared = 0;
    S.miniCounts = {};
    for (let i=0;i<MINI_IDS.length;i++) S.miniCounts[MINI_IDS[i]] = 0;
    S.miniActive = null;

    DOC.body.classList.remove('plate-mini-urgent');
    clearAllTargets();
  }

  function start(runMode, cfg){
    resetState(runMode, cfg);

    S.running = true;
    S.ended = false;

    // begin first mini quickly (so distribution starts)
    root.setTimeout(function(){
      if (!S.running || S.ended) return;
      startNextMini();
      questUpdate();
    }, 550);

    updateTime();
    updateScore();
    questUpdate();

    Log.logEvent('start', { runMode:S.runMode, diff:S.diff, timeSec:S.timeSec, seed:S.seed });

    loopSpawn();
    loopTick();
  }

  // ------------------------- Public API (PlateBoot) -------------------------
  const PlateBoot = (root.PlateBoot = root.PlateBoot || {});

  PlateBoot.start = start;

  PlateBoot.flushNow = function(){
    return flushBeforeLeave();
  };

  PlateBoot.goHub = function(){
    // If not running, just go
    const url = hubUrl();

    // if game is running, end with reason hub? (but don’t show end overlay; just flush then leave)
    if (!S.ended){
      // mark ended without overlay spam
      S.ended = true;
      S.running = false;

      try{ root.clearTimeout(S.spawnTimer); }catch(_e){}
      try{ root.clearTimeout(S.tickTimer); }catch(_e){}
      clearAllTargets();
      DOC.body.classList.remove('plate-mini-urgent');

      const acc = accPct();
      const grade = rankFromAcc(acc);

      const detail = {
        reason:'hub',
        scoreFinal:S.score|0,
        comboMax:S.comboMax|0,
        misses:S.misses|0,
        accuracyGoodPct:acc|0,
        grade:grade,
        goalsCleared:S.goalsCleared|0,
        goalsTotal:S.goalsTotal|0,
        miniCleared:S.miniCleared|0,
        miniTotal:S.miniCleared|0,
        diff:S.diff, runMode:S.runMode, seed:S.seed
      };
      storeLastSummary(detail);
      Log.logEvent('end', detail);
      emit('hha:end', detail);
    }

    flushBeforeLeave().then(function(){
      try{ root.location.href = url; }catch(_e){ root.location.href = String(qs('hub','../hub.html')||'../hub.html'); }
    });
  };

  // ------------------------- init once -------------------------
  setupView();
  attachLeaveGuards();
  ensureEndOverlay(); // bind buttons once, if overlay exists

})(typeof window !== 'undefined' ? window : globalThis);
