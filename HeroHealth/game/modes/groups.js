// === Hero Health Academy — game/modes/groups.js ===
// Floating icons แบบ goodjunk + Multi-Target + Powers (x2/freeze/magnet) + Golden
// สอดคล้องกับ styles/group.css ที่ใช้ html[data-hha-mode="groups"]

import { Progress } from '../core/progression.js';

export const name = 'groups';

/* ---------- Groups & Items ---------- */
const GROUPS = [
  { id:'fruits',  labelTH:'ผลไม้',     labelEN:'Fruits',     color:'#ef4444' },
  { id:'veggies', labelTH:'ผัก',        labelEN:'Vegetables', color:'#22c55e' },
  { id:'protein', labelTH:'โปรตีน',     labelEN:'Protein',    color:'#3b82f6' },
  { id:'grains',  labelTH:'ธัญพืช',     labelEN:'Grains',     color:'#f59e0b' },
];

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
  { id:'lettuce',    group:'veggies', labelEN:'Lettuce',    labelTH:'ผักใบ',          icon:'🥬' },
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
  { id:'soybeans',   group:'protein', labelEN:'Soybeans',   labelTH:'ถั่วเหลือง',      icon:'🫘' },
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

/* ---------- State ---------- */
const ST = {
  lang: 'TH',

  // เป้าหมายสุ่ม 1–3 หมวด/รอบ
  targetIds: ['fruits'],
  needPerTarget: 4,
  gotPerTarget: {},

  // พลัง
  x2Until: 0,
  freezeUntil: 0,
  magnetOnce: false,    // เพิ่มโอกาสสุ่ม target ชั่วคราว

  // ไอคอนทอง (โบนัส)
  goldenRate: 0.12
};

/* ---------- API for main.js ---------- */
export function init(gameState, hud, diff){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');

  // ติดธงโหมดให้ CSS ทำงาน (styles/group.css)
  try { document.documentElement.setAttribute('data-hha-mode', 'groups'); } catch {}

  // โควตาต่อหมวดตามระดับ
  const d = gameState?.difficulty || 'Normal';
  ST.needPerTarget = d==='Easy' ? 3 : d==='Hard' ? 5 : 4;

  // สุ่มจำนวนเป้าหมาย 1–3
  const howMany = 1 + ((Math.random()*3)|0);
  ST.targetIds = pickN(shuffle(GROUPS.map(g=>g.id)), howMany);

  ST.gotPerTarget = {};
  for (const id of ST.targetIds) ST.gotPerTarget[id] = 0;

  renderTargetHUD();
  Progress.event('mode_init', { mode:'groups', targetIds: ST.targetIds, need: ST.needPerTarget });
}

export function cleanup(){
  // เอาธงโหมดออกเมื่อออกจากเกม
  try { if (document.documentElement.getAttribute('data-hha-mode') === 'groups') {
    document.documentElement.removeAttribute('data-hha-mode');
  }} catch {}
}

export function tick(/* state, systems, hud */){
  // TTL/Spawn จัดการโดย main.js แล้ว ที่นี่ไม่ต้องทำอะไรต่อวินาที
}

/** main.js เรียกก่อน spawn ไอคอนทุกชิ้น */
export function pickMeta(diff, /* gameState */){
  // เพิ่มโอกาสเจอ target ถ้าเปิดแม่เหล็ก
  const baseProb = 0.58;
  const probTarget = ST.magnetOnce ? 0.92 : baseProb;
  if (ST.magnetOnce) ST.magnetOnce = false; // ใช้ครั้งเดียว

  const isTarget  = Math.random() < probTarget;
  const pool = isTarget ? ITEMS.filter(i => ST.targetIds.includes(i.group)) : ITEMS;
  const it = pool[(Math.random()*pool.length)|0];

  const lifeBase = (diff?.life ?? 3000);
  const life = Math.max(900, lifeBase * (isFrozen() ? 1.8 : 1.0));

  const golden = isTarget && Math.random() < ST.goldenRate;

  return {
    id: it.id,
    char: golden ? '🟡' : it.icon,  // ไฮไลต์ “ทอง”
    good: ST.targetIds.includes(it.group),
    life,
    groupId: it.group,
    golden
  };
}

/** เมื่อผู้เล่นคลิกไอคอน */
export function onHit(meta, systems /*, gameState, hud */){
  if (!meta) return 'ok';

  if (meta.good){
    if (meta.groupId in ST.gotPerTarget){
      ST.gotPerTarget[meta.groupId] = Math.min(ST.needPerTarget, (ST.gotPerTarget[meta.groupId]||0) + 1);
      renderTargetHUD();
      Progress.event('groups_hit', { good:true, groupId: meta.groupId, golden: !!meta.golden });

      // ครบทุกหมวดตามโควตา → สุ่มเป้าหมายใหม่
      const doneAll = Object.keys(ST.gotPerTarget).every(id => ST.gotPerTarget[id] >= ST.needPerTarget);
      if (doneAll){
        const howMany = 1 + ((Math.random()*3)|0);
        ST.targetIds = pickN(shuffle(GROUPS.map(g=>g.id)), howMany);
        ST.gotPerTarget = {};
        for (const id of ST.targetIds) ST.gotPerTarget[id] = 0;
        renderTargetHUD();
        systems.sfx?.play?.('powerup');
        systems.coach?.say?.(t('เป้าหมายใหม่!', 'New targets!', ST.lang));
        Progress.event('groups_cycle', { targetIds: ST.targetIds, need: ST.needPerTarget });
      }
    }

    if (meta.golden){
      systems.coach?.say?.(t('ทองมาแล้ว!', 'Golden!', ST.lang));
      Progress.event('golden', { mode:'groups' });
    }

    return 'good';
  }

  // กดผิดหมวด
  systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
  Progress.event('groups_hit', { good:false, groupId: meta.groupId||null, golden: !!meta.golden });
  return 'bad';
}

/* ---------- Powers (เรียกจาก main.js) ---------- */
export const powers = {
  x2Target(){
    // โหมดนี้คะแนนพื้นฐานยังให้ main.js คูณตาม FEVER/Combo อยู่
    // เก็บช่วงเวลาไว้ ถ้าต้องการ logic เพิ่มเติมในอนาคต
    ST.x2Until = now() + 8000;
  },
  freezeTarget(){
    ST.freezeUntil = now() + 3000;
  },
  magnetNext(){
    ST.magnetOnce = true;
  }
};

export function getPowerDurations(){
  // main.js ใช้อ่านเพื่อแสดงแถบ CD/ระยะเวลาของปุ่มใน powerbar
  return { x2:8, freeze:3, magnet:0 };
}

/* ---------- HUD ---------- */
function renderTargetHUD(){
  const wrap  = document.getElementById('targetWrap');
  const badge = document.getElementById('targetBadge');
  const tLabel= document.getElementById('t_target');
  if (!wrap || !badge || !tLabel) return;

  wrap.style.display = 'inline-flex';
  tLabel.textContent = t('หมวด', 'Target', ST.lang);

  // ตัวอย่าง: ผลไม้(2/4), โปรตีน(1/4)
  const parts = ST.targetIds.map(id=>{
    const g = GROUPS.find(x=>x.id===id);
    const got = ST.gotPerTarget[id] || 0;
    const need = ST.needPerTarget;
    return `${t(g.labelTH, g.labelEN, ST.lang)}(${got}/${need})`;
  });
  badge.textContent = parts.join(', ');
}

/* ---------- utils ---------- */
function t(th, en, lang){ return lang==='EN' ? en : th; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1)|0); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pickN(a, n){ return a.slice(0, Math.max(1, Math.min(n, a.length))); }
function now(){ return performance?.now?.()||Date.now(); }
function isFrozen(){ return now() < (ST.freezeUntil||0); }
