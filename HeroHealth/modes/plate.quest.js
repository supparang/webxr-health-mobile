// === modes/plate.quest.js — build balanced plate ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const VEG = ['🥦','🥗','🥬','🌽','🥕','🍅','🍆','🥒','🫑','🧅','🍄','🥔'];
const PRO = ['🐟','🍗','🥚','🥩','🫘','🧀','🥛'];
const GRA = ['🍞','🍚','🍙','🍝','🍜','🥖','🥯','🧇'];
const FRU = ['🍎','🍇','🍉','🍓','🍊','🍍','🥝','🍒','🍑','🍐','🍋','🫐'];
const FAT = ['🥑','🧈','🍫','🍩','🍟','🍕','🌭']; // หมวดพิเศษ

const ALL = [...VEG, ...PRO, ...GRA, ...FRU, ...FAT];

function judgePlate(hitChar, ctx){
  if (hitChar == null) return { good:false, scoreDelta:-5 };
  // ให้ดีเมื่อเลือกได้ครบหมวดที่ระบบต้องการ (ctx.needCategories)
  const need = ctx?.needCategories || { VEG:1, PRO:1, GRA:1, FRU:1 };
  const is = VEG.includes(hitChar) ? 'VEG' :
             PRO.includes(hitChar) ? 'PRO' :
             GRA.includes(hitChar) ? 'GRA' :
             FRU.includes(hitChar) ? 'FRU' :
             FAT.includes(hitChar) ? 'FAT' : 'OTHER';

  // หมวดพิเศษ FAT ไม่ให้บวกคะแนน (หรือหัก) ตามดีไซน์
  if (is === 'FAT') return { good:false, scoreDelta:-4 };

  // นับเป็นสำเร็จ (ในจริง ๆ ควรอัปเดต ctx.needCategories ให้ลดลง — ทำในโหมดจริง)
  return { good:true, scoreDelta:12, feverDelta:1 };
}

export async function boot(config = {}) {
  return factoryBoot({
    name: 'plate',
    pools: { good: ALL },
    judge: (ch, ctx) => judgePlate(ch, ctx),
    ui: { questStartText: 'Mini Quest — จัดจานให้ครบ 5 หมู่ (เว้นหมวดพิเศษ)' },
    ...config
  });
}
export default { boot };