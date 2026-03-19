/* === /herohealth/gate/games/fitnessplanner/cooldown.js ===
 * HeroHealth Gate Game: FitnessPlanner Cooldown
 * FULL PATCH v20260319b-FITNESSPLANNER-COOLDOWN-MANUAL-RESULT
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
  const score = clamp(Math.round((state.answers * 34) + (state.reflectSec * 8)), 0, 100);
  const passed = state.answers >= 2 && state.reflectSec >= 2;

  return {
    ok: true,
    zone: 'exercise',
    game: 'fitnessplanner',
    phase: 'cooldown',
    activityId: 'fitnessplanner-mindful-reflection',
    title: 'ทบทวนความรู้สึก',
    subtitle: passed
      ? 'ทบทวนเสร็จแล้ว เก่งมาก'
      : 'เลือกความรู้สึกของตัวเองอีกนิด แล้วค่อยกลับ',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `ตอบ ${state.answers} ข้อ`,
      `คิดทบทวน ${state.reflectSec} วินาที`,
      `ความรู้สึก: ${state.mood || '-'}`,
      `พลังงาน: ${state.energy || '-'}`,
      `คะแนน ${score}%`
    ],
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
        ? 'ทบทวนเสร็จแล้ว เก่งมาก'
        : 'เลือกความรู้สึกของตัวเองอีกนิด แล้วค่อยกลับ'
    },
    buffs: {
      wType: 'fitnessplanner_cooldown',
      wPct: score,
      wAnswers: state.answers,
      wReflectSec: state.reflectSec,
      wMood: state.mood || '',
      wEnergy: state.energy || '',
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
      <div class="fpg-wrap fpg-wrap-cool">
        <section class="fpg-card">
          <div class="fpg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="fpg-title">🌙 ทบทวนความรู้สึก</h1>
          <p class="fpg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
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

  const state = {
    started: false,
    finished: false,
    submitted: false,

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
        <h1 class="fpg-title">🌙 ทบทวนความรู้สึก</h1>
        <p class="fpg-subtitle">บอกความรู้สึกของตัวเองหลังจบเกม Fitness Planner</p>

        <div class="fpg-grid">
          <div class="fpg-panel">
            <h2 class="fpg-h2">วิธีเล่น</h2>
            <ol class="fpg-list">
              <li>เลือกความรู้สึกวันนี้ 1 อย่าง</li>
              <li>เลือกระดับพลังงาน 1 อย่าง</li>
              <li>อยู่ต่ออีกนิดเพื่อทบทวนตัวเอง</li>
            </ol>
          </div>

          <div class="fpg-panel fpg-play">
            <div class="fpg-phase-badge fpg-phase-badge-cool">COOLDOWN</div>
            <div class="fpg-cue fpg-cue-cool" id="fpg-cue">วันนี้รู้สึกยังไง?</div>
            <div class="fpg-timer" id="fpg-timer">${GAME_SEC}s</div>
            <div class="fpg-stats" id="fpg-stats">
              <span>ตอบ 0</span>
              <span>คิดทบทวน 0s</span>
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
          <button class="fpg-btn fpg-btn-primary" id="fpg-start" type="button">เริ่มผ่อนคลาย</button>
          <button class="fpg-btn fpg-btn-ghost" id="fpg-finish" type="button" disabled>ดูผล</button>
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

  function canOpenResult(){
    return state.finished === true
      || (state.answers >= 2 && state.reflectSec >= 2)
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
      <span>ตอบ ${state.answers}</span>
      <span>คิดทบทวน ${state.reflectSec}s</span>
    `;
    syncFinishBtn();
  }

  function setChoiceButtonsEnabled(enabled){
    [...moodBtns, ...energyBtns].forEach(btn => {
      btn.disabled = !enabled;
      btn.style.pointerEvents = enabled ? 'auto' : 'none';
      btn.style.opacity = enabled ? '1' : '.7';
    });
  }

  function stopReflectTimer(){
    clearInterval(state.reflectTimer);
    state.reflectTimer = null;
  }

  function stopAllTimers(){
    clearInterval(state.gameTimer);
    state.gameTimer = null;
    stopReflectTimer();
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
    setChoiceButtonsEnabled(false);

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    cueEl.textContent = 'ทบทวนเสร็จแล้ว กดดูผล';
    timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
    renderStats();
  }

  function pickMood(btn){
    if (!state.started || state.finished) return;

    state.mood = btn.dataset.mood || '';
    moodBtns.forEach(b => b.classList.toggle('is-picked', b === btn));
    cueEl.textContent = 'เลือกความรู้สึกแล้ว';
    updateAnswers();
  }

  function pickEnergy(btn){
    if (!state.started || state.finished) return;

    state.energy = btn.dataset.energy || '';
    energyBtns.forEach(b => b.classList.toggle('is-picked', b === btn));
    cueEl.textContent = 'เลือกระดับพลังงานแล้ว';
    updateAnswers();
  }

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    setChoiceButtonsEnabled(true);

    api?.setSub?.('เลือกความรู้สึก เลือกพลังงาน แล้วค่อยทบทวนตัวเอง');
    api?.logger?.push?.('fitnessplanner_cooldown_start', {
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

    state.reflectTimer = setInterval(() => {
      if (state.finished) return;

      state.reflectSec += 1;
      renderStats();

      if (state.answers >= 2 && state.reflectSec >= 2){
        finishGame();
      }
    }, 1000);
  }

  moodBtns.forEach(btn => {
    btn.addEventListener('click', () => pickMood(btn));
  });

  energyBtns.forEach(btn => {
    btn.addEventListener('click', () => pickEnergy(btn));
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

  api?.setSub?.('เริ่มผ่อนคลายแล้วเลือกความรู้สึกของตัวเอง');
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