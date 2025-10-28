// === Hero Health Academy — game/modes/groups.js (Hardened Drop-in) ===
// Food Group Frenzy (5 หมู่) + โควตา + Power-ups (x2 / Freeze / Magnet)
// รวม: golden gating window, target cooldown + micro toast, HUD target badge, safe lifetimes
// สัญญากับ main.js:
// export: init(state, hud, diff), cleanup(state, hud), pickMeta(diff, state),
//         onHit(meta, sys, state, hud), tick(state, sys, hud)
// export: powers{ x2Target, freezeTarget, magnetNext }, getPowerDurations()
// export: fx{ onSpawn, onHit }
// meta: {char, label, aria, groupId, good, golden, life}

export const name = 'groups';

// ---------- Safe FX bootstrap (no duplicate identifiers) ----------
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    (async () => {
      try {
        const m = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

// ---------- เนื้อหา ----------
const GROUPS = {
  veggies: [
    { id:'veg_broccoli',  emoji:'🥦', th:'บรอกโคลี',     en:'Broccoli' },
    { id:'veg_carrot',    emoji:'🥕', th:'แครอท',        en:'Carrot' },
    { id:'veg_corn',      emoji:'🌽', th:'ข้าวโพดหวาน',  en:'Sweet corn' },
    { id:'veg_lettuce',   emoji:'🥬', th:'ผักกาดหอม',    en:'Lettuce' },
    { id:'veg_cucumber',  emoji:'🥒', th:'แตงกวา',       en:'Cucumber' },
    { id:'veg_spinach',   emoji:'🥬', th:'ผักโขม',       en:'Spinach' },
    { id:'veg_pumpkin',   emoji:'🎃', th:'ฟักทอง',       en:'Pumpkin' },
    { id:'veg_mushroom',  emoji:'🍄', th:'เห็ด',         en:'Mushroom' },
    { id:'veg_eggplant',  emoji:'🍆', th:'มะเขือยาว',    en:'Eggplant' },
    { id:'veg_chili',     emoji:'🌶️', th:'พริก',        en:'Chili' },
    { id:'veg_onion',     emoji:'🧅', th:'หัวหอม',       en:'Onion' },
    { id:'veg_garlic',    emoji:'🧄', th:'กระเทียม',     en:'Garlic' },
    { id:'veg_tomato',    emoji:'🍅', th:'มะเขือเทศ*',   en:'Tomato*' },
    { id:'veg_cabbage',   emoji:'🥬', th:'กะหล่ำปลี',    en:'Cabbage' },
    { id:'veg_okra',      emoji:'🌿', th:'กระเจี๊ยบ',    en:'Okra' },
    { id:'veg_bokchoy',   emoji:'🥬', th:'กวางตุ้ง',     en:'Bok choy' },
    { id:'veg_kale',      emoji:'🥬', th:'คะน้า',        en:'Kale' },
    { id:'veg_beet',      emoji:'🫐', th:'บีตรูต',       en:'Beetroot' },
    { id:'veg_asparagus', emoji:'🌿', th:'หน่อไม้ฝรั่ง', en:'Asparagus' },
    { id:'veg_mixsalad',  emoji:'🥗', th:'สลัดผักรวม',   en:'Mixed salad' },
  ],
  protein: [
    { id:'pro_chicken',   emoji:'🍗', th:'ไก่',          en:'Chicken' },
    { id:'pro_beef',      emoji:'🥩', th:'เนื้อวัว',     en:'Beef' },
    { id:'pro_pork',      emoji:'🍖', th:'หมู',          en:'Pork' },
    { id:'pro_egg',       emoji:'🥚', th:'ไข่',          en:'Egg' },
    { id:'pro_fish',      emoji:'🐟', th:'ปลา',          en:'Fish' },
    { id:'pro_shrimp',    emoji:'🍤', th:'กุ้ง',         en:'Shrimp' },
    { id:'pro_crab',      emoji:'🦀', th:'ปู',           en:'Crab' },
    { id:'pro_shell',     emoji:'🐚', th:'หอย',          en:'Shellfish' },
    { id:'pro_tofu',      emoji:'🧊', th:'เต้าหู้',       en:'Tofu' },
    { id:'pro_soymilk',   emoji:'🥛', th:'นมถั่วเหลือง', en:'Soy milk' },
    { id:'pro_peanut',    emoji:'🥜', th:'ถั่วลิสง',      en:'Peanuts' },
    { id:'pro_bean',      emoji:'🫘', th:'ถั่วแดง',       en:'Beans' },
    { id:'pro_edamame',   emoji:'🫘', th:'ถั่วแระ',       en:'Edamame' },
    { id:'pro_salmon',    emoji:'🍣', th:'ปลาแซลมอน',    en:'Salmon' },
    { id:'pro_tuna',      emoji:'🐟', th:'ทูน่า',        en:'Tuna' },
    { id:'pro_duck',      emoji:'🦆', th:'เนื้อเป็ด',     en:'Duck' },
    { id:'pro_lentil',    emoji:'🫘', th:'ถั่วเลนทิล',    en:'Lentils' },
    { id:'pro_chickpea',  emoji:'🫘', th:'ถั่วลูกไก่',    en:'Chickpeas' },
    { id:'pro_squid',     emoji:'🦑', th:'ปลาหมึก',      en:'Squid' },
    { id:'pro_eggwhite',  emoji:'🥚', th:'ไข่ขาว',       en:'Egg white' },
  ],
  grains: [
    { id:'gr_rice',       emoji:'🍚', th:'ข้าวสวย',      en:'Rice' },
    { id:'gr_brownrice',  emoji:'🍚', th:'ข้าวกล้อง',    en:'Brown rice' },
    { id:'gr_sticky',     emoji:'🍙', th:'ข้าวเหนียว',   en:'Sticky rice' },
    { id:'gr_bread',      emoji:'🍞', th:'ขนมปัง',       en:'Bread' },
    { id:'gr_baguette',   emoji:'🥖', th:'บาแกตต์',      en:'Baguette' },
    { id:'gr_croissant',  emoji:'🥐', th:'ครัวซองต์',     en:'Croissant' },
    { id:'gr_pasta',      emoji:'🍝', th:'พาสต้า',        en:'Pasta' },
    { id:'gr_noodle',     emoji:'🍜', th:'ก๋วยเตี๋ยว',    en:'Noodles' },
    { id:'gr_cereal',     emoji:'🥣', th:'ซีเรียล',       en:'Cereal' },
    { id:'gr_oat',        emoji:'🥣', th:'โอ๊ต',          en:'Oats' },
    { id:'gr_porridge',   emoji:'🥣', th:'โจ๊ก',          en:'Porridge' },
    { id:'gr_flatbread',  emoji:'🫓', th:'แป้งแผ่น',      en:'Flatbread' },
    { id:'gr_pita',       emoji:'🫓', th:'พิต้า',         en:'Pita' },
    { id:'gr_tortilla',   emoji:'🌮', th:'ตอร์ติญา',      en:'Tortilla' },
    { id:'gr_bagel',      emoji:'🥯', th:'เบเกิล',        en:'Bagel' },
    { id:'gr_waffle',     emoji:'🧇', th:'วาฟเฟิล',       en:'Waffle' },
    { id:'gr_pancake',    emoji:'🥞', th:'แพนเค้ก',       en:'Pancake' },
    { id:'gr_cracker',    emoji:'🍘', th:'ข้าวเกรียบ',    en:'Rice cracker' },
    { id:'gr_bun',        emoji:'🥯', th:'ขนมปังกลม',     en:'Bun' },
    { id:'gr_quinoa',     emoji:'🥣', th:'ควินัว',        en:'Quinoa' },
  ],
  fruit: [
    { id:'fr_apple',      emoji:'🍎', th:'แอปเปิล',      en:'Apple' },
    { id:'fr_banana',     emoji:'🍌', th:'กล้วย',        en:'Banana' },
    { id:'fr_grape',      emoji:'🍇', th:'องุ่น',        en:'Grapes' },
    { id:'fr_strawberry', emoji:'🍓', th:'สตรอว์เบอร์รี', en:'Strawberry' },
    { id:'fr_orange',     emoji:'🍊', th:'ส้ม',          en:'Orange' },
    { id:'fr_pineapple',  emoji:'🍍', th:'สับปะรด',      en:'Pineapple' },
    { id:'fr_mango',      emoji:'🥭', th:'มะม่วง',       en:'Mango' },
    { id:'fr_peach',      emoji:'🍑', th:'พีช',          en:'Peach' },
    { id:'fr_watermelon', emoji:'🍉', th:'แตงโม',        en:'Watermelon' },
    { id:'fr_cherry',     emoji:'🍒', th:'เชอร์รี',       en:'Cherry' },
    { id:'fr_pear',       emoji:'🍐', th:'แพร์',         en:'Pear' },
    { id:'fr_lemon',      emoji:'🍋', th:'เลมอน',        en:'Lemon' },
    { id:'fr_melon',      emoji:'🍈', th:'เมลอน',        en:'Melon' },
    { id:'fr_kiwi',       emoji:'🥝', th:'กีวี',         en:'Kiwi' },
    { id:'fr_blueberry',  emoji:'🫐', th:'บลูเบอร์รี',    en:'Blueberry' },
    { id:'fr_raspberry',  emoji:'🫐', th:'ราสป์เบอร์รี',  en:'Raspberry' },
    { id:'fr_dragon',     emoji:'🐉', th:'แก้วมังกร',     en:'Dragon fruit' },
    { id:'fr_papaya',     emoji:'🥭', th:'มะละกอ',       en:'Papaya' },
    { id:'fr_coconut',    emoji:'🥥', th:'มะพร้าว',      en:'Coconut' },
    { id:'fr_guava',      emoji:'🍏', th:'ฝรั่ง',        en:'Guava' },
  ],
  dairy: [
    { id:'da_milk',       emoji:'🥛', th:'นม',           en:'Milk' },
    { id:'da_yogurt',     emoji:'🥛', th:'โยเกิร์ต',      en:'Yogurt' },
    { id:'da_cheese',     emoji:'🧀', th:'ชีส',           en:'Cheese' },
    { id:'da_kefir',      emoji:'🥛', th:'เคเฟอร์',       en:'Kefir' },
    { id:'da_curd',       emoji:'🥛', th:'นมตกตะกอน',     en:'Curd' },
    { id:'da_buttermilk', emoji:'🥛', th:'บัตเตอร์มิลค์', en:'Buttermilk' },
    { id:'da_cocoa',      emoji:'🍫', th:'นมโกโก้',       en:'Cocoa milk' },
    { id:'da_yakult',     emoji:'🥛', th:'นมเปรี้ยว',     en:'Fermented milk' },
    { id:'da_icecream',   emoji:'🍦', th:'ไอศกรีม',       en:'Ice cream' },
    { id:'da_froyo',      emoji:'🍧', th:'โฟรโย',         en:'Frozen yogurt' },
    { id:'da_pudding',    emoji:'🍮', th:'พุดดิ้งนม',     en:'Milk pudding' },
    { id:'da_condensed',  emoji:'🥛', th:'นมข้นหวาน',     en:'Condensed milk' },
    { id:'da_evap',       emoji:'🥛', th:'นมข้นจืด',      en:'Evaporated milk' },
    { id:'da_lassi',      emoji:'🥛', th:'ลัสซี',         en:'Lassi' },
    { id:'da_mozz',       emoji:'🧀', th:'มอสซาเรลลา',    en:'Mozzarella' },
    { id:'da_parm',       emoji:'🧀', th:'พาร์เมซาน',     en:'Parmesan' },
    { id:'da_cottage',    emoji:'🧀', th:'คอทเทจชีส',     en:'Cottage cheese' },
    { id:'da_ricotta',    emoji:'🧀', th:'ริคอตตา',       en:'Ricotta' },
    { id:'da_skyr',       emoji:'🥛', th:'สกีร์',         en:'Skyr' },
    { id:'da_milkshake',  emoji:'🥤', th:'มิลค์เชค',      en:'Milkshake' },
  ],
};
const GROUP_KEYS = Object.keys(GROUPS);

// ---------- ค่าแนะนำ/ควบคุม ----------
const QUOTA = { Easy:6, Normal:8, Hard:10 };
const TARGET_RATIO = 0.28;
const GOLDEN_CHANCE = 0.04;
const GOLDEN_COOLDOWN_SPAWNS = 6;
const GOLDEN_CAP_PER20 = 2;

// ---------- ภายในโหมด ----------
let _hudRef = null;
let _lastState = null;
let _x2Until = 0;
let _magnetNext = false;

// golden window
let _spawnsInWindow = 0;
let _goldenInWindow = 0;
let _sinceGolden = GOLDEN_COOLDOWN_SPAWNS;

// target cooldown + toast
let _targetCooldownUntil = 0;

function nowMs(){ return performance?.now?.() || Date.now(); }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function labelOf(item, lang='TH'){ return (lang==='EN') ? item.en : item.th; }
function chooseNextTarget(prev){ let ng; do { ng = GROUP_KEYS[(Math.random()*GROUP_KEYS.length)|0]; } while (ng===prev); return ng; }

function toast(msg){
  let el = document.getElementById('toast');
  if (!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 1000);
}

function updateTargetHUD(state){
  const have = state?.ctx?.targetHave|0;
  const need = state?.ctx?.targetNeed|0;
  const gkey = state?.ctx?.targetGroup;
  try { _hudRef?.setTarget?.(gkey, have, need); } catch {}
  const el = document.getElementById('targetBadge');
  if (el){
    const nameTH = ({veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'})[gkey] || gkey;
    el.textContent = `${nameTH} • ${have}/${need}`;
    const wrap = document.getElementById('targetWrap');
    if (wrap) wrap.style.display = 'inline-flex';
  }
}

// ---------- Lifecycle ----------
export function init(state={}, hud=null, diff={}){
  _hudRef = hud;
  _lastState = state;
  state.ctx = state.ctx || {};
  state.lang = (state.lang||localStorage.getItem('hha_lang')||'TH').toUpperCase();

  state.ctx.targetGroup = chooseNextTarget(null);
  state.ctx.targetNeed  = QUOTA[state.difficulty] || 8;
  state.ctx.targetHave  = 0;

  _x2Until = 0;
  _magnetNext = false;

  _spawnsInWindow = 0;
  _goldenInWindow = 0;
  _sinceGolden = GOLDEN_COOLDOWN_SPAWNS;

  _targetCooldownUntil = 0;

  updateTargetHUD(state);
}

export function cleanup(/*state*/){
  _hudRef = null;
  _lastState = null;
  _x2Until = 0;
  _magnetNext = false;
  _spawnsInWindow = 0;
  _goldenInWindow = 0;
  _sinceGolden = GOLDEN_COOLDOWN_SPAWNS;
  _targetCooldownUntil = 0;
}

export function tick(/*state, sys, hud*/){
  if (_x2Until && nowMs() > _x2Until) _x2Until = 0;
}

// ---------- สุ่มเป้าหมาย ----------
export function pickMeta(diff={}, state={}){
  // Magnet: ชิ้นถัดไปบังคับเป็นเป้าหมาย
  let forceTarget = false;
  if (_magnetNext){ forceTarget = true; _magnetNext = false; }

  const targetGroup = state.ctx?.targetGroup || 'veggies';
  const isTarget = forceTarget || (Math.random() < TARGET_RATIO);

  // เลือกหมวด
  const groupId = isTarget
    ? targetGroup
    : (()=>{ let k; do { k = GROUP_KEYS[(Math.random()*GROUP_KEYS.length)|0]; } while (k===targetGroup); return k; })();

  // เลือกรายการ
  const item = GROUPS[groupId][(Math.random()*GROUPS[groupId].length)|0];

  // golden gating (เฉพาะชิ้นเป้าหมาย)
  _spawnsInWindow++;
  if (_spawnsInWindow >= 20){ _spawnsInWindow = 0; _goldenInWindow = 0; }

  let golden = false;
  if (isTarget && _sinceGolden > GOLDEN_COOLDOWN_SPAWNS && _goldenInWindow < GOLDEN_CAP_PER20){
    if (Math.random() < GOLDEN_CHANCE){ golden = true; _goldenInWindow++; _sinceGolden = 0; }
  } else {
    _sinceGolden++;
  }

  const life = clamp(Number(diff.life) > 0 ? Number(diff.life) : 3000, 700, 4500);

  return {
    char: item.emoji,
    label: labelOf(item, state.lang),
    aria: item.en,
    groupId,
    good: (groupId === targetGroup),
    golden,
    life
  };
}

// ---------- เมื่อผู้เล่นคลิก ----------
export function onHit(meta={}, sys={}, state={}, hud=null){
  // meta: {good, golden, groupId}
  let result = 'ok';

  if (meta.good){
    result = meta.golden ? 'perfect' : 'good';

    // โควตา: golden นับ 2
    const add = meta.golden ? 2 : 1;
    state.ctx.targetHave = Math.min((state.ctx.targetHave|0) + add, state.ctx.targetNeed|0);

    // ครบโควตา → เปลี่ยนหมวดใหม่ + cooldown + glow
    if ((state.ctx.targetHave|0) >= (state.ctx.targetNeed|0)){
      try { sys.sfx?.play?.('sfx-perfect'); } catch {}
      const next = chooseNextTarget(state.ctx.targetGroup);
      state.ctx.targetGroup = next;
      state.ctx.targetNeed  = QUOTA[state.difficulty] || 8;
      state.ctx.targetHave  = 0;

      _targetCooldownUntil = nowMs() + 1200;

      const nameTH = ({veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'})[next] || next;
      toast('🎯 เป้าหมายใหม่: ' + nameTH);

      const wrap = document.getElementById('targetWrap');
      if (wrap){ wrap.classList.add('glow'); setTimeout(()=>wrap.classList.remove('glow'), 950); }
    }
    updateTargetHUD(state);
  } else {
    // ชิ้นผิดหมวด = bad
    result = 'bad';
  }

  return result; // 'good' | 'perfect' | 'bad' | 'ok'
}

// ---------- Power-ups ----------
export const powers = {
  x2Target(){ _x2Until = nowMs() + 8000; },
  freezeTarget(){ if (_lastState) _lastState.freezeUntil = nowMs() + 3000; },
  magnetNext(){ _magnetNext = true; }
};

export function getPowerDurations(){ return { x2:8, freeze:3, magnet:2 }; }

// ---------- FX hooks ----------
export const fx = {
  onSpawn(el/*, state*/){
    try { (window?.HHA_FX?.add3DTilt || (()=>{}))(el); } catch {}
  },
  onHit(x, y/*, meta, state*/){
    try { (window?.HHA_FX?.shatter3D || (()=>{}))(x, y); } catch {}
  }
};
