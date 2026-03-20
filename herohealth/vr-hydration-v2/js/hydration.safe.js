// === /herohealth/vr-hydration-v2/js/hydration.safe.js ===
// Hydration V2 Main Orchestrator
// PATCH v20260318a-HYDRATION-V2-PATCH-C-NEXT-SESSION-FIX-HUB-TEAM
//
// Flow:
// Intro -> Main Run -> Summary -> Scenarios -> Evaluate -> Create -> Final Summary

import { openEvaluate } from './hydration.evaluate.js';
import { openScenarios } from './hydration.scenarios.js';
import { maybeCreateReward, showRewardPopup } from './hydration.rewards.js';
import { openCreate } from './hydration.create.js';
import { computeSocialProgress, buildSocialSummary } from './hydration.social.js';
import {
  initResearchContext,
  describeResearchBadge,
  buildResearchPayload,
  persistResearchPayload,
  markResearchSessionComplete,
  buildResearchProgressText
} from './hydration.research.js';

const PHASES = {
  INTRO: 'intro',
  RUN: 'run',
  SUMMARY: 'summary',
  SCENARIOS: 'scenarios',
  EVALUATE: 'evaluate',
  CREATE: 'create',
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
  boostStatus: document.getElementById('boostStatus'),
  shieldStatus: document.getElementById('shieldStatus'),
  rewardCountStatus: document.getElementById('rewardCountStatus'),
  toast: document.getElementById('toast'),
  rewardPopup: document.getElementById('rewardPopup'),
  introOverlay: document.getElementById('introOverlay'),
  summaryOverlay: document.getElementById('summaryOverlay'),
  scenarioOverlay: document.getElementById('scenarioOverlay'),
  evaluateOverlay: document.getElementById('evaluateOverlay'),
  createOverlay: document.getElementById('createOverlay'),
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
const researchCtx = initResearchContext(ctx);
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

  sessionNo: researchCtx.sessionNo,
  weekNo: researchCtx.weekNo,
  nextSessionNo: researchCtx.sessionNo,
  nextWeekNo: researchCtx.weekNo,

  durationMs: ctx.mode === 'program' ? 75000 : 45000,
  remainingMs: ctx.mode === 'program' ? 75000 : 45000,
  clockMs: 0,

  actionScore: 0,
  knowledgeScore: 0,
  planningScore: 0,
  socialScore: 0,
  totalScore: 0,

  goodCatch: 0,
  badCatch: 0,
  missedGood: 0,
  correctChoices: 0,
  wrongChoices: 0,

  evaluateChoice: null,
  evaluateCorrect: false,
  createdPlan: {},
  createdPlanScore: 0,

  classTankContribution: 0,
  teamMissionDone: false,
  socialMissionLabel: 'Solo Mode',
  socialMissionNote: 'โหมดนี้ยังไม่คิดภารกิจทีม',
  teamStars: 0,
  socialSummary: '',

  combo: 0,
  bestCombo: 0,

  rewardCount: 0,
  rewardHistory: [],
  shieldCount: 0,
  pointBoostUntil: 0,

  scenarioSummary: '',
  createFeedbackTitle: '',
  createFeedbackText: '',
  researchSavedAt: '',

  items: [],
  nextItemId: 1,

  lastEventLog: []
};

let rafId = 0;
let loopPrevTs = 0;
let nextSpawnAt = 0;
let toastTimer = 0;

boot();

function boot() {
  window.__HYDRATION_V2__ = { ctx, state, researchCtx };

  setupIntro();
  bindUI();
  recomputeSocial();
  renderHUD();
  renderTeamBox();
  renderStatusRibbon();
  logEvent('boot', { ctx, researchCtx });
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
    hub: resolveHubUrl(qs.get('hub') || '/herohealth/hub.html'),
    seed: toSeed(qs.get('seed'))
  };
}

function resolveHubUrl(rawHub) {
  const fallback = '/herohealth/hub.html';
  const raw = String(rawHub || '').trim() || fallback;

  try {
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return new URL(raw, window.location.origin).toString();

    if (raw === './hub.html' || raw === 'hub.html') {
      return new URL(fallback, window.location.origin).toString();
    }

    if (raw === '../hub.html') {
      return new URL('/herohealth/hub.html', window.location.origin).toString();
    }

    return new URL(raw, window.location.href).toString();
  } catch (_) {
    try {
      return new URL(fallback, window.location.origin).toString();
    } catch (_) {
      return fallback;
    }
  }
}

function setupIntro() {
  refs.modeBadge.textContent = ctx.mode === 'program' ? 'PROGRAM MODE' : 'QUICK MODE';
  refs.teamMini.textContent = ctx.type === 'team' ? 'TEAM' : 'SOLO';
  refs.sessionBadge.textContent = describeResearchBadge(researchCtx, ctx);

  refs.introTitle.textContent =
    ctx.mode === 'program'
      ? 'เตรียมเริ่ม Program Hydration Run'
      : 'เตรียมเริ่ม Quick Hydration Run';

  refs.introText.textContent =
    ctx.mode === 'program'
      ? 'รอบนี้เป็น program scaffold ที่มี Summary → Scenarios → Evaluate → Create และมี session/week สำหรับงานวิจัย'
      : 'รอบนี้เป็น quick scaffold ที่มี Summary → Scenarios → Evaluate → Create และเก็บ progress แบบ starter';

  refs.introModeChip.textContent =
    `${ctx.mode === 'program' ? 'Program' : 'Quick'} / ${ctx.type === 'team' ? 'Team' : 'Solo'}`;

  refs.introRunChip.textContent =
    `${ctx.run === 'research' ? 'Research flow' : 'Play flow'} • W${researchCtx.weekNo} S${researchCtx.sessionNo}`;

  refs.introSeedChip.textContent = `seed=${ctx.seed}`;

  refs.stageSub.textContent =
    ctx.mode === 'program'
      ? 'Program starter: รัน action ก่อน แล้วต่อ learning flow + research progress'
      : 'Quick starter: เล่น action สั้น ๆ แล้วต่อ learning flow หลังเล่น';

  refs.coachLine.textContent =
    ctx.type === 'team'
      ? 'ช่วยกันเก็บน้ำ ตอบสถานการณ์ และวางแผน เพื่อดันภารกิจทีม'
      : 'เก็บน้ำให้ทัน และอย่าแตะเครื่องดื่มหวาน';

  refs.missionList.innerHTML = `
    <li>เก็บ 💧 หรือ 🚰 ให้ได้มากที่สุด</li>
    <li>ปล่อย 🥤 และ 🧃 ให้ผ่านไป</li>
    <li>จบรอบแล้วทำ Scenarios + Evaluate + Create</li>
    <li>${ctx.type === 'team' ? 'ช่วยทีมผ่าน Team Hydration Goal' : 'รอบนี้เล่นแบบเดี่ยว'}</li>
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
  state.clockMs = 0;
  state.actionScore = 0;
  state.knowledgeScore = 0;
  state.planningScore = 0;
  state.socialScore = 0;
  state.totalScore = 0;

  state.goodCatch = 0;
  state.badCatch = 0;
  state.missedGood = 0;
  state.correctChoices = 0;
  state.wrongChoices = 0;

  state.combo = 0;
  state.bestCombo = 0;

  state.evaluateChoice = null;
  state.evaluateCorrect = false;

  state.createdPlan = {};
  state.createdPlanScore = 0;
  state.createFeedbackTitle = '';
  state.createFeedbackText = '';
  state.scenarioSummary = '';

  state.classTankContribution = 0;
  state.teamMissionDone = false;
  state.socialMissionLabel = 'Solo Mode';
  state.socialMissionNote = 'โหมดนี้ยังไม่คิดภารกิจทีม';
  state.teamStars = 0;
  state.socialSummary = '';

  state.rewardCount = 0;
  state.rewardHistory = [];
  state.shieldCount = 0;
  state.pointBoostUntil = 0;
  state.researchSavedAt = '';

  state.items.forEach(removeItemNode);
  state.items = [];
  state.nextItemId = 1;

  state.remainingMs = state.durationMs;
  loopPrevTs = 0;
  nextSpawnAt = 0;

  hideOverlay(refs.introOverlay);
  hideOverlay(refs.summaryOverlay);
  hideOverlay(refs.scenarioOverlay);
  hideOverlay(refs.evaluateOverlay);
  hideOverlay(refs.createOverlay);

  recomputeSocial();
  renderHUD();
  renderTeamBox();
  renderStatusRibbon();
  showToast('เริ่มเลย! เก็บน้ำให้ทันนะ');
  logEvent('round_start', snapshotRoundState());

  rafId = requestAnimationFrame(loop);
}

function loop(ts) {
  if (state.phase !== PHASES.RUN) return;

  if (!loopPrevTs) loopPrevTs = ts;
  const dt = ts - loopPrevTs;
  loopPrevTs = ts;

  state.clockMs += dt;
  state.remainingMs = Math.max(0, state.remainingMs - dt);

  if (ts >= nextSpawnAt) {
    spawnItem();
    nextSpawnAt = ts + randomRange(520, 980);
  }

  updateItems(dt);
  renderHUD();
  renderTeamBox();
  renderStatusRibbon();

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
    if (state.clockMs < state.pointBoostUntil) gained *= 2;

    state.actionScore += gained;
    refs.coachLine.textContent = 'ดีมาก เก็บน้ำถูกแล้ว';
    showToast(`เก็บน้ำสำเร็จ +${gained}`);
    logEvent('good_catch', { lane, gained, combo: state.combo });

    maybeTriggerReward();
  } else {
    if (state.shieldCount > 0) {
      state.shieldCount -= 1;
      refs.coachLine.textContent = 'Shield ป้องกันการแตะหวานผิดให้แล้ว';
      showToast('Shield ช่วยไว้แล้ว');
      logEvent('bad_catch_blocked', { lane, shieldLeft: state.shieldCount });
    } else {
      state.badCatch += 1;
      state.combo = 0;
      state.actionScore = Math.max(0, state.actionScore - 6);
      refs.coachLine.textContent = 'ระวังนะ อย่าแตะเครื่องดื่มหวาน';
      showToast('แตะหวานผิด -6');
      logEvent('bad_catch', { lane, penalty: 6 });
    }
  }

  recomputeSocial();
  renderHUD();
  renderTeamBox();
  renderStatusRibbon();
}

function maybeTriggerReward() {
  let trigger = null;
  if (state.combo > 0 && state.combo % 4 === 0) trigger = 'combo';
  else if (state.goodCatch > 0 && state.goodCatch % 5 === 0) trigger = 'streak';

  if (!trigger) return;

  const reward = maybeCreateReward({
    state,
    trigger,
    randomFn: rng
  });

  if (!reward) return;

  applyReward(reward);
  showRewardPopup(refs.rewardPopup, reward);
  logEvent('reward', reward);
}

function applyReward(reward) {
  state.rewardCount += 1;
  state.rewardHistory.push(reward.id);

  if (reward.type === 'time_bonus') {
    state.remainingMs += reward.ms || 0;
  } else if (reward.type === 'point_boost') {
    state.pointBoostUntil = Math.max(state.pointBoostUntil, state.clockMs + (reward.ms || 0));
  } else if (reward.type === 'shield') {
    state.shieldCount += reward.count || 1;
  } else if (reward.type === 'smart_bonus') {
    state.actionScore += reward.points || 0;
  }

  refs.coachLine.textContent = reward.title;
  recomputeSocial();
  renderStatusRibbon();
  renderHUD();
}

function finishRound() {
  cancelAnimationFrame(rafId);
  state.phase = PHASES.SUMMARY;

  state.items.forEach(removeItemNode);
  state.items = [];

  recomputeSocial();
  state.totalScore = computeTotalScore();

  renderHUD();
  renderTeamBox();
  renderStatusRibbon();
  showMainSummaryOverlay();
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

function recomputeSocial() {
  const social = computeSocialProgress({
    type: ctx.type,
    goodCatch: state.goodCatch,
    badCatch: state.badCatch,
    correctChoices: state.correctChoices,
    createdPlanScore: state.createdPlanScore,
    rewardCount: state.rewardCount,
    bestCombo: state.bestCombo
  });

  state.classTankContribution = social.contributionPercent;
  state.socialScore = social.socialScore;
  state.teamMissionDone = social.missionDone;
  state.socialMissionLabel = social.missionLabel;
  state.socialMissionNote = social.missionNote;
  state.teamStars = social.teamStars;
  state.socialSummary = buildSocialSummary(social);

  return social;
}

function showMainSummaryOverlay() {
  const teamBlock = ctx.type === 'team'
    ? `
      <div class="result-box">
        <strong>Team Progress</strong><br/>
        contribution ${state.classTankContribution}% • stars ${state.teamStars}<br/>
        mission: ${state.teamMissionDone ? 'ผ่านแล้ว' : 'ยังไม่ผ่าน'}<br/>
        ${escapeHtml(state.socialMissionLabel)}<br/>
        ${escapeHtml(state.socialMissionNote)}
      </div>
    `
    : `
      <div class="result-box">
        <strong>${escapeHtml(state.socialMissionLabel)}</strong><br/>
        ${escapeHtml(state.socialMissionNote)}<br/><br/>
        ${escapeHtml(state.socialSummary)}
      </div>
    `;

  refs.summaryOverlay.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-kicker">Summary • Main Run</div>
      <h2>จบรอบหลักแล้ว</h2>
      <p>
        ตอนนี้เป็นผลของรอบเล่นหลักก่อนเข้าสู่ post-game learning
        ได้แก่ Scenarios → Evaluate → Create
      </p>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">คะแนนรอบหลัก</div>
          <div class="summary-main">${state.actionScore}</div>
          <div class="summary-sub">คิดจากการเก็บน้ำถูก เลี่ยงหวาน และ reward ที่ได้รับ</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">เก็บน้ำถูก</div>
          <div class="summary-main">${state.goodCatch}</div>
          <div class="summary-sub">ยิ่งเก็บถูกมาก คะแนนยิ่งดี</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">แตะหวานผิด</div>
          <div class="summary-main">${state.badCatch}</div>
          <div class="summary-sub">ถ้ามี Shield จะไม่โดนลบนับผิด</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Rewards ที่ได้</div>
          <div class="summary-main">${state.rewardCount}</div>
          <div class="summary-sub">${escapeHtml(state.rewardHistory.join(', ') || 'ยังไม่ได้ reward')}</div>
        </div>
      </div>

      ${teamBlock}

      <div class="overlay-actions">
        <button class="btn ghost" id="summaryReplayBtn" type="button">เล่นรอบนี้ใหม่</button>
        <button class="btn ghost" id="summaryHubBtn" type="button">กลับ HUB</button>
        <button class="btn primary" id="summaryNextBtn" type="button">ไปต่อ Scenarios</button>
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

  refs.summaryOverlay.querySelector('#summaryNextBtn')
    .addEventListener('click', runPostGameLearningFlow);
}

async function runPostGameLearningFlow() {
  hideOverlay(refs.summaryOverlay);

  state.phase = PHASES.SCENARIOS;
  const scenarioResult = await openScenarios(refs.scenarioOverlay, state, {
    count: 2,
    randomFn: rng
  });

  state.correctChoices = scenarioResult.correctCount || 0;
  state.wrongChoices = scenarioResult.wrongCount || 0;
  state.knowledgeScore += scenarioResult.knowledgeDelta || 0;
  state.scenarioSummary = scenarioResult.summary || '';
  recomputeSocial();
  state.totalScore = computeTotalScore();

  logEvent('scenarios_done', scenarioResult);

  state.phase = PHASES.EVALUATE;
  const evalResult = await openEvaluate(refs.evaluateOverlay, state, {
    title: 'เลือกแผนดื่มน้ำที่ดีที่สุด',
    subtitle: 'หลังเล่นแล้ว ลองเลือกแผนที่ช่วยสร้างนิสัยการดื่มน้ำที่ดี'
  });

  state.evaluateChoice = evalResult.choice;
  state.evaluateCorrect = evalResult.correct;
  state.knowledgeScore += evalResult.knowledgeDelta || 0;
  state.planningScore += evalResult.planningDelta || 0;
  recomputeSocial();
  state.totalScore = computeTotalScore();

  logEvent('evaluate_done', {
    choice: evalResult.choice,
    correct: evalResult.correct,
    knowledgeDelta: evalResult.knowledgeDelta,
    planningDelta: evalResult.planningDelta
  });

  state.phase = PHASES.CREATE;
  const createResult = await openCreate(refs.createOverlay, state);

  state.createdPlan = createResult.plan || {};
  state.createdPlanScore = createResult.planScore || 0;
  state.planningScore += createResult.planScore || 0;
  state.createFeedbackTitle = createResult.feedbackTitle || '';
  state.createFeedbackText = createResult.feedbackText || '';
  recomputeSocial();
  state.totalScore = computeTotalScore();

  logEvent('create_done', createResult);

  state.phase = PHASES.DONE;
  refs.coachLine.textContent =
    state.evaluateCorrect
      ? 'เยี่ยมเลย เลือกแผนได้ดีและต่อยอดถึงการสร้างแผนของตัวเองแล้ว'
      : 'ทำได้ดีมาก รอบนี้ได้ลองคิดทั้งสถานการณ์จริงและแผนดื่มน้ำแล้ว';

  const researchPayload = buildResearchPayload({
    ctx,
    state,
    researchCtx,
    socialSummary: state.socialSummary
  });

  persistResearchPayload(researchPayload, researchCtx);
  state.researchSavedAt = researchPayload.savedAt;

  const nextProgress = markResearchSessionComplete(researchCtx);
  state.nextSessionNo = nextProgress.nextSessionNo;
  state.nextWeekNo = nextProgress.nextWeekNo;

  saveSummary('post_learning');
  showFinalOverlay(evalResult, createResult, researchPayload);
  renderHUD();
  renderTeamBox();
  renderStatusRibbon();
}

function showFinalOverlay(evalResult, createResult, researchPayload) {
  const researchLabel = researchCtx.isResearchTrack ? 'Research' : 'Starter';
  const researchLine = buildResearchProgressText(researchCtx, {
    nextSessionNo: state.nextSessionNo,
    nextWeekNo: state.nextWeekNo
  });

  const teamDetail = ctx.type === 'team'
    ? `
      <strong>Team Check:</strong> contribution ${state.classTankContribution}% • stars ${state.teamStars}<br/>
      <strong>Mission:</strong> ${state.teamMissionDone ? 'ผ่านแล้ว ✅' : 'ยังไม่ผ่าน ✨'}<br/>
      <strong>Mission Label:</strong> ${escapeHtml(state.socialMissionLabel)}<br/>
      <strong>Mission Note:</strong> ${escapeHtml(state.socialMissionNote)}<br/>
    `
    : `
      <strong>Social:</strong> ${escapeHtml(state.socialSummary)}<br/>
    `;

  refs.summaryOverlay.innerHTML = `
    <div class="overlay-card">
      <div class="overlay-kicker">Summary • Action + Learning + Research</div>
      <h2>สรุปหลังจบ Patch C flow</h2>
      <p>
        ตอนนี้คะแนนรวมจะรวมทั้งรอบหลัก, Scenarios, Evaluate, Create และ social/research progress แล้ว
      </p>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">Action Score</div>
          <div class="summary-main">${state.actionScore}</div>
          <div class="summary-sub">เก็บน้ำ, เลี่ยงหวาน, reward ระหว่างเล่น</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Knowledge Score</div>
          <div class="summary-main">${state.knowledgeScore}</div>
          <div class="summary-sub">ได้จาก Scenarios + Evaluate</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Planning Score</div>
          <div class="summary-main">${state.planningScore}</div>
          <div class="summary-sub">ได้จาก Evaluate + Create</div>
        </div>

        <div class="summary-card">
          <div class="summary-label">Social Score</div>
          <div class="summary-main">${state.socialScore}</div>
          <div class="summary-sub">${escapeHtml(state.socialMissionLabel)} • ${state.teamStars} ดาว</div>
        </div>
      </div>

      <div class="result-box">
        <strong>คะแนนรวม:</strong> ${state.totalScore}<br/>
        <strong>Scenarios:</strong> ${escapeHtml(state.scenarioSummary || 'ยังไม่มีผล')}<br/>
        <strong>Evaluate:</strong> ${escapeHtml(evalResult.feedbackTitle || '-')}<br/>
        ${escapeHtml(evalResult.feedbackText || '')}<br/><br/>
        <strong>Create:</strong> ${escapeHtml(createResult.feedbackTitle || '-')}<br/>
        ${escapeHtml(createResult.feedbackText || '')}<br/><br/>
        ${teamDetail}
        <strong>${escapeHtml(researchLabel)}:</strong> ${escapeHtml(researchLine)}
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
    .addEventListener('click', () => {
      window.location.href = buildReplayUrl(true);
    });

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
    const missionText = state.teamMissionDone ? 'ผ่าน mission แล้ว ✅' : 'ยังไม่ผ่าน mission ✨';
    refs.teamNote.textContent =
      `${state.socialMissionNote} • ${missionText} • ${state.teamStars} ดาว • social ${state.socialScore}`;
  } else {
    refs.teamNote.textContent =
      'ตอนนี้เล่นแบบเดี่ยวอยู่ ระบบ social เต็มรูปแบบจะเด่นมากขึ้นเมื่อเล่นแบบทีม';
  }
}

function renderStatusRibbon() {
  refs.boostStatus.textContent =
    state.clockMs < state.pointBoostUntil
      ? `Boost: x2 active`
      : `Boost: ปกติ`;

  refs.shieldStatus.textContent = `Shield: ${state.shieldCount}`;
  refs.rewardCountStatus.textContent = `Rewards: ${state.rewardCount}`;
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
    diff: ctx.diff,
    pid: ctx.pid,
    studyId: ctx.studyId,
    seed: ctx.seed,
    savedAt: new Date().toISOString(),

    sessionNo: state.sessionNo,
    weekNo: state.weekNo,

    actionScore: state.actionScore,
    knowledgeScore: state.knowledgeScore,
    planningScore: state.planningScore,
    socialScore: state.socialScore,
    totalScore: state.totalScore,

    goodCatch: state.goodCatch,
    badCatch: state.badCatch,
    missedGood: state.missedGood,
    bestCombo: state.bestCombo,

    rewardCount: state.rewardCount,
    rewardHistory: state.rewardHistory,
    shieldCount: state.shieldCount,

    correctChoices: state.correctChoices,
    wrongChoices: state.wrongChoices,
    scenarioSummary: state.scenarioSummary,

    evaluateChoice: state.evaluateChoice,
    evaluateCorrect: state.evaluateCorrect,

    createdPlan: state.createdPlan,
    createdPlanScore: state.createdPlanScore,

    classTankContribution: state.classTankContribution,
    teamMissionDone: state.teamMissionDone,
    socialMissionLabel: state.socialMissionLabel,
    socialMissionNote: state.socialMissionNote,
    teamStars: state.teamStars,
    socialSummary: state.socialSummary,

    researchSavedAt: state.researchSavedAt,
    nextSessionNo: state.nextSessionNo,
    nextWeekNo: state.nextWeekNo
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
    sessionNo: state.sessionNo,
    weekNo: state.weekNo,
    actionScore: state.actionScore,
    knowledgeScore: state.knowledgeScore,
    planningScore: state.planningScore,
    socialScore: state.socialScore,
    totalScore: state.totalScore,
    goodCatch: state.goodCatch,
    badCatch: state.badCatch,
    missedGood: state.missedGood,
    bestCombo: state.bestCombo,
    rewardCount: state.rewardCount,
    rewardHistory: [...state.rewardHistory],
    correctChoices: state.correctChoices,
    wrongChoices: state.wrongChoices,
    evaluateChoice: state.evaluateChoice,
    evaluateCorrect: state.evaluateCorrect,
    createdPlanScore: state.createdPlanScore,
    classTankContribution: state.classTankContribution,
    teamMissionDone: state.teamMissionDone,
    socialMissionLabel: state.socialMissionLabel,
    teamStars: state.teamStars
  };
}

function buildReplayUrl(useNextProgress = false) {
  const u = new URL(window.location.href);
  u.searchParams.set('seed', String(Date.now()));

  if (useNextProgress) {
    u.searchParams.set('session', String(state.nextSessionNo || state.sessionNo || 1));
    u.searchParams.set('week', String(state.nextWeekNo || state.weekNo || 1));
  } else {
    u.searchParams.set('session', String(state.sessionNo || 1));
    u.searchParams.set('week', String(state.weekNo || 1));
  }

  u.searchParams.set('hub', ctx.hub);
  return u.toString();
}

function logEvent(name, payload = {}) {
  const event = {
    name,
    ts: Date.now(),
    payload
  };
  state.lastEventLog.push(event);
  if (state.lastEventLog.length > 60) state.lastEventLog.shift();
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