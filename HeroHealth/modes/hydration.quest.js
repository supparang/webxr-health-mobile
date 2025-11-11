// === /HeroHealth/modes/hydration.quest.js (wave quests; water gauge; cumulative summary) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom, burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // Water HUD
  ensureWaterGauge();
  let water = 55; setWaterGauge(water);

  // Pools
  const GOOD = ['💧','🚰','🥛','🍊','🍋']; // +น้ำ
  const BAD  = ['🧋','🥤','🍹','🧃','🍺']; // -น้ำ
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const BONUS = [STAR, DIA, SHIELD];

  // Quest deck
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1;

  let score = 0, combo = 0;
  let balancedSec = 0;   // เป้า Goal: Balanced ต่อเนื่อง
  const goalTarget = (diff==='easy'?10:(diff==='hard'?20:15));

  questHUDInit();
  questHUDUpdate(deck, `Wave ${wave}`);

  function judge(ch, ctx){
    // Power-ups
    if (ch===STAR){ score+=40; floatScoreScreen(ctx.cx, ctx.cy, '+40 ⭐'); burstAtScreen(ctx.cx, ctx.cy, {color:'#fde047'}); return {good:true, scoreDelta:40}; }
    if (ch===DIA){ score+=80; floatScoreScreen(ctx.cx, ctx.cy, '+80 💎'); burstAtScreen(ctx.cx, ctx.cy, {color:'#a78bfa'}); return {good:true, scoreDelta:80}; }
    if (ch===SHIELD){ score+=20; floatScoreScreen(ctx.cx, ctx.cy, '🛡️+20'); return {good:true, scoreDelta:20}; }

    if (GOOD.includes(ch)) {
      const delta = 20 + combo*2; score += delta; combo++;
      water = Math.min(100, water + 6);
      setWaterGauge(water);
      floatScoreScreen(ctx.cx, ctx.cy, '+'+delta);
      burstAtScreen(ctx.cx, ctx.cy, {color:'#22c55e'});
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      return { good:true, scoreDelta: delta };
    } else {
      // BAD → ถ้าเกินน้ำ (HIGH) ให้ +5, ถ้าไม่ใช่ลดคะแนนแรงและลดน้ำ
      const z = zoneFrom(water);
      if (z==='HIGH'){ score+=5; floatScoreScreen(ctx.cx, ctx.cy, '+5 (High)'); }
      else { score=Math.max(0, score-20); combo=0; floatScoreScreen(ctx.cx, ctx.cy, '-20'); }
      water = Math.max(0, water - 8);
      setWaterGauge(water);
      burstAtScreen(ctx.cx, ctx.cy, {color:'#ef4444'});
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      return { good:false, scoreDelta: (z==='HIGH'?5:-20) };
    }
  }

  // “หลบขยะ” นับ mini quest สำหรับ hydration ด้วย
  function onExpire(ev){
    if (!ev || ev.isGood) return;
    deck.onJunk();
    deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  // หนึ่งวินาที/ครั้ง
  function onSec(){
    const z = zoneFrom(water);
    if (z==='GREEN') balancedSec += 1;
    deck.second();
    deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  function onHitScreen(){
    // อัปเดต HUD, เช็คผ่านครบ 3 ใบ → เวฟใหม่
    questHUDUpdate(deck, `Wave ${wave}`);
    if (deck.isCleared()) {
      wave += 1;
      deck.draw3();
      questHUDUpdate(deck, `Wave ${wave}`);
    }
  }

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

      window.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'Hydration',
          difficulty: diff,
          score,
          comboMax: deck.stats.comboMax,
          misses: deck.stats.junkMiss,
          hits: deck.stats.goodCount,
          duration: dur,
          goalCleared: balancedSec >= goalTarget,
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
    pools     : { good:[...GOOD, ...BONUS], bad:[...BAD] },
    goodRate  : 0.62,
    judge     : (ch, ctx) => judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    return ctrl;
  });
}

export default { boot };
