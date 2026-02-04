// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — v4.2 (Boss+Progress+Missions+End Summary + LAYOUT FIX)
// ✅ FIX: target position uses LAYER rect (no more top-left bug)
// ✅ FIX: force position:absolute in JS (robust even if CSS delayed)
// ✅ FIX: cVR spawns paired targets (left+right) with same uid, counted once
// ✅ FIX: onShoot uses ev.detail.x/y when provided
// ✅ AI hooks compat with CLASSIC script (window.HHA.createAIHooks)
// ✅ Never crash if AI missing (stub getDifficulty/getTip/onEvent)
// ✅ Supports shoot from both: hha:shoot and gj:shoot
// ✅ PATCH (Step 2): Standardize hha:end schema:
//    { game, reason, runMode, diff, seed, timePlannedSec, scoreFinal, comboMax, miss, accuracyPct, grade, ... }
//    + keep legacy aliases (durationPlannedSec, accuracyGoodPct, misses, etc.)
'use strict';

import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';
import { awardBadge, hasBadge, getPid } from '../badges.safe.js';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

/** BADGES helper */
function badgeMeta(extra){
  let pid = '';
  try{ pid = (typeof getPid === 'function') ? (getPid()||'') : ''; }catch(_){}
  let q;
  try{ q = new URL(location.href).searchParams; }catch(_){ q = new URLSearchParams(); }
  const base = {
    pid,
    run: String(q.get('run')||'').toLowerCase() || 'play',
    diff: String(q.get('diff')||'').toLowerCase() || 'normal',
    time: Number(q.get('time')||0) || 0,
    seed: Number(q.get('seed')||0) || 0,
    view: String(q.get('view')||'').toLowerCase() || '',
    style: String(q.get('style')||'').toLowerCase() || '',
    game: 'goodjunk'
  };
  if(extra && typeof extra === 'object'){
    for(const k of Object.keys(extra)) base[k] = extra[k];
  }
  return base;
}

function awardOnce(gameKey, badgeId, meta){
  try{
    return !!awardBadge(gameKey, badgeId, badgeMeta(meta));
  }catch(_){
    return false;
  }
}

/** อ่าน safe vars แล้วคืนค่าเป็น number px */
function cssPx(varName, fallback){
  try{
    const v = getComputedStyle(DOC.documentElement).getPropertyValue(varName);
    const n = parseFloat(String(v || '').trim());
    return Number.isFinite(n) ? n : fallback;
  }catch{
    return fallback;
  }
}

/** ✅ Safe rect relative to a specific layer element */
function getSafeRectForLayer(layerEl){
  const r = layerEl.getBoundingClientRect();
  const topSafe = cssPx('--gj-top-safe', 90);
  const botSafe = cssPx('--gj-bottom-safe', 95);

  // safe padding inside layer
  const padX = 14;

  // coordinates are RELATIVE TO layer (not viewport)
  const x = padX;
  const y = Math.max(8, topSafe); // keep away from HUD
  const w = Math.max(140, r.width - padX*2);
  const h = Math.max(190, r.height - y - botSafe);

  return { x,y,w,h, rect:r };
}

/** ยิงจากจุด (x,y) viewport แล้ว pick target ที่ใกล้สุดใน lockPx */
function pickByShootAt(x, y, lockPx=28){
  const els = Array.from(DOC.querySelectorAll('.gj-target'));
  let best = null;

  for(const el of els){
    const b = el.getBoundingClientRect();
    if(!b.width || !b.height) continue;

    const inside =
      (x >= b.left - lockPx && x <= b.right + lockPx) &&
      (y >= b.top  - lockPx && y <= b.bottom + lockPx);

    if(!inside) continue;

    const ex = (b.left + b.right) / 2;
    const ey = (b.top  + b.bottom) / 2;
    const dx = (ex - x);
    const dy = (ey - y);
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }
  return best ? best.el : null;
}

// --- Target decoration ---
function chooseGroupId(rng){
  return 1 + Math.floor((typeof rng === 'function' ? rng() : Math.random()) * 5);
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
  }
}

// --- Quests ---
function makeGoals(){
  return [
    { key:'clean', name:'แยกของดี/ของเสีย', desc:'เก็บของดีให้เยอะ และอย่าโดนของเสีย', targetGood:18, maxMiss:6 },
    { key:'combo', name:'คอมโบของดี', desc:'ทำคอมโบของดีให้ถึง 8', targetCombo:8 },
    { key:'survive', name:'ช่วงบอส', desc:'ช่วงท้ายอย่าให้พลาด (MISS ไม่เกิน 3)', maxMiss:3 }
  ];
}

// ✅ AI safe wrapper (CLASSIC script compat)
function makeAI(opts){
  let ai = null;
  try{
    if(WIN.HHA && WIN.HHA.AIHooks && typeof WIN.HHA.AIHooks.create === 'function'){
      ai = WIN.HHA.AIHooks.create(opts || {});
    }else if(WIN.HHA && typeof WIN.HHA.createAIHooks === 'function'){
      ai = WIN.HHA.createAIHooks(opts || {});
    }
  }catch(_){ ai = null; }

  ai = ai || {};
  if(typeof ai.onEvent !== 'function') ai.onEvent = ()=>{};
  if(typeof ai.getTip !== 'function') ai.getTip = ()=>null;
  if(typeof ai.getDifficulty !== 'function') ai.getDifficulty = (_sec, base)=>Object.assign({}, base||{});
  if(typeof ai.enabled !== 'boolean') ai.enabled = false;

  return ai;
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');

  const elGoalName   = DOC.getElementById('hud-goal');
  const elGoalDesc   = DOC.getElementById('goalDesc');
  const elGoalCur    = DOC.getElementById('hud-goal-cur');
  const elGoalTarget = DOC.getElementById('hud-goal-target');

  const elMiniText  = DOC.getElementById('hud-mini');
  const elMiniTimer = DOC.getElementById('miniTimer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const elLowOverlay = DOC.getElementById('lowTimeOverlay');
  const elLowNum = DOC.getElementById('gj-lowtime-num');

  // ✅ progress
  const elProgFill = DOC.getElementById('gjProgressFill');

  // ✅ boss UI (optional in HTML; safe if missing)
  const elBossBar  = DOC.getElementById('bossBar');
  const elBossFill = DOC.getElementById('bossFill');
  const elBossHint = DOC.getElementById('bossHint');

  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const rng = makeRNG(seed);

  // map uid -> { els:[...], alive:boolean, kind:string, groupId:number|null }
  const Pair = new Map();
  let uidSeq = 1;

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score:0, miss:0,
    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,

    goals: makeGoals(),
    goalIndex: 0,

    mini: { windowSec: 12, windowStartAt: 0, groups: new Set(), done: false },

    boss: {
      active:false,
      startedAtSec: null,
      durationSec: 10,
      hp: 100,
      hpMax: 100,
      cleared: false
    },

    // BADGES runtime flags
    badge_streak10:false,
    badge_mini:false,
    badge_boss:false
  };

  const adaptiveOn = (run === 'play');
  const aiOn = (run === 'play');

  const AI = makeAI({ game:'GoodJunkVR', mode: run, rng, enabled: true });

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }
  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  // ✅ Standard accuracy policy for end summary:
  // judged = hitGood + hitJunk + expireGood
  function calcAccuracyPct(){
    const judged = (S.hitGood|0) + (S.hitJunk|0) + (S.expireGood|0);
    if (judged <= 0) return 100;
    const acc = (S.hitGood|0) / judged;
    return clamp(Math.round(acc * 100), 0, 100);
  }

  // ✅ Standard grade policy (same family as Groups/Hydration/Plate)
  function gradeFrom(accPct, score){
    score = Number(score)||0;
    accPct = Number(accPct)||0;
    return (accPct>=92 && score>=220) ? 'S'
      : (accPct>=86 && score>=170) ? 'A'
      : (accPct>=76 && score>=120) ? 'B'
      : (accPct>=62) ? 'C' : 'D';
  }

  // NOTE: HUD grade can remain “game-tuned” if you want; end-summary grade will be standardized.
  function gradeNow(){
    if(S.score >= 190 && S.miss <= 3) return 'A';
    if(S.score >= 125 && S.miss <= 6) return 'B';
    if(S.score >= 70) return 'C';
    return 'D';
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = gradeNow();
    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  // --- quests ---
  function currentGoal(){ return S.goals[S.goalIndex] || S.goals[0]; }
  function resetMiniWindow(){
    S.mini.windowStartAt = (performance.now ? performance.now() : Date.now());
    S.mini.groups.clear();
    S.mini.done = false;
  }

  function updateQuestUI(){
    const g = currentGoal();
    if(elGoalName) elGoalName.textContent = g?.name || '—';
    if(elGoalDesc) elGoalDesc.textContent = g?.desc || '—';

    let cur = 0, target = 1;

    if(g?.targetGood){
      cur = S.hitGood; target = g.targetGood;
      if(elGoalDesc) elGoalDesc.textContent = `${g.desc} (ของดี ≥ ${g.targetGood}, MISS ≤ ${g.maxMiss})`;
    }else if(g?.targetCombo){
      cur = S.comboMax; target = g.targetCombo;
      if(elGoalDesc) elGoalDesc.textContent = `${g.desc} (คอมโบสูงสุด ≥ ${g.targetCombo})`;
    }else{
      cur = Math.max(0, Math.floor(S.timePlan - S.timeLeft));
      target = Math.floor(S.timePlan);
      if(elGoalDesc) elGoalDesc.textContent = `${g.desc} (MISS ≤ ${g.maxMiss})`;
    }

    if(elGoalCur) elGoalCur.textContent = String(cur);
    if(elGoalTarget) elGoalTarget.textContent = String(target);

    const now = (performance.now ? performance.now() : Date.now());
    const left = Math.max(0, (S.mini.windowSec*1000 - (now - S.mini.windowStartAt)) / 1000);
    const miniCur = S.mini.groups.size;
    const miniTar = 3;

    if(elMiniText){
      elMiniText.textContent = S.mini.done
        ? `ผ่านแล้ว! 🎁 รับโบนัสแล้ว`
        : `ครบ ${miniTar} หมู่ใน ${S.mini.windowSec} วิ (${miniCur}/${miniTar})`;
    }
    if(elMiniTimer){
      elMiniTimer.textContent = S.mini.done ? 'DONE' : `${left.toFixed(0)}s`;
    }

    emit('quest:update', {
      goal:{ title:g?.name||'—', desc:g?.desc||'—', cur, target, done:false },
      mini:{ title:`ครบ ${miniTar} หมู่ใน ${S.mini.windowSec} วิ`, cur:miniCur, target:miniTar, done:S.mini.done },
      allDone:false
    });
  }

  function advanceGoalIfDone(){
    const g = currentGoal();
    let done = false;
    if(g?.targetGood) done = (S.hitGood >= g.targetGood) && (S.miss <= g.maxMiss);
    else if(g?.targetCombo) done = (S.comboMax >= g.targetCombo);

    if(done){
      const prev = S.goalIndex;
      S.goalIndex = Math.min(S.goals.length - 1, S.goals.length>0 ? (S.goalIndex + 1) : 0);
      if(S.goalIndex !== prev){
        emit('hha:coach', { msg:`GOAL ผ่านแล้ว ✅ ไปต่อ: ${currentGoal().name}`, tag:'Coach' });
      }
    }
  }

  function onHitGoodMeta(groupId){
    const now = (performance.now ? performance.now() : Date.now());
    if(!S.mini.windowStartAt) resetMiniWindow();
    if(now - S.mini.windowStartAt > S.mini.windowSec*1000) resetMiniWindow();

    if(!S.mini.done){
      S.mini.groups.add(Number(groupId)||1);
      const tar = 3;
      if(S.mini.groups.size >= tar){
        S.mini.done = true;

        // BADGE: mini_clear_1 (once per run)
        if(!S.badge_mini){
          S.badge_mini = true;
          awardOnce('goodjunk','mini_clear_1',{
            miniTar:tar,
            miniWindowSec:S.mini.windowSec|0,
            score:S.score|0,
            miss:S.miss|0,
            comboMax:S.comboMax|0
          });
        }

        const preferShield = (S.miss >= 2);
        if(preferShield){
          S.shield = Math.min(3, S.shield + 1);
          addScore(14);
          emit('hha:judge', { type:'perfect', label:'BONUS 🛡️' });
        }else{
          const before = S.miss;
          S.miss = Math.max(0, S.miss - 1);
          addScore(18);
          emit('hha:judge', { type:'perfect', label:(before!==S.miss)?'BONUS MISS-1':'BONUS ⭐' });
        }
        emit('hha:coach', { msg:`สุดยอด! ครบ 3 หมู่ใน ${S.mini.windowSec} วิ 🎁 โบนัสแล้ว!`, tag:'Coach' });
      }
    }
  }

  // --- low time overlay ---
  function updateLowTime(){
    if(!elLowOverlay || !elLowNum) return;
    const t = Math.ceil(S.timeLeft);
    if(t <= 5 && t >= 0){
      elLowOverlay.setAttribute('aria-hidden','false');
      elLowNum.textContent = String(t);
    }else{
      elLowOverlay.setAttribute('aria-hidden','true');
    }
  }

  // --- progress ---
  function updateProgress(){
    if(!elProgFill) return;
    const played = clamp(S.timePlan - S.timeLeft, 0, S.timePlan);
    const p = (S.timePlan > 0) ? (played / S.timePlan) : 0;
    elProgFill.style.width = `${Math.round(p*100)}%`;
  }

  // --- boss ui ---
  function setBossUI(active){
    if(!elBossBar) return;
    elBossBar.setAttribute('aria-hidden', active ? 'false' : 'true');
    emit('gj:measureSafe', {}); // boot will remeasure now
  }
  function updateBossUI(){
    if(!elBossFill) return;
    const p = clamp(S.boss.hp / S.boss.hpMax, 0, 1);
    elBossFill.style.width = `${Math.round(p*100)}%`;
  }

  function startBossIfNeeded(){
    if(S.boss.active || S.boss.cleared) return;

    const played = S.timePlan - S.timeLeft;
    const triggerAt = Math.max(18, S.timePlan * 0.70);
    if(played >= triggerAt){
      S.boss.active = true;
      S.boss.startedAtSec = played;
      S.boss.hp = S.boss.hpMax = (diff === 'hard') ? 120 : (diff === 'easy') ? 90 : 100;
      setBossUI(true);
      updateBossUI();
      if(elBossHint) elBossHint.textContent = 'โหมดบอส: เก็บของดีเพื่อลดพลังบอส / อย่าโดนของเสีย!';
      emit('hha:coach', { msg:'⚡ เข้าสู่ BOSS PHASE! เก็บของดีให้แม่น ๆ', tag:'Coach' });
      setFever(Math.min(100, S.fever + 8));
    }
  }

  function endBoss(success){
    if(!S.boss.active) return;
    S.boss.active = false;
    S.boss.cleared = !!success;
    setBossUI(false);

    if(success){
      // BADGE: boss_clear_1
      if(!S.badge_boss){
        S.badge_boss = true;
        awardOnce('goodjunk','boss_clear_1', {
          score:S.score|0,
          miss:S.miss|0,
          comboMax:S.comboMax|0,
          hitGood:S.hitGood|0,
          hitJunk:S.hitJunk|0,
          expireGood:S.expireGood|0
        });
      }

      addScore(120);
      setFever(Math.max(0, S.fever - 18));
      emit('hha:judge', { type:'perfect', label:'BOSS CLEAR!' });
      emit('hha:coach', { msg:'🏆 บอสแพ้แล้ว! เก่งมาก!', tag:'Coach' });
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
    }else{
      emit('hha:coach', { msg:'จบช่วงบอส! รอบหน้าลองเน้นของดีให้มากขึ้นนะ', tag:'Coach' });
    }
    setHUD();
  }

  // --- hits ---
  function onHit(kind, extra = {}){
    if(S.ended) return;
    const tNow = performance.now();

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // BADGE: streak_10
      if(!S.badge_streak10 && S.combo >= 10){
        S.badge_streak10 = true;
        awardOnce('goodjunk','streak_10',{
          combo:S.combo|0,
          comboMax:S.comboMax|0,
          score:S.score|0,
          miss:S.miss|0
        });
      }

      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      if(extra.groupId) onHitGoodMeta(extra.groupId);
      emit('hha:judge', { type:'good', label:'GOOD' });
      if(aiOn) AI.onEvent('hitGood', { t:tNow });

      if(S.boss.active){
        S.boss.hp = Math.max(0, S.boss.hp - 6);
        updateBossUI();
        if(S.boss.hp <= 0) endBoss(true);
      }
    }
    else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
        if(aiOn) AI.onEvent('hitJunk', { t:tNow });

        if(S.boss.active){
          S.boss.hp = Math.min(S.boss.hpMax, S.boss.hp + 10);
          updateBossUI();
        }
      }
    }
    else if(kind==='star'){
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });
    }
    else if(kind==='shield'){
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    if(aiOn){
      const played = S.timePlan - S.timeLeft;
      const tip = AI.getTip(played);
      if(tip) emit('hha:coach', tip);
    }

    setHUD();
    updateQuestUI();
    advanceGoalIfDone();
  }

  /** ลบ/ฆ่าเป้าแบบ uid (รองรับ cVR pair) */
  function killUid(uid){
    const p = Pair.get(uid);
    if(!p || !p.alive) return;
    p.alive = false;
    for(const el of p.els){
      try{ el.remove(); }catch(_){}
    }
    Pair.delete(uid);
  }

  /** สร้าง element target (ใช้ได้ทั้ง L/R) */
  function makeTargetEl(kind, obj, sizePx){
    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    // ✅ robustness even if CSS delayed
    t.style.position = 'absolute';
    t.style.lineHeight = '1';
    t.style.willChange = 'transform,left,top';

    if(kind === 'good' || kind === 'junk'){
      decorateTarget(t, obj);
    }else{
      t.textContent = (kind==='star') ? '⭐' : '🛡️';
    }

    t.style.fontSize = sizePx + 'px';
    return t;
  }

  /** spawn หนึ่งเป้า (ใน PC/mobile = 1 element, ใน cVR = 2 elements UID เดียว) */
  function spawn(kind){
    if(S.ended) return;
    if(!layerL) return;

    const isCVR = DOC.body.classList.contains('view-cvr') && !!layerR;

    const size = (kind==='good') ? 56 : (kind==='junk') ? 58 : 52;

    const obj = { kind, rng: S.rng, groupId:null };
    if(kind === 'good') obj.groupId = chooseGroupId(S.rng);

    const uid = String(uidSeq++);

    // เลือกตำแหน่งจาก layerL เสมอ แล้ว map ไป layerR (ให้เหมือนกันทั้งสองตา)
    const safeL = getSafeRectForLayer(layerL);
    const xL = safeL.x + S.rng()*safeL.w;
    const yL = safeL.y + S.rng()*safeL.h;

    const elL = makeTargetEl(kind, obj, size);
    elL.dataset.uid = uid;

    elL.style.left = Math.round(xL) + 'px';
    elL.style.top  = Math.round(yL) + 'px';

    let els = [elL];

    if(isCVR){
      const safeR = getSafeRectForLayer(layerR);
      // scale x to right layer width (in case widths differ a bit)
      const xRatio = safeR.w / Math.max(1, safeL.w);
      const xR = safeR.x + (xL - safeL.x) * xRatio;
      const yR = yL; // same y

      const elR = makeTargetEl(kind, obj, size);
      elR.dataset.uid = uid;
      elR.style.left = Math.round(xR) + 'px';
      elR.style.top  = Math.round(yR) + 'px';
      els.push(elR);
    }

    Pair.set(uid, { els, alive:true, kind, groupId: obj.groupId });

    function hitThis(){
      const p = Pair.get(uid);
      if(!p || !p.alive || S.ended) return;
      killUid(uid);
      if(kind === 'good') onHit('good', { groupId: obj.groupId });
      else onHit(kind);
    }

    for(const el of els){
      el.addEventListener('pointerdown', hitThis, { passive:true });
    }

    layerL.appendChild(elL);
    if(isCVR && els[1] && layerR) layerR.appendChild(els[1]);

    const ttl = (kind==='star' || kind==='shield') ? 1700 : 1600;

    setTimeout(()=>{
      const p = Pair.get(uid);
      if(!p || !p.alive || S.ended) return;

      // timeout: only "good" counts as miss on expire (your original rule)
      killUid(uid);

      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        if(aiOn) AI.onEvent('miss', { t:performance.now() });

        if(S.boss.active){
          S.boss.hp = Math.min(S.boss.hpMax, S.boss.hp + 12);
          updateBossUI();
        }

        setHUD();
        updateQuestUI();
      }
    }, ttl);
  }

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;

    // ✅ use explicit xy if provided; fallback to center
    let x = Number(ev?.detail?.x);
    let y = Number(ev?.detail?.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)){
      const r = DOC.documentElement.getBoundingClientRect();
      x = r.left + r.width/2;
      y = r.top  + r.height/2;
    }

    if(aiOn) AI.onEvent('shoot', { t:performance.now() });

    const picked = pickByShootAt(x, y, lockPx);
    if(!picked) return;

    const uid = picked.dataset.uid || null;
    const kind = picked.dataset.kind || 'good';
    const groupId = picked.dataset.group ? Number(picked.dataset.group) : null;

    if(uid){
      // remove both eyes
      killUid(uid);
    }else{
      try{ picked.remove(); }catch(_){}
    }

    if(kind === 'good') onHit('good', { groupId });
    else onHit(kind);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    if(S.boss.active) endBoss(false);

    // --- badges on end (score_80p, perfect_run) ---
    // keep old badge policy (fine)
    const judged = Math.max(1, (S.hitGood|0) + (S.hitJunk|0) + (S.expireGood|0));
    const acc01 = (S.hitGood|0) / judged;

    if(acc01 >= 0.80){
      awardOnce('goodjunk','score_80p',{
        accuracy: Number(acc01.toFixed(4)),
        hitGood:S.hitGood|0,
        hitJunk:S.hitJunk|0,
        expireGood:S.expireGood|0,
        miss:S.miss|0,
        scoreFinal:S.score|0,
        comboMax:S.comboMax|0,
        bossCleared: !!S.boss.cleared
      });
    }
    if((S.miss|0) === 0){
      awardOnce('goodjunk','perfect_run',{
        accuracy: Number(acc01.toFixed(4)),
        hitGood:S.hitGood|0,
        hitJunk:S.hitJunk|0,
        expireGood:S.expireGood|0,
        miss:S.miss|0,
        scoreFinal:S.score|0,
        comboMax:S.comboMax|0,
        bossCleared: !!S.boss.cleared
      });
    }

    // ✅ STANDARD END SUMMARY (Step 2)
    const accuracyPct = calcAccuracyPct();
    const grade = gradeFrom(accuracyPct, S.score);

    const summary = {
      // --- STANDARD keys (เหมือน Hydration/Groups/Plate) ---
      game: 'goodjunk',
      reason: reason || 'end',
      runMode: S.run,
      diff: S.diff,
      seed: S.seed,
      timePlannedSec: S.timePlan,
      scoreFinal: S.score|0,
      comboMax: S.comboMax|0,
      miss: S.miss|0,
      accuracyPct,
      grade,

      // --- extra useful context ---
      pack: 'fair-v4.2-boss-layout',
      view: S.view,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),
      hitGood: S.hitGood|0,
      hitJunk: S.hitJunk|0,
      expireGood: S.expireGood|0,
      shieldRemaining: S.shield|0,
      bossCleared: !!S.boss.cleared,

      // --- LEGACY aliases (กันของเดิมพัง) ---
      durationPlannedSec: S.timePlan,
      run: S.run,
      misses: S.miss|0,
      accuracyGoodPct: Math.round(((judged>0)?((S.hitGood/judged)*100):100)*10)/10 // 1 decimal
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    try{
      WIN.removeEventListener('hha:shoot', onShoot);
      WIN.removeEventListener('gj:shoot', onShoot);
    }catch(_){}
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

    updateLowTime();
    updateProgress();
    startBossIfNeeded();

    const played = (S.timePlan - S.timeLeft);

    let base = { spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 };

    if(diff === 'easy'){ base.spawnMs=980; base.pJunk=0.22; base.pGood=0.74; }
    else if(diff === 'hard'){ base.spawnMs=820; base.pJunk=0.30; base.pGood=0.66; }

    if(S.boss.active){
      base.spawnMs = Math.max(520, base.spawnMs - 260);
      base.pJunk = Math.min(0.52, base.pJunk + 0.16);
      base.pGood = Math.max(0.40, base.pGood - 0.14);
      base.pStar = base.pStar + 0.01;
      base.pShield = base.pShield + 0.02;
    }

    const D = (adaptiveOn && aiOn) ? AI.getDifficulty(played, base)
            : (adaptiveOn ? {
                spawnMs: Math.max(560, base.spawnMs - (played>8 ? (played-8)*5 : 0)),
                pGood: base.pGood - Math.min(0.10, played*0.002),
                pJunk: base.pJunk + Math.min(0.10, played*0.002),
                pStar: base.pStar,
                pShield: base.pShield
              } : { ...base });

    // normalize
    {
      let s = D.pGood + D.pJunk + D.pStar + D.pShield;
      if(s <= 0) s = 1;
      D.pGood/=s; D.pJunk/=s; D.pStar/=s; D.pShield/=s;
    }

    if(ts - S.lastSpawn >= D.spawnMs){
      S.lastSpawn = ts;
      const r = S.rng();
      if(r < D.pGood) spawn('good');
      else if(r < D.pGood + D.pJunk) spawn('junk');
      else if(r < D.pGood + D.pJunk + D.pStar) spawn('star');
      else spawn('shield');
    }

    if(S.boss.active && S.boss.startedAtSec != null){
      if(played - S.boss.startedAtSec >= S.boss.durationSec){
        endBoss(false);
      }
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  resetMiniWindow();
  setFever(S.fever);
  setShieldUI();
  setHUD();
  updateQuestUI();
  updateProgress();
  setBossUI(false);

  // BADGE: first_play
  awardOnce('goodjunk','first_play',{});

  // listen both shoot events
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });
  WIN.addEventListener('gj:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair-v4.2-boss-layout', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}