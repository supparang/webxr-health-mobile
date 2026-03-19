// === /herohealth/gate/helpers/sequence-warmup.js ===
// FULL PATCH v20260318-SEQUENCE-WARMUP-MANUAL-START-HIDE-HARDENED
// ✅ manual-start helper
// ✅ brief overlay ซ่อนแบบแข็งแรง
// ✅ autostart:false
// ✅ เรียงลำดับ step ตาม targetIds
// ✅ finish ส่งผ่าน api.finish()

export function mountSequenceWarmup({
  container,
  api,
  ctx,
  config
}){
  const {
    rng = Math.random,
    rootClass = 'seq',
    title = 'Warmup',
    subtitle = 'เรียงลำดับให้ถูกต้อง',
    startLabel = 'เริ่ม',
    timeLimit = 20,
    stepPool = [],
    targetIds = [],

    renderShell,

    getChoiceClass = () => 'seq-choice',
    getDoneRowClass = (done) => `seq-step ${done ? 'done' : ''}`,

    onCorrectToast = (n) => `ถูกต้อง! ขั้นที่ ${n}`,
    onWrongToast = () => 'ยังไม่ใช่ขั้นตอนถัดไป',

    finishTitleSuccess = 'พร้อมแล้ว!',
    finishTitleTimeout = 'หมดเวลา',
    finishSubtitle = 'สรุปผล Warmup',

    finishLines = ({ state, acc, timeBonus }) => [
      `เรียงถูก ${state.currentIndex}/${state.goal} ขั้น`,
      `คะแนน ${state.score}`,
      `พลาด ${state.miss}`,
      `ความแม่นยำ ${acc}%`,
      `โบนัสเวลา +${timeBonus} วินาที`
    ],

    buildBuffs = ({ state, acc, timeBonus, scoreBonus, rank }) => ({
      wType: 'sequence_warmup',
      wPct: acc,
      wSteps: state.currentIndex,
      wTimeBonus: timeBonus,
      wScoreBonus: scoreBonus,
      wRank: rank
    })
  } = config || {};

  const state = {
    started: false,
    ended: false,
    time: Math.max(1, Number(timeLimit || 20)),
    score: 0,
    miss: 0,
    taps: 0,
    hits: 0,
    currentIndex: 0,
    goal: targetIds.length,
    timer: null,
    choices: []
  };

  function shuffle(arr){
    const a = [...arr];
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor((typeof rng === 'function' ? rng() : Math.random()) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(s=''){
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  container.innerHTML = renderShell({
    title,
    subtitle,
    startLabel
  });

  const els = {
    brief: container.querySelector('[data-role="brief"]'),
    start: container.querySelector('[data-role="start"]'),
    steps: container.querySelector('[data-role="steps"]'),
    choices: container.querySelector('[data-role="choices"]')
  };

  function accuracy(){
    return state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0;
  }

  function setHud(){
    api?.setStats?.({
      time: state.time,
      score: state.score,
      miss: state.miss,
      acc: `${accuracy()}% • ${state.currentIndex}/${state.goal}`
    });

    api?.setSub?.(
      state.ended
        ? 'Warmup เสร็จแล้ว'
        : `เรียงลำดับให้ถูก ${state.currentIndex}/${state.goal}`
    );
  }

  function hideBriefHard(){
    if(!els.brief) return;
    els.brief.classList.add('hidden');
    els.brief.style.display = 'none';
    els.brief.style.pointerEvents = 'none';
    els.brief.style.opacity = '0';
    els.brief.setAttribute('aria-hidden', 'true');
  }

  function computeRewards(){
    let timeBonus = 0;
    let scoreBonus = 0;
    let rank = 'try';

    if(state.currentIndex >= state.goal){
      timeBonus = 5;
      scoreBonus = 20;
      rank = 'excellent';
    }else if(state.currentIndex >= Math.max(1, state.goal - 1)){
      timeBonus = 3;
      scoreBonus = 10;
      rank = 'good';
    }else if(state.currentIndex >= 1){
      timeBonus = 1;
      rank = 'ok';
    }

    return { timeBonus, scoreBonus, rank };
  }

  function finish(ok){
    if(state.ended) return;
    state.ended = true;

    clearInterval(state.timer);
    state.timer = null;

    const acc = accuracy();
    const { timeBonus, scoreBonus, rank } = computeRewards();

    api?.logger?.push?.(`${ctx.game}_warmup_end`, {
      ok,
      currentIndex: state.currentIndex,
      goal: state.goal,
      score: state.score,
      miss: state.miss,
      acc,
      rank
    });

    api?.finish?.({
      ok: !!ok,
      title: ok ? finishTitleSuccess : finishTitleTimeout,
      subtitle: finishSubtitle,
      lines: finishLines({ state, acc, timeBonus, scoreBonus, rank }),
      buffs: buildBuffs({ state, acc, timeBonus, scoreBonus, rank }),
      markDailyDone: true
    });
  }

  function getStepById(id){
    return stepPool.find(s => s.id === id) || null;
  }

  function renderSteps(){
    if(!els.steps) return;

    els.steps.innerHTML = '';

    for(let i = 0; i < state.goal; i++){
      const targetId = targetIds[i];
      const step = getStepById(targetId);
      const done = i < state.currentIndex;
      const current = i === state.currentIndex && !state.ended;
      const chosen = done ? step : null;

      const row = document.createElement('div');
      row.className = getDoneRowClass(done);
      if(current) row.classList.add('active');

      row.innerHTML = `
        <div class="${rootClass}-slot-index">${i + 1}</div>
        <div class="${rootClass}-slot-body">
          <div class="${rootClass}-slot-title">
            ${chosen ? `${esc(chosen.emoji || '')} ${esc(chosen.label || '')}` : 'ยังไม่ได้เลือก'}
          </div>
          <div class="${rootClass}-slot-sub">
            ${chosen ? esc(chosen.desc || '') : 'รอการเลือก'}
          </div>
        </div>
      `;
      els.steps.appendChild(row);
    }
  }

  function renderChoices(){
    if(!els.choices) return;

    els.choices.innerHTML = '';

    state.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = getChoiceClass(choice);
      btn.disabled = state.ended;

      btn.innerHTML = `
        <div class="${rootClass}-choice-emoji">${esc(choice.emoji || '')}</div>
        <div class="${rootClass}-choice-text">
          <div class="${rootClass}-choice-title">${esc(choice.label || '')}</div>
          <div class="${rootClass}-choice-sub">${esc(choice.desc || '')}</div>
        </div>
      `;

      btn.addEventListener('click', () => {
        if(state.ended) return;

        state.taps += 1;

        const expectedId = targetIds[state.currentIndex];
        const isCorrect = choice.id === expectedId;

        if(isCorrect){
          state.hits += 1;
          state.score += 10;
          state.currentIndex += 1;

          api?.toast?.(onCorrectToast(state.currentIndex, choice, state));

          if(state.currentIndex >= state.goal){
            renderSteps();
            renderChoices();
            setHud();
            finish(true);
            return;
          }
        }else{
          state.miss += 1;
          state.score = Math.max(0, state.score - 2);
          api?.toast?.(onWrongToast(choice, state));

          btn.animate?.([
            { transform:'translateX(0px)' },
            { transform:'translateX(-6px)' },
            { transform:'translateX(6px)' },
            { transform:'translateX(0px)' }
          ], { duration: 220, easing:'ease-out' });
        }

        renderSteps();
        setHud();
      });

      els.choices.appendChild(btn);
    });
  }

  function startInternal(){
    if(state.started || state.ended) return;
    state.started = true;

    if(els.start){
      els.start.disabled = true;
      els.start.setAttribute('aria-disabled', 'true');
    }

    hideBriefHard();

    state.choices = shuffle(stepPool);
    renderSteps();
    renderChoices();
    setHud();

    api?.logger?.push?.(`${ctx.game}_warmup_start`, {
      seed: ctx.seed,
      diff: ctx.diff
    });

    state.timer = setInterval(() => {
      if(state.ended) return;

      state.time -= 1;
      if(state.time < 0) state.time = 0;
      setHud();

      if(state.time <= 0){
        finish(false);
      }
    }, 1000);
  }

  els.start?.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    startInternal();
  }, { passive:false });

  els.start?.addEventListener('pointerup', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    startInternal();
  }, { passive:false });

  if(!els.start || !els.brief){
    queueMicrotask(() => {
      startInternal();
    });
  }

  renderSteps();
  setHud();

  return {
    autostart: false,
    start: startInternal,
    destroy(){
      clearInterval(state.timer);
      state.timer = null;
      state.ended = true;
    }
  };
}