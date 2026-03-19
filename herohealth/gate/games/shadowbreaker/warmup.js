/* === /herohealth/gate/games/shadowbreaker/warmup.js ===
 * HeroHealth Gate Game: ShadowBreaker Warmup
 * FULL PATCH v20260319a-SHADOWBREAKER-WARMUP-API-FINISH-FIX
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
  const id = 'hh-gate-style-shadowbreaker';
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
  const totalAsked = Math.max(1, state.total);
  const score = clamp(Math.round((state.success / totalAsked) * 100), 0, 100);
  const passed = score >= 60 || state.success >= 5;

  return {
    ok: true,
    zone: 'exercise',
    game: 'shadowbreaker',
    phase: 'warmup',
    activityId: 'shadowbreaker-light-dodge-prep',
    title: 'ซ้อมหลบเร็ว',
    subtitle: passed
      ? 'พร้อมแล้ว ไปเล่น Shadow Breaker กัน'
      : 'ลองซ้อมหลบอีกนิด ให้ไวขึ้นอีกหน่อย',
    passed,
    score,
    stars: starsFromScore(score),
    lines: [
      `รอบ ${Math.min(state.roundIndex + 1, state.maxRounds)}/${state.maxRounds}`,
      `สำเร็จ ${state.success}`,
      `ผิด ${state.fail}`,
      `ไม่ทัน ${state.misses}`,
      `RT เฉลี่ย ${state.reactionCount ? Math.round(state.reactionSum / state.reactionCount) : 0} ms`
    ],
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
    buffs: {
      wType: 'shadowbreaker_warmup',
      wPct: score,
      wSuccess: state.success,
      wFail: state.fail,
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
      <div class="sbg-wrap">
        <section class="sbg-card">
          <div class="sbg-kicker">EXERCISE ZONE • WARMUP</div>
          <h1 class="sbg-title">⚡ ซ้อมหลบเร็ว</h1>
          <p class="sbg-subtitle">โมดูลนี้ใช้สำหรับ phase=warmup เท่านั้น</p>
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
    submitted: false,

    total: 0,
    maxRounds: TOTAL_ROUNDS,
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
          <button class="sbg-btn sbg-btn-primary" id="sbg-start" type="button">เริ่มอุ่นเครื่อง</button>
          <button class="sbg-btn sbg-btn-ghost" id="sbg-finish" type="button" disabled>ดูผล</button>
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

  function shownRound(){
    if (state.finished) return TOTAL_ROUNDS;
    return clamp(state.roundIndex + 1, 0, TOTAL_ROUNDS);
  }

  function canOpenResult(){
    return state.finished === true
      || state.success >= 5
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
      <span>สำเร็จ ${state.success}</span>
      <span>พลาด ${state.fail + state.misses}</span>
    `;
    syncFinishBtn();
  }

  function lockActions(locked){
    actionsEl.querySelectorAll('.sbg-btn-action').forEach(btn => {
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
    state.roundTimer = null;

    const rt = Math.max(0, Math.round(performance.now() - state.cueAt));
    state.reactionSum += rt;
    state.reactionCount += 1;

    if (action === cue.id){
      state.success += 1;
      cueEl.textContent = `หลบสำเร็จ! ${cue.label}`;
    }else{
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

  function startInternal(){
    if (state.started) return;
    state.started = true;

    startBtn.disabled = true;
    startBtn.style.pointerEvents = 'none';
    startBtn.style.opacity = '.65';

    lockActions(false);
    cueEl.textContent = 'เริ่ม!';
    renderStats();

    api?.setSub?.('กดให้ตรงกับท่าหลบ ซ้าย ขวา และย่อ');
    api?.logger?.push?.('shadowbreaker_warmup_start', {
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

  finishBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    submitResult();
  }, { passive:false });

  renderStats();
  syncFinishBtn();

  api?.setSub?.('เริ่มอุ่นเครื่องแล้วกดให้ตรงกับท่าหลบ');
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