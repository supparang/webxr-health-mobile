// === Hero Health Academy — modes/groups.js (Food Group Frenzy; 20 items/หมู่ รวมครบในไฟล์) ===
export const name = 'groups';

/* ------------------------------------------------------------------
   1) GROUP DEFINITIONS (5 หมู่หลัก)
------------------------------------------------------------------- */
export const GROUPS = [
  { id:'fruits',   labelTH:'ผลไม้',        labelEN:'Fruits',        color:'#ef4444' },
  { id:'veggies',  labelTH:'ผัก',           labelEN:'Vegetables',    color:'#22c55e' },
  { id:'protein',  labelTH:'โปรตีน',        labelEN:'Protein',       color:'#3b82f6' },
  { id:'grains',   labelTH:'ธัญพืช',        labelEN:'Grains',        color:'#f59e0b' },
  { id:'dairy',    labelTH:'นม/ผลิตภัณฑ์',  labelEN:'Dairy',         color:'#a855f7' },
];

/* ------------------------------------------------------------------
   2) ITEMS — รวม 20 รายการ/หมู่ (icon + labelTH/EN)
   หมายเหตุ: ใช้อีโมจิที่หาได้จริงในระบบมาตรฐาน
------------------------------------------------------------------- */

// Fruits (20)
const FRUITS = [
  { id:'apple',       labelEN:'Apple',        labelTH:'แอปเปิล',       icon:'🍎' },
  { id:'green_apple', labelEN:'Green Apple',  labelTH:'แอปเปิลเขียว',  icon:'🍏' },
  { id:'banana',      labelEN:'Banana',       labelTH:'กล้วย',          icon:'🍌' },
  { id:'strawberry',  labelEN:'Strawberry',   labelTH:'สตรอว์เบอร์รี่', icon:'🍓' },
  { id:'watermelon',  labelEN:'Watermelon',   labelTH:'แตงโม',           icon:'🍉' },
  { id:'orange',      labelEN:'Orange',       labelTH:'ส้ม',             icon:'🍊' },
  { id:'grapes',      labelEN:'Grapes',       labelTH:'องุ่น',           icon:'🍇' },
  { id:'pineapple',   labelEN:'Pineapple',    labelTH:'สับปะรด',         icon:'🍍' },
  { id:'mango',       labelEN:'Mango',        labelTH:'มะม่วง',          icon:'🥭' },
  { id:'cherries',    labelEN:'Cherries',     labelTH:'เชอร์รี่',         icon:'🍒' },
  { id:'peach',       labelEN:'Peach',        labelTH:'พีช',             icon:'🍑' },
  { id:'lemon',       labelEN:'Lemon',        labelTH:'มะนาว',           icon:'🍋' },
  { id:'pear',        labelEN:'Pear',         labelTH:'ลูกแพร์',         icon:'🍐' },
  { id:'kiwi',        labelEN:'Kiwi',         labelTH:'กีวี',            icon:'🥝' },
  { id:'melon',       labelEN:'Melon',        labelTH:'เมลอน',           icon:'🍈' },
  { id:'coconut',     labelEN:'Coconut',      labelTH:'มะพร้าว',         icon:'🥥' },
  { id:'blueberry',   labelEN:'Blueberries',  labelTH:'บลูเบอร์รี่',     icon:'🫐' }, // บางฟอนต์รองรับ
  { id:'raspberry',   labelEN:'Raspberries',  labelTH:'ราสป์เบอร์รี่',   icon:'🫐' },
  { id:'tangerine',   labelEN:'Tangerine',    labelTH:'ส้มแมนดาริน',     icon:'🍊' },
  { id:'lime',        labelEN:'Lime',         labelTH:'มะนาวเขียว',      icon:'🍋' },
].map(x=>({...x, group:'fruits'}));

// Veggies (20)
const VEGGIES = [
  { id:'carrot',    labelEN:'Carrot',      labelTH:'แครอท',           icon:'🥕' },
  { id:'broccoli',  labelEN:'Broccoli',    labelTH:'บรอกโคลี',        icon:'🥦' },
  { id:'cucumber',  labelEN:'Cucumber',    labelTH:'แตงกวา',          icon:'🥒' },
  { id:'tomato',    labelEN:'Tomato',      labelTH:'มะเขือเทศ',        icon:'🍅' },
  { id:'corn',      labelEN:'Corn',        labelTH:'ข้าวโพด',          icon:'🌽' },
  { id:'lettuce',   labelEN:'Leafy Greens',labelTH:'ผักใบ/ผักกาด',     icon:'🥬' },
  { id:'mushroom',  labelEN:'Mushroom',    labelTH:'เห็ด',             icon:'🍄' },
  { id:'salad',     labelEN:'Salad',       labelTH:'สลัดผัก',          icon:'🥗' },
  { id:'chili',     labelEN:'Chili',       labelTH:'พริก',             icon:'🌶️' },
  { id:'onion',     labelEN:'Onion',       labelTH:'หัวหอม',           icon:'🧅' },
  { id:'garlic',    labelEN:'Garlic',      labelTH:'กระเทียม',         icon:'🧄' },
  { id:'potato',    labelEN:'Potato',      labelTH:'มันฝรั่ง',          icon:'🥔' },
  { id:'eggplant',  labelEN:'Eggplant',    labelTH:'มะเขือม่วง',        icon:'🍆' },
  { id:'avocado',   labelEN:'Avocado',     labelTH:'อะโวคาโด',          icon:'🥑' },
  { id:'herbs',     labelEN:'Herbs',       labelTH:'สมุนไพร',           icon:'🌿' },
  { id:'sweetcorn', labelEN:'Sweet Corn',  labelTH:'ข้าวโพดหวาน',       icon:'🌽' },
  { id:'pickle',    labelEN:'Pickled Cuke',labelTH:'แตงกวาดอง',         icon:'🥒' },
  { id:'pepper',    labelEN:'Bell Pepper', labelTH:'พริกหวาน',          icon:'🌶️' },
  { id:'seaweed',   labelEN:'Seaweed',     labelTH:'สาหร่าย',           icon:'🪸' }, // อีโมจิแทนใกล้เคียง
  { id:'sprout',    labelEN:'Bean Sprout', labelTH:'ถั่วงอก',           icon:'🌱' },
].map(x=>({...x, group:'veggies'}));

// Protein (20)
const PROTEIN = [
  { id:'egg',       labelEN:'Egg',          labelTH:'ไข่',              icon:'🥚' },
  { id:'drumstick', labelEN:'Chicken',      labelTH:'ไก่',              icon:'🍗' },
  { id:'meat',      labelEN:'Meat',         labelTH:'เนื้อสัตว์',       icon:'🍖' },
  { id:'beef',      labelEN:'Beef Steak',   labelTH:'เนื้อวัว',         icon:'🥩' },
  { id:'fish',      labelEN:'Fish',         labelTH:'ปลา',              icon:'🐟' },
  { id:'shrimp',    labelEN:'Shrimp',       labelTH:'กุ้ง',             icon:'🦐' },
  { id:'crab',      labelEN:'Crab',         labelTH:'ปู',               icon:'🦀' },
  { id:'squid',     labelEN:'Squid',        labelTH:'หมึก',             icon:'🦑' },
  { id:'tofu',      labelEN:'Tofu',         labelTH:'เต้าหู้',           icon:'🍢' }, // ใช้คท.ไม้เป็นตัวแทน
  { id:'peanut',    labelEN:'Peanuts',      labelTH:'ถั่วลิสง',         icon:'🥜' },
  { id:'soybeans',  labelEN:'Soybeans',     labelTH:'ถั่วเหลือง',       icon:'🫘' },
  { id:'ham',       labelEN:'Ham/Bacon',    labelTH:'แฮม/เบคอน',        icon:'🥓' },
  { id:'sausage',   labelEN:'Sausage',      labelTH:'ไส้กรอก',          icon:'🌭' },
  { id:'nuts',      labelEN:'Mixed Nuts',   labelTH:'ถั่วรวม',          icon:'🌰' },
  { id:'turkey',    labelEN:'Turkey',       labelTH:'ไก่งวง',           icon:'🍗' },
  { id:'eel',       labelEN:'Eel',          labelTH:'ปลาไหล',           icon:'🐟' },
  { id:'shell',     labelEN:'Shellfish',    labelTH:'หอย',              icon:'🐚' },
  { id:'lamb',      labelEN:'Lamb',         labelTH:'เนื้อแกะ',         icon:'🥩' },
  { id:'beans',     labelEN:'Beans',        labelTH:'ถั่วต่างๆ',         icon:'🫘' },
  { id:'edamame',   labelEN:'Edamame',      labelTH:'ถั่วแระ',          icon:'🫘' },
].map(x=>({...x, group:'protein'}));

// Grains (20)
const GRAINS = [
  { id:'rice',        labelEN:'Rice',          labelTH:'ข้าวสวย',         icon:'🍚' },
  { id:'rice_ball',   labelEN:'Rice Ball',     labelTH:'ข้าวปั้น',         icon:'🍙' },
  { id:'rice_cracker',labelEN:'Rice Cracker',  labelTH:'ข้าวเกรียบ/เซมเบ้', icon:'🍘' },
  { id:'bread',       labelEN:'Bread',         labelTH:'ขนมปัง',          icon:'🍞' },
  { id:'baguette',    labelEN:'Baguette',      labelTH:'บาแก็ต',           icon:'🥖' },
  { id:'croissant',   labelEN:'Croissant',     labelTH:'ครัวซองต์',         icon:'🥐' },
  { id:'pancake',     labelEN:'Pancake',       labelTH:'แพนเค้ก',           icon:'🥞' },
  { id:'waffle',      labelEN:'Waffle',        labelTH:'วาฟเฟิล',           icon:'🧇' },
  { id:'noodles',     labelEN:'Noodles',       labelTH:'ก๋วยเตี๋ยว',        icon:'🍜' },
  { id:'spaghetti',   labelEN:'Spaghetti',     labelTH:'สปาเกตตี',          icon:'🍝' },
  { id:'sandwich',    labelEN:'Sandwich',      labelTH:'แซนด์วิช',          icon:'🥪' },
  { id:'taco',        labelEN:'Taco',          labelTH:'ทาโก้',              icon:'🌮' },
  { id:'burrito',     labelEN:'Burrito',       labelTH:'เบอร์ริโต',          icon:'🌯' },
  { id:'pretzel',     labelEN:'Pretzel',       labelTH:'เพรทเซล',            icon:'🥨' },
  { id:'pie',         labelEN:'Pie',           labelTH:'พาย',                icon:'🥧' },
  { id:'cookie',      labelEN:'Cookie',        labelTH:'คุกกี้',             icon:'🍪' },
  { id:'donut',       labelEN:'Donut',         labelTH:'โดนัท',              icon:'🍩' },
  { id:'bagel',       labelEN:'Bagel',         labelTH:'เบเกิล',             icon:'🥯' },
  { id:'cereal',      labelEN:'Cereal',        labelTH:'ซีเรียล',             icon:'🥣' },
  { id:'bento',       labelEN:'Bento (Rice)',  labelTH:'เบนโตะ (มีข้าว)',     icon:'🍱' },
].map(x=>({...x, group:'grains'}));

// Dairy (20)
const DAIRY = [
  { id:'milk',        labelEN:'Milk',          labelTH:'นม',              icon:'🥛' },
  { id:'cheese',      labelEN:'Cheese',        labelTH:'ชีส',             icon:'🧀' },
  { id:'yogurt',      labelEN:'Yogurt',        labelTH:'โยเกิร์ต',         icon:'🥣' },
  { id:'butter',      labelEN:'Butter',        labelTH:'เนย',              icon:'🧈' },
  { id:'icecream',    labelEN:'Ice Cream',     labelTH:'ไอศกรีม',          icon:'🍦' },
  { id:'icecream_b',  labelEN:'Sundae',        labelTH:'ไอศกรีมถ้วย',       icon:'🍨' },
  { id:'custard',     labelEN:'Custard',       labelTH:'คัสตาร์ด/พุดดิ้ง',  icon:'🍮' },
  { id:'milkshake',   labelEN:'Milkshake',     labelTH:'มิลค์เชค',         icon:'🥤' },
  { id:'kefir',       labelEN:'Kefir',         labelTH:'นมเปรี้ยวเคฟีร์',   icon:'🥛' },
  { id:'cream',       labelEN:'Cream',         labelTH:'ครีม',             icon:'🥛' },
  { id:'cottage',     labelEN:'Cottage Cheese',labelTH:'คอทเทจชีส',        icon:'🧀' },
  { id:'mozzarella',  labelEN:'Mozzarella',    labelTH:'มอซซาเรลลา',        icon:'🧀' },
  { id:'parmesan',    labelEN:'Parmesan',      labelTH:'พาร์มีซาน',         icon:'🧀' },
  { id:'greek_yog',   labelEN:'Greek Yogurt',  labelTH:'กรีกโยเกิร์ต',      icon:'🥣' },
  { id:'yog_drink',   labelEN:'Yogurt Drink',  labelTH:'นมเปรี้ยว',         icon:'🥤' },
  { id:'pudding',     labelEN:'Milk Pudding',  labelTH:'พุดดิ้งนม',         icon:'🍮' },
  { id:'condensed',   labelEN:'Condensed Milk',labelTH:'นมข้นหวาน',        icon:'🥛' },
  { id:'evaporated',  labelEN:'Evaporated Milk',labelTH:'นมข้นจืด',        icon:'🥛' },
  { id:'ghee',        labelEN:'Ghee',          labelTH:'กี (เนยใส)',        icon:'🧈' },
  { id:'bottle',      labelEN:'Milk Bottle',   labelTH:'ขวดนม',            icon:'🍼' },
].map(x=>({...x, group:'dairy'}));

// รวมทั้งหมด
const ITEMS = [...FRUITS, ...VEGGIES, ...PROTEIN, ...GRAINS, ...DAIRY];

/* ------------------------------------------------------------------
   3) TUNABLES / STATE
------------------------------------------------------------------- */
const NEED_BY_DIFF = { Easy:3, Normal:4, Hard:5 };
const PROB_TARGET  = 0.58;   // โอกาสสุ่มตรงหมวดเป้าหมาย
const LIFE_MS      = 3000;   // TTL ของไอคอน (ms)

const POWER_DUR = { x2:8, freeze:3, magnet:2 }; // วินาที

const ST = {
  lang:'TH',
  targetId:'fruits',
  need:4, got:0,
  lastSpawnAt:0,
  missions:[],
  missionProg:{},
  magnetNext:false,
};

/* ------------------------------------------------------------------
   4) MINI-QUESTS (สุ่ม 1 ง่าย + 1 กลาง + 1 ยาก ต่อเกม)
------------------------------------------------------------------- */
const QUESTS_POOL = [
  // ง่าย
  { id:'q_easy_collect6', labelTH:'เก็บให้ถูก 6 ชิ้น', labelEN:'Pick 6 correct items', need:6, diff:'easy',
    test:(ev)=>ev.result==='good' && ev.meta?.good },
  { id:'q_easy_combo8', labelTH:'ทำคอมโบ x8', labelEN:'Reach combo x8', need:8, diff:'easy',
    test:(ev)=>ev.comboNow>=8 },

  // กลาง
  { id:'q_mid_noBad5', labelTH:'ห้ามพลาด 5 ชิ้นติด', labelEN:'No miss for 5 hits', need:5, diff:'mid',
    test:(ev)=>ev.result!=='bad' },
  { id:'q_mid_target2', labelTH:'เคลียร์ 2 หมวด', labelEN:'Clear 2 targets', need:2, diff:'mid',
    test:(ev)=>ev.type==='target_clear' },

  // ยาก
  { id:'q_hard_speed5', labelTH:'เก็บเร็ว 1.2s/ชิ้น ×5', labelEN:'Fast pick 5 times', need:5, diff:'hard',
    test:(ev)=>ev.type==='fast_hit' },
  { id:'q_hard_combo15', labelTH:'ทำคอมโบ x15', labelEN:'Reach combo x15', need:15, diff:'hard',
    test:(ev)=>ev.comboNow>=15 },
];

/* ------------------------------------------------------------------
   5) PUBLIC API สำหรับ main.js
------------------------------------------------------------------- */
export function init(gameState, hud, diff){
  ST.lang = localStorage.getItem('hha_lang') || 'TH';
  ST.need = NEED_BY_DIFF[gameState?.difficulty] ?? 4;
  ST.got = 0;

  // สุ่มเป้าหมายเริ่ม
  ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
  showTargetHUD(true);
  updateTargetBadge();

  // สุ่มเควส 1-1-1
  const easy = randPick(QUESTS_POOL.filter(q=>q.diff==='easy'), 1);
  const mid  = randPick(QUESTS_POOL.filter(q=>q.diff==='mid'), 1);
  const hard = randPick(QUESTS_POOL.filter(q=>q.diff==='hard'), 1);
  ST.missions = [...easy, ...mid, ...hard];
  ST.missionProg = Object.fromEntries(ST.missions.map(q=>[q.id,0]));
  publishMissionsHUD();
}

export function cleanup(){
  showTargetHUD(false);
}

export function pickMeta(diff, gameState){
  ST.lastSpawnAt = performance.now();

  const pickTarget = Math.random() < PROB_TARGET;
  const pool = pickTarget
    ? ITEMS.filter(i=>i.group===ST.targetId)
    : ITEMS.filter(i=>i.group!==ST.targetId);
  const it = pool[(Math.random()*pool.length)|0];

  return {
    id: it.id,
    char: it.icon,
    label: ST.lang==='EN' ? it.labelEN : it.labelTH,
    aria: `${ST.lang==='EN'?it.labelEN:it.labelTH}`,
    good: (it.group===ST.targetId),
    life: LIFE_MS,
    groupId: it.group,
    decoy: !pickTarget
  };
}

export function onHit(meta, systems, gameState, hud){
  const now  = performance.now();
  const fast = (now - ST.lastSpawnAt) <= 1200;

  if (meta.good){
    ST.got++;
    updateTargetBadge();
    systems.coach?.say?.(t('ใช่เลย!', 'Nice!', ST.lang));

    if (fast) pushQuestEvent({type:'fast_hit'});
    pushQuestEvent({result:'good', meta, comboNow:gameState.combo});

    if (ST.got >= ST.need){
      ST.got = 0;
      ST.targetId = pickDifferent(GROUPS.map(g=>g.id), ST.targetId);
      updateTargetBadge();
      systems.sfx?.play?.('powerup');
      systems.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
      pushQuestEvent({type:'target_clear'});
    }
    return 'good';
  }else{
    systems.coach?.say?.(t('ยังไม่ใช่หมวดนี้นะ', 'Not this group!', ST.lang));
    pushQuestEvent({result:'bad', meta, comboNow:gameState.combo});
    return 'bad';
  }
}

export function tick(){ /* โหมดนี้ไม่ต้องทำอะไรต่อวินาทีเพิ่มเติม */ }

/* ------------------------------------------------------------------
   6) POWERS (ให้ main.js เรียกใช้)
------------------------------------------------------------------- */
export const powers = {
  x2Target(){
    // ใช้ควบคู่กับระบบคะแนน/FEVER ใน main.js ได้เลย (เอฟเฟกต์/เสียง)
    try{ document.getElementById('sfx-powerup')?.play(); }catch{}
  },
  freezeTarget(){ /* ถ้าต้องขยาย: ใส่ flag ให้ main.js ลด spawn เฉพาะกลุ่มได้ */ },
  magnetNext(){ ST.magnetNext = true; }
};
export function getPowerDurations(){ return POWER_DUR; }

/* ------------------------------------------------------------------
   7) HUD HELPERS
------------------------------------------------------------------- */
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
    badge.setAttribute('aria-live','polite');
  }
  const tLabel = document.getElementById('t_target');
  if (tLabel) tLabel.textContent = t('หมวด', 'Target', ST.lang);
}
function publishMissionsHUD(){
  const list = ST.missions.map(q=>({
    id:q.id,
    label: t(q.labelTH,q.labelEN,ST.lang),
    need: q.need,
    prog: ST.missionProg[q.id]||0
  }));
  try{ window?.Progress?.emit?.('run_start', { missions:list }); }catch{}
}

/* ------------------------------------------------------------------
   8) QUEST PROGRESS + BADGE FX
------------------------------------------------------------------- */
function pushQuestEvent(ev){
  for (const q of ST.missions){
    if (q.test(ev)){
      ST.missionProg[q.id] = Math.min(q.need, (ST.missionProg[q.id]||0) + 1);
      try{
        window?.Progress?.emit?.('mission_tick', { id:q.id, prog:ST.missionProg[q.id], need:q.need });
        if (ST.missionProg[q.id] >= q.need){
          window?.Progress?.emit?.('mission_done', { id:q.id });
          popBadgeFX(q);
        }
      }catch{}
    }
  }
  // แจ้ง HUD ให้วาดใหม่
  publishMissionsHUD();
}
function popBadgeFX(q){
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;left:50%;top:28%;transform:translate(-50%,-50%);
    font:900 22px/1.2 ui-rounded,system-ui;color:#4ade80;text-shadow:0 2px 10px #000b;z-index:160;pointer-events:none;
    background:rgba(6,44,24,.6);border:1px solid #1f9d55;border-radius:14px;padding:10px 14px;`;
  el.textContent = t('สำเร็จเควส: ', 'Quest Complete: ', ST.lang) + t(q.labelTH, q.labelEN, ST.lang);
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .35s, transform .35s'; el.style.opacity='0'; el.style.transform='translate(-50%,-60%)'; }, 900);
  setTimeout(()=>{ try{ el.remove(); }catch{} }, 1300);
}

/* ------------------------------------------------------------------
   9) UTILS
------------------------------------------------------------------- */
function t(th, en, lang){ return lang==='EN' ? en : th; }
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length ? cand[(Math.random()*cand.length)|0] : prev;
}
function randPick(arr, n){
  const a = arr.slice(); const out = [];
  while (a.length && out.length<n){ out.push(a.splice((Math.random()*a.length)|0,1)[0]); }
  return out;
}
