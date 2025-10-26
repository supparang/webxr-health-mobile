// === Hero Health Academy — modes/groups.js ===
// Food Grouping (คล้าย goodjunk): จัดเข้าหมวด Fruits / Vegetables / Protein / Grains

export const name = 'groups';

let ctx = null;
let ui  = null;
let state = null;

// ------- Gameplay Config -------
const GROUPS = [
  { id:'fruits',  labelEN:'Fruits',     labelTH:'ผลไม้',    color:'#ff6b6b', key:'1' },
  { id:'veggies', labelEN:'Vegetables', labelTH:'ผัก',       color:'#51cf66', key:'2' },
  { id:'protein', labelEN:'Protein',    labelTH:'โปรตีน',    color:'#339af0', key:'3' },
  { id:'grains',  labelEN:'Grains',     labelTH:'ธัญพืช',    color:'#f59f00', key:'4' },
];

const ROUND_DEFAULTS = {
  durationSec: 60,
  language: 'TH', // 'EN'|'TH'
  allowHints: true,
  dynamicDifficulty: true,
};

const ITEMS = [
  // Fruits
  { id:'apple',      group:'fruits',  labelEN:'Apple',      labelTH:'แอปเปิล',      icon:'assets/icons/food/apple.png' },
  { id:'banana',     group:'fruits',  labelEN:'Banana',     labelTH:'กล้วย',        icon:'assets/icons/food/banana.png' },
  { id:'strawberry', group:'fruits',  labelEN:'Strawberry', labelTH:'สตรอว์เบอร์รี่', icon:'assets/icons/food/strawberry.png' },
  // Veggies
  { id:'carrot',     group:'veggies', labelEN:'Carrot',     labelTH:'แครอท',        icon:'assets/icons/food/carrot.png' },
  { id:'broccoli',   group:'veggies', labelEN:'Broccoli',   labelTH:'บรอกโคลี',     icon:'assets/icons/food/broccoli.png' },
  { id:'cucumber',   group:'veggies', labelEN:'Cucumber',   labelTH:'แตงกวา',       icon:'assets/icons/food/cucumber.png' },
  // Protein
  { id:'egg',        group:'protein', labelEN:'Egg',        labelTH:'ไข่',           icon:'assets/icons/food/egg.png' },
  { id:'fish',       group:'protein', labelEN:'Fish',       labelTH:'ปลา',           icon:'assets/icons/food/fish.png' },
  { id:'tofu',       group:'protein', labelEN:'Tofu',       labelTH:'เต้าหู้',        icon:'assets/icons/food/tofu.png' },
  // Grains
  { id:'rice',       group:'grains',  labelEN:'Rice',       labelTH:'ข้าว',          icon:'assets/icons/food/rice.png' },
  { id:'bread',      group:'grains',  labelEN:'Bread',      labelTH:'ขนมปัง',        icon:'assets/icons/food/bread.png' },
  { id:'noodles',    group:'grains',  labelEN:'Noodles',    labelTH:'ก๋วยเตี๋ยว',    icon:'assets/icons/food/noodles.png' },
];

function t(th, en, lang){ return lang==='EN' ? en : th; }

// ------- Lifecycle -------
export function init(context){
  ctx = context;
}

export function enter(root, opts={}){
  const cfg = { ...ROUND_DEFAULTS, ...opts };
  state = {
    cfg,
    timeLeft: cfg.durationSec,
    playing: true,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    queue: shuffle(ITEMS),
    current: null,
    nextRevealAt: 0,
    decayTimer: 0,
    difficultyLevel: 1, // 1..5
  };

  ui = buildUI(cfg);
  root.appendChild(ui);

  ctx?.coach?.say( t('เลือกหมวดอาหารให้ถูกต้องนะ!', 'Pick the right food group!', cfg.language) );
  nextItem();
}

export function exit(){
  if (ui && ui.parentNode) ui.parentNode.removeChild(ui);
  ui = null;
  state = null;
}

export function tick(dt){
  if(!state?.playing) return;

  // เวลา
  state.timeLeft -= dt;
  if (state.timeLeft <= 0){
    endRound();
    return;
  }

  // Streak decay
  state.decayTimer += dt;
  if (state.decayTimer > 6 && state.combo>0){
    state.combo = Math.max(0, state.combo-1);
    updateComboUI();
    state.decayTimer = 0;
  }

  // Dynamic difficulty
  if (state.cfg.dynamicDifficulty){
    const pct = 1 - (state.timeLeft / state.cfg.durationSec);
    state.difficultyLevel = 1 + Math.floor(pct*4); // 1..5
  }

  updateTimerUI();
}

export function handleDomAction(el){
  const a = el?.closest?.('[data-action]')?.getAttribute('data-action') || '';
  if (!a) return;

  if (a.startsWith('group:')){
    const g = a.split(':')[1];
    onChooseGroup(g);
    return;
  }
  if (a==='groups:hint'){ showHint(); return; }
  if (a==='groups:skip'){ skipItem(); return; }
  if (a==='groups:quit'){ endRound(true); return; }
}

// ------- UI -------
function buildUI(cfg){
  const wrap = h('div', { class:'mode-groups' }, [
    h('div', { class:'gg-head' }, [
      h('div', { class:'gg-title' }, t('จัดเข้าหมวดอาหาร', 'Group the Food', cfg.language)),
      h('div', { class:'gg-timer', id:'ggTimer' }, formatTime(cfg.durationSec)),
    ]),
    h('div', { class:'gg-item' }, [
      h('img', { id:'ggIcon', alt:'food', class:'gg-icon', src:'' }),
      h('div', { id:'ggName', class:'gg-name' }, ''),
      h('div', { id:'ggHint', class:'gg-hint' }, ''),
    ]),
    h('div', { class:'gg-grid' },
      GROUPS.map(g => h('button', {
        class:'gg-btn',
        style:`--btnColor:${g.color}`,
        'data-action': `group:${g.id}`,
        title: `${g.labelEN} [${g.key}]`
      }, t(g.labelTH, g.labelEN, cfg.language)))
    ),
    h('div', { class:'gg-foot' }, [
      h('button', { class:'gg-small', 'data-action':'groups:hint' }, t('คำใบ้', 'Hint', cfg.language)),
      h('button', { class:'gg-small', 'data-action':'groups:skip' }, t('ข้าม', 'Skip', cfg.language)),
      h('button', { class:'gg-small danger', 'data-action':'groups:quit' }, t('จบเกม', 'End', cfg.language)),
      h('div', { class:'gg-score' }, [
        h('span', { id:'ggScore' }, '0'),
        h('span', { id:'ggCombo' }, '×0')
      ])
    ])
  ]);

  // คีย์ลัด 1–4
  wrap.addEventListener('keydown', (e)=>{
    const map = { '1':'fruits','2':'veggies','3':'protein','4':'grains' };
    const g = map[e.key];
    if (g){
      const btn = wrap.querySelector(`[data-action="group:${g}"]`);
      if (btn){ btn.click(); e.preventDefault(); }
    }
  });
  return wrap;
}

// ------- Gameplay -------
function nextItem(){
  if (state.queue.length === 0) state.queue = shuffle(ITEMS);
  state.current = state.queue.shift();
  state.nextRevealAt = performance.now() + 300;

  const lang = state.cfg.language;
  sel('#ggIcon').src = state.current.icon;
  sel('#ggName').textContent = t(state.current.labelTH, state.current.labelEN, lang);
  sel('#ggHint').textContent = '';
  glowChoices(null);
  state.decayTimer = 0;
}

function onChooseGroup(groupId){
  if (!state?.playing || !state.current) return;

  const correct = (groupId === state.current.group);

  if (correct){
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const base = 100;
    const add  = base + (state.combo-1)*10 + (state.difficultyLevel-1)*5;
    state.score += add;
    state.correct += 1;
    ctx?.sfx?.play('right');
    ctx?.hud?.flash('+'+add);
    if (ctx?.powerups && state.combo>=10) ctx.powerups.tryFever?.();
  }else{
    if (state.combo>0) ctx?.sfx?.play('comboBreak');
    state.combo = 0;
    state.wrong += 1;
    ctx?.sfx?.play('wrong');
    ctx?.hud?.shake?.(0.3);
  }

  updateScoreUI();
  updateComboUI();
  glowChoices(groupId);

  if (ctx?.coach){
    if (correct){
      ctx.coach.cheer?.();
    }else{
      const gName = groupLabel(state.current.group, state.cfg.language);
      ctx.coach.say( t(`ข้อนี้คือหมวด “${gName}”`,
                       `This one is “${gName}”`, state.cfg.language) );
    }
  }

  setTimeout(nextItem, correct ? 350 : 500);
}

function skipItem(){
  if (!state?.playing) return;
  ctx?.sfx?.play('skip');
  nextItem();
}

function showHint(){
  if (!state?.playing || !state?.cfg?.allowHints) return;
  const g = groupLabel(state.current.group, state.cfg.language);
  sel('#ggHint').textContent = t(`ใบ้: หมวดขึ้นต้นด้วย "${g[0]}"`, `Hint: Starts with "${g[0]}"`, state.cfg.language);
  ctx?.sfx?.play('hint');
}

function endRound(byUser=false){
  state.playing = false;
  const result = {
    mode: name,
    time: state.cfg.durationSec,
    score: state.score,
    hits: state.correct,
    misses: state.wrong,
    bestCombo: state.bestCombo,
    endedByUser: byUser,
    stars: calcStars(state.score),
    details: { difficultyCurve: state.difficultyLevel }
  };
  ctx?.hud?.showResult?.(result);
  ctx?.engine?.emit?.('mode:end', result);
}

// ------- Helpers -------
function calcStars(score){
  if (score>=1600) return 5;
  if (score>=1200) return 4;
  if (score>=900)  return 3;
  if (score>=600)  return 2;
  if (score>=300)  return 1;
  return 0;
}

function groupLabel(id, lang){
  const g = GROUPS.find(x=>x.id===id);
  if (!g) return id;
  return t(g.labelTH, g.labelEN, lang);
}

function shuffle(arr){
  const a = arr.slice(0);
  for(let i=a.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function h(tag, attrs={}, children=[]){
  const el = document.createElement(tag);
  for (const k in attrs){
    if (k==='class') el.className = attrs[k];
    else el.setAttribute(k, attrs[k]);
  }
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if (c==null) return;
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}
function sel(q){ return ui?.querySelector(q); }

function updateTimerUI(){
  const tEl = sel('#ggTimer');
  if (tEl) tEl.textContent = formatTime(Math.max(0, state.timeLeft|0));
}
function updateScoreUI(){
  const el = sel('#ggScore'); if (el) el.textContent = String(state.score);
}
function updateComboUI(){
  const el = sel('#ggCombo'); if (el) el.textContent = '×'+state.combo;
}
function glowChoices(chosenId){
  GROUPS.forEach(g=>{
    const btn = ui?.querySelector(`[data-action="group:${g.id}"]`);
    if (!btn) return;
    btn.classList.remove('good','bad','chosen');
  });
  if (!chosenId) return;
  const correctId = state.current.group;
  GROUPS.forEach(g=>{
    const btn = ui?.querySelector(`[data-action="group:${g.id}"]`);
    if (!btn) return;
    if (g.id===chosenId) btn.classList.add('chosen', (g.id===correctId?'good':'bad'));
  });
}
function formatTime(s){
  const m = (s/60)|0, r = (s%60)|0;
  return `${m}:${r.toString().padStart(2,'0')}`;
}
