// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v3: STAR+SHIELD + SHOOT + FOOD5 + MINI window)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe from goodjunk-vr.html)
// ✅ MISS = good expired + junk hit (shield blocks junk => not MISS)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// ✅ FOOD5 mapping: good targets show emoji by Thai 5 groups (seeded)
// ✅ MINI window: “ครบ 3 หมู่ใน 12 วิ” => bonus spawn (⭐ or 🛡) + coach message
// ✅ Low-time overlay 5..1
// Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:end

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
  // pick .gj-target nearest to center within lock window
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

// ---------- FOOD5 helpers ----------
function chooseGroupId(rng){
  return 1 + Math.floor(((typeof rng==='function') ? rng() : Math.random()) * 5);
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
    el.dataset.group = 'star';
    el.setAttribute('aria-label', 'STAR');
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'shield';
    el.setAttribute('aria-label', 'SHIELD');
  }
}

// ---------- MINI window meta ----------
const MINI = {
  windowSec: 12,
  targetGroups: 3,
  startAt: 0,
  groups: new Set(),
  done: false
};
function nowMs(){ return (performance?.now?.() ?? Date.now()); }
function resetMiniWindow(){
  MINI.startAt = nowMs();
  MINI.groups.clear();
  MINI.done = false;
}

// ---------- Quest UI helpers ----------
function setText(id, v){
  const el = DOC.getElementById(id);
  if(el) el.textContent = String(v);
}
function pushQuest(goal, mini, allDone=false){
  // update HUD text
  if(goal){
    setText('hud-goal', goal.name ?? '—');
    setText('goalDesc', goal.sub ?? '—');
    setText('hud-goal-cur', goal.cur ?? 0);
    setText('hud-goal-target', goal.target ?? 0);
  }
  if(mini){
    setText('hud-mini', mini.name ?? '—');
    setText('miniTimer', mini.timerText ?? '—');
  }

  emit('quest:update', { goal, mini, allDone });
}

// ---------- Low time overlay ----------
function setLowTimeOverlay(show, num){
  const ov = DOC.getElementById('lowTimeOverlay');
  const elNum = DOC.getElementById('gj-lowtime-num');
  if(!ov || !elNum) return;
  if(show){
    ov.setAttribute('aria-hidden', 'false');
    elNum.textContent = String(num);
  }else{
    ov.setAttribute('aria-hidden', 'true');
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

  const rng = makeRNG(seed);

  // -------- Difficulty knobs (FAIR) --------
  // ปรับได้ภายหลังให้ “เร้าใจ” ขึ้นแบบคุมได้
  const CFG = {
    spawnEveryMs: (diff==='easy') ? 980 : (diff==='hard') ? 820 : 900,
    ttlGoodMs:    (diff==='easy') ? 1750 : (diff==='hard') ? 1450 : 1600,
    ttlJunkMs:    (diff==='easy') ? 1800 : (diff==='hard') ? 1500 : 1600,
    ttlPowerMs:   1700,
    // distribution
    pGood: 0.70,
    pJunk: 0.26,
    pStar: 0.02,
    pShield: 0.02,
    // goal
    goalTargetGood: (diff==='easy') ? 18 : (diff==='hard') ? 26 : 22
  };

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng,

    score:0,
    miss:0, // MISS = good expired + junk hit (shield blocks = not miss)
    hitGood:0,
    hitJunk:0,
    expireGood:0,

    combo:0,
    comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,

    // goal tracking
    goalGood:0,
    goalTarget: CFG.goalTargetGood,

    // low time overlay state
    lastLowShown: null
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

    const g = computeGrade();
    if(elGrade) elGrade.textContent = g;

    setShieldUI();
    emit('hha:score', { score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function updateQuestUI(){
    const goal = {
      name: 'แยกของดี/ของเสีย',
      sub: `เก็บของดีให้ได้ ${S.goalTarget} ชิ้น (หลบของทอด/หวาน)`,
      cur: S.goalGood,
      target: S.goalTarget
    };

    // mini timer text
    const tNow = nowMs();
    const left = Math.max(0, MINI.windowSec - Math.floor((tNow - MINI.startAt)/1000));
    const mini = {
      name: `ครบ ${MINI.targetGroups} หมู่ใน ${MINI.windowSec} วิ`,
      sub: 'ทำได้แล้วสุ่มโบนัส ⭐/🛡',
      cur: MINI.groups.size,
      target: MINI.targetGroups,
      done: MINI.done,
      timerText: MINI.done ? '✓ สำเร็จ' : `${left}s`
    };

    pushQuest(goal, mini, false);
  }

  function giveBonus(){
    // สุ่มโบนัสแบบแฟร์: ⭐ หรือ 🛡
    const r = rng();
    const kind = (r < 0.5) ? 'star' : 'shield';
    // spawn ใกล้กลางจอเล็กน้อย (ยังอยู่ใน safe)
    spawn(kind, { nudgeCenter: true, ttlOverride: CFG.ttlPowerMs });
    emit('hha:coach', { msg:`สุดยอด! ได้โบนัส ${kind==='star'?'⭐':'🛡️'}!`, tag:'bonus' });
  }

  function onHitGoodMeta(groupId){
    const tNow = nowMs();
    if(!MINI.startAt) resetMiniWindow();

    // หมดหน้าต่างเวลา -> รีเซ็ต
    if(tNow - MINI.startAt > MINI.windowSec*1000){
      resetMiniWindow();
    }

    MINI.groups.add(Number(groupId)||1);

    if(!MINI.done && MINI.groups.size >= MINI.targetGroups){
      MINI.done = true;
      giveBonus();
      // รีเซ็ตหน้าต่างเพื่อเริ่มรอบ mini ใหม่แบบ “ผ่านแล้วสลับทันที”
      setTimeout(resetMiniWindow, 180);
    }

    updateQuestUI();
  }

  function onHit(kind, meta={}){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.goalGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD', groupId: meta.groupId ?? null });

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

    setHUD();

    // goal cleared? (ทำให้ “ไป GOAL ต่อ” ได้ในอนาคต)
    if(S.goalGood >= S.goalTarget){
      emit('hha:coach', { msg:'ผ่าน GOAL! เก่งมาก 🎉', tag:'goal' });
      // ไม่จบเกมทันที แต่คุณจะต่อยอดเป็นหลาย GOAL ได้
      // ตอนนี้ “ล็อกเป้า” ไว้ที่ goal เดียวให้แฟร์ก่อน
    }
  }

  function spawn(kind, opt={}){
    if(S.ended || !layer) return;

    const safe = getSafeRect();

    let x = safe.x + rng()*safe.w;
    let y = safe.y + rng()*safe.h;

    if(opt.nudgeCenter){
      const cx = safe.x + safe.w/2;
      const cy = safe.y + safe.h/2;
      x = cx + (rng()-0.5)*safe.w*0.45;
      y = cy + (rng()-0.5)*safe.h*0.45;
    }

    const t = DOC.createElement('div');
    t.className = 'gj-target spawn';

    const obj = { kind, rng, groupId: 1 };
    if(kind==='good') obj.groupId = chooseGroupId(rng);

    t.dataset.kind = kind;
    t.dataset.groupId = String(obj.groupId || '');

    // size
    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    t.style.left = x+'px';
    t.style.top  = y+'px';
    t.style.fontSize = size+'px';

    decorateTarget(t, obj);

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ t.remove(); }catch(_){}
    };

    t.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind, obj);
    });

    layer.appendChild(t);

    // TTL (แฟร์ ไม่แว้บ)
    const ttl =
      (typeof opt.ttlOverride === 'number') ? opt.ttlOverride :
      (kind==='star' || kind==='shield') ? CFG.ttlPowerMs :
      (kind==='junk') ? CFG.ttlJunkMs :
      CFG.ttlGoodMs;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();

      // expire good counts as MISS
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
    const gid  = Number(picked.dataset.groupId||0) || 1;
    try{ picked.remove(); }catch(_){}

    onHit(kind, { kind, rng, groupId: gid });
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    setLowTimeOverlay(false, 0);

    const grade = computeGrade();
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
      fever:S.fever,
      goalGood:S.goalGood,
      goalTarget:S.goalTarget,
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

    // low-time overlay 5..1
    const ceilLeft = Math.ceil(S.timeLeft);
    if(ceilLeft <= 5 && ceilLeft >= 1){
      if(S.lastLowShown !== ceilLeft){
        S.lastLowShown = ceilLeft;
        setLowTimeOverlay(true, ceilLeft);
      }
    }else{
      if(S.lastLowShown !== null){
        S.lastLowShown = null;
        setLowTimeOverlay(false, 0);
      }
    }

    // spawn
    if(ts - S.lastSpawn >= CFG.spawnEveryMs){
      S.lastSpawn = ts;

      const r = rng();
      if(r < CFG.pGood) spawn('good');
      else if(r < CFG.pGood + CFG.pJunk) spawn('junk');
      else if(r < CFG.pGood + CFG.pJunk + CFG.pStar) spawn('star');
      else spawn('shield');
    }

    // quest update (keep timer text alive)
    updateQuestUI();

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

  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', {
    game:'GoodJunkVR',
    pack:'fair-v3',
    view, runMode:run, diff,
    timePlanSec:timePlan,
    seed
  });

  requestAnimationFrame(tick);
}