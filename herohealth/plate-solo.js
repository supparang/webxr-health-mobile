// === /herohealth/plate-solo.js ===
// HeroHealth Plate Solo — FULL SAFE FILE BUILD
// v20260513-PLATE-SOLO-PORTION-TARGET-FIX2-FULL
// ✅ Portion target fix: แต่ละหมู่มีเป้าหมาย/สเกลไม่เท่ากัน
// ✅ ไม่เติมเต็มเร็วเกินไป / ไม่ใช้ x/4 เหมือนกันทุกหมู่
// ✅ แก้ Syntax Error จาก updateMeters ซ้ำ / แก้ howBanner -> showBanner
// ✅ Summary ไม่เด้งเองตอนโหลด / เล่นซ้ำได้ / กลับ Nutrition Zone / Cooldown ได้
// ✅ emoji-only, DOM-safe, GitHub Pages safe

(() => {
  'use strict';

  const VERSION = '20260513-PLATE-SOLO-PORTION-TARGET-FIX2-FULL';
  const DOC = window.document;
  const WIN = window;
  const $ = id => DOC.getElementById(id);

  try { console.info('[Plate Solo]', VERSION, 'loaded'); } catch(e) {}

  const Q = new URL(location.href).searchParams;
  const qs = (k, d = '') => Q.get(k) ?? d;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
  const now = () => performance.now();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));

  const DIFF = String(qs('diff','normal')).toLowerCase();
  const VIEW = String(qs('view','mobile')).toLowerCase();
  const RUN = String(qs('run','play')).toLowerCase();
  const PRACTICE_ON = qs('practice', RUN === 'research' ? '0' : '1') !== '0';
  const ADAPTIVE_ON = qs('adaptive', RUN === 'research' ? '0' : '1') !== '0';
  const PRACTICE_SEC = clamp(Number(qs('practiceSec','25')) || 25, 15, 35);

  const CFG = ({
    easy:{ spawn:1250, life:6900, junk:.10, bossAtk:6600 },
    normal:{ spawn:1120, life:6200, junk:.16, bossAtk:5550 },
    hard:{ spawn:860, life:5050, junk:.25, bossAtk:4650 },
    challenge:{ spawn:720, life:4200, junk:.32, bossAtk:3820 }
  })[DIFF] || { spawn:1120, life:6200, junk:.16, bossAtk:5550 };

  const HHA = {
    projectTag:'HeroHealth', gameId:'plate-solo', zone:'nutrition', mode:'solo', version:VERSION,
    pid:qs('pid','anon'), name:qs('name', qs('nick','Hero')), nick:qs('nick', qs('name','Hero')),
    runMode:RUN, studyId:qs('studyId',''), phase:qs('phase',''), conditionGroup:qs('conditionGroup',''),
    section:qs('section',''), sessionCode:qs('session_code',''), logEndpoint:qs('log','') || qs('api','')
  };

  const GROUPS = [
    { id:'protein', label:'โปรตีน', icon:'🥚' },
    { id:'carb', label:'ข้าว/แป้ง', icon:'🍚' },
    { id:'veg', label:'ผัก', icon:'🥦' },
    { id:'fruit', label:'ผลไม้', icon:'🍎' },
    { id:'fat', label:'ไขมันดี', icon:'🥜' }
  ];

  // PATCH: เป้าหมายไม่เท่ากัน + portion scale ทำให้ไม่เต็มเร็วเกินไป
  const GROUP_TARGETS = { protein:3.5, carb:3.5, veg:5.0, fruit:4.0, fat:2.5 };
  const GROUP_PORTION_SCALE = { protein:.72, carb:.72, veg:.55, fruit:.62, fat:.48 };
  const groupTarget = g => Number(GROUP_TARGETS[g] || 4);
  const groupLimit = g => groupTarget(g) + .75;
  const portionValue = (g,v) => Number(v || 0) * Number(GROUP_PORTION_SCALE[g] || .65);

  const FOODS = [
    { emoji:'🥚', name:'ไข่', effects:{ protein:1 } },
    { emoji:'🐟', name:'ปลา', effects:{ protein:1 } },
    { emoji:'🍗', name:'ไก่', effects:{ protein:1 } },
    { emoji:'🫘', name:'ถั่ว', effects:{ protein:.7, fat:.35 } },
    { emoji:'🥛', name:'นม', effects:{ protein:.7, fat:.25 } },
    { emoji:'🍚', name:'ข้าว', effects:{ carb:1 } },
    { emoji:'🍞', name:'ขนมปัง', effects:{ carb:1 } },
    { emoji:'🥔', name:'มัน', effects:{ carb:1 } },
    { emoji:'🍠', name:'เผือก/มัน', effects:{ carb:1 } },
    { emoji:'🥦', name:'บรอกโคลี', effects:{ veg:1 } },
    { emoji:'🥬', name:'ผักใบ', effects:{ veg:1 } },
    { emoji:'🥕', name:'แครอต', effects:{ veg:1 } },
    { emoji:'🥒', name:'แตงกวา', effects:{ veg:1 } },
    { emoji:'🍎', name:'แอปเปิล', effects:{ fruit:1 } },
    { emoji:'🍌', name:'กล้วย', effects:{ fruit:1 } },
    { emoji:'🍊', name:'ส้ม', effects:{ fruit:1 } },
    { emoji:'🍉', name:'แตงโม', effects:{ fruit:1 } },
    { emoji:'🥜', name:'ถั่ว/ไขมันดี', effects:{ fat:1 } },
    { emoji:'🥑', name:'อะโวคาโด', effects:{ fat:1 } },
    { emoji:'🫒', name:'น้ำมันดี', effects:{ fat:1 } },
    { emoji:'🍟', name:'เฟรนช์ฟรายส์', junk:true, effects:{ fat:1.2, carb:.5 } },
    { emoji:'🍰', name:'เค้กหวาน', junk:true, effects:{ carb:1, fat:.6 } },
    { emoji:'🧃', name:'น้ำหวาน', junk:true, effects:{ carb:1 } },
    { emoji:'🥤', name:'น้ำอัดลม', junk:true, effects:{ carb:1 } },
    { emoji:'🍩', name:'โดนัท', junk:true, effects:{ carb:.8, fat:.8 } },
    { emoji:'🍔', name:'เบอร์เกอร์', junk:true, effects:{ carb:.8, fat:1, protein:.3 } }
  ];

  const POWERS = [
    { emoji:'🛡️', name:'Shield', power:'shield', type:'power' },
    { emoji:'❄️', name:'Freeze', power:'freeze', type:'power' },
    { emoji:'💡', name:'Smart Hint', power:'hint', type:'power' }
  ];

  const BOSSES = [
    { id:'greasy', icon:'👾', name:'Greasy Monster', title:'👾 Greasy Monster', intro:'บอสไขมันมาแล้ว! ระวังหมู่ไขมันล้น', skillName:'Oil Splash' },
    { id:'sugar', icon:'🍭', name:'Sugar Storm', title:'🍭 Sugar Storm', intro:'พายุน้ำตาลมาแล้ว! ระวังคาร์บและของหวาน', skillName:'Sweet Rain' },
    { id:'carbzilla', icon:'🍚', name:'Carbzilla', title:'🍚 Carbzilla', intro:'Carbzilla มาแล้ว! อย่าให้ข้าว/แป้งล้นจาน', skillName:'Carb Burst' },
    { id:'chaos', icon:'🌀', name:'Chaos Chef', title:'🌀 Chaos Chef', intro:'Chaos Chef มาแล้ว! ต้องตัดสินใจเร็วกว่าเดิม', skillName:'Choice Trap' }
  ];

  function hashSeed(str){
    let h = 2166136261 >>> 0; str = String(str || 'plate');
    for (let i=0; i<str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
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
  function bangkokYmd(){
    try { return new Intl.DateTimeFormat('en-CA',{ timeZone:'Asia/Bangkok', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
    catch(e){ return new Date().toISOString().slice(0,10); }
  }
  function bangkokIso(){
    try {
      const s = new Intl.DateTimeFormat('sv-SE',{ timeZone:'Asia/Bangkok', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).format(new Date());
      return s.replace(' ','T') + '+07:00';
    } catch(e){ return new Date().toISOString(); }
  }

  const DAILY_YMD = bangkokYmd();
  const ACTIVE_SEED = qs('seed','') || `plate-daily-${DAILY_YMD}-${DIFF}`;
  const rand = mulberry32(hashSeed(ACTIVE_SEED));
  const dailyRand = mulberry32(hashSeed(`plate-daily-challenge-${DAILY_YMD}-${DIFF}`));
  const pick = arr => arr[Math.floor(rand() * arr.length)] || arr[0];
  const dailyPick = arr => arr[Math.floor(dailyRand() * arr.length)] || arr[0];
  const chance = p => rand() < p;

  const SAFE_STORE = {
    get(k, f=null){ try { const v = localStorage.getItem(k); return v == null ? f : v; } catch(e){ return f; } },
    set(k, v){ try { localStorage.setItem(k, v); return true; } catch(e){ return false; } }
  };
  const safeJsonStringify = obj => { try { return JSON.stringify(obj); } catch(e){ return '{}'; } };
  const safeJsonParse = (s, f) => { try { return JSON.parse(s); } catch(e){ return f; } };

  const ids = `
    app score combo balance timeText timerFill phaseText missions meters hintBox
    bossBox bossHp bossPct bossMood bossName arena spawnLayer plate plateFoods
    plateLabel phaseBanner arcadeHud miniScore miniCombo miniBalance miniTime
    plateHealthIcon plateHealthFill plateHealthText feverLayer finalRush aiDirectorChip
    aiDirectorIcon aiDirectorText practiceCoach practiceIcon practiceTitle practiceText practiceSec practiceFill btnSkipPractice
    bossAvatar bossFace bossLabel bossSkillFlash bossMechanicBox bossMechanicTitle bossMechanicText bossMechanicSec bossMechanicFill
    lastSaveBox lastSaveText lastSaveSec lastSaveFill orderBox orderText orderSec orderFill duelLayer miniEventBox miniEventText miniEventSec miniEventFill
    log flash juiceLayer startOverlay summaryOverlay dailyBox goalLock rankIcon summaryTitle summaryLine starRow bestRow sumScore sumBalance sumCombo sumMission badgeRow recommend
    pShield pFreeze pFever btnStart btnPause btnHint btnSkill btnAim btnBack aimReticle btnReplay btnCooldown btnSummaryBack
  `.trim().split(/\s+/);
  const els = {};
  const byId = id => DOC.getElementById(id);

  function ensureEl(id, tagName, parent, className, html){
    let el = byId(id); if (el) return el;
    el = DOC.createElement(tagName || 'div'); el.id = id;
    if (className) el.className = className;
    if (html != null) el.innerHTML = html;
    const p = parent || byId('plateApp') || DOC.querySelector('.plate-app') || byId('app') || DOC.querySelector('.game-app') || DOC.body;
    if (p) p.appendChild(el);
    return el;
  }

  function resolvePlateEls(){
    ids.forEach(id => els[id] = byId(id));
    els.app = els.app || byId('plateApp') || DOC.querySelector('.plate-app') || DOC.body;
    els.score = els.score || byId('scoreText');
    els.combo = els.combo || byId('comboText');
    els.balance = els.balance || byId('balanceText') || byId('balance');
    els.timeText = els.timeText || byId('timerText') || byId('timeText');
    els.arena = els.arena || byId('gameStage') || byId('arena');
    els.spawnLayer = els.spawnLayer || byId('playField') || byId('spawnLayer') || els.arena;
    els.plate = els.plate || byId('centerPlate') || byId('plate');
    els.plateFoods = els.plateFoods || byId('plateFoods') || ensureEl('plateFoods','div',els.plate,'plate-foods');
    els.plateLabel = els.plateLabel || byId('plateLabel') || ensureEl('plateLabel','div',els.plate,'plate-label','วางอาหารให้ครบ 5 หมู่');
    els.phaseBanner = els.phaseBanner || byId('prompt') || byId('phaseBanner');
    els.startOverlay = els.startOverlay || byId('startOverlay') || ensureEl('startOverlay','div',els.app,'hidden');
    els.summaryOverlay = els.summaryOverlay || byId('summaryOverlay') || byId('summaryModal') || byId('resultModal');
    els.btnStart = els.btnStart || byId('startBtn') || byId('btnStart');
    els.btnPause = els.btnPause || byId('pauseBtn') || byId('btnPause');
    els.btnHint = els.btnHint || byId('btnHint') || ensureEl('btnHint','button',DOC.querySelector('.controls-right') || els.app,'btn blue','คำใบ้');
    els.btnSkill = els.btnSkill || byId('btnSkill') || ensureEl('btnSkill','button',DOC.querySelector('.controls-right') || els.app,'btn warn','สกิลช่วย');
    els.btnBack = els.btnBack || byId('backBtn') || byId('btnBack');
    els.btnReplay = els.btnReplay || byId('replayBtn') || byId('btnReplay');
    els.btnCooldown = els.btnCooldown || byId('cooldownBtn') || byId('btnCooldown');
    els.btnSummaryBack = els.btnSummaryBack || byId('nutritionZoneBtn') || byId('btnZone') || byId('btnSummaryBack');
    els.missions = els.missions || ensureEl('missions','div',DOC.querySelector('.goal-panel') || els.app,'goal-list');
    els.meters = els.meters || ensureEl('meters','div',DOC.querySelector('.plate-side') || els.app,'meters-list');
    els.hintBox = els.hintBox || ensureEl('hintBox','div',DOC.querySelector('.plate-side') || els.app,'panel-note');
    els.log = els.log || ensureEl('log','div',DOC.querySelector('.plate-side') || els.app,'panel-note');
    els.timerFill = els.timerFill || ensureEl('timerFill','i',DOC.querySelector('.timer-card') || els.app,'timer-fill');
    els.phaseText = els.phaseText || byId('phaseText') || ensureEl('phaseText','div',DOC.querySelector('.combo-card') || els.app,'stat-value','Ready');
    els.juiceLayer = els.juiceLayer || ensureEl('juiceLayer','div',els.arena || els.app,'juice-layer');
    els.flash = els.flash || ensureEl('flash','div',els.arena || els.app,'flash');
    return els;
  }

  function foodVisualHtml(food, cls=''){
    const emoji = esc(food && food.emoji ? food.emoji : '🍽️');
    return `<div class="foodVisual assetFallback emojiOnly ${cls}"><span class="foodEmojiFallback" aria-hidden="true">${emoji}</span><span class="assetPackDebug">emoji-only</span></div>`;
  }
  function plateFoodVisualHtml(emoji){
    return `<span class="plateFoodIcon assetFallback emojiOnly"><span class="foodEmojiFallback" aria-hidden="true">${esc(emoji || '🍽️')}</span></span>`;
  }

  function setGameplayViewportVars(){
    try {
      const h = Math.max(420, Math.round(WIN.innerHeight || DOC.documentElement.clientHeight || 720));
      DOC.documentElement.style.setProperty('--hha-vh', h + 'px');
      DOC.documentElement.style.setProperty('--plate-runtime-vh', h + 'px');
    } catch(e) {}
  }
  setGameplayViewportVars();
  WIN.addEventListener('resize', setGameplayViewportVars, { passive:true });
  WIN.addEventListener('orientationchange', () => setTimeout(setGameplayViewportVars, 120), { passive:true });

  function installStyles(){
    if (DOC.getElementById('plateSoloRuntimeStyles')) return;
    const st = DOC.createElement('style'); st.id = 'plateSoloRuntimeStyles';
    st.textContent = `
      .hidden{display:none!important}.foodCard{position:absolute;top:-120px;transform:translateX(-50%) rotate(var(--rot,0deg));z-index:30;touch-action:none;cursor:pointer}
      .foodCard{border:3px solid rgba(255,170,170,.55);background:#fff;border-radius:22px;padding:8px 10px;min-width:76px;min-height:92px;box-shadow:0 18px 36px rgba(25,55,80,.16);animation:plateFall var(--life,6200ms) linear forwards;font-weight:900;color:#31546a}
      .foodCard .foodEmojiFallback{font-size:42px;line-height:1}.foodCard .name{font-size:12px;margin-top:4px}.foodTag{font-size:10px;border-radius:999px;background:#ffe9ef;color:#c94a67;padding:2px 7px;margin-top:3px;display:inline-block}.foodCard.goodNow{border-color:rgba(95,210,118,.75)}.foodCard.power{border-color:rgba(100,180,255,.75)}.foodCard.junk,.foodCard.dangerFood{border-color:rgba(255,112,112,.9)}
      .size-good{scale:.92}.size-junk{scale:.96}.size-boss{scale:1.08}.size-power{scale:.9}.fastObject{filter:saturate(1.08)}
      @keyframes plateFall{0%{top:-130px;opacity:0;transform:translateX(-50%) translateX(var(--startX,0)) rotate(var(--rot,0deg)) scale(.9)}8%{opacity:1}100%{top:calc(100% + 120px);opacity:.95;transform:translateX(-50%) translateX(var(--endX,0)) rotate(calc(var(--rot,0deg) * -1)) scale(1)}}
      .move-zigzag{animation-name:plateFall}.move-junk-dash{animation-timing-function:cubic-bezier(.2,.9,.1,1)}.move-power-float{animation-timing-function:ease-in-out}.move-rain-fast{animation-timing-function:linear}
      .food-meter.over{background:rgba(255,110,110,.10)!important}.food-meter.warn{background:rgba(255,210,80,.12)!important}.meter-fill{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#60d66f,#ffdb66,#ff8a80)}
      .floatText,.scorePop,.comboBoom,.victoryBurst,.counterFx,.milestoneToast,.nearMissFx{position:absolute;left:50%;top:43%;transform:translate(-50%,-50%);z-index:100;pointer-events:none;border-radius:20px;padding:12px 16px;font-weight:1000;box-shadow:0 18px 40px rgba(20,50,70,.22);animation:plateToast 1s both}.scorePop{background:#fff;color:#24506a}.comboBoom,.victoryBurst{background:#fff4ce;color:#784600}.floatText{color:white}.coinFx{position:absolute;left:50%;top:50%;z-index:99;animation:coinFx .9s both;pointer-events:none;font-size:22px}
      @keyframes plateToast{0%{opacity:0;transform:translate(-50%,-40%) scale(.75)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}100%{opacity:0;transform:translate(-50%,-80%) scale(.92)}}@keyframes coinFx{0%{opacity:1;transform:translate(-50%,-50%) scale(.6)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) rotate(var(--rot)) scale(1.1)}}
      .boss-warning #arena,.boss-warning .arena,.boss-warning #gameStage{box-shadow:0 0 0 5px rgba(255,82,82,.18),0 0 42px rgba(255,82,82,.28) inset!important}.boss-enraged #arena,.boss-enraged .arena,.boss-enraged #gameStage{animation:plateBossRumble .42s infinite alternate}@keyframes plateBossRumble{from{transform:translateX(-1px)}to{transform:translateX(1px)}}
      .replayChallenge{margin-top:12px;border-radius:18px;padding:12px 14px;background:linear-gradient(135deg,#f5fbff,#fff8df);border:1px solid rgba(98,164,210,.28);font-weight:850;color:#31546a}.star.on{filter:saturate(1.5);opacity:1}.star{opacity:.35}.badge.new{outline:2px solid rgba(255,190,60,.5)}
    `;
    DOC.head.appendChild(st);
  }

  function hideSummaryOverlay(){
    const overlay = byId('summaryOverlay') || byId('summaryModal') || byId('resultModal');
    if (!overlay) return;
    overlay.classList.add('hidden'); overlay.classList.remove('show','open','active'); overlay.setAttribute('aria-hidden','true');
    overlay.style.display='none'; overlay.style.visibility='hidden'; overlay.style.opacity='0'; overlay.style.pointerEvents='none';
    els.summaryOverlay = overlay;
  }
  function showSummaryOverlay(){
    const overlay = byId('summaryOverlay') || byId('summaryModal') || byId('resultModal');
    if (!overlay) return;
    overlay.classList.remove('hidden'); overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false');
    overlay.style.display='flex'; overlay.style.visibility='visible'; overlay.style.opacity='1'; overlay.style.pointerEvents='auto';
    els.summaryOverlay = overlay;
  }

  const state = {
    running:false, paused:false, ended:false,
    practiceEnabled:PRACTICE_ON, practiceActive:false, practiceDone:false, practiceStarted:0, practiceHits:0, practiceMistakes:0, practicePhase:0,
    startedAt:0, pausedMs:0, pauseStarted:0, totalSec:clamp(Number(qs('time','120')) || 120, 60, 180),
    score:0, combo:0, bestCombo:0, plateHealth:100, plateHealthMin:100,
    lastSaveActive:false, lastSaveUsed:false, lastSaveSuccess:false, lastSaveExpire:0, lastSaveStats:null,
    hits:0, misses:0, junkHits:0, overloads:0, missedGood:0,
    fill:Object.fromEntries(GROUPS.map(g => [g.id,0])), groupHits:Object.fromEntries(GROUPS.map(g => [g.id,0])), plateItems:[], active:new Map(), nextId:1,
    lastSpawn:0, lastSpawnLane:-1, spawnLaneHistory:[], wave:0, rush:false, feverUntil:0, lastFever:0, freezeUntil:0, shield:0, rescueUsed:false,
    boss:false, bossHp:100, bossDefeated:false, bossType:null, lastBossAtk:0, bossEnraged:false, bossWarnActive:false, bossWarnExpire:0, bossCounterCount:0, bossAttackCount:0,
    bossMechanic:null, bossMechanicStats:null, bossMechanicExpire:0, lastBossMechanicAt:0,
    order:null, orderExpire:0, lastOrderAt:0, duel:null, duelExpire:0, lastDuelAt:0, mini:null, miniStats:null, miniExpire:0, lastMiniAt:0,
    perfectPicks:0, riskyPicks:0, aimPicks:0, lastAimTarget:null,
    adaptiveOn:ADAPTIVE_ON, recentPerf:[], goodStreak:0, badStreak:0, directorLevel:0, assistLevel:0, directorMood:'normal', directorLastAt:0,
    missions:[], dailyChallenge:null, stars:0, logs:[], lastHintAt:0, bestBefore:null, unlockedBadges:new Set(), newBadges:[], comboMilestones:new Set(), nearMissUsed:false, nearMissCount:0, replayGoal:'',
    sessionId:'plate-' + Date.now().toString(36) + '-' + Math.floor(rand()*1e6).toString(36), eventQueue:[], lastFlushAt:0, apiDisabled:false
  };

  let audioCtx = null;
  function sfx(kind){
    try {
      audioCtx = audioCtx || new (WIN.AudioContext || WIN.webkitAudioContext)();
      const m = { good:[660,.055,'sine',.045], perfect:[880,.075,'triangle',.055], bad:[150,.08,'sawtooth',.035], boss:[90,.16,'square',.04], fever:[980,.12,'triangle',.06], tick:[520,.035,'sine',.025] };
      const [f,d,t,gain] = m[kind] || m.good;
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type=t; o.frequency.value=f; g.gain.value=gain; o.connect(g); g.connect(audioCtx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime+d); o.stop(audioCtx.currentTime+d+.015);
    } catch(e) {}
  }

  function screenMode(){ const w = Math.max(DOC.documentElement.clientWidth || 0, WIN.innerWidth || 0); return w <= 520 ? 'small' : (w <= 980 ? 'mobile' : 'desktop'); }
  function isAimMode(){ return VIEW === 'cvr' || VIEW === 'cardboard' || VIEW === 'vr-cardboard'; }
  function elapsedSec(){ return Math.max(0, (now() - state.startedAt - state.pausedMs) / 1000); }
  function timeLeft(){ return Math.max(0, state.totalSec - elapsedSec()); }
  function practiceElapsedSec(){ return Math.max(0, (now() - state.practiceStarted) / 1000); }
  function practiceLeftSec(){ return Math.max(0, PRACTICE_SEC - practiceElapsedSec()); }
  function isFever(){ return now() < state.feverUntil; }
  function isFreeze(){ return now() < state.freezeUntil; }

  function balanceScore(){
    const vals = GROUPS.map(g => {
      const target = groupTarget(g.id), f = state.fill[g.id] || 0;
      return f <= target ? (f / target) * 100 : Math.max(0, 100 - (f - target) * 42);
    });
    return Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
  }
  function mostMissingGroup(){ return GROUPS.map(g => ({...g, need:groupTarget(g.id) - (state.fill[g.id] || 0)})).sort((a,b)=>b.need-a.need)[0] || GROUPS[0]; }
  function mostOverGroup(){ return GROUPS.map(g => ({...g, over:(state.fill[g.id] || 0) - groupTarget(g.id)})).sort((a,b)=>b.over-a.over)[0] || GROUPS[0]; }
  function wouldOverload(food){ return !!(food && food.effects && Object.entries(food.effects).some(([g,v]) => (state.fill[g] || 0) + portionValue(g,v) > groupTarget(g) + .20)); }
  function applyEffects(effects){ Object.entries(effects || {}).forEach(([g,v]) => { if (g in state.fill) state.fill[g] = clamp((state.fill[g] || 0) + portionValue(g,v), 0, groupLimit(g)); }); }

  function renderMeters(){
    resolvePlateEls(); if (!els.meters) return;
    els.meters.innerHTML = GROUPS.map(g => {
      const target = groupTarget(g.id);
      return `<div id="bar-${g.id}" class="meter-row food-meter" data-group="${g.id}"><div class="meter-head"><span class="meter-name">${g.icon} ${esc(g.label)}</span><span id="gmv-${g.id}" class="meter-value">0.0/${target}</span></div><div class="meter-track"><i id="bari-${g.id}" class="meter-fill"></i></div><div id="need-${g.id}" class="meter-need">ยังขาด ${target.toFixed(1)}</div></div>`;
    }).join('');
    if (els.balance) els.balance.textContent = '0%';
    const balanceFill = byId('balanceFill') || byId('balanceBar') || DOC.querySelector('.progress-fill');
    if (balanceFill) balanceFill.style.width = '0%';
  }
  function updateMeters(){
    GROUPS.forEach(g => {
      const target = groupTarget(g.id), v = state.fill[g.id] || 0, pct = clamp((v/target)*100,0,145);
      const bar = byId('bar-'+g.id), fill = byId('bari-'+g.id), label = byId('gmv-'+g.id), need = byId('need-'+g.id);
      if (!bar || !fill || !label || !need) return;
      fill.style.width = Math.min(pct,100) + '%';
      bar.classList.toggle('over', v > target + .20);
      bar.classList.toggle('warn', v >= target * .82 && v <= target + .20);
      label.textContent = `${v.toFixed(1)}/${target}`;
      need.textContent = v > target + .20 ? 'ล้นแล้ว! อย่าเติมเพิ่ม' : (v >= target * .82 ? 'พอดีแล้ว' : `ยังขาด ${(target - v).toFixed(1)}`);
    });
    const balanceFill = byId('balanceFill') || byId('balanceBar') || DOC.querySelector('.progress-fill');
    if (balanceFill) balanceFill.style.width = balanceScore() + '%';
  }

  function renderPlate(){
    resolvePlateEls();
    if (els.plateFoods) els.plateFoods.innerHTML = state.plateItems.map(x => plateFoodVisualHtml(x)).join('');
    const b = balanceScore();
    if (els.plate && els.plate.classList) {
      els.plate.classList.toggle('good', b >= 84);
      els.plate.classList.toggle('danger', b < 45 || state.overloads >= 3 || state.plateHealth <= 35);
    }
    if (els.plateLabel) els.plateLabel.textContent = b >= 90 ? 'Perfect Plate!' : b >= 75 ? 'Good Balance' : state.plateHealth <= 25 ? 'Save Plate!' : 'Need Balance';
  }
  function updatePlateHealthUI(){
    const hp = Math.round(state.plateHealth);
    if (els.plateHealthFill) els.plateHealthFill.style.width = clamp(hp,0,100) + '%';
    if (els.plateHealthText) els.plateHealthText.textContent = 'Plate ' + hp + '%';
    if (els.plateHealthIcon) els.plateHealthIcon.textContent = hp <= 25 ? '🚨' : hp <= 55 ? '💛' : '❤️';
    if (els.app) { els.app.classList.toggle('plate-warn', hp <= 55 && hp > 25); els.app.classList.toggle('plate-danger', hp <= 25); els.app.classList.toggle('plate-critical', hp <= 15); }
  }

  function feedback(txt, kind='good'){
    const d = DOC.createElement('div'); d.className = 'floatText'; d.textContent = txt;
    d.style.background = kind === 'bad' ? 'rgba(214,55,69,.82)' : kind === 'perfect' ? 'rgba(120,80,220,.86)' : 'rgba(36,144,80,.82)';
    (els.arena || DOC.body).appendChild(d); setTimeout(()=>d.remove(), 900);
  }
  function showBanner(txt){ resolvePlateEls(); if (!els.phaseBanner) return; els.phaseBanner.textContent = txt; els.phaseBanner.classList.remove('show'); void els.phaseBanner.offsetWidth; els.phaseBanner.classList.add('show'); }
  function scorePop(text, kind='good'){
    const d = DOC.createElement('div'); d.className = `scorePop ${kind}`; d.textContent = text; d.style.left = (42+rand()*16).toFixed(1)+'%'; d.style.top = (42+rand()*14).toFixed(1)+'%';
    (els.juiceLayer || els.arena || DOC.body).appendChild(d); setTimeout(()=>d.remove(),900);
  }
  function coinBurst(kind='good', count=7){
    const layer = els.juiceLayer || els.arena || DOC.body;
    const icons = kind === 'boss' ? ['⭐','✨','🏆','💥'] : kind === 'power' ? ['✨','⚡','💫'] : ['⭐','🟡','✨'];
    for (let i=0;i<count;i++){
      const c = DOC.createElement('div'); c.className='coinFx'; c.textContent=pick(icons);
      const a = Math.PI*2*i/count + rand()*.55, dist = 54+rand()*94;
      c.style.setProperty('--dx', Math.cos(a)*dist+'px'); c.style.setProperty('--dy', Math.sin(a)*dist+'px'); c.style.setProperty('--rot', ((rand()*540)-270).toFixed(0)+'deg');
      c.style.left = (46+rand()*8).toFixed(1)+'%'; c.style.top = (45+rand()*10).toFixed(1)+'%'; layer.appendChild(c); setTimeout(()=>c.remove(),950);
    }
  }
  function popFx(cls, html, ms=1100){ const d=DOC.createElement('div'); d.className=cls; d.innerHTML=html; (els.juiceLayer || els.arena || DOC.body).appendChild(d); setTimeout(()=>{try{d.remove();}catch(e){}},ms); }
  function comboBoom(combo){ popFx('comboBoom', combo >= 15 ? `🔥 PERFECT PLATE FEVER x${combo}!` : combo >= 10 ? `🔥 SUPER COMBO x${combo}!` : `⚡ COMBO x${combo}!`, 1000); }
  function shakePlate(){ if (!els.plate) return; els.plate.classList.remove('bad'); void els.plate.offsetWidth; els.plate.classList.add('bad'); }
  function flash(){ if (!els.flash) return; els.flash.classList.remove('on'); void els.flash.offsetWidth; els.flash.classList.add('on'); }
  function logLine(txt){ resolvePlateEls(); if (!els.log) return; state.logs.unshift(txt); state.logs = state.logs.slice(0,7); els.log.innerHTML = state.logs.map(x=>`<div class="logLine">${esc(x)}</div>`).join(''); }
  function addScore(p,label='',kind='good'){ const n=Math.round(Number(p)||0); if(!n)return; state.score+=n; scorePop(label || `+${n}`, kind); if(n>=45) coinBurst(kind, Math.min(12, Math.max(4, Math.ceil(n/28)))); }
  function loseScore(p,label=''){ const n=Math.round(Number(p)||0); if(!n)return; state.score=Math.max(0,state.score-n); scorePop(label || `-${n}`, 'bad'); }
  function damagePlate(amount, reason=''){
    const n=Math.max(0,Number(amount)||0); if(!n)return; state.plateHealth=clamp(state.plateHealth-n,0,100); state.plateHealthMin=Math.min(state.plateHealthMin,state.plateHealth);
    if(reason) logLine(`❤️ จานเสียหาย: ${reason}`);
    if(state.plateHealth<=25 && !state.lastSaveActive && !state.lastSaveUsed && state.running && !state.ended && !state.practiceActive) startLastSave();
    if(state.plateHealth<=0 && !state.lastSaveActive) plateCrashPenalty();
  }
  function healPlate(amount, reason=''){ const n=Math.max(0,Number(amount)||0); if(!n)return; state.plateHealth=clamp(state.plateHealth+n,0,100); if(reason) logLine(`❤️ กู้จาน: ${reason}`); }
  function plateCrashPenalty(){ state.plateHealth=18; loseScore(80,'-80 จานเกือบพัง!'); state.combo=0; shakePlate(); flash(); feedback('🚨 จานเกือบพัง! รีบกู้สมดุล','bad'); sfx('bad'); }

  function showHint(force=false){
    if(!force && now()-state.lastHintAt<2400) return; state.lastHintAt=now();
    const m=mostMissingGroup(), o=mostOverGroup(); let msg='เติมหมู่ที่ยังขาดก่อน จะได้คอมโบสูง!';
    if(state.lastSaveActive && state.lastSaveStats) msg=`🚨 Last Save: รีบเติม <b>${state.lastSaveStats.needIcon} ${state.lastSaveStats.needLabel}</b> และห้ามโดน junk!`;
    else if(o && o.over>.35) msg=`⚠️ <b>${o.icon} ${o.label}</b> เริ่มล้นแล้ว หยุดเติมก่อน!`;
    else if(m && m.need>.65) msg=`รีบเติม <b>${m.icon} ${m.label}</b> จานยังขาดอยู่!`;
    else if(balanceScore()>=86) msg='เยี่ยม! จานใกล้สมดุลมาก รักษาคอมโบไว้!';
    if(state.boss && !state.bossDefeated) msg += ' ทำถูกต่อเนื่องเพื่อลด HP บอส!';
    if(els.hintBox) els.hintBox.innerHTML = msg;
  }

  function chooseMissions(){
    const pool = [
      { id:'veg', txt:'เก็บผัก 4 ครั้ง', type:'group', group:'veg', target:4 }, { id:'fruit', txt:'เก็บผลไม้ 3 ครั้ง', type:'group', group:'fruit', target:3 },
      { id:'protein', txt:'เติมโปรตีน 3 ครั้ง', type:'group', group:'protein', target:3 }, { id:'combo', txt:'ทำคอมโบ 8', type:'combo', target:8 },
      { id:'rainbow', txt:'ครบทั้ง 5 หมู่', type:'rainbow', target:5 }, { id:'lowjunk', txt:'โดน junk ไม่เกิน 2', type:'endLowJunk', target:2 },
      { id:'balance', txt:'จบด้วยสมดุล 80%+', type:'endBalance', target:80 }, { id:'boss', txt:'ชนะบอสท้ายเกม', type:'boss' }
    ];
    const arr=[]; while(arr.length<3 && pool.length) arr.push(pool.splice(Math.floor(rand()*pool.length),1)[0]); return arr;
  }
  function chooseDailyChallenge(){ return dailyPick([
    { id:'balance85', icon:'⚖️', text:'จบเกมด้วยสมดุล 85%+', goal:'รักษาจานให้พอดี ไม่ล้น', reward:'Daily Balance Star' },
    { id:'combo10', icon:'🔥', text:'ทำคอมโบสูงสุด 10+', goal:'เลือกถูกต่อเนื่อง อย่ากดมั่ว', reward:'Daily Combo Star' },
    { id:'nojunk', icon:'🚫', text:'จบเกมโดยโดน junk ไม่เกิน 1', goal:'หลบของทอด ของหวาน น้ำหวาน', reward:'Daily Clean Star' },
    { id:'boss', icon:'👾', text:'ชนะบอสท้ายเกม', goal:'ทำ Perfect Pick เพื่อลด HP บอส', reward:'Daily Boss Star' },
    { id:'portion', icon:'📏', text:'จบเกมโดยล้นไม่เกิน 1 ครั้ง', goal:'อาหารดีแต่ถ้าหมู่นั้นเต็มแล้วอย่าใส่เพิ่ม', reward:'Daily Portion Star' },
    { id:'vegfruit', icon:'🥦', text:'เก็บผัก 4 ครั้ง และผลไม้ 3 ครั้ง', goal:'เติมผักผลไม้ให้ครบ ไม่ขาด', reward:'Daily Rainbow Star' }
  ]); }
  function dailyStatus(){
    const d=state.dailyChallenge; if(!d) return {done:false,label:''};
    if(d.id==='balance85') return {done:balanceScore()>=85,label:`${balanceScore()}%/85%`};
    if(d.id==='combo10') return {done:state.bestCombo>=10,label:`${Math.min(state.bestCombo,10)}/10`};
    if(d.id==='nojunk') return {done:state.junkHits<=1,label:`junk ${state.junkHits}/1`};
    if(d.id==='boss') return {done:!!state.bossDefeated,label:state.bossDefeated?'ชนะแล้ว':'ยังไม่ชนะ'};
    if(d.id==='portion') return {done:state.overloads<=1,label:`ล้น ${state.overloads}/1`};
    if(d.id==='vegfruit'){ const v=state.groupHits.veg||0,f=state.groupHits.fruit||0; return {done:v>=4&&f>=3,label:`ผัก ${Math.min(v,4)}/4 ผลไม้ ${Math.min(f,3)}/3`}; }
    return {done:false,label:''};
  }
  function missionStatus(m){
    if(m.type==='group') return {done:(state.groupHits[m.group]||0)>=m.target,val:Math.min(state.groupHits[m.group]||0,m.target),max:m.target};
    if(m.type==='combo') return {done:state.bestCombo>=m.target,val:Math.min(state.bestCombo,m.target),max:m.target};
    if(m.type==='rainbow'){ const c=GROUPS.filter(g=>(state.groupHits[g.id]||0)>0).length; return {done:c>=5,val:c,max:5}; }
    if(m.type==='endLowJunk') return {done:state.junkHits<=m.target,val:Math.min(state.junkHits,m.target),max:m.target};
    if(m.type==='endBalance') return {done:balanceScore()>=m.target,val:balanceScore(),max:m.target,pct:true};
    if(m.type==='boss') return {done:state.bossDefeated,val:state.bossDefeated?1:0,max:1};
    return {done:false,val:0,max:1};
  }
  function renderMissions(){
    resolvePlateEls(); if(!els.missions) return;
    els.missions.innerHTML = state.missions.map(m=>{ const st=missionStatus(m), p=st.pct?`${st.val}%`:`${st.val}/${st.max}`; return `<span id="mis-${m.id}" class="mission ${st.done?'done':''}">${st.done?'✅':'🎯'} ${esc(m.txt)} <small>${p}</small></span>`; }).join('') + (state.dailyChallenge ? (()=>{ const ds=dailyStatus(); return `<span id="mis-daily" class="mission ${ds.done?'done':''}">${ds.done?'✅':'📅'} Daily: ${esc(state.dailyChallenge.text)} <small>${esc(ds.label)}</small></span>`; })() : '');
  }
  function updateMissionHot(){ renderMissions(); }
  function renderDailyBox(){ if(!els.dailyBox || !state.dailyChallenge) return; const d=state.dailyChallenge,b=state.bestBefore||{}; els.dailyBox.innerHTML=`<b>📅 Daily Challenge • ${esc(DAILY_YMD)}</b><br>${d.icon} <b>${esc(d.text)}</b><br><span>เป้าหมาย: ${esc(d.goal)}</span><br><span>Best เดิม: ${Number(b.score||0)} คะแนน • ${Number(b.stars||0)} ดาว</span>`; }
  function renderGoalLock(){ if(!els.goalLock) return; const m1=state.missions[0]?state.missions[0].txt:'ทำจานให้สมดุล', d=state.dailyChallenge; els.goalLock.innerHTML=`<div class="goalLockTitle">🎯 เป้าหมายก่อนเริ่ม</div><div class="goalCards"><div class="goalCard"><b>📅 Daily</b> ${d?`${esc(d.icon)} ${esc(d.text)}`:'ทำภารกิจประจำวัน'}</div><div class="goalCard"><b>🎯 Mission 1</b> ${esc(m1)}</div><div class="goalCard"><b>⚖️ จำไว้</b> แต่ละหมู่มีปริมาณไม่เท่ากัน อย่าเติมจนล้น!</div></div>`; }

  function classifyFoodCard(food){
    if(food.type==='power') return {cls:'power',tag:'Power'};
    if(state.lastSaveActive && state.lastSaveStats){ const g=state.lastSaveStats.needGroup; if(food.junk) return {cls:'bossForbidden junk',tag:'ห้ามโดน!'}; if(food.effects&&food.effects[g]&&!wouldOverload(food)) return {cls:'bossWanted goodNow',tag:'กู้จาน!'}; }
    if(state.bossMechanic){ const m=state.bossMechanic; if(m.type==='avoidJunk'&&food.junk) return {cls:'bossForbidden junk',tag:'ห้ามโดน!'}; if(m.type==='avoidGroup'&&food.effects&&food.effects[m.group]) return {cls:'bossForbidden dangerFood',tag:'ห้ามตอนนี้!'}; if(m.type==='quickFix'&&food.effects&&food.effects[m.group]&&!wouldOverload(food)) return {cls:'bossWanted goodNow',tag:'รีบเก็บ!'}; }
    if(food.junk) return {cls:'junk',tag:'หลบ!'};
    if(wouldOverload(food)) return {cls:'riskyFood dangerFood',tag:'ล้น!'};
    const m=mostMissingGroup(); if(food.effects&&food.effects[m.id]) return {cls:'goodNow',tag:'ควรเก็บ'};
    return {cls:'neutralFood',tag:'ใช้ได้'};
  }
  function chooseMovement(food){
    if(state.mini && state.mini.type==='healthyRain' && !food.junk) return {cls:'move-rain-fast',lifeScale:.72,label:'rain-fast'};
    if(state.mini && state.mini.type==='junkInvasion' && food.junk) return {cls:chance(.5)?'move-junk-dash':'move-junk-wobble',lifeScale:.68,label:'junk-invasion'};
    if(food.type==='power') return {cls:'move-power-float',lifeScale:1.18,label:'power-float'};
    if(food.junk) return state.boss||state.rush ? {cls:chance(.55)?'move-junk-dash':'move-junk-wobble',lifeScale:.72,label:'junk-fast'} : {cls:chance(.5)?'move-junk-wobble':'move-drift-right',lifeScale:.9,label:'junk-wobble'};
    if(state.boss && chance(.38)) return {cls:'move-boss-swipe',lifeScale:.78,label:'boss-swipe'};
    if(state.rush && chance(.45)) return {cls:chance(.5)?'move-zigzag':'move-drift-left',lifeScale:.82,label:'rush-move'};
    if(chance(.28)) return {cls:chance(.5)?'move-drift-left':'move-drift-right',lifeScale:1,label:'drift'};
    if(chance(.18)) return {cls:'move-zigzag',lifeScale:.95,label:'zigzag'};
    return {cls:'move-fall',lifeScale:1,label:'fall'};
  }
  function spawnLanes(){ const mode=screenMode(); if(state.practiceActive) return mode==='small'?[18,33,67,82]:mode==='mobile'?[15,28,41,59,72,85]:[12,24,36,64,76,88]; return mode==='small'?[16,30,44,56,70,84]:mode==='mobile'?[14,26,38,50,62,74,86]:[10,20,30,40,60,70,80,90]; }
  function foodSizeClass(food,m){ if(food.type==='power') return 'size-power'; if(food.junk) return state.boss||(state.mini&&state.mini.type==='junkInvasion')?'size-boss':'size-junk'; if(state.boss&&m&&m.label==='boss-swipe') return 'size-boss'; return 'size-good'; }
  function chooseSpawnPlacement(food,m){
    const lanes=spawnLanes(); let cs=lanes.map((pct,i)=>({pct,i,score:rand()})).map(x=>{ if(x.i===state.lastSpawnLane)x.score-=.7; if(state.spawnLaneHistory.includes(x.i))x.score-=.35; if(x.pct<8||x.pct>92)x.score-=2.2; if(state.practiceActive&&x.pct>34&&x.pct<66)x.score-=2.0; if(!state.practiceActive&&x.pct>43&&x.pct<57)x.score-=.45; if(m&&(m.label==='boss-swipe'||m.label==='junk-fast'))x.score+=Math.abs(x.pct-50)/70; if(food.type==='power'){ if(x.pct<18||x.pct>82)x.score-=.5; if(x.pct>=35&&x.pct<=65&&!state.practiceActive)x.score+=.3; } if(isAimMode())x.score+=(1-Math.abs(x.pct-50)/50)*.28; return x; }).sort((a,b)=>b.score-a.score);
    const c=cs[0]||{pct:50,i:0}; state.lastSpawnLane=c.i; state.spawnLaneHistory.push(c.i); state.spawnLaneHistory=state.spawnLaneHistory.slice(-3); return {leftPct:c.pct,lane:c.i,edgeClass:c.pct<=14?'lane-edge-left':c.pct>=84?'lane-edge-right':''};
  }
  function spawnDelay(){
    let d=CFG.spawn; if(state.wave>=2)d*=.9; if(state.wave>=3)d*=.78; if(state.rush)d*=.70; if(isFever())d*=.72; if(state.boss)d*=.82; if(state.mini&&state.mini.type==='healthyRain')d*=.72; if(state.mini&&state.mini.type==='junkInvasion')d*=.68; if(state.mini&&state.mini.type==='missingAlert')d*=.78;
    return d * clamp((1-state.directorLevel*.055)*(1+state.assistLevel*.115),.74,1.38);
  }
  function cardLife(){ let life=CFG.life; if(state.rush)life*=.75; if(isFever())life*=.78; if(state.boss)life*=.82; return clamp(life*clamp((1-state.directorLevel*.035)*(1+state.assistLevel*.16),1.05,1.85),3800,8800); }

  function choosePracticeFood(){
    const ph=state.practicePhase||0;
    if(ph===0){ const m=mostMissingGroup(), pool=FOODS.filter(f=>!f.junk&&f.effects&&f.effects[m.id]&&!wouldOverload(f)); return {...pick(pool.length?pool:FOODS.filter(f=>!f.junk))}; }
    if(ph===1){ if(chance(.52)) return {...pick(FOODS.filter(f=>!f.junk&&f.effects&&f.effects.carb))}; return {...pick(FOODS.filter(f=>!f.junk&&f.effects&&(f.effects.veg||f.effects.fruit||f.effects.protein)))}; }
    if(chance(.48)) return {...pick(FOODS.filter(f=>f.junk))};
    const m=mostMissingGroup(), pool=FOODS.filter(f=>!f.junk&&f.effects&&f.effects[m.id]&&!wouldOverload(f)); return {...pick(pool.length?pool:FOODS.filter(f=>!f.junk))};
  }
  function chooseFood(){
    if(state.practiceActive) return choosePracticeFood();
    const m=mostMissingGroup();
    if(state.mini&&state.mini.type==='healthyRain'&&chance(.82)){ const pool=FOODS.filter(f=>!f.junk&&f.effects&&(f.effects[m.id]||GROUPS.some(g=>(state.fill[g.id]||0)<groupTarget(g.id)*.82&&f.effects[g.id]))&&!wouldOverload(f)); if(pool.length)return{...pick(pool)}; }
    if(state.mini&&state.mini.type==='missingAlert'&&chance(.72)){ const g=state.mini.group||m.id, pool=FOODS.filter(f=>!f.junk&&f.effects&&f.effects[g]&&!wouldOverload(f)); if(pool.length)return{...pick(pool)}; }
    if(chance(.075)&&!state.boss&&!state.mini&&!state.lastSaveActive) return {...pick(POWERS)};
    let jr=CFG.junk+(state.wave-1)*.035+(state.rush?.06:0)+(state.boss?.08:0)+(state.directorLevel*.025-state.assistLevel*.035); if(state.mini&&state.mini.type==='junkInvasion')jr+=.42; if(state.lastSaveActive)jr+=.12;
    if(chance(clamp(jr,.08,.72))) return {...pick(FOODS.filter(f=>f.junk))};
    const missingIds=GROUPS.filter(g=>(state.fill[g.id]||0)<groupTarget(g.id)*.82).map(g=>g.id);
    if(missingIds.length&&chance(.64)){ const g=pick(missingIds), pool=FOODS.filter(f=>!f.junk&&f.effects&&f.effects[g]&&!wouldOverload(f)); if(pool.length)return{...pick(pool)}; }
    const safeHealthy=FOODS.filter(f=>!f.junk&&f.effects&&!wouldOverload(f)); if(safeHealthy.length) return {...pick(safeHealthy)};
    if(chance(.40)) return {...pick(POWERS)};
    return {...pick(FOODS.filter(f=>f.junk))};
  }

  function spawnFood(forced=null){
    resolvePlateEls();
    const maxActive = state.practiceActive ? 4 : state.boss ? 8 : state.rush ? 7 : state.mini ? 8 : screenMode()==='small' ? 5 : screenMode()==='mobile' ? 6 : 8;
    if(!forced && state.active && state.active.size >= maxActive) return;
    state.lastSpawn=now(); const food=forced?{...forced}:chooseFood(); if(!food) return;
    const id='f'+state.nextId++, card=DOC.createElement('button'), visual=classifyFoodCard(food), mov=chooseMovement(food), place=chooseSpawnPlacement(food,mov), size=foodSizeClass(food,mov);
    const fast=['junk-fast','junk-invasion','boss-swipe','rain-fast','rush-move'].includes(mov.label)?'fastObject':'';
    const comboGlow=!food.junk&&food.type!=='power'&&state.combo>=8&&!wouldOverload(food)?'comboGlow':'';
    card.className=`foodCard assetMode ${visual.cls} ${mov.cls} ${size} ${fast} ${comboGlow} ${place.edgeClass}`;
    card.style.left=place.leftPct+'%'; card.style.setProperty('--rot',((rand()*18)-9).toFixed(1)+'deg');
    const life=Math.round(cardLife()*(mov.lifeScale||1)); card.style.animationDuration=life+'ms'; card.style.setProperty('--life',life+'ms'); card.style.setProperty('--startX',Math.round((rand()*120)-60)+'px'); card.style.setProperty('--endX',Math.round((rand()*150)-75)+'px'); card.style.setProperty('--sway',Math.round(22+rand()*28)+'px');
    card.innerHTML=`<div>${foodVisualHtml(food)}<div class="name">${esc(food.name)}</div></div><div class="foodTag">${esc(visual.tag)}</div>`;
    card.addEventListener('pointerdown', ev=>{ ev.preventDefault(); pickFood(id); }, {passive:false});
    (els.spawnLayer||els.arena||DOC.body).appendChild(card);
    state.active.set(id,{food,el:card,born:now(),expire:now()+life});
    postLog('target_spawn',{emoji:food.emoji,name:food.name,kind:food.type==='power'?'power':food.junk?'junk':'healthy',visualTag:visual.tag,movement:mov.label,lifeMs:life,lane:place.lane,leftPct:place.leftPct,wave:state.wave,boss:!!state.boss});
  }
  function clearActiveCards(){ for(const obj of state.active.values()){ try{obj.el.remove();}catch(e){} } state.active.clear(); }
  function expireCards(){ const n=now(); for(const [id,obj] of Array.from(state.active.entries())){ if(n>=obj.expire){ obj.el.remove(); state.active.delete(id); if(!obj.food.junk&&obj.food.type!=='power'){ state.missedGood++; state.combo=0; damagePlate(4,'ปล่อยอาหารดีหลุด'); recordPerf('missedGood',false); if(chance(.22)) feedback('หลุดไป! คอมโบหาย','bad'); } } } }
  function pickFood(id){ if(!state.running||state.paused||state.ended)return; const obj=state.active.get(id); if(!obj)return; obj.el.remove(); state.active.delete(id); const f=obj.food; if(f.type==='power')return applyPower(f); if(f.junk)return handleJunk(f); return handleHealthy(f); }

  function handleHealthy(f){
    const overload=wouldOverload(f), lastSaveWasActive=state.lastSaveActive;
    checkOrderOnPick(f,overload,false); checkMiniOnHealthy(f,overload); checkBossMechanicOnHealthy(f,overload); applyEffects(f.effects);
    state.hits++; Object.keys(f.effects||{}).forEach(g=>state.groupHits[g]=(state.groupHits[g]||0)+1); state.plateItems.push(f.emoji); state.plateItems=state.plateItems.slice(-10);
    if(overload){ state.overloads++; state.riskyPicks++; state.combo=0; loseScore(18,'-18 ล้น!'); damagePlate(10,'หมู่อาหารล้น'); if(lastSaveWasActive)checkLastSaveOnHealthy(f,true); if(state.boss)state.bossHp=clamp(state.bossHp+3,0,100); feedback('⚠️ หมู่นี้เต็มแล้ว!','bad'); sfx('bad'); shakePlate(); logLine(`${f.emoji} ${f.name}: หมู่นี้เริ่มล้น`); recordPerf('overload',false); if(state.practiceActive)state.practiceMistakes++; }
    else { state.perfectPicks++; const mult=(state.rush?2:1)*(isFever()?2:1)*(state.boss?1.25:1); state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo); const gain=Math.round((45+Math.min(state.combo,12)*5)*mult); addScore(gain,state.combo>=5?`Combo +${gain}`:`+${gain}`,state.combo>=5?'combo':'good'); healPlate(state.combo>=5?4:2,'เลือกอาหารถูก'); if(lastSaveWasActive)checkLastSaveOnHealthy(f,false); if(state.boss&&!state.bossDefeated) tryBossCounter(f,overload)||damageBoss(5+Math.min(10,state.combo)); checkComboMilestone(); feedback(state.combo>=5?`🔥 Combo ${state.combo}! +${gain}`:`✅ เติมถูกหมู่! +${gain}`,state.combo>=5?'perfect':'good'); sfx(state.combo>=5?'perfect':'good'); if(state.combo>=6&&state.combo%6===0&&now()-state.lastFever>9000)triggerFever(); if([5,10,15].includes(state.combo))comboBoom(state.combo); logLine(`${f.emoji} ${f.name}: เติมถูกจังหวะ`); recordPerf('perfect',true); if(state.practiceActive)state.practiceHits++; }
    updateMissionHot(); showHint(false); updateAll(); postLog('target_hit',{kind:'healthy',emoji:f.emoji,name:f.name,overload,balancePct:balanceScore(),plateHealth:Math.round(state.plateHealth),combo:state.combo,score:Math.round(state.score)});
  }
  function handleJunk(f){
    const lastSaveWasActive=state.lastSaveActive; checkOrderOnPick(f,true,true); checkMiniOnJunk(); checkBossMechanicOnJunk();
    if(state.shield>0){ state.shield--; addScore(12,'Shield +12','power'); feedback('🛡️ Shield กันของหลอก!','good'); sfx('good'); logLine('Shield บล็อก junk ได้ 1 ครั้ง'); recordPerf('blocked',true); if(state.practiceActive)state.practiceHits++; updateAll(); return; }
    if(tryNearMissRescue(f)){ updateAll(); return; }
    state.junkHits++; state.misses++; state.combo=0; loseScore(35,'-35 Junk!'); if(lastSaveWasActive)checkLastSaveOnJunk(); else damagePlate(16,'โดน junk'); applyEffects(f.effects); if(state.boss)state.bossHp=clamp(state.bossHp+7,0,100); feedback(`❌ หลบ ${f.name}! จานเสียสมดุล`,'bad'); sfx('bad'); shakePlate(); flash(); logLine(`${f.emoji} ${f.name}: ของหลอก!`); recordPerf('junk',false); if(state.practiceActive)state.practiceMistakes++; showHint(true); updateAll(); postLog('target_hit',{kind:'junk',emoji:f.emoji,name:f.name,balancePct:balanceScore(),plateHealth:Math.round(state.plateHealth),combo:state.combo,score:Math.round(state.score)});
  }
  function applyPower(f){ if(f.power==='shield'){state.shield=clamp(state.shield+1,0,2);feedback('🛡️ ได้ Shield!','perfect');logLine('ได้ Shield กัน junk');} else if(f.power==='freeze'){state.freezeUntil=now()+3000;feedback('❄️ Freeze 3 วิ!','perfect');logLine('Freeze: อาหารหยุดเกิดชั่วคราว');} else {showHint(true);addScore(10,'Hint +10','power');feedback('💡 Smart Hint +10','good');} sfx('perfect'); updateAll(); }
  function triggerFever(){ state.lastFever=now(); state.feverUntil=now()+7500; if(els.app)els.app.classList.add('fever'); if(els.feverLayer)els.feverLayer.classList.remove('hidden'); setTimeout(()=>{if(els.app)els.app.classList.remove('fever'); if(els.feverLayer)els.feverLayer.classList.add('hidden');},7600); showBanner('🔥 FEVER MODE! คะแนน x2'); feedback('🔥 Fever Mode!','perfect'); sfx('fever'); }

  function startLastSave(){ const m=mostMissingGroup(); state.lastSaveActive=true; state.lastSaveUsed=true; state.lastSaveSuccess=false; state.lastSaveExpire=now()+8500; state.lastSaveStats={hits:0,needGroup:m.id,needLabel:m.label,needIcon:m.icon,junk:0}; if(els.lastSaveBox)els.lastSaveBox.classList.add('on'); if(els.lastSaveText)els.lastSaveText.textContent=`จานใกล้พัง! รีบเติม ${m.icon} ${m.label} ให้ถูก 2 ครั้ง และห้ามโดน junk`; if(els.lastSaveSec)els.lastSaveSec.textContent='9s'; if(els.lastSaveFill)els.lastSaveFill.style.width='100%'; if(els.app)els.app.classList.add('last-save-active'); showBanner('🚨 LAST SAVE!'); feedback('🚨 จานใกล้พัง! กู้ให้ทัน','bad'); sfx('boss'); }
  function updateLastSave(){ if(!state.lastSaveActive||!state.lastSaveStats)return; const left=Math.max(0,state.lastSaveExpire-now()); if(els.lastSaveSec)els.lastSaveSec.textContent=Math.ceil(left/1000)+'s'; if(els.lastSaveFill)els.lastSaveFill.style.width=clamp(left/8500*100,0,100)+'%'; if(left<=0)completeLastSave(false,'กู้จานไม่ทัน'); }
  function checkLastSaveOnHealthy(food,overload){ if(!state.lastSaveActive||!state.lastSaveStats)return; const g=state.lastSaveStats.needGroup; if(!overload&&food.effects&&food.effects[g]){ state.lastSaveStats.hits++; feedback(`❤️ กู้จาน ${state.lastSaveStats.hits}/2`,'good'); healPlate(10,'เลือกหมู่ที่ต้องการ'); if(state.lastSaveStats.hits>=2)completeLastSave(true,'กู้จานสำเร็จ!'); } else if(overload) damagePlate(8,'ล้นระหว่าง Last Save'); }
  function checkLastSaveOnJunk(){ if(!state.lastSaveActive||!state.lastSaveStats)return; state.lastSaveStats.junk++; damagePlate(12,'โดน junk ระหว่าง Last Save'); completeLastSave(false,'โดน junk ตอนกู้จาน'); }
  function completeLastSave(success,reason){ if(!state.lastSaveActive)return; state.lastSaveActive=false; state.lastSaveSuccess=!!success; if(success){ healPlate(42,'Last Save สำเร็จ'); addScore(140,'Last Save +140','boss'); state.combo+=2; state.bestCombo=Math.max(state.bestCombo,state.combo); if(state.boss&&!state.bossDefeated)damageBoss(16); feedback('❤️ กู้จานสำเร็จ!','perfect'); coinBurst('boss',14); sfx('perfect'); } else { loseScore(45,'-45 Last Save'); state.combo=0; state.plateHealth=Math.max(state.plateHealth,18); feedback('⚠️ กู้จานไม่สำเร็จ แต่ยังเล่นต่อได้!','bad'); shakePlate(); sfx('bad'); } if(els.lastSaveBox)els.lastSaveBox.classList.remove('on'); if(els.app)els.app.classList.remove('last-save-active'); state.lastSaveStats=null; }

  function updatePhase(tLeft){ const e=elapsedSec(), pct=e/state.totalSec; let nw=pct<.22?1:pct<.48?2:pct<.72?3:4; const rush=!state.boss&&e>16&&(Math.floor(e)%28)>=20; if(els.finalRush)els.finalRush.classList.toggle('hidden',tLeft>15); if(tLeft<=26&&!state.boss)startBoss(); if(state.boss)nw=5; if(nw!==state.wave){ state.wave=nw; showBanner(({1:'Wave 1 • เติมจาน',2:'Wave 2 • ระวังล้น',3:'Wave 3 • Food Rush',4:'Rush Window!',5:'Boss Plate!'})[nw]||'Wave'); sfx(nw===5?'boss':'tick'); } if(rush!==state.rush){ state.rush=rush; if(rush){ showBanner('⚡ Rush 8 วิ • คะแนน x2'); logLine('Rush Window! รีบเลือกให้แม่น'); } } }
  function startBoss(){ state.boss=true; state.bossHp=Math.min(state.bossHp,100); state.bossEnraged=false; state.bossWarnActive=false; state.bossWarnExpire=0; state.bossCounterCount=0; state.bossAttackCount=0; state.lastBossAtk=now()+1500; state.bossType=pick(BOSSES); if(els.app){els.app.classList.add('boss-mode','boss-'+state.bossType.id);els.app.classList.remove('boss-defeated');} if(els.bossAvatar)els.bossAvatar.classList.remove('hidden'); if(els.bossFace)els.bossFace.textContent=state.bossType.icon; if(els.bossLabel)els.bossLabel.textContent=state.bossType.name; if(els.bossBox)els.bossBox.classList.add('on'); if(els.bossName)els.bossName.textContent=state.bossType.title; showBanner(`${state.bossType.icon} Boss Plate!`); feedback(state.bossType.intro,'bad'); sfx('boss'); logLine(`Boss Phase: ${state.bossType.name}`); }
  function animateBoss(kind){ if(!els.bossAvatar)return; els.bossAvatar.classList.remove('hit','attack'); void els.bossAvatar.offsetWidth; els.bossAvatar.classList.add(kind); setTimeout(()=>{if(els.bossAvatar)els.bossAvatar.classList.remove(kind);},520); }
  function pulseBossArena(){ if(!els.arena)return; els.arena.classList.remove('boss-pulse'); void els.arena.offsetWidth; els.arena.classList.add('boss-pulse'); setTimeout(()=>{if(els.arena)els.arena.classList.remove('boss-pulse');},520); }
  function showBossSkill(txt){ if(!els.bossSkillFlash)return; els.bossSkillFlash.textContent=txt; els.bossSkillFlash.classList.remove('show'); void els.bossSkillFlash.offsetWidth; els.bossSkillFlash.classList.add('show'); }
  function bossAttackDelay(){ return CFG.bossAtk * clamp((1-state.directorLevel*.06)*(1+state.assistLevel*.10)*(state.bossEnraged?.72:1),.58,1.32); }
  function isBossWarning(){ return state.boss&&!state.bossDefeated&&state.bossWarnActive&&now()<state.bossWarnExpire; }
  function bossWarningDuration(){ return state.bossEnraged?1050:1450; }
  function maybeBossEnrage(){ if(!state.boss||state.bossDefeated||state.bossEnraged||state.bossHp>50)return; state.bossEnraged=true; if(els.app)els.app.classList.add('boss-enraged'); showBanner('🔥 BOSS ENRAGED!'); feedback('🔥 บอสโกรธแล้ว! โจมตีเร็วขึ้น แต่ counter ได้แรงขึ้น','bad'); sfx('boss'); logLine('Boss Enrage: ระวังสกิลถี่ขึ้น!'); postLog('boss_enrage',{bossType:state.bossType?state.bossType.id:'',bossHp:Math.round(state.bossHp)}); }
  function startBossWarning(){ if(!state.boss||state.bossDefeated||state.bossWarnActive)return; const b=state.bossType||BOSSES[0]; state.bossWarnActive=true; state.bossWarnExpire=now()+bossWarningDuration(); if(els.app)els.app.classList.add('boss-warning'); const txt=state.bossEnraged?`🔥 ${b.skillName||'Boss Skill'} กำลังมา! COUNTER เร็ว!`:`⚠️ ${b.skillName||'Boss Skill'} กำลังมา! เลือกของดีเพื่อ COUNTER`; showBossSkill(txt); showBanner('⚠️ Boss Warning!'); feedback('⚡ เลือกอาหารดีที่ยังไม่ล้น เพื่อสวนกลับ!','bad'); sfx('tick'); }
  function tryBossCounter(food,overload){ if(!isBossWarning()||!food||food.junk||overload)return false; const missing=mostMissingGroup(), goodMissing=food.effects&&food.effects[missing.id], goodCombo=state.combo>=4; if(!goodMissing&&!goodCombo)return false; state.bossWarnActive=false; state.bossWarnExpire=0; state.bossCounterCount++; state.lastBossAtk=now()+900; if(els.app)els.app.classList.remove('boss-warning'); const dmg=clamp(18+Math.min(18,state.combo*1.25)+(state.bossEnraged?8:0),18,46); damageBoss(dmg); healPlate(state.bossEnraged?12:8,'Boss Counter'); addScore(state.bossEnraged?125:90,state.bossEnraged?'ENRAGE COUNTER +125':'COUNTER +90','boss'); popFx('counterFx',`⚡ COUNTER!<br><small>บอสเสีย HP -${Math.round(dmg)}</small>`,1150); showBanner('⚡ COUNTER สำเร็จ!'); feedback('⚡ สวนสกิลบอสสำเร็จ!','perfect'); sfx('fever'); logLine('COUNTER! เลือกอาหารดีทันก่อนบอสโจมตี'); return true; }
  function checkComboMilestone(){ const marks=[{n:3,txt:'⚡ Combo 3! จับจังหวะได้แล้ว',score:25},{n:5,txt:'🔥 Combo 5! เริ่มติดไฟ',score:45},{n:10,txt:'🏆 Combo 10! Plate Rush!',score:90},{n:15,txt:'👑 Combo 15! Master Chef!',score:140},{n:20,txt:'🌟 Combo 20! Legendary Plate!',score:220}]; for(const m of marks){ if(state.combo>=m.n&&!state.comboMilestones.has(m.n)){ state.comboMilestones.add(m.n); addScore(m.score,`Milestone +${m.score}`,'mission'); popFx('milestoneToast',`${m.txt}<br><small>โบนัส +${m.score}</small>`,1150); if(m.n>=10&&now()-state.lastFever>3500)triggerFever(); sfx('perfect'); } } }
  function tryNearMissRescue(food){ if(state.nearMissUsed||state.practiceActive||state.combo<8||state.plateHealth<18)return false; state.nearMissUsed=true; state.nearMissCount++; const lost=Math.min(4,Math.floor(state.combo/2)); state.combo=Math.max(0,state.combo-lost); state.shield=Math.max(state.shield,1); healPlate(8,'Near Miss Rescue'); addScore(25,'Near Miss +25','power'); popFx('nearMissFx','💙 NEAR MISS!<br><small>คอมโบสูงช่วยกันพลาด 1 ครั้ง</small>',1100); feedback('💙 Near Miss! ยังไม่เสียเต็ม ได้ Shield 1 ครั้ง','perfect'); sfx('perfect'); logLine(`Near Miss Rescue: กัน ${food?food.name:'junk'} ได้ 1 ครั้ง`); return true; }
  function bossAttack(){ if(state.bossDefeated)return; if(!state.bossWarnActive){startBossWarning();return;} if(now()<state.bossWarnExpire)return; state.bossWarnActive=false; state.bossWarnExpire=0; if(els.app)els.app.classList.remove('boss-warning'); state.lastBossAtk=now(); state.bossAttackCount++; const b=state.bossType||BOSSES[0]; animateBoss('attack'); pulseBossArena(); damagePlate(state.bossEnraged?10:7,'บอสโจมตี'); if(now()-state.lastBossMechanicAt>(state.bossEnraged?6500:9000))startBossMechanic(); if(b.id==='greasy'){ state.fill.fat=clamp((state.fill.fat||0)+portionValue('fat',state.bossEnraged?1.15:.9),0,groupLimit('fat')); state.fill.veg=clamp((state.fill.veg||0)-portionValue('veg',state.bossEnraged?.35:.25),0,groupLimit('veg')); showBossSkill('👾 Oil Splash! ไขมันพุ่ง'); feedback('👾 บอสเทน้ำมัน! ระวังไขมันล้น','bad'); } else if(b.id==='sugar'){ state.fill.carb=clamp((state.fill.carb||0)+portionValue('carb',state.bossEnraged?.85:.65),0,groupLimit('carb')); const junk=FOODS.filter(f=>f.junk&&['🍰','🧃','🍩','🥤'].includes(f.emoji)); spawnFood({...pick(junk)}); setTimeout(()=>{if(state.running&&!state.ended)spawnFood({...pick(junk)});},state.bossEnraged?240:350); if(state.bossEnraged)setTimeout(()=>{if(state.running&&!state.ended)spawnFood({...pick(junk)});},520); showBossSkill('🍭 Sweet Rain! ของหวานตกลงมา'); feedback('🍭 Sugar Storm ปล่อยของหวาน!','bad'); } else if(b.id==='carbzilla'){ state.fill.carb=clamp((state.fill.carb||0)+portionValue('carb',state.bossEnraged?1.28:1.05),0,groupLimit('carb')); state.fill.protein=clamp((state.fill.protein||0)-portionValue('protein',state.bossEnraged?.3:.2),0,groupLimit('protein')); showBossSkill('🍚 Carb Burst! คาร์บเพิ่มแรง'); feedback('🍚 Carbzilla ทำให้คาร์บล้น!','bad'); } else { state.fill.veg=clamp((state.fill.veg||0)-portionValue('veg',state.bossEnraged?.5:.35),0,groupLimit('veg')); state.fill.fruit=clamp((state.fill.fruit||0)-portionValue('fruit',state.bossEnraged?.5:.35),0,groupLimit('fruit')); if(!state.duel&&!state.order&&!state.lastSaveActive)startDuel(); showBossSkill('🌀 Choice Trap! ต้องเลือกให้ไว'); feedback('🌀 Chaos Chef เปิดกับดักเลือก 1 จาก 2!','bad'); } state.combo=0; shakePlate(); flash(); sfx('boss'); showHint(true); updateAll(); }
  function damageBoss(dmg){ state.bossHp=clamp(state.bossHp-dmg,0,100); animateBoss('hit'); if(state.boss&&!state.bossDefeated)pulseBossArena(); maybeBossEnrage(); if(state.bossHp<=0&&!state.bossDefeated){ state.bossDefeated=true; state.bossWarnActive=false; state.bossWarnExpire=0; addScore(220,'Boss +220','boss'); if(els.app){els.app.classList.add('boss-defeated');els.app.classList.remove('boss-warning','boss-enraged');} showBanner('🏆 ชนะบอส! +220'); feedback('👑 Boss Crusher!','perfect'); sfx('fever'); logLine('ชนะบอสแล้ว!'); popFx('victoryBurst','<div class="victoryBurstText">🏆 BOSS DOWN!</div>',1700); coinBurst('boss',18); } }

  function startBossMechanic(){ if(!state.boss||state.bossDefeated||!state.bossType||state.bossMechanic||state.lastSaveActive)return; state.lastBossMechanicAt=now(); const m0=mostMissingGroup(), b=state.bossType; const m=b.id==='greasy'?{type:'avoidGroup',group:'fat',icon:'🥜',title:'👾 Oil Warning!',text:'น้ำมันกำลังล้น! ห้ามเติมไขมันดีช่วงนี้',sec:6,reward:105,penalty:30}:b.id==='sugar'?{type:'avoidJunk',title:'🍭 Sugar Storm!',text:'พายุน้ำตาลมาแล้ว! ห้ามโดน junk',sec:6,reward:110,penalty:35}:b.id==='carbzilla'?{type:'avoidGroup',group:'carb',icon:'🍚',title:'🍚 Carb Lock!',text:'Carbzilla ป่วนจาน! ห้ามเติมข้าว/แป้ง',sec:6,reward:105,penalty:30}:{type:'quickFix',group:m0.id,icon:m0.icon,title:'🌀 Chaos Fix!',text:`รีบเติม ${m0.icon} ${m0.label} ให้ถูก 2 ครั้ง`,sec:7,target:2,reward:125,penalty:28}; state.bossMechanic=m; state.bossMechanicExpire=now()+m.sec*1000; state.bossMechanicStats={hits:0}; if(els.bossMechanicBox)els.bossMechanicBox.classList.add('on'); if(els.bossMechanicTitle)els.bossMechanicTitle.textContent=m.title; if(els.bossMechanicText)els.bossMechanicText.textContent=m.text; if(els.bossMechanicSec)els.bossMechanicSec.textContent=m.sec+'s'; if(els.bossMechanicFill)els.bossMechanicFill.style.width='100%'; if(els.app)els.app.classList.add('boss-mechanic-active'); showBanner(m.title); feedback(m.text,'bad'); sfx('boss'); }
  function updateBossMechanic(){ if(!state.bossMechanic)return; const m=state.bossMechanic,left=Math.max(0,state.bossMechanicExpire-now()); if(els.bossMechanicSec)els.bossMechanicSec.textContent=Math.ceil(left/1000)+'s'; if(els.bossMechanicFill)els.bossMechanicFill.style.width=clamp(left/(m.sec*1000)*100,0,100)+'%'; if(left<=0){ if(m.type==='avoidGroup'||m.type==='avoidJunk')completeBossMechanic(true,'หลบสกิลบอสสำเร็จ!'); else completeBossMechanic(false,'แก้เกมไม่ทัน!'); } }
  function checkBossMechanicOnHealthy(food,overload){ if(!state.bossMechanic)return; const m=state.bossMechanic; if(m.type==='avoidGroup'&&food.effects&&food.effects[m.group])return completeBossMechanic(false,`เผลอเติม ${m.icon} ระหว่างสกิลบอส!`); if(m.type==='quickFix'&&!overload&&food.effects&&food.effects[m.group]){ state.bossMechanicStats.hits++; if(state.bossMechanicStats.hits>=(m.target||2))completeBossMechanic(true,'แก้เกม Chaos สำเร็จ!'); else feedback(`ดีมาก! อีก ${(m.target||2)-state.bossMechanicStats.hits} ครั้ง`,'good'); } }
  function checkBossMechanicOnJunk(){ if(state.bossMechanic&&state.bossMechanic.type==='avoidJunk')completeBossMechanic(false,'โดน junk ระหว่าง Sugar Storm!'); }
  function completeBossMechanic(success,reason){ if(!state.bossMechanic)return; const m=state.bossMechanic; if(success){ addScore(m.reward||100,`Boss Mission +${m.reward||100}`,'boss'); state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo); if(state.boss&&!state.bossDefeated)damageBoss(14); feedback(`✅ ${reason}`,'perfect'); sfx('perfect'); coinBurst('boss',10); } else { loseScore(m.penalty||28,`-${m.penalty||28} Boss`); state.combo=0; if(state.boss&&!state.bossDefeated)state.bossHp=clamp(state.bossHp+7,0,100); feedback(`⚠️ ${reason}`,'bad'); sfx('bad'); shakePlate(); pulseBossArena(); } setTimeout(()=>{ if(els.bossMechanicBox)els.bossMechanicBox.classList.remove('on'); if(els.app)els.app.classList.remove('boss-mechanic-active','boss-mechanic-success','boss-mechanic-fail'); },success?520:700); state.bossMechanic=null; state.bossMechanicStats=null; }

  function maybeStartMiniEvent(tLeft){ if(!state.running||state.paused||state.ended||state.practiceActive||state.mini||state.order||state.duel||state.lastSaveActive||tLeft<22)return; if(now()-state.lastMiniAt<(state.boss?15000:19000))return; if(chance(state.boss?.42:.28))startMiniEvent(); }
  function startMiniEvent(){ state.lastMiniAt=now(); const m=mostMissingGroup(); const pool=[{type:'healthyRain',icon:'🌧️',title:'Healthy Rain',text:'อาหารดีตกเร็วขึ้น! เลือกให้ถูก 4 ครั้ง',sec:8,target:4},{type:'junkInvasion',icon:'🚨',title:'Junk Invasion',text:'ของหลอกบุก! รอดโดยไม่เลือก junk',sec:7,target:0},{type:'missingAlert',icon:'🔎',title:'Missing Group Alert',text:`รีบเติม ${m.icon} ${m.label} 2 ครั้ง`,sec:8,target:2,group:m.id}]; state.mini=pick(pool); state.miniExpire=now()+state.mini.sec*1000; state.miniStats={hits:0,junk:0,groupHits:0}; if(els.miniEventBox)els.miniEventBox.classList.add('on'); if(els.miniEventText)els.miniEventText.textContent=`${state.mini.icon} ${state.mini.text}`; if(els.miniEventSec)els.miniEventSec.textContent=state.mini.sec+'s'; if(els.miniEventFill)els.miniEventFill.style.width='100%'; showBanner(`${state.mini.icon} ${state.mini.title}!`); sfx('fever'); logLine(`Mini Event: ${state.mini.title}`); }
  function updateMiniEvent(){ if(!state.mini)return; const left=Math.max(0,state.miniExpire-now()); if(els.miniEventSec)els.miniEventSec.textContent=Math.ceil(left/1000)+'s'; if(els.miniEventFill)els.miniEventFill.style.width=clamp(left/(state.mini.sec*1000)*100,0,100)+'%'; if(left<=0)finishMiniEvent(false); }
  function checkMiniOnHealthy(food,overload){ if(!state.mini||!state.miniStats)return; if(state.mini.type==='healthyRain'){ if(!overload&&++state.miniStats.hits>=state.mini.target)finishMiniEvent(true); } else if(state.mini.type==='missingAlert'){ const g=state.mini.group; if(!overload&&food.effects&&food.effects[g]&&++state.miniStats.groupHits>=state.mini.target)finishMiniEvent(true); } }
  function checkMiniOnJunk(){ if(state.mini&&state.mini.type==='junkInvasion'){ state.miniStats.junk++; finishMiniEvent(false); } }
  function finishMiniEvent(success){ if(!state.mini)return; const mini=state.mini; if(mini.type==='junkInvasion'&&!success)success=state.miniStats&&state.miniStats.junk===0; if(success){ const reward=mini.type==='healthyRain'?130:mini.type==='missingAlert'?115:125; addScore(reward,`Mini +${reward}`,'mission'); state.combo+=2; state.bestCombo=Math.max(state.bestCombo,state.combo); if(state.boss&&!state.bossDefeated)damageBoss(12); feedback(`${mini.icon} Mini Clear! +${reward}`,'perfect'); sfx('perfect'); logLine(`${mini.title} สำเร็จ +${reward}`); } else { loseScore(20,'-20 Mini'); state.combo=0; if(state.boss&&!state.bossDefeated)state.bossHp=clamp(state.bossHp+4,0,100); feedback(`${mini.icon} Mini Failed`,'bad'); sfx('bad'); shakePlate(); logLine(`${mini.title} ไม่สำเร็จ`); } state.mini=null; state.miniStats=null; if(els.miniEventBox)els.miniEventBox.classList.remove('on'); updateAll(); }

  function maybeStartOrder(tLeft){ if(!state.running||state.paused||state.ended||state.practiceActive||state.order||state.lastSaveActive||tLeft<18)return; if(now()-state.lastOrderAt<(state.boss?12500:15500))return; if(chance(state.boss?.52:.38))startOrder(); }
  function startOrder(){ state.lastOrderAt=now(); const m=mostMissingGroup(), o=mostOverGroup(); const pool=[{type:'needGroup',group:m.id,icon:m.icon,text:`เติม ${m.icon} ${m.label} ให้ทัน!`,sec:7,reward:95},{type:'cleanPick',text:'เลือกอาหารที่ไม่ทำให้จานล้น!',sec:7,reward:85},{type:'noJunk',text:'เอาตัวรอด ห้ามเลือก junk!',sec:8,reward:80}]; if(o&&o.over>.2)pool.push({type:'avoidGroup',group:o.id,icon:o.icon,text:`ห้ามเติม ${o.icon} ${o.label} เพิ่ม!`,sec:7,reward:90}); state.order=pick(pool); state.orderExpire=now()+state.order.sec*1000; if(els.orderBox)els.orderBox.classList.add('on'); if(els.orderText)els.orderText.textContent=state.order.text; if(els.orderSec)els.orderSec.textContent=state.order.sec+'s'; if(els.orderFill)els.orderFill.style.width='100%'; showBanner('⚡ ภารกิจด่วน!'); sfx('tick'); logLine('ภารกิจด่วน: '+state.order.text); }
  function checkOrderOnPick(food,overload,isJunk){ if(!state.order)return; const o=state.order; if(o.type==='needGroup'){ if(!isJunk&&food.effects&&food.effects[o.group]&&!overload)completeOrder(true,'ทำภารกิจด่วนสำเร็จ!'); else if(isJunk)completeOrder(false,'พลาดภารกิจด่วน'); } else if(o.type==='avoidGroup'){ if(food.effects&&food.effects[o.group])completeOrder(false,`เผลอเติม ${o.icon} เพิ่ม`); else if(!isJunk&&!overload)completeOrder(true,'หลบหมู่ที่ล้นได้ดี!'); else if(isJunk)completeOrder(false,'โดน junk ระหว่างภารกิจ'); } else if(o.type==='cleanPick'){ if(!isJunk&&!overload)completeOrder(true,'เลือกอาหารสะอาดและไม่ล้น!'); else completeOrder(false,'อาหารทำให้จานเสียสมดุล'); } else if(o.type==='noJunk'&&isJunk)completeOrder(false,'โดน junk แล้ว!'); }
  function completeOrder(success,reason){ if(!state.order)return; const o=state.order,reward=Number(o.reward||70); if(success){ addScore(reward,`Mission +${reward}`,'mission'); state.combo++; state.bestCombo=Math.max(state.bestCombo,state.combo); if(state.boss&&!state.bossDefeated)damageBoss(9); feedback(`⚡ ${reason} +${reward}`,'perfect'); sfx('perfect'); logLine(reason+` +${reward}`); } else { loseScore(22,'-22 Mission'); state.combo=0; if(state.boss&&!state.bossDefeated)state.bossHp=clamp(state.bossHp+4,0,100); feedback(`⚠️ ${reason}`,'bad'); sfx('bad'); shakePlate(); logLine(reason); } state.order=null; if(els.orderBox)els.orderBox.classList.remove('on'); updateAll(); }
  function updateOrderAndDuel(){ if(state.order){ const left=Math.max(0,state.orderExpire-now()); if(els.orderSec)els.orderSec.textContent=Math.ceil(left/1000)+'s'; if(els.orderFill)els.orderFill.style.width=clamp(left/(state.order.sec*1000)*100,0,100)+'%'; if(left<=0){ if(state.order.type==='noJunk')completeOrder(true,'รอดจาก junk ได้ครบเวลา!'); else completeOrder(false,'หมดเวลาภารกิจด่วน'); } } if(state.duel){ const left=Math.max(0,state.duelExpire-now()), fill=byId('duelFill'); if(fill)fill.style.width=clamp(left/state.duel.secMs*100,0,100)+'%'; if(left<=0)clearDuel(true); } }
  function maybeStartDuel(tLeft){ if(!state.running||state.paused||state.ended||state.practiceActive||state.duel||state.order||state.lastSaveActive||tLeft<20)return; if(now()-state.lastDuelAt<(state.boss?17000:22000))return; if(chance(state.boss?.45:.28))startDuel(); }
  function startDuel(){ state.lastDuelAt=now(); const m=mostMissingGroup(), o=mostOverGroup(); const goodPool=FOODS.filter(f=>!f.junk&&f.effects&&f.effects[m.id]&&!wouldOverload(f)); const riskyPool=FOODS.filter(f=>f.junk||(o&&o.over>.1&&f.effects&&f.effects[o.id])||wouldOverload(f)); const good={...pick(goodPool.length?goodPool:FOODS.filter(f=>!f.junk))}, risky={...pick(riskyPool.length?riskyPool:FOODS.filter(f=>f.junk))}; const choices=chance(.5)?[good,risky]:[risky,good]; state.duel={choices,bestEmoji:good.emoji,secMs:5200}; state.duelExpire=now()+state.duel.secMs; if(els.duelLayer){ els.duelLayer.innerHTML=`<div class="duelBox"><div class="duelTitle">⚡ อาหาร 2 ชิ้นกำลังพุ่งเข้าจาน! เลือกตัวที่เหมาะกว่า!</div><div class="duelChoices">${choices.map((f,i)=>`<button class="duelBtn" data-i="${i}"><div>${foodVisualHtml(f)}<div class="name">${esc(f.name)}</div></div></button>`).join('')}</div><div class="duelTimer"><i id="duelFill"></i></div></div>`; Array.from(els.duelLayer.querySelectorAll('.duelBtn')).forEach(btn=>btn.addEventListener('pointerdown',ev=>{ev.preventDefault();pickDuel(Number(btn.dataset.i));},{passive:false})); } showBanner('⚡ Double Choice!'); sfx('tick'); logLine('Double Choice: เลือกอาหารที่เหมาะที่สุด'); }
  function pickDuel(i){ if(!state.duel)return; const f=state.duel.choices[i]; clearDuel(false); if(!f)return; if(f.junk)return handleJunk(f); return handleHealthy(f); }
  function clearDuel(timeout){ if(!state.duel)return; if(timeout){ state.combo=0; loseScore(18,'-18 ช้าไป!'); feedback('⏱️ ช้าไป! Double Choice หมดเวลา','bad'); sfx('bad'); logLine('Double Choice หมดเวลา'); } state.duel=null; if(els.duelLayer)els.duelLayer.innerHTML=''; updateAll(); }

  function recordPerf(kind,good){ if(!state.adaptiveOn)return; const t=now(); state.recentPerf.push({t,kind,good:!!good,balance:balanceScore(),combo:state.combo}); state.recentPerf=state.recentPerf.filter(x=>t-x.t<=16000).slice(-18); if(good){state.goodStreak++;state.badStreak=0;}else{state.badStreak++;state.goodStreak=0;} }
  function updateAIDirector(){ if(!state.adaptiveOn||!state.running||state.paused||state.ended||state.practiceActive)return; if(now()-state.directorLastAt<3200)return; state.directorLastAt=now(); const r=state.recentPerf,total=r.length||1,good=r.filter(x=>x.good).length,acc=good/total,junk=r.filter(x=>x.kind==='junk').length,over=r.filter(x=>x.kind==='overload').length; let mood='normal',icon='🤖',msg='AI Coach: คุมจานให้พอดีต่อไป'; const struggling=total>=5&&(acc<.45||junk>=2||over>=2||balanceScore()<42||state.badStreak>=3), strong=total>=6&&(acc>=.78||state.goodStreak>=6||state.combo>=8||balanceScore()>=82); if(struggling){ state.assistLevel=clamp(state.assistLevel+1,0,3); state.directorLevel=clamp(state.directorLevel-1,0,4); mood='assist'; icon='💙'; msg='AI Coach: ช่วยชะลอเกมนิดหนึ่ง ดูป้าย “ควรเก็บ”'; if(state.shield<=0&&state.badStreak>=4){ state.shield=1; feedback('💙 AI Coach ให้ Shield ช่วย 1 ครั้ง','good'); } } else if(strong){ state.directorLevel=clamp(state.directorLevel+1,0,4); state.assistLevel=clamp(state.assistLevel-1,0,3); mood=state.directorLevel>=3?'hot':'challenge'; icon=state.directorLevel>=3?'🔥':'⚡'; msg=state.directorLevel>=3?'AI Coach: เก่งมาก! เพิ่มความท้าทายแล้ว':'AI Coach: จังหวะดีขึ้น เกมจะเร็วขึ้นนิดหนึ่ง'; } state.directorMood=mood; if(els.aiDirectorChip){ els.aiDirectorChip.classList.remove('hidden','assist','challenge','hot'); if(mood!=='normal')els.aiDirectorChip.classList.add(mood); if(els.aiDirectorIcon)els.aiDirectorIcon.textContent=icon; if(els.aiDirectorText)els.aiDirectorText.textContent=msg; clearTimeout(updateAIDirector._timer); updateAIDirector._timer=setTimeout(()=>{if(els.aiDirectorChip)els.aiDirectorChip.classList.add('hidden');},2600); } if(els.app){ els.app.classList.remove('ai-assist','ai-challenge','ai-hot'); if(mood==='assist')els.app.classList.add('ai-assist'); if(mood==='challenge')els.app.classList.add('ai-challenge'); if(mood==='hot')els.app.classList.add('ai-hot'); } }

  function setTextSafe(el,value){ if(el)el.textContent=value; }
  function setWidthSafe(el,value){ if(el&&el.style)el.style.width=value; }
  function toggleSafe(el,cls,on){ if(el&&el.classList)el.classList.toggle(cls,!!on); }
  function updateAll(){ resolvePlateEls(); const left=state.practiceActive?Math.ceil(practiceLeftSec()):Math.ceil(timeLeft()), bal=balanceScore(); setTextSafe(els.score,Math.round(state.score)); setTextSafe(els.combo,state.combo); setTextSafe(els.balance,bal+'%'); setTextSafe(els.timeText,left); setTextSafe(els.miniScore,Math.round(state.score)); setTextSafe(els.miniCombo,state.combo); setTextSafe(els.miniBalance,bal+'%'); setTextSafe(els.miniTime,left+'s'); const total=state.practiceActive?PRACTICE_SEC:state.totalSec; if(els.timerFill){ setWidthSafe(els.timerFill,clamp(left/total*100,0,100)+'%'); toggleSafe(els.timerFill,'danger',left<=15); } const phaseName=state.boss?(state.bossDefeated?'Boss defeated • รักษาจานให้จบสวย':'Boss Plate • ทำถูกเพื่อลด HP'):state.rush?'Rush Window • คะแนน x2':`Wave ${state.wave||1} • ${DIFF}`; setTextSafe(els.phaseText,state.practiceActive?'🧑‍🍳 Practice Mode • ลองก่อน คะแนนยังไม่คิดจริง':isFever()?'🔥 FEVER MODE • คะแนน x2':phaseName); updateMeters(); renderPlate(); updatePowers(); updateBoss(); renderMissions(); updatePlateHealthUI(); }
  function updatePowers(){ if(els.pShield){ els.pShield.classList.toggle('on',state.shield>0); els.pShield.innerHTML=`<b>🛡️</b>Shield ${state.shield?'x'+state.shield:''}`; } if(els.pFreeze)els.pFreeze.classList.toggle('on',isFreeze()); if(els.pFever)els.pFever.classList.toggle('on',isFever()); }
  function updateBoss(){ if(els.bossBox)els.bossBox.classList.toggle('on',state.boss); if(els.bossHp)els.bossHp.style.width=state.bossHp+'%'; if(els.bossPct)els.bossPct.textContent=Math.round(state.bossHp)+'%'; if(els.bossName&&state.bossType)els.bossName.textContent=state.bossType.title; if(els.bossMood)els.bossMood.textContent=state.bossDefeated?'ชนะบอสแล้ว! รักษาจานให้สมดุลจนจบ':state.boss?(isBossWarning()?'⚠️ Boss Warning: เลือกอาหารดีเพื่อ COUNTER!':state.bossEnraged?'🔥 บอสโกรธแล้ว! Counter จะได้โบนัสแรงขึ้น':'Perfect Pick จะลด HP บอส / junk ทำให้บอสฟื้น'):'บอสยังไม่มา'; }

  function updatePracticeCoach(){ const left=practiceLeftSec(); let ph=0; if(left<=PRACTICE_SEC*.66)ph=1; if(left<=PRACTICE_SEC*.33)ph=2; state.practicePhase=ph; const data=[{icon:'✅',title:'Practice 1/3',text:'เลือกอาหารที่มีป้าย “ควรเก็บ” เพื่อเติมหมู่ที่จานยังขาด'},{icon:'⚠️',title:'Practice 2/3',text:'ถ้าเห็นป้าย “ล้น!” ให้ระวัง อาหารดีแต่หมู่นั้นเต็มแล้ว'},{icon:'🚫',title:'Practice 3/3',text:'หลบ Junk เช่น ของทอด ของหวาน น้ำหวาน แล้วเก็บของดีให้ทัน'}][ph]; if(els.practiceIcon)els.practiceIcon.textContent=data.icon; if(els.practiceTitle)els.practiceTitle.textContent=data.title; if(els.practiceText)els.practiceText.textContent=data.text; if(els.practiceSec)els.practiceSec.textContent=Math.ceil(left)+'s'; if(els.practiceFill)els.practiceFill.style.width=clamp(left/PRACTICE_SEC*100,0,100)+'%'; if(ph===1)state.fill.carb=Math.max(state.fill.carb,groupTarget('carb')); }
  function updatePractice(){ const left=practiceLeftSec(); if(left<=0)return finishPractice(false); updatePracticeCoach(); const delay=left>PRACTICE_SEC*.66?1200:left>PRACTICE_SEC*.33?1000:850; if(!isFreeze()&&now()-state.lastSpawn>delay)spawnFood(); expireCards(); updateAll(); }

  function resetForMainRound(){ if(els.btnStart&&!state.running){els.btnStart.disabled=false;els.btnStart.classList.remove('hidden');} clearActiveCards(); Object.assign(state,{score:0,combo:0,bestCombo:0,plateHealth:100,plateHealthMin:100,lastSaveActive:false,lastSaveUsed:false,lastSaveSuccess:false,lastSaveStats:null,hits:0,misses:0,junkHits:0,overloads:0,missedGood:0,fill:Object.fromEntries(GROUPS.map(g=>[g.id,0])),groupHits:Object.fromEntries(GROUPS.map(g=>[g.id,0])),plateItems:[],wave:0,rush:false,feverUntil:0,lastFever:0,shield:0,freezeUntil:0,rescueUsed:false,boss:false,bossHp:100,bossDefeated:false,bossType:null,bossMechanic:null,bossMechanicStats:null,order:null,duel:null,mini:null,miniStats:null,perfectPicks:0,riskyPicks:0,aimPicks:0,recentPerf:[],goodStreak:0,badStreak:0,directorLevel:0,assistLevel:0,directorMood:'normal',comboMilestones:new Set(),bossEnraged:false,bossWarnActive:false,bossWarnExpire:0,bossCounterCount:0,bossAttackCount:0,nearMissUsed:false,nearMissCount:0,replayGoal:'',lastSpawnLane:-1,spawnLaneHistory:[]}); if(els.btnSkill)els.btnSkill.disabled=false; ['orderBox','miniEventBox','bossMechanicBox','lastSaveBox'].forEach(k=>{if(els[k])els[k].classList.remove('on');}); if(els.duelLayer)els.duelLayer.innerHTML=''; ['finalRush','feverLayer','aiDirectorChip'].forEach(k=>{if(els[k])els[k].classList.add('hidden');}); if(els.app)els.app.classList.remove('boss-mode','boss-greasy','boss-sugar','boss-carbzilla','boss-chaos','boss-defeated','boss-enraged','boss-warning','boss-mechanic-active','ai-assist','ai-challenge','ai-hot','plate-warn','plate-danger','plate-critical','last-save-active'); updateAll(); }
  function startPractice(){ resetForMainRound(); state.practiceActive=true; state.practiceStarted=now(); state.practiceHits=0; state.practiceMistakes=0; state.practicePhase=0; state.lastSpawn=now(); if(els.app)els.app.classList.add('practice-mode'); if(els.practiceCoach)els.practiceCoach.classList.remove('hidden'); updatePracticeCoach(); showBanner(`🧑‍🍳 Practice ${PRACTICE_SEC} วิ`); feedback('ลองก่อน! คะแนนยังไม่คิดจริง','good'); sfx('good'); }
  function finishPractice(skipped){ if(!state.practiceActive)return; state.practiceActive=false; state.practiceDone=true; clearActiveCards(); resetForMainRound(); if(els.practiceCoach)els.practiceCoach.classList.add('hidden'); if(els.app)els.app.classList.remove('practice-mode'); showBanner(skipped?'ข้าม Practice • เริ่มเกมจริง!':'Practice จบแล้ว • เริ่มเกมจริง!'); feedback(skipped?'เริ่มเกมจริง!':'พร้อมแล้ว เริ่มเกมจริง!','perfect'); sfx('perfect'); startRealGame(); }
  function startGame(){ hideSummaryOverlay(); resolvePlateEls(); setGameplayViewportVars(); state.running=true; state.ended=false; state.paused=false; try{DOC.body.classList.add('plate-playing','plate-immersive');}catch(e){} if(els.app)els.app.classList.add('playing','immersive-gameplay','hud-target-safe'); if(els.arcadeHud)els.arcadeHud.classList.remove('hidden'); if(els.btnStart){els.btnStart.disabled=true;els.btnStart.classList.add('hidden');} if(els.startOverlay)els.startOverlay.classList.add('hidden'); if(state.practiceEnabled&&!state.practiceDone)startPractice(); else startRealGame(); requestAnimationFrame(loop); }
  function startRealGame(){ state.practiceActive=false; state.practiceDone=true; state.startedAt=now(); state.pausedMs=0; state.lastSpawn=now(); if(els.practiceCoach)els.practiceCoach.classList.add('hidden'); if(els.app)els.app.classList.remove('practice-mode'); showBanner('Wave 1 • เติมจานให้ครบ!'); showHint(true); postLog('session_start',{version:VERSION,diff:DIFF,view:VIEW,durationPlannedSec:state.totalSec,activeSeed:String(ACTIVE_SEED),dailyYmd:DAILY_YMD}); }
  function togglePause(force=false){ if(!state.running||state.ended)return; if(!state.paused||force){ state.paused=true; state.pauseStarted=now(); if(els.btnPause)els.btnPause.textContent='▶️ เล่นต่อ'; logLine('พักเกมไว้ก่อน'); } else { state.paused=false; state.pausedMs+=now()-state.pauseStarted; state.lastSpawn=now(); if(els.btnPause)els.btnPause.textContent='⏸️ พัก'; requestAnimationFrame(loop); logLine('กลับมาเล่นต่อ!'); } }
  function loop(){ if(!state.running||state.ended)return; if(state.paused){requestAnimationFrame(loop);return;} if(state.practiceActive){updatePractice();requestAnimationFrame(loop);return;} const left=timeLeft(); updatePhase(left); updateAIDirector(); if(left<=0){endGame();return;} maybeStartMiniEvent(left); maybeStartOrder(left); maybeStartDuel(left); updateOrderAndDuel(); updateMiniEvent(); updateBossMechanic(); updateLastSave(); if(!isFreeze()&&!state.duel&&now()-state.lastSpawn>spawnDelay())spawnFood(); expireCards(); if(state.boss&&!state.bossDefeated&&now()-state.lastBossAtk>bossAttackDelay())bossAttack(); updateAll(); requestAnimationFrame(loop); }
  function rescueSkill(){ if(!state.running||state.paused||state.ended||state.rescueUsed)return; state.rescueUsed=true; if(els.btnSkill)els.btnSkill.disabled=true; state.freezeUntil=now()+2500; state.shield=Math.max(state.shield,1); const m=mostMissingGroup(); state.fill[m.id]=Math.min(groupTarget(m.id)*.7,(state.fill[m.id]||0)+.55); addScore(30,'Rescue +30','power'); healPlate(18,'Rescue Skill'); feedback('✨ Rescue! Freeze + Shield + เติมหมู่ที่ขาด','perfect'); sfx('fever'); logLine('ใช้ Rescue Skill แล้ว'); updateAll(); }

  function playerKey(){ return String(qs('pid','anon')||'anon').replace(/[^\w.-]/g,'_'); }
  function bestKey(){ return `HHA_PLATE_SOLO_BEST_${playerKey()}_${DIFF}`; }
  function badgeKey(){ return `HHA_PLATE_SOLO_BADGES_${playerKey()}`; }
  function dailyKey(){ return `HHA_PLATE_SOLO_DAILY_${playerKey()}_${DAILY_YMD}_${DIFF}`; }
  function loadBest(){ const raw=SAFE_STORE.get(bestKey(),''); return raw ? (safeJsonParse(raw,{score:0,balance:0,combo:0,stars:0,date:''}) || {score:0,balance:0,combo:0,stars:0,date:''}) : {score:0,balance:0,combo:0,stars:0,date:''}; }
  function loadBadgeSet(){ const arr=safeJsonParse(SAFE_STORE.get(badgeKey(),'[]'),[]); return new Set(Array.isArray(arr)?arr:[]); }
  function updateBadgeCollection(badges){ const old=state.unlockedBadges||new Set(), news=badges.filter(b=>!old.has(b)), merged=new Set([...old,...badges]); state.unlockedBadges=merged; state.newBadges=news; SAFE_STORE.set(badgeKey(),safeJsonStringify(Array.from(merged))); return news; }
  function calcStars(bal,done){ let s=0; if(bal>=60&&state.score>=250)s=1; if(bal>=75&&done>=2&&state.bestCombo>=6)s=2; if(bal>=88&&done>=3&&state.bestCombo>=9&&(state.bossDefeated||state.bossHp<=15))s=3; if(dailyStatus().done&&s<2)s=2; return clamp(s,0,3); }
  function buildReplayChallenge(stars,bal,done){ if(!state.bossDefeated)return'👾 Replay Goal: เล่นอีกตาเพื่อชนะบอสท้ายเกม'; if(stars<3)return'⭐ Replay Goal: เล่นอีกตาเพื่อเก็บ 3 ดาว'; if(bal<92)return'⚖️ Replay Goal: ทำ Perfect Plate 92%+'; if(state.bestCombo<15)return'🔥 Replay Goal: ทำ Combo 15+'; if(state.junkHits>0)return'🚫 Replay Goal: จบแบบไม่โดน junk เลย'; return'👑 Replay Goal: ทำคะแนนใหม่ให้สูงกว่าเดิม!'; }
  function endGame(){
    if(state.ended)return; state.ended=true; state.running=false; try{DOC.body.classList.remove('plate-playing','plate-immersive');}catch(e){} clearActiveCards(); renderMissions(); if(els.app)els.app.classList.remove('playing','immersive-gameplay','hud-target-safe'); if(els.arcadeHud)els.arcadeHud.classList.add('hidden');
    const bal=balanceScore(), done=state.missions.filter(m=>missionStatus(m).done).length, rawScore=Math.round(Number(state.score)||0);
    const fairScore=Math.max(rawScore,Math.round((Number(state.hits)||0)*42+(Number(state.bestCombo)||0)*18+done*80+(state.bossDefeated?220:0)+(state.lastSaveSuccess?120:0)-(Number(state.junkHits)||0)*25-(Number(state.overloads)||0)*12));
    if(fairScore>rawScore)state.score=fairScore; const stars=calcStars(bal,done); state.stars=stars;
    const rank=bal>=90&&done>=3&&state.bossDefeated?{icon:'👑',title:'SS • Plate Master',line:'สุดยอด! จานสมดุล ชนะบอส และทำภารกิจครบ'}:bal>=82&&done>=2?{icon:'🏆',title:'S • Balance Hero',line:'ยอดเยี่ยม! จานสมดุลมาก เล่นอีกรอบลุ้น SS ได้เลย'}:bal>=70||state.score>=600||state.bestCombo>=10?{icon:'⭐',title:'A • Smart Chef',line:'ดีมาก! รอบหน้าเน้นหมู่ที่ยังขาดและอย่าให้ล้น'}:bal>=55?{icon:'🌟',title:'B • Healthy Builder',line:'เริ่มดีแล้ว! ลองดูแถบสมดุลก่อนเลือกอาหาร'}:{icon:'🍽️',title:'C • Plate Starter',line:'ไม่เป็นไร! รอบหน้าลองเติมหมู่ที่ขาดก่อนนะ'};
    if(els.rankIcon)els.rankIcon.textContent=rank.icon; if(els.summaryTitle)els.summaryTitle.textContent=rank.title; if(els.summaryLine)els.summaryLine.textContent=rank.line;
    if(els.starRow)els.starRow.innerHTML=`<span class="star ${stars>=1?'on':''}">⭐</span><span class="star ${stars>=2?'on':''}">⭐</span><span class="star ${stars>=3?'on':''}">⭐</span><div class="starLabel">${stars>=3?'สุดยอด! 3 ดาวแบบ Plate Hero':stars===2?'ดีมาก! อีกนิดเดียวถึง 3 ดาว':stars===1?'ผ่านแล้ว! รอบหน้าลุ้น 2 ดาว':'ลองใหม่ได้! เริ่มจากเติมหมู่ที่ขาดก่อน'}</div>`;
    if(els.sumScore)els.sumScore.textContent=Math.round(state.score); if(els.sumBalance)els.sumBalance.textContent=bal+'%'; if(els.sumCombo)els.sumCombo.textContent=state.bestCombo; if(els.sumMission)els.sumMission.textContent=`${done}/${state.missions.length}`;
    const badges=[]; if(bal>=85)badges.push('⚖️ Balance Master'); if(state.bestCombo>=10)badges.push('🔥 Combo Chef'); if(state.junkHits===0)badges.push('🚫 Junk Dodger'); if(state.bossDefeated)badges.push('👾 Boss Crusher'); if(state.bossCounterCount>=2)badges.push('⚡ Counter Hero'); if(state.bossEnraged&&state.bossDefeated)badges.push('🔥 Enrage Survivor'); if(state.nearMissUsed)badges.push('💙 Near Miss Saver'); if(done>=3)badges.push('🎯 Mission Clear'); if(state.lastSaveSuccess)badges.push('❤️ Plate Saver'); if(!badges.length)badges.push('🍽️ Plate Starter'); const news=updateBadgeCollection(badges); if(els.badgeRow)els.badgeRow.innerHTML=badges.map(b=>`<span class="badge ${news.includes(b)?'new':''}">${esc(b)}${news.includes(b)?' • NEW':''}</span>`).join('');
    state.replayGoal=buildReplayChallenge(stars,bal,done); if(els.recommend)els.recommend.innerHTML=`<div class="childSummary"><div class="childLine">🌟 วันนี้เก่ง: <b>${bal>=85?'คุมจานสมดุลได้ยอดเยี่ยม':state.bestCombo>=8?'ทำคอมโบได้ดีมาก':'เลือกอาหารได้ดีขึ้นแล้ว'}</b></div><div class="childLine">🎯 ฝึกต่อ: <b>${state.junkHits>2?'หลบ junk เช่น 🍟 🍰 🧃 ให้มากขึ้น':`เติม ${mostMissingGroup().icon} ${mostMissingGroup().label} ให้เร็วกว่านี้`}</b></div><div class="childLine">❤️ พลังจานสุดท้าย: <b>${Math.round(state.plateHealth)}%</b></div><div class="childLine">🔁 เป้าหมายรอบหน้า: <b>${stars>=2?'รอบหน้าลุ้น 3 ดาว':'รอบหน้าลองทำ 2 ดาว'}</b></div><div class="replayChallenge">${esc(state.replayGoal)}</div></div>`;
    if(els.btnStart){els.btnStart.disabled=false;els.btnStart.classList.remove('hidden');}
    showBanner('สรุปผล • เล่นอีกครั้งเพื่อจัดจานอาหาร'); showSummaryOverlay();
    const summary={timestampIso:new Date().toISOString(),timestampBangkok:bangkokIso(),projectTag:HHA.projectTag,gameId:HHA.gameId,zone:HHA.zone,mode:HHA.mode,version:VERSION,summaryPolishHint:'portion-target-fix2',sessionId:state.sessionId,pid:HHA.pid,name:HHA.name,diff:DIFF,view:VIEW,scoreFinal:Math.round(state.score),balancePct:bal,comboMax:state.bestCombo,hits:state.hits,misses:state.misses,junkHits:state.junkHits,overloads:state.overloads,missionsDone:done,stars,bossDefeated:state.bossDefeated,bossEnraged:state.bossEnraged,bossCounterCount:state.bossCounterCount,bossAttackCount:state.bossAttackCount,nearMissUsed:state.nearMissUsed,nearMissCount:state.nearMissCount,replayGoal:state.replayGoal,plateHealthFinal:Math.round(state.plateHealth),lastSaveUsed:state.lastSaveUsed,lastSaveSuccess:state.lastSaveSuccess,durationPlayedSec:Math.round(elapsedSec())};
    SAFE_STORE.set('HHA_LAST_SUMMARY',safeJsonStringify(summary)); SAFE_STORE.set('HHA_LAST_SUMMARY_plate_solo',safeJsonStringify(summary)); SAFE_STORE.set(dailyKey(),safeJsonStringify(summary)); postLog('session_end',summary); flushLogs(true);
  }

  function preserveParams(url,keys){ keys.forEach(k=>{ const v=qs(k,''); if(v!==null&&v!==undefined&&String(v)!=='')url.searchParams.set(k,v); }); }
  function canonicalHubUrl(){ return qs('hub','') || 'https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html'; }
  function buildNutritionZoneUrl(fromTag){ const u=new URL('https://supparang.github.io/webxr-health-mobile/herohealth/nutrition-zone.html',location.href); preserveParams(u,['pid','name','nick','diff','time','view','run','seed','studyId','conditionGroup','section','session_code','log','api']); u.searchParams.set('pid',qs('pid','anon')); const nm=qs('name',qs('nick','')); if(nm)u.searchParams.set('name',nm); u.searchParams.set('diff',qs('diff','normal')); u.searchParams.set('time',qs('time','120')); u.searchParams.set('view',qs('view','mobile')); u.searchParams.set('run',qs('run','play')); u.searchParams.set('zone','nutrition'); u.searchParams.set('from',fromTag||'plate-solo'); u.searchParams.set('hub',canonicalHubUrl()); return u; }
  function goBack(){ flushLogs(true); location.href=buildNutritionZoneUrl('plate-solo').toString(); }
  function goCooldown(){ flushLogs(true); const gate=new URL('https://supparang.github.io/webxr-health-mobile/herohealth/warmup-gate.html',location.href), zoneUrl=buildNutritionZoneUrl('plate-solo-cooldown'); preserveParams(gate,['pid','name','nick','diff','time','view','run','seed','studyId','conditionGroup','section','session_code','log','api']); gate.searchParams.set('pid',qs('pid','anon')); const nm=qs('name',qs('nick','')); if(nm)gate.searchParams.set('name',nm); gate.searchParams.set('diff',qs('diff','normal')); gate.searchParams.set('time',qs('time','120')); gate.searchParams.set('view',qs('view','mobile')); gate.searchParams.set('run',qs('run','play')); gate.searchParams.set('phase','cooldown'); gate.searchParams.set('zone','nutrition'); gate.searchParams.set('game','plate'); gate.searchParams.set('gameId','plate'); gate.searchParams.set('mode','solo'); gate.searchParams.set('entry','plate-solo'); gate.searchParams.set('from','plate-solo-summary'); gate.searchParams.set('hub',zoneUrl.toString()); gate.searchParams.set('next',zoneUrl.toString()); location.href=gate.toString(); }

  function postLog(eventType,extra={}){ const endpoint=HHA.logEndpoint; if(!endpoint||state.apiDisabled)return; state.eventQueue.push({table:eventType==='session_end'?'sessions':'events',eventType,projectTag:HHA.projectTag,gameId:HHA.gameId,zone:HHA.zone,mode:HHA.mode,version:VERSION,sessionId:state.sessionId,pid:HHA.pid,name:HHA.name,diff:DIFF,view:VIEW,runMode:HHA.runMode,timestampIso:new Date().toISOString(),timestampBangkok:bangkokIso(),pageUrl:location.href,userAgent:navigator.userAgent,extra}); state.eventQueue=state.eventQueue.slice(-50); if(eventType==='session_end'||eventType==='session_start'||now()-state.lastFlushAt>5000)flushLogs(eventType==='session_end'); }
  function flushLogs(force=false){ const endpoint=HHA.logEndpoint; if(!endpoint||state.apiDisabled||!state.eventQueue.length)return; state.lastFlushAt=now(); const batch=state.eventQueue.splice(0,force?state.eventQueue.length:Math.min(8,state.eventQueue.length)); const body=safeJsonStringify({table:'events',source:'plate-solo',batch:true,count:batch.length,events:batch}); try{ if(navigator.sendBeacon&&force){ const ok=navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'})); if(!ok)state.eventQueue.unshift(...batch); return; } fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:!!force}).then(res=>{ if(res.status===401||res.status===403){state.apiDisabled=true;try{sessionStorage.setItem('HHA_API_DISABLED',String(Date.now()));}catch(e){}} if(!res.ok&&!force)state.eventQueue.unshift(...batch); }).catch(()=>{if(!force)state.eventQueue.unshift(...batch);}); }catch(e){ if(!force)state.eventQueue.unshift(...batch); } }

  function setupAimMode(){ const on=isAimMode(); if(els.aimReticle)els.aimReticle.classList.toggle('hidden',!on); if(els.btnAim)els.btnAim.classList.toggle('hidden',!on); if(on)logLine('โหมด Cardboard/cVR: เล็งกลางจอแล้วกดเลือกเป้า'); }
  function updateAimTarget(){ if(!isAimMode()||!state.running||state.paused||state.ended||!els.arena)return; const r0=els.arena.getBoundingClientRect(), cx=r0.left+r0.width/2, cy=r0.top+r0.height/2; let bestId=null,bestD=Infinity; for(const [id,obj] of state.active.entries()){ const r=obj.el.getBoundingClientRect(), d=Math.hypot(r.left+r.width/2-cx,r.top+r.height/2-cy); if(d<bestD){bestD=d;bestId=id;} } const range=screenMode()==='small'?285:250; for(const [id,obj] of state.active.entries())obj.el.classList.toggle('aimLock',id===bestId&&bestD<range); state.lastAimTarget=bestD<range?bestId:null; }
  function selectAimTarget(){ if(!isAimMode())return; updateAimTarget(); if(state.lastAimTarget&&state.active.has(state.lastAimTarget)){state.aimPicks++;pickFood(state.lastAimTarget);} else {feedback('🎯 เล็งอาหารให้ตรงกลางก่อน','bad');sfx('bad');} }
  function bind(){ resolvePlateEls(); if(els.btnStart&&!els.btnStart.__plateBound){els.btnStart.__plateBound=true;els.btnStart.addEventListener('click',startGame);} if(els.btnSkipPractice&&!els.btnSkipPractice.__plateBound){els.btnSkipPractice.__plateBound=true;els.btnSkipPractice.addEventListener('click',()=>{if(state.practiceActive)finishPractice(true);});} if(els.btnPause&&!els.btnPause.__plateBound){els.btnPause.__plateBound=true;els.btnPause.addEventListener('click',()=>togglePause(false));} if(els.btnHint&&!els.btnHint.__plateBound){els.btnHint.__plateBound=true;els.btnHint.addEventListener('click',()=>showHint(true));} if(els.btnSkill&&!els.btnSkill.__plateBound){els.btnSkill.__plateBound=true;els.btnSkill.addEventListener('click',rescueSkill);} if(els.btnAim&&!els.btnAim.__plateBound){els.btnAim.__plateBound=true;els.btnAim.addEventListener('click',selectAimTarget);} if(els.btnBack&&!els.btnBack.__plateBound){els.btnBack.__plateBound=true;els.btnBack.addEventListener('click',goBack);} if(els.btnReplay&&!els.btnReplay.__plateBound){els.btnReplay.__plateBound=true;els.btnReplay.addEventListener('click',()=>location.reload());} if(els.btnCooldown&&!els.btnCooldown.__plateBound){els.btnCooldown.__plateBound=true;els.btnCooldown.addEventListener('click',goCooldown);} if(els.btnSummaryBack&&!els.btnSummaryBack.__plateBound){els.btnSummaryBack.__plateBound=true;els.btnSummaryBack.addEventListener('click',goBack);} if(els.arena&&!els.arena.__plateAimBound){els.arena.__plateAimBound=true;els.arena.addEventListener('pointerdown',ev=>{if(!isAimMode())return;if(ev.target.closest('.foodCard'))return;ev.preventDefault();selectAimTarget();},{passive:false});} if(!DOC.__plateVisibilityBound){DOC.__plateVisibilityBound=true;DOC.addEventListener('visibilitychange',()=>{if(DOC.hidden&&state.running&&!state.paused)togglePause(true);});} }

  function init(){ installStyles(); resolvePlateEls(); hideSummaryOverlay(); state.ended=false; state.running=false; setGameplayViewportVars(); if(els.app)els.app.classList.add('emoji-only-mode','v41-immersive-ready'); try{ const disabledAt=Number(sessionStorage.getItem('HHA_API_DISABLED')||'0'); if(disabledAt&&Date.now()-disabledAt<15*60*1000)state.apiDisabled=true; }catch(e){} renderMeters(); state.missions=chooseMissions(); state.dailyChallenge=chooseDailyChallenge(); state.bestBefore=loadBest(); state.unlockedBadges=loadBadgeSet(); renderDailyBox(); renderGoalLock(); setupAimMode(); renderMissions(); updateAll(); bind(); logLine('พร้อมแล้ว: วันนี้มี Daily Challenge และดาวให้ลุ้น!'); }

  WIN.addEventListener('pagehide',()=>flushLogs(true));
  WIN.addEventListener('beforeunload',()=>flushLogs(true));
  init();
})();
