// === Hero Health Academy — game/modes/groups.js (Target Group Edition) ===
// โหมด "จาน 5 หมู่ / Food Group Frenzy":
// - ระบบจะสุ่ม "หมวดเป้าหมาย" (ผลไม้/ผัก/โปรตีน/ธัญพืช)
// - แสดงไอคอนอาหาร 8 ชิ้น (มีของหมวดเป้าหมายอยู่ N ชิ้น)
// - ผู้เล่นต้อง "คลิกให้ตรงหมวดเป้าหมาย" ให้ครบ N ชิ้น เพื่อไปยังรอบถัดไป
// - คะแนนได้จากคลิกถูก และคอมโบต่อเนื่อง ถ้าคลิกผิดคอมโบจะรีเซ็ต
//
// Public API ที่ main.js เรียก:
//   export function init(ctx)
//   export function enter(root, opts)
//   export function exit()
//   export function tick(dt)
//   export function handleDomAction(el)

export const name = 'groups';

let ctx = null;   // engine/hud/coach/sfx/score/powerups ... จาก main
let ui  = null;   // root DOM ของโหมดนี้
let st  = null;   // state ภายในโหมด

// ---------- Config ----------
const GROUPS = [
  { id:'fruits',  labelTH:'ผลไม้',     labelEN:'Fruits',     color:'#ef4444', key:'1' },
  { id:'veggies', labelTH:'ผัก',        labelEN:'Vegetables', color:'#22c55e', key:'2' },
  { id:'protein', labelTH:'โปรตีน',     labelEN:'Protein',    color:'#3b82f6', key:'3' },
  { id:'grains',  labelTH:'ธัญพืช',     labelEN:'Grains',     color:'#f59e0b', key:'4' },
];

const DEFAULTS = {
  durationSec: 60,
  language: 'TH',           // 'TH' | 'EN'
  allowHints: true,
  gridSize: 8,              // จำนวนไอคอนต่อรอบ
  correctPerRound: 3,       // จำนวนเป้าหมายที่ต้องคลิกให้ครบในรอบหนึ่ง
};

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
    playing: true,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    wrongs: 0,
    round: 0,
    targetGroup: null,     // 'fruits' | 'veggies' | 'protein' | 'grains'
    need: cfg.correctPerRound,
    got: 0,
    usedItemIds: new Set(), // ป้องกันซ้ำติดกันบ่อยๆ
  };

  ui = buildUI(cfg);
  root.appendChild(ui);

  ctx?.coach?.say( t('คลิกให้ตรงหมวดที่กำหนด!', 'Tap the items that match the target group!', cfg.language) );
  newRound(); // เริ่มรอบแรก
}

export function exit(){
  ui?.remove();
  ui = null; st = null;
}

export function tick(_dt){
  // รอบนี้ logic หลักอยู่ในการคลิก ไม่ต้องทำงานรายวินาทีในที่นี้
}

export function handleDomAction(el){
  const act = el?.closest?.('[data-action]')?.getAttribute('data-action');
  if (!act) return;
  if (act.startsWith('pick:')){ onPick(act.slice(5)); return; }
  if (act === 'groups:hint'){ showHint(); return; }
  if (act === 'groups:skip'){ newRound(true); return; }
  if (act === 'groups:quit'){ endRound(true); return; }
}

// ---------- Round / Grid ----------
function newRound(skipped=false){
  if (!st?.playing) return;

  st.round++;
  st.got = 0;
  clearHint();

  // สุ่มหมวดเป้าหมายที่ไม่ซ้ำจากรอบก่อน (ถ้าทำได้)
  const prev = st.targetGroup;
  const candidates = GROUPS.map(g=>g.id);
  st.targetGroup = pickDifferent(candidates, prev);

  // เลือกจำนวนที่ต้องคลิกให้ครบ (ปรับได้ หากในกลุ่มนั้นเหลือไอคอนน้อย)
  const inTarget = ITEMS.filter(i=>i.group===st.targetGroup);
  st.need = Math.min(st.cfg.correctPerRound, inTarget.length, st.cfg.gridSize);

  // สร้างกริด: เลือกเป้าหมาย N ชิ้น + ตัวหลอก (gridSize-N) ชิ้น
  const targetItems   = takeRandom(inTarget, st.need, st.usedItemIds);
  const others        = ITEMS.filter(i=>i.group!==st.targetGroup);
  const distractors   = takeRandom(others, st.cfg.gridSize - targetItems.length, st.usedItemIds);
  const gridItems     = shuffle([...targetItems, ...distractors]);

  // บันทึกว่าชิ้นไหนเป็นเป้าหมาย
  const answerSet = new Set(targetItems.map(i=>i.id));

  renderRound({
    targetGroup: st.targetGroup,
    gridItems,
    isCorrect: (id)=>answerSet.has(id)
  });

  // อัปเดตข้อความโค้ช/เป้า
  const gName = groupLabel(st.targetGroup, st.cfg.language);
  ctx?.coach?.say( t(`เป้าหมาย: ${gName}`, `Target: ${gName}`, st.cfg.language) );

  // บันทึกว่าชิ้นที่ใช้ไปแล้ว เพื่อลดโอกาสซ้ำถี่ ๆ
  targetItems.forEach(i=>st.usedItemIds.add(i.id));
  if (st.usedItemIds.size > 80) { // กันโตเกิน
    st.usedItemIds = new Set(Array.from(st.usedItemIds).slice(-40));
  }

  if (skipped){
    ctx?.sfx?.play('tick') || ctx?.sfx?.play?.('skip');
  }
}

function renderRound({ targetGroup, gridItems, isCorrect }){
  // เป้า
  const target = GROUPS.find(g=>g.id===targetGroup);
  sel('#ggTarget').textContent = t(target.labelTH, target.labelEN, st.cfg.language);
  sel('#ggTarget').style.setProperty('--targetColor', target.color);

  // เคลียร์กริด
  const grid = sel('#ggGrid');
  grid.innerHTML = '';

  // สร้าง cell
  for (const it of gridItems){
    const cell = h('button', {
      class:'gg-cell',
      'data-id': it.id,
      'data-action': `pick:${it.id}`,
      title: t(it.labelTH, it.labelEN, st.cfg.language)
    }, [
      h('div', { class:'gg-emoji' }, it.icon),
      h('div', { class:'gg-label' }, t(it.labelTH, it.labelEN, st.cfg.language))
    ]);
    // เก็บข้อมูลถูก/ผิดไว้ใน DOM dataset
    cell.dataset.correct = isCorrect(it.id) ? '1' : '0';
    grid.appendChild(cell);
  }

  // HUD
  updateHUD();
}

// ---------- Click handling ----------
function onPick(itemId){
  if (!st?.playing) return;
  const btn = sel(`[data-id="${CSS.escape(itemId)}"]`);
  if (!btn || btn.classList.contains('done')) return; // กันกดซ้ำ

  const isOk = btn.dataset.correct === '1';

  if (isOk){
    st.got += 1;
    st.hits += 1;
    st.combo += 1;
    st.bestCombo = Math.max(st.bestCombo, st.combo);

    btn.classList.add('good','done');
    const add = 120 + (st.combo-1)*10; // คอมโบบวกคะแนน
    st.score += add;
    ctx?.hud?.flash?.('+'+add);
    ctx?.sfx?.play('good') || ctx?.sfx?.play?.('right');

    // สำเร็จครบตาม need → ขึ้นรอบใหม่เร็วๆ
    if (st.got >= st.need){
      setTimeout(()=>newRound(false), 450);
    }
  }else{
    // ผิด → คอมโบหาย สะเทือนจอเล็กน้อย
    st.wrongs += 1;
    st.combo = 0;
    btn.classList.add('bad','done');
    ctx?.sfx?.play('bad') || ctx?.sfx?.play?.('wrong');
    ctx?.hud?.shake?.(0.25);
  }

  updateHUD();
}

// ---------- HUD / Hints ----------
function updateHUD(){
  sel('#ggScore').textContent = String(st.score);
  sel('#ggCombo').textContent = '×'+st.combo;
  sel('#ggNeed').textContent  = `${st.got}/${st.need}`;
}

function showHint(){
  if (!st?.cfg?.allowHints) return;
  const gName = groupLabel(st.targetGroup, st.cfg.language);
  sel('#ggHint').textContent = t(`ใบ้: มองหาอาหารในหมวด “${gName}”`,
                                 `Hint: Look for items in “${gName}”`, st.cfg.language);
  ctx?.sfx?.play('powerup') || ctx?.sfx?.play?.('hint');
}
function clearHint(){ sel('#ggHint').textContent = ''; }

// ---------- End ----------
function endRound(byUser=false){
  st.playing = false;
  const result = {
    mode: name,
    score: st.score,
    hits: st.hits,
    misses: st.wrongs,
    bestCombo: st.bestCombo,
    endedByUser: byUser,
    rounds: st.round
  };
  ctx?.hud?.showResult?.(result);
  ctx?.engine?.emit?.('mode:end', result);
}

// ---------- Mini helpers ----------
function t(th, en, lang){ return lang==='EN' ? en : th; }
function groupLabel(id, lang='TH'){
  const g = GROUPS.find(x=>x.id===id);
  if (!g) return id;
  return t(g.labelTH, g.labelEN, lang);
}
function takeRandom(arr, n, excludeIdSet=new Set()){
  const pool = arr.filter(x=>!excludeIdSet.has(x.id));
  const a = shuffle(pool.length>=n ? pool : arr).slice(0, n);
  return a;
}
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length? cand[(Math.random()*cand.length)|0] : prev;
}
function shuffle(a){
  const arr = a.slice(0);
  for(let i=arr.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
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

// ---------- UI ----------
function buildUI(cfg){
  const wrap = h('div', { class:'mode-groups tg', tabindex:'-1' }, [
    // Header
    h('div', { class:'gg-head' }, [
      h('div', { class:'gg-title' }, t('จาน 5 หมู่', 'Food Group Frenzy', cfg.language)),
      h('div', { class:'gg-meta' }, [
        h('span', { class:'gg-badge', id:'ggTarget', style:'--targetColor:#999' }, '—')
      ]),
      h('div', { class:'gg-scorebox' }, [
        h('span', { id:'ggScore' }, '0'),
        h('span', { id:'ggCombo' }, '×0')
      ]),
    ]),
    // Hint line
    h('div', { id:'ggHint', class:'gg-hint' }, ''),
    // Need counter
    h('div', { class:'gg-need' }, [
      h('span', {}, t('เป้าหมายที่ต้องคลิกให้ครบ', 'Items to collect', cfg.language)+': '),
      h('b', { id:'ggNeed' }, '0/0')
    ]),
    // Grid
    h('div', { id:'ggGrid', class:'tg-grid' }, []),

    // Footer controls
    h('div', { class:'gg-foot' }, [
      h('button', { class:'gg-small', 'data-action':'groups:hint' }, t('คำใบ้', 'Hint', cfg.language)),
      h('button', { class:'gg-small', 'data-action':'groups:skip' }, t('ข้ามรอบ', 'Skip round', cfg.language)),
      h('button', { class:'gg-small danger', 'data-action':'groups:quit' }, t('จบเกม', 'End', cfg.language)),
    ]),
  ]);

  // คีย์ลัด 1-4 เลือกหมวด (เผื่อใช้ในอนาคต)
  wrap.addEventListener('keydown', (e)=>{
    const map = { '1':'fruits','2':'veggies','3':'protein','4':'grains' };
    if (map[e.key]){
      sel('#ggHint').textContent = t(`ตอนนี้เป้าหมายคือ “${groupLabel(map[e.key])}”`,
                                     `Current target is “${groupLabel(map[e.key],'EN')}”`,
                                     cfg.language);
      e.preventDefault();
    }
  });
  return wrap;
}
