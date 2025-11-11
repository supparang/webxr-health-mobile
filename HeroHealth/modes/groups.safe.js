// === /HeroHealth/modes/groups.safe.js (wave quests; cumulative summary) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // Food groups (เลือกให้ถูกหมู่เป้าหมาย)
  const GROUPS = {
    veg:     ['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],
    fruit:   ['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain:   ['🍞','🥖','🥯','🥐','🍚','🍙','🍘'],
    protein: ['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy:   ['🥛','🧀','🍦','🍨','🍮']
  };
  const ALL = Object.values(GROUPS).flat();

  // เป้าหมายปัจจุบัน: random group × targetN
  let targetKey = Object.keys(GROUPS)[(Math.random()*5)|0];
  let targetNeed = 2;
  let targetHit  = 0;

  // Deck
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1;

  let score=0, combo=0;

  function setNewGoal(){
    const keys = Object.keys(GROUPS);
    targetKey  = keys[(Math.random()*keys.length)|0];
    targetNeed = Math.min(3, targetNeed + 1);  // ยากขึ้นทีละนิดเมื่อทำถึง
    targetHit  = 0;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้า: เลือกกลุ่ม ${targetKey.toUpperCase()} × ${targetNeed}`}}));
  }

  questHUDInit();
  questHUDUpdate(deck, `Wave ${wave}`);

  function judge(ch, ctx){
    const inTarget = GROUPS[targetKey].includes(ch);
    if (inTarget) {
      const delta = 25 + combo*2; score += delta; combo++;
      targetHit += 1;
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'groups'});
      if (targetHit >= targetNeed) { setNewGoal(); }
      return { good:true, scoreDelta: delta };
    } else if (ALL.includes(ch)) {
      // ผิดหมู่ → โทษ
      const delta = -12; score = Math.max(0, score + delta); combo = 0;
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'plate'});
      return { good:false, scoreDelta: delta };
    } else {
      // เผื่อมีตัวอื่น (จะไม่เกิดใน config นี้)
      return { good:false, scoreDelta: 0 };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // ถือเป็น “หลบของผิดหมู่” → ใช้ onJunk เพื่อเควสต์หลบ
    deck.onJunk(); deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  function onHitScreen(){
    questHUDUpdate(deck, `Wave ${wave}`);
    if (deck.isCleared()) {
      wave += 1;
      deck.draw3();
      questHUDUpdate(deck, `Wave ${wave}`);
    }
  }

  function onSec(){ deck.second(); deck.updateScore(score); questHUDUpdate(deck, `Wave ${wave}`); }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  const onEnd = () => {
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
      questHUDDispose();

      const progNow       = deck.getProgress();
      const clearedNow    = progNow.filter(q => q.done).length;
      const totalCleared  = (wave - 1) * 3 + clearedNow;
      const totalPossible = wave * 3;

      const goalCleared = (targetHit >= targetNeed); // สถานะตอนหมดเวลา

      window.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'Food Groups',
          difficulty: diff,
          score,
          comboMax: deck.stats.comboMax,
          misses: deck.stats.junkMiss,
          hits: deck.stats.goodCount,
          duration: dur,
          goalCleared,
          questsCleared: totalCleared,
          questsTotal: totalPossible,
          reason:'timeout'
        }
      }));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...ALL], bad:[] },    // ปล่อยสุ่มทั้งหมด แล้ว judge แยกว่าถูกหมู่/ผิดหมู่
    goodRate  : 1.0,                           // ทั้งหมดเป็น food, ตัดสินถูก/ผิดใน judge
    judge     : (ch, ctx) => judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    // แสดงเป้าแรก
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้า: เลือกกลุ่ม ${targetKey.toUpperCase()} × ${targetNeed}`}}));
    return ctrl;
  });
}

export default { boot };
