/* === /herohealth/gate/games/fitnessplanner/warmup.js ===
 * HeroHealth Gate Game: FitnessPlanner Warmup
 * FULL PATCH v20260319a-FITNESSPLANNER-WARMUP-API-FINISH-FIX
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
  const id = 'hh-gate-style-fitnessplanner';
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
  const score = clamp(Math.round((state.done / Math.max(1, state.total)) * 100), 0, 100);
  const passed = state.done >= 3 || score >= 75;

  return {
    ok: true,
    zone: 'exercise',
    game: 'fitnessplanner',
    phase: 'warmup',
    activityId: 'fitnessplanner-body-wake-flow',
    title: 'ปลุกร่างกาย',
    subtitle: passed
      ? 'พร้อมแล้ว ไปเล่น Fitness Planner กัน'
      : 'ขยับร่างกายอีกนิด แล้วค่อยเริ่มเกม',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `ท่า ${Math.min(state.currentStep + 1, state.total)}/${state.total}`,
      `ทำครบ ${state.done}`,
      `ข้าม ${state.skipped}`,
      `คะแนน ${score}%`
    ],
    metrics: {
      total: state.total,
      done: state.done,
      skipped: state.skipped,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'positive' : 'gentle',
      line: passed
        ? 'พร้อมแล้ว ไปเล่น Fitness Planner กัน'
        : 'ขยับร่างกายอีกนิด แล้วค่อยเริ่มเกม'
    },
    buffs: {
      wType: 'fitnessplanner_warmup',
      wPct: score,
      wDone: state.done,
      wSkipped: state.skipped,
      wStars: starsFromScore(score)
    },
    nextAction: 'run',
    markDailyDone: true
  };
}

export function mount(root, ctx = {}, api = {}){
  loadStyle();

  const phase = String(getParam(ctx, 'phase', 'warmup')).toLowerCase();
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

  if (phase !== 'warmup'){
    root.innerHTML = `
      <div class="fpg-wrap">
        <section class="fpg-card">
          <div class="fpg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="fpg-title">🧘 ปลุกร่างกาย</h1>
          <p class="fpg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
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
    { id:'arms',  label:'ยืดแขนขึ้น',        emoji:'🙆' },
    { id:'side',  label:'ยืดลำตัวด้านข้าง', emoji:'🧍' },
    { id:'knee',  label:'ย่อเข่าเบา ๆ',     emoji:'🦵' },
    { id:'twist', label:'บิดตัวช้า ๆ',      emoji:'↩️' }
  ];

  const state = {
    started: false,
    finished: false,
    submitted: false,

    currentStep: -1,
    total: steps.length,
    done: 0,
    skipped: 0,

    remainStepSec: STEP_SEC,
    stepTimer: null
  };

  root.innerHTML = `
    <div class="fpg-wrap">
      <section class="fpg-card">
        <div class="fpg-kicker">EXERCISE ZONE • WARMUP</div>
        <h1 class="fpg-title">🧘 ปลุกร่างกาย</h1>
        <p class="fpg-subtitle">ขยับร่างกายเบา ๆ ก่อนเข้า Fitness Planner</p>

        <div class="fpg-grid">
          <div class="fpg-panel">
            <h2 class="fpg-h2">วิธีเล่น</h2>
            <ol class="fpg-list">
              <li>ทำตามท่าที่ขึ้นบนจอทีละท่า</li>
              <li>กด “ทำครบแล้ว” เมื่อทำท่าเสร็จ</li>
              <li>ทำครบอย่างน้อย 3 จาก 4 ท่า</li>
            </ol>
          </div>

          <div class="fpg-panel fpg-play">
            <div class="fpg-phase-badge">WARMUP</div>
            <div class="fpg-cue" id="fpg-cue">พร้อม</div>
            <div class="fpg-timer" id="fpg-timer">${STEP_SEC}s</div>
            <div class="fpg-stats" id="fpg-stats">
              <span>ท่า 0/4</span>
              <span>ทำครบ 0</span>
              <span>ข้าม 0</span>
            </div>

            <div class="fpg-actions">
              <button class="fpg-btn-action" type="button" id="fpg-done" disabled>
                <span class="fpg-emoji">✅</span>
                <span>ทำครบแล้ว</span>
              </button>
              <button class="fpg-btn-action" type="button" id="fpg-skip" disabled>
                <span class="fpg-emoji">⏭️</span>
                <span>ข้าม</span>
              </button>
            </div>
          </div>
        </div>

        <div class="fpg-footer">
          <button class="fpg-btn fpg-btn-primary" id="fpg-start" type="button">เริ่มอุ่นเครื่อง</button>
          <button class="fpg-btn fpg-btn-ghost" id="fpg-finish" type="button" disabled>ดูผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#fpg-cue');
  const timerEl = root.querySelector('#fpg-timer');
  const statsEl = root.querySelector('#fpg-stats');
  const doneBtn = root.querySelector('#fpg-done');
  const skipBtn = root.querySelector('#fpg-skip');
  const startBtn = root.querySelector('#fpg-start');
  const finishBtn = root.querySelector('#fpg-finish');

  function shownStep(){
    if (state.finished) return state.total;
    return clamp(state.currentStep + 1, 0, state.total);
  }

  function canOpenResult(){
    return state.finished === true
      || state.done >= 3
      || state.currentStep >= state.total;
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
      <span>ท่า ${shownStep()}/${state.total}</span>
      <span>ทำครบ ${state.done}</span>
      <span>ข้าม ${state.skipped}</span>
    `;
    syncFinishBtn();
  }

  function lockActionButtons(locked){
    doneBtn.disabled = locked;
    skipBtn.disabled = locked;
    doneBtn.style.pointerEvents = locked ? 'none' : 'auto';
    skipBtn.style.pointerEvents = locked ? 'none' : 'auto';
    doneBtn.style.opacity = locked ? '.7' : '1';
    skipBtn.style.opacity = locked ? '.7' : '1';
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

    clearInterval(state.stepTimer);
    state.stepTimer = null;

    lockActionButtons(true);

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    timerEl.textContent = '0s';
    renderStats();
  }

  function nextStep(){
    if (state.finished) return;

    state.currentStep += 1;

    if (state.currentStep >= steps.length){
      finishGame();
      return;
    }

    const step = steps[state.currentStep];
    state.remainStepSec = STEP_SEC;

    timerEl.textContent = `${state.remainStepSec}s`;
    cueEl.textContent = `${step.emoji} ${step.label}`;

    lockActionButtons(false);
    renderStats();

    clearInterval(state.stepTimer);
    state.stepTimer = setInterval(() => {
      state.remainStepSec -= 1;
      if (state.remainStepSec < 0) state.remainStepSec = 0;

      timerEl.textContent = `${state.remainStepSec}s`;

      if (state.remainStepSec <= 0){
        state.skipped += 1;
        cueEl.textContent = 'หมดเวลา ข้ามไปท่าถัดไป';
        lockActionButtons(true);
        renderStats();

        clearInterval(state.stepTimer);
        state.stepTimer = null;

        setTimeout(nextStep, 500);
      }
    }, 1000);
  }

  function markDone(){
    if (!state.started || state.finished || state.currentStep < 0) return;

    clearInterval(state.stepTimer);
    state.stepTimer = null;

    state.done += 1;
    lockActionButtons(true);
    cueEl.textContent = 'ดีมาก ทำครบแล้ว';
    renderStats();

    setTimeout(nextStep, 450);
  }

  function markSkip(){
    if (!state.started || state.finished || state.currentStep < 0) return;

    clearInterval(state.stepTimer);
    state.stepTimer = null;

    state.skipped += 1;
    lockActionButtons(true);
    cueEl.textContent = 'ข้ามท่านี้';
    renderStats();

    setTimeout(nextStep, 450);
  }

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    api?.setSub?.('ทำตามท่าที่ขึ้นบนจอทีละท่า แล้วกดทำครบแล้ว');
    api?.logger?.push?.('fitnessplanner_warmup_start', {
      totalSteps: steps.length
    });

    nextStep();
  }

  doneBtn.addEventListener('click', markDone);
  skipBtn.addEventListener('click', markSkip);

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

  api?.setSub?.('เริ่มอุ่นเครื่องแล้วทำตามท่าที่ขึ้นบนจอ');
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
      clearInterval(state.stepTimer);
      state.stepTimer = null;
      state.finished = true;
    }
  };
}

export default { loadStyle, mount };