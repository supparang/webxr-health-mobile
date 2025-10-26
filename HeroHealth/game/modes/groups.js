// === Hero Health Academy — game/modes/groups.js (Upgrades 1–12 + powers API, CSS moved to game.css) ===
export const name = 'groups';

const TUNING = {
  quotaByDiff: { Easy:3, Normal:4, Hard:5 },
  ttlByDiff:   { Easy:4200, Normal:3000, Hard:2200 },
  targetBias: 0.60,
  perTargetSec: 15,
  rushLastSec: 5, rushBiasBoost: 0.35, rushTTLScale: 0.85,
  autoswitchSec: 18,
  decoyRate: 0.18,
  questCount: 3, questBonus: 25, questFeverPlus: 2,
  dynamicBias: true, biasLo: 0.50, biasHi: 0.80, dynHiAcc: 0.90, dynLoAcc: 0.60, dynBiasStep: 0.02, dynTTLStep: 60,
  powerFreezeTarget: 3, powerMagnetNext: true, powerX2TargetSec: 8,
  burstChance: 0.22, burstDurSec: 3, burstBiasBoost: 0.30, burstTTLScale: 0.80,
  tutorialFirstSec: 20,
  perfectWindowMs: 280, streakBonus: 35, badTaxN: 3, badTaxTimePenalty: 3,
  highContrastPulse: true
};

const GROUPS = [
  { id:'fruits',  labelTH:'ผลไม้',     labelEN:'Fruits',     color:'#ef4444' },
  { id:'veggies', labelTH:'ผัก',        labelEN:'Vegetables', color:'#22c55e' },
  { id:'protein', labelTH:'โปรตีน',     labelEN:'Protein',    color:'#3b82f6' },
  { id:'grains',  labelTH:'ธัญพืช',     labelEN:'Grains',     color:'#f59e0b' },
];

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
  { id:'peach', group:'fruits', labelEN:'Peach', labelTH:'พีช', icon:'🍑' },
  { id:'lemon', group:'fruits', labelEN:'Lemon', labelTH:'มะนาว', icon:'🍋' },
  { id:'kiwi', group:'fruits', labelEN:'Kiwi', labelTH:'กีวี', icon:'🥝' },
  // Veggies
  { id:'carrot', group:'veggies', labelEN:'Carrot', labelTH:'แครอท', icon:'🥕' },
  { id:'broccoli', group:'veggies', labelEN:'Broccoli', labelTH:'บรอกโคลี', icon:'🥦' },
  { id:'cucumber', group:'veggies', labelEN:'Cucumber', labelTH:'แตงกวา', icon:'🥒' },
  { id:'tomato', group:'veggies', labelEN:'Tomato', labelTH:'มะเขือเทศ', icon:'🍅' },
  { id:'corn', group:'veggies', labelEN:'Corn', labelTH:'ข้าวโพด', icon:'🌽' },
  { id:'lettuce', group:'veggies', labelEN:'Lettuce', labelTH:'ผักใบ', icon:'🥬' },
  { id:'mushroom', group:'veggies', labelEN:'Mushroom', labelTH:'เห็ด', icon:'🍄' },
  { id:'salad', group:'veggies', labelEN:'Salad', labelTH:'สลัดผัก', icon:'🥗' },
  { id:'chili', group:'veggies', labelEN:'Chili', labelTH:'พริก', icon:'🌶️' },
  { id:'onion', group:'veggies', labelEN:'Onion', labelTH:'หัวหอม', icon:'🧅' },
  { id:'garlic', group:'veggies', labelEN:'Garlic', labelTH:'กระเทียม', icon:'🧄' },
  { id:'potato', group:'veggies', labelEN:'Potato', labelTH:'มันฝรั่ง', icon:'🥔' },
  // Protein
  { id:'egg', group:'protein', labelEN:'Egg', labelTH:'ไข่', icon:'🥚' },
  { id:'fish', group:'protein', labelEN:'Fish', labelTH:'ปลา', icon:'🐟' },
  { id:'tofu', group:'protein', labelEN:'Tofu', labelTH:'เต้าหู้', icon:'🍢' },
  { id:'chicken', group:'protein', labelEN:'Chicken', labelTH:'ไก่', icon:'🍗' },
  { id:'beef', group:'protein', labelEN:'Beef', labelTH:'เนื้อวัว', icon:'🥩' },
  { id:'shrimp', group:'protein', labelEN:'Shrimp', labelTH:'กุ้ง', icon:'🦐' },
  { id:'crab', group:'protein', labelEN:'Crab', labelTH:'ปู', icon:'🦀' },
  { id:'squid', group:'protein', labelEN:'Squid', labelTH:'หมึก', icon:'🦑' },
  { id:'peanuts', group:'protein', labelEN:'Peanuts', labelTH:'ถั่วลิสง', icon:'🥜' },
  { id:'soybeans', group:'protein', labelEN:'Soybeans', labelTH:'ถั่วเมล็ดแห้ง', icon:'🫘' },
  { id:'milk', group:'protein', labelEN:'Milk', labelTH:'นม', icon:'🥛' },
  { id:'cheese', group:'protein', labelEN:'Cheese', labelTH:'ชีส', icon:'🧀' },
  { id:'ham', group:'protein', labelEN:'Ham', labelTH:'แฮม/เบคอน', icon:'🥓' },
  { id:'sausage', group:'protein', labelEN:'Sausage', labelTH:'ไส้กรอก', icon:'🌭' },
  // Grains
  { id:'rice', group:'grains', labelEN:'Rice', labelTH:'ข้าวสวย', icon:'🍚' },
  { id:'bread', group:'grains', labelEN:'Bread', labelTH:'ขนมปัง', icon:'🍞' },
  { id:'noodles', group:'grains', labelEN:'Noodles', labelTH:'ก๋วยเตี๋ยว', icon:'🍜' },
  { id:'spaghetti', group:'grains', labelEN:'Spaghetti', labelTH:'สปาเกตตี', icon:'🍝' },
  { id:'croissant', group:'grains', labelEN:'Croissant', labelTH:'ครัวซองต์', icon:'🥐' },
  { id:'pancake', group:'grains', labelEN:'Pancake', labelTH:'แพนเค้ก', icon:'🥞' },
  { id:'burrito', group:'grains', labelEN:'Burrito', labelTH:'เบอร์ริโต', icon:'🌯' },
  { id:'sandwich', group:'grains', labelEN:'Sandwich', labelTH:'แซนด์วิช', icon:'🥪' },
  { id:'taco', group:'grains', labelEN:'Taco', labelTH:'ทาโก้', icon:'🌮' },
  { id:'pie', group:'grains', labelEN:'Pie', labelTH:'พาย', icon:'🥧' },
  { id:'cookie', group:'grains', labelEN:'Cookie', labelTH:'คุกกี้', icon:'🍪' },
  { id:'donut', group:'grains', labelEN:'Donut', labelTH:'โดนัท', icon:'🍩' },
];

const t = (th, en, lang)=> (lang==='EN' ? en : th);
const now = ()=> (performance?.now?.() || Date.now());
const clamp = (x,a,b)=> Math.max(a, Math.min(b, x));
function pickDifferent(list, prev){ if (!prev) return list[(Math.random()*list.length)|0]; const cand = list.filter(x=>x!==prev); return cand.length? cand[(Math.random()*cand.length)|0] : prev; }

const ST = {
  lang:'TH', targetId:'fruits', need:4, got:0, lastSwitchMs:0,
  targetTimeLeft: TUNING.perTargetSec,
  quests:[], questDone:new Set(),
  liveBias: TUNING.targetBias, liveTTL: { ...TUNING.ttlByDiff },
  puFreezeUntil:0, puMagnetNext:false, puX2Until:0,
  burstUntil:0, tutorialUntil:0,
  inTargetStreakNoMiss:true, badStreak:0
};

const LOOKALIKE = {
  fruits:['tomato','chili'],
  veggies:['mushroom','corn','peanuts'],
  protein:['cheese','milk'],
  grains:['donut','cookie','croissant'],
};
function pickDecoy(targetId){
  const poolIds = LOOKALIKE[targetId] || [];
  const pool = ITEMS.filter(x=>poolIds.includes(x.id));
  if (!pool.length) return null;
  return pool[(Math.random()*pool.length)|0];
}

function showTargetHUD(show){ const wrap = document.getElementById('targetWrap'); if (wrap) wrap.style.display = show?'block':'none'; }
function updateTargetBadge(){
  const g = GROUPS.find(x=>x.id===ST.targetId);
  const badge = document.getElementById('targetBadge');
  if (badge){ badge.textContent = t(g.labelTH, g.labelEN, ST.lang) + `  (${ST.got}/${ST.need})`; badge.style.fontWeight = '800'; }
  const tLabel = document.getElementById('t_target'); if (tLabel) tLabel.textContent = t('หมวด', 'Target', ST.lang);
}
function updateQuestChips(){
  const host = document.getElementById('questChips'); if (!host) return;
  host.innerHTML = '';
  for (const q of ST.quests){
    const b = document.createElement('div'); b.className='chip questChip'; b.textContent=q.label;
    if (ST.questDone.has(q.id)) b.classList.add('done');
    host.appendChild(b);
  }
}
function makeQuests(){
  const q=[]; const L=ST.lang;
  q.push({ id:'Q_TARGET3', label: t('เก็บหมวดเป้าหมาย 3 ชิ้นติด','Get 3 target items in a row',L), type:'chain3', prog:0, need:3 });
  q.push({ id:'Q_VEG2',    label: t('เก็บผัก 2 ชิ้น','Collect 2 veggies',L), type:'group', group:'veggies', prog:0, need:2 });
  q.push({ id:'Q_FAST',    label: t('กดเร็ว 1 ครั้ง (Perfect)','Hit 1 Perfect',L), type:'perfect', prog:0, need:1 });
  return q.slice(0, TUNING.questCount);
}

function switchTarget(forced=false){
  const ids = GROUPS.map(g=>g.id);
  ST.targetId = pickDifferent(ids, ST.targetId);
  ST.got = 0; ST.lastSwitchMs = now(); ST.targetTimeLeft = TUNING.perTargetSec; ST.inTargetStreakNoMiss = true;
  updateTargetBadge();
  return forced;
}

/* ---------- Public API ---------- */
export function init(gameState, hud, diff){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  const d = (gameState?.difficulty)||'Normal';
  ST.need = TUNING.quotaByDiff[d] ?? 4;

  ST.liveBias = TUNING.targetBias;
  ST.liveTTL  = { ...TUNING.ttlByDiff };
  ST.tutorialUntil = now() + TUNING.tutorialFirstSec*1000;

  ST.badStreak=0; ST.puFreezeUntil=0; ST.puMagnetNext=false; ST.puX2Until=0; ST.burstUntil=0;

  switchTarget(false); showTargetHUD(true);

  ST.quests = makeQuests(); ST.questDone.clear(); updateQuestChips();

  try{
    const g = GROUPS.find(x=>x.id===ST.targetId);
    gameState?.coach?.say?.(t(`เป้าหมาย: ${g.labelTH}`, `Target: ${g.labelEN}`, ST.lang));
  }catch{}
}
export function cleanup(){ showTargetHUD(false); document.body.classList.remove('mod-mirror','mod-blur','mod-mono','hc'); }

export function tick(state, systems){
  const ms = now();

  // Dynamic difficulty
  if (TUNING.dynamicBias && Array.isArray(state?._accHist) && state._accHist.length){
    const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
    if (acc > TUNING.dynHiAcc){
      ST.liveBias = clamp(ST.liveBias - TUNING.dynBiasStep, TUNING.biasLo, TUNING.biasHi);
      for (const k in ST.liveTTL) ST.liveTTL[k] = Math.max(900, ST.liveTTL[k] - TUNING.dynTTLStep);
    } else if (acc < TUNING.dynLoAcc){
      ST.liveBias = clamp(ST.liveBias + TUNING.dynBiasStep, TUNING.biasLo, TUNING.biasHi);
      for (const k in ST.liveTTL) ST.liveTTL[k] = ST.liveTTL[k] + TUNING.dynTTLStep;
    }
  }

  // Random short modifiers
  if (Math.random()<0.06){
    const m = Math.random();
    if (m<0.34){ toggleModifier('mod-mirror', 1500); }
    else if (m<0.67){ toggleModifier('mod-blur', 450); }
    else { toggleModifier('mod-mono', 1200); }
  }

  // Target timer + autoswitch (freezable)
  const frozen = (ms < ST.puFreezeUntil);
  if (!frozen){ ST.targetTimeLeft = Math.max(0, ST.targetTimeLeft - 1); }
  const inRush = ST.targetTimeLeft <= TUNING.rushLastSec;

  if (ST.got < ST.need){
    const waited = (ms - ST.lastSwitchMs) / 1000;
    if (waited >= TUNING.autoswitchSec){
      switchTarget(true); systems?.coach?.say?.(t('เปลี่ยนหมวด!','New target!',ST.lang));
      try{ systems?.sfx?.play?.('powerup'); }catch{}
    }
  }

  // Burst window
  if (ST.burstUntil < ms && Math.random() < TUNING.burstChance) ST.burstUntil = ms + TUNING.burstDurSec*1000;

  // Tutorial hint
  if (ms < ST.tutorialUntil && ST.badStreak >= 2){
    systems?.coach?.say?.(t('ผลไม้คือ 🍎🍌🍓 … เล็งให้ตรงหมวดนะ','Fruits are 🍎🍌🍓 … pick the right group!',ST.lang));
    ST.badStreak = 0;
  }

  // Accessibility pulse
  if (TUNING.highContrastPulse && Math.random()<0.03){ document.body.classList.toggle('hc', true); setTimeout(()=>document.body.classList.remove('hc'), 2000); }

  // Update HUD with countdown
  const badge = document.getElementById('targetBadge');
  if (badge){ const g = GROUPS.find(x=>x.id===ST.targetId); badge.textContent = t(g.labelTH, g.labelEN, ST.lang) + `  (${ST.got}/${ST.need}) — ${ST.targetTimeLeft}s`; }
}

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
  if (Math.random() < bias){
    pick = pickFrom(ITEMS, it=>it.group===ST.targetId);
  }else{
    if (Math.random() < TUNING.decoyRate){
      pick = pickDecoy(ST.targetId) || pickFrom(ITEMS, it=>it.group!==ST.targetId);
      if (pick) pick.__decoy = true;
    } else {
      pick = pickFrom(ITEMS, it=>it.group!==ST.targetId);
    }
  }
  if (!pick) pick = ITEMS[(Math.random()*ITEMS.length)|0];

  const bornAt = now();
  return { id:pick.id, char:pick.icon, good:(pick.group===ST.targetId), life:ttl, bornAt, groupId:pick.group, decoy:!!pick.__decoy };
}
function pickFrom(arr, pred){ const pool = arr.filter(pred); if (!pool.length) return null; return pool[(Math.random()*pool.length)|0]; }

export function onHit(meta, systems, gameState){
  const ms = now();
  const fast = (typeof meta.bornAt==='number') ? ((ms - meta.bornAt) <= TUNING.perfectWindowMs) : false;

  let result;
  if (meta.good){
    const x2Now = (ms < ST.puX2Until);
    if (fast){ result = 'perfect'; if (x2Now) systems?.score?.add?.(8); systems?.coach?.say?.(t('ไวมาก!','Perfect!',ST.lang)); }
    else { result = 'good'; if (x2Now) systems?.score?.add?.(6); systems?.coach?.say?.(t('ใช่เลย!','Nice!',ST.lang)); }

    ST.got++; ST.badStreak = 0;
    questHit(result, meta);

    if (ST.puMagnetNext){ systems?.score?.add?.(5); ST.puMagnetNext = false; }

    if (ST.got >= ST.need){
      if (ST.inTargetStreakNoMiss){ systems?.score?.add?.(TUNING.streakBonus); systems?.coach?.say?.(t('ยอดเยี่ยม! สายไม่พลาด','Flawless!',ST.lang)); }
      if (ST.questDone.size){
        if (gameState?.fever?.active){ gameState.fever.timeLeft = Math.min(12, (gameState.fever.timeLeft||0) + TUNING.questFeverPlus); }
        else { gameState.fever.meter = Math.min(100, (gameState.fever.meter||0) + 20); }
        systems?.score?.add?.(TUNING.questBonus * ST.questDone.size);
        ST.questDone.clear(); updateQuestChips();
      }
      switchTarget(true);
      try{ systems?.sfx?.play?.('powerup'); }catch{}
      systems?.coach?.say?.(t('เปลี่ยนหมวด!','New target!',ST.lang));
    }
  } else {
    result = 'bad'; ST.badStreak++; ST.inTargetStreakNoMiss = false;
    systems?.coach?.say?.(meta.decoy ? t('ลวงตานะ!','That was a decoy!',ST.lang) : t('ยังไม่ใช่หมวดนี้','Not this group!',ST.lang));
    if (ST.badStreak>=TUNING.badTaxN){ gameState.timeLeft = Math.max(0, (gameState.timeLeft||0) - TUNING.badTaxTimePenalty); ST.badStreak = 0; }
  }
  return result;
}

// Quests progress
function questHit(kind, meta){
  for (const q of ST.quests){
    if (ST.questDone.has(q.id)) continue;
    if (q.type==='chain3' && kind!=='bad' && meta.good){ q.prog++; if (q.prog>=q.need) ST.questDone.add(q.id); }
    if (q.type==='group' && kind!=='bad' && meta.groupId===q.group){ q.prog++; if (q.prog>=q.need) ST.questDone.add(q.id); }
    if (q.type==='perfect' && kind==='perfect'){ q.prog++; if (q.prog>=q.need) ST.questDone.add(q.id); }
  }
  updateQuestChips();
}

// Visual modifiers
function toggleModifier(cls, ms){ document.body.classList.add(cls); setTimeout(()=>document.body.classList.remove(cls), ms|0); }

// Powers API (เรียกจาก main.js ผ่านปุ่ม powerbar)
export const powers = {
  freezeTarget(){ ST.puFreezeUntil = now() + TUNING.powerFreezeTarget*1000; },
  magnetNext(){ ST.puMagnetNext = true; },
  x2Target(){ ST.puX2Until = now() + TUNING.powerX2TargetSec*1000; },
};
