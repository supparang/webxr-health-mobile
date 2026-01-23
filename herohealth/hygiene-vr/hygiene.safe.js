// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard) PACK I
// NEW: Boss Weakness by STEP + Combo Rescue Heart + Kid-friendly End Tips
// Emits: hha:start, hha:time, hha:judge, hha:end, hha:boss_enter, hha:boss_clear, hha:soap_pick
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
function nowMs(){ return performance.now ? performance.now() : Date.now(); }
function copyText(text){
  return navigator.clipboard?.writeText(String(text)).catch(()=>{});
}

// ------------------ Steps ------------------
const STEPS = [
  { key:'palm',  icon:'🫧', label:'ฝ่ามือ', hitsNeed:6 },
  { key:'back',  icon:'🤚', label:'หลังมือ', hitsNeed:6 },
  { key:'gaps',  icon:'🧩', label:'ซอกนิ้ว', hitsNeed:6 },
  { key:'knuck', icon:'👊', label:'ข้อนิ้ว', hitsNeed:6 },
  { key:'thumb', icon:'👍', label:'หัวแม่มือ', hitsNeed:6 },
  { key:'nails', icon:'💅', label:'ปลายนิ้ว/เล็บ', hitsNeed:6 },
  { key:'wrist', icon:'⌚', label:'ข้อมือ', hitsNeed:6 },
];

const ICON_HAZ  = '🦠';
const ICON_SOAP = '🧼';
const ICON_BOSS = '👑🦠';

export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep = DOC.getElementById('pillStep');
  const pillHits = DOC.getElementById('pillHits');
  const pillCombo= DOC.getElementById('pillCombo');
  const pillMiss = DOC.getElementById('pillMiss');
  const pillRisk = DOC.getElementById('pillRisk');
  const pillTime = DOC.getElementById('pillTime');
  const pillPerfect = DOC.getElementById('pillPerfect');
  const pillShield  = DOC.getElementById('pillShield');
  const pillHeart   = DOC.getElementById('pillHeart');
  const pillMission = DOC.getElementById('pillMission');
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const missionBar = DOC.getElementById('missionBar');
  const missionText= DOC.getElementById('missionText');
  const missionFill= DOC.getElementById('missionFill');

  const wheelRow = DOC.getElementById('wheelRow');
  const wheelSub = DOC.getElementById('wheelSub');

  const miniBoss = DOC.getElementById('miniBoss');
  const miniSoap = DOC.getElementById('miniSoap');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endTips      = DOC.getElementById('endTips');
  const endJson      = DOC.getElementById('endJson');

  const btnStart   = DOC.getElementById('btnStart');
  const btnRestart = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase(); // play | study
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  const rhythmOn = (qs('rhythm','1') !== '0');
  const ghostOn  = (qs('ghost','1') !== '0');
  const explainOn= (qs('explain','1') !== '0');

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // base difficulty
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, bpm:96 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26, bpm:116 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, bpm:106 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    bpm:[84, 132]
  };

  // optional AI
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

  // mission
  let mission = null;
  async function loadMission(){
    try{
      const mod = await import('./hygiene.missions.js');
      if(typeof mod?.pickMission === 'function'){
        mission = mod.pickMission({ seed, runMode, diff });
      }
    }catch{}
    if(missionBar){
      missionBar.style.display = mission ? 'block' : 'none';
      if(mission && pillMission) pillMission.textContent = `🎯 ${mission.name}`;
      if(mission && missionText) missionText.textContent = `${mission.name} • ${mission.story}`;
    }
  }

  // ------------------ State ------------------
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

  // PACK I: Combo Rescue heart (1 per loop)
  let heart = 1;          // current charge
  let heartMax = 1;       // max per loop
  let rescuedCount = 0;

  let perfect = 0;
  let shield = 0;

  // Soap meter 0..100
  let soap = 0;
  let soapBoostUntilMs = 0;

  // Boss
  let bossActive = false;
  let bossHP = 0;
  let bossClears = 0;
  let bossNextAtMs = 0;
  let bossEndsAtMs = 0;
  let bossObj = null;

  // PACK I: Boss weakness by STEP
  let bossWeakIdx = 0;          // which step damages boss
  let bossWeakUntilMs = 0;      // when to rotate weakness

  // Mist
  let mistUntilMs = 0;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];

  // mistakes per step (for kid summary)
  const wrongByStep = new Array(STEPS.length).fill(0);

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  // ghost (last 10s)
  const ghostBuf = [];
  let ghostLayer = null;

  // rhythm
  let beatMs = 0;
  let nextBeatAt = 0;
  let beatCount = 0;

  // ------------------ Helpers ------------------
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  function explain(kind, obj){
    if(!explainOn) return '';
    const cur = STEPS[stepIdx];
    if(kind==='wrong'){
      const wrong = (obj && obj.stepIdx>=0) ? STEPS[obj.stepIdx] : null;
      return `ผิดขั้นตอน → ตอนนี้ต้อง ${cur.icon} ${cur.label}${wrong?` (ที่กดคือ ${wrong.icon})`:''}`;
    }
    if(kind==='haz'){
      return shield>0 ? `🛡 กันเชื้อไว้ 1 ครั้ง!` : `โดนเชื้อ 🦠 → หลบก่อนยิง`;
    }
    if(kind==='boss_hint'){
      const w = STEPS[bossWeakIdx];
      return `บอสแพ้: ${w.icon} ${w.label} (ยิงเป้านั้นเพื่อทำดาเมจ)`;
    }
    return '';
  }

  function setMist(on){
    DOC.body.classList.toggle('is-mist', !!on);
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 130;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 120;
    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;
    return { x0, x1, y0, y1, w, h };
  }

  function elapsedSec(){ return running ? ((nowMs() - tStartMs)/1000) : 0; }
  function getStepAcc(){ return totalStepHits ? (correctHits / totalStepHits) : 0; }
  function getMissCount(){ return (wrongStepHits + hazHits); }

  function setWheel(){
    if(!wheelRow) return;
    wheelRow.innerHTML = '';
    STEPS.forEach((s,i)=>{
      const d = DOC.createElement('div');
      d.className = 'hw-chip' + (i===stepIdx?' is-now':'') + (i<stepIdx?' is-done':'');
      d.textContent = s.icon;
      wheelRow.appendChild(d);
    });
    if(wheelSub){
      wheelSub.textContent = `ตอนนี้: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label} • รอบที่ทำแล้ว: ${loopsDone}`;
    }
  }

  function missionProgress(){
    if(!mission || !mission.rules) return { pct:0, done:false, text:'—' };
    const r = mission.rules;

    const stepAcc = getStepAcc();

    if(r.minLoops != null){
      const pct = clamp(loopsDone / Math.max(1, r.minLoops), 0, 1);
      const done = loopsDone >= r.minLoops;
      return { pct, done, text:`loops ${loopsDone}/${r.minLoops}` };
    }
    if(r.minComboMax != null){
      const pct = clamp(comboMax / Math.max(1, r.minComboMax), 0, 1);
      const done = comboMax >= r.minComboMax;
      return { pct, done, text:`comboMax ${comboMax}/${r.minComboMax}` };
    }
    if(r.maxHazHits != null){
      const pct = clamp((r.maxHazHits - hazHits) / Math.max(1, r.maxHazHits), 0, 1);
      const done = (hazHits <= r.maxHazHits) && (timeLeft <= 0);
      return { pct, done, text:`haz ${hazHits}/${r.maxHazHits}` };
    }
    if(r.minStepAcc != null){
      const pct = clamp(stepAcc / Math.max(0.01, r.minStepAcc), 0, 1);
      const done = stepAcc >= r.minStepAcc;
      return { pct, done, text:`acc ${(stepAcc*100).toFixed(0)}%/${Math.round(r.minStepAcc*100)}%` };
    }
    if(r.minBossClears != null){
      const pct = clamp(bossClears / Math.max(1, r.minBossClears), 0, 1);
      const done = bossClears >= r.minBossClears;
      return { pct, done, text:`boss ${bossClears}/${r.minBossClears}` };
    }

    return { pct:0, done:false, text:'—' };
  }

  let missionDoneFired = false;
  function updateMissionUI(){
    if(!missionBar || !missionFill || !missionText) return;
    if(!mission){ missionBar.style.display='none'; return; }

    const p = missionProgress();
    missionFill.style.width = (p.pct*100).toFixed(1) + '%';
    missionText.textContent = `${mission.name} • ${p.text}`;

    if(p.done && !missionDoneFired){
      missionDoneFired = true;
      showBanner(`🎯 Mission สำเร็จ! ${mission.name}`);
      emit('hha:mission', { id: mission.id, name: mission.name, done:true });
      WIN.dispatchEvent(new CustomEvent('hha:badge',{detail:{icon:'🎯',title:'Mission Clear',id:'hw_mission'}}));
    }
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);
    pillPerfect && (pillPerfect.textContent = `PERFECT ${perfect}`);
    pillShield && (pillShield.textContent = `🛡 ${shield}`);
    pillHeart && (pillHeart.textContent = `💖 ${heart}`);

    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);

    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);

    const P = dd ? dd.getParams() : base;
    const bpm = clamp(P.bpm ?? base.bpm, bounds.bpm[0], bounds.bpm[1]);
    hudSub && (hudSub.textContent =
      `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • ${rhythmOn?'rhythm':'flow'} bpm=${Math.round(bpm)}`
    );

    miniSoap && (miniSoap.textContent = `🧼 Soap: ${Math.round(soap)}%`);
    if(bossActive){
      const w = STEPS[bossWeakIdx];
      miniBoss && (miniBoss.textContent = `👑 Boss HP ${bossHP} • แพ้: ${w.icon} ${w.label}`);
    }else{
      miniBoss && (miniBoss.textContent =
        `👑 Boss: จะมาอีกใน ${Math.max(0, Math.ceil((bossNextAtMs-nowMs())/1000))}s`
      );
    }

    setWheel();
    updateMissionUI();
  }

  // ---------- Targets ----------
  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
    bossObj = null;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
    if(bossObj && obj.id === bossObj.id) bossObj = null;
  }

  function createTarget(kind, emoji, stepRef, forcePos=null){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);
    stage.appendChild(el);

    const rect = getSpawnRect();
    let x, y;

    if(forcePos){
      x = forcePos.x; y = forcePos.y;
    }else{
      x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
      y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);
    }

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (kind==='boss' ? 1.15 : (0.90 + rng()*0.25)).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  // ---------- Ghost ----------
  function recordGhost({kind, ok, x, y, rtMs}){
    if(!ghostOn) return;
    const t = nowMs();
    ghostBuf.push({ t, kind, ok, x, y, rtMs });
    const cut = t - 10000;
    while(ghostBuf.length && ghostBuf[0].t < cut) ghostBuf.shift();
    renderGhost();
  }

  function ensureGhostLayer(){
    if(!ghostOn) return;
    if(ghostLayer && ghostLayer.isConnected) return;
    ghostLayer = DOC.createElement('div');
    ghostLayer.className = 'hw-ghost';
    ghostLayer.setAttribute('aria-hidden','true');
    stage.appendChild(ghostLayer);
  }

  function renderGhost(){
    if(!ghostOn) return;
    ensureGhostLayer();
    if(!ghostLayer) return;

    const rect = getSpawnRect();
    const t = nowMs();
    const frag = DOC.createDocumentFragment();
    ghostLayer.innerHTML = '';

    for(const g of ghostBuf){
      const age = (t - g.t);
      const a = clamp(1 - age/10000, 0, 1);
      const dot = DOC.createElement('div');
      dot.className = 'hw-dot' + (g.ok ? ' ok':' bad');
      dot.style.opacity = String(0.10 + a*0.55);
      dot.style.left = ((g.x/rect.w)*100).toFixed(3) + '%';
      dot.style.top  = ((g.y/rect.h)*100).toFixed(3) + '%';
      frag.appendChild(dot);
    }
    ghostLayer.appendChild(frag);
  }

  // ---------- Spawn ----------
  function setupRhythm(){
    const P = dd ? dd.getParams() : base;
    const bpm = clamp(P.bpm ?? base.bpm, bounds.bpm[0], bounds.bpm[1]);
    beatMs = 60000 / Math.max(40, bpm);
    nextBeatAt = nowMs() + beatMs;
    beatCount = 0;
  }

  function spawnOne(){
    const cur = STEPS[stepIdx];
    const P0 = dd ? dd.getParams() : base;

    const boost = nowMs() < soapBoostUntilMs;
    const P = {
      hazardRate: clamp(P0.hazardRate * (boost ? 0.55 : 1), 0.02, 0.40),
      decoyRate:  clamp(P0.decoyRate  * (boost ? 0.85 : 1), 0.05, 0.55),
    };

    // during boss: bias spawn towards weakness step to guide play
    if(bossActive && rng() < 0.55){
      const w = STEPS[bossWeakIdx];
      return createTarget('good', w.icon, bossWeakIdx);
    }

    // occasionally soap pickup (not too frequent)
    if(!bossActive && rng() < (boost ? 0.02 : 0.035)){
      return createTarget('soap', ICON_SOAP, -2);
    }

    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', cur.icon, stepIdx);
    }
  }

  function onBeat(){
    beatCount++;
    const b = (beatCount % 4) || 4;
    if(targets.length > 18) return;

    if(b === 1){ spawnOne(); return; }
    if(b === 2){
      if(rng() < 0.65) spawnOne();
      else spawnOne();
      return;
    }
    if(b === 3){ spawnOne(); return; }
    if(b === 4){
      spawnOne();
      if(diff==='hard' && rng() < 0.35) spawnOne();
      return;
    }
  }

  // ---------- Boss Logic (PACK I: weakness rotates) ----------
  function scheduleNextBoss(){
    const baseGap = (diff==='easy') ? 22 : (diff==='hard' ? 16 : 19);
    const jitter = (runMode==='study') ? 0 : Math.floor(rng()*4);
    bossNextAtMs = nowMs() + (baseGap + jitter)*1000;
  }

  function pickWeakIdx(){
    // deterministic-ish but fun: rotate
    bossWeakIdx = Math.floor(rng()*STEPS.length);
    bossWeakUntilMs = nowMs() + 2500; // rotate every 2.5s
  }

  function startBoss(){
    if(bossActive) return;
    bossActive = true;
    bossHP = (diff==='easy') ? 6 : (diff==='hard' ? 8 : 7);
    bossEndsAtMs = nowMs() + 11000;  // 11s window
    mistUntilMs = bossEndsAtMs;
    setMist(true);

    pickWeakIdx();

    // spawn boss center-ish
    const cx = WIN.innerWidth*0.5;
    const cy = WIN.innerHeight*0.44;
    bossObj = createTarget('boss', ICON_BOSS, -9, { x:cx, y:cy });

    emit('hha:boss_enter', { hp: bossHP, atSec: elapsedSec(), weakIdx: bossWeakIdx });
    showBanner(`👑 King Germ มาแล้ว! ${explain('boss_hint')}`);
  }

  function rotateWeaknessIfNeeded(){
    if(!bossActive) return;
    const t = nowMs();
    if(t >= bossWeakUntilMs){
      pickWeakIdx();
      showBanner(`👑 เปลี่ยนจุดอ่อน! ${explain('boss_hint')}`);
    }
  }

  function endBossTimeout(){
    if(!bossActive) return;
    bossActive = false;
    if(bossObj) removeTarget(bossObj);
    setMist(false);
    scheduleNextBoss();
    showBanner(`👑 บอสหนีไป! ลองใหม่รอบหน้า`);
  }

  function bossDamageByStepHit(hitStepIdx, source, extra){
    if(!bossActive) return false;
    if(hitStepIdx !== bossWeakIdx) return false;

    // require soap >= 12 to count as damage (soft gate)
    if(soap < 12){
      showBanner(`🧼 Soap น้อยไป! เก็บ/ยิงถูกเพิ่มก่อน`);
      emit('hha:judge', { kind:'boss_needsoap', stepIdx, source, extra, soap, weakIdx: bossWeakIdx });
      return false;
    }

    soap = clamp(soap - 12, 0, 100);
    bossHP -= 1;

    emit('hha:judge', { kind:'boss_dmg', stepIdx, source, extra, bossHP, soap, weakIdx: bossWeakIdx });
    showBanner(`👑 โดนบอส! (HP ${bossHP})`);

    if(bossHP <= 0){
      bossClears++;
      emit('hha:boss_clear', { clears: bossClears, atSec: elapsedSec() });

      // reward
      shield++;
      soapBoostUntilMs = nowMs() + 6500;
      timeLeft += 6;
      showBanner(`🏆 ชนะบอส! +🛡 +เวลา +Soap Boost`);

      if(bossObj) removeTarget(bossObj);
      bossActive = false;
      setMist(false);
      scheduleNextBoss();

      WIN.dispatchEvent(new CustomEvent('hha:badge',{detail:{icon:'👑',title:'Boss Clear',id:'hw_boss'}}));
    }
    return true;
  }

  // ---------- Input ----------
  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  function onShoot(e){
    if(!running || paused) return;
    if(view !== 'cvr') return;

    const d = (e && e.detail) || {};
    const lockPx = Number(d.lockPx||28);

    const cx = WIN.innerWidth/2;
    const cy = WIN.innerHeight/2;

    let best=null, bestDist=1e9;
    for(const t of targets){
      const dx = (t.x - cx), dy = (t.y - cy);
      const dist = Math.hypot(dx, dy);
      if(dist < lockPx && dist < bestDist){
        best = t; bestDist = dist;
      }
    }
    if(best){
      judgeHit(best, 'shoot', { lockPx, dist: bestDist });
    }else{
      recordGhost({ kind:'shot_miss', ok:false, x:cx, y:cy, rtMs:0 });
    }
  }

  // ---------- PACK I: Heart Rescue ----------
  function tryRescue(kind){
    // rescue prevents MISS increment once per loop
    if(heart <= 0) return false;
    heart--;
    rescuedCount++;
    showBanner(`💖 เซฟ! ยังไม่โดน MISS (${kind})`);
    emit('hha:judge', { kind:'rescue', cause: kind, atSec: elapsedSec(), heart });
    // still break combo (teach)
    combo = 0;
    perfect = 0;
    return true;
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // Boss click = hint only (visual)
    if(obj.kind === 'boss'){
      showBanner(explain('boss_hint') || 'ยิง STEP ที่บอสแพ้!');
      emit('hha:judge', { kind:'boss_click', stepIdx, source, extra, weakIdx: bossWeakIdx });
      setHud();
      return;
    }

    // SOAP
    if(obj.kind === 'soap'){
      soap = clamp(soap + 35, 0, 100);
      soapBoostUntilMs = nowMs() + 6500;
      shield++;
      emit('hha:soap_pick', { soap, shield, atSec: elapsedSec() });
      showBanner(`🧼 เก็บสบู่! Soap Boost +🛡`);
      recordGhost({ kind:'soap', ok:true, x:obj.x, y:obj.y, rtMs:rt });
      removeTarget(obj);
      setHud();
      return;
    }

    // GOOD (step targets)
    if(obj.kind === 'good'){
      // if boss active, good-hit on weakness step damages boss
      if(bossActive){
        rotateWeaknessIfNeeded();
        const didBossDmg = bossDamageByStepHit(obj.stepIdx, source, extra);
        // still count as correct learning hit too (nice feeling)
        // (but don't auto-advance stepIdx during boss; keep learning stable)
        if(didBossDmg){
          recordGhost({ kind:'boss_dmg', ok:true, x:obj.x, y:obj.y, rtMs:rt });
        }
      }

      // learning progress (always)
      correctHits++;
      totalStepHits++;
      if(obj.stepIdx === stepIdx){
        hitsInStep++;
      }

      const isPerfect = rt <= 900;
      if(isPerfect){
        perfect++;
        if(perfect % 4 === 0){
          shield++;
          showBanner(`🛡 ได้โล่! (Perfect x${perfect})`);
        }
      }

      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      soap = clamp(soap + (isPerfect ? 12 : 8), 0, 100);

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo, perfect:isPerfect });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, hitStepIdx: obj.stepIdx, rtMs: rt, source, extra, perfect:isPerfect, soap });
      recordGhost({ kind:'good', ok:true, x:obj.x, y:obj.y, rtMs:rt });

      showBanner(isPerfect ? `✨ PERFECT! ${STEPS[obj.stepIdx].icon} +1` : `✅ ถูกต้อง! ${STEPS[obj.stepIdx].icon} +1`);

      // only advance real STEP when hit matches current step
      if(obj.stepIdx === stepIdx){
        if(hitsInStep >= STEPS[stepIdx].hitsNeed){
          stepIdx++;
          hitsInStep=0;

          if(stepIdx >= STEPS.length){
            stepIdx=0;
            loopsDone++;

            // PACK I: refresh heart each loop
            heart = heartMax;
            showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone}) +💖 รีชาร์จ`);
          }else{
            showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
          }
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    // WRONG
    if(obj.kind === 'wrong'){
      // rescue if available
      if(tryRescue('wrong')){
        totalStepHits++; // still affects accuracy a bit (teach)
        wrongByStep[stepIdx] = (wrongByStep[stepIdx]||0) + 1;
        removeTarget(obj);
        setHud();
        return;
      }

      wrongStepHits++;
      totalStepHits++;
      wrongByStep[stepIdx] = (wrongByStep[stepIdx]||0) + 1;

      combo = 0;
      perfect = 0;
      soap = clamp(soap - 10, 0, 100);

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra, soap });
      recordGhost({ kind:'wrong', ok:false, x:obj.x, y:obj.y, rtMs:rt });

      showBanner(`⚠️ ${explain('wrong', obj) || 'ผิดขั้นตอน!'}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    // HAZ
    if(obj.kind === 'haz'){
      combo = 0;
      perfect = 0;

      // shield blocks
      if(shield > 0){
        shield--;
        emit('hha:judge', { kind:'haz_block', stepIdx, rtMs: rt, source, extra, shield });
        recordGhost({ kind:'haz_block', ok:true, x:obj.x, y:obj.y, rtMs:rt });
        showBanner(`🛡 กันเชื้อไว้!`);
        removeTarget(obj);
        setHud();
        return;
      }

      // rescue if available
      if(tryRescue('haz')){
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      soap = clamp(soap - 16, 0, 100);

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra, soap });
      recordGhost({ kind:'haz', ok:false, x:obj.x, y:obj.y, rtMs:rt });

      showBanner(`🦠 ${explain('haz', obj) || 'โดนเชื้อ!'}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  // ---------- Main loop ----------
  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    // boss schedule
    if(!bossActive && t >= bossNextAtMs){
      startBoss();
    }
    if(bossActive){
      rotateWeaknessIfNeeded();
    }
    if(bossActive && t >= bossEndsAtMs){
      endBossTimeout();
    }

    // mist auto off
    if(t >= mistUntilMs && !bossActive){
      setMist(false);
    }

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });

    // spawn
    if(rhythmOn){
      while(t >= nextBeatAt){
        nextBeatAt += beatMs;
        onBeat();
        if(targets.length > 18){
          const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
          if(oldest) removeTarget(oldest);
        }
      }
    }else{
      const P = dd ? dd.getParams() : base;
      tick.spawnAcc = (tick.spawnAcc || 0) + (P.spawnPerSec * dt);
      while(tick.spawnAcc >= 1){
        tick.spawnAcc -= 1;
        spawnOne();
        if(targets.length > 18){
          const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
          if(oldest) removeTarget(oldest);
        }
      }
    }

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;

    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    wrongByStep.fill(0);

    perfect = 0;
    shield = 0;

    heartMax = 1;
    heart = heartMax;
    rescuedCount = 0;

    soap = 0;
    soapBoostUntilMs = 0;

    bossActive = false;
    bossHP = 0;
    bossClears = 0;
    bossEndsAtMs = 0;
    bossObj = null;
    bossWeakIdx = 0;
    bossWeakUntilMs = 0;

    mistUntilMs = 0;
    setMist(false);

    ghostBuf.length = 0;
    missionDoneFired = false;

    setupRhythm();
    scheduleNextBoss();
    setHud();
    renderGhost();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec, rhythmOn, ghostOn, explainOn });

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function buildKidTips({ stepAcc, topStepIdx, topCount }){
    const s = STEPS[topStepIdx];
    const accPct = Math.round(stepAcc*100);

    let tip = '';
    if(topCount <= 0){
      tip = `เก่งมาก! แทบไม่พลาดขั้นตอนเลย 👍`;
    }else{
      tip = `พลาดบ่อยสุด: ${s.icon} ${s.label} (ประมาณ ${topCount} ครั้ง)\n` +
            `ทิป: ช้าอีกนิดแล้ว “เล็งไอคอนขั้นตอน” ก่อนยิง ✨`;
    }

    const extra =
      `\n\n💡 จำง่าย 7 ขั้น: ` +
      `${STEPS.map(x=>x.icon).join(' → ')}` +
      `\n💖 Rescue ใช้ไป: ${rescuedCount} ครั้ง`;

    return `📌 คะแนนความแม่นยำ: ${accPct}%\n${tip}${extra}`;
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    setMist(false);

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const stepAcc = getStepAcc();
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    const rtMed = (()=> {
      const a = rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 0;
      const m = (a.length-1)/2;
      return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
    })();

    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;
    const mp = missionProgress();

    // find top mistake step
    let topStepIdx = 0, topCount = -1;
    for(let i=0;i<wrongByStep.length;i++){
      if(wrongByStep[i] > topCount){
        topCount = wrongByStep[i];
        topStepIdx = i;
      }
    }

    const summary = {
      version:'1.3.0-prod',
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
      perfectCount: perfect,
      shieldEnd: shield,
      soapEnd: soap,

      bossClears,
      heartUsed: rescuedCount,
      misses: getMissCount(),
      medianStepMs: rtMed,

      rhythmOn, ghostOn, explainOn,

      missionId: mission ? mission.id : null,
      missionName: mission ? mission.name : null,
      missionDone: !!mp.done,
      missionPct: mp.pct,

      wrongByStep
    };

    if(coach) Object.assign(summary, coach.getSummaryExtras());
    if(dd) Object.assign(summary, dd.getSummaryExtras());

    if(ghostOn){
      summary.ghost10s = ghostBuf.slice(-60);
    }

    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent =
      `Grade ${grade} • acc ${(stepAcc*100).toFixed(1)}% • boss ${bossClears} • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;

    if(endTips){
      endTips.textContent = buildKidTips({ stepAcc, topStepIdx, topCount });
    }

    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson.textContent||''), { passive:true });

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  // cVR shoot
  WIN.addEventListener('hha:shoot', onShoot);

  // particles pop (optional)
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
    }
  });

  // init
  loadMission().finally(()=>{ resetGame(); });
}