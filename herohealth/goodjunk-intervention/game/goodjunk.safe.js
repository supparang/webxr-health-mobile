// === /goodjunk-intervention/game/goodjunk.safe.js ===
// FULL PATCH v20260318c-GJI-SAFE-FOR-INTERVENTION-SHELL
// ใช้กับ goodjunk-vr.html shell ล่าสุดที่มี:
// - #gj-layer
// - HUD / Mission / Coach / Boss bar
// - banners
// - #endOverlay
// - ปุ่ม Post-Knowledge / Post-Behavior / Parent Summary / Replay / Back HUB
//
// Flow:
// launcher -> pre -> pre -> game -> endOverlay -> post / parent / replay
//
// Saves:
// - GJI_GAME_SUMMARY
// - GJI_GAME_EVENTS
//
// Also supports:
// - click / tap targets
// - hha:shoot event from vr-ui.js (for cVR / crosshair mode)

import { pickCtxFromQuery, withDefaultCtx } from '../research/config.js';
import { KEYS, loadCtx, mergeCtx, saveCtx, saveJSON } from '../research/localstore.js';

const VERSION = 'v20260318c-GJI-SAFE-FOR-INTERVENTION-SHELL';
const SEARCH = new URLSearchParams(window.location.search);

const FOODS = {
  good: [
    { id: 'apple',      label: 'แอปเปิล',   emoji: '🍎', cat: 'fruit', points: 10, tip: 'ผลไม้เป็นของว่างที่ดีต่อร่างกาย' },
    { id: 'banana',     label: 'กล้วย',     emoji: '🍌', cat: 'fruit', points: 10, tip: 'กล้วยช่วยให้อิ่มและมีพลังงาน' },
    { id: 'orange',     label: 'ส้ม',       emoji: '🍊', cat: 'fruit', points: 10, tip: 'ส้มช่วยให้สดชื่นและได้วิตามิน' },
    { id: 'pear',       label: 'ลูกแพร์',   emoji: '🍐', cat: 'fruit', points: 10, tip: 'ผลไม้ดีกว่าขนมหวานเป็นประจำ' },
    { id: 'carrot',     label: 'แครอท',    emoji: '🥕', cat: 'veg',   points: 12, tip: 'ผักช่วยให้ร่างกายแข็งแรง' },
    { id: 'broccoli',   label: 'บรอกโคลี', emoji: '🥦', cat: 'veg',   points: 12, tip: 'ผักควรกินบ่อยเพื่อสุขภาพที่ดี' },
    { id: 'cucumber',   label: 'แตงกวา',   emoji: '🥒', cat: 'veg',   points: 11, tip: 'ผักสดเป็นตัวเลือกที่ดี' },
    { id: 'water',      label: 'น้ำเปล่า', emoji: '💧', cat: 'drink', points: 11, tip: 'น้ำเปล่าดีกว่าเครื่องดื่มหวาน' },
    { id: 'milk',       label: 'นมจืด',    emoji: '🥛', cat: 'drink', points: 11, tip: 'นมจืดเหมาะกว่าน้ำหวาน' },
    { id: 'corn',       label: 'ข้าวโพด',  emoji: '🌽', cat: 'veg',   points: 10, tip: 'อาหารธรรมชาติดีกว่าขนมแปรรูป' }
  ],
  junk: [
    { id: 'chips',      label: 'มันฝรั่งทอด', emoji: '🍟', cat: 'junk', points: -8, tip: 'ของทอดควรกินให้น้อยลง' },
    { id: 'soda',       label: 'น้ำอัดลม',    emoji: '🥤', cat: 'junk', points: -9, tip: 'น้ำอัดลมมีน้ำตาลสูง' },
    { id: 'candy',      label: 'ลูกอม',       emoji: '🍬', cat: 'junk', points: -8, tip: 'ขนมหวานกินมากเกินไปไม่ดี' },
    { id: 'donut',      label: 'โดนัท',       emoji: '🍩', cat: 'junk', points: -8, tip: 'ของหวานกินได้บ้าง แต่ไม่ควรบ่อย' },
    { id: 'cake',       label: 'เค้ก',        emoji: '🍰', cat: 'junk', points: -8, tip: 'เค้กเป็นของหวานที่ควรลดลง' },
    { id: 'cookie',     label: 'คุกกี้',      emoji: '🍪', cat: 'junk', points: -7, tip: 'คุกกี้ไม่ควรเป็นของว่างประจำ' },
    { id: 'burger',     label: 'เบอร์เกอร์',  emoji: '🍔', cat: 'junk', points: -9, tip: 'อาหารแปรรูปมากควรเลือกให้น้อยลง' },
    { id: 'sweetTea',   label: 'ชาหวาน',     emoji: '🧋', cat: 'junk', points: -9, tip: 'เครื่องดื่มหวานมีน้ำตาลสูง' },
    { id: 'icecream',   label: 'ไอศกรีม',     emoji: '🍨', cat: 'junk', points: -8, tip: 'ของหวานเย็นอร่อย แต่ไม่ควรกินบ่อย' }
  ]
};

const STAGES = [
  {
    key: 'WARM',
    title: 'WARM',
    desc: 'เก็บอาหารดีพื้นฐานให้แม่น',
    hint: 'เริ่มเบา ๆ ก่อน เน้นของดีให้ต่อเนื่อง',
    goalType: 'good',
    goalBase: 8,
    spawnEvery: 980,
    speedMin: 110,
    speedMax: 160,
    goodRatio: 0.72,
    coachHead: 'พร้อมแล้ว! ยิงของดี 🥦',
    coachExplain: 'เริ่มจากผลไม้ ผัก น้ำเปล่า และนมจืดก่อน'
  },
  {
    key: 'SORT',
    title: 'SORT',
    desc: 'เลือกของดีท่ามกลาง junk ที่มากขึ้น',
    hint: 'เริ่มมี junk มากขึ้น ดูก่อนค่อยแตะ',
    goalType: 'good',
    goalBase: 12,
    spawnEvery: 820,
    speedMin: 135,
    speedMax: 200,
    goodRatio: 0.62,
    coachHead: 'สังเกตให้ดีขึ้น 👀',
    coachExplain: 'อย่าเผลอแตะเครื่องดื่มหวานหรือของทอด'
  },
  {
    key: 'SMART',
    title: 'SMART',
    desc: 'เน้นผลไม้ น้ำเปล่า หรือนมจืด',
    hint: 'ถ้าจะเลือกของว่าง ให้เลือกทางเลือกที่ดีกว่า',
    goalType: 'smart',
    goalBase: 7,
    spawnEvery: 730,
    speedMin: 150,
    speedMax: 220,
    goodRatio: 0.58,
    coachHead: 'เลือกให้ฉลาดขึ้น ✨',
    coachExplain: 'ตอนนี้ลองเน้นผลไม้ น้ำเปล่า หรือนมจืด'
  },
  {
    key: 'BOSS',
    title: 'BOSS',
    desc: 'ลดพลัง Snack Boss ด้วยอาหารดี',
    hint: 'เก็บของดีเพื่อลด HP ของ Boss และอย่าแตะ junk',
    goalType: 'boss',
    goalBase: 100,
    spawnEvery: 620,
    speedMin: 170,
    speedMax: 250,
    goodRatio: 0.56,
    boss: true,
    coachHead: 'Boss มาแล้ว! ⚠️',
    coachExplain: 'แตะของดีเพื่อโจมตี Boss และอย่าแตะ junk เด็ดขาด'
  }
];

const MINI_POOL = [
  { type: 'good3',    label: 'เก็บของดี 3 ชิ้น',              target: 3, duration: 9 },
  { type: 'fruit2',   label: 'เก็บผลไม้ 2 ชิ้น',              target: 2, duration: 9 },
  { type: 'drink1',   label: 'เก็บน้ำเปล่าหรือนมจืด 1 ครั้ง', target: 1, duration: 8 },
  { type: 'avoidJunk',label: 'อย่าแตะ junk 5 วินาที',          target: 5, duration: 5 },
  { type: 'combo4',   label: 'ทำคอมโบ 4',                     target: 4, duration: 10 }
];

const CFG = {
  defaultTimeSec: 80,
  maxTimeSec: 180,
  minTimeSec: 45,
  maxActive: 9,

  missPenalty: 4,
  junkTapPenalty: 8,
  comboEvery: 5,
  comboBonus: 8,
  missionBonus: 15,
  miniBonus: 12,
  bossClearBonus: 30,

  topBoundDesktop: 170,
  topBoundMobile: 220,
  bottomBoundDesktop: 140,
  bottomBoundMobile: 200,

  eventCap: 900
};

const state = {
  ctx: {},
  diff: 'easy',
  view: 'mobile',
  totalSec: CFG.defaultTimeSec,
  started: false,
  finished: false,
  paused: false,

  elapsedMs: 0,
  lastTs: 0,
  raf: 0,
  spawnTimer: 0,

  bounds: { left: 10, top: 180, width: 300, height: 300, bottom: 500 },

  score: 0,
  miss: 0,
  goodHit: 0,
  junkHit: 0,
  junkAvoided: 0,
  combo: 0,
  bestCombo: 0,

  fruitHit: 0,
  vegHit: 0,
  drinkHit: 0,

  stageIndex: 0,
  stageEnteredAtMs: 0,
  stageBaseGood: 0,
  stageBaseSmart: 0,
  stageBonusDone: {},

  mini: null,
  miniCooldownMs: 2000,

  boss: {
    active: false,
    hp: 100,
    maxHp: 100,
    cleared: false
  },

  active: [],
  events: [],

  ui: {}
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randint(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function q(name, fallback = '') {
  return SEARCH.get(name) ?? fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function diffScale() {
  if (state.diff === 'easy') return 0.90;
  if (state.diff === 'hard') return 1.18;
  return 1.0;
}

function timeLeftSec() {
  return Math.max(0, Math.ceil(state.totalSec - state.elapsedMs / 1000));
}

function ensureExtraStyle() {
  if (document.getElementById('gji-intervention-target-style')) return;

  const style = document.createElement('style');
  style.id = 'gji-intervention-target-style';
  style.textContent = `
    .gj-target{
      position:absolute;
      transform:translate(-50%,-50%);
      min-width:72px;
      min-height:72px;
      padding:8px 10px;
      border-radius:20px;
      border:1px solid rgba(255,255,255,.16);
      display:grid;
      place-items:center;
      gap:4px;
      text-align:center;
      box-shadow:0 14px 34px rgba(0,0,0,.32);
      background:rgba(15,23,42,.92);
      color:#fff;
      cursor:pointer;
      pointer-events:auto;
      user-select:none;
      -webkit-user-select:none;
      touch-action:manipulation;
      z-index:20;
    }
    .gj-target.good{
      background:linear-gradient(180deg, rgba(22,101,52,.96), rgba(15,23,42,.92));
      border-color:rgba(34,197,94,.34);
    }
    .gj-target.junk{
      background:linear-gradient(180deg, rgba(127,29,29,.96), rgba(15,23,42,.92));
      border-color:rgba(239,68,68,.32);
    }
    .gj-target.hit{
      transform:translate(-50%,-50%) scale(.88);
      opacity:.25;
      transition:transform .12s ease, opacity .12s ease;
    }
    .gj-emoji{
      font-size:30px;
      line-height:1;
    }
    .gj-label{
      font-size:12px;
      font-weight:1000;
      line-height:1.05;
      white-space:nowrap;
    }
  `;
  document.head.appendChild(style);
}

function calcBounds() {
  const isMobile = window.innerWidth <= 900;
  const left = 12;
  const width = Math.max(220, window.innerWidth - 24);
  const top = isMobile ? CFG.topBoundMobile : CFG.topBoundDesktop;
  const bottomGap = isMobile ? CFG.bottomBoundMobile : CFG.bottomBoundDesktop;
  const bottom = Math.max(top + 220, window.innerHeight - bottomGap);
  const height = Math.max(220, bottom - top);

  state.bounds = { left, top, width, bottom, height };
}

function bindUiRefs() {
  state.ui.layer = document.getElementById('gj-layer');

  state.ui.hudScore = document.getElementById('hud-score');
  state.ui.hudTime = document.getElementById('hud-time');
  state.ui.hudMiss = document.getElementById('hud-miss');
  state.ui.hudGrade = document.getElementById('hud-grade');
  state.ui.hudGoal = document.getElementById('hud-goal');
  state.ui.hudGoalCur = document.getElementById('hud-goal-cur');
  state.ui.hudGoalTarget = document.getElementById('hud-goal-target');
  state.ui.goalDesc = document.getElementById('goalDesc');

  state.ui.missionTitle = document.getElementById('missionTitle');
  state.ui.missionGoal = document.getElementById('missionGoal');
  state.ui.missionHint = document.getElementById('missionHint');
  state.ui.missionFill = document.getElementById('missionFill');

  state.ui.coachInline = document.getElementById('coachInline');
  state.ui.coachExplain = document.getElementById('coachExplain');
  state.ui.aiRisk = document.getElementById('aiRisk');
  state.ui.hudMini = document.getElementById('hud-mini');
  state.ui.miniTimer = document.getElementById('miniTimer');
  state.ui.aiHint = document.getElementById('aiHint');

  state.ui.bossBar = document.getElementById('bossBar');
  state.ui.bossFill = document.getElementById('bossFill');
  state.ui.bossHint = document.getElementById('bossHint');

  state.ui.stageBanner = document.getElementById('stageBanner');
  state.ui.stageBannerBig = document.getElementById('stageBannerBig');
  state.ui.stageBannerSmall = document.getElementById('stageBannerSmall');
  state.ui.milestoneBanner = document.getElementById('milestoneBanner');

  state.ui.dangerOverlay = document.getElementById('dangerOverlay');
  state.ui.missionBox = document.getElementById('missionBox');
  state.ui.aiBox = document.getElementById('aiBox');

  state.ui.endOverlay = document.getElementById('endOverlay');
  state.ui.endTitle = document.getElementById('endTitle');
  state.ui.endSub = document.getElementById('endSub');
  state.ui.endGrade = document.getElementById('endGrade');
  state.ui.endScore = document.getElementById('endScore');
  state.ui.endMiss = document.getElementById('endMiss');
  state.ui.endTime = document.getElementById('endTime');
  state.ui.endDecision = document.getElementById('endDecision');
  state.ui.nutritionExplainBody = document.getElementById('nutritionExplainBody');
  state.ui.reflectionBody = document.getElementById('reflectionBody');
  state.ui.reflectionBullets = document.getElementById('reflectionBullets');
  state.ui.takeHomeMissionBody = document.getElementById('takeHomeMissionBody');
}

function buildContext() {
  const fromConfigQuery = pickCtxFromQuery();
  const mapped = withDefaultCtx({
    ...fromConfigQuery,
    pid: fromConfigQuery.pid || q('studentKey', q('nickName', 'guest')),
    nickName: q('nickName', q('studentKey', '')),
    studyId: q('studyId', fromConfigQuery.studyId || 'GJI-2026'),
    phase: q('phase', fromConfigQuery.phase || 'intervention'),
    group: q('group', q('conditionGroup', fromConfigQuery.group || '')),
    condition: q('condition', q('conditionGroup', fromConfigQuery.condition || 'intervention')),
    session: q('session', q('sessionId', fromConfigQuery.session || 's1')),
    classRoom: q('classRoom', ''),
    school: q('schoolName', q('schoolCode', '')),
    diff: q('diff', 'easy'),
    view: q('view', 'mobile'),
    time: q('time', String(CFG.defaultTimeSec)),
    run: q('run', 'play'),
    hub: q('hub', '../../hub.html')
  });

  mergeCtx(mapped);
  state.ctx = withDefaultCtx({ ...loadCtx(), ...mapped });
  saveCtx(state.ctx);

  state.diff = state.ctx.diff || 'easy';
  state.view = state.ctx.view || 'mobile';
  state.totalSec = clamp(Number(state.ctx.time || CFG.defaultTimeSec), CFG.minTimeSec, CFG.maxTimeSec);
}

function logEvent(type, data = {}) {
  state.events.push({
    type,
    at: nowIso(),
    elapsedMs: Math.round(state.elapsedMs),
    stage: currentStage().key,
    ...data
  });

  if (state.events.length > CFG.eventCap) {
    state.events.splice(0, state.events.length - CFG.eventCap);
  }
}

function stageSpanMs() {
  return (state.totalSec * 1000) / STAGES.length;
}

function currentStage() {
  return STAGES[state.stageIndex];
}

function stageIndexByElapsed() {
  const idx = Math.floor(state.elapsedMs / stageSpanMs());
  return clamp(idx, 0, STAGES.length - 1);
}

function goalTarget(stage = currentStage()) {
  if (stage.goalType === 'boss') return stage.goalBase;

  const timeFactor = state.totalSec / CFG.defaultTimeSec;
  const diffFactor = state.diff === 'hard' ? 1.08 : (state.diff === 'easy' ? 0.92 : 1.0);
  return Math.max(4, Math.round(stage.goalBase * timeFactor * diffFactor));
}

function goalCurrent(stage = currentStage()) {
  if (stage.goalType === 'good') {
    return state.goodHit - state.stageBaseGood;
  }
  if (stage.goalType === 'smart') {
    return (state.fruitHit + state.drinkHit) - state.stageBaseSmart;
  }
  if (stage.goalType === 'boss') {
    return state.boss.maxHp - state.boss.hp;
  }
  return 0;
}

function formatGrade() {
  const decisions = state.goodHit + state.junkHit + state.miss;
  const accuracy = decisions > 0 ? state.goodHit / decisions : 0;

  if (state.goodHit >= 20 && state.junkHit <= 3 && state.miss <= 5 && accuracy >= 0.58) return 'A';
  if (state.goodHit >= 15 && state.junkHit <= 5 && state.miss <= 8 && accuracy >= 0.48) return 'B';
  if (state.goodHit >= 10 && accuracy >= 0.36) return 'C';
  return 'D';
}

function computeRisk() {
  const decisions = Math.max(4, state.goodHit + state.junkHit + state.miss);
  const raw = ((state.junkHit * 1.25) + (state.miss * 0.95) + (state.combo === 0 ? 0.35 : 0)) / decisions;
  return clamp(raw, 0, 0.99);
}

function setCoach(head, explain, hint = '') {
  if (state.ui.coachInline) state.ui.coachInline.textContent = head;
  if (state.ui.coachExplain) state.ui.coachExplain.textContent = explain || '';
  if (state.ui.aiHint) state.ui.aiHint.textContent = hint || '—';
}

function updateBossUi() {
  if (!state.ui.bossBar || !state.ui.bossFill || !state.ui.bossHint) return;

  if (currentStage().boss) {
    state.ui.bossBar.style.display = '';
    const pct = clamp((state.boss.hp / state.boss.maxHp) * 100, 0, 100);
    state.ui.bossFill.style.setProperty('--hp', `${pct}%`);
    state.ui.bossFill.style.width = `${pct}%`;
    state.ui.bossHint.textContent = state.boss.cleared
      ? 'Boss แตกแล้ว!'
      : `HP ${Math.round(state.boss.hp)}/${state.boss.maxHp}`;
  } else {
    state.ui.bossBar.style.display = 'none';
  }
}

function updateDangerUi() {
  const risk = computeRisk();
  const stage = currentStage();
  let alpha = risk * 0.32;
  if (stage.boss && !state.boss.cleared) alpha = Math.max(alpha, 0.18);
  state.ui.dangerOverlay.style.opacity = String(clamp(alpha, 0, 0.45));
}

function updateMiniUi() {
  if (!state.ui.hudMini || !state.ui.miniTimer) return;
  if (!state.mini) {
    state.ui.hudMini.textContent = '—';
    state.ui.miniTimer.textContent = '0';
    return;
  }

  const remaining = Math.max(0, Math.ceil((state.mini.duration * 1000 - (state.elapsedMs - state.mini.startMs)) / 1000));
  state.ui.hudMini.textContent = state.mini.label;
  state.ui.miniTimer.textContent = String(remaining);
}

function updateMissionUi() {
  const stage = currentStage();
  const cur = goalCurrent(stage);
  const target = goalTarget(stage);
  const pct = clamp((cur / Math.max(1, target)) * 100, 0, 100);

  state.ui.hudGoal.textContent = stage.key;
  state.ui.hudGoalCur.textContent = String(Math.round(cur));
  state.ui.hudGoalTarget.textContent = String(Math.round(target));
  state.ui.goalDesc.textContent = stage.desc;

  state.ui.missionTitle.textContent = stage.title;
  state.ui.missionGoal.textContent = stage.desc;
  state.ui.missionHint.textContent = stage.hint;
  state.ui.missionFill.style.setProperty('--p', `${pct}%`);
}

function updateHud() {
  state.ui.hudScore.textContent = String(state.score);
  state.ui.hudTime.textContent = String(timeLeftSec());
  state.ui.hudMiss.textContent = String(state.miss);
  state.ui.hudGrade.textContent = formatGrade();
  updateMissionUi();
  updateMiniUi();

  const risk = computeRisk();
  state.ui.aiRisk.textContent = risk.toFixed(2);

  if (risk >= 0.65) {
    if (!state.mini) setCoach(currentStage().coachHead, currentStage().coachExplain, 'ช้าลงนิด ดูก่อนค่อยแตะ');
  } else if (currentStage().goalType === 'smart') {
    if (!state.mini) setCoach(currentStage().coachHead, currentStage().coachExplain, 'เน้นผลไม้ น้ำเปล่า หรือ นมจืด');
  } else if (!state.mini) {
    setCoach(currentStage().coachHead, currentStage().coachExplain, 'รักษาคอมโบด้วยการเก็บของดีต่อเนื่อง');
  }

  updateBossUi();
  updateDangerUi();
}

function showStageBanner(big, small = '') {
  state.ui.stageBannerBig.textContent = big;
  state.ui.stageBannerSmall.textContent = small;
  state.ui.stageBanner.classList.add('show');
  clearTimeout(showStageBanner._t);
  showStageBanner._t = setTimeout(() => {
    state.ui.stageBanner.classList.remove('show');
  }, 1100);
}

function showMilestone(text) {
  state.ui.milestoneBanner.textContent = text;
  state.ui.milestoneBanner.classList.add('show');
  clearTimeout(showMilestone._t);
  showMilestone._t = setTimeout(() => {
    state.ui.milestoneBanner.classList.remove('show');
  }, 900);
}

function toggleCompactPanel(el) {
  el.classList.toggle('auto-hide');
}

function bindPanelToggles() {
  state.ui.missionBox?.addEventListener('click', () => toggleCompactPanel(state.ui.missionBox));
  state.ui.aiBox?.addEventListener('click', () => toggleCompactPanel(state.ui.aiBox));
  state.ui.missionBox?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      toggleCompactPanel(state.ui.missionBox);
    }
  });
  state.ui.aiBox?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      toggleCompactPanel(state.ui.aiBox);
    }
  });
}

function clearTargets(silent = true) {
  for (const t of state.active) {
    t.active = false;
    try { t.el.remove(); } catch {}
    if (!silent) logEvent('target_removed', { id: t.id, item: t.food.id });
  }
  state.active.length = 0;
}

function makeTargetKind(stage) {
  return Math.random() < stage.goodRatio ? 'good' : 'junk';
}

function makeTargetModel() {
  const stage = currentStage();
  const kind = makeTargetKind(stage);
  const food = pick(FOODS[kind]);
  const size = randint(68, 92);
  const x = rand(size * 0.8, state.bounds.width - size * 0.8);
  const vy = rand(stage.speedMin, stage.speedMax) * diffScale();
  const swayAmp = rand(0, 30);
  const swaySpeed = rand(1.2, 2.6);
  const phase = rand(0, Math.PI * 2);

  return {
    id: `gji_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    kind,
    food,
    size,
    x,
    y: -size,
    vy,
    swayAmp,
    swaySpeed,
    phase,
    active: true
  };
}

function isStrictShootMode() {
  return /cvr/i.test(String(state.view || ''));
}

function createTargetElement(model) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `gj-target ${model.kind}`;
  el.setAttribute('aria-label', `${model.food.label} ${model.kind === 'good' ? 'good' : 'junk'}`);
  el.innerHTML = `
    <div class="gj-emoji">${model.food.emoji}</div>
    <div class="gj-label">${model.food.label}</div>
  `;
  el.style.width = `${model.size}px`;
  el.style.height = `${model.size}px`;

  if (isStrictShootMode()) {
    el.style.pointerEvents = 'none';
  } else {
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      tapTarget(model, 'tap');
    }, { passive: false });

    el.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
    }, { passive: false });
  }

  return el;
}

function spawnTarget() {
  if (!state.started || state.finished || state.paused) return;
  if (state.active.length >= CFG.maxActive) {
    scheduleSpawn();
    return;
  }

  const model = makeTargetModel();
  model.el = createTargetElement(model);

  state.active.push(model);
  state.ui.layer.appendChild(model.el);

  logEvent('spawn', {
    id: model.id,
    item: model.food.id,
    label: model.food.label,
    kind: model.kind
  });

  scheduleSpawn();
}

function scheduleSpawn() {
  clearTimeout(state.spawnTimer);
  if (!state.started || state.finished) return;

  const stage = currentStage();
  const base = stage.spawnEvery;
  const delay = Math.max(320, base / diffScale());

  state.spawnTimer = setTimeout(spawnTarget, delay);
}

function renderTargets() {
  const sec = state.elapsedMs / 1000;

  for (let i = state.active.length - 1; i >= 0; i -= 1) {
    const t = state.active[i];
    if (!t.active) continue;

    t.y += t.vy * state._dtSec;
    const x = state.bounds.left + t.x + Math.sin(sec * t.swaySpeed + t.phase) * t.swayAmp;
    const y = state.bounds.top + t.y;

    t.el.style.left = `${x}px`;
    t.el.style.top = `${y}px`;

    if (t.y > state.bounds.height + t.size) {
      onTargetEscape(t);
    }
  }
}

function removeTarget(t) {
  t.active = false;
  try { t.el.classList.add('hit'); } catch {}
  setTimeout(() => {
    try { t.el.remove(); } catch {}
  }, 120);
  const idx = state.active.indexOf(t);
  if (idx >= 0) state.active.splice(idx, 1);
}

function comboBonusCheck() {
  if (state.combo > 0 && state.combo % CFG.comboEvery === 0) {
    state.score += CFG.comboBonus;
    showMilestone(`COMBO x${state.combo} +${CFG.comboBonus}`);
    setCoach('คอมโบสุดยอด 🔥', 'เลือกของดีต่อเนื่องได้ดีมาก', 'รักษาจังหวะนี้ไว้');
    logEvent('combo_bonus', { combo: state.combo, bonus: CFG.comboBonus, score: state.score });
  }
}

function smartChoiceHit(food) {
  return food.cat === 'fruit' || food.id === 'water' || food.id === 'milk' || food.cat === 'drink';
}

function damageBossBy(food) {
  if (!currentStage().boss || state.boss.cleared) return;

  let dmg = 12;
  if (food.cat === 'veg') dmg = 13;
  if (food.cat === 'fruit') dmg = 12;
  if (food.id === 'water' || food.id === 'milk') dmg = 14;

  state.boss.hp = Math.max(0, state.boss.hp - dmg);
  state.ui.bossHint.textContent = `โดนโจมตี -${dmg}`;

  if (state.boss.hp <= 0 && !state.boss.cleared) {
    state.boss.cleared = true;
    state.score += CFG.bossClearBonus;
    showMilestone(`BOSS CLEAR +${CFG.bossClearBonus}`);
    setCoach('Boss แตกแล้ว! 🎉', 'หนูเลือกของดีได้ดีมาก', 'พร้อมดูสรุปผลหลังเล่น');
    logEvent('boss_clear', { bonus: CFG.bossClearBonus, score: state.score });

    setTimeout(() => {
      finishGame();
    }, 900);
  }
}

function healBossOnJunk() {
  if (!currentStage().boss || state.boss.cleared) return;
  state.boss.hp = Math.min(state.boss.maxHp, state.boss.hp + 8);
  state.ui.bossHint.textContent = 'Junk ทำให้ Boss แข็งแรงขึ้น';
}

function tapTarget(t, source = 'tap') {
  if (!state.started || state.finished || !t.active) return;

  if (t.kind === 'good') {
    state.score += Math.max(0, t.food.points);
    state.goodHit += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    if (t.food.cat === 'fruit') state.fruitHit += 1;
    if (t.food.cat === 'veg') state.vegHit += 1;
    if (t.food.cat === 'drink') state.drinkHit += 1;

    comboBonusCheck();
    damageBossBy(t.food);

    setCoach(
      `${t.food.label} ดีมาก ${t.food.emoji}`,
      t.food.tip,
      smartChoiceHit(t.food) ? 'นี่เป็นทางเลือกที่ดีกว่า junk' : 'รักษาคอมโบต่อไป'
    );

    logEvent('tap_good', {
      source,
      id: t.id,
      item: t.food.id,
      label: t.food.label,
      score: state.score,
      combo: state.combo
    });

    handleMiniProgress('good', t.food);
  } else {
    state.junkHit += 1;
    state.miss += 1;
    state.combo = 0;
    state.score = Math.max(0, state.score - CFG.junkTapPenalty);
    healBossOnJunk();

    setCoach(
      `ระวัง ${t.food.label} ${t.food.emoji}`,
      t.food.tip,
      'ครั้งหน้าลองดูฉลากหรือดูรูปร่างอาหารก่อนแตะ'
    );

    logEvent('tap_junk', {
      source,
      id: t.id,
      item: t.food.id,
      label: t.food.label,
      score: state.score
    });

    handleMiniProgress('junk', t.food);
  }

  removeTarget(t);
  updateStageMissionBonus();
  updateHud();
}

function onTargetEscape(t) {
  if (!t.active) return;

  if (t.kind === 'good') {
    state.miss += 1;
    state.combo = 0;
    state.score = Math.max(0, state.score - CFG.missPenalty);

    setCoach(
      `พลาด ${t.food.label} ไปแล้ว`,
      'ลองรีบเก็บอาหารดีให้มากขึ้น',
      'ถ้าเป็นของดี อย่าปล่อยให้หลุดผ่าน'
    );

    logEvent('miss_good', {
      id: t.id,
      item: t.food.id,
      label: t.food.label,
      score: state.score
    });

    handleMiniProgress('miss_good', t.food);
  } else {
    state.junkAvoided += 1;
    logEvent('avoid_junk', {
      id: t.id,
      item: t.food.id,
      label: t.food.label
    });

    handleMiniProgress('avoid_junk', t.food);
  }

  removeTarget(t);
  updateHud();
}

function updateStageMissionBonus() {
  const stage = currentStage();
  const idx = state.stageIndex;
  const cur = goalCurrent(stage);
  const target = goalTarget(stage);

  if (!state.stageBonusDone[idx] && !stage.boss && cur >= target) {
    state.stageBonusDone[idx] = true;
    state.score += CFG.missionBonus;
    showMilestone(`MISSION CLEAR +${CFG.missionBonus}`);
    setCoach(
      `${stage.title} สำเร็จแล้ว ✨`,
      'ทำภารกิจของด่านนี้สำเร็จแล้ว',
      'ลุยต่อไปได้เลย'
    );
    logEvent('stage_goal_clear', { stage: stage.key, bonus: CFG.missionBonus, score: state.score });
  }
}

function stageGoalBullet(stageKey) {
  if (stageKey === 'WARM') return 'ฉันเริ่มแยกอาหารดีออกจาก junk ได้ดีขึ้น';
  if (stageKey === 'SORT') return 'ฉันต้องมองให้ชัดก่อนเลือก ไม่แตะตามความเคยชิน';
  if (stageKey === 'SMART') return 'ฉันรู้ว่าผลไม้ น้ำเปล่า และนมจืดเป็นตัวเลือกที่ดีกว่า';
  return 'ฉันพยายามลด junk และเพิ่มอาหารที่ดีต่อร่างกาย';
}

function startMiniMission() {
  if (!state.started || state.finished) return;

  const pool = [...MINI_POOL];
  const base = pick(pool);

  state.mini = {
    ...base,
    startMs: state.elapsedMs,
    progress: 0,
    baseGood: state.goodHit,
    baseFruit: state.fruitHit,
    baseDrink: state.drinkHit,
    baseJunk: state.junkHit,
    baseCombo: state.combo
  };

  setCoach(
    `Mini Mission: ${base.label}`,
    'ทำภารกิจสั้นเพื่อรับโบนัสเพิ่ม',
    'ดูเวลาถอยหลังทางขวา'
  );

  logEvent('mini_start', { type: base.type, label: base.label });
  updateMiniUi();
}

function clearMiniMission(reason = 'clear') {
  if (!state.mini) return;
  logEvent('mini_end', { reason, type: state.mini.type, progress: state.mini.progress });
  state.mini = null;
  state.miniCooldownMs = reason === 'success' ? 2500 : 1500;
  updateMiniUi();
}

function succeedMiniMission() {
  if (!state.mini) return;
  state.score += CFG.miniBonus;
  showMilestone(`MINI +${CFG.miniBonus}`);
  setCoach('Mini Mission สำเร็จ 🎯', 'หนูทำภารกิจย่อยสำเร็จแล้ว', 'รับโบนัสเพิ่มไปเลย');
  logEvent('mini_success', { type: state.mini.type, bonus: CFG.miniBonus, score: state.score });
  clearMiniMission('success');
  updateHud();
}

function failMiniMission() {
  if (!state.mini) return;
  setCoach('Mini Mission หมดเวลา', 'ไม่เป็นไร ลองใหม่ในรอบถัดไป', 'ค่อย ๆ ดูและเลือกให้แม่นขึ้น');
  logEvent('mini_fail', { type: state.mini.type });
  clearMiniMission('fail');
  updateHud();
}

function handleMiniProgress(eventType, food) {
  if (!state.mini) return;

  switch (state.mini.type) {
    case 'good3':
      state.mini.progress = state.goodHit - state.mini.baseGood;
      if (state.mini.progress >= state.mini.target) succeedMiniMission();
      break;

    case 'fruit2':
      state.mini.progress = state.fruitHit - state.mini.baseFruit;
      if (state.mini.progress >= state.mini.target) succeedMiniMission();
      break;

    case 'drink1':
      state.mini.progress = state.drinkHit - state.mini.baseDrink;
      if (state.mini.progress >= state.mini.target) succeedMiniMission();
      break;

    case 'combo4':
      state.mini.progress = state.combo;
      if (state.mini.progress >= state.mini.target) succeedMiniMission();
      break;

    case 'avoidJunk':
      if (eventType === 'junk') {
        failMiniMission();
      }
      break;
  }

  updateMiniUi();
}

function updateMiniMission(dtMs) {
  if (!state.mini) {
    state.miniCooldownMs = Math.max(0, state.miniCooldownMs - dtMs);
    if (state.miniCooldownMs <= 0 && state.started && !state.finished) {
      startMiniMission();
    }
    return;
  }

  const elapsed = (state.elapsedMs - state.mini.startMs) / 1000;
  const remaining = state.mini.duration - elapsed;

  if (state.mini.type === 'avoidJunk') {
    state.mini.progress = Math.min(state.mini.target, elapsed);
    if (state.mini.progress >= state.mini.target) {
      succeedMiniMission();
      return;
    }
  }

  if (remaining <= 0) {
    failMiniMission();
    return;
  }

  updateMiniUi();
}

function showBossForStage(stage) {
  if (stage.boss) {
    state.boss.active = true;
    state.boss.maxHp = stage.goalBase;
    state.boss.hp = stage.goalBase;
    state.boss.cleared = false;
  } else {
    state.boss.active = false;
  }
  updateBossUi();
}

function enterStage(nextIndex, first = false) {
  state.stageIndex = nextIndex;
  state.stageEnteredAtMs = state.elapsedMs;
  state.stageBaseGood = state.goodHit;
  state.stageBaseSmart = state.fruitHit + state.drinkHit;
  state.mini = null;
  state.miniCooldownMs = 1800;

  const stage = currentStage();

  if (stage.boss) {
    clearTargets(true);
    showBossForStage(stage);
  } else {
    state.boss.active = false;
    updateBossUi();
  }

  if (!first) {
    showStageBanner(stage.title, stage.desc);
    logEvent('stage_enter', { stage: stage.key });
  } else {
    logEvent('stage_enter', { stage: stage.key, first: true });
  }

  setCoach(stage.coachHead, stage.coachExplain, stage.hint);
  updateHud();
}

function updateStageByTime() {
  const idx = stageIndexByElapsed();
  if (idx !== state.stageIndex) {
    enterStage(idx, false);
  }
}

function loop(ts) {
  if (!state.started || state.finished) return;

  if (!state.lastTs) state.lastTs = ts;
  const dtMs = Math.min(50, ts - state.lastTs);
  state.lastTs = ts;
  state._dtSec = dtMs / 1000;

  if (!state.paused) {
    state.elapsedMs += dtMs;
    updateStageByTime();
    updateMiniMission(dtMs);
    renderTargets();
    updateHud();

    if (state.elapsedMs >= state.totalSec * 1000) {
      finishGame();
      return;
    }
  }

  state.raf = requestAnimationFrame(loop);
}

function buildSummary() {
  const decisions = state.goodHit + state.junkHit + state.miss;
  const accuracy = decisions > 0 ? state.goodHit / decisions : 0;
  const grade = formatGrade();

  return {
    app: 'goodjunk-intervention',
    version: VERSION,
    savedAt: nowIso(),

    pid: state.ctx.pid || '',
    nickName: state.ctx.nickName || '',
    studyId: state.ctx.studyId || '',
    phase: state.ctx.phase || '',
    group: state.ctx.group || '',
    condition: state.ctx.condition || '',
    session: state.ctx.session || '',

    diff: state.diff,
    view: state.view,
    totalSec: state.totalSec,
    elapsedSec: Math.round(state.elapsedMs / 1000),

    score: state.score,
    goodHit: state.goodHit,
    junkHit: state.junkHit,
    miss: state.miss,
    junkAvoided: state.junkAvoided,
    comboBest: state.bestCombo,

    fruitHit: state.fruitHit,
    vegHit: state.vegHit,
    drinkHit: state.drinkHit,

    grade,
    accuracy: Number(accuracy.toFixed(4)),
    stageReached: currentStage().key,
    bossCleared: state.boss.cleared
  };
}

function makeNutritionExplain(summary) {
  if (summary.goodHit >= 18 && summary.junkHit <= 3) {
    return 'ในรอบนี้เด็กเลือกอาหารและเครื่องดื่มที่ดีต่อร่างกายได้บ่อย เช่น ผลไม้ ผัก น้ำเปล่า หรือนมจืด และแตะ junk ค่อนข้างน้อย แปลว่ามีแนวโน้มแยกทางเลือกที่เหมาะกว่าได้ดีขึ้น';
  }
  if (summary.junkHit > summary.goodHit) {
    return 'ในรอบนี้เด็กยังเผลอแตะ junk food หรือเครื่องดื่มหวานหลายครั้ง จึงควรฝึกสังเกตให้มากขึ้นว่าอาหารแบบไหนควรลด และอะไรเป็นทางเลือกที่ดีกว่าในชีวิตประจำวัน';
  }
  if (summary.drinkHit >= 3) {
    return 'เด็กเริ่มตอบสนองต่อทางเลือกเครื่องดื่มที่เหมาะกว่าได้ดีขึ้น โดยเฉพาะน้ำเปล่าหรือนมจืด ซึ่งเป็นสัญญาณที่ดีต่อการปรับพฤติกรรมในสถานการณ์จริง';
  }
  return 'ผลการเล่นแสดงให้เห็นว่าเด็กเริ่มฝึกแยกอาหารที่ควรเลือกบ่อย อาหารที่ควรลด และพยายามตอบสนองต่อภารกิจสุขภาพได้ดีขึ้น แม้ยังมีจุดที่ควรฝึกต่อเรื่องความแม่นยำในการเลือก';
}

function makeReflection(summary) {
  if (summary.grade === 'A') {
    return {
      body: 'วันนี้หนูทำได้ดีมาก ลองคิดว่าทำไมหนูถึงเลือกของดีได้แม่น แล้วเอาวิธีนั้นไปใช้เวลาซื้อของว่างจริง',
      bullets: [
        'ฉันเลือกของดีได้หลายครั้งและรักษาคอมโบได้',
        'ฉันสังเกต junk ได้เร็วขึ้น',
        'ครั้งหน้าจะเลือกผลไม้หรือน้ำเปล่าในชีวิตจริง'
      ]
    };
  }

  if (summary.junkHit >= 5) {
    return {
      body: 'วันนี้ยังมีบางช่วงที่หนูเผลอแตะ junk ลองคิดว่าจังหวะไหนทำให้รีบเกินไป แล้วครั้งหน้าจะชะลอก่อนเลือก',
      bullets: [
        'ฉันเผลอแตะของหวานหรือของทอดตอนไหนบ้าง',
        'ฉันควรดูอาหารให้ชัดก่อนแตะ',
        'ครั้งหน้าจะเปลี่ยน 1 อย่าง เช่น เลือกน้ำเปล่าแทนน้ำหวาน'
      ]
    };
  }

  return {
    body: 'วันนี้หนูเริ่มฝึกเลือกของว่างได้ดีขึ้น ลองดูว่าในชีวิตจริงจะใช้สิ่งที่เรียนรู้จากเกมได้อย่างไร',
    bullets: [
      stageGoalBullet(currentStage().key),
      'ฉันควรเพิ่มของดีให้มากกว่า junk',
      'ฉันจะลองเลือกของว่างสุขภาพ 1 อย่างหลังจบกิจกรรม'
    ]
  };
}

function makeTakeHome(summary) {
  if (summary.drinkHit < 2) {
    return 'วันนี้ลองเลือกน้ำเปล่าหรือนมจืด 1 ครั้งแทนเครื่องดื่มหวาน แล้วบอกผู้ปกครองว่าทำไมตัวเลือกนี้จึงดีกว่า';
  }
  if (summary.fruitHit < 3) {
    return 'วันนี้ลองเลือกผลไม้ 1 อย่างเป็นของว่าง แล้วคุยกับผู้ปกครองว่าผลไม้ดีกว่าขนมหวานอย่างไร';
  }
  return 'วันนี้ลองเลือกของว่างดี 1 อย่าง เช่น ผลไม้ นมจืด หรือน้ำเปล่า แล้วอธิบายให้ผู้ปกครองฟังว่าทำไมจึงเลือกแบบนั้น';
}

function populateEndOverlay(summary) {
  const gradeText = summary.grade;
  const positive = summary.grade === 'A' || summary.grade === 'B';

  state.ui.endTitle.textContent = positive ? 'เยี่ยมมาก! จบรอบแล้ว 🎉' : 'จบรอบแล้ว 👍';
  state.ui.endSub.textContent = positive
    ? 'หนูเลือกของว่างสุขภาพได้ดีขึ้นในรอบนี้'
    : 'รอบนี้เป็นการฝึกที่ดี ลองใช้สิ่งที่เรียนรู้ไปต่อยอด';

  state.ui.endGrade.textContent = `Grade ${gradeText}`;
  state.ui.endScore.textContent = String(summary.score);
  state.ui.endMiss.textContent = String(summary.miss);
  state.ui.endTime.textContent = `${summary.elapsedSec}s`;

  state.ui.endDecision.textContent =
    `โหมด intervention • เลือกของดี ${summary.goodHit} ครั้ง • แตะ junk ${summary.junkHit} ครั้ง • หลีกเลี่ยง junk ${summary.junkAvoided} ครั้ง`;

  state.ui.nutritionExplainBody.textContent = makeNutritionExplain(summary);

  const reflection = makeReflection(summary);
  state.ui.reflectionBody.textContent = reflection.body;
  state.ui.reflectionBullets.innerHTML = reflection.bullets.map(v => `<li>${v}</li>`).join('');

  state.ui.takeHomeMissionBody.textContent = makeTakeHome(summary);
}

function finishGame() {
  if (state.finished) return;
  state.finished = true;
  state.started = false;

  cancelAnimationFrame(state.raf);
  clearTimeout(state.spawnTimer);
  clearTargets(true);

  const summary = buildSummary();
  populateEndOverlay(summary);

  saveJSON(KEYS.GAME_SUMMARY, summary);
  saveJSON(KEYS.GAME_EVENTS, state.events);

  try {
    localStorage.setItem('GJI_LAST_SUMMARY', JSON.stringify(summary));
  } catch {}

  try {
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
      game: 'goodjunk-intervention',
      title: 'GoodJunk Intervention',
      score: summary.score,
      miss: summary.miss,
      grade: summary.grade,
      savedAt: summary.savedAt
    }));
  } catch {}

  logEvent('finish', summary);

  state.ui.endOverlay.style.display = 'flex';
  state.ui.endOverlay.setAttribute('aria-hidden', 'false');
}

function resetRunState() {
  state.started = false;
  state.finished = false;
  state.paused = false;

  state.elapsedMs = 0;
  state.lastTs = 0;

  state.score = 0;
  state.miss = 0;
  state.goodHit = 0;
  state.junkHit = 0;
  state.junkAvoided = 0;
  state.combo = 0;
  state.bestCombo = 0;

  state.fruitHit = 0;
  state.vegHit = 0;
  state.drinkHit = 0;

  state.stageIndex = 0;
  state.stageEnteredAtMs = 0;
  state.stageBaseGood = 0;
  state.stageBaseSmart = 0;
  state.stageBonusDone = {};

  state.mini = null;
  state.miniCooldownMs = 1800;

  state.boss.active = false;
  state.boss.hp = 100;
  state.boss.maxHp = 100;
  state.boss.cleared = false;

  state.active.length = 0;
  state.events.length = 0;

  clearTimeout(state.spawnTimer);
  cancelAnimationFrame(state.raf);
  clearTargets(true);

  state.ui.endOverlay.style.display = 'none';
  state.ui.endOverlay.setAttribute('aria-hidden', 'true');
}

function startRun() {
  if (state.started) return;

  resetRunState();
  enterStage(0, true);

  state.started = true;
  state.finished = false;
  state.lastTs = 0;

  logEvent('start', {
    pid: state.ctx.pid || '',
    studyId: state.ctx.studyId || '',
    session: state.ctx.session || '',
    diff: state.diff,
    view: state.view,
    totalSec: state.totalSec
  });

  scheduleSpawn();
  updateHud();
  state.raf = requestAnimationFrame(loop);
}

function startCountdown() {
  let sec = 3;
  showStageBanner('GoodJunk Intervention', `เริ่มใน ${sec}`);
  setCoach('เตรียมพร้อม 🚀', 'อีกไม่กี่วินาทีเกมจะเริ่ม', 'เก็บของดีและหลีกเลี่ยง junk');

  const timer = setInterval(() => {
    sec -= 1;
    if (sec > 0) {
      showStageBanner('GoodJunk Intervention', `เริ่มใน ${sec}`);
    } else {
      clearInterval(timer);
      showStageBanner(currentStage().title, currentStage().desc);
      startRun();
    }
  }, 1000);
}

function onShoot(ev) {
  if (!state.started || state.finished) return;

  const lockPx = Number(ev?.detail?.lockPx ?? 42);
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  let best = null;
  let bestDist = Infinity;

  for (const t of state.active) {
    if (!t.active || !t.el) continue;
    const r = t.el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;

    const dx = ex - cx;
    const dy = ey - cy;
    const withinX = Math.abs(dx) <= (r.width / 2 + lockPx);
    const withinY = Math.abs(dy) <= (r.height / 2 + lockPx);

    if (withinX && withinY) {
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        best = t;
        bestDist = dist;
      }
    }
  }

  if (best) {
    tapTarget(best, 'shoot');
  }
}

function bindShootMode() {
  window.addEventListener('hha:shoot', onShoot);
}

function bindPauseResume() {
  document.addEventListener('visibilitychange', () => {
    if (!state.started || state.finished) return;
    state.paused = document.hidden;

    if (state.paused) {
      setCoach('หยุดชั่วคราว ⏸️', 'กลับมาหน้านี้เพื่อเล่นต่อ', 'เกมจะเล่นต่อเมื่อกลับมาหน้านี้');
    } else {
      state.lastTs = 0;
      const stage = currentStage();
      setCoach(stage.coachHead, stage.coachExplain, stage.hint);
    }
  });

  window.addEventListener('resize', () => {
    calcBounds();
  });
}

function init() {
  ensureExtraStyle();
  bindUiRefs();
  bindPanelToggles();
  buildContext();
  calcBounds();
  bindPauseResume();
  bindShootMode();

  setCoach(
    'พร้อมแล้ว! ยิงของดี 🥦',
    'เกมนี้ช่วยฝึกเลือกของว่างที่ดีต่อสุขภาพ',
    'เริ่มต้นด้วยผลไม้ ผัก น้ำเปล่า และนมจืด'
  );

  updateHud();
  startCountdown();
}

init();

window.GJI_GAME = {
  version: VERSION,
  state,
  start: startRun,
  finish: finishGame
};