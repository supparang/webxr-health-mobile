// === modes/groups.safe.js — group targets ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// กลุ่มตัวอย่าง (20 ต่อกลุ่ม)
const VEG = ['🥦','🥕','🌽','🍅','🥬','🧅','🫑','🍆','🧄','🥒','🥔','🍄','🌶️','🥗','🫘','🌰','🥜','🌿','🍠','🥥'];
const PRO = ['🐟','🍗','🥚','🥩','🧀','🥛','🫘','🦐','🦑','🧈','🍖','🍤','🦞','🧆','🍣','🥓','🧂','🍔','🌭','🥠'];
const GRA = ['🍞','🥖','🥐','🥯','🥞','🧇','🍙','🍚','🍘','🍝','🍜','🍛','🌮','🌯','🫓','🥟','🍕','🥠','🍩','🍪'];

const ALL = [...VEG, ...PRO, ...GRA];

function judgeGroups(hitChar, ctx){
  if (hitChar == null) return { good:false, scoreDelta:-5 };
  // ตัดสินว่า "ดี" เมื่อคลิกชนิดที่ระบบสุ่มหมวดเป้าหมายไว้ (จาก ctx.targetGroup)
  const aim = ctx?.targetGroup || 'VEG';
  const inGroup = (aim === 'VEG' ? VEG : aim === 'PRO' ? PRO : GRA).includes(hitChar);
  return inGroup ? { good:true, scoreDelta:12, feverDelta:1 } : { good:false, scoreDelta:-8 };
}

export async function boot(config = {}) {
  return factoryBoot({
    name: 'groups',
    pools: { good: ALL },             // ใช้กองเดียว สุ่มได้ทุกอย่าง
    judge: (ch, ctx) => judgeGroups(ch, ctx),
    ui: { questStartText: 'Mini Quest — เลือกของให้ตรงหมวดที่กำหนด' },
    ...config
  });
}
export default { boot };