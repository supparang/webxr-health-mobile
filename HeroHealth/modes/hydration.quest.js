// === /HeroHealth/modes/hydration.quest.js (Water gauge + Fever + Power-ups + Wave Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const WATER = ['💧','🚰','🥤','🧊'];
  const DRY   = ['☕','🍵','🍺','🥫']; // ตัวล่อ (ไม่เพิ่มน้ำ)
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar(); setFever(0); setShield(0);
  ensureWaterGauge(); setWaterGauge(55); // เริ่มกลางๆ

  // Wave quests (สุ่มจากพูล default ของ MissionDeck)
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1, totalCleared = 0;
  questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  // State
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;
  let water=55; // 0..100

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever = Math.max(0, Math.min(100, fever + n)); setFever(fever); if (!feverActive && fever>=100){ feverActive=true; setFeverActive(true); } }
  function decayFever(base){ const d = feverActive ? 10 : base; fever = Math.max(0, fever - d); setFever(fever); if (feverActive && fever<=0){ feverActive=false; setFeverActive(false); } }

  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function setWater(n){ water = clamp(n,0,100); setWaterGauge(water); }

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // Power-ups
    if (ch===STAR){ const d=35*mult(); score+=d; gainFever(10);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'hydration' }); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=70*mult(); score+=d; gainFever(28);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'groups' }); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=18;
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'goodjunk' }); return {good:true, scoreDelta:18}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever = Math.max(fever, 60); setFever(fever); score+=20;
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'plate' }); return {good:true, scoreDelta:20}; }

    const isWater = WATER.includes(ch);
    if (isWater){
      const add   = (diff==='easy'?8: (diff==='hard'?5:6));
      setWater(water + add);
      const base  = 16 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.5);
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'hydration' });
      return { good:true, scoreDelta: delta };
    } else {
      // DRY / lure
      if (shield>0){ shield-=1; setShield(shield);
        Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'plate' });
        return {good:false, scoreDelta:0};
      }
      // กินของ “แห้ง” — ลดน้ำ + หักคะแนนเบาๆ + reset combo
      const sub = (diff==='easy'?6: (diff==='hard'?10:8));
      setWater(water - sub);
      const delta = -12;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(16);
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'groups' });
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หลีก “ล่อแห้ง” สำเร็จ → รักษาน้ำ
    gainFever(4); deck.onJunk(); deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  function onHitScreen(){
    const before = deck.getProgress().filter(q=>q.done).length;
    questHUDUpdate(deck, `Wave ${wave}`);
    const after  = deck.getProgress().filter(q=>q.done).length;
    if (after > before && deck.isCleared()){
      totalCleared += 3; deck.draw3(); questHUDUpdate(deck, `Wave ${++wave}`);
    }
  }

  function onSec(){
    // น้ำปรับเข้าสู่สมดุลช้า ๆ
    if (water > 55) setWater(water - 1);
    else if (water < 55) setWater(water + 1);

    // Fever ลดเอง
    if (combo<=0) decayFever(6); else decayFever(2);

    // อัปเดต quest ต่อวินาที
    deck.second(); deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  const onEnd = () => {
    try{
      window.removeEventListener('hha:hit-screen', onHitScreen);
      window.removeEventListener('hha:expired',    onExpire);
      window.removeEventListener('hha:time',       onSec);
      const clearedNow = deck.getProgress().filter(q=>q.done).length;
      const questsCleared  = totalCleared + clearedNow;
      const questsTotal    = (wave-1)*3 + 3;

      questHUDDispose();
      const goalOK = zoneFrom(water)==='GREEN';
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Hydration', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared: goalOK, questsCleared, questsTotal
      }}));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...WATER, ...BONUS], bad:[...DRY] },
    goodRate  : 0.60,
    powerups  : BONUS,
    powerRate : 0.08,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    return ctrl;
  });
}
export default { boot };
