// === /HeroHealth/modes/hydration.quest.js (DOM+Water+Fever+Quests+Powers) ===
import factory from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverGauge, setFeverGauge, setFlame, feverBurstScreen } from '../vr/ui-fever.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom, floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const GOOD = ['💧','🚰','🥛','🍊','🍋'];           // บวกน้ำ
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];           // ลดน้ำ (โดยเฉพาะตอนน้ำต่ำ)
  const POW  = ['⭐','💎','🛡️','🔥'];

  let water = 55; // 0..100
  let fever = 0, feverActive = false, shield=0, score=0, combo=0;

  // Goal: รักษา “Balanced” zone (40..70) ให้ถึงเวลาสะสม 25 วิ
  let balancedSec = 0;
  const goalTarget = 25;

  ensureWaterGauge(); setWaterGauge(water);
  ensureFeverGauge(); setFeverGauge(0); setFlame(false);

  const deck = new MissionDeck({
    pool: [
      { id:'balanced15', level:'normal', label:'Balanced 15 วิ', check:s=>s.noMissTime>=15, prog:s=>Math.min(15,s.noMissTime), target:15 },
      { id:'good12',     level:'easy',   label:'เก็บน้ำดี 12 ชิ้น', check:s=>s.goodCount>=12, prog:s=>Math.min(12,s.goodCount), target:12 },
      { id:'score350',   level:'hard',   label:'คะแนน 350+', check:s=>s.score>=350, prog:s=>Math.min(350,s.score), target:350 },
      { id:'avoid8',     level:'easy',   label:'หลีกเครื่องดื่มหวาน 8', check:s=>s.junkMiss>=8, prog:s=>Math.min(8,s.junkMiss), target:8 },
      { id:'combo12',    level:'normal', label:'คอมโบ 12', check:s=>s.comboMax>=12, prog:s=>Math.min(12,s.comboMax), target:12 },
      { id:'star2',      level:'normal', label:'เก็บ ⭐ 2 ดวง', check:s=>s.star>=2, prog:s=>Math.min(2,s.star), target:2 },
      { id:'diamond1',   level:'hard',   label:'เก็บ 💎 1 เม็ด', check:s=>s.diamond>=1, prog:s=>Math.min(1,s.diamond), target:1 },
      { id:'score500',   level:'hard',   label:'แต้ม 500+', check:s=>s.score>=500, prog:s=>Math.min(500,s.score), target:500 },
      { id:'good18',     level:'normal', label:'เก็บน้ำดี 18 ชิ้น', check:s=>s.goodCount>=18, prog:s=>Math.min(18,s.goodCount), target:18 },
      { id:'nomiss15',   level:'normal', label:'ไม่พลาด 15 วิ', check:s=>s.noMissTime>=15, prog:s=>Math.min(15,s.noMissTime), target:15 },
    ]
  });
  deck.draw3();
  let wave=1;
  questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);

  const secTimer = setInterval(()=>{
    // Balanced zone time
    if (zoneFrom(water)==='GREEN') balancedSec = Math.min(9999, balancedSec+1);

    deck.second();

    // fever decay
    if (!feverActive){ fever=Math.max(0, fever-3); setFeverGauge(fever); }
    else {
      fever=Math.max(0, fever-1); setFeverGauge(fever);
      if (fever<=0){ feverActive=false; setFlame(false); }
    }

    // goal progress banner
    pushQuestBanner();
    questHUDUpdate(deck, `Wave ${wave}`);
  }, 1000);

  function judgeChar(ch, ctx){
    if (ch==='⭐') return { type:'star', good:true, scoreDelta:40, fever:+10, water:+2 };
    if (ch==='💎') return { type:'diamond', good:true, scoreDelta:80, fever:+15, water:+3 };
    if (ch==='🛡️') return { type:'shield', good:true, scoreDelta:0,  fever:0,  water:+0 };
    if (ch==='🔥') return { type:'fever',  good:true, scoreDelta:0,  fever:+100, water:+0 };

    if (GOOD.includes(ch)) return { type:'good', good:true, scoreDelta:20+ctx.combo*2, fever:+6,  water:+6 };
    if (BAD.includes(ch))  return { type:'bad',  good:false, scoreDelta: (zoneFrom(water)==='HIGH'? +5 : -20), fever:-6, water:-8 };

    return { type:'other', good:false, scoreDelta:0, fever:0, water:0 };
  }

  const game = await factory.boot({
    host: cfg.host, difficulty: cfg.difficulty||'normal', duration: cfg.duration||60,
    goodRate: 0.66, pools:{ good:[...GOOD,...POW], bad:[...BAD] },
    judge: (ch, ctx)=>{
      const r=judgeChar(ch, ctx);

      // apply power
      if (r.type==='shield') shield=Math.min(3, shield+1);
      if (r.type==='fever'){ fever=100; feverActive=true; setFlame(true); feverBurstScreen(); }

      // water update
      water = Math.max(0, Math.min(100, water + (r.water||0)));
      setWaterGauge(water);

      // quest stats
      if (r.type==='good' || r.type==='star' || r.type==='diamond') deck.onGood();
      if (r.type==='bad'  && !(shield>0)) deck.onJunk();
      if (r.type==='star') deck.onStar();
      if (r.type==='diamond') deck.onDiamond();

      // fever adjust
      fever = Math.max(0, Math.min(100, fever + (r.fever||0)));
      if (fever>=100){ feverActive=true; setFlame(true); feverBurstScreen(); }
      setFeverGauge(fever);

      // scoring / combo
      score = Math.max(0, score + r.scoreDelta);
      combo = r.good ? Math.min(9999, (ctx.combo||0)+1) : 0;
      deck.updateScore(score);
      deck.updateCombo(combo);

      if (deck.isCleared()){ wave+=1; deck.draw3(); questHUDUpdate(deck, `Wave ${wave}`); }
      return { good:r.good, scoreDelta:r.scoreDelta };
    },
    onExpire: ({isGood})=>{
      if (!isGood){ deck.onJunk(); questHUDUpdate(deck, `Wave ${wave}`); }
      else { // พลาดน้ำดี → ลดน้ำเล็กน้อย
        water = Math.max(0, water-4); setWaterGauge(water);
      }
    }
  });

  const onHit=(e)=>{
    const d=e.detail||{}, x=d.x||innerWidth/2, y=d.y||innerHeight/2;
    if(d.good){ burstAtScreen(x,y,{color:'#22c55e',count:16}); floatScoreScreen(x,y, (d.delta>0?`+${d.delta}`:`${d.delta}`),'#eafff5'); }
    else      { burstAtScreen(x,y,{color:'#ef4444',count:12}); floatScoreScreen(x,y, `${d.delta||0}`,'#ffe4e6'); }
  };
  window.addEventListener('hha:hit-screen', onHit);

  function pushQuestBanner(){
    const cur=deck.getCurrent();
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text:`Goal: Balanced ${balancedSec}/${goalTarget}s | Mini: ${cur?cur.label:'—'}`,
        goal:{ label:`Balanced time`, prog:balancedSec, target:goalTarget },
        mini: cur ? { label:cur.label, prog:(cur.prog?cur.prog(deck.stats):0), target:cur.target||1 } : null
      }
    }));
  }
  pushQuestBanner();

  const onEnd=(e)=>{
    try{
      clearInterval(secTimer);
      window.removeEventListener('hha:hit-screen', onHit);
      questHUDDispose(); setFlame(false);
      const qCleared = deck.getProgress().filter(q=>q.done).length;
      window.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'Hydration',
          difficulty:String(cfg.difficulty||'normal'),
          score, comboMax:deck.stats.comboMax,
          misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
          duration:Number(cfg.duration||60),
          goalCleared: balancedSec>=goalTarget,
          questsCleared:qCleared, questsTotal:3, reason:'timeout'
        }
      }));
    }catch{}
  };
  window.addEventListener('hha:end', onEnd, { once:true });

  return { stop(){ try{game.stop();}catch{} onEnd(); }, pause(){ try{game.pause();}catch{} }, resume(){ try{game.resume();}catch{} } };
}
export default { boot };
