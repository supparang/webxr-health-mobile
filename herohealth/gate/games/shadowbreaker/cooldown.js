/* === /herohealth/gate/games/shadowbreaker/cooldown.js ===
 * HeroHealth Gate Game: ShadowBreaker Cooldown
 * PATCH v20260312-SHADOWBREAKER-COOLDOWN-A
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
  const id = 'hh-gate-style-shadowbreaker';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './gate/games/shadowbreaker/style.css';
  document.head.appendChild(link);
}

function starsFromScore(score){
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function makeResult(state){
  const score = clamp(Math.round((state.breathCycles * 18) + (state.calmTicks * 6)), 0, 100);
  const passed = state.breathCycles >= 4 && state.calmTicks >= 4;
  return {
    ok: true,
    zone: 'exercise',
    game: 'shadowbreaker',
    phase: 'cooldown',
    activityId: 'shadowbreaker-energy-fade',
    title: 'Energy Fade',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      breathCycles: state.breathCycles,
      calmTicks: state.calmTicks,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? 'ผ่อนพลังลงเรียบร้อยแล้ว ร่างกายพร้อมพัก'
        : 'หายใจช้า ๆ อีกนิด ให้ร่างกายค่อย ๆ ผ่อนลง'
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
      <div class="sbg-wrap">
        <section class="sbg-card">
          <div class="sbg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="sbg-title">🌙 Energy Fade</h1>
          <p class="sbg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
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
    calmTicks: 0,
    gameTimer: null,
    calmTimer: null
  };

  root.innerHTML = `
    <div class="sbg-wrap sbg-wrap-cool">
      <section class="sbg-card">
        <div class="sbg-kicker">EXERCISE ZONE • COOLDOWN</div>
        <h1 class="sbg-title">🌙 Energy Fade</h1>
        <p class="sbg-subtitle">ค่อย ๆ ผ่อนจังหวะหลังจบเกม Shadow Breaker</p>

        <div class="sbg-grid">
          <div class="sbg-panel">
            <h2 class="sbg-h2">วิธีทำ</h2>
            <ol class="sbg-list">
              <li>กดปุ่ม “หายใจ 1 รอบ” ตามจังหวะช้า ๆ</li>
              <li>ทำให้ครบอย่างน้อย 4 รอบ</li>
              <li>อยู่ในช่วงคูลดาวน์ให้นิ่งต่อเนื่องเพื่อเก็บ calm ticks</li>
            </ol>
          </div>

          <div class="sbg-panel sbg-play">
            <div class="sbg-phase-badge sbg-phase-badge-cool">COOLDOWN</div>
            <div class="sbg-cue sbg-cue-cool" id="sbg-cue">หายใจเข้า... หายใจออก...</div>
            <div class="sbg-timer" id="sbg-timer">${GAME_SEC}s</div>
            <div class="sbg-stats" id="sbg-stats">
              <span>รอบหายใจ 0</span>
              <span>calm 0</span>
            </div>

            <div class="sbg-actions sbg-actions-single">
              <button class="sbg-btn-action sbg-btn-breath" type="button" id="sbg-breath" disabled>
                <span class="sbg-emoji">💨</span>
                <span>หายใจ 1 รอบ</span>
              </button>
            </div>
          </div>
        </div>

        <div class="sbg-footer">
          <button class="sbg-btn sbg-btn-primary" id="sbg-start">เริ่มคูลดาวน์</button>
          <button class="sbg-btn sbg-btn-ghost" id="sbg-finish" disabled>สรุปผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#sbg-cue');
  const timerEl = root.querySelector('#sbg-timer');
  const statsEl = root.querySelector('#sbg-stats');
  const breathBtn = root.querySelector('#sbg-breath');
  const startBtn = root.querySelector('#sbg-start');
  const finishBtn = root.querySelector('#sbg-finish');

  function renderStats(){
    statsEl.innerHTML = `
      <span>รอบหายใจ ${state.breathCycles}</span>
      <span>calm ${state.calmTicks}</span>
    `;
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.gameTimer);
    clearInterval(state.calmTimer);
    breathBtn.disabled = true;
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดสรุปผล';
    renderStats();
  }

  breathBtn.addEventListener('click', () => {
    if (!state.started || state.finished) return;
    state.breathCycles += 1;
    cueEl.textContent = state.breathCycles % 2 === 0
      ? 'หายใจเข้า...'
      : 'หายใจออก...';
    renderStats();

    if (state.breathCycles >= 4 && state.calmTicks >= 4){
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

    state.calmTimer = setInterval(() => {
      if (!state.finished) {
        state.calmTicks += 1;
        renderStats();
        if (state.breathCycles >= 4 && state.calmTicks >= 4){
          finishGame();
        }
      }
    }, 2500);
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}
