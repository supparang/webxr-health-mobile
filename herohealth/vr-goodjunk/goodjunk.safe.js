// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE Engine (PRODUCTION, HHA Standard)
// ✅ Warmup 3s -> gradual ramp (faster)
// ✅ Adaptive in run=play; fixed in run=research (diff-based)
// ✅ Click target OR press ยิง (shoot nearest to crosshair)
// ✅ Caps max targets on screen (no early overwhelm)
// ✅ Miss = good expire + junk hit; shield-block junk NOT miss
// ✅ Hazard dodge uses hha:shift from touch-look-goodjunk.js
// ✅ Best-effort logger flush + last summary localStorage
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end

'use strict';

function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
}

// -------------------- RNG (deterministic) --------------------
function xmur3(str){
  str = String(str || '');
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
  const g = xmur3(String(seed || 'seed'));
  return sfc32(g(), g(), g(), g());
}
function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }
function shuffle(rng, arr){
  for (let i=arr.length-1;i>0;i--){
    const j = (rng()*(i+1))|0;
    const t = arr[i]; arr[i]=arr[j]; arr[j]=t;
  }
  return arr;
}

// -------------------- Optional modules --------------------
function getParticles(){
  const root = window;
  return (root.GAME_MODULES && root.GAME_MODULES.Particles) || root.Particles || {
    scorePop(){}, burstAt(){}, celebrate(){}
  };
}
function getFeverUI(){
  const root = window;
  return (root.GAME_MODULES && root.GAME_MODULES.FeverUI) || root.FeverUI || {
    set(){}, get(){ return { value:0, state:'low', shield:0 }; }, setShield(){}
  };
}

// -------------------- Logger (best effort) --------------------
function logEvent(type, data){
  emit('hha:log_event', { type, data: data || {} });
  try{ if (typeof window.hhaLogEvent === 'function') window.hhaLogEvent(type, data||{}); }catch(_){}
}
async function flushLogger(reason){
  emit('hha:flush', { reason: String(reason||'flush') });

  const fns = [];
  try{ if (window.HHA_CLOUD_LOGGER && typeof window.HHA_CLOUD_LOGGER.flush === 'function') fns.push(window.HHA_CLOUD_LOGGER.flush.bind(window.HHA_CLOUD_LOGGER)); }catch(_){}
  try{ if (window.HHACloudLogger && typeof window.HHACloudLogger.flush === 'function') fns.push(window.HHACloudLogger.flush.bind(window.HHACloudLogger)); }catch(_){}
  try{ if (window.GAME_MODULES && window.GAME_MODULES.CloudLogger && typeof window.GAME_MODULES.CloudLogger.flush === 'function') fns.push(window.GAME_MODULES.CloudLogger.flush.bind(window.GAME_MODULES.CloudLogger)); }catch(_){}
  try{ if (typeof window.hhaFlush === 'function') fns.push(window.hhaFlush.bind(window)); }catch(_){}

  const tasks = fns.map(fn=>{
    try{
      const r = fn({ reason:String(reason||'flush') });
      return (r && typeof r.then === 'function') ? r : Promise.resolve();
    }catch(_){ return Promise.resolve(); }
  });

  await Promise.race([
    Promise.all(tasks),
    new Promise(res=>setTimeout(res, 260))
  ]);
}

// -------------------- Difficulty base --------------------
function diffParams(diff){
  diff = String(diff||'normal').toLowerCase();
  if (diff === 'easy')   return { spawnMs:820, ttl:2000, size:1.05, junk:0.34, shield:0.06, hint:0.05 };
  if (diff === 'hard')   return { spawnMs:620, ttl:1500, size:0.93, junk:0.46, shield:0.04, hint:0.03 };
  return                  { spawnMs:710, ttl:1750, size:1.00, junk:0.40, shield:0.05, hint:0.04 };
}

// -------------------- Grade --------------------
function gradeFromAcc(acc){
  acc = Number(acc)||0;
  if (acc >= 95) return 'SSS';
  if (acc >= 90) return 'SS';
  if (acc >= 85) return 'S';
  if (acc >= 75) return 'A';
  if (acc >= 60) return 'B';
  return 'C';
}

// -------------------- Target pools --------------------
const GOOD = ['🥦','🥬','🥕','🍎','🍇','🍊','🍉','🍌','🍓','🥗','🥒','🌽'];
const JUNK = ['🍟','🍔','🍕','🍩','🍬','🧋','🍭','🍫'];
const BONUS = { hint:'💡', shield:'🛡️' };

// -------------------- Quests (2 goals + 7 minis) --------------------
const GOALS = [
  { title:'เก็บของดีให้ครบ', needGood: 12, maxJunk: 3 },
  { title:'เก็บของดีให้ครบ', needGood: 22, maxJunk: 2 }
];

const MINI_DEFS = [
  { key:'clean',  title:'คลีนอีกรอบ!', desc:'ห้ามโดนขยะ 10 วิ', sec:10, type:'surviveNoJunk' },
  { key:'rush',   title:'สปีดรัน!',    desc:'เก็บของดี 6 ชิ้น',  need:6,  sec:11, type:'collectGood' },
  { key:'combo',  title:'คอมโบมา!',    desc:'ทำคอมโบ 8',         need:8,  sec:20, type:'reachCombo' },
  { key:'shield', title:'ชิลด์ช่วย!',   desc:'บล็อกขยะด้วยชิลด์', need:1,  sec:30, type:'shieldBlock' },
  { key:'fast',   title:'มือไว!',      desc:'ยิงโดน 5 ครั้งติด',  need:5,  sec:12, type:'streak' },
  { key:'dodge',  title:'หลบให้ได้!',  desc:'หลบ Ring/Laser 1 ครั้ง', need:1, sec:30, type:'dodge' },
  { key:'final',  title:'สุดท้าย!',     desc:'เก็บของดี 8 ชิ้นแบบไม่มิส', need:8, sec:14, type:'collectNoMiss' }
];
function makeMiniBag(rng){
  return { bag: shuffle(rng, MINI_DEFS.slice()), idx: 0 };
}

// -------------------- Engine boot --------------------
export function boot(opts = {}){
  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  const shootEl = opts.shootEl || document.getElementById('btnShoot');
  const ringEl  = document.getElementById('atk-ring');
  const laserEl = document.getElementById('atk-laser');

  if (!layerEl){
    console.warn('[GoodJunkVR] layerEl missing (#gj-layer)');
    return;
  }

  const Particles = getParticles();
  const FeverUI = getFeverUI();

  // config
  const diff = String(opts.diff || 'normal').toLowerCase();
  const runMode = (String(opts.run || 'play').toLowerCase() === 'research') ? 'research' : 'play';
  const endPolicy = String(opts.endPolicy || 'time').toLowerCase(); // time|all
  const challenge = String(opts.challenge || 'rush').toLowerCase(); // reserved
  const timeSec = clamp(opts.time ?? 80, 30, 600);
  const seed = String(opts.seed || (Date.now()));
  const rng = makeRng(seed);
  const ctx = opts.context || {};
  const safeMargins = opts.safeMargins || { top:128, bottom:170, left:26, right:26 };
  const hub = String(opts.hub || '../hub.html');

  const view = String(opts.view || detectView()).toLowerCase();

  // state
  const S = {
    running:false, ended:false, flushedEnd:false,

    diff, runMode, endPolicy, challenge, timeSec, seed, view,
    hub,

    tStart:0, left:timeSec,

    // scoring
    score:0, combo:0, comboMax:0,
    misses:0, // miss = good expire + junk hit (unblocked)
    hitAll:0, hitGood:0, hitJunk:0, hitJunkGuard:0,
    expireGood:0,

    // shield
    shield:0,

    // quest
    goalIndex:0, goalsCleared:0, goalsTotal:GOALS.length,
    goalJunkUnblocked:0,
    miniActive:null, miniCleared:0, miniTotal:0,
    miniBag: makeMiniBag(rng),

    // spawn/adapt
    base: diffParams(diff),
    spawnMs: 700,
    ttlMs: 1750,
    size: 1.0,
    junkRate: 0.40,
    maxActive: 6,

    // warmup/ramp
    warmupSec: 3,
    warmupUntil: 0,

    // timers
    spawnTimer:0, tickTimer:0, miniTimer:0, hazardTimer:0,

    // dodge/hazards
    lastShiftMag:0,
    dodgeCount:0,

    hintUntil:0
  };

  // shift magnitude from touch-look
  function onShift(e){
    try{
      const d = e.detail || {};
      const x = Number(d.x)||0, y = Number(d.y)||0;
      S.lastShiftMag = Math.sqrt(x*x + y*y);
    }catch(_){}
  }
  window.addEventListener('hha:shift', onShift, { passive:true });

  // meta + start log
  logEvent('session_start', {
    ...ctx,
    diff:S.diff, runMode:S.runMode, endPolicy:S.endPolicy, challenge:S.challenge,
    seed:S.seed, timeSec:S.timeSec, view:S.view
  });

  // -------------------- helpers --------------------
  function safeRect(){
    const W = window.innerWidth || 360;
    const H = window.innerHeight || 640;

    let left = safeMargins.left|0, right = safeMargins.right|0;
    let top  = safeMargins.top|0,  bottom= safeMargins.bottom|0;

    // relax if screen small
    if ((W-left-right) < 180){ left = 12; right = 12; }
    if ((H-top-bottom) < 260){ top = Math.max(110, top-18); bottom = Math.max(140, bottom-18); }

    return { W,H, x0:left, x1:Math.max(left+20, W-right), y0:top, y1:Math.max(top+20, H-bottom) };
  }
  function randPos(){
    const r = safeRect();
    const x = r.x0 + rng()*(r.x1 - r.x0);
    const y = r.y0 + rng()*(r.y1 - r.y0);
    return { x,y };
  }
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
  }
  function setShield(n){
    S.shield = clamp(n, 0, 3);
    try{ if (FeverUI && typeof FeverUI.setShield === 'function') FeverUI.setShield(S.shield); }catch(_){}
  }
  function judge(kind, text){ emit('hha:judge', { kind, text }); }
  function coach(mood, text, sub){ emit('hha:coach', { mood, text, sub }); }

  function updateScore(){
    emit('hha:score', {
      score:S.score|0, combo:S.combo|0, comboMax:S.comboMax|0, misses:S.misses|0, shield:S.shield|0
    });
    const acc = S.hitAll > 0 ? Math.round((S.hitGood / S.hitAll) * 100) : 0;
    emit('hha:rank', { grade: gradeFromAcc(acc), accuracy: acc });
  }
  function updateTime(){ emit('hha:time', { left: Math.max(0, S.left|0) }); }

  function questUpdate(){
    const g = GOALS[S.goalIndex] || GOALS[GOALS.length-1];
    const goodNow = S.hitGood|0;
    const goodNeed = g ? (g.needGood|0) : 0;

    const goalTitle = g
      ? `${g.title} ${goodNow}/${goodNeed} • ขยะ ≤${g.maxJunk}`
      : '—';

    let miniTitle='—', miniNow=0, miniTotal=0, miniLeftMs=0;
    if (S.miniActive){
      const m = S.miniActive;
      miniTitle = `${m.title} ${m.desc}`;
      miniNow = m.cur|0;
      miniTotal = m.max|0;
      miniLeftMs = Math.max(0, (m.until - now())|0);
    }

    emit('quest:update', {
      goalTitle,
      goalNow: clamp(goodNeed ? (goodNow/goodNeed)*100 : 0, 0, 100)|0,
      goalTotal: 100,
      miniTitle,
      miniNow,
      miniTotal,
      miniLeftMs
    });

    emit('quest:progress', {
      goalsCleared:S.goalsCleared|0, goalsTotal:S.goalsTotal|0,
      miniCleared:S.miniCleared|0, miniTotal:7
    });
  }

  function burstAtEl(el){
    try{
      const r = el.getBoundingClientRect();
      Particles.burstAt(r.left + r.width/2, r.top + r.height/2, String(el.dataset.type||''));
    }catch(_){}
  }

  // -------------------- end overlay (create if missing) --------------------
  function ensureEndOverlay(){
    let ov = document.getElementById('endOverlay');
    if (ov) return ov;

    ov = document.createElement('div');
    ov.id = 'endOverlay';
    ov.style.cssText = `
      position:fixed; inset:0; display:none; align-items:center; justify-content:center;
      background: rgba(0,0,0,.55); z-index: 9999; padding: 18px;
    `;
    ov.innerHTML = `
      <div style="
        width:min(820px, 100%);
        background: rgba(2,6,23,.92);
        border:1px solid rgba(148,163,184,.18);
        border-radius: 18px;
        box-shadow: 0 30px 120px rgba(0,0,0,.55);
        padding: 18px;
      ">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="font-weight:800; font-size:18px;">สรุปผล</div>
          <div id="endRank" style="font-weight:900; font-size:22px;">C</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px; margin-top:12px;">
          <div>Score: <b id="endScore">0</b></div>
          <div>Accuracy: <b id="endAcc">0%</b></div>
          <div>ComboMax: <b id="endComboMax">0</b></div>
          <div>Miss: <b id="endMiss">0</b></div>
          <div>Goals: <b id="endGoals">0/0</b></div>
          <div>Minis: <b id="endMinis">0/0</b></div>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:16px;">
          <button id="btnRetry" style="padding:12px 14px; border-radius:14px;">เล่นอีกครั้ง</button>
          <button id="btnBackHub" style="padding:12px 14px; border-radius:14px;">กลับ HUB</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    const btnRetry = document.getElementById('btnRetry');
    const btnBackHub = document.getElementById('btnBackHub');
    if (btnRetry){
      btnRetry.addEventListener('click', async ()=>{
        await flushAll('retry', makeSummary('retry'));
        location.reload();
      });
    }
    if (btnBackHub){
      btnBackHub.addEventListener('click', async ()=>{
        await goHub();
      });
    }
    return ov;
  }

  function showEnd(summary){
    const ov = ensureEndOverlay();
    const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=String(val); };
    set('endScore', summary.scoreFinal ?? 0);
    set('endRank', summary.grade ?? 'C');
    set('endAcc',  (summary.accuracyGoodPct ?? 0) + '%');
    set('endComboMax', summary.comboMax ?? 0);
    set('endMiss', summary.misses ?? 0);
    set('endGoals', `${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
    set('endMinis', `${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}`);
    ov.style.display='flex';
  }

  // -------------------- targets --------------------
  function makeTarget(kind, emoji, x, y, s){
    const el = document.createElement('div');
    el.className = 'gj-target';
    el.dataset.type = kind;
    el.dataset.emoji = emoji || '✨';

    setXY(el, x, y);
    el.style.setProperty('--s', Number(s||1).toFixed(3));
    el.textContent = String(emoji||'✨');

    // TTL
    el._ttlTimer = window.setTimeout(()=>{
      if (!el.isConnected) return;

      // good expires -> miss
      if (kind === 'good'){
        S.misses++;
        S.combo = 0;
        S.expireGood++;
        judge('warn', 'MISS (หมดเวลา)!');
        updateScore();
        questUpdate();
        logEvent('miss_expire', { kind:'good', emoji:String(emoji||'') });
      }

      el.classList.add('out');
      setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
    }, S.ttlMs);

    // click/tap hit
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el, { via:'click' });
    }, { passive:false });

    logEvent('spawn', { kind, emoji:String(emoji||'') });
    return el;
  }

  function removeTarget(el){
    try{ clearTimeout(el._ttlTimer); }catch(_){}
    el.classList.add('hit');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 140);
  }

  function capTargets(){
    const nodes = layerEl.querySelectorAll('.gj-target');
    const max = S.maxActive|0;
    if (nodes.length <= max) return;

    const over = nodes.length - max;
    for (let i=0;i<over;i++){
      try{
        const el = nodes[i];
        clearTimeout(el._ttlTimer);
        el.remove();
      }catch(_){}
    }
  }

  // -------------------- shooting (nearest to crosshair) --------------------
  function crosshairPoint(){
    const W = window.innerWidth || 360;
    const H = window.innerHeight || 640;
    return { x: W/2, y: H*0.62 };
  }

  function nearestTargetToAim(radiusPx=92){
    const p = crosshairPoint();
    const nodes = layerEl.querySelectorAll('.gj-target');
    let best=null, bestD=1e9;

    nodes.forEach(el=>{
      try{
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        const dx = cx - p.x, dy = cy - p.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < bestD){
          bestD = d; best = el;
        }
      }catch(_){}
    });

    return (best && bestD <= radiusPx) ? best : null;
  }

  function shoot(){
    if (!S.running || S.ended) return;

    const el = nearestTargetToAim(92);
    if (!el){
      S.combo = Math.max(0, S.combo - 1);
      judge('warn', 'วืด!');
      updateScore();
      return;
    }
    hitTarget(el, { via:'shoot' });
  }

  // -------------------- hit logic --------------------
  function addScore(pts){
    S.score = Math.max(0, (S.score + (pts|0))|0);
  }

  function giveShield(){
    setShield(S.shield + 1);
    judge('good', 'SHIELD +1');
    emit('hha:celebrate', { kind:'mini', title:'SHIELD 🛡️' });
    logEvent('powerup', { kind:'shield', shield:S.shield|0 });
  }

  function hitGood(el, via){
    S.hitAll++; S.hitGood++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    const pts = Math.round(80 + S.combo*2.5);
    addScore(pts);

    judge('good', `+${pts}`);
    burstAtEl(el);
    logEvent('hit', { kind:'good', via, emoji:String(el.dataset.emoji||''), score:S.score|0, combo:S.combo|0 });

    checkGoal();
    miniOnHit({ kind:'good' });

    updateScore();
    questUpdate();
    removeTarget(el);
  }

  function hitJunk(el, via){
    S.hitAll++;

    if (S.shield > 0){
      setShield(S.shield - 1);
      S.hitJunkGuard++;
      judge('good', 'SHIELD BLOCK!');
      burstAtEl(el);
      logEvent('shield_block', { via, emoji:String(el.dataset.emoji||'') });

      miniOnHit({ kind:'junk_block' });
      updateScore();
      questUpdate();
      removeTarget(el);
      return;
    }

    S.hitJunk++;
    S.goalJunkUnblocked++;
    S.misses++;
    S.combo = 0;

    const penalty = 140;
    addScore(-penalty);

    judge('bad', `JUNK! -${penalty}`);
    coach('sad', 'โดนขยะแล้ว 😵 คุมให้ดีขึ้นนะ!', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
    burstAtEl(el);
    logEvent('hit', { kind:'junk', via, emoji:String(el.dataset.emoji||''), score:S.score|0 });

    miniOnHit({ kind:'junk' });

    updateScore();
    questUpdate();
    removeTarget(el);
  }

  function hitHint(el, via){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    addScore(90);
    judge('good', 'HINT! +90');
    emit('hha:celebrate', { kind:'mini', title:'HINT 💡' });

    S.hintUntil = now() + 6000;

    logEvent('hit', { kind:'hint', via, score:S.score|0 });
    updateScore();
    questUpdate();
    removeTarget(el);
  }

  function hitShieldTarget(el, via){
    S.hitAll++;
    S.combo = clamp(S.combo + 1, 0, 9999);
    S.comboMax = Math.max(S.comboMax, S.combo);

    giveShield();
    addScore(70);
    logEvent('hit', { kind:'shield', via, score:S.score|0 });
    updateScore();
    questUpdate();
    removeTarget(el);
  }

  function hitTarget(el, meta){
    if (!S.running || S.ended || !el || !el.isConnected) return;
    const kind = String(el.dataset.type||'').toLowerCase();
    const via = (meta && meta.via) ? meta.via : 'unknown';

    if (kind === 'good') return hitGood(el, via);
    if (kind === 'junk') return hitJunk(el, via);
    if (kind === 'hint') return hitHint(el, via);
    if (kind === 'shield') return hitShieldTarget(el, via);
  }

  // -------------------- goals --------------------
  function currentGoal(){ return GOALS[S.goalIndex] || GOALS[GOALS.length-1]; }

  function checkGoal(){
    const g = currentGoal();
    if (!g) return;

    const okGood = S.hitGood >= g.needGood;
    const okJunk = S.goalJunkUnblocked <= g.maxJunk;

    if (okGood && okJunk){
      S.goalsCleared++;
      emit('hha:celebrate', { kind:'goal', title:'GOAL CLEAR!' });
      judge('good', 'GOAL CLEAR!');
      addScore(420);

      S.goalIndex = Math.min(GOALS.length-1, S.goalIndex + 1);
      S.goalJunkUnblocked = 0;

      coach('happy', 'เก่งมาก! ไปต่ออีกด่าน 🔥', 'รักษาจังหวะ + หลีกขยะ');

      if (S.endPolicy === 'all' && S.goalsCleared >= S.goalsTotal && S.miniCleared >= 7){
        endGame('all_done');
      }
    }
  }

  // -------------------- minis --------------------
  function nextMiniDef(){
    if (!S.miniBag || !S.miniBag.bag || S.miniBag.bag.length === 0) S.miniBag = makeMiniBag(rng);
    if (S.miniBag.idx >= S.miniBag.bag.length){
      S.miniBag = makeMiniBag(rng);
    }
    return S.miniBag.bag[S.miniBag.idx++];
  }

  function startMini(){
    const def = nextMiniDef();
    const t = now();
    S.miniTotal++;

    S.miniActive = {
      key:def.key, title:def.title, desc:def.desc, type:def.type,
      max: def.need ? (def.need|0) : 0,
      cur: 0,
      until: t + (def.sec*1000),
      noMissStart: S.misses|0,
      startCombo: S.combo|0,
      guardStart: S.hitJunkGuard|0,
      dodgeStart: S.dodgeCount|0
    };

    coach('neutral', `MINI: ${def.title}`, def.desc);
    emit('hha:celebrate', { kind:'mini', title:`MINI START: ${def.title}` });
    questUpdate();

    clearInterval(S.miniTimer);
    S.miniTimer = setInterval(()=>{
      if (!S.miniActive) return;
      if (now() >= S.miniActive.until){
        failMini('หมดเวลา');
      }else{
        questUpdate();
        // surviveNoJunk passes when time is up
        if (S.miniActive && S.miniActive.type === 'surviveNoJunk' && now() >= S.miniActive.until){
          passMini();
        }
      }
    }, 160);
  }

  function failMini(reason){
    if (!S.miniActive) return;
    judge('warn', `MINI FAIL! ${reason||''}`);
    coach('sad', 'ไม่เป็นไร! มินิต่อไปมาใหม่ 💪', 'ค่อย ๆ เอาจังหวะ');
    logEvent('mini_fail', { key:S.miniActive.key, reason:String(reason||'fail') });

    S.miniActive = null;
    questUpdate();

    setTimeout(()=>{ if (S.running && !S.ended) startMini(); }, 900);
  }

  function passMini(){
    if (!S.miniActive) return;
    const title = S.miniActive.title;
    S.miniCleared++;

    judge('good', 'MINI CLEAR!');
    emit('hha:celebrate', { kind:'mini', title:`MINI CLEAR: ${title}` });
    addScore(260);

    logEvent('mini_clear', { key:S.miniActive.key, title });

    S.miniActive = null;
    questUpdate();
    updateScore();

    setTimeout(()=>{ if (S.running && !S.ended) startMini(); }, 800);
  }

  function miniOnHit(ev){
    const m = S.miniActive;
    if (!m) return;

    const kind = ev.kind;

    if (m.type === 'surviveNoJunk'){
      if (kind === 'junk') return failMini('โดนขยะ');
      return;
    }

    if (m.type === 'collectGood'){
      if (kind === 'junk') return failMini('โดนขยะ');
      if (kind === 'good'){
        m.cur++;
        if (m.cur >= m.max) return passMini();
      }
      return;
    }

    if (m.type === 'reachCombo'){
      m.cur = Math.min(m.max, S.combo);
      if (S.combo >= m.max) return passMini();
      return;
    }

    if (m.type === 'shieldBlock'){
      if (kind === 'junk_block'){
        m.cur++;
        if (m.cur >= m.max) return passMini();
      }
      return;
    }

    if (m.type === 'streak'){
      m.cur = Math.min(m.max, S.combo);
      if (m.cur >= m.max) return passMini();
      return;
    }

    if (m.type === 'dodge'){
      const d = (S.dodgeCount - m.dodgeStart);
      m.cur = clamp(d, 0, m.max);
      if (m.cur >= m.max) return passMini();
      return;
    }

    if (m.type === 'collectNoMiss'){
      if (S.misses > m.noMissStart) return failMini('มีมิสเกิดขึ้น');
      if (kind === 'good'){
        m.cur++;
        if (m.cur >= m.max) return passMini();
      }
      return;
    }
  }

  // -------------------- spawn choice --------------------
  function chooseType(){
    const r = rng();
    if (r < S.base.hint) return 'hint';
    if (r < S.base.hint + S.base.shield) return 'shield';

    return (rng() < S.junkRate) ? 'junk' : 'good';
  }

  function spawnOne(){
    if (!S.running || S.ended) return;

    capTargets();

    const active = layerEl.querySelectorAll('.gj-target').length;
    if (active >= S.maxActive) return;

    const tp = chooseType();
    const p = randPos();

    let size = S.size;
    if (S.hintUntil && now() < S.hintUntil){
      size = clamp(size * 1.06, 0.90, 1.12);
    }

    let em = '✨';
    if (tp === 'good') em = pick(rng, GOOD);
    if (tp === 'junk') em = pick(rng, JUNK);
    if (tp === 'hint') em = BONUS.hint;
    if (tp === 'shield') em = BONUS.shield;

    const el = makeTarget(tp, em, p.x, p.y, size);
    layerEl.appendChild(el);
  }

  // -------------------- Adaptive (play) + Warmup ramp --------------------
  function applyDifficulty(){
    const base = diffParams(S.diff);

    if (S.runMode === 'research'){
      S.spawnMs = base.spawnMs;
      S.ttlMs = base.ttl;
      S.size = base.size;
      S.junkRate = base.junk;
      S.maxActive = (S.diff === 'easy') ? 7 : (S.diff === 'hard' ? 9 : 8);
      return;
    }

    const t = now();
    const inWarmup = t < S.warmupUntil;

    const acc = S.hitAll > 0 ? (S.hitGood / S.hitAll) : 0.78;
    const comboHeat = clamp(S.combo / 16, 0, 1);
    const missHeat = clamp(S.misses / 24, 0, 1);
    const skill = clamp((acc*0.65 + comboHeat*0.45 - missHeat*0.35), 0, 1);

    // เร่ง ramp ให้เร็วขึ้น (ตามที่สั่ง)
    const ramp = inWarmup ? 0.0 : clamp((t - S.warmupUntil) / 9000, 0, 1); // 9s

    // max targets: start low, grow fast
    const maxLo = 3;
    const maxHi = (S.diff === 'easy') ? 9 : (S.diff === 'hard' ? 12 : 11);
    const maxA = maxLo + (maxHi - maxLo) * clamp(ramp*0.78 + skill*0.62, 0, 1);
    S.maxActive = clamp(Math.round(maxA), 3, maxHi);

    // spawn speed faster with skill
    const spawnLo = base.spawnMs + 230;
    const spawnHi = base.spawnMs - 190;
    const spawn = spawnLo + (spawnHi - spawnLo) * clamp(ramp*0.72 + skill*0.82, 0, 1);

    // ttl shorter with skill
    const ttlLo = base.ttl + 240;
    const ttlHi = base.ttl - 200;
    const ttl = ttlLo + (ttlHi - ttlLo) * clamp(ramp*0.68 + skill*0.78, 0, 1);

    // size smaller with skill (แต่คุมไม่ให้เล็กเกิน ป.5)
    const sizeLo = base.size * 1.05;
    const sizeHi = base.size * 0.90;
    const size = sizeLo + (sizeHi - sizeLo) * clamp(ramp*0.62 + skill*0.72, 0, 1);

    // junk rate rises with skill (คุมเพดาน)
    const junkLo = clamp(base.junk - 0.06, 0.28, 0.55);
    const junkHi = clamp(base.junk + 0.06, 0.28, 0.58);
    const junk = junkLo + (junkHi - junkLo) * clamp(ramp*0.62 + skill*0.66, 0, 1);

    if (inWarmup){
      S.maxActive = 2;
      S.spawnMs = 1050;
      S.ttlMs = base.ttl + 350;
      S.size = base.size * 1.08;
      S.junkRate = clamp(base.junk - 0.10, 0.22, 0.55);
    }else{
      S.spawnMs = clamp(spawn, 420, 980);
      S.ttlMs   = clamp(ttl,   1100, 2300);
      S.size    = clamp(size,  0.88, 1.10);
      S.junkRate= clamp(junk,  0.26, 0.58);
    }
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;
    applyDifficulty();
    spawnOne();
    capTargets();
    S.spawnTimer = setTimeout(loopSpawn, Math.round(S.spawnMs));
  }

  // -------------------- hazards (Ring/Laser) --------------------
  function pulseRing(){
    if (!ringEl) return;
    ringEl.style.opacity = '1';
    ringEl.classList.add('active');
    setTimeout(()=>{
      try{ ringEl.classList.remove('active'); ringEl.style.opacity='0'; }catch(_){}
    }, 900);
  }
  function pulseLaser(){
    if (!laserEl) return;
    laserEl.style.opacity = '1';
    laserEl.classList.add('active');
    setTimeout(()=>{
      try{ laserEl.classList.remove('active'); laserEl.style.opacity='0'; }catch(_){}
    }, 700);
  }

  function hazardTick(){
    if (!S.running || S.ended) return;

    const elapsed = (now() - S.tStart)/1000;
    const baseGap = (S.runMode==='research') ? 12.5 : 10.2;
    const gap = clamp(baseGap - elapsed*0.05, 7.5, 12.5);
    const wait = (gap + rng()*3.0) * 1000;

    S.hazardTimer = setTimeout(()=>{
      if (!S.running || S.ended) return;

      const isRing = rng() < 0.55;
      if (isRing) pulseRing(); else pulseLaser();

      const needShift = (S.view === 'mobile') ? 18 : 14;

      setTimeout(()=>{
        const dodged = (S.lastShiftMag >= needShift);
        if (dodged){
          S.dodgeCount++;
          judge('good', 'DODGE!');
          miniOnHit({ kind:'dodge' });
          logEvent('dodge', { ok:true, mag:S.lastShiftMag|0 });
        }else{
          // hazard counts like junk hit (but allow shield)
          if (S.shield > 0){
            setShield(S.shield - 1);
            S.hitJunkGuard++;
            judge('good', 'DODGE FAIL แต่ SHIELD ช่วยไว้!');
            miniOnHit({ kind:'junk_block' });
            logEvent('hazard', { ok:false, blocked:true });
          }else{
            S.misses++;
            S.goalJunkUnblocked++;
            S.combo = 0;
            addScore(-120);
            judge('bad', 'โดน Ring/Laser!');
            coach('sad', 'หลบอีกนิด! ลากจอ/เอียงโลกเพื่อหลบ', 'คุมจังหวะนะ');
            miniOnHit({ kind:'junk' });
            logEvent('hazard', { ok:false, blocked:false });
          }
          updateScore();
          questUpdate();
        }
      }, isRing ? 650 : 520);

      hazardTick();
    }, wait);
  }

  // -------------------- tick loop --------------------
  function loopTick(){
    if (!S.running || S.ended) return;

    S.left = Math.max(0, S.left - 0.14);
    updateTime();
    checkGoal();

    if (S.left <= 0){
      endGame('time');
      return;
    }

    S.tickTimer = setTimeout(loopTick, 140);
  }

  // -------------------- summary + flush --------------------
  function makeSummary(reason){
    const acc = S.hitAll > 0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
    const grade = gradeFromAcc(acc);

    return {
      reason: String(reason||'end'),
      ...ctx,

      projectTag: ctx.projectTag || 'GoodJunkVR',
      runMode: S.runMode,
      diff: S.diff,
      gameMode: 'GoodJunkVR',
      seed: S.seed,

      durationPlannedSec: S.timeSec|0,
      durationPlayedSec: Math.round((now() - S.tStart)/1000),

      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      misses: S.misses|0,

      goalsCleared: S.goalsCleared|0,
      goalsTotal: S.goalsTotal|0,
      miniCleared: S.miniCleared|0,
      miniTotal: 7,

      nHitGood: S.hitGood|0,
      nHitJunk: S.hitJunk|0,
      nHitJunkGuard: S.hitJunkGuard|0,
      nExpireGood: S.expireGood|0,

      accuracyGoodPct: acc|0,
      grade
    };
  }

  async function flushAll(reason, summary){
    try{
      if (summary){
        localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
        localStorage.setItem('hha_last_summary', JSON.stringify(summary));
      }
    }catch(_){}
    await flushLogger(reason);
  }

  function clearAllTargets(){
    const list = layerEl.querySelectorAll('.gj-target');
    list.forEach(el=>{
      try{ clearTimeout(el._ttlTimer); }catch(_){}
      try{ el.remove(); }catch(_){}
    });
  }

  async function endGame(reason){
    if (S.ended) return;
    S.ended = true;
    S.running = false;

    try{ clearTimeout(S.spawnTimer); }catch(_){}
    try{ clearTimeout(S.tickTimer); }catch(_){}
    try{ clearTimeout(S.hazardTimer); }catch(_){}
    try{ clearInterval(S.miniTimer); }catch(_){}

    clearAllTargets();

    const summary = makeSummary(reason);

    if (!S.flushedEnd){
      S.flushedEnd = true;
      await flushAll('end', summary);
    }

    emit('hha:end', summary);
    showEnd(summary);
    logEvent('session_end', summary);
  }

  async function goHub(){
    const summary = makeSummary('back_hub');
    await flushAll('back_hub', summary);

    try{
      const u = new URL(String(S.hub || hub), location.href);
      u.searchParams.set('ts', String(Date.now()));
      location.href = u.toString();
    }catch(_){
      location.href = String(S.hub || hub || '../hub.html');
    }
  }

  // flush-hardened
  window.addEventListener('pagehide', ()=>{ try{ flushAll('pagehide', makeSummary('pagehide')); }catch(_){ } }, { passive:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'hidden'){
      try{ flushAll('hidden', makeSummary('hidden')); }catch(_){}
    }
  }, { passive:true });

  // -------------------- spawn loop --------------------
  function chooseType(){
    const r = rng();
    if (r < S.base.hint) return 'hint';
    if (r < S.base.hint + S.base.shield) return 'shield';
    return (rng() < S.junkRate) ? 'junk' : 'good';
  }

  function loopSpawn(){
    if (!S.running || S.ended) return;
    applyDifficulty();

    capTargets();
    const active = layerEl.querySelectorAll('.gj-target').length;
    if (active < S.maxActive){
      const tp = chooseType();
      const p = randPos();
      let size = S.size;

      if (S.hintUntil && now() < S.hintUntil){
        size = clamp(size * 1.06, 0.90, 1.12);
      }

      let em = '✨';
      if (tp === 'good') em = pick(rng, GOOD);
      if (tp === 'junk') em = pick(rng, JUNK);
      if (tp === 'hint') em = BONUS.hint;
      if (tp === 'shield') em = BONUS.shield;

      layerEl.appendChild(makeTarget(tp, em, p.x, p.y, size));
    }

    S.spawnTimer = setTimeout(loopSpawn, Math.round(S.spawnMs));
  }

  // -------------------- start --------------------
  function start(){
    S.running = true;
    S.ended = false;
    S.flushedEnd = false;

    S.tStart = now();
    S.left = timeSec;

    S.score=0; S.combo=0; S.comboMax=0; S.misses=0;
    S.hitAll=0; S.hitGood=0; S.hitJunk=0; S.hitJunkGuard=0; S.expireGood=0;

    setShield(0);

    S.goalIndex=0; S.goalsCleared=0; S.goalsTotal=GOALS.length;
    S.goalJunkUnblocked=0;

    S.miniActive=null; S.miniCleared=0; S.miniTotal=0;
    S.miniBag = makeMiniBag(rng);

    S.base = diffParams(S.diff);
    S.hintUntil = 0;

    S.warmupUntil = now() + S.warmupSec*1000;

    coach('neutral', 'พร้อมลุย! ช่วงแรก “นุ่ม ๆ” แล้วค่อยโหดขึ้นเอง 😈', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
    emit('hha:celebrate', { kind:'mini', title:'WARMUP 3s' });

    updateTime();
    updateScore();
    questUpdate();

    setTimeout(()=>{
      if (!S.running || S.ended) return;
      startMini();
    }, (S.warmupSec*1000) + 800);

    loopSpawn();
    loopTick();
    hazardTick();
  }

  // -------------------- input binds --------------------
  if (shootEl){
    shootEl.addEventListener('click', (e)=>{ e.preventDefault?.(); shoot(); }, { passive:false });
    shootEl.addEventListener('pointerup', (e)=>{ e.preventDefault?.(); shoot(); }, { passive:false });
  }
  window.addEventListener('keydown', (e)=>{
    if (e.code === 'Space' || e.code === 'Enter') shoot();
  });

  // expose for debug
  window.GoodJunkVR = window.GoodJunkVR || {};
  window.GoodJunkVR.endGame = endGame;
  window.GoodJunkVR.shoot = shoot;
  window.GoodJunkVR.goHub = goHub;

  // run
  start();

  // -------------------- helpers (view detect) --------------------
  function detectView(){
    const qs = new URL(location.href).searchParams;
    const v = (qs.get('view') || '').toLowerCase();
    if (v) return v;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    const isCardboard = (qs.get('vr') === '1') || (qs.get('cardboard') === '1');
    if (isCardboard) return 'cardboard';
    return isMobile ? 'mobile' : 'pc';
  }

  // -------------------- shoot helper --------------------
  function crosshairPoint(){
    const W = window.innerWidth || 360;
    const H = window.innerHeight || 640;
    return { x: W/2, y: H*0.62 };
  }
  function nearestTargetToAim(radiusPx=92){
    const p = crosshairPoint();
    const nodes = layerEl.querySelectorAll('.gj-target');
    let best=null, bestD=1e9;

    nodes.forEach(el=>{
      try{
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        const dx = cx - p.x, dy = cy - p.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < bestD){ bestD = d; best = el; }
      }catch(_){}
    });

    return (best && bestD <= radiusPx) ? best : null;
  }
  function shoot(){
    if (!S.running || S.ended) return;

    const el = nearestTargetToAim(92);
    if (!el){
      S.combo = Math.max(0, S.combo - 1);
      judge('warn', 'วืด!');
      updateScore();
      return;
    }
    hitTarget(el, { via:'shoot' });
  }
}