// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — v4.1 (Boss+Progress) — PATCH 4
// ✅ FIX: AI.getDifficulty missing -> guard + fallback
// ✅ FIX: Spawn safe rect true-safe (anti-edge + target padding)
// ✅ Boss Phase: HP bar + rules
// ✅ Progress bar fill
// ✅ Mobile HUD fix relies on CSS + gj:measureSafe wiring in HTML
// ✅ GOAL/MINI + AI hooks + crosshair shoot

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

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 90;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 95;

  const x = 22;
  const y = Math.max(64, top);
  const w = Math.max(140, r.width - 44);
  const h = Math.max(190, r.height - y - bot);
  return { x,y,w,h, vw:r.width, vh:r.height };
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

  // ✅ boss UI
  const elBossBar  = DOC.getElementById('bossBar');
  const elBossFill = DOC.getElementById('bossFill');
  const elBossHint = DOC.getElementById('bossHint');

  const layer = DOC.getElementById('gj-layer');

  const rng = makeRNG(seed);

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

    // ✅ boss phase
    boss: {
      active:false,
      startedAtSec: null,
      durationSec: 10,
      hp: 100,
      hpMax: 100,
      cleared: false
    }
  };

  const adaptiveOn = (run === 'play');
  const aiOn = (run === 'play');

  // ✅ AI hooks (guard)
  const AI = createAIHooks({ game:'GoodJunkVR', mode: run, rng });

  // ✅ fallback if any method missing (prevents crash)
  function aiGetDifficulty(played, base){
    try{
      if(AI && typeof AI.getDifficulty === 'function') return AI.getDifficulty(played, base);
    }catch(_){}
    // fallback deterministic-ish
    const b = Object.assign({}, base);
    const ramp = clamp((played||0) / 70, 0, 1);
    b.spawnMs = clamp(b.spawnMs - ramp*140, 520, 1200);
    b.pGood   = clamp(b.pGood - ramp*0.06, 0.35, 0.85);
    b.pJunk   = clamp(b.pJunk + ramp*0.06, 0.10, 0.55);
    return b;
  }
  function aiOnEvent(name, payload){
    try{ if(AI && typeof AI.onEvent === 'function') AI.onEvent(name, payload); }catch(_){}
  }
  function aiGetTip(played){
    try{ if(AI && typeof AI.getTip === 'function') return AI.getTip(played); }catch(_){}
    return null;
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
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      if(extra.groupId) onHitGoodMeta(extra.groupId);
      emit('hha:judge', { type:'good', label:'GOOD' });
      if(aiOn) aiOnEvent('hitGood', { t:tNow });

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
        if(aiOn) aiOnEvent('hitJunk', { t:tNow });

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
      const tip = aiGetTip(played);
      if(tip) emit('hha:coach', tip);
    }

    setHUD();
    updateQuestUI();
    advanceGoalIfDone();
  }

  // ✅ TRUE-SAFE spawn point (anti-edge + target padding)
  function pickSpawnXY(kind){
    const safe = getSafeRect();

    // target size approx (px)
    const size = (kind==='good') ? 56 : (kind==='junk') ? 58 : 52;
    const pad = Math.max(26, Math.floor(size*0.58)); // keep away from edges

    // reduce available area by padding
    const sx = safe.x + pad;
    const sy = safe.y + pad;
    const sw = Math.max(40, safe.w - pad*2);
    const sh = Math.max(40, safe.h - pad*2);

    const x = sx + S.rng()*sw;
    const y = sy + S.rng()*sh;

    return { x, y, size };
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const pos = pickSpawnXY(kind);

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    const obj = { kind, rng: S.rng, groupId:null };

    if(kind === 'good'){
      obj.groupId = chooseGroupId(S.rng);
      decorateTarget(t, obj);
    }else if(kind === 'junk'){
      decorateTarget(t, obj);
    }else{
      t.textContent = (kind==='star') ? '⭐' : '🛡️';
    }

    t.style.left = pos.x+'px';
    t.style.top  = pos.y+'px';
    t.style.fontSize = pos.size+'px';

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

    layer.appendChild(t);

    const ttl = (kind==='star' || kind==='shield') ? 1700 : 1600;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        if(aiOn) aiOnEvent('miss', { t:performance.now() });

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

    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    const groupId = picked.dataset.group ? Number(picked.dataset.group) : null;

    try{ picked.remove(); }catch(_){}
    if(kind === 'good') onHit('good', { groupId });
    else onHit(kind);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    if(S.boss.active) endBoss(false);

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
    const summary = {
      game:'GoodJunkVR',
      pack:'fair-v4.1-boss',
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

    const D =
      (adaptiveOn && aiOn)
        ? aiGetDifficulty(played, base)
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

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair-v4.1-boss', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}