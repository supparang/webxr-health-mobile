// === /HeroHealth/modes/plate.safe.js (Healthy Plate + Fever + Power-ups + Wave Quests) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // แนวคิด: เน้นวัตถุดิบ “จานสุขภาพ” → โปรตีน/ผัก/ผลไม้/ข้าว-แป้ง/นม
  const PLATE_GOOD = [
    // โปรตีน
    '🥩','🥚','🐟','🍗','🫘',
    // ผัก
    '🥦','🥕','🥬','🍅','🌽','🍆',
    // ผลไม้
    '🍎','🍌','🍇','🍊','🍓','🍍','🥝','🍐',
    // ข้าว-แป้ง
    '🍚','🍞','🥖','🌾','🥐',
    // นม/นมถั่วเหลือง
    '🥛','🧀'
  ];
  const LURE = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬']; // ของล่อ/ขยะ
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // HUD
  ensureFeverBar(); setFever(0); setShield(0);

  // Wave mini-quests
  const deck = new MissionDeck(); deck.draw3();
  let wave = 1, totalCleared = 0;
  questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  // State
  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100){ feverActive = true; setFeverActive(true); }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0){ feverActive = false; setFeverActive(false); }
  }

  function judge(ch, ctx){
    const cx = ctx.cx ?? ctx.clientX, cy = ctx.cy ?? ctx.clientY;

    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' }); return {good:true, scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'groups' }); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'hydration' }); return {good:true, scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever = Math.max(fever, 60); setFever(fever); score+=25;
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'goodjunk' }); return {good:true, scoreDelta:25}; }

    const isGood = PLATE_GOOD.includes(ch);
    if (isGood){
      const base  = 18 + combo*2;           // จานสุขภาพ เน้น “ต่อคอมโบแล้วคุ้ม”
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.55);
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
      return { good:true, scoreDelta: delta };
    }else{
      if (shield>0){ shield-=1; setShield(shield);
        Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'plate' });
        return {good:false, scoreDelta:0};
      }
      const delta = -14;
      score = Math.max(0, score + delta); combo = 0;
      decayFever(18);
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null, null, { screen:{x:cx,y:cy}, theme:'groups' });
      return { good:false, scoreDelta: delta };
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // หลีกขยะได้ → ส่งผลกับเควสต์ (nomiss / balanced)
    gainFever(4);
    deck.onJunk(); deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  function onHitScreen(){
    const before = deck.getProgress().filter(q=>q.done).length;
    questHUDUpdate(deck, `Wave ${wave}`);
    const after  = deck.getProgress().filter(q=>q.done).length;

    if (after > before && deck.isCleared()){
      totalCleared += 3;
      deck.draw3();
      questHUDUpdate(deck, `Wave ${++wave}`);
    }
  }

  function onSec(){
    // Fever ค่อย ๆ ลดเอง (ไวขึ้นถ้าไม่คอมโบ)
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

      const clearedNow   = deck.getProgress().filter(q=>q.done).length;
      const questsCleared= totalCleared + clearedNow;
      const questsTotal  = (wave-1)*3 + 3;

      questHUDDispose();
      const goalOK = score >= 450; // เป้าหมายโหมด Plate ตามที่ตกลง (>=450)
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Healthy Plate', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared: goalOK, questsCleared, questsTotal
      }}));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...PLATE_GOOD, ...BONUS], bad:[...LURE] },
    goodRate  : 0.62,
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
