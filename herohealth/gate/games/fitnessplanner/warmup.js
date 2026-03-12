/* === /herohealth/gate/games/fitnessplanner/warmup.js ===
 * HeroHealth Gate Game: FitnessPlanner Warmup
 * PATCH v20260312-FITNESSPLANNER-WARMUP-A
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
  const id = 'hh-gate-style-fitnessplanner';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './gate/games/fitnessplanner/style.css';
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
    title: 'Body Wake Flow',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      total: state.total,
      done: state.done,
      skipped: state.skipped,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'positive' : 'gentle',
      line: passed
        ? 'ร่างกายพร้อมแล้ว ไปวางแผนการออกกำลังกายกัน'
        : 'ลองทำ flow ให้ครบขึ้นอีกนิด จะช่วยให้ร่างกายพร้อมมากขึ้น'
    },
    nextAction: 'run'
  };
}

export function mount(root, ctx = {}){
  ensureStyle();

  const phase = String(getParam(ctx, 'phase', 'warmup')).toLowerCase();
  const onComplete = typeof ctx?.onComplete === 'function' ? ctx.onComplete : () => {};
  if (phase !== 'warmup'){
    root.innerHTML = `
      <div class="fpg-wrap">
        <section class="fpg-card">
          <div class="fpg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="fpg-title">🧘 Body Wake Flow</h1>
          <p class="fpg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
        </section>
      </div>
    `;
    return;
  }

  const STEP_SEC = 4;
  const steps = [
    { id:'arms', label:'ยืดแขนขึ้น', emoji:'🙆' },
    { id:'side', label:'ยืดลำตัวด้านข้าง', emoji:'🧍' },
    { id:'knee', label:'ย่อเข่าเบา ๆ', emoji:'🦵' },
    { id:'twist', label:'บิดตัวช้า ๆ', emoji:'↩️' }
  ];

  const state = {
    started: false,
    finished: false,
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
        <h1 class="fpg-title">🧘 Body Wake Flow</h1>
        <p class="fpg-subtitle">ปลุกร่างกายทั้งตัวก่อนเข้า Fitness Planner</p>

        <div class="fpg-grid">
          <div class="fpg-panel">
            <h2 class="fpg-h2">วิธีเล่น</h2>
            <ol class="fpg-list">
              <li>ทำตามท่าที่ขึ้นบนจอทีละท่า</li>
              <li>กด “ทำครบแล้ว” เมื่อทำท่านั้นเสร็จ</li>
              <li>ทำครบอย่างน้อย 3 จาก 4 ท่าเพื่อผ่าน warmup</li>
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
                <span>ข้ามท่านี้</span>
              </button>
            </div>
          </div>
        </div>

        <div class="fpg-footer">
          <button class="fpg-btn fpg-btn-primary" id="fpg-start">เริ่มอุ่นเครื่อง</button>
          <button class="fpg-btn fpg-btn-ghost" id="fpg-finish" disabled>สรุปผล</button>
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

  function renderStats(){
    statsEl.innerHTML = `
      <span>ท่า ${Math.max(0, state.currentStep + 1)}/4</span>
      <span>ทำครบ ${state.done}</span>
      <span>ข้าม ${state.skipped}</span>
    `;
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.stepTimer);
    doneBtn.disabled = true;
    skipBtn.disabled = true;
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดสรุปผล';
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
    doneBtn.disabled = false;
    skipBtn.disabled = false;
    renderStats();

    clearInterval(state.stepTimer);
    state.stepTimer = setInterval(() => {
      state.remainStepSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainStepSec)}s`;
      if (state.remainStepSec <= 0){
        state.skipped += 1;
        cueEl.textContent = 'หมดเวลา ข้ามไปท่าถัดไป';
        doneBtn.disabled = true;
        skipBtn.disabled = true;
        renderStats();
        clearInterval(state.stepTimer);
        setTimeout(nextStep, 500);
      }
    }, 1000);
  }

  doneBtn.addEventListener('click', () => {
    if (!state.started || state.finished || state.currentStep < 0) return;
    clearInterval(state.stepTimer);
    state.done += 1;
    doneBtn.disabled = true;
    skipBtn.disabled = true;
    cueEl.textContent = 'ดีมาก ทำครบแล้ว';
    renderStats();
    setTimeout(nextStep, 450);
  });

  skipBtn.addEventListener('click', () => {
    if (!state.started || state.finished || state.currentStep < 0) return;
    clearInterval(state.stepTimer);
    state.skipped += 1;
    doneBtn.disabled = true;
    skipBtn.disabled = true;
    cueEl.textContent = 'ข้ามท่านี้';
    renderStats();
    setTimeout(nextStep, 450);
  });

  startBtn.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    nextStep();
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}
