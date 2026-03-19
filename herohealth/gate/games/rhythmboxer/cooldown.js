/* === /herohealth/gate/games/rhythmboxer/cooldown.js ===
 * HeroHealth Gate Game: RhythmBoxer Cooldown
 * FULL PATCH v20260319a-RHYTHMBOXER-COOLDOWN-API-FINISH-FIX
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
  const id = 'hh-gate-style-rhythmboxer';
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
  const score = clamp(Math.round((state.breathCycles * 16) + (state.relaxTicks * 7)), 0, 100);
  const passed = state.breathCycles >= 5 && state.relaxTicks >= 3;

  return {
    ok: true,
    zone: 'exercise',
    game: 'rhythmboxer',
    phase: 'cooldown',
    activityId: 'rhythmboxer-calm-breathing-rings',
    title: 'หายใจผ่อนคลาย',
    subtitle: passed
      ? 'หายใจผ่อนคลายแล้ว เก่งมาก'
      : 'หายใจช้า ๆ อีกนิด แล้วค่อยกลับไปพัก',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `หายใจ ${state.breathCycles} ครั้ง`,
      `ผ่อนคลาย ${state.relaxTicks} รอบ`,
      `คะแนน ${score}%`
    ],
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
    buffs: {
      wType: 'rhythmboxer_cooldown',
      wPct: score,
      wBreathCycles: state.breathCycles,
      wRelaxTicks: state.relaxTicks,
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
      <div class="rbg-wrap rbg-wrap-cool">
        <section class="rbg-card">
          <div class="rbg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="rbg-title">🫧 หายใจผ่อนคลาย</h1>
          <p class="rbg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
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
          <button class="rbg-btn rbg-btn-ghost" id="rbg-finish" type="button" disabled>ดูผล</button>
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

  function canOpenResult(){
    return state.finished === true
      || (state.breathCycles >= 5 && state.relaxTicks >= 3)
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
      <span>ผ่อนคลาย ${state.relaxTicks}</span>
    `;
    syncFinishBtn();
  }

  function stopRelaxTimer(){
    clearInterval(state.relaxTimer);
    state.relaxTimer = null;
  }

  function stopAllTimers(){
    clearInterval(state.gameTimer);
    state.gameTimer = null;
    stopRelaxTimer();
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

    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
    renderStats();
  }

  function tryFinishIfReady(){
    if (state.breathCycles >= 5 && state.relaxTicks >= 3){
      finishGame();
    }
  }

  function doBreath(){
    if (!state.started || state.finished) return;

    state.breathCycles += 1;
    cueEl.textContent = state.breathCycles % 2 === 0 ? 'หายใจเข้า...' : 'หายใจออก...';
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
    api?.logger?.push?.('rhythmboxer_cooldown_start', {
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

    state.relaxTimer = setInterval(() => {
      if (!state.finished) {
        state.relaxTicks += 1;
        renderStats();
        tryFinishIfReady();
      }
    }, 3000);
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

  api?.setSub?.('เริ่มผ่อนคลายแล้วค่อย ๆ หายใจเข้าออก');
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