/* === /herohealth/gate/games/rhythmboxer/warmup.js ===
 * HeroHealth Gate Game: RhythmBoxer Warmup
 * PATCH v20260312-RHYTHMBOXER-WARMUP-A
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
  const id = 'hh-gate-style-rhythmboxer';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './gate/games/rhythmboxer/style.css';
  document.head.appendChild(link);
}

function starsFromScore(score){
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function makeResult(state){
  const score = clamp(Math.round((state.hit / Math.max(1, state.total)) * 100), 0, 100);
  const passed = score >= 60 || state.hit >= 5;
  return {
    ok: true,
    zone: 'exercise',
    game: 'rhythmboxer',
    phase: 'warmup',
    activityId: 'rhythmboxer-shoulder-roll-beat',
    title: 'Shoulder Roll Beat',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      total: state.total,
      hit: state.hit,
      wrong: state.wrong,
      misses: state.misses,
      avgReactionMs: state.reactionCount ? Math.round(state.reactionSum / state.reactionCount) : 0,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'positive' : 'gentle',
      line: passed
        ? 'ไหล่และแขนพร้อมแล้ว ไปเริ่ม Rhythm Boxer กัน'
        : 'ลองจับจังหวะให้แม่นขึ้นอีกนิด แล้วค่อยเข้าด่านหลัก'
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
      <div class="rbg-wrap">
        <section class="rbg-card">
          <div class="rbg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="rbg-title">🥊 Shoulder Roll Beat</h1>
          <p class="rbg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
        </section>
      </div>
    `;
    return;
  }

  const seed = Number(getParam(ctx, 'seed', Date.now()));
  const TOTAL_ROUNDS = 8;
  const ROUND_MS = 1700;
  const GAME_SEC = 20;

  const cues = [
    { id:'left', label:'ซ้าย', emoji:'👊', side:'L' },
    { id:'right', label:'ขวา', emoji:'👊', side:'R' },
    { id:'both', label:'พร้อมกัน', emoji:'🥊', side:'LR' }
  ];

  const state = {
    started: false,
    finished: false,
    total: 0,
    hit: 0,
    wrong: 0,
    misses: 0,
    reactionSum: 0,
    reactionCount: 0,
    roundIndex: -1,
    cueAt: 0,
    remainSec: GAME_SEC,
    roundTimer: null,
    gameTimer: null,
    sequence: []
  };

  for (let i = 0; i < TOTAL_ROUNDS; i++){
    const idx = Math.abs((seed + i * 17) % cues.length);
    state.sequence.push(cues[idx]);
  }

  root.innerHTML = `
    <div class="rbg-wrap">
      <section class="rbg-card">
        <div class="rbg-kicker">EXERCISE ZONE • WARMUP</div>
        <h1 class="rbg-title">🥊 Shoulder Roll Beat</h1>
        <p class="rbg-subtitle">เปิดไหล่และจับจังหวะก่อนเข้าเกม Rhythm Boxer</p>

        <div class="rbg-grid">
          <div class="rbg-panel">
            <h2 class="rbg-h2">วิธีเล่น</h2>
            <ol class="rbg-list">
              <li>กดปุ่มให้ตรงกับจังหวะที่ขึ้นบนจอ</li>
              <li>มี 3 แบบ: ซ้าย ขวา พร้อมกัน</li>
              <li>ทำให้ถูกอย่างน้อย 5 ครั้ง หรือคะแนนรวม 60%</li>
            </ol>
          </div>

          <div class="rbg-panel rbg-play">
            <div class="rbg-phase-badge">WARMUP</div>
            <div class="rbg-cue" id="rbg-cue">พร้อม</div>
            <div class="rbg-timer" id="rbg-timer">${GAME_SEC}s</div>
            <div class="rbg-stats" id="rbg-stats">
              <span>รอบ 0/${TOTAL_ROUNDS}</span>
              <span>ถูก 0</span>
              <span>พลาด 0</span>
            </div>

            <div class="rbg-actions" id="rbg-actions">
              <button class="rbg-btn-action" type="button" data-action="left" disabled>
                <span class="rbg-emoji">👈</span>
                <span>ซ้าย</span>
              </button>
              <button class="rbg-btn-action" type="button" data-action="both" disabled>
                <span class="rbg-emoji">🥊</span>
                <span>พร้อมกัน</span>
              </button>
              <button class="rbg-btn-action" type="button" data-action="right" disabled>
                <span class="rbg-emoji">👉</span>
                <span>ขวา</span>
              </button>
            </div>
          </div>
        </div>

        <div class="rbg-footer">
          <button class="rbg-btn rbg-btn-primary" id="rbg-start">เริ่มอุ่นเครื่อง</button>
          <button class="rbg-btn rbg-btn-ghost" id="rbg-finish" disabled>สรุปผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#rbg-cue');
  const timerEl = root.querySelector('#rbg-timer');
  const statsEl = root.querySelector('#rbg-stats');
  const actionsEl = root.querySelector('#rbg-actions');
  const startBtn = root.querySelector('#rbg-start');
  const finishBtn = root.querySelector('#rbg-finish');

  function renderStats(){
    statsEl.innerHTML = `
      <span>รอบ ${Math.max(0, state.roundIndex + 1)}/${TOTAL_ROUNDS}</span>
      <span>ถูก ${state.hit}</span>
      <span>พลาด ${state.wrong + state.misses}</span>
    `;
  }

  function lockActions(locked){
    actionsEl.querySelectorAll('.rbg-btn-action').forEach(btn => { btn.disabled = locked; });
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearTimeout(state.roundTimer);
    clearInterval(state.gameTimer);
    lockActions(true);
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดสรุปผล';
    renderStats();
  }

  function nextCue(){
    if (state.finished) return;
    state.roundIndex += 1;

    if (state.roundIndex >= state.sequence.length){
      finishGame();
      return;
    }

    const cue = state.sequence[state.roundIndex];
    state.total += 1;
    state.cueAt = performance.now();
    cueEl.textContent = `${cue.emoji} ${cue.label}`;
    renderStats();

    clearTimeout(state.roundTimer);
    state.roundTimer = setTimeout(() => {
      state.misses += 1;
      cueEl.textContent = `ไม่ทัน! คำตอบคือ ${cue.label}`;
      renderStats();
      setTimeout(nextCue, 480);
    }, ROUND_MS);
  }

  function answer(action){
    if (!state.started || state.finished || state.roundIndex < 0) return;

    const cue = state.sequence[state.roundIndex];
    clearTimeout(state.roundTimer);

    const rt = Math.max(0, Math.round(performance.now() - state.cueAt));
    state.reactionSum += rt;
    state.reactionCount += 1;

    if (action === cue.id){
      state.hit += 1;
      cueEl.textContent = `เข้าจังหวะ! ${cue.label}`;
    } else {
      state.wrong += 1;
      cueEl.textContent = `ยังไม่ใช่ — ต้องเป็น ${cue.label}`;
    }

    renderStats();
    setTimeout(nextCue, 420);
  }

  actionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.rbg-btn-action');
    if (!btn) return;
    answer(btn.dataset.action || '');
  });

  startBtn.addEventListener('click', () => {
    if (state.started) return;
    state.started = true;
    startBtn.disabled = true;
    lockActions(false);
    cueEl.textContent = 'เริ่ม!';
    renderStats();

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
      if (state.remainSec <= 0) finishGame();
    }, 1000);

    setTimeout(nextCue, 500);
  });

  finishBtn.addEventListener('click', () => {
    onComplete(makeResult(state));
  });
}
