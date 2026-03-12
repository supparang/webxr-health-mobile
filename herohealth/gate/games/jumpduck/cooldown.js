/* === /herohealth/gate/games/jumpduck/cooldown.js ===
 * HeroHealth Gate Game: JumpDuck Cooldown
 * PATCH v20260312c-JUMPDUCK-COOLDOWN-MOBILE-CACHE
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
  const id = 'hh-gate-style-jumpduck';
  const href = './gate/games/jumpduck/style.css?v=20260312c';

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
  const score = clamp(Math.round((state.starsDone * 28) + (state.holdSeconds * 4)), 0, 100);
  const passed = state.starsDone >= 3 && state.holdSeconds >= 6;
  return {
    ok: true,
    zone: 'exercise',
    game: 'jumpduck',
    phase: 'cooldown',
    activityId: 'jumpduck-leg-stretch-stars',
    title: 'Leg Stretch Stars',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      starsDone: state.starsDone,
      holdSeconds: state.holdSeconds,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'calm' : 'gentle',
      line: passed
        ? 'ยืดขาเรียบร้อยแล้ว ร่างกายพร้อมพัก'
        : 'ค้างท่ายืดอีกนิด จะช่วยให้ขาผ่อนคลายมากขึ้น'
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
      <div class="jdg-wrap">
        <section class="jdg-card">
          <div class="jdg-kicker">EXERCISE ZONE • COOLDOWN</div>
          <h1 class="jdg-title">⭐ Leg Stretch Stars</h1>
          <p class="jdg-subtitle">โมดูลนี้ใช้สำหรับ phase=cooldown เท่านั้น</p>
        </section>
      </div>
    `;
    return;
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
        <h1 class="jdg-title">⭐ Leg Stretch Stars</h1>
        <p class="jdg-subtitle">ยืดขาหลังจบเกม Jump Duck</p>

        <div class="jdg-grid">
          <div class="jdg-panel">
            <h2 class="jdg-h2">วิธีทำ</h2>
            <ol class="jdg-list">
              <li>แตะดาวทีละดวงตามลำดับ</li>
              <li>ค้างท่ายืดเบา ๆ ระหว่างทำ</li>
              <li>ทำครบ 3 ดวง และค้างรวมอย่างน้อย 6 วินาที</li>
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
          <button class="jdg-btn jdg-btn-primary" id="jdg-start">เริ่มคูลดาวน์</button>
          <button class="jdg-btn jdg-btn-ghost" id="jdg-finish" disabled>สรุปผล</button>
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

  function renderStats(){
    statsEl.innerHTML = `
      <span>ดาว ${state.starsDone}/3</span>
      <span>ค้าง ${state.holdSeconds}s</span>
    `;
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearInterval(state.gameTimer);
    clearInterval(state.holdTimer);
    actionsEl.querySelectorAll('.jdg-btn-action').forEach(btn => { btn.disabled = true; });
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดสรุปผล';
    renderStats();
  }

  actionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.jdg-btn-action');
    if (!btn || !state.started || state.finished) return;

    const star = btn.dataset.star || '';
    if (state.doneMap[star]) return;

    state.doneMap[star] = 1;
    state.starsDone += 1;
    btn.disabled = true;
    btn.classList.add('is-done');
    cueEl.textContent = `ดีมาก ${btn.textContent.trim()}`;
    renderStats();

    if (state.starsDone >= 3 && state.holdSeconds >= 6){
      finishGame();
    }
  });

  startBtn.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    actionsEl.querySelectorAll('.jdg-btn-action').forEach(btn => { btn.disabled = false; });

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
      if (state.remainSec <= 0) finishGame();
    }, 1000);

    state.holdTimer = setInterval(() => {
      if (!state.finished && state.starsDone > 0){
        state.holdSeconds += 1;
        renderStats();
        if (state.starsDone >= 3 && state.holdSeconds >= 6){
          finishGame();
        }
      }
    }, 1000);
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}