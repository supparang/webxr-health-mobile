// === Hero Health — modes/plate.quest.js (Production) ===
// โหมด: Healthy Plate — จัดอาหารให้ครบ 5 หมู่ และรักษาสมดุลในแต่ละรอบ
// ใช้ระบบหลักจาก vr/mode-factory.js (สปอว์น/คะแนน/เอฟเฟกต์/HUD)

import { boot as factoryBoot } from '../vr/mode-factory.js';

// -------- หมวดอาหารหลัก (5 หมู่) --------
const GROUPS = {
  grains : ['🍚','🍙','🍘','🍞','🥖','🥯','🥨'],
  protein: ['🍗','🥩','🍖','🐟','🦐','🥚','🍤','🥜'],
  veggie : ['🥦','🥬','🥕','🍅','🌽','🧅','🫑','🥗'],
  fruit  : ['🍎','🍊','🍇','🍉','🍓','🍌','🍍','🍑','🍐','🍒','🥭'],
  dairy  : ['🥛','🧀','🍦','🍨','🍧','🥞']
};

// -------- ขยะ (ของหวาน/มัน/เค็มจัด) --------
const JUNK = ['🍔','🍕','🌭','🍩','🍪','🧁','🍫','🍬','🍭','🥤','🧋','🍟','🍹','🍿'];

// -------- ภารกิจและเงื่อนไข --------
const QUEST_BY_DIFF = {
  easy:   { goal: 30, desc: 'จัดอาหารให้ครบ 5 หมู่รวม 30 รายการ หลีกเลี่ยงขยะ!' },
  normal: { goal: 45, desc: 'จัดอาหารให้ครบ 5 หมู่รวม 45 รายการ หลีกเลี่ยงขยะ!' },
  hard:   { goal: 60, desc: 'จัดอาหารให้ครบ 5 หมู่รวม 60 รายการ หลีกเลี่ยงขยะ!' }
};

// -------- Mini Quest เฉพาะ Healthy Plate --------
// - “Perfect 5” → จัดครบ 5 หมู่ในรอบเดียว
// - “Balanced Round x3” → ทำครบ 3 รอบโดยไม่พลาดหมู่ใด
// - “No Junk Round” → จบรอบโดยไม่มีขยะเลย
function makeQuestState(){
  return {
    round: 1,
    found: new Set(),
    completedRounds: 0,
    junkTouched: false,
    qPerfect5: false,
    qBalanced3: false,
    qNoJunk: false
  };
}
function questText(qs){
  return `Healthy Plate — รอบที่ ${qs.round} | หมู่สะสม: ${qs.found.size}/5 ${
    qs.qPerfect5 ? '✅' : ''
  } ${
    qs.qBalanced3 ? '✅' : ''
  } ${
    qs.qNoJunk ? '✅' : ''
  }`;
}

// -------- ฟังก์ชันช่วยตรวจหมวด --------
function getFoodGroup(char){
  for (const [grp, arr] of Object.entries(GROUPS)) {
    if (arr.includes(char)) return grp;
  }
  return null;
}

// -------- ฟังก์ชันให้คะแนน --------
function judgePlate(char, ctx, qs){
  if (char == null) {
    return { good:false, scoreDelta:-3 };
  }

  const grp = getFoodGroup(char);
  const isJunk = JUNK.includes(char);
  let score = 0, good = false;

  if (grp) {
    qs.found.add(grp);
    score = 12;
    good = true;
  } else if (isJunk) {
    score = -8;
    qs.junkTouched = true;
  } else {
    score = 0;
  }

  // เมื่อครบ 5 หมู่ในรอบนั้น → ผ่านรอบ
  if (qs.found.size >= 5) {
    qs.qPerfect5 = true;
    qs.completedRounds++;
    qs.found.clear();
    qs.round++;

    if (!qs.junkTouched) qs.qNoJunk = true;
    qs.junkTouched = false;

    if (qs.completedRounds >= 3) qs.qBalanced3 = true;
  }

  return { good, scoreDelta: score };
}

// -------- Boot โหมดหลัก --------
export async function boot(config = {}){
  const diff = config.difficulty || 'normal';
  const quest = QUEST_BY_DIFF[diff] ?? QUEST_BY_DIFF.normal;

  const qs = makeQuestState();

  // แจ้ง Mini Quest ตอนเริ่ม
  try {
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: { text: `Healthy Plate — ${quest.desc}` }
    }));
  } catch {}

  // judge closure
  function judge(char, ctx){
    const res = judgePlate(char, ctx, qs);
    try {
      window.dispatchEvent(new CustomEvent('hha:quest', {
        detail: { text: questText(qs) }
      }));
    } catch {}
    return res;
  }

  // เรียกใช้ factory
  return factoryBoot({
    name: 'plate',
    pools: { good: Object.values(GROUPS).flat(), bad: JUNK },
    judge,
    goal: quest.goal,
    ...config
  });
}

export default { boot };