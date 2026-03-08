// === /herohealth/gate/helpers/sequence-warmup.js ===
// Shared helper for sequence-style warmup modules
// Pattern: choose correct items in order (3-step / 3-target sequence)

import { shuffle } from './rng.js';

export function mountSequenceWarmup({
  container,
  api,
  ctx,
  config
}){
  const {
    rootClass = 'seq',
    title = 'Warmup',
    subtitle = 'เลือกให้ถูกตามลำดับ',
    startLabel = 'เริ่ม',
    timeLimit = 20,
    stepPool = [],
    targetIds = [],
    renderShell,
    getChoiceClass = ()=>'seq-choice',
    getDoneRowClass = (done)=> done ? 'done' : '',
    onCorrectToast = (n)=> `ถูกต้อง! ขั้นที่ ${n}`,
    onWrongToast = ()=> 'ยังไม่ใช่ขั้นตอนถัดไป',
    finishTitleSuccess = 'พร้อมแล้ว!',
    finishTitleTimeout = 'หมดเวลา',
    finishSubtitle = 'สรุปผล Warmup',
    finishLines = ({ state, acc, timeBonus })=>[
      `เรียงถูก ${state.currentIndex}/${targetIds.length} ขั้น`,
      `คะแนน ${state.score}`,
      `พลาด ${state.miss}`,
      `ความแม่นยำ ${acc}%`,
      `โบนัสเวลา +${timeBonus} วินาที`
    ],
    buildBuffs = ({ state, acc, timeBonus, scoreBonus, rank })=>({
      wType: 'sequence_warmup',
      wPct: acc,
      wSteps: state.currentIndex,
      wTimeBonus: timeBonus,
      wScoreBonus: scoreBonus,
      wRank: rank
    })
  } = config;

  const state = {
    started:false,
    ended:false,
    time:timeLimit,
    score:0,
    miss:0,
    taps:0,
    hits:0,
    currentIndex:0,
    picks:[],
    rounds:[],
    timer:null
  };

  const targetSteps = targetIds.map(id => stepPool.find(s => s.id === id)).filter(Boolean);

  if(targetSteps.length !== targetIds.length){
    throw new Error(`[sequence-warmup] Missing target steps. expected=${targetIds.length}, actual=${targetSteps.length}`);
  }

  container.innerHTML = renderShell({
    title,
    subtitle,
    startLabel
  });

  const els = {
    brief: container.querySelector(`[data-role="brief"]`),
    start: container.querySelector(`[data-role="start"]`),
    steps: container.querySelector(`[data-role="steps"]`),
    choices: container.querySelector(`[data-role="choices"]`)
  };

  function acc(){
    return state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0;
  }

  function setHud(){
    api.setStats({
      time: state.time,
      score: state.score,
      miss: state.miss,
      acc: `${acc()}% • ${state.currentIndex}/${targetSteps.length}`
    });
  }

  function renderSteps(){
    if(!els.steps) return;
    els.steps.innerHTML = '';

    targetSteps.forEach((step, idx)=>{
      const picked = state.picks[idx];
      const done = !!picked;
      const row = document.createElement('div');
      row.className = getDoneRowClass(done);
      row.innerHTML = `
        <div class="${rootClass}-step-num">${idx+1}</div>
        <div style="min-width:0;flex:1 1 auto;">
          <div style="font-weight:900;">${picked ? `${picked.emoji} ${picked.label}` : 'ยังไม่ได้เลือก'}</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:2px;">
            ${picked ? picked.desc : 'รอการเลือก'}
          </div>
        </div>
      `;
      els.steps.appendChild(row);
    });
  }

  function buildRound(){
    const needed = targetSteps[state.currentIndex];
    const distractors = shuffle(
      stepPool.filter(s => s.id !== needed.id),
      config.rng
    ).slice(0, 2);

    state.rounds = shuffle([needed, ...distractors], config.rng);
    renderChoices();
  }

  function onChoice(step, btn){
    if(state.ended) return;

    state.taps++;
    const expected = targetSteps[state.currentIndex];
    const isGood = step.id === expected.id;

    if(isGood){
      state.hits++;
      state.score += 15;
      state.picks.push(step);
      state.currentIndex++;
      btn.classList.add('good');
      btn.disabled = true;
      api.toast(onCorrectToast(state.currentIndex));
    }else{
      state.miss++;
      state.score = Math.max(0, state.score - 2);
      btn.classList.add('bad');
      btn.disabled = true;
      api.toast(onWrongToast(step, expected, state));
    }

    setHud();
    renderSteps();

    setTimeout(()=>{
      if(state.currentIndex >= targetSteps.length){
        finish(true);
      }else{
        buildRound();
      }
    }, 320);
  }

  function renderChoices(){
    if(!els.choices) return;
    els.choices.innerHTML = '';

    state.rounds.forEach(step=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = getChoiceClass(step);
      btn.innerHTML = `
        <div class="${rootClass}-choice-head">
          <div class="${rootClass}-choice-emoji">${step.emoji}</div>
          <div style="min-width:0;">
            <div style="font-weight:900;">${step.label}</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:2px;">${step.desc}</div>
          </div>
        </div>
      `;
      btn.addEventListener('click', ()=> onChoice(step, btn));
      els.choices.appendChild(btn);
    });
  }

  function computeRewards(){
    let timeBonus = 0;
    let scoreBonus = 0;
    let rank = 'try';

    if(state.currentIndex >= targetSteps.length){
      timeBonus = 5;
      scoreBonus = 20;
      rank = 'excellent';
    }else if(state.currentIndex >= Math.max(2, targetSteps.length - 1)){
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

    const accuracy = acc();
    const { timeBonus, scoreBonus, rank } = computeRewards();

    api.logger.push(`${ctx.game}_warmup_end`, {
      ok,
      stepsCorrect: state.currentIndex,
      totalSteps: targetSteps.length,
      score: state.score,
      miss: state.miss,
      acc: accuracy,
      rank
    });

    api.finish({
      ok:true,
      title: ok ? finishTitleSuccess : finishTitleTimeout,
      subtitle: finishSubtitle,
      lines: finishLines({ state, acc: accuracy, timeBonus, scoreBonus, rank }),
      buffs: buildBuffs({ state, acc: accuracy, timeBonus, scoreBonus, rank })
    });
  }

  function start(){
    if(state.started) return;
    state.started = true;
    els.brief?.classList.add('hidden');
    renderSteps();
    buildRound();
    setHud();

    api.logger.push(`${ctx.game}_warmup_start`, {
      seed: ctx.seed,
      diff: ctx.diff
    });

    state.timer = setInterval(()=>{
      state.time--;
      setHud();
      if(state.time <= 0){
        finish(false);
      }
    }, 1000);
  }

  els.start?.addEventListener('click', start);
  renderSteps();
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(state.timer);
    }
  };
}
