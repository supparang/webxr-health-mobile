// Food Groups — DOM target
import { boot as bootFactory } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');

  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain:['🍞','🥖','🥯','🍚','🍙','🍘'],
    protein:['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦','🍨']
  };
  const ALL = Object.values(GROUPS).flat();
  const keys = Object.keys(GROUPS);
  let target = keys[(Math.random()*keys.length)|0];
  let need = 1, got = 0;

  const deck = new MissionDeck().draw3();
  function showGoal(){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้า: ${target.toUpperCase()} × ${need}`}})); }
  showGoal();

  let score=0, combo=0, misses=0;
  function updateHUD(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }
  function miss(){ combo=0; misses++; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }

  function judge(ch){
    const hit = GROUPS[target].includes(ch);
    if (hit){
      const delta = 3 + combo;
      combo++; score+=delta; got++;
      if (got>=need){ // เปลี่ยนเป้า + ขยับความยากทีละนิด
        target = keys[(Math.random()*keys.length)|0];
        need = Math.min(3, need+1); got=0; showGoal();
      }
      updateHUD();
      return { good:true, scoreDelta: delta };
    } else {
      miss(); score=Math.max(0,score-2); updateHUD();
      return { good:false, scoreDelta: -2 };
    }
  }

  const handle = await bootFactory({
    host: cfg.host,
    difficulty: diff,
    duration: (diff==='easy'?90:diff==='hard'?45:60),
    pools: { good: ALL, bad: [] },     // ใช้พูลเดียว ตัดสินจาก judge
    goodRate: 1.0,                      // ให้สุ่มจาก ALL แล้ว judge เอง
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