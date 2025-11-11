// DOM version — Healthy Plate (จัดครบ 5 หมู่)
import factoryBoot from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate } from '../vr/quest-hud.js';
import { burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const dur = Number(cfg.duration || 60);
  const diff = String(cfg.difficulty || 'normal');

  const GROUPS = {
    veg: ['🥦','🥕','🥬','🍅','🌽'],
    fruit: ['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain: ['🍞','🥖','🍚','🍘'],
    protein: ['🐟','🍗','🥚','🫘','🥜'],
    dairy: ['🥛','🧀','🍦']
  };
  const ALL = Object.values(GROUPS).flat();
  const GOOD = [...ALL, '⭐','💎','🛡️'];
  const BAD  = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  let score=0, combo=0, shield=0, leftSec=dur, hits=0, misses=0;

  // รอบละ “ครบ 5 หมู่”
  let roundDone = { veg:false, fruit:false, grain:false, protein:false, dairy:false };
  function roundCleared(){ return Object.values(roundDone).every(Boolean); }

  // Goal: ทำครบ 5 หมู่ 2 รอบ
  const goal = { label:'จัดครบ 5 หมู่ 2 รอบ', prog:0, target:2, cleared:false, rounds:0 };
  function updateGoal(){ goal.prog = Math.min(goal.target, goal.rounds); goal.cleared = goal.prog>=goal.target; }

  const deck = new MissionDeck();
  deck.draw3(); questHUDInit();
  function pushHUD(hint){
    questHUDUpdate(deck, hint||'');
    updateGoal();
    const cur = deck.getCurrent(); const p = deck.getProgress()[deck.currentIndex] || {};
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text:`Mini Quest — ${cur?.label || 'กำลังสุ่ม…'}`,
        goal:{label:goal.label, prog:goal.prog, target:goal.target},
        mini:{label:cur?.label||'-', prog:p.prog||0, target:p.target||1}
      }
    }));
  }
  pushHUD('จัดให้ครบทุกหมู่');

  window.addEventListener('hha:time', e=>{ if(Number.isFinite(e?.detail?.sec)) leftSec=e.detail.sec; });
  function maybeRefillDeck(){ if(deck.isCleared() && leftSec>5){ deck.draw3(); pushHUD('เควสต์ใหม่มาแล้ว!'); } }

  function fx(x,y,good,txt){ burstAtScreen(x,y,{color:good?'#22c55e':'#ef4444'}); floatScoreScreen(x,y,txt || (good?'+10':'-10')); }

  function findGroupOf(ch){
    for(const k in GROUPS){ if(GROUPS[k].includes(ch)) return k; }
    return null;
  }

  function judgeChar(ch, ctx){
    if (ch==='⭐' || ch==='💎' || ch==='🛡️'){
      if (ch==='⭐'){ score+=40; fx(ctx.x,ctx.y,true,'+40 ⭐'); }
      if (ch==='💎'){ score+=80; fx(ctx.x,ctx.y,true,'+80 💎'); }
      if (ch==='🛡️'){ shield=Math.min(3,shield+1); fx(ctx.x,ctx.y,true,'🛡️+1'); }
      combo=Math.min(9999,combo+1); deck.updateScore(score); deck.updateCombo(combo); pushHUD(); maybeRefillDeck();
      return { good:true, scoreDelta:0 };
    }

    const g = findGroupOf(ch);
    if (g){
      const val = 22 + combo*2;
      score+=val; combo++; hits++; roundDone[g] = true;
      if (roundCleared()){ goal.rounds++; roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false}; floatScoreScreen(ctx.x,ctx.y,'ROUND +100','#fde047'); score+=100; }
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      fx(ctx.x,ctx.y,true,'+'+val);
      pushHUD(); maybeRefillDeck();
      return { good:true, scoreDelta:val };
    }else{
      if (shield>0){ shield--; fx(ctx.x,ctx.y,true,'Shield!'); pushHUD(); return {good:true, scoreDelta:0}; }
      combo=0; score=Math.max(0,score-12); misses++;
      deck.updateScore(score); deck.updateCombo(combo);
      fx(ctx.x,ctx.y,false,'-12');
      pushHUD(); return {good:false, scoreDelta:-12};
    }
  }

  window.addEventListener('hha:hit-screen', e=>{
    const d=e.detail||{};
    const res=judgeChar(d.char,{isGood:d.isGood,x:d.x,y:d.y});
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  });

  window.addEventListener('hha:expired', e=>{
    const d=e.detail||{};
    if(d && d.isGood===false){ deck.onJunk(); pushHUD(); maybeRefillDeck(); }
  });

  const secTimer=setInterval(()=>{ deck.second(); pushHUD(); maybeRefillDeck(); if(leftSec<=0) clearInterval(secTimer); },1000);

  return factoryBoot.boot({
    host: cfg.host, difficulty: diff, duration: dur,
    pools:{ good: GOOD, bad: BAD },
    goodRate:(diff==='easy'?0.7:diff==='hard'?0.56:0.62),
    judge:(ch,ctx)=>judgeChar(ch,{...ctx,x:window.innerWidth/2,y:window.innerHeight/2})
  });
}
export default { boot };
