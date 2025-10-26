// === Hero Health Academy — game/modes/groups.js
// โหมด: จาน 5 หมู่ (Food Group Frenzy)
// อัปเดต: เป้าหมายสามารถมี 1/2/3 หมวดแบบสุ่มต่อรอบ + Mini Quest ทั้งหมด 5 แบบ สุ่มมาเล่น 3 อย่าง

export const name = 'groups';

/* --------------------- TUNING --------------------- */
const TUNING = {
  quotaByDiff: { Easy:3, Normal:4, Hard:5 },             // ต้องเก็บให้ครบต่อ "รอบ"
  ttlByDiff:   { Easy:4200, Normal:3000, Hard:2200 },     // TTL ไอคอนพื้นฐาน (ms)
  targetBias: 0.60,                                       // โอกาสสุ่ม “หมวดเป้าหมาย”
  perTargetSec: 15,                                       // เวลาต่อรอบ
  rushLastSec: 5,                                         // เร่งท้ายรอบ
  rushBiasBoost: 0.35,
  rushTTLScale: 0.85,
  autoswitchSec: 18,

  decoyRate: 0.18,

  // Mini Quests — มีทั้งหมด 5 แบบ (กำหนดด้านล่าง) แล้วสุ่มมา 3 ต่อเกม
  questShowCount: 3,
  questTime: { Easy:22, Normal:18, Hard:14 },
  questRewardScore: { small:40, mid:80, big:140 },
  questRewardFever: { small:10, mid:18, big:28 },
  questRewardTime:  { small:2,  mid:3,  big:4  },
  questRerollCooldown: 10,

  // Powers
  powerFreezeTarget: 3,        // s
  powerX2TargetSec: 8,         // s
  powerMagnetBonus: 5,         // points (one-time)

  // Perfect / Streak / Bad tax
  perfectWindowMs: 280,
  streakBonus: 35,
  badTaxN: 3, badTaxTimePenalty: 3,

  // Golden target
  goldRateBase: 0.08,
  goldRateRushBoost: 0.07,
  goldBonusScore: 18,
  goldBonusFever: 18,
};

/* --------------------- Groups & Items --------------------- */
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

/* --------------------- State --------------------- */
const ST = {
  lang: 'TH',
  targets: ['fruits'],          // เป้าหมายหลายหมวดพร้อมกัน (1–3 หมวด)
  need: 4,                      // ต้องเก็บครบกี่ชิ้น (รวมทุกหมวดเป้าหมาย)
  got: 0,
  lastSwitchMs: 0,
  targetTimeLeft: TUNING.perTargetSec,
  _inRush: false,

  liveBias: TUNING.targetBias,
  liveTTL: { ...TUNING.ttlByDiff },

  // powers
  puFreezeUntil: 0,
  puX2Until: 0,
  puMagnetNext: false,

  // quests (เลือกจาก pool 5 แบบ มาแสดง 3)
  quests: [],
  questRerollAt: 0,
  _boundPowerHandlers: [],

  // streak/tax
  inTargetStreakNoMiss: true,
  badStreak: 0,

  // other
  tutorialUntil: 0,
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
function sample(arr){ return arr[(Math.random()*arr.length)|0]; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]];} return a; }

/* --------------------- HUD --------------------- */
function showTargetHUD(show){
  const wrap = document.getElementById('targetWrap');
  if (wrap) wrap.style.display = show ? 'block' : 'none';
}
function labelOf(gid){
  const g = GROUPS.find(x=>x.id===gid);
  return g ? (ST.lang==='EN'?g.labelEN:g.labelTH) : gid;
}
function updateTargetBadge(extra=''){
  const badge = document.getElementById('targetBadge');
  if (badge){
    const names = ST.targets.map(labelOf).join(' + ');
    const base = `${names}  (${ST.got}/${ST.need})`;
    badge.textContent = extra ? `${base} — ${extra}` : base;
    badge.style.fontWeight = '800';
  }
  const tLabel = document.getElementById('t_target');
  if (tLabel) tLabel.textContent = t('หมวด', 'Target', ST.lang);
}
function renderQuestChips(){
  const host = document.getElementById('questChips');
  if (!host) return;
  host.innerHTML = '';
  for (const q of ST.quests){
    const chip = document.createElement('div');
    chip.className = 'chip questChip';
    chip.dataset.qid = q.id;

    const title = document.createElement('div');
    title.className = 'qTitle';
    title.textContent = q.label;
    chip.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'qMeta';
    meta.textContent = `${q.typeDisplay} • +${q.rewardScore}pts`;
    chip.appendChild(meta);

    const bar = document.createElement('div');
    bar.className = 'qBar';
    const fill = document.createElement('i'); fill.style.width='0%';
    bar.appendChild(fill); chip.appendChild(bar);

    host.appendChild(chip);
  }
}
function updateQuestUI(){
  const host = document.getElementById('questChips'); if (!host) return;
  for (const q of ST.quests){
    const chip = host.querySelector(`.questChip[data-qid="${q.id}"]`); if (!chip) continue;
    const fill = chip.querySelector('.qBar i');
    if (fill){
      const pct = q.need>0 ? clamp(q.prog/q.need,0,1)*100 : 0;
      fill.style.width = pct.toFixed(0)+'%';
    }
    chip.classList.toggle('done', q.state==='done');
    chip.classList.toggle('fail', q.state==='fail');
    const meta = chip.querySelector('.qMeta');
    if (meta){
      const timeStr = q.timeLeft>0 ? `${q.timeLeft|0}s` : (q.state==='done'?'✓':'—');
      meta.textContent = `${q.typeDisplay} • ${timeStr} • +${q.rewardScore}pts`;
    }
  }
}

/* --------------------- Powers HUD binding --------------------- */
function bindPowerBar(){
  const wrap = document.getElementById('powerBar');
  if (!wrap) return;
  const seg = (k)=>wrap.querySelector(`.pseg[data-k="${k}"]`);
  const handlers = [];

  function bind(k, fn){
    const el = seg(k); if (!el) return;
    const h = (e)=>{ e.stopPropagation(); fn(); el.classList.add('used'); setTimeout(()=>el.classList.remove('used'), 600); };
    el.addEventListener('click', h, {passive:true});
    handlers.push({el,h});
  }
  bind('freeze', ()=>{ ST.puFreezeUntil = now() + TUNING.powerFreezeTarget*1000; });
  bind('x2',     ()=>{ ST.puX2Until     = now() + TUNING.powerX2TargetSec*1000; });
  bind('sweep',  ()=>{ ST.puMagnetNext  = true; });

  ST._boundPowerHandlers = handlers;
}
function unbindPowerBar(){
  for (const {el,h} of ST._boundPowerHandlers){ try{ el.removeEventListener('click', h); }catch{} }
  ST._boundPowerHandlers = [];
}

/* --------------------- Decoy --------------------- */
const LOOKALIKE = {
  fruits:  ['tomato','chili'],
  veggies: ['mushroom','corn','peanuts'],
  protein: ['cheese','milk'],
  grains:  ['donut','cookie','croissant'],
};
function pickDecoy(targetIds){
  const ids = targetIds.flatMap(tg=> LOOKALIKE[tg] || []);
  const pool = ITEMS.filter(x=>ids.includes(x.id));
  return pool.length ? sample(pool) : null;
}

/* --------------------- Mini Quest System (POOL = 5 แบบ) --------------------- */
function uid(prefix){ return prefix+'_'+Math.random().toString(36).slice(2,8); }
function makeQuestPool(diff, lang){
  const time = TUNING.questTime[diff] ?? 18;
  return [
    // 1) เก็บหมวดเป้าหมายติดกัน 3 ชิ้น (รวมหลายหมวดก็ได้ แต่ต้องเป็น "ใน targets")
    {
      id: uid('Q_CHAIN'),
      type:'chain_target_n',
      typeDisplay: t('ติดกัน','Chain',lang),
      label: t('เก็บเป้าหมายติดกัน 3 ชิ้น','Get 3 target items in a row',lang),
      need:3, prog:0, timeLeft:time, state:'active',
      rewardScore:TUNING.questRewardScore.mid, rewardFever:TUNING.questRewardFever.mid, rewardTime:TUNING.questRewardTime.mid,
    },
    // 2) Perfect 2 ครั้ง
    {
      id: uid('Q_PERFECT'),
      type:'perfect_n',
      typeDisplay: t('เพอร์เฟกต์','Perfect',lang),
      label: t('ทำ Perfect 2 ครั้ง','Hit 2 Perfect',lang),
      need:2, prog:0, timeLeft:time, state:'active',
      rewardScore:TUNING.questRewardScore.mid, rewardFever:TUNING.questRewardFever.small, rewardTime:TUNING.questRewardTime.small,
    },
    // 3) เก็บ “ผัก” 2 ชิ้น
    {
      id: uid('Q_GROUP_VEG'),
      type:'group_collect_n',
      group:'veggies',
      typeDisplay: t('หมวด','Group',lang),
      label: t('เก็บ “ผัก” 2 ชิ้น','Collect 2 veggies',lang),
      need:2, prog:0, timeLeft:time, state:'active',
      rewardScore:TUNING.questRewardScore.small, rewardFever:TUNING.questRewardFever.small, rewardTime:TUNING.questRewardTime.small,
    },
    // 4) เก็บไอคอนทอง 1 ชิ้น
    {
      id: uid('Q_GOLD'),
      type:'golden_n',
      typeDisplay: t('ทอง','Golden',lang),
      label: t('เก็บไอคอนทอง 1 ชิ้น','Hit 1 golden target',lang),
      need:1, prog:0, timeLeft:time, state:'active',
      rewardScore:TUNING.questRewardScore.big, rewardFever:TUNING.questRewardFever.big, rewardTime:TUNING.questRewardTime.mid,
    },
    // 5) ไม่พลาดติดต่อกัน 6 วินาที
    {
      id: uid('Q_NOMISS'),
      type:'no_miss_for_s',
      typeDisplay: t('ไม่พลาด','No Miss',lang),
      label: t('ไม่พลาดติดต่อกัน 6 วินาที','No miss for 6s',lang),
      need:6, prog:0, timeLeft:time, state:'active',
      rewardScore:TUNING.questRewardScore.mid, rewardFever:TUNING.questRewardFever.small, rewardTime:TUNING.questRewardTime.mid,
    },
  ];
}

function rollQuests(diff, lang){
  // ใช้ pool 5 แบบ แล้วสุ่มมา 3 อย่างเสมอ
  const pool = makeQuestPool(diff, lang);
  return shuffle(pool).slice(0, TUNING.questShowCount);
}

function applyQuestTick(quests, dt, onDone){
  for (const q of quests){
    if (q.state!=='active') continue;
    q.timeLeft = Math.max(0, q.timeLeft - dt);
    if (q.type==='no_miss_for_s' && _noMissTick){
      q.prog = clamp(q.prog + 1, 0, q.need);
    }
    if (q.prog>=q.need){ q.state='done'; onDone?.(q); }
    else if (q.timeLeft<=0){ q.state='fail'; }
  }
}
function applyQuestHit(quests, kind, meta, onDone){
  for (const q of quests){
    if (q.state!=='active') continue;
    switch(q.type){
      case 'chain_target_n':
        if (kind==='bad' || !meta.good) q.prog = 0; else q.prog = clamp(q.prog+1, 0, q.need);
        break;
      case 'perfect_n':
        if (kind==='perfect') q.prog = clamp(q.prog+1, 0, q.need);
        break;
      case 'group_collect_n':
        if (kind!=='bad' && meta.groupId===q.group) q.prog = clamp(q.prog+1, 0, q.need);
        break;
      case 'golden_n':
        if (kind!=='bad' && meta.golden) q.prog = clamp(q.prog+1, 0, q.need);
        break;
      case 'no_miss_for_s':
        if (kind==='bad') q.prog = 0;
        break;
    }
    if (q.prog>=q.need){ q.state='done'; onDone?.(q); }
  }
}
function grantQuestReward(q, systems, gameState){
  systems?.score?.add?.(q.rewardScore|0);
  if (gameState?.fever){
    gameState.fever.meter = Math.min(100, (gameState.fever.meter||0) + (q.rewardFever|0));
  }
  if (typeof gameState.timeLeft === 'number'){
    gameState.timeLeft = Math.max(0, gameState.timeLeft + (q.rewardTime|0));
  }
  systems?.coach?.say?.(
    t(`เควสสำเร็จ! +${q.rewardScore} แต้ม`, `Quest complete! +${q.rewardScore}pts`, ST.lang)
  );
}

/* --------------------- Target switching (1–3 groups) --------------------- */
function switchTarget(){
  // สุ่มจำนวนเป้าหมาย 1/2/3 หมวด
  const k = 1 + ((Math.random()*3)|0); // 1..3
  const all = GROUPS.map(g=>g.id);
  ST.targets = shuffle(all.slice()).slice(0, k);
  ST.got = 0;
  ST.lastSwitchMs = now();
  ST.targetTimeLeft = TUNING.perTargetSec;
  ST.inTargetStreakNoMiss = true;
  updateTargetBadge();
}

/* --------------------- Public API --------------------- */
export function init(gameState){
  ST.lang = (localStorage.getItem('hha_lang')||'TH');
  const d = (gameState?.difficulty)||'Normal';
  ST.need = TUNING.quotaByDiff[d] ?? 4;
  ST.liveBias = TUNING.targetBias;
  ST.liveTTL  = { ...TUNING.ttlByDiff };
  ST.tutorialUntil = now() + 15000;

  ST.puFreezeUntil=0; ST.puX2Until=0; ST.puMagnetNext=false;

  switchTarget();
  showTargetHUD(true);

  // Mini quests: ใช้ pool 5 แบบ สุ่มมา 3
  ST.quests = rollQuests(d, ST.lang);
  ST.questRerollAt = now() + TUNING.questRerollCooldown*1000;
  renderQuestChips();

  bindPowerBar();

  try {
    const names = ST.targets.map(labelOf).join(' + ');
    gameState?.coach?.say?.(t(`เป้าหมาย: ${names}`, `Targets: ${names}`, ST.lang));
  } catch {}
}

export function cleanup(){
  showTargetHUD(false);
  unbindPowerBar();
}

/* flag สำหรับ no_miss_for_s */
let _noMissTick = true;

/* เรียกทุกวินาทีจาก main.js */
export function tick(state, systems){
  const ms = now();
  const d = (state?.difficulty)||'Normal';

  // Target timer (หยุดเมื่อ Freeze)
  const frozen = (ms < ST.puFreezeUntil);
  if (!frozen) ST.targetTimeLeft = Math.max(0, ST.targetTimeLeft - 1);
  ST._inRush = ST.targetTimeLeft <= TUNING.rushLastSec;

  updateTargetBadge(`${ST.targetTimeLeft|0}s`);

  // Mini quests tick
  applyQuestTick(ST.quests, 1, (q)=>{ grantQuestReward(q, systems, state); });
  updateQuestUI();

  // Reroll เฉพาะตัวที่ fail (รักษาจำนวน 3)
  if (ms >= ST.questRerollAt){
    let changed=false;
    for (let i=0;i<ST.quests.length;i++){
      const q = ST.quests[i];
      if (q.state==='fail'){
        ST.quests[i] = rollQuests(d, ST.lang)[0];
        changed=true;
      }
    }
    if (changed){
      renderQuestChips();
      ST.questRerollAt = ms + TUNING.questRerollCooldown*1000;
    }
  }

  // Autoswitch รอบเมื่อช้าเกิน
  if (ST.got < ST.need){
    const waited = (ms - ST.lastSwitchMs)/1000;
    if (waited >= TUNING.autoswitchSec){
      switchTarget();
      try { systems?.sfx?.play?.('powerup'); } catch {}
      systems?.coach?.say?.(t('เปลี่ยนหมวด!','New targets!',ST.lang));
    }
  }

  _noMissTick = true;
}

/* สุ่มเมตาต่อชิ้น */
export function pickMeta(diff, gameState){
  const d = (gameState?.difficulty)||'Normal';
  let ttl = ST.liveTTL[d] ?? (diff?.life || 3000);
  let bias = ST.liveBias;

  if (ST._inRush){ bias = clamp(bias + TUNING.rushBiasBoost,0,1); ttl = Math.round(ttl * TUNING.rushTTLScale); }

  let pick;
  const targetSet = new Set(ST.targets);
  if (Math.random() < bias){
    pick = sample(ITEMS.filter(it=>targetSet.has(it.group)));
  } else {
    if (Math.random()<TUNING.decoyRate){
      pick = pickDecoy(ST.targets) || sample(ITEMS.filter(it=>!targetSet.has(it.group)));
      if (pick) pick.__decoy = true;
    } else {
      pick = sample(ITEMS.filter(it=>!targetSet.has(it.group)));
    }
  }
  if (!pick) pick = sample(ITEMS);

  // โอกาส Golden ถ้าเป็นเป้าหมาย
  let golden=false;
  if (targetSet.has(pick.group)){
    let p = TUNING.goldRateBase + (ST._inRush ? TUNING.goldRateRushBoost : 0);
    if (Math.random() < p) golden = true;
  }

  return {
    id: pick.id,
    char: golden ? `✨${pick.icon}` : pick.icon,
    good: targetSet.has(pick.group),
    life: ttl,
    bornAt: now(),
    groupId: pick.group,
    decoy: !!pick.__decoy,
    golden,
  };
}

/* เมื่อผู้เล่นคลิก */
export function onHit(meta, systems, gameState){
  const ms = now();
  const fast = (typeof meta.bornAt==='number') ? ((ms - meta.bornAt) <= TUNING.perfectWindowMs) : false;

  let result;
  if (meta.good){
    const x2Now = (ms < ST.puX2Until);
    if (fast || meta.golden){
      result = 'perfect';
      if (x2Now) systems?.score?.add?.(8);
      if (meta.golden){
        systems?.score?.add?.(TUNING.goldBonusScore);
        if (gameState?.fever) gameState.fever.meter = Math.min(100, (gameState.fever.meter||0) + TUNING.goldBonusFever);
        systems?.coach?.say?.(t('ทองคำ! เยี่ยมมาก!','GOLDEN! Awesome!',ST.lang));
      } else {
        systems?.coach?.say?.(t('ไวมาก!','Perfect!',ST.lang));
      }
    } else {
      result = 'good';
      if (x2Now) systems?.score?.add?.(6);
      systems?.coach?.say?.(t('ใช่เลย!','Nice!',ST.lang));
    }

    // Magnet next (ครั้งเดียว)
    if (ST.puMagnetNext){ systems?.score?.add?.(TUNING.powerMagnetBonus); ST.puMagnetNext=false; }

    ST.got++;
    ST.badStreak = 0;

    // เควส (อัปเดตจาก hit)
    applyQuestHit(ST.quests, result, meta, (q)=>{ grantQuestReward(q, systems, gameState); });
    updateQuestUI();

    // จบ "รอบ" แล้วสุ่มจำนวนเป้าหมายใหม่ (1/2/3)
    if (ST.got >= ST.need){
      if (ST.inTargetStreakNoMiss){
        systems?.score?.add?.(TUNING.streakBonus);
        systems?.coach?.say?.(t('ยอดเยี่ยม! ไม่พลาดเลย','Flawless!',ST.lang));
      }
      switchTarget();
      try { systems?.sfx?.play?.('powerup'); } catch {}
      const names = ST.targets.map(labelOf).join(' + ');
      systems?.coach?.say?.(t(`เปลี่ยนเป้าหมาย: ${names}`, `New targets: ${names}`, ST.lang));
    }
    _noMissTick = true;

  } else {
    result = 'bad';
    ST.badStreak++;
    ST.inTargetStreakNoMiss = false;
    systems?.coach?.say?.(meta.decoy ? t('โดนตัวลวง!','Decoy!',ST.lang) : t('ยังไม่ใช่หมวดนี้','Not this group!',ST.lang));

    // Bad tax
    if (ST.badStreak>=TUNING.badTaxN){
      gameState.timeLeft = Math.max(0, (gameState.timeLeft||0) - TUNING.badTaxTimePenalty);
      ST.badStreak = 0;
    }

    // เควส: รีเซ็ต no_miss_for_s
    applyQuestHit(ST.quests, 'bad', meta, (q)=>{ grantQuestReward(q, systems, gameState); });
    updateQuestUI();
    _noMissTick = false;
  }

  return result;
}

/* --------------------- Powers API --------------------- */
export const powers = {
  freezeTarget(){ ST.puFreezeUntil = now() + TUNING.powerFreezeTarget*1000; },
  magnetNext(){ ST.puMagnetNext = true; },
  x2Target(){ ST.puX2Until = now() + TUNING.powerX2TargetSec*1000; },
};
