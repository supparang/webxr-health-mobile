// === /herohealth/gate/helpers/target-hit-warmup.js ===
// Shared helper for target-hit / quick-scan warmup modules

import { rand } from './rng.js';

export function mountTargetHitWarmup({
  container,
  api,
  ctx,
  config
}){
  const {
    rng,
    title = 'Warmup',
    subtitle = 'แตะเป้าหมายให้ถูก',
    startLabel = 'เริ่ม',
    timeLimit = 20,
    goal = 5,

    rootClass = 'target',
    renderShell,

    goodPool = [],
    badPool = [],
    initialGood = 8,
    initialBad = 5,
    minAliveGood = 3,
    respawnGoodCount = 2,

    xRange = [12, 88],
    yRange = [18, 82],

    hostSelector = '[data-role="targets"]',
    briefSelector = '[data-role="brief"]',
    startSelector = '[data-role="start"]',

    goodItemClass = 'good',
    badItemClass = 'bad',

    onGoodToast = ()=> 'ถูกต้อง!',
    onBadToast = ()=> 'อุ๊ปส์! ยังไม่ใช่เป้าหมาย',
    finishTitleSuccess = 'พร้อมแล้ว!',
    finishTitleTimeout = 'หมดเวลา',
    finishSubtitle = 'สรุปผล Warmup',

    progressText = ({ state }) => `${state.progress}/${state.goal}`,

    finishLines = ({ state, acc, timeBonus })=>[
      `ทำสำเร็จ ${state.progress}/${state.goal}`,
      `คะแนน ${state.score}`,
      `พลาด ${state.miss}`,
      `ความแม่นยำ ${acc}%`,
      `โบนัสเวลา +${timeBonus} วินาที`
    ],

    buildBuffs = ({ state, acc, timeBonus, scoreBonus, rank })=>({
      wType: 'target_hit',
      wPct: acc,
      wCount: state.progress,
      wTimeBonus: timeBonus,
      wScoreBonus: scoreBonus,
      wRank: rank
    }),

    makeGoodData = (pool, i)=> pool[i % pool.length],
    makeBadData = (pool, i)=> pool[i % pool.length]
  } = config;

  const state = {
    started:false,
    ended:false,
    time:timeLimit,
    score:0,
    miss:0,
    taps:0,
    hits:0,
    progress:0,
    goal,
    timer:null,
    items:[]
  };

  container.innerHTML = renderShell({
    title,
    subtitle,
    startLabel
  });

  const els = {
    brief: container.querySelector(briefSelector),
    start: container.querySelector(startSelector),
    targets: container.querySelector(hostSelector),
    progressText: container.querySelector('[data-role="progress-text"]')
  };

  function acc(){
    return state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0;
  }

  function setHud(){
    api.setStats({
      time: state.time,
      score: state.score,
      miss: state.miss,
      acc: `${acc()}% • ${progressText({ state })}`
    });
    if(els.progressText){
      els.progressText.textContent = progressText({ state });
    }
  }

  function popAt(x, y, text){
    const el = document.createElement('div');
    el.className = `${rootClass}-pop`;
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.textContent = text;
    els.targets.appendChild(el);
    setTimeout(()=> el.remove(), 560);
  }

  function makeItem(kind, data){
    return {
      id: `${kind}-${Math.random().toString(36).slice(2,8)}`,
      kind,
      emoji: data.emoji,
      label: data.label,
      x: rand(rng, xRange[0], xRange[1]),
      y: rand(rng, yRange[0], yRange[1]),
      alive: true,
      el: null
    };
  }

  function spawnSet(){
    const out = [];
    for(let i=0;i<initialGood;i++){
      out.push(makeItem('good', makeGoodData(goodPool, i)));
    }
    for(let i=0;i<initialBad;i++){
      out.push(makeItem('bad', makeBadData(badPool, i)));
    }
    return out;
  }

  function maybeRespawnGood(){
    const aliveGood = state.items.filter(o=>o.kind === 'good' && o.alive).length;
    if(aliveGood >= minAliveGood) return;

    for(let i=0;i<respawnGoodCount;i++){
      const data = makeGoodData(goodPool, Math.floor(rng() * goodPool.length));
      state.items.push(makeItem('good', data));
    }
    render();
  }

  function computeRewards(){
    let timeBonus = 0;
    let scoreBonus = 0;
    let rank = 'try';

    if(state.progress >= state.goal){
      timeBonus = 5;
      scoreBonus = 20;
      rank = 'excellent';
    }else if(state.progress >= Math.max(3, state.goal - 2)){
      timeBonus = 3;
      scoreBonus = 10;
      rank = 'good';
    }else if(state.progress >= 1){
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
      progress: state.progress,
      goal: state.goal,
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

  function onGood(item){
    if(state.ended || !item.alive) return;
    item.alive = false;
    state.progress++;
    state.hits++;
    state.taps++;
    state.score += 10;
    item.el?.remove();

    popAt(item.x, item.y, '+10');
    api.toast(onGoodToast(item, state));
    maybeRespawnGood();
    setHud();

    if(state.progress >= state.goal){
      finish(true);
    }
  }

  function onBad(item){
    if(state.ended || !item.alive) return;
    state.miss++;
    state.taps++;
    state.score = Math.max(0, state.score - 2);

    item.el?.animate([
      { transform:'translate(-50%,-50%) rotate(0deg)' },
      { transform:'translate(-50%,-50%) rotate(-8deg)' },
      { transform:'translate(-50%,-50%) rotate(8deg)' },
      { transform:'translate(-50%,-50%) rotate(0deg)' }
    ], { duration: 240, easing:'ease-out' });

    api.toast(onBadToast(item, state));
    setHud();
  }

  function render(){
    els.targets.innerHTML = '';
    state.items.filter(o=>o.alive).forEach(item=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `${rootClass}-item ${item.kind === 'good' ? goodItemClass : badItemClass}`;
      btn.style.left = item.x + '%';
      btn.style.top = item.y + '%';
      btn.textContent = item.emoji;
      btn.title = item.label;

      btn.addEventListener('click', ()=>{
        if(item.kind === 'good') onGood(item);
        else onBad(item);
      });

      item.el = btn;
      els.targets.appendChild(btn);
    });
  }

  function start(){
    if(state.started) return;
    state.started = true;
    els.brief?.classList.add('hidden');
    state.items = spawnSet();
    render();
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
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(state.timer);
    }
  };
}
