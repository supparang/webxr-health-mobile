// === Hero Health Academy — game/modes/groups.js (Emoji Edition, 50 items) ===
// โหมด "Groups": จัดหมวดอาหารให้ถูกต้อง (Fruits / Vegetables / Protein / Grains)
// ใช้อีโมจิเป็นไอคอน → เบา โหลดเร็ว ไม่ต้องมีไฟล์ภาพ
// Public API: export const name, init(ctx), enter(root, opts), exit(), tick(dt), handleDomAction(el)

export const name = 'groups';

let ctx = null;   // { engine, hud, coach, sfx, score, powerups }
let ui  = null;   // root DOM for this mode
let st  = null;   // state

// ---------- Config ----------
const GROUPS = [
  { id:'fruits',  labelTH:'ผลไม้',   labelEN:'Fruits',     color:'#ef4444', key:'1' },
  { id:'veggies', labelTH:'ผัก',      labelEN:'Vegetables', color:'#22c55e', key:'2' },
  { id:'protein', labelTH:'โปรตีน',   labelEN:'Protein',    color:'#3b82f6', key:'3' },
  { id:'grains',  labelTH:'ธัญพืช',   labelEN:'Grains',     color:'#f59e0b', key:'4' },
];

const DEFAULTS = {
  durationSec: 60,
  language: 'TH',          // 'TH' | 'EN'
  allowHints: true,
  dynamicDifficulty: true,
};

// ---------- Items (50) ----------
const ITEMS = [
  // Fruits (12)
  { id:'apple',      group:'fruits',  labelEN:'Apple',      labelTH:'แอปเปิล',       icon:'🍎' },
  { id:'banana',     group:'fruits',  labelEN:'Banana',     labelTH:'กล้วย',         icon:'🍌' },
  { id:'strawberry', group:'fruits',  labelEN:'Strawberry', labelTH:'สตรอว์เบอร์รี่', icon:'🍓' },
  { id:'watermelon', group:'fruits',  labelEN:'Watermelon', labelTH:'แตงโม',          icon:'🍉' },
  { id:'orange',     group:'fruits',  labelEN:'Orange',     labelTH:'ส้ม',            icon:'🍊' },
  { id:'grapes',     group:'fruits',  labelEN:'Grapes',     labelTH:'องุ่น',          icon:'🍇' },
  { id:'pineapple',  group:'fruits',  labelEN:'Pineapple',  labelTH:'สับปะรด',        icon:'🍍' },
  { id:'mango',      group:'fruits',  labelEN:'Mango',      labelTH:'มะม่วง',         icon:'🥭' },
  { id:'cherry',     group:'fruits',  labelEN:'Cherry',     labelTH:'เชอร์รี่',        icon:'🍒' },
  { id:'peach',      group:'fruits',  labelEN:'Peach',      labelTH:'พีช',            icon:'🍑' },
  { id:'lemon',      group:'fruits',  labelEN:'Lemon',      labelTH:'มะนาว',          icon:'🍋' },
  { id:'kiwi',       group:'fruits',  labelEN:'Kiwi',       labelTH:'กีวี',           icon:'🥝' },

  // Veggies (12)
  { id:'carrot',     group:'veggies', labelEN:'Carrot',     labelTH:'แครอท',         icon:'🥕' },
  { id:'broccoli',   group:'veggies', labelEN:'Broccoli',   labelTH:'บรอกโคลี',      icon:'🥦' },
  { id:'cucumber',   group:'veggies', labelEN:'Cucumber',   labelTH:'แตงกวา',        icon:'🥒' },
  { id:'tomato',     group:'veggies', labelEN:'Tomato',     labelTH:'มะเขือเทศ',      icon:'🍅' },
  { id:'corn',       group:'veggies', labelEN:'Corn',       labelTH:'ข้าวโพด',        icon:'🌽' },
  { id:'lettuce',    group:'veggies', labelEN:'Lettuce',    labelTH:'ผักกาด/ผักใบ',  icon:'🥬' },
  { id:'mushroom',   group:'veggies', labelEN:'Mushroom',   labelTH:'เห็ด',           icon:'🍄' },
  { id:'salad',      group:'veggies', labelEN:'Salad',      labelTH:'สลัดผัก',        icon:'🥗' },
  { id:'chili',      group:'veggies', labelEN:'Chili',      labelTH:'พริก',           icon:'🌶️' },
  { id:'onion',      group:'veggies', labelEN:'Onion',      labelTH:'หัวหอม',         icon:'🧅' },
  { id:'garlic',     group:'veggies', labelEN:'Garlic',     labelTH:'กระเทียม',       icon:'🧄' },
  { id:'potato',     group:'veggies', labelEN:'Potato',     labelTH:'มันฝรั่ง',        icon:'🥔' },

  // Protein (14)
  { id:'egg',        group:'protein', labelEN:'Egg',        labelTH:'ไข่',            icon:'🥚' },
  { id:'fish',       group:'protein', labelEN:'Fish',       labelTH:'ปลา',            icon:'🐟' },
  { id:'tofu',       group:'protein', labelEN:'Tofu',       labelTH:'เต้าหู้',         icon:'🍢' },
  { id:'chicken',    group:'protein', labelEN:'Chicken',    labelTH:'ไก่',            icon:'🍗' },
  { id:'beef',       group:'protein', labelEN:'Beef',       labelTH:'เนื้อวัว',       icon:'🥩' },
  { id:'shrimp',     group:'protein', labelEN:'Shrimp',     labelTH:'กุ้ง',            icon:'🦐' },
  { id:'crab',       group:'protein', labelEN:'Crab',       labelTH:'ปู',              icon:'🦀' },
  { id:'squid',      group:'protein', labelEN:'Squid',      labelTH:'หมึก',            icon:'🦑' },
  { id:'peanuts',    group:'protein', labelEN:'Peanuts',    labelTH:'ถั่วลิสง',       icon:'🥜' },
  { id:'soybeans',   group:'protein', labelEN:'Soybeans',   labelTH:'ถั่ว (ถั่วเหลือง/เมล็ดถั่ว)', icon:'🫘' },
  { id:'milk',       group:'protein', labelEN:'Milk',       labelTH:'นม',             icon:'🥛' },
  { id:'cheese',     group:'protein', labelEN:'Cheese',     labelTH:'ชีส',            icon:'🧀' },
  { id:'ham',        group:'protein', labelEN:'Ham',        labelTH:'แฮม/เบคอน',      icon:'🥓' },
  { id:'sausage',    group:'protein', labelEN:'Sausage',    labelTH:'ไส้กรอก',        icon:'🌭' },

  // Grains (12)
  { id:'rice',       group:'grains',  labelEN:'Rice',       labelTH:'ข้าวสวย',        icon:'🍚' },
  { id:'bread',      group:'grains',  labelEN:'Bread',      labelTH:'ขนมปัง',         icon:'🍞' },
  { id:'noodles',    group:'grains',  labelEN:'Noodles',    labelTH:'ก๋วยเตี๋ยว',     icon:'🍜' },
  { id:'spaghetti',  group:'grains',  labelEN:'Spaghetti',  labelTH:'สปาเกตตี',       icon:'🍝' },
  { id:'croissant',  group:'grains',  labelEN:'Croissant',  labelTH:'ครัวซองต์',       icon:'🥐' },
  { id:'pancake',    group:'grains',  labelEN:'Pancake',    labelTH:'แพนเค้ก',         icon:'🥞' },
  { id:'burrito',    group:'grains',  labelEN:'Burrito',    labelTH:'เบอร์ริโต',       icon:'🌯' },
  { id:'sandwich',   group:'grains',  labelEN:'Sandwich',   labelTH:'แซนด์วิช',        icon:'🥪' },
  { id:'taco',       group:'grains',  labelEN:'Taco',       labelTH:'ทาโก้',           icon:'🌮' },
  { id:'pie',        group:'grains',  labelEN:'Pie',        labelTH:'พาย',             icon:'🥧' },
  { id:'cookie',     group:'grains',  labelEN:'Cookie',     labelTH:'คุกกี้',          icon:'🍪' },
  { id:'donut',      group:'grains',  labelEN:'Donut',      labelTH:'โดนัท',           icon:'🍩' },
];

// ---------- Lifecycle ----------
export function init(context){ ctx = context; }

export function enter(root, opts={}){
  const cfg = { ...DEFAULTS, ...opts };

  st = {
    cfg,
    timeLeft: cfg.durationSec,
    playing: true,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    difficulty: 1, // 1..5
    decayTimer: 0,
    queue: shuffle(ITEMS),
    current: null,
  };

  ui = buildUI(cfg);
  root.appendChild(ui);

  ctx?.coach?.say( t('เลือกหมวดอาหารให้ถูกต้องนะ!', 'Pick the right food group!', cfg.language) );
  nextItem();
}

export function exit(){
  ui?.remove();
  ui = null; st = null;
}

export function tick(dt){
  if(!st?.playing) return;

  // timer
  st.timeLeft -= dt;
  if (st.timeLeft <= 0){ endRound(); return; }
  sel('#ggTimer').textContent = formatTime(Math.ceil(st.timeLeft));

  // combo decay (อยู่นิ่งนานคอมโบค่อยๆ ลด)
  st.decayTimer += dt;
  if (st.decayTimer > 6 && st.combo>0){
    st.combo = Math.max(0, st.combo-1);
    updateHUD();
    st.decayTimer = 0;
  }

  // difficulty curve
  if (st.cfg.dynamicDifficulty){
    const pct = 1 - (st.timeLeft / st.cfg.durationSec);
    st.difficulty = 1 + Math.floor(pct*4); // 1..5
  }
}

export function handleDomAction(el){
  const a = el?.closest?.('[data-action]')?.getAttribute('data-action');
  if (!a) return;

  if (a.startsWith('group:')){ onChoose(a.split(':')[1]); return; }
  if (a === 'groups:hint'){ showHint(); return; }
  if (a === 'groups:skip'){ skipItem(); return; }
  if (a === 'groups:quit'){ endRound(true); return; }
}

// ---------- UI ----------
function buildUI(cfg){
  const wrap = h('div', { class:'mode-groups', tabindex:'-1' }, [
    h('div', { class:'gg-head' }, [
      h('div', { class:'gg-title' }, t('จัดเข้าหมวดอาหาร', 'Group the Food', cfg.language)),
      h('div', { id:'ggTimer', class:'gg-timer' }, formatTime(cfg.durationSec)),
    ]),
    h('div', { class:'gg-item' }, [
      h('div', { id:'ggIcon', class:'gg-icon', style:'font-size:80px' }, '🍎'),
      h('div', { id:'ggName', class:'gg-name' }, ''),
      h('div', { id:'ggHint', class:'gg-hint' }, ''),
    ]),
    h('div', { class:'gg-grid' },
      GROUPS.map(g => h('button', {
        class:'gg-btn',
        style:`--btnColor:${g.color}`,
        'data-action': `group:${g.id}`,
        title: `${t(g.labelTH, g.labelEN, cfg.language)} [${g.key}]`
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

  // shortcuts 1-4
  wrap.addEventListener('keydown', (e)=>{
    const map = { '1':'fruits','2':'veggies','3':'protein','4':'grains' };
    const gid = map[e.key];
    if (gid){
      wrap.querySelector(`[data-action="group:${gid}"]`)?.click();
      e.preventDefault();
    }
  });
  return wrap;
}

// ---------- Gameplay ----------
function nextItem(){
  if (st.queue.length === 0) st.queue = shuffle(ITEMS);
  st.current = st.queue.pop();
  st.decayTimer = 0;

  sel('#ggIcon').textContent = st.current.icon;
  sel('#ggName').textContent = t(st.current.labelTH, st.current.labelEN, st.cfg.language);
  sel('#ggHint').textContent = '';
  glowChoices(null);
}

function onChoose(groupId){
  if (!st?.playing || !st.current) return;
  const ok = (groupId === st.current.group);

  if (ok){
    st.combo += 1;
    st.bestCombo = Math.max(st.bestCombo, st.combo);
    const base = 100;
    const add  = base + (st.combo-1)*10 + (st.difficulty-1)*5;
    st.score += add;
    st.correct += 1;
    ctx?.sfx?.play('good') || ctx?.sfx?.play?.('right');
    ctx?.hud?.flash('+'+add);
    if (ctx?.powerups && st.combo>=10) ctx.powerups.tryFever?.();
    ctx?.coach?.cheer?.();
  } else {
    if (st.combo>0) ctx?.sfx?.play('bad') || ctx?.sfx?.play?.('comboBreak');
    st.combo = 0;
    st.wrong += 1;
    ctx?.hud?.shake?.(0.3);
    const gName = groupLabel(st.current.group);
    ctx?.coach?.say( t(`ข้อนี้คือหมวด “${gName}”`, `This one is “${gName}”`, st.cfg.language) );
  }

  updateHUD();
  glowChoices(groupId);
  setTimeout(nextItem, ok ? 320 : 480);
}

function skipItem(){
  if (!st?.playing) return;
  ctx?.sfx?.play('tick') || ctx?.sfx?.play?.('skip');
  nextItem();
}

function showHint(){
  if (!st?.playing || !st?.cfg?.allowHints) return;
  const g = groupLabel(st.current.group, st.cfg.language);
  sel('#ggHint').textContent = t(`ใบ้: หมวดขึ้นต้นด้วย "${g[0]}"`, `Hint: Starts with "${g[0]}"`, st.cfg.language);
  ctx?.sfx?.play('powerup') || ctx?.sfx?.play?.('hint');
}

function endRound(byUser=false){
  st.playing = false;
  const result = {
    mode: name,
    time: st.cfg.durationSec,
    score: st.score,
    hits: st.correct,
    misses: st.wrong,
    bestCombo: st.bestCombo,
    endedByUser: byUser,
    stars: calcStars(st.score),
    details: { difficultyCurve: st.difficulty }
  };
  ctx?.hud?.showResult?.(result);
  ctx?.engine?.emit?.('mode:end', result);
}

// ---------- Small Helpers ----------
function t(th, en, lang){ return lang==='EN' ? en : th; }

function groupLabel(id, lang='TH'){
  const g = GROUPS.find(x=>x.id===id);
  if (!g) return id;
  return t(g.labelTH, g.labelEN, lang);
}

function updateHUD(){
  sel('#ggScore').textContent = String(st.score);
  sel('#ggCombo').textContent = '×'+st.combo;
}

function glowChoices(chosenId){
  GROUPS.forEach(g=>{
    const btn = ui?.querySelector(`[data-action="group:${g.id}"]`);
    if (!btn) return;
    btn.classList.remove('good','bad','chosen');
  });
  if (!chosenId) return;
  const correctId = st.current.group;
  GROUPS.forEach(g=>{
    const btn = ui?.querySelector(`[data-action="group:${g.id}"]`);
    if (!btn) return;
    if (g.id===chosenId) btn.classList.add('chosen', (g.id===correctId?'good':'bad'));
  });
}

function calcStars(score){
  if (score>=3000) return 5;
  if (score>=2200) return 4;
  if (score>=1600) return 3;
  if (score>=1000) return 2;
  if (score>=500)  return 1;
  return 0;
}

function formatTime(s){
  const m = (s/60)|0, r = (s%60)|0;
  return `${m}:${r.toString().padStart(2,'0')}`;
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

function shuffle(arr){
  const a = arr.slice(0);
  for(let i=a.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
