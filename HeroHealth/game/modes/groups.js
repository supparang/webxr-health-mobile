// === Hero Health Academy — game/modes/groups.js (Floating Icons + Target Group) ===
export const name = 'groups';

const GROUPS = [
  { id:'fruits',  labelTH:'ผลไม้',     labelEN:'Fruits',     color:'#ef4444' },
  { id:'veggies', labelTH:'ผัก',        labelEN:'Vegetables', color:'#22c55e' },
  { id:'protein', labelTH:'โปรตีน',     labelEN:'Protein',    color:'#3b82f6' },
  { id:'grains',  labelTH:'ธัญพืช',     labelEN:'Grains',     color:'#f59e0b' },
];

const ITEMS = [
  // Fruits
  { id:'apple', group:'fruits', icon:'🍎', labelTH:'แอปเปิล', labelEN:'Apple' },
  { id:'banana', group:'fruits', icon:'🍌', labelTH:'กล้วย', labelEN:'Banana' },
  { id:'strawberry', group:'fruits', icon:'🍓', labelTH:'สตรอว์เบอร์รี่', labelEN:'Strawberry' },
  { id:'watermelon', group:'fruits', icon:'🍉', labelTH:'แตงโม', labelEN:'Watermelon' },
  { id:'orange', group:'fruits', icon:'🍊', labelTH:'ส้ม', labelEN:'Orange' },
  { id:'grapes', group:'fruits', icon:'🍇', labelTH:'องุ่น', labelEN:'Grapes' },
  { id:'pineapple', group:'fruits', icon:'🍍', labelTH:'สับปะรด', labelEN:'Pineapple' },
  { id:'mango', group:'fruits', icon:'🥭', labelTH:'มะม่วง', labelEN:'Mango' },
  { id:'cherry', group:'fruits', icon:'🍒', labelTH:'เชอร์รี่', labelEN:'Cherry' },
  { id:'peach', group:'fruits', icon:'🍑', labelTH:'พีช', labelEN:'Peach' },
  { id:'lemon', group:'fruits', icon:'🍋', labelTH:'มะนาว', labelEN:'Lemon' },
  { id:'kiwi', group:'fruits', icon:'🥝', labelTH:'กีวี', labelEN:'Kiwi' },
  // Veggies
  { id:'carrot', group:'veggies', icon:'🥕', labelTH:'แครอท', labelEN:'Carrot' },
  { id:'broccoli', group:'veggies', icon:'🥦', labelTH:'บรอกโคลี', labelEN:'Broccoli' },
  { id:'cucumber', group:'veggies', icon:'🥒', labelTH:'แตงกวา', labelEN:'Cucumber' },
  { id:'tomato', group:'veggies', icon:'🍅', labelTH:'มะเขือเทศ', labelEN:'Tomato' },
  { id:'corn', group:'veggies', icon:'🌽', labelTH:'ข้าวโพด', labelEN:'Corn' },
  { id:'lettuce', group:'veggies', icon:'🥬', labelTH:'ผักใบ', labelEN:'Lettuce' },
  { id:'mushroom', group:'veggies', icon:'🍄', labelTH:'เห็ด', labelEN:'Mushroom' },
  { id:'salad', group:'veggies', icon:'🥗', labelTH:'สลัดผัก', labelEN:'Salad' },
  { id:'chili', group:'veggies', icon:'🌶️', labelTH:'พริก', labelEN:'Chili' },
  { id:'onion', group:'veggies', icon:'🧅', labelTH:'หัวหอม', labelEN:'Onion' },
  { id:'garlic', group:'veggies', icon:'🧄', labelTH:'กระเทียม', labelEN:'Garlic' },
  { id:'potato', group:'veggies', icon:'🥔', labelTH:'มันฝรั่ง', labelEN:'Potato' },
  // Protein
  { id:'egg', group:'protein', icon:'🥚', labelTH:'ไข่', labelEN:'Egg' },
  { id:'fish', group:'protein', icon:'🐟', labelTH:'ปลา', labelEN:'Fish' },
  { id:'tofu', group:'protein', icon:'🍢', labelTH:'เต้าหู้', labelEN:'Tofu' },
  { id:'chicken', group:'protein', icon:'🍗', labelTH:'ไก่', labelEN:'Chicken' },
  { id:'beef', group:'protein', icon:'🥩', labelTH:'เนื้อวัว', labelEN:'Beef' },
  { id:'shrimp', group:'protein', icon:'🦐', labelTH:'กุ้ง', labelEN:'Shrimp' },
  { id:'crab', group:'protein', icon:'🦀', labelTH:'ปู', labelEN:'Crab' },
  { id:'squid', group:'protein', icon:'🦑', labelTH:'หมึก', labelEN:'Squid' },
  { id:'peanuts', group:'protein', icon:'🥜', labelTH:'ถั่วลิสง', labelEN:'Peanuts' },
  { id:'soybeans', group:'protein', icon:'🫘', labelTH:'ถั่ว', labelEN:'Soybeans' },
  { id:'milk', group:'protein', icon:'🥛', labelTH:'นม', labelEN:'Milk' },
  { id:'cheese', group:'protein', icon:'🧀', labelTH:'ชีส', labelEN:'Cheese' },
  { id:'ham', group:'protein', icon:'🥓', labelTH:'แฮม/เบคอน', labelEN:'Ham' },
  { id:'sausage', group:'protein', icon:'🌭', labelTH:'ไส้กรอก', labelEN:'Sausage' },
  // Grains
  { id:'rice', group:'grains', icon:'🍚', labelTH:'ข้าวสวย', labelEN:'Rice' },
  { id:'bread', group:'grains', icon:'🍞', labelTH:'ขนมปัง', labelEN:'Bread' },
  { id:'noodles', group:'grains', icon:'🍜', labelTH:'ก๋วยเตี๋ยว', labelEN:'Noodles' },
  { id:'spaghetti', group:'grains', icon:'🍝', labelTH:'สปาเกตตี', labelEN:'Spaghetti' },
  { id:'croissant', group:'grains', icon:'🥐', labelTH:'ครัวซองต์', labelEN:'Croissant' },
  { id:'pancake', group:'grains', icon:'🥞', labelTH:'แพนเค้ก', labelEN:'Pancake' },
  { id:'burrito', group:'grains', icon:'🌯', labelTH:'เบอร์ริโต', labelEN:'Burrito' },
  { id:'sandwich', group:'grains', icon:'🥪', labelTH:'แซนด์วิช', labelEN:'Sandwich' },
  { id:'taco', group:'grains', icon:'🌮', labelTH:'ทาโก้', labelEN:'Taco' },
  { id:'pie', group:'grains', icon:'🥧', labelTH:'พาย', labelEN:'Pie' },
  { id:'cookie', group:'grains', icon:'🍪', labelTH:'คุกกี้', labelEN:'Cookie' },
  { id:'donut', group:'grains', icon:'🍩', labelTH:'โดนัท', labelEN:'Donut' },
];

const ST = {
  lang: 'TH',
  targetId: 'fruits',
  need: 4,
  got: 0,
};

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

export function tick(){ /* no-op */ }

export function pickMeta(diff, gameState){
  const probTarget = 0.58;
  const pickTarget = Math.random() < probTarget;
  const pool = pickTarget
    ? ITEMS.filter(i=>i.group===ST.targetId)
    : ITEMS.filter(i=>i.group!==ST.targetId);
  const it = pool[(Math.random()*pool.length)|0];
  return {
    id: it.id,
    char: it.icon,
    good: (it.group===ST.targetId),
    groupId: it.group,         // ช่วยให้ระบบเควส/โปรเกรสรู้หมวด
    life: diff?.life || 3000,
  };
}

export function onHit(meta, systems){
  if (meta.good){
    ST.got++;
    updateTargetBadge();
    systems.coach?.say?.(t('ใช่เลย!', 'Nice!', ST.lang));
    if (ST.got >= ST.need){
      ST.got = 0;
      ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
      updateTargetBadge();
      systems.sfx?.play?.('powerup');
      systems.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
    }
    return 'good';
  }
  systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
  return 'bad';
}

// Powers durations (สำหรับ main.js powerbar)
export function getPowerDurations(){ return { x2:8, freeze:3, magnet:5 }; }

// Optional: powers (เรียกจาก main.js)
export const powers = {
  x2Target(){ /* ให้ main.js จัด FEVER/คะแนน */ },
  freezeTarget(){
    // ให้ main.js กันสแปวนได้อยู่แล้วผ่าน freezeUntil; ที่นี่ขอเป็น no-op
  },
  magnetNext(){ /* โหมดนี้ปล่อยให้สุ่มตามปกติ */ },
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
function t(th,en,lang=ST.lang){ return lang==='EN' ? en : th; }
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length? cand[(Math.random()*cand.length)|0] : prev;
}
