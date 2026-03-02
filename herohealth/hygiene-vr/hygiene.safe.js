// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard) — PATCH v20260222a (AI Coach + AI Prediction)
// ✅ AI Coach: explainable micro-tips + rate-limit + not spammy
// ✅ AI Prediction: next risk zone (deterministic) shown in HUD pillAI + saved in summary.ai
// ✅ Keeps: Kid-only end, Teacher toggle (lazy), Heatmap2D, Evaluate, Create, Practice focus, TTL, watchdog
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

const ZONES = [
  { id:'palm',  name:'ฝ่ามือ', stepKey:'palm'  },
  { id:'back',  name:'หลังมือ', stepKey:'back'  },
  { id:'gaps',  name:'ซอกนิ้ว', stepKey:'gaps'  },
  { id:'knuck', name:'ข้อนิ้ว', stepKey:'knuck' },
  { id:'thumb', name:'โป้ง',    stepKey:'thumb' },
  { id:'nails', name:'เล็บ',    stepKey:'nails' },
  { id:'wrist', name:'ข้อมือ',  stepKey:'wrist' },
];

function rectOf(id){
  try{
    const el = DOC.getElementById(id);
    if(!el) return null;
    const r = el.getBoundingClientRect();
    return { x:r.left, y:r.top, w:r.width, h:r.height, r };
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
  const pillAI   = DOC.getElementById('pillAI'); // ✅ NEW
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const barStep  = DOC.getElementById('barStep');
  const barLoop  = DOC.getElementById('barLoop');

  const quizBox  = DOC.getElementById('quizBox');
  const quizQ    = DOC.getElementById('quizQ');
  const quizSub  = DOC.getElementById('quizSub');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // Kid summary
  const kidBadge   = DOC.getElementById('kidBadge');
  const kidLine1   = DOC.getElementById('kidLine1');
  const kidLine2   = DOC.getElementById('kidLine2');
  const kidTopRisk = DOC.getElementById('kidTopRisk');
  const btnPracticeRisk = DOC.getElementById('btnPracticeRisk');

  // Teacher toggle
  const btnToggleDetails = DOC.getElementById('btnToggleDetails');
  const detailsBody = DOC.getElementById('detailsBody');

  // Evaluate/Create (inside details)
  const evalHint      = DOC.getElementById('evalHint');
  const handMap       = DOC.getElementById('handMap');
  const evalPicked    = DOC.getElementById('evalPicked');
  const evalScore     = DOC.getElementById('evalScore');
  const evalReasons   = DOC.getElementById('evalReasons');
  const btnEvalConfirm= DOC.getElementById('btnEvalConfirm');
  const btnEvalSkip   = DOC.getElementById('btnEvalSkip');

  const createBox     = DOC.getElementById('createBox');
  const routineOpts   = DOC.getElementById('routineOpts');
  const createPicked  = DOC.getElementById('createPicked');
  const createScore   = DOC.getElementById('createScore');
  const createTimerEl = DOC.getElementById('createTimer');
  const btnCreateConfirm = DOC.getElementById('btnCreateConfirm');

  // Buttons
  const btnStart     = DOC.getElementById('btnStart');
  const btnPractice  = DOC.getElementById('btnPractice');
  const btnRestart   = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const fxOn = (qs('fx','1') !== '0') && !prefersReducedMotion();

  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.75, hazardRate:0.07, decoyRate:0.15, lifeMs:[1500, 2200] };
    if(diff==='hard') return { spawnPerSec:2.55, hazardRate:0.14, decoyRate:0.26, lifeMs:[1200, 1900] };
    return { spawnPerSec:2.15, hazardRate:0.11, decoyRate:0.22, lifeMs:[1300, 2100] };
  })();

  // external optional AI packs
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');
  const coachExt = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
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

  const stepStats = STEPS.map(s=>({ key:s.key, label:s.label, ok:0, wrong:0, haz:0, rt:[] }));

  let mission = { id:'', text:'', done:0, t0:0, meta:{} };
  const power = { shield:0, focusUntil:0, freezeUntil:0 };

  let questText = 'ทำ STEP ให้ถูก!';
  let quizOpen = false;
  let quizRight = 0;
  let quizWrong = 0;

  // practice focus
  const practice = { on:false, focusStepIdx:null };

  // targets
  const targets = [];
  let nextId=1;

  // end summary
  let endSummary = null;

  // evaluate/create states (lazy)
  let evalState = { active:false, pickedZone:null, pickedReason:null, topRiskZone:null, confirmed:false };
  let createState = { active:false, picked:[], score:null, left:30, t:null };
  let teacherInitDone = false;

  // =========================================================
  // (1) AI COACH (Explainable + Rate-limit)
  // =========================================================
  const AI_COACH = {
    lastAt: 0,
    cooldownMs: 1400,
    shown: [],
    maxShown: 12,
    enabled: true,
    say(type, text){
      if(!AI_COACH.enabled) return false;
      const now = nowMs();
      if(now - AI_COACH.lastAt < AI_COACH.cooldownMs) return false;
      AI_COACH.lastAt = now;
      const msg = `🤖 ${text}`;
      showBanner(msg);
      AI_COACH.shown.push({ t: nowIso(), type, text });
      if(AI_COACH.shown.length > AI_COACH.maxShown) AI_COACH.shown.shift();
      return true;
    }
  };

  // recent events for explainable tips/prediction
  const recent = []; // {kind, stepKey, rt, ts}
  function pushRecent(e){
    recent.push(e);
    if(recent.length > 18) recent.shift();
  }
  function recentStats(){
    let wrong=0, haz=0, ok=0, slow=0;
    const n = recent.length || 1;
    for(const e of recent){
      if(e.kind==='wrong') wrong++;
      else if(e.kind==='haz') haz++;
      else if(e.kind==='good') ok++;
      if(e.rt && e.rt>900) slow++;
    }
    return { n, wrong, haz, ok, slow, wrongRate:wrong/n, hazRate:haz/n, slowRate:slow/n };
  }

  function explainableCoachTick(){
    if(!running || paused) return;
    if(practice.on) return; // practice ไม่ต้องสอนเยอะ

    const rs = recentStats();

    // 1) ถ้าโดนเชื้อรัว -> แนะหลบ
    if(rs.haz >= 2 && rs.hazRate > 0.18){
      AI_COACH.say('haz', 'ระวัง 🦠 นะ! ถ้าจอเริ่มแน่น ให้โฟกัส “เป้าถูก” ก่อน แล้วค่อยเก็บคอมโบ');
      return;
    }

    // 2) ถ้ากดผิดขั้นตอนบ่อย -> แนะดู pillStep
    if(rs.wrong >= 2 && rs.wrongRate > 0.22){
      const s = STEPS[stepIdx];
      AI_COACH.say('wrong', `ตอนนี้ STEP คือ ${s.label} — ให้แตะไอคอน ${s.icon} เท่านั้น`);
      return;
    }

    // 3) ถ้าตอบช้า -> แนะเลือกเป้าที่ใกล้/ไม่รีบ
    if(rs.slow >= 3 && rs.slowRate > 0.25){
      AI_COACH.say('slow', 'ลองแตะเป้าที่อยู่ใกล้มือ/กลางจอ จะเร็วขึ้น และลดพลาด');
      return;
    }

    // 4) ถ้าคอมโบหลุดบ่อยช่วงหลัง -> แนะทำช้าแต่นิ่ง
    if(combo===0 && rs.n>=8 && (rs.wrong+rs.haz)>=3){
      AI_COACH.say('reset', 'ไม่เป็นไร! ค่อย ๆ ทำทีละเป้าให้ถูก จะกลับมาคอมโบยาวได้');
      return;
    }
  }

  // =========================================================
  // (2) AI PREDICTION (Next Risk Zone) — deterministic + explainable
  // =========================================================
  function median(arr){
    const a = (arr||[]).slice().sort((x,y)=>x-y);
    if(!a.length) return 0;
    const m = (a.length-1)/2;
    return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
  }

  function calcHeatmap2D(){
    const hm = STEPS.map((s,i)=>{
      const st = stepStats[i];
      const total = st.ok + st.wrong + st.haz;
      const risk = total ? ((st.wrong + st.haz) / total) : 0;
      const rtMed = median(st.rt);
      return {
        zoneId: s.key,
        label: s.label,
        ok: st.ok,
        wrong: st.wrong,
        haz: st.haz,
        risk,
        heat: (risk>=0.34) ? 2 : (risk>=0.18 ? 1 : 0),
        medianRtMs: rtMed
      };
    });

    const top = hm.slice().sort((a,b)=>{
      if(b.risk!==a.risk) return b.risk-a.risk;
      if(b.haz!==a.haz) return b.haz-a.haz;
      return b.wrong-a.wrong;
    })[0] || null;

    return { heatmap: hm, topRisk: top ? top.zoneId : null };
  }

  function predictNextRisk(){
    // base from heatmap risk + recent errors by stepKey
    const hm = calcHeatmap2D().heatmap;
    const recentBoost = new Map();
    for(const e of recent){
      const k = e.stepKey || '';
      if(!k) continue;
      const b = recentBoost.get(k) || 0;
      // wrong/haz gives bigger weight; slow gives slight weight
      const add = (e.kind==='haz') ? 0.22 : (e.kind==='wrong') ? 0.16 : (e.rt && e.rt>900) ? 0.06 : 0;
      recentBoost.set(k, b + add);
    }

    // deterministic tie-breaker using rng() but stable because rng is seeded
    const scored = hm.map(z=>{
      const boost = recentBoost.get(z.zoneId) || 0;
      const slow = (z.medianRtMs||0) > 900 ? 0.05 : 0;
      const baseScore = (z.risk||0) * 0.70 + boost + slow;

      // small deterministic jitter
      const jitter = (rng()*0.04);
      return { ...z, score: baseScore + jitter, explain:{ risk:z.risk, boost, slow } };
    }).sort((a,b)=>b.score-a.score);

    const pick = scored[0] || null;
    if(!pick) return null;

    // explanation line (short)
    const parts = [];
    if(pick.explain.boost >= 0.12) parts.push('พลาด/โดนเชื้อช่วงล่าสุด');
    if((pick.medianRtMs||0) > 900) parts.push('ตอบช้าจุดนี้');
    if((pick.risk||0) >= 0.18) parts.push('สถิติเสี่ยงจากเกมนี้');
    const why = parts.length ? parts.join(' + ') : 'สถิติโดยรวม';

    return {
      zoneId: pick.zoneId,
      label: pick.label,
      score: Number(pick.score.toFixed(3)),
      why,
      components: pick.explain
    };
  }

  function setAIPill(pred){
    if(!pillAI) return;
    if(!pred){
      pillAI.textContent = '🤖 AI: —';
      pillAI.classList.remove('hot');
      return;
    }
    const name = (ZONES.find(z=>z.id===pred.zoneId)?.name) || pred.label || pred.zoneId;
    pillAI.textContent = `🤖 AI: เสี่ยงถัดไป “${name}”`;
    // highlight when strong
    if((pred.components.boost||0) >= 0.18 || (pred.risk||0) >= 0.22) pillAI.classList.add('hot');
    else pillAI.classList.remove('hot');
  }

  // =========================================================
  // UI helpers
  // =========================================================
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  function fxHit(kind, obj){
    if(!fxOn) return;
    const P = WIN.Particles;
    if(!P || !obj) return;
    const x = Number(obj.x || WIN.innerWidth*0.5);
    const y = Number(obj.y || WIN.innerHeight*0.5);

    if(kind === 'good'){
      P.popText(x, y, '✅ +1', 'good');
      P.burst(x, y, { count: 12, spread: 46, upBias: 0.86 });
    }else if(kind === 'wrong'){
      P.popText(x, y, '⚠️ ผิด!', 'warn');
      P.burst(x, y, { count: 10, spread: 40, upBias: 0.82 });
    }else if(kind === 'haz'){
      P.popText(x, y, power.shield>0 ? '🛡️ กันได้!' : '🦠 โดนเชื้อ!', power.shield>0 ? 'cyan' : 'bad');
      P.burst(x, y, { count: 14, spread: 54, upBias: 0.90 });
    }
  }

  function setQuizVisible(on){
    quizOpen = !!on;
    if(!quizBox) return;
    quizBox.style.display = on ? 'block' : 'none';
  }

  function pickQuiz(){
    const bank = WIN.HHA_HYGIENE_QUIZ_BANK;
    if(!Array.isArray(bank) || !bank.length) return null;
    const q = bank[Math.floor(rng()*bank.length)];
    return q || null;
  }

  function openRandomQuiz(){
    const q = pickQuiz();
    if(!q || !quizQ || !quizSub) return;

    setQuizVisible(true);
    quizQ.textContent = `🧠 Quiz: ${q.q}`;

    const options = [q.a].concat((q.wrong||[]).slice(0,3));
    for(let i=options.length-1;i>0;i--){
      const j = Math.floor(rng()*(i+1));
      [options[i],options[j]] = [options[j],options[i]];
    }

    quizSub.textContent = 'ตัวเลือก: ' + options.map((x,i)=>`${i+1}) ${x}`).join('  •  ')
      + '  (ตอบโดย “ถูกต่อเนื่อง 2 ครั้ง” เพื่อยืนยัน)';

    quizOpen._armed = true;
    quizOpen._t0 = nowMs();
    quizOpen._needStreak = 2;
    quizOpen._streak = 0;
  }

  function closeQuiz(msg){
    if(quizOpen){
      setQuizVisible(false);
      quizOpen = false;
      quizOpen._armed = false;
      if(msg) showBanner(msg);
    }
  }

  function getMissCount(){ return (wrongStepHits + hazHits); }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 160;
    const bottomSafeVar = Number(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 160;

    const hudTop = rectOf('hudTop');
    const bannerR = rectOf('banner');
    const quizR = rectOf('quizBox');

    let topSafe = topSafeVar;
    if(hudTop) topSafe = Math.max(topSafe, hudTop.y + hudTop.h + 12);
    if(bannerR) topSafe = Math.max(topSafe, bannerR.y + bannerR.h + 8);
    if(quizR && quizR.w>10 && quizR.h>10) topSafe = Math.max(topSafe, quizR.y + quizR.h + 10);

    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = (topSafe + pad);
    const y1 = h - bottomSafeVar - pad;

    return { x0, x1, y0, y1, w, h };
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
        const dx = ot.x - x, dy = ot.y - y;
        const rr = (ot.radius||radius) + radius + 8;
        if((dx*dx + dy*dy) < rr*rr){ ok=false; break; }
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

    const mtxt = mission.text || questText;
    pillQuest && (pillQuest.textContent = `MISSION ${mtxt}`);
    pillPower && (pillPower.textContent = `POWER 🛡️${power.shield} • 🎯${(power.focusUntil>nowMs())?'ON':'OFF'} • ❄️${(power.freezeUntil>nowMs())?'ON':'OFF'}`);

    // ✅ AI prediction pill refresh (lightweight)
    setAIPill(predictNextRisk());

    hudSub && (hudSub.textContent =
      `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • tgt=${targets.length}` +
      (practice.on ? ` • PRACTICE:${STEPS[practice.focusStepIdx||0]?.key||''}` : '')
    );

    if(barStep){
      const pct = clamp(hitsInStep / Math.max(1, s.hitsNeed), 0, 1);
      barStep.style.width = (pct*100).toFixed(1) + '%';
    }
    if(barLoop){
      const stepAcross = (stepIdx + (hitsInStep / Math.max(1, s.hitsNeed))) / 7;
      let m = 0;
      if(mission && mission.meta && mission.meta.pct != null) m = clamp(mission.meta.pct, 0, 1);
      const pct = clamp(Math.max(stepAcross, m), 0, 1);
      barLoop.style.width = (pct*100).toFixed(1) + '%';
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
    const radius = Math.max(26, (tgtSize*0.5));
    const {x,y,rect} = pickSpawnXY(radius);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const P = dd ? dd.getParams() : base;
    const lifeMin = (P.lifeMs && P.lifeMs[0]) ? Number(P.lifeMs[0]) : 1300;
    const lifeMax = (P.lifeMs && P.lifeMs[1]) ? Number(P.lifeMs[1]) : 2100;
    const lifeMs = clamp(lifeMin + rng()*(lifeMax-lifeMin), 900, 4000);

    const born = nowMs();
    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: born, dieAtMs: born + lifeMs, x, y, radius };
    targets.push(obj);

    if(kind==='good' && power.focusUntil > nowMs()) el.classList.add('is-focus');

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function spawnOne(){
    if(practice.on && Number.isFinite(practice.focusStepIdx)){
      const s = STEPS[practice.focusStepIdx];
      const r = rng();
      if(r < 0.06) return createTarget('haz', ICON_HAZ, -1);
      if(r < 0.14) return createTarget('wrong', STEPS[(practice.focusStepIdx+2)%7].icon, (practice.focusStepIdx+2)%7);
      return createTarget('good', s.icon, practice.focusStepIdx);
    }

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

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||30);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      const dx = (t.x - cx), dy = (t.y - cy);
      const dist = Math.hypot(dx, dy);
      if(dist < lockPx && dist < bestDist){ best = t; bestDist = dist; }
    }
    if(best) judgeHit(best, 'shoot', { lockPx, dist: bestDist });
  }

  function onHazHit(){
    if(power.shield > 0){
      power.shield--;
      AI_COACH.say('shield', 'โล่สบู่ช่วยกันเชื้อได้ 1 ครั้ง (ดีมาก!)');
      return true;
    }
    return false;
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    if(obj.kind === 'good'){
      correctHits++; totalStepHits++; hitsInStep++;
      combo++; comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      const idx = practice.on && Number.isFinite(practice.focusStepIdx) ? practice.focusStepIdx : stepIdx;
      stepStats[idx].ok++; stepStats[idx].rt.push(rt);
      pushRecent({ kind:'good', stepKey: STEPS[idx].key, rt, ts: nowMs() });

      if(quizOpen && quizOpen._armed){
        const within = (nowMs() - quizOpen._t0) <= 4000;
        if(within){
          quizOpen._streak++;
          if(quizOpen._streak >= (quizOpen._needStreak||2)){
            quizRight++; closeQuiz('✅ Quiz ผ่าน!');
          }
        }else closeQuiz(null);
      }

      coachExt?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo, practice:practice.on });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec(), practice:practice.on });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra, practice:practice.on });

      // AI coach moment: combo milestone / slow
      if(!practice.on && combo===6) AI_COACH.say('combo', 'คอมโบดีมาก! รักษาความนิ่งไว้ จะได้พลังช่วยง่ายขึ้น');
      if(rt>1000 && !practice.on) AI_COACH.say('slow', 'ถ้ารู้สึกช้า ลองแตะเป้าที่ใกล้มือ/กลางจอ จะไวขึ้น');

      fxHit('good', obj);
      removeTarget(obj);

      if(practice.on){
        if(hitsInStep >= STEPS[idx].hitsNeed) showBanner(`✅ ซ้อม ${STEPS[idx].label} สำเร็จ!`);
        setHud();
        return;
      }

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++; hitsInStep=0;
        if(stepIdx >= STEPS.length){
          stepIdx=0; loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);
          if(!quizOpen) openRandomQuiz();
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          if(!quizOpen && rng() < 0.22) openRandomQuiz();
        }
      }

      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++; totalStepHits++; combo=0;

      const idx = practice.on && Number.isFinite(practice.focusStepIdx) ? practice.focusStepIdx : stepIdx;
      stepStats[idx].wrong++;
      pushRecent({ kind:'wrong', stepKey: STEPS[idx].key, rt, ts: nowMs() });

      if(quizOpen && quizOpen._armed){ quizWrong++; closeQuiz('❌ Quiz พลาด!'); }

      // AI coach explain
      if(!practice.on){
        const s = STEPS[stepIdx];
        AI_COACH.say('wrong', `ผิดขั้นตอน—ตอนนี้คือ ${s.label} ให้แตะ ${s.icon} เท่านั้น`);
      }

      fxHit('wrong', obj);
      removeTarget(obj);

      if(getMissCount() >= missLimit && !practice.on) endGame('fail');
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      const blocked = onHazHit();
      if(!blocked){ hazHits++; combo=0; }

      const idx = practice.on && Number.isFinite(practice.focusStepIdx) ? practice.focusStepIdx : stepIdx;
      if(!blocked) stepStats[idx].haz++;
      pushRecent({ kind:'haz', stepKey: STEPS[idx].key, rt, ts: nowMs() });

      if(quizOpen && quizOpen._armed){ quizWrong++; closeQuiz('❌ Quiz พลาด!'); }

      if(!blocked && !practice.on){
        AI_COACH.say('haz', 'โดนเชื้อแล้ว! แนะนำ: โฟกัส “เป้าถูก” ก่อน ลดจอแน่น จะปลอดภัยขึ้น');
      }

      fxHit('haz', obj);
      removeTarget(obj);

      if(!blocked){
        if(getMissCount() >= missLimit && !practice.on) endGame('fail');
      }
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
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec(), practice:practice.on });

    if(timeLeft <= 0){ endGame(practice.on ? 'practice_time' : 'time'); return; }

    cleanupExpiredTargets();

    const P = dd ? dd.getParams() : base;
    const frozen = power.freezeUntil > t;
    const freezeMul = frozen ? 0.45 : 1.0;
    const miss = getMissCount();
    const fairnessMul = (miss>=2 && !practice.on) ? 0.78 : 1.0;
    const practiceMul = practice.on ? 0.85 : 1.0;

    const mul = mobileThrottleFactor() * freezeMul * fairnessMul * practiceMul;
    spawnAcc += (P.spawnPerSec * mul * dt);

    const cap = (view==='cvr') ? 16 : (practice.on ? 14 : 18);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      if(targets.length >= cap) break;
      spawnOne();
    }

    // ✅ AI Coach tick occasionally (not every frame)
    if(!tick._aiNextAt) tick._aiNextAt = t + 800;
    if(t >= tick._aiNextAt){
      tick._aiNextAt = t + 900;
      explainableCoachTick();
    }

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

  function kidBadgeFrom(grade, stepAcc, miss, haz){
    if(grade==='SSS') return '🏆';
    if(grade==='SS')  return '🥇';
    if(grade==='S')   return '🥈';
    if(grade==='A')   return '🥉';
    if(stepAcc>=0.55 && miss<=2) return '✨';
    if(haz>=3 || miss>=3) return '💪';
    return '🌱';
  }
  function kidLineFrom(grade){
    if(grade==='SSS') return 'สุดยอดมาก!';
    if(grade==='SS')  return 'เก่งมาก!';
    if(grade==='S')   return 'ดีมาก!';
    if(grade==='A')   return 'เยี่ยม!';
    if(grade==='B')   return 'พอใช้ กำลังดี';
    return 'เริ่มดีแล้ว ซ้อมอีกนิด!';
  }
  function setKidSummaryUI(summary){
    if(!summary) return;
    const grade = summary.grade || 'C';
    if(kidBadge) kidBadge.textContent = kidBadgeFrom(grade, summary.stepAcc||0, summary.misses||0, summary.hazHits||0);
    if(kidLine1) kidLine1.textContent = kidLineFrom(grade);

    const ok = summary.hitsCorrect ?? 0;
    const miss = summary.misses ?? 0;
    const haz = summary.hazHits ?? 0;
    if(kidLine2) kidLine2.textContent = `✅ ถูก ${ok} • ⚠️ พลาด ${miss} • 🦠 โดนเชื้อ ${haz}`;

    const ai = summary?.ai?.prediction || null;
    const top = (ai && ai.zoneId) ? ai.zoneId : (summary?.analyze?.topRiskZone || null);
    const name = top ? (ZONES.find(z=>z.id===top)?.name || top) : '—';

    if(kidTopRisk){
      kidTopRisk.textContent = top ? `${name} (AI บอกว่าเสี่ยงสุด/เสี่ยงถัดไป)` : 'วันนี้ทำได้ดีทุกจุด!';
    }
    if(btnPracticeRisk){
      btnPracticeRisk.disabled = !top;
      btnPracticeRisk.dataset.focus = top || '';
    }
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0; spawnAcc=0;

    for(let i=0;i<stepStats.length;i++){
      stepStats[i].ok=0; stepStats[i].wrong=0; stepStats[i].haz=0;
      stepStats[i].rt.length=0;
    }

    mission = { id:'', text:'', done:0, t0:0, meta:{} };
    power.shield=0; power.focusUntil=0; power.freezeUntil=0;

    quizRight=0; quizWrong=0;
    setQuizVisible(false);

    practice.on=false; practice.focusStepIdx=null;

    recent.length = 0;
    AI_COACH.shown.length = 0;

    teacherInitDone=false;
    if(createBox) createBox.style.display='none';

    setHud();
  }

  function startGame(playSeconds, opt){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    if(Number.isFinite(playSeconds) && playSeconds>0){
      timeLeft = clamp(playSeconds, 5, timePlannedSec);
    }

    if(opt && opt.practiceFocus === true && Number.isFinite(opt.focusStepIdx)){
      practice.on = true;
      practice.focusStepIdx = clamp(opt.focusStepIdx, 0, STEPS.length-1);
      stepIdx = practice.focusStepIdx;
      hitsInStep = 0;
    }

    if(startOverlay) startOverlay.style.display='none';
    if(endOverlay) endOverlay.style.display='none';
    if(detailsBody) detailsBody.style.display='none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, practice:practice.on, focusStepIdx:practice.focusStepIdx });

    showBanner(practice.on
      ? `🧪 ซ้อมจุด: ${STEPS[practice.focusStepIdx].icon} ${STEPS[practice.focusStepIdx].label} (15 วิ)`
      : `เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`
    );

    startWatchdog();
    setHud();
    requestAnimationFrame(tick);
  }

  // --- Teacher mode (Evaluate/Create) ---
  function initTeacherModeOnce(){
    if(teacherInitDone) return;
    teacherInitDone = true;

    evalState.active = true;
    evalState.confirmed = false;
    evalState.pickedZone = null;
    evalState.pickedReason = null;

    const hm2 = calcHeatmap2D();
    evalState.topRiskZone = hm2.topRisk;

    if(evalHint){
      evalHint.textContent = (view==='cvr')
        ? 'แนะนำ: หน้า Evaluate ใช้ “แตะ” จะง่ายสุด'
        : 'แตะวงกลมเพื่อเลือก';
    }

    if(handMap){
      handMap.innerHTML = '';
      const byId = new Map(hm2.heatmap.map(z=>[z.zoneId, z]));
      for(const z of ZONES){
        const hz = byId.get(z.id) || { heat:0, risk:0 };
        const btn = DOC.createElement('button');
        btn.type='button';
        btn.className = `hw-zone heat-${hz.heat||0}`;
        btn.dataset.zone = z.id;
        btn.style.setProperty('--zx', ({palm:32,back:68,gaps:35,knuck:50,thumb:22,nails:66,wrist:50}[z.id]||50));
        btn.style.setProperty('--zy', ({palm:62,back:62,gaps:34,knuck:40,thumb:44,nails:30,wrist:82}[z.id]||50));

        const riskPct = Math.round((hz.risk||0)*100);
        btn.innerHTML = `<div class="zlab">${z.name}<span class="zmini">${riskPct}%</span></div>`;
        btn.addEventListener('click', ()=>{
          evalState.pickedZone = z.id;
          if(evalPicked) evalPicked.textContent = `เลือก: ${z.name}`;
          [...handMap.querySelectorAll('.hw-zone')].forEach(x=>x.classList.toggle('is-picked', x.dataset.zone===z.id));
          if(btnEvalConfirm) btnEvalConfirm.disabled = !(evalState.pickedZone && evalState.pickedReason);
        }, { passive:true });

        if(z.id===evalState.topRiskZone) btn.classList.add('is-risk');
        handMap.appendChild(btn);
      }
    }

    if(evalPicked) evalPicked.textContent = 'เลือก: —';
    if(evalScore) evalScore.textContent = 'ผลประเมิน: —';
    if(btnEvalConfirm) btnEvalConfirm.disabled = true;
    if(createBox) createBox.style.display='none';
  }

  // --- Create routine scoring ---
  function scoreRoutine(picked){
    const core = [
      'ก่อนกินอาหาร/ขนม',
      'หลังเข้าห้องน้ำ',
      'หลังจับของสาธารณะ/ลูกบิด/มือถือ'
    ];
    let coreHit = 0;
    for(const c of core) if(picked.includes(c)) coreHit++;

    const score = coreHit===3 ? 95 : (coreHit===2 ? 78 : (coreHit===1 ? 60 : 45));
    const label = coreHit===3 ? 'ยอดเยี่ยม' : (coreHit===2 ? 'ดี' : (coreHit===1 ? 'พอใช้' : 'ควรปรับ'));
    const tip = coreHit===3 ? 'ครบ 3 ช่วงสำคัญ! โอกาสป่วยลดลงชัด' :
                coreHit===2 ? 'เกือบครบ—เพิ่ม “อีก 1 ช่วงหลัก” จะดีมาก' :
                coreHit===1 ? 'ยังขาดช่วงหลักหลายข้อ ลองเลือกช่วงที่เจอบ่อย' :
                'ลองเริ่มจาก 3 ช่วงหลักก่อนนะ';
    return { score, label, coreHit, tip };
  }

  function openCreate30s(){
    if(!createBox) return;
    createBox.style.display='block';
    createState.active=true;
    createState.picked=[];
    createState.score=null;
    createState.left=30;

    if(routineOpts){
      [...routineOpts.querySelectorAll('.hw-rt')].forEach(b=>b.classList.remove('is-picked'));
    }
    if(createPicked) createPicked.textContent='เลือกแล้ว: 0/3';
    if(createScore) createScore.textContent='คะแนน: —';
    if(btnCreateConfirm) btnCreateConfirm.disabled=true;

    clearInterval(createState.t);
    if(createTimerEl) createTimerEl.textContent=String(createState.left);

    createState.t = setInterval(()=>{
      if(!createState.active) return;
      createState.left = Math.max(0, (createState.left|0)-1);
      if(createTimerEl) createTimerEl.textContent=String(createState.left);
      if(createState.left<=0){
        clearInterval(createState.t);
        if(!createState.score) finalizeCreate(true);
      }
    }, 1000);
  }

  function finalizeCreate(auto){
    if(createState.score) return;
    createState.active=false;
    clearInterval(createState.t);

    const picked = createState.picked.slice(0,3);
    if(picked.length<3){
      const fill = ['ก่อนกินอาหาร/ขนม','หลังเข้าห้องน้ำ','หลังจับของสาธารณะ/ลูกบิด/มือถือ','กลับถึงบ้านจากข้างนอก','หลังไอ/จาม/สั่งน้ำมูก'];
      for(const f of fill){
        if(picked.length>=3) break;
        if(!picked.includes(f)) picked.push(f);
      }
      createState.picked = picked;
    }

    const sc = scoreRoutine(picked);
    createState.score = sc;

    if(createScore) createScore.textContent = `คะแนน: ${sc.score}/100 (${sc.label})`;
    showBanner(auto ? '⏱️ หมดเวลา! ระบบช่วยสรุปให้' : '✅ บันทึก routine แล้ว');

    if(endSummary){
      endSummary.create = {
        routine: picked,
        score: sc.score,
        label: sc.label,
        coreHit: sc.coreHit,
        tip: sc.tip,
        auto: !!auto,
        secondsLeft: createState.left|0
      };
      if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
      saveJson(LS_LAST, endSummary);
    }
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

    const hm2 = calcHeatmap2D();
    const pred = predictNextRisk();

    const summary = {
      version:'20260222a',
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
      missionLast: mission.text || '',
      powerEnd: { ...power },

      medianStepMs: rtMed,

      analyze: { heatmap2d: hm2.heatmap, topRiskZone: hm2.topRisk },
      evaluate: null,
      create: null,

      // ✅ AI result (what + why)
      ai: {
        prediction: pred,
        coachOn: true,
        coachTipCount: AI_COACH.shown.length,
        coachTipsShown: AI_COACH.shown.slice()
      },

      practice: { on: practice.on, focusStepIdx: practice.focusStepIdx }
    };

    // external coach extras (optional)
    if(coachExt) Object.assign(summary, coachExt.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endSummary = JSON.parse(JSON.stringify(Object.assign({grade}, summary)));

    if(endTitle){
      endTitle.textContent = practice.on ? 'จบการซ้อม 🧪' : ((reason==='fail') ? 'จบเกม ❌' : 'จบเกม ✅');
    }
    if(endSub){
      endSub.textContent = practice.on
        ? `ซ้อมจุด: ${STEPS[practice.focusStepIdx||0]?.label||''} • ถูก ${summary.hitsCorrect} • พลาด ${summary.misses}`
        : `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(0)}% • loops ${loopsDone}`;
    }
    if(detailsBody) detailsBody.style.display='none';
    if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);

    if(endOverlay) endOverlay.style.display='grid';

    setKidSummaryUI(endSummary);
    setAIPill(pred);

    showBanner('✅ AI สรุปให้แล้ว (เด็กอ่านง่าย)');

    setHud();
  }

  function goHub(){
    try{ location.href = hub ? hub : '../hub.html'; }catch{}
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

  btnPracticeRisk?.addEventListener('click', ()=>{
    const top = btnPracticeRisk?.dataset?.focus || '';
    if(!top) return;
    const idx = STEPS.findIndex(s=>s.key===top);
    if(idx<0) return;
    startGame(15, { practiceFocus:true, focusStepIdx: idx });
  }, { passive:true });

  // Teacher toggle
  if(btnToggleDetails && detailsBody){
    btnToggleDetails.addEventListener('click', ()=>{
      const on = detailsBody.style.display !== 'none';
      detailsBody.style.display = on ? 'none' : 'block';
      btnToggleDetails.textContent = on
        ? '🔍 ดูโหมดครู/วิจัย (Evaluate + Routine + Summary)'
        : '🙈 ซ่อนโหมดครู/วิจัย';
      if(!on) initTeacherModeOnce();
    }, { passive:true });
  }

  // Evaluate binds (reason pick)
  evalReasons?.addEventListener('click', (e)=>{
    const t = e.target;
    if(!t || !t.classList.contains('hw-reason')) return;
    evalState.pickedReason = t.getAttribute('data-reason') || '';
    [...evalReasons.querySelectorAll('.hw-reason')].forEach(b=>b.classList.toggle('is-picked', b===t));
    if(btnEvalConfirm) btnEvalConfirm.disabled = !(evalState.pickedZone && evalState.pickedReason);
  });

  btnEvalConfirm?.addEventListener('click', ()=>{
    if(btnEvalConfirm.disabled) return;
    const picked = evalState.pickedZone;
    const reason = evalState.pickedReason;
    const top = evalState.topRiskZone;
    const match = (picked && top && picked===top);
    const pickedName = (ZONES.find(z=>z.id===picked)?.name) || picked || '';

    endSummary.evaluate = { pickedZone:picked, pickedName, pickedReason:reason, topRiskZone:top, matchTopRisk:!!match, view, seed };
    if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    saveJson(LS_LAST, endSummary);

    if(evalScore) evalScore.textContent = match ? `✅ ถูก! จุดเสี่ยงสุดคือ ${pickedName}` : `⚠️ จุดเสี่ยงสุดอาจเป็นอีกจุด (ดูวงกระพริบ)`;
    openCreate30s();
  }, { passive:true });

  btnEvalSkip?.addEventListener('click', ()=>{
    endSummary.evaluate = { skipped:true, view, seed };
    if(endJson) endJson.textContent = JSON.stringify(endSummary, null, 2);
    saveJson(LS_LAST, endSummary);
    openCreate30s();
  }, { passive:true });

  routineOpts?.addEventListener('click', (e)=>{
    const t = e.target;
    if(!t || !t.classList.contains('hw-rt')) return;
    const text = t.getAttribute('data-rt') || '';
    if(!text) return;

    const idx = createState.picked.indexOf(text);
    if(idx>=0) createState.picked.splice(idx,1);
    else{
      if(createState.picked.length>=3){ showBanner('เลือกได้สูงสุด 3 ข้อ'); return; }
      createState.picked.push(text);
    }

    [...routineOpts.querySelectorAll('.hw-rt')].forEach(b=>{
      const v = b.getAttribute('data-rt') || '';
      b.classList.toggle('is-picked', createState.picked.includes(v));
    });

    if(createPicked) createPicked.textContent = `เลือกแล้ว: ${createState.picked.length}/3`;
    if(btnCreateConfirm) btnCreateConfirm.disabled = (createState.picked.length !== 3);
  });

  btnCreateConfirm?.addEventListener('click', ()=>{
    if(btnCreateConfirm.disabled) return;
    finalizeCreate(false);
  }, { passive:true });

  // cVR shoot gameplay
  WIN.addEventListener('hha:shoot', onShoot);

  // initial
  setHud();
}