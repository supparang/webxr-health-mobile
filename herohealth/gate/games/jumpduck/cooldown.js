/* === /herohealth/gate/games/jumpduck/cooldown.js ===
 * HeroHealth Gate Game: JumpDuck Cooldown
 * FULL PATCH v20260319b-JUMPDUCK-COOLDOWN-MANUAL-RESULT
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
  const id = 'hh-gate-style-jumpduck';
  const href = new URL('./style.css?v=20260312c', import.meta.url).toString();

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
  const starGoal = 3;
  const holdGoal = 6;
  const starPct = clamp(state.starsDone / starGoal, 0, 1);
  const holdPct = clamp(state.holdSeconds / holdGoal, 0, 1);
  const weighted = (starPct * 0.60) + (holdPct * 0.40);
  return clamp(Math.round(weighted * 100), 0, 100);
}

function makeResult(state){
  const score = computeScore(state);
  const passed = state.starsDone >= 3 && state.holdSeconds >= 6;

  return {
    ok: true,
    zone: 'exercise',
    game: 'jumpduck',
    phase: 'cooldown',
    activityId: 'jumpduck-leg-stretch-stars',
    title: 'ยืดขาหลังเล่น',
    subtitle: passed
      ? 'ยืดขาเสร็จแล้ว เก่งมาก'
      : 'ยืดขาอีกนิด แล้วค่อยกลับไปพัก',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `ดาว ${state.starsDone}/3`,
      `ค้างท่า ${state.holdSeconds} วินาที`,
      `คะแนน ${score}%`
    ],
    metrics: {
      starsDone: state.starsDone,
      holdSeconds: state.holdSeconds,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? 'ยืดขาเสร็จแล้ว เก่งมาก'
        : 'ยืดขาอีกนิด แล้วค่อยกลับไปพัก'
    },
    buffs: {
      wType: 'jumpduck_cooldown',
      wPct: score,
      wStarsDone: state.starsDone,
      wHoldSeconds: state.holdSeconds,
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
      <div class="jdg-wrap">
        <section class="jdg-card">
          <div class="jdg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="jdg-title">⭐ ยืดขาหลังเล่น</h1>
          <p class="jdg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
        </section>
      </div>
    `;
    return {
      autostart: false,
      start(){},
      destroy(){}
    };
  }

  const GAME_SEC = 18;
  const STAR_LIST = [
    { id: 'front', label: 'ยืดด้านหน้า', emoji: '⭐' },
    { id: 'side',  label: 'ยืดด้านข้าง', emoji: '✨' },
    { id: 'calf',  label: 'ยืดน่อง',     emoji: '🌟' }
  ];

  const state = {
    started: false,
    finished: false,
    submitted: false,

    remainSec: GAME_SEC,
    starsDone: 0,
    holdSeconds: 0,
    doneMap: Object.create(null),

    gameTimer: null,
    holdTimer: null
  };

  root.innerHTML = `
    <div class="jdg-wrap">
      <section class="jdg-card">
        <div class="jdg-kicker">EXERCISE ZONE • COOLDOWN</div>
        <h1 class="jdg-title">⭐ ยืดขาหลังเล่น</h1>
        <p class="jdg-subtitle">ยืดขาเบา ๆ หลังจบเกม Jump Duck</p>

        <div class="jdg-grid">
          <div class="jdg-panel">
            <h2 class="jdg-h2">วิธีเล่น</h2>
            <ol class="jdg-list">
              <li>แตะดาวทีละดวง</li>
              <li>ค้างท่ายืดเบา ๆ ระหว่างทำ</li>
              <li>ทำครบ 3 ดวง และค้างอย่างน้อย 6 วินาที</li>
            </ol>
          </div>

          <div class="jdg-panel jdg-play">
            <div class="jdg-phase-badge jdg-phase-badge-cool">COOLDOWN</div>
            <div class="jdg-cue" id="jdg-cue">พักหายใจ แล้วเริ่มยืดขา</div>
            <div class="jdg-timer" id="jdg-timer">${GAME_SEC}s</div>
            <div class="jdg-stats" id="jdg-stats">
              <span>ดาว 0/3</span>
              <span>ค้าง 0s</span>
            </div>

            <div class="jdg-actions jdg-actions-stars" id="jdg-actions">
              ${STAR_LIST.map(s => `
                <button class="jdg-btn-action" type="button" data-star="${s.id}" disabled>
                  <span class="jdg-emoji">${s.emoji}</span>
                  <span>${s.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="jdg-footer">
          <button class="jdg-btn jdg-btn-primary" id="jdg-start" type="button">เริ่มผ่อนคลาย</button>
          <button class="jdg-btn jdg-btn-ghost" id="jdg-finish" type="button" disabled>ดูผล</button>
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

  function starButtons(){
    return Array.from(actionsEl.querySelectorAll('.jdg-btn-action'));
  }

  function canOpenResult(){
    return state.finished === true
      || (state.starsDone >= 3 && state.holdSeconds >= 6)
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
      <span>ดาว ${state.starsDone}/3</span>
      <span>ค้าง ${state.holdSeconds}s</span>
    `;
    syncFinishBtn();
  }

  function setStarButtonsEnabled(enabled){
    starButtons().forEach(btn => {
      const starId = btn.dataset.star || '';
      const done = !!state.doneMap[starId];
      btn.disabled = !enabled || done;
      btn.style.pointerEvents = (!enabled || done) ? 'none' : 'auto';
      btn.style.opacity = (!enabled || done) ? '.7' : '1';
    });
  }

  function stopHoldTimer(){
    clearInterval(state.holdTimer);
    state.holdTimer = null;
  }

  function stopAllTimers(){
    clearInterval(state.gameTimer);
    state.gameTimer = null;
    stopHoldTimer();
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
    setStarButtonsEnabled(false);

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    cueEl.textContent = 'ยืดขาเสร็จแล้ว กดดูผล';
    timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
    renderStats();
  }

  function tryFinishIfReady(){
    if (state.starsDone >= 3 && state.holdSeconds >= 6){
      finishGame();
    }
  }

  function pickStar(btn){
    if (!state.started || state.finished) return;

    const star = btn.dataset.star || '';
    if (!star || state.doneMap[star]) return;

    state.doneMap[star] = 1;
    state.starsDone += 1;

    btn.disabled = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '.7';
    btn.classList.add('is-done');

    const meta = STAR_LIST.find(s => s.id === star);
    cueEl.textContent = `ดีมาก ${meta?.label || 'ทำได้ดีมาก'}`;

    renderStats();
    tryFinishIfReady();
  }

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    setStarButtonsEnabled(true);

    api?.setSub?.('แตะดาวทีละดวง แล้วค้างท่ายืดเบา ๆ');
    api?.logger?.push?.('jumpduck_cooldown_start', {
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

    state.holdTimer = setInterval(() => {
      if (!state.finished && state.starsDone > 0){
        state.holdSeconds += 1;
        renderStats();
        tryFinishIfReady();
      }
    }, 1000);
  }

  actionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.jdg-btn-action');
    if (!btn) return;
    pickStar(btn);
  });

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

  api?.setSub?.('เริ่มผ่อนคลายแล้วค่อย ๆ ยืดขา');
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