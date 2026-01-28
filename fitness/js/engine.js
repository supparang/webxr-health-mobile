// === /fitness/js/engine.js — Shadow Breaker core (A-16 + A-17) ===
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';
import { WindowLogger } from './window-logger.js';
import { recordSession } from './stats-store.js';

import { PatternDirector } from './pattern-director.js';
import { predictWindow } from './predictor-lite.js';

// ----- DOM refs -----
let wrap;
let viewMenu, viewPlay, viewResult;

let targetLayer;
let feedbackEl;

let feverFill, feverStatus;

let hpYouTop, hpBossTop;
let hpYouBottom, hpBossBottom;

let statTime, statScore, statCombo, statPhase, statMiss, statShield;

let bossNameTop;
let bossEmojiSide, bossNameSide, bossDescSide;
let bossPhaseLabel, bossShieldLabel;

let diffSel, timeSel;

let btnPlay, btnResearch, btnBackFromPlay;
let btnPauseToggle, btnResultRetry, btnResultMenu;

let btnDownloadEvents, btnDownloadSession, btnDownloadWindows;

let resTime, resScore, resMaxCombo, resMissRes, resPhaseRes, resBossCleared, resAcc, resGrade;

// ช่องกรอกโหมดวิจัย (HTML ใหม่ของคุณ)
let inputPartId, inputPartGroup, inputPartNote;

// ----- Boss meta -----
const BOSSES = [
  { id: 0, name: 'Bubble Glove', emoji: '🐣', baseShield: 0, hint: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน' },
  { id: 1, name: 'Spark Guard', emoji: '⚡️', baseShield: 1, hint: 'เล็งให้ไว ระวังลูกระเบิดสีแดง' },
  { id: 2, name: 'Shadow Mitt', emoji: '🕶️', baseShield: 1, hint: 'บางเป้าเป็นเป้าลวง ดูจังหวะแล้วค่อยตี' },
  { id: 3, name: 'Galaxy Punch', emoji: '🌌', baseShield: 2, hint: 'ด่านสุดท้าย เป้าจะเล็กและเร็วมาก' }
];

const DIFF_CONFIG = {
  easy:   { label:'Easy — ผ่อนคลาย',  spawnIntervalMin: 950, spawnIntervalMax:1350, targetLifetime:1500, baseSize:150, bossDamageNormal:0.04,  bossDamageBossFace:0.45 },
  normal: { label:'Normal — สมดุล',    spawnIntervalMin: 800, spawnIntervalMax:1200, targetLifetime:1300, baseSize:125, bossDamageNormal:0.035, bossDamageBossFace:0.40 },
  hard:   { label:'Hard — ท้าทาย',     spawnIntervalMin: 650, spawnIntervalMax:1000, targetLifetime:1150, baseSize:110, bossDamageNormal:0.03,  bossDamageBossFace:0.35 }
};

// FEVER / HP
const FEVER_PER_HIT = 0.18;
const FEVER_DECAY_PER_SEC = 0.10;
const FEVER_DURATION_MS = 6000;

const LOWHP_THRESHOLD = 0.3;
const BOSSFACE_THRESHOLD = 0.28;

// runtime
let renderer = null;
let state = null;
let spawnTimer = null;
let gameLoopId = null;

let menuOpenedAt = performance.now();
let wired = false;

let director = null;

// loggers
const eventLogger = new EventLogger();
const sessionLogger = new SessionLogger();
const windowLogger = new WindowLogger();

// ===== utilities =====
const randRange = (min, max) => min + Math.random() * (max - min);

function pickWeighted(weights) {
  const total = weights.reduce((acc, w) => acc + w.w, 0);
  let r = Math.random() * total;
  for (const item of weights) {
    if (r < item.w) return item.v;
    r -= item.w;
  }
  return weights[weights.length - 1].v;
}
const currentBoss = () => BOSSES[state.bossIndex] || BOSSES[BOSSES.length - 1];

// ===== view / HUD =====
function showView(name) {
  viewMenu?.classList.remove('is-active');
  viewPlay?.classList.remove('is-active');
  viewResult?.classList.remove('is-active');

  if (name === 'menu') viewMenu?.classList.add('is-active');
  else if (name === 'play') viewPlay?.classList.add('is-active');
  else if (name === 'result') viewResult?.classList.add('is-active');

  if (name === 'menu') menuOpenedAt = performance.now();
}

function resetHud() {
  if (statTime) statTime.textContent = '0.0 s';
  if (statScore) statScore.textContent = '0';
  if (statCombo) statCombo.textContent = '0';
  if (statPhase) statPhase.textContent = '1';
  if (statMiss) statMiss.textContent = '0';
  if (statShield) statShield.textContent = '0';

  if (feverStatus) {
    feverStatus.textContent = 'READY';
    feverStatus.classList.remove('on');
  }
  if (feverFill) feverFill.style.transform = 'scaleX(0)';

  hpYouBottom && (hpYouBottom.style.transform = 'scaleX(1)');
  hpBossBottom && (hpBossBottom.style.transform = 'scaleX(1)');
  hpYouTop && (hpYouTop.style.transform = 'scaleX(1)');
  hpBossTop && (hpBossTop.style.transform = 'scaleX(1)');

  if (feedbackEl) {
    feedbackEl.textContent = 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!';
    feedbackEl.className = 'sb-msg-main';
  }

  // A-16 skill chip update
  try{
    const p = document.getElementById('sb-skill-power');
    const pt = document.getElementById('sb-skill-power-txt');
    if (pt) pt.textContent = '0/3';
    if (p) p.classList.remove('on');
  }catch(_){}
}

function setFeedback(msg, tone) {
  if (!feedbackEl) return;
  feedbackEl.textContent = msg;
  feedbackEl.className = 'sb-msg-main';
  if (tone) feedbackEl.classList.add(tone);
}

function updateHpBars() {
  if (!state) return;
  const vPlayer = Math.max(0, Math.min(1, state.playerHp));
  const vBoss = Math.max(0, Math.min(1, state.bossHp));
  hpYouBottom && (hpYouBottom.style.transform = `scaleX(${vPlayer})`);
  hpBossBottom && (hpBossBottom.style.transform = `scaleX(${vBoss})`);
  hpYouTop && (hpYouTop.style.transform = `scaleX(${vPlayer})`);
  hpBossTop && (hpBossTop.style.transform = `scaleX(${vBoss})`);
}

function updateFeverUi(now) {
  if (!state || !feverFill) return;
  const v = Math.max(0, Math.min(1, state.fever));
  feverFill.style.transform = `scaleX(${v})`;

  if (state.feverOn && now >= state.feverUntil) {
    state.feverOn = false;
    if (feverStatus) {
      feverStatus.textContent = 'READY';
      feverStatus.classList.remove('on');
    }
  }
}

function updateBossUi() {
  if (!state) return;
  const boss = currentBoss();

  if (wrap) {
    wrap.dataset.boss = String(boss.id);
    wrap.dataset.phase = String(state.bossPhase);
    wrap.dataset.diff = state.diffKey;
  }

  if (bossEmojiSide) bossEmojiSide.textContent = boss.emoji;
  if (bossNameSide) bossNameSide.textContent = boss.name;
  if (bossDescSide) bossDescSide.textContent = boss.hint;

  if (bossNameTop) bossNameTop.textContent = `${boss.name} ${boss.emoji}`;
  if (bossPhaseLabel) bossPhaseLabel.textContent = String(state.bossPhase);
  if (bossShieldLabel) bossShieldLabel.textContent = String(boss.baseShield);

  if (statPhase) statPhase.textContent = String(state.bossPhase);
}

// ===== renderer helpers =====
function ensureRenderer() {
  if (renderer) return renderer;
  renderer = new DomRendererShadow(targetLayer, {
    wrapEl: wrap,
    feedbackEl,
    onTargetHit: handleTargetHit
  });
  renderer.setDifficulty(state?.diffKey || 'normal');
  return renderer;
}

function clearRenderer() {
  if (renderer) {
    renderer.destroy();
    renderer = null;
  }
}

// ===== spawn targets =====
function spawnBossFaceTarget() {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const bossMeta = currentBoss();
  const now = performance.now();
  const id = state.nextTargetId++;

  const phaseScale =
    state.bossPhase === 1 ? 1.05 :
    state.bossPhase === 2 ? 0.95 : 0.82;

  const data = {
    id,
    type: 'bossface',
    bossIndex: state.bossIndex,
    bossPhase: state.bossPhase,
    spawnTime: now,
    isBossFace: true,
    bossEmoji: bossMeta.emoji,
    sizePx: cfg.baseSize * 1.9 * phaseScale,
    timeoutAt: now + cfg.targetLifetime * 1.5,
    zoneId: undefined
  };

  state.targets.set(id, data);
  ensureRenderer().spawnTarget(data);

  data.timeoutHandle = setTimeout(() => {
    if (!state || !state.running) return;
    if (!state.targets.has(id)) return;
    state.targets.delete(id);
    renderer?.removeTarget(id, 'timeout');

    state.miss++;
    state.missStreak = (state.missStreak || 0) + 1;

    statMiss && (statMiss.textContent = String(state.miss));
    state.combo = 0;
    statCombo && (statCombo.textContent = '0');
    setFeedback('พลาดหน้า boss! รอบหน้าลองโฟกัสให้ทัน 💥', 'miss');
    logEvent('timeout', data, { grade: 'miss' });
  }, cfg.targetLifetime * 1.5);
}

function spawnTargetOfType(kind, extra) {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;
  const now = performance.now();
  const id = state.nextTargetId++;

  let phaseScale = 1;
  if (state.bossPhase === 1) phaseScale = 1.05;
  else if (state.bossPhase === 2) phaseScale = 0.95;
  else phaseScale = 0.82;

  const ttl = cfg.targetLifetime;
  const base = (extra && extra.size) || cfg.baseSize;
  const size = base * phaseScale;

  const data = {
    id,
    type: kind,
    bossIndex: state.bossIndex,
    bossPhase: state.bossPhase,
    spawnTime: now,
    isBossFace: (extra && extra.isBossFace) || false,
    bossEmoji: extra && extra.bossEmoji,
    sizePx: size,
    timeoutAt: now + ttl,
    isDecoy: kind === 'decoy',
    isBomb: kind === 'bomb',
    isHeal: kind === 'heal',
    isShield: kind === 'shield',
    zoneId: extra && extra.zoneId != null ? extra.zoneId : undefined
  };

  state.targets.set(id, data);
  ensureRenderer().spawnTarget(data);

  // A-16: telegraph at phase 3
  if (state.bossPhase >= 3) {
    try{
      const el = renderer?.targets?.get?.(id);
      if (el) el.classList.add('is-tele');
    }catch(_){}
  }

  data.timeoutHandle = setTimeout(() => {
    if (!state || !state.running) return;
    if (!state.targets.has(id)) return;

    state.targets.delete(id);
    renderer?.removeTarget(id, 'timeout');

    const isRealMiss = data.type === 'normal' || data.isBossFace;

    if (isRealMiss) {
      state.miss++;
      state.missStreak = (state.missStreak || 0) + 1;

      // zone live miss
      if (data.zoneId != null){
        const zi = Math.max(0, Math.min(5, data.zoneId|0));
        const Z = state.zoneLive[zi];
        if (Z) Z.miss++;
      }

      statMiss && (statMiss.textContent = String(state.miss));
      state.combo = 0;
      statCombo && (statCombo.textContent = '0');
      setFeedback('พลาดจังหวะ! ลองมองเป้าให้ชัดแล้วลองใหม่ 👀', 'miss');
      logEvent('timeout', data, { grade: 'miss' });
    } else {
      logEvent('timeout', data, { grade: 'skip' });
    }
  }, ttl);
}

function computeZoneWeakLive(){
  let bestId = 0;
  let bestScore = -1;

  for (let i=0;i<state.zoneLive.length;i++){
    const Z = state.zoneLive[i];
    const trials = Z.hits + Z.miss;
    const missRate = trials ? (Z.miss / trials) : 0;
    const avgRt = Z.rtN ? (Z.rtSum / Z.rtN) : 380;
    const rtN = Math.max(0, Math.min(1, avgRt / 900));
    const score = 0.62*missRate + 0.38*rtN;

    if (score > bestScore){
      bestScore = score;
      bestId = i;
    }
  }

  state.zoneWeakId = bestId;
  state.zoneWeakScore = bestScore;
}

function spawnOneTarget() {
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;

  if (!state.bossFaceSpawned && state.bossHp > 0 && state.bossHp <= BOSSFACE_THRESHOLD) {
    state.bossFaceSpawned = true;
    spawnBossFaceTarget();
    return;
  }

  computeZoneWeakLive();

  // base chaos
  const phase = state.bossPhase || 1;
  const bossLow = state.bossHp < 0.35 ? 1 : 0;
  const fever = state.feverOn ? 1 : 0;

  // A-17: use predicted fatigue to "auto-balance" intensity (fun but fair)
  const fatigue = state.ai && state.ai.fatigue_prob != null ? state.ai.fatigue_prob : 0.25;
  const fatigueDamp = Math.max(0.55, 1 - 0.55*fatigue);

  let chaos = Math.max(0, Math.min(1, (0.25*(phase-1) + 0.20*bossLow + 0.18*fever) * fatigueDamp));
  state.chaosLevel = chaos;

  const plan = director
    ? director.nextPlan({
        nowMs: performance.now(),
        bossPhase: state.bossPhase,
        bossIndex: state.bossIndex,
        diffKey: state.diffKey,
        missStreak: state.missStreak,
        avgRtEwma: state.avgRtEwma,
        playerHp: state.playerHp,
        feverOn: state.feverOn,
        zoneWeakId: state.zoneWeakId,
        zoneWeakScore: state.zoneWeakScore,
        chaosLevel: chaos
      })
    : { kind: pickWeighted([
        { v:'normal', w:64 },{ v:'decoy', w:10 },{ v:'bomb', w:8 },{ v:'heal', w:9 },{ v:'shield', w:9 }
      ]), zoneId:null, sizeMul:1.0 };

  const base = cfg.baseSize * (plan.sizeMul || 1.0);
  spawnTargetOfType(plan.kind, { size: base, zoneId: plan.zoneId });
}

function scheduleNextSpawn() {
  if (!state || !state.running) return;
  const cfg = DIFF_CONFIG[state.diffKey] || DIFF_CONFIG.normal;

  // A-17: spawn speed tuned by fatigue (higher fatigue -> slightly slower)
  const fat = state.ai?.fatigue_prob ?? 0.25;
  const slowMul = 1 + 0.22*Math.max(0, fat - 0.55); // only slow when fatigue high
  const delay = randRange(cfg.spawnIntervalMin, cfg.spawnIntervalMax) * slowMul;

  spawnTimer = setTimeout(() => {
    if (!state || !state.running) return;
    spawnOneTarget();
    scheduleNextSpawn();
  }, delay);
}

// ===== hit / miss =====
function applyHitToBoss(amount) {
  state.bossHp = Math.max(0, state.bossHp - amount);

  const prevPhase = state.bossPhase;
  if (state.bossHp > 0.66) state.bossPhase = 1;
  else if (state.bossHp > 0.33) state.bossPhase = 2;
  else state.bossPhase = 3;

  if (state.bossPhase !== prevPhase) updateBossUi();
  updateHpBars();

  if (state.bossHp <= 0) {
    state.clearedBosses++;
    state.bossIndex++;
    if (state.bossIndex >= BOSSES.length) {
      endGame('all-boss-cleared');
    } else {
      state.bossHp = 1;
      state.bossPhase = 1;
      state.bossFaceSpawned = false;
      updateBossUi();
    }
  }
}

function handleTargetHit(id, hitInfo) {
  if (!state || !state.running) return;
  const data = state.targets.get(id);
  if (!data) return;

  state.targets.delete(id);
  if (data.timeoutHandle) clearTimeout(data.timeoutHandle);

  const now = performance.now();
  const rt = now - data.spawnTime;

  // A-16: update avg RT EWMA
  if (data.type === 'normal' || data.isBossFace){
    const a = 0.12;
    state.avgRtEwma = state.avgRtEwma == null ? rt : (a*rt + (1-a)*state.avgRtEwma);
  }

  let grade = 'good';
  let scoreDelta = 100;
  let hpDeltaPlayer = 0;
  let bossDmg = 0;
  let shieldDelta = 0;

  if (data.type === 'bomb' || data.type === 'decoy') {
    // A-16: Bomb Parry (เร็วมาก -> ได้เกราะ + ตีบอสได้เล็กน้อย)
    if (data.type === 'bomb' && rt < 220) {
      grade = 'parry';
      scoreDelta = 90;
      shieldDelta = +1;
      bossDmg = DIFF_CONFIG[state.diffKey].bossDamageNormal * 0.9;
      setFeedback('🛡️ PARRY! ตีระเบิดทันเวลา → ได้เกราะ!', 'perfect');
      state.combo++;
    } else {
      grade = 'bomb';
      scoreDelta = -80;
      if (state.shield > 0) {
        shieldDelta = -1;
        setFeedback('เกราะช่วยไว้! แต่ระวังเป้าลวงให้ดี 👀', 'bad');
      } else {
        hpDeltaPlayer = -0.17;
        setFeedback('โดนระเบิด! HP ลดลง รีบตั้งหลักใหม่ 💥', 'bad');
      }
      state.combo = 0;
    }
  } else if (data.type === 'heal') {
    grade = 'heal';
    scoreDelta = 60;
    hpDeltaPlayer = +0.15;
    setFeedback('เยี่ยม! ได้ HP เพิ่มขึ้น 🩹', 'good');
    state.combo++;
  } else if (data.type === 'shield') {
    grade = 'shield';
    scoreDelta = 60;
    shieldDelta = +1;
    setFeedback('ได้เกราะเพิ่ม ต้านระเบิดได้ชั่วคราว 🛡️', 'good');
    state.combo++;
  } else if (data.isBossFace) {
    grade = 'perfect';
    scoreDelta = 250;
    bossDmg = DIFF_CONFIG[state.diffKey].bossDamageBossFace;
    setFeedback('หมัดเด็ดใส่หน้าบอส! 💥', 'perfect');
    state.combo++;
  } else {
    if (rt < 220) { grade = 'perfect'; scoreDelta = 160; }
    else if (rt < 480) { grade = 'good'; scoreDelta = 120; }
    else { grade = 'bad'; scoreDelta = 60; }

    bossDmg = DIFF_CONFIG[state.diffKey].bossDamageNormal;
    state.combo++;
    setFeedback(
      grade === 'perfect' ? 'สุดยอด! PERFECT 🎯'
      : grade === 'good' ? 'เยี่ยม! จังหวะกำลังดี 👍'
      : 'ช้าไปนิด ลองเร่งอีกนิดนะ 🔄',
      grade
    );
  }

  // A-16: Perfect streak -> Power Punch ready
  if (grade === 'perfect') state.perfectStreak++;
  else if (grade === 'good') state.perfectStreak = Math.max(0, state.perfectStreak - 1);
  else state.perfectStreak = 0;

  if (!state.powerPunchReady && state.perfectStreak >= 3){
    state.powerPunchReady = true;
    state.perfectStreak = 0;
    setFeedback('⚡ POWER PUNCH READY! หมัดถัดไปแรงขึ้น x2 💥', 'perfect');
  }

  // FEVER gauge เฉพาะ normal target
  if (data.type === 'normal') {
    state.fever += FEVER_PER_HIT;
    if (!state.feverOn && state.fever >= 1) {
      state.feverOn = true;
      state.feverUntil = now + FEVER_DURATION_MS;
      state.fever = 1;
      if (feverStatus) {
        feverStatus.textContent = 'ON';
        feverStatus.classList.add('on');
      }
    }
  }

  // fever bonus
  if (state.feverOn) {
    scoreDelta = Math.round(scoreDelta * 1.5);
    bossDmg *= 1.25;
  }

  // A-16: Power Punch boost on next boss-damage hit
  if (state.powerPunchReady && bossDmg > 0){
    scoreDelta = Math.round(scoreDelta * 1.8);
    bossDmg *= 1.55;
    state.powerPunchReady = false;
    setFeedback('💥 POWER PUNCH! โดนหนักมาก!', 'perfect');
  }

  // apply changes
  state.score = Math.max(0, state.score + scoreDelta);
  if (hpDeltaPlayer !== 0) state.playerHp = Math.max(0, Math.min(1, state.playerHp + hpDeltaPlayer));
  if (shieldDelta !== 0) state.shield = Math.max(0, state.shield + shieldDelta);
  if (bossDmg > 0) applyHitToBoss(bossDmg);

  state.totalHits++;
  state.missStreak = 0;

  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  statScore && (statScore.textContent = String(state.score));
  statCombo && (statCombo.textContent = String(state.combo));
  statShield && (statShield.textContent = String(state.shield));

  updateHpBars();
  updateFeverUi(now);

  // A-16 zone live (hits)
  if (data.zoneId != null){
    const zi = Math.max(0, Math.min(5, data.zoneId|0));
    const Z = state.zoneLive[zi];
    if (Z){
      Z.hits++;
      Z.rtSum += rt;
      Z.rtN++;
    }
  }

  if (renderer) {
    renderer.playHitFx(id, {
      grade,
      scoreDelta,
      clientX: hitInfo && hitInfo.clientX,
      clientY: hitInfo && hitInfo.clientY
    });
    renderer.removeTarget(id, 'hit');
  }

  logEvent('hit', data, { grade, rtMs: rt, scoreDelta });

  // update skill chip
  try{
    const p = document.getElementById('sb-skill-power');
    const pt = document.getElementById('sb-skill-power-txt');
    if (pt){
      pt.textContent = state.powerPunchReady ? 'READY' : `${Math.min(3, state.perfectStreak)}/3`;
    }
    if (p){
      p.classList.toggle('on', !!state.powerPunchReady);
    }
  }catch(_){}

  if (state.playerHp <= 0) endGame('player-dead');
}

// ===== logging / loop =====
function logEvent(type, targetData, extra) {
  if (!state) return;
  const now = performance.now();
  const row = {
    ts_ms: Math.round(now - state.startedAt),
    mode: state.mode,
    diff: state.diffKey,
    boss_index: state.bossIndex,
    boss_phase: state.bossPhase,
    target_id: targetData ? targetData.id : '',
    target_type: targetData ? targetData.type : '',
    is_boss_face: targetData ? !!targetData.isBossFace : '',
    zone_id: targetData && targetData.zoneId != null ? targetData.zoneId : '',
    event_type: type,
    rt_ms: extra && extra.rtMs != null ? Math.round(extra.rtMs) : '',
    grade: (extra && extra.grade) || '',
    score_delta: (extra && extra.scoreDelta) || '',
    combo_after: state.combo,
    score_after: state.score,
    player_hp: state.playerHp.toFixed(3),
    boss_hp: state.bossHp.toFixed(3)
  };

  if (state.researchMeta) {
    row.participant_id = state.researchMeta.id;
    row.participant_group = state.researchMeta.group;
    row.participant_note = state.researchMeta.note;
  }

  eventLogger.add(row);

  // for RT stats
  if (type === 'hit' && targetData) {
    if (targetData.type === 'decoy') {
      state.rtDecoySum += extra.rtMs;
      state.rtDecoyCount++;
    } else if (!targetData.isBossFace && targetData.type === 'normal') {
      state.rtNormalSum += extra.rtMs;
      state.rtNormalCount++;
    }
  }
}

function gradeFromAccuracy(acc) {
  if (acc >= 98) return 'SSS';
  if (acc >= 95) return 'SS';
  if (acc >= 90) return 'S';
  if (acc >= 80) return 'A';
  if (acc >= 70) return 'B';
  return 'C';
}

function downloadCsv(filename, csvText) {
  if (!csvText) {
    alert('ยังไม่มีข้อมูลให้ดาวน์โหลด');
    return;
  }
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

// ===== A-17: window feature collector =====
function collectWindowFeatures(){
  // compute hit/miss in last window
  const w = state.win;
  const dt = Math.max(1, (performance.now() - w.startedAtMs) / 1000);

  const trials = w.hits + w.miss;
  const hitRate = trials ? w.hits / trials : 0;
  const missRate = trials ? w.miss / trials : 0;
  const avgRt = w.rtN ? (w.rtSum / w.rtN) : state.avgRtEwma || 420;

  // jitter approx: normalized abs deviation
  const rtJitter = w.rtN ? Math.max(0, Math.min(1, (w.rtAbsDevSum / w.rtN) / 350)) : 0.25;

  const lowHpRatio = w.lowHpMs / (dt*1000);
  const feverRatio = w.feverMs / (dt*1000);

  const bombRate = trials ? w.bombHits / trials : 0;
  const parryRate = w.bombHits ? (w.parryCount / w.bombHits) : 0;

  return {
    hitRate, missRate,
    avgRt, rtJitter,
    lowHpRatio, feverRatio,
    bombRate, parryRate,
    zoneWeakId: state.zoneWeakId
  };
}

function resetWindow(){
  state.win = {
    startedAtMs: performance.now(),
    hits: 0,
    miss: 0,
    bombHits: 0,
    parryCount: 0,
    rtSum: 0,
    rtN: 0,
    rtAbsDevSum: 0,
    lowHpMs: 0,
    feverMs: 0
  };
}

function pushWindowRow(pred, feat){
  const now = performance.now();
  const row = {
    ts_ms: Math.round(now - state.startedAt),
    mode: state.mode,
    diff: state.diffKey,
    boss_index: state.bossIndex,
    boss_phase: state.bossPhase,
    zone_weak_id: state.zoneWeakId,
    hit_rate: +feat.hitRate.toFixed(3),
    miss_rate: +feat.missRate.toFixed(3),
    avg_rt_ms: +feat.avgRt.toFixed(1),
    rt_jitter: +feat.rtJitter.toFixed(3),
    lowhp_ratio: +feat.lowHpRatio.toFixed(3),
    fever_ratio: +feat.feverRatio.toFixed(3),
    bomb_rate: +feat.bombRate.toFixed(3),
    parry_rate: +feat.parryRate.toFixed(3),
    fatigue_prob: +pred.fatigue_prob.toFixed(3),
    flow_score: +pred.flow_score.toFixed(3),
    focus_side: pred.focus_side
  };

  if (state.researchMeta){
    row.participant_id = state.researchMeta.id;
    row.participant_group = state.researchMeta.group;
  }

  windowLogger.add(row);
}

function maybeCoach(pred){
  // rate limit coach to avoid spam
  const now = performance.now();
  if (now < (state.aiNextCoachAt || 0)) return;
  state.aiNextCoachAt = now + 2200;

  // only show when playing (not too frequent)
  if (pred && pred.coach_line){
    setFeedback('🤖 AI Coach: ' + pred.coach_line, 'good');
  }
}

function gameLoop(now) {
  if (!state || !state.running) return;

  const elapsed = now - state.lastTickAt;
  state.lastTickAt = now;
  state.timeLeftMs -= elapsed;

  // fever/lowhp timers
  if (state.fever > 0 && !state.feverOn) {
    state.fever = Math.max(0, state.fever - FEVER_DECAY_PER_SEC * (elapsed / 1000));
  }
  if (state.feverOn) state.feverActiveMs += elapsed;
  if (state.playerHp <= LOWHP_THRESHOLD) state.lowHpMs += elapsed;

  // window timers
  if (state.playerHp <= LOWHP_THRESHOLD) state.win.lowHpMs += elapsed;
  if (state.feverOn) state.win.feverMs += elapsed;

  if (state.timeLeftMs <= 0) {
    statTime && (statTime.textContent = '0.0 s');
    endGame('time-up');
    return;
  }

  statTime && (statTime.textContent = (state.timeLeftMs / 1000).toFixed(1) + ' s');
  updateFeverUi(now);

  // safety timeout check
  const nowTargets = Array.from(state.targets.values());
  for (const t of nowTargets) {
    if (now >= t.timeoutAt) {
      if (t.timeoutHandle) clearTimeout(t.timeoutHandle);
      state.targets.delete(t.id);
      renderer?.removeTarget(t.id, 'timeout');

      const isRealMiss = t.type === 'normal' || t.isBossFace;
      if (isRealMiss) {
        state.miss++;
        state.missStreak = (state.missStreak || 0) + 1;

        // zone live miss
        if (t.zoneId != null){
          const zi = Math.max(0, Math.min(5, t.zoneId|0));
          const Z = state.zoneLive[zi];
          if (Z) Z.miss++;
        }

        statMiss && (statMiss.textContent = String(state.miss));
        state.combo = 0;
        statCombo && (statCombo.textContent = '0');
        logEvent('timeout', t, { grade: 'miss' });

        // window miss
        state.win.miss++;
      } else {
        logEvent('timeout', t, { grade: 'skip' });
      }
    }
  }

  // A-17: window sampling every 2.0s
  if (now >= state.nextWindowAt){
    state.nextWindowAt = now + 2000;

    const feat = collectWindowFeatures();
    const pred = predictWindow(feat);

    state.ai = pred;

    pushWindowRow(pred, feat);
    maybeCoach(pred);

    // reset window
    resetWindow();
  }

  gameLoopId = requestAnimationFrame(gameLoop);
}

// ===== end game =====
function endGame(reason) {
  if (!state || !state.running) return;
  state.running = false;

  spawnTimer && clearTimeout(spawnTimer);
  spawnTimer = null;

  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoopId = null;

  if (renderer) {
    for (const id of state.targets.keys()) {
      renderer.removeTarget(id, 'end');
    }
  }
  state.targets.clear();

  const totalTrials = state.totalHits + state.miss;
  const acc = totalTrials > 0 ? (state.totalHits / totalTrials) * 100 : 0;

  const summary = {
    session_id: Date.now().toString(36),
    build_version: 'shadow-breaker-A17',
    mode: state.mode,
    difficulty: state.diffKey,
    training_phase: state.bossPhase,
    run_index: 0,
    start_ts: state.startedAt,
    end_ts: performance.now(),
    duration_s: state.durationSec,
    end_reason: reason,
    final_score: state.score,
    grade: gradeFromAccuracy(acc),
    total_targets: totalTrials,
    total_hits: state.totalHits,
    total_miss: state.miss,
    accuracy_pct: +acc.toFixed(2),
    max_combo: state.maxCombo,
    avg_rt_normal_ms: state.rtNormalCount ? +(state.rtNormalSum / state.rtNormalCount).toFixed(1) : '',
    avg_rt_decoy_ms: state.rtDecoyCount ? +(state.rtDecoySum / state.rtDecoyCount).toFixed(1) : '',
    fever_total_time_s: +(state.feverActiveMs / 1000).toFixed(2),
    low_hp_time_s: +(state.lowHpMs / 1000).toFixed(2),
    bosses_cleared: state.clearedBosses,
    menu_to_play_ms: Math.round(state.startedAt - menuOpenedAt),
    participant: '',
    group: '',
    note: '',
    env_ua: navigator.userAgent,
    env_viewport_w: window.innerWidth,
    env_viewport_h: window.innerHeight,
    env_input_mode: 'mouse/touch'
  };

  if (state.researchMeta) {
    summary.participant = state.researchMeta.id;
    summary.group = state.researchMeta.group;
    summary.note = state.researchMeta.note;
  }

  sessionLogger.add(summary);

  try {
    recordSession('shadow-breaker', {
      score: summary.final_score,
      accuracy_pct: summary.accuracy_pct,
      grade: summary.grade,
      bosses_cleared: summary.bosses_cleared,
      duration_s: summary.duration_s,
      diff: summary.difficulty,
      ts: Date.now()
    });
  } catch (e) {
    console.warn('ShadowBreaker: cannot save to stats-store', e);
  }

  // result UI
  resTime && (resTime.textContent = summary.duration_s.toFixed(1) + ' s');
  resScore && (resScore.textContent = String(summary.final_score));
  resMaxCombo && (resMaxCombo.textContent = String(summary.max_combo));
  resMissRes && (resMissRes.textContent = String(summary.total_miss));
  resPhaseRes && (resPhaseRes.textContent = String(state.bossPhase));
  resBossCleared && (resBossCleared.textContent = String(summary.bosses_cleared));
  resAcc && (resAcc.textContent = summary.accuracy_pct.toFixed(1) + ' %');
  resGrade && (resGrade.textContent = summary.grade);

  showView('result');
}

// ===== start game =====
function startGame(mode, researchMeta) {
  const diffKey = (diffSel && diffSel.value) || 'normal';
  const durationSec = parseInt((timeSel && timeSel.value) || '60', 10) || 60;
  DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;

  // seed for director
  let seed = Date.now();
  if (mode === 'research' && researchMeta){
    const key = `${researchMeta.id}|${researchMeta.group}|${diffKey}|${durationSec}`;
    let h = 2166136261;
    for (let i=0;i<key.length;i++){
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    seed = h >>> 0;
  }

  director = new PatternDirector(seed);
  director.reset();

  clearRenderer();
  resetHud();

  eventLogger.clear();
  windowLogger.clear();

  state = {
    mode: mode || 'play',
    diffKey,
    durationSec,
    running: true,
    timeLeftMs: durationSec * 1000,
    score: 0,
    combo: 0,
    maxCombo: 0,
    miss: 0,
    shield: 0,
    fever: 0,
    feverOn: false,
    feverUntil: 0,
    feverActiveMs: 0,
    lowHpMs: 0,
    playerHp: 1,
    bossHp: 1,
    bossIndex: 0,
    bossPhase: 1,
    bossFaceSpawned: false,
    clearedBosses: 0,
    totalHits: 0,
    targets: new Map(),
    nextTargetId: 1,
    startedAt: performance.now(),
    lastTickAt: performance.now(),
    researchMeta: researchMeta || null,
    rtNormalSum: 0,
    rtNormalCount: 0,
    rtDecoySum: 0,
    rtDecoyCount: 0,

    // A-16/A-17 extras
    missStreak: 0,
    avgRtEwma: 380,
    zoneLive: Array.from({length:6}, ()=>({hits:0, miss:0, rtSum:0, rtN:0})),
    zoneWeakId: 0,
    zoneWeakScore: 0,
    chaosLevel: 0,
    perfectStreak: 0,
    powerPunchReady: false,
    ai: null,
    aiNextCoachAt: 0,

    // A-17 window
    win: null,
    nextWindowAt: performance.now() + 2000
  };

  resetWindow();

  if (wrap) {
    wrap.dataset.diff = diffKey;
    wrap.dataset.phase = '1';
    wrap.dataset.boss = '0';
  }

  ensureRenderer().setDifficulty(diffKey);

  updateBossUi();
  updateHpBars();
  updateFeverUi(state.startedAt);

  showView('play');

  state.lastTickAt = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);
  scheduleNextSpawn();
}

// ===== public init =====
export function initShadowBreaker() {
  if (!wrap) {
    wrap = document.getElementById('sb-wrap');
    viewMenu = document.getElementById('sb-view-menu');
    viewPlay = document.getElementById('sb-view-play');
    viewResult = document.getElementById('sb-view-result');

    targetLayer = document.getElementById('sb-target-layer');
    feedbackEl = document.getElementById('sb-msg-main');

    feverFill = document.getElementById('sb-fever-bar');
    feverStatus = document.getElementById('sb-label-fever');

    hpYouTop = document.getElementById('sb-hp-you-top');
    hpBossTop = document.getElementById('sb-hp-boss-top');
    hpYouBottom = document.getElementById('sb-hp-you-bottom');
    hpBossBottom = document.getElementById('sb-hp-boss-bottom');

    statTime = document.getElementById('sb-text-time');
    statScore = document.getElementById('sb-text-score');
    statCombo = document.getElementById('sb-text-combo');
    statPhase = document.getElementById('sb-text-phase');
    statMiss = document.getElementById('sb-text-miss');
    statShield = document.getElementById('sb-text-shield');

    bossNameTop = document.getElementById('sb-current-boss-name');
    bossEmojiSide = document.getElementById('sb-meta-emoji');
    bossNameSide = document.getElementById('sb-meta-name');
    bossDescSide = document.getElementById('sb-meta-desc');
    bossPhaseLabel = document.getElementById('sb-boss-phase-label');
    bossShieldLabel = document.getElementById('sb-boss-shield-label');

    diffSel = document.getElementById('sb-diff');
    timeSel = document.getElementById('sb-time');

    btnPlay = document.getElementById('sb-btn-play');
    btnResearch = document.getElementById('sb-btn-research');
    btnBackFromPlay = document.getElementById('sb-btn-back-menu');
    btnPauseToggle = document.getElementById('sb-btn-pause');
    btnResultRetry = document.getElementById('sb-btn-result-retry');
    btnResultMenu = document.getElementById('sb-btn-result-menu');

    btnDownloadEvents = document.getElementById('sb-btn-download-events');
    btnDownloadSession = document.getElementById('sb-btn-download-session');
    btnDownloadWindows = document.getElementById('sb-btn-download-windows');

    resTime = document.getElementById('sb-res-time');
    resScore = document.getElementById('sb-res-score');
    resMaxCombo = document.getElementById('sb-res-max-combo');
    resMissRes = document.getElementById('sb-res-miss');
    resPhaseRes = document.getElementById('sb-res-phase');
    resBossCleared = document.getElementById('sb-res-boss-cleared');
    resAcc = document.getElementById('sb-res-acc');
    resGrade = document.getElementById('sb-res-grade');

    // HTML ของคุณใช้ id เหล่านี้:
    inputPartId = document.getElementById('sb-participant-id');
    inputPartGroup = document.getElementById('sb-participant-group');
    inputPartNote = document.getElementById('sb-participant-note');
  }

  if (!wrap || !targetLayer) {
    console.warn('[ShadowBreaker] Missing core DOM (sb-wrap or sb-target-layer).');
    return;
  }

  if (!wired) {
    wired = true;

    // A-16: inject skillbar
    try{
      const statsCard = document.querySelector('.sb-card-stats');
      if (statsCard && !statsCard.querySelector('.sb-skillbar')){
        const bar = document.createElement('div');
        bar.className = 'sb-skillbar';
        bar.innerHTML = `
          <div id="sb-skill-power" class="sb-skillchip">
            💥 <strong>Power Punch</strong>: <span id="sb-skill-power-txt">0/3</span>
          </div>
          <div id="sb-skill-parry" class="sb-skillchip">
            🛡️ <strong>Parry</strong>: <span id="sb-skill-parry-txt">Hit bomb &lt; 220ms</span>
          </div>
        `;
        statsCard.appendChild(bar);
      }
    }catch(_){}

    btnPlay?.addEventListener('click', () => startGame('play', null));

    btnResearch?.addEventListener('click', () => {
      const pid = inputPartId ? inputPartId.value.trim() : '';
      const group = inputPartGroup ? inputPartGroup.value.trim() : '';
      const note = inputPartNote ? inputPartNote.value.trim() : '';

      if (!pid || !group) {
        alert('กรุณากรอกรหัสผู้เข้าร่วม และกลุ่ม ให้ครบก่อนเข้า "โหมดวิจัย"');
        return;
      }
      startGame('research', { id: pid, group, note });
    });

    btnBackFromPlay?.addEventListener('click', () => {
      if (state && state.running) endGame('stop-early');
      showView('menu');
    });

    btnPauseToggle?.addEventListener('change', (e) => {
      if (e.target.checked && state && state.running) endGame('stop-early');
    });

    btnResultRetry?.addEventListener('click', () => {
      if (state && state.mode === 'research' && state.researchMeta) startGame('research', state.researchMeta);
      else startGame('play', null);
    });

    btnResultMenu?.addEventListener('click', () => showView('menu'));

    btnDownloadEvents?.addEventListener('click', () => {
      downloadCsv('shadow-breaker-events.csv', eventLogger.toCsv());
    });

    btnDownloadSession?.addEventListener('click', () => {
      downloadCsv('shadow-breaker-session.csv', sessionLogger.toCsv());
    });

    btnDownloadWindows?.addEventListener('click', () => {
      downloadCsv('shadow-breaker-windows-model-ready.csv', windowLogger.toCsv());
    });
  }

  resetHud();
  updateBossUi();
  showView('menu');

  console.log('[ShadowBreaker] init complete');
}

// auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShadowBreaker);
} else {
  initShadowBreaker();
}