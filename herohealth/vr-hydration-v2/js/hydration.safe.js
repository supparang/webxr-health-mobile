// === /herohealth/vr-hydration-v2/js/hydration.safe.js ===
// Hydration V2 Main Orchestrator
// PATCH v20260317a-HYDRATION-V2-STARTER-SCAFFOLD
//
// Starter scope in this patch:
// - launcher passthrough
// - run page with 3-lane hydration catch round
// - summary overlay
// - evaluate overlay
// - local summary save
//
// Next patches planned:
// - hydration.create.js
// - hydration.scenarios.js
// - hydration.rewards.js
// - hydration.social.js
// - hydration.research.js

import { openEvaluate } from './hydration.evaluate.js';

const PHASES = {
  INTRO: 'intro',
  RUN: 'run',
  SUMMARY: 'summary',
  EVALUATE: 'evaluate',
  DONE: 'done'
};

const GOOD_POOL = [
  { emoji: '💧', label: 'water', kind: 'good' },
  { emoji: '🚰', label: 'water', kind: 'good' }
];

const BAD_POOL = [
  { emoji: '🥤', label: 'soda', kind: 'bad' },
  { emoji: '🧃', label: 'sweet', kind: 'bad' }
];

const refs = {
  timeValue: document.getElementById('timeValue'),
  scoreValue: document.getElementById('scoreValue'),
  goodValue: document.getElementById('goodValue'),
  badValue: document.getElementById('badValue'),
  modeBadge: document.getElementById('modeBadge'),
  coachLine: document.getElementById('coachLine'),
  teamMini: document.getElementById('teamMini'),
  stageSub: document.getElementById('stageSub'),
  sessionBadge: document.getElementById('sessionBadge'),
  missionList: document.getElementById('missionList'),
  stage: document.getElementById('stage'),
  itemLayer: document.getElementById('itemLayer'),
  teamContributionValue: document.getElementById('teamContributionValue'),
  teamFill: document.getElementById('teamFill'),
  teamNote: document.getElementById('teamNote'),
  toast: document.getElementById('toast'),
  introOverlay: document.getElementById('introOverlay'),
  summaryOverlay: document.getElementById('summaryOverlay'),
  evaluateOverlay: document.getElementById('evaluateOverlay'),
  introTitle: document.getElementById('introTitle'),
  introText: document.getElementById('introText'),
  introModeChip: document.getElementById('introModeChip'),
  introRunChip: document.getElementById('introRunChip'),
  introSeedChip: document.getElementById('introSeedChip'),
  startBtn: document.getElementById('startBtn'),
  backHubBtn: document.getElementById('backHubBtn'),
  laneBtns: [...document.querySelectorAll('.lane-btn')]
};

const ctx = buildCtx();
const rng = mulberry32(ctx.seed);

const state = {
  phase: PHASES.INTRO,
  mode: ctx.mode,
  type: ctx.type,
  run: ctx.run,
  seed: ctx.seed,
  pid: ctx.pid,
  studyId: ctx.studyId,
  hub: ctx.hub,

  durationMs: ctx.mode === 'program' ? 75000 : 45000,
  remainingMs: ctx.mode === 'program' ? 75000 : 45000,

  actionScore: 0,
  knowledgeScore: 0,
  planningScore: 0,
  socialScore: 0,
  totalScore: 0,

  goodCatch: 0,
  badCatch: 0,
  missedGood: 0,

  evaluateChoice: null,
  evaluateCorrect: false,

  classTankContribution: 0,
  teamMissionDone: false,

  combo: 0,
  bestCombo: 0,

  items: [],
  nextItemId: 1,

  lastFeedback: '',
  lastEventLog: []
};

let rafId = 0;
let loopPrevTs = 0;
let nextSpawnAt = 0;
let toastTimer = 0;

boot();

function boot() {
  window.__HYDRATION_V2__ = { ctx, state };

  setupIntro();
  bindUI();
  renderHUD();
  renderTeamBox();
  logEvent('boot', { ctx });
}

function buildCtx() {
  const qs = new URLSearchParams(window.location.search);
  return {
    gameId: qs.get('gameId') || 'hydration',
    mode: normalizeEnum(qs.get('mode'), ['quick', 'program'], 'quick'),
    type: normalizeEnum(qs.get('type'), ['solo', 'team'], 'solo'),
    run: normalizeEnum(qs.get('run'), ['play', 'research'], 'play'),
    pid: qs.get('pid') || '',
    studyId: qs.get('studyId') || '',
    diff: qs.get('diff') || 'normal',
    hub: qs.get('hub') || '../hub.html',
    seed: toSeed(qs.get('seed'))
  };
}

function setupIntro() {
  refs.modeBadge.textContent = ctx.mode === 'program' ? 'PROGRAM MODE' : 'QUICK MODE';
  refs.teamMini.textContent = ctx.type === 'team' ? 'TEAM' : 'SOLO';
  refs.sessionBadge.textContent =
    ctx.run === 'research'
      ? 'Research Scaffold'
      : 'Play Scaffold';

  refs.introTitle.textContent =
    ctx.mode === 'program'
      ? 'เตรียมเริ่ม Program Hydration Run'
      : 'เตรียมเริ่ม Quick Hydration Run';

  refs.introText.textContent =
    ctx.mode === 'program'
      ? 'รอบนี้เป็น program starter scaffold สำหรับ Hydration V2 เริ่มจากรอบหลักก่อน แล้วต่อ Evaluate หลังจบ'
      : 'รอบนี้เป็น quick starter scaffold สำหรับ Hydration V2 เล่นรอบหลักสั้น ๆ แล้วต่อ Evaluate หลังจบ';

  refs.introModeChip.textContent =
    `${ctx.mode === 'program' ? 'Program' : 'Quick'} / ${ctx.type === 'team' ? 'Team' : 'Solo'}`;

  refs.introRunChip.textContent =
    ctx.run === 'research' ? 'Research flow' : 'Play flow';

  refs.introSeedChip.textContent = `seed=${ctx.seed}`;

  refs.stageSub.textContent =
    ctx.mode === 'program'
      ? 'Program starter: เล่นรอบหลักก่อน แล้วใช้ Evaluate เป็น post-game learning'
      : 'Quick starter: เก็บน้ำให้ไว แล้วไปทำ Evaluate ต่อ';

  refs.coachLine.textContent =
    ctx.type === 'team'
      ? 'ช่วยกันเก็บน้ำให้ดี เพื่อเพิ่ม team contribution หลังจบรอบ'
      : 'เก็บน้ำให้ทัน และอย่าแตะเครื่องดื่มหวาน';

  refs.missionList.innerHTML = `
    <li>เก็บ 💧 หรือ 🚰 ให้ได้มากที่สุด</li>
    <li>ปล่อย 🥤 และ 🧃 ให้ผ่านไป</li>
    <li>จบรอบแล้วทำ Evaluate ต่อ</li>
  `;

  showOverlay(refs.introOverlay);
}

function bindUI() {
  refs.startBtn.addEventListener('click', startRound);
  refs.backHubBtn.addEventListener('click', () => {
    window.location.href = ctx.hub;
  });

  refs.laneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const lane = Number(btn.dataset.lane || 0);
      handleLaneTap(lane, btn);
    });
  });

  window.addEventListener('keydown', (ev) => {
    if (state.phase !== PHASES.RUN) return;
    if (ev.key === '1') handleLaneTap(0, refs.laneBtns[0]);
    if (ev.key === '2') handleLaneTap(1, refs.laneBtns[1]);
    if (ev.key === '3') handleLaneTap(2, refs.laneBtns[2]);
  });

  window.addEventListener('beforeunload', () => {
    cancelAnimationFrame(rafId);
  });
}

function startRound() {
  cancelAnimationFrame(rafId);

  state.phase = PHASES.RUN;
  state.actionScore = 0;
  state.knowledgeScore = 0;
  state.planningScore = 0;
  state.socialScore = 0;
  state.totalScore = 0;

  state.goodCatch = 0;
  state.badCatch = 0;
  state.missedGood = 0;
  state.combo = 0;
  state.bestCombo = 0;

  state.evaluateChoice = null;
  state.evaluateCorrect = false;
  state.classTankContribution = 0;
  state.teamMissionDone = false;

  state.items.forEach(removeItemNode);
  state.items = [];
  state.nextItemId = 1;

  state.remainingMs = state.durationMs;
  loopPrevTs = 0;
  nextSpawnAt = 0;

  hideOverlay(refs.introOverlay);
  hideOverlay(refs.summaryOverlay);
  hideOverlay(refs.evaluateOverlay);

  renderHUD();
  renderTeamBox();
  showToast('เริ่มเลย! เก็บน้ำให้ทันนะ');
  logEvent('round_start', snapshotRoundState());

  rafId = requestAnimationFrame(loop);
}

function loop(ts) {
  if (state.phase !== PHASES.RUN) return;

  if (!loopPrevTs) loopPrevTs = ts;
  const dt = ts - loopPrevTs;
  loopPrevTs = ts;

  state.remainingMs = Math.max(0, state.remainingMs - dt);

  if (ts >= nextSpawnAt) {
    spawnItem();
    nextSpawnAt = ts + randomRange(520, 980);
  }

  updateItems(dt);
  renderHUD();
  renderTeamBox();

  if (state.remainingMs <= 0) {
    finishRound();
    return;
  }

  rafId = requestAnimationFrame(loop);
}

function spawnItem() {
  const lane = randomInt(0, 2);
  const roll = rng();
  const base = roll < 0.64 ? pick(GOOD_POOL) : pick(BAD_POOL);

  const item = {
    id: state.nextItemId++,
    lane,
    kind: base.kind,
    emoji: base.emoji,
    label: base.label,
    x: laneToX(lane),
    y: -96,
    speed: randomRange(170, 245),
    active: true,
    node: createItemNode(base)
  };

  refs.itemLayer.appendChild(item.node);
  state.items.push(item);
}

function createItemNode(base) {
  const node = document.createElement('div');
  node.className = `fall-item ${base.kind}`;
  node.innerHTML = `
    <div class="item-emoji">${base.emoji}</div>
    <div class="item-label">${base.label}</div>
  `;
  return node;
}

function updateItems(dt) {
  const stageHeight = refs.stage.clientHeight;

  for (const item of state.items) {
    if (!item.active) continue;

    item.y += item.speed * (dt / 1000);
    item.x = laneToX(item.lane);

    item.node.style.transform = `translate(${item.x}px, ${item.y}px)`;

    if (item.y > stageHeight) {
      item.active = false;
      if (item.kind === 'good') {
        state.missedGood += 1;
        state.combo = 0;
        state.actionScore = Math.max(0, state.actionScore - 2);
        showToast('พลาดน้ำไป 1 ชิ้น');
      }
      removeItemNode(item);
    }
  }

  state.items = state.items.filter(item => item.active);
}

function handleLaneTap(lane, button) {
  if (state.phase !== PHASES.RUN) return;

  pulseLane(button);

  const stageHeight = refs.stage.clientHeight;
  const catchTop = stageHeight - 150;
  const catchBottom = stageHeight - 54;

  const candidates = state.items
    .filter(item =>
      item.active &&
      item.lane === lane &&
      item.y >= catchTop &&
      item.y <= catchBottom
    )
    .sort((a, b) => b.y - a.y);

  if (!candidates.length) {
    showToast('ยังไม่ถึงเส้นรับ');
    return;
  }

  const target = candidates[0];
  target.active = false;
  target.node.classList.add('item-hit');

  window.setTimeout(() => {
    removeItemNode(target);
  }, 180);

  if (target.kind === 'good') {
    state.goodCatch += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    let gained = 10;
    if (state.combo > 0 && state.combo % 4 === 0) gained += 4;

    state.actionScore += gained;
    refs.coachLine.textContent = 'ดีมาก เก็บน้ำถูกแล้ว';
    showToast(`เก็บน้ำสำเร็จ +${gained}`);
    logEvent('good_catch', { lane, gained, combo: state.combo });
  } else {
    state.badCatch += 1;
    state.combo = 0;
    state.actionScore = Math.max(0, state.actionScore - 6);
    refs.coachLine.textContent = 'ระวังนะ อย่าแตะเครื่องดื่มหวาน';
    showToast('แตะหวานผิด -6');
    logEvent('bad_catch', { lane, penalty: 6 });
  }

  renderHUD();
  renderTeamBox();
}

function finishRound() {
  cancelAnimationFrame(rafId);
  state.phase = PHASES.SUMMARY;

  state.items.forEach(removeItemNode);
  state.items = [];

  if (ctx.type === 'team') {
    state.classTankContribution = Math.min(100, Math.round(state.goodCatch * 4));
    state.socialScore = Math.min(20, Math.floor(state.classTankContribution / 5));
    state.teamMissionDone = state.classTankContribution >= 40;
  } else {
    state.classTankContribution = 0;
    state.socialScore = 0;
    state.teamMissionDone = false;
  }

  state.totalScore = computeTotalScore();

  renderHUD();
  renderTeamBox();
  showSummaryOverlay();
  saveSummary('round_end');
  logEvent('round_end', snapshotRoundState());
}

function computeTotalScore() {
  return (
    state.actionScore +
    state.knowledgeScore +
    state.planningScore +
    state.socialScore
  );
}

function showSummaryOverlay() {
  refs.summaryOverlay.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-kicker">Summary • Main Run</div>
      <h2>จบรอบหลักแล้ว</h2>
      <p>
        ตอนนี้เป็นผลของรอบเล่นหลักก่อนเข้าสู่ Evaluate
        เพื่อวัดการเลือกแผนดื่มน้ำหลังเล่น
      </p>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">คะแนนรอบหลัก</div>
          <div class="summary-main">${state.actionScore}</div>
          <div class="summary-sub">คิดจากการเก็บน้ำถูกและเลี่ยงการแตะหวานผิด</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">เก็บน้ำถูก</div>
          <div class="summary-main">${state.goodCatch}</div>
          <div class="summary-sub">ยิ่งเก็บถูกมาก คะแนนยิ่งดี</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">แตะหวานผิด</div>
          <div class="summary-main">${state.badCatch}</div>
          <div class="summary-sub">ควรปล่อยให้ผ่านไป ไม่ควรแตะ</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">พลาดน้ำ</div>
          <div class="summary-main">${state.missedGood}</div>
          <div class="summary-sub">เป็นตัวชี้ว่าควรจับจังหวะให้แม่นขึ้น</div>
        </div>
      </div>

      <div class="result-box">
        ${ctx.type === 'team'
          ? `Contribution ทีมเบื้องต้นของรอบนี้ = <strong>${state.classTankContribution}%</strong>`
          : `โหมดเดี่ยวรอบนี้เน้น action + post-game evaluate ก่อน`}
      </div>

      <div class="overlay-actions">
        <button class="btn ghost" id="summaryReplayBtn" type="button">เล่นรอบนี้ใหม่</button>
        <button class="btn ghost" id="summaryHubBtn" type="button">กลับ HUB</button>
        <button class="btn primary" id="summaryEvaluateBtn" type="button">ไปต่อ Evaluate</button>
      </div>
    </div>
  `;

  showOverlay(refs.summaryOverlay);

  refs.summaryOverlay.querySelector('#summaryReplayBtn')
    .addEventListener('click', startRound);

  refs.summaryOverlay.querySelector('#summaryHubBtn')
    .addEventListener('click', () => {
      window.location.href = ctx.hub;
    });

  refs.summaryOverlay.querySelector('#summaryEvaluateBtn')
    .addEventListener('click', runEvaluateFlow);
}

async function runEvaluateFlow() {
  hideOverlay(refs.summaryOverlay);
  state.phase = PHASES.EVALUATE;

  const result = await openEvaluate(refs.evaluateOverlay, state, {
    title: 'เลือกแผนดื่มน้ำที่ดีที่สุด',
    subtitle: 'หลังเล่นแล้ว ลองเลือกแผนที่ช่วยสร้างนิสัยการดื่มน้ำที่ดี'
  });

  state.evaluateChoice = result.choice;
  state.evaluateCorrect = result.correct;
  state.knowledgeScore += result.knowledgeDelta || 0;
  state.planningScore += result.planningDelta || 0;
  state.totalScore = computeTotalScore();
  state.phase = PHASES.DONE;

  refs.coachLine.textContent =
    result.correct
      ? 'เยี่ยมเลย เลือกแผนดื่มน้ำได้ดี'
      : 'ไม่เป็นไร ลองอ่าน feedback แล้วค่อยทำรอบถัดไป';

  saveSummary('post_evaluate');
  logEvent('evaluate_done', {
    choice: result.choice,
    correct: result.correct,
    knowledgeDelta: result.knowledgeDelta,
    planningDelta: result.planningDelta
  });

  showFinalOverlay(result);
  renderHUD();
}

function showFinalOverlay(result) {
  refs.summaryOverlay.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-kicker">Summary • With Evaluate</div>
      <h2>สรุปหลัง Evaluate</h2>
      <p>
        ตอนนี้คะแนนรวมจะรวมทั้งรอบหลัก และผลการเลือกแผนดื่มน้ำแล้ว
      </p>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Action Score</div>
          <div class="summary-main">${state.actionScore}</div>
          <div class="summary-sub">เก็บน้ำให้ถูก และไม่แตะหวาน</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Knowledge Score</div>
          <div class="summary-main">${state.knowledgeScore}</div>
          <div class="summary-sub">ได้จาก Evaluate หลังจบรอบ</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Planning Score</div>
          <div class="summary-main">${state.planningScore}</div>
          <div class="summary-sub">เริ่มวัดพฤติกรรมการวางแผนดื่มน้ำ</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">คะแนนรวม</div>
          <div class="summary-main">${state.totalScore}</div>
          <div class="summary-sub">starter scaffold: action + evaluate + team bonus</div>
        </div>
      </div>

      <div class="result-box">
        <strong>${escapeHtml(result.feedbackTitle)}</strong><br/>
        ${escapeHtml(result.feedbackText)}<br/><br/>
        คำตอบที่เลือก: <strong>${escapeHtml(result.choice || 'ไม่ได้เลือก')}</strong>
      </div>

      <div class="overlay-actions">
        <button class="btn ghost" id="doneReplayBtn" type="button">เล่นอีกครั้ง</button>
        <button class="btn ghost" id="doneHubBtn" type="button">กลับ HUB</button>
        <button class="btn warn" id="doneCloseBtn" type="button">ปิดผลลัพธ์</button>
      </div>
    </div>
  `;

  showOverlay(refs.summaryOverlay);

  refs.summaryOverlay.querySelector('#doneReplayBtn')
    .addEventListener('click', startRound);

  refs.summaryOverlay.querySelector('#doneHubBtn')
    .addEventListener('click', () => {
      window.location.href = ctx.hub;
    });

  refs.summaryOverlay.querySelector('#doneCloseBtn')
    .addEventListener('click', () => {
      hideOverlay(refs.summaryOverlay);
    });
}

function renderHUD() {
  refs.timeValue.textContent = formatMs(state.remainingMs);
  refs.scoreValue.textContent = String(state.totalScore || state.actionScore);
  refs.goodValue.textContent = String(state.goodCatch);
  refs.badValue.textContent = String(state.badCatch);
}

function renderTeamBox() {
  const percent = Math.max(0, Math.min(100, state.classTankContribution));
  refs.teamContributionValue.textContent = `${percent}%`;
  refs.teamFill.style.width = `${percent}%`;

  if (ctx.type === 'team') {
    refs.teamNote.textContent =
      state.teamMissionDone
        ? 'ภารกิจทีมขั้นต่ำผ่านแล้วใน starter นี้'
        : 'เก็บน้ำเพิ่มเพื่อดัน contribution ให้สูงขึ้น';
  } else {
    refs.teamNote.textContent =
      'ตอนนี้เล่นแบบเดี่ยวอยู่ ระบบ social เต็มรูปแบบจะต่อใน patch ถัดไป';
  }
}

function laneToX(lane) {
  const stageWidth = refs.stage.clientWidth;
  const centers = [
    stageWidth * (1 / 6),
    stageWidth * (3 / 6),
    stageWidth * (5 / 6)
  ];
  return Math.round(centers[lane] - 42);
}

function pulseLane(button) {
  if (!button) return;
  button.classList.add('active');
  window.setTimeout(() => button.classList.remove('active'), 120);
}

function removeItemNode(item) {
  try {
    item?.node?.remove();
  } catch (_) {}
}

function pick(pool) {
  return pool[Math.floor(rng() * pool.length)];
}

function randomInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomRange(min, max) {
  return rng() * (max - min) + min;
}

function showOverlay(el) {
  if (!el) return;
  el.classList.add('show');
}

function hideOverlay(el) {
  if (!el) return;
  el.classList.remove('show');
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    refs.toast.classList.remove('show');
  }, 1100);
}

function formatMs(ms) {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function saveSummary(reason) {
  const payload = {
    reason,
    gameId: ctx.gameId,
    mode: ctx.mode,
    type: ctx.type,
    run: ctx.run,
    pid: ctx.pid,
    studyId: ctx.studyId,
    seed: ctx.seed,
    savedAt: new Date().toISOString(),

    actionScore: state.actionScore,
    knowledgeScore: state.knowledgeScore,
    planningScore: state.planningScore,
    socialScore: state.socialScore,
    totalScore: state.totalScore,

    goodCatch: state.goodCatch,
    badCatch: state.badCatch,
    missedGood: state.missedGood,
    bestCombo: state.bestCombo,

    evaluateChoice: state.evaluateChoice,
    evaluateCorrect: state.evaluateCorrect,
    classTankContribution: state.classTankContribution,
    teamMissionDone: state.teamMissionDone
  };

  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));

    const history = JSON.parse(localStorage.getItem('HHA_SUMMARY_HISTORY') || '[]');
    history.unshift(payload);
    if (history.length > 20) history.length = 20;
    localStorage.setItem('HHA_SUMMARY_HISTORY', JSON.stringify(history));
  } catch (err) {
    console.warn('[HydrationV2] localStorage save failed', err);
  }
}

function snapshotRoundState() {
  return {
    phase: state.phase,
    mode: state.mode,
    type: state.type,
    run: state.run,
    actionScore: state.actionScore,
    knowledgeScore: state.knowledgeScore,
    planningScore: state.planningScore,
    socialScore: state.socialScore,
    totalScore: state.totalScore,
    goodCatch: state.goodCatch,
    badCatch: state.badCatch,
    missedGood: state.missedGood,
    bestCombo: state.bestCombo,
    evaluateChoice: state.evaluateChoice,
    evaluateCorrect: state.evaluateCorrect,
    classTankContribution: state.classTankContribution,
    teamMissionDone: state.teamMissionDone
  };
}

function logEvent(name, payload = {}) {
  const event = {
    name,
    ts: Date.now(),
    payload
  };
  state.lastEventLog.push(event);
  if (state.lastEventLog.length > 40) state.lastEventLog.shift();
  console.debug('[HydrationV2]', name, payload);
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function toSeed(value) {
  const n = Number(value);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return Date.now();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}