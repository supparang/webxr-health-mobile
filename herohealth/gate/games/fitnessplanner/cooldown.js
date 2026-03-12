/* === /herohealth/gate/games/fitnessplanner/cooldown.js ===
 * HeroHealth Gate Game: FitnessPlanner Cooldown
 * PATCH v20260312-FITNESSPLANNER-COOLDOWN-A
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
  const score = clamp(Math.round((state.answers * 34) + (state.reflectSec * 8)), 0, 100);
  const passed = state.answers >= 2 && state.reflectSec >= 2;
  return {
    ok: true,
    zone: 'exercise',
    game: 'fitnessplanner',
    phase: 'cooldown',
    activityId: 'fitnessplanner-mindful-reflection',
    title: 'Mindful Reflection',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      answers: state.answers,
      reflectSec: state.reflectSec,
      mood: state.mood || '',
      energy: state.energy || '',
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? 'สะท้อนความรู้สึกเรียบร้อยแล้ว พร้อมกลับ HUB'
        : 'ลองเลือกความรู้สึกและทบทวนตัวเองอีกนิด จะช่วยวางแผนครั้งต่อไปได้ดีขึ้น'
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
      <div class="fpg-wrap fpg-wrap-cool">
        <section class="fpg-card">
          <div class="fpg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="fpg-title">🌙 Mindful Reflection</h1>
          <p class="fpg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
        </section>
      </div>
    `;
    return;
  }

  const GAME_SEC = 18;

  const state = {
    started: false,
    finished: false,
    remainSec: GAME_SEC,
    answers: 0,
    reflectSec: 0,
    mood: '',
    energy: '',
    gameTimer: null,
    reflectTimer: null
  };

  root.innerHTML = `
    <div class="fpg-wrap fpg-wrap-cool">
      <section class="fpg-card">
        <div class="fpg-kicker">EXERCISE ZONE • COOLDOWN</div>
        <h1 class="fpg-title">🌙 Mindful Reflection</h1>
        <p class="fpg-subtitle">ทบทวนความรู้สึกสั้น ๆ หลังจบ Fitness Planner</p>

        <div class="fpg-grid">
          <div class="fpg-panel">
            <h2 class="fpg-h2">วิธีทำ</h2>
            <ol class="fpg-list">
              <li>เลือกความรู้สึกวันนี้ 1 อย่าง</li>
              <li>เลือกระดับพลังงานของตัวเอง 1 อย่าง</li>
              <li>อยู่ในช่วง reflection ต่ออย่างน้อย 2 วินาที</li>
            </ol>
          </div>

          <div class="fpg-panel fpg-play">
            <div class="fpg-phase-badge fpg-phase-badge-cool">COOLDOWN</div>
            <div class="fpg-cue fpg-cue-cool" id="fpg-cue">วันนี้รู้สึกอย่างไรบ้าง?</div>
            <div class="fpg-timer" id="fpg-timer">${GAME_SEC}s</div>
            <div class="fpg-stats" id="fpg-stats">
              <span>ตอบ 0</span>
              <span>reflect 0s</span>
            </div>

            <div class="fpg-select-group">
              <div class="fpg-select-title">ความรู้สึก</div>
              <div class="fpg-actions">
                <button class="fpg-btn-action" type="button" data-mood="happy" disabled>😊 สนุก</button>
                <button class="fpg-btn-action" type="button" data-mood="calm" disabled>😌 สงบ</button>
                <button class="fpg-btn-action" type="button" data-mood="tired" disabled>😮‍💨 เหนื่อย</button>
              </div>
            </div>

            <div class="fpg-select-group">
              <div class="fpg-select-title">พลังงาน</div>
              <div class="fpg-actions">
                <button class="fpg-btn-action" type="button" data-energy="low" disabled>🔹 น้อย</button>
                <button class="fpg-btn-action" type="button" data-energy="medium" disabled>🔸 ปานกลาง</button>
                <button class="fpg-btn-action" type="button" data-energy="high" disabled>⭐ มาก</button>
              </div>
            </div>
          </div>
        </div>

        <div class="fpg-footer">
          <button class="fpg-btn fpg-btn-primary" id="fpg-start">เริ่มคูลดาวน์</button>
          <button class="fpg-btn fpg-btn-ghost" id="fpg-finish" disabled>สรุปผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#fpg-cue');
  const timerEl = root.querySelector('#fpg-timer');
  const statsEl = root.querySelector('#fpg-stats');
  const startBtn = root.querySelector('#fpg-start');
  const finishBtn = root.querySelector('#fpg-finish');

  const moodBtns = Array.from(root.querySelectorAll('[data-mood]'));
  const energyBtns = Array.from(root.querySelectorAll('[data-energy]'));

  function renderStats(){
    statsEl.innerHTML = `
      <span>ตอบ ${state.answers}</span>
      <span>reflect ${state.reflectSec}s</span>
    `;
  }

  function updateAnswers(){
    let count = 0;
    if (state.mood) count += 1;
    if (state.energy) count += 1;
    state.answers = count;
    renderStats();

    if (state.answers >= 2 && state.reflectSec >= 2){
      finishGame();
    }
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.gameTimer);
    clearInterval(state.reflectTimer);
    [...moodBtns, ...energyBtns].forEach(btn => btn.disabled = true);
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดสรุปผล';
    renderStats();
  }

  moodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.started || state.finished) return;
      state.mood = btn.dataset.mood || '';
      moodBtns.forEach(b => b.classList.toggle('is-picked', b === btn));
      cueEl.textContent = 'บันทึกความรู้สึกแล้ว';
      updateAnswers();
    });
  });

  energyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.started || state.finished) return;
      state.energy = btn.dataset.energy || '';
      energyBtns.forEach(b => b.classList.toggle('is-picked', b === btn));
      cueEl.textContent = 'บันทึกระดับพลังงานแล้ว';
      updateAnswers();
    });
  });

  startBtn.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    [...moodBtns, ...energyBtns].forEach(btn => btn.disabled = false);

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
      if (state.remainSec <= 0) finishGame();
    }, 1000);

    state.reflectTimer = setInterval(() => {
      if (!state.finished){
        state.reflectSec += 1;
        renderStats();
        if (state.answers >= 2 && state.reflectSec >= 2){
          finishGame();
        }
      }
    }, 1000);
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}
