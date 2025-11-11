// === /HeroHealth/modes/hydration.quest.js (Fever + Water + Power-ups + Wave) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom, floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  ensureWaterGauge();
  ensureFeverBar();
  let water=55; setWaterGauge(water); setFever(0); setShield(0);

  const GOOD = ['💧','🚰','🥛','🍊','🍋'];
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const BONUS=[STAR,DIA,SHIELD];

  const deck = new MissionDeck(); deck.draw3();
  let wave=1; questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  let score=0, combo=0, shield=0;
  let fever=0, feverActive=false;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive && fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(base){ const d = feverActive ? 10 : base; fever=Math.max(0,fever-d); setFever(fever); if(feverActive && fever<=0){ feverActive=false; setFeverActive(false); } }

  function judge(ch, ctx){
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(10); floatScoreScreen(ctx.cx,ctx.cy,'+40 ⭐'); burstAtScreen(ctx.cx,ctx.cy,{color:'#fde047'}); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(30); floatScoreScreen(ctx.cx,ctx.cy,'+80 💎'); burstAtScreen(ctx.cx,ctx.cy,{color:'#a78bfa'}); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; floatScoreScreen(ctx.cx,ctx.cy,'🛡️+20'); return {good:true,scoreDelta:20}; }

    if (GOOD.includes(ch)){
      const base = 20 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(8 + combo*0.6);
      water = Math.min(100, water + 6);
      setWaterGauge(water);
      floatScoreScreen(ctx.cx, ctx.cy, '+'+delta);
      burstAtScreen(ctx.cx, ctx.cy, {color:'#22c55e'});
      deck.onGood(); deck.updateCombo(combo); deck.updateScore(score);
      return {good:true, scoreDelta:delta};
    } else {
      // BAD
      if (shield>0){ shield-=1; setShield(shield); floatScoreScreen(ctx.cx,ctx.cy,'Shield!'); return {good:false,scoreDelta:0}; }
      const z = zoneFrom(water);
      if (z==='HIGH'){ score += 5; floatScoreScreen(ctx.cx,ctx.cy,'+5 (High)'); }
      else { score=Math.max(0, score-20); combo=0; floatScoreScreen(ctx.cx,ctx.cy,'-20'); }
      water = Math.max(0, water - 8);
      setWaterGauge(water);
      decayFever(18);
      burstAtScreen(ctx.cx, ctx.cy, {color:'#ef4444'});
      deck.onJunk(); deck.updateCombo(combo); deck.updateScore(score);
      return {good:false, scoreDelta:(z==='HIGH'?5:-20)};
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    gainFever(4);
    deck.onJunk(); deck.updateScore(score);
    questHUDUpdate(deck, `Wave ${wave}`);
  }

  let balancedSec=0;
  function onSec(){
    if (zoneFrom(water)==='GREEN') balancedSec++;
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); deck.updateScore(score); questHUDUpdate(deck, `Wave ${wave}`);
  }

  function onHitScreen(){
    questHUDUpdate(deck, `Wave ${wave}`);
    if (deck.isCleared()){ wave+=1; deck.draw3(); questHUDUpdate(deck, `Wave ${wave}`); }
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
      const totalCleared  = (wave-1)*3 + clearedNow;
      const totalPossible = wave*3;
      const goalTarget = (diff==='easy'?10:(diff==='hard'?20:15));
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{
        mode:'Hydration', difficulty:diff, score,
        comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
        duration:dur, goalCleared: balancedSec>=goalTarget, questsCleared: totalCleared, questsTotal: totalPossible
      }}));
    }catch{}
  };

  return factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...BAD] },
    goodRate  : 0.62,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  }).then(ctrl=>{
    window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)<=0) onEnd(); });
    return ctrl;
  });
}
export default { boot };
