// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Story + Sequence Boss)
// v1.1.0-prod (PACK O)
// Emits: hha:start, hha:time, hha:judge, hha:end, hha:story, hha:boss
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY

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

// ------------------ Steps (emoji mapping) ------------------
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

// ------------------ Story Chapters ------------------
const CHAPTERS = [
  { id:'C0', title:'📖 ภารกิจเริ่มต้น', text:'โรงเรียนกำลังมีเชื้อ 🦠\nคุณคือ “ฮีโร่ล้างมือ” ต้องทำ 7 ขั้นตอนให้ถูก และหลบเชื้อให้ได้!' },
  { id:'C1', title:'📖 ด่าน 1: ช่วยเพื่อนในห้อง', text:'เพื่อนหลายคนยังสับสนเรื่อง “ซอกนิ้ว” และ “ข้อนิ้ว”!\nทำให้ถูกและต่อคอมโบให้ยาวที่สุด!' },
  { id:'C2', title:'📖 ด่าน 2: ทางเดินเชื้อโรค', text:'เชื้อเริ่มโผล่ถี่ขึ้น…\nอย่ากด/ยิงผิดขั้นตอน และอย่าโดน 🦠!' },
  { id:'C3', title:'📖 ด่าน 3: ห้องอาหาร', text:'ก่อนกินข้าว ต้องมือสะอาด!\nระวังเป้าหลอก (ขั้นอื่น) ที่จะทำให้คอมโบแตก!' },
  { id:'C4', title:'📖 ด่าน 4: บอสใหญ่!', text:'ถึงเวลาสู้กับ “Germ Boss” 👾\nบอสจะบังคับให้ทำตามลำดับ STEP 1→7 ถ้าพลาดจะโดนลงโทษ!' },
];

// ------------------ Engine ------------------
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
  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // Story overlay
  const storyOverlay = DOC.getElementById('storyOverlay');
  const storyTitle = DOC.getElementById('storyTitle');
  const storyText  = DOC.getElementById('storyText');
  const btnStoryOk = DOC.getElementById('btnStoryOk');
  const btnStorySkip = DOC.getElementById('btnStorySkip');

  // Boss bar
  const bossBar = DOC.getElementById('bossBar');
  const bossTitle = DOC.getElementById('bossTitle');
  const bossSub   = DOC.getElementById('bossSub');
  const bossFill  = DOC.getElementById('bossFill');

  // controls
  const btnStart   = DOC.getElementById('btnStart');
  const btnRestart = DOC.getElementById('btnRestart');
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

  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22 };
  })();
  const bounds = { spawnPerSec:[1.2, 4.2], hazardRate:[0.06, 0.26], decoyRate:[0.10, 0.40] };

  // AI instances (optional)
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

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
  const rtOk = []; // ms
  let spawnAcc=0;

  // Boss state
  let bossActive=false;
  let bossHP=0, bossHPMax=0;
  let bossSeqIdx=0;        // which step required next (0..6)
  let bossHitsNeed=0;      // required hits per step in boss
  let bossHitsDone=0;
  let nextBossAtSec=0;     // schedule
  let bossClears=0;
  let miniBossClears=0;

  // Story state
  let storyShownIdx=-1;
  let storyLock=false;
  const storyOn = (qs('story','1') !== '0');

  // active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  // ---------- helpers ----------
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function getMissCount(){
    // hygiene: miss = wrong step hits + hazard hits
    return (wrongStepHits + hazHits);
  }

  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
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

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function createTarget(kind, emoji, stepRef){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    const label = (kind==='good')
      ? (STEPS[stepIdx]?.label || '')
      : (kind==='wrong')
        ? 'ผิดขั้น'
        : (kind==='haz' ? 'เชื้อ' : '');

    // label helps on PC/Mobile; CSS hides in VR/cVR
    el.innerHTML = `<span class="emoji">${emoji}</span><div class="lab">${label}</div>`;
    el.dataset.id = String(nextId);

    stage.appendChild(el);

    const rect = getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

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

  // ---------- Story ----------
  function chapterIndexFromProgress(){
    // map progress to chapter index (simple + fun)
    if(loopsDone === 0) return 0;
    if(loopsDone === 1) return 1;
    if(loopsDone === 2) return 2;
    if(loopsDone === 3) return 3;
    return 4; // endgame/boss vibe
  }

  function openStoryIfNeeded(force=false){
    if(!storyOn) return;
    if(!storyOverlay || !storyTitle || !storyText) return;

    const idx = chapterIndexFromProgress();
    if(!force && idx <= storyShownIdx) return;

    const ch = CHAPTERS[Math.min(idx, CHAPTERS.length-1)];
    storyTitle.textContent = ch.title;
    storyText.textContent = ch.text;

    storyOverlay.style.display='grid';
    storyLock = true;
    paused = true;

    emit('hha:story', { chapterId: ch.id, idx, loopsDone, elapsedSec: elapsedSec() });
  }

  function closeStory(){
    if(!storyOverlay) return;
    storyOverlay.style.display='none';
    storyLock = false;
    paused = false;

    storyShownIdx = Math.max(storyShownIdx, chapterIndexFromProgress());
    showBanner('ไปต่อ! 🔥');
  }

  btnStoryOk?.addEventListener('click', closeStory, { passive:true });
  btnStorySkip?.addEventListener('click', ()=>{
    // teacher override: disable further story
    // (ยังไม่เก็บ param ถาวร เพื่อให้การทดลองครั้งหน้ากลับมาได้)
    storyOverlay.style.display='none';
    storyLock = false;
    paused = false;
    storyShownIdx = 999;
    showBanner('ข้ามเนื้อเรื่องแล้ว (ครู)');
  }, { passive:true });

  // ---------- Boss ----------
  function bossPlan(){
    // schedule based on time + diff
    // easy: first boss at 22s, then every 28s
    // normal: 20s then 26s
    // hard: 18s then 24s
    if(diff==='easy') return { first:22, every:28, hp:10, hitsPerStep:2 };
    if(diff==='hard') return { first:18, every:24, hp:14, hitsPerStep:2 };
    return { first:20, every:26, hp:12, hitsPerStep:2 };
  }
  const BP = bossPlan();

  function setBossUI(on){
    if(!bossBar) return;
    bossBar.style.display = on ? 'block' : 'none';
  }
  function updateBossUI(){
    if(!bossActive) return;
    if(bossTitle) bossTitle.textContent = '👾 GERM BOSS';
    const sNeed = STEPS[bossSeqIdx] || STEPS[0];
    if(bossSub){
      bossSub.textContent = `ทำตามลำดับ: STEP ${bossSeqIdx+1}/7 ${sNeed.icon} (${bossHitsDone}/${bossHitsNeed}) • ระวังยิงผิด!`;
    }
    if(bossFill){
      const pct = bossHPMax ? (bossHP / bossHPMax) : 0;
      bossFill.style.width = `${clamp(pct,0,1)*100}%`;
    }
  }

  function startBoss(kind='boss'){
    bossActive = true;
    bossHPMax = BP.hp;
    bossHP = bossHPMax;

    bossSeqIdx = 0;
    bossHitsNeed = BP.hitsPerStep;
    bossHitsDone = 0;

    setBossUI(true);
    updateBossUI();

    clearTargets();
    showBanner(kind==='mini' ? '🌀 MINI BOSS!' : '👾 BOSS มาแล้ว!');
    emit('hha:boss', { state:'start', kind, elapsedSec: elapsedSec() });
  }

  function endBoss(win){
    if(!bossActive) return;
    bossActive = false;
    setBossUI(false);
    clearTargets();

    if(win){
      showBanner('🏆 BOSS CLEAR!');
      bossClears += 1;
      combo = Math.max(combo, 3); // reward feel
    }else{
      showBanner('💥 แพ้บอส! ตั้งสติแล้วลองใหม่');
      // penalty: time loss small
      timeLeft = Math.max(0, timeLeft - 6);
      combo = 0;
    }
    emit('hha:boss', { state:'end', win, bossClears, elapsedSec: elapsedSec() });
  }

  function bossPenalty(){
    // wrong hit during boss: HP drop + combo break
    bossHP -= 2;
    combo = 0;
    if(bossHP <= 0){
      endBoss(false);
      // schedule next boss a bit later so not too harsh
      nextBossAtSec = elapsedSec() + Math.max(12, BP.every-6);
    }else{
      updateBossUI();
      showBanner('❌ ผิดลำดับ! บอสโจมตี!');
    }
  }

  function bossProgressOnCorrect(){
    bossHitsDone++;
    // reward: HP goes down as “timer” to push urgency
    bossHP -= 1;
    if(bossHP < 0) bossHP = 0;

    if(bossHitsDone >= bossHitsNeed){
      bossSeqIdx++;
      bossHitsDone = 0;

      if(bossSeqIdx >= STEPS.length){
        // clear
        endBoss(true);
        nextBossAtSec = elapsedSec() + BP.every;
      }else{
        showBanner(`➡️ ต่อไป: ${STEPS[bossSeqIdx].icon} ${STEPS[bossSeqIdx].label}`);
      }
    }

    if(bossHP <= 0 && bossActive){
      // still allow clear only if sequence finished, otherwise fail
      bossPenalty();
    }else{
      updateBossUI();
    }
  }

  // ---------- HUD ----------
  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const stepAcc = totalStepHits ? (correctHits / totalStepHits) : 0;
    const riskIncomplete = clamp(1 - stepAcc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);
    pillTime && (pillTime.textContent = `TIME ${Math.max(0, Math.ceil(timeLeft))}`);
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`); // keep simple

    if(bossActive) updateBossUI();
  }

  // ---------- Spawn logic ----------
  function spawnOne(){
    const P = dd ? dd.getParams() : base;

    // During boss: spawn only required step + some hazards (but no decoy)
    if(bossActive){
      const need = STEPS[bossSeqIdx];
      const r = rng();
      if(r < (P.hazardRate * 0.85)){
        return createTarget('haz', ICON_HAZ, -1);
      }
      return createTarget('good', need.icon, bossSeqIdx);
    }

    // Normal mode
    const s = STEPS[stepIdx];
    const r = rng();

    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
      // wrong step emoji
      let j = stepIdx;
      for(let k=0;k<5;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', s.icon, stepIdx);
    }
  }

  // ---------- Hit / Shoot ----------
  function onHitByPointer(obj, source){
    if(!running || paused || storyLock) return;
    judgeHit(obj, source, null);
  }

  function onShoot(e){
    if(!running || paused || storyLock) return;
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
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // BOSS RULES: must match required step + good only
    if(bossActive){
      if(obj.kind === 'good' && obj.stepIdx === bossSeqIdx){
        combo++;
        comboMax = Math.max(comboMax, combo);
        correctHits++; totalStepHits++;
        rtOk.push(rt);
        removeTarget(obj);
        showBanner(`✅ ถูก! (BOSS) ${STEPS[bossSeqIdx].icon}`);
        bossProgressOnCorrect();
        setHud();
        return;
      }else{
        // wrong or hazard in boss
        if(obj.kind === 'haz'){ hazHits++; }
        if(obj.kind === 'wrong'){ wrongStepHits++; totalStepHits++; }
        removeTarget(obj);
        bossPenalty();
        checkFail();
        setHud();
        return;
      }
    }

    // NORMAL rules
    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      coach?.onEvent('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });
      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;

          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);

          // Story beat each loop
          openStoryIfNeeded(false);

          // Mini boss after first loop sometimes
          if(loopsDone === 1 && elapsedSec() >= (BP.first-2)){
            startBoss('mini');
            miniBossClears += 1; // count as encounter; final clear counted in endBoss(true)
          }
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }
      }

      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'wrong'){
      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      coach?.onEvent('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      hazHits++;
      combo = 0;

      coach?.onEvent('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  // ---------- Game loop ----------
  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused || storyLock){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // Boss scheduling (main boss)
    if(!bossActive){
      const es = elapsedSec();
      if(nextBossAtSec === 0){
        nextBossAtSec = BP.first;
      }else if(es >= nextBossAtSec){
        startBoss('boss');
        // next scheduled when boss ends
      }
    }

    const P = dd ? dd.getParams() : base;

    // spawn accumulator
    // during boss: spawn slower so readable
    const spawnRate = bossActive ? Math.max(1.2, P.spawnPerSec * 0.80) : P.spawnPerSec;

    spawnAcc += (spawnRate * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets
      const cap = bossActive ? 10 : 18;
      if(targets.length > cap){
        // remove oldest
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    dd?.onEvent('tick', { elapsedSec: elapsedSec() });

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false; storyLock=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;
    spawnAcc=0;

    bossActive=false;
    bossHP=0; bossHPMax=0; bossSeqIdx=0; bossHitsNeed=0; bossHitsDone=0;
    nextBossAtSec=0; bossClears=0; miniBossClears=0;

    storyShownIdx=-1;

    setBossUI(false);
    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    // show chapter 0 at start (fun)
    openStoryIfNeeded(true);

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    setBossUI(false);

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

    const summary = {
      version:'1.1.0-prod',
      game:'hygiene',
      gameMode:'hygiene',
      runMode,
      diff,
      view,
      seed,
      sessionId,
      timestampIso: nowIso(),

      reason,
      durationPlannedSec: timePlannedSec,
      durationPlayedSec,

      // progress
      loopsDone,
      stepIdxEnd: stepIdx,
      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,

      // boss/story
      bossClears,
      miniBossClears,

      // core metrics
      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),
      medianStepMs: rtMed
    };

    // Optional: progression/weekly hooks (PACK N) if files exist
    try{
      WIN.HHA_HW_COS?.apply?.();

      const xpRes = WIN.HHA_HW_XP?.addFromSummary?.(summary, { allowInResearch:false });
      const w = WIN.HHA_HW_WEEK?.evaluate?.(summary, { allowInResearch:false });

      const st = WIN.HHA_HW_XP?.get?.();
      if(st){
        summary.xp = st.xp;
        summary.level = st.level;
        summary.levelPct = st.progress?.pct ?? 0;
      }
      if(w){
        summary.weekKey = w.weekKey;
        summary.missionId = w.missionId;
        summary.missionName = w.missionName;
        summary.missionDone = !!w.done;
        summary.missionTrophy = !!w.trophy;
      }
    }catch(e){}

    if(coach) Object.assign(summary, coach.getSummaryExtras?.() || {});
    if(dd) Object.assign(summary, dd.getSummaryExtras?.() || {});

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
    endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • boss ${bossClears} • haz ${hazHits} • miss ${getMissCount()} • loops ${loopsDone}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  // UI binds
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });

  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>{
    try{ navigator.clipboard?.writeText(String(endJson.textContent||'')); }catch{}
  }, { passive:true });

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

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // Coach/badge pop
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
    }
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    if(WIN.Particles && WIN.Particles.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
    }
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // init
  try{ WIN.HHA_HW_COS?.apply?.(); }catch{}
  setHud();
}