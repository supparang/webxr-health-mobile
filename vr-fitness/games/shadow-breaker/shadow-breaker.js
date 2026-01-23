// === vr-fitness/games/shadow-breaker/shadow-breaker.js ===
// Shadow Breaker — PRODUCTION v1.1.0
// ✅ HeroHealth-like: supports hha:shoot (crosshair/tap-to-shoot via vr-ui.js)
// ✅ Events: hha:start / hha:time / hha:score / hha:coach / hha:end / hha:flush
// ✅ Boss HUD bar + boss queue (4 bosses) + boss-final style when near death
// ✅ Safe spawn (respects CSS --safe-top + boss/HUD)
// ✅ Local sessions log + CSV download (apps script paused)
// ✅ Pass-through: hub/view/seed/research/studyId/log/phase/mode/diff/time

(() => {
  'use strict';

  // -----------------------------
  // IDs / version / storage keys
  // -----------------------------
  const SB_GAME_ID = 'shadow-breaker';
  const SB_GAME_VERSION = '1.1.0-prod';

  const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
  const SB_META_KEY    = 'ShadowBreakerMeta_v1';

  // Optional (HHA-style local last summary)
  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  // -----------------------------
  // Query helpers
  // -----------------------------
  function qs(k, d=null){
    try{ return new URL(location.href).searchParams.get(k) ?? d; }
    catch{ return d; }
  }

  const sbPhase = (qs('phase','train')||'train').toLowerCase();
  const sbMode  = (qs('mode','timed')||'timed').toLowerCase();   // timed | endless
  const sbDiff  = (qs('diff','normal')||'normal').toLowerCase(); // easy | normal | hard

  const sbTimeSec = (()=> {
    const t = parseInt(qs('time','60'), 10);
    return (Number.isFinite(t) && t >= 20 && t <= 300) ? t : 60;
  })();

  const SB_SEED = (qs('seed','')||'').trim(); // reserved for later seeded RNG expansion

  const SB_IS_RESEARCH = (()=> {
    const r = (qs('research','')||'').toLowerCase();
    return r==='1' || r==='true' || r==='on' || !!qs('studyId','') || !!qs('log','');
  })();

  // -----------------------------
  // DOM helpers
  // -----------------------------
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const sbGameArea   = $('#gameArea') || $('#playArea') || $('#sbPlayArea');
  const sbFeedbackEl = $('#feedback') || $('#sbFeedback');

  const sbStartBtn   = $('#startBtn') || $('#playBtn') || $('#playButton') || $('#sbStartBtn');
  const sbStartLabel = $('#startLabel');

  const sbLangButtons = $$('.lang-toggle button, .lang-toggle .lang-btn');

  const sbMetaInputs = {
    studentId:  $('#studentId'),
    schoolName: $('#schoolName'),
    classRoom:  $('#classRoom'),
    groupCode:  $('#groupCode'),
    deviceType: $('#deviceType'),
    note:       $('#note'),
  };

  const sbHUD = {
    timeVal:   $('#timeVal')   || $('#hudTime'),
    scoreVal:  $('#scoreVal')  || $('#hudScore'),
    hitVal:    $('#hitVal')    || $('#hudHit'),
    missVal:   $('#missVal')   || $('#hudMiss'),
    comboVal:  $('#comboVal')  || $('#hudCombo'),
    coachLine: $('#coachLine') || $('#hudCoach'),
  };

  const sbOverlay = $('#resultOverlay') || $('#resultCard') || $('#resultPanel') || null;

  const sbR = {
    score:    $('#rScore')    || $('#resScore'),
    hit:      $('#rHit')      || $('#resHit'),
    perfect:  $('#rPerfect')  || $('#resPerfect'),
    good:     $('#rGood')     || $('#resGood'),
    miss:     $('#rMiss')     || $('#resMiss'),
    acc:      $('#rAcc')      || $('#resAcc'),
    combo:    $('#rCombo')    || $('#resCombo'),
    timeUsed: $('#rTimeUsed') || $('#resTimeUsed'),
  };

  const sbPlayAgainBtn   = $('#playAgainBtn') || $('#resPlayAgainBtn') || $('#resReplayBtn');
  const sbBackHubBtn     = $('#backHubBtn') || $('#resBackHubBtn') || $('#resMenuBtn');
  const sbDownloadCsvBtn = $('#downloadCsvBtn') || $('#resDownloadCsvBtn');

  // -----------------------------
  // Core utils
  // -----------------------------
  function sbEmit(name, detail = {}){
    try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function clamp(n,a,b){
    n = +n;
    if(!Number.isFinite(n)) return a;
    return Math.max(a, Math.min(b, n));
  }
  function nowMs(){ return performance.now(); }

  // -----------------------------
  // Device detect
  // -----------------------------
  function sbDetectDevice(){
    const ua = navigator.userAgent || '';
    if (/Quest|Oculus|Vive|VR|Pico/i.test(ua)) return 'vrHeadset';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
    return 'pc';
  }

  // -----------------------------
  // Difficulty config
  // -----------------------------
  const sbDiffCfg = {
    easy:   { spawnMs: 920, bossHp: 6,  lifeMs: 2400, bossLifeMs: 7000 },
    normal: { spawnMs: 700, bossHp: 9,  lifeMs: 2300, bossLifeMs: 6500 },
    hard:   { spawnMs: 540, bossHp: 12, lifeMs: 2150, bossLifeMs: 6000 },
  };
  const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

  // -----------------------------
  // Emojis / bosses
  // -----------------------------
  const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];

  const SB_BOSSES = [
    { id: 1, emoji:'💧', nameTh:'Bubble Glove',  nameEn:'Bubble Glove',  hpBonus:0 },
    { id: 2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
    { id: 3, emoji:'🥊', nameTh:'Iron Fist',     nameEn:'Iron Fist',     hpBonus:4 },
    { id: 4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
  ];

  // -----------------------------
  // i18n
  // -----------------------------
  const sbI18n = {
    th: {
      startLabel: 'เริ่มเล่น',
      coachReady: 'โค้ชพุ่ง: เล็งกลางจอแล้วแตะ/ยิงให้โดน! 👊',
      coachGood:  'สวยมาก! ต่อคอมโบยาว ๆ ✨',
      coachMiss:  'พลาดนิดเดียว ไม่เป็นไร 💪',
      coachFever: 'FEVER!! ทุบให้สุด!! 🔥',
      tagGoal:    'เป้าหมาย: ต่อย/ยิงเป้า emoji ให้ทันเวลา รักษาคอมโบ และพิชิตบอสทั้ง 4 ตัว.',
      alertMeta:  'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
      feverLabel: 'FEVER!!',
      bossNear:   (name)=>`ใกล้ล้ม ${name} แล้ว! เร่งอีกนิด! ⚡`,
      bossClear:  (name)=>`พิชิต ${name} แล้ว! บอสถัดไปมา! 🔥`,
      bossAppear: (name)=>`${name} ปรากฏตัวแล้ว!`,
      paused:     'พักเกมชั่วคราว',
      resumed:    'กลับมาเล่นต่อ!',
    },
    en: {
      startLabel: 'Start',
      coachReady: 'Aim center and tap/shoot targets! 👊',
      coachGood:  'Nice! Keep the combo! ✨',
      coachMiss:  'Missed a bit. Try again! 💪',
      coachFever: 'FEVER!! Smash!! 🔥',
      tagGoal:    'Goal: hit emoji targets quickly, keep combo, defeat all bosses.',
      alertMeta:  'Please fill at least the Student ID before starting.',
      feverLabel: 'FEVER!!',
      bossNear:   (name)=>`Almost defeat ${name}! Finish it! ⚡`,
      bossClear:  (name)=>`You beat ${name}! Next boss! 🔥`,
      bossAppear: (name)=>`${name} appeared!`,
      paused:     'Paused',
      resumed:    'Resumed!',
    }
  };

  let sbLang = 'th';

  function sbApplyLang(){
    const t = sbI18n[sbLang] || sbI18n.th;
    if(sbStartLabel) sbStartLabel.textContent = t.startLabel;
    const tg = $('#tagGoal'); if(tg) tg.textContent = t.tagGoal;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;
  }

  // -----------------------------
  // Feedback popup (CSS expects .feedback.good/.miss/.perfect/.fever + .show)
  // -----------------------------
  function sbShowFeedback(type){
    if(!sbFeedbackEl) return;
    const t = sbI18n[sbLang] || sbI18n.th;

    let txt = '';
    if(type==='fever')   txt = t.feverLabel;
    else if(type==='perfect') txt = (sbLang==='th' ? 'Perfect! 💥' : 'PERFECT!');
    else if(type==='good')    txt = (sbLang==='th' ? 'ดีมาก! ✨' : 'GOOD!');
    else txt = (sbLang==='th' ? 'พลาด!' : 'MISS');

    sbFeedbackEl.textContent = txt;

    // include BOTH styles to be extra-safe with older css
    sbFeedbackEl.className = `feedback ${type} feedback-${type}`;

    sbFeedbackEl.style.display = 'block';
    sbFeedbackEl.classList.add('show');

    const dur = (type==='fever') ? 800 : 420;
    setTimeout(() => {
      if(!sbFeedbackEl) return;
      sbFeedbackEl.classList.remove('show');
      setTimeout(() => { if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 140);
    }, dur);
  }

  // -----------------------------
  // Boss HUD bar
  // -----------------------------
  let sbBossHud = null;
  function sbEnsureBossHud(){
    if(!sbGameArea) return null;
    if(sbBossHud) return sbBossHud;

    const box = document.createElement('div');
    box.className = 'boss-barbox';
    box.innerHTML = `
      <div class="boss-face" id="sbBossFace">🐲</div>
      <div style="flex:1; min-width:0;">
        <div class="boss-name" id="sbBossName">Boss</div>
        <div class="boss-bar"><div class="boss-bar-fill" id="sbBossFill"></div></div>
      </div>
    `;
    document.body.appendChild(box); // fixed overlay layer

    sbBossHud = {
      box,
      face: box.querySelector('#sbBossFace'),
      name: box.querySelector('#sbBossName'),
      fill: box.querySelector('#sbBossFill')
    };
    return sbBossHud;
  }

  function sbSetBossHudVisible(v){
    const hud = sbEnsureBossHud();
    if(!hud) return;
    hud.box.style.display = v ? 'flex' : 'none';
  }

  function sbUpdateBossHud(){
    const hud = sbEnsureBossHud();
    if(!hud || !sbState.activeBoss || !sbState.activeBossInfo) return;

    const info = sbState.activeBossInfo;
    hud.face.textContent = info.emoji;
    hud.name.textContent = (sbLang==='th' ? info.nameTh : info.nameEn);

    const curHp = clamp(sbState.activeBoss.hp, 0, sbState.activeBoss.maxHp);
    const ratio = sbState.activeBoss.maxHp > 0 ? (curHp / sbState.activeBoss.maxHp) : 0;
    hud.fill.style.transform = `scaleX(${ratio})`;
  }

  // -----------------------------
  // Safe-top from CSS var --safe-top (fallback to 118px)
  // -----------------------------
  function sbGetSafeTopPx(){
    try{
      const v = getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim();
      const n = parseFloat(v);
      if(Number.isFinite(n)) return Math.max(64, n);
    }catch(_){}
    return 118;
  }

  // -----------------------------
  // Game state
  // -----------------------------
  const sbState = {
    running:false,
    paused:false,

    startTime:0,
    pauseAt:0,
    elapsedMs:0,
    durationMs: (sbMode==='endless') ? Infinity : sbTimeSec * 1000,

    spawnTimer:null,
    targets:[],

    score:0,
    hit:0,
    perfect:0,
    good:0,
    miss:0,
    combo:0,
    maxCombo:0,

    fever:false,
    feverUntil:0,

    sessionMeta:null,

    bossQueue:[],
    bossActive:false,
    bossWarned:false,
    activeBoss:null,
    activeBossInfo:null,
  };

  let sbTargetIdCounter = 1;
  let sbLastTimeTick = -1;

  // -----------------------------
  // Meta persistence
  // -----------------------------
  function sbLoadMeta(){
    try{
      const raw = localStorage.getItem(SB_META_KEY);
      if(!raw) return;
      const meta = JSON.parse(raw);
      Object.entries(sbMetaInputs).forEach(([k,el])=>{
        if(el && meta && meta[k]) el.value = meta[k];
      });
    }catch(_){}
  }

  function sbSaveMetaDraft(){
    const meta = {};
    Object.entries(sbMetaInputs).forEach(([k,el])=>{
      meta[k] = el ? (el.value || '').trim() : '';
    });
    try{ localStorage.setItem(SB_META_KEY, JSON.stringify(meta)); }catch(_){}
  }

  // -----------------------------
  // Reset / HUD
  // -----------------------------
  function sbResetStats(){
    sbState.score=0; sbState.hit=0; sbState.perfect=0; sbState.good=0; sbState.miss=0;
    sbState.combo=0; sbState.maxCombo=0;
    sbState.elapsedMs=0;

    sbState.fever=false; sbState.feverUntil=0;

    sbState.targets=[];
    sbState.bossQueue=[]; sbState.bossActive=false; sbState.bossWarned=false;
    sbState.activeBoss=null; sbState.activeBossInfo=null;

    if(sbHUD.scoreVal) sbHUD.scoreVal.textContent='0';
    if(sbHUD.hitVal) sbHUD.hitVal.textContent='0';
    if(sbHUD.missVal) sbHUD.missVal.textContent='0';
    if(sbHUD.comboVal) sbHUD.comboVal.textContent='x0';
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));

    if(sbGameArea){
      sbGameArea.querySelectorAll('.sb-target').forEach(el=>el.remove());
      sbGameArea.classList.remove('fever');
    }
    sbSetBossHudVisible(false);
  }

  function sbUpdateHUD(){
    if(sbHUD.scoreVal) sbHUD.scoreVal.textContent=String(sbState.score);
    if(sbHUD.hitVal) sbHUD.hitVal.textContent=String(sbState.hit);
    if(sbHUD.missVal) sbHUD.missVal.textContent=String(sbState.miss);
    if(sbHUD.comboVal) sbHUD.comboVal.textContent='x'+sbState.combo;
  }

  // -----------------------------
  // Boss queue scheduling
  // -----------------------------
  function sbPrepareBossQueue(){
    const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000; // endless schedule within first 2 minutes
    const checkpoints = [0.15,0.35,0.60,0.85].map(r=>Math.round(ms*r));
    sbState.bossQueue = SB_BOSSES.map((b,idx)=>({
      bossIndex: idx,
      spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15))
    }));
  }

  // -----------------------------
  // Spawn position (safe)
  // -----------------------------
  function sbPickSpawnXY(sizePx){
    if(!sbGameArea) return { x: 20, y: 20 };

    const rect = sbGameArea.getBoundingClientRect();
    const pad = 16;

    // Use CSS safe-top if possible (prevents spawning behind HUD/boss bar)
    const safeTop = Math.max(64, sbGetSafeTopPx() - 10);

    const maxX = Math.max(0, rect.width  - sizePx - pad*2);
    const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop);

    const x = pad + Math.random() * maxX;
    const y = pad + safeTop + Math.random() * maxY;
    return { x, y };
  }

  // -----------------------------
  // Spawn target
  // -----------------------------
  function sbSpawnTarget(isBoss=false, bossInfo=null){
    if(!sbGameArea) return;

    const sizeBase = isBoss ? 92 : 56;
    const baseHp = isBoss ? (sbCfg.bossHp + (bossInfo?.hpBonus||0)) : 1;

    const tObj = {
      id: sbTargetIdCounter++,
      boss: !!isBoss,
      bossInfo: bossInfo || null,
      hp: baseHp,
      maxHp: baseHp,
      createdAt: nowMs(),
      el: null,
      alive: true,
      missTimer: null
    };

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(tObj.id);
    el.style.width  = sizeBase + 'px';
    el.style.height = sizeBase + 'px';
    el.style.display='flex';
    el.style.alignItems='center';
    el.style.justifyContent='center';
    el.style.fontSize = isBoss ? '2.1rem' : '1.7rem';

    if(isBoss && bossInfo){
      el.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
      el.textContent = bossInfo.emoji;
    }else{
      const emo = SB_NORMAL_EMOJIS[Math.floor(Math.random()*SB_NORMAL_EMOJIS.length)];
      el.style.background = sbState.fever
        ? 'radial-gradient(circle at 30% 20%, #facc15, #eab308)'
        : 'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
      el.textContent = emo;
    }

    const pos = sbPickSpawnXY(sizeBase);
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';

    el.addEventListener('click', ()=> sbHitTarget(tObj));

    sbGameArea.appendChild(el);
    tObj.el = el;
    sbState.targets.push(tObj);

    // Boss enter
    if(isBoss && bossInfo){
      sbState.bossActive = true;
      sbState.bossWarned = false;
      sbState.activeBoss = tObj;
      sbState.activeBossInfo = bossInfo;

      sbSetBossHudVisible(true);
      sbUpdateBossHud();

      const name = (sbLang==='th' ? bossInfo.nameTh : bossInfo.nameEn);
      sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossAppear(name), boss: bossInfo.id });
    }

    // Life timer -> miss
    const lifeMs = isBoss ? sbCfg.bossLifeMs : sbCfg.lifeMs;
    tObj.missTimer = setTimeout(() => {
      if(!tObj.alive) return;
      tObj.alive = false;
      try{ tObj.el && tObj.el.remove(); }catch(_){}

      sbState.miss++;
      sbState.combo = 0;
      sbUpdateHUD();
      sbShowFeedback('miss');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachMiss;

      // Boss timeout -> clear boss state
      if(tObj.boss){
        sbState.bossActive=false;
        sbState.activeBoss=null;
        sbState.activeBossInfo=null;
        sbSetBossHudVisible(false);
      }

      sbEmit('hha:score', { score: sbState.score, gained: 0, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss: !!tObj.boss, reason:'timeout' });
    }, lifeMs);

    // Pop-in animation
    if(el.animate){
      el.animate(
        [{ transform:'scale(0.7)', opacity:0 }, { transform:'scale(1)', opacity:1 }],
        { duration: isBoss ? 220 : 160, easing:'ease-out' }
      );
    }
  }

  function sbMaybeSpawnBoss(){
    if(!sbState.running || sbState.paused) return;
    if(sbState.bossActive) return;
    if(!sbState.bossQueue.length) return;

    const next = sbState.bossQueue[0];
    if(sbState.elapsedMs >= next.spawnAtMs){
      sbState.bossQueue.shift();
      const bossInfo = SB_BOSSES[next.bossIndex];
      sbSpawnTarget(true, bossInfo);
    }
  }

  function sbSpawnNextBossImmediate(){
    if(!sbState.bossQueue.length) return;
    const next = sbState.bossQueue.shift();
    const bossInfo = SB_BOSSES[next.bossIndex];
    sbSpawnTarget(true, bossInfo);
  }

  // -----------------------------
  // Fever mode
  // -----------------------------
  function sbEnterFever(){
    sbState.fever = true;
    sbState.feverUntil = nowMs() + 3500;

    if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachFever;
    if(sbGameArea) sbGameArea.classList.add('fever');

    sbShowFeedback('fever');
    sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).coachFever, fever:true });
  }

  function sbCheckFeverTick(t){
    if(sbState.fever && t >= sbState.feverUntil){
      sbState.fever=false;
      if(sbGameArea) sbGameArea.classList.remove('fever');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachReady;
    }
  }

  // -----------------------------
  // Hit logic
  // -----------------------------
  function sbHitTarget(tObj){
    if(!sbState.running || sbState.paused || !tObj.alive) return;

    // reduce hp
    tObj.hp -= 1;

    sbState.hit++;

    const isBoss = tObj.boss;
    const bossInfo = tObj.bossInfo;

    // Boss near death style
    if(isBoss && tObj.el){
      if(tObj.hp <= 2) tObj.el.classList.add('boss-final');
      else tObj.el.classList.remove('boss-final');
    }

    // Still alive -> Good hit
    if(tObj.hp > 0){
      sbState.good++;
      sbState.combo++;
      sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

      const base = isBoss ? 70 : 50;
      const comboBonus = Math.min(sbState.combo * 5, 60);
      const feverBonus = sbState.fever ? 30 : 0;
      const gained = base + comboBonus + feverBonus;
      sbState.score += gained;

      if(tObj.el && tObj.el.animate){
        tObj.el.animate(
          [{ transform:'scale(1)' }, { transform:'scale(1.08)' }, { transform:'scale(1)' }],
          { duration:140, easing:'ease-out' }
        );
      }

      sbUpdateHUD();
      sbShowFeedback('good');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachGood;

      if(isBoss){
        sbUpdateBossHud();
        if(!sbState.bossWarned && tObj.hp <= 2){
          sbState.bossWarned = true;
          const name = (sbLang==='th' ? bossInfo.nameTh : bossInfo.nameEn);
          sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossNear(name), boss: bossInfo.id });
        }
      }

      sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss: !!isBoss });
      return;
    }

    // Perfect kill (hp <= 0)
    tObj.alive = false;
    if(tObj.missTimer){ clearTimeout(tObj.missTimer); tObj.missTimer=null; }

    sbState.perfect++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    const base = isBoss ? 200 : 80;
    const comboBonus = Math.min(sbState.combo * 8, 100);
    const feverBonus = sbState.fever ? 80 : 0;
    const gained = base + comboBonus + feverBonus;
    sbState.score += gained;

    if(tObj.el && tObj.el.animate){
      const anim = tObj.el.animate(
        [{ transform:'scale(1)', opacity:1 }, { transform:'scale(0.1)', opacity:0 }],
        { duration:150, easing:'ease-in' }
      );
      anim.onfinish = () => { try{ tObj.el && tObj.el.remove(); }catch(_){ } };
    }else{
      try{ tObj.el && tObj.el.remove(); }catch(_){}
    }

    sbUpdateHUD();

    if(sbState.combo >= 5 && !sbState.fever) sbEnterFever();
    else sbShowFeedback('perfect');

    // Boss down
    if(isBoss){
      const name = (sbLang==='th' ? bossInfo.nameTh : bossInfo.nameEn);
      sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossClear(name), boss: bossInfo.id });

      sbState.bossActive=false;
      sbState.activeBoss=null;
      sbState.activeBossInfo=null;
      sbSetBossHudVisible(false);

      // Next boss immediately for "rush" feel (optional)
      sbSpawnNextBossImmediate();
    }

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss: !!isBoss });
  }

  // -----------------------------
  // Crosshair shoot support (vr-ui.js)
  // -----------------------------
  function sbHitNearestTargetAtScreenXY(x, y, lockPx=28){
    if(!sbState.running || sbState.paused || !sbGameArea) return false;
    x = Number(x); y = Number(y);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return false;

    let best=null, bestD2=Infinity;

    for(const tObj of sbState.targets){
      if(!tObj.alive || !tObj.el) continue;
      const r = tObj.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx = cx - x, dy = cy - y;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD2){
        bestD2 = d2;
        best = tObj;
      }
    }

    const lock = Math.max(10, Number(lockPx)||28);
    if(best && bestD2 <= lock*lock){
      sbHitTarget(best);
      return true;
    }
    return false;
  }

  window.addEventListener('hha:shoot', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    sbHitNearestTargetAtScreenXY(d.x, d.y, d.lockPx || 28);
  });

  // Keyboard: Space hits nearest at center (debug/PC fun)
  window.addEventListener('keydown', (ev)=>{
    if(!sbState.running || sbState.paused) return;
    if(ev.code === 'Space'){
      ev.preventDefault();
      if(!sbGameArea) return;
      const rect = sbGameArea.getBoundingClientRect();
      sbHitNearestTargetAtScreenXY(rect.left + rect.width/2, rect.top + rect.height/2, 90);
    }
  });

  // -----------------------------
  // Spawn loop
  // -----------------------------
  function sbStartSpawnLoop(){
    if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
    sbState.spawnTimer = setInterval(() => {
      if(!sbState.running || sbState.paused) return;

      // leave gaps sometimes
      if(Math.random() < 0.10) return;

      // reduce clutter during boss
      if(sbState.bossActive && Math.random() < 0.50) return;

      sbSpawnTarget(false, null);
    }, sbCfg.spawnMs);
  }

  function sbStopSpawnLoop(){
    if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
    sbState.spawnTimer = null;
  }

  // -----------------------------
  // Main loop
  // -----------------------------
  function sbMainLoop(t){
    if(!sbState.running) return;

    if(sbState.paused){
      requestAnimationFrame(sbMainLoop);
      return;
    }

    if(!sbState.startTime) sbState.startTime = t;
    sbState.elapsedMs = t - sbState.startTime;

    if(sbMode !== 'endless'){
      const remain = Math.max(0, Math.round((sbState.durationMs - sbState.elapsedMs)/1000));
      if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(remain);

      if(remain !== sbLastTimeTick){
        sbLastTimeTick = remain;
        sbEmit('hha:time', { remainSec: remain, elapsedMs: Math.round(sbState.elapsedMs) });
      }

      if(sbState.elapsedMs >= sbState.durationMs){
        sbEndGame('timeup');
        return;
      }
    }else{
      const sec = Math.floor(sbState.elapsedMs/1000);
      if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(sec);

      if(sec !== sbLastTimeTick){
        sbLastTimeTick = sec;
        sbEmit('hha:time', { elapsedSec: sec, elapsedMs: Math.round(sbState.elapsedMs) });
      }
    }

    sbCheckFeverTick(t);
    sbMaybeSpawnBoss();

    requestAnimationFrame(sbMainLoop);
  }

  // -----------------------------
  // Local logging (sessions + CSV)
  // -----------------------------
  function sbLogLocal(rec){
    try{
      const raw = localStorage.getItem(SB_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(rec);
      localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(arr));
    }catch(err){
      console.warn('[SB] local log failed:', err);
    }
  }

  function sbWriteHhaLastSummary(rec){
    try{
      const last = {
        gameId: SB_GAME_ID,
        gameVersion: SB_GAME_VERSION,
        at: Date.now(),
        summary: rec
      };
      localStorage.setItem(LS_LAST, JSON.stringify(last));

      const raw = localStorage.getItem(LS_HIST);
      const hist = raw ? JSON.parse(raw) : [];
      hist.unshift(last);
      while(hist.length > 50) hist.pop();
      localStorage.setItem(LS_HIST, JSON.stringify(hist));
    }catch(_){}
  }

  function sbDownloadCsv(){
    let rows=[];
    try{
      const raw = localStorage.getItem(SB_STORAGE_KEY);
      if(!raw){ alert('ยังไม่มีข้อมูล session'); return; }
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr) || !arr.length){ alert('ยังไม่มีข้อมูล session'); return; }

      const header=[
        'studentId','schoolName','classRoom','groupCode','deviceType','language','note',
        'phase','mode','diff','gameId','gameVersion','sessionId','timeSec',
        'score','hits','perfect','good','miss','accuracy','maxCombo','fever',
        'timeUsedSec','seed','research','reason','createdAt'
      ];
      rows.push(header.join(','));

      for(const rec of arr){
        const line = header.map(k=>{
          const v = rec[k] !== undefined ? String(rec[k]) : '';
          return `"${v.replace(/"/g,'""')}"`;
        }).join(',');
        rows.push(line);
      }
    }catch(err){
      console.error(err);
      alert('ไม่สามารถสร้าง CSV ได้');
      return;
    }

    const csv = rows.join('\r\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ShadowBreakerSessions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  // -----------------------------
  // End / Start game
  // -----------------------------
  function sbEndGame(reason='end'){
    if(!sbState.running) return;

    sbState.running = false;
    sbState.paused = false;

    sbStopSpawnLoop();

    // clear targets
    for(const tObj of sbState.targets){
      try{
        if(tObj.missTimer) clearTimeout(tObj.missTimer);
        if(tObj.el && tObj.el.remove) tObj.el.remove();
      }catch(_){}
    }
    sbState.targets = [];

    sbSetBossHudVisible(false);

    const playedSec = Math.round(sbState.elapsedMs/1000);
    const totalHit  = sbState.hit;
    const totalMiss = sbState.miss;
    const attempts  = totalHit + totalMiss;
    const acc = attempts > 0 ? Math.round((totalHit/attempts)*100) : 0;

    const rec = {
      studentId:  sbState.sessionMeta?.studentId || '',
      schoolName: sbState.sessionMeta?.schoolName || '',
      classRoom:  sbState.sessionMeta?.classRoom || '',
      groupCode:  sbState.sessionMeta?.groupCode || '',
      deviceType: sbState.sessionMeta?.deviceType || sbDetectDevice(),
      language:   sbLang,
      note:       sbState.sessionMeta?.note || '',

      phase:      sbPhase,
      mode:       sbMode,
      diff:       sbDiff,

      gameId:     SB_GAME_ID,
      gameVersion:SB_GAME_VERSION,
      sessionId:  String(Date.now()),
      timeSec:    (sbMode==='endless') ? playedSec : sbTimeSec,

      score:      sbState.score,
      hits:       totalHit,
      perfect:    sbState.perfect,
      good:       sbState.good,
      miss:       sbState.miss,
      accuracy:   acc,
      maxCombo:   sbState.maxCombo,
      fever:      sbState.fever ? 1 : 0,
      timeUsedSec: playedSec,

      seed:       SB_SEED,
      research:   SB_IS_RESEARCH ? 1 : 0,
      reason,
      createdAt:  new Date().toISOString(),
    };

    sbLogLocal(rec);
    sbWriteHhaLastSummary(rec);

    // fill overlay
    if(sbR.score) sbR.score.textContent = String(sbState.score);
    if(sbR.hit) sbR.hit.textContent = String(totalHit);
    if(sbR.perfect) sbR.perfect.textContent = String(sbState.perfect);
    if(sbR.good) sbR.good.textContent = String(sbState.good);
    if(sbR.miss) sbR.miss.textContent = String(sbState.miss);
    if(sbR.acc) sbR.acc.textContent = acc + '%';
    if(sbR.combo) sbR.combo.textContent = 'x' + sbState.maxCombo;
    if(sbR.timeUsed) sbR.timeUsed.textContent = playedSec + 's';

    if(sbOverlay) sbOverlay.classList.remove('hidden');

    // Events
    sbEmit('hha:end', rec);
    sbEmit('hha:flush', { reason: 'end' });

    // allow restart
    if(sbStartBtn){
      sbStartBtn.disabled = false;
      sbStartBtn.style.opacity = 1;
    }
  }

  function sbStartGame(){
    if(sbState.running) return;

    const t = sbI18n[sbLang] || sbI18n.th;

    // meta requirement only in research
    const sid = sbMetaInputs.studentId ? (sbMetaInputs.studentId.value||'').trim() : '';
    if(SB_IS_RESEARCH && !sid){
      alert(t.alertMeta);
      return;
    }

    const meta = {
      studentId: sid || '',
      schoolName: sbMetaInputs.schoolName ? (sbMetaInputs.schoolName.value||'').trim() : '',
      classRoom:  sbMetaInputs.classRoom  ? (sbMetaInputs.classRoom.value||'').trim() : '',
      groupCode:  sbMetaInputs.groupCode  ? (sbMetaInputs.groupCode.value||'').trim() : '',
      deviceType:
        (sbMetaInputs.deviceType && sbMetaInputs.deviceType.value === 'auto')
          ? sbDetectDevice()
          : (sbMetaInputs.deviceType ? sbMetaInputs.deviceType.value : sbDetectDevice()),
      note: sbMetaInputs.note ? (sbMetaInputs.note.value||'').trim() : ''
    };

    sbState.sessionMeta = meta;
    sbSaveMetaDraft();

    document.body.classList.add('play-only');

    sbResetStats();
    sbPrepareBossQueue();

    sbState.running = true;
    sbState.paused  = false;
    sbState.startTime = 0;
    sbLastTimeTick = -1;

    if(sbStartBtn){
      sbStartBtn.disabled = true;
      sbStartBtn.style.opacity = 0.75;
    }
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

    // Events
    sbEmit('hha:start', {
      gameId: SB_GAME_ID,
      gameVersion: SB_GAME_VERSION,
      phase: sbPhase,
      mode: sbMode,
      diff: sbDiff,
      timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
      seed: SB_SEED,
      research: SB_IS_RESEARCH ? 1 : 0
    });

    // small delay for UX
    setTimeout(() => {
      sbStartSpawnLoop();
      requestAnimationFrame(sbMainLoop);
    }, 420);
  }

  // -----------------------------
  // Pause/resume (hub message)
  // -----------------------------
  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if(d.type !== 'hub:pause') return;
    if(!sbState.running) return;

    const v = !!d.value;

    if(v && !sbState.paused){
      sbState.paused = true;
      sbState.pauseAt = nowMs();
      sbStopSpawnLoop();
      sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).paused });
    }else if(!v && sbState.paused){
      sbState.paused = false;

      // keep elapsed stable
      if(sbState.startTime && sbState.pauseAt){
        const pausedDur = nowMs() - sbState.pauseAt;
        sbState.startTime += pausedDur;
      }
      sbStartSpawnLoop();
      sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).resumed });
    }
  });

  // -----------------------------
  // Buttons
  // -----------------------------
  if(sbStartBtn) sbStartBtn.addEventListener('click', sbStartGame);

  if(sbPlayAgainBtn){
    sbPlayAgainBtn.addEventListener('click', () => {
      if(sbOverlay) sbOverlay.classList.add('hidden');
      if(sbStartBtn){ sbStartBtn.disabled = false; sbStartBtn.style.opacity = 1; }
      sbStartGame();
    });
  }

  if(sbBackHubBtn){
    sbBackHubBtn.addEventListener('click', () => {
      const hub = (qs('hub','')||'').trim();
      location.href = hub || '../hub.html';
    });
  }

  if(sbDownloadCsvBtn){
    sbDownloadCsvBtn.addEventListener('click', sbDownloadCsv);
  }

  // meta persistence
  Object.values(sbMetaInputs).forEach(el=>{
    if(!el) return;
    el.addEventListener('change', sbSaveMetaDraft);
    el.addEventListener('blur', sbSaveMetaDraft);
  });

  // lang toggle
  sbLangButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sbLangButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sbLang = (btn.dataset.lang || 'th').toLowerCase();
      sbApplyLang();
    });
  });

  // -----------------------------
  // Init
  // -----------------------------
  sbLoadMeta();
  sbApplyLang();

  // initial HUD time
  if(sbHUD.timeVal){
    sbHUD.timeVal.textContent = (sbMode==='endless') ? '0' : String(sbTimeSec);
  }

})();