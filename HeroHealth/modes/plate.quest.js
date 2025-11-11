// === /HeroHealth/modes/plate.quest.js (DOM+Fever+Quests+Powers) ===
import factory from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverGauge, setFeverGauge, setFlame, feverBurstScreen } from '../vr/ui-fever.js';
import { floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦'],
  };
  const POW=['⭐','💎','🛡️','🔥'];
  const ALL = Object.values(GROUPS).flat();

  // เป้า: “จัดครบ 5 หมู่” — ให้ผู้เล่นเก็บแต่ละหมู่ให้ครบ 1 ครั้ง (veg/fruit/grain/protein/dairy)
  let round = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
  function roundCleared(){ return Object.values(round).every(Boolean); }

  let score=0, combo=0, fever=0, feverActive=false, shield=0, roundsDone=0;

  const deck = new MissionDeck(); deck.draw3();
  let wave=1; questHUDInit(); questHUDUpdate(deck, `Wave ${wave}`);
  ensureFeverGauge(); setFeverGauge(0); setFlame(false);

  const secTimer = setInterval(()=>{
    deck.second();
    if(!feverActive){ fever=Math.max(0,fever-3); } else { fever=Math.max(0,fever-1); if(fever<=0){feverActive=false; setFlame(false);} }
    setFeverGauge(fever);
    pushBanner();
    questHUDUpdate(deck, `Wave ${wave}`);
  },1000);

  function judgeChar(ch, ctx){
    if (ch==='⭐') return { type:'star', good:true, scoreDelta:40, fever:+10 };
    if (ch==='💎') return { type:'diamond', good:true, scoreDelta:80, fever:+15 };
    if (ch==='🛡️') return { type:'shield', good:true, scoreDelta:0,  fever:0  };
    if (ch==='🔥') return { type:'fever',  good:true, scoreDelta:0,  fever:+100 };

    for (const k of Object.keys(GROUPS)){
      if (GROUPS[k].includes(ch)) return { type:'food', good:true, scoreDelta:22+ctx.combo*2, fever:+6, group:k };
    }
    return { type:'other', good:false, scoreDelta:0, fever:0 };
  }

  const game = await factory.boot({
    host:cfg.host, difficulty:cfg.difficulty||'normal', duration:cfg.duration||60,
    goodRate:0.72, pools:{ good:[...ALL, ...POW], bad:[] }, // ทั้งหมดถือว่า “ของดี” ในรอบจัดจาน
    judge:(ch,ctx)=>{
      const r=judgeChar(ch,ctx);

      if (r.type==='shield') shield=Math.min(3,shield+1);
      if (r.type==='fever'){ fever=100; feverActive=true; setFlame(true); feverBurstScreen(); }

      if (r.good) deck.onGood(); else deck.onJunk();
      if (r.type==='star') deck.onStar();
      if (r.type==='diamond') deck.onDiamond();

      fever = Math.max(0, Math.min(100, fever + (r.fever||0)));
      if(fever>=100){ feverActive=true; setFlame(true); feverBurstScreen(); }
      setFeverGauge(fever);

      score = Math.max(0, score + r.scoreDelta);
      combo = r.good ? Math.min(9999,(ctx.combo||0)+1) : 0;
      deck.updateScore(score); deck.updateCombo(combo);

      if (r.type==='food' && r.group) {
        round[r.group] = true;
        if (roundCleared()){
          score += 100;
          roundsDone += 1;
          round = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
        }
      }

      if (deck.isCleared()){ wave+=1; deck.draw3(); questHUDUpdate(deck, `Wave ${wave}`); }

      return { good:r.good, scoreDelta:r.scoreDelta };
    },
    onExpire:({isGood})=>{
      if (isGood){ deck.onJunk(); } // พลาดของกินดี ๆ
      questHUDUpdate(deck, `Wave ${wave}`); pushBanner();
    }
  });

  const onHit=(e)=>{
    const d=e.detail||{}, x=d.x||innerWidth/2, y=d.y||innerHeight/2;
    if(d.good){ burstAtScreen(x,y,{color:'#22c55e',count:16}); floatScoreScreen(x,y,(d.delta>0?`+${d.delta}`:`${d.delta}`),'#eafff5'); }
    else      { burstAtScreen(x,y,{color:'#ef4444',count:12}); floatScoreScreen(x,y,`${d.delta||0}`,'#ffe4e6'); }
  };
  window.addEventListener('hha:hit-screen', onHit);

  function pushBanner(){
    const cur=deck.getCurrent();
    const done = Object.keys(round).filter(k=>round[k]).length;
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text:`Goal: จัดครบ 5 หมู่ (${done}/5) | Mini: ${cur?cur.label:'—'}`,
        goal:{ label:'จัดครบ 5 หมู่', prog:done, target:5 },
        mini: cur ? { label:cur.label, prog:(cur.prog?cur.prog(deck.stats):0), target:cur.target||1 } : null
      }
    }));
  }
  pushBanner();

  const onEnd=()=>{
    try{
      clearInterval(secTimer);
      window.removeEventListener('hha:hit-screen', onHit);
      questHUDDispose(); setFlame(false);
      const qCleared = deck.getProgress().filter(q=>q.done).length;
      const goalCleared = Object.values(round).every(Boolean);
      window.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'Healthy Plate',
          difficulty:String(cfg.difficulty||'normal'),
          score, comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
          duration:Number(cfg.duration||60),
          goalCleared, questsCleared:qCleared, questsTotal:3, reason:'timeout', roundsDone
        }
      }));
    }catch{}
  };
  window.addEventListener('hha:end', onEnd, { once:true });

  return { stop(){ try{game.stop();}catch{} onEnd(); }, pause(){ try{game.pause();}catch{} }, resume(){ try{game.resume();}catch{} } };
}
export default { boot };
