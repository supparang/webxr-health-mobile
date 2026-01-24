// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v3: FOOD5 + GOAL/MINI + STAR+SHIELD + SHOOT + Light-AI)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ FOOD5 mapping + decorateTarget (like Plate) via ../vr/food5-th.js
// ✅ GOAL chain + MINI: "ครบ 3 หมู่ใน 12 วิ" (HUD-ready)
// ✅ Light AI Difficulty Director (adaptive in play, OFF in research)
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:coach, quest:update, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY

'use strict';

// NOTE: This file is an ES module (because we export boot)
// FOOD5 helpers (same module used by Plate/Groups)
import { FOOD5, JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min,Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
}

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 168;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 140;

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

    const ex = (b.left + b.right)/2;
    const ey = (b.top  + b.bottom)/2;
    const dx = ex - cx;
    const dy = ey - cy;
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }
  return best ? best.el : null;
}

/* -------------------------
 * FOOD5 / decorateTarget
 * ------------------------- */
function chooseGroupId(rng){
  return 1 + Math.floor((rng ? rng() : Math.random()) * 5);
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
    el.setAttribute('aria-label', 'Star โบนัส');
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'power';
    el.setAttribute('aria-label', 'Shield บล็อคขยะ');
  }
}

/* -------------------------
 * QUEST (GOAL + MINI)
 * ------------------------- */
function makeGoalChain(){
  // พอให้ “สนุก/ท้าทาย/เร้าใจ” และเดินต่อได้แน่นอน
  // GOAL1: เก็บของดี 6 ชิ้น
  // GOAL2: เก็บของดี 10 ชิ้น
  // GOAL3: จบเกมด้วย MISS <= 3 (ฝึกเลี่ยงขยะ)
  return [
    { name:'GOAL 1', title:'เก็บของดี 6 ชิ้น',  sub:'แตะ/ยิง “ของดี” ให้ได้ 6', type:'hitGood', target:6 },
    { name:'GOAL 2', title:'เก็บของดี 10 ชิ้น', sub:'แตะ/ยิง “ของดี” ให้ได้ 10', type:'hitGood', target:10 },
    { name:'GOAL 3', title:'จบเกม MISS ≤ 3',     sub:'เลี่ยงขยะ/ไม่ปล่อยของดีหมดเวลา', type:'finalMissMax', target:3 }
  ];
}

function fmtSec(n){
  n = Math.max(0, Math.ceil(Number(n)||0));
  return `${n}s`;
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  // Research mode => deterministic + adaptive OFF
  const isResearch = (run === 'study' || run === 'research');

  // HUD refs
  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');

  const elGoalTitle  = DOC.getElementById('hud-goal');
  const elGoalDesc   = DOC.getElementById('goalDesc');
  const elGoalCur    = DOC.getElementById('hud-goal-cur');
  const elGoalTarget = DOC.getElementById('hud-goal-target');

  const elMiniTitle  = DOC.getElementById('hud-mini');
  const elMiniTimer  = DOC.getElementById('miniTimer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const layer   = DOC.getElementById('gj-layer');

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

    // spawn control (AI director can adjust in play)
    spawnEveryMs: 900,
    pGood: 0.70,
    pJunk: 0.26,
    pStar: 0.02,
    pShield: 0.02,

    // quest
    goals: makeGoalChain(),
    goalIdx: 0,           // 0..N-1
    goalCur: 0,
    goalDone: false,

    // mini quest window
    mini: {
      name: 'ครบ 3 หมู่ใน 12 วิ',
      windowSec: 12,
      windowStartAt: 0,
      groups: new Set(),
      target: 3,
      done: false,
      rewardGiven: false
    },

    lastTick:0,
    lastSpawn:0,

    // AI director stats
    ai: {
      enabled: !isResearch,
      lastAdjustAt: 0,
      shots: 0,
      hits: 0,
      hitRate: 0,
      recentMiss: 0
    }
  };

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score < 0) S.score = 0;
  }

  function computeGrade(){
    // ให้ “ยุติธรรม” ตามเวลา 70–90s
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';
    return g;
  }

  function updateQuestHUD(){
    const g = S.goals[S.goalIdx] || null;

    // GOAL
    if(g){
      if(elGoalTitle)  elGoalTitle.textContent = g.title || g.name || 'GOAL';
      if(elGoalDesc)   elGoalDesc.textContent = g.sub || '—';

      // goal progress
      let cur = 0, tar = g.target || 1;
      if(g.type === 'hitGood'){
        cur = S.hitGood;
      }else if(g.type === 'finalMissMax'){
        // แสดงเป็น “MISS ปัจจุบัน”
        cur = S.miss;
        tar = g.target;
      }else{
        cur = S.goalCur;
      }

      if(elGoalCur)    elGoalCur.textContent = String(cur);
      if(elGoalTarget) elGoalTarget.textContent = String(tar);
    }else{
      if(elGoalTitle)  elGoalTitle.textContent = 'DONE';
      if(elGoalDesc)   elGoalDesc.textContent = 'ผ่านทุก GOAL แล้ว!';
      if(elGoalCur)    elGoalCur.textContent = '1';
      if(elGoalTarget) elGoalTarget.textContent = '1';
    }

    // MINI
    const mini = S.mini;
    if(elMiniTitle){
      if(mini.done) elMiniTitle.textContent = `ผ่านแล้ว ✅ (${mini.target}/${mini.target})`;
      else elMiniTitle.textContent = `${mini.name}`;
    }

    const left = miniLeftSec();
    if(elMiniTimer){
      if(mini.done) elMiniTimer.textContent = 'ผ่านแล้ว';
      else elMiniTimer.textContent = `${mini.groups.size}/${mini.target} · เหลือ ${fmtSec(left)}`;
    }

    // Emit quest:update for logging/analytics
    try{
      emit('quest:update', {
        goal:{
          name: g ? g.title : 'DONE',
          sub:  g ? g.sub : 'ผ่านทุก GOAL แล้ว!',
          cur:  g ? (g.type==='hitGood' ? S.hitGood : (g.type==='finalMissMax' ? S.miss : S.goalCur)) : 1,
          target: g ? (g.target||1) : 1
        },
        mini:{
          name: mini.name,
          sub: 'โบนัส STAR/SHIELD',
          cur: mini.groups.size,
          target: mini.target,
          leftSec: mini.done ? 0 : left,
          done: mini.done
        },
        allDone: (!S.goals[S.goalIdx])
      });
    }catch(_){}
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);

    const g = computeGrade();
    if(elGrade) elGrade.textContent = g;

    setShieldUI();
    updateQuestHUD();

    emit('hha:score', { score:S.score, miss:S.miss, grade:g });
  }

  function miniResetWindow(){
    const m = S.mini;
    m.windowStartAt = nowMs();
    m.groups.clear();
    m.done = false;
    // rewardGiven คงไว้เพื่อกันแจกซ้ำในช่วงสั้นๆ (แต่ถ้าอยากให้ทำซ้ำได้ ให้ set false ได้)
  }

  function miniLeftSec(){
    const m = S.mini;
    const elapsed = (nowMs() - m.windowStartAt)/1000;
    return Math.max(0, m.windowSec - elapsed);
  }

  function miniOnHitGood(groupId){
    const m = S.mini;
    const elapsedMs = nowMs() - m.windowStartAt;
    if(elapsedMs > m.windowSec * 1000){
      miniResetWindow();
    }
    m.groups.add(Number(groupId)||1);

    if(!m.done && m.groups.size >= m.target){
      m.done = true;

      // reward once per run (หรืออยากให้ทำซ้ำได้ ให้เซ็ต rewardGiven=false เมื่อรีเซ็ต)
      if(!m.rewardGiven){
        m.rewardGiven = true;

        // โบนัสแบบ “แฟร์”: ให้ Shield +1 และลด fever นิดหน่อย
        S.shield = Math.min(3, S.shield + 1);
        setShieldUI();
        setFever(Math.max(0, S.fever - 10));
        addScore(20);

        emit('hha:coach', { msg:`สุดยอด! ครบ ${m.target} หมู่ใน ${m.windowSec} วิ 🎁 ได้โบนัส SHIELD!`, tag:'Coach' });
        emit('hha:judge', { type:'perfect', label:'BONUS!' });
      }
    }
  }

  function maybeAdvanceGoal(){
    const g = S.goals[S.goalIdx];
    if(!g) return;

    let ok = false;
    if(g.type === 'hitGood'){
      ok = (S.hitGood >= (g.target||1));
    }else if(g.type === 'finalMissMax'){
      // เป้าหมายนี้ “เช็คตอนจบ” เป็นหลัก แต่เรายังแสดง progress ระหว่างเล่น
      ok = false;
    }else{
      ok = (S.goalCur >= (g.target||1));
    }

    if(ok){
      S.goalIdx++;
      emit('hha:coach', { msg:'ผ่าน GOAL! ไปต่อ →', tag:'Coach' });

      // เมื่อเปลี่ยน goal ให้รีเฟรช mini window เพื่อให้ “มีจังหวะเร้าใจ”
      // และไม่ทำให้ stuck
      miniResetWindow();

      // เพิ่มความท้าทายเล็กน้อยใน play (ไม่ใช้ใน research)
      if(S.ai.enabled){
        // ยากขึ้นนิดเดียว แต่ยังแฟร์
        S.spawnEveryMs = Math.max(720, S.spawnEveryMs - 40);
        S.pJunk = Math.min(0.32, S.pJunk + 0.01);
        S.pGood = Math.max(0.62, 1 - (S.pJunk + S.pStar + S.pShield));
      }
    }
  }

  function onHit(kind, meta={}){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      // groupId for mini
      const gid = Number(meta.groupId || meta.gid || 1) || 1;
      miniOnHitGood(gid);

      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      maybeAdvanceGoal();
    }

    else if(kind==='junk'){
      // shield blocks junk -> NOT MISS
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

    setHUD();
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const el = DOC.createElement('div');
    el.className = 'gj-target spawn';
    el.dataset.kind = kind;

    const t = { kind, rng:S.rng };

    if(kind === 'good'){
      t.groupId = chooseGroupId(S.rng);
    }

    decorateTarget(el, t);

    // sizing (คล้ายเดิม แต่ปรับให้เข้ากับ emoji หลายแบบ)
    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    el.style.left = x+'px';
    el.style.top  = y+'px';
    el.style.fontSize = size+'px';

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ el.remove(); }catch(_){}
    };

    el.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind, { groupId: t.groupId });
    });

    layer.appendChild(el);

    // TTL (แฟร์ ไม่แว้บ)
    // ถ้า fever สูงให้ “เสี่ยงขึ้นนิด” โดยลด TTL ของ good เฉพาะ play
    let ttl = (kind==='star' || kind==='shield') ? 1700 : 1600;
    if(!isResearch && kind==='good'){
      ttl = Math.max(1100, ttl - Math.floor(S.fever * 2.5)); // 0..250ms ลด
    }

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
      }
    }, ttl);
  }

  /* -------------------------
   * Light AI Difficulty Director
   * ------------------------- */
  function aiAdjust(ts){
    if(!S.ai.enabled) return;
    if(ts - S.ai.lastAdjustAt < 1000) return;
    S.ai.lastAdjustAt = ts;

    // ประเมินแบบเรียบง่าย: hit rate จาก good hits เทียบกับ “การพยายาม” (hits รวม)
    const hitsTotal = S.hitGood + S.hitJunk;
    const hitRate = hitsTotal > 0 ? (S.hitGood / hitsTotal) : 0.5;
    S.ai.hitRate = hitRate;

    // ถ้าเล่นเก่งมาก -> เพิ่ม junk นิด / เร่ง spawn นิด
    // ถ้าเริ่มพลาดเยอะ -> ผ่อนนิด (แฟร์สำหรับเด็ก ป.5)
    const tooHard = (S.miss >= 6) || (hitRate < 0.45);
    const tooEasy = (S.miss <= 1 && hitRate > 0.72 && S.timeLeft > 12);

    if(tooHard){
      S.spawnEveryMs = Math.min(980, S.spawnEveryMs + 35);
      S.pJunk = Math.max(0.22, S.pJunk - 0.01);
    }else if(tooEasy){
      S.spawnEveryMs = Math.max(700, S.spawnEveryMs - 30);
      S.pJunk = Math.min(0.34, S.pJunk + 0.01);
    }

    // ทำให้ pGood สอดคล้องเสมอ (กันรวมไม่ครบ 1)
    const fixed = S.pStar + S.pShield;
    S.pGood = Math.max(0.58, 1 - (S.pJunk + fixed));
  }

  /* -------------------------
   * Shoot support (crosshair)
   * ------------------------- */
  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    const gid  = picked.dataset.group ? Number(picked.dataset.group) : 1;

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId: gid });

    // AI metric: count shot (เฉพาะยิงจาก crosshair)
    S.ai.shots++;
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = computeGrade();

    // เช็ค GOAL3 ตอนจบ (MISS <= 3)
    const g = S.goals[S.goalIdx];
    let goal3Pass = null;
    if(g && g.type === 'finalMissMax'){
      goal3Pass = (S.miss <= (g.target||3));
      if(goal3Pass){
        S.goalIdx++;
      }
    }

    const summary = {
      game:'GoodJunkVR',
      pack:'fair-v3',
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
      feverEnd:S.fever,

      goalIndexReached:S.goalIdx,
      goalTotal:S.goals.length,
      goal3Pass,

      miniDone:S.mini.done,
      miniGroups:Array.from(S.mini.groups),

      aiEnabled:S.ai.enabled,
      aiHitRate:S.ai.hitRate,
      spawnEveryMs:S.spawnEveryMs,
      pGood:S.pGood, pJunk:S.pJunk, pStar:S.pStar, pShield:S.pShield,

      grade,
      reason
    };

    // Save last + history
    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
    try{
      const raw = localStorage.getItem(LS_HIST);
      const arr = raw ? JSON.parse(raw) : [];
      if(Array.isArray(arr)){
        arr.unshift(Object.assign({ ts: Date.now() }, summary));
        while(arr.length > 40) arr.pop();
        localStorage.setItem(LS_HIST, JSON.stringify(arr));
      }
    }catch(_){}

    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    emit('hha:end', summary);
  }

  function spawnPick(){
    const r = S.rng();
    const a = S.pGood;
    const b = a + S.pJunk;
    const c = b + S.pStar;
    if(r < a) return 'good';
    if(r < b) return 'junk';
    if(r < c) return 'star';
    return 'shield';
  }

  function tick(ts){
    if(S.ended) return;
    if(!S.lastTick) S.lastTick = ts;

    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    // MINI timer update “เนียนๆ”
    if(!S.mini.done){
      const left = miniLeftSec();
      if(left <= 0){
        miniResetWindow(); // วนรอบใหม่แบบแฟร์
      }
    }

    // AI adjust (play only)
    aiAdjust(ts);

    // spawn
    if(ts - S.lastSpawn >= S.spawnEveryMs){
      S.lastSpawn = ts;
      spawn(spawnPick());
    }

    // end
    if(S.timeLeft <= 0){
      endGame('timeup');
      return;
    }

    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  S.mini.windowStartAt = nowMs(); // init mini window
  setFever(S.fever);
  setShieldUI();
  setHUD();

  // listen shoot
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', {
    game:'GoodJunkVR',
    pack:'fair-v3',
    view, runMode:run, diff,
    timePlanSec:timePlan,
    seed,
    research:isResearch,
    aiEnabled:S.ai.enabled
  });

  requestAnimationFrame(tick);
}