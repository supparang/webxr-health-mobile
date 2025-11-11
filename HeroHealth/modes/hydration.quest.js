// === /HeroHealth/modes/hydration.quest.js (fever + water + fx) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom, floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';
import { ensureFeverGauge, setFeverGauge, setFlame, feverBurstScreen, destroyFeverGauge } from '../vr/ui-fever.js';

export async function boot(cfg = {}){
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  // pools
  const GOOD = ['💧','🚰','🥛','🍊','🍋','⭐','💎','🛡️'];
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];

  // water
  ensureWaterGauge();
  let water = 55; setWaterGauge(water);

  // fever
  ensureFeverGauge();
  let fever=0, feverActive=false, feverTimer=0;
  function addFever(d){
    fever = Math.max(0, Math.min(100, fever + d));
    setFeverGauge(fever);
    if(!feverActive && fever>=100){
      feverActive = true; setFlame(true); feverBurstScreen(); setFeverGauge(100);
      feverTimer = setTimeout(()=>{ feverActive=false; setFlame(false); fever=0; setFeverGauge(0); }, 5000);
    }
  }

  function valueForGood(combo){
    const base = 20 + combo*2;
    return Math.round(base * (feverActive ? 1.5 : 1));
  }

  // visual & water updates
  function onHitScreen(e){
    const d=e.detail||{}; const x=d.x,y=d.y;
    if(d.char==='⭐'){ burstAtScreen(x,y,{color:'#fde047',count:20}); floatScoreScreen(x,y,'+40 ⭐','#fde047'); addFever(+8); return; }
    if(d.char==='💎'){ burstAtScreen(x,y,{color:'#a78bfa',count:22}); floatScoreScreen(x,y,'+80 💎','#a78bfa'); addFever(+8); return; }
    if(d.char==='🛡️'){ burstAtScreen(x,y,{color:'#60a5fa',count:18}); floatScoreScreen(x,y,'🛡️+1','#93c5fd'); addFever(+6); return; }

    if(d.good){
      burstAtScreen(x,y,{color:'#22c55e',count:16});
      water = Math.min(100, water + 6);
      setWaterGauge(water);
      addFever(+5);
    }else{
      // ถ้าอยู่โซน HIGH → โทษเบาลง (คะแนนเป็นบวกเล็กน้อย) | LOW → โทษหนัก
      burstAtScreen(x,y,{color:'#ef4444',count:14});
      water = Math.max(0, water - 8);
      setWaterGauge(water);
      addFever(-12);
    }
    if(typeof d.delta==='number'){
      floatScoreScreen(x,y,(d.delta>0?'+':'')+d.delta, d.delta>0?'#22c55e':'#ef4444');
    }
  }
  window.addEventListener('hha:hit-screen', onHitScreen);

  function judge(ch, ctx){
    if(ch==='⭐') return { good:true, scoreDelta:40 };
    if(ch==='💎') return { good:true, scoreDelta:80 };
    if(ch==='🛡️') return { good:true, scoreDelta:0 };
    const isGood = GOOD.includes(ch);
    if(isGood)  return { good:true,  scoreDelta:valueForGood(ctx.combo||0) };
    // BAD: zone-sensitive scoring (เอฟเฟกต์น้ำทำแล้วใน onHitScreen)
    const z = zoneFrom(water);
    if(z==='HIGH') return { good:false, scoreDelta: +5 };
    return { good:false, scoreDelta: -20 };
  }

  const api = await factoryBoot({
    host: cfg.host, difficulty: diff, duration: dur,
    pools: { good: GOOD, bad: BAD }, goodRate: 0.66,
    judge,
    onExpire: ev=>{ // หมดอายุ: good → ลงโทษน้ำ, junk → หลบสำเร็จ
      if(ev && ev.isGood===false){ addFever(+2); }
    }
  });

  window.addEventListener('hha:end', ()=>{
    try{ clearTimeout(feverTimer); }catch{}
    setFlame(false); destroyFeverGauge();
    window.removeEventListener('hha:hit-screen', onHitScreen);
  }, { once:true });

  return api;
}
export default { boot };
