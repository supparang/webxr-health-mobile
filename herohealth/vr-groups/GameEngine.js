/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (AI PACK + FUN + FAIR + VR Cardboard)
✅ Enter VR / TapShoot: listens to hha:shoot (from ../vr/vr-ui.js)
✅ Aim Assist: shoot picks nearest target near center (AI adjustable lockPx)
✅ AI 1) Difficulty Director (play adaptive, research deterministic)
✅ AI 2) AI Coach (micro-tips explainable + rate limit)
✅ AI 3) Pattern Generator (storm/boss/spawn pattern, seeded)
✅ Perfect / Clutch / Boss phases / Powerups (star/ice/diamond/shield)
✅ Dynamic safe spawn rect (avoid HUD/quest/power/coach)
✅ Metrics: rt avg/median/fastHitRate + spawned/hit counters
✅ Emits:
   - hha:score, hha:time, hha:rank, hha:fever, hha:coach, hha:judge, hha:end, hha:celebrate
   - groups:power, groups:progress
*/
(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };
  const emitProgress = (detail)=> emit('groups:progress', detail||{});

  // ---------- Seeded RNG ----------
  function xmur3(str){
    str = String(str||'seed');
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

  // ---------- Helpers ----------
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function styleNorm(s){
    s = String(s||'mix').toLowerCase();
    return (s==='hard'||s==='feel'||s==='mix') ? s : 'mix';
  }
  function pick(arr, rng){
    if (!arr || !arr.length) return null;
    return arr[(rng()*arr.length)|0];
  }

  // ---------- Content ----------
  // เพลง 5 หมู่ (ตามที่คุณย้ำ)
  const SONG = {
    1:'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน 💪',
    2:'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง ⚡',
    3:'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ 🥦',
    4:'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน 🍎',
    5:'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย 🥑'
  };

  const GROUPS = {
    1:{ label:'หมู่ 1', emoji:['🥛','🥚','🍗','🐟','🥜','🫘'] },
    2:{ label:'หมู่ 2', emoji:['🍚','🍞','🥔','🍠','🥖','🍜'] },
    3:{ label:'หมู่ 3', emoji:['🥦','🥬','🥕','🌽','🥒','🍆'] },
    4:{ label:'หมู่ 4', emoji:['🍎','🍌','🍊','🍉','🍓','🍍'] },
    5:{ label:'หมู่ 5', emoji:['🥑','🫒','🧈','🥥','🧀','🌰'] }
  };

  const JUNK_EMOJI  = ['🍟','🍔','🍕','🧋','🍩','🍬','🍭'];
  const DECOY_EMOJI = ['🎭','🌀','✨','🌈','🎈'];

  // powerups
  const PWR = {
    star:{ emoji:'⭐', label:'OVERDRIVE' },
    ice:{  emoji:'❄️', label:'FREEZE' },
    diamond:{ emoji:'💎', label:'MAGNET' },
    shield:{ emoji:'🛡️', label:'SHIELD' },
  };

  // ---------- Difficulty base ----------
  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 6;
    if (diff==='hard') return 10;
    return 8;
  }

  function diffParams(diff){
    diff = String(diff||'normal').toLowerCase();
    const thr = goalNeed(diff);
    if (diff === 'easy') return { spawnMs:900, ttl:1750, size:1.05, powerThr:thr, junk:0.10, decoy:0.08, stormDur:6, bossHp:3, perfectMs:320 };
    if (diff === 'hard') return { spawnMs:680, ttl:1450, size:0.92, powerThr:thr, junk:0.16, decoy:0.12, stormDur:7, bossHp:4, perfectMs:270 };
    return                 { spawnMs:780, ttl:1600, size:1.00, powerThr:thr, junk:0.12, decoy:0.10, stormDur:6, bossHp:3, perfectMs:295 };
  }

  function rankFromAcc(acc){
    if (acc >= 95) return 'SSS';
    if (acc >= 90) return 'SS';
    if (acc >= 85) return 'S';
    if (acc >= 75) return 'A';
    if (acc >= 60) return 'B';
    return 'C';
  }

  // ============================================================
  // ✅ AI PACK (1–3)
  // ============================================================
  function createAIDifficultyDirector(seed, runMode, diff){
    const rng = makeRng(String(seed)+'::ai::dir');
    const base = diffParams(diff);

    const st = {
      level: 0.45,          // 0..1
      lockPx: 86,           // aim assist radius
      spawnMs: base.spawnMs,
      ttl: base.ttl,
      junkBias: base.junk,
      decoyBias: base.decoy,
      bossEvery: 20000,
      lastUpdate: 0,
      lastReason: 'init'
    };

    function clamp01(x){ return x<0?0:(x>1?1:x); }

    function computeFromPerf(perf){
      // perf: {acc, combo, fever, missRate, rtMed}
      const acc = clamp01(perf.acc);
      const comboK = clamp01(perf.combo/18);
      const feverK = clamp01(perf.fever/100);
      const missK  = clamp01(perf.missRate/0.25);     // 0..1 at 25% miss rate
      const rtK    = clamp01((perf.rtMed||420) / 650); // smaller better

      // ability score: high acc+combo, low fever+miss+rt => higher
      const ability = clamp01( 0.45*acc + 0.25*comboK + 0.15*(1-feverK) + 0.10*(1-missK) + 0.05*(1-rtK) );

      // target difficulty wants to follow ability but keep fair
      let target = clamp01( ability*0.95 + 0.03 ); // keep slightly forgiving

      // smooth step
      const a = 0.12;
      st.level = clamp01(st.level*(1-a) + target*a);

      // map to parameters (higher = harder)
      const L = st.level;

      st.spawnMs   = clamp(base.spawnMs - L*260, 480, 980);
      st.ttl       = clamp(base.ttl     - L*260, 1200, 1850);
      st.junkBias  = clamp(base.junk    + L*0.07, 0.08, 0.24);
      st.decoyBias = clamp(base.decoy   + L*0.06, 0.06, 0.22);
      st.bossEvery = clamp(22000 - L*7000, 13000, 24000);

      // aim assist: easier => bigger lockPx
      st.lockPx = Math.round(clamp(110 - L*45, 58, 128));
      st.lastReason = 'perf';
    }

    function deterministicResearch(){
      // research: stable based on diff only (seeded small noise allowed but fixed)
      const n = (rng()-0.5) * 0.06; // tiny deterministic
      const L = clamp01( (diff==='easy'?0.35:diff==='hard'?0.62:0.48) + n );

      st.level = L;
      st.spawnMs   = clamp(base.spawnMs - L*240, 520, 980);
      st.ttl       = clamp(base.ttl     - L*220, 1250, 1850);
      st.junkBias  = clamp(base.junk    + L*0.06, 0.08, 0.22);
      st.decoyBias = clamp(base.decoy   + L*0.05, 0.06, 0.20);
      st.bossEvery = clamp(21000 - L*6000, 14000, 24000);
      st.lockPx    = Math.round(clamp(104 - L*40, 60, 126));
      st.lastReason = 'research';
    }

    function step(perf){
      if (runMode === 'research'){
        deterministicResearch();
        return st;
      }
      computeFromPerf(perf||{});
      return st;
    }

    function getState(){ return Object.assign({}, st); }
    return { step, getState };
  }

  function createAICoach(seed){
    const rng = makeRng(String(seed)+'::ai::coach');
    let lastSayAt = 0;
    let lastKey = '';
    let cooldownMs = 1800;

    function shouldSay(key){
      const t = now();
      if (t - lastSayAt < cooldownMs) return false;
      if (key && key === lastKey && (t - lastSayAt) < 4200) return false;
      lastSayAt = t;
      lastKey = key || '';
      return true;
    }

    function pickTip(ctx){
      // ctx: {acc, combo, fever, missStreak, rtMed, stage, storm, bossAlive, groupId}
      const acc = ctx.acc||0;
      const fever = ctx.fever||0;
      const combo = ctx.combo||0;

      // priority: fever high -> caution
      if (fever >= 70) return { key:'fever', mood:'fever', text:'ใจเย็น ๆ ก่อนนะ 👀 เล็งกลางจอ แล้วค่อยยิงทีละเป้า จะคุมได้เอง!' };
      if (ctx.storm && ctx.stormLeftSec <= 3) return { key:'storm3', mood:'fever', text:'พายุใกล้จบ! ⏳ เน้น “ถูก” ก่อน “เร็ว” ยิงกลาง ๆ!' };
      if (ctx.bossAlive) return { key:'boss', mood:'neutral', text:'บอสมา! 👑 โฟกัสที่บอสก่อน แล้วระวังดีคอยรอบ ๆ' };
      if (ctx.missStreak >= 2) return { key:'miss', mood:'sad', text:'ไม่เป็นไร! 🙌 ลดความเร็วลงนิดเดียว แล้วเล็งให้ชัวร์' };
      if (acc < 0.65) return { key:'acc', mood:'neutral', text:'ทริค: ดู “หมู่ที่กำลังเล่น” แล้วเลือกอาหารให้ตรงหมู่เท่านั้นนะ 🍀' };
      if (combo >= 10 && acc >= 0.8) return { key:'combo', mood:'happy', text:'โหดมาก! 🔥 คอมโบมาแล้ว ลุยต่อ—อย่าเผลอโดนขยะ!' };

      // light fun random
      const fun = [
        { key:'song', mood:'happy', text: SONG[ctx.groupId] || 'จำ 5 หมู่ไว้ให้แม่น! 🎵' },
        { key:'center', mood:'neutral', text:'Cardboard โหมดยิงกลางจอ: ให้ครอสแฮร์อยู่บนเป้าแล้วแตะยิง ✨' }
      ];
      return fun[(rng()*fun.length)|0];
    }

    function update(ctx){
      const tip = pickTip(ctx||{});
      if (!tip) return null;
      if (!shouldSay(tip.key)) return null;
      return tip;
    }

    return { update };
  }

  function createAIPatternGenerator(seed){
    const rng = makeRng(String(seed)+'::ai::pat');
    const stormPatterns = ['wave','spiral','burst'];
    const bossStyles = ['teleport','decoy','tank'];

    function stormPattern(style){
      // deterministic-ish preference
      if (style === 'hard') return 'spiral';
      if (style === 'feel') return 'wave';
      // mix
      return pick(stormPatterns, rng) || 'wave';
    }

    function bossPlan(){
      // choose a plan for next boss (decoy/teleport weight)
      const r = rng();
      if (r < 0.45) return 'teleport';
      if (r < 0.78) return 'decoy';
      return 'tank';
    }

    function spawnFlavor(){
      // slight changes: more corners vs center, etc (future)
      return (rng() < 0.5) ? 'spread' : 'ring';
    }

    return { stormPattern, bossPlan, spawnFlavor };
  }

  // ---------- State ----------
  const engine = {
    layerEl:null,
    running:false,
    ended:false,

    runMode:'play',
    diff:'normal',
    style:'mix',
    timeSec:90,
    seed:'seed',
    rng:Math.random,

    // AI refs
    aiDir:null,
    aiCoach:null,
    aiPat:null,
    aiLockPx:86,
    aiLast: null,

    // VR feel
    vx:0, vy:0, dragOn:false, dragX:0, dragY:0,

    left:90,
    score:0,
    combo:0,
    comboMax:0,
    misses:0,

    hitGood:0,
    hitAll:0,

    // counters (HHA-style detail)
    nTargetGoodSpawned:0,
    nTargetWrongSpawned:0,
    nTargetJunkSpawned:0,
    nTargetDecoySpawned:0,
    nTargetBossSpawned:0,
    nTargetStarSpawned:0,
    nTargetIceSpawned:0,
    nTargetDiamondSpawned:0,
    nTargetShieldSpawned:0,

    nHitGood:0,
    nHitWrong:0,
    nHitJunk:0,
    nHitDecoy:0,
    nHitBoss:0,
    nHitJunkGuard:0,
    nExpireGood:0,

    // RT metrics
    rtList:[],
    fastHits:0,

    groupId:1,
    groupClean:true,

    // fever/shield
    fever:0,
    shield:0,      // allow stack to 2
    feverTickLast:0,

    // power
    power:0,
    powerThr:8,

    // spawn/ttl (driven by AI in play)
    ttlMs:1600,
    sizeBase:1.0,
    adapt:{ spawnMs:780, ttl:1600, size:1.0, junkBias:0.12, decoyBias:0.10, bossEvery:18000 },

    // storm
    storm:false,
    stormUntilMs:0,
    nextStormAtMs:0,
    stormDurSec:6,
    stormPattern:'wave',
    stormSpawnIdx:0,
    _stormUrgent:false,
    _stormTickTimer:0,

    // boss
    bossAlive:false,
    bossHp:0,
    bossHpMax:3,
    nextBossAtMs:0,
    bossPhase:1,
    bossPlan:'teleport',
    _bossEl:null,

    // buffs
    magnetUntil:0,
    freezeUntil:0,
    overUntil:0,

    // timers
    spawnTimer:0,
    tickTimer:0,

    // quest
    quest:null,
    _questBound:false,
    _questUiBound:false,

    // listeners bound once
    _boundShoot:false,
    _boundVr:false
  };

  function scoreMult(){ return (now() < engine.overUntil) ? 2 : 1; }
  function emitCoach(text, mood){ emit('hha:coach', { text: String(text||''), mood: mood||'neutral' }); }
  function emitFever(){ emit('hha:fever', { feverPct: Math.round(engine.fever)|0, shield: engine.shield|0 }); }

  function updateRank(){
    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    emit('hha:rank', { grade: rankFromAcc(acc), accuracy: acc });
  }
  function updateScore(){
    emit('hha:score', { score: engine.score|0, combo: engine.combo|0, comboMax: engine.comboMax|0, misses: engine.misses|0 });
    updateRank();
  }
  function updateTime(){ emit('hha:time', { left: engine.left|0 }); }
  function updatePower(){ emit('groups:power', { charge: engine.power|0, threshold: engine.powerThr|0 }); }

  // ---------- Quest bridge ----------
  function ensureQuest(){
    if (engine.quest) return engine.quest;
    const maker = NS.createGroupsQuest;
    if (typeof maker !== 'function') return null;

    engine.quest = maker({
      runMode: engine.runMode,
      diff: engine.diff,
      style: engine.style,
      seed: engine.seed
    });

    if (!engine._questBound && engine.quest && typeof engine.quest.onProgress === 'function'){
      engine._questBound = true;
      root.addEventListener('groups:progress', (ev)=>{
        try{ engine.quest && engine.quest.onProgress(ev); }catch{}
      }, { passive:true });
    }

    // bind quest ui urgency (tick when <=3s)
    if (!engine._questUiBound){
      engine._questUiBound = true;
      root.addEventListener('quest:update', (ev)=>{
        if (!engine.running || engine.ended) return;
        const d = ev.detail||{};
        const leftSec = Number(d.miniTimeLeftSec||0);
        if (leftSec > 0 && leftSec <= 3){
          DOC.body.classList.add('mini-urgent');
          try{ NS.Audio && NS.Audio.tick && NS.Audio.tick(); }catch{}
        }else{
          DOC.body.classList.remove('mini-urgent');
        }
      }, { passive:true });
    }

    return engine.quest;
  }

  function questStart(){
    const q = ensureQuest();
    try{ q && q.start && q.start(); }catch{}
    try{ q && q.pushUpdate && q.pushUpdate(); }catch{}
  }

  function questStop(){
    try{ engine.quest && engine.quest.stop && engine.quest.stop(); }catch{}
  }

  // ---------- VR feel ----------
  function applyView(){
    const layer = engine.layerEl;
    if (!layer) return;
    layer.style.setProperty('--vx', engine.vx.toFixed(1)+'px');
    layer.style.setProperty('--vy', engine.vy.toFixed(1)+'px');
  }

  function setupView(){
    let bound = false;
    function bind(){
      if (bound) return;
      const layer = engine.layerEl;
      if (!layer) return;
      bound = true;

      layer.addEventListener('pointerdown', (e)=>{
        engine.dragOn = true; engine.dragX = e.clientX; engine.dragY = e.clientY;
      }, { passive:true });

      root.addEventListener('pointermove', (e)=>{
        if (!engine.dragOn) return;
        const dx = e.clientX - engine.dragX;
        const dy = e.clientY - engine.dragY;
        engine.dragX = e.clientX; engine.dragY = e.clientY;
        engine.vx = clamp(engine.vx + dx*0.22, -90, 90);
        engine.vy = clamp(engine.vy + dy*0.22, -90, 90);
        applyView();
      }, { passive:true });

      root.addEventListener('pointerup', ()=>{ engine.dragOn=false; }, { passive:true });

      root.addEventListener('deviceorientation', (ev)=>{
        const gx = Number(ev.gamma)||0;
        const gy = Number(ev.beta)||0;
        engine.vx = clamp(engine.vx + gx*0.06, -90, 90);
        engine.vy = clamp(engine.vy + (gy-20)*0.02, -90, 90);
        applyView();
      }, { passive:true });
    }

    const it = setInterval(()=>{
      bind();
      if (bound) clearInterval(it);
    }, 80);
  }

  // ---------- Dynamic safe spawn rect (avoid HUD) ----------
  function rectOf(sel){
    const el = DOC.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r || r.width<=0 || r.height<=0) return null;
    return r;
  }

  function safeSpawnRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    // baseline margins
    let top = 150;
    let bot = 190;
    let left = 16;
    let right = 16;

    const hud = rectOf('.hud');
    const pills = rectOf('.centerTop');
    const quest = rectOf('.questTop');
    const power = rectOf('.powerWrap');
    const coach = rectOf('.coachWrap');

    if (hud) top = Math.max(top, hud.bottom + 12);
    if (pills) top = Math.max(top, pills.bottom + 10);
    if (power) bot = Math.max(bot, (H - power.top) + 12);
    if (coach) bot = Math.max(bot, (H - coach.top) + 12);

    // avoid right-side quest/coach by shrinking right margin
    if (quest) right = Math.max(right, (W - quest.left) + 12);
    if (coach) right = Math.max(right, (W - coach.left) + 12);

    // clamp to sane
    top = clamp(top, 90, H*0.55);
    bot = clamp(bot, 120, H*0.55);
    left = clamp(left, 8, W*0.25);
    right = clamp(right, 8, W*0.35);

    const x0 = left;
    const x1 = Math.max(x0+40, W - right);
    const y0 = top;
    const y1 = Math.max(y0+40, H - bot);
    return { x0,x1,y0,y1,W,H };
  }

  // ---------- DOM target ----------
  function setXY(el, x, y){
    el.style.setProperty('--x', x.toFixed(1)+'px');
    el.style.setProperty('--y', y.toFixed(1)+'px');
    el.dataset._x = String(x);
    el.dataset._y = String(y);
  }

  function randPos(){
    const r = safeSpawnRect();
    const x = r.x0 + engine.rng()*(r.x1 - r.x0);
    const y = r.y0 + engine.rng()*(r.y1 - r.y0);
    return { x, y };
  }

  function stormPos(){
    const r = safeSpawnRect();
    const cx = r.W * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;
    const idx = (engine.stormSpawnIdx++);

    const jx = (engine.rng()-0.5) * 26;
    const jy = (engine.rng()-0.5) * 22;

    if (engine.stormPattern === 'wave'){
      const t = (idx % 28) / 28;
      const x = r.x0 + t*(r.x1 - r.x0);
      const y = cy + Math.sin((idx*0.55)) * ((r.y1 - r.y0)*0.22);
      return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
    }
    if (engine.stormPattern === 'spiral'){
      const a = idx * 0.62;
      const rad = clamp(28 + idx*5.0, 28, Math.min(r.x1-r.x0, r.y1-r.y0)*0.40);
      const x = cx + Math.cos(a)*rad;
      const y = cy + Math.sin(a)*rad;
      return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
    }
    // burst
    const corners = [
      {x:r.x0+26, y:r.y0+26},
      {x:r.x1-26, y:r.y0+26},
      {x:r.x0+26, y:r.y1-26},
      {x:r.x1-26, y:r.y1-26},
      {x:cx, y:r.y0+22},
      {x:cx, y:r.y1-22},
    ];
    const c = corners[(engine.rng()*corners.length)|0];
    const x = c.x + (engine.rng()-0.5)*120;
    const y = c.y + (engine.rng()-0.5)*110;
    return { x: clamp(x + jx, r.x0, r.x1), y: clamp(y + jy, r.y0, r.y1) };
  }

  function removeTarget(el){
    if (!el) return;
    try{ root.clearTimeout(el._ttlTimer); }catch{}
    el.classList.add('hit');
    root.setTimeout(()=> el.remove(), 220);
  }

  function addTypeClass(el, type){
    el.classList.remove('fg-good','fg-wrong','fg-junk','fg-decoy','fg-boss','fg-star','fg-ice','fg-diamond','fg-shield');
    if (type === 'good') el.classList.add('fg-good');
    else if (type === 'wrong') el.classList.add('fg-wrong');
    else if (type === 'junk') el.classList.add('fg-junk');
    else if (type === 'decoy') el.classList.add('fg-decoy');
    else if (type === 'boss') el.classList.add('fg-boss');
    else if (type === 'star') el.classList.add('fg-star');
    else if (type === 'ice') el.classList.add('fg-ice');
    else if (type === 'diamond') el.classList.add('fg-diamond');
    else if (type === 'shield') el.classList.add('fg-shield');
  }

  function makeTarget(type, emoji, x, y, s){
    const layer = engine.layerEl;
    if (!layer) return null;

    const el = DOC.createElement('div');
    el.className = 'fg-target spawn';
    el.dataset.emoji = emoji || '✨';
    el.dataset.type = type;
    el.dataset.spawnAt = String(now());

    addTypeClass(el, type);

    if (type === 'good') el.dataset.groupId = String(engine.groupId);

    setXY(el, x, y);
    el.style.setProperty('--s', s.toFixed(3));

    // allow direct click (except cVR where CSS disables pointer-events)
    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.();
      hitTarget(el, 'tap');
    }, { passive:false });

    // TTL expire -> miss only when GOOD expires
    const ttl = engine.ttlMs;
    el._ttlTimer = root.setTimeout(()=>{
      if (!el.isConnected) return;
      if (type === 'good'){
        engine.nExpireGood++;
        engine.misses++; engine.combo = 0; engine.groupClean = false;
        engine.fever = clamp(engine.fever + 10, 0, 100);
        try{ NS.Audio && NS.Audio.bad && NS.Audio.bad(); }catch{}
        emit('hha:judge', { kind:'MISS' });
        updateScore();
        emitFever();
      }
      el.classList.add('out');
      root.setTimeout(()=> el.remove(), 220);
    }, ttl);

    return el;
  }

  // ---------- Game mechanics ----------
  function setGroup(id){
    engine.groupId = id;
    engine.groupClean = true;
    emitCoach(SONG[id] || `ต่อไป หมู่ ${id}!`, 'happy');
  }

  function perfectSwitchBonus(){
    if (!engine.groupClean) return;
    emitProgress({ kind:'perfect_switch' });
    emit('hha:celebrate', { kind:'mini', title:'Perfect Switch!' });
  }

  function switchGroup(){
    perfectSwitchBonus();
    const next = (engine.groupId % 5) + 1;
    setGroup(next);
    emitProgress({ kind:'group_swap' });
    engine.power = 0;
    updatePower();
  }

  function addPower(n){
    engine.power = clamp(engine.power + (n|0), 0, engine.powerThr);
    updatePower();
    if (engine.power >= engine.powerThr) switchGroup();
  }

  // ---------- Storm ----------
  function enterStorm(){
    engine.storm = true;
    engine.stormUntilMs = now() + engine.stormDurSec*1000;
    engine.stormPattern = (engine.aiPat && engine.aiPat.stormPattern) ? engine.aiPat.stormPattern(engine.style) : (engine.style==='hard'?'spiral':engine.style==='feel'?'wave':'burst');
    engine.stormSpawnIdx = 0;
    engine._stormUrgent = false;

    DOC.body.classList.add('groups-storm');
    emitProgress({ kind:'storm_on' });
    try{ NS.Audio && NS.Audio.storm && NS.Audio.storm(); }catch{}
    emit('hha:judge', { kind:'boss', text:'STORM!' });
  }

  function stopStormTick(){
    try{ root.clearInterval(engine._stormTickTimer); }catch{}
    engine._stormTickTimer = 0;
  }

  function exitStorm(){
    engine.storm = false;
    engine.stormUntilMs = 0;
    engine._stormUrgent = false;
    stopStormTick();
    DOC.body.classList.remove('groups-storm','groups-storm-urgent');
    emitProgress({ kind:'storm_off' });

    const gap = (engine.runMode==='research')
      ? (18000 + engine.rng()*6000)
      : (16000 + engine.rng()*12000);
    engine.nextStormAtMs = now() + gap;
  }

  // ---------- Boss (phases) ----------
  function tryBossSpawn(){
    if (engine.bossAlive) return;
    if (now() < engine.nextBossAtMs) return;

    engine.bossAlive = true;
    engine.bossHp = engine.bossHpMax;
    engine.bossPhase = 1;

    engine.bossPlan = (engine.aiPat && engine.aiPat.bossPlan) ? engine.aiPat.bossPlan() : 'teleport';

    const p = engine.storm ? stormPos() : randPos();
    const s = 1.25 * engine.sizeBase;

    const el = makeTarget('boss','👑',p.x,p.y,s);
    if (!el) return;

    el.dataset.hp = String(engine.bossHp);
    el.classList.add('fg-boss');
    engine.layerEl.appendChild(el);
    engine._bossEl = el;

    engine.nTargetBossSpawned++;
    emitProgress({ kind:'boss_spawn' });
    try{ NS.Audio && NS.Audio.boss && NS.Audio.boss(); }catch{}
    emit('hha:judge', { kind:'boss', text:'BOSS!' });

    const base = (engine.runMode==='research') ? 20000 : clamp(engine.adapt.bossEvery, 14000, 26000);
    engine.nextBossAtMs = now() + base;
  }

  function spawnBossDecoys(){
    const boss = engine._bossEl;
    if (!boss || !boss.isConnected) return;
    const br = boss.getBoundingClientRect();
    const bx = br.left + br.width*0.5;
    const by = br.top + br.height*0.5;
    const n = (engine.rng() < 0.55) ? 1 : 2;
    for (let i=0;i<n;i++){
      const ang = engine.rng()*Math.PI*2;
      const rad = 90 + engine.rng()*70;
      const x = bx + Math.cos(ang)*rad;
      const y = by + Math.sin(ang)*rad;
      const p = safeSpawnRect();
      const ex = clamp(x, p.x0, p.x1);
      const ey = clamp(y, p.y0, p.y1);
      const el = makeTarget('decoy', DECOY_EMOJI[(engine.rng()*DECOY_EMOJI.length)|0], ex, ey, engine.sizeBase*0.95);
      if (el){
        engine.layerEl.appendChild(el);
        engine.nTargetDecoySpawned++;
      }
    }
  }

  function bossTeleport(){
    const boss = engine._bossEl;
    if (!boss || !boss.isConnected) return;
    const p = engine.storm ? stormPos() : randPos();
    setXY(boss, p.x, p.y);
    boss.classList.add('fg-boss-hurt');
    setTimeout(()=> boss.classList.remove('fg-boss-hurt'), 220);
    emit('hha:judge', { kind:'boss', text:'SHIFT!' });
  }

  function hitBoss(el){
    emitProgress({ type:'hit', correct:true });

    engine.hitAll++;
    engine.combo = clamp(engine.combo + 1, 0, 9999);
    engine.comboMax = Math.max(engine.comboMax, engine.combo);
    emitProgress({ kind:'combo', combo: engine.combo });

    engine.bossHp = Math.max(0, engine.bossHp - 1);
    el.dataset.hp = String(engine.bossHp);

    engine.score += Math.round(160 * scoreMult());
    engine.nHitBoss++;
    updateScore();

    // phase transitions + boss plan flavor
    if (engine.bossHp === Math.max(1, engine.bossHpMax-1) && engine.bossPhase < 2){
      engine.bossPhase = 2;
      if (engine.bossPlan === 'decoy') spawnBossDecoys();
      emit('hha:judge', { kind:'boss', text:'PHASE 2!' });
    }
    if (engine.bossHp === 1 && engine.bossPhase < 3){
      engine.bossPhase = 3;
      el.classList.add('fg-boss-weak');
      if (engine.bossPlan === 'teleport') bossTeleport();
      emit('hha:judge', { kind:'boss', text:'PHASE 3!' });
    }

    if (engine.bossHp <= 0){
      engine.bossAlive = false;
      emitProgress({ kind:'boss_down' });
      emit('hha:celebrate', { kind:'goal', title:'BOSS DOWN!' });
      removeTarget(el);
    }else{
      el.classList.add('fg-boss-hurt');
      setTimeout(()=> el.classList.remove('fg-boss-hurt'), 220);
    }
  }

  // ---------- Powerups ----------
  function setBuffClass(){
    DOC.body.classList.toggle('groups-overdrive', now() < engine.overUntil);
    DOC.body.classList.toggle('groups-freeze', now() < engine.freezeUntil);
  }

  function takePowerup(tp){
    const t = now();
    if (tp === 'star'){
      engine.overUntil = t + 8000;
      try{ NS.Audio && NS.Audio.overdrive && NS.Audio.overdrive(); }catch{}
      emit('hha:judge', { kind:'good', text:'OVERDRIVE x2!' });
      emit('hha:celebrate', { kind:'mini', title:'OVERDRIVE!' });
    }else if (tp === 'ice'){
      engine.freezeUntil = t + 7000;
      emit('hha:judge', { kind:'good', text:'FREEZE!' });
    }else if (tp === 'diamond'){
      engine.magnetUntil = t + 7000;
      emit('hha:judge', { kind:'good', text:'MAGNET!' });
    }else if (tp === 'shield'){
      engine.shield = clamp(engine.shield + 1, 0, 2);
      emitFever();
      emit('hha:judge', { kind:'good', text:'SHIELD +' });
    }
    setBuffClass();
  }

  // ---------- Aim assist (TapShoot) ----------
  function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }

  function pickTargetNear(x,y, lockPx){
    const layer = engine.layerEl;
    if (!layer) return null;
    const list = layer.querySelectorAll('.fg-target');
    const lock2 = lockPx*lockPx;

    let best = null;
    let bestD = Infinity;

    list.forEach(el=>{
      if (!el || !el.isConnected) return;
      if (el.classList.contains('hit') || el.classList.contains('out')) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width*0.5;
      const cy = r.top + r.height*0.5;
      const d = dist2(x,y,cx,cy);
      if (d <= lock2 && d < bestD){
        bestD = d;
        best = el;
      }
    });

    return best;
  }

  function bindShootOnce(){
    if (engine._boundShoot) return;
    engine._boundShoot = true;
    root.addEventListener('hha:shoot', (ev)=>{
      if (!engine.running || engine.ended) return;
      const d = ev.detail||{};
      const x = Number(d.x);
      const y = Number(d.y);

      // ✅ AI-driven lockPx (fallback to event lockPx)
      const lockPx = clamp(Number(d.lockPx||engine.aiLockPx||86), 40, 160);

      if (!isFinite(x) || !isFinite(y)) return;
      const el = pickTargetNear(x,y, lockPx);
      if (el) hitTarget(el, 'shoot');
      else{
        emit('hha:judge', { kind:'MISS', text:'MISS!' });
        try{ NS.Audio && NS.Audio.bad && NS.Audio.bad(); }catch{}
      }
    }, { passive:true });
  }

  function bindVrEventsOnce(){
    if (engine._boundVr) return;
    engine._boundVr = true;
    root.addEventListener('hha:vr', (ev)=>{
      const d = ev.detail||{};
      if (d.state === 'reset'){
        engine.vx = 0; engine.vy = 0; applyView();
      }
    }, { passive:true });
  }

  // ---------- Hit logic ----------
  function addRT(rtMs, perfectMs){
    if (!isFinite(rtMs) || rtMs <= 0) return;
    engine.rtList.push(rtMs);
    if (rtMs <= 280) engine.fastHits++;
    if (rtMs <= perfectMs){
      emit('hha:judge', { kind:'good', text:'PERFECT!' });
      engine.score += Math.round(60 * scoreMult());
      emit('hha:celebrate', { kind:'mini', title:'PERFECT!' });
    }else if (rtMs <= perfectMs + 80){
      emit('hha:judge', { kind:'good', text:'NICE!' });
      engine.score += Math.round(20 * scoreMult());
    }
  }

  function hitTarget(el, via){
    if (!engine.running || engine.ended) return;
    if (!el || !el.isConnected) return;

    let type = String(el.dataset.type||'').toLowerCase();

    if (type === 'boss'){ hitBoss(el); return; }

    // powerups
    if (type === 'star' || type === 'ice' || type === 'diamond' || type === 'shield'){
      takePowerup(type);
      removeTarget(el);
      return;
    }

    // good but wrong group => wrong
    if (type === 'good'){
      const gid = Number(el.dataset.groupId)||0;
      if (gid && gid !== engine.groupId) type = 'wrong';
    }

    engine.hitAll++;

    const baseDP = diffParams(engine.diff);
    const spawnedAt = Number(el.dataset.spawnAt||0);
    const rt = spawnedAt ? (now() - spawnedAt) : 0;

    // GOOD
    if (type === 'good'){
      emitProgress({ type:'hit', correct:true });
      emitProgress({ kind:'hit_good' });

      try{ NS.Audio && NS.Audio.good && NS.Audio.good(); }catch{}

      engine.hitGood++;
      engine.nHitGood++;

      addRT(rt, baseDP.perfectMs);

      engine.combo = clamp(engine.combo + 1, 0, 9999);
      engine.comboMax = Math.max(engine.comboMax, engine.combo);
      emitProgress({ kind:'combo', combo: engine.combo });

      // clutch bonus (last 10s)
      if (engine.left <= 10){
        DOC.body.classList.add('clutch');
        engine.score += Math.round(35 * scoreMult());
      }

      engine.score += Math.round((110 + engine.combo*3) * scoreMult());
      engine.fever = clamp(engine.fever - 3, 0, 100);

      updateScore();
      emitFever();

      // sync goal->group
      addPower(1);

      removeTarget(el);
      return;
    }

    // BAD types
    const badLike = (type === 'junk' || type === 'wrong' || type === 'decoy');
    if (badLike){
      // shield blocks junk
      if (type === 'junk' && engine.shield > 0){
        engine.shield = Math.max(0, engine.shield - 1);
        engine.nHitJunkGuard++;
        emitFever();
        emit('hha:judge', { kind:'good', text:'SHIELD BLOCK!' });
        removeTarget(el);
        return;
      }

      emitProgress({ type:'hit', correct:false });
      emitProgress({ kind:'hit_bad' });

      try{ NS.Audio && NS.Audio.bad && NS.Audio.bad(); }catch{}

      if (type === 'junk') engine.nHitJunk++;
      else if (type === 'wrong') engine.nHitWrong++;
      else engine.nHitDecoy++;

      engine.misses++;
      engine.combo = 0;
      engine.groupClean = false;

      engine.fever = clamp(engine.fever + (type==='junk'?18:12), 0, 100);
      emitFever();

      emit('hha:judge', { kind:'bad', text:(type==='junk'?'JUNK!':(type==='wrong'?'WRONG!':'DECOY!')) });

      updateScore();
      removeTarget(el);
      return;
    }
  }

  // ---------- Spawn decision ----------
  function choosePowerType(){
    const r = engine.rng();
    if (r < 0.40) return 'star';
    if (r < 0.70) return 'ice';
    if (r < 0.88) return 'diamond';
    return 'shield';
  }

  function chooseType(){
    const baseJ = (engine.runMode==='research') ? diffParams(engine.diff).junk : engine.adapt.junkBias;
    const baseD = (engine.runMode==='research') ? diffParams(engine.diff).decoy : engine.adapt.decoyBias;

    // more fever => more junk pressure (still fair)
    const feverK = clamp(engine.fever/100, 0, 1);
    const j = clamp(baseJ + feverK*0.04, 0.06, 0.26);
    const d = clamp(baseD + feverK*0.03, 0.05, 0.22);

    // powerup chance
    const pu = engine.storm ? 0.020 : 0.013;
    if (engine.rng() < pu) return choosePowerType();

    const r = engine.rng();
    if (r < j) return 'junk';
    if (r < j + d) return 'decoy';

    // wrong pressure
    if (engine.rng() < (engine.storm ? 0.20 : 0.14)) return 'wrong';
    return 'good';
  }

  function chooseEmoji(tp){
    if (tp === 'junk') return JUNK_EMOJI[(engine.rng()*JUNK_EMOJI.length)|0];
    if (tp === 'decoy') return DECOY_EMOJI[(engine.rng()*DECOY_EMOJI.length)|0];
    if (tp === 'star') return PWR.star.emoji;
    if (tp === 'ice')  return PWR.ice.emoji;
    if (tp === 'diamond') return PWR.diamond.emoji;
    if (tp === 'shield') return PWR.shield.emoji;

    if (tp === 'good') return GROUPS[engine.groupId].emoji[(engine.rng()*GROUPS[engine.groupId].emoji.length)|0];

    // wrong
    const other = [];
    for (let g=1; g<=5; g++){
      if (g === engine.groupId) continue;
      other.push(...GROUPS[g].emoji);
    }
    return other[(engine.rng()*other.length)|0] || '✨';
  }

  function incSpawn(tp){
    if (tp === 'good') engine.nTargetGoodSpawned++;
    else if (tp === 'wrong') engine.nTargetWrongSpawned++;
    else if (tp === 'junk') engine.nTargetJunkSpawned++;
    else if (tp === 'decoy') engine.nTargetDecoySpawned++;
    else if (tp === 'star') engine.nTargetStarSpawned++;
    else if (tp === 'ice') engine.nTargetIceSpawned++;
    else if (tp === 'diamond') engine.nTargetDiamondSpawned++;
    else if (tp === 'shield') engine.nTargetShieldSpawned++;
  }

  function spawnOne(){
    if (!engine.running || engine.ended) return;
    const layer = engine.layerEl;
    if (!layer) return;

    tryBossSpawn();

    const tp = chooseType();
    const em = chooseEmoji(tp);
    const p = engine.storm ? stormPos() : randPos();

    const s = engine.sizeBase * (tp==='boss'?1.25:1.0);
    const el = makeTarget(tp, em, p.x, p.y, s);
    if (el){
      incSpawn(tp);
      layer.appendChild(el);
    }
  }

  function loopSpawn(){
    if (!engine.running || engine.ended) return;

    spawnOne();

    const base = (engine.runMode==='research') ? diffParams(engine.diff) : engine.adapt;

    let sMs = Math.max(420, base.spawnMs * (engine.storm ? 0.82 : 1.0));
    if (now() < engine.freezeUntil) sMs *= 1.10;

    engine.spawnTimer = root.setTimeout(loopSpawn, sMs);
  }

  // ---------- Tick loop ----------
  function feverTick(){
    const t = now();
    if (!engine.feverTickLast) engine.feverTickLast = t;
    const dt = Math.min(0.25, Math.max(0, (t - engine.feverTickLast)/1000));
    engine.feverTickLast = t;

    const acc = engine.hitAll > 0 ? (engine.hitGood/engine.hitAll) : 0;
    const cool = 7.5 * (0.6 + clamp(engine.combo/18,0,1)*0.6 + clamp(acc,0,1)*0.3);
    engine.fever = clamp(engine.fever - cool*dt, 0, 100);
    emitFever();
  }

  function median(arr){
    if (!arr || !arr.length) return 0;
    const a = arr.slice().sort((x,y)=>x-y);
    const mid = (a.length/2)|0;
    return (a.length%2) ? a[mid] : (a[mid-1]+a[mid])*0.5;
  }

  function perfSnapshot(){
    const acc = engine.hitAll > 0 ? (engine.hitGood/engine.hitAll) : 0;
    const missRate = engine.hitAll > 0 ? (engine.misses/engine.hitAll) : 0;
    const rtMed = engine.rtList.length ? median(engine.rtList) : 420;
    return { acc, combo: engine.combo, fever: engine.fever, missRate, rtMed };
  }

  function aiStep(){
    if (!engine.aiDir) return;

    // update every ~1.0s
    const t = now();
    if (engine.aiLast && (t - engine.aiLast.t) < 1000) return;
    const perf = perfSnapshot();
    const st = engine.aiDir.step(perf);
    engine.aiLast = { t, perf, st };

    // apply to engine
    engine.adapt.spawnMs   = st.spawnMs;
    engine.adapt.ttl       = st.ttl;
    engine.ttlMs           = st.ttl;
    engine.adapt.junkBias  = st.junkBias;
    engine.adapt.decoyBias = st.decoyBias;
    engine.adapt.bossEvery = st.bossEvery;
    engine.aiLockPx        = st.lockPx;
  }

  function aiCoachStep(){
    if (!engine.aiCoach) return;
    const acc = engine.hitAll > 0 ? (engine.hitGood/engine.hitAll) : 0;
    const missStreak = (engine.combo===0 && engine.misses>0) ? 2 : 0; // simple heuristic
    const rtMed = engine.rtList.length ? median(engine.rtList) : 420;

    const stormLeft = engine.storm ? Math.max(0, (engine.stormUntilMs - now())/1000) : 0;

    const tip = engine.aiCoach.update({
      acc, combo: engine.combo, fever: engine.fever,
      missStreak,
      rtMed,
      storm: engine.storm,
      stormLeftSec: stormLeft,
      bossAlive: engine.bossAlive,
      groupId: engine.groupId
    });

    if (tip && tip.text){
      emitCoach(tip.text, tip.mood || 'neutral');
    }
  }

  function loopTick(){
    if (!engine.running || engine.ended) return;

    // AI step (adaptive in play, deterministic in research)
    aiStep();

    // storm timing
    if (!engine.storm && now() >= engine.nextStormAtMs) enterStorm();
    if (engine.storm && now() >= engine.stormUntilMs){
      exitStorm();
    }else if (engine.storm){
      const leftMs = engine.stormUntilMs - now();
      if (leftMs <= 3200){
        DOC.body.classList.add('groups-storm-urgent');
        if (!engine._stormUrgent){
          engine._stormUrgent = true;
          stopStormTick();
          engine._stormTickTimer = root.setInterval(()=>{
            try{ NS.Audio && NS.Audio.tick && NS.Audio.tick(); }catch{}
          }, 520);
        }
      }
    }

    // clutch indicator
    if (engine.left <= 10) DOC.body.classList.add('clutch');
    else DOC.body.classList.remove('clutch');

    setBuffClass();
    feverTick();

    // AI coach (every ~1.8s via internal rate limit)
    aiCoachStep();

    // time
    engine.left = Math.max(0, engine.left - 0.14);
    updateTime();
    if (engine.left <= 0){ endGame('time'); return; }

    engine.tickTimer = root.setTimeout(loopTick, 140);
  }

  function clearAllTargets(){
    const layer = engine.layerEl;
    if (!layer) return;
    const list = layer.querySelectorAll('.fg-target');
    list.forEach(el=>{
      try{ root.clearTimeout(el._ttlTimer); }catch{}
      el.remove();
    });
  }

  function endGame(reason){
    if (engine.ended) return;
    engine.ended = true;
    engine.running = false;

    try{ root.clearTimeout(engine.spawnTimer); }catch{}
    try{ root.clearTimeout(engine.tickTimer); }catch{}
    stopStormTick();
    clearAllTargets();
    questStop();

    DOC.body.classList.remove('groups-storm','groups-storm-urgent','groups-overdrive','groups-freeze','clutch','mini-urgent');

    const acc = engine.hitAll > 0 ? Math.round((engine.hitGood/engine.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    let qs = null;
    try{ qs = engine.quest && engine.quest.getState ? engine.quest.getState() : null; }catch{}

    // RT metrics
    const avgRt = engine.rtList.length ? Math.round(engine.rtList.reduce((a,b)=>a+b,0)/engine.rtList.length) : 0;
    const medRt = engine.rtList.length ? Math.round(median(engine.rtList)) : 0;
    const fastRate = engine.rtList.length ? Math.round((engine.fastHits/engine.rtList.length)*100) : 0;

    const junkErrorPct = engine.hitAll > 0 ? Math.round((engine.nHitJunk/engine.hitAll)*100) : 0;

    emit('hha:end', {
      reason: reason || 'end',

      scoreFinal: engine.score|0,
      comboMax: engine.comboMax|0,
      misses: engine.misses|0,

      accuracyGoodPct: acc|0,
      junkErrorPct: junkErrorPct|0,

      avgRtGoodMs: avgRt|0,
      medianRtGoodMs: medRt|0,
      fastHitRatePct: fastRate|0,

      grade,

      goalsCleared: qs ? (qs.goalsCleared|0) : 0,
      goalsTotal:   qs ? (qs.goalsTotal|0)   : 0,
      miniCleared:  qs ? (qs.miniCleared|0)  : 0,
      miniTotal:    qs ? (qs.miniTotal|0)    : 0,

      // counters
      nTargetGoodSpawned: engine.nTargetGoodSpawned|0,
      nTargetWrongSpawned: engine.nTargetWrongSpawned|0,
      nTargetJunkSpawned: engine.nTargetJunkSpawned|0,
      nTargetDecoySpawned: engine.nTargetDecoySpawned|0,
      nTargetBossSpawned: engine.nTargetBossSpawned|0,
      nTargetStarSpawned: engine.nTargetStarSpawned|0,
      nTargetIceSpawned: engine.nTargetIceSpawned|0,
      nTargetDiamondSpawned: engine.nTargetDiamondSpawned|0,
      nTargetShieldSpawned: engine.nTargetShieldSpawned|0,

      nHitGood: engine.nHitGood|0,
      nHitWrong: engine.nHitWrong|0,
      nHitJunk: engine.nHitJunk|0,
      nHitDecoy: engine.nHitDecoy|0,
      nHitBoss: engine.nHitBoss|0,
      nHitJunkGuard: engine.nHitJunkGuard|0,
      nExpireGood: engine.nExpireGood|0,

      diff: engine.diff,
      runMode: engine.runMode,
      style: engine.style,
      seed: engine.seed,

      // AI snapshot
      ai: engine.aiDir ? engine.aiDir.getState() : null
    });
  }

  // ---------- Public API ----------
  function setLayerEl(el){
    engine.layerEl = el || null;
    applyView();
    setupView();
  }

  function start(diff, cfg){
    cfg = cfg || {};
    engine.runMode = (String(cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    engine.diff = String(diff || cfg.diff || 'normal').toLowerCase();
    engine.style = styleNorm(cfg.style || 'mix');
    engine.timeSec = clamp(cfg.time ?? 90, 30, 180);
    engine.seed = String(cfg.seed || Date.now());
    engine.rng = makeRng(engine.seed);

    // ✅ AI init
    engine.aiDir = createAIDifficultyDirector(engine.seed, engine.runMode, engine.diff);
    engine.aiCoach = createAICoach(engine.seed);
    engine.aiPat = createAIPatternGenerator(engine.seed);
    engine.aiLast = null;

    const dp = diffParams(engine.diff);

    engine.running = true;
    engine.ended = false;

    engine.left = engine.timeSec;
    engine.score = 0; engine.combo = 0; engine.comboMax = 0;
    engine.misses = 0; engine.hitGood = 0; engine.hitAll = 0;

    // reset counters
    engine.nTargetGoodSpawned=0; engine.nTargetWrongSpawned=0; engine.nTargetJunkSpawned=0; engine.nTargetDecoySpawned=0;
    engine.nTargetBossSpawned=0; engine.nTargetStarSpawned=0; engine.nTargetIceSpawned=0; engine.nTargetDiamondSpawned=0; engine.nTargetShieldSpawned=0;
    engine.nHitGood=0; engine.nHitWrong=0; engine.nHitJunk=0; engine.nHitDecoy=0; engine.nHitBoss=0; engine.nHitJunkGuard=0; engine.nExpireGood=0;

    engine.rtList = [];
    engine.fastHits = 0;

    engine.powerThr = dp.powerThr;
    engine.power = 0;

    engine.sizeBase = dp.size;
    engine.ttlMs = dp.ttl;

    engine.storm = false;
    engine.stormDurSec = dp.stormDur;
    engine.nextStormAtMs = now() + (engine.runMode==='research' ? (15000 + engine.rng()*4000) : (12000 + engine.rng()*11000));
    engine.stormPattern = (engine.aiPat && engine.aiPat.stormPattern) ? engine.aiPat.stormPattern(engine.style) : (engine.style==='hard'?'spiral':engine.style==='feel'?'wave':'burst');
    engine.stormSpawnIdx = 0;
    engine._stormUrgent = false;
    stopStormTick();

    engine.bossAlive = false;
    engine.bossHpMax = dp.bossHp;
    engine.nextBossAtMs = now() + 14000;

    engine.groupId = 1;
    engine.groupClean = true;

    engine.fever = 0;
    engine.shield = 0;
    engine.feverTickLast = 0;

    engine.magnetUntil = 0;
    engine.freezeUntil = 0;
    engine.overUntil = 0;
    setBuffClass();

    engine.vx = 0; engine.vy = 0;
    applyView();

    // bind shared events
    bindShootOnce();
    bindVrEventsOnce();

    updateTime();
    updatePower();
    updateScore();
    emitFever();
    emitCoach(SONG[1], 'neutral');

    // start quest
    questStart();

    emit('hha:celebrate', { kind:'goal', title:'เริ่มเกม! 🎵' });

    // initial AI apply (important for start feel)
    aiStep();

    loopSpawn();
    loopTick();
  }

  function stop(reason){ endGame(reason || 'stop'); }

  function getAIState(){
    return {
      dir: engine.aiDir ? engine.aiDir.getState() : null,
      lockPx: engine.aiLockPx|0,
      last: engine.aiLast
    };
  }

  NS.GameEngine = { start, stop, setLayerEl, getAIState };

})(typeof window !== 'undefined' ? window : globalThis);