// === Hero Health Academy — game/modes/groups.js (A–D applied) ===
export const name = 'groups';

// ---------- Config ----------
const GROUPS = [
  { id:'fruits',   labelTH:'ผลไม้',     labelEN:'Fruits',      color:'#ef4444' },
  { id:'veggies',  labelTH:'ผัก',        labelEN:'Vegetables',  color:'#22c55e' },
  { id:'protein',  labelTH:'โปรตีน',     labelEN:'Protein',     color:'#3b82f6' },
  { id:'grains',   labelTH:'ธัญพืช',     labelEN:'Grains',      color:'#f59e0b' },
  { id:'dairy',    labelTH:'นม/ผลิตภัณฑ์', labelEN:'Dairy',    color:'#a855f7' },
];

// === ตัวอย่าง ITEMS 50 ชิ้น (เหมือนก่อนหน้า) ===
// Fruits (12), Veggies (12), Protein (14), Grains (12) — Dairy จะสุ่มน้อยลงหากรายการไม่ครบ
const ITEMS = [
  // Fruits
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

  // Veggies
  { id:'carrot',     group:'veggies', labelEN:'Carrot',     labelTH:'แครอท',         icon:'🥕' },
  { id:'broccoli',   group:'veggies', labelEN:'Broccoli',   labelTH:'บรอกโคลี',      icon:'🥦' },
  { id:'cucumber',   group:'veggies', labelEN:'Cucumber',   labelTH:'แตงกวา',        icon:'🥒' },
  { id:'tomato',     group:'veggies', labelEN:'Tomato',     labelTH:'มะเขือเทศ',      icon:'🍅' },
  { id:'corn',       group:'veggies', labelEN:'Corn',       labelTH:'ข้าวโพด',        icon:'🌽' },
  { id:'lettuce',    group:'veggies', labelEN:'Lettuce',    labelTH:'ผักใบเขียว',    icon:'🥬' },
  { id:'mushroom',   group:'veggies', labelEN:'Mushroom',   labelTH:'เห็ด',           icon:'🍄' },
  { id:'salad',      group:'veggies', labelEN:'Salad',      labelTH:'สลัดผัก',        icon:'🥗' },
  { id:'chili',      group:'veggies', labelEN:'Chili',      labelTH:'พริก',           icon:'🌶️' },
  { id:'onion',      group:'veggies', labelEN:'Onion',      labelTH:'หัวหอม',         icon:'🧅' },
  { id:'garlic',     group:'veggies', labelEN:'Garlic',     labelTH:'กระเทียม',       icon:'🧄' },
  { id:'potato',     group:'veggies', labelEN:'Potato',     labelTH:'มันฝรั่ง',        icon:'🥔' },

  // Protein
  { id:'egg',        group:'protein', labelEN:'Egg',        labelTH:'ไข่',            icon:'🥚' },
  { id:'fish',       group:'protein', labelEN:'Fish',       labelTH:'ปลา',            icon:'🐟' },
  { id:'tofu',       group:'protein', labelEN:'Tofu',       labelTH:'เต้าหู้',         icon:'🍢' },
  { id:'chicken',    group:'protein', labelEN:'Chicken',    labelTH:'ไก่',            icon:'🍗' },
  { id:'beef',       group:'protein', labelEN:'Beef',       labelTH:'เนื้อวัว',       icon:'🥩' },
  { id:'shrimp',     group:'protein', labelEN:'Shrimp',     labelTH:'กุ้ง',            icon:'🦐' },
  { id:'crab',       group:'protein', labelEN:'Crab',       labelTH:'ปู',              icon:'🦀' },
  { id:'squid',      group:'protein', labelEN:'Squid',      labelTH:'หมึก',            icon:'🦑' },
  { id:'peanuts',    group:'protein', labelEN:'Peanuts',    labelTH:'ถั่วลิสง',       icon:'🥜' },
  { id:'soybeans',   group:'protein', labelEN:'Soybeans',   labelTH:'ถั่วเหลือง',     icon:'🫘' },
  { id:'milk',       group:'protein', labelEN:'Milk',       labelTH:'นม',             icon:'🥛' },
  { id:'cheese',     group:'protein', labelEN:'Cheese',     labelTH:'ชีส',            icon:'🧀' },
  { id:'ham',        group:'protein', labelEN:'Ham',        labelTH:'แฮม/เบคอน',      icon:'🥓' },
  { id:'sausage',    group:'protein', labelEN:'Sausage',    labelTH:'ไส้กรอก',        icon:'🌭' },

  // Grains
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
  targetId: 'fruits',
  need: 4,         // จำนวนที่ต้องเก็บให้ครบ ก่อนสลับหมวด
  got: 0,
  x2Until: 0,      // A/B: ทำให้เกิด icon golden + คูณคะแนน
  magnetUntil: 0,  // A: bias โอกาส spawn หมวดเป้าหมาย
};

// ---------- Public API ----------
export function init(gameState, hud, diff){
  const d = (gameState?.difficulty)||'Normal';
  ST.need = d==='Easy' ? 3 : d==='Hard' ? 5 : 4;
  ST.got = 0;
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
  showTargetHUD(true);
  updateTargetBadge();
}

export function cleanup(){
  showTargetHUD(false);
}

export function tick(state){
  const now = performance.now();
  if (ST.magnetUntil && now > ST.magnetUntil) ST.magnetUntil = 0;
}

// ให้ main.js เรียกทุกครั้งที่ spawn
export function pickMeta(diff){
  // A) Magnet bias + reroll
  const probTargetBase = 0.58;
  const probTarget = (ST.magnetUntil && performance.now() < ST.magnetUntil) ? 0.90 : probTargetBase;
  let pickTarget = Math.random() < probTarget;

  let pool = pickTarget ? ITEMS.filter(i=>i.group===ST.targetId)
                        : ITEMS.filter(i=>i.group!==ST.targetId);

  let it = pool[(Math.random()*pool.length)|0];

  // ถ้า magnet อยู่ แต่สุ่มไม่เข้าเป้า ลอง reroll 1 ครั้ง
  if (!pickTarget && ST.magnetUntil && performance.now()<ST.magnetUntil){
    const again = ITEMS.filter(i=>i.group===ST.targetId);
    if (again.length) it = again[(Math.random()*again.length)|0];
  }

  // B) ส่ง flag mult=2 เมื่ออยู่ในช่วง x2
  const x2Active = performance.now() < ST.x2Until;
  const golden = x2Active && Math.random() < 0.20;

  return {
    id: it.id,
    groupId: it.group,
    char: it.icon,
    good: (it.group===ST.targetId),
    life: diff?.life || 3000,
    golden,             // ใช้แต่งเอฟเฟกต์/ข้อความ
    mult: x2Active ? 2 : 1
  };
}

// ถูกคลิกหนึ่งชิ้น → คืนผลลัพธ์คล้าย goodjunk
export function onHit(meta, systems){
  if (meta.good){
    ST.got++;
    updateTargetBadge();
    if (meta.golden) systems.coach?.say?.(t('ทองคำ! +พลัง', 'Golden! +Power', ST.lang));
    else systems.coach?.say?.(t('ใช่เลย!', 'Nice!', ST.lang));

    if (ST.got >= ST.need){
      ST.got = 0;
      ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
      updateTargetBadge();
      systems.sfx?.play?.('powerup');
      systems.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
    }
    return meta.golden ? 'perfect' : 'good';
  }
  systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
  return 'bad';
}

// ---------- Powers (สำหรับ main.js) ----------
export function getPowerDurations(){
  return { x2:8, freeze:3, magnet:5 };
}
export const powers = {
  x2Target(){
    ST.x2Until = performance.now() + 8000;
  },
  freezeTarget(){
    // ส่ง event ให้ main.js ไปตั้ง freezeUntil (3s)
    window.dispatchEvent(new CustomEvent('hha:freeze', { detail:{ ms:3000 } }));
  },
  magnetNext(){
    ST.magnetUntil = performance.now() + 5000;
  }
};

// ---------- HUD helpers ----------
function showTargetHUD(show){
  const wrap = document.getElementById('targetWrap');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}
function updateTargetBadge(){
  const g = GROUPS.find(x=>x.id===ST.targetId);
  const badge = document.getElementById('targetBadge');
  if (badge){
    badge.textContent = t(g.labelTH, g.labelEN, ST.lang) + `  (${ST.got}/${ST.need})`;
    badge.style.fontWeight = '800';
  }
  const tLabel = document.getElementById('t_target');
  if (tLabel) tLabel.textContent = t('หมวด', 'Target', ST.lang);
}

// ---------- utils ----------
function t(th, en, lang){ return lang==='EN' ? en : th; }
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length? cand[(Math.random()*cand.length)|0] : prev;
}
