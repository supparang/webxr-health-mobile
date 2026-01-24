// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.2: STAR+SHIELD + SHOOT + FOOD5 + MINI QUEST)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ Food 5 groups mapping (TH) for GOOD targets
// ✅ Mini quest: collect 3 different groups in 12s => bonus
// ✅ Low-time overlay (last 5s)
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:coach, quest:update, hha:end

'use strict';

// NOTE: file is ES module (because we export boot)
import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
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
  const cs = getComputedStyle(DOC.documentElement);

  const top = parseInt(cs.getPropertyValue('--gj-top-safe')) || 168;
  const bot = parseInt(cs.getPropertyValue('--gj-bottom-safe')) || 140;

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

  return { x,y,w,h };
}

function pickByShoot(lockPx=28){
  // pick .gj-target that overlaps the center-crosshair window, closest to center
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

/* -----------------------------
 * FOOD5 + Decorate target
 * ----------------------------- */
function chooseGroupId(rng){
  return 1 + Math.floor((rng ? rng() : Math.random()) * 5); // 1..5
}

function decorateTarget(el, t){
  if(!el || !t) return;

  if(t.kind === 'good'){
    const gid = Number(t.groupId || 1);
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
    el.dataset.group = 'star';
    el.setAttribute('aria-label', `STAR ⭐`);
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'shield';
    el.setAttribute('aria-label', `SHIELD 🛡️`);
  }
}

/* -----------------------------
 * Mini quest meta: 3 groups in 12s
 * ----------------------------- */
const GJ_META = {
  windowSec: 12,
  windowStartAt: 0,
  windowGroups: new Set(),
  miniDone: false,
};

function resetMiniWindow(){
  GJ_META.windowStartAt = nowMs();
  GJ_META.windowGroups.clear();
  GJ_META.miniDone = false;
}

export function boot(opts={}){
  // --- params
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  // --- dom
  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elGoalName   = DOC.getElementById('hud-goal');
  const elGoalDesc   = DOC.getElementById('goalDesc');
  const elGoalCur    = DOC.getElementById('hud-goal-cur');
  const elGoalTarget = DOC.getElementById('hud-goal-target');

  const elMiniDesc   = DOC.getElementById('hud-mini');
  const elMiniTimer  = DOC.getElementById('miniTimer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const elLowOverlay = DOC.getElementById('lowTimeOverlay');
  const elLowNum     = DOC.getElementById('gj-lowtime-num');

  const rng = makeRNG(seed);

  // --- state
  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan,
    timeLeft: timePlan,
    seed,
    rng,

    score:0,
    miss:0,             // ✅ miss = good expired + junk hit (blocked junk not count)
    hitGood:0,
    hitJunk:0,
    expireGood:0,

    combo:0,
    comboMax:0,

    // star/shield
    shield:0,           // remaining
    hitStar:0,
    hitShield:0,

    fever:18,

    // goal system
    goalIndex: 0,
    goalStartAt: 0,
    goalsCleared: 0,
    goalsTotal: 5,

    lastTick:0,
    lastSpawn:0,
  };

  // init mini
  resetMiniWindow();

  // --- goals (simple, fast, kid-friendly)
  const GOALS = [
    {
      name: 'เริ่มต้น: ของดี 8 ชิ้น',
      desc: 'แตะ/ยิงของดีให้ได้ 8 ชิ้น',
      target: 8,
      cur: ()=> S.hitGood,
      done: ()=> S.hitGood >= 8,
      onStart: ()=>{},
    },
    {
      name: 'คอมโบ 6',
      desc: 'ทำคอมโบให้ถึง 6 (อย่าโดนของเสีย)',
      target: 6,
      cur: ()=> Math.min(S.comboMax, 6),
      done: ()=> S.comboMax >= 6,
      onStart: ()=>{},
    },
    {
      name: 'ชิลด์ช่วยชีวิต',
      desc: 'เก็บ 🛡️ ให้ได้อย่างน้อย 1 ครั้ง',
      target: 1,
      cur: ()=> Math.min(S.hitShield, 1),
      done: ()=> S.hitShield >= 1,
      onStart: ()=>{},
    },
    {
      name: 'ลดพลาดด้วย ⭐',
      desc: 'เก็บ ⭐ อย่างน้อย 1 ครั้ง (ช่วยลด MISS)',
      target: 1,
      cur: ()=> Math.min(S.hitStar, 1),
      done: ()=> S.hitStar >= 1,
      onStart: ()=>{},
    },
    {
      name: 'รอบสุดท้าย: ของดี 6 ชิ้น',
      desc: 'เก็บของดีเพิ่มอีก 6 ชิ้นก่อนหมดเวลา',
      target: 6,
      cur: ()=>{
        // counts from goal start snapshot
        return Math.min(S.hitGood - S._g5BaseGood, 6);
      },
      done: ()=> (S.hitGood - S._g5BaseGood) >= 6,
      onStart: ()=>{
        S._g5BaseGood = S.hitGood;
      },
    },
  ];

  function curGoal(){
    return GOALS[Math.max(0, Math.min(GOALS.length-1, S.goalIndex))];
  }

  function setText(node, v){ if(node) node.textContent = String(v); }

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function computeGrade(){
    // very simple grade
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';
    return g;
  }

  function updateHUD(){
    setText(elScore, S.score);
    setText(elTime,  Math.ceil(S.timeLeft));
    setText(elMiss,  S.miss);
    setText(elGrade, computeGrade());
    setShieldUI();

    // goal UI
    const g = curGoal();
    const gCur = clamp(g.cur(), 0, g.target);
    setText(elGoalName, g.name);
    setText(elGoalDesc, g.desc);
    setText(elGoalCur, gCur);
    setText(elGoalTarget, g.target);

    // mini UI
    const now = nowMs();
    const elapsed = (now - GJ_META.windowStartAt) / 1000;
    const remain = Math.max(0, Math.ceil(GJ_META.windowSec - elapsed));
    const cur = GJ_META.windowGroups.size;
    const tar = 3;

    setText(elMiniDesc, `ครบ ${tar} หมู่ใน ${GJ_META.windowSec} วิ (โบนัส!)`);
    setText(elMiniTimer, `${cur}/${tar} · ${remain}s`);

    // emit score
    emit('hha:score',{ score:S.score });

    // emit quest:update for HUD/peek
    emit('quest:update', {
      goal: { name:g.name, sub:g.desc, cur:gCur, target:g.target },
      mini: { name:`ครบ ${tar} หมู่ใน ${GJ_META.windowSec} วิ`, sub:'โบนัส SHIELD/คะแนน', cur, target:tar, done:GJ_META.miniDone },
      allDone: (S.goalsCleared >= S.goalsTotal)
    });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score < 0) S.score = 0;
  }

  function lowTimeUI(){
    if(!elLowOverlay || !elLowNum) return;
    const t = Math.ceil(S.timeLeft);
    if(t <= 5 && t > 0){
      elLowOverlay.setAttribute('aria-hidden','false');
      elLowNum.textContent = String(t);
    }else{
      elLowOverlay.setAttribute('aria-hidden','true');
    }
  }

  function advanceGoalIfDone(){
    const g = curGoal();
    if(!g) return;

    if(g.done()){
      S.goalsCleared = Math.min(S.goalsTotal, S.goalsCleared + 1);
      emit('hha:judge', { type:'perfect', label:'GOAL CLEAR!' });

      // bonus small
      addScore(25);
      setFever(Math.max(0, S.fever - 4));

      // next goal
      S.goalIndex = Math.min(GOALS.length-1, S.goalIndex + 1);
      S.goalStartAt = nowMs();

      // call onStart
      try{ curGoal().onStart?.(); }catch(_){}
    }
  }

  function onMiniHitGood(groupId){
    const now = nowMs();
    if(now - GJ_META.windowStartAt > GJ_META.windowSec*1000){
      resetMiniWindow();
    }
    GJ_META.windowGroups.add(Number(groupId||1));

    const cur = GJ_META.windowGroups.size;
    const tar = 3;

    if(!GJ_META.miniDone && cur >= tar){
      GJ_META.miniDone = true;

      // ✅ bonus: give shield +1 (cap 3) + score, fair & immediate
      const before = S.shield;
      S.shield = Math.min(3, S.shield + 1);
      if(S.shield > before) S.hitShield += 0; // (hitShield counts only when collecting shield target)
      addScore(18);
      setFever(Math.max(0, S.fever - 6));

      emit('hha:coach', { msg:`สุดยอด! ครบ ${tar} หมู่ใน ${GJ_META.windowSec} วิ 🎁 ได้โบนัส!`, tag:'mini' });
      emit('hha:judge', { type:'perfect', label:'BONUS!' });

      // reset window for next cycle (after short beat)
      setTimeout(()=>resetMiniWindow(), 250);
    }
  }

  function onHit(kind, tMeta=null){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);

      // mini meta: group collecting
      const gid = Number(tMeta?.groupId || 1);
      onMiniHitGood(gid);

      emit('hha:judge', { type:'good', label:'GOOD' });
    }

    else if(kind==='junk'){
      // shield blocks junk -> NOT MISS
      if(S.shield > 0){
        S.shield--;
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
      }else{
        S.hitJunk++;
        S.miss++;             // ✅ junk hit counts miss
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
      }
    }

    else if(kind==='star'){
      S.hitStar++;
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);     // ✅ reduce miss by 1
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });
    }

    else if(kind==='shield'){
      S.hitShield++;
      S.shield = Math.min(3, S.shield + 1);
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    advanceGoalIfDone();
    updateHUD();
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const node = DOC.createElement('div');
    node.className = 'gj-target spawn';
    node.dataset.kind = kind;

    // meta per target
    const meta = { kind, rng: S.rng, groupId: 1 };

    if(kind === 'good'){
      meta.groupId = chooseGroupId(S.rng);
    }

    decorateTarget(node, meta);

    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    node.style.left = x+'px';
    node.style.top  = y+'px';
    node.style.fontSize = size+'px';

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive = false;
      try{ node.remove(); }catch(_){}
    };

    node.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind, meta);
    });

    layer.appendChild(node);

    // TTL (แฟร์ ไม่แว้บ)
    const ttl = (kind==='star' || kind==='shield') ? 1700 : 1650;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      // ✅ good expires => MISS
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo = 0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        updateHUD();
      }
    }, ttl);
  }

  // ✅ Crosshair shoot support
  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';

    // try to read groupId if present
    const gid = Number(picked.dataset.group || 1);

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId: gid });
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = computeGrade();

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

      // ✅ miss definition
      miss:S.miss,
      hitGood:S.hitGood,
      hitJunk:S.hitJunk,
      expireGood:S.expireGood,

      comboMax:S.comboMax,

      hitStar:S.hitStar,
      hitShield:S.hitShield,
      shieldRemaining:S.shield,

      goalsCleared:S.goalsCleared,
      goalsTotal:S.goalsTotal,

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
    setText(elTime, Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    lowTimeUI();

    // spawn every ~900ms
    if(ts - S.lastSpawn >= 900){
      S.lastSpawn = ts;

      // fair distribution:
      // 70% good, 26% junk, 2% star, 2% shield
      const r = S.rng();
      if(r < 0.70) spawn('good');
      else if(r < 0.96) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
    }

    if(S.timeLeft <= 0){
      endGame('timeup');
      return;
    }

    // update mini timer text smoothly
    updateHUD();

    requestAnimationFrame(tick);
  }

  // --- start
  S.started = true;
  S.goalStartAt = nowMs();
  try{ curGoal().onStart?.(); }catch(_){}

  setFever(S.fever);
  setShieldUI();
  updateHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', {
    game:'GoodJunkVR',
    pack:'fair',
    view, runMode:run, diff,
    timePlanSec: timePlan,
    seed
  });

  requestAnimationFrame(tick);
}