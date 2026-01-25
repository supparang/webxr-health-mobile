// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.3 PATCH B4)
// ✅ PATCH B3 included: Anti-clump + Cap targets + TTL fair + GOAL/MINI + Low-time overlay
// ✅ PATCH B4: Food 5 groups mapping (good = group 1..5), junk emojis from JUNK
// ✅ MINI now: "ครบ 3 หมู่ใน 12 วิ" (bonus shield + miss-1) + quest:update
// ✅ AI Prediction (ML-lite): online risk predictor + fair adaptive knobs (ai=on only, research forced off)
// ✅ Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:metrics, hha:end

'use strict';

import { FOOD5, JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';
import { createPredictor } from '../vr/ai-predictor.js';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };
const nowMs = ()=> (performance?.now?.() ?? Date.now());

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 140;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 130;

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

  return { x,y,w,h };
}

function pickByShoot(lockPx=28){
  const r = DOC.documentElement.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2;

  const els = Array.from(DOC.querySelectorAll('.gj-target'));
  let best = null;

  for(const el of els){
    const b = el.getBoundingClientRect();
    if(!b.width || !b.height) continue;

    const inside =
      (cx >= b.left - lockPx && cx <= b.right + lockPx) &&
      (cy >= b.top  - lockPx && cy <= b.bottom + lockPx);

    if(!inside) continue;

    const ex = (b.left + b.right) / 2;
    const ey = (b.top  + b.bottom) / 2;
    const dx = (ex - cx);
    const dy = (ey - cy);
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }
  return best ? best.el : null;
}

// -------- Food group helpers --------
function chooseGroupId(rng){
  // 1..5 uniform (ปรับเป็น weighted ได้ภายหลัง)
  const r = (typeof rng === 'function') ? rng() : Math.random();
  return 1 + Math.floor(r * 5);
}

function decorateTarget(el, t){
  if(!el || !t) return;

  if(t.kind === 'good'){
    const gid = t.groupId || 1;
    const emo = emojiForGroup(t.rng, gid);
    el.textContent = emo;
    el.dataset.group = String(gid);
    el.setAttribute('aria-label', `${labelForGroup(gid)} ${emo}`);
  }else if(t.kind === 'junk'){
    const emo = pickEmoji(t.rng, JUNK.emojis);
    el.textContent = emo;
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', `${JUNK.labelTH} ${emo}`);
  }else if(t.kind === 'star'){
    el.textContent = '⭐';
    el.dataset.group = 'power';
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'power';
  }
}

// -------- missions meta (mini window) --------
function makeMiniMeta(){
  return {
    windowSec: 12,
    windowStartAt: 0,
    windowGroups: new Set(),
    miniDone: false
  };
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  // AI toggle (play only)
  const aiParam = String(qs('ai','off')).toLowerCase();
  const aiWanted = (aiParam === '1' || aiParam === 'true' || aiParam === 'on' || aiParam === 'yes');
  const aiEnabled = (run !== 'research') && aiWanted; // research forced off

  // HUD refs
  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  // Mission HUD (A has these)
  const elGoalTitle = DOC.getElementById('hud-goal');
  const elGoalDesc  = DOC.getElementById('goalDesc');
  const elGoalCur   = DOC.getElementById('hud-goal-cur');
  const elGoalTar   = DOC.getElementById('hud-goal-target');
  const elMiniText  = DOC.getElementById('hud-mini');
  const elMiniTimer = DOC.getElementById('miniTimer');

  // Low time overlay
  const elLow = DOC.getElementById('lowTimeOverlay');
  const elLowNum = DOC.getElementById('gj-lowtime-num');

  // ---- difficulty knobs ----
  const CFG_BASE = (() => {
    if(diff === 'easy'){
      return { spawnMs: 980, ttlGood: 2200, ttlJunk: 2200, ttlPow: 2600, maxTargets: 7, minDist: 88 };
    }
    if(diff === 'hard'){
      return { spawnMs: 820, ttlGood: 1600, ttlJunk: 1650, ttlPow: 2300, maxTargets: 8, minDist: 78 };
    }
    return { spawnMs: 900, ttlGood: 1900, ttlJunk: 1900, ttlPow: 2450, maxTargets: 7, minDist: 84 };
  })();

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng: makeRNG(seed),

    score:0, miss:0,
    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,

    // RT avg for AI
    rtSamples: [],
    rtAvg: 0,

    // missions (GOAL)
    goalIndex: 0,
    goalCur: 0,
    goalTarget: 0,

    // mini window (food groups)
    mini: makeMiniMeta(),

    // low overlay
    lowShown:false,
    lastLowSec:-1,

    // adaptive cfg (may be nudged by AI)
    cfg: Object.assign({}, CFG_BASE),

    // predictor
    predictor: aiEnabled ? createPredictor({ seed: String(seed), enabled: true }) : createPredictor({ enabled: false }),
    aiEnabled
  };

  // ---- GOALS (simple & fun) ----
  const GOALS = [
    { name:'เก็บของดี', desc:'แตะ/ยิง “ของดี” ให้ได้ครบ', target: (diff==='easy'? 10 : diff==='hard'? 14 : 12) },
    { name:'เก็บของดีต่อเนื่อง', desc:'เก็บของดีให้ได้เพิ่มอีก', target: (diff==='easy'? 12 : diff==='hard'? 16 : 14) },
    { name:'ทำคะแนนพุ่ง', desc:'เก็บของดีเยอะ ๆ แล้วเลี่ยงของเสีย', target: (diff==='easy'? 14 : diff==='hard'? 18 : 16) },
  ];

  function resetMiniWindow(){
    S.mini.windowStartAt = nowMs();
    S.mini.windowGroups.clear();
    S.mini.miniDone = false;

    // initial HUD text
    if(elMiniText) elMiniText.textContent = `ครบ 3 หมู่ใน ${S.mini.windowSec} วิ`;
    if(elMiniTimer) elMiniTimer.textContent = `${S.mini.windowSec}s`;
  }

  function updateQuestHUD(){
    // GOAL HUD
    if(elGoalTitle) elGoalTitle.textContent = `${GOALS[S.goalIndex].name}`;
    if(elGoalDesc)  elGoalDesc.textContent  = `${GOALS[S.goalIndex].desc}`;
    if(elGoalCur)   elGoalCur.textContent   = String(S.goalCur);
    if(elGoalTar)   elGoalTar.textContent   = String(S.goalTarget);

    // MINI HUD
    const cur = S.mini.windowGroups.size;
    const tar = 3;
    const left = Math.max(0, Math.ceil((S.mini.windowStartAt + S.mini.windowSec*1000 - nowMs())/1000));
    if(elMiniText){
      elMiniText.textContent = S.mini.miniDone
        ? `สำเร็จ! 🎁 โบนัสแล้ว`
        : `ครบ ${tar} หมู่ใน ${S.mini.windowSec} วิ (ตอนนี้ ${cur}/${tar})`;
    }
    if(elMiniTimer){
      elMiniTimer.textContent = S.mini.miniDone ? 'DONE' : `${left}s`;
    }

    // quest:update (ให้ HUD/ระบบอื่น ๆ ใช้งานได้)
    try{
      WIN.dispatchEvent(new CustomEvent('quest:update', { detail:{
        goal:{ name:GOALS[S.goalIndex].name, sub:GOALS[S.goalIndex].desc, cur:S.goalCur, target:S.goalTarget },
        mini:{ name:`ครบ ${tar} หมู่ใน ${S.mini.windowSec} วิ`, sub:'โบนัส: 🛡 + ลด MISS', cur, target:tar, done:S.mini.miniDone },
        allDone:false
      }}));
    }catch(_){}
  }

  function goalInit(){
    S.goalIndex = 0;
    S.goalCur = 0;
    S.goalTarget = GOALS[0].target;
    updateQuestHUD();
  }

  function goalAdvance(){
    S.goalIndex = Math.min(GOALS.length-1, S.goalIndex+1);
    S.goalCur = 0;
    S.goalTarget = GOALS[S.goalIndex].target;

    resetMiniWindow();
    updateQuestHUD();

    emit('hha:coach', { msg:`GOAL ใหม่! ${GOALS[S.goalIndex].name} ${S.goalTarget} ครั้ง`, tag:'Goal' });
  }

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function calcGrade(){
    let g='C';
    if(S.score>=175 && S.miss<=3) g='A';
    else if(S.score>=115 && S.miss<=6) g='B';
    else if(S.score>=70) g='C';
    else g='D';
    return g;
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = calcGrade();
    setShieldUI();
    updateQuestHUD();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function emitMetrics(extra={}){
    emit('hha:metrics', {
      metrics: Object.assign({
        miss: S.miss,
        combo: S.combo,
        rtAvg: S.rtAvg,
        fever: S.fever,
        score: S.score,
        aiEnabled: S.aiEnabled ? 1 : 0
      }, extra)
    });
  }

  function countTargets(){
    return DOC.querySelectorAll('.gj-target').length;
  }

  function isFarEnough(x,y, minDist){
    const els = Array.from(DOC.querySelectorAll('.gj-target'));
    const md2 = minDist*minDist;
    for(const el of els){
      const ex = Number(el.dataset.cx || 0);
      const ey = Number(el.dataset.cy || 0);
      if(!ex && !ey) continue;
      const dx = ex - x;
      const dy = ey - y;
      if(dx*dx + dy*dy < md2) return false;
    }
    return true;
  }

  function findSpawnXY(){
    const safe = getSafeRect();
    const margin = 18;
    const minDist = S.cfg.minDist;

    for(let i=0;i<16;i++){
      const x = safe.x + margin + S.rng()*(safe.w - margin*2);
      const y = safe.y + margin + S.rng()*(safe.h - margin*2);
      if(isFarEnough(x,y,minDist)){
        return { x,y };
      }
    }
    const x = safe.x + margin + S.rng()*(safe.w - margin*2);
    const y = safe.y + margin + S.rng()*(safe.h - margin*2);
    return { x,y };
  }

  function applyMiniOnHitGood(groupId){
    const now = nowMs();
    const start = S.mini.windowStartAt || (S.mini.windowStartAt = now);
    const elapsed = now - start;

    // window timeout => reset
    if(elapsed > S.mini.windowSec*1000){
      resetMiniWindow();
    }

    S.mini.windowGroups.add(Number(groupId)||1);

    const cur = S.mini.windowGroups.size;
    const tar = 3;

    // success
    if(!S.mini.miniDone && cur >= tar){
      S.mini.miniDone = true;

      // BONUS (แฟร์): +shield 1 (cap 3) + miss -1 (floor 0) + score
      S.shield = Math.min(3, S.shield + 1);
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(22);
      setFever(Math.max(0, S.fever - 6));

      emit('hha:judge', { type:'perfect', label:(before!==S.miss)?'BONUS! 🛡 + MISS-1':'BONUS! 🛡' });
      emit('hha:coach', { msg:`MINI สำเร็จ! ครบ 3 หมู่ใน ${S.mini.windowSec} วิ 🎁`, tag:'Bonus' });

      // start new window soon (ไม่ให้ bonus spam)
      setTimeout(()=>resetMiniWindow(), 520);
    }

    updateQuestHUD();
  }

  function onHit(kind, rtMs=null, meta={}){
    if(S.ended) return;

    // RT avg
    if(rtMs != null && isFinite(rtMs)){
      S.rtSamples.push(rtMs);
      if(S.rtSamples.length > 20) S.rtSamples.shift();
      const sum = S.rtSamples.reduce((a,b)=>a+b,0);
      S.rtAvg = Math.round(sum / S.rtSamples.length);
    }

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      // GOAL progress
      S.goalCur++;
      if(S.goalCur >= S.goalTarget){
        goalAdvance();
      }

      // MINI progress by group variety
      const groupId = meta.groupId || 1;
      applyMiniOnHitGood(groupId);

      // predictor feedback (label: good hit)
      S.predictor.observe({ event:'hit_good', rtMs: rtMs ?? null, missDelta: 0 });
    }

    else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
        S.predictor.observe({ event:'block_junk', rtMs: rtMs ?? null, missDelta: 0 });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
        S.predictor.observe({ event:'hit_junk', rtMs: rtMs ?? null, missDelta: 1 });
      }
    }

    else if(kind==='star'){
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });
      S.predictor.observe({ event:'pickup_star', missDelta: (before!==S.miss)? -1 : 0 });
    }

    else if(kind==='shield'){
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
      S.predictor.observe({ event:'pickup_shield', missDelta: 0 });
    }

    setHUD();
    emitMetrics({ rtMs: rtMs ?? null });
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    // cap
    if(countTargets() >= S.cfg.maxTargets){
      return;
    }

    const { x,y } = findSpawnXY();

    const el = DOC.createElement('div');
    el.className = 'gj-target spawn';
    el.dataset.kind = kind;

    // meta object for decorateTarget
    const t = { kind, rng: S.rng, groupId: null };
    if(kind === 'good'){
      t.groupId = chooseGroupId(S.rng);
      el.dataset.groupId = String(t.groupId);
    }

    decorateTarget(el, t);

    // size (emoji-based; keep comfy)
    const size =
      (kind==='good') ? 60 :
      (kind==='junk') ? 62 :
      54;

    el.style.left = x+'px';
    el.style.top  = y+'px';
    el.style.fontSize = size+'px';

    el.dataset.cx = String(x);
    el.dataset.cy = String(y);

    const born = nowMs();
    el.dataset.spawnAt = String(born);

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ el.remove(); }catch(_){}
    };

    setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(_){ } }, 140);

    el.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      const bornAt = Number(el.dataset.spawnAt || 0);
      const rt = bornAt ? (nowMs() - bornAt) : null;

      const k = el.dataset.kind || 'good';
      const gid = Number(el.dataset.groupId || 1);

      kill();
      onHit(k, rt, { groupId: gid });
    });

    layer.appendChild(el);

    // TTL fair
    const ttl =
      (kind==='star' || kind==='shield') ? S.cfg.ttlPow :
      (kind==='good') ? S.cfg.ttlGood :
      S.cfg.ttlJunk;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
        emitMetrics({ expiredGood: 1 });
        S.predictor.observe({ event:'expire_good', missDelta: 1 });
      }
    }, ttl);
  }

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const bornAt = Number(picked.dataset.spawnAt || 0);
    const rt = bornAt ? (nowMs() - bornAt) : null;

    const kind = picked.dataset.kind || 'good';
    const gid  = Number(picked.dataset.groupId || 1);

    try{ picked.remove(); }catch(_){}
    onHit(kind, rt, { groupId: gid });
  }

  function lowTimeUpdate(){
    const left = Math.ceil(S.timeLeft);
    if(left <= 5){
      if(!S.lowShown){
        S.lowShown = true;
        try{ elLow?.setAttribute('aria-hidden','false'); }catch(_){}
      }
      if(elLowNum) elLowNum.textContent = String(left);
      if(left !== S.lastLowSec){
        S.lastLowSec = left;
        emit('hha:judge', { type:'warn', label:`${left}` });
      }
    }else{
      if(S.lowShown){
        S.lowShown = false;
        try{ elLow?.setAttribute('aria-hidden','true'); }catch(_){}
      }
    }
  }

  function maybeAIAdjust(){
    if(!S.aiEnabled) return;

    // feature vector for predictor
    const feats = {
      rtAvg: S.rtAvg || 0,
      miss: S.miss,
      combo: S.combo,
      fever: S.fever,
      onScreen: countTargets(),
      diff: S.diff
    };

    const risk = S.predictor.predictRisk(feats); // 0..1

    // Fair adjust: ถ้า risk สูง (เล่นไม่ทัน) -> ผ่อนนิดหน่อย
    // ถ้า risk ต่ำ (เก่งมาก) -> เพิ่มความตื่นเต้นเล็กน้อย (แต่ไม่โหด)
    const base = CFG_BASE;

    if(risk >= 0.68){
      // ease up
      S.cfg.spawnMs = clamp(base.spawnMs + 70, base.spawnMs, base.spawnMs + 140);
      S.cfg.ttlGood = clamp(base.ttlGood + 220, base.ttlGood, base.ttlGood + 360);
      S.cfg.minDist = clamp(base.minDist + 6, base.minDist, base.minDist + 10);
    }else if(risk <= 0.32){
      // spice up (slightly)
      S.cfg.spawnMs = clamp(base.spawnMs - 40, base.spawnMs - 80, base.spawnMs);
      S.cfg.ttlGood = clamp(base.ttlGood - 120, base.ttlGood - 220, base.ttlGood);
      S.cfg.minDist = clamp(base.minDist - 3, base.minDist - 6, base.minDist);
    }else{
      // keep base-ish
      S.cfg.spawnMs = base.spawnMs;
      S.cfg.ttlGood = base.ttlGood;
      S.cfg.minDist = base.minDist;
    }

    // occasional explainable micro-tip (rate-limited inside predictor)
    const tip = S.predictor.maybeTip({ risk, feats });
    if(tip){
      emit('hha:coach', { msg: tip, tag:'AI' });
    }

    emitMetrics({ risk });
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    try{ elLow?.setAttribute('aria-hidden','true'); }catch(_){}

    const grade = calcGrade();
    const summary = {
      game:'GoodJunkVR',
      pack:'fair',
      view:S.view,
      runMode:S.run,
      diff:S.diff,
      seed:S.seed,
      durationPlannedSec:S.timePlan,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),
      scoreFinal:S.score,
      miss:S.miss,
      comboMax:S.comboMax,
      hitGood:S.hitGood,
      hitJunk:S.hitJunk,
      expireGood:S.expireGood,
      shieldRemaining:S.shield,
      rtAvgMs: S.rtAvg,
      aiEnabled: S.aiEnabled ? 1 : 0,
      grade,
      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    // MINI window countdown update
    const left = Math.max(0, Math.ceil((S.mini.windowStartAt + S.mini.windowSec*1000 - nowMs())/1000));
    if(elMiniTimer && !S.mini.miniDone) elMiniTimer.textContent = `${left}s`;
    if(left <= 0 && !S.mini.miniDone){
      resetMiniWindow();
      updateQuestHUD();
    }

    // spawn cadence
    if(ts - S.lastSpawn >= S.cfg.spawnMs){
      S.lastSpawn = ts;

      // distribution: 70% good, 26% junk, 2% star, 2% shield
      const r = S.rng();
      if(r < 0.70) spawn('good');
      else if(r < 0.96) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
    }

    lowTimeUpdate();
    maybeAIAdjust();

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;

  goalInit();
  resetMiniWindow();

  setFever(S.fever);
  setShieldUI();
  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed, ai: S.aiEnabled?1:0 });
  requestAnimationFrame(tick);
}