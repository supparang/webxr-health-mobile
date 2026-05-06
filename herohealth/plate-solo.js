// === /herohealth/plate-solo.js ===
// HeroHealth Plate Solo
// v20260506-v26 Production Split
// Balanced Plate Rush
// Includes v2.0–v2.6: Rush, Overload, Missions, Order, Double Choice,
// Mini Events, Boss Skills, Daily Challenge, Stars, Badges, Best,
// cVR Aim, Safe Storage, HHA Logging Hardening.

(() => {
  'use strict';

  const VERSION = '20260506-PLATE-SOLO-V2.6-PRODUCTION-SPLIT';

  const $ = (id) => document.getElementById(id);
  const Q = new URL(location.href).searchParams;
  const qs = (k, d = '') => Q.get(k) ?? d;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));

  const DIFF = qs('diff', 'normal').toLowerCase();
  const VIEW = qs('view', 'mobile').toLowerCase();

  const HHA = {
    version:VERSION,
    projectTag:'HeroHealth',
    gameId:'plate-solo',
    zone:'nutrition',
    mode:'solo',
    pid:qs('pid','anon'),
    name:qs('name', qs('nick','Hero')),
    nick:qs('nick', qs('name','Hero')),
    runMode:qs('run','play'),
    studyId:qs('studyId',''),
    phase:qs('phase',''),
    conditionGroup:qs('conditionGroup',''),
    section:qs('section',''),
    sessionCode:qs('session_code',''),
    logEndpoint:qs('log','') || qs('api','')
  };

  const SAFE_STORE = {
    ok:true,

    get(key, fallback = null){
      try{
        const v = localStorage.getItem(key);
        if(v === null || v === undefined) return fallback;
        return v;
      }catch(e){
        this.ok = false;
        return fallback;
      }
    },

    set(key, value){
      try{
        localStorage.setItem(key, value);
        return true;
      }catch(e){
        this.ok = false;
        return false;
      }
    },

    remove(key){
      try{
        localStorage.removeItem(key);
        return true;
      }catch(e){
        this.ok = false;
        return false;
      }
    }
  };

  function safeJsonStringify(obj){
    try{
      return JSON.stringify(obj);
    }catch(e){
      return '{}';
    }
  }

  function safeJsonParse(s, fallback){
    try{
      return JSON.parse(s);
    }catch(e){
      return fallback;
    }
  }

  function bangkokIso(){
    try{
      const d = new Date();
      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone:'Asia/Bangkok',
        year:'numeric',
        month:'2-digit',
        day:'2-digit',
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit',
        hour12:false
      }).format(d);

      return parts.replace(' ', 'T') + '+07:00';
    }catch(e){
      return new Date().toISOString();
    }
  }

  function bangkokYmd(){
    try{
      return new Intl.DateTimeFormat('en-CA', {
        timeZone:'Asia/Bangkok',
        year:'numeric',
        month:'2-digit',
        day:'2-digit'
      }).format(new Date());
    }catch(e){
      return new Date().toISOString().slice(0,10);
    }
  }

  function hashSeed(str){
    let h = 2166136261 >>> 0;
    str = String(str || 'plate');

    for(let i = 0; i < str.length; i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }

  function mulberry32(seed){
    let t = seed >>> 0;

    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DAILY_YMD = bangkokYmd();
  const RAW_SEED = qs('seed','');
  const ACTIVE_SEED = RAW_SEED || `plate-daily-${DAILY_YMD}-${DIFF}`;

  const rand = mulberry32(hashSeed(ACTIVE_SEED));
  const dailyRand = mulberry32(hashSeed(`plate-daily-challenge-${DAILY_YMD}-${DIFF}`));

  const pick = (arr) => arr[Math.floor(rand() * arr.length)] || arr[0];
  const dailyPick = (arr) => arr[Math.floor(dailyRand() * arr.length)] || arr[0];
  const chance = (p) => rand() < p;

  const CFG = {
    easy:{
      spawn:1220,
      life:5200,
      junk:.12,
      speed:1,
      bossAtk:6500,
      target:3.6
    },
    normal:{
      spawn:980,
      life:4600,
      junk:.19,
      speed:1.12,
      bossAtk:5600,
      target:4
    },
    hard:{
      spawn:790,
      life:3900,
      junk:.26,
      speed:1.24,
      bossAtk:4700,
      target:4.3
    },
    challenge:{
      spawn:650,
      life:3300,
      junk:.32,
      speed:1.38,
      bossAtk:3900,
      target:4.5
    }
  }[DIFF] || {
    spawn:980,
    life:4600,
    junk:.19,
    speed:1.12,
    bossAtk:5600,
    target:4
  };

  const GROUPS = [
    {id:'protein', label:'โปรตีน', icon:'🥚'},
    {id:'carb', label:'ข้าว/แป้ง', icon:'🍚'},
    {id:'veg', label:'ผัก', icon:'🥦'},
    {id:'fruit', label:'ผลไม้', icon:'🍎'},
    {id:'fat', label:'ไขมันดี', icon:'🥜'}
  ];

  const FOODS = [
    {emoji:'🥚', name:'ไข่', effects:{protein:1}},
    {emoji:'🐟', name:'ปลา', effects:{protein:1}},
    {emoji:'🍗', name:'ไก่', effects:{protein:1}},
    {emoji:'🫘', name:'ถั่ว', effects:{protein:.7,fat:.35}, mixed:true},
    {emoji:'🥛', name:'นม', effects:{protein:.7,fat:.25}, mixed:true},

    {emoji:'🍚', name:'ข้าว', effects:{carb:1}},
    {emoji:'🍞', name:'ขนมปัง', effects:{carb:1}},
    {emoji:'🥔', name:'มัน', effects:{carb:1}},
    {emoji:'🍠', name:'เผือก/มัน', effects:{carb:1}},

    {emoji:'🥦', name:'บรอกโคลี', effects:{veg:1}},
    {emoji:'🥬', name:'ผักใบ', effects:{veg:1}},
    {emoji:'🥕', name:'แครอต', effects:{veg:1}},
    {emoji:'🥒', name:'แตงกวา', effects:{veg:1}},

    {emoji:'🍎', name:'แอปเปิล', effects:{fruit:1}},
    {emoji:'🍌', name:'กล้วย', effects:{fruit:1}},
    {emoji:'🍊', name:'ส้ม', effects:{fruit:1}},
    {emoji:'🍉', name:'แตงโม', effects:{fruit:1}},

    {emoji:'🥜', name:'ถั่ว/ไขมันดี', effects:{fat:1}},
    {emoji:'🥑', name:'อะโวคาโด', effects:{fat:1}},
    {emoji:'🫒', name:'น้ำมันดี', effects:{fat:1}},

    {emoji:'🍟', name:'เฟรนช์ฟรายส์', junk:true, effects:{fat:1.2,carb:.5}},
    {emoji:'🍰', name:'เค้กหวาน', junk:true, effects:{carb:1,fat:.6}},
    {emoji:'🧃', name:'น้ำหวาน', junk:true, effects:{carb:1}},
    {emoji:'🍩', name:'โดนัท', junk:true, effects:{carb:.8,fat:.8}},
    {emoji:'🍔', name:'เบอร์เกอร์', junk:true, effects:{carb:.8,fat:1,protein:.3}}
  ];

  const BOSSES = [
    {
      id:'greasy',
      icon:'👾',
      name:'Greasy Monster',
      title:'👾 Greasy Monster',
      intro:'บอสไขมันมาแล้ว! ระวังหมู่ไขมันล้น',
      skillName:'Oil Splash',
      skillText:'บอสเทน้ำมัน ทำให้ไขมันพุ่ง!'
    },
    {
      id:'sugar',
      icon:'🍭',
      name:'Sugar Storm',
      title:'🍭 Sugar Storm',
      intro:'พายุน้ำตาลมาแล้ว! ระวังคาร์บและของหวาน',
      skillName:'Sweet Rain',
      skillText:'ของหวานตกลงมา รีบหลบ junk!'
    },
    {
      id:'carbzilla',
      icon:'🍚',
      name:'Carbzilla',
      title:'🍚 Carbzilla',
      intro:'Carbzilla มาแล้ว! อย่าให้ข้าว/แป้งล้นจาน',
      skillName:'Carb Burst',
      skillText:'บอสเติมคาร์บใส่จาน!'
    },
    {
      id:'chaos',
      icon:'🌀',
      name:'Chaos Chef',
      title:'🌀 Chaos Chef',
      intro:'Chaos Chef มาแล้ว! ต้องตัดสินใจเร็วกว่าเดิม',
      skillName:'Choice Trap',
      skillText:'บอสเปิด Double Choice ดักผู้เล่น!'
    }
  ];

  const POWERS = [
    {emoji:'🛡️', name:'Shield', power:'shield'},
    {emoji:'❄️', name:'Freeze', power:'freeze'},
    {emoji:'💡', name:'Smart Hint', power:'hint'}
  ];

  const state = {
    running:false,
    paused:false,
    ended:false,
    startedAt:0,
    pauseStarted:0,
    pausedMs:0,
    totalSec:clamp(Number(qs('time', '100')) || 100, 60, 180),

    score:0,
    combo:0,
    bestCombo:0,
    hits:0,
    misses:0,
    junkHits:0,
    overloads:0,
    missedGood:0,

    fill:Object.fromEntries(GROUPS.map(g => [g.id,0])),
    groupHits:Object.fromEntries(GROUPS.map(g => [g.id,0])),
    plateItems:[],

    active:new Map(),
    nextId:1,
    lastSpawn:0,
    lastBossAtk:0,

    wave:0,
    rush:false,
    feverUntil:0,
    lastFever:0,
    shield:0,
    freezeUntil:0,
    rescueUsed:false,

    boss:false,
    bossHp:100,
    bossDefeated:false,
    bossType:null,

    order:null,
    orderStarted:0,
    orderExpire:0,
    lastOrderAt:0,

    duel:null,
    duelStarted:0,
    duelExpire:0,
    lastDuelAt:0,

    mini:null,
    miniStarted:0,
    miniExpire:0,
    lastMiniAt:0,
    miniStats:null,

    dailyChallenge:null,
    stars:0,

    perfectPicks:0,
    riskyPicks:0,
    aimPicks:0,
    lastAimTarget:null,

    unlockedBadges:new Set(),
    newBadges:[],
    bestBefore:null,
    bestAfter:null,
    newBestFlags:[],

    logs:[],
    lastHintAt:0,

    sessionId:'plate-' + Date.now().toString(36) + '-' + Math.floor(rand()*1e6).toString(36),

    eventQueue:[],
    lastFlushAt:0,
    apiDisabled:false
  };

  const els = {
    app:$('app'),
    score:$('score'),
    combo:$('combo'),
    balance:$('balance'),
    timeText:$('timeText'),
    timerFill:$('timerFill'),
    phaseText:$('phaseText'),
    missions:$('missions'),
    meters:$('meters'),
    hintBox:$('hintBox'),

    bossBox:$('bossBox'),
    bossHp:$('bossHp'),
    bossPct:$('bossPct'),
    bossMood:$('bossMood'),
    bossName:$('bossName'),

    arena:$('arena'),
    spawnLayer:$('spawnLayer'),
    plate:$('plate'),
    plateFoods:$('plateFoods'),
    plateLabel:$('plateLabel'),

    phaseBanner:$('phaseBanner'),
    bossSkillFlash:$('bossSkillFlash'),

    orderBox:$('orderBox'),
    orderText:$('orderText'),
    orderSec:$('orderSec'),
    orderFill:$('orderFill'),

    duelLayer:$('duelLayer'),

    miniEventBox:$('miniEventBox'),
    miniEventText:$('miniEventText'),
    miniEventSec:$('miniEventSec'),
    miniEventFill:$('miniEventFill'),

    log:$('log'),
    flash:$('flash'),

    startOverlay:$('startOverlay'),
    summaryOverlay:$('summaryOverlay'),
    dailyBox:$('dailyBox'),
    goalLock:$('goalLock'),

    rankIcon:$('rankIcon'),
    summaryTitle:$('summaryTitle'),
    summaryLine:$('summaryLine'),
    starRow:$('starRow'),
    bestRow:$('bestRow'),
    sumScore:$('sumScore'),
    sumBalance:$('sumBalance'),
    sumCombo:$('sumCombo'),
    sumMission:$('sumMission'),
    badgeRow:$('badgeRow'),
    recommend:$('recommend'),

    pShield:$('pShield'),
    pFreeze:$('pFreeze'),
    pFever:$('pFever'),

    btnStart:$('btnStart'),
    btnPause:$('btnPause'),
    btnHint:$('btnHint'),
    btnSkill:$('btnSkill'),
    btnAim:$('btnAim'),
    btnBack:$('btnBack'),
    aimReticle:$('aimReticle'),
    btnReplay:$('btnReplay'),
    btnCooldown:$('btnCooldown'),
    btnSummaryBack:$('btnSummaryBack')
  };

  function bootFail(message, detail){
    try{
      console.error('[PlateSolo Boot Error]', message, detail || '');

      const div = document.createElement('div');
      div.className = 'bootError';
      div.innerHTML = `
        <div class="bootErrorCard">
          <h2>⚠️ Plate Solo โหลดไม่ครบ</h2>
          <div>${esc(message)}</div>
          <code>${esc(detail || '')}</code>
          <p style="margin:10px 0 0;color:#668198">
            ให้เช็กว่า HTML id ครบตาม patch ล่าสุดหรือไม่ เช่น arena, spawnLayer, meters, summaryOverlay
          </p>
        </div>
      `;
      document.body.appendChild(div);
    }catch(e){}

    return false;
  }

  function requireEls(){
    const required = [
      'app',
      'score',
      'combo',
      'balance',
      'timeText',
      'timerFill',
      'phaseText',
      'missions',
      'meters',
      'hintBox',
      'bossBox',
      'bossHp',
      'bossPct',
      'bossMood',
      'bossName',
      'arena',
      'spawnLayer',
      'plate',
      'plateFoods',
      'plateLabel',
      'phaseBanner',
      'log',
      'startOverlay',
      'summaryOverlay',
      'btnStart',
      'btnPause',
      'btnHint',
      'btnSkill',
      'btnBack'
    ];

    const missing = required.filter(k => !els[k]);

    if(missing.length){
      return bootFail(
        'พบ element ที่จำเป็นหายไป เกมจึงเริ่มไม่ได้',
        'Missing: ' + missing.join(', ')
      );
    }

    return true;
  }

  window.addEventListener('error', (ev) => {
    try{
      postLog('client_error', {
        message:ev.message || '',
        file:ev.filename || '',
        line:ev.lineno || '',
        col:ev.colno || ''
      });
    }catch(e){}
  });

  window.addEventListener('unhandledrejection', (ev) => {
    try{
      postLog('client_unhandledrejection', {
        reason:String(ev.reason || '')
      });
    }catch(e){}
  });

  let audioCtx = null;

  function sfx(kind){
    try{
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();

      const map = {
        good:[660,.055,'sine',.045],
        perfect:[880,.075,'triangle',.055],
        bad:[150,.08,'sawtooth',.035],
        boss:[90,.16,'square',.04],
        fever:[980,.12,'triangle',.06],
        tick:[520,.035,'sine',.025]
      };

      const [freq,dur,type,gain] = map[kind] || map.good;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      o.type = type;
      o.frequency.value = freq;
      g.gain.value = gain;

      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();

      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + dur);
      o.stop(audioCtx.currentTime + dur + .015);
    }catch(e){}
  }

  function init(){
    if(!requireEls()) return;

    renderMeters();

    state.missions = chooseMissions();
    state.dailyChallenge = chooseDailyChallenge();
    state.bestBefore = loadBest();
    state.unlockedBadges = loadBadgeSet();

    renderDailyBox();
    renderGoalLock();
    setupAimMode();
    renderMissions();
    updateAll();

    logLine('พร้อมแล้ว: วันนี้มี Daily Challenge และดาวให้ลุ้น!');
    bind();
  }

  function bind(){
    els.btnStart.addEventListener('click', startGame);
    els.btnPause.addEventListener('click', () => togglePause(false));
    els.btnHint.addEventListener('click', () => showHint(true));
    els.btnSkill.addEventListener('click', rescueSkill);

    if(els.btnAim){
      els.btnAim.addEventListener('click', selectAimTarget);
    }

    els.btnBack.addEventListener('click', goBack);

    els.arena.addEventListener('pointerdown', (ev) => {
      if(!isAimMode()) return;
      if(ev.target.closest('.foodCard')) return;
      ev.preventDefault();
      selectAimTarget();
    }, {passive:false});

    if(els.btnReplay){
      els.btnReplay.addEventListener('click', () => location.reload());
    }

    if(els.btnCooldown){
      els.btnCooldown.addEventListener('click', goCooldown);
    }

    if(els.btnSummaryBack){
      els.btnSummaryBack.addEventListener('click', goBack);
    }

    document.addEventListener('visibilitychange', () => {
      if(document.hidden && state.running && !state.paused){
        togglePause(true);
      }
    });
  }

  function startGame(){
    state.running = true;
    state.startedAt = now();
    state.lastSpawn = now();

    els.startOverlay.classList.add('hidden');

    showBanner('Wave 1 • เติมจานให้ครบ!');
    showHint(true);

    postLog('session_start', {
      version:VERSION,
      diff:DIFF,
      view:VIEW,
      durationPlannedSec:state.totalSec,
      activeSeed:String(ACTIVE_SEED),
      dailyYmd:DAILY_YMD,
      dailyChallengeId:state.dailyChallenge ? state.dailyChallenge.id : '',
      dailyChallengeText:state.dailyChallenge ? state.dailyChallenge.text : ''
    });

    requestAnimationFrame(loop);
  }

  function togglePause(forcePause = false){
    if(!state.running || state.ended) return;

    if(!state.paused || forcePause){
      state.paused = true;
      state.pauseStarted = now();
      els.btnPause.textContent = '▶️ เล่นต่อ';
      logLine('พักเกมไว้ก่อน');
    }else{
      state.paused = false;
      state.pausedMs += now() - state.pauseStarted;
      els.btnPause.textContent = '⏸️ พัก';
      state.lastSpawn = now();
      requestAnimationFrame(loop);
      logLine('กลับมาเล่นต่อ!');
    }
  }

  function elapsedSec(){
    return Math.max(0, (now() - state.startedAt - state.pausedMs) / 1000);
  }

  function timeLeft(){
    return Math.max(0, state.totalSec - elapsedSec());
  }

  function isFever(){
    return now() < state.feverUntil;
  }

  function isFreeze(){
    return now() < state.freezeUntil;
  }

  function loop(){
    if(!state.running || state.ended) return;

    if(state.paused){
      requestAnimationFrame(loop);
      return;
    }

    const tLeft = timeLeft();

    updatePhase(tLeft);

    if(tLeft <= 0){
      endGame();
      return;
    }

    maybeStartMiniEvent(tLeft);
    maybeStartOrder(tLeft);
    maybeStartDuel(tLeft);
    updateOrderAndDuel();
    updateMiniEvent();

    if(!isFreeze() && !state.duel && now() - state.lastSpawn > spawnDelay()){
      spawnFood();
    }

    expireCards();
    updateAimTarget();

    if(state.boss && !state.bossDefeated && now() - state.lastBossAtk > CFG.bossAtk){
      bossAttack();
    }

    updateAll();
    requestAnimationFrame(loop);
  }

  function updatePhase(tLeft){
    const e = elapsedSec();
    const pct = e / state.totalSec;

    let newWave = pct < .22 ? 1 : pct < .48 ? 2 : pct < .72 ? 3 : 4;
    const rush = !state.boss && e > 16 && (Math.floor(e) % 28) >= 20;

    if(tLeft <= 26 && !state.boss){
      startBoss();
    }

    if(state.boss) newWave = 5;

    if(newWave !== state.wave){
      state.wave = newWave;

      const names = {
        1:'Wave 1 • เติมจาน',
        2:'Wave 2 • ระวังล้น',
        3:'Wave 3 • Food Rush',
        4:'Rush Window!',
        5:'Boss Plate!'
      };

      showBanner(names[newWave] || 'Wave');
      sfx(newWave === 5 ? 'boss' : 'tick');
    }

    if(rush !== state.rush){
      state.rush = rush;

      if(rush){
        showBanner('⚡ Rush 8 วิ • คะแนน x2');
        logLine('Rush Window! รีบเลือกให้แม่น');
      }
    }
  }

  function isAimMode(){
    return VIEW === 'cvr' || VIEW === 'cardboard' || VIEW === 'vr-cardboard';
  }

  function setupAimMode(){
    const on = isAimMode();

    if(els.aimReticle){
      els.aimReticle.classList.toggle('hidden', !on);
    }

    if(els.btnAim){
      els.btnAim.classList.toggle('hidden', !on);
    }

    if(on){
      logLine('โหมด Cardboard/cVR: เล็งกลางจอแล้วกดเลือกเป้า');
    }
  }

  function updateAimTarget(){
    if(!isAimMode() || !state.running || state.paused || state.ended) return;

    const arenaRect = els.arena.getBoundingClientRect();
    const cx = arenaRect.left + arenaRect.width / 2;
    const cy = arenaRect.top + arenaRect.height / 2;

    let bestId = null;
    let bestD = Infinity;

    for(const [id,obj] of state.active.entries()){
      if(!obj || !obj.el || !document.body.contains(obj.el)) continue;

      const r = obj.el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);

      if(d < bestD){
        bestD = d;
        bestId = id;
      }
    }

    for(const [id,obj] of state.active.entries()){
      if(obj && obj.el){
        obj.el.classList.toggle('aimLock', id === bestId && bestD < 250);
      }
    }

    state.lastAimTarget = bestD < 250 ? bestId : null;
  }

  function selectAimTarget(){
    if(!isAimMode()){
      return;
    }

    updateAimTarget();

    if(state.lastAimTarget && state.active.has(state.lastAimTarget)){
      state.aimPicks++;
      pickFood(state.lastAimTarget);
    }else{
      feedback('🎯 เล็งอาหารให้ตรงกลางก่อน', 'bad');
      sfx('bad');
    }
  }

  function spawnDelay(){
    let d = CFG.spawn;

    if(state.wave >= 2) d *= .9;
    if(state.wave >= 3) d *= .78;
    if(state.rush) d *= .55;
    if(isFever()) d *= .58;
    if(state.boss) d *= .7;

    if(state.mini && state.mini.type === 'healthyRain') d *= .55;
    if(state.mini && state.mini.type === 'junkInvasion') d *= .48;
    if(state.mini && state.mini.type === 'missingAlert') d *= .7;

    return d;
  }

  function cardLife(){
    let life = CFG.life / CFG.speed;

    if(state.rush) life *= .75;
    if(isFever()) life *= .78;
    if(state.boss) life *= .82;

    return clamp(life, 2100, 6200);
  }

  function chooseFood(){
    const missing = mostMissingGroup();

    if(state.mini && state.mini.type === 'healthyRain'){
      if(chance(.82)){
        const pool = FOODS.filter(f =>
          !f.junk &&
          f.effects &&
          (
            f.effects[missing.id] ||
            GROUPS.some(g => state.fill[g.id] < CFG.target * .82 && f.effects[g.id])
          )
        );

        return {...pick(pool.length ? pool : FOODS.filter(f => !f.junk))};
      }
    }

    if(state.mini && state.mini.type === 'missingAlert'){
      const g = state.mini.group || missing.id;

      if(chance(.72)){
        const pool = FOODS.filter(f => !f.junk && f.effects && f.effects[g]);
        return {...pick(pool.length ? pool : FOODS.filter(f => !f.junk))};
      }
    }

    if(chance(.075) && !state.boss && !state.mini){
      return {...pick(POWERS), type:'power'};
    }

    let junkRate = CFG.junk
      + (state.wave - 1) * .035
      + (state.rush ? .06 : 0)
      + (state.boss ? .08 : 0);

    if(state.mini && state.mini.type === 'junkInvasion'){
      junkRate += .42;
    }

    if(chance(clamp(junkRate, .08, .72))){
      return {...pick(FOODS.filter(f => f.junk))};
    }

    const missingIds = GROUPS
      .filter(g => state.fill[g.id] < CFG.target * .82)
      .map(g => g.id);

    if(missingIds.length && chance(.56)){
      const g = pick(missingIds);
      const pool = FOODS.filter(f => !f.junk && f.effects && f.effects[g]);
      return {...pick(pool)};
    }

    return {...pick(FOODS.filter(f => !f.junk))};
  }

  function classifyFoodCard(food){
    if(!food){
      return {cls:'neutralFood', tag:'ดูให้ดี'};
    }

    if(food.type === 'power'){
      return {cls:'power', tag:'Power'};
    }

    if(food.junk){
      return {cls:'junk', tag:'หลบ!'};
    }

    if(wouldOverload(food)){
      return {cls:'riskyFood dangerFood', tag:'ล้น!'};
    }

    const missing = mostMissingGroup();

    if(missing && food.effects && food.effects[missing.id]){
      return {cls:'goodNow', tag:'ควรเก็บ'};
    }

    return {cls:'neutralFood', tag:'ใช้ได้'};
  }

  function spawnFood(forcedFood = null){
    state.lastSpawn = now();

    const food = forcedFood ? {...forcedFood} : chooseFood();
    const id = 'f' + state.nextId++;

    const card = document.createElement('button');
    const visual = classifyFoodCard(food);
    card.className = `foodCard ${visual.cls}`;

    const left = 5 + rand() * 82;
    card.style.left = left + '%';
    card.style.setProperty('--rot', ((rand() * 18) - 9).toFixed(1) + 'deg');

    const life = cardLife();
    card.style.animationDuration = life + 'ms';

    card.innerHTML = `
      <div>
        <div class="emoji">${food.emoji}</div>
        <div class="name">${esc(food.name)}</div>
      </div>
      <div class="foodTag">${esc(visual.tag)}</div>
    `;

    card.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      pickFood(id);
    }, {passive:false});

    els.spawnLayer.appendChild(card);

    state.active.set(id, {
      food,
      el:card,
      born:now(),
      expire:now() + life
    });

    postLog('target_spawn', {
      emoji:food.emoji,
      name:food.name,
      kind:food.type === 'power' ? 'power' : (food.junk ? 'junk' : 'healthy'),
      visualTag:visual.tag,
      wave:state.wave,
      boss:!!state.boss,
      miniType:state.mini ? state.mini.type : ''
    });
  }

  function expireCards(){
    const n = now();

    for(const [id,obj] of Array.from(state.active.entries())){
      if(n >= obj.expire){
        obj.el.remove();
        state.active.delete(id);

        if(!obj.food.junk && obj.food.type !== 'power'){
          state.missedGood++;
          state.combo = 0;

          if(chance(.22)){
            feedback('หลุดไป! คอมโบหาย', 'bad');
          }
        }
      }
    }
  }

  function pickFood(id){
    if(!state.running || state.paused || state.ended) return;

    const obj = state.active.get(id);
    if(!obj) return;

    obj.el.remove();
    state.active.delete(id);

    const f = obj.food;

    if(f.type === 'power') return applyPower(f);
    if(f.junk) return handleJunk(f);

    return handleHealthy(f);
  }

  function wouldOverload(food){
    if(!food.effects) return false;

    return Object.entries(food.effects).some(([g,v]) => {
      return state.fill[g] + Number(v || 0) > CFG.target + .25;
    });
  }

  function handleHealthy(f){
    const overload = wouldOverload(f);

    checkOrderOnPick(f, overload, false);
    checkMiniOnHealthy(f, overload);

    applyEffects(f.effects, true);

    state.hits++;

    Object.keys(f.effects || {}).forEach(g => {
      state.groupHits[g] = (state.groupHits[g] || 0) + 1;
    });

    state.plateItems.push(f.emoji);
    state.plateItems = state.plateItems.slice(-18);

    if(overload){
      state.overloads++;
      state.riskyPicks++;
      state.combo = 0;
      state.score = Math.max(0, state.score - 18);
      state.bossHp = clamp(state.bossHp + (state.boss ? 3 : 1), 0, 100);

      feedback('⚠️ หมู่นี้เต็มแล้ว!', 'bad');
      sfx('bad');
      shakePlate();
      logLine(`${f.emoji} ${f.name}: หมู่นี้เริ่มล้น`);
    }else{
      state.perfectPicks++;

      const mult =
        (state.rush ? 2 : 1) *
        (isFever() ? 2 : 1) *
        (state.boss ? 1.25 : 1);

      state.combo++;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

      const gain = Math.round((45 + Math.min(state.combo, 12) * 5) * mult);
      state.score += gain;

      if(state.boss && !state.bossDefeated){
        damageBoss(5 + Math.min(10, state.combo));
      }

      feedback(
        state.combo >= 5 ? `🔥 Combo ${state.combo}! +${gain}` : `✅ เติมถูกหมู่! +${gain}`,
        state.combo >= 5 ? 'perfect' : 'good'
      );

      sfx(state.combo >= 5 ? 'perfect' : 'good');

      if(state.combo >= 6 && state.combo % 6 === 0 && now() - state.lastFever > 9000){
        triggerFever();
      }

      logLine(`${f.emoji} ${f.name}: เติมถูกจังหวะ`);
    }

    updateMissionHot();
    showHint(false);
    updateAll();

    postLog('target_hit', {
      kind:'healthy',
      emoji:f.emoji,
      name:f.name,
      overload,
      balancePct:balanceScore(),
      combo:state.combo,
      score:Math.round(state.score)
    });
  }

  function handleJunk(f){
    checkOrderOnPick(f, true, true);
    checkMiniOnJunk();

    if(state.shield > 0){
      state.shield--;
      state.score += 12;

      feedback('🛡️ Shield กันของหลอก!', 'good');
      sfx('good');
      logLine('Shield บล็อก junk ได้ 1 ครั้ง');
      updateAll();

      postLog('target_hit', {
        kind:'junk-blocked',
        emoji:f.emoji,
        name:f.name,
        balancePct:balanceScore(),
        combo:state.combo,
        score:Math.round(state.score)
      });

      return;
    }

    state.junkHits++;
    state.misses++;
    state.combo = 0;
    state.score = Math.max(0, state.score - 35);

    applyEffects(f.effects, true);

    if(state.boss){
      state.bossHp = clamp(state.bossHp + 7, 0, 100);
    }

    feedback(`❌ หลบ ${f.name}! จานเสียสมดุล`, 'bad');
    sfx('bad');
    shakePlate();
    flash();
    logLine(`${f.emoji} ${f.name}: ของหลอก!`);
    showHint(true);
    updateAll();

    postLog('target_hit', {
      kind:'junk',
      emoji:f.emoji,
      name:f.name,
      balancePct:balanceScore(),
      combo:state.combo,
      score:Math.round(state.score)
    });
  }

  function applyEffects(effects, add = true){
    Object.entries(effects || {}).forEach(([g,v]) => {
      if(!(g in state.fill)) return;

      const delta = Number(v || 0) * (add ? 1 : -1);
      state.fill[g] = clamp(state.fill[g] + delta, 0, CFG.target + 2.2);
    });
  }

  function applyPower(f){
    if(f.power === 'shield'){
      state.shield = clamp(state.shield + 1, 0, 2);
      feedback('🛡️ ได้ Shield!', 'perfect');
      logLine('ได้ Shield กัน junk');
    }else if(f.power === 'freeze'){
      state.freezeUntil = now() + 3000;
      feedback('❄️ Freeze 3 วิ!', 'perfect');
      logLine('Freeze: อาหารหยุดเกิดชั่วคราว');
    }else{
      showHint(true);
      state.score += 10;
      feedback('💡 Smart Hint +10', 'good');
    }

    sfx('perfect');
    updateAll();

    postLog('power_pick', {
      power:f.power,
      emoji:f.emoji,
      name:f.name,
      shield:state.shield,
      freezeActive:isFreeze(),
      score:Math.round(state.score)
    });
  }

  function triggerFever(){
    state.lastFever = now();
    state.feverUntil = now() + 7500;

    els.app.classList.add('fever');
    setTimeout(() => els.app.classList.remove('fever'), 7600);

    showBanner('🔥 FEVER MODE! คะแนน x2');
    feedback('🔥 Fever Mode!', 'perfect');
    sfx('fever');
  }

  function maybeStartMiniEvent(tLeft){
    if(!state.running || state.paused || state.ended) return;
    if(state.mini || state.order || state.duel) return;
    if(tLeft < 22) return;

    const interval = state.boss ? 15000 : 19000;
    if(now() - state.lastMiniAt < interval) return;

    if(chance(state.boss ? .42 : .28)){
      startMiniEvent();
    }
  }

  function startMiniEvent(){
    state.lastMiniAt = now();

    const missing = mostMissingGroup();

    const pool = [
      {
        type:'healthyRain',
        icon:'🌧️',
        title:'Healthy Rain',
        text:'อาหารดีตกเร็วขึ้น! เลือกให้ถูก 4 ครั้ง',
        sec:8,
        target:4
      },
      {
        type:'junkInvasion',
        icon:'🚨',
        title:'Junk Invasion',
        text:'ของหลอกบุก! รอดโดยไม่เลือก junk',
        sec:7,
        target:0
      },
      {
        type:'missingAlert',
        icon:'🔎',
        title:'Missing Group Alert',
        text:`รีบเติม ${missing.icon} ${missing.label} 2 ครั้ง`,
        sec:8,
        target:2,
        group:missing.id,
        groupLabel:missing.label,
        groupIcon:missing.icon
      }
    ];

    state.mini = pick(pool);
    state.miniStarted = now();
    state.miniExpire = now() + state.mini.sec * 1000;
    state.miniStats = {
      hits:0,
      junk:0,
      groupHits:0,
      startHits:state.hits,
      startJunk:state.junkHits
    };

    els.miniEventBox.classList.add('on');
    els.miniEventText.textContent = `${state.mini.icon} ${state.mini.text}`;
    els.miniEventSec.textContent = state.mini.sec + 's';
    els.miniEventFill.style.width = '100%';

    showBanner(`${state.mini.icon} ${state.mini.title}!`);
    sfx('fever');
    logLine(`Mini Event: ${state.mini.title}`);

    postLog('mini_start', {
      type:state.mini.type,
      title:state.mini.title
    });
  }

  function updateMiniEvent(){
    if(!state.mini) return;

    const leftMs = Math.max(0, state.miniExpire - now());
    const leftSec = Math.ceil(leftMs / 1000);
    const totalMs = Math.max(1, state.mini.sec * 1000);

    els.miniEventSec.textContent = leftSec + 's';
    els.miniEventFill.style.width = clamp((leftMs / totalMs) * 100, 0, 100) + '%';

    if(leftMs <= 0){
      finishMiniEvent(false);
    }
  }

  function checkMiniOnHealthy(food, overload){
    if(!state.mini || !state.miniStats) return;

    if(state.mini.type === 'healthyRain'){
      if(!overload){
        state.miniStats.hits++;

        if(state.miniStats.hits >= state.mini.target){
          finishMiniEvent(true);
        }
      }
      return;
    }

    if(state.mini.type === 'missingAlert'){
      const g = state.mini.group;

      if(!overload && food.effects && food.effects[g]){
        state.miniStats.groupHits++;

        if(state.miniStats.groupHits >= state.mini.target){
          finishMiniEvent(true);
        }
      }
    }
  }

  function checkMiniOnJunk(){
    if(!state.mini || !state.miniStats) return;

    if(state.mini.type === 'junkInvasion'){
      state.miniStats.junk++;
      finishMiniEvent(false);
    }
  }

  function finishMiniEvent(success){
    if(!state.mini) return;

    const mini = state.mini;

    if(mini.type === 'junkInvasion' && !success){
      success = state.miniStats && state.miniStats.junk === 0;
    }

    if(success){
      const reward = mini.type === 'healthyRain' ? 130 : mini.type === 'missingAlert' ? 115 : 125;
      state.score += reward;
      state.combo += 2;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

      if(state.boss && !state.bossDefeated){
        damageBoss(12);
      }

      feedback(`${mini.icon} Mini Clear! +${reward}`, 'perfect');
      sfx('perfect');
      logLine(`${mini.title} สำเร็จ +${reward}`);

      postLog('mini_end', {
        type:mini.type,
        success:true,
        reward
      });
    }else{
      state.score = Math.max(0, state.score - 20);
      state.combo = 0;

      if(state.boss && !state.bossDefeated){
        state.bossHp = clamp(state.bossHp + 4, 0, 100);
      }

      feedback(`${mini.icon} Mini Failed`, 'bad');
      sfx('bad');
      shakePlate();
      logLine(`${mini.title} ไม่สำเร็จ`);

      postLog('mini_end', {
        type:mini.type,
        success:false
      });
    }

    state.mini = null;
    state.miniStats = null;
    els.miniEventBox.classList.remove('on');
    updateAll();
  }

  function maybeStartOrder(tLeft){
    if(!state.running || state.paused || state.ended) return;
    if(state.order || tLeft < 18) return;

    const interval = state.boss ? 12500 : 15500;
    if(now() - state.lastOrderAt < interval) return;

    if(chance(state.boss ? .52 : .38)){
      startOrder();
    }
  }

  function startOrder(){
    state.lastOrderAt = now();

    const missing = mostMissingGroup();
    const over = mostOverGroup();

    const pool = [
      {
        type:'needGroup',
        group:missing.id,
        icon:missing.icon,
        text:`เติม ${missing.icon} ${missing.label} ให้ทัน!`,
        sec:7,
        reward:95
      },
      {
        type:'cleanPick',
        text:'เลือกอาหารที่ไม่ทำให้จานล้น!',
        sec:7,
        reward:85
      },
      {
        type:'noJunk',
        text:'เอาตัวรอด ห้ามเลือก junk!',
        sec:8,
        reward:80
      }
    ];

    if(over && over.over > .2){
      pool.push({
        type:'avoidGroup',
        group:over.id,
        icon:over.icon,
        text:`ห้ามเติม ${over.icon} ${over.label} เพิ่ม!`,
        sec:7,
        reward:90
      });
    }

    state.order = pick(pool);
    state.orderStarted = now();
    state.orderExpire = now() + state.order.sec * 1000;

    els.orderBox.classList.add('on');
    els.orderText.textContent = state.order.text;
    els.orderSec.textContent = state.order.sec + 's';
    els.orderFill.style.width = '100%';

    showBanner('⚡ ภารกิจด่วน!');
    sfx('tick');
    logLine('ภารกิจด่วน: ' + state.order.text);

    postLog('order_start', {
      type:state.order.type,
      text:state.order.text
    });
  }

  function checkOrderOnPick(food, overload, isJunk){
    if(!state.order) return;

    const o = state.order;

    if(o.type === 'needGroup'){
      if(!isJunk && food.effects && food.effects[o.group] && !overload){
        completeOrder(true, 'ทำภารกิจด่วนสำเร็จ!');
      }else if(isJunk){
        completeOrder(false, 'พลาดภารกิจด่วน');
      }
      return;
    }

    if(o.type === 'avoidGroup'){
      if(food.effects && food.effects[o.group]){
        completeOrder(false, `เผลอเติม ${o.icon} เพิ่ม`);
      }else if(!isJunk && !overload){
        completeOrder(true, 'หลบหมู่ที่ล้นได้ดี!');
      }else if(isJunk){
        completeOrder(false, 'โดน junk ระหว่างภารกิจ');
      }
      return;
    }

    if(o.type === 'cleanPick'){
      if(!isJunk && !overload){
        completeOrder(true, 'เลือกอาหารสะอาดและไม่ล้น!');
      }else{
        completeOrder(false, 'อาหารทำให้จานเสียสมดุล');
      }
      return;
    }

    if(o.type === 'noJunk'){
      if(isJunk){
        completeOrder(false, 'โดน junk แล้ว!');
      }
    }
  }

  function completeOrder(success, reason){
    if(!state.order) return;

    const o = state.order;
    const reward = Number(o.reward || 70);
    const txt = reason || (success ? 'ภารกิจสำเร็จ!' : 'ภารกิจไม่สำเร็จ');

    if(success){
      state.score += reward;
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);

      if(state.boss && !state.bossDefeated){
        damageBoss(9);
      }

      feedback(`⚡ ${txt} +${reward}`, 'perfect');
      sfx('perfect');
      logLine(txt + ` +${reward}`);
    }else{
      state.score = Math.max(0, state.score - 22);
      state.combo = 0;

      if(state.boss && !state.bossDefeated){
        state.bossHp = clamp(state.bossHp + 4, 0, 100);
      }

      feedback(`⚠️ ${txt}`, 'bad');
      sfx('bad');
      shakePlate();
      logLine(txt);
    }

    postLog('order_end', {
      type:o.type,
      success,
      reason:txt
    });

    state.order = null;
    els.orderBox.classList.remove('on');
    updateAll();
  }

  function updateOrderAndDuel(){
    const n = now();

    if(state.order){
      const leftMs = Math.max(0, state.orderExpire - n);
      const leftSec = Math.ceil(leftMs / 1000);
      const totalMs = Math.max(1, state.order.sec * 1000);

      els.orderSec.textContent = leftSec + 's';
      els.orderFill.style.width = clamp((leftMs / totalMs) * 100, 0, 100) + '%';

      if(leftMs <= 0){
        if(state.order.type === 'noJunk'){
          completeOrder(true, 'รอดจาก junk ได้ครบเวลา!');
        }else{
          completeOrder(false, 'หมดเวลาภารกิจด่วน');
        }
      }
    }

    if(state.duel){
      const leftMs = Math.max(0, state.duelExpire - n);
      const fill = document.getElementById('duelFill');

      if(fill){
        fill.style.width = clamp((leftMs / state.duel.secMs) * 100, 0, 100) + '%';
      }

      if(leftMs <= 0){
        clearDuel(true);
      }
    }
  }

  function maybeStartDuel(tLeft){
    if(!state.running || state.paused || state.ended) return;
    if(state.duel || state.order || tLeft < 20) return;

    const interval = state.boss ? 17000 : 22000;
    if(now() - state.lastDuelAt < interval) return;

    if(chance(state.boss ? .45 : .28)){
      startDuel();
    }
  }

  function startDuel(){
    state.lastDuelAt = now();

    const missing = mostMissingGroup();
    const over = mostOverGroup();

    const goodPool = FOODS.filter(f =>
      !f.junk &&
      f.effects &&
      f.effects[missing.id] &&
      !wouldOverload(f)
    );

    const riskyPool = FOODS.filter(f => {
      if(f.junk) return true;
      if(over && over.over > .1 && f.effects && f.effects[over.id]) return true;
      return wouldOverload(f);
    });

    const good = {...pick(goodPool.length ? goodPool : FOODS.filter(f => !f.junk))};
    const risky = {...pick(riskyPool.length ? riskyPool : FOODS.filter(f => f.junk))};

    const choices = chance(.5) ? [good, risky] : [risky, good];

    state.duel = {
      choices,
      bestEmoji:good.emoji,
      secMs:5200
    };

    state.duelStarted = now();
    state.duelExpire = now() + state.duel.secMs;

    els.duelLayer.innerHTML = `
      <div class="duelBox">
        <div class="duelTitle">⚡ เลือก 1 อย่างให้เหมาะกับจานตอนนี้!</div>
        <div class="duelChoices">
          ${choices.map((f,i)=>`
            <button class="duelBtn" data-i="${i}">
              <div>
                <div class="emoji">${f.emoji}</div>
                <div class="name">${esc(f.name)}</div>
              </div>
            </button>
          `).join('')}
        </div>
        <div class="duelTimer"><i id="duelFill"></i></div>
      </div>
    `;

    Array.from(els.duelLayer.querySelectorAll('.duelBtn')).forEach(btn => {
      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        pickDuel(Number(btn.dataset.i));
      }, {passive:false});
    });

    showBanner('⚡ Double Choice!');
    sfx('tick');
    logLine('Double Choice: เลือกอาหารที่เหมาะที่สุด');

    postLog('duel_start', {
      choices:choices.map(f => f.emoji + ':' + f.name).join('|'),
      bestEmoji:good.emoji
    });
  }

  function pickDuel(index){
    if(!state.duel) return;

    const f = state.duel.choices[index];
    const bestEmoji = state.duel.bestEmoji;

    clearDuel(false);

    if(!f) return;

    postLog('duel_pick', {
      emoji:f.emoji,
      name:f.name,
      isBest:f.emoji === bestEmoji
    });

    if(f.junk){
      handleJunk(f);
      return;
    }

    handleHealthy(f);
  }

  function clearDuel(timeout){
    if(!state.duel) return;

    if(timeout){
      state.combo = 0;
      state.score = Math.max(0, state.score - 18);
      feedback('⏱️ ช้าไป! Double Choice หมดเวลา', 'bad');
      sfx('bad');
      logLine('Double Choice หมดเวลา');

      postLog('duel_timeout', {});
    }

    state.duel = null;
    els.duelLayer.innerHTML = '';
    updateAll();
  }

  function startBoss(){
    state.boss = true;
    state.bossHp = Math.min(state.bossHp, 100);
    state.lastBossAtk = now() + 1500;
    state.bossType = pick(BOSSES);

    els.bossBox.classList.add('on');
    els.bossName.textContent = state.bossType.title;

    showBanner(`${state.bossType.icon} Boss Plate!`);
    feedback(state.bossType.intro, 'bad');
    sfx('boss');
    logLine(`Boss Phase: ${state.bossType.name}`);

    postLog('boss_start', {
      bossType:state.bossType.id,
      bossName:state.bossType.name
    });
  }

  function bossAttack(){
    if(state.bossDefeated) return;

    state.lastBossAtk = now();

    const b = state.bossType || BOSSES[0];

    if(b.id === 'greasy'){
      state.fill.fat = clamp(state.fill.fat + .9, 0, CFG.target + 2.2);
      state.fill.veg = clamp(state.fill.veg - .25, 0, CFG.target + 2.2);

      showBossSkill('👾 Oil Splash! ไขมันพุ่ง');
      feedback('👾 บอสเทน้ำมัน! ระวังไขมันล้น', 'bad');
      logLine('Boss Skill: Oil Splash เพิ่มไขมัน');
    }

    else if(b.id === 'sugar'){
      state.fill.carb = clamp(state.fill.carb + .65, 0, CFG.target + 2.2);

      const junkPool = FOODS.filter(f => f.junk && ['🍰','🧃','🍩'].includes(f.emoji));
      spawnFood({...pick(junkPool.length ? junkPool : FOODS.filter(f => f.junk))});

      setTimeout(() => {
        if(state.running && !state.ended){
          spawnFood({...pick(junkPool.length ? junkPool : FOODS.filter(f => f.junk))});
        }
      }, 350);

      showBossSkill('🍭 Sweet Rain! ของหวานตกลงมา');
      feedback('🍭 Sugar Storm ปล่อยของหวาน!', 'bad');
      logLine('Boss Skill: Sweet Rain ปล่อย junk');
    }

    else if(b.id === 'carbzilla'){
      state.fill.carb = clamp(state.fill.carb + 1.05, 0, CFG.target + 2.2);
      state.fill.protein = clamp(state.fill.protein - .2, 0, CFG.target + 2.2);

      showBossSkill('🍚 Carb Burst! คาร์บเพิ่มแรง');
      feedback('🍚 Carbzilla ทำให้คาร์บล้น!', 'bad');
      logLine('Boss Skill: Carb Burst เพิ่มคาร์บ');
    }

    else if(b.id === 'chaos'){
      state.fill.veg = clamp(state.fill.veg - .35, 0, CFG.target + 2.2);
      state.fill.fruit = clamp(state.fill.fruit - .35, 0, CFG.target + 2.2);

      if(!state.duel && !state.order){
        startDuel();
      }

      showBossSkill('🌀 Choice Trap! ต้องเลือกให้ไว');
      feedback('🌀 Chaos Chef เปิดกับดักเลือก 1 จาก 2!', 'bad');
      logLine('Boss Skill: Choice Trap');
    }

    state.combo = 0;

    shakePlate();
    flash();
    sfx('boss');
    showHint(true);
    updateAll();

    postLog('boss_skill', {
      bossType:b.id,
      skillName:b.skillName,
      balancePct:balanceScore()
    });
  }

  function showBossSkill(txt){
    if(!els.bossSkillFlash) return;

    els.bossSkillFlash.textContent = txt;
    els.bossSkillFlash.classList.remove('show');
    void els.bossSkillFlash.offsetWidth;
    els.bossSkillFlash.classList.add('show');
  }

  function damageBoss(dmg){
    state.bossHp = clamp(state.bossHp - dmg, 0, 100);

    if(state.bossHp <= 0 && !state.bossDefeated){
      state.bossDefeated = true;
      state.score += 220;

      showBanner('🏆 ชนะบอส! +220');
      feedback('👑 Boss Crusher!', 'perfect');
      sfx('fever');
      logLine('ชนะบอสแล้ว!');

      postLog('boss_defeated', {
        bossType:state.bossType ? state.bossType.id : '',
        score:Math.round(state.score)
      });
    }
  }

  function rescueSkill(){
    if(!state.running || state.paused || state.ended || state.rescueUsed) return;

    state.rescueUsed = true;
    els.btnSkill.disabled = true;

    state.freezeUntil = now() + 2500;
    state.shield = Math.max(state.shield, 1);

    const missing = mostMissingGroup();

    if(missing){
      state.fill[missing.id] = Math.min(CFG.target * .7, state.fill[missing.id] + .9);
    }

    state.score += 30;

    feedback('✨ Rescue! Freeze + Shield + เติมหมู่ที่ขาด', 'perfect');
    sfx('fever');
    logLine('ใช้ Rescue Skill แล้ว');
    updateAll();

    postLog('rescue_skill', {
      missingGroup:missing ? missing.id : '',
      score:Math.round(state.score),
      balancePct:balanceScore()
    });
  }

  function balanceScore(){
    const vals = GROUPS.map(g => {
      const f = state.fill[g.id];

      if(f <= CFG.target){
        return (f / CFG.target) * 100;
      }

      return Math.max(0, 100 - (f - CFG.target) * 32);
    });

    return Math.round(vals.reduce((a,b) => a + b, 0) / vals.length);
  }

  function mostMissingGroup(){
    return GROUPS
      .map(g => ({...g, need:CFG.target - state.fill[g.id]}))
      .sort((a,b) => b.need - a.need)[0];
  }

  function mostOverGroup(){
    return GROUPS
      .map(g => ({...g, over:state.fill[g.id] - CFG.target}))
      .sort((a,b) => b.over - a.over)[0];
  }

  function showHint(force){
    if(!force && now() - state.lastHintAt < 2400) return;

    state.lastHintAt = now();

    const missing = mostMissingGroup();
    const over = mostOverGroup();

    let msg = 'เติมหมู่ที่ยังขาดก่อน จะได้คอมโบสูง!';

    if(over && over.over > .35){
      msg = `⚠️ <b>${over.icon} ${over.label}</b> เริ่มล้นแล้ว หยุดเติมก่อน!`;
    }else if(missing && missing.need > .65){
      msg = `รีบเติม <b>${missing.icon} ${missing.label}</b> จานยังขาดอยู่!`;
    }else if(balanceScore() >= 86){
      msg = 'เยี่ยม! จานใกล้สมดุลมาก รักษาคอมโบไว้!';
    }

    if(state.boss && !state.bossDefeated){
      msg += ' ทำถูกต่อเนื่องเพื่อลดพลังบอส!';
    }

    els.hintBox.innerHTML = msg;
  }

  function renderMeters(){
    els.meters.innerHTML = GROUPS.map(g => `
      <div class="groupMeter" data-g="${g.id}">
        <div class="gmTop">
          <span>${g.icon} ${g.label}</span>
          <small id="gmv-${g.id}">0/${CFG.target}</small>
        </div>
        <div id="bar-${g.id}" class="bar"><i id="bari-${g.id}"></i></div>
        <div id="need-${g.id}" class="need">ยังขาด</div>
      </div>
    `).join('');
  }

  function updateMeters(){
    GROUPS.forEach(g => {
      const v = state.fill[g.id];
      const pct = clamp((v / CFG.target) * 100, 0, 145);

      const bar = $('bar-' + g.id);
      const fill = $('bari-' + g.id);
      const label = $('gmv-' + g.id);
      const need = $('need-' + g.id);

      if(!bar || !fill || !label || !need) return;

      fill.style.width = Math.min(pct, 100) + '%';
      bar.classList.toggle('over', v > CFG.target + .25);
      bar.classList.toggle('warn', v >= CFG.target * .82 && v <= CFG.target + .25);
      label.textContent = `${v.toFixed(1)}/${CFG.target}`;

      if(v > CFG.target + .25){
        need.textContent = 'ล้นแล้ว! อย่าเติมเพิ่ม';
      }else if(v >= CFG.target * .82){
        need.textContent = 'พอดีแล้ว';
      }else{
        need.textContent = `ยังขาด ${(CFG.target - v).toFixed(1)}`;
      }
    });
  }

  function chooseMissions(){
    const pool = [
      {id:'veg', txt:'เก็บผัก 4 ครั้ง', type:'group', group:'veg', target:4},
      {id:'fruit', txt:'เก็บผลไม้ 3 ครั้ง', type:'group', group:'fruit', target:3},
      {id:'protein', txt:'เติมโปรตีน 3 ครั้ง', type:'group', group:'protein', target:3},
      {id:'combo', txt:'ทำคอมโบ 8', type:'combo', target:8},
      {id:'rainbow', txt:'ครบทั้ง 5 หมู่', type:'rainbow', target:5},
      {id:'lowjunk', txt:'โดน junk ไม่เกิน 2', type:'endLowJunk', target:2},
      {id:'balance', txt:'จบด้วยสมดุล 80%+', type:'endBalance', target:80},
      {id:'boss', txt:'ชนะบอสท้ายเกม', type:'boss'}
    ];

    const arr = [];

    while(arr.length < 3 && pool.length){
      arr.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    }

    return arr;
  }

  function chooseDailyChallenge(){
    const pool = [
      {
        id:'balance85',
        icon:'⚖️',
        text:'จบเกมด้วยสมดุล 85%+',
        goal:'รักษาจานให้พอดี ไม่ล้น',
        reward:'Daily Balance Star'
      },
      {
        id:'combo10',
        icon:'🔥',
        text:'ทำคอมโบสูงสุด 10+',
        goal:'เลือกถูกต่อเนื่อง อย่ากดมั่ว',
        reward:'Daily Combo Star'
      },
      {
        id:'nojunk',
        icon:'🚫',
        text:'จบเกมโดยโดน junk ไม่เกิน 1',
        goal:'หลบของทอด ของหวาน น้ำหวาน',
        reward:'Daily Clean Star'
      },
      {
        id:'boss',
        icon:'👾',
        text:'ชนะบอสท้ายเกม',
        goal:'ทำ Perfect Pick เพื่อลด HP บอส',
        reward:'Daily Boss Star'
      },
      {
        id:'portion',
        icon:'📏',
        text:'จบเกมโดยล้นไม่เกิน 1 ครั้ง',
        goal:'อาหารดีแต่ถ้าเต็มแล้วอย่าใส่เพิ่ม',
        reward:'Daily Portion Star'
      },
      {
        id:'vegfruit',
        icon:'🥦',
        text:'เก็บผัก 4 ครั้ง และผลไม้ 3 ครั้ง',
        goal:'เติมผักผลไม้ให้ครบ ไม่ขาด',
        reward:'Daily Rainbow Star'
      }
    ];

    return dailyPick(pool);
  }

  function dailyStatus(){
    const d = state.dailyChallenge;
    if(!d) return {done:false, label:''};

    if(d.id === 'balance85'){
      return {done:balanceScore() >= 85, label:`${balanceScore()}%/85%`};
    }

    if(d.id === 'combo10'){
      return {done:state.bestCombo >= 10, label:`${Math.min(state.bestCombo,10)}/10`};
    }

    if(d.id === 'nojunk'){
      return {done:state.junkHits <= 1, label:`junk ${state.junkHits}/1`};
    }

    if(d.id === 'boss'){
      return {done:!!state.bossDefeated, label:state.bossDefeated ? 'ชนะแล้ว' : 'ยังไม่ชนะ'};
    }

    if(d.id === 'portion'){
      return {done:state.overloads <= 1, label:`ล้น ${state.overloads}/1`};
    }

    if(d.id === 'vegfruit'){
      const veg = state.groupHits.veg || 0;
      const fruit = state.groupHits.fruit || 0;

      return {
        done:veg >= 4 && fruit >= 3,
        label:`ผัก ${Math.min(veg,4)}/4 ผลไม้ ${Math.min(fruit,3)}/3`
      };
    }

    return {done:false, label:''};
  }

  function renderDailyBox(){
    if(!els.dailyBox || !state.dailyChallenge) return;

    const d = state.dailyChallenge;
    const best = state.bestBefore || {};

    els.dailyBox.innerHTML = `
      <b>📅 Daily Challenge • ${esc(DAILY_YMD)}</b><br>
      ${d.icon} <b>${esc(d.text)}</b><br>
      <span>เป้าหมาย: ${esc(d.goal)}</span><br>
      <span>Best เดิม: ${Number(best.score || 0)} คะแนน • ${Number(best.stars || 0)} ดาว</span>
    `;
  }

  function renderGoalLock(){
    if(!els.goalLock) return;

    const m1 = state.missions[0] ? state.missions[0].txt : 'ทำจานให้สมดุล';
    const d = state.dailyChallenge;

    els.goalLock.innerHTML = `
      <div class="goalLockTitle">🎯 เป้าหมายก่อนเริ่ม</div>
      <div class="goalCards">
        <div class="goalCard">
          <b>📅 Daily</b>
          ${d ? `${esc(d.icon)} ${esc(d.text)}` : 'ทำภารกิจประจำวัน'}
        </div>
        <div class="goalCard">
          <b>🎯 Mission 1</b>
          ${esc(m1)}
        </div>
        <div class="goalCard">
          <b>⚖️ จำไว้</b>
          อาหารดี แต่ถ้าหมู่นั้นเต็มแล้ว = ล้น!
        </div>
      </div>
    `;
  }

  function missionStatus(m, final = false){
    if(m.type === 'group'){
      return {
        done:(state.groupHits[m.group] || 0) >= m.target,
        val:Math.min(state.groupHits[m.group] || 0, m.target),
        max:m.target
      };
    }

    if(m.type === 'combo'){
      return {
        done:state.bestCombo >= m.target,
        val:Math.min(state.bestCombo, m.target),
        max:m.target
      };
    }

    if(m.type === 'rainbow'){
      const c = GROUPS.filter(g => (state.groupHits[g.id] || 0) > 0).length;
      return {done:c >= 5, val:c, max:5};
    }

    if(m.type === 'endLowJunk'){
      return {
        done:final ? state.junkHits <= m.target : state.junkHits <= m.target,
        val:Math.min(state.junkHits, m.target),
        max:m.target,
        inverse:true
      };
    }

    if(m.type === 'endBalance'){
      return {
        done:final ? balanceScore() >= m.target : balanceScore() >= m.target,
        val:balanceScore(),
        max:m.target,
        pct:true
      };
    }

    if(m.type === 'boss'){
      return {
        done:state.bossDefeated,
        val:state.bossDefeated ? 1 : 0,
        max:1
      };
    }

    return {done:false, val:0, max:1};
  }

  function renderMissions(final = false){
    const missionHtml = state.missions.map(m => {
      const st = missionStatus(m, final);
      const progress = st.pct
        ? `${st.val}%`
        : (st.inverse ? `${st.val}/${st.max}` : `${st.val}/${st.max}`);

      return `
        <span id="mis-${m.id}" class="mission ${st.done ? 'done' : ''}">
          ${st.done ? '✅' : '🎯'} ${esc(m.txt)} <small>${progress}</small>
        </span>
      `;
    }).join('');

    let dailyHtml = '';

    if(state.dailyChallenge){
      const ds = dailyStatus();

      dailyHtml = `
        <span id="mis-daily" class="mission ${ds.done ? 'done' : ''}">
          ${ds.done ? '✅' : '📅'} Daily: ${esc(state.dailyChallenge.text)}
          <small>${esc(ds.label)}</small>
        </span>
      `;
    }

    els.missions.innerHTML = missionHtml + dailyHtml;
  }

  function updateMissionHot(){
    renderMissions(false);

    for(const m of state.missions){
      const st = missionStatus(m,false);
      const el = $('mis-' + m.id);

      if(el && !st.done && st.val >= st.max - 1){
        el.classList.add('hot');
      }
    }
  }

  function updateAll(){
    const left = Math.ceil(timeLeft());

    els.score.textContent = Math.round(state.score);
    els.combo.textContent = state.combo;
    els.balance.textContent = balanceScore() + '%';
    els.timeText.textContent = left + 's';

    els.timerFill.style.width = clamp((left / state.totalSec) * 100, 0, 100) + '%';
    els.timerFill.classList.toggle('danger', left <= 15);

    const phaseName = state.boss
      ? (state.bossDefeated ? 'Boss defeated • รักษาจานให้จบสวย' : 'Boss Plate • ทำถูกเพื่อลด HP')
      : state.rush
        ? 'Rush Window • คะแนน x2'
        : `Wave ${state.wave || 1} • ${DIFF}`;

    els.phaseText.textContent = isFever()
      ? '🔥 FEVER MODE • คะแนน x2'
      : phaseName;

    updateMeters();
    renderPlate();
    updatePowers();
    updateBoss();
    renderMissions(false);
  }

  function updatePowers(){
    els.pShield.classList.toggle('on', state.shield > 0);
    els.pFreeze.classList.toggle('on', isFreeze());
    els.pFever.classList.toggle('on', isFever());

    els.pShield.innerHTML = `<b>🛡️</b>Shield ${state.shield ? 'x' + state.shield : ''}`;
  }

  function updateBoss(){
    els.bossBox.classList.toggle('on', state.boss);
    els.bossHp.style.width = state.bossHp + '%';
    els.bossPct.textContent = Math.round(state.bossHp) + '%';

    if(state.bossType){
      els.bossName.textContent = state.bossType.title;
    }

    els.bossMood.textContent = state.bossDefeated
      ? 'ชนะบอสแล้ว! รักษาจานให้สมดุลจนจบ'
      : (state.boss ? 'Perfect Pick จะลด HP บอส / junk ทำให้บอสฟื้น' : 'บอสยังไม่มา');
  }

  function renderPlate(){
    els.plateFoods.innerHTML = state.plateItems.map(x => `<span>${x}</span>`).join('');

    const b = balanceScore();

    els.plate.classList.toggle('good', b >= 84);
    els.plateLabel.textContent = b >= 90
      ? 'Perfect Plate!'
      : b >= 75
        ? 'Good Balance'
        : 'Need Balance';
  }

  function feedback(txt, kind){
    const div = document.createElement('div');
    div.className = 'floatText';
    div.textContent = txt;

    if(kind === 'good') div.style.background = 'rgba(36,144,80,.82)';
    if(kind === 'bad') div.style.background = 'rgba(214,55,69,.82)';
    if(kind === 'perfect') div.style.background = 'rgba(120,80,220,.86)';

    els.arena.appendChild(div);
    setTimeout(() => div.remove(), 900);
  }

  function showBanner(txt){
    els.phaseBanner.textContent = txt;
    els.phaseBanner.classList.remove('show');
    void els.phaseBanner.offsetWidth;
    els.phaseBanner.classList.add('show');
  }

  function shakePlate(){
    els.plate.classList.remove('bad');
    void els.plate.offsetWidth;
    els.plate.classList.add('bad');
  }

  function flash(){
    els.flash.classList.remove('on');
    void els.flash.offsetWidth;
    els.flash.classList.add('on');
  }

  function logLine(txt){
    state.logs.unshift(txt);
    state.logs = state.logs.slice(0, 7);
    els.log.innerHTML = state.logs.map(x => `<div class="logLine">${esc(x)}</div>`).join('');
  }

  function playerKey(){
    return String(qs('pid','anon') || 'anon').replace(/[^\w.-]/g,'_');
  }

  function bestKey(){
    return `HHA_PLATE_SOLO_BEST_${playerKey()}_${DIFF}`;
  }

  function badgeKey(){
    return `HHA_PLATE_SOLO_BADGES_${playerKey()}`;
  }

  function dailyKey(){
    return `HHA_PLATE_SOLO_DAILY_${playerKey()}_${DAILY_YMD}_${DIFF}`;
  }

  function loadBest(){
    const raw = SAFE_STORE.get(bestKey(), '');

    if(!raw){
      return {score:0,balance:0,combo:0,stars:0,date:''};
    }

    return safeJsonParse(raw, {
      score:0,
      balance:0,
      combo:0,
      stars:0,
      date:''
    }) || {
      score:0,
      balance:0,
      combo:0,
      stars:0,
      date:''
    };
  }

  function updateBest(summary){
    const before = state.bestBefore || {};
    const after = {
      score:Number(before.score || 0),
      balance:Number(before.balance || 0),
      combo:Number(before.combo || 0),
      stars:Number(before.stars || 0),
      date:before.date || ''
    };

    const flags = [];

    if(summary.scoreFinal > after.score){
      after.score = summary.scoreFinal;
      flags.push('คะแนนสูงสุดใหม่');
    }

    if(summary.balancePct > after.balance){
      after.balance = summary.balancePct;
      flags.push('สมดุลสูงสุดใหม่');
    }

    if(summary.comboMax > after.combo){
      after.combo = summary.comboMax;
      flags.push('คอมโบสูงสุดใหม่');
    }

    if(summary.stars > after.stars){
      after.stars = summary.stars;
      flags.push('ดาวสูงสุดใหม่');
    }

    if(flags.length){
      after.date = DAILY_YMD;
      SAFE_STORE.set(bestKey(), safeJsonStringify(after));
    }

    state.bestAfter = after;
    state.newBestFlags = flags;

    return flags;
  }

  function loadBadgeSet(){
    const raw = SAFE_STORE.get(badgeKey(), '[]');
    const arr = safeJsonParse(raw, []);
    return new Set(Array.isArray(arr) ? arr : []);
  }

  function updateBadgeCollection(badges){
    const oldSet = state.unlockedBadges || new Set();
    const newBadges = badges.filter(b => !oldSet.has(b));
    const merged = new Set([...oldSet, ...badges]);

    state.unlockedBadges = merged;
    state.newBadges = newBadges;

    SAFE_STORE.set(badgeKey(), safeJsonStringify(Array.from(merged)));

    return newBadges;
  }

  function calcStars(bal, done){
    let stars = 0;

    if(bal >= 60 && state.score >= 250){
      stars = 1;
    }

    if(bal >= 75 && done >= 2 && state.bestCombo >= 6){
      stars = 2;
    }

    if(bal >= 88 && done >= 3 && state.bestCombo >= 9 && (state.bossDefeated || state.bossHp <= 15)){
      stars = 3;
    }

    if(dailyStatus().done && stars < 2){
      stars = 2;
    }

    return clamp(stars, 0, 3);
  }

  function renderStars(stars){
    const label = stars >= 3
      ? 'สุดยอด! 3 ดาวแบบ Plate Hero'
      : stars === 2
        ? 'ดีมาก! อีกนิดเดียวถึง 3 ดาว'
        : stars === 1
          ? 'ผ่านแล้ว! รอบหน้าลุ้น 2 ดาว'
          : 'ลองใหม่ได้! เริ่มจากเติมหมู่ที่ขาดก่อน';

    els.starRow.innerHTML = `
      <span class="star ${stars >= 1 ? 'on' : ''}">⭐</span>
      <span class="star ${stars >= 2 ? 'on' : ''}">⭐</span>
      <span class="star ${stars >= 3 ? 'on' : ''}">⭐</span>
      <div class="starLabel">${esc(label)}</div>
    `;
  }

  function renderBestRow(flags){
    const before = state.bestBefore || {};
    const chips = [];

    chips.push(`<span class="bestChip">🏆 Best ${Number(before.score || 0)}</span>`);
    chips.push(`<span class="bestChip">⚖️ Best Balance ${Number(before.balance || 0)}%</span>`);
    chips.push(`<span class="bestChip">🔥 Best Combo ${Number(before.combo || 0)}</span>`);

    if(flags && flags.length){
      flags.forEach(f => {
        chips.push(`<span class="bestChip new">✨ ${esc(f)}</span>`);
      });
    }

    els.bestRow.innerHTML = chips.join('');
  }

  function saveDailyResult(summary){
    const ds = dailyStatus();

    const daily = {
      date:DAILY_YMD,
      diff:DIFF,
      challengeId:state.dailyChallenge ? state.dailyChallenge.id : '',
      challengeText:state.dailyChallenge ? state.dailyChallenge.text : '',
      done:ds.done,
      score:summary.scoreFinal,
      balance:summary.balancePct,
      combo:summary.comboMax,
      stars:summary.stars,
      bossDefeated:summary.bossDefeated,
      savedAt:new Date().toISOString()
    };

    SAFE_STORE.set(dailyKey(), safeJsonStringify(daily));

    return daily;
  }

  function getRank(bal, done){
    const s = state.score;

    if(bal >= 90 && done >= 3 && state.bossDefeated){
      return {
        icon:'👑',
        title:'SS • Plate Master',
        line:'สุดยอด! จานสมดุล ชนะบอส และทำภารกิจครบ'
      };
    }

    if(bal >= 82 && done >= 2){
      return {
        icon:'🏆',
        title:'S • Balance Hero',
        line:'ยอดเยี่ยม! จานสมดุลมาก เล่นอีกรอบลุ้น SS ได้เลย'
      };
    }

    if(bal >= 70 || s >= 600){
      return {
        icon:'⭐',
        title:'A • Smart Chef',
        line:'ดีมาก! รอบหน้าเน้นหมู่ที่ยังขาดและอย่าให้ล้น'
      };
    }

    if(bal >= 55){
      return {
        icon:'🌟',
        title:'B • Healthy Builder',
        line:'เริ่มดีแล้ว! ลองดูแถบสมดุลก่อนเลือกอาหาร'
      };
    }

    return {
      icon:'🍽️',
      title:'C • Plate Starter',
      line:'ไม่เป็นไร! รอบหน้าลองเติมหมู่ที่ขาดก่อนนะ'
    };
  }

  function buildBadges(bal, done){
    const badges = [];

    if(bal >= 85) badges.push('⚖️ Balance Master');
    if(state.bestCombo >= 10) badges.push('🔥 Combo Chef');
    if(state.junkHits === 0) badges.push('🚫 Junk Dodger');
    if(state.bossDefeated) badges.push('👾 Boss Crusher');
    if(done >= 3) badges.push('🎯 Mission Clear');
    if(state.overloads === 0) badges.push('📏 Portion Hero');
    if(state.groupHits.veg >= 4) badges.push('🥦 Veggie Hero');
    if(state.groupHits.fruit >= 3) badges.push('🍎 Fruit Friend');

    if(state.bossType && state.bossType.id === 'greasy' && state.bossDefeated) badges.push('👾 Greasy Slayer');
    if(state.bossType && state.bossType.id === 'sugar' && state.bossDefeated) badges.push('🍭 Sugar Defender');
    if(state.bossType && state.bossType.id === 'carbzilla' && state.bossDefeated) badges.push('🍚 Carbzilla Tamer');
    if(state.bossType && state.bossType.id === 'chaos' && state.bossDefeated) badges.push('🌀 Chaos Chef Beater');

    if(state.stars >= 1) badges.push('⭐ One Star Chef');
    if(state.stars >= 2) badges.push('⭐⭐ Two Star Chef');
    if(state.stars >= 3) badges.push('⭐⭐⭐ Three Star Hero');

    if(state.dailyChallenge && dailyStatus().done){
      badges.push(`📅 ${state.dailyChallenge.reward}`);
    }

    if(state.perfectPicks >= 16) badges.push('✅ Smart Picker');
    if(state.riskyPicks === 0 && state.hits >= 12) badges.push('📏 No Overload Hero');
    if(isAimMode() && state.aimPicks >= 8) badges.push('🎯 VR Aim Chef');

    if(SAFE_STORE.ok) badges.push('💾 Saved Progress');
    if(HHA.logEndpoint && !state.apiDisabled) badges.push('☁️ Cloud Ready');

    if(!badges.length) badges.push('🍽️ Plate Starter');

    return badges;
  }

  function buildChildSummary(bal, done, stars){
    const miss = mostMissingGroup();
    const over = mostOverGroup();

    let strong = 'เลือกอาหารได้ดีขึ้นแล้ว';

    if(state.bestCombo >= 8) strong = 'ทำคอมโบได้ดีมาก';
    if(bal >= 85) strong = 'คุมจานสมดุลได้ยอดเยี่ยม';
    if(state.bossDefeated) strong = 'สู้บอสได้เก่งมาก';

    let practice = 'ดูแถบ 5 หมู่ก่อนเลือกอาหาร';

    if(miss && miss.need > .5){
      practice = `เติม ${miss.icon} ${miss.label} ให้เร็วกว่านี้`;
    }

    if(over && over.over > .25){
      practice = `ระวัง ${over.icon} ${over.label} ล้น`;
    }

    if(state.junkHits > 2){
      practice = 'หลบ junk เช่น 🍟 🍰 🧃 ให้มากขึ้น';
    }

    if(state.riskyPicks > 2){
      practice = 'ดูป้าย “ล้น!” แล้วหยุดกดหมู่นั้นก่อน';
    }

    if(state.perfectPicks >= 12 && state.junkHits <= 1){
      strong = 'อ่านป้ายอาหารและเลือกได้แม่นมาก';
    }

    let next = 'รอบหน้าลองทำ 2 ดาว';

    if(stars >= 2) next = 'รอบหน้าลุ้น 3 ดาว';
    if(stars >= 3) next = 'รอบหน้าลองทำ Perfect Plate';

    if(state.dailyChallenge && !dailyStatus().done){
      next = `ลองทำ Daily: ${state.dailyChallenge.text}`;
    }

    return `
      <div class="childSummary">
        <div class="childLine">🌟 วันนี้เก่ง: <b>${esc(strong)}</b></div>
        <div class="childLine">🎯 ฝึกต่อ: <b>${esc(practice)}</b></div>
        <div class="childLine">🔁 เป้าหมายรอบหน้า: <b>${esc(next)}</b></div>
      </div>
    `;
  }

  function endGame(){
    state.ended = true;
    state.running = false;

    for(const obj of state.active.values()){
      obj.el.remove();
    }

    state.active.clear();

    renderMissions(true);

    const bal = balanceScore();
    const done = state.missions.filter(m => missionStatus(m,true).done).length;
    const stars = calcStars(bal, done);
    state.stars = stars;

    const rank = getRank(bal, done);

    els.rankIcon.textContent = rank.icon;
    els.summaryTitle.textContent = `${rank.title}`;
    els.summaryLine.textContent = rank.line;

    renderStars(stars);

    els.sumScore.textContent = Math.round(state.score);
    els.sumBalance.textContent = bal + '%';
    els.sumCombo.textContent = state.bestCombo;
    els.sumMission.textContent = `${done}/${state.missions.length}`;

    const badges = buildBadges(bal, done);
    const newBadges = updateBadgeCollection(badges);

    els.badgeRow.innerHTML = badges.map(b => {
      const isNew = newBadges.includes(b);
      return `<span class="badge ${isNew ? 'new' : ''}">${esc(b)}${isNew ? ' • NEW' : ''}</span>`;
    }).join('');

    const flags = updateBest({
      scoreFinal:Math.round(state.score),
      balancePct:bal,
      comboMax:state.bestCombo,
      stars:stars
    });

    renderBestRow(flags);
    els.recommend.innerHTML = buildChildSummary(bal, done, stars);

    els.summaryOverlay.classList.remove('hidden');

    const summary = {
      timestampIso:new Date().toISOString(),
      timestampBangkok:bangkokIso(),
      projectTag:HHA.projectTag,
      gameId:HHA.gameId,
      zone:HHA.zone,
      mode:HHA.mode,
      version:VERSION,
      sessionId:state.sessionId,
      pid:HHA.pid,
      name:HHA.name,
      nick:HHA.nick,
      studyId:HHA.studyId,
      phase:HHA.phase,
      conditionGroup:HHA.conditionGroup,
      section:HHA.section,
      sessionCode:HHA.sessionCode,

      runMode:HHA.runMode,
      diff:DIFF,
      view:VIEW,
      scoreFinal:Math.round(state.score),
      balancePct:bal,
      comboMax:state.bestCombo,
      hits:state.hits,
      misses:state.misses,
      junkHits:state.junkHits,
      overloads:state.overloads,
      missedGood:state.missedGood,
      missionsDone:done,
      missionsTotal:state.missions.length,
      bossDefeated:state.bossDefeated,
      bossType:state.bossType ? state.bossType.id : '',

      stars:stars,
      dailyYmd:DAILY_YMD,
      activeSeed:String(ACTIVE_SEED),
      dailyChallengeId:state.dailyChallenge ? state.dailyChallenge.id : '',
      dailyChallengeText:state.dailyChallenge ? state.dailyChallenge.text : '',
      dailyChallengeDone:dailyStatus().done,

      orderDoneHint:'v2.1-order-card-enabled',
      doubleChoiceHint:'v2.1-double-choice-enabled',
      miniEventHint:'v2.2-mini-events-enabled',
      bossSkillHint:'v2.2-boss-skills-enabled',
      replayLayerHint:'v2.3-daily-best-badge-stars-enabled',
      viewMode:VIEW,
      perfectPicks:state.perfectPicks,
      riskyPicks:state.riskyPicks,
      aimPicks:state.aimPicks,
      visualPolishHint:'v2.4-food-tags-goal-lock-aim-enabled',
      stabilityHint:'v2.5-hha-safe-storage-logging-enabled',
      productionSplitHint:'v2.6-html-css-js-split-enabled',

      badges:buildBadges(bal, done).join('|'),
      durationPlayedSec:Math.round(elapsedSec()),
      endedAt:new Date().toISOString()
    };

    SAFE_STORE.set('HHA_LAST_SUMMARY', safeJsonStringify(summary));
    SAFE_STORE.set('HHA_LAST_SUMMARY_plate', safeJsonStringify(summary));
    SAFE_STORE.set('HHA_LAST_SUMMARY_plate_solo', safeJsonStringify(summary));
    saveDailyResult(summary);

    postLog('session_end', summary);
    flushLogs(true);
  }

  function goBack(){
    flushLogs(true);

    const hub = qs('hub','') || qs('back','');

    if(hub){
      try{
        location.href = hub;
        return;
      }catch(e){}
    }

    const fallback = location.pathname.includes('/plate/')
      ? '../nutrition-zone.html'
      : './nutrition-zone.html';

    const u = new URL(fallback, location.href);

    preserveParams(u, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'seed',
      'studyId',
      'phase',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    u.searchParams.set('zone','nutrition');
    u.searchParams.set('from','plate-solo');

    location.href = u.toString();
  }

  function goCooldown(){
    flushLogs(true);

    const gate = new URL(
      location.pathname.includes('/plate/')
        ? '../warmup-gate.html'
        : './warmup-gate.html',
      location.href
    );

    preserveParams(gate, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'seed',
      'studyId',
      'phase',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    const zoneUrl = new URL(
      location.pathname.includes('/plate/')
        ? '../nutrition-zone.html'
        : './nutrition-zone.html',
      location.href
    );

    preserveParams(zoneUrl, [
      'pid',
      'name',
      'nick',
      'diff',
      'time',
      'view',
      'run',
      'seed',
      'studyId',
      'phase',
      'conditionGroup',
      'section',
      'session_code',
      'log',
      'api'
    ]);

    zoneUrl.searchParams.set('zone','nutrition');
    zoneUrl.searchParams.set('from','plate-solo-cooldown');

    const hub = qs('hub','') || zoneUrl.toString();

    gate.searchParams.set('phase','cooldown');
    gate.searchParams.set('zone','nutrition');
    gate.searchParams.set('game','plate');
    gate.searchParams.set('mode','solo');
    gate.searchParams.set('entry','plate-solo');
    gate.searchParams.set('hub', hub);
    gate.searchParams.set('next', hub);

    location.href = gate.toString();
  }

  function preserveParams(url, keys){
    keys.forEach(k => {
      try{
        const v = qs(k,'');

        if(v !== null && v !== undefined && String(v) !== ''){
          url.searchParams.set(k, v);
        }
      }catch(e){}
    });
  }

  function postLog(eventType, extra = {}){
    const endpoint = HHA.logEndpoint;
    if(!endpoint || state.apiDisabled) return;

    const payload = {
      table:eventType === 'session_end' ? 'sessions' : 'events',
      eventType,
      projectTag:HHA.projectTag,
      gameId:HHA.gameId,
      zone:HHA.zone,
      mode:HHA.mode,
      version:VERSION,
      sessionId:state.sessionId,
      pid:HHA.pid,
      name:HHA.name,
      nick:HHA.nick,
      diff:DIFF,
      view:VIEW,
      runMode:HHA.runMode,
      studyId:HHA.studyId,
      phase:HHA.phase,
      conditionGroup:HHA.conditionGroup,
      section:HHA.section,
      sessionCode:HHA.sessionCode,
      timestampIso:new Date().toISOString(),
      timestampBangkok:bangkokIso(),
      pageUrl:location.href,
      userAgent:navigator.userAgent,
      extra
    };

    state.eventQueue.push(payload);
    state.eventQueue = state.eventQueue.slice(-40);

    if(eventType === 'session_end' || eventType === 'session_start' || eventType === 'client_error'){
      flushLogs(true);
    }else if(now() - state.lastFlushAt > 5000){
      flushLogs(false);
    }
  }

  function flushLogs(force = false){
    const endpoint = HHA.logEndpoint;
    if(!endpoint || state.apiDisabled) return;
    if(!state.eventQueue.length) return;

    state.lastFlushAt = now();

    const batch = state.eventQueue.splice(
      0,
      force ? state.eventQueue.length : Math.min(8, state.eventQueue.length)
    );

    const body = safeJsonStringify({
      table:'events',
      source:'plate-solo',
      batch:true,
      count:batch.length,
      events:batch
    });

    try{
      if(navigator.sendBeacon && force){
        const ok = navigator.sendBeacon(endpoint, new Blob([body], {type:'application/json'}));

        if(!ok){
          state.eventQueue.unshift(...batch);
        }

        return;
      }

      fetch(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body,
        keepalive:!!force
      }).then(res => {
        if(res.status === 401 || res.status === 403){
          state.apiDisabled = true;

          try{
            sessionStorage.setItem('HHA_API_DISABLED', String(Date.now()));
          }catch(e){}
        }

        if(!res.ok && !force){
          state.eventQueue.unshift(...batch);
          state.eventQueue = state.eventQueue.slice(-40);
        }
      }).catch(() => {
        if(!force){
          state.eventQueue.unshift(...batch);
          state.eventQueue = state.eventQueue.slice(-40);
        }
      });
    }catch(e){
      if(!force){
        state.eventQueue.unshift(...batch);
        state.eventQueue = state.eventQueue.slice(-40);
      }
    }
  }

  window.addEventListener('pagehide', () => {
    try{
      flushLogs(true);
    }catch(e){}
  });

  window.addEventListener('beforeunload', () => {
    try{
      flushLogs(true);
    }catch(e){}
  });

  init();

})();
