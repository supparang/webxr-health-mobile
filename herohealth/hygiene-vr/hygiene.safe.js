// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard) — PATCH v20260219c
// ✅ Quiz buttons 1–4 (mobile/pc click) + cVR shoot select
// ✅ FIX: overlay scroll works (CSS side) + targets die instantly (is-dying)
// ✅ TTL cleanup + cap + watchdog (anti-stall)
// Exports: boot()
'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v,min,max)=>Math.max(min, Math.min(max, Number(v)||0));
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function makeRNG(seed){
  let x = (Number(seed)||Date.now()) >>> 0;
  return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
}
function loadJson(key, fb){
  try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch{}
}
function nowIso(){ try{return new Date().toISOString();}catch{ return ''; } }
function nowMs(){ return (performance && performance.now) ? performance.now() : Date.now(); }
function copyText(text){ return navigator.clipboard?.writeText(String(text)).catch(()=>{}); }

function isTouchDevice(){
  try{ return ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0; }catch{ return false; }
}
function prefersReducedMotion(){
  try{ return WIN.matchMedia && WIN.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch{ return false; }
}

const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6 },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6 },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6 },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6 },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6 },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6 },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6 },
];
const ICON_HAZ = '🦠';

function rectOf(id){
  try{
    const el = DOC.getElementById(id);
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return { r };
  }catch{ return null; }
}
function pointInRect(x,y, rr){
  if(!rr) return false;
  const r = rr.r || rr;
  return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom;
}

export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage){
    console.error('[Hygiene] stage not found');
    return;
  }

  // HUD
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillQuest= DOC.getElementById('pillQuest');
  const pillPower= DOC.getElementById('pillPower');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const barStep  = DOC.getElementById('barStep');
  const barLoop  = DOC.getElementById('barLoop');

  // overlays
  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart     = DOC.getElementById('btnStart');
  const btnPractice  = DOC.getElementById('btnPractice');
  const btnRestart   = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // quiz dom
  const quizBox  = DOC.getElementById('quizBox');
  const quizQ    = DOC.getElementById('quizQ');
  const quizSub  = DOC.getElementById('quizSub');
  const quizOpts = DOC.getElementById('quizOpts');
  const opt0 = DOC.getElementById('opt0');
  const opt1 = DOC.getElementById('opt1');
  const opt2 = DOC.getElementById('opt2');
  const opt3 = DOC.getElementById('opt3');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const fxOn = (qs('fx','1') !== '0') && !prefersReducedMotion();

  // difficulty base
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.75, hazardRate:0.07, decoyRate:0.15, lifeMs:[1500, 2200] };
    if(diff==='hard') return { spawnPerSec:2.55, hazardRate:0.14, decoyRate:0.26, lifeMs:[1200, 1900] };
    return { spawnPerSec:2.15, hazardRate:0.11, decoyRate:0.22, lifeMs:[1300, 2100] };
  })();

  // AI optional
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({
    seed, runMode,
    base,
    bounds:{ spawnPerSec:[1.15, 4.00], hazardRate:[0.05, 0.24], decoyRate:[0.10, 0.38] }
  }) : null;

  // state
  let running=false, paused=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0;
  let hitsInStep=0;
  let loopsDone=0;

  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];
  let spawnAcc=0;

  // mission/power (คงไว้)
  let mission = { id:'', text:'', done:0, meta:{ pct:0 } };
  const power = { shield:0, focusUntil:0, freezeUntil:0 };

  // quiz state
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

  // targets
  // {id, el, kind, stepIdx, bornMs, dieAtMs, x,y, radius}
  const targets = [];
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }
  function coachTip(text, cdMs){
    const now = nowMs();
    const cd = Number(cdMs||1400);
    if(!coachTip._t || (now - coachTip._t) > cd){
      coachTip._t = now;
      if(text) showBanner(`🤖 ${text}`);
    }
  }

  function fxHit(kind, obj){
    if(!fxOn) return;
    const P = WIN.Particles;
    if(!P || !obj) return;
    const x = Number(obj.x || WIN.innerWidth*0.5);
    const y = Number(obj.y || WIN.innerHeight*0.5);
    if(kind==='good'){
      P.popText(x,y,'✅ +1','good'); P.burst(x,y,{count:12,spread:46,upBias:.86});
    }else if(kind==='wrong'){
      P.popText(x,y,'⚠️ ผิด!','warn'); P.burst(x,y,{count:10,spread:40,upBias:.82});
    }else{
      P.popText(x,y,'🦠','bad'); P.burst(x,y,{count:14,spread:54,upBias:.90});
    }
  }

  function setQuizVisible(on){
    quizOpen = !!on;
    if(quizBox) quizBox.style.display = on ? 'block' : 'none';
  }

  function pickQuiz(){
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    return bank[Math.floor(rng()*bank.length)] || null;
  }

  function openRandomQuiz(){
    const q = pickQuiz();
    if(!q || !quizQ || !quizSub || !quizOpts) return;

    setQuizVisible(true);

    const options = [q.a].concat((q.wrong||[]).slice(0,3));
    while(options.length < 4) options.push('—');

    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i],options[j]] = [options[j],options[i]];
    }
    const correctIndex = options.indexOf(q.a);

    quizOpen._armed = true;
    quizOpen._answered = false;
    quizOpen._t0 = nowMs();
    quizOpen._q = q;
    quizOpen._options = options.slice(0,4);
    quizOpen._correctI = correctIndex;

    quizQ.textContent = `🧠 Quiz: ${q.q}`;
    quizSub.textContent = `เลือกคำตอบที่ถูก (1–4)`;

    if(opt0) opt0.textContent = options[0] || '—';
    if(opt1) opt1.textContent = options[1] || '—';
    if(opt2) opt2.textContent = options[2] || '—';
    if(opt3) opt3.textContent = options[3] || '—';

    try{
      [...quizOpts.querySelectorAll('.hw-quiz-opt')].forEach(b=>{
        b.classList.remove('is-right','is-wrong');
      });
    }catch{}
  }

  function closeQuiz(msg){
    if(quizOpen){
      setQuizVisible(false);
      quizOpen = false;
      quizOpen._armed = false;
      quizOpen._answered = false;
      if(msg) showBanner(msg);
    }
  }

  function answerQuiz(i, source){
    if(!quizOpen || !quizOpen._armed || quizOpen._answered) return;
    i = Number(i);
    if(!Number.isFinite(i) || i<0 || i>3) return;

    quizOpen._answered = true;

    const ok = (i === quizOpen._correctI);
    if(ok) quizRight++;
    else quizWrong++;

    try{
      const btns = [...(quizOpts?.querySelectorAll('.hw-quiz-opt')||[])];
      btns.forEach(b=>{
        const bi = Number(b.getAttribute('data-i'));
        b.classList.remove('is-right','is-wrong');
        if(bi === quizOpen._correctI) b.classList.add('is-right');
        if(!ok && bi === i) b.classList.add('is-wrong');
      });
    }catch{}

    showBanner(ok ? '✅ ตอบถูก!' : '❌ ตอบผิด!');
    coachTip(ok ? 'เก่งมาก! จำได้แล้ว' : 'ไม่เป็นไร ลองท่อง “ฝ่า-หลัง-ซอก-ข้อ-โป้ง-เล็บ-ข้อมือ”', 1200);

    emit('hha:judge', { kind:'quiz', ok, choiceIndex:i, correctIndex:quizOpen._correctI, source:source||'tap' });

    setTimeout(()=>{ closeQuiz(null); }, 650);
  }

  quizOpts?.addEventListener('click', (e)=>{
    const t = e.target?.closest?.('.hw-quiz-opt');
    if(!t) return;
    answerQuiz(Number(t.getAttribute('data-i')), 'tap');
  }, { passive:true });

  function getMissCount(){ return (wrongStepHits + hazHits); }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 160;
    const bottomSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 160;

    // dynamic by hud dom
    const hudTop = rectOf('hudTop');
    let topSafe = topSafeVar;
    if(hudTop) topSafe = Math.max(topSafe, hudTop.r.bottom + 12);

    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafeVar - pad;
    return { x0,x1,y0,y1,w,h };
  }

  function pickSpawnXY(radius){
    const rect = getSpawnRect();
    for(let t=0;t<18;t++){
      const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
      const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

      if(pointInRect(x,y, rectOf('hudTop'))) continue;
      if(pointInRect(x,y, rectOf('banner'))) continue;
      if(pointInRect(x,y, rectOf('startOverlay'))) continue;
      if(pointInRect(x,y, rectOf('endOverlay'))) continue;

      let ok = true;
      for(const ot of targets){
        const dx = ot.x-x, dy = ot.y-y;
        const rr = (ot.radius||radius)+radius+8;
        if((dx*dx+dy*dy) < rr*rr){ ok=false; break; }
      }
      if(ok) return {x,y,rect};
    }
    return { x:(rect.x0+rect.x1)/2, y:(rect.y0+rect.y1)/2, rect };
  }

  function setHud(){
    const s = STEPS[stepIdx];

    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    pillQuest && (pillQuest.textContent = `MISSION ${mission.text || 'ทำ STEP ให้ถูก!'}`);
    pillPower && (pillPower.textContent = `POWER 🛡️${power.shield} • 🎯${(power.focusUntil>nowMs())?'ON':'OFF'} • ❄️${(power.freezeUntil>nowMs())?'ON':'OFF'}`);

    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • tgt=${targets.length}`);

    if(barStep){
      const pct = clamp(hitsInStep / Math.max(1, s.hitsNeed), 0, 1);
      barStep.style.width = (pct*100).toFixed(1) + '%';
    }
    if(barLoop){
      const stepAcross = (stepIdx + (hitsInStep / Math.max(1, s.hitsNeed))) / 7;
      barLoop.style.width = (clamp(stepAcross,0,1)*100).toFixed(1) + '%';
    }
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      try{ t.el?.remove(); }catch{}
    }
  }

  function killTarget(obj){
    if(!obj || !obj.el) return;
    try{
      obj.el.classList.add('is-dying');
      const el = obj.el;
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 170);
    }catch{}
  }
  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    killTarget(obj);
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);
    stage.appendChild(el);

    const tgtSize = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--tgtSize').replace('px','')) || 76;
    const radius = Math.max(26, tgtSize*0.5);

    const {x,y,rect} = pickSpawnXY(radius);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const P = dd ? dd.getParams() : base;
    const lifeMin = (P.lifeMs && P.lifeMs[0]) ? Number(P.lifeMs[0]) : 1300;
    const lifeMax = (P.lifeMs && P.lifeMs[1]) ? Number(P.lifeMs[1]) : 2100;
    const lifeMs = clamp(lifeMin + rng()*(lifeMax-lifeMin), 900, 4000);

    const born = nowMs();
    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: born, dieAtMs: born+lifeMs, x,y, radius };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> judgeHit(obj,'tap',null), { passive:true });
    }
    return obj;
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = dd ? dd.getParams() : base;

    const r = rng();
    if(r < P.hazardRate) return createTarget('haz', ICON_HAZ, -1);
    if(r < P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<7;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }
    return createTarget('good', s.icon, stepIdx);
  }

  // cVR shoot: if quiz open -> answer; else shoot gameplay
  function onShoot(e){
    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||34);

    // quiz aim-select
    if(view==='cvr' && quizOpen && quizOpen._armed && !quizOpen._answered && quizOpts){
      const rect = quizOpts.getBoundingClientRect();
      const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;
      if(cx>=rect.left && cx<=rect.right && cy>=rect.top && cy<=rect.bottom){
        let best=null, bestDist=1e9;
        const btns = [...quizOpts.querySelectorAll('.hw-quiz-opt')];
        for(const b of btns){
          const r = b.getBoundingClientRect();
          const bx = (r.left+r.right)/2, by = (r.top+r.bottom)/2;
          const dist = Math.hypot(bx-cx, by-cy);
          if(dist<lockPx && dist<bestDist){ best=b; bestDist=dist; }
        }
        if(best){
          answerQuiz(Number(best.getAttribute('data-i')), 'shoot');
          return;
        }
      }
    }

    if(!running || paused) return;
    if(view !== 'cvr') return;

    const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;
    let best=null, bestDist=1e9;
    for(const t of targets){
      const dx = t.x - cx, dy = t.y - cy;
      const dist = Math.hypot(dx,dy);
      if(dist < lockPx && dist < bestDist){ best=t; bestDist=dist; }
    }
    if(best) judgeHit(best,'shoot',{lockPx,dist:bestDist});
  }

  function judgeHit(obj, source, extra){
    if(!running || paused) return;

    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++; totalStepHits++;
      hitsInStep++;
      combo++; comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      coach?.onEvent?.('step_hit', { stepIdx, ok:true, rtMs:rt, stepAcc:getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:true, rtMs:rt, elapsedSec:elapsedSec() });
      emit('hha:judge', { kind:'good', stepIdx, rtMs:rt, source, extra });

      fxHit('good', obj);
      removeTarget(obj);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++; hitsInStep=0;
        if(stepIdx >= STEPS.length){
          stepIdx=0; loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          if(!quizOpen && rng()<0.85) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng()<0.22) openRandomQuiz();
        }
      }

      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++; totalStepHits++;
      combo = 0;

      coach?.onEvent?.('step_hit', { stepIdx, ok:false, wrongStepIdx:obj.stepIdx, rtMs:rt });
      dd?.onEvent?.('step_hit', { ok:false, rtMs:rt, elapsedSec:elapsedSec() });
      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx:obj.stepIdx, rtMs:rt, source, extra });

      fxHit('wrong', obj);
      removeTarget(obj);

      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      if(getMissCount() >= missLimit) endGame('fail');

      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++; combo=0;

      coach?.onEvent?.('haz_hit', { stepIdx, rtMs:rt });
      dd?.onEvent?.('haz_hit', { elapsedSec:elapsedSec() });
      emit('hha:judge', { kind:'haz', stepIdx, rtMs:rt, source, extra });

      fxHit('haz', obj);
      removeTarget(obj);

      showBanner('🦠 โดนเชื้อ! ระวัง!');
      if(getMissCount() >= missLimit) endGame('fail');

      setHud();
      return;
    }
  }

  function cleanupExpiredTargets(){
    const t = nowMs();
    for(let i=targets.length-1;i>=0;i--){
      const obj = targets[i];
      if(t >= obj.dieAtMs){
        targets.splice(i,1);
        killTarget(obj);
      }
    }
  }

  function mobileThrottleFactor(){
    const touch = isTouchDevice();
    const n = targets.length|0;
    if(!touch) return 1.0;
    if(n >= 14) return 0.65;
    if(n >= 10) return 0.80;
    return 0.95;
  }

  function tick(){
    if(!running) return;

    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;
    tick._lastBeat = t;

    if(paused){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){ endGame('time'); return; }

    cleanupExpiredTargets();

    const P = dd ? dd.getParams() : base;
    const mul = mobileThrottleFactor();
    spawnAcc += (P.spawnPerSec * mul * dt);

    const cap = (view==='cvr') ? 16 : 18;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      if(targets.length >= cap) break;
      spawnOne();
    }

    dd?.onEvent?.('tick', { elapsedSec: elapsedSec() });

    setHud();
    requestAnimationFrame(tick);
  }

  function startWatchdog(){
    clearInterval(startWatchdog._t);
    startWatchdog._t = setInterval(()=>{
      if(!running || paused) return;
      const now = nowMs();
      const last = tick._lastBeat || 0;
      if(last && (now - last) > 1800){
        console.warn('[Hygiene] watchdog nudge', now-last);
        showBanner('⚠️ เกมสะดุด… กำลังดึงกลับมา');
        try{ requestAnimationFrame(tick); }catch{}
      }
    }, 700);
  }
  function stopWatchdog(){ clearInterval(startWatchdog._t); }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;
    spawnAcc=0;

    quizRight = 0;
    quizWrong = 0;
    setQuizVisible(false);

    mission = { id:'', text:'', done:0, meta:{ pct:0 } };
    power.shield=0; power.focusUntil=0; power.freezeUntil=0;

    setHud();
  }

  function startGame(playSeconds){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    if(Number.isFinite(playSeconds) && playSeconds>0){
      timeLeft = clamp(playSeconds, 5, timePlannedSec);
    }

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    startWatchdog();
    setHud();
    requestAnimationFrame(tick);
  }

  function median(arr){
    const a = (arr||[]).slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m = (a.length-1)/2;
    return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
  }

  function endGame(reason){
    if(!running) return;
    running=false; paused=false;
    stopWatchdog();

    clearTargets();
    setQuizVisible(false);

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    const rtMed = median(rtOk);

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'20260219c',
      game:'hygiene',
      gameMode:'hygiene',
      runMode, diff, view, seed,
      sessionId,
      timestampIso: nowIso(),

      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      loopsDone,
      stepIdxEnd: stepIdx,
      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),

      quizRight,
      quizWrong,

      medianStepMs: rtMed
    };

    if(coach?.getSummaryExtras) Object.assign(summary, coach.getSummaryExtras() || {});
    if(dd?.getSummaryExtras) Object.assign(summary, dd.getSummaryExtras() || {});

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    if(endTitle) endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    if(endSub) endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    if(endJson) endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    if(endOverlay) endOverlay.style.display = 'grid';
  }

  function goHub(){
    try{ location.href = hub || '../hub.html'; }catch{}
  }

  // binds
  btnStart?.addEventListener('click', ()=>startGame(), { passive:true });
  btnPractice?.addEventListener('click', ()=>startGame(15), { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', ()=>startGame(), { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  WIN.addEventListener('hha:shoot', onShoot);

  // init
  setHud();
}