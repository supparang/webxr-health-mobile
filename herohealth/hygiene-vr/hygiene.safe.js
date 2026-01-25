// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (v1.7.0-prod)
// ✅ 7 steps emoji targets
// ✅ Mini-Quiz 3 questions (pause spawn)
// ✅ Soap Shield bonus (blocks 1 hazard)
// ✅ Boss 10s finale (HP bar) + bonus on clear
// ✅ Lightweight SFX (WebAudio osc)
// ✅ Score + Grade (bonus quiz/shield/boss, penalty miss)
// ✅ cVR shoot via hha:shoot center lockPx
// ✅ End summary -> HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY

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

const ICON_HAZ  = '🦠';
const ICON_SOAP = '🧼';
const ICON_BOSS = '🦠';

// ------------------ QUIZ (3 items) ------------------
const QUIZ = [
  {
    id:'q1',
    q:'ขั้นตอน “ซอกนิ้ว” ใช้ท่าไหน?',
    sub:'เลือกคำตอบที่สื่อความถูกต้องที่สุด',
    choices:[
      { t:'🧩 ถูซอกนิ้วแบบประสานนิ้ว', ok:true },
      { t:'👍 ถูหัวแม่มืออย่างเดียว', ok:false },
      { t:'💅 ถูปลายนิ้ว/เล็บก่อน', ok:false },
    ]
  },
  {
    id:'q2',
    q:'ทำไมต้องถู “ปลายนิ้ว/เล็บ” ?',
    sub:'เลือกข้อที่ถูก',
    choices:[
      { t:'💅 เพราะสิ่งสกปรกสะสมใต้เล็บได้', ok:true },
      { t:'🫧 เพราะทำให้ฟองเยอะขึ้น', ok:false },
      { t:'⌚ เพราะถูข้อมือก่อนเสมอ', ok:false },
    ]
  },
  {
    id:'q3',
    q:'คำท่อง 7 ขั้นตอนที่ถูกต้องคือ?',
    sub:'เลือกชุดคำที่ถูก',
    choices:[
      { t:'ฝ่า-หลัง-ซอก-ข้อ-โป้ง-เล็บ-ข้อมือ', ok:true },
      { t:'ฝ่า-ซอก-หลัง-ข้อ-เล็บ-โป้ง-ข้อมือ', ok:false },
      { t:'หลัง-ฝ่า-ข้อ-ซอก-โป้ง-เล็บ-ข้อมือ', ok:false },
    ]
  },
];

// ------------------ Tiny SFX (WebAudio) ------------------
function createSfx(){
  const state = { ctx:null, lastAt:0, enabled:true };
  function ensure(){
    if(state.ctx) return state.ctx;
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return null;
    state.ctx = new AC();
    return state.ctx;
  }
  function beep(freq=660, dur=0.06, gain=0.06, type='sine'){
    if(!state.enabled) return;
    const t = nowMs();
    if(t - state.lastAt < 35) return; // throttle
    state.lastAt = t;

    const ctx = ensure();
    if(!ctx) return;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;

    o.connect(g);
    g.connect(ctx.destination);

    const t0 = ctx.currentTime;
    o.start(t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.stop(t0 + dur + 0.01);
  }
  return {
    enable(v){ state.enabled = !!v; },
    tap(){ beep(520, .05, .05, 'triangle'); },
    good(){ beep(760, .06, .06, 'sine'); },
    wrong(){ beep(220, .08, .07, 'square'); },
    haz(){ beep(160, .10, .08, 'sawtooth'); },
    block(){ beep(480, .05, .06, 'triangle'); beep(900, .04, .04, 'sine'); },
    soap(){ beep(650, .05, .06, 'sine'); beep(980, .05, .04, 'sine'); },
    quizOk(){ beep(740, .05, .06, 'sine'); beep(980, .05, .06, 'sine'); },
    bossHit(){ beep(420, .05, .06, 'square'); },
    bossClear(){ beep(880, .06, .07, 'sine'); beep(1180, .06, .06, 'sine'); },
  };
}

// ------------------ Engine ------------------
export function boot(){
  const stage = DOC.getElementById('stage');
  if(!stage) return;

  // UI handles
  const pillStep  = DOC.getElementById('pillStep');
  const pillHits  = DOC.getElementById('pillHits');
  const pillCombo = DOC.getElementById('pillCombo');
  const pillMiss  = DOC.getElementById('pillMiss');
  const pillRisk  = DOC.getElementById('pillRisk');
  const pillTime  = DOC.getElementById('pillTime');
  const pillQuest = DOC.getElementById('pillQuest');
  const hudSub    = DOC.getElementById('hudSub');
  const banner    = DOC.getElementById('banner');

  // Boss UI
  const bossBar   = DOC.getElementById('bossBar');
  const bossFill  = DOC.getElementById('bossFill');
  const bossTitle = DOC.getElementById('bossTitle');
  const bossSub   = DOC.getElementById('bossSub');

  // Quiz UI
  const quizBox   = DOC.getElementById('quizBox');
  const quizQ     = DOC.getElementById('quizQ');
  const quizSub   = DOC.getElementById('quizSub');
  const quizAns   = DOC.getElementById('quizAns');
  const quizHint  = DOC.getElementById('quizHint');

  const startOverlay = DOC.getElementById('startOverlay');
  const endOverlay   = DOC.getElementById('endOverlay');
  const endTitle     = DOC.getElementById('endTitle');
  const endSub       = DOC.getElementById('endSub');
  const endJson      = DOC.getElementById('endJson');

  // controls
  const btnStart     = DOC.getElementById('btnStart');
  const btnRestart   = DOC.getElementById('btnRestart');
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnCopyJson  = DOC.getElementById('btnCopyJson');
  const btnPause     = DOC.getElementById('btnPause');
  const btnBack      = DOC.getElementById('btnBack');
  const btnBack2     = DOC.getElementById('btnBack2');

  // params
  const runMode = (qs('run','play')||'play').toLowerCase();
  const diff    = (qs('diff','normal')||'normal').toLowerCase();
  const view    = (qs('view','pc')||'pc').toLowerCase();
  const hub     = qs('hub','');
  const kids    = (qs('kids','0') === '1');

  const sfxOn = (qs('sfx','1') !== '0');
  const SFX = createSfx();
  SFX.enable(sfxOn);

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng  = makeRNG(seed);

  // difficulty base
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec: kids?1.55:1.8, hazardRate:0.085, decoyRate:0.18, soapRate:0.07 };
    if(diff==='hard') return { spawnPerSec: kids?2.15:2.6, hazardRate:0.14,  decoyRate:0.26, soapRate:0.06 };
    return { spawnPerSec: kids?1.85:2.2, hazardRate:0.12,  decoyRate:0.22, soapRate:0.065 };
  })();

  // state
  let running=false, paused=false, quizMode=false;
  let tStartMs=0, tLastMs=0;
  let timeLeft = timePlannedSec;

  let stepIdx=0;
  let hitsInStep=0;
  let loopsDone=0;

  let combo=0, comboMax=0;
  let wrongStepHits=0;
  let hazHits=0;
  let hazBlocked=0;
  const missLimit = 3;

  let shield=0;

  let correctHits=0;
  let totalStepHits=0;
  const rtOk = [];
  let spawnAcc=0;

  // quiz
  let quizIndex=0;
  const quizShown = new Set();
  let quizOkCount=0;

  // quests
  const quest = { q1:false, q2:false, q3:false };

  // boss
  let bossActive=false;
  let bossCleared=false;
  let bossHP=0, bossHPMax=0;
  let bossId=null;

  // targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y}
  let nextId=1;

  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1200);
  }

  function getSpawnRect(){
    const w = WIN.innerWidth, h = WIN.innerHeight;
    const topSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-top-safe')) || 150;
    const bottomSafe = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--hw-bottom-safe')) || 130;
    const pad = 14;
    const x0 = pad, x1 = w - pad;
    const y0 = topSafe + pad;
    const y1 = h - bottomSafe - pad;
    return { x0, x1, y0, y1, w, h };
  }

  function getMissCount(){
    return (wrongStepHits + hazHits); // blocked doesn't count
  }
  function stepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function setBossUI(){
    if(!bossBar) return;
    bossBar.style.display = bossActive ? 'block' : 'none';
    if(!bossActive) return;

    if(bossTitle) bossTitle.textContent = bossCleared ? '✅ BOSS CLEAR' : '🚨 FINAL BOSS';
    if(bossSub) bossSub.textContent = bossCleared ? 'ทำได้!' : `HP ${bossHP}/${bossHPMax}`;
    if(bossFill){
      const pct = bossHPMax ? clamp((bossHP/bossHPMax)*100, 0, 100) : 0;
      bossFill.style.width = `${pct.toFixed(1)}%`;
    }
  }

  function setQuestText(){
    if(!pillQuest) return;
    const qDone = (quest.q1?1:0) + (quest.q2?1:0) + (quest.q3?1:0);
    pillQuest.textContent = `QUEST 🛡 ${shield} • ❓ ${quizIndex}/3 • 🏅 ${qDone}/3`;
  }

  function setHud(){
    const s = STEPS[stepIdx];
    pillStep && (pillStep.textContent = `STEP ${stepIdx+1}/7 ${s.icon} ${s.label}`);
    pillHits && (pillHits.textContent = `HITS ${hitsInStep}/${s.hitsNeed}`);
    pillCombo && (pillCombo.textContent = `COMBO ${combo}`);
    pillMiss && (pillMiss.textContent = `MISS ${getMissCount()} / ${missLimit}`);

    const acc = stepAcc();
    const riskIncomplete = clamp(1 - acc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);
    pillRisk && (pillRisk.textContent = `RISK Incomplete ${(riskIncomplete*100).toFixed(0)}% • Unsafe ${(riskUnsafe*100).toFixed(0)}%`);

    if(pillTime){
      const t = Math.max(0, Math.ceil(timeLeft));
      pillTime.textContent = `TIME ${t}`;
      pillTime.classList.toggle('urgent', t <= 10);
      DOC.body.classList.toggle('last3', t <= 3);
    }

    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view} • loops=${loopsDone}`);
    setQuestText();
    setBossUI();
  }

  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
    bossId = null;
  }

  function createTarget(kind, emoji, stepRef, opts={}){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);
    stage.appendChild(el);

    const rect = getSpawnRect();
    let x, y;

    if(opts.center){
      x = rect.w * 0.5;
      y = rect.h * 0.30; // top-ish but not in HUD
    }else{
      x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
      y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);
    }

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (opts.scale ?? (0.90 + rng()*0.25)).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y };
    targets.push(obj);

    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHit(obj, 'tap', null), { passive:true });
    }
    return obj;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
    if(bossId === obj.id) bossId = null;
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function spawnOne(){
    if(bossActive){
      // during boss: keep only boss target (and tiny hazards)
      if(!bossCleared && bossId == null){
        const b = createTarget('boss', ICON_BOSS, -3, { center:true, scale:1.25 });
        bossId = b.id;
      }else{
        // add small hazard occasionally for tension
        if(rng() < 0.25){
          createTarget('haz', ICON_HAZ, -1, { scale:0.82 });
        }
      }
      return;
    }

    const miss = getMissCount();
    const soapRate = clamp(base.soapRate + miss*0.02, 0.05, 0.18);

    const r = rng();
    if(r < base.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < base.hazardRate + soapRate){
      return createTarget('soap', ICON_SOAP, -2);
    }else if(r < base.hazardRate + soapRate + base.decoyRate){
      let j = stepIdx;
      for(let k=0;k<6;k++){
        const pick = Math.floor(rng()*STEPS.length);
        if(pick !== stepIdx){ j = pick; break; }
      }
      return createTarget('wrong', STEPS[j].icon, j);
    }else{
      return createTarget('good', STEPS[stepIdx].icon, stepIdx);
    }
  }

  function startBoss(){
    if(bossActive || bossCleared) return;
    bossActive = true;

    // HP depends on difficulty
    bossHPMax = (diff==='hard') ? 14 : (diff==='easy' ? 10 : 12);
    if(kids) bossHPMax = Math.max(8, bossHPMax - 2);

    bossHP = bossHPMax;
    showBanner('🚨 FINAL BOSS! ยิงเชื้อให้แตกก่อนหมดเวลา!');
    setBossUI();
    clearTargets(); // clear clutter -> focus boss
    spawnOne();     // spawn boss immediately
    setHud();
  }

  function bossHit(){
    if(!bossActive || bossCleared) return;
    bossHP = Math.max(0, bossHP - 1);
    SFX.bossHit();
    showBanner(`💥 BOSS HIT! (${bossHP}/${bossHPMax})`);
    setBossUI();

    if(bossHP <= 0){
      bossCleared = true;
      bossActive = false;
      SFX.bossClear();
      showBanner('✅ BOSS CLEAR! ได้โบนัสเวลา +5 และโล่ +1');

      timeLeft += 5;
      shield = clamp(shield + 1, 0, 3);

      clearTargets();
      setHud();
    }
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  // ------------------ QUIZ FLOW ------------------
  function maybeStartQuiz(){
    if(quizIndex >= 3) return;
    const item = QUIZ[quizIndex];
    if(!item || quizShown.has(item.id)) return;
    quizShown.add(item.id);
    quizIndex++;
    startQuiz(item);
  }

  function startQuiz(item){
    quizMode = true;
    clearTargets();

    if(!quizBox || !quizQ || !quizSub || !quizAns) {
      quizMode = false;
      return;
    }

    quizBox.style.display = 'block';
    quizQ.textContent = `❓ ${item.q}`;
    quizSub.textContent = item.sub || 'เลือกคำตอบ';
    quizAns.innerHTML = '';

    (item.choices||[]).forEach((c, idx)=>{
      const b = DOC.createElement('button');
      b.type = 'button';
      b.className = 'hw-ans';
      b.textContent = c.t;
      b.addEventListener('click', ()=>{
        resolveQuiz(!!c.ok, idx, item);
      }, { passive:true });
      quizAns.appendChild(b);
    });

    if(quizHint) quizHint.textContent = 'ตอบถูก: 🛡 +1 และคอมโบ +3';
    showBanner('🧠 MINI QUIZ!');
    setHud();
  }

  function resolveQuiz(ok, choiceIndex, item){
    if(!quizBox || !quizAns) return;

    const btns = Array.from(quizAns.querySelectorAll('button'));
    btns.forEach((b, i)=>{
      const isPicked = (i === choiceIndex);
      if(isPicked) b.classList.add(ok?'good':'bad');
      b.disabled = true;
      b.style.opacity = isPicked ? '1' : '.55';
    });

    if(ok){
      quizOkCount++;
      shield = clamp(shield + 1, 0, 3);
      combo += 3;
      comboMax = Math.max(comboMax, combo);
      SFX.quizOk();
      showBanner(`✅ ถูก! 🛡 +1 (โล่ ${shield})`);
      emit('hha:judge', { kind:'quiz_ok', quizId:item.id, shield, combo });
    }else{
      combo = 0;
      SFX.wrong();
      showBanner('❌ ยังไม่ถูก!');
      emit('hha:judge', { kind:'quiz_bad', quizId:item.id });
    }

    setTimeout(()=>{
      quizBox.style.display = 'none';
      quizAns.innerHTML = '';
      quizMode = false;
      setHud();
    }, 850);
  }

  // ------------------ HIT / SHOOT ------------------
  function onHit(obj, source, extra){
    if(!running || paused || quizMode) return;

    // first user action: unlock audio on mobile
    if(source === 'tap') SFX.tap();

    const rt = computeRt(obj);

    if(obj.kind === 'boss'){
      bossHit();
      removeTarget(obj);
      return;
    }

    if(obj.kind === 'soap'){
      shield = clamp(shield + 1, 0, 3);
      combo = combo + 2;
      comboMax = Math.max(comboMax, combo);
      SFX.soap();
      showBanner(`🧼 ได้โล่! 🛡 +1 (ตอนนี้ ${shield})`);
      emit('hha:judge', { kind:'soap', rtMs:rt, source, extra, shield });
      removeTarget(obj);
      setHud();
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);
      SFX.good();

      if(!quest.q2 && comboMax >= 12){
        quest.q2 = true;
        showBanner('🏅 QUEST: คอมโบ 12 สำเร็จ!');
      }else{
        showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);
      }

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra });

      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);

          if(!quest.q1 && loopsDone >= 1 && stepAcc() >= 0.80){
            quest.q1 = true;
            showBanner('🏅 QUEST: รอบแรกแม่น ≥ 80% สำเร็จ!');
          }

          maybeStartQuiz();
        }else{
          showBanner(`➡️ ขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
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
      SFX.wrong();
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }

    if(obj.kind === 'haz'){
      if(shield > 0){
        shield--;
        hazBlocked++;
        combo = Math.max(0, combo - 1);
        SFX.block();
        showBanner(`🛡 BLOCK! โล่เหลือ ${shield}`);
        emit('hha:judge', { kind:'block', rtMs: rt, source, extra, shield });
        removeTarget(obj);
        setHud();
        return;
      }

      hazHits++;
      combo = 0;
      SFX.haz();
      showBanner('🦠 โดนเชื้อ! ระวัง!');
      emit('hha:judge', { kind:'haz', rtMs: rt, source, extra });
      removeTarget(obj);
      checkFail();
      setHud();
      return;
    }
  }

  function onShoot(e){
    if(!running || paused || quizMode) return;
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
      onHit(best, 'shoot', { lockPx, dist: bestDist });
    }
  }

  // ------------------ LOOP ------------------
  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
  }

  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }
    if(quizMode){ requestAnimationFrame(tick); return; }

    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    // boss trigger
    if(!bossCleared && !bossActive && timeLeft <= 10 && timeLeft > 0){
      startBoss();
    }

    if(timeLeft <= 0){
      endGame(bossActive && !bossCleared ? 'time_boss_fail' : 'time');
      return;
    }

    // spawn
    const sp = bossActive ? (kids?2.1:2.6) : base.spawnPerSec;
    spawnAcc += (sp * dt);
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();
      const cap = bossActive ? (kids?10:12) : (kids?14:18);
      if(targets.length > cap){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    setHud();
    requestAnimationFrame(tick);
  }

  function resetGame(){
    running=false; paused=false; quizMode=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0; hazBlocked=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;
    spawnAcc=0;
    shield=0;

    quizIndex=0;
    quizOkCount=0;
    quizShown.clear();
    quest.q1=false; quest.q2=false; quest.q3=false;

    bossActive=false; bossCleared=false;
    bossHP=0; bossHPMax=0; bossId=null;

    if(quizBox){ quizBox.style.display='none'; }
    if(quizAns){ quizAns.innerHTML=''; }
    if(bossBar){ bossBar.style.display='none'; }

    setHud();
  }

  function startGame(){
    resetGame();
    running=true;
    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay && (startOverlay.style.display = 'none');
    endOverlay && (endOverlay.style.display = 'none');

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    showBanner(`เริ่ม! STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();
    requestAnimationFrame(tick);
  }

  function computeScore(){
    // score model: simple + explainable
    const misses = getMissCount();
    const acc = stepAcc();

    const sCorrect = correctHits * 10;
    const sLoops   = loopsDone * 50;
    const sCombo   = comboMax * 2;
    const sQuiz    = quizOkCount * 30;
    const sBoss    = bossCleared ? 80 : 0;
    const sShield  = hazBlocked * 15;

    const pMiss    = misses * 25;
    const pHaz     = hazHits * 20;
    const pAcc     = Math.round((1 - acc) * 120); // small penalty if low acc

    const score = Math.max(0, Math.round(
      sCorrect + sLoops + sCombo + sQuiz + sBoss + sShield - pMiss - pHaz - pAcc
    ));

    return { score, sCorrect, sLoops, sCombo, sQuiz, sBoss, sShield, pMiss, pHaz, pAcc };
  }

  function scoreToGrade(score){
    if(score >= 520) return 'SSS';
    if(score >= 410) return 'SS';
    if(score >= 320) return 'S';
    if(score >= 240) return 'A';
    if(score >= 160) return 'B';
    return 'C';
  }

  function endGame(reason){
    if(!running) return;
    running=false;
    clearTargets();

    if(getMissCount() <= 1) quest.q3 = true;

    const durationPlayedSec = Math.max(0, Math.round(elapsedSec()));
    const acc = stepAcc();
    const riskIncomplete = clamp(1 - acc, 0, 1);
    const riskUnsafe = clamp(hazHits / Math.max(1, (loopsDone+1)*2), 0, 1);

    const rtMed = (()=> {
      const a = rtOk.slice().sort((a,b)=>a-b);
      if(!a.length) return 0;
      const m = (a.length-1)/2;
      return (a.length%2) ? a[m|0] : (a[m|0] + a[(m|0)+1])/2;
    })();

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const scoreParts = computeScore();
    const grade = scoreToGrade(scoreParts.score);

    const summary = {
      version:'1.7.0-prod',
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
      hazBlocked,
      shieldEnd: shield,

      stepAcc: acc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),
      medianStepMs: rtMed,

      quizDone: quizIndex,
      quizOk: quizOkCount,

      bossCleared,
      bossHPMax,

      questQ1: quest.q1,
      questQ2: quest.q2,
      questQ3: quest.q3,

      score: scoreParts.score,
      grade,
      scoreBreakdown: scoreParts,
    };

    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle && (endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅');
    endSub && (endSub.textContent =
      `Grade ${grade} • SCORE ${scoreParts.score} • acc ${(acc*100).toFixed(1)}% • miss ${getMissCount()} • boss ${bossCleared?'clear':'—'} • quiz ${quizOkCount}/${quizIndex}`
    );

    if(endJson) endJson.textContent = JSON.stringify(summary, null, 2);
    endOverlay && (endOverlay.style.display = 'grid');
  }

  // ------------------ UI binds ------------------
  btnStart?.addEventListener('click', startGame, { passive:true });
  btnRestart?.addEventListener('click', ()=>{ resetGame(); showBanner('รีเซ็ตแล้ว'); }, { passive:true });
  btnPlayAgain?.addEventListener('click', startGame, { passive:true });
  btnCopyJson?.addEventListener('click', ()=>copyText(endJson?.textContent||''), { passive:true });

  function goHub(){
    if(hub) location.href = hub;
    else location.href = '../hub.html';
  }
  btnBack?.addEventListener('click', goHub, { passive:true });
  btnBack2?.addEventListener('click', goHub, { passive:true });

  btnPause?.addEventListener('click', ()=>{
    if(!running) return;
    paused = !paused;
    if(btnPause) btnPause.textContent = paused ? '▶ Resume' : '⏸ Pause';
    showBanner(paused ? 'พักเกม' : 'ไปต่อ!');
  }, { passive:true });

  WIN.addEventListener('hha:shoot', onShoot);

  setHud();
}