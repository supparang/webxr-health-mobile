// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — v5 (AIM+Boss2Stage+cVR Split)
// ✅ AIM: uses x,y from vr-ui + soft aim assist + adaptive lock expansion
// ✅ Boss: Progressive 2 stages (Stage 1 warm-up -> Stage 2 ramp)
// ✅ cVR: split 2 eyes, spawns paired targets in L/R layers, shoot picks by eye
'use strict';

import { createAIHooks } from '../vr/ai-hooks.js';
import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function isCVR(view){ return String(view||'').toLowerCase() === 'cvr'; }

function getSafeRect(view){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 82;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 92;

  const padX = 22;

  // ✅ cVR uses half width playfield per eye
  const fullW = r.width;
  const w = isCVR(view) ? Math.max(140, (fullW/2) - padX*2) : Math.max(140, fullW - padX*2);

  const x = padX;
  const y = Math.max(64, top);
  const h = Math.max(190, r.height - y - bot);

  return { x,y,w,h, fullW, fullH:r.height };
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

function chooseGroupId(rng){
  const r = (typeof rng === 'function') ? rng() : Math.random();
  return 1 + Math.floor(r * 5);
}

// --- Aim pick helpers (now supports x,y + per-eye layer) ---
function pickByShootAt(x, y, lockPx, layerEl, preferGood=false){
  if(!layerEl) return null;

  const els = Array.from(layerEl.querySelectorAll('.gj-target'));
  let best = null;

  for(const el of els){
    const b = el.getBoundingClientRect();
    if(!b.width || !b.height) continue;

    const inside =
      (x >= b.left - lockPx && x <= b.right + lockPx) &&
      (y >= b.top  - lockPx && y <= b.bottom + lockPx);

    if(!inside) continue;

    const ex = (b.left + b.right)/2;
    const ey = (b.top  + b.bottom)/2;
    const dx = ex - x;
    const dy = ey - y;
    let d2 = dx*dx + dy*dy;

    // ✅ small bias: prefer good in aim assist (optional)
    const kind = el.dataset.kind || '';
    if(preferGood && kind === 'junk') d2 *= 1.22;

    if(!best || d2 < best.d2) best = { el, d2 };
  }

  return best ? best.el : null;
}

function pickNearestSoft(x, y, softLockPx, layerEl, preferGood=true){
  if(!layerEl) return null;

  const els = Array.from(layerEl.querySelectorAll('.gj-target'));
  let best = null;

  for(const el of els){
    const b = el.getBoundingClientRect();
    if(!b.width || !b.height) continue;

    const ex = (b.left + b.right)/2;
    const ey = (b.top  + b.bottom)/2;
    const dx = ex - x;
    const dy = ey - y;
    let d = Math.sqrt(dx*dx + dy*dy);

    if(d > softLockPx) continue;

    // bias: prefer good
    const kind = el.dataset.kind || '';
    if(preferGood && kind === 'junk') d *= 1.18;

    if(!best || d < best.d) best = { el, d };
  }

  return best ? best.el : null;
}

// --- Quests ---
function makeGoals(){
  return [
    { key:'clean', name:'แยกของดี/ของเสีย', desc:'เก็บของดีให้เยอะ และอย่าโดนของเสีย', targetGood:18, maxMiss:6 },
    { key:'combo', name:'คอมโบของดี', desc:'ทำคอมโบของดีให้ถึง 8', targetCombo:8 },
    { key:'survive', name:'ช่วงบอส', desc:'ช่วงท้ายอย่าให้พลาด (MISS ไม่เกิน 3)', maxMiss:3 }
  ];
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

  const layerL = DOC.getElementById('gj-layer');     // left / normal
  const layerR = DOC.getElementById('gj-layer-r');   // right eye for cVR

  const rng = makeRNG(seed);

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score:0, miss:0,
    hitGood:0, hitJunk:0, expireGood:0,
    combo:0, comboMax:0,
    missStreak:0, // ✅ for aim assist lock expansion

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
      durationSec: 12,   // a bit longer for 2-stage feeling
      stage: 0,          // 0=off,1=warm,2=ramp
      stage2AtSec: 4.0,  // switch after 4 sec in boss phase
      hp: 100,
      hpMax: 100,
      cleared: false
    },

    pairSeq: 0,
    livePairs: new Map() // pairId -> {L,R,alive}
  };

  const adaptiveOn = (run === 'play');
  const aiOn = (run === 'play');

  const AI = createAIHooks({ game:'GoodJunkVR', mode: run, rng, diff });
  const hasGetDiff = AI && typeof AI.getDifficulty === 'function';

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }
  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

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
      goal:{ name:g?.name||'—', sub:g?.desc||'—', cur, target, done:false },
      mini:{ name:`ครบ ${miniTar} หมู่ใน ${S.mini.windowSec} วิ`, sub:'โบนัส ⭐/🛡️', cur:miniCur, target:miniTar, done:S.mini.done },
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
      S.goalIndex = Math.min(S.goals.length - 1, S.goalIndex + 1);
      if(S.goalIndex !== prev){
        emit('hha:coach', { msg:`GOAL ผ่านแล้ว ✅ ไปต่อ: ${currentGoal().name}`, tag:'Coach' });
        updateQuestUI();
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
        updateQuestUI();
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

  // --- boss ui / stages ---
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
  function setBossHint(){
    if(!elBossHint) return;
    if(S.boss.stage === 1) elBossHint.textContent = 'Stage 1: วอร์มอัพ — เน้นของดี';
    else if(S.boss.stage === 2) elBossHint.textContent = 'Stage 2: โหดขึ้น! — อย่าพลาด';
    else elBossHint.textContent = '—';
  }

  function startBossIfNeeded(){
    if(S.boss.active || S.boss.cleared) return;

    const played = S.timePlan - S.timeLeft;
    const triggerAt = Math.max(18, S.timePlan * 0.70);

    if(played >= triggerAt){
      S.boss.active = true;
      S.boss.startedAtSec = played;
      S.boss.stage = 1;
      S.boss.hp = S.boss.hpMax = (diff === 'hard') ? 130 : (diff === 'easy') ? 95 : 110;

      setBossUI(true);
      setBossHint();
      updateBossUI();

      emit('hha:coach', { msg:'⚡ เข้าสู่ BOSS PHASE! (Stage 1) โฟกัสของดีให้แม่น ๆ', tag:'Coach' });
      setFever(Math.min(100, S.fever + 8));
    }
  }

  function updateBossStage(played){
    if(!S.boss.active || S.boss.startedAtSec == null) return;
    const bossElapsed = played - S.boss.startedAtSec;

    if(S.boss.stage === 1 && bossElapsed >= S.boss.stage2AtSec){
      S.boss.stage = 2;
      setBossHint();
      emit('hha:coach', { msg:'🔥 BOSS Stage 2! โหดขึ้นแล้ว — อย่าพลาด!', tag:'Coach' });
      // small burst to make stage change feel intense
      setFever(Math.min(100, S.fever + 6));
    }
  }

  function endBoss(success){
    if(!S.boss.active) return;
    S.boss.active = false;
    S.boss.cleared = !!success;
    S.boss.stage = 0;
    setBossUI(false);

    if(success){
      addScore(140);
      setFever(Math.max(0, S.fever - 18));
      emit('hha:judge', { type:'perfect', label:'BOSS CLEAR!' });
      emit('hha:coach', { msg:'🏆 บอสแพ้แล้ว! โหดแต่คุณโหดกว่า!', tag:'Coach' });
      S.shield = Math.min(3, S.shield + 1);
      setShieldUI();
    }else{
      emit('hha:coach', { msg:'จบช่วงบอส! รอบหน้าลองเน้นของดี + ลดพลาดนะ', tag:'Coach' });
    }
    setHUD();
  }

  // --- hits ---
  function onHit(kind, extra = {}){
    if(S.ended) return;
    const tNow = (performance.now ? performance.now() : Date.now());

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.missStreak = 0;

      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      if(extra.groupId) onHitGoodMeta(extra.groupId);
      emit('hha:judge', { type:'good', label:'GOOD' });
      if(aiOn) AI.onEvent('hitGood', { t:tNow });

      if(S.boss.active){
        const dec = (S.boss.stage === 2) ? 7 : 5;
        S.boss.hp = Math.max(0, S.boss.hp - dec);
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
        S.missStreak = clamp(S.missStreak + 1, 0, 9);
        S.combo = 0;

        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
        if(aiOn) AI.onEvent('hitJunk', { t:tNow });

        if(S.boss.active){
          const inc = (S.boss.stage === 2) ? 12 : 8;
          S.boss.hp = Math.min(S.boss.hpMax, S.boss.hp + inc);
          updateBossUI();
        }
      }
    }

    else if(kind==='star'){
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      S.missStreak = Math.max(0, S.missStreak - 1);
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
      const tip = (typeof AI.getTip === 'function') ? AI.getTip(played) : null;
      if(tip) emit('hha:coach', tip);
    }

    setHUD();
    updateQuestUI();
    advanceGoalIfDone();
  }

  // --- spawn with cVR pairing ---
  function makeTargetEl(kind, obj){
    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    if(kind === 'good' || kind === 'junk'){
      decorateTarget(t, obj);
    }else{
      t.textContent = (kind==='star') ? '⭐' : '🛡️';
    }
    return t;
  }

  function removePair(pairId){
    const p = S.livePairs.get(pairId);
    if(!p) return;
    S.livePairs.delete(pairId);
    try{ p.L?.remove(); }catch(_){}
    try{ p.R?.remove(); }catch(_){}
  }

  function spawn(kind){
    if(S.ended || !layerL) return;

    const safe = getSafeRect(S.view);

    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const obj = { kind, rng: S.rng, groupId:null };
    if(kind === 'good') obj.groupId = chooseGroupId(S.rng);

    const size = (kind==='good') ? 56 : (kind==='junk') ? 58 : 52;
    const ttl = (kind==='star' || kind==='shield') ? 1700 : 1600;

    // single (pc/mobile/vr)
    if(!isCVR(S.view)){
      const t = makeTargetEl(kind, obj);
      t.style.left = x+'px';
      t.style.top  = y+'px';
      t.style.fontSize = size+'px';

      let alive = true;
      const kill = ()=>{
        if(!alive) return;
        alive=false;
        try{ t.remove(); }catch(_){}
      };

      t.addEventListener('pointerdown', ()=>{
        if(!alive || S.ended) return;
        kill();
        if(kind === 'good') onHit('good', { groupId: obj.groupId });
        else onHit(kind);
      });

      layerL.appendChild(t);

      setTimeout(()=>{
        if(!alive || S.ended) return;
        kill();
        if(kind==='good'){
          S.expireGood++;
          S.miss++;
          S.missStreak = clamp(S.missStreak + 1, 0, 9);
          S.combo=0;
          setFever(S.fever + 5);
          emit('hha:judge', { type:'miss', label:'MISS' });
          if(aiOn) AI.onEvent('miss', { t:(performance.now ? performance.now() : Date.now()) });

          if(S.boss.active){
            const inc = (S.boss.stage === 2) ? 14 : 10;
            S.boss.hp = Math.min(S.boss.hpMax, S.boss.hp + inc);
            updateBossUI();
          }

          setHUD();
          updateQuestUI();
        }
      }, ttl);

      return;
    }

    // ✅ cVR: create paired targets on L/R layers
    if(!layerR) return;

    const pairId = String(++S.pairSeq);
    const tL = makeTargetEl(kind, obj);
    const tR = makeTargetEl(kind, obj);

    tL.dataset.pair = pairId;
    tR.dataset.pair = pairId;

    if(kind === 'good'){
      tL.dataset.group = String(obj.groupId);
      tR.dataset.group = String(obj.groupId);
    }else if(kind === 'junk'){
      tL.dataset.group = 'junk';
      tR.dataset.group = 'junk';
    }

    tL.style.left = x+'px';
    tL.style.top  = y+'px';
    tL.style.fontSize = size+'px';

    tR.style.left = x+'px';
    tR.style.top  = y+'px';
    tR.style.fontSize = size+'px';

    // pointerdown only on LEFT layer is enough (right layer has pointer-events:none in css)
    tL.addEventListener('pointerdown', ()=>{
      if(S.ended) return;
      removePair(pairId);
      if(kind === 'good') onHit('good', { groupId: obj.groupId });
      else onHit(kind);
    });

    S.livePairs.set(pairId, { L:tL, R:tR });

    layerL.appendChild(tL);
    layerR.appendChild(tR);

    setTimeout(()=>{
      if(S.ended) return;
      if(!S.livePairs.has(pairId)) return;
      removePair(pairId);

      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.missStreak = clamp(S.missStreak + 1, 0, 9);
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        if(aiOn) AI.onEvent('miss', { t:(performance.now ? performance.now() : Date.now()) });

        if(S.boss.active){
          const inc = (S.boss.stage === 2) ? 14 : 10;
          S.boss.hp = Math.min(S.boss.hpMax, S.boss.hp + inc);
          updateBossUI();
        }

        setHUD();
        updateQuestUI();
      }
    }, ttl);
  }

  // --- SHOOT (now uses x,y and eye) ---
  function onShoot(ev){
    if(S.ended || !S.started) return;

    const d = ev?.detail || {};
    const lockBase = Number(d.lockPx ?? 28) || 28;

    // adaptive expansion based on miss streak + boss stage
    let lockPx = lockBase
      + Math.min(18, S.missStreak * 3)
      + (S.boss.active ? (S.boss.stage === 2 ? 10 : 6) : 0)
      + (isCVR(S.view) ? 6 : 0);

    lockPx = clamp(lockPx, 18, 64);

    // use provided x,y or fallback to center
    const r = DOC.documentElement.getBoundingClientRect();
    const x = (typeof d.x === 'number') ? d.x : (r.left + r.width/2);
    const y = (typeof d.y === 'number') ? d.y : (r.top  + r.height/2);

    let eye = d.eye || null;

    // choose layer
    let targetLayer = layerL;
    if(isCVR(S.view)){
      if(eye === 'right') targetLayer = layerR || layerL;
      else if(eye === 'left') targetLayer = layerL;
      else{
        // if unknown eye, choose by x position
        targetLayer = (x <= (r.left + r.width/2)) ? layerL : (layerR || layerL);
      }
    }

    // 1) strict within lock
    let picked = pickByShootAt(x, y, lockPx, targetLayer, true);

    // 2) soft aim assist
    if(!picked){
      const softLock = clamp(lockPx + 18, 22, 82);
      picked = pickNearestSoft(x, y, softLock, targetLayer, true);
    }

    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    const groupId = picked.dataset.group ? Number(picked.dataset.group) : null;

    // remove paired (cvr) if exists
    const pairId = picked.dataset.pair || null;
    if(pairId && S.livePairs.has(pairId)){
      removePair(pairId);
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

    // cleanup pairs
    try{
      for(const [pid] of S.livePairs) removePair(pid);
    }catch(_){}

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
    const summary = {
      game:'GoodJunkVR',
      pack:'fair-v5-boss2-cvr',
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
      bossCleared:S.boss.cleared,
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

    updateLowTime();
    updateProgress();
    startBossIfNeeded();

    const played = (S.timePlan - S.timeLeft);
    updateBossStage(played);

    let base = { spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 };
    if(diff === 'easy'){ base.spawnMs=980; base.pJunk=0.22; base.pGood=0.74; }
    else if(diff === 'hard'){ base.spawnMs=820; base.pJunk=0.30; base.pGood=0.66; }

    // ✅ boss overrides: stage-specific ramp
    if(S.boss.active){
      if(S.boss.stage === 1){
        base.spawnMs = Math.max(600, base.spawnMs - 170);
        base.pJunk   = Math.min(0.44, base.pJunk + 0.10);
        base.pGood   = Math.max(0.46, base.pGood - 0.09);
        base.pStar   = base.pStar + 0.01;
        base.pShield = base.pShield + 0.02;
      }else if(S.boss.stage === 2){
        base.spawnMs = Math.max(520, base.spawnMs - 260);
        base.pJunk   = Math.min(0.54, base.pJunk + 0.18);
        base.pGood   = Math.max(0.40, base.pGood - 0.15);
        base.pStar   = base.pStar + 0.01;
        base.pShield = base.pShield + 0.03;
      }
    }

    const D = (adaptiveOn && aiOn && hasGetDiff)
      ? AI.getDifficulty(played, base)
      : (adaptiveOn ? {
          spawnMs: Math.max(560, base.spawnMs - (played>8 ? (played-8)*5 : 0)),
          pGood: base.pGood - Math.min(0.10, played*0.002),
          pJunk: base.pJunk + Math.min(0.10, played*0.002),
          pStar: base.pStar,
          pShield: base.pShield
        } : { ...base });

    let s = D.pGood + D.pJunk + D.pStar + D.pShield;
    if(s <= 0) s = 1;
    D.pGood/=s; D.pJunk/=s; D.pStar/=s; D.pShield/=s;

    if(ts - S.lastSpawn >= D.spawnMs){
      S.lastSpawn = ts;
      const r = S.rng();
      if(r < D.pGood) spawn('good');
      else if(r < D.pGood + D.pJunk) spawn('junk');
      else if(r < D.pGood + D.pJunk + D.pStar) spawn('star');
      else spawn('shield');
    }

    // boss duration end
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

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair-v5-boss2-cvr', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}