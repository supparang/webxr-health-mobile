// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK + AI PACK (v3)
// ✅ Spacious spawn: uses --gj-top-safe / --gj-bottom-safe (CSS)
// ✅ MISS = good expired + junk hit (shield block NOT miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Missions: GOAL chain + MINI quest via quest:update (Plate-compatible)
// ✅ DD FAIR: adjust spawn/ttl/ratios every 1s (play only; research OFF)
// ✅ AI Prediction: miss-burst risk -> coach tip + suggest assist
// ✅ DL-ready: telemetry feature tail in summary (no heavy inference)
// ✅ Input: tap/click OR crosshair shoot via event hha:shoot
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:coach, quest:update, hha:end
//
// Requires:
//   - /herohealth/vr-goodjunk/goodjunk.ai-pack.js  (createGoodJunkAIPack)
//   - /herohealth/vr/food5-th.js (emojiForGroup, labelForGroup, pickEmoji, JUNK)
//
// NOTE: ใน research mode (run=research) จะ "ปิด DD" และคงค่าคงที่ (deterministic-friendly)

'use strict';

import { createGoodJunkAIPack } from './goodjunk.ai-pack.js';
import { emojiForGroup, labelForGroup, pickEmoji, JUNK } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

function nowMs(){ return (performance?.now?.() ?? Date.now()); }

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const st = getComputedStyle(DOC.documentElement);
  const top = parseInt(st.getPropertyValue('--gj-top-safe')) || 140;
  const bot = parseInt(st.getPropertyValue('--gj-bottom-safe')) || 130;

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

  return { x,y,w,h };
}

function pickByShoot(lockPx=28){
  // pick topmost .gj-target that overlaps the center-crosshair window
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

// Food 5 groups: 1..5 เท่า ๆ กัน (ปรับ weighted ได้ภายหลัง)
function chooseGroupId(rng){
  return 1 + Math.floor((rng ? rng() : Math.random()) * 5);
}

function decorateTarget(el, t){
  // t.kind: 'good' | 'junk' | 'star' | 'shield'
  if(!el) return;

  if(t.kind === 'good'){
    const gid = t.groupId || 1;
    const emo = emojiForGroup(t.rng, gid);
    el.textContent = emo;
    el.dataset.group = String(gid);
    el.setAttribute('aria-label', `${labelForGroup(gid)} ${emo}`);
  }
  else if(t.kind === 'junk'){
    const emo = pickEmoji(t.rng, JUNK.emojis);
    el.textContent = emo;
    el.dataset.group = 'junk';
    el.setAttribute('aria-label', `${JUNK.labelTH} ${emo}`);
  }
  else if(t.kind === 'star'){
    el.textContent = '⭐';
    el.dataset.group = 'power';
    el.setAttribute('aria-label', `โบนัส ลดพลาด ⭐`);
  }
  else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'power';
    el.setAttribute('aria-label', `โล่ กันขยะ 🛡️`);
  }
}

function pushHistory(summary){
  try{
    const arr = JSON.parse(localStorage.getItem(LS_HIST)||'[]');
    arr.unshift(summary);
    while(arr.length>40) arr.pop();
    localStorage.setItem(LS_HIST, JSON.stringify(arr));
  }catch(_){}
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();     // play | research
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  const isPlay = (run === 'play');

  // HUD refs (optional)
  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  // Missions HUD (if exists)
  const elGoalDesc   = DOC.getElementById('goalDesc');
  const elGoalCur    = DOC.getElementById('hud-goal-cur');
  const elGoalTarget = DOC.getElementById('hud-goal-target');

  const elMiniTimer  = DOC.getElementById('miniTimer');
  const elMiniName   = DOC.getElementById('miniName') || null; // ถ้ามี

  const layer = DOC.getElementById('gj-layer');

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed,
    rng: makeRNG(seed),

    score:0,
    miss:0,                 // ✅ MISS combined
    miss_goodExpired:0,
    miss_junkHit:0,

    hitGood:0,
    hitJunk:0,
    expireGood:0,

    combo:0,
    comboMax:0,

    // mechanics
    shield:0,
    fever:18,

    // timing
    lastTick:0,
    lastSpawn:0,

    // metrics windows (5s) for predictor
    secStamp:0,
    w_miss: [0,0,0,0,0],
    w_exp:  [0,0,0,0,0],
    w_good: [0,0,0,0,0],
    w_junk: [0,0,0,0,0],

    // forced spawn queue from AI suggestions
    forceQueue: []
  };

  // --- AI PACK (missions + dd + prediction + dl-ready telemetry tail)
  const AI = createGoodJunkAIPack({
    mode: run,
    seed,
    rng: S.rng,
    nowMs,
    emit
    // dlHook: (features)=>({risk:0..1, tip:"..."}) // ยังไม่เปิดใช้จริง
  });

  // bind HUD (optional)
  AI.bindHUD({
    setGoalText: (name, sub, cur, target)=>{
      if(elGoalDesc) elGoalDesc.textContent = `${name}${sub?` — ${sub}`:''}`;
      if(elGoalCur) elGoalCur.textContent = String(cur);
      if(elGoalTarget) elGoalTarget.textContent = String(target);
    },
    setMiniText: (name, sub, cur, target, done, secLeft)=>{
      if(elMiniName) elMiniName.textContent = name || 'MINI';
      if(elMiniTimer) elMiniTimer.textContent = done ? '✓' : `${secLeft}s`;
      // ถ้าคุณมี DOM สำหรับ mini cur/target ก็เสียบเพิ่มได้
    }
  });

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
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';
    return g;
  }

  function setHUD(){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = computeGrade();

    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function bumpWindow(arr, add){
    // arr len=5
    arr[arr.length-1] = (arr[arr.length-1]||0) + (add|0);
  }

  function rotateWindowsIfNeeded(ts){
    const sec = Math.floor(ts/1000);
    if(!S.secStamp) S.secStamp = sec;
    while(S.secStamp < sec){
      S.secStamp++;
      S.w_miss.shift(); S.w_miss.push(0);
      S.w_exp.shift();  S.w_exp.push(0);
      S.w_good.shift(); S.w_good.push(0);
      S.w_junk.shift(); S.w_junk.push(0);
    }
  }

  function sum5(arr){ return arr.reduce((a,b)=>a+(b|0),0); }

  function onHit(kind, meta={}){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);

      bumpWindow(S.w_good, 1);

      // missions + mini (ต้องส่ง groupId)
      AI.onHit({
        kind:'good',
        groupId: meta.groupId || null,
        shieldRemaining: S.shield,
        fever: S.fever,
        score: S.score,
        combo: S.combo,
        miss: S.miss
      });

      emit('hha:judge', { type:'good', label:'GOOD' });
    }

    else if(kind==='junk'){
      // shield blocks junk -> NOT MISS
      if(S.shield>0){
        S.shield--;
        setShieldUI();
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
        // note: blocked junk doesn't count in window miss/junk
      }else{
        S.hitJunk++;
        S.miss_junkHit++;
        S.miss++;               // ✅ combined MISS
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);

        bumpWindow(S.w_junk, 1);
        bumpWindow(S.w_miss, 1);

        AI.onHit({ kind:'junk', fever:S.fever, combo:S.combo, miss:S.miss });
        emit('hha:judge', { type:'bad', label:'OOPS' });
      }
    }

    else if(kind==='star'){
      // ⭐ reduce miss by 1 (floor 0) + score
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(18);
      setFever(Math.max(0, S.fever - 8));
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'MISS -1!' : 'STAR!' });
    }

    else if(kind==='shield'){
      // 🛡 add 1 shield (cap 3)
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

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    const obj = { kind, rng: S.rng };

    // Food group id for good only
    if(kind === 'good'){
      obj.groupId = chooseGroupId(S.rng);
      t.dataset.groupId = String(obj.groupId);
    }

    // decorate (emoji + aria)
    decorateTarget(t, obj);

    // sizes: powerups slightly smaller
    const size =
      (kind==='good')   ? 56 :
      (kind==='junk')   ? 58 :
      52;

    t.style.left = `${x}px`;
    t.style.top  = `${y}px`;
    t.style.fontSize = `${size}px`;

    let alive = true;

    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ t.classList.add('die'); }catch(_){}
      // ให้มีเวลาจางออกนิดนึง ลดความรู้สึก “แว้บ”
      setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 120);
    };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind, { groupId: obj.groupId || null });
    }, { passive:true });

    layer.appendChild(t);

    // tell AI pack spawn info (optional)
    AI.onSpawn?.({ kind, ttlMs: 0, groupId: obj.groupId || null });

    // TTL (แฟร์ ไม่แว้บ) — จะถูก DD ปรับใน play
    const dd = AI.getDD();
    const ttl =
      (kind==='star' || kind==='shield') ? (dd.ttlPower || 1700) :
      (dd.ttlGood  || 1600);

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      // expire only good => miss
      if(kind==='good'){
        S.expireGood++;
        S.miss_goodExpired++;
        S.miss++;               // ✅ combined MISS
        S.combo = 0;
        setFever(S.fever + 5);

        bumpWindow(S.w_exp, 1);
        bumpWindow(S.w_miss, 1);

        AI.onExpireGood?.({ groupId: obj.groupId || null, fever:S.fever, miss:S.miss, combo:S.combo });
        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
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
    const gid  = Number(picked.dataset.groupId||0) || null;

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId: gid });
  }

  // listen AI suggestions (assist/reward)
  function onAISuggest(ev){
    const d = ev?.detail || {};
    // เรา “ไม่ spawn ทันที” แต่ใส่คิวให้ spawn ถัดไป (แฟร์/คุมได้)
    if(d.type === 'reward' && d.what === 'powerup'){
      S.forceQueue.push(String(d.pick||'shield'));
    }
    if(d.type === 'assist' && d.what === 'shieldOrStar'){
      // ถ้า MISS เยอะให้ shield ก่อน
      S.forceQueue.push(S.miss >= 3 ? 'shield' : 'star');
    }
  }

  function computeAccuracyApprox(){
    const total = S.hitGood + S.hitJunk + S.expireGood;
    if(total <= 0) return 1;
    return clamp(S.hitGood / total, 0, 1);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = computeGrade();

    // AI tail additions
    const aiAdd = AI.onEnd({
      reason,
      goalsDone: null
    }) || {};

    const summary = {
      game:'GoodJunkVR',
      pack:'fair+ai',
      view:S.view,
      runMode:S.run,
      diff:S.diff,
      seed:S.seed,

      durationPlannedSec:S.timePlan,
      durationPlayedSec: Math.round(S.timePlan - S.timeLeft),

      scoreFinal:S.score,
      miss:S.miss,
      miss_goodExpired:S.miss_goodExpired,
      miss_junkHit:S.miss_junkHit,

      comboMax:S.comboMax,
      hitGood:S.hitGood,
      hitJunk:S.hitJunk,
      expireGood:S.expireGood,

      feverFinal:S.fever,
      shieldRemaining:S.shield,

      accuracyApprox: Number(computeAccuracyApprox().toFixed(3)),
      grade,
      reason,

      ...aiAdd
    };

    try{ localStorage.setItem(LS_LAST, JSON.stringify(summary)); }catch(_){}
    try{ pushHistory(summary); }catch(_){}

    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}
    try{ WIN.removeEventListener('gj:ai:suggest', onAISuggest); }catch(_){}

    emit('hha:end', summary);
  }

  function spawnByRatios(){
    // choose by DD ratios (play) / fixed (research)
    // If AI queued force spawn -> serve it first
    if(S.forceQueue.length){
      const k = String(S.forceQueue.shift()||'').toLowerCase();
      if(k==='shield' || k==='star') return k;
    }

    const dd = AI.getDD();
    const ratio = dd?.ratio || { good:0.70, junk:0.26, star:0.02, shield:0.02 };

    const r = S.rng();
    if(r < ratio.good) return 'good';
    if(r < ratio.good + ratio.junk) return 'junk';
    if(r < ratio.good + ratio.junk + ratio.star) return 'star';
    return 'shield';
  }

  let last1s = 0;

  function tick(ts){
    if(S.ended) return;

    if(!S.lastTick) S.lastTick = ts;
    const dt = Math.min(0.25, (ts - S.lastTick)/1000);
    S.lastTick = ts;

    S.timeLeft = Math.max(0, S.timeLeft - dt);
    if(elTime) elTime.textContent = String(Math.ceil(S.timeLeft));
    emit('hha:time', { left:S.timeLeft });

    // rotate 5s windows using real seconds
    rotateWindowsIfNeeded(ts);

    // spawn based on DD spawnMs
    const dd = AI.getDD();
    const spawnMs = isPlay ? (dd.spawnMs || 900) : 900; // research: fixed
    if(ts - S.lastSpawn >= spawnMs){
      S.lastSpawn = ts;
      const kind = spawnByRatios();
      spawn(kind);
    }

    // 1Hz tick for AI pack (DD + Prediction + mission timers)
    if(ts - last1s >= 1000){
      last1s = ts;

      const miss5 = sum5(S.w_miss);
      const exp5  = sum5(S.w_exp);

      const total = S.hitGood + S.hitJunk + S.expireGood;
      const acc = total ? (S.hitGood / total) : 1;

      const missRate = (S.hitGood + S.hitJunk + S.expireGood) ? (S.miss / Math.max(1, (S.hitGood + S.hitJunk + S.expireGood))) : 0;

      AI.onTick1s({
        // for missions + predictor + DD fair
        acc,
        missRate,
        missBurst: miss5 >= 2 ? 1 : 0,
        missBurst5: miss5,
        expireBurst5: exp5,
        fever: S.fever,
        combo: S.combo,
        miss: S.miss
      });
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

  AI.onStart({ timePlanSec: timePlan, view, diff });

  // listen shoot + ai suggest
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });
  WIN.addEventListener('gj:ai:suggest', onAISuggest, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair+ai', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}