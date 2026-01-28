// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — v5 (Mini Rotation + Boss 2 Stage + Progress + AI safe)
// ✅ Mini quests rotate: ผ่านแล้วสลับทันที
// ✅ Boss 2 stage: HP -> Storm survival
// ✅ Progress bar fill (#gjProgressFill)
// ✅ Mobile HUD fix: safe zone auto-measure via gj:measureSafe (HTML listens)
// ✅ AI hooks safe: getDifficulty/getTip/onEvent always guarded
// ✅ Crosshair shoot (hha:shoot)
// Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:coach, hha:end

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

// --- Quests (GOALS) ---
function makeGoals(){
  return [
    { key:'clean',  name:'แยกของดี/ของเสีย', desc:'เก็บของดีให้เยอะ และอย่าโดนของเสีย', targetGood:18, maxMiss:6 },
    { key:'combo',  name:'คอมโบของดี', desc:'ทำคอมโบของดีให้ถึง 8', targetCombo:8 },
    { key:'survive',name:'ช่วงบอส', desc:'ช่วงท้ายอย่าให้พลาด (MISS ไม่เกิน 3)', maxMiss:3 }
  ];
}

// --- Mini Quest Rotation (ผ่านแล้วสลับทันที) ---
function makeMiniPool(){
  return [
    {
      key:'g3in12',
      name:'ครบ 3 หมู่ใน 12 วิ',
      desc:'ยิงของดีให้ได้ “ต่างหมู่” ครบ 3 ภายในเวลา',
      init:(S)=>{ S.mini.windowSec=12; S.mini.windowStartAt=0; S.mini.groups.clear(); S.mini.count=0; },
      onGood:(S, groupId)=>{
        const now = (performance.now?performance.now():Date.now());
        if(!S.mini.windowStartAt) S.mini.windowStartAt = now;
        if(now - S.mini.windowStartAt > S.mini.windowSec*1000){
          S.mini.windowStartAt = now;
          S.mini.groups.clear();
        }
        S.mini.groups.add(Number(groupId)||1);
        S.mini.count = S.mini.groups.size;
        return (S.mini.count >= 3);
      },
      ui:(S)=>{
        const now = (performance.now?performance.now():Date.now());
        const left = S.mini.windowStartAt ? Math.max(0, (S.mini.windowSec*1000 - (now - S.mini.windowStartAt))/1000) : S.mini.windowSec;
        return { text:`ครบ 3 หมู่ใน ${S.mini.windowSec} วิ (${S.mini.count||0}/3)`, timer:`${left.toFixed(0)}s` };
      }
    },
    {
      key:'streak6',
      name:'คอมโบ 6 ติด',
      desc:'ยิงของดีติดกัน 6 ครั้ง (ห้ามพลาด)',
      init:(S)=>{ S.mini.count=0; },
      onGood:(S)=>{ S.mini.count = clamp(S.combo,0,99); return (S.mini.count >= 6); },
      onMissOrJunk:(S)=>{ S.mini.count = 0; },
      ui:(S)=>({ text:`คอมโบ 6 ติด (${Math.min(6,S.mini.count||0)}/6)`, timer:'—' })
    },
    {
      key:'block2',
      name:'บล็อค 2 ครั้ง',
      desc:'เก็บโล่ แล้วบล็อคขยะให้ได้ 2 ครั้ง',
      init:(S)=>{ S.mini.count=0; },
      onBlock:(S)=>{ S.mini.count++; return (S.mini.count >= 2); },
      ui:(S)=>({ text:`บล็อคขยะ 2 ครั้ง (${Math.min(2,S.mini.count||0)}/2)`, timer:'—' })
    }
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

  // ✅ boss UI (from patched HTML)
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

    // ✅ mini rotation state
    miniPool: makeMiniPool(),
    miniIndex: 0,
    mini: {
      activeKey:'g3in12',
      windowSec:12,
      windowStartAt:0,
      groups:new Set(),
      count:0,
      done:false
    },

    // ✅ boss 2 stage
    boss: {
      active:false,
      mode:'hp', // 'hp' -> 'storm'
      startedAtSec:null,
      durationSec: 10,
      hp:100,
      hpMax:100,
      stormSec: 8,
      stormStartSec:null,
      cleared:false
    }
  };

  const adaptiveOn = (run === 'play');
  const aiOn = (run === 'play');

  // ✅ AI hooks (safe guard)
  const AI = (() => {
    try{ return createAIHooks({ game:'GoodJunkVR', mode: run, rng }); }catch(_){ return {}; }
  })();

  function AI_getDifficulty(played, base){
    try{
      if(AI && typeof AI.getDifficulty === 'function') return AI.getDifficulty(played, base);
    }catch(_){}
    return { ...base };
  }
  function AI_getTip(played){
    try{
      if(AI && typeof AI.getTip === 'function') return AI.getTip(played);
    }catch(_){}
    return null;
  }
  function AI_onEvent(type, payload){
    try{
      if(AI && typeof AI.onEvent === 'function') AI.onEvent(type, payload);
    }catch(_){}
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
    if(S.score >= 210 && S.miss <= 3) return 'A';
    if(S.score >= 140 && S.miss <= 6) return 'B';
    if(S.score >= 80) return 'C';
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

  // --- goals ---
  function currentGoal(){ return S.goals[S.goalIndex] || S.goals[0]; }

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

  // --- mini rotation ---
  function currentMini(){
    return S.miniPool[S.miniIndex] || S.miniPool[0];
  }

  function startMini(idx = null){
    if(typeof idx === 'number') S.miniIndex = (idx % S.miniPool.length + S.miniPool.length) % S.miniPool.length;

    const m = currentMini();
    S.mini.activeKey = m.key;
    S.mini.done = false;
    S.mini.windowStartAt = 0;
    S.mini.groups.clear();
    S.mini.count = 0;

    try{ if(m.init) m.init(S); }catch(_){}
    emit('hha:coach', { msg:`🎯 MINI: ${m.name}`, tag:'Coach' });
    updateQuestUI();
  }

  function completeMini(){
    if(S.mini.done) return;
    S.mini.done = true;

    // reward rule: if miss high -> shield else star-like benefit
    const preferShield = (S.miss >= 2 || S.boss.active);
    if(preferShield){
      S.shield = Math.min(3, S.shield + 1);
      addScore(18);
      emit('hha:judge', { type:'perfect', label:'MINI BONUS 🛡️' });
      emit('hha:coach', { msg:'ได้โบนัส: 🛡️ +1', tag:'Coach' });
    }else{
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(22);
      emit('hha:judge', { type:'perfect', label:(before!==S.miss)?'MINI MISS-1':'MINI ⭐' });
      emit('hha:coach', { msg:'ได้โบนัส: ลด MISS -1', tag:'Coach' });
    }

    setHUD();

    // rotate immediately
    const next = (S.miniIndex + 1) % S.miniPool.length;
    setTimeout(()=>startMini(next), 380);
  }

  function updateQuestUI(){
    const g = currentGoal();
    if(elGoalName) elGoalName.textContent = g?.name || '—';

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

    const m = currentMini();
    let miniText = `${m.name}`;
    let miniTimer = '—';
    try{
      const ui = m.ui ? m.ui(S) : null;
      if(ui?.text) miniText = ui.text;
      if(ui?.timer != null) miniTimer = ui.timer;
    }catch(_){}

    if(elMiniText){
      elMiniText.textContent = S.mini.done ? `ผ่านแล้ว! 🎁` : miniText;
    }
    if(elMiniTimer){
      elMiniTimer.textContent = S.mini.done ? 'DONE' : miniTimer;
    }

    emit('quest:update', {
      goal:{ name:g?.name||'—', sub:g?.desc||'—', cur, target, done:false },
      mini:{ name:m?.name||'—', sub:m?.desc||'—', cur:S.mini.count||0, target:999, done:S.mini.done },
      allDone:false
    });
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

  // --- boss UI ---
  function setBossUI(active){
    if(!elBossBar) return;
    elBossBar.setAttribute('aria-hidden', active ? 'false' : 'true');
    emit('gj:measureSafe', {}); // HTML will re-measure
  }
  function updateBossUI(){
    if(!elBossFill) return;

    if(S.boss.mode === 'hp'){
      const p = clamp(S.boss.hp / S.boss.hpMax, 0, 1);
      elBossFill.style.width = `${Math.round(p*100)}%`;
    }else{
      // storm: bar shows time left
      const played = S.timePlan - S.timeLeft;
      const left = Math.max(0, S.boss.stormSec - (played - (S.boss.stormStartSec || played)));
      const p = (S.boss.stormSec > 0) ? clamp(left / S.boss.stormSec, 0, 1) : 0;
      elBossFill.style.width = `${Math.round(p*100)}%`;
    }
  }

  function startBossIfNeeded(){
    if(S.boss.active || S.boss.cleared) return;

    const played = S.timePlan - S.timeLeft;
    const triggerAt = Math.max(18, S.timePlan * 0.70);
    if(played >= triggerAt){
      S.boss.active = true;
      S.boss.mode = 'hp';
      S.boss.startedAtSec = played;
      S.boss.hp = S.boss.hpMax = (diff === 'hard') ? 140 : (diff === 'easy') ? 100 : 120;
      setBossUI(true);
      if(elBossHint) elBossHint.textContent = 'Stage 1: เก็บของดีเพื่อลด HP / อย่าโดนของเสีย!';
      setFever(Math.min(100, S.fever + 10));
      emit('hha:coach', { msg:'⚡ เข้าสู่ BOSS! Stage 1: ตบ HP ด้วยของดี!', tag:'Coach' });
      updateBossUI();
    }
  }

  function startStormStage(){
    const played = S.timePlan - S.timeLeft;
    S.boss.mode = 'storm';
    S.boss.stormStartSec = played;
    if(elBossHint) elBossHint.textContent = 'Stage 2: STORM! เอาตัวรอด 8 วิ (หลบของเสีย)';
    emit('hha:coach', { msg:'🌪️ STORM STAGE! หลบของเสียให้รอด!', tag:'Coach' });
    updateBossUI();
  }

  function endBoss(success){
    if(!S.boss.active) return;
    S.boss.active = false;
    S.boss.cleared = !!success;
    setBossUI(false);

    if(success){
      addScore(160);
      setFever(Math.max(0, S.fever - 20));
      S.shield = Math.min(3, S.shield + 1);
      emit('hha:judge', { type:'perfect', label:'BOSS CLEAR!' });
      emit('hha:coach', { msg:'🏆 BOSS CLEAR! โบนัสใหญ่ + โล่เพิ่ม!', tag:'Coach' });
    }else{
      emit('hha:coach', { msg:'จบช่วงบอส! รอบหน้าลองคุมจังหวะให้แน่นขึ้นนะ', tag:'Coach' });
    }
    setHUD();
  }

  // --- hits ---
  function onHit(kind, extra = {}){
    if(S.ended) return;

    const tNow = performance.now?.() || Date.now();

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });
      AI_onEvent('hitGood', { t:tNow });

      // mini progress
      try{
        const m = currentMini();
        let ok = false;
        if(m?.onGood) ok = !!m.onGood(S, extra.groupId);
        S.mini.count = S.mini.count || 0;
        if(ok) completeMini();
      }catch(_){}

      // boss HP damage
      if(S.boss.active && S.boss.mode === 'hp'){
        S.boss.hp = Math.max(0, S.boss.hp - 7);
        updateBossUI();
        if(S.boss.hp <= 0){
          startStormStage(); // go to stage2 instead of ending
        }
      }
    }

    else if(kind==='junk'){
      if(S.shield>0){
        S.shield--;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
        AI_onEvent('block', { t:tNow });

        // mini progress for block2
        try{
          const m = currentMini();
          if(m?.onBlock){
            const ok = !!m.onBlock(S);
            if(ok) completeMini();
          }
        }catch(_){}

      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
        AI_onEvent('hitJunk', { t:tNow });

        // mini reset for streak mini
        try{
          const m = currentMini();
          if(m?.onMissOrJunk) m.onMissOrJunk(S);
        }catch(_){}

        // boss punishment
        if(S.boss.active && S.boss.mode === 'hp'){
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

    // AI tip occasionally
    if(aiOn){
      const played = S.timePlan - S.timeLeft;
      const tip = AI_getTip(played);
      if(tip) emit('hha:coach', tip);
    }

    setHUD();
    updateQuestUI();
    advanceGoalIfDone();
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

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

    const size = (kind==='good') ? 56 : (kind==='junk') ? 58 : 52;
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
        AI_onEvent('miss', { t: performance.now?.() || Date.now() });

        // mini reset for streak mini
        try{
          const m = currentMini();
          if(m?.onMissOrJunk) m.onMissOrJunk(S);
        }catch(_){}

        // boss punish
        if(S.boss.active && S.boss.mode === 'hp'){
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

    // close boss if active
    if(S.boss.active) endBoss(false);

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
    const summary = {
      game:'GoodJunkVR',
      pack:'fair-v5-mini-boss2',
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

    // base dist
    let base = { spawnMs: 900, pGood: 0.70, pJunk: 0.26, pStar: 0.02, pShield: 0.02 };

    if(diff === 'easy'){ base.spawnMs=980; base.pJunk=0.22; base.pGood=0.74; }
    else if(diff === 'hard'){ base.spawnMs=820; base.pJunk=0.30; base.pGood=0.66; }

    // boss stage overrides
    if(S.boss.active){
      if(S.boss.mode === 'hp'){
        base.spawnMs = Math.max(540, base.spawnMs - 240);
        base.pJunk = Math.min(0.52, base.pJunk + 0.14);
        base.pGood = Math.max(0.40, base.pGood - 0.12);
        base.pStar += 0.01;
        base.pShield += 0.02;
      }else{
        // storm: fast + junk heavy
        base.spawnMs = 520;
        base.pJunk = 0.46;
        base.pGood = 0.46;
        base.pStar = 0.03;
        base.pShield = 0.05;
      }
    }

    const D = (adaptiveOn && aiOn)
      ? AI_getDifficulty(played, base)
      : (adaptiveOn ? {
          spawnMs: Math.max(560, base.spawnMs - (played>8 ? (played-8)*5 : 0)),
          pGood: base.pGood - Math.min(0.10, played*0.002),
          pJunk: base.pJunk + Math.min(0.10, played*0.002),
          pStar: base.pStar,
          pShield: base.pShield
        } : { ...base });

    // normalize
    {
      let s = (D.pGood||0) + (D.pJunk||0) + (D.pStar||0) + (D.pShield||0);
      if(s <= 0) s = 1;
      D.pGood/=s; D.pJunk/=s; D.pStar/=s; D.pShield/=s;
      D.spawnMs = clamp(D.spawnMs, 520, 1400);
    }

    if(ts - S.lastSpawn >= D.spawnMs){
      S.lastSpawn = ts;
      const r = S.rng();
      if(r < D.pGood) spawn('good');
      else if(r < D.pGood + D.pJunk) spawn('junk');
      else if(r < D.pGood + D.pJunk + D.pStar) spawn('star');
      else spawn('shield');
    }

    // boss stage timers
    if(S.boss.active){
      if(S.boss.mode === 'hp' && S.boss.startedAtSec != null){
        if(played - S.boss.startedAtSec >= S.boss.durationSec){
          // if not cleared HP by time -> fail boss
          endBoss(false);
        }
      }
      if(S.boss.mode === 'storm'){
        if(S.boss.stormStartSec == null) S.boss.stormStartSec = played;
        const left = S.boss.stormSec - (played - S.boss.stormStartSec);
        updateBossUI();
        if(left <= 0){
          // survive success if miss not too high in boss goal spirit
          const ok = (S.miss <= (diff==='hard' ? 7 : diff==='easy' ? 9 : 8));
          endBoss(ok);
        }
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
  setFever(S.fever);
  setShieldUI();
  setHUD();

  // init mini at start
  startMini(0);

  updateQuestUI();
  updateProgress();

  // ensure boss bar hidden on start
  setBossUI(false);

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair-v5-mini-boss2', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}