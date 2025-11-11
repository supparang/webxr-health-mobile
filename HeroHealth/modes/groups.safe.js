// DOM version — Food Groups (เลือกให้ถูกหมู่)
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

  // เป้าปัจจุบัน: เลือกให้ถูก “หมู่เป้า”
  const keys = Object.keys(GROUPS);
  let target = keys[(Math.random()*keys.length)|0];
  let correctPicked = 0, goalSize = 2; // ต้องถูก X ชิ้นต่อรอบ

  let score=0, combo=0, shield=0, leftSec=dur, hits=0, misses=0;

  function setNewGoal(){ target = keys[(Math.random()*keys.length)|0]; correctPicked=0; }
  setNewGoal();

  // Goal (ผ่าน 3 รอบของเป้าหมู่: veg/fruit/... ชุดละ goalSize)
  const goal = { label: `เลือก ${target.toUpperCase()} ให้ถูก ${goalSize} ชิ้น × 3 รอบ`, prog: 0, target: 3, cleared: false, rounds:0 };
  function updateGoal(){
    goal.label = `เลือก ${target.toUpperCase()} ให้ถูก ${goalSize} ชิ้น × 3 รอบ`;
    goal.prog = Math.min(goal.target, goal.rounds);
    goal.cleared = goal.prog >= goal.target;
  }

  const deck = new MissionDeck();
  deck.draw3(); questHUDInit();
  function pushHUD(hint){
    questHUDUpdate(deck, hint||'');
    updateGoal();
    const cur = deck.getCurrent(); const p = deck.getProgress()[deck.currentIndex] || {};
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail:{
        text:`Mini Quest — ${cur?.label || 'กำลังสุ่ม…'}`,
        goal:{ label: goal.label, prog: goal.prog, target: goal.target },
        mini:{ label: cur?.label || '-', prog: p.prog || 0, target: p.target || 1 }
      }
    }));
  }
  pushHUD('เลือกให้ถูกหมู่');

  window.addEventListener('hha:time', e=>{ if(Number.isFinite(e?.detail?.sec)) leftSec = e.detail.sec; });
  function maybeRefillDeck(){ if(deck.isCleared() && leftSec>5){ deck.draw3(); pushHUD('เควสต์ใหม่มาแล้ว!'); } }

  function fx(x,y,good,txt){ burstAtScreen(x,y,{color:good?'#22c55e':'#ef4444'}); floatScoreScreen(x,y,txt || (good?'+10':'-10')); }

  function isInTarget(ch){ return GROUPS[target].includes(ch); }

  function judgeChar(ch, ctx){
    if (ch==='⭐' || ch==='💎' || ch==='🛡️'){
      if (ch==='⭐'){ score+=40; fx(ctx.x,ctx.y,true,'+40 ⭐'); }
      if (ch==='💎'){ score+=80; fx(ctx.x,ctx.y,true,'+80 💎'); }
      if (ch==='🛡️'){ shield=Math.min(3,shield+1); fx(ctx.x,ctx.y,true,'🛡️+1'); }
      combo = Math.min(9999, combo+1); deck.updateScore(score); deck.updateCombo(combo); pushHUD(); maybeRefillDeck();
      return { good:true, scoreDelta:0 };
    }

    const ok = isInTarget(ch);
    if (ok){
      const val = 25 + combo*2;
      score+=val; combo++; hits++; correctPicked++;
      if (correctPicked >= goalSize){ goal.rounds++; setNewGoal(); }
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      fx(ctx.x,ctx.y,true,'+'+val);
      pushHUD(); maybeRefillDeck();
      return { good:true, scoreDelta:val };
    }else{
      if (shield>0){ shield--; fx(ctx.x,ctx.y,true,'Shield!'); pushHUD(); return {good:true, scoreDelta:0}; }
      combo=0; score=Math.max(0,score-12); misses++;
      deck.updateScore(score); deck.updateCombo(combo);
      fx(ctx.x,ctx.y,false,'-12');
      pushHUD(); return { good:false, scoreDelta:-12 };
    }
  }

  window.addEventListener('hha:hit-screen', e=>{
    const d=e.detail||{};
    const res=judgeChar(d.char,{isGood:d.isGood,x:d.x,y:d.y});
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  });

  window.addEventListener('hha:expired', e=>{
    const d=e.detail||{};
    if (d && d.isGood===false){ deck.onJunk(); pushHUD(); maybeRefillDeck(); }
  });

  const secTimer=setInterval(()=>{ deck.second(); pushHUD(); maybeRefillDeck(); if(leftSec<=0) clearInterval(secTimer); },1000);

  return factoryBoot.boot({
    host: cfg.host, difficulty: diff, duration: dur,
    pools:{ good: GOOD, bad: BAD },
    goodRate:(diff==='easy'?0.7:diff==='hard'?0.55:0.62),
    judge:(ch,ctx)=>judgeChar(ch,{...ctx,x:window.innerWidth/2,y:window.innerHeight/2})
  });
}
export default { boot };
