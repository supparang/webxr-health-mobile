/* === /herohealth/gate/games/rhythmboxer/cooldown.js ===
 * HeroHealth Gate Game: RhythmBoxer Cooldown
 * PATCH v20260312e-RHYTHMBOXER-COOLDOWN-TH-CHILD
 */

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function getParam(ctx, key, fallback=''){
  try{
    if (ctx?.url) return ctx.url.searchParams.get(key) ?? fallback;
    return new URL(window.location.href).searchParams.get(key) ?? fallback;
  }catch(_){
    return fallback;
  }
}

function ensureStyle(){
  const id = 'hh-gate-style-rhythmboxer';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './gate/games/rhythmboxer/style.css';
  document.head.appendChild(link);
}

function starsFromScore(score){
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function makeResult(state){
  const score = clamp(Math.round((state.breathCycles * 16) + (state.relaxTicks * 7)), 0, 100);
  const passed = state.breathCycles >= 5 && state.relaxTicks >= 3;
  return {
    ok: true,
    zone: 'exercise',
    game: 'rhythmboxer',
    phase: 'cooldown',
    activityId: 'rhythmboxer-calm-breathing-rings',
    title: 'หายใจผ่อนคลาย',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      breathCycles: state.breathCycles,
      relaxTicks: state.relaxTicks,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? 'หายใจผ่อนคลายแล้ว เก่งมาก'
        : 'หายใจช้า ๆ อีกนิด แล้วค่อยกลับไปพัก'
    },
    nextAction: 'hub'
  };
}

export function mount(root, ctx = {}){
  ensureStyle();

  const phase = String(getParam(ctx, 'phase', 'cooldown')).toLowerCase();
  const onComplete = typeof ctx?.onComplete === 'function' ? ctx.onComplete : () => {};
  if (phase !== 'cooldown'){
    root.innerHTML = `
      <div class="rbg-wrap rbg-wrap-cool">
        <section class="rbg-card">
          <div class="rbg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="rbg-title">🫧 หายใจผ่อนคลาย</h1>
          <p class="rbg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
        </section>
      </div>
    `;
    return;
  }

  const GAME_SEC = 20;

  const state = {
    started: false,
    finished: false,
    remainSec: GAME_SEC,
    breathCycles: 0,
    relaxTicks: 0,
    gameTimer: null,
    relaxTimer: null
  };

  root.innerHTML = `
    <div class="rbg-wrap rbg-wrap-cool">
      <section class="rbg-card">
        <div class="rbg-kicker">EXERCISE ZONE • COOLDOWN</div>
        <h1 class="rbg-title">🫧 หายใจผ่อนคลาย</h1>
        <p class="rbg-subtitle">หายใจลึก ๆ และผ่อนคลายหลังจบเกม Rhythm Boxer</p>

        <div class="rbg-grid">
          <div class="rbg-panel">
            <h2 class="rbg-h2">วิธีเล่น</h2>
            <ol class="rbg-list">
              <li>กดปุ่มหายใจทีละ 1 ครั้ง</li>
              <li>ทำให้ครบอย่างน้อย 5 ครั้ง</li>
              <li>หายใจช้า ๆ ต่ออีกนิด</li>
            </ol>
          </div>

          <div class="rbg-panel rbg-play">
            <div class="rbg-phase-badge rbg-phase-badge-cool">COOLDOWN</div>
            <div class="rbg-cue rbg-cue-cool" id="rbg-cue">หายใจเข้า... หายใจออก...</div>
            <div class="rbg-timer" id="rbg-timer">${GAME_SEC}s</div>
            <div class="rbg-stats" id="rbg-stats">
              <span>หายใจ 0</span>
              <span>ผ่อนคลาย 0</span>
            </div>

            <div class="rbg-actions rbg-actions-single">
              <button class="rbg-btn-action rbg-btn-breath" type="button" id="rbg-breath" disabled>
                <span class="rbg-emoji">💨</span>
                <span>หายใจ 1 ครั้ง</span>
              </button>
            </div>
          </div>
        </div>

        <div class="rbg-footer">
          <button class="rbg-btn rbg-btn-primary" id="rbg-start">เริ่มผ่อนคลาย</button>
          <button class="rbg-btn rbg-btn-ghost" id="rbg-finish" disabled>ดูผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#rbg-cue');
  const timerEl = root.querySelector('#rbg-timer');
  const statsEl = root.querySelector('#rbg-stats');
  const breathBtn = root.querySelector('#rbg-breath');
  const startBtn = root.querySelector('#rbg-start');
  const finishBtn = root.querySelector('#rbg-finish');

  function renderStats(){
    statsEl.innerHTML = `
      <span>หายใจ ${state.breathCycles}</span>
      <span>ผ่อนคลาย ${state.relaxTicks}</span>
    `;
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.gameTimer);
    clearInterval(state.relaxTimer);
    breathBtn.disabled = true;
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    renderStats();
  }

  breathBtn.addEventListener('click', () => {
    if (!state.started || state.finished) return;
    state.breathCycles += 1;
    cueEl.textContent = state.breathCycles % 2 === 0 ? 'หายใจเข้า...' : 'หายใจออก...';
    renderStats();

    if (state.breathCycles >= 5 && state.relaxTicks >= 3){
      finishGame();
    }
  });

  startBtn.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    breathBtn.disabled = false;

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
      if (state.remainSec <= 0) finishGame();
    }, 1000);

    state.relaxTimer = setInterval(() => {
      if (!state.finished) {
        state.relaxTicks += 1;
        renderStats();
        if (state.breathCycles >= 5 && state.relaxTicks >= 3){
          finishGame();
        }
      }
    }, 3000);
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}