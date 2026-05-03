// === /herohealth/vr-goodjunk/goodjunk-solo-boss.js ===
// FULL PATCH v20260503c-GOODJUNK-SOLO-BOSS-STANDALONE-NULLSAFE
// ✅ หน้า /herohealth/vr-goodjunk/goodjunk-solo-boss.html คือหน้าเล่นเกมจริง
// ✅ ไม่ใช่ launcher
// ✅ bindEvents null-safe ไม่พัง addEventListener of null
// ✅ เล่นได้เลย: Intro → Game → Summary
// ✅ ใช้ CFG.hub เท่านั้นเมื่อกลับ เพื่อให้ gate ส่งเข้า cooldown ได้ถูก
// ✅ รองรับ warmup gate → game → cooldown gate
// ✅ child-friendly + exciting boss phase + HERO HIT + Rage/Final Rush

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH = 'v20260503c-GOODJUNK-SOLO-BOSS-STANDALONE-NULLSAFE';
  const ROOT = 'https://supparang.github.io/webxr-health-mobile/herohealth/';
  const DEFAULT_HUB = ROOT + 'nutrition-zone.html';

  const qs = new URLSearchParams(location.search);

  function clean(v, fallback = ''){
    v = String(v ?? '').trim();
    return v || fallback;
  }

  function safeUrl(raw, fallback){
    try{
      if(!String(raw || '').trim()) return fallback;
      return new URL(String(raw), location.href).toString();
    }catch(_){
      return fallback;
    }
  }

  function num(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(v, min, max){
    v = Number(v);
    if(!Number.isFinite(v)) v = min;
    return Math.max(min, Math.min(max, v));
  }

  function now(){
    return performance.now();
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[ch]));
  }

  function mulberry32(seed){
    let t = (Number(seed) >>> 0) || 1;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CFG = Object.assign({
    pid: clean(qs.get('pid'), 'anon'),
    name: clean(qs.get('name') || qs.get('nick'), 'Hero'),
    nick: clean(qs.get('nick') || qs.get('name'), 'Hero'),
    diff: clean(qs.get('diff'), 'normal'),
    time: clean(qs.get('time'), '150'),
    seed: clean(qs.get('seed'), String(Date.now())),
    view: clean(qs.get('view'), 'mobile'),
    run: clean(qs.get('run'), 'play'),
    zone: clean(qs.get('zone'), 'nutrition'),
    cat: clean(qs.get('cat'), 'nutrition'),
    game: 'goodjunk',
    gameId: 'goodjunk',
    mode: clean(qs.get('mode'), 'solo-boss'),
    entry: clean(qs.get('entry'), 'solo-boss'),
    phaseBoss: clean(qs.get('phaseBoss'), '1'),
    hub: safeUrl(qs.get('hub'), DEFAULT_HUB),
    hubRoot: safeUrl(qs.get('hubRoot'), DEFAULT_HUB),
    api: clean(qs.get('api'), ''),
    log: clean(qs.get('log'), ''),
    studyId: clean(qs.get('studyId'), ''),
    section: clean(qs.get('section'), ''),
    session_code: clean(qs.get('session_code'), '')
  }, WIN.HHA_GOODJUNK_SOLO_BOSS_CONFIG || WIN.GJ_SOLO_BOSS_CONFIG || {});

  WIN.HHA_GOODJUNK_SOLO_BOSS_CONFIG = CFG;
  WIN.GJ_SOLO_BOSS_CONFIG = CFG;

  const DIFF = String(CFG.diff || 'normal').toLowerCase();

  const TUNING = {
    easy: {
      time: 90,
      lives: 6,
      bossHp: 180,
      spawnEvery: 920,
      maxTargets: 5,
      junkChance: 0.34,
      speedMin: 1.0,
      speedMax: 1.8,
      bossAttackEvery: 7600,
      finalRushAt: 0.25
    },
    normal: {
      time: 120,
      lives: 5,
      bossHp: 240,
      spawnEvery: 760,
      maxTargets: 6,
      junkChance: 0.42,
      speedMin: 1.25,
      speedMax: 2.25,
      bossAttackEvery: 6200,
      finalRushAt: 0.30
    },
    hard: {
      time: 150,
      lives: 4,
      bossHp: 320,
      spawnEvery: 620,
      maxTargets: 7,
      junkChance: 0.48,
      speedMin: 1.5,
      speedMax: 2.7,
      bossAttackEvery: 5200,
      finalRushAt: 0.35
    },
    challenge: {
      time: 150,
      lives: 4,
      bossHp: 380,
      spawnEvery: 520,
      maxTargets: 8,
      junkChance: 0.52,
      speedMin: 1.8,
      speedMax: 3.2,
      bossAttackEvery: 4600,
      finalRushAt: 0.40
    }
  };

  const tune = TUNING[DIFF] || TUNING.normal;
  const plannedTime = clamp(num(CFG.time, tune.time), 45, 180);

  const GOOD = [
    { emoji:'🍎', label:'แอปเปิล', dmg:10, charge:8 },
    { emoji:'🥦', label:'บรอกโคลี', dmg:12, charge:9 },
    { emoji:'🥕', label:'แครอท', dmg:10, charge:8 },
    { emoji:'🍉', label:'แตงโม', dmg:9, charge:7 },
    { emoji:'🐟', label:'ปลา', dmg:13, charge:10 },
    { emoji:'🥚', label:'ไข่', dmg:12, charge:9 },
    { emoji:'🥛', label:'นม', dmg:11, charge:8 },
    { emoji:'🍚', label:'ข้าว', dmg:10, charge:7 },
    { emoji:'🫘', label:'ถั่ว', dmg:12, charge:9 },
    { emoji:'🥬', label:'ผักใบเขียว', dmg:12, charge:9 }
  ];

  const JUNK = [
    { emoji:'🍩', label:'โดนัท', dmg:0, penalty:1 },
    { emoji:'🥤', label:'น้ำอัดลม', dmg:0, penalty:1 },
    { emoji:'🍟', label:'เฟรนช์ฟรายส์', dmg:0, penalty:1 },
    { emoji:'🍔', label:'เบอร์เกอร์มันเยอะ', dmg:0, penalty:1 },
    { emoji:'🍭', label:'ลูกอม', dmg:0, penalty:1 },
    { emoji:'🍫', label:'ช็อกโกแลตหวาน', dmg:0, penalty:1 },
    { emoji:'🧁', label:'คัพเค้ก', dmg:0, penalty:1 }
  ];

  const BOSS_ATTACKS = [
    { emoji:'🌪️', text:'Junk Storm!' },
    { emoji:'🍩', text:'Sugar Trap!' },
    { emoji:'🥤', text:'Soda Blast!' },
    { emoji:'🍟', text:'Fried Rain!' }
  ];

  const state = {
    patch: PATCH,
    booted: false,
    started: false,
    paused: false,
    ended: false,

    score: 0,
    good: 0,
    junkHit: 0,
    missedGood: 0,
    miss: 0,
    combo: 0,
    bestCombo: 0,

    lives: tune.lives,
    timeLeft: plannedTime,
    bossHp: tune.bossHp,
    bossMaxHp: tune.bossHp,
    heroHit: 0,
    phase: 1,
    finalRush: false,
    rage: 0,

    lastFrame: 0,
    lastSpawn: 0,
    lastBossAttack: 0,
    startTs: 0,
    endTs: 0,

    targets: new Map(),
    seq: 0,

    rng: mulberry32(Number(CFG.seed || Date.now()))
  };

  const el = {};

  function $(id){
    return DOC.getElementById(id);
  }

  function cacheElements(){
    Object.assign(el, {
      app: $('gjSoloBossApp') || $('app') || DOC.body,

      boot: $('gjBoot'),
      bootStatus: $('gjBootStatusText'),
      bootError: $('gjBootError'),
      bootStartBtn: $('gjBootStartBtn'),
      bootBackBtn: $('gjBootBackBtn'),

      introScreen: $('introScreen'),
      introStartBtn: $('introStartBtn') || $('startBtn'),
      introBackBtn: $('introBackBtn'),

      gameScreen: $('gameScreen'),
      summaryScreen: $('summaryScreen'),

      scoreText: $('scoreText'),
      timerText: $('timerText'),
      lifeText: $('lifeText'),
      phaseText: $('phaseText'),
      bossHpText: $('bossHpText'),
      bossHpFill: $('bossHpFill'),
      heroHitText: $('heroHitText'),
      heroHitFill: $('heroHitFill'),
      heroHitBtn: $('heroHitBtn'),
      comboText: $('comboText'),
      goodText: $('goodText'),
      missText: $('missText'),
      rageText: $('rageText'),
      goalText: $('goalText'),

      backBtn: $('backBtn'),
      pauseBtn: $('pauseBtn'),
      resumeBtn: $('resumeBtn'),
      pauseOverlay: $('pauseOverlay'),
      pauseResumeBtn: $('pauseResumeBtn'),
      pauseBackBtn: $('pauseBackBtn'),

      gameWorld: $('gameWorld'),
      targetLayer: $('targetLayer') || $('foodLayer'),
      fxLayer: $('fxLayer') || $('particleLayer') || $('overlayLayer'),

      bossAvatar: $('bossAvatar'),
      bossArena: $('bossArena'),
      coachText: $('coachText'),
      toast: $('toast'),
      toastText: $('toastText'),
      announcer: $('announcer'),
      finalRushText: $('finalRushText'),

      summaryTitle: $('summaryTitle'),
      summaryScore: $('summaryScore'),
      summaryGood: $('summaryGood'),
      summaryMiss: $('summaryMiss'),
      summaryStars: $('summaryStars'),
      summaryTip: $('summaryTip'),
      summaryReplayBtn: $('summaryReplayBtn') || $('replayBtn') || $('restartBtn'),
      summaryBackBtn: $('summaryBackBtn') || $('backHubBtn') || $('hubBtn') || $('homeBtn'),

      replayBtn: $('replayBtn'),
      restartBtn: $('restartBtn'),
      homeBtn: $('homeBtn'),
      hubBtn: $('hubBtn'),
      backHubBtn: $('backHubBtn')
    });
  }

  function on(node, eventName, handler, options){
    if(node && typeof node.addEventListener === 'function'){
      node.addEventListener(eventName, handler, options);
      return true;
    }

    try{
      console.warn('[GoodJunk Solo Boss] Missing event target:', eventName);
    }catch(_){}

    return false;
  }

  function setText(node, text){
    if(node) node.textContent = String(text);
  }

  function setHtml(node, html){
    if(node) node.innerHTML = String(html);
  }

  function show(node){
    if(!node) return;
    node.hidden = false;
    node.style.display = '';
  }

  function hide(node){
    if(!node) return;
    node.hidden = true;
    node.style.display = 'none';
  }

  function hideBoot(){
    if(el.boot){
      el.boot.classList.add('is-hidden');
      el.boot.style.display = 'none';
    }
    if(typeof WIN.GJ_SOLO_HIDE_BOOT === 'function'){
      try{ WIN.GJ_SOLO_HIDE_BOOT(); }catch(_){}
    }
  }

  function showBootError(err){
    if(el.bootStatus) el.bootStatus.textContent = 'โหลดเกมไม่สำเร็จ';
    if(el.bootError){
      el.bootError.style.display = 'block';
      el.bootError.textContent = String(err && (err.stack || err.message) || err || 'Unknown error');
    }
  }

  function goHub(){
    try{
      WIN.location.href = CFG.hub || DEFAULT_HUB;
    }catch(_){
      WIN.location.href = DEFAULT_HUB;
    }
  }

  function replayGame(){
    try{
      const u = new URL(location.href);
      u.searchParams.set('seed', String(Date.now()));
      WIN.location.href = u.toString();
    }catch(_){
      WIN.location.reload();
    }
  }

  function rand(){
    return state.rng();
  }

  function pick(arr){
    return arr[Math.floor(rand() * arr.length)];
  }

  function worldRect(){
    const node = el.gameWorld || el.app || DOC.body;
    const r = node.getBoundingClientRect();
    return {
      width: Math.max(320, r.width || WIN.innerWidth),
      height: Math.max(420, r.height || WIN.innerHeight)
    };
  }

  function calcAccuracy(){
    const total = state.good + state.junkHit + state.missedGood;
    if(total <= 0) return 100;
    return Math.round((state.good / total) * 100);
  }

  function calcStars(){
    const acc = calcAccuracy();
    if(state.bossHp <= 0 && acc >= 85 && state.miss <= 3) return '⭐⭐⭐';
    if(state.bossHp <= 0 && acc >= 65) return '⭐⭐';
    if(state.bossHp <= 0) return '⭐';
    if(state.score >= 120) return '⭐';
    return '☆';
  }

  function updateHud(){
    setText(el.scoreText, state.score);
    setText(el.timerText, Math.max(0, Math.ceil(state.timeLeft)));
    setText(el.lifeText, '❤️'.repeat(Math.max(0, state.lives)) || '0');
    setText(el.phaseText, state.finalRush ? 'FINAL' : String(state.phase));
    setText(el.bossHpText, `${Math.max(0, Math.ceil((state.bossHp / state.bossMaxHp) * 100))}%`);
    setText(el.heroHitText, `${Math.round(state.heroHit)}%`);
    setText(el.comboText, state.combo);
    setText(el.goodText, state.good);
    setText(el.missText, state.miss);
    setText(el.rageText, state.rage);

    if(el.bossHpFill){
      el.bossHpFill.style.width = `${clamp((state.bossHp / state.bossMaxHp) * 100, 0, 100)}%`;
    }

    if(el.heroHitFill){
      el.heroHitFill.style.width = `${clamp(state.heroHit, 0, 100)}%`;
    }

    if(el.goalText){
      const msg = state.finalRush
        ? '🔥 FINAL RUSH! เก็บอาหารดีให้เร็ว ใช้ HERO HIT เพื่อปิดฉากบอส!'
        : 'แตะอาหารดี 🥦🍎 เพื่อชาร์จ HERO HIT และหลบอาหารขยะ 🍩🥤';
      el.goalText.textContent = msg;
    }

    if(el.bossAvatar){
      if(state.finalRush){
        el.bossAvatar.textContent = '🔥👑🍔';
      }else if(state.bossHp / state.bossMaxHp < 0.5){
        el.bossAvatar.textContent = '😡🍔';
      }else{
        el.bossAvatar.textContent = '👑🍔';
      }
    }
  }

  function toast(message, ms = 1200){
    const msg = String(message || '');

    if(el.toastText){
      el.toastText.textContent = msg;
    }

    if(el.toast){
      el.toast.textContent = msg;
      el.toast.classList.add('show');
      el.toast.style.display = 'block';
      clearTimeout(toast._t);
      toast._t = setTimeout(() => {
        el.toast.classList.remove('show');
        el.toast.style.display = '';
      }, ms);
      return;
    }

    const t = DOC.createElement('div');
    t.className = 'gjRuntimeToast';
    t.textContent = msg;
    t.style.cssText = [
      'position:absolute',
      'left:50%',
      'bottom:calc(78px + env(safe-area-inset-bottom,0px))',
      'transform:translateX(-50%)',
      'z-index:9999',
      'max-width:min(92vw,640px)',
      'padding:12px 14px',
      'border-radius:999px',
      'background:rgba(15,23,42,.92)',
      'border:1px solid rgba(148,163,184,.18)',
      'color:#f8fafc',
      'font-weight:1000',
      'box-shadow:0 18px 42px rgba(0,0,0,.34)',
      'text-align:center'
    ].join(';');

    (el.app || DOC.body).appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function fx(x, y, text, type = 'good'){
    const layer = el.fxLayer || el.app || DOC.body;
    const n = DOC.createElement('div');
    n.textContent = text;
    n.className = `gjFx ${type}`;
    n.style.cssText = [
      'position:absolute',
      `left:${x}px`,
      `top:${y}px`,
      'transform:translate(-50%,-50%)',
      'z-index:60',
      'pointer-events:none',
      'font-size:24px',
      'font-weight:1000',
      `color:${type === 'bad' ? '#fca5a5' : type === 'gold' ? '#fde68a' : '#86efac'}`,
      'text-shadow:0 10px 28px rgba(0,0,0,.42)',
      'animation:gjFxFloat .7s ease-out forwards'
    ].join(';');

    ensureFxStyle();
    layer.appendChild(n);
    setTimeout(() => n.remove(), 760);
  }

  function ensureFxStyle(){
    if(DOC.getElementById('gj-solo-runtime-style')) return;
    const style = DOC.createElement('style');
    style.id = 'gj-solo-runtime-style';
    style.textContent = `
      @keyframes gjFxFloat{
        from{ opacity:1; transform:translate(-50%,-50%) translateY(0) scale(1); }
        to{ opacity:0; transform:translate(-50%,-50%) translateY(-36px) scale(1.12); }
      }
      .gjSoloShake{ animation:gjSoloShake .24s linear 1; }
      @keyframes gjSoloShake{
        0%,100%{ transform:translateX(0); }
        25%{ transform:translateX(-7px); }
        50%{ transform:translateX(7px); }
        75%{ transform:translateX(-4px); }
      }
      .gjTargetPop{ animation:gjTargetPop .18s ease-out 1; }
      @keyframes gjTargetPop{
        from{ transform:translate(-50%,-50%) scale(.6); opacity:.2; }
        to{ transform:translate(-50%,-50%) scale(1); opacity:1; }
      }
    `;
    DOC.head.appendChild(style);
  }

  function shake(){
    const node = el.gameWorld || el.app;
    if(!node) return;
    node.classList.remove('gjSoloShake');
    void node.offsetWidth;
    node.classList.add('gjSoloShake');
  }

  function removeTarget(id){
    const item = state.targets.get(id);
    if(!item) return;
    state.targets.delete(id);
    try{ item.node.remove(); }catch(_){}
  }

  function clearTargets(){
    Array.from(state.targets.keys()).forEach(removeTarget);
  }

  function spawnTarget(forceKind = ''){
    if(state.ended || state.paused || !state.started) return;
    if(state.targets.size >= tune.maxTargets + (state.finalRush ? 2 : 0)) return;

    const r = worldRect();
    const kind = forceKind || (rand() < tune.junkChance ? 'junk' : 'good');
    const data = kind === 'good' ? pick(GOOD) : pick(JUNK);

    const id = `gj_${Date.now()}_${++state.seq}`;
    const node = DOC.createElement('button');

    const size = kind === 'good'
      ? 58 + Math.floor(rand() * 20)
      : 56 + Math.floor(rand() * 18);

    const x = clamp(40 + rand() * (r.width - 80), 36, r.width - 36);
    const y = clamp(150 + rand() * (r.height - 230), 120, r.height - 68);

    node.type = 'button';
    node.className = `gjTarget foodTarget target gj-food ${kind} gjTargetPop`;
    node.setAttribute('aria-label', data.label);
    node.textContent = data.emoji;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.fontSize = `${Math.round(size * 0.56)}px`;
    node.style.background = kind === 'good'
      ? 'radial-gradient(circle at 35% 30%,rgba(255,255,255,.32),rgba(34,197,94,.22),rgba(15,23,42,.86))'
      : 'radial-gradient(circle at 35% 30%,rgba(255,255,255,.24),rgba(239,68,68,.24),rgba(15,23,42,.88))';

    const speed = tune.speedMin + rand() * (tune.speedMax - tune.speedMin);
    const vx = (rand() < 0.5 ? -1 : 1) * speed * (state.finalRush ? 1.2 : 1);
    const vy = (rand() < 0.5 ? -1 : 1) * speed * 0.55;

    const ttl = kind === 'good'
      ? (state.finalRush ? 2300 : 3100)
      : (state.finalRush ? 2600 : 3400);

    const item = {
      id,
      node,
      kind,
      data,
      x,
      y,
      vx,
      vy,
      size,
      born: now(),
      ttl
    };

    on(node, 'pointerdown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      hitTarget(id);
    }, { passive:false });

    (el.targetLayer || el.gameWorld || el.app || DOC.body).appendChild(node);
    state.targets.set(id, item);
  }

  function hitTarget(id){
    if(state.ended || state.paused) return;

    const item = state.targets.get(id);
    if(!item) return;

    const x = item.x;
    const y = item.y;

    if(item.kind === 'good'){
      const damage = item.data.dmg + Math.floor(state.combo / 5);
      state.score += 10 + Math.min(20, state.combo);
      state.good++;
      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.heroHit = clamp(state.heroHit + item.data.charge + Math.min(8, state.combo), 0, 100);
      state.bossHp = clamp(state.bossHp - damage, 0, state.bossMaxHp);
      fx(x, y, `+${10 + Math.min(20, state.combo)}`, 'good');

      if(state.combo > 0 && state.combo % 8 === 0){
        toast(`Combo x${state.combo}! HERO HIT ชาร์จเร็วขึ้น ⚡`);
      }
    }else{
      state.junkHit++;
      state.miss++;
      state.combo = 0;
      state.lives = Math.max(0, state.lives - item.data.penalty);
      state.rage = clamp(state.rage + 8, 0, 100);
      state.score = Math.max(0, state.score - 8);
      fx(x, y, 'พลาด!', 'bad');
      shake();
    }

    removeTarget(id);
    checkPhase();
    updateHud();

    if(state.bossHp <= 0){
      endGame(true);
      return;
    }

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function missGoodTarget(item){
    state.missedGood++;
    state.miss++;
    state.combo = 0;
    state.lives = Math.max(0, state.lives - 1);
    fx(item.x, item.y, 'หลุด!', 'bad');
    shake();
    updateHud();

    if(state.lives <= 0){
      endGame(false);
    }
  }

  function updateTargets(dt){
    const r = worldRect();
    const t = now();

    for(const [id, item] of Array.from(state.targets.entries())){
      item.x += item.vx * dt * 60;
      item.y += item.vy * dt * 60;

      if(item.x < 32 || item.x > r.width - 32) item.vx *= -1;
      if(item.y < 112 || item.y > r.height - 54) item.vy *= -1;

      item.x = clamp(item.x, 32, r.width - 32);
      item.y = clamp(item.y, 112, r.height - 54);

      item.node.style.left = `${item.x}px`;
      item.node.style.top = `${item.y}px`;

      if(t - item.born > item.ttl){
        if(item.kind === 'good'){
          missGoodTarget(item);
        }
        removeTarget(id);
      }
    }
  }

  function useHeroHit(){
    if(state.ended || state.paused || !state.started) return;

    if(state.heroHit < 100){
      toast('HERO HIT ยังไม่เต็ม เก็บอาหารดีต่ออีกนิด ⚡');
      return;
    }

    const damage = state.finalRush ? 74 : 58;
    state.heroHit = 0;
    state.bossHp = clamp(state.bossHp - damage, 0, state.bossMaxHp);
    state.score += 35;
    clearTargets();
    shake();
    toast(`HERO HIT! โจมตีบอส -${damage} 👊`, 1400);
    fx(worldRect().width / 2, worldRect().height / 2, 'HERO HIT!', 'gold');

    updateHud();

    if(state.bossHp <= 0){
      endGame(true);
    }
  }

  function bossAttack(){
    if(state.ended || state.paused || !state.started) return;

    const atk = pick(BOSS_ATTACKS);
    toast(`${atk.emoji} ${atk.text}`, 1100);
    shake();

    const count = state.finalRush ? 4 : 3;
    for(let i = 0; i < count; i++){
      setTimeout(() => spawnTarget('junk'), i * 120);
    }
  }

  function checkPhase(){
    const hpPct = state.bossHp / state.bossMaxHp;

    if(!state.finalRush && hpPct <= tune.finalRushAt){
      state.finalRush = true;
      state.phase = 3;
      toast('🔥 FINAL RUSH! บอสคลั่งแล้ว!', 1500);
      shake();
    }else if(hpPct <= 0.58){
      state.phase = 2;
    }else{
      state.phase = 1;
    }
  }

  function gameLoop(ts){
    if(state.ended) return;

    if(!state.lastFrame) state.lastFrame = ts;
    const dt = Math.min(0.05, (ts - state.lastFrame) / 1000);
    state.lastFrame = ts;

    if(!state.paused && state.started){
      state.timeLeft = Math.max(0, state.timeLeft - dt);

      const spawnEvery = state.finalRush ? tune.spawnEvery * 0.66 : tune.spawnEvery;
      if(ts - state.lastSpawn >= spawnEvery){
        state.lastSpawn = ts;
        spawnTarget();
      }

      if(ts - state.lastBossAttack >= tune.bossAttackEvery){
        state.lastBossAttack = ts;
        bossAttack();
      }

      updateTargets(dt);
      updateHud();

      if(state.timeLeft <= 0){
        endGame(state.bossHp <= 0);
        return;
      }
    }

    requestAnimationFrame(gameLoop);
  }

  function showIntro(){
    hideBoot();
    show(el.introScreen);
    hide(el.gameScreen);
    hide(el.summaryScreen);
    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');
  }

  function startGame(){
    if(state.started && !state.ended) return;

    hideBoot();
    hide(el.introScreen);
    show(el.gameScreen);
    hide(el.summaryScreen);

    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');

    state.started = true;
    state.paused = false;
    state.ended = false;
    state.startTs = Date.now();
    state.lastFrame = 0;
    state.lastSpawn = 0;
    state.lastBossAttack = now() + 1800;

    updateHud();
    toast('เริ่มสู้ Junk King! 👑');
    requestAnimationFrame(gameLoop);
  }

  function pauseGame(){
    if(!state.started || state.ended) return;
    state.paused = true;
    if(el.pauseOverlay) el.pauseOverlay.classList.add('show');
    toast('พักเกม');
  }

  function resumeGame(){
    if(!state.started || state.ended) return;
    state.paused = false;
    state.lastFrame = 0;
    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');
    toast('เล่นต่อ!');
  }

  function starTip(win){
    if(win && calcAccuracy() >= 85) return 'สุดยอด! เลือกอาหารดีได้แม่นมาก ใช้ HERO HIT ได้ดี';
    if(win) return 'เยี่ยมมาก! ชนะบอสแล้ว รอบหน้าลองลดการพลาดให้น้อยลง';
    if(state.good >= 10) return 'เกือบแล้ว! เลือกอาหารดีได้หลายครั้ง รอบหน้าระวังอาหารขยะเพิ่ม';
    return 'ลองใหม่ได้เลย มองให้ดีว่าอะไรคืออาหารดีและอะไรคืออาหารขยะ';
  }

  function saveSummary(win){
    const payload = {
      game: 'goodjunk',
      mode: 'solo-boss',
      pid: CFG.pid,
      name: CFG.name,
      score: state.score,
      scoreFinal: state.score,
      good: state.good,
      junkHit: state.junkHit,
      missedGood: state.missedGood,
      miss: state.miss,
      misses: state.miss,
      accPct: calcAccuracy(),
      stars: calcStars(),
      win,
      bossDefeated: win,
      bestCombo: state.bestCombo,
      durationSec: Math.max(0, Math.round((Date.now() - state.startTs) / 1000)),
      endedAt: new Date().toISOString(),
      patch: PATCH
    };

    try{
      localStorage.setItem(`HHA_LAST_SUMMARY:goodjunk:${CFG.pid || 'anon'}`, JSON.stringify(payload));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        ts: Date.now(),
        payload,
        ...payload
      }));
    }catch(_){}

    return payload;
  }

  function endGame(win){
    if(state.ended) return;

    state.ended = true;
    state.paused = false;
    state.endTs = Date.now();

    clearTargets();

    hide(el.gameScreen);
    hide(el.introScreen);
    show(el.summaryScreen);

    if(el.pauseOverlay) el.pauseOverlay.classList.remove('show');

    const summary = saveSummary(win);

    setText(el.summaryTitle, win ? 'ชนะบอสแล้ว!' : 'หมดพลังแล้ว');
    setText(el.summaryScore, summary.score);
    setText(el.summaryGood, summary.good);
    setText(el.summaryMiss, summary.miss);
    setText(el.summaryStars, summary.stars);
    setText(el.summaryTip, starTip(win));

    toast(win ? 'Victory! 🎉' : 'ลองใหม่อีกครั้งนะ 💪', 1500);
  }

  function bindEvents(){
    on(el.bootStartBtn, 'click', startGame);
    on(el.bootBackBtn, 'click', goHub);

    on(el.introStartBtn, 'click', startGame);
    on(el.introBackBtn, 'click', goHub);

    on(el.backBtn, 'click', goHub);
    on(el.pauseBtn, 'click', pauseGame);
    on(el.resumeBtn, 'click', resumeGame);

    on(el.pauseResumeBtn, 'click', resumeGame);
    on(el.pauseBackBtn, 'click', goHub);

    on(el.summaryReplayBtn, 'click', replayGame);
    on(el.summaryBackBtn, 'click', goHub);

    on(el.replayBtn, 'click', replayGame);
    on(el.restartBtn, 'click', replayGame);
    on(el.homeBtn, 'click', goHub);
    on(el.hubBtn, 'click', goHub);
    on(el.backHubBtn, 'click', goHub);

    on(el.heroHitBtn, 'click', useHeroHit);

    on(WIN, 'resize', () => {
      updateHud();
    });

    on(DOC, 'visibilitychange', () => {
      if(DOC.hidden && state.started && !state.ended){
        pauseGame();
      }
    });

    on(WIN, 'hha:goodjunk:solo:start', () => {
      startGame();
    });

    on(DOC, 'hha:goodjunk:solo:start', () => {
      startGame();
    });

    on(WIN, 'keydown', ev => {
      if(ev.key === 'Escape') pauseGame();
      if(ev.key === ' '){
        ev.preventDefault();
        useHeroHit();
      }
    });
  }

  function ensureRequiredDom(){
    let app = $('gjSoloBossApp') || $('app');

    if(!app){
      app = DOC.createElement('main');
      app.id = 'gjSoloBossApp';
      app.className = 'gj-solo-boss-app';
      DOC.body.appendChild(app);
    }

    function add(id, tag = 'div', parent = app){
      let n = $(id);
      if(!n){
        n = DOC.createElement(tag);
        n.id = id;
        parent.appendChild(n);
      }
      return n;
    }

    add('introScreen', 'section');
    add('gameScreen', 'section');
    add('summaryScreen', 'section');

    add('introStartBtn', 'button');
    add('introBackBtn', 'button');
    add('backBtn', 'button');
    add('pauseBtn', 'button');
    add('resumeBtn', 'button');
    add('summaryReplayBtn', 'button');
    add('summaryBackBtn', 'button');

    add('scoreText');
    add('timerText');
    add('lifeText');
    add('phaseText');
    add('bossHpText');
    add('heroHitText');
    add('comboText');
    add('goodText');
    add('missText');

    add('gameWorld');
    add('targetLayer');
    add('fxLayer');

    add('summaryTitle');
    add('summaryScore');
    add('summaryGood');
    add('summaryMiss');
    add('summaryStars');
    add('summaryTip');

    cacheElements();
  }

  function boot(root, cfg){
    if(state.booted) return;
    state.booted = true;

    try{
      if(cfg && typeof cfg === 'object'){
        Object.assign(CFG, cfg);
      }

      ensureFxStyle();
      ensureRequiredDom();
      cacheElements();
      bindEvents();
      updateHud();

      if(el.bootStatus) el.bootStatus.textContent = 'Game engine ready';

      if(CFG.run === 'play' || qs.get('autostart') === '1'){
        setTimeout(startGame, 180);
      }else{
        showIntro();
      }

      console.log('[GoodJunk Solo Boss] booted', {
        patch: PATCH,
        cfg: CFG
      });
    }catch(err){
      console.error('[GoodJunk Solo Boss] boot failed', err);
      showBootError(err);
    }
  }

  WIN.bootGoodJunkSoloBoss = boot;
  WIN.startGoodJunkSoloBoss = function(root, cfg){
    boot(root, cfg);
    startGame();
  };

  WIN.GoodJunkSoloBoss = {
    PATCH,
    boot,
    start(root, cfg){
      boot(root, cfg);
      startGame();
    },
    pause: pauseGame,
    resume: resumeGame,
    goHub,
    getState(){
      return JSON.parse(JSON.stringify({
        score: state.score,
        good: state.good,
        miss: state.miss,
        lives: state.lives,
        bossHp: state.bossHp,
        timeLeft: state.timeLeft,
        patch: PATCH
      }));
    }
  };

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', () => boot());
  }else{
    boot();
  }
})();
