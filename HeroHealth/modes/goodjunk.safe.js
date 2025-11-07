// === modes/goodjunk.safe.js — Good vs Junk (with Dynamic Mini-Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

function q(text){ try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text}})); }catch{} }

// สุ่มมีโอกาสเป็นทอง (ใช้ใน judge ด้วย)
function isGolden(char){
  // ทองเฉพาะ “ของดี” โอกาส ~7%
  if(!GOOD.includes(char)) return false;
  return Math.random() < 0.07;
}

export async function boot(config = {}) {
  // ----- สถานะรอบ/เป้าหมาย -----
  let round = 1;
  let needGood = 8;         // ต้องเก็บของดีให้ครบ (จะเพิ่มตามรอบ)
  let maxJunk  = 3;         // กดของขยะได้ไม่เกินใน 1 รอบ
  let gotGood = 0;
  let gotJunk = 0;

  // ----- เควสย่อย -----
  let streakGood = 0;       // กดของดีติดกัน
  let goldenThisRound = 0;  // จับทองในรอบนี้กี่ครั้ง
  let noJunkSec = 0;        // วินาทีที่ไม่มีการกดของขยะ

  // ตัวจับเวลา 1 วินาทีสำหรับ No-Junk 10s
  const secTicker = setInterval(()=>{
    noJunkSec++;
    if(noJunkSec>0 && noJunkSec<10){
      q(`No-Junk: ${noJunkSec}/10 วิ | เป้าหมายหลัก เก็บของดี ${gotGood}/${needGood} (ขยะ ${gotJunk}/${maxJunk})`);
    }else if(noJunkSec>=10){
      q('สำเร็จ: No-Junk 10s — เยี่ยมมาก!'); 
      noJunkSec = 0; // วนรอบใหม่
    }
  },1000);

  function refreshQuest(){
    q(`เก็บ “ของดี” ให้ครบ ${gotGood}/${needGood} ชิ้น — เลี่ยงของขยะ (ได้ไม่เกิน ${gotJunk}/${maxJunk})`);
  }
  refreshQuest();

  function nextRound(){
    round++;
    // เพิ่มความยากแบบค่อยเป็นค่อยไป
    needGood = Math.min(18, needGood + (round%2===0 ? 2 : 1));
    maxJunk  = Math.max(1, 3 - Math.floor((round-1)/3));
    gotGood = 0; gotJunk = 0;
    streakGood = 0; goldenThisRound = 0; noJunkSec = 0;
    q(`รอบใหม่! เป้าหมาย: ของดี ${needGood} ชิ้น (ขยะได้ไม่เกิน ${maxJunk})`);
  }

  // ----- ตัวให้คะแนน/ตัดสินแต่ละคลิก -----
  function judge(char, ctx){
    // timeout → ถือว่า “พลาด” (soft miss) ไม่หักเยอะ
    if(char==null){
      streakGood = 0;
      return { good:false, scoreDelta:-2 };
    }

    // ชนิดทอง (คิดก่อนเพื่อโบนัส)
    const golden = isGolden(char);

    if(GOOD.includes(char)){
      gotGood++; streakGood++;
      if(golden){ goldenThisRound++; }

      // เควสย่อย: streak
      if(streakGood>0 && streakGood<8){
        q(`Good Streak: ${streakGood}/8 | เป้าหมายหลัก ${gotGood}/${needGood}`);
      }else if(streakGood>=8){
        q('สำเร็จ: Good Streak 8x — สุดยอด!');
        streakGood = 0; // ทำได้อีกรอบ
      }

      // ผ่านรอบหรือยัง
      if(gotGood>=needGood){
        // โบนัสทองถ้ามี
        if(goldenThisRound>0){
          q(`ผ่านรอบ + Golden Catch x${goldenThisRound}! → เริ่มรอบใหม่`);
        }else{
          q('ผ่านรอบ! → เริ่มรอบใหม่');
        }
        const bonus = 20 + (goldenThisRound*5);
        nextRound();
        return { good:true, scoreDelta: bonus, feverDelta: 2 };
      }else{
        refreshQuest();
        // ถ้าเป็นทองให้คะแนนมากขึ้น
        return { good:true, scoreDelta: golden? 16 : 12, feverDelta: 1 };
      }
    }

    // ของขยะ
    if(JUNK.includes(char)){
      gotJunk++; streakGood = 0; noJunkSec = 0; // รีเซ็ต No-Junk
      if(gotJunk>maxJunk){
        // เกินโควตาขยะ → ลงโทษแรงเล็กน้อยและรีเฟรชภารกิจเดิม (ยังอยู่รอบเดิม)
        q(`ขยะเกินโควตา! พยายามเลี่ยงของขยะ (ตอนนี้ ${gotJunk}/${maxJunk})`);
        return { good:false, scoreDelta:-12 };
      }else{
        refreshQuest();
        return { good:false, scoreDelta:-8 };
      }
    }

    // อื่น ๆ (ไม่อยู่ใน GOOD/JUNK)
    streakGood = 0;
    return { good:false, scoreDelta:-3 };
  }

  // ครอบด้วย factory (ใช้ anti-overlap/สแปว์น/คอมโบ/fever ตามเดิม)
  const api = await factoryBoot({
    name: 'goodjunk',
    pools: { good: [...GOOD, ...JUNK] },  // ให้ factory สุ่มทั้งสองแบบ
    judge,
    ui: { questStartText: 'Mini Quest — เก็บของดีให้ครบ เลี่ยงของขยะ' },
    ...config
  });

  // ทำความสะอาดตัวจับเวลาเมื่อจบเกม
  const origStop = api?.stop?.bind(api);
  return {
    ...api,
    stop(){ try{ clearInterval(secTicker); }catch{} origStop?.(); }
  };
}

export default { boot };