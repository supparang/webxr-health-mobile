// === /HeroHealth/modes/goodjunk.safe.js (Full Pack) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createGoodJunkQuest } from './goodjunk.quest.js';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty||'normal').toLowerCase();
  const dur  = Number(cfg.duration||60);

  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);

  // Quest director (2 goals + 3 minis, auto-refill)
  const deck = createGoodJunkQuest(diff);
  deck.drawGoals(2);
  deck.draw3();

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail:{
        goal: (goals.find(g=>!g.done) || goals[0] || null),
        mini: (minis.find(m=>!m.done) || minis[0] || null),
        goalsAll: goals, minisAll: minis, hint
      }
    }));
  }

  // Stats
  let score=0, combo=0, comboMax=0, misses=0;
  let star=0, diamond=0, shield=0, fever=0, feverActive=false;

  // Accumulators across waves
  let accMiniDone=0, accGoalDone=0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){ fever=Math.max(0,Math.min(100,fever+n)); setFever(fever);
    if(!feverActive && fever>=100){ feverActive=true; setFeverActive(true); } }
  function decayFever(n){ const d = feverActive?10:n; fever=Math.max(0,fever-d); setFever(fever);
    if(feverActive && fever<=0){ feverActive=false; setFeverActive(false); } }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  function scoreFX(x,y,delta,theme){
    try{
      Particles.scorePop(x,y,(delta>0?'+':'')+delta);
      Particles.burstShards(null,null,{screen:{x,y},theme:theme||'goodjunk'});
    }catch(_){}
  }

  function judge(ch, ctx){
    const x=ctx.clientX||ctx.cx||0, y=ctx.clientY||ctx.cy||0;
    // Power-ups
    if (ch===STAR){ const d=40*mult(); score+=d; star++; gainFever(10); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d,'goodjunk'); return {good:true, scoreDelta:d}; }
    if (ch===DIA) { const d=80*mult(); score+=d; diamond++; gainFever(30); deck.onGood(); combo++; comboMax=Math.max(comboMax,combo); syncDeck(); pushQuest(); scoreFX(x,y,d,'goodjunk'); return {good:true, scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3,shield+1); setShield(shield); score+=20; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,20,'goodjunk'); return {good:true, scoreDelta:20}; }
    if (ch===FIRE) { feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; deck.onGood(); syncDeck(); pushQuest(); scoreFX(x,y,25,'goodjunk'); return {good:true, scoreDelta:25}; }

    if (GOOD.includes(ch)){
      const d=(16+combo*2)*mult();
      score+=d; combo++; comboMax=Math.max(comboMax,combo);
      gainFever(7+combo*0.5);
      deck.onGood(); syncDeck(); pushQuest();
      scoreFX(x,y,d,'goodjunk');
      return {good:true, scoreDelta:d};
    }else{
      if (shield>0){ shield--; setShield(shield); decayFever(6); syncDeck(); pushQuest(); scoreFX(x,y,0,'groups'); return {good:false, scoreDelta:0}; }
      const d=-12; score=Math.max(0,score+d); combo=0; misses++; decayFever(16);
      deck.onJunk(); syncDeck(); pushQuest();
      scoreFX(x,y,d,'groups');
      return {good:false, scoreDelta:d};
    }
  }

  function onExpire(ev){
    if (!ev || ev.isGood) return;
    // เลี่ยงของเสีย → นับเป็น onJunk เพื่อคุมความยาก (พลาด)
    deck.onJunk(); misses++; decayFever(6); syncDeck(); pushQuest();
  }

  function onSec(){
    if (combo<=0) decayFever(6); else decayFever(2);
    deck.second(); syncDeck();

    // ถ้าเคลียร์ครบชุด และเวลายังเหลือ → เติมชุดถัดไป + นับสะสม
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');

    if (goals.length>0 && goals.every(g=>g.done)){ accGoalDone += goals.length; deck.drawGoals(2); pushQuest('Goal ใหม่'); }
    if (minis.length>0 && minis.every(m=>m.done)){ accMiniDone += minis.length; deck.draw3();       pushQuest('Mini ใหม่'); }
  }

  // wire global ticks
  window.addEventListener('hha:time', (e)=>{ if((e.detail?.sec|0)>=0) onSec(); });

  // go factory
  return factoryBoot({
    difficulty: diff, duration: dur,
    pools:{good:[...GOOD,...BONUS], bad:[...JUNK]},
    goodRate:0.62, powerups:BONUS, powerRate:0.1, powerEvery:7,
    judge:(ch,ctx)=>judge(ch,ctx), onExpire
  }).then(ctrl=>{
    pushQuest('เริ่ม');
    // finish summary
    window.addEventListener('hha:time',(e)=>{
      if((e.detail?.sec|0)===0){
        const g = deck.getProgress('goals'), m = deck.getProgress('mini');
        const goalCleared  = g.length>0 && g.every(x=>x.done);
        const goalsTotal   = accGoalDone + g.length;
        const goalsCleared = accGoalDone + g.filter(x=>x.done).length;
        const miniTotal    = accMiniDone + m.length;
        const miniCleared  = accMiniDone + m.filter(x=>x.done).length;
        window.dispatchEvent(new CustomEvent('hha:end',{detail:{
          mode:'Good vs Junk', difficulty:diff, score, comboMax, misses, duration:dur,
          goalCleared, goalsCleared, goalsTotal, questsCleared: miniCleared, questsTotal: miniTotal
        }}));
      }
    });
    return ctrl;
  });
}

export default { boot };