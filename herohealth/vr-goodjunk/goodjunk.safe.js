// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK (v3: Food5 + Missions + STAR+SHIELD + SHOOT)
// ✅ Spacious spawn (uses --gj-top-safe / --gj-bottom-safe)
// ✅ MISS = good expired + junk hit (shield-block junk does NOT count as miss)
// ✅ ⭐ Star: reduce miss by 1 (floor 0) + bonus score
// ✅ 🛡 Shield: blocks next junk hit (cap 3)
// ✅ Food5 mapping (GOOD targets are from Thai 5 groups)
// ✅ Missions: GOAL + MINI (rotating) -> quest:update + HUD IDs
// ✅ Supports: tap/click OR crosshair shoot via event hha:shoot
// Emits: hha:start, hha:score, hha:time, hha:judge, quest:update, hha:end, hha:coach

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
  const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 160;
  const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 140;

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
    const dx = ex - cx;
    const dy = ey - cy;
    const d2 = dx*dx + dy*dy;

    if(!best || d2 < best.d2) best = { el, d2 };
  }

  return best ? best.el : null;
}

// -----------------------------
// Missions (Goal + Mini)
// -----------------------------
function diffConfig(diff){
  // ปรับให้ “แฟร์แต่ท้าทาย” สำหรับเด็ก ป.5
  if(diff === 'easy')   return { goalTarget: 16, spawnMs: 950, goodP: 0.74, junkP: 0.22 };
  if(diff === 'hard')   return { goalTarget: 24, spawnMs: 820, goodP: 0.66, junkP: 0.30 };
  return                { goalTarget: 20, spawnMs: 900, goodP: 0.70, junkP: 0.26 };
}

function nowMs(){ return (performance?.now ? performance.now() : Date.now()); }

export function boot(opts={}){
  const view = String(opts.view || qs('view','mobile')).toLowerCase();
  const run  = String(opts.run  || qs('run','play')).toLowerCase();
  const diff = String(opts.diff || qs('diff','normal')).toLowerCase();
  const timePlan = clamp(Number(opts.time || qs('time','80'))||80, 20, 300);
  const seed = String(opts.seed || qs('seed', Date.now()));

  // HUD ids
  const elScore = DOC.getElementById('hud-score');
  const elTime  = DOC.getElementById('hud-time');
  const elMiss  = DOC.getElementById('hud-miss');
  const elGrade = DOC.getElementById('hud-grade');
  const layer   = DOC.getElementById('gj-layer');

  const elFeverFill = DOC.getElementById('feverFill');
  const elFeverText = DOC.getElementById('feverText');
  const elShield    = DOC.getElementById('shieldPills');

  const elGoalName   = DOC.getElementById('hud-goal');
  const elGoalDesc   = DOC.getElementById('goalDesc');
  const elGoalCur    = DOC.getElementById('hud-goal-cur');
  const elGoalTar    = DOC.getElementById('hud-goal-target');
  const elMiniText   = DOC.getElementById('hud-mini');
  const elMiniTimer  = DOC.getElementById('miniTimer');

  const elLowOverlay = DOC.getElementById('lowTimeOverlay');
  const elLowNum     = DOC.getElementById('gj-lowtime-num');

  const CFG = diffConfig(diff);

  const S = {
    started:false, ended:false,
    view, run, diff,
    timePlan, timeLeft: timePlan,
    seed, rng: makeRNG(seed),

    score:0,
    miss:0,

    hitGood:0,
    hitJunk:0,
    expireGood:0,

    combo:0,
    comboMax:0,

    shield:0,
    fever:18,

    lastTick:0,
    lastSpawn:0,

    // Food5 stats
    groupHit: { 1:0,2:0,3:0,4:0,5:0 },

    // Missions
    goalTarget: CFG.goalTarget,
    goalCur: 0, // count “good collected”
    goalDone:false,

    miniIndex: 0,
    miniDone:false,

    // Mini A: 3 groups in 12s
    miniA: { windowSec: 12, windowStart: nowMs(), groups: new Set(), need: 3 },

    // Mini B: streak 6 goods (no miss reset)
    miniB: { need: 6, streak: 0 },

    // end ui
    endPanel: null
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

  function computeGrade(){
    // เกณฑ์ A/B/C/D แบบเด็กเข้าใจง่าย
    let g='C';
    if(S.score>=170 && S.miss<=3) g='A';
    else if(S.score>=110) g='B';
    else if(S.score>=65)  g='C';
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

  function setQuestHUD(){
    // Goal
    if(elGoalName) elGoalName.textContent = 'เก็บของดีให้ครบ';
    if(elGoalDesc) elGoalDesc.textContent =
      `เก็บ “ของดี” ให้ครบ ${S.goalTarget} ชิ้น และเลี่ยงขยะอาหาร (หวาน/ทอด/น้ำอัดลม)`;
    if(elGoalCur) elGoalCur.textContent = String(S.goalCur);
    if(elGoalTar) elGoalTar.textContent = String(S.goalTarget);

    // Mini (rotate)
    const miniAActive = (S.miniIndex % 2 === 0);
    if(miniAActive){
      const a = S.miniA;
      const secLeft = Math.max(0, a.windowSec - ((nowMs() - a.windowStart)/1000));
      if(elMiniText)  elMiniText.textContent = `ครบ 3 หมู่ใน ${a.windowSec} วิ (โบนัส STAR/SHIELD)`;
      if(elMiniTimer) elMiniTimer.textContent = `${Math.ceil(secLeft)}s · ${a.groups.size}/3`;
    }else{
      const b = S.miniB;
      if(elMiniText)  elMiniText.textContent = `สตรีคของดี ${b.need} ชิ้นติด (ห้ามพลาด)`;
      if(elMiniTimer) elMiniTimer.textContent = `${b.streak}/${b.need}`;
    }

    // emit quest:update ให้ missions peek / ระบบอื่นใช้ได้
    const miniCur = (S.miniIndex%2===0) ? S.miniA.groups.size : S.miniB.streak;
    const miniTar = (S.miniIndex%2===0) ? S.miniA.need : S.miniB.need;

    emit('quest:update', {
      goal:{ name:'เก็บของดีให้ครบ', sub:'เลี่ยงขยะอาหาร', cur:S.goalCur, target:S.goalTarget, done:S.goalDone },
      mini:{ name:'Mini Challenge', sub:'ผ่านแล้วสลับทันที', cur:miniCur, target:miniTar, done:S.miniDone },
      allDone:false
    });
  }

  function addScore(delta){
    S.score += (delta|0);
    if(S.score<0) S.score = 0;
  }

  function rewardMini(){
    // โบนัส: สุ่มให้ Shield หรือ Star (ให้รู้สึก “แฟร์”)
    const r = S.rng();
    if(r < 0.55){
      S.shield = Math.min(3, S.shield + 1);
      addScore(10);
      emit('hha:judge',{ type:'perfect', label:'BONUS SHIELD!' });
    }else{
      // Star reward effect: reduce miss by 1
      const before = S.miss;
      S.miss = Math.max(0, S.miss - 1);
      addScore(14);
      emit('hha:judge',{ type:'perfect', label:(before!==S.miss)?'BONUS MISS -1!':'BONUS STAR!' });
    }
    emit('hha:coach',{ msg:'ทำมินิสำเร็จ! ได้โบนัส 🎁', tag:'Coach' });
  }

  function rotateMini(){
    S.miniDone = false;
    S.miniIndex++;
    // reset both
    S.miniA.windowStart = nowMs();
    S.miniA.groups.clear();
    S.miniB.streak = 0;
  }

  function onHit(kind, meta={}){
    if(S.ended) return;

    if(kind==='good'){
      S.hitGood++;
      S.goalCur++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      addScore(10 + Math.min(10, S.combo));
      setFever(S.fever + 2);
      emit('hha:judge', { type:'good', label:'GOOD' });

      // Food5 group stats + mini tracking
      const gid = Number(meta.groupId||1);
      if(FOOD5[gid]) S.groupHit[gid] = (S.groupHit[gid]||0) + 1;

      // Mini A: 3 groups in window
      if(S.miniIndex % 2 === 0){
        const a = S.miniA;
        const dt = nowMs() - a.windowStart;
        if(dt > a.windowSec*1000){
          a.windowStart = nowMs();
          a.groups.clear();
          S.miniDone = false;
        }
        a.groups.add(gid);

        if(!S.miniDone && a.groups.size >= a.need){
          S.miniDone = true;
          rewardMini();
          rotateMini(); // “ผ่านแล้วสลับทันที”
        }
      }
      // Mini B: streak goods (no miss reset elsewhere)
      else{
        const b = S.miniB;
        b.streak++;
        if(!S.miniDone && b.streak >= b.need){
          S.miniDone = true;
          rewardMini();
          rotateMini();
        }
      }

      // Goal done
      if(!S.goalDone && S.goalCur >= S.goalTarget){
        S.goalDone = true;
        emit('hha:coach',{ msg:'GOAL สำเร็จ! 🎉', tag:'Coach' });
      }
    }

    else if(kind==='junk'){
      // shield blocks junk -> NOT MISS
      if(S.shield>0){
        S.shield--;
        emit('hha:judge', { type:'perfect', label:'BLOCK!' });
      }else{
        S.hitJunk++;
        S.miss++;
        S.combo = 0;
        addScore(-6);
        setFever(S.fever + 6);
        emit('hha:judge', { type:'bad', label:'OOPS' });
      }
      // miss breaks mini B streak
      S.miniB.streak = 0;
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
      addScore(8);
      emit('hha:judge', { type:'perfect', label:'SHIELD!' });
    }

    setHUD();
    setQuestHUD();
  }

  function chooseGroupId(rng){
    // 1..5 เท่า ๆ กัน (แฟร์)
    return 1 + Math.floor((rng ? rng() : Math.random()) * 5);
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
    }else{
      el.textContent = '🛡️';
      el.dataset.group = 'shield';
    }
  }

  function spawn(kind){
    if(S.ended || !layer) return;

    const safe = getSafeRect();
    const x = safe.x + S.rng()*safe.w;
    const y = safe.y + S.rng()*safe.h;

    const tEl = DOC.createElement('div');
    tEl.className = 'gj-target spawn';
    tEl.dataset.kind = kind;

    const t = { kind, rng:S.rng, groupId: 1 };
    if(kind === 'good') t.groupId = chooseGroupId(S.rng);

    decorateTarget(tEl, t);

    const size =
      (kind==='good') ? 56 :
      (kind==='junk') ? 58 :
      52;

    tEl.style.left = x+'px';
    tEl.style.top  = y+'px';
    tEl.style.fontSize = size+'px';

    let alive = true;
    const kill = ()=>{
      if(!alive) return;
      alive=false;
      try{ tEl.remove(); }catch(_){}
    };

    tEl.addEventListener('pointerdown', ()=>{
      if(!alive || S.ended) return;
      kill();
      onHit(kind, { groupId: t.groupId });
    });

    layer.appendChild(tEl);

    // TTL (แฟร์ ไม่แว้บ)
    const ttl =
      (kind==='star' || kind==='shield') ? 1700 :
      1600;

    setTimeout(()=>{
      if(!alive || S.ended) return;
      kill();
      if(kind==='good'){
        S.expireGood++;
        S.miss++;
        S.combo = 0;
        S.miniB.streak = 0;
        setFever(S.fever + 5);
        emit('hha:judge', { type:'miss', label:'MISS' });
        setHUD();
        setQuestHUD();
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
    const gid  = Number(picked.dataset.group || 1);

    try{ picked.remove(); }catch(_){}
    onHit(kind, { groupId: gid });
  }

  function showEnd(summary){
    // minimal end overlay (ไม่ต้องแก้ HTML)
    try{
      if(S.endPanel) S.endPanel.remove();
    }catch(_){}

    const p = DOC.createElement('div');
    p.style.position='fixed';
    p.style.inset='0';
    p.style.zIndex='999';
    p.style.display='flex';
    p.style.alignItems='center';
    p.style.justifyContent='center';
    p.style.padding='24px';
    p.style.background='rgba(2,6,23,.72)';
    p.style.backdropFilter='blur(10px)';

    const card = DOC.createElement('div');
    card.style.width='min(720px,96vw)';
    card.style.border='1px solid rgba(148,163,184,.22)';
    card.style.borderRadius='22px';
    card.style.background='rgba(2,6,23,.80)';
    card.style.padding='18px';
    card.style.boxShadow='0 18px 55px rgba(0,0,0,.45)';
    card.style.color='#e5e7eb';
    card.style.fontFamily='system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif';

    const title = DOC.createElement('div');
    title.style.fontWeight='1200';
    title.style.fontSize='20px';
    title.textContent='สรุปผล GoodJunkVR';

    const line = DOC.createElement('div');
    line.style.marginTop='10px';
    line.style.lineHeight='1.6';
    line.innerHTML =
      `คะแนน: <b>${summary.scoreFinal}</b> · MISS: <b>${summary.miss}</b> · เกรด: <b>${summary.grade}</b><br/>
       ของดี: <b>${summary.hitGood}</b> · ขยะ: <b>${summary.hitJunk}</b> · ของดีหมดเวลา: <b>${summary.expireGood}</b>`;

    const btnRow = DOC.createElement('div');
    btnRow.style.display='flex';
    btnRow.style.gap='10px';
    btnRow.style.marginTop='14px';
    btnRow.style.flexWrap='wrap';

    const btnAgain = DOC.createElement('button');
    btnAgain.textContent='เล่นอีกครั้ง';
    btnAgain.style.height='44px';
    btnAgain.style.padding='0 14px';
    btnAgain.style.borderRadius='16px';
    btnAgain.style.border='1px solid rgba(148,163,184,.22)';
    btnAgain.style.background='rgba(15,23,42,.55)';
    btnAgain.style.color='#e5e7eb';
    btnAgain.style.fontWeight='1100';
    btnAgain.onclick=()=>location.reload();

    const btnHub = DOC.createElement('button');
    btnHub.textContent='กลับ HUB';
    btnHub.style.height='44px';
    btnHub.style.padding='0 14px';
    btnHub.style.borderRadius='16px';
    btnHub.style.border='1px solid rgba(34,197,94,.35)';
    btnHub.style.background='rgba(34,197,94,.16)';
    btnHub.style.color='#eafff3';
    btnHub.style.fontWeight='1200';
    btnHub.onclick=()=>{
      const hub = qs('hub', null);
      try{ WIN.HHACloudLogger?.flush?.(); }catch(_){}
      if(hub) location.href = hub;
      else p.remove();
    };

    btnRow.appendChild(btnAgain);
    btnRow.appendChild(btnHub);

    card.appendChild(title);
    card.appendChild(line);
    card.appendChild(btnRow);
    p.appendChild(card);
    DOC.body.appendChild(p);

    S.endPanel = p;
  }

  function endGame(reason='timeup'){
    if(S.ended) return;
    S.ended = true;

    const grade = computeGrade();
    const summary = {
      game:'GoodJunkVR',
      pack:'fair+food5',
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
      feverFinal: Math.round(S.fever),

      groupHit: S.groupHit,
      goalTarget:S.goalTarget,
      goalCur:S.goalCur,

      grade,
      reason
    };

    try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
    try{ WIN.removeEventListener('hha:shoot', onShoot); }catch(_){}

    // flush logger if exists
    try{ WIN.HHACloudLogger?.flush?.(); }catch(_){}

    emit('hha:end', summary);
    showEnd(summary);
  }

  function updateLowTime(){
    if(!elLowOverlay || !elLowNum) return;
    const t = Math.ceil(S.timeLeft);
    if(t <= 5 && t > 0){
      elLowNum.textContent = String(t);
      elLowOverlay.setAttribute('aria-hidden','false');
    }else{
      elLowOverlay.setAttribute('aria-hidden','true');
    }
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

    // spawn cadence
    if(ts - S.lastSpawn >= CFG.spawnMs){
      S.lastSpawn = ts;

      // fair distribution:
      // good: CFG.goodP, junk: CFG.junkP, star 2%, shield 2%
      const r = S.rng();
      const pGood = CFG.goodP;
      const pJunk = CFG.goodP + CFG.junkP;

      if(r < pGood) spawn('good');
      else if(r < pJunk) spawn('junk');
      else if(r < 0.98) spawn('star');
      else spawn('shield');
    }

    if(S.timeLeft<=0){
      endGame('timeup');
      return;
    }

    // update mission timers
    setQuestHUD();
    requestAnimationFrame(tick);
  }

  // start
  S.started = true;
  setFever(S.fever);
  setShieldUI();
  setHUD();
  setQuestHUD();

  // listen shoot
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  emit('hha:start', {
    game:'GoodJunkVR',
    pack:'fair+food5',
    view, runMode:run, diff,
    timePlanSec:timePlan,
    seed
  });

  requestAnimationFrame(tick);
}