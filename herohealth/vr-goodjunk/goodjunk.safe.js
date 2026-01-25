// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v3: QUEST + FOOD5 + STAR+SHIELD + SHOOT)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit (blocked junk NOT miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ QuestDirector: GOAL chain + MINI (3 good hits in 12s -> bonus powerup)
// ✅ Food5 mapping: good = random group emoji, junk = random junk emoji
// Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:end

import { FOOD5, JUNK, pickEmoji, emojiForGroup, labelForGroup } from '../vr/food5-th.js';

'use strict';

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

function chooseGroupId(rng){
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
  }else{
    // star/shield
    el.textContent = (t.kind==='star') ? '⭐' : '🛡️';
  }
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
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

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
  };

  // ===============================
  // QUEST DIRECTOR (Goal + Mini) — FAIR + FAST
  // ===============================
  const elGoalTitle  = DOC.getElementById('hud-goal');
  const elGoalDesc   = DOC.getElementById('goalDesc');
  const elGoalCur    = DOC.getElementById('hud-goal-cur');
  const elGoalTar    = DOC.getElementById('hud-goal-target');

  const elMiniDesc   = DOC.getElementById('hud-mini');
  const elMiniTimer  = DOC.getElementById('miniTimer');

  const Q = {
    goalIndex: 0,
    goalCur: 0,
    goalTar: 0,

    miniWinSec: 12,
    miniStartMs: 0,
    miniGoodHits: 0,
    miniDone: false,

    goals: [
      { name:'เก็บของดี',         desc:'แตะของดีให้ได้ 6 ครั้ง',                 type:'hitGood', target:6 },
      { name:'อย่าโดนของเสีย',    desc:'ห้ามโดนของเสียให้ครบ 10 วิ',             type:'noJunk',  target:10 }, // sec
      { name:'คอมโบมาแล้ว!',      desc:'ทำคอมโบให้ถึง 6',                        type:'combo',   target:6 },
      { name:'เก็บของดีต่อเนื่อง', desc:'แตะของดี 8 ครั้ง (MISS น้อยกว่า 3)',     type:'hitGoodMissCap', target:8, missCap:3 },
      { name:'สปีดรัน',           desc:'เก็บของดี 10 ครั้งให้ทัน',                type:'hitGood', target:10 },
    ],
  };

  function qEmitUpdate(allDone=false){
    try{
      WIN.dispatchEvent(new CustomEvent('quest:update', { detail:{
        goal:{
          name: Q.goals[Q.goalIndex]?.name || '—',
          sub:  Q.goals[Q.goalIndex]?.desc || '—',
          cur:  Q.goalCur,
          target: Q.goalTar
        },
        mini:{
          name: `แตะของดี ${Q.miniGoodHits}/3 ใน ${Q.miniWinSec} วิ`,
          sub: 'ทำได้ = โบนัส ⭐/🛡️',
          cur: Q.miniGoodHits,
          target: 3,
          done: Q.miniDone
        },
        allDone
      }}));
    }catch(_){}
  }

  function qRender(){
    const g = Q.goals[Q.goalIndex];
    if(elGoalTitle) elGoalTitle.textContent = g ? g.name : '—';
    if(elGoalDesc)  elGoalDesc.textContent  = g ? g.desc : '—';
    if(elGoalCur)   elGoalCur.textContent   = String(Math.floor(Q.goalCur));
    if(elGoalTar)   elGoalTar.textContent   = String(Q.goalTar);

    if(elMiniDesc){
      elMiniDesc.textContent = Q.miniDone
        ? 'ผ่านแล้ว ✅ โบนัสโผล่!'
        : `แตะของดี 3 ครั้งใน ${Q.miniWinSec} วิ`;
    }
  }

  function qSetGoal(i){
    Q.goalIndex = Math.max(0, Math.min(Q.goals.length-1, i));
    Q.goalCur = 0;
    Q.goalTar = Q.goals[Q.goalIndex].target;
    qRender();
    qEmitUpdate(false);
  }

  function qNextGoal(){
    if(Q.goalIndex < Q.goals.length-1){
      qSetGoal(Q.goalIndex + 1);
      try{ emit('hha:coach', { msg:`ไปต่อ GOAL: ${Q.goals[Q.goalIndex].name} ✅`, tag:'goal' }); }catch(_){}
    }else{
      try{ emit('hha:coach', { msg:'GOAL ครบทุกข้อแล้ว! 🎉', tag:'goal' }); }catch(_){}
      qEmitUpdate(true);
    }
  }

  function miniReset(){
    Q.miniStartMs = performance.now ? performance.now() : Date.now();
    Q.miniGoodHits = 0;
    Q.miniDone = false;
    qRender();
  }

  function miniTimerText(){
    if(!elMiniTimer) return;
    if(Q.miniDone){ elMiniTimer.textContent = 'DONE'; return; }
    const now = performance.now ? performance.now() : Date.now();
    const left = Math.max(0, Q.miniWinSec*1000 - (now - Q.miniStartMs));
    elMiniTimer.textContent = `${Math.ceil(left/1000)}s`;
  }

  function grantMiniBonus(){
    // spawn powerup ด้วยระบบเดิม (fair ไม่แว้บ)
    const preferStar = (S.shield >= 2);
    const r = S.rng();
    const kind = preferStar ? (r < 0.78 ? 'star' : 'shield') : (r < 0.50 ? 'star' : 'shield');
    spawn(kind);
    try{ emit('hha:coach', { msg:`MINI ผ่าน! 🎁 โบนัส ${kind==='star'?'⭐':'🛡️'} โผล่มาแล้ว!`, tag:'mini' }); }catch(_){}
  }

  // init quest
  qSetGoal(0);
  miniReset();

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

    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';

    if(elGrade) elGrade.textContent = g;

    setShieldUI();
    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function onHit(kind, meta=null){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      // mini window
      const now = performance.now ? performance.now() : Date.now();
      if(now - Q.miniStartMs > Q.miniWinSec*1000) miniReset();
      if(!Q.miniDone){
        Q.miniGoodHits++;
        if(Q.miniGoodHits >= 3){
          Q.miniDone = true;
          grantMiniBonus();
          setTimeout(miniReset, 250);
        }
      }

      // goal progress
      const g = Q.goals[Q.goalIndex];
      if(g){
        if(g.type === 'hitGood'){
          Q.goalCur++;
          if(Q.goalCur >= Q.goalTar) qNextGoal();
        }else if(g.type === 'combo'){
          Q.goalCur = Math.max(Q.goalCur, S.combo);
          if(Q.goalCur >= Q.goalTar) qNextGoal();
        }else if(g.type === 'hitGoodMissCap'){
          if(S.miss < (g.missCap ?? 3)){
            Q.goalCur++;
          }
          if(Q.goalCur >= Q.goalTar) qNextGoal();
        }
      }

      qRender();
      qEmitUpdate(false);
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

        // quest: noJunk resets when real junk hit
        const g = Q.goals[Q.goalIndex];
        if(g && g.type === 'noJunk') Q.goalCur = 0;
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

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';
    t.dataset.kind = kind;

    const info = { kind, rng: S.rng };

    if(kind === 'good'){
      info.groupId = chooseGroupId(S.rng);
    }
    decorateTarget(t, info);

    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

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
      onHit(kind, info);
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
        setHUD();
      }
    }, ttl);
  }

  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    try{ picked.remove(); }catch(_){}
    onHit(kind, null);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
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

    // quest: noJunk counts seconds without junk hit
    const g = Q.goals[Q.goalIndex];
    if(g && g.type === 'noJunk'){
      Q.goalCur = Math.min(Q.goalTar, Q.goalCur + dt);
      if(Q.goalCur >= Q.goalTar) qNextGoal();
      qRender();
      qEmitUpdate(false);
    }

    miniTimerText();

    // spawn every ~900ms
    if(ts - S.lastSpawn >= 900){
      S.lastSpawn = ts;
      const r = S.rng();
      if(r < 0.70) spawn('good');
      else if(r < 0.96) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
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

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}