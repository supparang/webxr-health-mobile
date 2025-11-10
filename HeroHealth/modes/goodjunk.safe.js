// Good vs Junk — DOM target, no THREE
import { boot as bootFactory } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');

  // พูลอีโมจิ
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  // deck เควสต์ 3 ใบ
  const deck = new MissionDeck().draw3();
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest 1/3 — ${deck[0].label}`}}));

  let stats = { score:0, combo:0, hits:0, misses:0 };
  function updateHUD(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:stats.score, combo:stats.combo}})); }
  function miss(){ stats.combo=0; stats.misses++; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:stats.misses}})); }

  // ให้โรงงานตัดสิน “ของดี/ขยะ” และคืน delta คะแนน
  function judge(ch){
    const good = GOOD.includes(ch);
    const delta = good ? (2 + stats.combo) : -3;
    if (good) { stats.combo++; stats.hits++; }
    else { miss(); }
    stats.score = Math.max(0, stats.score + delta);
    // อัปเดตเควสต์
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:
      `Quest ${Math.min(3, (new MissionDeck()._autoAdvance?0:0)+1)}/3 — ${deck[0].label}`}})); // ป้ายคงไว้เรียบง่าย
    updateHUD();
    return { good, scoreDelta: delta };
  }

  const handle = await bootFactory({
    host: cfg.host,
    difficulty: diff,
    duration: (diff==='easy'?90:diff==='hard'?45:60),
    pools: { good: GOOD, bad: JUNK },
    goodRate: (diff==='easy'?0.78:diff==='hard'?0.58:0.68),
    judge
  });

  // timer HUD
  let remain = (diff==='easy'?90:diff==='hard'?45:60);
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  const tId = setInterval(()=>{ remain=Math.max(0,remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0){ clearInterval(tId); }
  },1000);

  return { stop(){ try{handle.stop();}catch{} }, pause(){ handle.pause(); }, resume(){ handle.resume(); } };
}
export default { boot };