// === /goodjunk-intervention/game/goodjunk.safe.js ===
// GoodJunk Intervention - Full Safe Game Script
// FULL PATCH v20260318b-GJI-GAME-FULL
//
// Flow:
// launcher -> pre-knowledge -> pre-behavior -> game -> summary -> post-knowledge -> post-behavior -> post-choice -> completion
//
// Notes:
// - self-mount overlay UI
// - child-friendly serious game
// - saves GJI_GAME_SUMMARY
// - redirects to game/summary.html on finish
// - works on mobile / desktop
//
// Required sibling files:
// - ../research/config.js
// - ../research/localstore.js

import { buildUrl, pickCtxFromQuery, withDefaultCtx } from '../research/config.js';
import { KEYS, loadCtx, mergeCtx, saveCtx, saveJSON, loadJSON } from '../research/localstore.js';

const VERSION = 'v20260318b-GJI-GAME-FULL';

const FOODS = {
  good: [
    { id: 'apple', label: 'แอปเปิล', emoji: '🍎', points: 10, tip: 'ผลไม้ช่วยให้ร่างกายสดชื่นและได้ใยอาหาร' },
    { id: 'banana', label: 'กล้วย', emoji: '🍌', points: 10, tip: 'กล้วยช่วยให้อิ่มและมีพลังงาน' },
    { id: 'orange', label: 'ส้ม', emoji: '🍊', points: 10, tip: 'ส้มมีวิตามินและรสสดชื่น' },
    { id: 'carrot', label: 'แครอท', emoji: '🥕', points: 12, tip: 'ผักช่วยให้ร่างกายแข็งแรง' },
    { id: 'broccoli', label: 'บรอกโคลี', emoji: '🥦', points: 12, tip: 'ผักดีต่อร่างกายและควรกินบ่อย' },
    { id: 'milk', label: 'นมจืด', emoji: '🥛', points: 11, tip: 'นมจืดดีกว่าน้ำหวาน' },
    { id: 'water', label: 'น้ำเปล่า', emoji: '💧', points: 11, tip: 'น้ำเปล่าช่วยดับกระหายได้ดี' },
    { id: 'corn', label: 'ข้าวโพด', emoji: '🌽', points: 10, tip: 'อาหารธรรมชาติดีกว่าขนมหวาน' },
    { id: 'pear', label: 'ลูกแพร์', emoji: '🍐', points: 10, tip: 'ผลไม้เป็นของว่างที่ดี' },
    { id: 'cucumber', label: 'แตงกวา', emoji: '🥒', points: 12, tip: 'ผักสดเป็นตัวเลือกที่ดีต่อสุขภาพ' }
  ],
  junk: [
    { id: 'chips', label: 'มันฝรั่งทอด', emoji: '🍟', points: -8, tip: 'ของทอดกินบ่อยไม่ดีต่อร่างกาย' },
    { id: 'soda', label: 'น้ำอัดลม', emoji: '🥤', points: -9, tip: 'น้ำอัดลมมีน้ำตาลสูง' },
    { id: 'candy', label: 'ลูกอม', emoji: '🍬', points: -8, tip: 'ขนมหวานกินมากเกินไปไม่ดี' },
    { id: 'donut', label: 'โดนัท', emoji: '🍩', points: -8, tip: 'ของหวานควรกินแต่น้อย' },
    { id: 'cake', label: 'เค้ก', emoji: '🍰', points: -8, tip: 'ของหวานกินได้บ้าง แต่ไม่ควรบ่อย' },
    { id: 'cookie', label: 'คุกกี้', emoji: '🍪', points: -7, tip: 'ขนมหวานไม่ควรเป็นของว่างประจำ' },
    { id: 'burger', label: 'เบอร์เกอร์', emoji: '🍔', points: -9, tip: 'อาหารแปรรูปมากควรเลือกให้น้อยลง' },
    { id: 'sweettea', label: 'ชาหวาน', emoji: '🧋', points: -9, tip: 'เครื่องดื่มหวานจัดมีน้ำตาลสูง' },
    { id: 'icecream', label: 'ไอศกรีม', emoji: '🍨', points: -8, tip: 'หวานเย็นอร่อย แต่ไม่ควรกินบ่อย' }
  ]
};

const STAGE_BLUEPRINTS = [
  {
    name: 'ด่าน 1 • เลือกของว่างดี',
    coach: 'เก็บอาหารดีให้มากที่สุด และอย่ากดของหวาน',
    targetGood: 6,
    spawnEvery: 1050,
    speedMin: 110,
    speedMax: 160,
    junkRatio: 0.35
  },
  {
    name: 'ด่าน 2 • นักเลือกของว่างฉลาด',
    coach: 'เริ่มเร็วขึ้นแล้ว สังเกตให้ดี เลือกของดีแทนขนมหวาน',
    targetGood: 9,
    spawnEvery: 850,
    speedMin: 145,
    speedMax: 210,
    junkRatio: 0.45
  },
  {
    name: 'ด่าน 3 • HeroHealth Rush',
    coach: 'ด่านสุดท้าย เก็บของดีต่อเนื่องเพื่อทำคอมโบ',
    targetGood: 12,
    spawnEvery: 650,
    speedMin: 190,
    speedMax: 270,
    junkRatio: 0.52
  }
];

const DEFAULTS = {
  duration: 60,
  maxActive: 9,
  comboBonusEvery: 5,
  comboBonusScore: 8,
  avoidReward: 1,
  missPenalty: 4,
  junkTapPenalty: 8
};

const state = {
  ctx: {},
  runMode: 'play',
  diff: 'normal',
  totalDuration: DEFAULTS.duration,
  totalElapsedMs: 0,
  stageIndex: 0,
  started: false,
  finished: false,
  paused: false,

  score: 0,
  combo: 0,
  bestCombo: 0,
  goodHit: 0,
  junkHit: 0,
  miss: 0,
  junkAvoided: 0,
  totalTap: 0,
  stars: 0,

  stageGoodStart: 0,
  stageEnteredAtMs: 0,

  rafId: 0,
  timerId: 0,
  spawnTimeout: 0,
  lastTs: 0,

  activeItems: [],
  events: [],
  eventCap: 700,

  els: {},
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

function nowIso() {
  return new Date().toISOString();
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

function readQueryCtx() {
  const params = getParams();
  return withDefaultCtx({
    ...pickCtxFromQuery(),
    run: params.get('run') || 'play',
    diff: params.get('diff') || 'normal',
    time: params.get('time') || '',
    zone: params.get('zone') || 'nutrition',
    game: params.get('game') || 'goodjunk'
  });
}

function durationFromQuery() {
  const params = getParams();
  const t = safeNum(params.get('time'), DEFAULTS.duration);
  return clamp(t || DEFAULTS.duration, 30, 180);
}

function difficultyScale() {
  if (state.diff === 'easy') return 0.88;
  if (state.diff === 'hard') return 1.18;
  return 1.0;
}

function stageDurationMs() {
  return (state.totalDuration * 1000) / STAGE_BLUEPRINTS.length;
}

function getStageIndexByElapsed(elapsedMs) {
  const idx = Math.floor(elapsedMs / stageDurationMs());
  return clamp(idx, 0, STAGE_BLUEPRINTS.length - 1);
}

function currentStage() {
  return STAGE_BLUEPRINTS[state.stageIndex];
}

function logEvent(type, data = {}) {
  const evt = {
    at: nowIso(),
    t: Math.round(state.totalElapsedMs),
    stage: state.stageIndex + 1,
    type,
    ...data
  };
  state.events.push(evt);
  if (state.events.length > state.eventCap) {
    state.events.splice(0, state.events.length - state.eventCap);
  }
}

function ensureStyle() {
  if (document.getElementById('gji-safe-style')) return;
  const style = document.createElement('style');
  style.id = 'gji-safe-style';
  style.textContent = `
    :root{
      --gji-bg:#07111f;
      --gji-panel:rgba(2,6,23,.76);
      --gji-panel2:rgba(15,23,42,.84);
      --gji-stroke:rgba(148,163,184,.16);
      --gji-text:#f8fafc;
      --gji-muted:#cbd5e1;
      --gji-good:#22c55e;
      --gji-junk:#ef4444;
      --gji-blue:#38bdf8;
      --gji-yellow:#facc15;
      --gji-shadow:0 18px 50px rgba(0,0,0,.34);
    }
    #gji-root, .gji-root{
      position:fixed;
      inset:0;
      z-index:1200;
      color:var(--gji-text);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      pointer-events:none;
      overflow:hidden;
    }
    .gji-bg{
      position:absolute;
      inset:0;
      background:
        radial-gradient(circle at top left, rgba(34,197,94,.14), transparent 26%),
        radial-gradient(circle at top right, rgba(56,189,248,.12), transparent 28%),
        linear-gradient(180deg, rgba(2,6,23,.2), rgba(2,6,23,.12));
      pointer-events:none;
    }
    .gji-top{
      position:absolute;
      left:12px;
      right:12px;
      top:12px;
      display:grid;
      gap:10px;
      pointer-events:none;
    }
    .gji-row{
      display:grid;
      grid-template-columns:1.25fr 1fr;
      gap:10px;
    }
    .gji-card{
      background:var(--gji-panel);
      border:1px solid var(--gji-stroke);
      border-radius:20px;
      box-shadow:var(--gji-shadow);
      backdrop-filter: blur(8px);
      pointer-events:auto;
    }
    .gji-maincard{
      padding:14px 16px;
    }
    .gji-title{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      font-weight:900;
      font-size:18px;
      margin-bottom:6px;
    }
    .gji-title small{
      font-size:12px;
      color:var(--gji-muted);
      font-weight:700;
    }
    .gji-sub{
      color:var(--gji-muted);
      font-size:14px;
      line-height:1.35;
    }
    .gji-stats{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:10px;
      padding:12px;
    }
    .gji-stat{
      background:rgba(15,23,42,.78);
      border:1px solid var(--gji-stroke);
      border-radius:16px;
      padding:10px 12px;
      min-width:0;
    }
    .gji-stat .k{
      color:var(--gji-muted);
      font-size:12px;
      font-weight:700;
    }
    .gji-stat .v{
      font-size:24px;
      font-weight:900;
      margin-top:4px;
      line-height:1;
    }
    .gji-barwrap{
      margin-top:10px;
      display:grid;
      gap:8px;
    }
    .gji-bar{
      height:12px;
      border-radius:999px;
      background:rgba(148,163,184,.12);
      overflow:hidden;
      border:1px solid rgba(148,163,184,.12);
    }
    .gji-fill{
      height:100%;
      width:0%;
      background:linear-gradient(90deg,var(--gji-good),var(--gji-blue));
      transition:width .16s linear;
    }
    .gji-meta{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:10px;
    }
    .gji-pill{
      display:inline-flex;
      align-items:center;
      gap:6px;
      min-height:34px;
      padding:8px 12px;
      border-radius:999px;
      background:rgba(15,23,42,.82);
      border:1px solid var(--gji-stroke);
      font-size:13px;
      font-weight:800;
    }
    .gji-coach{
      position:absolute;
      left:12px;
      right:12px;
      bottom:12px;
      padding:14px 16px;
      font-size:15px;
      line-height:1.4;
      background:var(--gji-panel2);
      border:1px solid var(--gji-stroke);
      border-radius:20px;
      box-shadow:var(--gji-shadow);
      backdrop-filter: blur(8px);
      pointer-events:none;
    }
    .gji-playfield{
      position:absolute;
      inset:140px 8px 92px;
      pointer-events:none;
      overflow:hidden;
    }
    .gji-item{
      position:absolute;
      pointer-events:auto;
      user-select:none;
      touch-action:manipulation;
      min-width:72px;
      min-height:72px;
      padding:8px 10px;
      border-radius:22px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(15,23,42,.9);
      box-shadow:0 12px 28px rgba(0,0,0,.28);
      display:grid;
      place-items:center;
      gap:4px;
      text-align:center;
      transform:translate(-50%, -50%);
      transition:transform .08s ease;
    }
    .gji-item:hover,
    .gji-item:active{
      transform:translate(-50%, -50%) scale(1.05);
    }
    .gji-item.good{
      border-color:rgba(34,197,94,.36);
      background:linear-gradient(180deg, rgba(22,101,52,.92), rgba(15,23,42,.92));
    }
    .gji-item.junk{
      border-color:rgba(239,68,68,.34);
      background:linear-gradient(180deg, rgba(127,29,29,.92), rgba(15,23,42,.92));
    }
    .gji-emoji{
      font-size:30px;
      line-height:1;
    }
    .gji-label{
      font-size:12px;
      font-weight:900;
      line-height:1.1;
      white-space:nowrap;
    }
    .gji-start,
    .gji-finish{
      position:absolute;
      inset:0;
      display:grid;
      place-items:center;
      padding:18px;
      background:rgba(2,6,23,.56);
      backdrop-filter: blur(6px);
      pointer-events:auto;
    }
    .gji-modal{
      width:min(860px,100%);
      background:rgba(10,18,34,.94);
      border:1px solid var(--gji-stroke);
      border-radius:28px;
      box-shadow:var(--gji-shadow);
      padding:22px;
    }
    .gji-badge{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 12px;
      border-radius:999px;
      background:rgba(34,197,94,.16);
      border:1px solid rgba(34,197,94,.28);
      color:#dcfce7;
      font-weight:900;
      font-size:14px;
    }
    .gji-modal h1{
      margin:14px 0 8px;
      font-size:clamp(28px, 4vw, 40px);
      line-height:1.05;
    }
    .gji-modal p{
      margin:0 0 14px;
      color:var(--gji-muted);
      line-height:1.45;
    }
    .gji-rulegrid{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:12px;
      margin:16px 0;
    }
    .gji-rule{
      padding:16px;
      border-radius:20px;
      background:rgba(15,23,42,.78);
      border:1px solid var(--gji-stroke);
    }
    .gji-rule h3{
      margin:0 0 8px;
      font-size:18px;
    }
    .gji-rule p{
      margin:0;
      font-size:14px;
    }
    .gji-actions{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-top:18px;
    }
    .gji-btn{
      min-height:50px;
      padding:12px 16px;
      border-radius:16px;
      border:none;
      font-weight:900;
      cursor:pointer;
      pointer-events:auto;
    }
    .gji-btn.primary{
      background:linear-gradient(180deg,var(--gji-good),#16a34a);
      color:white;
    }
    .gji-btn.ghost{
      background:rgba(148,163,184,.12);
      color:var(--gji-text);
      border:1px solid var(--gji-stroke);
    }
    .gji-tiplist{
      display:grid;
      gap:8px;
      margin-top:12px;
      color:var(--gji-muted);
      font-size:14px;
    }
    .gji-flash{
      position:absolute;
      top:50%;
      left:50%;
      transform:translate(-50%,-50%);
      padding:14px 18px;
      border-radius:18px;
      background:rgba(2,6,23,.9);
      border:1px solid rgba(148,163,184,.18);
      font-size:20px;
      font-weight:900;
      box-shadow:var(--gji-shadow);
      pointer-events:none;
      opacity:0;
      transition:opacity .18s ease, transform .18s ease;
    }
    .gji-flash.show{
      opacity:1;
      transform:translate(-50%,-50%) scale(1.03);
    }
    .gji-legend{
      color:var(--gji-muted);
      font-size:13px;
      margin-top:8px;
    }
    @media (max-width: 860px){
      .gji-row{ grid-template-columns:1fr; }
      .gji-stats{ grid-template-columns:repeat(2,1fr); }
      .gji-rulegrid{ grid-template-columns:1fr; }
      .gji-playfield{ inset:176px 6px 92px; }
      .gji-item{ min-width:64px; min-height:64px; border-radius:18px; }
    }
  `;
  document.head.appendChild(style);
}

function ensureMount() {
  ensureStyle();

  let root = document.getElementById('gji-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'gji-root';
    root.className = 'gji-root';
    root.innerHTML = `
      <div class="gji-bg"></div>

      <div class="gji-top">
        <div class="gji-row">
          <div class="gji-card gji-maincard">
            <div class="gji-title">
              <span id="gjiStageName">GoodJunk Intervention</span>
              <small id="gjiVersion">${VERSION}</small>
            </div>
            <div class="gji-sub" id="gjiMissionLine">เลือกอาหารดีต่อร่างกาย และหลีกเลี่ยงของหวานกับของทอด</div>

            <div class="gji-barwrap">
              <div class="gji-bar"><div class="gji-fill" id="gjiTimeFill"></div></div>
              <div class="gji-bar"><div class="gji-fill" id="gjiStageFill"></div></div>
            </div>

            <div class="gji-meta">
              <div class="gji-pill" id="gjiTimerPill">⏱️ เวลา 00</div>
              <div class="gji-pill" id="gjiComboPill">🔥 คอมโบ 0</div>
              <div class="gji-pill" id="gjiTargetPill">🎯 ภารกิจ 0/0</div>
              <div class="gji-pill" id="gjiCtxPill">🧪 PID -</div>
            </div>

            <div class="gji-legend">เก็บของดี = คะแนนเพิ่ม • กดของหวาน/ของทอด = คะแนนลด • ปล่อยของดีตก = พลาด</div>
          </div>

          <div class="gji-card">
            <div class="gji-stats">
              <div class="gji-stat"><div class="k">คะแนน</div><div class="v" id="gjiScore">0</div></div>
              <div class="gji-stat"><div class="k">เลือกดี</div><div class="v" id="gjiGood">0</div></div>
              <div class="gji-stat"><div class="k">Junk ที่กด</div><div class="v" id="gjiJunk">0</div></div>
              <div class="gji-stat"><div class="k">พลาด</div><div class="v" id="gjiMiss">0</div></div>
            </div>
          </div>
        </div>
      </div>

      <div class="gji-playfield" id="gjiPlayfield"></div>
      <div class="gji-flash" id="gjiFlash"></div>
      <div class="gji-coach" id="gjiCoach">พร้อมเริ่มภารกิจเลือกของว่างสุขภาพ</div>

      <div class="gji-start" id="gjiStartOverlay">
        <div class="gji-modal">
          <div class="gji-badge">GoodJunk Intervention</div>
          <h1>ภารกิจเลือกของว่างสุขภาพ</h1>
          <p>
            วันนี้หนูจะช่วย HeroHealth เลือกอาหารและเครื่องดื่มที่ดีต่อร่างกาย
            เก็บของดีให้มากที่สุด และอย่ากดของหวานหรือของทอดนะ
          </p>

          <div class="gji-rulegrid">
            <div class="gji-rule">
              <h3>🍎 เก็บของดี</h3>
              <p>แตะผลไม้ ผัก นมจืด หรือน้ำเปล่า เพื่อรับคะแนนและทำคอมโบ</p>
            </div>
            <div class="gji-rule">
              <h3>🍟 เลี่ยง Junk</h3>
              <p>อย่ากดของทอด น้ำอัดลม และขนมหวาน เพราะจะเสียคะแนน</p>
            </div>
            <div class="gji-rule">
              <h3>🎯 ทำภารกิจ</h3>
              <p>แต่ละด่านจะเร็วขึ้น พยายามเลือกของดีให้ถึงเป้าหมายของด่าน</p>
            </div>
          </div>

          <div class="gji-tiplist">
            <div>• เก็บของดีต่อเนื่องจะได้คอมโบ</div>
            <div>• ถ้าปล่อยอาหารดีตก จะนับเป็นพลาด</div>
            <div>• จบเกมแล้วจะมีคำถามสั้น ๆ หลังเล่น</div>
          </div>

          <div class="gji-actions">
            <button class="gji-btn primary" id="gjiStartBtn">เริ่มเกม</button>
            <button class="gji-btn ghost" id="gjiBackBtn">กลับหน้าเริ่ม</button>
          </div>
        </div>
      </div>

      <div class="gji-finish" id="gjiFinishOverlay" style="display:none;">
        <div class="gji-modal">
          <div class="gji-badge">กำลังสรุปผล</div>
          <h1>เยี่ยมมาก 🎉</h1>
          <p>กำลังบันทึกผลเกมและพาไปหน้าสรุป...</p>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  state.els.root = root;
  state.els.stageName = root.querySelector('#gjiStageName');
  state.els.missionLine = root.querySelector('#gjiMissionLine');
  state.els.timeFill = root.querySelector('#gjiTimeFill');
  state.els.stageFill = root.querySelector('#gjiStageFill');
  state.els.timerPill = root.querySelector('#gjiTimerPill');
  state.els.comboPill = root.querySelector('#gjiComboPill');
  state.els.targetPill = root.querySelector('#gjiTargetPill');
  state.els.ctxPill = root.querySelector('#gjiCtxPill');
  state.els.score = root.querySelector('#gjiScore');
  state.els.good = root.querySelector('#gjiGood');
  state.els.junk = root.querySelector('#gjiJunk');
  state.els.miss = root.querySelector('#gjiMiss');
  state.els.playfield = root.querySelector('#gjiPlayfield');
  state.els.flash = root.querySelector('#gjiFlash');
  state.els.coach = root.querySelector('#gjiCoach');
  state.els.startOverlay = root.querySelector('#gjiStartOverlay');
  state.els.finishOverlay = root.querySelector('#gjiFinishOverlay');
  state.els.startBtn = root.querySelector('#gjiStartBtn');
  state.els.backBtn = root.querySelector('#gjiBackBtn');
}

function renderHud() {
  const st = currentStage();
  const elapsedSec = Math.floor(state.totalElapsedMs / 1000);
  const left = Math.max(0, state.totalDuration - elapsedSec);
  const totalPct = clamp((state.totalElapsedMs / (state.totalDuration * 1000)) * 100, 0, 100);

  const stageGood = state.goodHit - state.stageGoodStart;
  const stagePct = clamp((stageGood / Math.max(1, st.targetGood)) * 100, 0, 100);

  state.els.stageName.textContent = st.name;
  state.els.missionLine.textContent = st.coach;
  state.els.timeFill.style.width = `${totalPct}%`;
  state.els.stageFill.style.width = `${stagePct}%`;
  state.els.timerPill.textContent = `⏱️ เวลา ${String(left).padStart(2, '0')}`;
  state.els.comboPill.textContent = `🔥 คอมโบ ${state.combo}`;
  state.els.targetPill.textContent = `🎯 ภารกิจ ${stageGood}/${st.targetGood}`;
  state.els.ctxPill.textContent = `🧪 PID ${state.ctx.pid || '-'}`;
  state.els.score.textContent = String(state.score);
  state.els.good.textContent = String(state.goodHit);
  state.els.junk.textContent = String(state.junkHit);
  state.els.miss.textContent = String(state.miss);
}

function coach(text) {
  state.els.coach.textContent = text;
}

let flashTimer = 0;
function flash(text) {
  const el = state.els.flash;
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 650);
}

function showStart() {
  state.els.startOverlay.style.display = '';
}

function hideStart() {
  state.els.startOverlay.style.display = 'none';
}

function showFinish() {
  state.els.finishOverlay.style.display = '';
}

function clearPlayfield() {
  for (const it of state.activeItems) {
    try { it.el.remove(); } catch {}
  }
  state.activeItems = [];
}

function resetState() {
  state.started = false;
  state.finished = false;
  state.paused = false;

  state.totalElapsedMs = 0;
  state.stageIndex = 0;

  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.goodHit = 0;
  state.junkHit = 0;
  state.miss = 0;
  state.junkAvoided = 0;
  state.totalTap = 0;
  state.stars = 0;

  state.stageGoodStart = 0;
  state.stageEnteredAtMs = 0;

  state.lastTs = 0;
  clearTimeout(state.timerId);
  clearTimeout(state.spawnTimeout);
  cancelAnimationFrame(state.rafId);

  clearPlayfield();
  renderHud();
}

function updateStageByElapsed() {
  const nextIdx = getStageIndexByElapsed(state.totalElapsedMs);
  if (nextIdx !== state.stageIndex) {
    state.stageIndex = nextIdx;
    state.stageEnteredAtMs = state.totalElapsedMs;
    state.stageGoodStart = state.goodHit;

    const st = currentStage();
    coach(st.coach);
    flash(`เริ่ม ${st.name}`);
    logEvent('stage_enter', { name: st.name });
    renderHud();
  }
}

function makeItemKind() {
  const st = currentStage();
  return Math.random() < st.junkRatio ? 'junk' : 'good';
}

function createItemModel() {
  const kind = makeItemKind();
  const food = pick(FOODS[kind]);
  const st = currentStage();

  const scale = difficultyScale();
  const field = state.els.playfield.getBoundingClientRect();

  const x = rand(9, 91);
  const size = randint(72, 96);
  const pxPerSec = rand(st.speedMin, st.speedMax) * scale;

  return {
    id: `gji_item_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    kind,
    food,
    xPct: x,
    yPx: -size,
    size,
    speed: pxPerSec,
    alive: true,
    fieldH: field.height
  };
}

function makeItemElement(model) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `gji-item ${model.kind}`;
  btn.setAttribute('aria-label', `${model.food.label} ${model.kind === 'good' ? 'ของดี' : 'junk'}`);
  btn.innerHTML = `
    <div class="gji-emoji">${model.food.emoji}</div>
    <div class="gji-label">${model.food.label}</div>
  `;
  btn.style.left = `${model.xPct}%`;
  btn.style.top = `${model.yPx}px`;
  btn.style.width = `${model.size}px`;
  btn.style.height = `${model.size}px`;

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onTapItem(model);
  }, { passive: false });

  btn.addEventListener('touchstart', (ev) => {
    ev.preventDefault();
  }, { passive: false });

  return btn;
}

function spawnOne() {
  if (!state.started || state.finished || state.paused) return;
  if (state.activeItems.length >= DEFAULTS.maxActive) {
    scheduleSpawn();
    return;
  }

  const model = createItemModel();
  model.el = makeItemElement(model);

  state.activeItems.push(model);
  state.els.playfield.appendChild(model.el);

  logEvent('spawn', {
    itemId: model.id,
    item: model.food.id,
    label: model.food.label,
    kind: model.kind
  });

  scheduleSpawn();
}

function scheduleSpawn() {
  clearTimeout(state.spawnTimeout);
  if (!state.started || state.finished) return;

  const st = currentStage();
  const scale = difficultyScale();
  const delay = Math.max(360, st.spawnEvery / scale);

  state.spawnTimeout = setTimeout(spawnOne, delay);
}

function awardComboBonus() {
  if (state.combo > 0 && state.combo % DEFAULTS.comboBonusEvery === 0) {
    state.score += DEFAULTS.comboBonusScore;
    flash(`คอมโบ x${state.combo} โบนัส +${DEFAULTS.comboBonusScore}`);
    coach('เยี่ยมมาก เลือกของดีต่อเนื่องได้สุดยอด');
    logEvent('combo_bonus', {
      combo: state.combo,
      score: state.score
    });
  }
}

function removeItem(model) {
  model.alive = false;
  try { model.el.remove(); } catch {}
  const idx = state.activeItems.indexOf(model);
  if (idx >= 0) state.activeItems.splice(idx, 1);
}

function onTapItem(model) {
  if (!state.started || state.finished || !model.alive) return;

  state.totalTap += 1;

  if (model.kind === 'good') {
    state.goodHit += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.score += model.food.points;

    flash(`+${model.food.points} ${model.food.emoji}`);
    coach(`${model.food.label} ดีมาก! ${model.food.tip}`);
    logEvent('tap_good', {
      itemId: model.id,
      item: model.food.id,
      label: model.food.label,
      score: state.score,
      combo: state.combo
    });

    awardComboBonus();
  } else {
    state.junkHit += 1;
    state.combo = 0;
    state.score = Math.max(0, state.score + model.food.points - DEFAULTS.junkTapPenalty + Math.abs(model.food.points));
    state.score = Math.max(0, state.score - DEFAULTS.junkTapPenalty);

    flash(`ระวัง! ${model.food.emoji}`);
    coach(`${model.food.label} ควรเลือกให้น้อยลงนะ ${model.food.tip}`);
    logEvent('tap_junk', {
      itemId: model.id,
      item: model.food.id,
      label: model.food.label,
      score: state.score
    });
  }

  removeItem(model);
  renderHud();
}

function onMissItem(model) {
  if (!model.alive) return;

  if (model.kind === 'good') {
    state.miss += 1;
    state.combo = 0;
    state.score = Math.max(0, state.score - DEFAULTS.missPenalty);
    coach(`พลาด ${model.food.label} ไปแล้ว ครั้งหน้าลองรีบเลือกอาหารดีนะ`);
    logEvent('miss_good', {
      itemId: model.id,
      item: model.food.id,
      label: model.food.label,
      score: state.score
    });
  } else {
    state.junkAvoided += 1;
    state.score += DEFAULTS.avoidReward;
    logEvent('avoid_junk', {
      itemId: model.id,
      item: model.food.id,
      label: model.food.label,
      score: state.score
    });
  }

  removeItem(model);
  renderHud();
}

function tickItems(dtSec) {
  const field = state.els.playfield.getBoundingClientRect();
  for (let i = state.activeItems.length - 1; i >= 0; i -= 1) {
    const model = state.activeItems[i];
    if (!model.alive) continue;

    model.yPx += model.speed * dtSec;
    model.el.style.top = `${model.yPx}px`;

    if (model.yPx > field.height + model.size) {
      onMissItem(model);
    }
  }
}

function loop(ts) {
  if (!state.started || state.finished) return;
  if (!state.lastTs) state.lastTs = ts;

  const dt = Math.min(0.04, (ts - state.lastTs) / 1000);
  state.lastTs = ts;

  if (!state.paused) {
    state.totalElapsedMs += dt * 1000;
    updateStageByElapsed();
    tickItems(dt);
    renderHud();

    if (state.totalElapsedMs >= state.totalDuration * 1000) {
      finishGame();
      return;
    }
  }

  state.rafId = requestAnimationFrame(loop);
}

function countStars() {
  const accuracyBase = state.goodHit + state.junkHit + state.miss;
  const accuracy = accuracyBase > 0 ? state.goodHit / accuracyBase : 0;
  let stars = 1;

  if (state.goodHit >= 10) stars += 1;
  if (accuracy >= 0.6) stars += 1;
  if (state.bestCombo >= 5) stars += 1;

  return clamp(stars, 1, 4);
}

function buildSummary() {
  const totalAnswers = state.goodHit + state.junkHit + state.miss;
  const accuracy = totalAnswers > 0 ? state.goodHit / totalAnswers : 0;

  return {
    version: VERSION,
    endedAt: nowIso(),
    score: state.score,
    goodHit: state.goodHit,
    junkHit: state.junkHit,
    miss: state.miss,
    junkAvoided: state.junkAvoided,
    comboBest: state.bestCombo,
    totalTap: state.totalTap,
    totalElapsedMs: Math.round(state.totalElapsedMs),
    accuracy: Number(accuracy.toFixed(4)),
    stars: countStars(),
    stageReached: state.stageIndex + 1,
    runMode: state.runMode,
    diff: state.diff,
    duration: state.totalDuration
  };
}

function finishGame() {
  if (state.finished) return;
  state.finished = true;
  state.started = false;

  clearTimeout(state.spawnTimeout);
  cancelAnimationFrame(state.rafId);
  clearPlayfield();

  const summary = buildSummary();
  saveJSON(KEYS.GAME_SUMMARY, summary);
  saveJSON(KEYS.GAME_EVENTS, state.events);

  logEvent('finish', summary);
  showFinish();

  setTimeout(() => {
    const ctx = loadCtx();
    window.location.href = buildUrl('GAME_SUMMARY', ctx, false);
  }, 850);
}

function setupStage0() {
  state.stageIndex = 0;
  state.stageEnteredAtMs = 0;
  state.stageGoodStart = 0;
  coach(currentStage().coach);
  renderHud();
}

function startGame() {
  if (state.started) return;

  resetState();
  setupStage0();
  hideStart();

  state.started = true;
  state.finished = false;
  state.lastTs = 0;

  logEvent('start', {
    pid: state.ctx.pid || '',
    session: state.ctx.session || '',
    condition: state.ctx.condition || '',
    diff: state.diff,
    duration: state.totalDuration
  });

  flash('เริ่มภารกิจ!');
  scheduleSpawn();
  state.rafId = requestAnimationFrame(loop);
}

function backToLauncher() {
  const ctx = loadCtx();
  window.location.href = buildUrl('STUDENT_LAUNCHER', ctx, false);
}

function bindUi() {
  state.els.startBtn?.addEventListener('click', startGame);
  state.els.backBtn?.addEventListener('click', backToLauncher);

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!state.started && !state.finished) {
        backToLauncher();
      }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!state.started || state.finished) return;
    state.paused = document.hidden;
    if (state.paused) {
      coach('เกมหยุดชั่วคราว กลับมาหน้านี้เพื่อเล่นต่อ');
    } else {
      coach(currentStage().coach);
      state.lastTs = 0;
    }
  });
}

function warmBootExistingSummary() {
  const oldSummary = loadJSON(KEYS.GAME_SUMMARY, null);
  if (!oldSummary) return;
  // keep old summary until next finish; no auto clear
}

function initCtx() {
  const queryCtx = readQueryCtx();
  mergeCtx(queryCtx);
  state.ctx = withDefaultCtx(loadCtx());
  state.runMode = state.ctx.run || 'play';
  state.diff = state.ctx.diff || 'normal';
  state.totalDuration = durationFromQuery();
  saveCtx(state.ctx);
}

function initSceneNote() {
  const ctxText = [
    state.ctx.pid ? `PID ${state.ctx.pid}` : 'PID -',
    state.ctx.studyId ? `Study ${state.ctx.studyId}` : 'Study -',
    state.ctx.session ? `Session ${state.ctx.session}` : 'Session -'
  ].join(' • ');

  state.els.ctxPill.textContent = `🧪 ${ctxText}`;
  coach('พร้อมเริ่มภารกิจเลือกของว่างสุขภาพ');
}

function init() {
  initCtx();
  ensureMount();
  bindUi();
  warmBootExistingSummary();
  resetState();
  initSceneNote();
  showStart();
}

init();

window.GJI_GAME = {
  version: VERSION,
  getState: () => ({
    ctx: state.ctx,
    started: state.started,
    finished: state.finished,
    score: state.score,
    goodHit: state.goodHit,
    junkHit: state.junkHit,
    miss: state.miss,
    combo: state.combo,
    bestCombo: state.bestCombo,
    totalElapsedMs: state.totalElapsedMs,
    stageIndex: state.stageIndex
  }),
  start: startGame,
  finish: finishGame,
  backToLauncher
};