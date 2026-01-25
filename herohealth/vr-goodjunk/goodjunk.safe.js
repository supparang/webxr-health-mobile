// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v3: FOOD5 + GOALS + MINI + STAR/SHIELD + SHOOT)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit (shield blocks junk => NOT miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (blocked junk does NOT count as miss)
// ✅ Food 5 groups mapping (Thai stable) + decorateTarget
// ✅ GOAL progression + MINI challenges (bonus tied to STAR/SHIELD)
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:coach, quest:update, hha:end

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
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 110;

  const x = 22;
  const y = Math.max(72, top);
  const w = Math.max(120, r.width - 44);
  const h = Math.max(160, r.height - y - bot);

  return { x,y,w,h };
}

// ---- crosshair pick ----
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

// ---------------- FOOD5 decorate ----------------
function chooseGroupId(rng){
  // 1..5 equal for now
  const r = (typeof rng === 'function') ? rng() : Math.random();
  return 1 + Math.floor(r * 5);
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
    el.setAttribute('aria-label', `STAR ⭐`);
  }else if(t.kind === 'shield'){
    el.textContent = '🛡️';
    el.dataset.group = 'shield';
    el.setAttribute('aria-label', `SHIELD 🛡️`);
  }
}

// ---------------- QUEST SYSTEM ----------------
function makeGoals(diff){
  // 3 goals ที่อ่านง่ายสำหรับ ป.5 + เร้าใจ
  // goal 1: เก็บของดี 10
  // goal 2: เก็บของดี 20 + เลี่ยง junk (miss จำกัด)
  // goal 3: เก็บครบ 3 หมู่ (สะสม) + จบ
  const missCap2 = (diff==='easy') ? 6 : (diff==='hard') ? 3 : 4;

  return [
    {
      name:'GOAL 1: เก็บของดี 10 ชิ้น',
      desc:'แตะ/ยิง “ของดี” ให้ครบ 10 ชิ้น',
      target:10,
      cur:0,
      done:false,
      onGood(){ this.cur++; },
      check(){ this.done = (this.cur >= this.target); }
    },
    {
      name:'GOAL 2: เก็บของดี 20 ชิ้น',
      desc:`เก็บของดีให้ครบ 20 ชิ้น และเลี่ยงขยะอาหาร (MISS ≤ ${missCap2})`,
      target:20,
      cur:0,
      done:false,
      missCap: missCap2,
      onGood(){ this.cur++; },
      check(S){
        this.done = (this.cur >= this.target) && (S.miss <= this.missCap);
      }
    },
    {
      name:'GOAL 3: ครบ 3 หมู่ (สะสม)',
      desc:'เก็บของดีให้ครบ “อย่างน้อย 3 หมู่” (หมู่ 1–5) เพื่อจบเกมแบบสุดเท่',
      target:3,
      cur:0,
      done:false,
      groups: new Set(),
      onGood(gid){
        if(gid) this.groups.add(gid);
        this.cur = this.groups.size;
      },
      check(){ this.done = (this.cur >= this.target); }
    }
  ];
}

function makeMini(diff){
  return [
    {
      key:'mini_groups',
      name:'ครบ 3 หมู่ใน 12 วิ',
      desc:'เก็บของดีให้ครบ 3 หมู่ ภายใน 12 วินาที',
      target:3,
      cur:0,
      windowSec:12,
      windowStart:0,
      groups:new Set(),
      done:false,
      reset(now){
        this.windowStart = now;
        this.groups.clear();
        this.cur = 0;
        this.done = false;
      },
      tick(now){
        if(!this.windowStart) this.reset(now);
        if(now - this.windowStart > this.windowSec*1000) this.reset(now);
      },
      onGood(now, gid){
        this.tick(now);
        this.groups.add(gid||1);
        this.cur = this.groups.size;
        if(this.cur >= this.target) this.done = true;
      },
      timerText(now){
        if(!this.windowStart) return '—';
        const left = Math.max(0, this.windowSec - (now - this.windowStart)/1000);
        return `${this.cur}/${this.target} · เหลือ ${Math.ceil(left)}s`;
      }
    },
    {
      key:'mini_streak',
      name:'สตรีคของดี 6 ชิ้นติด (ห้ามพลาด)',
      desc:'เก็บของดี 6 ชิ้นติด ห้ามโดนขยะ/ห้าม MISS',
      target:6,
      cur:0,
      done:false,
      reset(){ this.cur = 0; this.done = false; },
      onGood(){ this.cur++; if(this.cur>=this.target) this.done=true; },
      onFail(){ this.reset(); },
      timerText(){ return `${this.cur}/${this.target}`; }
    }
  ];
}

function questEmit(goal, mini, allDone){
  try{
    WIN.dispatchEvent(new CustomEvent('quest:update',{ detail:{
      goal:{
        name: goal?.name || '—',
        sub: goal?.desc || '—',
        cur: goal?.cur ?? 0,
        target: goal?.target ?? 0,
        done: !!goal?.done
      },
      mini:{
        name: mini?.name || '—',
        sub: mini?.desc || '—',
        cur: mini?.cur ?? 0,
        target: mini?.target ?? 0,
        done: !!mini?.done,
        timer: mini?._timerText || '—'
      },
      allDone: !!allDone
    }}));
  }catch{}
}

// ---------------- MAIN ----------------
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

  const elGoalTitle = DOC.getElementById('hud-goal');
  const elGoalDesc  = DOC.getElementById('goalDesc');
  const elGoalCur   = DOC.getElementById('hud-goal-cur');
  const elGoalTar   = DOC.getElementById('hud-goal-target');

  const elMiniDesc  = DOC.getElementById('hud-mini');
  const elMiniTimer = DOC.getElementById('miniTimer');

  const layer   = DOC.getElementById('gj-layer');
  const layerR  = DOC.getElementById('gj-layer-r');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const goals = makeGoals(diff);
  const minis = makeMini(diff);

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

    goalIndex:0,
    miniIndex:0,
    goal: goals[0],
    mini: minis[0],

    // goal 3 track (สะสมหมู่)
    learnedGroups: new Set()
  };

  function setFever(p){
    S.fever = clamp(p,0,100);
    if(elFeverFill) elFeverFill.style.width = `${S.fever}%`;
    if(elFeverText) elFeverText.textContent = `${Math.round(S.fever)}%`;
  }

  function setShieldUI(){
    if(!elShield) return;
    elShield.textContent = (S.shield>0) ? `x${S.shield}` : '—';
  }

  function calcGrade(){
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65) g='C';
    else g='D';
    return g;
  }

  function renderQuestUI(now){
    const goal = S.goal;
    const mini = S.mini;

    // update mini timer text
    if(mini){
      if(mini.key==='mini_groups'){
        mini._timerText = mini.timerText(now);
      }else{
        mini._timerText = mini.timerText(now);
      }
    }

    if(elGoalTitle) elGoalTitle.textContent = goal?.name ? goal.name.replace(/^GOAL \d+:\s*/,'') : '—';
    if(elGoalDesc)  elGoalDesc.textContent  = goal?.desc || '—';
    if(elGoalCur)   elGoalCur.textContent   = String(goal?.cur ?? 0);
    if(elGoalTar)   elGoalTar.textContent   = String(goal?.target ?? 0);

    if(elMiniDesc)  elMiniDesc.textContent  = mini ? mini.name : '—';
    if(elMiniTimer) elMiniTimer.textContent = mini ? (mini._timerText || '—') : '—';

    questEmit(goal, mini, false);
  }

  function setHUD(now){
    if(elScore) elScore.textContent = String(S.score);
    if(elTime)  elTime.textContent  = String(Math.ceil(S.timeLeft));
    if(elMiss)  elMiss.textContent  = String(S.miss);
    if(elGrade) elGrade.textContent = calcGrade();

    setShieldUI();
    renderQuestUI(now);

    emit('hha:score',{ score:S.score });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function coach(msg){
    emit('hha:coach', { msg, tag:'Coach' });
  }

  function nextGoal(now){
    if(S.goalIndex < goals.length-1){
      S.goalIndex++;
      S.goal = goals[S.goalIndex];
      coach(`ไปต่อ! ${S.goal.name} ✅`);
      renderQuestUI(now);
    }
  }

  function nextMini(now){
    S.miniIndex = (S.miniIndex + 1) % minis.length;
    S.mini = minis[S.miniIndex];
    // reset mini state
    if(S.mini?.key==='mini_groups') S.mini.reset(now);
    if(S.mini?.key==='mini_streak') S.mini.reset();
    renderQuestUI(now);
  }

  function rewardMini(now){
    // โบนัสผูกของจริง: shield+1 และถ้ามี miss ให้ star effect ลด miss -1
    const before = S.miss;

    // give shield
    S.shield = Math.min(3, S.shield + 1);

    // star reduce miss if any
    if(S.miss > 0) S.miss = Math.max(0, S.miss - 1);

    addScore(28);
    setFever(Math.max(0, S.fever - 10));

    coach(`🎁 โบนัส MINI! ได้ 🛡️ +1${(before!==S.miss)?' และ ⭐ ลด MISS -1':''}`);
    emit('hha:judge', { type:'perfect', label:'BONUS!' });

    // เปลี่ยน mini ทันทีให้เร้าใจ
    nextMini(now);
  }

  function onHit(kind, meta={}){
    if(S.ended) return;
    const now = performance.now ? performance.now() : Date.now();

    if(kind==='good'){
      const gid = meta.groupId || 1;

      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);

      // goal progress
      if(S.goal?.onGood) S.goal.onGood(gid);
      if(S.goal?.check)  S.goal.check(S);

      // learning groups (for goal3)
      S.learnedGroups.add(gid);
      if(S.goalIndex===2 && S.goal?.onGood) S.goal.onGood(gid);

      // mini progress
      if(S.mini?.key==='mini_groups'){
        S.mini.onGood(now, gid);
      }else if(S.mini?.key==='mini_streak'){
        S.mini.onGood();
      }

      emit('hha:judge', { type:'good', label:'GOOD' });

      // if mini done -> reward
      if(S.mini?.done){
        rewardMini(now);
      }

      // if goal done -> next
      if(S.goal?.done){
        nextGoal(now);
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

        // mini streak fail
        if(S.mini?.key==='mini_streak') S.mini.onFail();
      }

      // goal 2 depends on miss cap, recheck
      if(S.goal?.check) S.goal.check(S);
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

    setHUD(now);
  }

  // ---- spawn targets (mirror layer-r) ----
  let uidSeq = 0;

  function removeByUid(uid){
    if(!uid) return;
    const els = DOC.querySelectorAll(`.gj-target[data-uid="${uid}"]`);
    els.forEach(el=>{ try{ el.remove(); }catch(_){ }});
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const uid = String(++uidSeq);

    const t = {
      uid,
      kind,
      rng: S.rng,
      groupId: (kind==='good') ? chooseGroupId(S.rng) : null
    };

    const makeEl = ()=>{
      const el = DOC.createElement('div');
      el.className = 'gj-target spawn';
      el.dataset.kind = kind;
      el.dataset.uid = uid;

      // size
      const size =
        (kind==='good') ? 56 :
        (kind==='junk') ? 58 :
        52;
      el.style.left = x+'px';
      el.style.top  = y+'px';
      el.style.fontSize = size+'px';

      decorateTarget(el, t);

      // pointer tap (disabled in cVR by CSS)
      el.addEventListener('pointerdown', ()=>{
        if(S.ended) return;
        removeByUid(uid);
        onHit(kind, { groupId: t.groupId });
      });

      return el;
    };

    const el1 = makeEl();
    layer.appendChild(el1);

    // mirror for right-eye layer (if exists)
    if(layerR){
      const el2 = makeEl();
      layerR.appendChild(el2);
    }

    // TTL (แฟร์ ไม่แว้บ)
    const ttl = (kind==='star' || kind==='shield') ? 1700 : 1600;

    setTimeout(()=>{
      if(S.ended) return;

      // if already removed, ignore
      const still = DOC.querySelector(`.gj-target[data-uid="${uid}"]`);
      if(!still) return;

      removeByUid(uid);

      // expire good => MISS
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo = 0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });

        // mini streak fail
        if(S.mini?.key==='mini_streak') S.mini.onFail();

        // goal 2 recheck
        if(S.goal?.check) S.goal.check(S);

        setHUD(performance.now ? performance.now() : Date.now());
      }
    }, ttl);
  }

  // ---- shoot support ----
  function onShoot(ev){
    if(S.ended || !S.started) return;

    const lockPx = Number(ev?.detail?.lockPx ?? 28) || 28;
    const picked = pickByShoot(lockPx);
    if(!picked) return;

    const uid = picked.dataset.uid;
    const kind = picked.dataset.kind || 'good';
    const gid = Number(picked.dataset.group || 1) || 1;

    removeByUid(uid);
    onHit(kind, { groupId: gid });
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = calcGrade();
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

    // update mini timers smoothly
    if(S.mini?.key==='mini_groups'){
      const now = ts;
      S.mini.tick(now);
      renderQuestUI(now);
    }

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

  // init mini
  const now0 = performance.now ? performance.now() : Date.now();
  if(S.mini?.key==='mini_groups') S.mini.reset(now0);
  if(S.mini?.key==='mini_streak') S.mini.reset();

  setFever(S.fever);
  setShieldUI();
  setHUD(now0);

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