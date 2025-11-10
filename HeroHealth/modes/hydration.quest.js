// Hydration — DOM target + water logic แบบย่อ (ไม่มีเกจภาพซ้อนค้าง)
import { boot as bootFactory } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');

  const GOOD = ['💧','🚰','🥛','🍊','🍋'];
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];

  const deck = new MissionDeck().draw3();
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest 1/3 — ${deck[0].label}`}}));

  let water=55, score=0, combo=0, misses=0;
  function zone(){ return (water>=40&&water<=70)?'GREEN':(water>70?'HIGH':'LOW'); }
  function updateHUD(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }
  function miss(){ combo=0; misses++; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }

  function judge(ch){
    if (GOOD.includes(ch)){
      const delta = 3+combo; combo++; score+=delta; water=Math.min(100,water+6); updateHUD();
      return { good:true, scoreDelta: delta };
    } else { // BAD
      if (zone()==='HIGH'){ score+=2; water=Math.max(0,water-6); }
      else { score=Math.max(0,score-4); water=Math.max(0,water-8); miss(); }
      updateHUD();
      return { good:false, scoreDelta: (zone()==='HIGH'?2:-4) };
    }
  }

  const handle = await bootFactory({
    host: cfg.host,
    difficulty: diff,
    duration: (diff==='easy'?90:diff==='hard'?45:60),
    pools: { good: GOOD, bad: BAD },
    goodRate: (diff==='easy'?0.75:diff==='hard'?0.6:0.68),
    judge
  });

  // time HUD
  let remain=(diff==='easy'?90:diff==='hard'?45:60);
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  const tId=setInterval(()=>{ remain=Math.max(0,remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) clearInterval(tId);
  },1000);

  return { stop(){handle.stop();}, pause(){handle.pause();}, resume(){handle.resume();} };
}
export default { boot };