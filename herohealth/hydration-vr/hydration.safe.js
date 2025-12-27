/* === /herohealth/hydration-vr/hydration.safe.js ===
HydrationVR — SAFE (PRODUCTION) — PATCHED P0+P1
- ✅ Orb targets (BLUE=+water, RED=-water)
- ✅ Guarantee spawn: >=1 BLUE + >=1 RED always (anti-dry-spell)
- ✅ Water gauge stable: NO change from expire in PLAY; drift is regression-to-mean toward 50 only
- ✅ Goal GREEN time counts correctly
- ✅ Storm cinematic: warn pre-roll (tick accel) + thunder + flash + shake
- ✅ Mini: Shield timing (0/2) — long-press to raise shield; must block BAD in end-window with pressure + non-green
- ✅ FX fallback: score pop + burst even if particles.js not ready
- ✅ Summary minis not 0/999; save HHA_LAST_SUMMARY; back-to-hub supported
*/

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const QS = new URLSearchParams(location.search);
const RUN = String(QS.get('run') || QS.get('runMode') || 'play').toLowerCase();  // play | study
const DIFF = String(QS.get('diff') || 'normal').toLowerCase();                 // easy | normal | hard
const DURATION = clampInt(QS.get('time') || QS.get('durationPlannedSec') || 70, 20, 180);
const HUB = String(QS.get('hub') || './hub.html');

const seedBase = String(QS.get('sessionId') || QS.get('ts') || Date.now());
const RNG = mulberry32(hash32(seedBase + '::hydration'));

const $ = (id)=> DOC.getElementById(id);

// ---- DOM refs (must exist) ----
const elPlay = $('playfield');
const elLayer = $('hvr-layer');

const elScore = $('stat-score');
const elCombo = $('stat-combo');
const elComboMax = $('stat-combo-max');
const elMiss = $('stat-miss');
const elTime = $('stat-time');
const elGrade = $('stat-grade');

const elCoach = $('coach-text');
const elCoachSub = $('coach-sub');

const elWaterZone = $('water-zone');
const elWaterPct  = $('water-pct');
const elWaterBar  = $('water-bar');
const elShield    = $('shield-count');
const elStormLeft = $('storm-left');

const q1 = $('quest-line1');
const q2 = $('quest-line2');
const q3 = $('quest-line3');
const q4 = $('quest-line4');

const miniCard = $('mini-card');
const miniStormIn = $('mini-storm-in');
const miniPressurePct = $('mini-pressure-pct');
const miniPressureBar = $('mini-pressure-bar');

const miniCStorm = $('mini-c-storm');
const miniVStorm = $('mini-v-storm');

const miniCZone = $('mini-c-zone');
const miniVZone = $('mini-v-zone');

const miniCPressure = $('mini-c-pressure');
const miniVPressure = $('mini-v-pressure');

const miniCEnd = $('mini-c-end');
const miniVEnd = $('mini-v-end');

const miniCBlock = $('mini-c-block');
const miniVBlock = $('mini-v-block');

const startOverlay = $('start-overlay');
const btnStart = $('btn-start');
const btnVR = $('btn-vr');
const btnStop = $('btn-stop');

const endWrap = $('hvr-end');
const btnRetry = $('btn-retry');
const btnBack = $('btn-back');

const endScore = $('end-score');
const endGrade = $('end-grade');
const endCombo = $('end-combo');
const endMiss  = $('end-miss');
const endGoals = $('end-goals');
const endMinis = $('end-minis');

// ---- Inject orb CSS (so visual is unique + cinematic) ----
injectOrbCSS();

// ---- FX (Particles if present, else fallback) ----
const FX = makeFX();

// ---- Audio (beep/tick/thunder) ----
const SFX = makeSFX();

// ---- Game tuning ----
const TUNE = tuneFor(DIFF, RUN, DURATION);

const state = {
  started: false,
  ended: false,

  tLeft: DURATION,
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  // water balance
  water: 50,          // 0..100
  zone: 'GREEN',      // LOW | GREEN | HIGH
  greenSec: 0,        // goal counter

  // shields
  shield: 0,          // charges
  shielding: false,
  shieldUntil: 0,

  // storm system
  nextStormIn: TUNE.firstStormIn, // seconds
  warnLead: TUNE.warnLead,        // seconds
  stormLeft: 0,                   // seconds remaining in storm
  stormActive: false,
  warnActive: false,
  warnAmp: 0,
  endWindow: false,
  pressure: 0,                    // 0..100

  // mini
  miniNeedBlocks: 2,
  miniBlocks: 0,

  // goals (2 goals total)
  goal1NeedGreenSec: TUNE.goalGreenSec,
  goal1Done: false,
  goal2Done: false, // finish in GREEN + miss constraint

  // spawn
  targets: [],
  spawnCooldown: 0,

  // input
  pointerDownAt: 0,
  longPressFired: false,
  longPressTimer: null,
};

function boot(){
  // buttons
  btnStart?.addEventListener('click', ()=> start(), { passive:true });
  btnVR?.addEventListener('click', ()=> enterVR(), { passive:true });
  btnStop?.addEventListener('click', ()=> stopNow('stopped'), { passive:true });

  btnRetry?.addEventListener('click', ()=> location.reload(), { passive:true });
  btnBack?.addEventListener('click', ()=> { location.href = HUB; }, { passive:true });

  // pointer: tap to shoot, long-press to shield
  bindTapAndHold();

  // initial UI
  setCoach('พร้อมแล้ว! คุมให้อยู่ GREEN นะ 💧', 'แตะ=ยิง • กดค้าง=ยกโล่');
  updateAllUI(0);

  // keep overlay visible until START
  if (startOverlay) startOverlay.style.display = 'flex';
}

function start(){
  if (state.started) return;
  state.started = true;
  if (startOverlay) startOverlay.style.display = 'none';

  // audio unlock
  SFX.unlock();

  // start with a tiny cinematic pop
  FX.stamp('START', 'คุมให้อยู่ GREEN');
  emit('hha:coach', { text: 'เริ่มแล้ว! คุมให้อยู่ GREEN ให้ได้นานที่สุด', sub: 'Storm จะมาเป็นระยะ ๆ — เตรียมยกโล่ช่วงท้ายพายุ' });

  // prime spawns (guarantee)
  ensureFieldGuarantee(true);

  // main loop
  let last = performance.now();
  const tick = (now)=>{
    if (state.ended) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    step(dt, now/1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function step(dt, tNow){
  // time
  state.tLeft -= dt;
  if (state.tLeft <= 0){
    state.tLeft = 0;
    finish('timeup');
    return;
  }

  // water drift (regression-to-mean) — only toward 50; never spike to 100
  applyRegressionToMean(dt);

  // zone update + goal green time
  state.zone = zoneFrom(state.water);
  if (state.zone === 'GREEN') state.greenSec += dt;

  // storm scheduler
  updateStorm(dt, tNow);

  // spawn/update targets
  updateTargets(dt, tNow);

  // check goals
  if (!state.goal1Done && state.greenSec >= state.goal1NeedGreenSec){
    state.goal1Done = true;
    FX.stamp('GOAL 1 ✅', `อยู่ GREEN ครบ ${state.goal1NeedGreenSec|0}s`);
    setCoach('เยี่ยม! Goal 1 ผ่านแล้ว ✅', 'Goal 2: จบเกมต้องอยู่ GREEN + miss ไม่เยอะ');
  }

  // goal2 checks at end (handled in finish)

  // UI
  updateAllUI(dt);
}

function updateStorm(dt, tNow){
  // countdown to next storm when not active
  if (!state.stormActive){
    state.nextStormIn = Math.max(0, state.nextStormIn - dt);

    // warn window
    if (state.nextStormIn > 0 && state.nextStormIn <= state.warnLead){
      if (!state.warnActive){
        state.warnActive = true;
        DOC.body.classList.add('storm-warn');
        setCSS('--warnamp', '0.0');
        state.warnAmp = 0;
        state._nextTickAt = tNow; // for accel ticks
        SFX.beep(520, 0.06);
      }

      // warn amp (0..1)
      state.warnAmp = clamp01(1 - (state.nextStormIn / state.warnLead));
      setCSS('--warnamp', String(state.warnAmp.toFixed(3)));

      // accelerated tick
      if (tNow >= state._nextTickAt){
        SFX.tick();
        const pace = Math.max(0.08, state.nextStormIn / 10); // accel as closer
        state._nextTickAt = tNow + pace;
      }
    } else {
      if (state.warnActive){
        state.warnActive = false;
        DOC.body.classList.remove('storm-warn');
        setCSS('--warnamp', '0');
      }
    }

    // start storm
    if (state.nextStormIn <= 0){
      startStorm();
    }

    // pre-storm UI
    const stormIn = Math.ceil(state.nextStormIn);
    miniStormIn.textContent = String(Math.max(0, stormIn));
  } else {
    // storm running
    state.stormLeft = Math.max(0, state.stormLeft - dt);
    elStormLeft.textContent = String(Math.ceil(state.stormLeft));

    // end-window: last TUNE.endWindowSec seconds
    state.endWindow = (state.stormLeft <= TUNE.endWindowSec);

    // pressure rules:
    // + build when in LOW/HIGH during storm; - decay if GREEN
    if (state.zone === 'GREEN'){
      state.pressure = Math.max(0, state.pressure - (TUNE.pressureDecay * dt));
    } else {
      state.pressure = Math.min(100, state.pressure + (TUNE.pressureGain * dt));
    }

    // cinematic amp
    if (state.endWindow){
      DOC.body.classList.add('fx-shake');
      DOC.body.classList.add('fx-high');
    } else {
      DOC.body.classList.add('fx-low');
    }

    // spawn BAD pressure bolt near end window (threat you must shield)
    if (state.endWindow){
      // ensure at least one "storm-bad" exists
      const hasBolt = state.targets.some(t => t.kind === 'bad' && t.tag === 'stormBolt');
      if (!hasBolt && state.pressure >= TUNE.pressureNeed){
        spawnTarget('bad', { tag:'stormBolt', ttl: TUNE.boltTTL });
      }
    }

    // storm end
    if (state.stormLeft <= 0){
      endStorm();
    }
  }
}

function startStorm(){
  state.stormActive = true;
  state.stormLeft = TUNE.stormDuration;
  state.endWindow = false;
  state.pressure = Math.max(0, state.pressure * 0.25); // reset-ish but keep a bit

  // clear warn
  state.warnActive = false;
  DOC.body.classList.remove('storm-warn');
  setCSS('--warnamp', '0');

  // cinematic start
  DOC.body.classList.add('storm');
  DOC.body.classList.add('fx-shake');
  DOC.body.classList.add('fx-low');

  // thunder + flash
  SFX.thunder();
  FX.flash();

  setCoach('🌪️ Storm มาแล้ว! ตั้งใจ “ออกจาก GREEN” เพื่ออัด Pressure', 'แล้ว “ท้ายพายุ” ค่อยยกโล่บล็อก BAD ให้ถูกจังหวะ');
  emit('hha:coach', { text: 'Storm มาแล้ว!', sub:'ออกจาก GREEN เพื่ออัด Pressure แล้วท้ายพายุยกโล่บล็อก BAD' });

  // next storm schedule
  state.nextStormIn = TUNE.stormGapMin + RNG() * (TUNE.stormGapMax - TUNE.stormGapMin);
}

function endStorm(){
  state.stormActive = false;
  state.endWindow = false;
  state.stormLeft = 0;
  DOC.body.classList.remove('storm');
  DOC.body.classList.remove('fx-shake');
  DOC.body.classList.remove('fx-low');
  DOC.body.classList.remove('fx-high');

  // small stamp
  FX.stamp('Storm ผ่าน!', 'คุมกลับ GREEN');

  setCoach('พายุผ่านแล้ว! กลับไปคุม GREEN ให้เนียน', `Mini เหลือ ${Math.max(0, state.miniNeedBlocks - state.miniBlocks)}/${state.miniNeedBlocks}`);
}

function updateTargets(dt, tNow){
  // shrink shield timer
  if (state.shielding && (tNow >= state.shieldUntil)){
    state.shielding = false;
    DOC.body.classList.remove('shield-on');
  }

  // update target TTL + remove expired
  for (let i = state.targets.length - 1; i >= 0; i--){
    const tar = state.targets[i];
    tar.ttl -= dt;
    if (tar.ttl <= 0){
      // expire: DO NOT change water gauge in PLAY
      if (RUN === 'study'){
        // study: count expire BAD as miss (research strict)
        if (tar.kind === 'bad'){
          state.miss += 1;
          state.combo = 0;
        }
      }
      tar.el?.remove();
      state.targets.splice(i,1);
    }
  }

  // spawn cadence
  state.spawnCooldown -= dt;
  const wantCount = TUNE.maxTargets;
  if (state.spawnCooldown <= 0 && state.targets.length < wantCount){
    // type bias depends on zone (unique hydration identity)
    // if LOW -> more BLUE; if HIGH -> more RED; if GREEN -> balanced
    const bias = (state.zone === 'LOW') ? 0.72 : (state.zone === 'HIGH') ? 0.28 : 0.50;
    const isGood = (RNG() < bias);
    spawnTarget(isGood ? 'good' : 'bad');
    state.spawnCooldown = TUNE.spawnEveryMin + RNG() * (TUNE.spawnEveryMax - TUNE.spawnEveryMin);
  }

  // guarantee at least 1 good and 1 bad always
  ensureFieldGuarantee(false);

  // mild float drift (cheap)
  for (const tar of state.targets){
    if (!tar.el) continue;
    tar.wob += dt;
    const dx = Math.sin(tar.wob * 1.7) * 2.2;
    const dy = Math.cos(tar.wob * 1.3) * 1.6;
    tar.el.style.transform = `translate3d(${dx}px,${dy}px,0)`;
  }
}

function ensureFieldGuarantee(force){
  const hasGood = state.targets.some(t => t.kind === 'good');
  const hasBad  = state.targets.some(t => t.kind === 'bad');
  const needGood = force || (!hasGood);
  const needBad  = force || (!hasBad);

  if (needGood) spawnTarget('good', { ttl: TUNE.ttlGood });
  if (needBad)  spawnTarget('bad',  { ttl: TUNE.ttlBad });
}

function spawnTarget(kind, opts = {}){
  if (!elLayer) return;

  const rect = elPlay.getBoundingClientRect();
  const padX = 56;
  const padY = 46;

  // spawn anywhere but avoid edges and keep from bottom HUD-ish feel
  const x = padX + RNG() * Math.max(1, (rect.width - padX*2));
  const y = padY + RNG() * Math.max(1, (rect.height - padY*2));

  const size = (kind === 'good') ? TUNE.sizeGood : TUNE.sizeBad;
  const ttl = Number(opts.ttl || (kind === 'good' ? TUNE.ttlGood : TUNE.ttlBad)) || 1.5;

  const el = DOC.createElement('div');
  el.className = `orb ${kind}`; // orb.good / orb.bad
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;

  // skull for bad
  if (kind === 'bad'){
    const badge = DOC.createElement('div');
    badge.className = 'orb-badge';
    badge.textContent = '☠️';
    el.appendChild(badge);
  } else {
    const badge = DOC.createElement('div');
    badge.className = 'orb-badge good';
    badge.textContent = '💧';
    el.appendChild(badge);
  }

  elLayer.appendChild(el);

  state.targets.push({
    kind,
    tag: String(opts.tag || ''),
    el,
    x, y, size,
    ttl,
    wob: RNG()*10,
  });
}

function bindTapAndHold(){
  if (!elPlay) return;

  const onDown = (ev)=>{
    if (!state.started || state.ended) return;
    ev.preventDefault?.();

    state.pointerDownAt = performance.now();
    state.longPressFired = false;

    // long press => shield
    clearTimeout(state.longPressTimer);
    state.longPressTimer = setTimeout(()=>{
      state.longPressFired = true;
      raiseShield();
    }, 350);
  };

  const onUp = (ev)=>{
    if (!state.started || state.ended) return;
    ev.preventDefault?.();

    clearTimeout(state.longPressTimer);

    const heldMs = performance.now() - state.pointerDownAt;
    if (state.longPressFired) return; // already shield

    // quick tap => shoot
    if (heldMs < 330){
      shoot();
    }
  };

  elPlay.addEventListener('pointerdown', onDown, { passive:false });
  elPlay.addEventListener('pointerup', onUp, { passive:false });
  elPlay.addEventListener('pointercancel', ()=> clearTimeout(state.longPressTimer), { passive:true });
}

function raiseShield(){
  if (state.shield <= 0){
    setCoach('ยังไม่มีโล่ 😅', 'เก็บโล่ได้จาก “คุม GREEN ต่อเนื่อง”');
    SFX.beep(260, 0.06);
    return;
  }
  if (state.shielding) return;

  state.shielding = true;
  state.shieldUntil = (performance.now()/1000) + TUNE.shieldActiveSec;

  DOC.body.classList.add('shield-on');
  FX.ring();
  SFX.beep(740, 0.06);

  setCoach('🛡️ ยกโล่!', state.stormActive ? 'หา BAD แล้วบล็อก “ท้ายพายุ” ให้ถูกจังหวะ' : 'เก็บไว้ใช้ตอน Storm ช่วงท้ายพายุ');
}

function shoot(){
  // aim at crosshair center
  const rect = elPlay.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top  + rect.height/2;

  // pick nearest target within radius
  let best = null;
  let bestD = Infinity;

  for (const t of state.targets){
    const r = t.el.getBoundingClientRect();
    const tx = r.left + r.width/2;
    const ty = r.top  + r.height/2;
    const d = dist2(cx,cy,tx,ty);

    const hitR = Math.max(18, r.width * 0.48);
    if (d <= hitR*hitR && d < bestD){
      best = t;
      bestD = d;
    }
  }

  if (!best){
    // whiff
    state.combo = 0;
    // small miss feel but not count as miss (optional) — keep it light
    FX.judge('MISS', cx, cy);
    SFX.beep(220, 0.04);
    return;
  }

  // remove target
  best.el?.remove();
  state.targets = state.targets.filter(x => x !== best);

  // resolve hit
  const px = rect.width/2 + (RNG()*12 - 6);
  const py = rect.height/2 + (RNG()*12 - 6);

  if (best.kind === 'good'){
    // water up
    const add = TUNE.waterUp;
    state.water = clamp01_100(state.water + add);

    state.score += TUNE.scoreGood;
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);

    // earn shield by “GREEN stability streak”
    // rule: if currently GREEN and combo hits threshold -> +1 shield (cap)
    if (state.zone === 'GREEN' && (state.combo % TUNE.shieldEveryCombo === 0)){
      state.shield = Math.min(TUNE.shieldCap, state.shield + 1);
      FX.stamp('🛡️ +1', 'ได้โล่แล้ว!');
      SFX.beep(920, 0.05);
    }

    FX.burstGood(px, py);
    FX.scorePop(px, py, `+${TUNE.scoreGood}`);
    SFX.beep(640, 0.04);
  } else {
    // BAD: if shielding => block (consume shield), else penalty
    if (state.shielding && state.shield > 0){
      state.shield -= 1;

      // mini condition: must be storm + end-window + pressure >= need + zone not green
      const okStorm = state.stormActive;
      const okEnd = state.endWindow;
      const okPressure = (state.pressure >= TUNE.pressureNeed);
      const okZone = (state.zone !== 'GREEN');

      if (okStorm && okEnd && okPressure && okZone && state.miniBlocks < state.miniNeedBlocks){
        state.miniBlocks += 1;
        FX.stamp('MINI ✅', `Block ${state.miniBlocks}/${state.miniNeedBlocks}`);
      } else {
        FX.stamp('BLOCK', 'กันได้ แต่ไม่เข้าจังหวะ mini');
      }

      // blocking BAD nudges water slightly toward 50 (identity: stabilize)
      state.water = clamp01_100(state.water + toward50(state.water, TUNE.blockStabilize));

      FX.burstBlock(px, py);
      FX.scorePop(px, py, 'BLOCK');
      SFX.beep(880, 0.05);
    } else {
      // penalty: water down + miss
      const down = TUNE.waterDown;
      state.water = clamp01_100(state.water - down);

      state.miss += 1;
      state.combo = 0;
      state.score = Math.max(0, state.score - TUNE.scoreBad);

      FX.burstBad(px, py);
      FX.judge('BAD!', cx, cy);
      SFX.beep(180, 0.05);
    }
  }

  // refresh after hit: keep guarantee
  ensureFieldGuarantee(false);

  // emit standard events (optional)
  emit('hha:score', packScoreDetail());
  emit('quest:update', packQuestDetail());
}

function applyRegressionToMean(dt){
  // never run before start
  if (!state.started) return;

  // base drift per sec
  let rate = TUNE.driftRate;

  // storm amplifies drift (cinematic pressure)
  if (state.stormActive) rate *= TUNE.stormDriftMul;

  // move toward 50
  const d = (50 - state.water);
  const step = Math.sign(d) * Math.min(Math.abs(d), rate * dt);

  // IMPORTANT: prevent “idle jump”
  if (Math.abs(step) < 0.00001) return;

  state.water = clamp01_100(state.water + step);
}

function updateAllUI(_dt){
  // stats
  if (elScore) elScore.textContent = String(state.score|0);
  if (elCombo) elCombo.textContent = String(state.combo|0);
  if (elComboMax) elComboMax.textContent = String(state.comboMax|0);
  if (elMiss) elMiss.textContent = String(state.miss|0);
  if (elTime) elTime.textContent = String(Math.ceil(state.tLeft));

  // grade (SSS..C)
  const g = gradeFrom(state);
  if (elGrade) elGrade.textContent = g;

  // water UI
  const z = zoneFrom(state.water);
  state.zone = z;

  if (elWaterZone) elWaterZone.textContent = z;
  if (elWaterPct) elWaterPct.textContent = `${Math.round(state.water)}%`;
  if (elWaterBar){
    elWaterBar.style.width = `${Math.round(state.water)}%`;
    elWaterBar.classList.toggle('red', z !== 'GREEN');
  }

  if (elShield) elShield.textContent = String(state.shield|0);

  // storm
  if (!state.stormActive){
    if (elStormLeft) elStormLeft.textContent = '0';
    const inS = Math.max(0, Math.ceil(state.nextStormIn));
    miniStormIn.textContent = String(inS);
  } else {
    miniStormIn.textContent = String(Math.max(0, Math.ceil(state.stormLeft)));
  }

  // quest lines (hydrate identity)
  const greenNeed = state.goal1NeedGreenSec|0;
  const greenNow = Math.floor(state.greenSec);
  const goalsDone = (state.goal1Done ? 1 : 0) + (state.goal2Done ? 1 : 0);

  q1.textContent = `อยู่ GREEN รวม ${greenNow}s / ${greenNeed}s`;
  q2.textContent = `น้ำตอนนี้ ${state.zone} • Score ${state.score} • Combo ${state.combo}`;
  q3.textContent = `Mini (Storm): ใช้ Shield block BAD “ถูกจังหวะ” ${state.miniBlocks}/${state.miniNeedBlocks}`;
  q4.textContent = `Goals done: ${goalsDone}/2 • Progress to S: ${progressToS(state)}%`;

  // mini checklist
  setMiniItem(miniCStorm, miniVStorm, state.stormActive, state.stormActive ? 'YES' : 'NO');
  setMiniItem(miniCZone, miniVZone, (state.stormActive && state.zone !== 'GREEN'), state.zone);
  setMiniItem(miniCPressure, miniVPressure, (state.pressure >= TUNE.pressureNeed), `${Math.round(state.pressure)}% / ${TUNE.pressureNeed}%`);
  setMiniItem(miniCEnd, miniVEnd, (state.stormActive && state.endWindow), state.endWindow ? 'NOW' : '—');
  setMiniItem(miniCBlock, miniVBlock, (state.miniBlocks >= state.miniNeedBlocks), `${state.miniBlocks}/${state.miniNeedBlocks}`);

  if (miniPressurePct) miniPressurePct.textContent = String(Math.round(state.pressure));
  if (miniPressureBar) miniPressureBar.style.width = `${Math.round(state.pressure)}%`;

  // body FX classes
  DOC.body.classList.toggle('fx-shake', !!(state.stormActive && state.endWindow));
  DOC.body.classList.toggle('fx-low', !!(state.stormActive && !state.endWindow));
  DOC.body.classList.toggle('fx-high', !!(state.stormActive && state.endWindow));
}

function finish(reason){
  if (state.ended) return;
  state.ended = true;

  // goal2: end in GREEN + miss <= threshold
  const okEndGreen = (state.zone === 'GREEN');
  const okMiss = (state.miss <= TUNE.goal2MissMax);
  state.goal2Done = (okEndGreen && okMiss);

  // show end
  if (endWrap) endWrap.style.display = 'flex';

  const g = gradeFrom(state);
  if (endScore) endScore.textContent = String(state.score|0);
  if (endGrade) endGrade.textContent = g;
  if (endCombo) endCombo.textContent = String(state.comboMax|0);
  if (endMiss) endMiss.textContent = String(state.miss|0);

  const goalsDone = (state.goal1Done ? 1 : 0) + (state.goal2Done ? 1 : 0);
  if (endGoals) endGoals.textContent = `${goalsDone}/2`;
  if (endMinis) endMinis.textContent = `${Math.min(state.miniBlocks, state.miniNeedBlocks)}/${state.miniNeedBlocks}`;

  setCoach('จบเกมแล้ว! ✅', `เหตุผล: ${reason} • จบใน ${state.zone} • mini ${state.miniBlocks}/${state.miniNeedBlocks}`);

  // save last summary (HHA standard)
  const summary = {
    gameMode: 'hydration',
    runMode: RUN,
    diff: DIFF,
    durationPlannedSec: DURATION,
    durationPlayedSec: DURATION - Math.ceil(state.tLeft),
    scoreFinal: state.score|0,
    comboMax: state.comboMax|0,
    misses: state.miss|0,
    goalsCleared: goalsDone,
    goalsTotal: 2,
    miniCleared: Math.min(state.miniBlocks, state.miniNeedBlocks),
    miniTotal: state.miniNeedBlocks,
    waterEndPct: Math.round(state.water),
    waterEndZone: state.zone,
    greenSec: Math.round(state.greenSec),
    reason: String(reason||'end'),
    timestampIso: new Date().toISOString(),
    hub: HUB,
  };

  try{
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
  }catch(_){}

  emit('hha:end', summary);
}

function stopNow(reason){
  if (!state.started){
    // just go back
    location.href = HUB;
    return;
  }
  finish(reason || 'stop');
}

function enterVR(){
  try{
    const scene = DOC.querySelector('a-scene');
    if (scene && scene.enterVR) scene.enterVR();
  }catch(_){}
  // If no scene, still keep UI
  setCoach('โหมด VR (ถ้ามี) ✅', 'ถ้าไม่ได้ใช้ A-Frame scene ตอนนี้ก็เล่นแบบ mobile ได้เลย');
}

// -------------------- Helpers --------------------
function setCoach(t, sub){
  if (elCoach) elCoach.textContent = String(t ?? '');
  if (elCoachSub) elCoachSub.textContent = String(sub ?? '');
}

function setMiniItem(elRow, elVal, ok, valText){
  if (!elRow || !elVal) return;
  elVal.textContent = String(valText ?? '—');
  elRow.classList.toggle('ok', !!ok);
  elRow.classList.toggle('bad', !ok && (valText === 'NO' || valText === 'GREEN'));
}

function zoneFrom(w){
  if (w < 35) return 'LOW';
  if (w > 65) return 'HIGH';
  return 'GREEN';
}

function gradeFrom(s){
  // score proxy with penalties
  const base = s.score - (s.miss * 6) + (s.comboMax * 1.5) + (Math.round(s.greenSec) * 1.2) + (s.miniBlocks * 12);
  if (base >= 220) return 'SSS';
  if (base >= 170) return 'SS';
  if (base >= 130) return 'S';
  if (base >= 95)  return 'A';
  if (base >= 60)  return 'B';
  return 'C';
}

function progressToS(s){
  // rough bar: 0..100 towards S threshold
  const base = s.score - (s.miss * 6) + (Math.round(s.greenSec) * 1.2) + (s.miniBlocks * 12);
  const pct = Math.round(clamp01(base / 130) * 100);
  return pct;
}

function packScoreDetail(){
  return {
    score: state.score|0,
    combo: state.combo|0,
    comboMax: state.comboMax|0,
    miss: state.miss|0,
    waterPct: Math.round(state.water),
    waterZone: state.zone,
    shield: state.shield|0,
    stormLeft: Math.ceil(state.stormLeft),
    tLeft: Math.ceil(state.tLeft),
    grade: gradeFrom(state),
  };
}

function packQuestDetail(){
  const goalsDone = (state.goal1Done ? 1 : 0) + (state.goal2Done ? 1 : 0);
  return {
    goalLine: q1?.textContent || '',
    progressLine: q2?.textContent || '',
    miniLine: q3?.textContent || '',
    stateLine: q4?.textContent || '',
    goalsDone,
    goalsTotal: 2,
    miniCleared: Math.min(state.miniBlocks, state.miniNeedBlocks),
    miniTotal: state.miniNeedBlocks,
  };
}

function emit(name, detail){
  try{
    ROOT.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(_){}
}

// -------------------- Tuning --------------------
function tuneFor(diff, run, duration){
  const isStudy = (run === 'study');

  const base = {
    maxTargets: (diff === 'hard') ? 4 : (diff === 'easy') ? 2 : 3,
    spawnEveryMin: (diff === 'hard') ? 0.55 : (diff === 'easy') ? 0.85 : 0.70,
    spawnEveryMax: (diff === 'hard') ? 0.90 : (diff === 'easy') ? 1.20 : 1.05,
    sizeGood: (diff === 'hard') ? 78 : (diff === 'easy') ? 98 : 88,
    sizeBad:  (diff === 'hard') ? 82 : (diff === 'easy') ? 102 : 92,
    ttlGood:  (diff === 'hard') ? 2.0 : (diff === 'easy') ? 2.8 : 2.4,
    ttlBad:   (diff === 'hard') ? 2.2 : (diff === 'easy') ? 3.0 : 2.6,

    scoreGood: 10,
    scoreBad:  8,

    waterUp:   (diff === 'hard') ? 10 : (diff === 'easy') ? 13 : 12,
    waterDown: (diff === 'hard') ? 15 : (diff === 'easy') ? 12 : 14,

    driftRate: (diff === 'hard') ? 2.8 : (diff === 'easy') ? 2.2 : 2.5, // per sec toward 50
    stormDriftMul: 1.55,

    shieldCap: 3,
    shieldEveryCombo: (diff === 'hard') ? 6 : (diff === 'easy') ? 4 : 5,
    shieldActiveSec: 1.15,

    firstStormIn: (diff === 'hard') ? 11 : (diff === 'easy') ? 14 : 12,
    warnLead: 3.0,
    stormDuration: (diff === 'hard') ? 7.0 : (diff === 'easy') ? 5.8 : 6.4,
    endWindowSec: 1.25,
    stormGapMin: (diff === 'hard') ? 12 : (diff === 'easy') ? 15 : 13,
    stormGapMax: (diff === 'hard') ? 18 : (diff === 'easy') ? 22 : 20,

    pressureGain: (diff === 'hard') ? 28 : (diff === 'easy') ? 22 : 25,  // per sec
    pressureDecay:(diff === 'hard') ? 34 : (diff === 'easy') ? 28 : 31,  // per sec
    pressureNeed: (diff === 'hard') ? 78 : (diff === 'easy') ? 62 : 70,

    boltTTL: 1.5,
    blockStabilize: 6, // move toward 50 by this step when block

    goalGreenSec: pickGoalGreen(duration, diff),
    goal2MissMax: (diff === 'hard') ? 5 : (diff === 'easy') ? 10 : 7,
  };

  // “Play แต่โหดแบบวิจัย”: play feels intense but penalties are fair
  if (!isStudy){
    // keep intensity but avoid punish from expire already handled
    base.spawnEveryMin *= 0.92;
    base.spawnEveryMax *= 0.92;
    base.driftRate *= 1.05;
  } else {
    // study stricter
    base.goal2MissMax = Math.max(3, base.goal2MissMax - 2);
    base.pressureNeed = Math.min(88, base.pressureNeed + 6);
  }

  return base;
}

function pickGoalGreen(duration, diff){
  // scale with duration, but keep a “feel” target
  const base = (diff === 'hard') ? 18 : (diff === 'easy') ? 12 : 15;
  const scale = clamp01((duration - 40) / 80); // 40..120
  return Math.round(base + (8 * scale));
}

// -------------------- FX --------------------
function makeFX(){
  // prefer particles.js if ready, else fallback DOM
  const Particles =
    (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
    ROOT.Particles ||
    null;

  const layer = DOC.querySelector('.hha-fx-layer') || ensureFxLayer();

  function scorePop(x, y, text){
    if (Particles && typeof Particles.scorePop === 'function'){
      Particles.scorePop(x, y, text);
      return;
    }
    const el = DOC.createElement('div');
    el.className = 'fx-pop';
    el.textContent = text;
    Object.assign(el.style, {
      position:'fixed',
      left: `${x}px`,
      top:  `${y}px`,
      transform:'translate(-50%,-50%)',
      fontWeight:'1100',
      fontSize:'14px',
      pointerEvents:'none',
      zIndex: 999,
      opacity:'1',
      filter:'drop-shadow(0 10px 18px rgba(0,0,0,.55))',
      animation:'fxPop 650ms ease forwards'
    });
    layer.appendChild(el);
    setTimeout(()=> el.remove(), 700);
  }

  function burstAt(x, y, kind){
    if (Particles && typeof Particles.burstAt === 'function'){
      Particles.burstAt(x, y, kind);
      return;
    }
    const el = DOC.createElement('div');
    el.className = 'fx-burst';
    Object.assign(el.style, {
      position:'fixed',
      left:`${x}px`,
      top:`${y}px`,
      width:'10px',
      height:'10px',
      borderRadius:'999px',
      background: (kind === 'bad') ? 'rgba(239,68,68,.9)' : (kind === 'block') ? 'rgba(167,139,250,.95)' : 'rgba(34,211,238,.95)',
      boxShadow:'0 0 26px rgba(34,211,238,.25)',
      transform:'translate(-50%,-50%)',
      pointerEvents:'none',
      zIndex: 999,
      animation:'fxBurst 520ms ease forwards'
    });
    layer.appendChild(el);
    setTimeout(()=> el.remove(), 600);
  }

  function judge(text, x, y){
    scorePop(x, y - 18, text);
  }

  function stamp(big, small){
    const wrap = $('hha-stamp');
    const b = $('stamp-big');
    const s = $('stamp-small');
    if (!wrap || !b || !s) return;
    b.textContent = big;
    s.textContent = small;
    wrap.classList.remove('show');
    void wrap.offsetWidth; // reflow
    wrap.classList.add('show');
  }

  function flash(){
    // simple lightning flash using body filter
    DOC.body.style.transition = 'filter 80ms ease';
    DOC.body.style.filter = 'brightness(1.35) contrast(1.15)';
    setTimeout(()=>{ DOC.body.style.filter = ''; }, 120);
  }

  function ring(){
    // subtle ring at crosshair center
    const r = elPlay.getBoundingClientRect();
    burstAt(r.left + r.width/2, r.top + r.height/2, 'block');
  }

  return {
    scorePop,
    burstGood:(x,y)=> burstAt(x,y,'good'),
    burstBad:(x,y)=> burstAt(x,y,'bad'),
    burstBlock:(x,y)=> burstAt(x,y,'block'),
    judge,
    stamp,
    flash,
    ring,
  };
}

function ensureFxLayer(){
  const el = DOC.createElement('div');
  el.className = 'hha-fx-layer';
  Object.assign(el.style, {
    position:'fixed',
    inset:'0',
    pointerEvents:'none',
    zIndex:'999'
  });
  DOC.body.appendChild(el);

  // inject keyframes once
  if (!DOC.getElementById('fx-kf')){
    const st = DOC.createElement('style');
    st.id = 'fx-kf';
    st.textContent = `
      @keyframes fxPop{
        0%{ transform: translate(-50%,-50%) scale(.95); opacity:0; }
        15%{ opacity:1; }
        100%{ transform: translate(-50%,-86%) scale(1.08); opacity:0; }
      }
      @keyframes fxBurst{
        0%{ transform: translate(-50%,-50%) scale(.8); opacity:.85; }
        100%{ transform: translate(-50%,-50%) scale(5.0); opacity:0; }
      }
    `;
    DOC.head.appendChild(st);
  }

  return el;
}

// -------------------- Audio --------------------
function makeSFX(){
  let ctx = null;
  let unlocked = false;

  function ensure(){
    if (ctx) return ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function unlock(){
    if (unlocked) return;
    const c = ensure();
    if (!c) return;
    // resume on gesture
    if (c.state === 'suspended'){
      c.resume().catch(()=>{});
    }
    unlocked = true;
  }

  function tone(freq, dur){
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended') return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g).connect(c.destination);
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function beep(freq=520, dur=0.05){ tone(freq, dur); }
  function tick(){ tone(980, 0.028); }

  function thunder(){
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended') return;

    // noise burst (simple) + low sine
    const bufferSize = Math.floor(c.sampleRate * 0.35);
    const buf = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<bufferSize;i++){
      const t = i / bufferSize;
      data[i] = (Math.random()*2-1) * (1 - t) * 0.65;
    }
    const noise = c.createBufferSource();
    noise.buffer = buf;

    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 220;

    const g = c.createGain();
    g.gain.value = 0.0001;

    noise.connect(filt).connect(g).connect(c.destination);

    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = 55;
    const g2 = c.createGain();
    g2.gain.value = 0.0001;
    o.connect(g2).connect(c.destination);

    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.40);

    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(0.20, t0 + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);

    noise.start(t0);
    noise.stop(t0 + 0.45);
    o.start(t0);
    o.stop(t0 + 0.60);
  }

  return { unlock, beep, tick, thunder };
}

// -------------------- Visual CSS for Orb --------------------
function injectOrbCSS(){
  if (!DOC || DOC.getElementById('hvr-orb-css')) return;
  const st = DOC.createElement('style');
  st.id = 'hvr-orb-css';
  st.textContent = `
    .orb{
      position:absolute;
      transform: translate3d(0,0,0);
      border-radius: 999px;
      pointer-events:none;
      filter: drop-shadow(0 18px 28px rgba(0,0,0,.55));
      will-change: transform;
    }
    .orb::before{
      content:"";
      position:absolute; inset:0;
      border-radius: 999px;
      opacity:.95;
      background:
        radial-gradient(18px 18px at 28% 30%, rgba(255,255,255,.38) 0%, rgba(255,255,255,0) 60%),
        radial-gradient(40px 36px at 62% 65%, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 70%);
      mix-blend-mode: screen;
      pointer-events:none;
    }
    .orb.good{
      background: radial-gradient(80px 80px at 30% 30%, rgba(56,189,248,.95) 0%, rgba(34,211,238,.88) 38%, rgba(59,130,246,.28) 72%, rgba(2,6,23,0) 100%),
                  radial-gradient(120px 120px at 50% 50%, rgba(34,197,94,.25) 0%, rgba(2,6,23,0) 70%);
      outline: 2px solid rgba(34,211,238,.22);
      box-shadow: inset 0 0 22px rgba(34,211,238,.22), 0 0 40px rgba(34,211,238,.14);
      animation: orbFloat 1.8s ease-in-out infinite;
    }
    .orb.bad{
      background: radial-gradient(80px 80px at 30% 30%, rgba(249,115,22,.95) 0%, rgba(239,68,68,.88) 40%, rgba(239,68,68,.28) 74%, rgba(2,6,23,0) 100%),
                  radial-gradient(120px 120px at 50% 50%, rgba(239,68,68,.24) 0%, rgba(2,6,23,0) 70%);
      outline: 2px solid rgba(239,68,68,.24);
      box-shadow: inset 0 0 22px rgba(239,68,68,.22), 0 0 40px rgba(239,68,68,.12);
      animation: orbFloatBad 1.55s ease-in-out infinite;
    }
    @keyframes orbFloat{
      0%{ transform: translate3d(0,0,0) scale(1); }
      50%{ transform: translate3d(0,-2px,0) scale(1.02); }
      100%{ transform: translate3d(0,0,0) scale(1); }
    }
    @keyframes orbFloatBad{
      0%{ transform: translate3d(0,0,0) scale(1); }
      50%{ transform: translate3d(0,2px,0) scale(1.03); }
      100%{ transform: translate3d(0,0,0) scale(1); }
    }
    .orb-badge{
      position:absolute;
      left:50%; top: 105%;
      transform: translate(-50%, 0);
      font-size: 14px;
      opacity:.95;
      filter: drop-shadow(0 10px 18px rgba(0,0,0,.65));
    }
    .orb-badge.good{ top: 108%; }
    body.shield-on #crosshair{
      box-shadow: 0 0 0 10px rgba(167,139,250,.12), 0 0 30px rgba(167,139,250,.22);
      border-color: rgba(167,139,250,.55);
    }
  `;
  DOC.head.appendChild(st);
}

// -------------------- Math utils --------------------
function clamp01(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }
function clamp01_100(v){ v = Number(v)||0; if (v < 0) return 0; if (v > 100) return 100; return v; }
function clampInt(v, a, b){ const n = Number(v); if (!Number.isFinite(n)) return a; return Math.max(a, Math.min(b, n|0)); }
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx + dy*dy; }
function toward50(w, step){ const d = 50 - w; return Math.sign(d) * Math.min(Math.abs(d), Math.abs(step)); }
function setCSS(k, v){ try{ DOC.documentElement.style.setProperty(k, v); }catch(_){ } }

// -------------------- Seed utils --------------------
function hash32(str){
  str = String(str||'');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- go ----
boot();
