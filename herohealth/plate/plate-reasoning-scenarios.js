// === /herohealth/plate/plate-reasoning-scenarios.js ===
// HeroHealth Plate Reasoning Scenarios (Analyze / Evaluate / Create) — v1.0
// ✅ Shared scenario bank for Plate Analyze / Evaluate / Create
// ✅ Thai-first content
// ✅ Seeded pick support (deterministic for study/research)
// ✅ Constraint tags + reason chips + scoring hints
// ✅ Exports helper functions for random/daily/seeded selection
//
// Usage:
//   import {
//     SCENARIOS,
//     REASON_CHIPS,
//     seededRng,
//     pickScenario,
//     getScenarioById,
//     buildEvaluatePair,
//     summarizeConstraintsTH
//   } from './plate-reasoning-scenarios.js';

'use strict';

// --------------------------------------------------
// Utilities
// --------------------------------------------------
export function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function seededRng(seed){
  let t = (Number(seed) || 123456789) >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne(arr, rng=Math.random){
  if(!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle(arr, rng=Math.random){
  const a = Array.isArray(arr) ? arr.slice() : [];
  for(let i=a.length-1; i>0; i--){
    const j = Math.floor(rng()*(i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function todayKeyTH(date=new Date()){
  // YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function hashString32(s){
  s = String(s || '');
  let h = 2166136261 >>> 0;
  for(let i=0; i<s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// --------------------------------------------------
// Reason chips (shared)
// --------------------------------------------------
// ใช้ทั้ง Analyze/Evaluate/Create เพื่อให้เหตุผลแบบ structured
export const REASON_CHIPS = [
  { id:'veg_enough',          labelTH:'ผักเพียงพอ',                        tag:'balance', polarity:'good' },
  { id:'fruit_ok',            labelTH:'ผลไม้เหมาะสม',                       tag:'balance', polarity:'good' },
  { id:'protein_ok',          labelTH:'โปรตีนเหมาะสม',                      tag:'protein', polarity:'good' },
  { id:'carb_ok',             labelTH:'คาร์โบไฮเดรตพอดี',                   tag:'carb', polarity:'good' },
  { id:'fat_ok',              labelTH:'ไขมันไม่มากเกิน',                    tag:'fat', polarity:'good' },
  { id:'sugar_high',          labelTH:'หวานเกินไป',                         tag:'sugar', polarity:'bad'  },
  { id:'fried_high',          labelTH:'ของทอด/มันมากเกิน',                  tag:'fat', polarity:'bad'  },
  { id:'carb_too_high',       labelTH:'แป้งเยอะเกินไป',                      tag:'carb', polarity:'bad'  },
  { id:'veg_too_low',         labelTH:'ผักน้อยเกินไป',                      tag:'veg', polarity:'bad'  },
  { id:'protein_too_low',     labelTH:'โปรตีนน้อยเกินไป',                   tag:'protein', polarity:'bad'  },
  { id:'energy_too_low',      labelTH:'พลังงานน้อยเกินไปสำหรับกิจกรรม',       tag:'energy', polarity:'bad'  },
  { id:'energy_too_high',     labelTH:'พลังงานมากเกินไปสำหรับมื้อนี้',         tag:'energy', polarity:'bad'  },
  { id:'allergy_safe',        labelTH:'หลีกเลี่ยงอาหารที่แพ้ได้ถูกต้อง',       tag:'allergy', polarity:'good' },
  { id:'allergy_violated',    labelTH:'มีอาหารที่ขัดกับข้อจำกัดการแพ้',        tag:'allergy', polarity:'bad'  },
  { id:'budget_fit',          labelTH:'เหมาะกับงบประมาณ',                    tag:'budget', polarity:'good' },
  { id:'budget_over',         labelTH:'เกินงบประมาณ',                        tag:'budget', polarity:'bad'  },
  { id:'time_fit',            labelTH:'เตรียมได้ทันตามเวลา',                 tag:'time', polarity:'good' },
  { id:'time_over',           labelTH:'ใช้เวลาเตรียมนานเกินไป',               tag:'time', polarity:'bad'  },
  { id:'preworkout_fit',      labelTH:'เหมาะกับมื้อก่อนออกกำลังกาย',         tag:'context', polarity:'good' },
  { id:'postworkout_fit',     labelTH:'เหมาะกับมื้อหลังออกกำลังกาย',         tag:'context', polarity:'good' },
  { id:'school_morning_fit',  labelTH:'เหมาะกับมื้อเช้าก่อนไปโรงเรียน',       tag:'context', polarity:'good' },
  { id:'home_ingredient_fit', labelTH:'ใช้วัตถุดิบที่มีในบ้านได้ดี',           tag:'ingredient', polarity:'good' },
  { id:'variety_good',        labelTH:'มีความหลากหลายดี',                    tag:'variety', polarity:'good' },
];

// lookup
export const REASON_CHIP_MAP = Object.freeze(
  REASON_CHIPS.reduce((acc, c)=>{ acc[c.id] = c; return acc; }, {})
);

// --------------------------------------------------
// Food item library (simplified / scoring-friendly)
// --------------------------------------------------
// ใช้ metadata เพื่อ scoring Analyze/Create และสร้าง plate pair ใน Evaluate
export const FOOD_ITEMS = [
  // ผัก
  { id:'veg_kale',      nameTH:'คะน้าลวก',        group:'veg',     cost:12, prepMin:5,  protein:1, carb:1, fat:0, sugar:0, fried:false, dairy:false,  tags:['home','quick'] },
  { id:'veg_cucumber',  nameTH:'แตงกวา',          group:'veg',     cost:10, prepMin:2,  protein:0, carb:1, fat:0, sugar:0, fried:false, dairy:false,  tags:['home','quick'] },
  { id:'veg_carrot',    nameTH:'แครอท',           group:'veg',     cost:12, prepMin:3,  protein:0, carb:2, fat:0, sugar:1, fried:false, dairy:false,  tags:['home','quick'] },
  { id:'veg_broccoli',  nameTH:'บรอกโคลี',         group:'veg',     cost:18, prepMin:6,  protein:2, carb:2, fat:0, sugar:1, fried:false, dairy:false,  tags:['home'] },

  // ผลไม้
  { id:'fruit_banana',  nameTH:'กล้วย',           group:'fruit',   cost:10, prepMin:1,  protein:1, carb:4, fat:0, sugar:2, fried:false, dairy:false,  tags:['quick','home','preworkout'] },
  { id:'fruit_apple',   nameTH:'แอปเปิล',         group:'fruit',   cost:20, prepMin:2,  protein:0, carb:3, fat:0, sugar:2, fried:false, dairy:false,  tags:['quick'] },
  { id:'fruit_papaya',  nameTH:'มะละกอ',          group:'fruit',   cost:15, prepMin:4,  protein:0, carb:3, fat:0, sugar:2, fried:false, dairy:false,  tags:['home'] },
  { id:'fruit_orange',  nameTH:'ส้ม',             group:'fruit',   cost:12, prepMin:2,  protein:0, carb:3, fat:0, sugar:2, fried:false, dairy:false,  tags:['quick'] },

  // โปรตีน
  { id:'pro_egg_boiled', nameTH:'ไข่ต้ม',          group:'protein', cost:12, prepMin:8,  protein:4, carb:0, fat:2, sugar:0, fried:false, dairy:false,  tags:['home'] },
  { id:'pro_tofu',       nameTH:'เต้าหู้',         group:'protein', cost:15, prepMin:5,  protein:4, carb:1, fat:1, sugar:0, fried:false, dairy:false,  tags:['home','quick'] },
  { id:'pro_fish',       nameTH:'ปลา',            group:'protein', cost:30, prepMin:10, protein:5, carb:0, fat:2, sugar:0, fried:false, dairy:false,  tags:['home'] },
  { id:'pro_chicken',    nameTH:'อกไก่',          group:'protein', cost:28, prepMin:10, protein:5, carb:0, fat:1, sugar:0, fried:false, dairy:false,  tags:['home'] },
  { id:'pro_milk',       nameTH:'นม',             group:'protein', cost:15, prepMin:1,  protein:3, carb:2, fat:2, sugar:1, fried:false, dairy:true,   tags:['quick'] },
  { id:'pro_yogurt',     nameTH:'โยเกิร์ต',        group:'protein', cost:20, prepMin:1,  protein:2, carb:2, fat:1, sugar:2, fried:false, dairy:true,   tags:['quick'] },

  // คาร์บ
  { id:'carb_rice',      nameTH:'ข้าวสวย',         group:'carb',    cost:10, prepMin:1,  protein:1, carb:5, fat:0, sugar:0, fried:false, dairy:false,  tags:['home','quick'] },
  { id:'carb_brownrice', nameTH:'ข้าวกล้อง',       group:'carb',    cost:15, prepMin:1,  protein:1, carb:5, fat:0, sugar:0, fried:false, dairy:false,  tags:['home','quick'] },
  { id:'carb_bread',     nameTH:'ขนมปัง',          group:'carb',    cost:12, prepMin:1,  protein:1, carb:4, fat:1, sugar:1, fried:false, dairy:false,  tags:['quick'] },
  { id:'carb_noodle',    nameTH:'ก๋วยเตี๋ยว/เส้น',  group:'carb',    cost:18, prepMin:6,  protein:1, carb:5, fat:1, sugar:0, fried:false, dairy:false,  tags:['home'] },

  // ไขมัน/ของเพิ่ม
  { id:'fat_avocado',    nameTH:'อะโวคาโด',        group:'fat',     cost:25, prepMin:2,  protein:1, carb:1, fat:5, sugar:0, fried:false, dairy:false,  tags:['healthy'] },
  { id:'fat_nuts',       nameTH:'ถั่ว',            group:'fat',     cost:15, prepMin:1,  protein:2, carb:1, fat:4, sugar:0, fried:false, dairy:false,  tags:['quick','home'] },
  { id:'fat_fried_chicken', nameTH:'ไก่ทอด',       group:'fat',     cost:30, prepMin:1,  protein:3, carb:2, fat:6, sugar:0, fried:true,  dairy:false,  tags:['fastfood'] },
  { id:'fat_fries',      nameTH:'เฟรนช์ฟรายส์',    group:'fat',     cost:25, prepMin:1,  protein:1, carb:5, fat:5, sugar:0, fried:true,  dairy:false,  tags:['fastfood'] },

  // ขนม/น้ำหวาน (ตัวหลอก)
  { id:'sweet_donut',    nameTH:'โดนัท',           group:'fat',     cost:20, prepMin:1,  protein:1, carb:4, fat:4, sugar:5, fried:true,  dairy:true,   tags:['snack','fastfood'] },
  { id:'sweet_soda',     nameTH:'น้ำอัดลม',        group:'fat',     cost:15, prepMin:1,  protein:0, carb:4, fat:0, sugar:6, fried:false, dairy:false,  tags:['drink','sugar'] },
];

export const FOOD_MAP = Object.freeze(
  FOOD_ITEMS.reduce((acc, x)=>{ acc[x.id] = x; return acc; }, {})
);

// --------------------------------------------------
// Scenario bank (shared)
// --------------------------------------------------
// แต่ละ scenario ใช้ได้กับ Analyze / Create และบางส่วนใช้สร้าง Evaluate pair
//
// key fields:
// - constraints: เงื่อนไขโจทย์
// - targetProfile: แนวทาง scoring/ideal
// - recommendedReasonChipIds: ชิปเหตุผลที่ "ควรมี"
// - avoidReasonChipIds: ชิปเหตุผลที่สะท้อนความเข้าใจผิด
// - availableItemIds: วัตถุดิบที่ให้เลือก (for create/analyze)
// - baselineBadPlate / baselineGoodPlate: ใช้ evaluate pair ได้ทันที (optional)
export const SCENARIOS = [
  {
    id:'scn_breakfast_school_quick_budget',
    zone:'nutrition',
    modeTags:['analyze','create','evaluate'],
    titleTH:'มื้อเช้าก่อนไปโรงเรียน (รีบ + งบจำกัด)',
    promptTH:'วันนี้มีเวลา 5 นาที งบไม่เกิน 50 บาท ต้องจัดมื้อเช้าก่อนไปโรงเรียนให้เหมาะสม',
    difficulty:'easy',
    constraints:{
      budgetMax: 50,
      prepTimeMaxMin: 5,
      allergy: [],
      context: 'school_morning',
      goal: ['balanced_plate'],
      proteinPriority: 'normal',
      avoidHighSugar: true
    },
    targetProfile:{
      wantGroups: ['veg','fruit','protein','carb'],
      optionalGroups: ['fat'],
      preferQuick: true,
      preferLowSugar: true,
      preferNotFried: true,
      minProteinScore: 2
    },
    availableItemIds:[
      'veg_cucumber','veg_carrot',
      'fruit_banana','fruit_orange',
      'pro_tofu','pro_milk','pro_yogurt',
      'carb_bread','carb_rice',
      'fat_nuts','sweet_donut','sweet_soda'
    ],
    recommendedReasonChipIds:[
      'school_morning_fit','time_fit','budget_fit','veg_enough','protein_ok','carb_ok'
    ],
    avoidReasonChipIds:[
      'sugar_high','budget_over','time_over'
    ],
    baselineGoodPlate:{
      itemIds:['carb_bread','pro_tofu','veg_cucumber','fruit_banana','fat_nuts'],
      rationaleHintTH:'ครบหลายหมู่ เตรียมเร็ว และไม่หวานจัด'
    },
    baselineBadPlate:{
      itemIds:['sweet_donut','sweet_soda','carb_bread'],
      rationaleHintTH:'เร็วแต่หวานสูง ผัก/โปรตีนน้อย'
    }
  },

  {
    id:'scn_preworkout_highprotein_nodairy',
    zone:'nutrition',
    modeTags:['analyze','create','evaluate'],
    titleTH:'มื้อก่อนออกกำลังกาย (โปรตีนสูง + แพ้นม)',
    promptTH:'ผู้เล่นจะออกกำลังกายในอีก 45 นาที ต้องการโปรตีนสูง แต่แพ้นม/ผลิตภัณฑ์นม',
    difficulty:'medium',
    constraints:{
      budgetMax: 70,
      prepTimeMaxMin: 10,
      allergy: ['dairy'],
      context: 'preworkout',
      goal: ['high_protein','balanced_plate'],
      proteinPriority: 'high',
      avoidHighSugar: true
    },
    targetProfile:{
      wantGroups: ['protein','carb','veg'],
      optionalGroups: ['fruit','fat'],
      preferQuick: false,
      preferLowSugar: true,
      preferNotFried: true,
      minProteinScore: 5
    },
    availableItemIds:[
      'pro_chicken','pro_fish','pro_tofu','pro_egg_boiled','pro_milk','pro_yogurt',
      'carb_rice','carb_brownrice','carb_bread',
      'veg_broccoli','veg_carrot','veg_cucumber',
      'fruit_banana','fruit_apple',
      'fat_nuts','fat_fried_chicken','sweet_soda'
    ],
    recommendedReasonChipIds:[
      'protein_ok','allergy_safe','preworkout_fit','carb_ok','veg_enough'
    ],
    avoidReasonChipIds:[
      'allergy_violated','fried_high','sugar_high'
    ],
    baselineGoodPlate:{
      itemIds:['pro_chicken','carb_brownrice','veg_broccoli','fruit_banana','fat_nuts'],
      rationaleHintTH:'โปรตีนดี มีคาร์บสำหรับพลังงาน และเลี่ยงนม'
    },
    baselineBadPlate:{
      itemIds:['pro_yogurt','sweet_soda','fat_fried_chicken'],
      rationaleHintTH:'ขัดกับแพ้นม และไขมัน/น้ำตาลสูง'
    }
  },

  {
    id:'scn_home_ingredients_limited',
    zone:'nutrition',
    modeTags:['analyze','create'],
    titleTH:'ของในบ้านมีจำกัด',
    promptTH:'ในบ้านมีวัตถุดิบจำกัด ต้องจัดจานให้สมดุลที่สุดจากของที่มี',
    difficulty:'medium',
    constraints:{
      budgetMax: 999, // ไม่เน้นงบ เพราะใช้ของในบ้าน
      prepTimeMaxMin: 8,
      allergy: [],
      context: 'home_limited',
      goal: ['balanced_plate'],
      proteinPriority: 'normal',
      avoidHighSugar: false
    },
    targetProfile:{
      wantGroups: ['veg','protein','carb'],
      optionalGroups: ['fruit','fat'],
      preferQuick: true,
      preferLowSugar: false,
      preferNotFried: true,
      minProteinScore: 3
    },
    availableItemIds:[
      'veg_cucumber','veg_kale',
      'fruit_papaya',
      'pro_egg_boiled','pro_tofu',
      'carb_rice',
      'fat_nuts',
      'sweet_soda'
    ],
    recommendedReasonChipIds:[
      'home_ingredient_fit','variety_good','protein_ok','veg_enough'
    ],
    avoidReasonChipIds:[
      'sugar_high'
    ]
  },

  {
    id:'scn_postworkout_recovery_budget',
    zone:'nutrition',
    modeTags:['analyze','create','evaluate'],
    titleTH:'มื้อหลังออกกำลังกาย (ฟื้นตัว + งบพอประมาณ)',
    promptTH:'เพิ่งออกกำลังกายเสร็จ ต้องการมื้อฟื้นตัว มีงบ 70 บาท',
    difficulty:'medium',
    constraints:{
      budgetMax: 70,
      prepTimeMaxMin: 10,
      allergy: [],
      context: 'postworkout',
      goal: ['balanced_plate','recovery'],
      proteinPriority: 'high',
      avoidHighSugar: true
    },
    targetProfile:{
      wantGroups: ['protein','carb','veg'],
      optionalGroups: ['fruit','fat'],
      preferQuick: false,
      preferLowSugar: true,
      preferNotFried: true,
      minProteinScore: 5
    },
    availableItemIds:[
      'pro_chicken','pro_fish','pro_tofu','pro_milk',
      'carb_rice','carb_brownrice','carb_noodle',
      'veg_broccoli','veg_kale','veg_carrot',
      'fruit_banana','fruit_orange',
      'fat_nuts','fat_fries','sweet_soda'
    ],
    recommendedReasonChipIds:[
      'postworkout_fit','protein_ok','carb_ok','veg_enough','budget_fit'
    ],
    avoidReasonChipIds:[
      'fried_high','sugar_high','budget_over'
    ],
    baselineGoodPlate:{
      itemIds:['pro_fish','carb_rice','veg_kale','fruit_orange','fat_nuts'],
      rationaleHintTH:'เหมาะกับฟื้นตัว มีโปรตีน+คาร์บพอดี'
    },
    baselineBadPlate:{
      itemIds:['fat_fries','sweet_soda','sweet_donut'],
      rationaleHintTH:'พลังงานคุณภาพต่ำ น้ำตาล/ไขมันสูง'
    }
  },

  {
    id:'scn_weight_control_lunch',
    zone:'nutrition',
    modeTags:['analyze','create','evaluate'],
    titleTH:'มื้อกลางวันคุมพลังงาน',
    promptTH:'ต้องการมื้อกลางวันอิ่มพอดี เน้นผักมากขึ้น และหลีกเลี่ยงพลังงานเกิน',
    difficulty:'easy',
    constraints:{
      budgetMax: 60,
      prepTimeMaxMin: 8,
      allergy: [],
      context: 'lunch_weight_control',
      goal: ['balanced_plate','energy_control'],
      proteinPriority: 'normal',
      avoidHighSugar: true
    },
    targetProfile:{
      wantGroups: ['veg','protein','carb'],
      optionalGroups: ['fruit'],
      preferQuick: true,
      preferLowSugar: true,
      preferNotFried: true,
      minProteinScore: 3
    },
    availableItemIds:[
      'veg_broccoli','veg_cucumber','veg_carrot',
      'fruit_apple','fruit_orange',
      'pro_tofu','pro_egg_boiled','pro_chicken',
      'carb_brownrice','carb_rice','carb_bread',
      'fat_nuts','fat_fried_chicken','sweet_soda'
    ],
    recommendedReasonChipIds:[
      'veg_enough','protein_ok','carb_ok','fat_ok'
    ],
    avoidReasonChipIds:[
      'energy_too_high','fried_high','sugar_high','carb_too_high'
    ],
    baselineGoodPlate:{
      itemIds:['veg_broccoli','veg_cucumber','pro_tofu','carb_brownrice','fruit_orange'],
      rationaleHintTH:'ผักเด่น + โปรตีนพอ + คาร์บพอดี'
    },
    baselineBadPlate:{
      itemIds:['carb_rice','carb_bread','fat_fried_chicken','sweet_soda'],
      rationaleHintTH:'แป้ง+ไขมัน+น้ำตาลเด่น ผักน้อย'
    }
  },

  {
    id:'scn_exam_day_focus',
    zone:'nutrition',
    modeTags:['analyze','create'],
    titleTH:'วันสอบ ต้องการสมาธิและอิ่มนาน',
    promptTH:'จัดมื้อก่อนสอบให้ช่วยอิ่มพอดี ไม่หวานจัด และไม่หนักเกินจนง่วง',
    difficulty:'medium',
    constraints:{
      budgetMax: 65,
      prepTimeMaxMin: 7,
      allergy: [],
      context: 'exam_day',
      goal: ['balanced_plate','steady_energy'],
      proteinPriority: 'normal',
      avoidHighSugar: true
    },
    targetProfile:{
      wantGroups: ['protein','carb','veg','fruit'],
      optionalGroups: ['fat'],
      preferQuick: true,
      preferLowSugar: true,
      preferNotFried: true,
      minProteinScore: 3
    },
    availableItemIds:[
      'pro_egg_boiled','pro_tofu','pro_milk',
      'carb_bread','carb_brownrice',
      'veg_cucumber','veg_carrot',
      'fruit_banana','fruit_apple',
      'fat_nuts',
      'sweet_donut','sweet_soda'
    ],
    recommendedReasonChipIds:[
      'school_morning_fit','protein_ok','carb_ok','sugar_high'
    ],
    avoidReasonChipIds:[
      'sugar_high','energy_too_high'
    ]
  },
];

// quick lookup
export const SCENARIO_MAP = Object.freeze(
  SCENARIOS.reduce((acc, s)=>{ acc[s.id] = s; return acc; }, {})
);

// --------------------------------------------------
// Scenario selection helpers
// --------------------------------------------------
export function getScenarioById(id){
  return SCENARIO_MAP[String(id || '')] || null;
}

/**
 * pickScenario(options)
 * options:
 *   - seed
 *   - pid
 *   - dayKey
 *   - modeTag ('analyze'|'evaluate'|'create')
 *   - difficulty
 *   - ids (whitelist)
 *   - strategy ('seed'|'day'|'random')
 */
export function pickScenario(options={}){
  const {
    seed = 0,
    pid = 'anon',
    dayKey = todayKeyTH(),
    modeTag = '',
    difficulty = '',
    ids = null,
    strategy = 'seed'
  } = options;

  let pool = SCENARIOS.slice();

  if(Array.isArray(ids) && ids.length){
    const idSet = new Set(ids.map(String));
    pool = pool.filter(s => idSet.has(s.id));
  }

  if(modeTag){
    pool = pool.filter(s => Array.isArray(s.modeTags) && s.modeTags.includes(modeTag));
  }

  if(difficulty){
    pool = pool.filter(s => String(s.difficulty || '') === String(difficulty));
  }

  if(pool.length === 0) return null;

  let rng = Math.random;
  if(strategy === 'day'){
    const h = hashString32(`${pid}|${dayKey}|${modeTag}|${difficulty}`);
    rng = seededRng(h);
  }else if(strategy === 'seed'){
    const h = hashString32(`${seed}|${pid}|${modeTag}|${difficulty}`);
    rng = seededRng(h);
  }

  return pickOne(pool, rng);
}

// --------------------------------------------------
// Constraint summarizer (for UI subtitles)
// --------------------------------------------------
export function summarizeConstraintsTH(scn){
  if(!scn || !scn.constraints) return 'ไม่มีเงื่อนไข';
  const c = scn.constraints;
  const parts = [];

  if(Number(c.budgetMax) && Number(c.budgetMax) < 999) parts.push(`งบ ≤ ${c.budgetMax} บาท`);
  if(Number(c.prepTimeMaxMin)) parts.push(`เวลา ≤ ${c.prepTimeMaxMin} นาที`);
  if(Array.isArray(c.allergy) && c.allergy.length){
    const map = { dairy:'แพ้นม', peanut:'แพ้ถั่วลิสง', seafood:'แพ้อาหารทะเล', egg:'แพ้ไข่' };
    parts.push(c.allergy.map(a => map[a] || `แพ้${a}`).join(', '));
  }
  if(c.context){
    const ctxMap = {
      school_morning:'มื้อเช้าก่อนไปโรงเรียน',
      preworkout:'ก่อนออกกำลังกาย',
      postworkout:'หลังออกกำลังกาย',
      home_limited:'ใช้วัตถุดิบในบ้าน',
      lunch_weight_control:'มื้อกลางวันคุมพลังงาน',
      exam_day:'ก่อนสอบ'
    };
    parts.push(ctxMap[c.context] || c.context);
  }
  if(c.proteinPriority === 'high') parts.push('เน้นโปรตีนสูง');
  if(c.avoidHighSugar) parts.push('เลี่ยงหวานจัด');

  return parts.join(' • ') || 'ไม่มีเงื่อนไข';
}

// --------------------------------------------------
// Plate stats helper (shared for evaluate/create/analyze)
// --------------------------------------------------
export function computePlateStats(itemIds=[]){
  const ids = Array.isArray(itemIds) ? itemIds : [];
  const items = ids.map(id => FOOD_MAP[id]).filter(Boolean);

  const groups = { veg:0, fruit:0, protein:0, carb:0, fat:0 };
  let cost = 0;
  let prepMin = 0;
  let protein = 0;
  let carb = 0;
  let fat = 0;
  let sugar = 0;
  let friedCount = 0;
  let dairyCount = 0;

  for(const it of items){
    if(groups[it.group] != null) groups[it.group] += 1;
    cost += Number(it.cost || 0);
    prepMin += Number(it.prepMin || 0);
    protein += Number(it.protein || 0);
    carb += Number(it.carb || 0);
    fat += Number(it.fat || 0);
    sugar += Number(it.sugar || 0);
    if(it.fried) friedCount++;
    if(it.dairy) dairyCount++;
  }

  const distinctGroupCount = Object.values(groups).filter(v => v > 0).length;

  return {
    items,
    itemIds: items.map(x=>x.id),
    groups,
    distinctGroupCount,
    cost,
    prepMin,
    macros: { protein, carb, fat, sugar },
    friedCount,
    dairyCount
  };
}

// --------------------------------------------------
// Evaluate pair builder (A/B)
// --------------------------------------------------
/**
 * buildEvaluatePair(scn, options)
 * - if scenario has baselineGood/Bad -> use them
 * - else generate from availableItemIds (simple heuristic)
 */
export function buildEvaluatePair(scn, options={}){
  if(!scn) return null;
  const rng = (typeof options.rng === 'function') ? options.rng : Math.random;
  const flip = !!options.flip;

  let A = null, B = null;
  let answer = 'A';

  if(scn.baselineGoodPlate && scn.baselineBadPlate){
    const good = {
      plateId: `${scn.id}_good`,
      label: 'good',
      itemIds: scn.baselineGoodPlate.itemIds.slice(),
      stats: computePlateStats(scn.baselineGoodPlate.itemIds),
      noteTH: scn.baselineGoodPlate.rationaleHintTH || ''
    };
    const bad = {
      plateId: `${scn.id}_bad`,
      label: 'bad',
      itemIds: scn.baselineBadPlate.itemIds.slice(),
      stats: computePlateStats(scn.baselineBadPlate.itemIds),
      noteTH: scn.baselineBadPlate.rationaleHintTH || ''
    };

    const doFlip = flip || (rng() < 0.5);
    if(doFlip){
      A = bad; B = good; answer = 'B';
    }else{
      A = good; B = bad; answer = 'A';
    }
  }else{
    // fallback generator (simple but usable)
    const avail = (scn.availableItemIds || []).filter(id => !!FOOD_MAP[id]);
    const pool = shuffle(avail, rng);

    // heuristic good: pick up to 5 groups, avoid fried/sugar/dairy if allergy
    const allergySet = new Set((scn.constraints?.allergy || []).map(String));
    const wantGroups = new Set(scn.targetProfile?.wantGroups || ['veg','protein','carb']);
    const chosenGood = [];
    const chosenGroups = new Set();

    for(const id of pool){
      const it = FOOD_MAP[id];
      if(!it) continue;
      if(allergySet.has('dairy') && it.dairy) continue;
      if(scn.constraints?.avoidHighSugar && (it.sugar||0) >= 4) continue;
      if(scn.targetProfile?.preferNotFried && it.fried) continue;

      if(wantGroups.has(it.group) && !chosenGroups.has(it.group)){
        chosenGood.push(id);
        chosenGroups.add(it.group);
      }else if(chosenGood.length < 5 && !chosenGroups.has(it.group)){
        chosenGood.push(id);
        chosenGroups.add(it.group);
      }
      if(chosenGood.length >= 5) break;
    }

    // fill if short
    for(const id of pool){
      if(chosenGood.length >= 5) break;
      if(!chosenGood.includes(id)) chosenGood.push(id);
    }

    // heuristic bad: fried/sugar-heavy + low veg/protein
    const badCandidates = pool.filter(id => {
      const it = FOOD_MAP[id];
      return it && (it.fried || (it.sugar||0) >= 4 || it.group === 'carb' || it.group === 'fat');
    });
    let chosenBad = shuffle(badCandidates, rng).slice(0,4);
    if(chosenBad.length < 3){
      chosenBad = shuffle(pool, rng).slice(0,4);
    }

    const good = {
      plateId: `${scn.id}_gen_good`,
      label: 'good',
      itemIds: chosenGood,
      stats: computePlateStats(chosenGood),
      noteTH: 'จานสมดุลกว่าและตรงเงื่อนไขมากกว่า'
    };
    const bad = {
      plateId: `${scn.id}_gen_bad`,
      label: 'bad',
      itemIds: chosenBad,
      stats: computePlateStats(chosenBad),
      noteTH: 'จานมีจุดอ่อนด้านสมดุล/ข้อจำกัด'
    };

    const doFlip = flip || (rng() < 0.5);
    if(doFlip){
      A = bad; B = good; answer = 'B';
    }else{
      A = good; B = bad; answer = 'A';
    }
  }

  return {
    scenarioId: scn.id,
    titleTH: scn.titleTH,
    promptTH: scn.promptTH,
    constraintsSummaryTH: summarizeConstraintsTH(scn),
    A,
    B,
    correctChoice: answer, // 'A'|'B'
    meta:{
      recommendedReasonChipIds: (scn.recommendedReasonChipIds || []).slice(),
      avoidReasonChipIds: (scn.avoidReasonChipIds || []).slice()
    }
  };
}

// --------------------------------------------------
// UI-friendly helpers
// --------------------------------------------------
export function getReasonChipLabelTH(id){
  return REASON_CHIP_MAP[id]?.labelTH || String(id || '');
}

export function getFoodNameTH(id){
  return FOOD_MAP[id]?.nameTH || String(id || '');
}

export function listFoodNamesTH(ids=[]){
  return (Array.isArray(ids) ? ids : [])
    .map(getFoodNameTH)
    .filter(Boolean);
}

/**
 * Build deterministic "daily" scenario selection by pid + mode
 */
export function pickDailyScenario({ pid='anon', modeTag='analyze', difficulty='' } = {}){
  return pickScenario({
    pid,
    dayKey: todayKeyTH(),
    modeTag,
    difficulty,
    strategy: 'day'
  });
}

/**
 * Build deterministic "research/study" scenario selection by seed
 */
export function pickSeededScenario({ seed=0, pid='anon', modeTag='analyze', difficulty='' } = {}){
  return pickScenario({
    seed,
    pid,
    modeTag,
    difficulty,
    strategy: 'seed'
  });
}

// --------------------------------------------------
// Optional: minimal event payload builders (for logger consistency)
// --------------------------------------------------
export function buildScenarioStartEvent(scn, extra={}){
  if(!scn) return null;
  return {
    event: 'plate:scenario_start',
    game: 'plate',
    taskType: extra.taskType || 'analyze',
    scenarioId: scn.id,
    scenarioTitleTH: scn.titleTH,
    difficulty: scn.difficulty || 'easy',
    constraints: scn.constraints || {},
    ts: Date.now(),
    ...extra
  };
}

export function buildScenarioSubmitEvent(scn, result={}, extra={}){
  if(!scn) return null;
  return {
    event: 'plate:scenario_submit',
    game: 'plate',
    taskType: extra.taskType || 'analyze',
    scenarioId: scn.id,
    score: Number(result.score || 0),
    balanceScore: Number(result.balanceScore || 0),
    constraintScore: Number(result.constraintScore || 0),
    reasonScore: Number(result.reasonScore || 0),
    choiceCorrect: result.choiceCorrect == null ? null : Number(!!result.choiceCorrect),
    misconceptionType: result.misconceptionType || '',
    ts: Date.now(),
    ...extra
  };
}