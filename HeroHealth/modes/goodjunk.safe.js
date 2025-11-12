// === /HeroHealth/modes/goodjunk.safe.js (Fever + Power-ups + Wave Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // HUD init
  ensureFeverBar(); setFever(0); setShield(0);

  // Wave quests
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1;
  let totalCleared = 0; // นับสะสมทุก wave
  questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  // State
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever = Math.max(0, Math.min(100, fever + n)); setFever(fever); if (!feverActive && fever>=100){ feverActive=true; setFeverActive(true); } }
  function decayFever(base){ const d = feverActive ? 10 : base; fever = Math.max(0, fever - d); setFever(fever); if (feverActive && fever<=0){ feverActive=false; setFeverActive(false); } }

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'goodjunk' });
      return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'groups' });
      return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'hydration' });
      return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever = Math.max(fever, 60); setFever(fever); score+=25;
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'plate' });
      return {good:true, scoreDelta:25}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      const base = 20 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(8 + combo*0.6);
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'goodjunk' });
      return { good:true, scoreDelta: delta };
    } else {
      // Junk →
      if (shield>0){ shield-=1; setShield(shield);
        Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'hydration' });
        return {good:false, scoreDelta:0};
      }
      const delta = -15;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{ x:cx, y:cy }, theme:'plate' });
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return; // นับเฉพาะ "หลีกขยะ"
    gainFever(4);
    deck.onJunk(); deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  function onHitScreen(){
    const before = deck.getProgress().filter(q=>q.done).length;
    questHUDUpdate(deck, `Wave ${wave}`);
    const after  = deck.getProgress().filter(q=>q.done).length;

    // กรณีบรรลุเควสต์ใหม่
    if (after > before) {
      // ถ้าเคลียร์ครบ 3 ใบ → สุ่ม wave ใหม่ทันทีถ้าเวลาเหลือ
      if (deck.isCleared()){
        totalCleared += 3;
        deck.draw3();
        questHUDUpdate(deck, `Wave ${++wave}`);
      }
    }
  }

  function onSec(){
    // ลดเองตามคอมโบ
    if (combo<=0) decayFever(6); else decayFever(2);
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
      const questsTotal    = (wave-1)*3 + 3; // wave-1 เคลียร์ไปแล้ว + wave ปัจจุบัน

      questHUDDispose();
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Good vs Junk', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared: score>=500, questsCleared, questsTotal
      }}));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.65,
    // เปิดการสุ่ม power-ups ในโรงงาน
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
