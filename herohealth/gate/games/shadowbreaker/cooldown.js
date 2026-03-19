/* === /herohealth/gate/games/shadowbreaker/cooldown.js ===
 * HeroHealth Gate Game: ShadowBreaker Cooldown
 * FULL PATCH v20260319b-SHADOWBREAKER-COOLDOWN-MANUAL-RESULT
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

export function loadStyle(){
  const id = 'hh-gate-style-shadowbreaker';
  const href = new URL('./style.css', import.meta.url).toString();

  const old = document.getElementById(id);
  if (old) old.remove();

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
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
    title: 'หายใจให้ช้าลง',
    subtitle: passed
      ? 'หายใจช้าลงแล้ว เก่งมาก'
      : 'หายใจช้า ๆ อีกนิด แล้วค่อยกลับไปพัก',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `หายใจ ${state.breathCycles} ครั้ง`,
      `ผ่อนคลาย ${state.calmTicks} รอบ`,
      `คะแนน ${score}%`
    ],
    metrics: {
      breathCycles: state.breathCycles,
      calmTicks: state.calmTicks,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? 'หายใจช้าลงแล้ว เก่งมาก'
        : 'หายใจช้า ๆ อีกนิด แล้วค่อยกลับไปพัก'
    },
    buffs: {
      wType: 'shadowbreaker_cooldown',
      wPct: score,
      wBreathCycles: state.breathCycles,
      wCalmTicks: state.calmTicks,
      wStars: starsFromScore(score)
    },
    nextAction: 'hub',
    markDailyDone: true
  };
}

export function mount(root, ctx = {}, api = {}){
  loadStyle();

  const phase = String(getParam(ctx, 'phase', 'cooldown')).toLowerCase();
  const fallbackComplete = typeof ctx?.onComplete === 'function' ? ctx.onComplete : null;

  function complete(payload){
    if (typeof api?.finish === 'function'){
      api.finish(payload);
      return;
    }
    if (typeof api?.complete === 'function'){
      api.complete(payload);
      return;
    }
    if (typeof fallbackComplete === 'function'){
      fallbackComplete(payload);
    }
  }

  if (phase !== 'cooldown'){
    root.innerHTML = `
      <div class="sbg-wrap">
        <section class="sbg-card">
          <div class="sbg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="sbg-title">🌙 หายใจให้ช้าลง</h1>
          <p class="sbg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
        </section>
      </div>
    `;
    return {
      autostart: false,
      start(){},
      destroy(){}
    };
  }

  const GAME_SEC = 20;

  const state = {
    started: false,
    finished: false,
    submitted: false,

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
        <h1 class="sbg-title">🌙 หายใจให้ช้าลง</h1>
        <p class="sbg-subtitle">หายใจช้า ๆ หลังจบเกม Shadow Breaker</p>

        <div class="sbg-grid">
          <div class="sbg-panel">
            <h2 class="sbg-h2">วิธีเล่น</h2>
            <ol class="sbg-list">
              <li>กดปุ่มหายใจทีละ 1 ครั้ง</li>
              <li>ทำให้ครบอย่างน้อย 4 ครั้ง</li>
              <li>หายใจช้า ๆ ต่ออีกนิด</li>
            </ol>
          </div>

          <div class="sbg-panel sbg-play">
            <div class="sbg-phase-badge sbg-phase-badge-cool">COOLDOWN</div>
            <div class="sbg-cue sbg-cue-cool" id="sbg-cue">หายใจเข้า... หายใจออก...</div>
            <div class="sbg-timer" id="sbg-timer">${GAME_SEC}s</div>
            <div class="sbg-stats" id="sbg-stats">
              <span>หายใจ 0</span>
              <span>ผ่อนคลาย 0</span>
            </div>

            <div class="sbg-actions sbg-actions-single">
              <button class="sbg-btn-action sbg-btn-breath" type="button" id="sbg-breath" disabled>
                <span class="sbg-emoji">💨</span>
                <span>หายใจ 1 ครั้ง</span>
              </button>
            </div>
          </div>
        </div>

        <div class="sbg-footer">
          <button class="sbg-btn sbg-btn-primary" id="sbg-start">เริ่มผ่อนคลาย</button>
          <button class="sbg-btn sbg-btn-ghost" id="sbg-finish" type="button" disabled>ดูผล</button>
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

  function canOpenResult(){
    return state.finished === true
      || (state.breathCycles >= 4 && state.calmTicks >= 4)
      || state.remainSec <= 0;
  }

  function syncFinishBtn(){
    const ready = canOpenResult();
    finishBtn.disabled = !ready;
    finishBtn.style.pointerEvents = ready ? 'auto' : 'none';
    finishBtn.style.opacity = ready ? '1' : '.65';
    finishBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
  }

  function renderStats(){
    statsEl.innerHTML = `
      <span>หายใจ ${state.breathCycles}</span>
      <span>ผ่อนคลาย ${state.calmTicks}</span>
    `;
    syncFinishBtn();
  }

  function stopCalmTimer(){
    clearInterval(state.calmTimer);
    state.calmTimer = null;
  }

  function stopAllTimers(){
    clearInterval(state.gameTimer);
    state.gameTimer = null;
    stopCalmTimer();
  }

  function submitResult(){
    if (!canOpenResult()) return;
    if (state.submitted) return;

    state.submitted = true;
    complete(makeResult(state));
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;

    stopAllTimers();

    breathBtn.disabled = true;
    breathBtn.style.pointerEvents = 'none';
    breathBtn.style.opacity = '.7';

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    cueEl.textContent = 'หายใจช้าลงเสร็จแล้ว กดดูผล';
    timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
    renderStats();
  }

  function tryFinishIfReady(){
    if (state.breathCycles >= 4 && state.calmTicks >= 4){
      finishGame();
    }
  }

  function doBreath(){
    if (!state.started || state.finished) return;

    state.breathCycles += 1;
    cueEl.textContent = state.breathCycles % 2 === 1 ? 'หายใจเข้า...' : 'หายใจออก...';
    renderStats();
    tryFinishIfReady();
  }

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    breathBtn.disabled = false;
    breathBtn.style.pointerEvents = 'auto';
    breathBtn.style.opacity = '1';

    api?.setSub?.('ค่อย ๆ หายใจเข้าออกช้า ๆ เพื่อผ่อนคลาย');
    api?.logger?.push?.('shadowbreaker_cooldown_start', {
      durationSec: GAME_SEC
    });

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      if (state.remainSec < 0) state.remainSec = 0;

      timerEl.textContent = `${state.remainSec}s`;

      if (state.remainSec <= 0){
        finishGame();
      }
    }, 1000);

    state.calmTimer = setInterval(() => {
      if (!state.finished) {
        state.calmTicks += 1;
        renderStats();
        tryFinishIfReady();
      }
    }, 2500);
  }

  breathBtn.addEventListener('click', doBreath);

  startBtn.addEventListener('click', startInternal);

  finishBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitResult();
  }, { passive:false });

  finishBtn.addEventListener('pointerup', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitResult();
  }, { passive:false });

  finishBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitResult();
  }, { passive:false });

  renderStats();
  syncFinishBtn();

  api?.setSub?.('เริ่มผ่อนคลายแล้วค่อย ๆ หายใจช้า ๆ');
  api?.setStats?.({
    time: GAME_SEC,
    score: 0,
    miss: 0,
    acc: '0%'
  });

  return {
    autostart: false,
    start(){},
    destroy(){
      stopAllTimers();
      state.finished = true;
    }
  };
}

export default { loadStyle, mount };