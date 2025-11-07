// === modes/groups.safe.js — Food Groups w/ Dynamic Quest ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const VEG = ['🥦','🥕','🌽','🍅','🥬','🧅','🫑','🍆','🧄','🥒','🥔','🍄','🌶️','🥗','🫘','🌰','🥜','🌿','🍠','🥥'];
const PRO = ['🐟','🍗','🥚','🥩','🧀','🥛','🫘','🦐','🦑','🍖','🍤','🧆','🍣','🥓'];
const GRA = ['🍞','🥖','🥐','🥯','🧇','🍙','🍚','🍘','🍝','🍜','🍛','🫓','🥟','🍕'];
const GROUPS = ['VEG','PRO','GRA'];
const MAP = { VEG, PRO, GRA };

function tGroup(g){ return g==='VEG'?'ผัก/ผลไม้':g==='PRO'?'โปรตีน':'ข้าว-แป้ง'; }

export async function boot(config = {}) {
  // ภารกิจแบบวนหมวด + เพิ่มจำนวนเมื่อผ่าน
  let target = GROUPS[Math.floor(Math.random()*GROUPS.length)];
  let need = 2;            // เริ่ม 2 ชิ้น
  let got = 0;

  function pushQuest(){
    const txt = `Mini Quest — เลือก “${tGroup(target)}” ให้ครบ ${got}/${need} ชิ้น`;
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:txt}})); }catch{}
  }
  pushQuest();

  function judge(ch, ctx){
    if(ch == null) return { good:false, scoreDelta:-5 }; // timeout
    const ok = MAP[target].includes(ch);
    if(ok){
      got++;
      if(got>=need){
        // ผ่านภารกิจรอบนี้ → เพิ่มความยากเล็กน้อย และสุ่มหมวดใหม่
        need = Math.min(5, need+1);
        got = 0;
        // สุ่มหมวดใหม่ที่ไม่ซ้ำเดิม
        let next = target;
        while(next===target) next = GROUPS[Math.floor(Math.random()*GROUPS.length)];
        target = next;
        try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`ผ่าน! → เปลี่ยนเป้า: ${tGroup(target)} (${got}/${need})`}})); }catch{}
        return { good:true, scoreDelta:18, feverDelta:2 };
      }else{
        pushQuest();
        return { good:true, scoreDelta:12, feverDelta:1 };
      }
    }else{
      // กดผิดหมวด รีเซ็ตความคืบหน้าเล็กน้อย
      got = Math.max(0, got-1);
      pushQuest();
      return { good:false, scoreDelta:-8 };
    }
  }

  return factoryBoot({
    name: 'groups',
    pools: { good: [...VEG, ...PRO, ...GRA] }, // สุ่มทั้งจอ แต่ตัดสินด้วย judge
    judge,
    ui: { questStartText: 'Mini Quest — เลือกให้ตรง “หมวด” ที่กำหนด' },
    ...config
  });
}
export default { boot };