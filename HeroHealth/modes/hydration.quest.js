// === modes/hydration.quest.js (production) ===
import { boot as buildMode } from '../vr/mode-factory.js';

// รายการ “ดื่มน้ำ” กับ “เครื่องดื่ม” มีผลต่อระดับน้ำ
var WATER = ['💧','🚰','🧊','🥛'];         // ดี
var LIGHT = ['🍵','🧃','🫖'];             // กลาง ๆ
var BAD   = ['🥤','🧋','🍺','🍷','🍹'];     // ไม่ดี

function inArr(ch, arr){ for(var i=0;i<arr.length;i++){ if(arr[i]===ch) return true; } return false; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

export async function boot(cfg){
  cfg = cfg || {};
  var level = 50; // 0..100
  var zone  = 'GREEN'; // LOW / GREEN / HIGH
  var streak = 0, greenHold = 0; // วินาทีในโซนเขียว
  var lastTick = Date.now();

  function zoneOf(v){ if(v<35) return 'LOW'; if(v>75) return 'HIGH'; return 'GREEN'; }
  function questText(){ return 'Hydration — Zone: '+zone+' | GREEN '+greenHold+'/20s | Streak '+streak+'/10 | Recover HIGH→GREEN ≤3s'; }

  try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }catch(e){}

  // ให้ระบบสปอว์นใช้ “อิโมจิดื่ม” ทั้งหมด (รวมไม่ดี)
  var ALL = WATER.concat(LIGHT).concat(BAD);

  // tick น้ำลดตามเวลาเล็กน้อย
  var decay = setInterval(function(){
    var now = Date.now();
    var dt = Math.max(0, Math.min(2000, now - lastTick));
    lastTick = now;
    level = clamp(level - dt*0.004, 0, 100); // ลดช้า ๆ
    var z = zoneOf(level);
    if(z==='GREEN'){ greenHold = clamp(greenHold+1, 0, 999); } else { greenHold = 0; }
    zone = z;
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }catch(e){}
  }, 1000);

  var api = await buildMode({
    host: cfg.host,
    difficulty: cfg.difficulty,
    duration: cfg.duration,
    pools: { good: ALL, bad: [] }, // ทั้งหมดเป็น "เป้าดื่ม" ให้ judge เป็นตัวตัดสิน
    goodRate: 1.0,
    goal: 9999,
    judge: function(char, ctx){
      // ผลกระทบต่อระดับน้ำ
      var delta = 0;
      if(inArr(char, WATER)) delta = 10;
      else if(inArr(char, LIGHT)) delta = 5;
      else if(inArr(char, BAD)) delta = -12;

      var prev = level; level = clamp(level + delta, 0, 100);
      var prevZone = zone; zone = zoneOf(level);

      // กติกาคะแนน: อยู่ GREEN ได้แต้มดี, LOW/HIGH ลงโทษเพิ่มตามกติกาที่คุยไว้
      var scoreDelta = 0, good = true;

      if(zone==='GREEN'){
        scoreDelta = 12; streak += 1;
      }else if(zone==='LOW'){
        // ถ้าดื่มของไม่ดีตอน LOW → โทษหนัก
        if(inArr(char, BAD)){ scoreDelta = -15; good = false; streak = 0; }
        else scoreDelta = 6; // ดื่มของดีเพื่อขึ้นสู่เขียว
      }else if(zone==='HIGH'){
        // ถ้าอยู่สูง ดื่มของไม่ดี → ลงโทษน้อยกว่า (ตามเงื่อนไข)
        if(inArr(char, BAD)){ scoreDelta = 2; } // ปรับลด
        else { scoreDelta = -8; good=false; streak=0; } // ดื่มเพิ่มตอนสูง = ไม่ดี
      }

      // เควสย่อย: Perfect Balance / Hydration Streak / Overdrink Warning
      // อัปเดตข้อความทุก hit
      try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }catch(e){}

      return { good: good, scoreDelta: scoreDelta };
    }
  });

  return {
    stop: function(){ try{ clearInterval(decay); }catch(e){} api && api.stop && api.stop(); },
    pause: function(){ api && api.pause && api.pause(); },
    resume: function(){ api && api.resume && api.resume(); }
  };
}

export default { boot };