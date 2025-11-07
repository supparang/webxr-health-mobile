// === modes/groups.safe.js — Food Groups w/ Dynamic Quest ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const VEG = ['🥦','🥕','🌽','🍅','🥬','🧅','🫑','🍆','🧄','🥒','🥔','🍄','🌶️','🥗','🫘','🌰','🥜','🌿','🍠','🥥'];
const PRO = ['🐟','🍗','🥚','🥩','🧀','🥛','🫘','🦐','🦑','🍖','🍤','🧆','🍣','🥓'];
const GRA = ['🍞','🥖','🥐','🥯','🧇','🍙','🍚','🍘','🍝','🍜','🍛','🫓','🥟','🍕'];

const GROUPS = ['VEG','PRO','GRA'];
const MAP = { VEG, PRO, GRA };
const ALL = [...VEG, ...PRO, ...GRA];

function tGroup(g){ return g==='VEG'?'ผัก/ผลไม้':g==='PRO'?'โปรตีน':'ข้าว-แป้ง'; }
function pushQuestText(target, got, need){
  const txt = `Mini Quest — เลือก “${tGroup(target)}” ให้ครบ ${got}/${need} ชิ้น`;
  try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:txt}})); }catch{}
}

export async function boot(config = {}) {
  let target = GROUPS[Math.floor(Math.random()*GROUPS.length)];
  let need = 2;
  let got = 0;
  pushQuestText(target, got, need);

  function judge(ch, ctx){
    if (ch == null) return { good:false, scoreDelta:-5 };
    const ok = MAP[target].includes(ch);
    if(ok){
      got++;
      if(got>=need){
        need = Math.min(5, need+1);
        got = 0;
        let next = target;
        while(next===target) next = GROUPS[Math.floor(Math.random()*GROUPS.length)];
        target = next;
        pushQuestText(target, got, need);
        return { good:true, scoreDelta:18, feverDelta:2 };
      }else{
        pushQuestText(target, got, need);
        return { good:true, scoreDelta:12, feverDelta:1 };
      }
    }else{
      got = Math.max(0, got-1);
      pushQuestText(target, got, need);
      return { good:false, scoreDelta:-8 };
    }
  }

  return factoryBoot({
    name: 'groups',
    pools: { good: ALL },
    judge,
    ui: { questStartText: 'Mini Quest — เลือกให้ตรง “หมวด” ที่กำหนด' },
    ...config
  });
}
export default { boot };