// === modes/plate.quest.js — Balanced Plate w/ Rounds ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const VEG = ['🥦','🥗','🥬','🌽','🥕','🍅','🍆','🥒','🫑','🧅','🍄','🥔'];
const PRO = ['🐟','🍗','🥚','🥩','🫘','🧀','🥛'];
const GRA = ['🍞','🍚','🍙','🍝','🍜','🥖','🥯','🧇'];
const FRU = ['🍎','🍇','🍉','🍓','🍊','🍍','🥝','🍒','🍑','🍐','🍋','🫐'];
const FAT = ['🥑','🧈','🍫','🍩','🍟','🍕','🌭']; // หมวดพิเศษ (ไม่นับ)

const ALL = [...VEG, ...PRO, ...GRA, ...FRU, ...FAT];
const belong = (ch, arr) => arr.includes(ch);

function prettyNeed(need){
  return `ผัก ${need.VEG} | โปรตีน ${need.PRO} | ข้าว-แป้ง ${need.GRA} | ผลไม้ ${need.FRU}`;
}
function q(text){ try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text}})); }catch{} }

export async function boot(config = {}) {
  // กำหนดจำนวนที่ต้องการต่อรอบ (สุ่มเล็กน้อย) แล้วค่อย ๆ เพิ่มความยาก
  let round = 1;
  let need = makeNeed(round);
  let done = { VEG:0, PRO:0, GRA:0, FRU:0 };

  function makeNeed(r){
    // ยากขึ้นทีละนิด แต่ไม่เกิน 3 ต่อหมวด
    return {
      VEG: Math.min(3, 1 + Math.floor((r-1)/2)),
      PRO: Math.min(3, 1 + Math.floor(r/3)),
      GRA: Math.min(3, 1 + Math.floor(r/2)),
      FRU: Math.min(3, 1 + Math.floor((r+1)/3)),
    };
  }
  function refreshQuest(){
    q(`จัดจานให้ครบ 5 หมู่ → เป้าปัจจุบัน: ${prettyNeed(need)} | ทำแล้ว: ผัก ${done.VEG} โปรตีน ${done.PRO} ข้าว-แป้ง ${done.GRA} ผลไม้ ${done.FRU}`);
  }
  refreshQuest();

  function progressOn(ch){
    if(belong(ch, VEG)) done.VEG++;
    else if(belong(ch, PRO)) done.PRO++;
    else if(belong(ch, GRA)) done.GRA++;
    else if(belong(ch, FRU)) done.FRU++;
  }
  function satisfied(){
    return done.VEG>=need.VEG && done.PRO>=need.PRO && done.GRA>=need.GRA && done.FRU>=need.FRU;
  }
  function nextRound(){
    round++;
    need = makeNeed(round);
    done = { VEG:0, PRO:0, GRA:0, FRU:0 };
    q(`รอบใหม่! → เป้าหมาย: ${prettyNeed(need)}`);
  }

  function judge(ch, ctx){
    if(ch==null){ return { good:false, scoreDelta:-4 }; }

    // กดหมวดพิเศษ → หักเล็กน้อย
    if(belong(ch, FAT)){ q('หมวดพิเศษ! เลือกได้บ้าง แต่ไม่ช่วยจัดจาน'); return { good:false, scoreDelta:-4 }; }

    // หมวด 4 หลัก
    if(belong(ch, VEG) || belong(ch, PRO) || belong(ch, GRA) || belong(ch, FRU)){
      progressOn(ch);
      if(satisfied()){
        q('เยี่ยม! ครบ 5 หมู่ในรอบนี้แล้ว → เริ่มรอบใหม่');
        nextRound();
        return { good:true, scoreDelta:20, feverDelta:2 };
      }else{
        refreshQuest();
        return { good:true, scoreDelta:12, feverDelta:1 };
      }
    }
    return { good:false, scoreDelta:-3 };
  }

  return factoryBoot({
    name: 'plate',
    pools: { good: ALL },
    judge,
    ui: { questStartText: 'Mini Quest — จัดจานครบ 5 หมู่ให้ตรงเป้าในเวลาที่กำหนด' },
    ...config
  });
}
export default { boot };