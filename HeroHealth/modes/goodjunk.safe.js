// === modes/goodjunk.safe.js — Good vs Junk (with Dynamic Mini-Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';

const GOOD = ['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK = ['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

function q(text){ try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text}})); }catch{} }
function isGolden(char){ return GOOD.includes(char) && Math.random() < 0.07; }

export async function boot(config = {}) {
  let round = 1;
  let needGood = 8;
  let maxJunk  = 3;
  let gotGood = 0;
  let gotJunk = 0;

  let streakGood = 0;
  let goldenThisRound = 0;
  let noJunkSec = 0;

  const secTicker = setInterval(()=>{
    noJunkSec++;
    if(noJunkSec>0 && noJunkSec<10){
      q(`No-Junk: ${noJunkSec}/10 วิ | เป้าหมายหลัก เก็บของดี ${gotGood}/${needGood} (ขยะ ${gotJunk}/${maxJunk})`);
    }else if(noJunkSec>=10){
      q('สำเร็จ: No-Junk 10s — เยี่ยมมาก!');
      noJunkSec = 0;
    }
  },1000);

  function refreshQuest(){
    q(`เก็บ “ของดี” ให้ครบ ${gotGood}/${needGood} ชิ้น — เลี่ยงของขยะ (ได้ไม่เกิน ${gotJunk}/${maxJunk})`);
  }
  function nextRound(){
    round++;
    needGood = Math.min(18, needGood + (round%2===0 ? 2 : 1));
    maxJunk  = Math.max(1, 3 - Math.floor((round-1)/3));
    gotGood = 0; gotJunk = 0; streakGood = 0; goldenThisRound = 0; noJunkSec = 0;
    q(`รอบใหม่! เป้าหมาย: ของดี ${needGood} ชิ้น (ขยะได้ไม่เกิน ${maxJunk})`);
  }
  refreshQuest();

  function judge(char, ctx){
    if(char==null){ streakGood=0; return { good:false, scoreDelta:-2 }; }

    const golden = isGolden(char);

    if(GOOD.includes(char)){
      gotGood++; streakGood++; if(golden) goldenThisRound++;

      if(streakGood>0 && streakGood<8){ q(`Good Streak: ${streakGood}/8 | เป้าหมายหลัก ${gotGood}/${needGood}`); }
      else if(streakGood>=8){ q('สำเร็จ: Good Streak 8x — สุดยอด!'); streakGood=0; }

      if(gotGood>=needGood){
        if(goldenThisRound>0){ q(`ผ่านรอบ + Golden Catch x${goldenThisRound}! → เริ่มรอบใหม่`); }
        else { q('ผ่านรอบ! → เริ่มรอบใหม่'); }
        const bonus = 20 + (goldenThisRound*5);
        nextRound();
        return { good:true, scoreDelta:bonus, feverDelta:2 };
      }else{
        refreshQuest();
        return { good:true, scoreDelta: golden?16:12, feverDelta:1 };
      }
    }

    if(JUNK.includes(char)){
      gotJunk++; streakGood=0; noJunkSec=0;
      if(gotJunk>maxJunk){ q(`ขยะเกินโควตา! พยายามเลี่ยงของขยะ (ตอนนี้ ${gotJunk}/${maxJunk})`); return { good:false, scoreDelta:-12 }; }
      refreshQuest(); return { good:false, scoreDelta:-8 };
    }

    streakGood=0; return { good:false, scoreDelta:-3 };
  }

  const api = await factoryBoot({
    name: 'goodjunk',
    pools: { good: [...GOOD, ...JUNK] },
    judge,
    ui: { questStartText: 'Mini Quest — เก็บของดีให้ครบ เลี่ยงของขยะ' },
    ...config
  });

  const origStop = api?.stop?.bind(api);
  return { ...api, stop(){ try{ clearInterval(secTicker); }catch{} origStop?.(); } };
}
export default { boot };