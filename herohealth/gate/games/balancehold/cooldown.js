/* === /herohealth/gate/games/balancehold/cooldown.js ===
 * HeroHealth Gate Game: BalanceHold Cooldown
 * PATCH v20260312e-BALANCEHOLD-COOLDOWN-TH-CHILD
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
  const id = 'hh-gate-style-balancehold';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './gate/games/balancehold/style.css';
  document.head.appendChild(link);
}

function starsFromScore(score){
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function makeResult(state){
  const score = clamp(Math.round((state.swayRounds * 18) + (state.stillnessSec * 10)), 0, 100);
  const passed = state.swayRounds >= 4 && state.stillnessSec >= 3;
  return {
    ok: true,
    zone: 'exercise',
    game: 'balancehold',
    phase: 'cooldown',
    activityId: 'balancehold-slow-sway-relax',
    title: 'ผ่อนคลายช้า ๆ',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      swayRounds: state.swayRounds,
      stillnessSec: state.stillnessSec,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? 'ผ่อนคลายเสร็จแล้ว เก่งมาก'
        : 'ค่อย ๆ ผ่อนคลายอีกนิด แล้วค่อยกลับไปพัก'
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
      <div class="bhg-wrap bhg-wrap-cool">
        <section class="bhg-card">
          <div class="bhg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="bhg-title">🌿 ผ่อนคลายช้า ๆ</h1>
          <p class="bhg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
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
    swayRounds: 0,
    stillnessSec: 0,
    gameTimer: null,
    stillTimer: null
  };

  root.innerHTML = `
    <div class="bhg-wrap bhg-wrap-cool">
      <section class="bhg-card">
        <div class="bhg-kicker">EXERCISE ZONE • COOLDOWN</div>
        <h1 class="bhg-title">🌿 ผ่อนคลายช้า ๆ</h1>
        <p class="bhg-subtitle">ค่อย ๆ ผ่อนคลายร่างกายหลังจบ Balance Hold</p>

        <div class="bhg-grid">
          <div class="bhg-panel">
            <h2 class="bhg-h2">วิธีเล่น</h2>
            <ol class="bhg-list">
              <li>กดปุ่มแกว่งช้า ๆ ทีละ 1 ครั้ง</li>
              <li>ทำให้ครบอย่างน้อย 4 ครั้ง</li>
              <li>จากนั้นยืนนิ่งอีกนิด</li>
            </ol>
          </div>

          <div class="bhg-panel bhg-play">
            <div class="bhg-phase-badge bhg-phase-badge-cool">COOLDOWN</div>
            <div class="bhg-cue bhg-cue-cool" id="bhg-cue">ค่อย ๆ แกว่งซ้ายขวาช้า ๆ</div>
            <div class="bhg-timer" id="bhg-timer">${GAME_SEC}s</div>
            <div class="bhg-stats" id="bhg-stats">
              <span>แกว่ง 0</span>
              <span>นิ่ง 0s</span>
            </div>

            <div class="bhg-actions">
              <button class="bhg-btn-action" type="button" id="bhg-sway" disabled>
                <span class="bhg-emoji">↔️</span>
                <span>แกว่ง 1 ครั้ง</span>
              </button>
              <button class="bhg-btn-action" type="button" id="bhg-still" disabled>
                <span class="bhg-emoji">🧍</span>
                <span>ยืนนิ่ง</span>
              </button>
            </div>
          </div>
        </div>

        <div class="bhg-footer">
          <button class="bhg-btn bhg-btn-primary" id="bhg-start">เริ่มผ่อนคลาย</button>
          <button class="bhg-btn bhg-btn-ghost" id="bhg-finish" disabled>ดูผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#bhg-cue');
  const timerEl = root.querySelector('#bhg-timer');
  const statsEl = root.querySelector('#bhg-stats');
  const swayBtn = root.querySelector('#bhg-sway');
  const stillBtn = root.querySelector('#bhg-still');
  const startBtn = root.querySelector('#bhg-start');
  const finishBtn = root.querySelector('#bhg-finish');

  function renderStats(){
    statsEl.innerHTML = `
      <span>แกว่ง ${state.swayRounds}</span>
      <span>นิ่ง ${state.stillnessSec}s</span>
    `;
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.gameTimer);
    clearInterval(state.stillTimer);
    swayBtn.disabled = true;
    stillBtn.disabled = true;
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    renderStats();
  }

  swayBtn.addEventListener('click', () => {
    if (!state.started || state.finished) return;
    state.swayRounds += 1;
    cueEl.textContent = 'ดีมาก ค่อย ๆ กลับมาตรงกลาง';
    renderStats();

    if (state.swayRounds >= 4){
      stillBtn.disabled = false;
    }
    if (state.swayRounds >= 4 && state.stillnessSec >= 3){
      finishGame();
    }
  });

  stillBtn.addEventListener('click', () => {
    if (!state.started || state.finished) return;
    stillBtn.disabled = true;
    cueEl.textContent = 'ยืนนิ่งไว้...';
    clearInterval(state.stillTimer);
    state.stillTimer = setInterval(() => {
      if (state.finished) return;
      state.stillnessSec += 1;
      renderStats();
      if (state.swayRounds >= 4 && state.stillnessSec >= 3){
        finishGame();
      }
    }, 1000);
  });

  startBtn.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    swayBtn.disabled = false;

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
      if (state.remainSec <= 0) finishGame();
    }, 1000);
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}