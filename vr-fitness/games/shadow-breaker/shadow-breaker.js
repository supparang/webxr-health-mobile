// === VR Fitness — Shadow Breaker (Production v1.0.3-prod) ===
// ✅ HeroHealth-like: hha:shoot support (crosshair/tap-to-shoot via vr-ui.js)
// ✅ HHA events: hha:start / hha:time / hha:score / hha:end / hha:flush
// ✅ Boss HUD bar + safe spawn + feedback fixed
// ✅ Pass-through: hub/view/seed/research/studyId/log etc.
// ✅ Save last summary: SB_LAST_SUMMARY_V1

(() => {
  'use strict';

  const SB_GAME_ID = 'shadow-breaker';
  const SB_GAME_VERSION = '1.0.3-prod';

  const SB_STORAGE_KEY = 'ShadowBreakerSessions_v1';
  const SB_META_KEY    = 'ShadowBreakerMeta_v1';
  const SB_LAST_SUMMARY_KEY = 'SB_LAST_SUMMARY_V1';

  function qs(k, d=null){ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } }

  const sbPhase = (qs('phase','train')||'train').toLowerCase();
  const sbMode  = (qs('mode','timed')||'timed').toLowerCase();
  const sbDiff  = (qs('diff','normal')||'normal').toLowerCase();
  const sbTimeSec = (()=>{ const t=parseInt(qs('time','60'),10); return (Number.isFinite(t)&&t>=20&&t<=300)?t:60; })();

  const SB_SEED = (qs('seed','')||'').trim(); // keep for later expansion (seeded rng)

  const SB_IS_RESEARCH = (()=> {
    const r = (qs('research','')||'').toLowerCase();
    return r==='1' || r==='true' || r==='on' || !!qs('studyId','') || !!qs('log','');
  })();

  // ---------- DOM ----------
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sbGameArea   = $('#gameArea') || $('#playArea') || $('#sbPlayArea');
  const sbFeedbackEl = $('#feedback') || $('#sbFeedback');

  const sbStartBtn =
    $('#startBtn') || $('#playBtn') || $('#playButton') || $('#sbStartBtn');

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

  const sbOverlay =
    $('#resultOverlay') || $('#resultCard') || $('#resultPanel') || null;

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

  const sbPlayAgainBtn =
    $('#playAgainBtn') || $('#resPlayAgainBtn') || $('#resReplayBtn');
  const sbBackHubBtn =
    $('#backHubBtn') || $('#resBackHubBtn') || $('#resMenuBtn');
  const sbDownloadCsvBtn =
    $('#downloadCsvBtn') || $('#resDownloadCsvBtn');

  // ---------- helpers ----------
  function sbEmit(name, detail = {}){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){} }
  function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }

  function nowISO(){
    try{ return new Date().toISOString(); }catch{ return ''; }
  }

  function safeRemove(el){
    try{ el && el.remove && el.remove(); }catch(_){}
  }

  function normalizeBool(v){
    if(v===true) return true;
    const s = String(v||'').toLowerCase();
    return s==='1'||s==='true'||s==='on'||s==='yes';
  }

  // ---------- Device detect ----------
  function sbDetectDevice() {
    const ua = navigator.userAgent || '';
    if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vrHeadset';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
    return 'pc';
  }

  // ---------- Config ----------
  const sbDiffCfg = {
    easy:   { spawnMs: 900, bossHp: 6 },
    normal: { spawnMs: 700, bossHp: 9 },
    hard:   { spawnMs: 520, bossHp: 12 },
    final:  { spawnMs: 440, bossHp: 14 }
  };
  const sbCfg = sbDiffCfg[sbDiff] || sbDiffCfg.normal;

  // ---------- Boss & emojis ----------
  const SB_NORMAL_EMOJIS = ['🎯','💥','⭐','⚡','🔥','🥎','🌀'];
  const SB_BOSSES = [
    { id: 1, emoji:'💧', nameTh:'Bubble Glove',  nameEn:'Bubble Glove',  hpBonus:0 },
    { id: 2, emoji:'⛈️', nameTh:'Storm Knuckle', nameEn:'Storm Knuckle', hpBonus:2 },
    { id: 3, emoji:'🥊', nameTh:'Iron Fist',     nameEn:'Iron Fist',     hpBonus:4 },
    { id: 4, emoji:'🐲', nameTh:'Golden Dragon', nameEn:'Golden Dragon', hpBonus:6 },
  ];

  // ---------- i18n ----------
  const sbI18n = {
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
      paused:'หยุดชั่วคราว',
      resumed:'เล่นต่อ!'
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
      paused:'Paused',
      resumed:'Resumed'
    }
  };

  let sbLang = 'th';

  // ---------- state ----------
  const sbState = {
    running:false,
    paused:false,
    startTime:0,
    pauseAt:0,
    elapsedMs:0,
    durationMs: sbMode==='endless' ? Infinity : sbTimeSec*1000,

    spawnTimer:null,
    targets:[], // tObj list (alive filtered on tick)
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
    activeBoss:null,     // tObj
    activeBossInfo:null, // boss info

    ended:false
  };

  // ---------- meta persistence ----------
  function sbLoadMeta(){
    try{
      const raw = localStorage.getItem(SB_META_KEY);
      if(!raw) return;
      const meta = JSON.parse(raw);
      Object.entries(sbMetaInputs).forEach(([k,el])=>{
        if(el && meta && typeof meta[k] === 'string') el.value = meta[k];
      });
    }catch(_){}
  }
  function sbSaveMetaDraft(){
    const meta = {};
    Object.entries(sbMetaInputs).forEach(([k,el])=>{
      meta[k] = el ? String(el.value||'').trim() : '';
    });
    try{ localStorage.setItem(SB_META_KEY, JSON.stringify(meta)); }catch(_){}
  }

  // ---------- language ----------
  function sbApplyLang(){
    const t = sbI18n[sbLang] || sbI18n.th;
    const sl = $('#startLabel'); if(sl) sl.textContent = t.startLabel;
    const tg = $('#tagGoal'); if(tg) tg.textContent = t.tagGoal;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;
  }
  sbLangButtons.forEach(btn=>{
    btn.addEventListener('click',()=>{
      sbLangButtons.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      sbLang = (btn.dataset.lang || 'th');
      sbApplyLang();
    });
  });

  // ---------- feedback ----------
  function sbShowFeedback(type){
    if(!sbFeedbackEl) return;
    const t = sbI18n[sbLang] || sbI18n.th;
    let txt='';
    let cls='';

    if(type==='fever'){ txt = t.feverLabel; cls='feedback feedback-fever'; }
    else if(type==='perfect'){ txt = (sbLang==='th'?'Perfect! 💥':'PERFECT!'); cls='feedback feedback-perfect'; }
    else if(type==='good'){ txt = (sbLang==='th'?'ดีมาก! ✨':'GOOD!'); cls='feedback feedback-good'; }
    else { txt = (sbLang==='th'?'พลาด!':'MISS'); cls='feedback feedback-miss'; }

    sbFeedbackEl.textContent = txt;
    sbFeedbackEl.className = cls;
    sbFeedbackEl.style.display = 'block';
    sbFeedbackEl.style.opacity = '1';

    // animate quick
    if(sbFeedbackEl.animate){
      sbFeedbackEl.animate(
        [{ transform:'translate(-50%,-50%) scale(0.95)', opacity:0 }, { transform:'translate(-50%,-50%) scale(1.0)', opacity:1 }],
        { duration: 120, easing:'ease-out' }
      );
    }

    setTimeout(()=>{
      if(!sbFeedbackEl) return;
      sbFeedbackEl.style.opacity = '0';
      setTimeout(()=>{ if(sbFeedbackEl) sbFeedbackEl.style.display='none'; }, 120);
    }, type==='fever'?780:420);
  }

  function sbResetStats(){
    sbState.score=0; sbState.hit=0; sbState.perfect=0; sbState.good=0; sbState.miss=0;
    sbState.combo=0; sbState.maxCombo=0;
    sbState.elapsedMs=0;
    sbState.fever=false; sbState.feverUntil=0;

    sbState.targets=[];
    sbState.bossQueue=[]; sbState.bossActive=false; sbState.bossWarned=false;
    sbState.activeBoss=null; sbState.activeBossInfo=null;
    sbState.ended=false;

    if(sbHUD.scoreVal) sbHUD.scoreVal.textContent='0';
    if(sbHUD.hitVal) sbHUD.hitVal.textContent='0';
    if(sbHUD.missVal) sbHUD.missVal.textContent='0';
    if(sbHUD.comboVal) sbHUD.comboVal.textContent='x0';
    if(sbHUD.timeVal) sbHUD.timeVal.textContent = (sbMode==='endless'?'0':String(sbTimeSec));

    if(sbGameArea){
      sbGameArea.querySelectorAll('.sb-target,.boss-barbox').forEach(el=>safeRemove(el));
      sbGameArea.classList.remove('fever');
    }
    sbBossHud = null;
  }

  function sbUpdateHUD(){
    if(sbHUD.scoreVal) sbHUD.scoreVal.textContent=String(sbState.score);
    if(sbHUD.hitVal) sbHUD.hitVal.textContent=String(sbState.hit);
    if(sbHUD.missVal) sbHUD.missVal.textContent=String(sbState.miss);
    if(sbHUD.comboVal) sbHUD.comboVal.textContent='x'+sbState.combo;
  }

  // ---------- Boss HUD ----------
  let sbBossHud = null;
  function sbEnsureBossHud(){
    if(!sbGameArea) return null;
    if(sbBossHud) return sbBossHud;

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
    hud.name.textContent = (sbLang==='th'?info.nameTh:info.nameEn);

    const curHp = clamp(sbState.activeBoss.hp, 0, sbState.activeBoss.maxHp);
    const ratio = sbState.activeBoss.maxHp > 0 ? (curHp / sbState.activeBoss.maxHp) : 0;
    hud.fill.style.transform = `scaleX(${ratio})`;
  }

  // ---------- Boss queue ----------
  function sbPrepareBossQueue(){
    const ms = (sbMode==='endless') ? 120000 : sbTimeSec*1000;
    const checkpoints = [0.15,0.35,0.60,0.85].map(r=>Math.round(ms*r));

    sbState.bossQueue = SB_BOSSES.map((b,idx)=>({
      bossIndex: idx,
      spawnAtMs: checkpoints[idx] || Math.round(ms*(0.2+idx*0.15))
    }));
  }

  // ---------- spawn safe-area ----------
  let sbTargetIdCounter = 1;

  function sbPickSpawnXY(sizePx){
    if(!sbGameArea) return { x:20, y:20 };

    const rect = sbGameArea.getBoundingClientRect();

    // pad + safe zones (กัน HUD และขอบ)
    const pad = 18;
    const safeTop = 56;   // กันชน boss hud
    const safeBottom = 14;

    const maxX = Math.max(0, rect.width - sizePx - pad*2);
    const maxY = Math.max(0, rect.height - sizePx - pad*2 - safeTop - safeBottom);

    const x = pad + Math.random()*maxX;
    const y = pad + safeTop + Math.random()*maxY;

    return { x, y };
  }

  function sbSpawnTarget(isBoss=false, bossInfo=null){
    if(!sbGameArea) return;

    const sizeBase = isBoss ? 90 : 56;
    const baseHp = isBoss ? (sbCfg.bossHp + (bossInfo?.hpBonus||0)) : 1;

    const tObj = {
      id: sbTargetIdCounter++,
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

    el.addEventListener('click', ()=>sbHitTarget(tObj));
    sbGameArea.appendChild(el);

    tObj.el = el;
    sbState.targets.push(tObj);

    // boss enter
    if(isBoss && bossInfo){
      sbState.bossActive = true;
      sbState.bossWarned = false;
      sbState.activeBoss = tObj;
      sbState.activeBossInfo = bossInfo;

      sbSetBossHudVisible(true);
      sbUpdateBossHud();

      const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
      sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossAppear(name), boss: bossInfo.id });
    }

    // life timer -> miss
    const lifeMs = isBoss ? 6500 : 2300;
    tObj.missTimer = setTimeout(()=>{
      if(!tObj.alive) return;
      tObj.alive=false;
      safeRemove(tObj.el);

      // miss from timeout
      sbState.miss++;
      sbState.combo=0;
      sbUpdateHUD();
      sbShowFeedback('miss');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachMiss;

      if(tObj.boss){
        sbState.bossActive=false;
        sbState.activeBoss=null;
        sbState.activeBossInfo=null;
        sbSetBossHudVisible(false);
      }
    }, lifeMs);

    if(el.animate){
      el.animate(
        [{ transform:'scale(0.7)', opacity:0 }, { transform:'scale(1)', opacity:1 }],
        { duration: isBoss?240:160, easing:'ease-out' }
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
    if(sbState.bossActive) return;
    if(!sbState.bossQueue.length) return;
    const next = sbState.bossQueue.shift();
    const bossInfo = SB_BOSSES[next.bossIndex];
    sbSpawnTarget(true, bossInfo);
  }

  // ---------- fever ----------
  function sbEnterFever(){
    sbState.fever=true;
    sbState.feverUntil = performance.now() + 3500;
    if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachFever;
    if(sbGameArea) sbGameArea.classList.add('fever');
    sbShowFeedback('fever');
    sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).coachFever, fever:true });
  }

  function sbCheckFeverTick(now){
    if(sbState.fever && now >= sbState.feverUntil){
      sbState.fever=false;
      if(sbGameArea) sbGameArea.classList.remove('fever');
      if(sbHUD.coachLine) sbHUD.coachLine.textContent = (sbI18n[sbLang]||sbI18n.th).coachReady;
    }
  }

  // ---------- hit logic ----------
  function sbKillTarget(tObj){
    tObj.alive=false;
    if(tObj.missTimer){ clearTimeout(tObj.missTimer); tObj.missTimer=null; }

    // remove element
    if(tObj.el && tObj.el.animate){
      tObj.el.animate(
        [{ transform:'scale(1)', opacity:1 }, { transform:'scale(0.1)', opacity:0 }],
        { duration:140, easing:'ease-in' }
      ).onfinish = ()=>safeRemove(tObj.el);
    }else{
      safeRemove(tObj.el);
    }
  }

  function sbHitTarget(tObj){
    if(!sbState.running || sbState.paused || !tObj || !tObj.alive) return;

    tObj.hp -= 1;

    sbState.hit++;
    const isBoss = tObj.boss;
    const bossInfo = tObj.bossInfo;

    // still alive => "good"
    if(tObj.hp > 0){
      sbState.good++;
      sbState.combo++;
      sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

      const base = isBoss ? 70 : 50;
      const comboBonus = Math.min(sbState.combo*5, 60);
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
          sbState.bossWarned=true;
          const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
          sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossNear(name), boss: bossInfo.id });
        }
      }

      sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
      return;
    }

    // kill => "perfect"
    sbState.perfect++;
    sbState.combo++;
    sbState.maxCombo = Math.max(sbState.maxCombo, sbState.combo);

    const base = isBoss ? 200 : 80;
    const comboBonus = Math.min(sbState.combo*8, 100);
    const feverBonus = sbState.fever ? 80 : 0;
    const gained = base + comboBonus + feverBonus;
    sbState.score += gained;

    sbKillTarget(tObj);
    sbUpdateHUD();

    if(sbState.combo >= 5 && !sbState.fever) sbEnterFever();
    else sbShowFeedback('perfect');

    if(isBoss){
      const name = (sbLang==='th'?bossInfo.nameTh:bossInfo.nameEn);
      sbEmit('hha:coach', { text: (sbI18n[sbLang]||sbI18n.th).bossClear(name), boss: bossInfo.id });

      sbState.bossActive=false;
      sbState.activeBoss=null;
      sbState.activeBossInfo=null;
      sbSetBossHudVisible(false);

      // spawn next boss soon (feel) — but not instantly chain too fast
      setTimeout(()=>sbSpawnNextBossImmediate(), 380);
    }

    sbEmit('hha:score', { score: sbState.score, gained, combo: sbState.combo, hit: sbState.hit, miss: sbState.miss, boss:!!isBoss });
  }

  // ---------- crosshair shoot (HeroHealth vr-ui.js) ----------
  function sbPruneTargets(){
    // keep only alive with element still in DOM
    sbState.targets = sbState.targets.filter(t=>{
      if(!t || !t.alive) return false;
      if(!t.el) return false;
      // if removed from DOM, mark dead
      if(!t.el.isConnected){ t.alive=false; return false; }
      return true;
    });
  }

  function sbHitNearestTargetAtScreenXY(x, y, lockPx=28){
    if(!sbState.running || sbState.paused || !sbGameArea) return false;
    x=Number(x); y=Number(y);
    if(!Number.isFinite(x)||!Number.isFinite(y)) return false;

    sbPruneTargets();

    let best=null, bestD2=Infinity;
    for(const tObj of sbState.targets){
      if(!tObj.alive || !tObj.el) continue;
      const r = tObj.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      const dx=cx-x, dy=cy-y;
      const d2=dx*dx+dy*dy;
      if(d2<bestD2){ bestD2=d2; best=tObj; }
    }
    const lock = Math.max(10, Number(lockPx)||28);
    if(best && bestD2 <= lock*lock){ sbHitTarget(best); return true; }
    return false;
  }

  window.addEventListener('hha:shoot', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    sbHitNearestTargetAtScreenXY(d.x, d.y, d.lockPx || 28);
  });

  // keyboard space (pc) => shoot center
  window.addEventListener('keydown',(ev)=>{
    if(!sbState.running || sbState.paused) return;
    if(ev.code==='Space'){
      ev.preventDefault();
      if(!sbGameArea) return;
      const rect = sbGameArea.getBoundingClientRect();
      sbHitNearestTargetAtScreenXY(rect.left+rect.width/2, rect.top+rect.height/2, 90);
    }
  });

  // ---------- spawning ----------
  function sbStartSpawnLoop(){
    if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
    sbState.spawnTimer = setInterval(()=>{
      if(!sbState.running || sbState.paused) return;
      if(Math.random() < 0.1) return;                 // occasional gap
      if(sbState.bossActive && Math.random() < 0.5) return; // reduce clutter during boss
      sbSpawnTarget(false, null);
      sbPruneTargets();
    }, sbCfg.spawnMs);
  }

  function sbStopSpawnLoop(){
    if(sbState.spawnTimer) clearInterval(sbState.spawnTimer);
    sbState.spawnTimer=null;
  }

  // ---------- loop ----------
  let sbLastTimeTick = -999;

  function sbMainLoop(now){
    if(!sbState.running) return;

    if(sbState.paused){
      requestAnimationFrame(sbMainLoop);
      return;
    }

    if(!sbState.startTime) sbState.startTime = now;
    sbState.elapsedMs = now - sbState.startTime;

    if(sbMode!=='endless'){
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

    sbCheckFeverTick(now);
    sbMaybeSpawnBoss();
    sbPruneTargets();

    requestAnimationFrame(sbMainLoop);
  }

  // ---------- logging local csv ----------
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

  function sbDownloadCsv(){
    let rows=[];
    try{
      const raw = localStorage.getItem(SB_STORAGE_KEY);
      if(!raw){ alert('ยังไม่มีข้อมูล session'); return; }
      const arr = JSON.parse(raw);
      if(!Array.isArray(arr) || !arr.length){ alert('ยังไม่มีข้อมูล session'); return; }

      const header=[
        'studentId','schoolName','classRoom','groupCode','deviceType','language','note',
        'phase','mode','diff','gameId','gameVersion','sessionId','timeSec','score','hits','perfect','good','miss',
        'accuracy','maxCombo','fever','timeUsedSec','seed','research','reason','createdAt'
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

  // ---------- last summary (HeroHealth-like) ----------
  function sbSaveLastSummary(summary){
    try{ localStorage.setItem(SB_LAST_SUMMARY_KEY, JSON.stringify(summary)); }catch(_){}
  }

  function sbBuildBackHubURL(){
    const hub = (qs('hub','')||'').trim();
    if(!hub) return '../hub.html';

    // passthrough selected ctx back (keeps hub stable)
    try{
      const back = new URL(hub, location.href);
      const keep = ['studyId','phase','conditionGroup','seed','ts','log','style','view','research'];
      const cur = new URL(location.href).searchParams;
      for(const k of keep){
        const v = cur.get(k);
        if(v !== null && String(v).trim() !== '') back.searchParams.set(k, String(v));
      }
      return back.toString();
    }catch(_){
      return hub;
    }
  }

  // ---------- end/start ----------
  function sbEndGame(reason='end'){
    if(!sbState.running || sbState.ended) return;
    sbState.ended = true;

    sbState.running=false;
    sbState.paused=false;

    sbStopSpawnLoop();

    for(const tObj of sbState.targets){
      try{
        if(tObj.missTimer) clearTimeout(tObj.missTimer);
        safeRemove(tObj.el);
      }catch(_){}
    }
    sbState.targets=[];

    sbSetBossHudVisible(false);

    const playedSec = Math.max(0, Math.round(sbState.elapsedMs/1000));
    const totalHit = sbState.hit;
    const totalMiss = sbState.miss;
    const attempts = totalHit + totalMiss;
    const acc = attempts>0 ? Math.round((totalHit/attempts)*100) : 0;

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
      timeUsedSec:playedSec,
      seed:       SB_SEED,
      research:   SB_IS_RESEARCH ? 1 : 0,
      reason,
      createdAt:  nowISO(),
      playUrl:    location.href
    };

    sbLogLocal(rec);

    // save last summary (for hub/show last results)
    sbSaveLastSummary({
      gameId: SB_GAME_ID,
      gameVersion: SB_GAME_VERSION,
      at: rec.createdAt,
      score: rec.score,
      hits: rec.hits,
      miss: rec.miss,
      accuracy: rec.accuracy,
      maxCombo: rec.maxCombo,
      timeUsedSec: rec.timeUsedSec,
      reason: rec.reason,
      playUrl: rec.playUrl
    });

    if(sbR.score) sbR.score.textContent = String(sbState.score);
    if(sbR.hit) sbR.hit.textContent = String(totalHit);
    if(sbR.perfect) sbR.perfect.textContent = String(sbState.perfect);
    if(sbR.good) sbR.good.textContent = String(sbState.good);
    if(sbR.miss) sbR.miss.textContent = String(sbState.miss);
    if(sbR.acc) sbR.acc.textContent = acc + '%';
    if(sbR.combo) sbR.combo.textContent = 'x' + sbState.maxCombo;
    if(sbR.timeUsed) sbR.timeUsed.textContent = playedSec + 's';

    if(sbOverlay) sbOverlay.classList.remove('hidden');

    // HHA events
    sbEmit('hha:end', rec);
    sbEmit('hha:flush', { reason: 'end' });
  }

  function sbStartGame(){
    if(sbState.running) return;

    const t = sbI18n[sbLang] || sbI18n.th;

    const sid = sbMetaInputs.studentId ? String(sbMetaInputs.studentId.value||'').trim() : '';
    if(SB_IS_RESEARCH && !sid){
      alert(t.alertMeta);
      return;
    }

    const meta = {
      studentId: sid || '',
      schoolName: sbMetaInputs.schoolName ? String(sbMetaInputs.schoolName.value||'').trim() : '',
      classRoom: sbMetaInputs.classRoom ? String(sbMetaInputs.classRoom.value||'').trim() : '',
      groupCode: sbMetaInputs.groupCode ? String(sbMetaInputs.groupCode.value||'').trim() : '',
      deviceType:
        (sbMetaInputs.deviceType && sbMetaInputs.deviceType.value === 'auto')
          ? sbDetectDevice()
          : (sbMetaInputs.deviceType ? sbMetaInputs.deviceType.value : sbDetectDevice()),
      note: sbMetaInputs.note ? String(sbMetaInputs.note.value||'').trim() : ''
    };
    sbState.sessionMeta = meta;
    sbSaveMetaDraft();

    document.body.classList.add('play-only');

    sbResetStats();
    sbPrepareBossQueue();

    sbState.running=true;
    sbState.paused=false;
    sbState.startTime=0;
    sbLastTimeTick = -999;

    if(sbStartBtn){
      sbStartBtn.disabled=true;
      sbStartBtn.style.opacity=0.75;
    }

    if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;

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

    setTimeout(()=>{
      sbStartSpawnLoop();
      requestAnimationFrame(sbMainLoop);
    }, 450);
  }

  // ---------- pause/resume from hub (iframe) ----------
  window.addEventListener('message',(ev)=>{
    const d = ev.data || {};
    if(d.type === 'hub:pause'){
      if(!sbState.running) return;
      const v = normalizeBool(d.value);
      const t = sbI18n[sbLang] || sbI18n.th;

      if(v && !sbState.paused){
        sbState.paused=true;
        sbState.pauseAt = performance.now();
        sbStopSpawnLoop();
        sbEmit('hha:coach', { text: t.paused });
        if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.paused;
      }else if(!v && sbState.paused){
        sbState.paused=false;
        if(sbState.startTime && sbState.pauseAt){
          const pausedDur = performance.now() - sbState.pauseAt;
          sbState.startTime += pausedDur;
        }
        sbStartSpawnLoop();
        sbEmit('hha:coach', { text: t.resumed });
        if(sbHUD.coachLine) sbHUD.coachLine.textContent = t.coachReady;
      }
    }
  });

  // flush triggers (cloud logger may listen)
  window.addEventListener('pagehide', ()=>sbEmit('hha:flush', { reason:'pagehide' }));
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'hidden'){
      sbEmit('hha:flush', { reason:'hidden' });
    }
  });

  // ---------- buttons ----------
  if(sbStartBtn) sbStartBtn.addEventListener('click', sbStartGame);

  if(sbPlayAgainBtn){
    sbPlayAgainBtn.addEventListener('click',()=>{
      if(sbOverlay) sbOverlay.classList.add('hidden');
      if(sbStartBtn){ sbStartBtn.disabled=false; sbStartBtn.style.opacity=1; }
      sbStartGame();
    });
  }

  if(sbBackHubBtn){
    sbBackHubBtn.addEventListener('click',()=>{
      location.href = sbBuildBackHubURL();
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

  // ---------- init ----------
  sbLoadMeta();
  sbApplyLang();

  if(sbHUD.timeVal){
    sbHUD.timeVal.textContent = (sbMode==='endless' ? '0' : String(sbTimeSec));
  }

})();