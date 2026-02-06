// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — v4.3-std+PATCH1 (Boss+Progress+Missions+End Summary + HISTORY)
// ✅ FIX: target position uses LAYER rect (no more top-left bug)
// ✅ FIX: force position:absolute in JS (robust even if CSS delayed)
// ✅ FIX: cVR spawns paired targets (left+right) with same uid, counted once
// ✅ FIX: onShoot uses ev.detail.x/y when provided
// ✅ AI hooks compat with CLASSIC script (window.HHA.createAIHooks)
// ✅ Never crash if AI missing (stub getDifficulty/getTip/onEvent)
// ✅ Supports shoot from both: hha:shoot and gj:shoot
// ✅ PATCH: Standardize hha:end summary + save HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY + legacy keys
// ✅ PATCH1: Safe rect INSIDE layer (do NOT subtract --gj-top-safe/--gj-bottom-safe again) + soft top clamp

'use strict';

import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';
import { awardBadge, getPid } from '../badges.safe.js';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function nowMs(){
  try{ return (performance && performance.now) ? performance.now() : Date.now(); }catch(_){ return Date.now(); }
}

function saveLastAndHistory(summary){
  try{
    localStorage.setItem(LS_LAST, JSON.stringify(summary));
    const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
    hist.unshift({
      ts: summary.ts || Date.now(),
      game: summary.game || 'goodjunk',
      score: summary.scoreFinal ?? summary.score ?? 0,
      grade: summary.grade || '',
      diff: summary.diff || '',
      run: summary.runMode || ''
    });
    localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 50)));
  }catch(_){}
}

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

/** ✅ PATCH1: Safe rect INSIDE layer (do NOT subtract --gj-top-safe/--gj-bottom-safe again)
    เพราะ CSS ทำ layer ให้เป็น safe-area แล้ว:
    #gj-layer { top: var(--gj-top-safe); bottom: var(--gj-bottom-safe); ... }
*/
function getSafeRectForLayer(layerEl){
  const r = layerEl.getBoundingClientRect();

  // padding ภายใน layer กันเป้าชนขอบเล็กน้อย
  const padX = 14;
  const padY = 10;

  const x = padX;
  const y = padY;

  const w = Math.max(160, r.width  - padX*2);
  const h = Math.max(220, r.height - padY*2);

  return { x, y, w, h, rect:r };
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

function gradeFrom(score, accPct, miss){
  if(score >= 260 && accPct >= 90 && miss <= 2) return 'S';
  if(score >= 190 && accPct >= 85) return 'A';
  if(score >= 125 && accPct >= 75) return 'B';
  if(score >= 70) return 'C';
  return 'D';
}
function tierFrom(grade){
  return (grade === 'S') ? '🏆 Master'
    : (grade === 'A') ? '🔥 Elite'
    : (grade === 'B') ? '⚡ Skilled'
    : (grade === 'C') ? '✅ Ok'
    : '🧊 Warm-up';
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

  const elProgFill = DOC.getElementById('gjProgressFill');

  const elBossBar  = DOC.getElementById('bossBar');
  const elBossFill = DOC.getElementById('bossFill');
  const elBossHint = DOC.getElementById('bossHint');

  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const rng = makeRNG(seed);

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

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function resetMiniWindow(){
    S.mini.windowStartAt = nowMs();
    S.mini.groups.clear();
    S.mini.done = false;
  }

  function updateQuestUI(){
    const g = S.goals[S.goalIndex] || S.goals[0];
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

    const now = nowMs();
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
    const g = S.goals[S.goalIndex] || S.goals[0];
    let done = false;
    if(g?.targetGood) done = (S.hitGood >= g.targetGood) && (S.miss <= g.maxMiss);
    else if(g?.targetCombo) done = (S.comboMax >= g.targetCombo);

    if(done){
      const prev = S.goalIndex;
      S.goalIndex = Math.min(S.goals.length - 1, S.goals.length>0 ? (S.goalIndex + 1) : 0);
      if(S.goalIndex !== prev){
        emit('hha:coach', { msg:`GOAL ผ่านแล้ว ✅ ไปต่อ: ${(S.goals[S.goalIndex]||{}).name||'—'}`, tag:'Coach' });
      }
    }
  }

  function onHitGoodMeta(groupId){
    const now = nowMs();
    if(!S.mini.windowStartAt) resetMiniWindow();
    if(now - S.mini.windowStartAt > S.mini.windowSec*1000) resetMiniWindow();

    if(!S.mini.done){
      S.mini.groups.add(Number(groupId)||1);
      const tar = 3;
      if(S.mini.groups.size >= tar){
        S.mini.done = true;

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

  function updateProgress(){
    if(!elProgFill) return;
    const played = clamp(S.timePlan - S.timeLeft, 0, S.timePlan);
    const p = (S.timePlan > 0) ? (played / S.timePlan) : 0;
    elProgFill.style.width = `${Math.round(p*100)}%`;
  }

  function setBossUI(active){
    if(!elBossBar) return;
    elBossBar.setAttribute('aria-hidden', active ? 'false' : 'true');
    emit('gj:measureSafe', {});
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

  function onHit(kind, extra = {}){
    if(S.ended) return;
    const tNow = nowMs();

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

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

  function killUid(uid){
    const p = Pair.get(uid);
    if(!p || !p.alive) return;
    p.alive = false;
    for(const el of p.els){
      try{ el.remove(); }catch(_){}
    }
    Pair.delete(uid);
  }

  function makeTargetEl(kind, obj, sizePx){
    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

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

  function spawn(kind){
    if(S.ended) return;
    if(!layerL) return;

    const isCVR = DOC.body.classList.contains('view-cvr') && !!layerR;

    const size = (kind==='good') ? 56 : (kind==='junk') ? 58 : 52;

    const obj = { kind, rng: S.rng, groupId:null };
    if(kind === 'good') obj.groupId = chooseGroupId(S.rng);

    const uid = String(uidSeq++);

    // ✅ PATCH1: pick inside layer safe rect (layer already excludes HUD-safe via CSS)
    const safeL = getSafeRectForLayer(layerL);
    const xL = safeL.x + S.rng()*safeL.w;

    // ✅ soft top clamp: กันอัดแน่นใกล้ขอบบนของ layer (มือถือจอเตี้ย)
    const topBias = 6; // 0-14 ได้
    const yL = safeL.y + topBias + S.rng()*(Math.max(10, safeL.h - topBias));

    const elL = makeTargetEl(kind, obj, size);
    elL.dataset.uid = uid;

    elL.style.left = Math.round(xL) + 'px';
    elL.style.top  = Math.round(yL) + 'px';

    let els = [elL];

    if(isCVR){
      const safeR = getSafeRectForLayer(layerR);
      const xRatio = safeR.w / Math.max(1, safeL.w);
      const xR = safeR.x + (xL - safeL.x) * xRatio;
      const yR = yL;

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

      killUid(uid);

      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        if(aiOn) AI.onEvent('miss', { t:nowMs() });

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

    let x = Number(ev?.detail?.x);
    let y = Number(ev?.detail?.y);
    if(!Number.isFinite(x) || !Number.isFinite(y)){
      const r = DOC.documentElement.getBoundingClientRect();
      x = r.left + r.width/2;
      y = r.top  + r.height/2;
    }

    if(aiOn) AI.onEvent('shoot', { t:nowMs() });

    const picked = pickByShootAt(x, y, lockPx);
    if(!picked) return;

    const uid = picked.dataset.uid || null;
    const kind = picked.dataset.kind || 'good';
    const groupId = picked.dataset.group ? Number(picked.dataset.group) : null;

    if(uid){
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

    // ✅ accuracy (judged only; no double-count)
    const judged = Math.max(0, (S.hitGood|0) + (S.hitJunk|0) + (S.expireGood|0));
    const acc = judged ? (S.hitGood / judged) : 0;
    const accPct = Math.round(acc * 1000) / 10; // 1 decimal

    // end badges
    if(acc >= 0.80){
      awardOnce('goodjunk','score_80p',{
        accuracy: Number(acc.toFixed(4)),
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
        accuracy: Number(acc.toFixed(4)),
        hitGood:S.hitGood|0,
        hitJunk:S.hitJunk|0,
        expireGood:S.expireGood|0,
        miss:S.miss|0,
        scoreFinal:S.score|0,
        comboMax:S.comboMax|0,
        bossCleared: !!S.boss.cleared
      });
    }

    const playedSec = Math.round(clamp(S.timePlan - S.timeLeft, 0, S.timePlan));

    const grade = gradeFrom(S.score|0, accPct, S.miss|0);
    const tier = tierFrom(grade);

    const summary = {
      game:'goodjunk',
      ts: Date.now(),
      pack:'goodjunk-v4.3-std+patch1',

      reason,

      view:S.view,
      runMode:S.run,
      diff:S.diff,
      seed:S.seed,

      timePlannedSec:S.timePlan,
      timePlayedSec: playedSec,

      scoreFinal:S.score|0,
      grade,
      tier,

      miss:S.miss|0,
      comboMax:S.comboMax|0,

      accuracyPct: accPct,
      judgedShots: judged|0,

      hitGood:S.hitGood|0,
      hitJunk:S.hitJunk|0,
      expireGood:S.expireGood|0,

      shieldRemaining:S.shield|0,
      bossCleared: !!S.boss.cleared,

      // ✅ legacy keys (กันของเก่า/หน้า summary เดิม)
      misses: S.miss|0,
      durationPlannedSec: S.timePlan,
      durationPlayedSec: playedSec
    };

    saveLastAndHistory(summary);

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

  awardOnce('goodjunk','first_play',{});

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });
  WIN.addEventListener('gj:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'goodjunk', pack:'goodjunk-v4.3-std+patch1', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}