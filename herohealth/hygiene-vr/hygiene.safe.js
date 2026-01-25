// === /herohealth/hygiene-vr/hygiene.safe.js ===
// HygieneVR SAFE — SURVIVAL (HHA Standard + Emoji 7 Steps + Boss + Powerups + Quest + Assist)
// Emits: hha:start, hha:time, hha:score, hha:judge, hha:end, quest:update, hha:block
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

const ICON_HAZ  = '🦠';
const ICON_SOAP = '🧼'; // slow hazard/decoy
const ICON_SHLD = '🛡️'; // block next hazard (no miss)
const ICON_WATR = '💧'; // combo guard (save combo once)
const ICON_BOSS = '🧫'; // boss target (optional)

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
  const pillQuest= DOC.getElementById('pillQuest');
  const qbarFill = DOC.getElementById('qbarFill');

  const pillPower= DOC.getElementById('pillPower');
  const pillBoss = DOC.getElementById('pillBoss');
  const bossBar  = DOC.getElementById('bossBar');
  const bossFill = DOC.getElementById('bossFill');

  const hudSub   = DOC.getElementById('hudSub');
  const banner   = DOC.getElementById('banner');

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
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const view = (qs('view','pc')||'pc').toLowerCase();
  const hub = qs('hub', '');
  const kids = (qs('kids','0') === '1');

  const timePlannedSec = clamp(qs('time', diff==='easy'?80:(diff==='hard'?70:75)), 20, 9999);
  const seed = Number(qs('seed', Date.now()));
  const rng = makeRNG(seed);

  // feature toggles (defaults)
  const coachOn = (qs('coach','1') !== '0');
  const ddOn    = (qs('dd','1') !== '0');

  const questOn = (qs('quest', (runMode==='research' ? '0' : '1')) !== '0');
  const powerOn = (qs('power', (runMode==='research' ? '0' : '1')) !== '0');
  const bossOn  = (qs('boss',  (runMode==='research' ? '0' : '1')) !== '0');

  // assist default on for play, off for research
  const assistOn = (qs('assist', (runMode==='research' ? '0' : (kids ? '1' : '1'))) !== '0');
  const assistAllowed = assistOn && (view === 'pc' || view === 'mobile');

  // difficulty presets (base)
  const base = (()=> {
    if(diff==='easy') return { spawnPerSec:1.8, hazardRate:0.09, decoyRate:0.18, powerRate:0.06 };
    if(diff==='hard') return { spawnPerSec:2.6, hazardRate:0.14, decoyRate:0.26, powerRate:0.05 };
    return { spawnPerSec:2.2, hazardRate:0.12, decoyRate:0.22, powerRate:0.055 };
  })();

  const bounds = {
    spawnPerSec:[1.2, 4.2],
    hazardRate:[0.06, 0.26],
    decoyRate:[0.10, 0.40],
    powerRate:[0.02, 0.10]
  };

  // AI instances (optional external packs)
  const coach = (coachOn && WIN.HHA_AICoach) ? WIN.HHA_AICoach.create({ gameId:'hygiene', seed, runMode, lang:'th' }) : null;
  const dd = (ddOn && WIN.HHA_DD) ? WIN.HHA_DD.create({ seed, runMode, base, bounds }) : null;

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
  let shieldBlocks=0;
  const missLimit = 3;

  let correctHits=0;
  let totalStepHits=0; // correct + wrong (only step targets)
  const rtOk = []; // ms
  let spawnAcc=0;

  // Power state
  const pwr = {
    soapUntilMs: 0,   // slow hazards/decoys for duration
    shield: 0,        // blocks next haz
    comboGuard: 0     // saves combo once on wrong step
  };

  // Boss state
  const boss = {
    on: bossOn,
    active: false,
    durSec: 10,
    tStartMs: 0,
    bossCount: 0,
    cleared: 0,
    hitsNeed: 10,     // during boss: hit correct targets X times
    hitsDone: 0
  };

  // Quest state
  const quest = {
    on: questOn,
    main: { doneSteps: 0, totalSteps: 7, passed: false },
    q2: { type: '', title: '', goal: 0, cur: 0, deadlineSec: 0, startMs: 0, passed: false },
    q2PassedCount: 0,
    q2FailedCount: 0
  };

  // Active targets
  const targets = []; // {id, el, kind, stepIdx, bornMs, x,y, meta}
  let nextId=1;

  // ------------------ UI helpers ------------------
  function showBanner(msg){
    if(!banner) return;
    banner.textContent = msg;
    banner.classList.add('show');
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(()=>banner.classList.remove('show'), 1400);
  }

  function copyText(text){
    return navigator.clipboard?.writeText(String(text)).catch(()=>{});
  }

  function setQbar(pct){
    if(!qbarFill) return;
    pct = clamp(pct, 0, 100);
    qbarFill.style.width = pct.toFixed(1) + '%';
  }

  function setBossBar(pct, show){
    if(!bossBar || !bossFill) return;
    if(show) bossBar.style.display = 'block';
    else bossBar.style.display = 'none';
    pct = clamp(pct, 0, 100);
    bossFill.style.width = pct.toFixed(1) + '%';
  }

  function getMissCount(){
    // miss = wrong step hits + hazard hits (แต่ถ้า Shield block => ไม่นับ hazHits)
    return (wrongStepHits + hazHits);
  }

  function elapsedSec(){
    return running ? ((nowMs() - tStartMs)/1000) : 0;
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
    hudSub && (hudSub.textContent = `${runMode.toUpperCase()} • diff=${diff} • seed=${seed} • view=${view}`);

    // power HUD
    if(pillPower){
      const soap = (nowMs() < pwr.soapUntilMs) ? '🧼ON' : '🧼—';
      const shld = pwr.shield ? `🛡️${pwr.shield}` : '🛡️—';
      const watr = pwr.comboGuard ? `💧${pwr.comboGuard}` : '💧—';
      pillPower.textContent = `PWR ${soap} ${shld} ${watr}`;
    }

    // boss HUD
    if(pillBoss){
      if(boss.active){
        const left = Math.max(0, boss.durSec - ((nowMs()-boss.tStartMs)/1000));
        pillBoss.textContent = `BOSS ⚡ ${(left).toFixed(0)}s • HIT ${boss.hitsDone}/${boss.hitsNeed}`;
      }else{
        pillBoss.textContent = boss.on ? `BOSS — (${boss.bossCount}x)` : 'BOSS OFF';
      }
    }
  }

  // ------------------ Assist UI (ring + X) ------------------
  let assistLayer=null, ringEl=null, xEl=null;

  function ensureAssistUI(){
    if(!assistAllowed) return;
    if(assistLayer) return;

    assistLayer = DOC.createElement('div');
    assistLayer.className = 'hw-assist-layer';

    ringEl = DOC.createElement('div');
    ringEl.className = 'hw-ring';

    xEl = DOC.createElement('div');
    xEl.className = 'hw-xmark';
    xEl.textContent = '✖';

    assistLayer.appendChild(ringEl);
    assistLayer.appendChild(xEl);
    DOC.body.appendChild(assistLayer);
  }

  function hideRing(){ if(ringEl) ringEl.classList.remove('on'); }

  function placeRingOnElement(el){
    if(!ringEl || !el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;

    const size = Math.max(56, Math.min(96, Math.round(Math.max(r.width, r.height) * 1.25)));
    ringEl.style.width = size+'px';
    ringEl.style.height= size+'px';
    ringEl.style.left  = cx+'px';
    ringEl.style.top   = cy+'px';
    ringEl.classList.add('on');
  }

  function popXOnElement(el){
    if(!xEl || !el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;

    xEl.style.left = cx+'px';
    xEl.style.top  = cy+'px';
    xEl.classList.add('on');
    clearTimeout(popXOnElement._t);
    popXOnElement._t = setTimeout(()=> xEl && xEl.classList.remove('on'), 260);
  }

  function pickBestGoodTarget(){
    const goods = targets.filter(t=>t && t.kind==='good' && t.el && t.stepIdx===stepIdx);
    if(!goods.length) return null;

    const cx = WIN.innerWidth/2, cy = WIN.innerHeight/2;
    let best=null, bestD=1e18;

    for(const t of goods){
      const rr = t.el.getBoundingClientRect();
      const x = rr.left + rr.width/2;
      const y = rr.top  + rr.height/2;
      const d = Math.hypot(x-cx, y-cy);
      if(d < bestD){ bestD=d; best=t; }
    }
    return best;
  }

  function updateAssist(){
    if(!assistAllowed) return;
    if(!running || paused){ hideRing(); return; }
    const best = pickBestGoodTarget();
    if(best && best.el) placeRingOnElement(best.el);
    else hideRing();
  }

  // ------------------ Quest system ------------------
  function pulseQuestPass(){
    DOC.body.classList.add('fx-questpass');
    clearTimeout(pulseQuestPass._t);
    pulseQuestPass._t = setTimeout(()=>DOC.body.classList.remove('fx-questpass'), 220);
  }

  function miniElapsedSec(){
    return (nowMs() - quest.q2.startMs) / 1000;
  }

  function updateQuestHUD(){
    if(!pillQuest) return;

    if(!quest.on){
      pillQuest.textContent = 'QUEST OFF';
      setQbar(0);
      return;
    }

    const mainTxt = `Main ${quest.main.doneSteps}/7`;

    const q2 = quest.q2;
    let miniTxt = 'Mini —';
    let pct = 0;

    if(q2.type){
      if(q2.type === 'combo12'){
        q2.cur = comboMax;
        pct = 100 * (q2.cur / q2.goal);
        miniTxt = `${q2.title} (${Math.min(q2.cur,q2.goal)}/${q2.goal})`;
      }else if(q2.type === 'streak6'){
        q2.cur = combo;
        pct = 100 * (q2.cur / q2.goal);
        miniTxt = `${q2.title} (${Math.min(q2.cur,q2.goal)}/${q2.goal})`;
      }else if(q2.type === 'safe15'){
        const sec = miniElapsedSec();
        q2.cur = sec;
        pct = 100 * (q2.cur / q2.goal);
        miniTxt = `${q2.title} (${Math.min(sec,q2.goal).toFixed(0)}/${q2.goal})`;
      }
    }

    const passMark = (q2.passed ? ' ✅' : '');
    pillQuest.textContent = `QUEST • ${mainTxt} • ${miniTxt}${passMark}`;
    setQbar(pct);
  }

  function passMiniQuest(){
    if(!quest.on) return;
    if(quest.q2.passed) return;
    quest.q2.passed = true;
    quest.q2PassedCount++;
    pulseQuestPass();
    showBanner('🏅 MINI QUEST PASS!');
    updateQuestHUD();
    emit('quest:update', { q2PassedCount: quest.q2PassedCount, q2FailedCount: quest.q2FailedCount });
  }

  function startMiniQuest(){
    if(!quest.on) return;

    quest.q2.passed = false;
    quest.q2.cur = 0;
    quest.q2.startMs = nowMs();

    const r = rng();
    const pick =
      (r < 0.34) ? 'combo12' :
      (r < 0.68) ? 'streak6' :
                   'safe15';

    if(pick === 'combo12'){
      quest.q2.type = 'combo12';
      quest.q2.title = 'ทำคอมโบ 12';
      quest.q2.goal = 12;
      quest.q2.deadlineSec = 9999;
    }else if(pick === 'streak6'){
      quest.q2.type = 'streak6';
      quest.q2.title = 'ถูกติดกัน 6';
      quest.q2.goal = 6;
      quest.q2.deadlineSec = 9999;
    }else{
      quest.q2.type = 'safe15';
      quest.q2.title = 'ไม่โดนเชื้อ 15 วิ';
      quest.q2.goal = 15;
      quest.q2.deadlineSec = 15;
    }

    updateQuestHUD();
  }

  // ------------------ Targets ------------------
  function clearTargets(){
    while(targets.length){
      const t = targets.pop();
      t.el?.remove();
    }
  }

  function createTarget(kind, emoji, stepRef, meta=null){
    const el = DOC.createElement('button');
    el.type='button';
    el.className = `hw-tgt ${kind}`;
    el.innerHTML = `<span class="emoji">${emoji}</span>`;
    el.dataset.id = String(nextId);
    stage.appendChild(el);

    const rect = getSpawnRect();
    const x = clamp(rect.x0 + (rect.x1-rect.x0)*rng(), rect.x0, rect.x1);
    const y = clamp(rect.y0 + (rect.y1-rect.y0)*rng(), rect.y0, rect.y1);

    el.style.setProperty('--x', ((x/rect.w)*100).toFixed(3));
    el.style.setProperty('--y', ((y/rect.h)*100).toFixed(3));
    el.style.setProperty('--s', (0.90 + rng()*0.25).toFixed(3));

    const obj = { id: nextId++, el, kind, stepIdx: stepRef, bornMs: nowMs(), x, y, meta };
    targets.push(obj);

    // click/tap only for non-cVR strict
    if(view !== 'cvr'){
      el.addEventListener('click', ()=> onHitByPointer(obj, 'tap'), { passive:true });
    }
    return obj;
  }

  function removeTarget(obj){
    const i = targets.findIndex(t=>t.id===obj.id);
    if(i>=0) targets.splice(i,1);
    obj.el?.remove();
  }

  function computeRt(obj){
    const dt = nowMs() - obj.bornMs;
    return clamp(dt, 0, 60000);
  }

  function onHitByPointer(obj, source){
    if(!running || paused) return;
    judgeHit(obj, source, null);
  }

  // cVR shooting: aim from center, lockPx = from vr-ui config
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
    }
  }

  // ------------------ Boss / Power / DD params ------------------
  function ddParams(){
    // external DD takes precedence, else internal adaptive
    if(dd) return dd.getParams();

    // internal adaptive:
    // - base + slight ramp by elapsed time
    // - if miss high => soften
    const t = elapsedSec();
    const miss = getMissCount();
    const ramp = clamp(t/60, 0, 1); // 0..1 in 60s

    let spawnPerSec = base.spawnPerSec + 0.6*ramp;
    let hazardRate  = base.hazardRate  + 0.04*ramp;
    let decoyRate   = base.decoyRate   + 0.05*ramp;
    let powerRate   = base.powerRate;

    if(miss >= 2){
      spawnPerSec *= 0.88;
      hazardRate  *= 0.85;
      decoyRate   *= 0.90;
      powerRate   = Math.min(bounds.powerRate[1], powerRate + 0.02);
    }
    if(comboMax >= 12){
      spawnPerSec *= 1.06;
      hazardRate  *= 1.06;
    }

    // clamp
    spawnPerSec = clamp(spawnPerSec, bounds.spawnPerSec[0], bounds.spawnPerSec[1]);
    hazardRate  = clamp(hazardRate,  bounds.hazardRate[0],  bounds.hazardRate[1]);
    decoyRate   = clamp(decoyRate,   bounds.decoyRate[0],   bounds.decoyRate[1]);
    powerRate   = clamp(powerRate,   bounds.powerRate[0],   bounds.powerRate[1]);

    return { spawnPerSec, hazardRate, decoyRate, powerRate };
  }

  function effectiveParams(){
    const P = ddParams();

    // soap effect: soften hazard/decoy for short time
    if(nowMs() < pwr.soapUntilMs){
      return {
        spawnPerSec: P.spawnPerSec * 0.92,
        hazardRate:  P.hazardRate  * 0.55,
        decoyRate:   P.decoyRate   * 0.65,
        powerRate:   P.powerRate * 0.70
      };
    }

    return P;
  }

  // Boss trigger: every 1 loop OR every ~25s (whichever first)
  let nextBossAtSec = 25;

  function startBoss(){
    if(!boss.on) return;
    if(boss.active) return;

    boss.active = true;
    boss.tStartMs = nowMs();
    boss.bossCount++;
    boss.hitsNeed = clamp(8 + boss.bossCount*2, 8, 16);
    boss.hitsDone = 0;

    showBanner(`👾 BOSS! ล้างให้ทัน! HIT ${boss.hitsNeed} ใน ${boss.durSec}s`);
    setBossBar(0, true);
    // short power gift for kids to feel fair
    if(powerOn && kids && pwr.shield < 1) pwr.shield = 1;

    // make it intense: clear old clutter
    trimTargetsHard();
  }

  function endBoss(pass){
    if(!boss.active) return;
    boss.active = false;

    setBossBar(0, false);
    if(pass){
      boss.cleared++;
      pulseQuestPass();
      showBanner(`🏆 BOSS CLEAR! +Power!`);
      // reward: give random power
      if(powerOn){
        const r = rng();
        if(r < 0.34) pwr.soapUntilMs = Math.max(pwr.soapUntilMs, nowMs() + 8000);
        else if(r < 0.68) pwr.shield = Math.min(3, pwr.shield + 1);
        else pwr.comboGuard = Math.min(3, pwr.comboGuard + 1);
      }
    }else{
      showBanner(`💥 BOSS FAIL! ระวังเชื้อ!`);
      // soften after boss fail
      if(powerOn) pwr.soapUntilMs = Math.max(pwr.soapUntilMs, nowMs() + 6000);
    }

    // schedule next boss
    nextBossAtSec = elapsedSec() + clamp(22 - boss.bossCount*1.2, 12, 22);
  }

  function updateBoss(){
    if(!boss.on) return;

    if(!boss.active){
      // trigger by time
      if(elapsedSec() >= nextBossAtSec && running && !paused) startBoss();
      return;
    }

    const t = (nowMs() - boss.tStartMs)/1000;
    const pct = 100 * (t / boss.durSec);
    setBossBar(pct, true);

    // pass condition: hitsDone >= hitsNeed within duration
    if(boss.hitsDone >= boss.hitsNeed){
      endBoss(true);
      return;
    }

    // time over -> fail (but not immediate game over; just fail boss)
    if(t >= boss.durSec){
      endBoss(false);
      return;
    }
  }

  // ------------------ Spawn logic ------------------
  function trimTargetsHard(){
    while(targets.length > 6){
      const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
      if(!oldest) break;
      removeTarget(oldest);
    }
  }

  function spawnPower(){
    if(!powerOn) return null;

    // power pick distribution
    const r = rng();
    let icon = ICON_SOAP, meta={type:'soap'};
    if(r < 0.34){ icon = ICON_SOAP; meta={type:'soap'}; }
    else if(r < 0.68){ icon = ICON_SHLD; meta={type:'shield'}; }
    else { icon = ICON_WATR; meta={type:'water'}; }

    return createTarget('pwr', icon, -2, meta);
  }

  function spawnOne(){
    const s = STEPS[stepIdx];
    const P = effectiveParams();

    // Boss: more hazards/decoys, still keep some good to progress
    if(boss.active){
      const r = rng();
      if(r < Math.min(0.28, P.hazardRate*1.9)){
        return createTarget('haz', ICON_HAZ, -1);
      }else if(r < Math.min(0.28, P.hazardRate*1.9) + Math.min(0.35, P.decoyRate*1.6)){
        let j = stepIdx;
        for(let k=0;k<6;k++){
          const pick = Math.floor(rng()*STEPS.length);
          if(pick !== stepIdx){ j = pick; break; }
        }
        return createTarget('wrong', STEPS[j].icon, j);
      }else{
        // good target during boss counts toward boss hits
        return createTarget('good', s.icon, stepIdx, { boss: true });
      }
    }

    // Normal mode: chance power first (rare)
    if(powerOn){
      const r0 = rng();
      if(r0 < P.powerRate){
        return spawnPower();
      }
    }

    const r = rng();
    if(r < P.hazardRate){
      return createTarget('haz', ICON_HAZ, -1);
    }else if(r < P.hazardRate + P.decoyRate){
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

  // ------------------ Judge / rules ------------------
  function getStepAcc(){
    return totalStepHits ? (correctHits / totalStepHits) : 0;
  }

  function checkFail(){
    if(getMissCount() >= missLimit){
      endGame('fail');
    }
  }

  function applyPower(meta){
    if(!meta || !meta.type) return;

    if(meta.type === 'soap'){
      pwr.soapUntilMs = Math.max(pwr.soapUntilMs, nowMs() + 9000);
      showBanner('🧼 SOAP! เชื้อช้าลง 9 วิ');
    }else if(meta.type === 'shield'){
      pwr.shield = Math.min(3, pwr.shield + 1);
      showBanner(`🛡️ SHIELD! กันเชื้อได้ ${pwr.shield} ครั้ง`);
    }else if(meta.type === 'water'){
      pwr.comboGuard = Math.min(3, pwr.comboGuard + 1);
      showBanner(`💧 FLOW! เซฟคอมโบได้ ${pwr.comboGuard} ครั้ง`);
    }
  }

  function judgeHit(obj, source, extra){
    const rt = computeRt(obj);

    // POWER pickup
    if(obj.kind === 'pwr'){
      applyPower(obj.meta);
      emit('hha:judge', { kind:'pwr', pwr: obj.meta?.type, rtMs: rt, source, extra });
      removeTarget(obj);
      setHud(); updateQuestHUD(); updateAssist();
      return;
    }

    if(obj.kind === 'good'){
      correctHits++;
      totalStepHits++;
      hitsInStep++;
      combo++;
      comboMax = Math.max(comboMax, combo);
      rtOk.push(rt);

      // Boss: count good hits toward boss clear
      if(boss.active){
        boss.hitsDone++;
      }

      coach?.onEvent?.('step_hit', { stepIdx, ok:true, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:true, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'good', stepIdx, rtMs: rt, source, extra, boss: boss.active });

      // mini quest checks
      if(quest.on && quest.q2.type === 'combo12' && comboMax >= quest.q2.goal) passMiniQuest();
      if(quest.on && quest.q2.type === 'streak6' && combo >= quest.q2.goal) passMiniQuest();

      showBanner(`✅ ถูกต้อง! ${STEPS[stepIdx].icon} +1`);

      // step clear
      if(hitsInStep >= STEPS[stepIdx].hitsNeed){
        stepIdx++;
        hitsInStep=0;

        quest.main.doneSteps = stepIdx; // 0..6

        if(stepIdx >= STEPS.length){
          stepIdx=0;
          loopsDone++;
          quest.main.doneSteps = 7;
          quest.main.passed = true;

          // trigger boss by loop (บางครั้ง)
          if(boss.on && !boss.active){
            startBoss();
          }

          pulseQuestPass();
          showBanner(`🏁 ครบ 7 ขั้นตอน! (loops ${loopsDone})`);

          // mini quest re-roll each loop
          if(quest.on) startMiniQuest();
          quest.main.doneSteps = 0;
        }else{
          showBanner(`➡️ ไปขั้นถัดไป: ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        }
      }

      removeTarget(obj);
      setHud(); updateQuestHUD(); updateAssist();
      return;
    }

    if(obj.kind === 'wrong'){
      // combo-guard (water) can save this mistake
      if(powerOn && pwr.comboGuard > 0){
        pwr.comboGuard--;
        // treat as "saved": no miss, no combo break
        emit('hha:judge', { kind:'wrong_saved', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
        showBanner(`💧 เซฟคอมโบ! ยังต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);
        removeTarget(obj);
        setHud(); updateQuestHUD(); updateAssist();
        return;
      }

      wrongStepHits++;
      totalStepHits++;
      combo = 0;

      // safe15 mini quest fail resets timer
      if(quest.on && quest.q2.type === 'safe15' && !quest.q2.passed){
        quest.q2FailedCount++;
        quest.q2.startMs = nowMs();
      }

      coach?.onEvent?.('step_hit', { stepIdx, ok:false, wrongStepIdx: obj.stepIdx, rtMs: rt, stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('step_hit', { ok:false, rtMs: rt, elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'wrong', stepIdx, wrongStepIdx: obj.stepIdx, rtMs: rt, source, extra });
      popXOnElement(obj.el);
      showBanner(`⚠️ ผิดขั้นตอน! ตอนนี้ต้อง ${STEPS[stepIdx].icon} ${STEPS[stepIdx].label}`);

      removeTarget(obj);
      checkFail();
      setHud(); updateQuestHUD(); updateAssist();
      return;
    }

    if(obj.kind === 'haz'){
      // SHIELD rule: block hazard -> NOT count miss
      if(powerOn && pwr.shield > 0){
        pwr.shield--;
        shieldBlocks++;

        emit('hha:block', { kind:'haz', stepIdx, rtMs: rt, source, extra });
        emit('hha:judge', { kind:'haz_blocked', stepIdx, rtMs: rt, source, extra });

        showBanner('🛡️ BLOCK! กันเชื้อได้');
        removeTarget(obj);
        setHud(); updateQuestHUD(); updateAssist();
        return;
      }

      hazHits++;
      combo = 0;

      // safe15 mini quest fail resets timer
      if(quest.on && quest.q2.type === 'safe15' && !quest.q2.passed){
        quest.q2FailedCount++;
        quest.q2.startMs = nowMs();
      }

      coach?.onEvent?.('haz_hit', { stepAcc: getStepAcc(), combo });
      dd?.onEvent?.('haz_hit', { elapsedSec: elapsedSec() });

      emit('hha:judge', { kind:'haz', stepIdx, rtMs: rt, source, extra });
      popXOnElement(obj.el);
      showBanner(`🦠 โดนเชื้อ! ระวัง!`);

      removeTarget(obj);
      checkFail();
      setHud(); updateQuestHUD(); updateAssist();
      return;
    }
  }

  // ------------------ Game loop ------------------
  function tick(){
    if(!running){ return; }
    const t = nowMs();
    const dt = Math.max(0, (t - tLastMs)/1000);
    tLastMs = t;

    if(paused){ requestAnimationFrame(tick); return; }

    // time
    timeLeft -= dt;
    emit('hha:time', { leftSec: timeLeft, elapsedSec: elapsedSec() });

    if(timeLeft <= 0){
      endGame('time');
      return;
    }

    // spawn
    const P = effectiveParams();
    spawnAcc += (P.spawnPerSec * dt);

    while(spawnAcc >= 1){
      spawnAcc -= 1;
      spawnOne();

      // cap targets to prevent clutter
      if(targets.length > (boss.active ? 16 : 18)){
        const oldest = targets.slice().sort((a,b)=>a.bornMs-b.bornMs)[0];
        if(oldest) removeTarget(oldest);
      }
    }

    // Boss update
    updateBoss();

    // safe15 quest auto-pass
    if(quest.on && quest.q2.type === 'safe15' && !quest.q2.passed){
      if(miniElapsedSec() >= quest.q2.goal) passMiniQuest();
    }

    // DD update hook
    dd?.onEvent?.('tick', { elapsedSec: elapsedSec(), misses: getMissCount(), comboMax });

    // HUD
    setHud();
    updateQuestHUD();
    updateAssist();

    requestAnimationFrame(tick);
  }

  // ------------------ Reset / Start / End ------------------
  function resetGame(){
    running=false; paused=false;
    clearTargets();
    timeLeft = timePlannedSec;

    stepIdx=0; hitsInStep=0; loopsDone=0;
    combo=0; comboMax=0;
    wrongStepHits=0; hazHits=0; shieldBlocks=0;
    correctHits=0; totalStepHits=0;
    rtOk.length=0;

    spawnAcc=0;

    // power
    pwr.soapUntilMs = 0;
    pwr.shield = 0;
    pwr.comboGuard = 0;

    // boss
    boss.active = false;
    boss.tStartMs = 0;
    boss.hitsDone = 0;
    boss.bossCount = 0;
    boss.cleared = 0;
    nextBossAtSec = 25;
    setBossBar(0,false);

    // quest
    if(quest.on){
      quest.main.doneSteps = 0;
      quest.main.passed = false;
      quest.q2.type = '';
      quest.q2.passed = false;
      quest.q2PassedCount = 0;
      quest.q2FailedCount = 0;
    }

    setHud();
    updateQuestHUD();
    updateAssist();
  }

  function startGame(){
    resetGame();
    running=true;

    tStartMs = nowMs();
    tLastMs = tStartMs;

    startOverlay.style.display = 'none';
    endOverlay.style.display = 'none';

    ensureAssistUI();

    emit('hha:start', { game:'hygiene', runMode, diff, seed, view, timePlannedSec });

    if(quest.on){
      startMiniQuest();
      quest.main.doneSteps = 0;
      quest.main.passed = false;
    }else{
      updateQuestHUD();
    }

    showBanner(`เริ่ม! ทำ STEP 1/7 ${STEPS[0].icon} ${STEPS[0].label}`);
    setHud();

    requestAnimationFrame(tick);
  }

  function endGame(reason){
    if(!running) return;
    running=false;

    clearTargets();
    setBossBar(0,false);

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

    // grade (simple)
    let grade='C';
    if(stepAcc>=0.90 && hazHits<=1) grade='SSS';
    else if(stepAcc>=0.82 && hazHits<=2) grade='SS';
    else if(stepAcc>=0.75 && hazHits<=3) grade='S';
    else if(stepAcc>=0.68) grade='A';
    else if(stepAcc>=0.58) grade='B';

    const sessionId = `HW-${Date.now()}-${Math.floor(rng()*1e6)}`;

    const summary = {
      version:'1.2.0-prod',
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

      loopsDone,
      stepIdxEnd: stepIdx,

      hitsCorrect: correctHits,
      hitsWrongStep: wrongStepHits,
      hazHits,
      shieldBlocks,

      stepAcc,
      riskIncomplete,
      riskUnsafe,
      comboMax,
      misses: getMissCount(),

      medianStepMs: rtMed,

      // Boss / Power results
      bossOn: boss.on,
      bossCount: boss.bossCount,
      bossCleared: boss.cleared,
      powerOn,
      powerShieldLeft: pwr.shield,
      powerComboGuardLeft: pwr.comboGuard,
      soapActiveEnd: (nowMs() < pwr.soapUntilMs)
    };

    // attach AI extras
    if(coach?.getSummaryExtras) Object.assign(summary, coach.getSummaryExtras());
    if(dd?.getSummaryExtras) Object.assign(summary, dd.getSummaryExtras());

    // Quest fields for HUB check
    summary.goalsTotal = 2;
    summary.goalsCleared = (quest.main.passed ? 1 : 0) + (quest.q2PassedCount > 0 ? 1 : 0);
    summary.miniTotal = 1;
    summary.miniCleared = (quest.q2PassedCount > 0 ? 1 : 0);
    summary.quest = {
      on: quest.on,
      mainPassed: quest.main.passed,
      q2Type: quest.q2.type,
      q2PassedCount: quest.q2PassedCount,
      q2FailedCount: quest.q2FailedCount
    };

    // badges/unlocks
    if(WIN.HHA_Badges){
      WIN.HHA_Badges.evaluateBadges(summary, { allowUnlockInResearch:false });
    }

    // save last + history
    saveJson(LS_LAST, summary);
    const hist = loadJson(LS_HIST, []);
    const arr = Array.isArray(hist) ? hist : [];
    arr.unshift(summary);
    saveJson(LS_HIST, arr.slice(0, 200));

    emit('hha:end', summary);

    endTitle.textContent = (reason==='fail') ? 'จบเกม ❌ (Miss เต็ม)' : 'จบเกม ✅';
    endSub.textContent = `Grade ${grade} • stepAcc ${(stepAcc*100).toFixed(1)}% • haz ${hazHits} • block ${shieldBlocks} • miss ${getMissCount()} • bossClear ${boss.cleared}`;
    endJson.textContent = JSON.stringify(Object.assign({grade}, summary), null, 2);
    endOverlay.style.display = 'grid';
  }

  // ------------------ Bind UI ------------------
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

  // cVR shoot support
  WIN.addEventListener('hha:shoot', onShoot);

  // FX hooks
  WIN.addEventListener('hha:badge', (e)=>{
    const b = (e && e.detail) || {};
    if(WIN.Particles?.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.22, `${b.icon||'🏅'} ${b.title||'Badge!'}`, 'good');
    }
  });
  WIN.addEventListener('hha:unlock', (e)=>{
    const u = (e && e.detail) || {};
    if(WIN.Particles?.popText){
      WIN.Particles.popText(WIN.innerWidth*0.5, WIN.innerHeight*0.28, `${u.icon||'✨'} UNLOCK!`, 'warn');
    }
  });
  WIN.addEventListener('hha:coach', (e)=>{
    const d = (e && e.detail) || {};
    if(d && d.text) showBanner(`🤖 ${d.text}`);
  });

  // init
  ensureAssistUI();
  setHud();
  updateQuestHUD();
  updateAssist();
}
