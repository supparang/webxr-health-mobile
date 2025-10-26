// === Hero Health Academy — game/modes/groups.js
// Upgrades pack (1–12): target timer + rush, decoys, mini-quests,
// modifiers (mirror/blur/mono), dynamic difficulty, strategic powerups,
// simulated burst, onboarding/tutorial, perfect window, streak bonus & bad tax,
// plus minor accessibility toggles.
// NOTE: ข้อที่ต้อง “เกิดหลายชิ้นพร้อมกัน” ถูกจำลองด้วยการเร่ง bias/ลด TTL
// เพราะการ spawn จริงควบคุมโดย main.js (หนึ่ง meta ต่อการเกิดหนึ่งชิ้น)

export const name = 'groups';

/* --------------------- TUNING (ปรับค่าไว) --------------------- */
const TUNING = {
  quotaByDiff: { Easy:3, Normal:4, Hard:5 },   // (1) เป้าหมายต่อหนึ่งหมวด
  ttlByDiff:   { Easy:4200, Normal:3000, Hard:2200 }, // อายุไอคอนพื้นฐาน
  targetBias: 0.60,            // (1/5) โอกาสออกชิ้น “เข้ากลุ่มเป้าหมาย”
  perTargetSec: 15,            // (1) เวลาแต่ละหมวด
  rushLastSec: 5,              // (1) ช่วงเร่งท้ายหมวด
  rushBiasBoost: 0.35,         // ช่วง rush เพิ่ม bias
  rushTTLScale: 0.85,          // ช่วง rush ลด TTL

  autoswitchSec: 18,           // (1) ถ้าเล่นช้าเกิน — บังคับสลับหมวด

  decoyRate: 0.18,             // (2) โอกาสสุ่ม decoy
  decoyHint: true,             // แสดงขอบ/เอฟเฟกต์บอกใบ้เล็กน้อย (CSS inject)

  questCount: 3,               // (3) จำนวนมินิเควสท์ที่แสดง
  questBonus: 25,              // คะแนนต่อเควสที่สำเร็จ
  questFeverPlus: 2,           // เพิ่มเวลา FEVER เมื่อทำเควสเสร็จ (วินาที)

  dynamicBias: true,           // (5) ปรับ bias ตามความแม่น
  biasLo: 0.50,                // ขอบล่าง/บน ของ bias ที่ยอมให้ปรับ
  biasHi: 0.80,
  dynHiAcc: 0.90,              // ถ้าแม่นสูงกว่า → ลด bias
  dynLoAcc: 0.60,              // ถ้าต่ำกว่า → เพิ่ม bias
  dynBiasStep: 0.02,
  dynTTLStep: 60,              // ลด/เพิ่ม TTL ทีละ (ms)

  // (6) power-ups เชิงกลยุทธ์
  powerFreezeTarget: 3,        // หยุดนาฬิกา(หมวด) วินาที
  powerMagnetNext: true,       // ชิ้นถัดไป (ถูก) ขยายฮิตบ็อกซ์ — จำลองด้วยคะแนนบวก
  powerX2TargetSec: 8,         // x2 เฉพาะชิ้นเข้ากลุ่ม เป้าหมาย

  // (7) burst spawn (จำลอง)
  burstChance: 0.22,           // โอกาสเปิดหน้าต่าง burst สั้นๆ
  burstDurSec: 3,              // ระยะเวลา burst
  burstBiasBoost: 0.30,
  burstTTLScale: 0.80,

  // (8) onboarding
  tutorialFirstSec: 20,        // 20 วินาทีแรก bias สูง + TTL ยาว

  // (9) perfect window / streak bonus & bad tax
  perfectWindowMs: 280,        // คลิกเร็วภายในเวลานี้ = perfect
  streakBonus: 35,             // จบหมวดโดยไม่พลาดเลย (บวกเพิ่ม)
  badTaxN: 3,                  // ผิด N ครั้งติด
  badTaxTimePenalty: 3,        // หักเวลา N วินาที

  // (12) accessibility flags (ใช้ CSS inject)
  highContrastPulse: true,
};

/* --------------------- กลุ่ม/รายการ --------------------- */
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

/* --------------------- สถานะภายใน --------------------- */
const ST = {
  lang: 'TH',
  targetId: 'fruits',
  need: 4,
  got: 0,
  lastSwitchMs: 0,

  // (1) Target timer
  targetTimeLeft: TUNING.perTargetSec,

  // (3) mini-quests
  quests: [],
  questDone: new Set(),

  // (5) dynamic
  liveBias: TUNING.targetBias,
  liveTTL: { ...TUNING.ttlByDiff },

  // (6) powerups
  puFreezeUntil: 0,     // ms
  puMagnetNext: false,
  puX2Until: 0,         // ms

  // (7) burst simulate
  burstUntil: 0,        // ms

  // (8) tutorial
  tutorialUntil: 0,     // ms

  // (9) perfect/streak/bad tax
  inTargetStreakNoMiss: true,
  badStreak: 0,

  // decoy hint (css)
  cssInjected: false,
};

/* --------------------- Utils --------------------- */
const t = (th, en, lang)=> (lang==='EN' ? en : th);
const now = ()=> (performance?.now?.() || Date.now());
const clamp = (x,a,b)=> Math.max(a, Math.min(b, x));
function pickDifferent(list, prev){
  if (!prev) return list[(Math.random()*list.length)|0];
  const cand = list.filter(x=>x!==prev);
  return cand.length? cand[(Math.random()*cand.length)|0] : prev;
}

/* --------------------- HUD helpers --------------------- */
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
function updateQuestChips(){
  const host = document.getElementById('questChips');
  if (!host) return;
  host.innerHTML = '';
  for (const q of ST.quests){
    const b = document.createElement('div');
    b.className = 'chip questChip';
    b.textContent = q.label;
    if (ST.questDone.has(q.id)) b.classList.add('done');
    host.appendChild(b);
  }
}

/* --------------------- Modifiers CSS inject --------------------- */
function ensureCSS(){
  if (ST.cssInjected) return;
  const css = `
  body.mod-mirror { transform: scaleX(-1); }
  body.mod-blur   { filter: blur(1.5px); }
  body.mod-mono   { filter: grayscale(100%); }
  .questChip{background:#112a; color:#fff; padding:6px 10px; border-radius:999px; font-weight:700; margin:4px}
  .questChip.done{background:#2e7d32}
  ${TUNING.decoyHint ? `.decoy-hint{ outline:3px dashed rgba(255,64,64,.45); border-radius:16px; }` : '' }
  ${TUNING.highContrastPulse ? `
    @keyframes hcPulse{0%{filter:drop-shadow(0 0 0 rgba(255,255,0,0))}50%{filter:drop-shadow(0 0 8px rgba(255,255,0,.75))}100%{filter:drop-shadow(0 0 0 rgba(255,255,0,0))}}
    body.hc .item{ animation: hcPulse 1.8s ease-in-out infinite; }
  `:''}`;
  const st = document.createElement('style');
  st.id = 'grp_mod_css';
  st.textContent = css;
  document.head.appendChild(st);
  ST.cssInjected = true;
}

/* --------------------- Decoys (2) --------------------- */
const LOOKALIKE = {
  fruits:  ['tomato','chili'],                // ผักหน้าตาคล้าย/สับสน
  veggies: ['mushroom','corn','peanuts'],     // โปรตีน/ธัญพืชที่ดูเหมือนผัก
  protein: ['cheese','milk'],                 // นม/ชีส (เข้าโปรตีนก็จริงในบางแนว แต่ใช้เป็นตัวลวง)
  grains:  ['donut','cookie','croissant'],    // ขนมหวานลวง
};
function pickDecoy(targetId){
  const poolIds = LOOKALIKE[targetId] || [];
  const pool = ITEMS.filter(x=>poolIds.includes(x.id));
  if (pool.length===0) return null;
  return pool[(Math.random()*pool.length)|0];
}

/* --------------------- Quests (3) --------------------- */
function makeQuests(){
  const q = [];
  q.push({ id:'Q_TARGET3', label: t('เก็บหมวดเป้าหมาย 3 ชิ้นติด', 'Get 3 target items in a row', ST.lang), type:'chain3', prog:0, need:3 });
  q.push({ id:'Q_VEG2',    label: t('เก็บผัก 2 ชิ้น', 'Collect 2 veggies', ST.lang), type:'group', group:'veggies', prog:0, need:2 });
  q.push({ id:'Q_FAST',    label: t('กดเร็ว 1 ครั้ง (Perfect)', 'Hit 1 Perfect', ST.lang), type:'perfect', prog:0, need:1 });
  return q.slice(0, TUNING.questCount);
}
function questHit(kind, meta){
  for (const q of ST.quests){
    if (ST.questDone.has(q.id)) continue;
    if (q.type==='chain3' && kind==='good' && meta.good){
      q.prog++; if (q.prog>=q.need) ST.questDone.add(q.id);
    }
    if (q.type==='group' && meta.groupId===q.group && kind!=='bad'){
      q.prog++; if (q.prog>=q.need) ST.questDone.add(q.id);
    }
    if (q.type==='perfect' && kind==='perfect'){
      q.prog++; if (q.prog>=q.need) ST.questDone.add(q.id);
    }
  }
  updateQuestChips();
}

/* --------------------- Target switching --------------------- */
function switchTarget(forced=false){
  const ids = GROUPS.map(g=>g.id);
  ST.targetId = pickDifferent(ids, ST.targetId);
  ST.got = 0;
  ST.lastSwitchMs = now();
  ST.targetTimeLeft = TUNING.perTargetSec;
  ST.inTargetStreakNoMiss = true;
  updateTargetBadge();
  return forced;
}

/* --------------------- Public API --------------------- */
export function init(gameState, hud, diff){
  ensureCSS();

  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  const d = (gameState?.difficulty)||'Normal';
  ST.need = TUNING.quotaByDiff[d] ?? 4;

  ST.liveBias = TUNING.targetBias;
  ST.liveTTL  = { ...TUNING.ttlByDiff };
  ST.tutorialUntil = now() + TUNING.tutorialFirstSec*1000;

  ST.badStreak = 0;
  ST.puFreezeUntil = 0;
  ST.puMagnetNext  = false;
  ST.puX2Until     = 0;
  ST.burstUntil    = 0;

  switchTarget(false);
  showTargetHUD(true);

  // Quests
  ST.quests = makeQuests();
  ST.questDone.clear();
  updateQuestChips();

  // Coach intro
  try {
    const g = GROUPS.find(x=>x.id===ST.targetId);
    const msg = t(`เป้าหมาย: ${g.labelTH}`, `Target: ${g.labelEN}`, ST.lang);
    gameState?.coach?.say?.(msg);
  } catch {}
}

export function cleanup(){
  showTargetHUD(false);
  document.body.classList.remove('mod-mirror','mod-blur','mod-mono','hc');
}

/* tick: main.js เรียกทุกวินาที */
export function tick(state, systems){
  const ms = now();

  // (5) Dynamic difficulty จาก accuracy กลิ้งเฉลี่ย
  if (TUNING.dynamicBias && Array.isArray(state?._accHist) && state._accHist.length){
    const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length; // 0..1
    if (acc > TUNING.dynHiAcc){
      ST.liveBias = clamp(ST.liveBias - TUNING.dynBiasStep, TUNING.biasLo, TUNING.biasHi);
      for (const k in ST.liveTTL) ST.liveTTL[k] = Math.max(900, ST.liveTTL[k] - TUNING.dynTTLStep);
    } else if (acc < TUNING.dynLoAcc){
      ST.liveBias = clamp(ST.liveBias + TUNING.dynBiasStep, TUNING.biasLo, TUNING.biasHi);
      for (const k in ST.liveTTL) ST.liveTTL[k] = ST.liveTTL[k] + TUNING.dynTTLStep;
    }
  }

  // (4) Modifiers: เปิดแบบสุ่มนานๆ ที (ผลกระทบภาพ)
  if (Math.random()<0.06){
    const m = Math.random();
    if (m<0.34){ toggleModifier('mod-mirror', 1500); }
    else if (m<0.67){ toggleModifier('mod-blur', 450); }
    else { toggleModifier('mod-mono', 1200); }
  }

  // (1) Target timer + Rush window + autoswitch (หยุดเวลาได้ด้วย Freeze power)
  const frozen = (ms < ST.puFreezeUntil);
  if (!frozen){
    ST.targetTimeLeft = Math.max(0, ST.targetTimeLeft - 1);
  }
  const inRush = ST.targetTimeLeft <= TUNING.rushLastSec;

  if (ST.got < ST.need){
    const waited = (ms - ST.lastSwitchMs) / 1000;
    if (waited >= TUNING.autoswitchSec){
      switchTarget(true);
      systems?.coach?.say?.(t('เปลี่ยนหมวด!', 'New target!', ST.lang));
      try { systems?.sfx?.play?.('powerup'); } catch {}
    }
  }

  // (7) Simulate burst window
  if (ST.burstUntil < ms && Math.random() < TUNING.burstChance){
    ST.burstUntil = ms + TUNING.burstDurSec*1000;
  }

  // (8) Onboarding hint: ถ้าพลาดซ้ำในช่วงต้น โค้ชใบ้
  if (ms < ST.tutorialUntil && ST.badStreak >= 2){
    systems?.coach?.say?.(t('ผลไม้คือ 🍎🍌🍓 … ลองเล็งให้ตรงหมวดนะ', 'Fruits are 🍎🍌🍓 … pick the right group!', ST.lang));
    ST.badStreak = 0; // เคลียร์หลังให้คำใบ้
  }

  // Accessibility pulse
  if (TUNING.highContrastPulse && Math.random()<0.03){
    document.body.classList.toggle('hc', true);
    setTimeout(()=>document.body.classList.remove('hc'), 2000);
  }

  // อัปเดต HUD target label ทุกวินาที (เวลานับถอยหลัง)
  const badge = document.getElementById('targetBadge');
  if (badge){
    const g = GROUPS.find(x=>x.id===ST.targetId);
    const sec = ST.targetTimeLeft;
    badge.textContent = t(g.labelTH, g.labelEN, ST.lang) + `  (${ST.got}/${ST.need}) — ${sec}s`;
  }
}

/* meta ต่อการเกิดหนึ่งชิ้น */
export function pickMeta(diff, gameState){
  const d = (gameState?.difficulty)||'Normal';
  let ttl = ST.liveTTL[d] ?? (diff?.life || 3000);
  let bias = ST.liveBias;

  const ms = now();
  const inTutorial = (ms < ST.tutorialUntil);
  const inRush     = (ST.targetTimeLeft <= TUNING.rushLastSec);
  const inBurst    = (ms < ST.burstUntil);

  if (inTutorial){ bias = clamp(bias + 0.25, 0, 1); ttl = Math.max(ttl, 3400); }
  if (inRush){     bias = clamp(bias + TUNING.rushBiasBoost, 0, 1); ttl = Math.round(ttl*TUNING.rushTTLScale); }
  if (inBurst){    bias = clamp(bias + TUNING.burstBiasBoost, 0, 1); ttl = Math.round(ttl*TUNING.burstTTLScale); }

  let pick;
  const r = Math.random();
  if (r < bias){
    pick = pickFrom(ITEMS, it=>it.group===ST.targetId);
  }else{
    // (2) Decoy chance
    if (Math.random() < TUNING.decoyRate){
      pick = pickDecoy(ST.targetId) || pickFrom(ITEMS, it=>it.group!==ST.targetId);
      if (pick) pick.__decoy = true;
    }else{
      pick = pickFrom(ITEMS, it=>it.group!==ST.targetId);
    }
  }
  if (!pick) pick = ITEMS[(Math.random()*ITEMS.length)|0];

  // เก็บเวลาเกิด เพื่อคำนวน perfect
  const bornAt = now();

  return {
    id: pick.id,
    char: pick.icon,
    good: (pick.group===ST.targetId),
    life: ttl,
    bornAt,
    groupId: pick.group,
    decoy: !!pick.__decoy,
  };
}

function pickFrom(arr, pred){
  const pool = arr.filter(pred);
  if (!pool.length) return null;
  return pool[(Math.random()*pool.length)|0];
}

/* เมื่อถูกคลิก */
export function onHit(meta, systems, gameState){
  const ms = now();
  const fast = (typeof meta.bornAt==='number') ? ((ms - meta.bornAt) <= TUNING.perfectWindowMs) : false;

  // เควส: ตรวจก่อน (ใช้ชนิดคลิก)
  let result;

  if (meta.good){
    // (6) Power: X2 target window?
    const x2Now = (ms < ST.puX2Until);

    // Perfect?
    if (fast){
      // ส่งผล 'perfect' ให้ main.js คำนวณคอมโบ/fever เอง
      result = 'perfect';
      if (x2Now) { systems?.score?.add?.(8); } // โบนัสเล็กน้อยเพิ่มเติม
      systems?.coach?.say?.(t('ไวมาก!','Perfect!',ST.lang));
    } else {
      result = 'good';
      if (x2Now) { systems?.score?.add?.(6); }
      systems?.coach?.say?.(t('ใช่เลย!','Nice!',ST.lang));
    }

    ST.got++;
    ST.badStreak = 0;
    questHit(result, meta);

    // Magnet next (จำลอง: ให้โบนัสเล็กน้อยรอบนี้แล้วปิดธง)
    if (ST.puMagnetNext){
      systems?.score?.add?.(5);
      ST.puMagnetNext = false;
    }

    // ครบโควตา → จบหมวด
    if (ST.got >= ST.need){
      // (9) Streak bonus: หากหมวดนี้ไม่พลาดเลย
      if (ST.inTargetStreakNoMiss){
        systems?.score?.add?.(TUNING.streakBonus);
        systems?.coach?.say?.(t('ยอดเยี่ยม! สายไม่พลาด','Flawless!',ST.lang));
      }
      // เคลียร์เควสเสร็จ → เพิ่ม Fever time
      if (ST.questDone.size){
        if (gameState?.fever?.active){
          gameState.fever.timeLeft = Math.min(12, (gameState.fever.timeLeft||0) + TUNING.questFeverPlus);
        } else {
          gameState.fever.meter = Math.min(100, (gameState.fever.meter||0) + 20);
        }
        // ให้คะแนนเควส
        systems?.score?.add?.(TUNING.questBonus * ST.questDone.size);
        ST.questDone.clear();
        updateQuestChips();
      }

      // สลับหมวดใหม่
      switchTarget(true);
      try { systems?.sfx?.play?.('powerup'); } catch {}
      systems?.coach?.say?.(t('เปลี่ยนหมวด!','New target!',ST.lang));
    }
  } else {
    // พลาด
    result = 'bad';
    ST.badStreak++;
    ST.inTargetStreakNoMiss = false;
    systems?.coach?.say?.(meta.decoy ? t('ลวงตานะ!','That was a decoy!',ST.lang)
                                     : t('ยังไม่ใช่หมวดนี้','Not this group!',ST.lang));
    // (9) Bad tax
    if (ST.badStreak>=TUNING.badTaxN){
      gameState.timeLeft = Math.max(0, (gameState.timeLeft||0) - TUNING.badTaxTimePenalty);
      ST.badStreak = 0;
    }
  }

  return result; // main.js จะดูแลคะแนนหลัก/คอมโบ/FEVER
}

/* --------------------- Modifiers helpers (4) --------------------- */
function toggleModifier(cls, ms){
  document.body.classList.add(cls);
  setTimeout(()=>document.body.classList.remove(cls), ms|0);
}

/* --------------------- Optional: expose “powerups” triggers ---------------------
   คุณสามารถเรียกฟังก์ชันนี้จากปุ่ม/เหตุการณ์อื่นๆ ได้ในอนาคต
   เช่น กดจาก powerbar ให้เฉพาะโหมดนี้
------------------------------------------------------------------------------- */
export const powers = {
  freezeTarget(){ ST.puFreezeUntil = now() + TUNING.powerFreezeTarget*1000; },
  magnetNext(){ ST.puMagnetNext = true; },
  x2Target(){ ST.puX2Until = now() + TUNING.powerX2TargetSec*1000; },
};
