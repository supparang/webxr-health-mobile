// === modes/groups.safe.js — Dynamic multi-target (1→2→3 by streak) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

// ----- 5 กลุ่มหลัก (≈20 ชิ้น/กลุ่ม) -----
const GROUPS = [
  { id:'veg',    label:'ผัก',              items:['🥦','🥕','🌽','🧅','🥒','🫑','🍆','🥬','🥔','🧄','🥗','🍄','🥜','🌶️','🥠','🥟','🧄','🥕','🥦','🥬'] },
  { id:'fruit',  label:'ผลไม้',            items:['🍎','🍏','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🥝','🥭','🍑','🍍','🍈','🍅','🍋','🍍','🍓'] },
  { id:'protein',label:'โปรตีน/เนื้อ',     items:['🍗','🍖','🥩','🥓','🍤','🐟','🍣','🥚','🫘','🥜','🌰','🧆','🥟','🍢','🌭','🍔','🍗','🍖','🍣','🍤'] },
  { id:'grains', label:'ข้าว-แป้ง/ธัญพืช', items:['🍚','🍙','🍘','🍞','🥖','🥐','🥨','🥯','🫓','🍝','🍜','🍱','🍕','🌮','🌯','🧇','🥞','🥠','🍩','🍪'] },
  { id:'dairy',  label:'นม/โยเกิร์ต',      items:['🥛','🧀','🍦','🍨','🍧','🍮','🥮','🧈','🥞','🧋','🍰','🧁','🍮','🥛','🧀','🍨','🍦','🍧','🧈','🧁'] },
];

const ALL_ITEMS = GROUPS.flatMap(g=>g.items);
const CHAR2GROUP = (()=>{ const m=new Map(); for(const g of GROUPS) for(const ch of g.items) m.set(ch,g.id); return m; })();

function shuffle(a){ const x=a.slice(); for(let i=x.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; } return x; }
function nextFromDeck(deck, used){
  // หาก deck หมดให้รีชัฟเฟิลจากกลุ่มทั้งหมดที่ไม่ได้ active อยู่
  if(deck.idx >= deck.ids.length){
    const pool = GROUPS.map(g=>g.id).filter(id=>!used.has(id));
    deck.ids = shuffle(pool);
    deck.idx = 0;
  }
  return deck.ids[deck.idx++];
}

export async function boot({ host, difficulty='normal' } = {}) {
  // เป้าต่อ “หนึ่งกลุ่ม”
  const NEED_PER_GROUP =
    (difficulty==='easy')   ? 8 :
    (difficulty==='hard')   ? 14 : 10;

  // เด็คสุ่มสำหรับเลือกกลุ่มเป้าถัดไป
  const deck = { ids: shuffle(GROUPS.map(g=>g.id)), idx: 0 };

  // สถานะ mult-target
  let activeTargets = [];             // ['veg','protein', ...]
  let targetSlots   = 1;              // 1 → 2 → 3
  let streakCorrect = 0;              // สำหรับเลื่อนขั้นเป้า
  const hits = new Map();             // groupId -> จำนวนที่เก็บในรอบนี้

  // เติมกลุ่มให้ครบตามจำนวนช่อง targetSlots
  function fillTargets(){
    const used = new Set(activeTargets);
    while(activeTargets.length < targetSlots){
      const id = nextFromDeck(deck, used);
      activeTargets.push(id);
      used.add(id);
      hits.set(id, 0);
    }
    // ถ้ามีเกิน (จากการลดช่อง) ให้ตัดหาง
    while(activeTargets.length > targetSlots){
      const removed = activeTargets.pop();
      hits.delete(removed);
    }
  }
  fillTargets();

  function labelOf(id){ return GROUPS.find(g=>g.id===id)?.label || id; }
  function sample3(arr){ const b=arr.slice(); const out=[]; for(let i=0;i<3 && b.length;i++){ out.push(b.splice(Math.floor(Math.random()*b.length),1)[0]); } return out; }

  // HUD push
  function pushHUD(){
    // 1) ชิพหมวด (ขวาบน) — ไฮไลต์เฉพาะที่เป็น "เป้า" (อาจมีหลายตัว)
    try{
      window.dispatchEvent(new CustomEvent('hha:chips',{
        detail:{ categories: GROUPS.map(g=>({ id:g.id, label:g.label, active: activeTargets.includes(g.id) })) }
      }));
    }catch{}

    // 2) กล่อง Goal (กลางบน) — แสดงหลายเป้า
    const multiTargets = activeTargets.map(id=>{
      const have = hits.get(id) || 0;
      const group = GROUPS.find(g=>g.id===id);
      return { id, label: labelOf(id), have, need: NEED_PER_GROUP, examples: sample3(group?.items||[]) };
    });
    try{
      window.dispatchEvent(new CustomEvent('hha:goal', { detail: { multiTargets } }));
    }catch{}

    // 3) Mini quest (สรุปย่อ)
    const mini = multiTargets.map(t=>`${t.label} ${t.have}/${t.need}`).join(' | ');
    try{
      window.dispatchEvent(new CustomEvent('hha:quest', { detail: { text: `Mini Quest: ${mini}` } }));
    }catch{}
  }
  pushHUD();

  // ปรับจำนวนช่องเป้าตามสตรีค
  function escalateOnStreak(){
    if(streakCorrect >= 12) targetSlots = 3;
    else if(streakCorrect >= 6) targetSlots = 2;
    else targetSlots = Math.max(targetSlots, 1);
    fillTargets();
  }
  function decayOnMiss(){
    streakCorrect = 0;
    targetSlots = Math.max(1, targetSlots - 1);
    fillTargets();
  }

  // ตัดสินผลเมื่อคลิก
  function judge(hitChar, ctx){
    if(!hitChar){
      // timeout = พลาดเล็กน้อย
      decayOnMiss();
      pushHUD();
      return { good:false, scoreDelta:-2 };
    }
    const gid = CHAR2GROUP.get(hitChar);
    const isTarget = activeTargets.includes(gid);

    if(isTarget){
      // ถูกกลุ่ม
      streakCorrect++;
      escalateOnStreak();

      const cur = (hits.get(gid)||0)+1;
      hits.set(gid, cur);

      // กลุ่มนี้ครบเป้าแล้ว → เปลี่ยนเป็นกลุ่มใหม่ในช่องเดิม
      if(cur >= NEED_PER_GROUP){
        const idx = activeTargets.indexOf(gid);
        const used = new Set(activeTargets);
        used.delete(gid);
        const nextId = nextFromDeck(deck, used);
        activeTargets[idx] = nextId;
        hits.delete(gid);
        hits.set(nextId, 0);
      }

      pushHUD();
      return { good:true, scoreDelta:10, feverDelta:2 };
    }else{
      // กดผิดกลุ่ม
      decayOnMiss();
      pushHUD();
      return { good:false, scoreDelta:-6 };
    }
  }

  // ส่งให้โรงงานกลางจัดการ spawn/anti-overlap/งบต่อวินาที
  return factoryBoot({
    name:'groups',
    host, difficulty,
    pools:{ good: ALL_ITEMS },   // spawn จากสระรวมทั้งหมด
    judge,
    ui:{ questMainSel:'#hudQuest' },
    timeByDiff:{ easy:60, normal:60, hard:75 },
    maxActiveByDiff:{ easy:2, normal:3, hard:3 },
    budgetByDiff:{   easy:2, normal:3, hard:3 },
    goldenRate:0.03, goodRate:1.0,
    minDist:0.38, slotCooldownMs:520,
  });
}
