/* === /herohealth/gate/games/rhythmboxer/warmup.js ===
 * HeroHealth Gate Game: RhythmBoxer Warmup
 * FULL PATCH v20260319b-RHYTHMBOXER-WARMUP-MANUAL-RESULT
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
  const id = 'hh-gate-style-rhythmboxer';
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
  const score = clamp(Math.round((state.hit / Math.max(1, state.total)) * 100), 0, 100);
  const passed = score >= 60 || state.hit >= 5;
  return {
    ok: true,
    zone: 'exercise',
    game: 'rhythmboxer',
    phase: 'warmup',
    activityId: 'rhythmboxer-shoulder-roll-beat',
    title: 'ซ้อมต่อยตามจังหวะ',
    subtitle: passed
      ? 'พร้อมแล้ว ไปเล่น Rhythm Boxer กัน'
      : 'ลองจับจังหวะอีกนิด แล้วค่อยเริ่มเกม',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `ตีถูก ${state.hit}/${state.total}`,
      `ตีผิด ${state.wrong}`,
      `พลาด ${state.misses}`,
      `เวลาเฉลี่ย ${state.reactionCount ? Math.round(state.reactionSum / state.reactionCount) : 0} ms`
    ],
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
        ? 'พร้อมแล้ว ไปเล่น Rhythm Boxer กัน'
        : 'ลองจับจังหวะอีกนิด แล้วค่อยเริ่มเกม'
    },
    buffs: {
      wType: 'rhythmboxer_warmup',
      wPct: score,
      wHit: state.hit,
      wWrong: state.wrong,
      wMisses: state.misses,
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
      <div class="rbg-wrap">
        <section class="rbg-card">
          <div class="rbg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="rbg-title">🥊 ซ้อมต่อยตามจังหวะ</h1>
          <p class="rbg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
        </section>
      </div>
    `;
    return {
      autostart: false,
      start(){},
      destroy(){}
    };
  }

  const seed = Number(getParam(ctx, 'seed', Date.now()));
  const TOTAL_ROUNDS = 8;
  const ROUND_MS = 1700;
  const GAME_SEC = 20;

  const cues = [
    { id:'left', label:'ซ้าย', emoji:'👊', side:'L' },
    { id:'right', label:'ขวา', emoji:'👊', side:'R' },
    { id:'both', label:'สองมือ', emoji:'🥊', side:'LR' }
  ];

  const state = {
    started: false,
    finished: false,
    ended: false,
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
        <h1 class="rbg-title">🥊 ซ้อมต่อยตามจังหวะ</h1>
        <p class="rbg-subtitle">ซ้อมต่อยซ้าย ขวา และสองมือ ก่อนเข้าเกม Rhythm Boxer</p>

        <div class="rbg-grid">
          <div class="rbg-panel">
            <h2 class="rbg-h2">วิธีเล่น</h2>
            <ol class="rbg-list">
              <li>กดปุ่มให้ตรงกับจังหวะที่ขึ้นบนจอ</li>
              <li>มี 3 แบบ: ซ้าย ขวา สองมือ</li>
              <li>ทำให้ถูกอย่างน้อย 5 ครั้ง</li>
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
                <span>สองมือ</span>
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
          <button class="rbg-btn rbg-btn-ghost" id="rbg-finish" type="button" disabled>ดูผล</button>
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

  function canOpenResult(){
    return state.finished === true;
  }

  function syncFinishBtn(){
    const ready = canOpenResult();
    finishBtn.disabled = !ready;
    finishBtn.style.pointerEvents = ready ? 'auto' : 'none';
    finishBtn.style.opacity = ready ? '1' : '.65';
  }

  function renderStats(){
    statsEl.innerHTML = `
      <span>รอบ ${Math.max(0, state.roundIndex + 1)}/${TOTAL_ROUNDS}</span>
      <span>ถูก ${state.hit}</span>
      <span>พลาด ${state.wrong + state.misses}</span>
    `;
    syncFinishBtn();
  }

  function lockActions(locked){
    actionsEl.querySelectorAll('.rbg-btn-action').forEach(btn => {
      btn.disabled = locked;
      btn.style.pointerEvents = locked ? 'none' : 'auto';
      btn.style.opacity = locked ? '.7' : '1';
    });
  }

  function finishGame(){
    if (state.finished) return;
    state.finished = true;
    clearTimeout(state.roundTimer);
    clearInterval(state.gameTimer);
    lockActions(true);

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    cueEl.textContent = 'เสร็จแล้ว กดดูผล';
    renderStats();
  }

  function nextCue(){
    if (state.finished || state.ended) return;
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

  function submitResult(){
    if (!canOpenResult()) return;
    if (state.ended) return;
    state.ended = true;
    complete(makeResult(state));
  }

  actionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.rbg-btn-action');
    if (!btn) return;
    answer(btn.dataset.action || '');
  });

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    lockActions(false);
    cueEl.textContent = 'เริ่ม!';
    renderStats();

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
      if (state.remainSec <= 0) finishGame();
    }, 1000);
    setTimeout(nextCue, 500);
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

  finishBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitResult();
  }, { passive:false });

  renderStats();
  syncFinishBtn();

  api?.setSub?.('ต่อยให้ตรงจังหวะ ซ้าย ขวา หรือสองมือ');
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
      state.ended = true;
      clearTimeout(state.roundTimer);
      clearInterval(state.gameTimer);
    }
  };
}

export default { loadStyle, mount };