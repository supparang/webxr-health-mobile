// === /HeroHealth/modes/plate.safe.js (Full, 5 หมู่ + โควตา + power-ups) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createPlateQuest, QUOTA } from './plate.quest.js';

const GROUPS = {
  1: ['🍚','🍙','🍞','🥯','🥐'],
  2: ['🥩','🍗','🍖','🥚','🧀'],
  3: ['🥦','🥕','🥬','🌽','🥗','🍅'],
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],
  5: ['🥛','🧈','🧀','🍨']
};
const GOOD = Object.values(GROUPS).flat();
const BAD  = ['🍔','🍟','🍕','🍩','🍪','🧋','🥤','🍫','🍬','🥓'];

const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

function foodGroup(emo){ for(const [g,arr] of Object.entries(GROUPS)){ if(arr.includes(emo)) return +g; } return 0; }

export async function boot(cfg={}){
  const diff=(cfg.difficulty||'normal').toLowerCase();
  const dur =(cfg.duration|0)||60;

  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);

  const deck = createPlateQuest(diff); deck.drawGoals(2); deck.draw3();
  // group counts (1..5) zero-based index 0..4
  const need = QUOTA[diff] || QUOTA.normal;
  const gCounts=[0,0,0,0,0];
  let accMiniDone=0, accGoalDone=0;

  function pushQuest(hint){
    const goals=deck.getProgress('goals'), minis=deck.getProgress('mini');
    const gtxt = `โควตา: [${need.join(', ')}] | ทำได้: [${gCounts.join(', ')}]`;
    window.dispatchEvent(new CustomEvent('quest:update',{detail:{
      goal:(goals.find(g=>!g.done)||goals[0]||null),
      mini:(minis.find(m=>!m.done)||minis[0]||null),
      goalsAll:goals, minisAll:minis, hint:gtxt
    }}));
  }

  // state
  let score=0, combo=0, comboMax=0, misses=0;
  let star=0, diamond=0, shield=0, fever=0, feverActive=false;

  function mult(){ return feverActive?2:1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever); if(!feverActive&&fever>=100){feverActive=true; setFeverActive(true);} }
  function decayFever(n){ const d=feverActive?10:n; fever=Math.max(0,fever-d); setFever(fever); if(feverActive&&fever<=0){feverActive=false; setFeverActive(false);} }
  function syncDeck(){ deck.updateScore(score); deck.updateCombo(combo); deck.stats.gCounts=[...gCounts]; deck.stats.star=star; deck.stats.diamond=diamond; }

  function scoreFX(x,y,val,theme){ Particles.scorePop(x,y,(val>0?'+':'')+val); Particles.burstShards(null,null,{screen:{x,y},theme:theme||'plate'}); }

  function judge(ch, ctx){
    const x=ctx.clientX||ctx.cx||0, y=ctx.clientY||ctx.cy||0;
    // power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d); return {good:true,scoreDelta:d}; }
    if (ch===DIA) { const d=80*mult(); score+=d; diamond++; gainFever(30); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,20); return {good:true,scoreDelta:20}; }
    if (ch===FIRE) { feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,25); return {good:true,scoreDelta:25}; }

    const g = foodGroup(ch);
    if (g>0){
      const d=(16+combo*2)*mult();
      score+=d; combo++; comboMax=Math.max(comboMax,combo); gainFever(6+combo*0.4);
      gCounts[g-1] = (gCounts[g-1]|0) + 1;
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x,y,d,'plate');
      return {good:true, scoreDelta:d};
    }else{
      if (shield>0){ shield--; setShield(shield); decayFever(6); syncDeck(); pushQuest(); scoreFX(x,y,0,'groups'); return {good:false,scoreDelta:0}; }
      const d=-12; score=Math.max(0,score+d); combo=0; misses++; decayFever(16); deck.onJunk(); syncDeck(); pushQuest(); scoreFX(x,y,d,'groups');
      return {good:false, scoreDelta:d};
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    misses++; deck.onJunk(); syncDeck(); pushQuest();
  }

  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck();

    const g=deck.getProgress('goals'), m=deck.getProgress('mini');
    if (g.length>0 && g.every(x=>x.done)){ accGoalDone+=g.length; deck.drawGoals(2); pushQuest('Goal ใหม่'); }
    if (m.length>0 && m.every(x=>x.done)){ accMiniDone+=m.length; deck.draw3();       pushQuest('Mini ใหม่'); }
  }

  return factoryBoot({
    difficulty:diff, duration:dur,
    pools:{good:[...GOOD,...BONUS], bad:[...BAD]},
    goodRate:0.64, powerups:BONUS, powerRate:0.10, powerEvery:7,
    judge:(ch,ctx)=>judge(ch,ctx), onExpire
  }).then(ctrl=>{
    pushQuest('เริ่ม • โควตา: '+need.join('-'));
    window.addEventListener('hha:time',(e)=>{
      const sec=(e.detail?.sec|0);
      if (sec>=0) onSec();
      if (sec===0){
        const g=deck.getProgress('goals'), m=deck.getProgress('mini');
        const goalCleared=g.length>0 && g.every(x=>x.done);
        const goalsTotal  = accGoalDone + g.length;
        const goalsDone   = accGoalDone + g.filter(x=>x.done).length;
        const miniTotal   = accMiniDone + m.length;
        const miniDone    = accMiniDone + m.filter(x=>x.done).length;
        window.dispatchEvent(new CustomEvent('hha:end',{detail:{
          mode:'Balanced Plate', difficulty:diff, score, misses, comboMax, duration:dur,
          goalCleared, goalsCleared:goalsDone, goalsTotal, questsCleared:miniDone, questsTotal:miniTotal
        }}));
      }
    });
    return ctrl;
  });
}
export default { boot };