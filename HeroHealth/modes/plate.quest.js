// === /HeroHealth/modes/plate.quest.js (wave quests; cumulative summary) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GROUPS = {
    veg: ['🥦','🥕','🥬','🍅','🌽'],
    fruit: ['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain: ['🍞','🥖','🍚','🍘'],
    protein: ['🐟','🍗','🥚','🫘','🥜'],
    dairy: ['🥛','🧀','🍦'],
  };
  const ALL = Object.values(GROUPS).flat();
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const BONUS=[STAR,DIA,SHIELD];

  // รอบ “จัดครบ 5 หมู่”
  let round = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
  let roundsDone = 0;

  const deck = new MissionDeck(); deck.draw3();
  let wave = 1;

  let score=0, combo=0;

  function judge(ch, ctx){
    if (ch===STAR){ score+=40; Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'plate'}); return {good:true, scoreDelta:40}; }
    if (ch===DIA){  score+=80; Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'groups'}); return {good:true, scoreDelta:80}; }
    if (ch===SHIELD){ score+=20; return {good:true, scoreDelta:20}; }

    // หาหมู่ของ ch
    let inKey=null;
    for (const k of Object.keys(GROUPS)){ if (GROUPS[k].includes(ch)) { inKey=k; break; } }

    if (inKey){
      const delta = 22 + combo*2; score += delta; combo++;
      round[inKey] = true;
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'goodjunk'});

      // ครบ 5 หมู่ = รอบสำเร็จ
      if (Object.values(round).every(Boolean)){
        roundsDone += 1;
        score += 100;
        // เริ่มรอบใหม่
        round = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
      }
      return { good:true, scoreDelta: delta };
    }else{
      // อื่น ๆ (ไม่น่ามี) → โทษเบา ๆ
      const delta = -8; score=Math.max(0,score+delta); combo=0;
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, {x:ctx.cx||0,y:ctx.cy||0,z:0}, {theme:'plate'});
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
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

      const goalCleared = Object.values(round).every(Boolean);

      window.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'Healthy Plate',
          difficulty: diff,
          score,
          comboMax: deck.stats.comboMax,
          misses: deck.stats.junkMiss,
          hits: deck.stats.goodCount,
          duration: dur,
          goalCleared,
          questsCleared: totalCleared,
          questsTotal: totalPossible,
          reason:'timeout',
          roundsDone
        }
      }));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...ALL, ...BONUS], bad:[] },
    goodRate  : 1.0,
    judge     : (ch, ctx) => judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    return ctrl;
  });
}

export default { boot };
