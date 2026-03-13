/* === /herohealth/gate/games/shadowbreaker/warmup.js ===
 * HeroHealth Gate Game: ShadowBreaker Warmup
 * PATCH v20260312e-SHADOWBREAKER-WARMUP-TH-CHILD
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
  const id = 'hh-gate-style-shadowbreaker';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = './gate/games/shadowbreaker/style.css';
  document.head.appendChild(link);
}

function starsFromScore(score){
  if (score >= 90) return 3;
  if (score >= 70) return 2;
  return 1;
}

function makeResult(state){
  const score = clamp(Math.round((state.success / Math.max(1, state.total)) * 100), 0, 100);
  const passed = score >= 60 || state.success >= 5;
  return {
    ok: true,
    zone: 'exercise',
    game: 'shadowbreaker',
    phase: 'warmup',
    activityId: 'shadowbreaker-light-dodge-prep',
    title: 'ซ้อมหลบเร็ว',
    passed,
    score,
    stars: starsFromScore(score),
    metrics: {
      total: state.total,
      success: state.success,
      fail: state.fail,
      misses: state.misses,
      avgReactionMs: state.reactionCount ? Math.round(state.reactionSum / state.reactionCount) : 0,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'positive' : 'gentle',
      line: passed
        ? 'พร้อมแล้ว ไปเล่น Shadow Breaker กัน'
        : 'ลองซ้อมหลบอีกนิด ให้ไวขึ้นอีกหน่อย'
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
      <div class="sbg-wrap">
        <section class="sbg-card">
          <div class="sbg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="sbg-title">⚡ ซ้อมหลบเร็ว</h1>
          <p class="sbg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
        </section>
      </div>
    `;
    return;
  }

  const seed = Number(getParam(ctx, 'seed', Date.now()));
  const TOTAL_ROUNDS = 7;
  const ROUND_MS = 1900;
  const GAME_SEC = 20;

  const cues = [
    { id:'left', label:'หลบซ้าย', emoji:'↙️' },
    { id:'right', label:'หลบขวา', emoji:'↘️' },
    { id:'duck', label:'ย่อหลบ', emoji:'⬇️' }
  ];

  const state = {
    started: false,
    finished: false,
    total: 0,
    success: 0,
    fail: 0,
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
    const idx = Math.abs((seed + i * 13) % cues.length);
    state.sequence.push(cues[idx]);
  }

  root.innerHTML = `
    <div class="sbg-wrap">
      <section class="sbg-card">
        <div class="sbg-kicker">EXERCISE ZONE • WARMUP</div>
        <h1 class="sbg-title">⚡ ซ้อมหลบเร็ว</h1>
        <p class="sbg-subtitle">ซ้อมหลบซ้าย ขวา และย่อ ก่อนเข้าเกม Shadow Breaker</p>

        <div class="sbg-grid">
          <div class="sbg-panel">
            <h2 class="sbg-h2">วิธีเล่น</h2>
            <ol class="sbg-list">
              <li>กดปุ่มให้ตรงกับท่าหลบที่ขึ้นบนจอ</li>
              <li>มี 3 ท่า: หลบซ้าย หลบขวา ย่อหลบ</li>
              <li>ทำสำเร็จอย่างน้อย 5 ครั้ง</li>
            </ol>
          </div>

          <div class="sbg-panel sbg-play">
            <div class="sbg-phase-badge">WARMUP</div>
            <div class="sbg-cue" id="sbg-cue">พร้อม</div>
            <div class="sbg-timer" id="sbg-timer">${GAME_SEC}s</div>
            <div class="sbg-stats" id="sbg-stats">
              <span>รอบ 0/${TOTAL_ROUNDS}</span>
              <span>สำเร็จ 0</span>
              <span>พลาด 0</span>
            </div>

            <div class="sbg-actions" id="sbg-actions">
              ${cues.map(c => `
                <button class="sbg-btn-action" type="button" data-action="${c.id}" disabled>
                  <span class="sbg-emoji">${c.emoji}</span>
                  <span>${c.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="sbg-footer">
          <button class="sbg-btn sbg-btn-primary" id="sbg-start">เริ่มอุ่นเครื่อง</button>
          <button class="sbg-btn sbg-btn-ghost" id="sbg-finish" disabled>ดูผล</button>
        </div>
      </section>
    </div>
  `;

  const cueEl = root.querySelector('#sbg-cue');
  const timerEl = root.querySelector('#sbg-timer');
  const statsEl = root.querySelector('#sbg-stats');
  const actionsEl = root.querySelector('#sbg-actions');
  const startBtn = root.querySelector('#sbg-start');
  const finishBtn = root.querySelector('#sbg-finish');

  function renderStats(){
    statsEl.innerHTML = `
      <span>รอบ ${Math.max(0, state.roundIndex + 1)}/${TOTAL_ROUNDS}</span>
      <span>สำเร็จ ${state.success}</span>
      <span>พลาด ${state.fail + state.misses}</span>
    `;
  }

  function lockActions(locked){
    actionsEl.querySelectorAll('.sbg-btn-action').forEach(btn => { btn.disabled = locked; });
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearTimeout(state.roundTimer);
    clearInterval(state.gameTimer);
    lockActions(true);
    startBtn.disabled = true;
    finishBtn.disabled = false;
    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
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
      setTimeout(nextCue, 520);
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
      state.success += 1;
      cueEl.textContent = `หลบสำเร็จ! ${cue.label}`;
    } else {
      state.fail += 1;
      cueEl.textContent = `ยังไม่ใช่ — ต้องเป็น ${cue.label}`;
    }

    renderStats();
    setTimeout(nextCue, 430);
  }

  actionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.sbg-btn-action');
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