/* === /herohealth/gate/games/jumpduck/warmup.js ===
 * HeroHealth Gate Game: JumpDuck Warmup
 * FULL PATCH v20260319a-JUMPDUCK-WARMUP-API-FINISH-FIX
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
  const id = 'hh-gate-style-jumpduck';
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
    Math.round((state.correct / Math.max(1, state.total)) * 100),
    0,
    100
  );
  const passed = score >= 60 || state.correct >= 4;

  return {
    ok: true,
    zone: 'exercise',
    game: 'jumpduck',
    phase: 'warmup',
    activityId: 'jumpduck-quick-feet-prep',
    title: 'ซ้อมกระโดด-ย่อ',
    subtitle: passed
      ? 'พร้อมแล้ว ไปเล่น Jump Duck กัน'
      : 'ลองซ้อมอีกนิด จับจังหวะกระโดดและย่อให้แม่นขึ้น',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `รอบ ${Math.min(state.roundIndex + 1, state.total)}/${state.total}`,
      `ถูก ${state.correct}`,
      `ผิด ${state.wrong}`,
      `ไม่ทัน ${state.misses}`,
      `RT เฉลี่ย ${state.reactionCount ? Math.round(state.reactionSum / state.reactionCount) : 0} ms`
    ],
    metrics: {
      total: state.total,
      correct: state.correct,
      wrong: state.wrong,
      misses: state.misses,
      avgReactionMs: state.reactionCount ? Math.round(state.reactionSum / state.reactionCount) : 0,
      finished: state.finished ? 1 : 0
    },
    coach: {
      tone: passed ? 'positive' : 'gentle',
      line: passed
        ? 'พร้อมแล้ว ไปเล่น Jump Duck กัน'
        : 'ลองซ้อมอีกนิด จับจังหวะกระโดดและย่อให้แม่นขึ้น'
    },
    buffs: {
      wType: 'jumpduck_warmup',
      wPct: score,
      wCorrect: state.correct,
      wWrong: state.wrong,
      wMisses: state.misses,
      wStars: starsFromScore(score)
    },
    nextAction: 'run',
    markDailyDone: true
  };
}

export function mount(root, ctx = {}, api = {}) {
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
      <div class="jdg-wrap">
        <section class="jdg-card">
          <div class="jdg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="jdg-title">🦘 ซ้อมกระโดด-ย่อ</h1>
          <p class="jdg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
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
  const ROUND_MS = 1800;
  const GAME_SEC = 20;

  const cues = [
    { id:'left',  label:'ซ้าย',    emoji:'⬅️' },
    { id:'right', label:'ขวา',     emoji:'➡️' },
    { id:'duck',  label:'ย่อ',     emoji:'⬇️' },
    { id:'jump',  label:'กระโดด',  emoji:'⬆️' }
  ];

  const state = {
    started: false,
    finished: false,
    submitted: false,
    total: TOTAL_ROUNDS,
    correct: 0,
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
    const idx = Math.abs((seed + i * 11) % cues.length);
    state.sequence.push(cues[idx]);
  }

  root.innerHTML = `
    <div class="jdg-wrap">
      <section class="jdg-card">
        <div class="jdg-kicker">EXERCISE ZONE • WARMUP</div>
        <h1 class="jdg-title">🦘 ซ้อมกระโดด-ย่อ</h1>
        <p class="jdg-subtitle">ซ้อมกระโดดและย่อก่อนเข้าเกม Jump Duck</p>

        <div class="jdg-grid">
          <div class="jdg-panel">
            <h2 class="jdg-h2">วิธีเล่น</h2>
            <ol class="jdg-list">
              <li>กดปุ่มให้ตรงกับคำสั่งที่ขึ้นบนจอ</li>
              <li>มี 4 ท่า: ซ้าย ขวา ย่อ กระโดด</li>
              <li>ทำให้ถูกอย่างน้อย 4 ครั้ง</li>
            </ol>
          </div>

          <div class="jdg-panel jdg-play">
            <div class="jdg-phase-badge">WARMUP</div>
            <div class="jdg-cue" id="jdg-cue">พร้อม</div>
            <div class="jdg-timer" id="jdg-timer">${GAME_SEC}s</div>
            <div class="jdg-stats" id="jdg-stats">
              <span>รอบ 0/${TOTAL_ROUNDS}</span>
              <span>ถูก 0</span>
              <span>ผิด 0</span>
            </div>

            <div class="jdg-actions" id="jdg-actions">
              ${cues.map(c => `
                <button class="jdg-btn-action" type="button" data-action="${c.id}" disabled>
                  <span class="jdg-emoji">${c.emoji}</span>
                  <span>${c.label}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="jdg-footer">
          <button class="jdg-btn jdg-btn-primary" id="jdg-start" type="button">เริ่มอุ่นเครื่อง</button>
          <button class="jdg-btn jdg-btn-ghost" id="jdg-finish" type="button" disabled>ดูผล</button>
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

  function shownRound(){
    if (state.finished) return TOTAL_ROUNDS;
    return clamp(state.roundIndex + 1, 0, TOTAL_ROUNDS);
  }

  function canOpenResult(){
    return state.finished === true
      || state.correct >= 4
      || state.roundIndex >= TOTAL_ROUNDS;
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
      <span>รอบ ${shownRound()}/${TOTAL_ROUNDS}</span>
      <span>ถูก ${state.correct}</span>
      <span>ผิด ${state.wrong + state.misses}</span>
    `;
    syncFinishBtn();
  }

  function lockActions(locked){
    actionsEl.querySelectorAll('.jdg-btn-action').forEach(btn => {
      btn.disabled = locked;
      btn.style.pointerEvents = locked ? 'none' : 'auto';
      btn.style.opacity = locked ? '.7' : '1';
    });
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

    clearTimeout(state.roundTimer);
    clearInterval(state.gameTimer);
    state.roundTimer = null;
    state.gameTimer = null;

    lockActions(true);

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    timerEl.textContent = `${Math.max(0, state.remainSec)}s`;
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
    state.roundTimer = null;

    const rt = Math.max(0, Math.round(performance.now() - state.cueAt));
    state.reactionSum += rt;
    state.reactionCount += 1;

    if (action === cue.id){
      state.correct += 1;
      cueEl.textContent = `ถูกต้อง! ${cue.label}`;
    }else{
      state.wrong += 1;
      cueEl.textContent = `ยังไม่ใช่ — ต้องเป็น ${cue.label}`;
    }

    renderStats();
    setTimeout(nextCue, 420);
  }

  actionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.jdg-btn-action');
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

    api?.setSub?.('กดให้ตรงกับคำสั่ง ซ้าย ขวา ย่อ กระโดด');
    api?.logger?.push?.('jumpduck_warmup_start', {
      seed,
      totalRounds: TOTAL_ROUNDS
    });

    state.gameTimer = setInterval(() => {
      state.remainSec -= 1;
      timerEl.textContent = `${Math.max(0, state.remainSec)}s`;

      if (state.remainSec <= 0){
        state.remainSec = 0;
        finishGame();
      }
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

  renderStats();
  syncFinishBtn();

  api?.setSub?.('เริ่มอุ่นเครื่องแล้วกดให้ตรงกับคำสั่ง');
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
      clearTimeout(state.roundTimer);
      clearInterval(state.gameTimer);
      state.roundTimer = null;
      state.gameTimer = null;
      state.finished = true;
    }
  };
}

export default { loadStyle, mount };