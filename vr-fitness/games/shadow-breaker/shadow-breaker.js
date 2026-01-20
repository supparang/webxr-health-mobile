// === VR Fitness — Shadow Breaker (Production v1.0.3-prod) ===
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:end / hha:flush
// ✅ flush-hardened ?log= cloud logger (offline queue)
// ✅ save last summary + backHub from ?hub=
// ✅ NEW: ctx passthrough (studyId/conditionGroup/ts/run/style/view/etc.) + hub return keep ctx + playUrl saved

(() => {
  'use strict';

  const SB_GAME_ID = 'shadow-breaker';
  const SB_GAME_VERSION = '1.0.3-prod';

  // local sessions + meta
  const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
  const SB_META_KEY    = 'ShadowBreakerMeta_v1';

  // last summary (HeroHealth-like)
  const VFA_LAST_SUMMARY_KEY = 'VFA_LAST_SUMMARY_V1';
  const HHA_LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';

  // cloud logger queue
  const VFA_LOG_QUEUE_KEY = 'VFA_LOG_QUEUE_V1';

  function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }
  function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
  function emit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }

  // -------- ctx passthrough --------
  const PASS_KEYS = [
    'hub','run','diff','time','seed','studyId','phase','conditionGroup','ts','log','style','view','research'
  ];

  function readCtxFromUrl(){
    const out = {};
    let sp;
    try{ sp = new URL(location.href).searchParams; }catch{ return out; }
    for(const k of PASS_KEYS){
      const v = sp.get(k);
      if(v !== null && String(v).trim() !== '') out[k] = String(v);
    }
    return out;
  }

  function buildUrlWithParams(baseUrl, params={}, overrides={}){
    // baseUrl may already have query. Merge.
    let u;
    try{
      u = new URL(baseUrl, location.href);
    }catch(_){
      // fallback: relative
      u = new URL(String(baseUrl || ''), location.href);
    }
    const sp = u.searchParams;

    // merge params then overrides
    for(const [k,v] of Object.entries(params||{})){
      if(v === undefined || v === null || String(v).trim() === '') continue;
      sp.set(k, String(v));
    }
    for(const [k,v] of Object.entries(overrides||{})){
      if(v === undefined || v === null || String(v).trim() === '') { sp.delete(k); continue; }
      sp.set(k, String(v));
    }
    u.search = sp.toString();
    return u.toString();
  }

  const CTX = readCtxFromUrl();

  const sbPhase = (qs('phase','train')||'train').toLowerCase();
  const sbMode  = (qs('mode','timed')||'timed').toLowerCase();
  const sbDiff  = (qs('diff','normal')||'normal').toLowerCase();
  const sbTimeSec = (()=>{ const t=parseInt(qs('time','60'),10); return (Number.isFinite(t)&&t>=20&&t<=300)?t:60; })();

  const SB_SEED = (qs('seed','')||'').trim();
  const SB_HUB  = (qs('hub','')||'').trim();
  const SB_LOG_ENDPOINT = (qs('log','')||'').trim();

  const SB_IS_RESEARCH = (()=> {
    const r = (qs('research','')||'').toLowerCase();
    return r==='1' || r==='true' || r==='on' || !!qs('studyId','') || !!SB_LOG_ENDPOINT;
  })();

  // ---------- DOM ----------
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sbGameArea   = $('#gameArea') || $('#playArea') || $('#sbPlayArea');
  const sbFeedbackEl = $('#feedback') || $('#sbFeedback');

  const sbStartBtn =
    $('#startBtn') || $('#playBtn') || $('#playButton') || $('#sbStartBtn');

  const sbLangButtons = $$('.lang-toggle button');

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

  const sbPlayAgainBtn = $('#playAgainBtn') || $('#resPlayAgainBtn') || $('#resReplayBtn');
  const sbBackHubBtn   = $('#backHubBtn') || $('#resBackHubBtn') || $('#resMenuBtn');
  const sbDownloadCsvBtn = $('#downloadCsvBtn') || $('#resDownloadCsvBtn');

  // ---------- Device detect ----------
  function detectDevice() {
    const ua = navigator.userAgent || '';
    if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vrHeadset';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
    return 'pc';
  }

  // ---------- Config ----------
  const diffCfg = {
    easy:   { spawnMs: 900, bossHp: 6 },
    normal: { spawnMs: 700, bossHp: 9 },
    hard:   { spawnMs: 520, bossHp: 12 },
  };
  const cfg = diffCfg[sbDiff] || diffCfg.normal;

  // ---------- Boss & emojis ----------
  const NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];
  const BOSSES = [
    { id: 1, emoji:'💧', nameTh:'Bubble Glove',  nameEn:'Bubble Glove',  hpBonus:0 },
    { id: 2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
    { id: 3, emoji:'🥊', nameTh:'Iron Fist',     nameEn:'Iron Fist',     hpBonus:4 },
    { id: 4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
  ];

  // ---------- i18n ----------
  const I18n = {
    th: {
      startLabel:'เริ่มเล่น',
      coachReady:'โค้ชพุ่ง: เล็งกลางจอแล้วแตะ/ยิงให้โดน! 👊',
      coachGood:'สวยมาก! ต่อคอมโบยาว ๆ ✨',
      coachMiss:'พลาดนิดเดียว ไม่เป็นไร 💪',
      coachFever:'FEVER!! ทุบให้สุด!! 🔥',
      tagGoal:'เป้าหมาย: ต่อย/ยิงเป้า emoji ให้ทันเวลา รักษาคอมโบ และพิชิตบอสทั้ง 4 ตัว.',
      alertMeta:'กรุณากรอกอย่างน้อย Student ID ก่อนเริ่มเล่นนะครับ',
      feverLabel:'FEVER!!',
      bossNear:(name)=>`ใกล้ล้ม ${name} แล้ว! เร่งอีกนิด! ⚡`,
      bossClear:(name)=>`พิชิต ${name} แล้ว! บอสถัดไปมา! 🔥`,
      bossAppear:(name)=>`${name} ปรากฏตัวแล้ว!`,
    },
    en: {
      startLabel:'Start',
      coachReady:'Aim center and tap/shoot targets! 👊',
      coachGood:'Nice! Keep the combo! ✨',
      coachMiss:'Missed a bit. Try again! 💪',
      coachFever:'FEVER!! Smash!! 🔥',
      tagGoal:'Goal: hit emoji targets quickly, keep combo, defeat all bosses.',
      alertMeta:'Please fill at least the Student ID before starting.',
      feverLabel:'FEVER!!',
      bossNear:(name)=>`Almost defeat ${name}! Finish it! ⚡`,
      bossClear:(name)=>`You beat ${name}! Next boss! 🔥`,
      bossAppear:(name)=>`${name} appeared!`,
    }
  };
  let lang = 'th';

  // ---------- state ----------
  const S = {
    running:false,
    paused:false,
    startTime:0,
    pauseAt:0,
    elapsedMs:0,
    durationMs: sbMode==='endless' ? Infinity : sbTimeSec*1000,
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

  // ---------- meta persistence ----------
  function loadMeta(){
    try{
      const raw = localStorage.getItem(SB_META_KEY);
      if(!raw) return;
      const meta = JSON.parse(raw);
      Object.entries(sbMetaInputs).forEach(([k,el])=>{
        if(el && meta[k]) el.value = meta[k];
      });
    }catch(_){}
  }
  function saveMetaDraft(){
    const meta = {};
    Object.entries(sbMetaInputs).forEach(([k,el])=>{
      meta[k] = el ? el.value.trim() : '';
    });
    try{ localStorage.setItem(SB_META_KEY, JSON.stringify(meta)); }catch(_){}
  }

  // ---------- language ----------
  function applyLang(){
    const t = I18n[lang];
    const sl = $('#startLabel'); if(sl) sl.textContent = t.startLabel;
    const tg = $('#tagGoal'); if(tg) tg.textContent = t.tagGoal;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;
  }
  sbLangButtons.forEach(btn=>{
    btn.addEventListener('click',()=>{
      sbLangButtons.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      lang = btn.dataset.lang || 'th';
      applyLang();
    });
  });

  // ---------- feedback ----------
  function showFeedback(type){
    if(!sbFeedbackEl) return;
    const t = I18n[lang];
    let txt='';
    if(type==='fever') txt = t.feverLabel;
    else if(type==='perfect') txt = (lang==='th'?'Perfect! 💥':'PERFECT!');
    else if(type==='good') txt = (lang==='th'?'ดีมาก! ✨':'GOOD!');
    else txt = (lang==='th'?'พลาด!':'MISS');

    sbFeedbackEl.textContent = txt;

    sbFeedbackEl.className = 'feedback';
    if(type==='fever') sbFeedbackEl.classList.add('feedback-fever');
    else if(type==='perfect') sbFeedbackEl.classList.add('feedback-perfect');
    else if(type==='good') sbFeedbackEl.classList.add('feedback-good');
    else sbFeedbackEl.classList.add('feedback-miss');

    sbFeedbackEl.style.display = 'block';
    sbFeedbackEl.style.opacity = '1';

    setTimeout(()=>{
      if(!sbFeedbackEl) return;
      sbFeedbackEl.style.opacity = '0';
      setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 140);
    }, type==='fever'?800:420);
  }

  // ---------- Boss HUD ----------
  let bossHud = null;

  function ensureBossHud(){
    if(!sbGameArea) return null;
    if(bossHud && bossHud.box && document.body.contains(bossHud.box)) return bossHud;

    const box = document.createElement('div');
    box.className = 'boss-barbox';
    box.innerHTML = `
      <div class="boss-face" id="sbBossFace">🐲</div>
      <div>
        <div class="boss-name" id="sbBossName">Boss</div>
        <div class="boss-bar"><div class="boss-bar-fill" id="sbBossFill"></div></div>
      </div>
    `;
    sbGameArea.appendChild(box);

    bossHud = {
      box,
      face: box.querySelector('#sbBossFace'),
      name: box.querySelector('#sbBossName'),
      fill: box.querySelector('#sbBossFill')
    };
    return bossHud;
  }
  function setBossHudVisible(v){
    const hud = ensureBossHud();
    if(!hud) return;
    hud.box.style.display = v ? 'flex' : 'none';
  }
  function updateBossHud(){
    const hud = ensureBossHud();
    if(!hud || !S.activeBoss || !S.activeBossInfo) return;
    const info = S.activeBossInfo;
    hud.face.textContent = info.emoji;
    hud.name.textContent = (lang==='th'?info.nameTh:info.nameEn);

    const curHp = clamp(S.activeBoss.hp, 0, S.activeBoss.maxHp);
    const ratio = S.activeBoss.maxHp > 0 ? (curHp / S.activeBoss.maxHp) : 0;
    hud.fill.style.transform = `scaleX(${ratio})`;
  }

  // ---------- reset & HUD ----------
  function resetStats(){
    S.score=0; S.hit=0; S.perfect=0; S.good=0; S.miss=0;
    S.combo=0; S.maxCombo=0;
    S.elapsedMs=0;
    S.fever=false; S.feverUntil=0;

    S.targets=[];
    S.bossQueue=[]; S.bossActive=false; S.bossWarned=false;
    S.activeBoss=null; S.activeBossInfo=null;

    if(sbHUD.scoreVal) sbHUD.scoreVal.textContent='0';
    if(sbHUD.hitVal) sbHUD.hitVal.textContent='0';
    if(sbHUD.missVal) sbHUD.missVal.textContent='0';
    if(sbHUD.comboVal) sbHUD.comboVal.textContent='x0';
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = (sbMode==='endless'?'0':String(sbTimeSec));

    if(sbGameArea){
      sbGameArea.querySelectorAll('.sb-target,.boss-barbox').forEach(el=>el.remove());
      sbGameArea.classList.remove('fever');
    }

    bossHud = null;
    setBossHudVisible(false);
  }

  function updateHUD(){
    if(sbHUD.scoreVal) sbHUD.scoreVal.textContent=String(S.score);
    if(sbHUD.hitVal) sbHUD.hitVal.textContent=String(S.hit);
    if(sbHUD.missVal) sbHUD.missVal.textContent=String(S.miss);
    if(sbHUD.comboVal) sbHUD.comboVal.textContent='x'+S.combo;
  }

  function pruneTargets(){
    S.targets = S.targets.filter(t => t && t.alive && t.el && document.body.contains(t.el));
  }

  // ---------- Boss queue ----------
  function prepareBossQueue(){
    const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000;
    const checkpoints = [0.15,0.35,0.6,0.85].map(r=>Math.round(ms*r));
    S.bossQueue = BOSSES.map((b,idx)=>({
      bossIndex: idx,
      spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15))
    }));
  }

  // ---------- spawn safe-area ----------
  let targetId = 1;

  function pickSpawnXY(sizePx){
    const panel = document.querySelector('.game-panel');
    const host = panel || sbGameArea;
    if(!host) return { x:20, y:20 };

    const rect = host.getBoundingClientRect();
    const pad = 18;
    const safeTop = 64;

    const maxX = Math.max(0, rect.width  - sizePx - pad*2);
    const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop);

    return {
      x: pad + Math.random()*maxX,
      y: pad + safeTop + Math.random()*maxY
    };
  }

  function spawnTarget(isBoss=false, bossInfo=null){
    if(!sbGameArea) return;

    const sizeBase = isBoss ? 90 : 56;
    const baseHp = isBoss ? (cfg.bossHp + (bossInfo?.hpBonus||0)) : 1;

    const tObj = {
      id: targetId++,
      boss: !!isBoss,
      bossInfo: bossInfo || null,
      hp: baseHp,
      maxHp: baseHp,
      createdAt: performance.now(),
      el: null,
      alive: true,
      missTimer: null
    };

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = String(tObj.id);
    el.style.width = sizeBase + 'px';
    el.style.height = sizeBase + 'px';

    if(isBoss && bossInfo){
      el.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #ea580c)';
      el.textContent = bossInfo.emoji;
      el.style.fontSize = '2.1rem';
    }else{
      const emo = NORMAL_EMOJIS[Math.floor(Math.random()*NORMAL_EMOJIS.length)];
      el.style.background = S.fever
        ? 'radial-gradient(circle at 30% 20%, #facc15, #eab308)'
        : 'radial-gradient(circle at 30% 20%, #38bdf8, #0ea5e9)';
      el.textContent = emo;
      el.style.fontSize = '1.7rem';
    }

    const pos = pickSpawnXY(sizeBase);
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';

    el.addEventListener('click', ()=>hitTarget(tObj));

    sbGameArea.appendChild(el);
    tObj.el = el;
    S.targets.push(tObj);

    if(isBoss && bossInfo){
      S.bossActive = true;
      S.bossWarned = false;
      S.activeBoss = tObj;
      S.activeBossInfo = bossInfo;

      setBossHudVisible(true);
      updateBossHud();

      const name = (lang==='th'?bossInfo.nameTh:bossInfo.nameEn);
      emit('hha:coach', { text: I18n[lang].bossAppear(name), boss: bossInfo.id });
    }

    const lifeMs = isBoss ? 6500 : 2300;
    tObj.missTimer = setTimeout(()=>{
      if(!tObj.alive) return;
      tObj.alive=false;
      try{ tObj.el && tObj.el.remove(); }catch(_){}

      S.miss++;
      S.combo=0;
      updateHUD();
      showFeedback('miss');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = I18n[lang].coachMiss;

      if(tObj.boss){
        S.bossActive=false;
        S.activeBoss=null;
        S.activeBossInfo=null;
        setBossHudVisible(false);
      }
      pruneTargets();
    }, lifeMs);

    if(el.animate){
      el.animate(
        [{ transform:'scale(0.7)', opacity:0 }, { transform:'scale(1)', opacity:1 }],
        { duration: isBoss?240:160, easing:'ease-out' }
      );
    }
  }

  function maybeSpawnBoss(){
    if(!S.running || S.paused) return;
    if(S.bossActive) return;
    if(!S.bossQueue.length) return;

    const next = S.bossQueue[0];
    if(S.elapsedMs >= next.spawnAtMs){
      S.bossQueue.shift();
      spawnTarget(true, BOSSES[next.bossIndex]);
    }
  }
  function spawnNextBossImmediate(){
    if(!S.bossQueue.length) return;
    const next = S.bossQueue.shift();
    spawnTarget(true, BOSSES[next.bossIndex]);
  }

  // ---------- fever ----------
  function enterFever(){
    S.fever=true;
    S.feverUntil = performance.now() + 3500;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = I18n[lang].coachFever;
    if(sbGameArea) sbGameArea.classList.add('fever');
    showFeedback('fever');
    emit('hha:coach', { text: I18n[lang].coachFever, fever:true });
  }
  function checkFeverTick(now){
    if(S.fever && now >= S.feverUntil){
      S.fever=false;
      if(sbGameArea) sbGameArea.classList.remove('fever');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = I18n[lang].coachReady;
    }
  }

  // ---------- hit logic ----------
  function hitTarget(tObj){
    if(!S.running || S.paused || !tObj || !tObj.alive) return;

    tObj.hp -= 1;
    S.hit++;

    const isBoss = tObj.boss;
    const bossInfo = tObj.bossInfo;

    if(tObj.hp > 0){
      S.good++;
      S.combo++;
      S.maxCombo = Math.max(S.maxCombo, S.combo);

      const base = isBoss ? 70 : 50;
      const comboBonus = Math.min(S.combo*5, 60);
      const feverBonus = S.fever ? 30 : 0;
      const gained = base + comboBonus + feverBonus;
      S.score += gained;

      if(tObj.el && tObj.el.animate){
        tObj.el.animate(
          [{ transform:'scale(1)' }, { transform:'scale(1.08)' }, { transform:'scale(1)' }],
          { duration:140, easing:'ease-out' }
        );
      }

      updateHUD();
      showFeedback('good');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = I18n[lang].coachGood;

      if(isBoss){
        updateBossHud();
        if(!S.bossWarned && tObj.hp <= 2){
          S.bossWarned=true;
          const name = (lang==='th'?bossInfo.nameTh:bossInfo.nameEn);
          emit('hha:coach', { text: I18n[lang].bossNear(name), boss: bossInfo.id });
        }
      }

      emit('hha:score', { score: S.score, gained, combo: S.combo, hit: S.hit, miss: S.miss, boss:!!isBoss });
      return;
    }

    // kill => perfect
    tObj.alive=false;
    if(tObj.missTimer) { clearTimeout(tObj.missTimer); tObj.missTimer=null; }

    S.perfect++;
    S.combo++;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    const base = isBoss ? 200 : 80;
    const comboBonus = Math.min(S.combo*8, 100);
    const feverBonus = S.fever ? 80 : 0;
    const gained = base + comboBonus + feverBonus;
    S.score += gained;

    if(tObj.el && tObj.el.animate){
      tObj.el.animate(
        [{ transform:'scale(1)', opacity:1 }, { transform:'scale(0.1)', opacity:0 }],
        { duration:140, easing:'ease-in' }
      ).onfinish = ()=>{ try{ tObj.el && tObj.el.remove(); }catch(_){} };
    }else{
      try{ tObj.el && tObj.el.remove(); }catch(_){}
    }

    updateHUD();

    if(S.combo >= 5 && !S.fever) enterFever();
    else showFeedback('perfect');

    if(isBoss){
      const name = (lang==='th'?bossInfo.nameTh:bossInfo.nameEn);
      emit('hha:coach', { text: I18n[lang].bossClear(name), boss: bossInfo.id });

      S.bossActive=false;
      S.activeBoss=null;
      S.activeBossInfo=null;
      setBossHudVisible(false);

      spawnNextBossImmediate();
    }

    pruneTargets();
    emit('hha:score', { score: S.score, gained, combo: S.combo, hit: S.hit, miss: S.miss, boss:!!isBoss });
  }

  // ---------- crosshair shoot (HeroHealth vr-ui.js) ----------
  function hitNearestAtScreenXY(x, y, lockPx=28){
    if(!S.running || S.paused || !sbGameArea) return false;
    x=Number(x); y=Number(y);
    if(!Number.isFinite(x)||!Number.isFinite(y)) return false;

    let best=null, bestD2=Infinity;
    for(const tObj of S.targets){
      if(!tObj || !tObj.alive || !tObj.el) continue;
      const r = tObj.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx=cx-x, dy=cy-y;
      const d2=dx*dx+dyriest y*dy;
      // (guard) – แก้ typo เผื่อ copy เพี้ยน
      const d2ok = (Number.isFinite(d2) ? d2 : (dx*dx+dy*dy));
      if(d2ok<bestD2){ bestD2=d2ok; best=tObj; }
    }
    const lock = Math.max(10, Number(lockPx)||28);
    if(best && bestD2 <= lock*lock){ hitTarget(best); return true; }
    return false;
  }

  window.addEventListener('hha:shoot', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    hitNearestAtScreenXY(d.x, d.y, d.lockPx || 28);
  });

  window.addEventListener('keydown',(ev)=>{
    if(!S.running || S.paused) return;
    if(ev.code==='Space'){
      ev.preventDefault();
      if(!sbGameArea) return;
      const rect = sbGameArea.getBoundingClientRect();
      hitNearestAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90);
    }
  });

  // ---------- spawning ----------
  function startSpawnLoop(){
    if(S.spawnTimer) clearInterval(S.spawnTimer);
    S.spawnTimer = setInterval(()=>{
      if(!S.running || S.paused) return;
      if(Math.random() < 0.1) return;
      if(S.bossActive && Math.random()<0.5) return;
      spawnTarget(false, null);
    }, cfg.spawnMs);
  }
  function stopSpawnLoop(){
    if(S.spawnTimer) clearInterval(S.spawnTimer);
    S.spawnTimer=null;
  }

  // ---------- loop ----------
  let lastTick = -1;

  function mainLoop(now){
    if(!S.running) return;

    if(S.paused){
      requestAnimationFrame(mainLoop);
      return;
    }

    if(!S.startTime) S.startTime = now;
    S.elapsedMs = now - S.startTime;

    if(sbMode!=='endless'){
      const remain = Math.max(0, Math.round((S.durationMs - S.elapsedMs)/1000));
      if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(remain);

      if(remain !== lastTick){
        lastTick = remain;
        emit('hha:time', { remainSec: remain, elapsedMs: Math.round(S.elapsedMs) });
      }

      if(S.elapsedMs >= S.durationMs){
        endGame('timeup');
        return;
      }
    }else{
      const sec = Math.floor(S.elapsedMs/1000);
      if(sbHUD.timeVal) sbHUD.timeVal.textContent = String(sec);
      if(sec !== lastTick){
        lastTick = sec;
        emit('hha:time', { elapsedSec: sec, elapsedMs: Math.round(S.elapsedMs) });
      }
    }

    checkFeverTick(now);
    maybeSpawnBoss();
    if(Math.random() < 0.15) pruneTargets();

    requestAnimationFrame(mainLoop);
  }

  // ---------- local logging + csv ----------
  function logLocal(rec){
    try{
      const raw = localStorage.getItem(SB_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push(rec);
      localStorage.setItem(SB_STORAGE_KEY, JSON.stringify(arr));
    }catch(err){
      console.warn('[SB] local log failed:', err);
    }
  }

  function downloadCsv(){
    let rows=[];
    try{
      const raw = localStorage.getItem(SB_STORAGE_KEY);
      if(!raw){ alert('ยังไม่มีข้อมูล session'); return; }
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr) || !arr.length){ alert('ยังไม่มีข้อมูล session'); return; }

      const header=[
        'studentId','schoolName','classRoom','groupCode','deviceType','language','note',
        'phase','mode','diff','gameId','gameVersion','sessionId','hub','view','timeSec','score','hits','perfect','good','miss',
        'accuracy','maxCombo','fever','timeUsedSec','seed','research','reason','createdAt',
        // ctx passthrough extras
        'studyId','conditionGroup','ts','run','style','log'
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
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='ShadowBreakerSessions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- last summary ----------
  function saveLastSummary(summary){
    try{ localStorage.setItem(VFA_LAST_SUMMARY_KEY, JSON.stringify(summary)); }catch(_){}
    try{ localStorage.setItem(HHA_LAST_SUMMARY_KEY, JSON.stringify(summary)); }catch(_){}
  }

  // ---------- Cloud logger (flush-hardened, offline queue) ----------
  function loadQueue(){
    try{ return JSON.parse(localStorage.getItem(VFA_LOG_QUEUE_KEY) || '[]') || []; }catch(_){ return []; }
  }
  function saveQueue(q){
    try{ localStorage.setItem(VFA_LOG_QUEUE_KEY, JSON.stringify(q||[])); }catch(_){}
  }

  async function postJson(url, payload){
    try{
      if(navigator.sendBeacon){
        const blob = new Blob([JSON.stringify(payload)], { type:'application/json' });
        const ok = navigator.sendBeacon(url, blob);
        if(ok) return true;
      }
    }catch(_){}

    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors',
        credentials: 'omit',
      });
      return !!res && (res.ok || res.status===0);
    }catch(_){
      return false;
    }
  }

  let flushing = false;
  async function flushQueue(reason='flush'){
    if(flushing) return;
    if(!SB_LOG_ENDPOINT) return;
    flushing = true;

    try{
      const q = loadQueue();
      if(!q.length){ flushing=false; return; }

      const remain = [];
      for(const item of q){
        const payload = {
          type: 'hha:end',
          gameId: SB_GAME_ID,
          gameVersion: SB_GAME_VERSION,
          reason,
          ts: Date.now(),
          data: item
        };
        const ok = await postJson(SB_LOG_ENDPOINT, payload);
        if(!ok) remain.push(item);
      }
      saveQueue(remain);
    } finally {
      flushing = false;
    }
  }

  function queueSession(rec){
    if(!SB_LOG_ENDPOINT) return;
    const q = loadQueue();
    q.push(rec);
    saveQueue(q);
  }

  window.addEventListener('hha:flush', (ev)=>{
    const r = (ev && ev.detail && ev.detail.reason) ? ev.detail.reason : 'hha:flush';
    flushQueue(r);
  });
  window.addEventListener('pagehide', ()=> flushQueue('pagehide'));
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) flushQueue('hidden');
  });
  window.addEventListener('beforeunload', ()=> flushQueue('beforeunload'));

  // ---------- pause/resume ----------
  function pause(v){
    if(!S.running) return;

    if(v && !S.paused){
      S.paused = true;
      S.pauseAt = performance.now();
      stopSpawnLoop();
    }else if(!v && S.paused){
      S.paused = false;
      if(S.startTime && S.pauseAt){
        S.startTime += (performance.now() - S.pauseAt);
      }
      startSpawnLoop();
      requestAnimationFrame(mainLoop);
    }
  }

  document.addEventListener('visibilitychange', ()=> pause(document.hidden));
  window.addEventListener('blur', ()=> pause(true));
  window.addEventListener('focus', ()=> pause(false));

  window.addEventListener('message',(ev)=>{
    const d = ev.data || {};
    if(d.type === 'hub:pause'){
      pause(!!d.value);
    }
  });

  // ---------- start/end ----------
  function makeSessionId(){
    try{
      if(crypto && crypto.randomUUID) return crypto.randomUUID();
    }catch(_){}
    return `${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
  }

  function endGame(reason='end'){
    if(!S.running) return;
    S.running=false;
    S.paused=false;

    stopSpawnLoop();

    for(const tObj of S.targets){
      try{
        if(tObj.missTimer) clearTimeout(tObj.missTimer);
        if(tObj.el && tObj.el.remove) tObj.el.remove();
      }catch(_){}
    }
    S.targets=[];
    setBossHudVisible(false);

    const playedSec = Math.round(S.elapsedMs/1000);
    const totalHit = S.hit;
    const totalMiss = S.miss;
    const attempts = totalHit + totalMiss;
    const acc = attempts>0 ? Math.round((totalHit/attempts)*100) : 0;

    const view = (qs('view','')||'').trim();

    const rec = {
      studentId:  S.sessionMeta?.studentId || '',
      schoolName: S.sessionMeta?.schoolName || '',
      classRoom:  S.sessionMeta?.classRoom || '',
      groupCode:  S.sessionMeta?.groupCode || '',
      deviceType: S.sessionMeta?.deviceType || detectDevice(),
      language:   lang,
      note:       S.sessionMeta?.note || '',

      phase:      sbPhase,
      mode:       sbMode,
      diff:       sbDiff,
      gameId:     SB_GAME_ID,
      gameVersion:SB_GAME_VERSION,
      sessionId:  makeSessionId(),

      hub:        SB_HUB,
      view,

      timeSec:    (sbMode==='endless') ? playedSec : sbTimeSec,
      score:      S.score,
      hits:       totalHit,
      perfect:    S.perfect,
      good:       S.good,
      miss:       S.miss,
      accuracy:   acc,
      maxCombo:   S.maxCombo,
      fever:      S.fever ? 1 : 0,
      timeUsedSec:playedSec,

      seed:       SB_SEED,
      research:   SB_IS_RESEARCH ? 1 : 0,

      // ctx passthrough fields (copy in)
      studyId:        qs('studyId','') || '',
      conditionGroup: qs('conditionGroup','') || '',
      ts:             qs('ts','') || '',
      run:            qs('run','') || '',
      style:          qs('style','') || '',
      log:            SB_LOG_ENDPOINT ? 1 : 0,

      reason,
      createdAt:  new Date().toISOString(),
    };

    // 1) local sessions
    logLocal(rec);

    // 2) save last summary + playUrl (for hub replay)
    const playUrl = (() => {
      try{ return new URL(location.href).toString(); }catch{ return location.href; }
    })();

    const summary = {
      gameId: SB_GAME_ID,
      gameVersion: SB_GAME_VERSION,
      title: 'Shadow Breaker',
      endedAt: rec.createdAt,
      hub: SB_HUB,
      view,
      diff: sbDiff,
      mode: sbMode,
      timeSec: rec.timeSec,
      playUrl,
      ctx: Object.assign({}, CTX), // raw passthrough
      metrics: {
        score: rec.score,
        hit: rec.hits,
        perfect: rec.perfect,
        good: rec.good,
        miss: rec.miss,
        accuracy: rec.accuracy,
        maxCombo: rec.maxCombo,
        timeUsedSec: rec.timeUsedSec,
      },
      session: rec
    };
    saveLastSummary(summary);

    // 3) cloud queue + flush
    queueSession(rec);

    // overlay fill
    if(sbR.score) sbR.score.textContent = String(S.score);
    if(sbR.hit) sbR.hit.textContent = String(totalHit);
    if(sbR.perfect) sbR.perfect.textContent = String(S.perfect);
    if(sbR.good) sbR.good.textContent = String(S.good);
    if(sbR.miss) sbR.miss.textContent = String(S.miss);
    if(sbR.acc) sbR.acc.textContent = acc + '%';
    if(sbR.combo) sbR.combo.textContent = 'x' + S.maxCombo;
    if(sbR.timeUsed) sbR.timeUsed.textContent = playedSec + 's';

    if(sbOverlay) sbOverlay.classList.remove('hidden');

    emit('hha:end', rec);
    emit('hha:flush', { reason: 'end' });

    flushQueue('end');
  }

  function startGame(){
    if(S.running) return;

    const t = I18n[lang];

    const sid = sbMetaInputs.studentId ? sbMetaInputs.studentId.value.trim() : '';
    if(SB_IS_RESEARCH && !sid){
      alert(t.alertMeta);
      return;
    }

    const meta = {
      studentId: sid || '',
      schoolName: sbMetaInputs.schoolName ? sbMetaInputs.schoolName.value.trim() : '',
      classRoom: sbMetaInputs.classRoom ? sbMetaInputs.classRoom.value.trim() : '',
      groupCode: sbMetaInputs.groupCode ? sbMetaInputs.groupCode.value.trim() : '',
      deviceType:
        (sbMetaInputs.deviceType && sbMetaInputs.deviceType.value === 'auto')
          ? detectDevice()
          : (sbMetaInputs.deviceType ? sbMetaInputs.deviceType.value : detectDevice()),
      note: sbMetaInputs.note ? sbMetaInputs.note.value.trim() : ''
    };
    S.sessionMeta = meta;
    saveMetaDraft();

    document.body.classList.add('play-only');

    resetStats();
    prepareBossQueue();

    S.running=true;
    S.paused=false;
    S.startTime=0;
    lastTick = -1;

    if(sbStartBtn){
      sbStartBtn.disabled=true;
      sbStartBtn.style.opacity=0.75;
    }
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

    // include ctx passthrough for research pipeline
    emit('hha:start', Object.assign({
      gameId: SB_GAME_ID,
      gameVersion: SB_GAME_VERSION,
      phase: sbPhase,
      mode: sbMode,
      diff: sbDiff,
      timeSec: (sbMode==='endless') ? 0 : sbTimeSec,
      seed: SB_SEED,
      research: SB_IS_RESEARCH ? 1 : 0,
      hub: SB_HUB,
      log: SB_LOG_ENDPOINT ? 1 : 0
    }, CTX));

    setTimeout(()=>{
      startSpawnLoop();
      requestAnimationFrame(mainLoop);
    }, 450);
  }

  // ---------- buttons ----------
  if(sbStartBtn) sbStartBtn.addEventListener('click', startGame);

  if(sbPlayAgainBtn){
    sbPlayAgainBtn.addEventListener('click',()=>{
      if(sbOverlay) sbOverlay.classList.add('hidden');
      if(sbStartBtn){ sbStartBtn.disabled=false; sbStartBtn.style.opacity=1; }
      startGame();
    });
  }

  if(sbBackHubBtn){
    sbBackHubBtn.addEventListener('click',()=>{
      const hub = SB_HUB || '../hub.html';
      // keep ctx when returning to hub so hub can know studyId/conditionGroup/etc.
      location.href = buildUrlWithParams(hub, CTX, { last: SB_GAME_ID });
    });
  }

  if(sbDownloadCsvBtn){
    sbDownloadCsvBtn.addEventListener('click', downloadCsv);
  }

  // meta listeners
  Object.values(sbMetaInputs).forEach(el=>{
    if(!el) return;
    el.addEventListener('change', saveMetaDraft);
    el.addEventListener('blur', saveMetaDraft);
  });

  // ---------- init ----------
  loadMeta();
  applyLang();

  if(sbHUD.timeVal){
    sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));
  }

})();