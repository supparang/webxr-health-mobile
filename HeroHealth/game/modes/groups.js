// === Hero Health Academy — game/modes/groups.js (targets have longer life, multi-target ready) ===
export const name = 'groups';

// ---------- Config ----------
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

// ---------- Internal state ----------
const ST = {
  lang: 'TH',
  targetIds: ['fruits'], // ข้อ 3: หลายเป้าหมาย
  need: 4,
  got: 0,
  multi: false,          // true = เปิดหลายเป้าหมาย
};

// ---------- Public API ----------
export function init(gameState, hud, diff){
  const d = (gameState?.difficulty)||'Normal';
  ST.need = d==='Easy' ? 3 : d==='Hard' ? 5 : 4;
  ST.got = 0;
  ST.lang = (localStorage.getItem('hha_lang')||'TH');

  const all = GROUPS.map(g=>g.id);
  if (ST.multi){
    let a = all[(Math.random()*all.length)|0];
    let b = all.filter(x=>x!==a)[(Math.random()*(all.length-1))|0];
    ST.targetIds = [a,b];
  } else {
    ST.targetIds = [ pickDifferent(all, ST.targetIds[0]) ];
  }

  showTargetHUD(true);
  updateTargetBadge();

  try { document.documentElement.setAttribute('data-hha-mode','groups'); } catch {}
}

export function cleanup(){
  showTargetHUD(false);
  try { document.documentElement.removeAttribute('data-hha-mode'); } catch {}
}

export function tick(state, systems, hud){
  // (ปรับ logic ย่อยได้ภายหลัง)
}

export function pickMeta(diff, gameState){
  // ข้อ 1: เป้าหมายอยู่นานขึ้น ตัวลวงอยู่น้อยลง
  const isTargetGroup = g => ST.targetIds.includes(g);
  const probTarget = 0.62;
  const pickTarget = Math.random() < probTarget;

  const pool = pickTarget
    ? ITEMS.filter(i=>isTargetGroup(i.group))
    : ITEMS.filter(i=>!isTargetGroup(i.group));

  const it = pool[(Math.random()*pool.length)|0];
  const isTarget = isTargetGroup(it.group);

  const baseLife = diff?.life || 3000;
  const life = Math.round(baseLife * (isTarget ? 1.25 : 0.85));

  return { id: it.id, char: it.icon, good: isTarget, life };
}

export function onHit(meta, systems, gameState, hud){
  if (meta.good){
    ST.got++;
    updateTargetBadge();
    systems.coach?.say?.(t('ใช่เลย!', 'Nice!', ST.lang));
    if (ST.got >= ST.need){
      ST.got = 0;
      const all = GROUPS.map(g=>g.id);
      if (ST.multi){
        let a = all[(Math.random()*all.length)|0];
        let b = all.filter(x=>x!==a)[(Math.random()*(all.length-1))|0];
        ST.targetIds = [a,b];
      } else {
        ST.targetIds = [ pickDifferent(all, ST.targetIds[0]) ];
      }
      updateTargetBadge();
      systems.sfx?.play?.('powerup');
      systems.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
    }
    return 'good';
  }else{
    systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
    return 'bad';
  }
}

// ---------- HUD helpers ----------
function showTargetHUD(show){
  const wrap = document.getElementById('targetWrap');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}
function updateTargetBadge(){
  const badge = document.getElementById('targetBadge');
  if (badge){
    const names = ST.targetIds.map(id=>{
      const g = GROUPS.find(x=>x.id===id);
      return t(g.labelTH, g.labelEN, ST.lang);
    }).join(' & ');
    badge.textContent = `${names}  (${ST.got}/${ST.need})`;
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
