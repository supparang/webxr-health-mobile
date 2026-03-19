/* === /herohealth/gate/games/_shared/cooldown-standard-template.js ===
 * HEROHEALTH COOLDOWN STANDARD TEMPLATE
 * MANUAL RESULT ONLY
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
  const id = 'hh-gate-style-__GAME__';
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

function computeScore(state){
  // ✅ แก้สูตรคะแนนตรงนี้ตามเกม
  return clamp(Math.round(state.scoreRaw || 0), 0, 100);
}

function isPassCondition(state){
  // ✅ แก้เงื่อนไขผ่านตรงนี้ตามเกม
  return !!state.finishedGoal;
}

function makeResult(state){
  const score = computeScore(state);
  const passed = isPassCondition(state);

  return {
    ok: true,
    zone: '__ZONE__',
    game: '__GAME__',
    phase: 'cooldown',
    activityId: '__ACTIVITY_ID__',

    title: '__TITLE__',
    subtitle: passed
      ? '__SUCCESS_SUBTITLE__'
      : '__FAIL_SUBTITLE__',

    passed,
    score,
    stars: starsFromScore(score),

    lines: [
      // ✅ แก้ข้อความสรุปตรงนี้ตามเกม
      `คะแนน ${score}%`
    ],

    metrics: {
      // ✅ ใส่ metrics จริงของเกม
      finished: state.finished ? 1 : 0
    },

    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? '__SUCCESS_SUBTITLE__'
        : '__FAIL_SUBTITLE__'
    },

    buffs: {
      // ✅ ใส่ buff / summary data ที่อยากเก็บ
      wType: '__GAME___cooldown',
      wPct: score,
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
      <div class="cd-wrap">
        <section class="cd-card">
          <div class="cd-kicker">COOLDOWN</div>
          <h1 class="cd-title">__TITLE__</h1>
          <p class="cd-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
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

    // ✅ state จริงของแต่ละเกมใส่เพิ่มตรงนี้
    scoreRaw: 0,
    finishedGoal: false,

    gameTimer: null,
    extraTimer: null
  };

  root.innerHTML = `
    <div class="cd-wrap">
      <section class="cd-card">
        <div class="cd-kicker">COOLDOWN</div>
        <h1 class="cd-title">__TITLE__</h1>
        <p class="cd-subtitle">__DESCRIPTION__</p>

        <div class="cd-grid">
          <div class="cd-panel">
            <h2 class="cd-h2">วิธีเล่น</h2>
            <ol class="cd-list">
              <li>__STEP_1__</li>
              <li>__STEP_2__</li>
              <li>__STEP_3__</li>
            </ol>
          </div>

          <div class="cd-panel cd-play">
            <div class="cd-phase-badge">COOLDOWN</div>
            <div class="cd-cue" id="cd-cue">__START_HINT__</div>
            <div class="cd-timer" id="cd-timer">${GAME_SEC}s</div>
            <div class="cd-stats" id="cd-stats"></div>

            <div class="cd-actions" id="cd-actions">
              <!-- ✅ ใส่ปุ่ม action ของเกมตรงนี้ -->
              <button class="cd-btn-action" type="button" id="cd-action" disabled>
                ทำกิจกรรม
              </button>
            </div>
          </div>
        </div>

        <div class="cd-footer">
          <button class="cd-btn cd-btn-primary" id="cd-start" type="button">เริ่มผ่อนคลาย</button>
          <button class="cd-btn cd-btn-ghost" id="cd-finish" type="button" disabled>ดูผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#cd-cue');
  const timerEl = root.querySelector('#cd-timer');
  const statsEl = root.querySelector('#cd-stats');
  const actionBtn = root.querySelector('#cd-action');
  const startBtn = root.querySelector('#cd-start');
  const finishBtn = root.querySelector('#cd-finish');

  function canOpenResult(){
    return state.finished === true || state.remainSec <= 0;
  }

  function syncFinishBtn(){
    const ready = canOpenResult();
    finishBtn.disabled = !ready;
    finishBtn.style.pointerEvents = ready ? 'auto' : 'none';
    finishBtn.style.opacity = ready ? '1' : '.65';
    finishBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
  }

  function renderStats(){
    // ✅ แก้สถิติแสดงผลตามเกม
    statsEl.innerHTML = `
      <span>คะแนน ${Math.round(state.scoreRaw)}</span>
      <span>เวลา ${Math.max(0, state.remainSec)}s</span>
    `;
    syncFinishBtn();
  }

  function stopExtraTimer(){
    clearInterval(state.extraTimer);
    state.extraTimer = null;
  }

  function stopAllTimers(){
    clearInterval(state.gameTimer);
    state.gameTimer = null;
    stopExtraTimer();
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

    actionBtn.disabled = true;
    actionBtn.style.pointerEvents = 'none';
    actionBtn.style.opacity = '.7';

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    timerEl.textContent = `${Math.max(0, state.remainSec)}s`;

    renderStats();
  }

  function tryFinishIfReady(){
    // ✅ แก้เงื่อนไขจบจริงของเกมตรงนี้
    if (state.finishedGoal){
      finishGame();
    }
  }

  function doAction(){
    if (!state.started || state.finished) return;

    // ✅ logic action ของเกมใส่ตรงนี้
    state.scoreRaw += 20;

    if (state.scoreRaw >= 80){
      state.finishedGoal = true;
    }

    cueEl.textContent = 'ดีมาก ทำต่ออีกนิด';
    renderStats();
    tryFinishIfReady();
  }

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    actionBtn.disabled = false;
    actionBtn.style.pointerEvents = 'auto';
    actionBtn.style.opacity = '1';

    api?.setSub?.('__SUB_TEXT__');
    api?.logger?.push?.('__GAME___cooldown_start', {
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

    // ✅ ถ้ามี timer เสริมของเกม ใช้ extraTimer นี้
    // state.extraTimer = setInterval(() => {}, 1000);
  }

  actionBtn.addEventListener('click', doAction);

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

  api?.setSub?.('__SUB_TEXT__');
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