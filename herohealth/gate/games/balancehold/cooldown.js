/* === /herohealth/gate/games/balancehold/cooldown.js ===
 * HeroHealth Gate Game: BalanceHold Cooldown
 * FULL PATCH v20260319a-BALANCEHOLD-COOLDOWN-API-FINISH-FIX
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
  const id = 'hh-gate-style-balancehold';
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
  const score = clamp(
    Math.round((state.swayRounds * 18) + (state.stillnessSec * 10)),
    0,
    100
  );
  const passed = state.swayRounds >= 4 && state.stillnessSec >= 3;

  return {
    ok: true,
    zone: 'exercise',
    game: 'balancehold',
    phase: 'cooldown',
    activityId: 'balancehold-slow-sway-relax',
    title: 'ผ่อนคลายช้า ๆ',
    subtitle: passed
      ? 'ผ่อนคลายเสร็จแล้ว เก่งมาก'
      : 'ค่อย ๆ ผ่อนคลายอีกนิด แล้วค่อยกลับไปพัก',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `แกว่ง ${state.swayRounds} ครั้ง`,
      `ยืนนิ่ง ${state.stillnessSec} วินาที`,
      `คะแนน ${score}%`
    ],
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
    buffs: {
      wType: 'balancehold_cooldown',
      wPct: score,
      wSwayRounds: state.swayRounds,
      wStillnessSec: state.stillnessSec,
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
      <div class="bhg-wrap bhg-wrap-cool">
        <section class="bhg-card">
          <div class="bhg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="bhg-title">🌿 ผ่อนคลายช้า ๆ</h1>
          <p class="bhg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
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
          <button class="bhg-btn bhg-btn-primary" id="bhg-start" type="button">เริ่มผ่อนคลาย</button>
          <button class="bhg-btn bhg-btn-ghost" id="bhg-finish" type="button" disabled>ดูผล</button>
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

  function canOpenResult(){
    return state.finished === true
      || (state.swayRounds >= 4 && state.stillnessSec >= 3)
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
      <span>แกว่ง ${state.swayRounds}</span>
      <span>นิ่ง ${state.stillnessSec}s</span>
    `;
    syncFinishBtn();
  }

  function lockActionButtons(locked){
    swayBtn.disabled = locked;
    stillBtn.disabled = locked;
    swayBtn.style.pointerEvents = locked ? 'none' : 'auto';
    stillBtn.style.pointerEvents = locked ? 'none' : 'auto';
    swayBtn.style.opacity = locked ? '.7' : '1';
    stillBtn.style.opacity = locked ? '.7' : '1';
  }

  function stopStillTimer(){
    clearInterval(state.stillTimer);
    state.stillTimer = null;
  }

  function stopAllTimers(){
    clearInterval(state.gameTimer);
    state.gameTimer = null;
    stopStillTimer();
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
    lockActionButtons(true);

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
    renderStats();
  }

  function tryFinishIfReady(){
    if (state.swayRounds >= 4 && state.stillnessSec >= 3){
      finishGame();
    }
  }

  function markSway(){
    if (!state.started || state.finished) return;

    state.swayRounds += 1;
    cueEl.textContent = 'ดีมาก ค่อย ๆ กลับมาตรงกลาง';
    renderStats();

    if (state.swayRounds >= 4){
      stillBtn.disabled = false;
      stillBtn.style.pointerEvents = 'auto';
      stillBtn.style.opacity = '1';
      cueEl.textContent = 'ดีมาก ครบแล้ว ลองยืนนิ่งต่ออีกนิด';
    }

    tryFinishIfReady();
  }

  function startStill(){
    if (!state.started || state.finished) return;
    if (state.swayRounds < 4) return;
    if (state.stillTimer) return;

    cueEl.textContent = 'ยืนนิ่งไว้...';

    stillBtn.disabled = true;
    stillBtn.style.pointerEvents = 'none';
    stillBtn.style.opacity = '.7';

    stopStillTimer();
    state.stillTimer = setInterval(() => {
      if (state.finished) return;

      state.stillnessSec += 1;
      renderStats();

      if (state.stillnessSec >= 3){
        stopStillTimer();
      }

      tryFinishIfReady();
    }, 1000);
  }

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    swayBtn.disabled = false;
    swayBtn.style.pointerEvents = 'auto';
    swayBtn.style.opacity = '1';

    api?.setSub?.('ค่อย ๆ แกว่งซ้ายขวาช้า ๆ แล้วค่อยยืนนิ่ง');
    api?.logger?.push?.('balancehold_cooldown_start', {
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
  }

  swayBtn.addEventListener('click', markSway);
  stillBtn.addEventListener('click', startStill);

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

  api?.setSub?.('เริ่มผ่อนคลายแล้วค่อย ๆ แกว่งซ้ายขวา');
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