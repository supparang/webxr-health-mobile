// === Hero Health Academy — game/modes/groups.js (Floating Icons + Powers + Multi-target) ===
import { Progress } from '../core/progression.js';

export const name = 'groups';

// ---------- Groups & Items ----------
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

// ---------- Internal state ----------
const ST = {
  lang: 'TH',
  // เป้าหมาย 1–3 หมวด (สุ่มต่อรอบ)
  targetIds: ['fruits'],
  needPerTarget: 4,
  gotPerTarget: {},   // {fruits:2,...}

  // พลังเสริม
  mulX2Until: 0,
  freezeUntil: 0,
  magnetOnce: false,

  // ทอง
  goldenRate: 0.12
};

// ---------- Public API ----------
export function init(gameState, hud, diff){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');

  // โควตาต่อหมวดตามความยาก
  const d = gameState?.difficulty || 'Normal';
  ST.needPerTarget = d==='Easy' ? 3 : d==='Hard' ? 5 : 4;

  // สุ่มจำนวนเป้าหมาย 1–3 หมวด
  const howMany = 1 + ((Math.random()*3)|0);            // 1..3
  ST.targetIds = pickN(shuffle(GROUPS.map(g=>g.id)), howMany);
  ST.gotPerTarget = {}; for (const id of ST.targetIds) ST.gotPerTarget[id]=0;

  // อัปเดต HUD
  setTargetHUD();
}

export function cleanup(){
  // nothing
}

export function tick(state, systems, hud){
  // เมื่อ freeze หมดเวลา ให้ปล่อย spawn ปกติ (main.js คุมแล้ว)
}

// meta ต่อชิ้นตอน spawn (main.js เรียกทุกครั้ง)
export function pickMeta(diff, gameState){
  // เพิ่มโอกาสให้ชิ้น "หมวดเป้าหมาย" โผล่บ่อยกว่า
  const probTarget = 0.58;
  const isTarget = Math.random() < probTarget;

  const pool = isTarget
    ? ITEMS.filter(i=>ST.targetIds.includes(i.group))
    : ITEMS;

  const it = pool[(Math.random()*pool.length)|0];

  const life = Math.max(900, (diff?.life||3000) * (isFreeze() ? 1.8 : 1.0));

  // โอกาสเป็นทองเฉพาะ target
  const golden = isTarget && Math.random() < ST.goldenRate;

  return {
    id: it.id,
    char: golden ? '🟡' : it.icon,
    good: ST.targetIds.includes(it.group),
    life,
    groupId: it.group,
    golden
  };
}

// เมื่อกดชิ้น
export function onHit(meta, systems, gameState, hud){
  if (!meta) return 'ok';

  if (meta.good){
    // Magnet (ครั้งถัดไป auto-good 1 ชิ้น)
    if (ST.magnetOnce){ ST.magnetOnce=false; }

    // x2 score ภายในโหมด (ซ้อนกับ FEVER ของเกม)
    const isPerfect = false; // หากมีหน้าต่าง perfect ให้คำนวณตรงนี้
    const res = isPerfect ? 'perfect' : 'good';

    // นับโควตา
    if (meta.groupId && ST.gotPerTarget[meta.groupId]!=null){
      ST.gotPerTarget[meta.groupId] = Math.min(ST.needPerTarget, ST.gotPerTarget[meta.groupId]+1);
      setTargetHUD();
      // ครบทุกเป้าหมายหรือยัง
      if (Object.keys(ST.gotPerTarget).every(id => ST.gotPerTarget[id] >= ST.needPerTarget)){
        // รีเซ็ตรอบเป้าหมายใหม่
        const howMany = 1 + ((Math.random()*3)|0);
        ST.targetIds = pickN(shuffle(GROUPS.map(g=>g.id)), howMany);
        ST.gotPerTarget = {}; for (const id of ST.targetIds) ST.gotPerTarget[id]=0;
        setTargetHUD();
        systems.sfx?.play?.('powerup');
      }
    }

    if (meta.golden){
      // แจ้ง coach เล็กน้อย
      systems.coach?.say?.(t('ทองมาแล้ว!', 'Golden!', ST.lang));
    }
    return res;
  }

  // กดผิด
  systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
  return 'bad';
}

// ---------- Powers (called by main.js) ----------
export const powers = {
  x2Target(){
    ST.mulX2Until = now()+8000;
  },
  freezeTarget(){
    ST.freezeUntil = now()+3000;
  },
  magnetNext(){
    ST.magnetOnce = true;
  }
};

export function getPowerDurations(){
  return { x2:8, freeze:3, magnet:0 };
}

// ---------- HUD helpers ----------
function setTargetHUD(){
  const wrap = document.getElementById('targetWrap');
  const badge = document.getElementById('targetBadge');
  const tLabel = document.getElementById('t_target');
  if (!wrap || !badge || !tLabel) return;
  wrap.style.display = 'block';
  tLabel.textContent = t('หมวด', 'Target', ST.lang);

  // ตัวอย่างข้อความ: ผลไม้(2/4), โปรตีน(1/4)
  const parts = ST.targetIds.map(id=>{
    const g = GROUPS.find(x=>x.id===id);
    const got = ST.gotPerTarget[id]||0;
    const need = ST.needPerTarget;
    return `${t(g.labelTH, g.labelEN, ST.lang)}(${got}/${need})`;
  });
  badge.textContent = parts.join(', ');
}

// ---------- utils ----------
function t(th, en, lang){ return lang==='EN' ? en : th; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
function pickN(a, n){ return a.slice(0, Math.max(1, Math.min(n, a.length))); }
function now(){ return performance?.now?.()||Date.now(); }
function isFreeze(){ return now() < (ST.freezeUntil||0); }
