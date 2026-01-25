// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR+FUN PACK (v3)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Food 5 groups decorate (good targets) + junk emoji variety
// ✅ MINI: ครบ 3 หมู่ใน 12 วิ -> โบนัส (ให้ Shield + ลด MISS + คะแนน)
// ✅ FUN: junk telegraph 140ms + combo-hot glow + lowtime state
// ✅ AI Prediction (rule+EWMA): tempo + distribution director (แฟร์)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:coach, quest:update, hha:end

import { JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

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

function ewma(prev, x, a){ return prev*(1-a) + x*a; }

function isCvr(view){ return String(view||'').toLowerCase() === 'cvr'; }

function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 140;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 130;

  const x = 22;
  const y = Math.max(80, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(140, r.height - y - bot);

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

/* ------------------------------
   Food 5 group decorate helpers
--------------------------------*/
function chooseGroupId(rng){
  return 1 + Math.floor((typeof rng === 'function' ? rng() : Math.random()) * 5);
}
function decorateTarget(el, t){
  if(!el) return;

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
    el.dataset.group = 'star';
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'shield';
  }
}

/* ------------------------------
   MINI quest meta (3 groups / 12s)
--------------------------------*/
const GJ_META = {
  windowSec: 12,
  windowStartAt: 0,
  windowGroups: new Set(),
  miniDone: false
};
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function resetMiniWindow(){
  GJ_META.windowStartAt = nowMs();
  GJ_META.windowGroups.clear();
  GJ_META.miniDone = false;
}
function emitQuestMini(cur, target, done){
  try{
    WIN.dispatchEvent(new CustomEvent('quest:update', { detail:{
      goal:{ name:'แยกของดี/ของเสีย', sub:'เก็บของดี เลี่ยงของหวาน/ทอด', cur:0, target:1 },
      mini:{ name:`ครบ ${target} หมู่ใน ${GJ_META.windowSec} วิ`, sub:'โบนัสช่วยชีวิต', cur, target, done },
      allDone:false
    }}));
  }catch{}
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

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

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
    lastSpawnAt:0,

    // FUN/AI metrics
    hitTotal:0,
    missRecent:0,
    rtEwma:750,
  };

  function setComboHot(on){
    try{
      if(on) DOC.body.classList.add('combo-hot');
      else DOC.body.classList.remove('combo-hot');
    }catch(_){}
  }
  function setLowTime(on){
    try{
      if(on) DOC.body.classList.add('lowtime');
      else DOC.body.classList.remove('lowtime');
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

  function grantMiniBonus(){
    // โบนัสแฟร์: +1 shield (cap 3) + ลด miss 1 (floor 0) + คะแนน
    S.shield = Math.min(3, S.shield + 1);
    const before = S.miss;
    S.miss = Math.max(0, S.miss - 1);
    addScore(25);
    setFever(Math.max(0, S.fever - 10));
    setShieldUI();
    emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'BONUS! MISS -1' : 'BONUS!' });
    emit('hha:coach', { msg:'โบนัสช่วยชีวิต! 🛡️ +1 และ MISS -1', tag:'mini:bonus' });
  }

  function onHitGoodMeta(groupId){
    const now = nowMs();
    if(!GJ_META.windowStartAt) resetMiniWindow();
    if(now - GJ_META.windowStartAt > GJ_META.windowSec*1000){
      resetMiniWindow();
    }
    GJ_META.windowGroups.add(groupId);

    const cur = GJ_META.windowGroups.size;
    const tar = 3;

    emitQuestMini(cur, tar, GJ_META.miniDone);

    if(!GJ_META.miniDone && cur >= tar){
      GJ_META.miniDone = true;
      emitQuestMini(cur, tar, true);
      grantMiniBonus();
    }
  }

  function killUid(uid){
    if(!uid) return;
    try{
      DOC.querySelectorAll(`.gj-target[data-uid="${uid}"]`).forEach(el=>el.remove());
    }catch(_){}
  }

  function pop(el){
    try{
      el.classList.add('hit-pop');
      setTimeout(()=>{ try{ el.classList.remove('hit-pop'); }catch(_){ } }, 120);
    }catch(_){}
  }

  function onHit(kind, meta={}){
    if(S.ended) return;

    // reaction time estimate (approx)
    try{
      const now = nowMs();
      const rt = Math.max(80, now - (S.lastSpawnAt || now));
      S.rtEwma = ewma(S.rtEwma, rt, 0.12);
    }catch(_){}

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      // mini quest meta
      onHitGoodMeta(meta.groupId || 1);
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

    // AI pressure update
    S.hitTotal++;
    if(kind==='junk' && S.shield<=0){
      S.missRecent = ewma(S.missRecent, 1, 0.18);
    }else{
      S.missRecent = ewma(S.missRecent, 0, 0.10);
    }

    setComboHot(S.combo >= 6);
    setHUD();

    // Predictive micro-tips (เบา ๆ)
    try{
      const risk = (S.missRecent*0.75) + (S.rtEwma>900 ? 0.35 : 0) + (S.timeLeft<18 ? 0.25 : 0);
      if(risk > 0.78){
        emit('hha:coach', { msg:'โหมดเสี่ยง! เลือกของดีให้ชัวร์ก่อน 😤', tag:'predict:miss' });
      }else if(S.combo === 7){
        emit('hha:coach', { msg:'คอมโบกำลังมา! 🔥 ยิงของดีต่อเนื่อง!', tag:'predict:combo' });
      }
    }catch(_){}
  }

  function spawn(kind){
    if(S.ended || !layerL) return;

    const safe = getSafeRect();

    const uid = String(Math.floor((S.rng()*1e9))) + '-' + String(Date.now());
    const t = { kind, rng:S.rng, groupId:null, uid };

    // assign group for good
    if(kind === 'good') t.groupId = chooseGroupId(S.rng);

    // size (px) for clamp
    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    // clamp inside safe rect with center transform
    const x0 = safe.x + S.rng()*safe.w;
    const y0 = safe.y + S.rng()*safe.h;
    const x = clamp(x0, safe.x + size/2 + 6, safe.x + safe.w - size/2 - 6);
    const y = clamp(y0, safe.y + size/2 + 6, safe.y + safe.h - size/2 - 6);

    function makeEl(){
      const el = DOC.createElement('div');
      el.className = 'gj-target spawn';
      el.dataset.kind = kind;
      el.dataset.uid  = uid;
      el.style.left = x+'px';
      el.style.top  = y+'px';
      el.style.fontSize = size+'px';

      decorateTarget(el, t);

      // FUN: telegraph junk
      if(kind === 'junk'){
        el.classList.add('telegraph-junk');
        setTimeout(()=>{ try{ el.classList.remove('telegraph-junk'); }catch(_){ } }, 140);
      }

      // for RT estimate (optional)
      el.dataset.spawnedAt = String(nowMs());

      return el;
    }

    const elL = makeEl();
    layerL.appendChild(elL);

    // cVR: duplicate to right layer so both eyes see targets
    let elR = null;
    if(isCvr(S.view) && layerR){
      elR = makeEl();
      layerR.appendChild(elR);
    }

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      killUid(uid);
    };

    // click/tap (not in cVR strict)
    elL.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      pop(elL);
      kill();
      onHit(kind, { groupId: t.groupId });
    });

    // TTL (แฟร์ ไม่แว้บ)
    const ttl = (kind==='star' || kind==='shield') ? 1700 : 1600;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo=0;
        S.missRecent = ewma(S.missRecent, 1, 0.20);
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

    const uid = picked.dataset.uid;
    const kind = picked.dataset.kind || 'good';
    const gid  = Number(picked.dataset.group || 1) || 1;

    killUid(uid);
    onHit(kind, { groupId: gid });
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
    const summary = {
      game:'GoodJunkVR',
      pack:'fair+fun',
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
      rtEwmaMs: Math.round(S.rtEwma),
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

    setLowTime(S.timeLeft <= 15);

    // ✅ Director (แฟร์): risk สูง -> ผ่อน tempo / ลด junk
    const risk = (S.missRecent*0.75) + (S.rtEwma>900 ? 0.35 : 0) + (S.timeLeft<18 ? 0.20 : 0);
    const goodStreak = (S.combo >= 6) ? 1 : 0;

    let spawnEvery = 900;
    spawnEvery -= Math.round(120 * goodStreak);
    spawnEvery += Math.round(140 * Math.min(1, risk));
    spawnEvery = clamp(spawnEvery, 760, 980);

    if(ts - S.lastSpawn >= spawnEvery){
      S.lastSpawn = ts;
      S.lastSpawnAt = nowMs();

      let pGood = 0.70, pJunk = 0.26, pStar = 0.02, pShield = 0.02;

      if(risk > 0.65){
        pGood = 0.74; pJunk = 0.22; pStar = 0.02; pShield = 0.02;
      }
      if(risk > 0.80){
        pGood = 0.76; pJunk = 0.19; pStar = 0.02; pShield = 0.03;
      }
      if(S.combo >= 8 && risk < 0.55){
        pGood = 0.68; pJunk = 0.28; pStar = 0.02; pShield = 0.02;
      }

      const r = S.rng();
      if(r < pGood) spawn('good');
      else if(r < pGood + pJunk) spawn('junk');
      else if(r < pGood + pJunk + pStar) spawn('star');
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
  resetMiniWindow();
  emitQuestMini(0, 3, false);

  setFever(S.fever);
  setShieldUI();
  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair+fun', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}