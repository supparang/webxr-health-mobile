// DOM version — Hydration (มี Water Gauge)
import factoryBoot from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate } from '../vr/quest-hud.js';
import { ensureWaterGauge, destroyWaterGauge, setWaterGauge, zoneFrom, burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const dur = Number(cfg.duration || 60);
  const diff = String(cfg.difficulty || 'normal');

  const GOOD = ['💧','🚰','🥛','🍊','🍋','⭐','💎','🛡️'];
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];

  let score = 0, combo = 0, shield = 0, water = 55;
  let hits = 0, misses = 0, leftSec = dur;
  let balancedSec = 0; // เก็บเวลาที่อยู่โซน GREEN ต่อเนื่อง

  ensureWaterGauge(); setWaterGauge(water);

  // Goal: Balanced ให้ครบ 25 วินาที
  const goal = { label: 'รักษา Balanced 25 วินาที', prog: 0, target: 25, cleared: false };
  function updateGoal() {
    goal.prog = Math.min(goal.target, balancedSec);
    goal.cleared = goal.prog >= goal.target;
  }

  // Deck
  const deck = new MissionDeck();
  deck.draw3(); questHUDInit();
  function pushHUD(hint) {
    questHUDUpdate(deck, hint || '');
    updateGoal();
    window.dispatchEvent(new CustomEvent('hha:quest', {
      detail: {
        text: `Mini Quest — ${deck.getCurrent()?.label || 'กำลังสุ่ม…'}`,
        goal: { label: goal.label, prog: goal.prog, target: goal.target },
        mini: { label: deck.getCurrent()?.label || '-', prog: deck.getProgress()[deck.currentIndex]?.prog || 0, target: deck.getProgress()[deck.currentIndex]?.target || 1 }
      }
    }));
  }
  pushHUD('ดื่มให้พอดี');

  window.addEventListener('hha:time', e => { if (Number.isFinite(e?.detail?.sec)) leftSec = e.detail.sec; });
  function maybeRefillDeck(){ if (deck.isCleared() && leftSec > 5){ deck.draw3(); pushHUD('เควสต์ใหม่มาแล้ว!'); } }

  function fx(x,y,txt,col){ burstAtScreen(x,y,{color:col||'#22c55e',count:18}); floatScoreScreen(x,y,txt||'+10'); }

  function applyHydration(isGood){
    if(isGood){ water = Math.min(100, water + 6); }
    else{
      water = Math.max(0, water - 8);
    }
    setWaterGauge(water);
  }

  function judgeChar(ch, ctx){
    const z = zoneFrom(water);
    if (ch==='⭐' || ch==='💎' || ch==='🛡️'){
      if (ch==='⭐'){ score+=40; fx(ctx.x,ctx.y,'+40 ⭐','#fde047'); }
      if (ch==='💎'){ score+=80; fx(ctx.x,ctx.y,'+80 💎','#a78bfa'); }
      if (ch==='🛡️'){ shield=Math.min(3,shield+1); fx(ctx.x,ctx.y,'🛡️+1','#60a5fa'); }
      combo = Math.min(9999, combo+1); deck.updateScore(score); deck.updateCombo(combo); pushHUD(); maybeRefillDeck();
      return { good:true, scoreDelta:0 };
    }

    if (ctx.isGood){
      const val = 20 + combo*2;
      score+=val; combo++; hits++; applyHydration(true);
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      fx(ctx.x,ctx.y,'+'+val,'#22c55e'); pushHUD(); maybeRefillDeck();
      return { good:true, scoreDelta:val };
    }else{
      if (shield>0){ shield--; fx(ctx.x,ctx.y,'Shield!','#60a5fa'); pushHUD(); return {good:true, scoreDelta:0}; }
      if (z==='HIGH'){ score+=5; applyHydration(false); fx(ctx.x,ctx.y,'+5 (High)','#38bdf8'); }
      else { combo=0; score=Math.max(0,score-20); misses++; applyHydration(false); fx(ctx.x,ctx.y,'-20','#ef4444'); }
      deck.updateScore(score); deck.updateCombo(combo); pushHUD(); return { good:false, scoreDelta:0 };
    }
  }

  // Hit
  window.addEventListener('hha:hit-screen', e=>{
    const d=e.detail||{};
    const res=judgeChar(d.char,{isGood:d.isGood,x:d.x,y:d.y});
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  });

  // Avoid junk
  window.addEventListener('hha:expired', e=>{
    const d=e.detail||{};
    if(d && d.isGood===false){ deck.onJunk(); pushHUD(); maybeRefillDeck(); }
  });

  // Count balanced seconds
  const secTimer=setInterval(()=>{
    deck.second();
    if (zoneFrom(water)==='GREEN') balancedSec = Math.min(9999, balancedSec+1);
    else balancedSec = Math.max(0, balancedSec-0); // ไม่ลด
    pushHUD(); maybeRefillDeck();
    if (leftSec<=0) clearInterval(secTimer);
  },1000);

  // Cleanup gauge on end
  window.addEventListener('hha:end', ()=>{ destroyWaterGauge(); }, { once:true });

  return factoryBoot.boot({
    host: cfg.host, difficulty: diff, duration: dur,
    pools: { good: GOOD, bad: BAD },
    goodRate: (diff==='easy'?0.72:diff==='hard'?0.58:0.66),
    judge: (ch,ctx)=>judgeChar(ch,{...ctx,x:window.innerWidth/2,y:window.innerHeight/2})
  });
}
export default { boot };
