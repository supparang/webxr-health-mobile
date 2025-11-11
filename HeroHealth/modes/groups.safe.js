// === /HeroHealth/modes/groups.safe.js (Fever + Power-ups + Wave) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GROUPS = {
    veg: ['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],
    fruit: ['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain: ['🍞','🥖','🥯','🥐','🍚','🍙','🍘'],
    protein: ['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy: ['🥛','🧀','🍦','🍨','🍮']
  };
  const ALL = Object.values(GROUPS).flat();
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const BONUS=[STAR,DIA,SHIELD];

  ensureFeverBar(); setFever(0); setShield(0);

  const deck = new MissionDeck(); deck.draw3();
  let wave=1; questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive && fever>=100){ feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d=feverActive?10:base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive && fever<=0){ feverActive=false; setFeverActive(false);} }

  // เป้าหมาย: group × need (เพิ่มยากขึ้นเมื่อสำเร็จ)
  let targetKey = Object.keys(GROUPS)[(Math.random()*5)|0];
  let targetNeed=2, targetHit=0;
  function setNewGoal(){ const ks=Object.keys(GROUPS); targetKey=ks[(Math.random()*ks.length)|0]; targetNeed=Math.min(3,targetNeed+1); targetHit=0;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้า: เลือกกลุ่ม ${targetKey.toUpperCase()} × ${targetNeed}`}})); }

  function judge(ch, ctx){
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); Particles.burstShards(null,{x:ctx.cx,y:ctx.cy,z:0},{theme:'groups'}); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); Particles.burstShards(null,{x:ctx.cx,y:ctx.cy,z:0},{theme:'goodjunk'}); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; return {good:true,scoreDelta:20}; }

    const inTarget = GROUPS[targetKey].includes(ch);
    if (inTarget){
      const base=25 + combo*2;
      const delta = base * mult();
      score += delta; combo+=1; targetHit+=1;
      gainFever(8 + combo*0.6);
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null,{x:ctx.cx,y:ctx.cy,z:0},{theme:'groups'});
      if (targetHit>=targetNeed) setNewGoal();
      return {good:true, scoreDelta:delta};
    } else if (ALL.includes(ch)){
      if (shield>0){ shield-=1; setShield(shield); Particles.burstShards(null,{x:ctx.cx,y:ctx.cy,z:0},{theme:'hydration'}); return {good:false,scoreDelta:0}; }
      const delta=-12; score=Math.max(0,score+delta); combo=0; decayFever(18);
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      Particles.burstShards(null,{x:ctx.cx,y:ctx.cy,z:0},{theme:'plate'});
      return {good:false, scoreDelta:delta};
    }
    return {good:false, scoreDelta:0};
  }

  function onExpire(ev){ if (!ev || ev.isGood) return; gainFever(4); deck.onJunk(); deck.updateScore(score); questHUDUpdate(deck,`Wave ${wave}`); }
  function onHitScreen(){ questHUDUpdate(deck,`Wave ${wave}`); if(deck.isCleared()){ wave+=1; deck.draw3(); questHUDUpdate(deck,`Wave ${wave}`);} }
  function onSec(){ if (combo<=0) decayFever(6); else decayFever(2); deck.second(); deck.updateScore(score); questHUDUpdate(deck,`Wave ${wave}`); }

  window.addEventListener('hha:hit-screen', onHitScreen);
  window.addEventListener('hha:expired',    onExpire);
  window.addEventListener('hha:time',       onSec);

  const onEnd=()=>{ try{
    window.removeEventListener('hha:hit-screen', onHitScreen);
    window.removeEventListener('hha:expired',    onExpire);
    window.removeEventListener('hha:time',       onSec);
    questHUDDispose();
    const progNow=deck.getProgress(), clearedNow=progNow.filter(q=>q.done).length;
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Food Groups', difficulty:diff, score, comboMax:deck.stats.comboMax,
      misses:deck.stats.junkMiss, hits:deck.stats.goodCount, duration:dur,
      goalCleared: (targetHit>=targetNeed),
      questsCleared: (wave-1)*3 + clearedNow, questsTotal: wave*3
    }}));
  }catch{} };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...ALL, ...BONUS], bad:[] },
    goodRate  : 1.0,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time',(e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้า: เลือกกลุ่ม ${targetKey.toUpperCase()} × ${targetNeed}`}}));
    return ctrl;
  });
}
export default { boot };
