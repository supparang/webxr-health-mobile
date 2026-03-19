/* === /herohealth/gate/games/balancehold/warmup.js ===
 * HeroHealth Gate Game: BalanceHold Warmup
 * FULL PATCH v20260318f-BALANCEHOLD-WARMUP-API-FINISH-FIX
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
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function starsFromScore(score){
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function makeResult(state){
  const score = clamp(
    Math.round(((state.success + (state.centerBonus ? 1 : 0)) / 4) * 100),
    0,
    100
  );
  const passed = state.success >= 3;

  return {
    ok: true,
    zone: 'exercise',
    game: 'balancehold',
    phase: 'warmup',
    activityId: 'balancehold-core-activate',
    title: 'ซ้อมทรงตัว',
    subtitle: passed
      ? 'พร้อมแล้ว ไปเล่น Balance Hold กัน'
      : 'ลองยืนนิ่งอีกนิด แล้วค่อยเริ่มเกม',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `สำเร็จ ${state.success}/3 ท่า`,
      `พลาด ${state.fail}`,
      `ซ้าย ${state.leftHoldSec}s`,
      `ขวา ${state.rightHoldSec}s`,
      `กลาง ${state.centerHoldSec}s`
    ],
    metrics: {
      success: state.success,
      fail: state.fail,
      leftHoldSec: state.leftHoldSec,
      rightHoldSec: state.rightHoldSec,
      centerHoldSec: state.centerHoldSec,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'positive' : 'gentle',
      line: passed
        ? 'พร้อมแล้ว ไปเล่น Balance Hold กัน'
        : 'ลองยืนนิ่งอีกนิด แล้วค่อยเริ่มเกม'
    },
    buffs: {
      wType: 'balancehold_warmup',
      wPct: score,
      wSuccess: state.success,
      wFail: state.fail,
      wCenterBonus: state.centerBonus ? 1 : 0,
      wStars: starsFromScore(score)
    },
    nextAction: 'run',
    markDailyDone: true
  };
}

export function mount(root, ctx = {}, api = {}){
  loadStyle();

  const phase = String(getParam(ctx, 'phase', 'warmup')).toLowerCase();

  const fallbackComplete =
    typeof ctx?.onComplete === 'function' ? ctx.onComplete : null;

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

  if (phase !== 'warmup'){
    root.innerHTML = `
      <div class="bhg-wrap">
        <section class="bhg-card">
          <div class="bhg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="bhg-title">⚖️ ซ้อมทรงตัว</h1>
          <p class="bhg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
        </section>
      </div>
    `;
    return {
      autostart: false,
      start(){},
      destroy(){}
    };
  }

  const STEP_SEC = 4;
  const steps = [
    { id:'left', label:'เอนซ้ายค้าง', emoji:'↖️' },
    { id:'right', label:'เอนขวาค้าง', emoji:'↗️' },
    { id:'center', label:'ยืนนิ่งตรงกลาง', emoji:'🧍' }
  ];

  const state = {
    started: false,
    finished: false,
    ended: false,
    currentStep: -1,
    success: 0,
    fail: 0,
    leftHoldSec: 0,
    rightHoldSec: 0,
    centerHoldSec: 0,
    centerBonus: 0,
    remainStepSec: STEP_SEC,
    stepTimer: null
  };

  root.innerHTML = `
    <div class="bhg-wrap">
      <section class="bhg-card">
        <div class="bhg-kicker">EXERCISE ZONE • WARMUP</div>
        <h1 class="bhg-title">⚖️ ซ้อมทรงตัว</h1>
        <p class="bhg-subtitle">ซ้อมยืนให้มั่นคงก่อนเข้าเกม Balance Hold</p>

        <div class="bhg-grid">
          <div class="bhg-panel">
            <h2 class="bhg-h2">วิธีเล่น</h2>
            <ol class="bhg-list">
              <li>ทำตามท่าที่ขึ้นบนจอทีละท่า</li>
              <li>กด “ทำครบแล้ว” เมื่อทำท่าเสร็จ</li>
              <li>ทำสำเร็จอย่างน้อย 3 ท่า</li>
            </ol>
          </div>

          <div class="bhg-panel bhg-play">
            <div class="bhg-phase-badge">WARMUP</div>
            <div class="bhg-cue" id="bhg-cue">พร้อม</div>
            <div class="bhg-timer" id="bhg-timer">${STEP_SEC}s</div>
            <div class="bhg-stats" id="bhg-stats">
              <span>ท่า 0/3</span>
              <span>สำเร็จ 0</span>
              <span>พลาด 0</span>
            </div>

            <div class="bhg-actions bhg-actions-single">
              <button class="bhg-btn-action" type="button" id="bhg-hold" disabled>
                <span class="bhg-emoji">✅</span>
                <span>ทำครบแล้ว</span>
              </button>
            </div>
          </div>
        </div>

        <div class="bhg-footer">
          <button class="bhg-btn bhg-btn-primary" id="bhg-start" type="button">เริ่มอุ่นเครื่อง</button>
          <button class="bhg-btn bhg-btn-ghost" id="bhg-finish" type="button" disabled>ดูผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#bhg-cue');
  const timerEl = root.querySelector('#bhg-timer');
  const statsEl = root.querySelector('#bhg-stats');
  const holdBtn = root.querySelector('#bhg-hold');
  const startBtn = root.querySelector('#bhg-start');
  const finishBtn = root.querySelector('#bhg-finish');

  function canOpenResult(){
    return state.finished === true;
  }

  function syncFinishBtn(){
    const canOpen = canOpenResult();
    finishBtn.disabled = !canOpen;
    finishBtn.style.pointerEvents = canOpen ? 'auto' : 'none';
    finishBtn.style.opacity = canOpen ? '1' : '.6';
  }

  function renderStats(){
    const shownStep = clamp(state.currentStep + 1, 0, steps.length);
    statsEl.innerHTML = `
      <span>ท่า ${shownStep}/3</span>
      <span>สำเร็จ ${state.success}</span>
      <span>พลาด ${state.fail}</span>
    `;
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;

    clearInterval(state.stepTimer);
    state.stepTimer = null;

    holdBtn.disabled = true;
    startBtn.disabled = true;
    timerEl.textContent = '0s';
    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    renderStats();
    syncFinishBtn();
  }

  function failStep(){
    if (state.finished || state.ended) return;

    state.fail += 1;
    cueEl.textContent = 'หมดเวลา ลองใหม่นะ';
    renderStats();

    clearInterval(state.stepTimer);
    state.stepTimer = null;

    setTimeout(nextStep, 500);
  }

  function nextStep(){
    if (state.finished || state.ended) return;

    state.currentStep += 1;

    if (state.currentStep >= steps.length){
      finishGame();
      return;
    }

    const step = steps[state.currentStep];
    state.remainStepSec = STEP_SEC;

    timerEl.textContent = `${state.remainStepSec}s`;
    cueEl.textContent = `${step.emoji} ${step.label}`;
    holdBtn.disabled = false;

    renderStats();
    syncFinishBtn();

    clearInterval(state.stepTimer);
    state.stepTimer = setInterval(() => {
      state.remainStepSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainStepSec)}s`;

      if (state.remainStepSec <= 0){
        failStep();
      }
    }, 1000);
  }

  function submitResult(){
    if (!canOpenResult()) return;
    if (state.ended) return;
    state.ended = true;

    complete(makeResult(state));
  }

  holdBtn.addEventListener('click', () => {
    if (!state.started || state.finished || state.currentStep < 0) return;

    const step = steps[state.currentStep];

    clearInterval(state.stepTimer);
    state.stepTimer = null;

    holdBtn.disabled = true;
    state.success += 1;

    if (step.id === 'left') state.leftHoldSec = STEP_SEC;
    if (step.id === 'right') state.rightHoldSec = STEP_SEC;
    if (step.id === 'center'){
      state.centerHoldSec = STEP_SEC;
      state.centerBonus = 1;
    }

    cueEl.textContent = `ดีมาก ${step.label}`;
    renderStats();

    setTimeout(nextStep, 450);
  });

  function startInternal(){
    if (state.started || state.finished) return;
    state.started = true;
    startBtn.disabled = true;
    nextStep();
  }

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

  renderStats();
  syncFinishBtn();

  api?.setSub?.('ทำท่าทรงตัวทีละท่า แล้วกดทำครบแล้ว');
  api?.setStats?.({
    time: STEP_SEC,
    score: 0,
    miss: 0,
    acc: '0%'
  });

  return {
    autostart: false,
    start(){},
    destroy(){
      state.ended = true;
      clearInterval(state.stepTimer);
      state.stepTimer = null;
    }
  };
}

export default { loadStyle, mount };