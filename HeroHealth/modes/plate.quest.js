// Healthy Plate — DOM target, เก็บครบ 5 หมู่วนรอบ
import { boot as bootFactory } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');

  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦'],
  };
  const ALL = Object.values(GROUPS).flat();

  const deck = new MissionDeck().draw3();
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest 1/3 — ${deck[0].label}`}}));

  let done = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
  let score=0, combo=0, misses=0;

  function roundCleared(){ return Object.values(done).every(Boolean); }
  function updateHUD(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }
  function miss(){ combo=0; misses++; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }

  function judge(ch){
    // โหมดนี้: ทุกอันถือว่า “ดี” แต่ให้คะแนนเพิ่มถ้าทำครบหมู่ใหม่
    const delta = 2 + combo;
    combo++; score += delta;
    // ติ๊กหมู่ที่ได้
    for (const k in GROUPS) if (GROUPS[k].includes(ch)) done[k]=true;
    if (roundCleared()){ score += 50; done={veg:false,fruit:false,grain:false,protein:false,dairy:false}; }
    updateHUD();
    return { good:true, scoreDelta: delta };
  }

  const handle = await bootFactory({
    host: cfg.host,
    difficulty: diff,
    duration: (diff==='easy'?90:diff==='hard'?45:60),
    pools: { good: ALL, bad: [] },
    goodRate: 1.0,
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