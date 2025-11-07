// === modes/hydration.quest.js — Water Balance + Advanced Quests ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GOOD = ['💧','🥛','🫗','🧊','🍵','🫖','🥤']; // น้ำ/นม/ชาร้อนอ่อน
const BAD  = ['🧋','☕','🍹','🍺','🍷','🍸','🥃'];

let level = 50;          // 0..100
let streak = 0;          // ดื่มถูกติดกัน
let perfectSec = 0;      // วินาทีที่อยู่ใน GREEN ติดกัน
let overRecoverTimer = 0;// เวลาคืนจาก HIGH → GREEN (หน่วยวินาที ภายใน 3 วิ)

// helper push quest
function q(text){ try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text}})); }catch{} }

export async function boot(config = {}) {
  level = 50; streak = 0; perfectSec = 0; overRecoverTimer = 0;
  q('Mini Quest — รักษาระดับน้ำให้อยู่ “โซนพอดี (GREEN)”');

  // สมัครตัวจับเวลา 1 วิ/ครั้ง เพื่ออัปเดต Perfect/Recover
  let timer = setInterval(()=>{
    const inGreen = (level>=40 && level<=65);
    const inHigh  = (level>65);
    if(inGreen){ perfectSec++; } else { perfectSec = 0; }
    if(inHigh){ overRecoverTimer++; } else if(inGreen && overRecoverTimer>0){ 
      // กลับสู่ GREEN ภายใน 3 วิ → เควส Overdrink Warning สำเร็จ
      if(overRecoverTimer<=3){ q('สำเร็จ: Overdrink Warning — คืนสมดุลภายใน 3 วิ!'); }
      overRecoverTimer = 0;
    }

    // แจ้งเป้าหมายย่อย
    if(perfectSec>0 && perfectSec<20){
      q(`Perfect Balance: อยู่ใน GREEN ${perfectSec}/20 วิ`);
    }else if(perfectSec>=20){
      q('สำเร็จ: Perfect Balance 20s — สุดยอด!');
      perfectSec = 0; // วนรอบใหม่ได้
    }
  },1000);

  function endTimer(){ try{ clearInterval(timer); }catch{} }

  function judge(ch, ctx){
    if(ctx?.type==='timeout'){ // ปล่อยพลาด
      level = Math.max(0, level-3);
      streak = 0;
      return { good:false, scoreDelta:-2 };
    }

    // ปรับระดับน้ำ
    if(GOOD.includes(ch)){ level = Math.min(100, level+6); streak++; }
    else if(BAD.includes(ch)){ level = Math.max(0, level-8); streak = 0; }
    else { streak = 0; return { good:false, scoreDelta:-2 }; }

    const inGreen = (level>=40 && level<=65);
    const inHigh  = (level>65);
    const inLow   = (level<40);

    // Hydration Streak (ดื่ม “ดี” ติดกัน 10 ครั้ง)
    if(streak>0 && streak<10){
      q(`Hydration Streak: ${streak}/10`);
    }else if(streak>=10){
      q('สำเร็จ: Hydration Streak 10x — เก่งมาก!');
      streak = 0; // รีเซ็ตเพื่อทำรอบใหม่
    }

    // คะแนนตามโซน
    if(GOOD.includes(ch)){
      if(inHigh)      { q('สูงเกิน! ลดการดื่มสักพัก'); return { good:false, scoreDelta:-4 }; }
      if(inGreen)     { return { good:true,  scoreDelta:12, feverDelta:1 }; }
      if(inLow)       { return { good:true,  scoreDelta:8,  feverDelta:0 }; }
    }else{ // BAD
      if(inLow)       { q('ยังขาดน้ำอยู่ หลีกเลี่ยงเครื่องดื่มนี้'); return { good:false, scoreDelta:-10 }; }
      if(inGreen)     { return { good:false, scoreDelta:-6 }; }
      if(inHigh)      { return { good:false, scoreDelta:-8 }; }
    }
    return { good:false, scoreDelta:-3 };
  }

  // ครอบด้วย factory
  const api = await factoryBoot({
    name: 'hydration',
    pools: { good: [...GOOD, ...BAD] },
    judge,
    ui: { questStartText: 'Mini Quest — รักษาน้ำ “โซน GREEN” + ทำเควสพิเศษ' },
    ...config
  });

  // เมื่อเกมหยุด ให้หยุดตัวจับเวลา
  const origStop = api?.stop?.bind(api);
  return {
    ...api,
    stop(){ try{ endTimer(); }catch{} origStop?.(); }
  };
}
export default { boot };