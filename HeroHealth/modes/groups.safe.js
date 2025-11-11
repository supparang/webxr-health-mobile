// === /HeroHealth/modes/groups.safe.js (DOM+Fever+Quests+Powers) ===
import factory from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { questHUDInit, questHUDUpdate, questHUDDispose } from '../vr/quest-hud.js';
import { ensureFeverGauge, setFeverGauge, setFlame, feverBurstScreen } from '../vr/ui-fever.js';
import { floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain:['🍞','🥖','🥯','🥐','🍚','🍙','🍘'],
    protein:['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦','🍨','🍮']
  };
  const ALL = Object.values(GROUPS).flat();
  const POW = ['⭐','💎','🛡️','🔥'];

  // เป้า: เลือก “หมู่ target” ให้ครบ goalSize ชิ้น (จะเพิ่ม 1→2→3 เมื่อทำสำเร็จ)
  const keys = Object.keys(GROUPS);
  let target = keys[(Math.random()*keys.length)|0];
  let goalSize = 1, correct=0;
  let score=0, combo=0, shield=0, fever=0, feverActive=false;

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

    const inTarget = GROUPS[target].includes(ch);
    if (ALL.includes(ch)) return { type: inTarget?'in':'out', good:inTarget, scoreDelta: inTarget? (22+ctx.combo*2) : -12, inTarget, fever: inTarget? +6 : -6 };
    return { type:'other', good:false, scoreDelta:0, fever:0 };
  }

  const game = await factory.boot({
    host:cfg.host, difficulty:cfg.difficulty||'normal', duration:cfg.duration||60,
    goodRate:0.7, pools:{ good:[...GROUPS[target], ...POW], bad:[...ALL.filter(x=>!GROUPS[target].includes(x))] },
    judge:(ch,ctx)=>{
      const r=judgeChar(ch,ctx);

      if (r.type==='shield') shield=Math.min(3,shield+1);
      if (r.type==='fever'){ fever=100; feverActive=true; setFlame(true); feverBurstScreen(); }

      // quests
      if (r.good) deck.onGood(); else deck.onJunk();
      if (r.type==='star') deck.onStar();
      if (r.type==='diamond') deck.onDiamond();

      fever = Math.max(0, Math.min(100, fever + (r.fever||0)));
      if(fever>=100){ feverActive=true; setFlame(true); feverBurstScreen(); }
      setFeverGauge(fever);

      score = Math.max(0, score + r.scoreDelta);
      combo = r.good ? Math.min(9999,(ctx.combo||0)+1) : 0;
      deck.updateScore(score); deck.updateCombo(combo);

      if (r.inTarget){
        correct++;
        if (correct>=goalSize){
          // ผ่านรอบ → เริ่มเป้าใหม่ (ใหญ่ขึ้นแต่ไม่เกิน 3)
          goalSize = Math.min(3, goalSize+1);
          correct = 0;
          target = keys[(Math.random()*keys.length)|0];
        }
      }

      if (deck.isCleared()){ wave+=1; deck.draw3(); }
      pushBanner();
      return { good:r.good, scoreDelta:r.scoreDelta };
    },
    onExpire:({isGood})=>{
      // สำหรับโหมดนี้: ถ้าหมดอายุของที่ “ใช่กลุ่ม” = ถือว่าพลาด
      // เราไม่รู้ว่าเป้าที่หมดอายุเป็นของกลุ่มไหนเพราะ factory ไม่บอก char ตรงนี้ → ไม่ทำอะไรเพิ่ม
      deck.onJunk(); pushBanner();
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
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{
        text:`Goal: ${target.toUpperCase()} × ${goalSize} (ได้แล้ว ${correct}) | Mini: ${cur?cur.label:'—'}`,
        goal:{ label:`${target.toUpperCase()} × ${goalSize}`, prog:correct, target:goalSize },
        mini: cur ? { label:cur.label, prog:(cur.prog?cur.prog(deck.stats):0), target:cur.target||1 } : null
      }
    }));
    questHUDUpdate(deck, `Wave ${wave}`);
  }
  pushBanner();

  const onEnd=()=>{
    try{
      clearInterval(secTimer);
      window.removeEventListener('hha:hit-screen', onHit);
      questHUDDispose(); setFlame(false);
      const qCleared = deck.getProgress().filter(q=>q.done).length;
      const goalCleared = (correct>=goalSize); // สถานะตอนจบ
      window.dispatchEvent(new CustomEvent('hha:end', {
        detail:{
          mode:'Food Groups',
          difficulty:String(cfg.difficulty||'normal'),
          score, comboMax:deck.stats.comboMax, misses:deck.stats.junkMiss, hits:deck.stats.goodCount,
          duration:Number(cfg.duration||60),
          goalCleared, questsCleared:qCleared, questsTotal:3, reason:'timeout'
        }
      }));
    }catch{}
  };
  window.addEventListener('hha:end', onEnd, { once:true });

  return { stop(){ try{game.stop();}catch{} onEnd(); }, pause(){ try{game.pause();}catch{} }, resume(){ try{game.resume();}catch{} } };
}
export default { boot };
