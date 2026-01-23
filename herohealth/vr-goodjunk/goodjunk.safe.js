// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v2.1: FOOD5 + DECORATE + MINI QUEST + SHOOT)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Food5 TH mapping: good -> group 1..5 emoji (like Plate), junk -> random junk emoji
// ✅ Mini quest: "ครบ 3 หมู่ใน 12 วิ" -> โบนัส (ให้ Shield ถ้ายังไม่เต็ม, ไม่งั้นลด Miss -1)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:end, quest:update, hha:coach

'use strict';

import { FOOD5, JUNK, emojiForGroup, labelForGroup, pickEmoji } from '../vr/food5-th.js';

const WIN = window;
const DOC = document;

const clamp = (v,min,max)=>Math.max(min,Math.min(max, Number(v)||0));
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

/* ------------------------------------------------
 * (1) Food5 helper: choose group + decorateTarget
 * ------------------------------------------------ */
function chooseGroupId(rng){
  return 1 + Math.floor((rng ? rng() : Math.random()) * 5);
}

function decorateTarget(el, t){
  // t.kind: 'good' | 'junk' | 'star' | 'shield'
  if(!el || !t) return;

  if(t.kind === 'good'){
    const gid = Number(t.groupId || 1) || 1;
    const emo = emojiForGroup(t.rng, gid);
    el.textContent = emo;
    el.dataset.group = String(gid);
    el.dataset.groupId = String(gid);
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
    el.dataset.group = 'star';
    el.setAttribute('aria-label', `โบนัส ดาว ⭐`);
  }
  else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'shield';
    el.setAttribute('aria-label', `โบนัส โล่ 🛡️`);
  }
}

/* ------------------------------------------------
 * (2) Mini quest meta (แฟร์, ไม่ซ้ำ Plate)
 * ------------------------------------------------ */
const GJ_META = {
  windowSec: 12,
  windowStartAt: 0,
  windowGroups: new Set(), // เก็บ groupId (1..5) ที่ทำได้ในหน้าต่างเวลา
  miniDone: false
};

function nowMs(){
  return (performance && performance.now) ? performance.now() : Date.now();
}

function resetMiniWindow(){
  GJ_META.windowStartAt = nowMs();
  GJ_META.windowGroups.clear();
  GJ_META.miniDone = false;
}

// ยิง/แตะ good แล้วเรียกอันนี้
function onHitGoodMeta(groupId, pushQuest){
  const t = nowMs();
  if(t - GJ_META.windowStartAt > GJ_META.windowSec*1000){
    resetMiniWindow();
  }
  const gid = Number(groupId||1) || 1;
  GJ_META.windowGroups.add(gid);

  const cur = GJ_META.windowGroups.size;
  const tar = 3;

  if(typeof pushQuest === 'function'){
    pushQuest(cur, tar);
  }

  if(!GJ_META.miniDone && cur >= tar){
    GJ_META.miniDone = true;
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{
        msg:`สุดยอด! ครบ ${tar} หมู่ใน ${GJ_META.windowSec} วิ 🎁 ได้โบนัส!`,
        tag:'Coach'
      }}));
    }catch{}
    return true; // mini completed now
  }
  return false;
}

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  // HUD refs
  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  // Quest HUD refs (มีใน goodjunk-vr.html ที่คุณแปะ)
  const elGoalName = DOC.getElementById('hud-goal');
  const elGoalDesc = DOC.getElementById('goalDesc');
  const elGoalCur  = DOC.getElementById('hud-goal-cur');
  const elGoalTar  = DOC.getElementById('hud-goal-target');
  const elMiniName = DOC.getElementById('hud-mini');
  const elMiniTimer= DOC.getElementById('miniTimer');

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

    // quest display
    goalName: 'แยกของดี/ของเสีย',
    goalDesc: 'เก็บของดี (อาหาร 5 หมู่) และเลี่ยงขยะ/ของทอดหวาน',
    goalCur: 0,
    goalTar: 1
  };

  // init mini quest window
  resetMiniWindow();

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${S.fever}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function pushQuestUpdate(curMini, tarMini){
    const t = nowMs();
    const left = Math.max(0, (GJ_META.windowSec*1000 - (t - GJ_META.windowStartAt)) / 1000);
    const miniName = `ครบ ${tarMini} หมู่ใน ${GJ_META.windowSec} วิ`;
    const miniSub  = 'โบนัส: ได้โล่/ลด MISS';
    const done = !!GJ_META.miniDone;

    // Update DOM (เร็วและชัด)
    if(elGoalName) elGoalName.textContent = S.goalName;
    if(elGoalDesc) elGoalDesc.textContent = S.goalDesc;
    if(elGoalCur)  elGoalCur.textContent  = String(S.goalCur);
    if(elGoalTar)  elGoalTar.textContent  = String(S.goalTar);

    if(elMiniName) elMiniName.textContent = `${miniName} (${curMini}/${tarMini})`;
    if(elMiniTimer){
      elMiniTimer.textContent = done ? 'ผ่านแล้ว ✅' : `เหลือ ${Math.ceil(left)}s`;
    }

    // Emit quest:update (ให้โครงสร้างเหมือน Plate ได้)
    try{
      WIN.dispatchEvent(new CustomEvent('quest:update', { detail:{
        goal:{ name:S.goalName, sub:S.goalDesc, cur:S.goalCur, target:S.goalTar },
        mini:{ name:miniName, sub:miniSub, cur:curMini, target:tarMini, done },
        allDone:false
      }}));
    }catch{}
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

    // keep quest fresh
    pushQuestUpdate(GJ_META.windowGroups.size, 3);
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function applyMiniBonus(){
    // โบนัสแฟร์: ถ้าโล่ยังไม่เต็ม -> ให้โล่ +1, ไม่งั้นลด MISS -1
    if(S.shield < 3){
      S.shield = Math.min(3, S.shield + 1);
      addScore(10);
      emit('hha:judge', { type:'perfect', label:'BONUS SHIELD!' });
    }else{
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(12);
      emit('hha:judge', { type:'perfect', label: (before!==S.miss) ? 'BONUS MISS -1!' : 'BONUS!' });
    }
    setFever(Math.max(0, S.fever - 6));
  }

  function onHit(kind, groupIdForGood){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      // ✅ mini quest meta
      const completedNow = onHitGoodMeta(groupIdForGood, (cur,tar)=>pushQuestUpdate(cur,tar));
      if(completedNow){
        applyMiniBonus();
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
    el.className = 'gj-target';
    el.dataset.kind = kind;

    // build target object
    const t = { kind, rng: S.rng, groupId: 1 };

    if(kind === 'good'){
      t.groupId = chooseGroupId(S.rng);
    }

    // decorate emoji + aria + dataset group
    decorateTarget(el, t);

    // sizes: good/junk bigger; powerups slightly smaller
    const size =
      (kind==='good') ? 58 :
      (kind==='junk') ? 60 :
      52;

    el.style.left = x+'px';
    el.style.top  = y+'px';
    el.style.fontSize = size+'px';

    // store groupId for hit meta
    if(kind === 'good'){
      el.dataset.groupId = String(t.groupId);
      el.dataset.group = String(t.groupId);
    }

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ el.remove(); }catch(_){}
    };

    el.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      const gid = Number(el.dataset.groupId || el.dataset.group || 1) || 1;
      kill();
      onHit(kind, gid);
    });

    layer.appendChild(el);

    // TTL (แฟร์ ไม่แว้บ): ให้ช้าลงนิดสำหรับเด็ก/มือถือ
    const base =
      (view === 'pc') ? 1750 :
      (view === 'vr' || view === 'cvr') ? 1900 :
      2100;

    const ttl =
      (kind==='star' || kind==='shield') ? Math.round(base * 0.95) :
      Math.round(base * 1.05);

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

  // ✅ Crosshair shoot support
  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const kind = picked.dataset.kind || 'good';
    const gid  = Number(picked.dataset.groupId || picked.dataset.group || 1) || 1;

    try{ picked.remove(); }catch(_){}
    onHit(kind, gid);
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = (elGrade && elGrade.textContent) ? elGrade.textContent : '—';
    const summary = {
      game:'GoodJunkVR',
      pack:'fair-food5',
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
      miniDone:GJ_META.miniDone,
      miniGroupsCount:GJ_META.windowGroups.size,
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

    // refresh quest timer display (mini countdown)
    pushQuestUpdate(GJ_META.windowGroups.size, 3);

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

  // init quest HUD
  if(elGoalName) elGoalName.textContent = S.goalName;
  if(elGoalDesc) elGoalDesc.textContent = S.goalDesc;
  if(elGoalCur)  elGoalCur.textContent  = String(S.goalCur);
  if(elGoalTar)  elGoalTar.textContent  = String(S.goalTar);
  resetMiniWindow();
  pushQuestUpdate(0,3);

  setHUD();

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', { game:'GoodJunkVR', pack:'fair-food5', view, runMode:run, diff, timePlanSec:timePlan, seed });
  requestAnimationFrame(tick);
}