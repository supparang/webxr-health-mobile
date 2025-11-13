import { createGoodJunkQuest } from './goodjunk.quest.js';

export async function boot(opts){
  const diff = (opts?.difficulty || 'normal').toLowerCase();

  // สร้าง quest director
  const quest = createGoodJunkQuest(diff);

  // state หลักของเกม
  let score = 0;
  let goodHits = 0;
  let miss = 0;
  let comboNow = 0;
  let comboMax = 0;
  let timeLeft = opts.duration || 60;

  function emitScore(delta, isGood){
    score = Math.max(0, score + (delta|0));
    if (isGood) goodHits++;
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail:{ delta, total:score, good:isGood }
    }));
    // อัปเดต quest ทุกครั้งที่มีคะแนน
    quest.update({ score, goodHits, miss, comboMax, timeLeft });
  }

  function onMiss(){
    miss++;
    comboNow = 0;
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail:{ delta:0, total:score, good:false }
    }));
    quest.update({ score, goodHits, miss, comboMax, timeLeft });
  }

  function onComboChange(newCombo){
    comboNow = newCombo;
    comboMax = Math.max(comboMax, comboNow);
    window.dispatchEvent(new CustomEvent('hha:combo', {
      detail:{ combo:comboNow, comboMax }
    }));
    quest.update({ score, goodHits, miss, comboMax, timeLeft });
  }

  // timer หลัก เรียก quest.update ด้วย
  const timer = setInterval(()=>{
    timeLeft--;
    if (timeLeft < 0){ clearInterval(timer); return; }
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    quest.update({ score, goodHits, miss, comboMax, timeLeft });
    if (timeLeft === 0){
      const sum = quest.summary();
      window.dispatchEvent(new CustomEvent('hha:end',{
        detail:{
          score,
          misses:miss,
          comboMax,
          goalCleared: (sum.goalsCleared >= sum.goalsTotal),
          questsCleared: sum.miniCleared,
          questsTotal: sum.miniTotal
        }
      }));
    }
  }, 1000);

  // เริ่ม quest ชุดแรก
  quest.start({ timeLeft });

  // .. ที่เหลือคือ logic สปอว์น emoji, handle click แล้วเรียก emitScore/onMiss/onComboChange ตามเดิม ..
  return {
    start(){
      // เริ่ม spawn เป้า
    }
  };
}
