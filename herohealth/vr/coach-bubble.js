// === /herohealth/vr/coach-bubble.js ===
// Bubble โค้ชตรงกลางล่าง + ใช้ประโยคจาก hydration-coach-lines.js
// ฟัง quest:update และ hha:end (ใช้ได้กับโหมด Hydration VR)

'use strict';

import { COACH_LINES } from '../hydration-vr/hydration-coach-lines.js';

// ---------- small helpers ----------
function pick(arr) {
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function tmpl(str, vars = {}) {
  if (!str) return '';
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    return (k in vars) ? String(vars[k]) : '';
  });
}

function countDone(list = []) {
  let done = 0;
  for (const x of list) {
    if (x && x.done) done++;
  }
  return { done, total: list.length };
}

// ---------- DOM / UI ----------
let coachEl = null;
let mainEl  = null;
let subEl   = null;
let metaEl  = null;
let hideTimer = null;
let moveTimer = null;

let lastGoalId = null;
let lastMiniId = null;
let introShown = false;

function ensureUI() {
  if (coachEl) return coachEl;

  // style mobile-first
  let css = document.getElementById('coach-style');
  if (!css) {
    css = document.createElement('style');
    css.id = 'coach-style';
    css.textContent = `
      #coachBubble{
        position:fixed;
        left:50%;
        bottom:18px;
        transform:translateX(-50%);
        max-width:420px;
        width:calc(100% - 32px);
        background:rgba(15,23,42,0.94);
        border-radius:999px;
        padding:8px 16px 10px;
        display:flex;
        align-items:center;
        gap:10px;
        box-shadow:0 18px 40px rgba(15,23,42,0.8);
        color:#e5e7eb;
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
        font-size:13px;
        line-height:1.4;
        opacity:0;
        pointer-events:none;
        transition:opacity .28s ease, transform .28s ease, bottom .28s ease;
        z-index:60;
      }
      #coachBubble[data-show="1"]{
        opacity:1;
        pointer-events:auto;
        transform:translateX(-50%) translateY(-4px);
      }
      #coachBubble[data-pos="left"]{
        left:20%;
        transform:translateX(-50%) translateY(-4px);
      }
      #coachBubble[data-pos="right"]{
        left:80%;
        transform:translateX(-50%) translateY(-4px);
      }
      #coachBubble .coach-emoji{
        font-size:26px;
        flex:0 0 auto;
      }
      #coachBubble .coach-text-wrap{
        flex:1 1 auto;
        min-width:0;
      }
      #coachBubble .coach-main{
        font-weight:600;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      #coachBubble .coach-sub{
        font-size:12px;
        color:#9ca3af;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      #coachBubble .coach-meta{
        font-size:11px;
        color:#6b7280;
        margin-top:2px;
      }
      @media (max-width:600px){
        #coachBubble{
          bottom:10px;
          padding:7px 12px 8px;
          font-size:12px;
        }
        #coachBubble .coach-emoji{ font-size:22px; }
        #coachBubble .coach-main{ font-size:12px; }
        #coachBubble .coach-sub{ font-size:11px; }
      }
    `;
    document.head.appendChild(css);
  }

  coachEl = document.createElement('div');
  coachEl.id = 'coachBubble';
  coachEl.dataset.show = '0';
  coachEl.dataset.pos  = 'center';
  coachEl.innerHTML = `
    <div class="coach-emoji">💧</div>
    <div class="coach-text-wrap">
      <div class="coach-main">โค้ชหยดน้ำ</div>
      <div class="coach-sub">ภารกิจใหญ่ + Mini จะแสดงตรงนี้</div>
      <div class="coach-meta"></div>
    </div>
  `;
  document.body.appendChild(coachEl);

  mainEl = coachEl.querySelector('.coach-main');
  subEl  = coachEl.querySelector('.coach-sub');
  metaEl = coachEl.querySelector('.coach-meta');

  // เริ่ม auto-move ซ้าย-ขวาเบา ๆ กันเป้าทับ
  startAutoMove();

  return coachEl;
}

function startAutoMove() {
  if (moveTimer) clearInterval(moveTimer);
  const positions = ['center', 'left', 'center', 'right'];
  let idx = 0;
  moveTimer = setInterval(() => {
    if (!coachEl || coachEl.dataset.show !== '1') return;
    idx = (idx + 1) % positions.length;
    coachEl.dataset.pos = positions[idx];
  }, 6000);
}

function showCoach(main, sub, meta, opt = {}) {
  ensureUI();
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (main && mainEl) mainEl.textContent = main;
  if (sub  && subEl)  subEl.textContent  = sub;
  if (meta && metaEl) metaEl.textContent = meta;

  coachEl.dataset.show = '1';

  const stayMs = opt.stayLong ? 9000 : 5500;
  hideTimer = setTimeout(() => {
    if (coachEl) coachEl.dataset.show = '0';
  }, stayMs);
}

// ---------- Event handlers ----------

function handleIntroOnce() {
  if (introShown) return;
  introShown = true;

  const line = pick(COACH_LINES.intro || []);
  const main = line || 'ไปลุยน้ำดีด้วยกันนะ! 👀💧';
  const sub  = 'เลือกน้ำดี หลบน้ำหวาน แล้วดูโซนน้ำด้านบนให้เป็น GREEN';
  const meta = '';
  showCoach(main, sub, meta, { stayLong: true });
}

function onQuestUpdate(ev) {
  const d = ev.detail || {};
  const goal = d.goal || null;
  const mini = d.mini || null;
  const goalsAll = d.goalsAll || [];
  const minisAll = d.minisAll || [];

  handleIntroOnce();

  let main = '';
  let sub  = '';
  let meta = '';

  const goalChanged = goal && goal.id && goal.id !== lastGoalId;
  const miniChanged = mini && mini.id && mini.id !== lastMiniId;

  if (goalChanged) {
    lastGoalId = goal.id;
    const tpl = pick(COACH_LINES.newGoal || []);
    main = tmpl(tpl, { text: goal.label });
  } else if (miniChanged) {
    lastMiniId = mini.id;
    const tpl = pick(COACH_LINES.newMini || []);
    main = tmpl(tpl, { text: mini.label });
  } else {
    // อัปเดตธรรมดา เลือกจาก progress / goodHit
    const base = (COACH_LINES.progress && COACH_LINES.progress.length)
      ? COACH_LINES.progress
      : (COACH_LINES.goodHit || COACH_LINES.intro || []);
    main = pick(base) || 'สู้ต่ออีกนิด เดี๋ยวก็ถึงเป้าแล้ว! 💪';
  }

  if (goal && mini) {
    sub = `${goal.label} | ${mini.label}`;
  } else if (goal) {
    sub = goal.label;
  } else if (mini) {
    sub = mini.label;
  } else {
    sub = d.hint || '';
  }

  const g = countDone(goalsAll);
  const m = countDone(minisAll);
  meta = `Goals ${g.done}/${g.total} · Mini ${m.done}/${m.total}`;

  showCoach(main, sub, meta, { stayLong: goalChanged || miniChanged });
}

function onGameEnd(ev) {
  const d = ev.detail || {};
  if (d.mode !== 'Hydration') return;

  const good = !!d.goalCleared;
  const pool = good ? (COACH_LINES.endGood || []) : (COACH_LINES.endNeedImprove || []);
  const main = tmpl(
    pick(pool) || (good ? 'ภารกิจวันนี้ทำได้ดีมาก น้ำสมดุลสุด ๆ เลย 💧💚'
                       : 'รอบนี้ใช้ได้เลย รอบหน้ามาลองเก็บคะแนนให้ดีกว่านี้นะ 😉'),
    {}
  );

  const score = d.score ?? 0;
  const green = d.greenTick ?? 0;
  const miss  = d.misses ?? d.miss ?? 0;

  const sub = `Score ${score} · GREEN ${green}s · Miss ${miss}`;

  const goalsCleared = d.goalsCleared ?? 0;
  const goalsTotal   = d.goalsTotal   ?? 0;
  const questsCleared = d.questsCleared ?? 0;
  const questsTotal   = d.questsTotal   ?? 0;

  const meta = `Goals ${goalsCleared}/${goalsTotal} · Mini ${questsCleared}/${questsTotal}`;

  showCoach(main, sub, meta, { stayLong: true });
}

// ---------- boot ----------
function bootCoach() {
  ensureUI();
  window.addEventListener('quest:update', onQuestUpdate);
  window.addEventListener('hha:end', onGameEnd);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootCoach);
} else {
  bootCoach();
}

// ไม่มี export อะไร ใช้เป็น side-effect module เฉย ๆ
export {};
