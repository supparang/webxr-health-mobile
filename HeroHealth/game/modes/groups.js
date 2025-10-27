// === Hero Health Academy — modes/groups.js (Floating Icons, Target Groups, Powers, A–D) ===
export const name = 'groups';

// ---------- Groups ----------
const GROUPS = [
  { id:'fruits',   labelTH:'ผลไม้',      labelEN:'Fruits',      color:'#ef4444' },
  { id:'veggies',  labelTH:'ผัก',         labelEN:'Vegetables',  color:'#22c55e' },
  { id:'protein',  labelTH:'โปรตีน',      labelEN:'Protein',     color:'#3b82f6' },
  { id:'grains',   labelTH:'ธัญพืช',      labelEN:'Grains',      color:'#f59e0b' },
  { id:'dairy',    labelTH:'นม/นมถั่ว',   labelEN:'Dairy/Alt',   color:'#a78bfa' }, // เพิ่มหมู่ที่ 5
];

// ---------- Items (ใช้ไอคอนเดิมที่เป็น emoji) ----------
const ITEMS = [
  // Fruits
  { id:'apple', group:'fruits', labelEN:'Apple', labelTH:'แอปเปิล', icon:'🍎' },
  { id:'banana', group:'fruits', labelEN:'Banana', labelTH:'กล้วย', icon:'🍌' },
  { id:'strawberry', group:'fruits', labelEN:'Strawberry', labelTH:'สตรอว์เบอร์รี่', icon:'🍓' },
  { id:'watermelon', group:'fruits', labelEN:'Watermelon', labelTH:'แตงโม', icon:'🍉' },
  { id:'orange', group:'fruits', labelEN:'Orange', labelTH:'ส้ม', icon:'🍊' },
  { id:'grapes', group:'fruits', labelEN:'Grapes', labelTH:'องุ่น', icon:'🍇' },
  { id:'pineapple', group:'fruits', labelEN:'Pineapple', labelTH:'สับปะรด', icon:'🍍' },
  { id:'mango', group:'fruits', labelEN:'Mango', labelTH:'มะม่วง', icon:'🥭' },
  { id:'cherry', group:'fruits', labelEN:'Cherry', labelTH:'เชอร์รี่', icon:'🍒' },
  { id:'kiwi', group:'fruits', labelEN:'Kiwi', labelTH:'กีวี', icon:'🥝' },
  // Veggies
  { id:'carrot', group:'veggies', labelEN:'Carrot', labelTH:'แครอท', icon:'🥕' },
  { id:'broccoli', group:'veggies', labelEN:'Broccoli', labelTH:'บรอกโคลี', icon:'🥦' },
  { id:'cucumber', group:'veggies', labelEN:'Cucumber', labelTH:'แตงกวา', icon:'🥒' },
  { id:'tomato', group:'veggies', labelEN:'Tomato', labelTH:'มะเขือเทศ', icon:'🍅' },
  { id:'corn', group:'veggies', labelEN:'Corn', labelTH:'ข้าวโพด', icon:'🌽' },
  { id:'lettuce', group:'veggies', labelEN:'Leafy Greens', labelTH:'ผักใบ', icon:'🥬' },
  { id:'mushroom', group:'veggies', labelEN:'Mushroom', labelTH:'เห็ด', icon:'🍄' },
  { id:'salad', group:'veggies', labelEN:'Salad', labelTH:'สลัด', icon:'🥗' },
  // Protein
  { id:'egg', group:'protein', labelEN:'Egg', labelTH:'ไข่', icon:'🥚' },
  { id:'fish', group:'protein', labelEN:'Fish', labelTH:'ปลา', icon:'🐟' },
  { id:'tofu', group:'protein', labelEN:'Tofu', labelTH:'เต้าหู้', icon:'🍢' },
  { id:'chicken', group:'protein', labelEN:'Chicken', labelTH:'ไก่', icon:'🍗' },
  { id:'beef', group:'protein', labelEN:'Beef', labelTH:'เนื้อวัว', icon:'🥩' },
  { id:'shrimp', group:'protein', labelEN:'Shrimp', labelTH:'กุ้ง', icon:'🦐' },
  { id:'peanuts', group:'protein', labelEN:'Peanuts', labelTH:'ถั่วลิสง', icon:'🥜' },
  { id:'soybeans', group:'protein', labelEN:'Soybeans', labelTH:'ถั่ว', icon:'🫘' },
  // Grains
  { id:'rice', group:'grains', labelEN:'Rice', labelTH:'ข้าว', icon:'🍚' },
  { id:'bread', group:'grains', labelEN:'Bread', labelTH:'ขนมปัง', icon:'🍞' },
  { id:'noodles', group:'grains', labelEN:'Noodles', labelTH:'เส้น/ก๋วยเตี๋ยว', icon:'🍜' },
  { id:'spaghetti', group:'grains', labelEN:'Spaghetti', labelTH:'สปาเกตตี', icon:'🍝' },
  { id:'pancake', group:'grains', labelEN:'Pancake', labelTH:'แพนเค้ก', icon:'🥞' },
  { id:'sandwich', group:'grains', labelEN:'Sandwich', labelTH:'แซนด์วิช', icon:'🥪' },
  { id:'taco', group:'grains', labelEN:'Taco', labelTH:'ทาโก้', icon:'🌮' },
  // Dairy/Alt
  { id:'milk', group:'dairy', labelEN:'Milk', labelTH:'นม', icon:'🥛' },
  { id:'cheese', group:'dairy', labelEN:'Cheese', labelTH:'ชีส', icon:'🧀' },
  { id:'yogurt', group:'dairy', labelEN:'Yogurt', labelTH:'โยเกิร์ต', icon:'🍦' } // ใช้ทรงใกล้เคียง
];

// ---------- Internal state ----------
const ST = {
  lang: 'TH',
  targetId: 'fruits',
  need: 4,
  got: 0,
  x2Until: 0,
  magnetUntil: 0,
};

// ---------- Public API ----------
export function init(gameState){
  const d = (gameState?.difficulty)||'Normal';
  ST.need = d==='Easy' ? 3 : d==='Hard' ? 5 : 4;
  ST.got = 0;
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
  showTargetHUD(true);
  updateTargetBadge();
}
export function cleanup(){ showTargetHUD(false); }
export function tick(){ /* no-op */ }

// (A) magnet bias + pick meta (D: ส่ง mult/golden ไป main.js)
export function pickMeta(diff){
  const now = performance.now();
  const magnetActive = now < ST.magnetUntil;
  const probTargetBase = 0.58;
  const probTarget = magnetActive ? 0.90 : probTargetBase; // A
  const pickTarget = Math.random() < probTarget;

  const pool = pickTarget
    ? ITEMS.filter(i=>i.group===ST.targetId)
    : ITEMS.filter(i=>i.group!==ST.targetId);

  const it = pool[(Math.random()*pool.length)|0];

  const goldenActive = now < ST.x2Until;
  const mult = goldenActive ? 2 : 1; // B
  const lifeBase = diff?.life || 3000;
  const life = Math.min(4500, Math.max(700, lifeBase)); // ป้องกันค้างนานเกินไป (ข้อ 1)

  return {
    id: it.id,
    groupId: it.group,
    char: it.icon,
    good: (it.group===ST.targetId),
    life,
    golden: goldenActive && Math.random()<0.2,
    mult
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
    return 'good'; // คะแนนคูณจะอยู่ที่ main.js ผ่าน meta.mult
  }
  systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
  return 'bad';
}

// ----- Powers -----
export function getPowerDurations(){ return { x2:8, freeze:3, magnet:6 }; }
export const powers = {
  x2Target(){
    ST.x2Until = performance.now() + 8000;
  },
  freezeTarget(){
    // การหยุด spawn ทำใน main.js โดยตั้ง state.freezeUntil จาก duration
  },
  magnetNext(ms=6000){
    ST.magnetUntil = performance.now() + ms;
  }
};

// ----- HUD helpers -----
function showTargetHUD(show){
  const wrap = document.getElementById('targetWrap');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}
function updateTargetBadge(){
  const g = GROUPS.find(x=>x.id===ST.targetId);
  const badge = document.getElementById('targetBadge');
  if (badge && g){
    badge.textContent = t(g.labelTH, g.labelEN, ST.lang) + `  (${ST.got}/${ST.need})`;
    badge.style.fontWeight = '800';
  }
  const tLabel = document.getElementById('t_target');
  if (tLabel) tLabel.textContent = t('หมวด', 'Target', ST.lang);
}

// ----- utils -----
function t(th, en, lang){ return lang==='EN' ? en : th; }
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length? cand[(Math.random()*cand.length)|0] : prev;
}
