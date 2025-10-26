// === Hero Health Academy — game/modes/groups.js (Floating icons with TTL, target quota & autoswitch) ===
export const name = 'groups';

// ---------- พารามิเตอร์ที่ “ปรับเกม” ได้ ----------
const TUNING = {
  // โควตาที่ต้องกดให้ถูกตามหมวด ก่อนสลับหมวดใหม่
  quotaByDiff: { Easy: 3, Normal: 4, Hard: 5 },

  // โอกาสสุ่มชิ้น “หมวดเป้าหมาย” (0–1) ยิ่งสูงยิ่งออกเป้าหมายบ่อย
  targetBias: 0.60,

  // TTL/อายุไอคอนต่อความยาก (มิลลิวินาที) — main.js จะใช้ meta.life ถ้ามี
  ttlByDiff: { Easy: 4200, Normal: 3000, Hard: 2200 },

  // บังคับสลับหมวดถ้าเล่นช้าเกินกำหนด (วินาที) และยังเก็บไม่ครบโควตา
  autoswitchSec: 18,

  // เมื่อสลับหมวดใหม่ ให้ “กันซ้ำ” จากหมวดเดิม
  avoidRepeatGroup: true,
};

// ---------- กลุ่ม/หมวด ----------
const GROUPS = [
  { id:'fruits',  labelTH:'ผลไม้',     labelEN:'Fruits',     color:'#ef4444' },
  { id:'veggies', labelTH:'ผัก',        labelEN:'Vegetables', color:'#22c55e' },
  { id:'protein', labelTH:'โปรตีน',     labelEN:'Protein',    color:'#3b82f6' },
  { id:'grains',  labelTH:'ธัญพืช',     labelEN:'Grains',     color:'#f59e0b' },
];

// ---------- รายการอาหาร (อีโมจิ) ----------
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
  { id:'soybeans',   group:'protein', labelEN:'Soybeans',   labelTH:'ถั่วเมล็ดแห้ง',  icon:'🫘' },
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

// ---------- สถานะภายในของโหมด ----------
const ST = {
  lang: 'TH',
  targetId: 'fruits',
  need: 4,            // จะถูกเซ็ตจากความยากตอน init()
  got: 0,
  lastSwitchMs: 0,    // เวลา (ms) ตอนตั้งเป้าหมายล่าสุด
};

// ---------- ฟังก์ชันช่วย ----------
const t = (th, en, lang)=> (lang==='EN' ? en : th);
const now = ()=> (performance?.now?.() || Date.now());
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length? cand[(Math.random()*cand.length)|0] : prev;
}
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
function switchTarget(forced=false){
  const ids = GROUPS.map(g=>g.id);
  ST.targetId = (TUNING.avoidRepeatGroup && ST.targetId)
    ? pickDifferent(ids, ST.targetId)
    : ids[(Math.random()*ids.length)|0];
  ST.got = 0;
  ST.lastSwitchMs = now();
  updateTargetBadge();
  return forced;
}

// ---------- API ให้ main.js เรียก ----------
export function init(gameState, hud, diff){
  // ภาษา
  ST.lang = (localStorage.getItem('hha_lang')||'TH');

  // โควตาตามความยาก
  const d = (gameState?.difficulty)||'Normal';
  ST.need = TUNING.quotaByDiff[d] ?? 4;

  // เป้าหมายเริ่มต้น
  switchTarget(false);

  // โชว์ HUD เป้าหมาย
  showTargetHUD(true);

  // ให้โค้ชพูด
  try {
    const g = GROUPS.find(x=>x.id===ST.targetId);
    const msg = t(`เป้าหมาย: ${g.labelTH}`, `Target: ${g.labelEN}`, ST.lang);
    gameState?.coach?.say?.(msg);
  } catch {}
}

export function cleanup(){
  showTargetHUD(false);
}

// main.js จะเรียกต่อวินาที (dt ~ 1s)
export function tick(state /* gameState */, systems /* {score,sfx,power,coach,...} */){
  // ถ้าเล่นช้า (ยังไม่ครบโควตา) เกิน autoswitchSec → สลับหมวดช่วยผู้เล่น
  if (ST.got < ST.need){
    const waited = (now() - ST.lastSwitchMs) / 1000;
    if (waited >= TUNING.autoswitchSec){
      switchTarget(true);
      systems?.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
      try { systems?.sfx?.play?.('powerup'); } catch {}
    }
  }
}

// เมื่อ main.js spawn หนึ่งชิ้น จะมาถาม meta ที่ควรเกิด
export function pickMeta(diff, gameState){
  const d = (gameState?.difficulty)||'Normal';
  const life = TUNING.ttlByDiff[d] ?? (diff?.life || 3000);

  // เพิ่มโอกาสหมวดเป้าหมายด้วย targetBias
  const pool = (Math.random() < TUNING.targetBias)
    ? ITEMS.filter(i=>i.group===ST.targetId)
    : ITEMS.filter(i=>i.group!==ST.targetId);

  // กันกรณี pool ว่าง (เช่น bias สูงเกินไประหว่างสลับ)
  const list = pool.length ? pool : ITEMS;
  const it = list[(Math.random()*list.length)|0];

  return {
    id: it.id,
    char: it.icon,
    good: (it.group === ST.targetId),
    life, // TTL ของชิ้นนี้ (main.js จะตั้ง setTimeout ลบเอง)
  };
}

// ถูกคลิกหนึ่งชิ้น
export function onHit(meta, systems){
  if (meta.good){
    ST.got++;
    updateTargetBadge();
    systems?.coach?.say?.(t('ใช่เลย!', 'Nice!', ST.lang));

    if (ST.got >= ST.need){
      // เคลียร์โควตา → สลับหมวดใหม่ทันที
      switchTarget(true);
      try { systems?.sfx?.play?.('powerup'); } catch {}
      systems?.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
    }
    return 'good'; // main.js จะคำนวณคะแนน/คอมโบ/FEVER ให้
  }

  // กดผิดหมวด
  systems?.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
  return 'bad';
}
