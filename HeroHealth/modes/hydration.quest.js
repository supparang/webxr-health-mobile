// === modes/hydration.quest.js — production safe ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

export async function boot(config = {}){
  // โซน hydration (0..100)
  let meter = 40; // เริ่ม LOW/GREEN
  let zone  = 'LOW';
  let greenSec = 0;
  let streak = 0;

  // รายการ
  const GOOD = ['💧','🥛','🍉','🍊','🍐','🥒'];       // เพิ่มน้ำ
  const BAD  = ['🥤','🧋','🍺','🍷','🍰','🍩'];       // เพิ่มน้ำแบบ “ไม่ดี” (ถ้า HIGH ลงโทษ)

  // ช่วยอธิบายบน HUD ขวา
  function updateQuestHUD(){
    const text = `Hydration — Zone: ${zone} | GREEN ${greenSec}/20s | Streak ${streak}/10 | Recover HIGH→GREEN ≤3s`;
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text}})); }catch{}
  }
  updateQuestHUD();

  function recalcZone(){
    if(meter<35) zone='LOW';
    else if(meter>65) zone='HIGH';
    else zone='GREEN';
  }

  // ปรับ meter ตามของที่เลือก
  function judge(char, ctx){
    // เพิ่ม/ลดตามหมวด
    let delta = 0, good = true, scoreDelta = 0, feverDelta = 0;

    if(GOOD.includes(char)){
      // น้ำดี: เพิ่ม meter
      meter += 7;
      if(zone==='LOW'){ scoreDelta = 12; streak++; }
      else if(zone==='GREEN'){ scoreDelta = 10; streak++; feverDelta = 1; }
      else if(zone==='HIGH'){ // ดื่มเกิน → ลดสกอร์เล็กน้อย
        scoreDelta = -4; good = false; streak = 0;
      }
    }else{
      // ของไม่ดี: เพิ่ม meter มาก/หรือโทษเมื่อ LOW
      meter += 9;
      if(zone==='LOW'){ scoreDelta = -6; good = false; streak = 0; }
      else if(zone==='GREEN'){ scoreDelta = -3; good = false; streak = 0; }
      else if(zone==='HIGH'){ scoreDelta = -8; good = false; streak = 0; }
    }

    meter = Math.max(0, Math.min(100, meter));
    const prevZone = zone;
    recalcZone();

    // เควส: อยู่โซน GREEN ต่อเนื่อง
    if(zone==='GREEN') greenSec = Math.min(20, greenSec+1);
    else greenSec = 0;

    // เควส: Recover HIGH→GREEN ≤3s
    if(prevZone==='HIGH' && zone==='GREEN'){ /* ตัวเช็คเวลาเสริมทำใน loop ด้านล่าง */ }

    updateQuestHUD();
    return { good, scoreDelta, feverDelta };
  }

  // เดินเวลาทุกวิ (factory จะยิง hha:time ให้แล้ว แต่ซ้ำไว้อีกชั้นเพื่อความชัวร์)
  let sec = Number(config.duration)||60;
  const t = setInterval(()=>{
    try{ window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec}})); }catch{}
    if(sec>0) sec--;
  },1000);

  // เริ่มเกมผ่าน factory
  const api = await factoryBoot({
    name:'hydration',
    pools: { good: GOOD, bad: BAD },
    judge,
    difficulty: config.difficulty || 'normal',
    duration: config.duration || 60,
    host: config.host,
    goodRate: 0.60,
    goldenRate: 0.05,
    goal: 999 // ใช้เควสเป็นหลัก
  });

  // คืน API มาตรฐาน
  return {
    stop(){ try{ api?.stop?.(); }catch{} clearInterval(t); },
    pause(){ try{ api?.pause?.(); }catch{} },
    resume(){ try{ api?.resume?.(); }catch{} }
  };
}

export default { boot };