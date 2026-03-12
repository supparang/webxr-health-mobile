/* === /herohealth/gate/games/jumpduck/warmup.js ===
 * JumpDuck Warmup Mini Game
 * Phase: warmup
 * HeroHealth Gate Game Module
 */

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function qs(ctx, key, fallback = '') {
  try {
    if (ctx && ctx.url) return ctx.url.searchParams.get(key) ?? fallback;
    return new URL(window.location.href).searchParams.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function makeStars(score) {
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function ensureGameStyle(ctx) {
  const href = './gate/games/jumpduck/style.css';
  const id = 'hh-gate-style-jumpduck';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function makeResult(state, extra = {}) {
  const score = clamp(Math.round((state.correct / Math.max(1, state.total)) * 100), 0, 100);
  return {
    ok: true,
    zone: 'exercise',
    game: 'jumpduck',
    phase: 'warmup',
    activityId: 'jumpduck-quick-feet-prep',
    title: 'Quick Feet Prep',
    passed: score >= 60 || state.correct >= 4,
    score,
    stars: makeStars(score),
    metrics: {
      total: state.total,
      correct: state.correct,
      wrong: state.wrong,
      misses: state.misses,
      avgReactionMs: state.reactionCount ? Math.round(state.reactionSum / state.reactionCount) : 0,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: score >= 60 ? 'positive' : 'gentle',
      line: score >= 60
        ? 'ขาพร้อมแล้ว ไปเริ่ม Jump Duck กัน'
        : 'อุ่นเครื่องอีกนิดนะ ตั้งจังหวะซ้าย ขวา ย่อ กระโดดให้แม่นขึ้น'
    },
    nextAction: 'run',
    ...extra
  };
}

export function mount(root, ctx = {}) {
  ensureGameStyle(ctx);

  const onComplete = typeof ctx.onComplete === 'function' ? ctx.onComplete : () => {};
  const seed = Number(qs(ctx, 'seed', Date.now()));
  const phase = qs(ctx, 'phase', 'warmup');
  if (phase !== 'warmup') {
    root.innerHTML = `<div class="jdg-wrap"><div class="jdg-card"><h2>Phase ไม่ตรง</h2><p>โมดูลนี้ใช้สำหรับ warmup เท่านั้น</p></div></div>`;
    return;
  }

  const CUES = [
    { id: 'left', label: 'ซ้าย', emoji: '⬅️' },
    { id: 'right', label: 'ขวา', emoji: '➡️' },
    { id: 'duck', label: 'ย่อ', emoji: '⬇️' },
    { id: 'jump', label: 'กระโดด', emoji: '⬆️' }
  ];

  const TOTAL_ROUNDS = 8;
  const ROUND_MS = 1800;
  const GAME_SEC = 20;

  const state = {
    seed,
    started: false,
    finished: false,
    total: 0,
    correct: 0,
    wrong: 0,
    misses: 0,
    reactionSum: 0,
    reactionCount: 0,
    roundIndex: -1,
    cueAt: 0,
    cues: [],
    roundTimer: null,
    gameTimer: null,
    remainSec: GAME_SEC
  };

  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const idx = Math.abs((seed + i * 11) % CUES.length);
    state.cues.push(CUES[idx]);
  }

  root.innerHTML = `
    <div class="jdg-wrap">
      <section class="jdg-card">
        <div class="jdg-kicker">EXERCISE ZONE • WARMUP</div>
        <h1 class="jdg-title">🦘 Quick Feet Prep</h1>
        <p class="jdg-subtitle">เตรียมขาและรีเฟล็กซ์ก่อนเข้าเกม Jump Duck</p>

        <div class="jdg-grid">
          <div class="jdg-panel">
            <h2 class="jdg-h2">วิธีเล่น</h2>
            <ol class="jdg-list">
              <li>กดปุ่มให้ตรงกับคำสั่งที่ขึ้น</li>
              <li>มี 4 ท่า: ซ้าย ขวา ย่อ กระโดด</li>
              <li>ทำให้ถูกอย่างน้อย 4 ครั้ง หรือคะแนนรวม 60%</li>
            </ol>
          </div>

          <div class="jdg-panel jdg-play">
            <div class="jdg-phase-badge">WARMUP</div>
            <div class="jdg-cue" id="jdg-cue">พร้อม</div>
            <div class="jdg-timer" id="jdg-timer">${GAME_SEC}s</div>
            <div class="jdg-stats" id="jdg-stats">
              <span>รอบ 0/${TOTAL_ROUNDS}</span>
              <span>ถูก 0</span>
              <span>ผิด 0</span>
            </div>

            <div class="jdg-actions" id="jdg-actions">
              ${CUES.map(c => `
                <button class="jdg-btn-action" type="button" data-action="${c.id}" disabled>
                  <span class="jdg-emoji">${c.emoji}</span>
                  <span>${c.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="jdg-footer">
          <button class="jdg-btn jdg-btn-primary" id="jdg-start">เริ่มอุ่นเครื่อง</button>
          <button class="jdg-btn jdg-btn-ghost" id="jdg-finish" disabled>สรุปผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#jdg-cue');
  const timerEl = root.querySelector('#jdg-timer');
  const statsEl = root.querySelector('#jdg-stats');
  const actionsEl = root.querySelector('#jdg-actions');
  const startBtn = root.querySelector('#jdg-start');
  const finishBtn = root.querySelector('#jdg-finish');

  function renderStats() {
    statsEl.innerHTML = `
      <span>รอบ ${Math.max(0, state.roundIndex + 1)}/${TOTAL_ROUNDS}</span>
      <span>ถูก ${state.correct}</span>
      <span>ผิด ${state.wrong + state.misses}</span>
    `;
  }

  function lockActions(locked) {
    actionsEl.querySelectorAll('.jdg-btn-action').forEach(btn => {
      btn.disabled = locked;
    });
  }

  function finishGame() {
    if (state.finished) return;
    state.finished = true;
    clearTimeout(state.roundTimer);
    clearInterval(state.gameTimer);
    lockActions(true);
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดสรุปผล';
    renderStats();
  }

  function nextCue() {
    if (state.finished) return;
    state.roundIndex += 1;
    if (state.roundIndex >= state.cues.length) {
      finishGame();
      return;
    }

    const cue = state.cues[state.roundIndex];
    state.total += 1;
    state.cueAt = performance.now();
    cueEl.textContent = `${cue.emoji} ${cue.label}`;
    renderStats();

    clearTimeout(state.roundTimer);
    state.roundTimer = setTimeout(() => {
      state.misses += 1;
      cueEl.textContent = `ไม่ทัน! คำตอบคือ ${cue.label}`;
      renderStats();
      setTimeout(nextCue, 500);
    }, ROUND_MS);
  }

  function answer(action) {
    if (!state.started || state.finished || state.roundIndex < 0) return;
    const cue = state.cues[state.roundIndex];
    clearTimeout(state.roundTimer);

    const rt = Math.max(0, Math.round(performance.now() - state.cueAt));
    state.reactionSum += rt;
    state.reactionCount += 1;

    if (action === cue.id) {
      state.correct += 1;
      cueEl.textContent = `ถูกต้อง! ${cue.label}`;
    } else {
      state.wrong += 1;
      cueEl.textContent = `ยังไม่ใช่ — ต้องเป็น ${cue.label}`;
    }

    renderStats();
    setTimeout(nextCue, 420);
  }

  actionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.jdg-btn-action');
    if (!btn) return;
    answer(btn.dataset.action || '');
  });

  startBtn.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    lockActions(false);
    cueEl.textContent = 'เริ่ม!';
    renderStats();

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
      if (state.remainSec <= 0) finishGame();
    }, 1000);

    setTimeout(nextCue, 500);
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}
