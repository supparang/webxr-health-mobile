// === /HeroHealth/modes/groups.safe.js (fever + fx) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';
import { ensureFeverGauge, setFeverGauge, setFlame, feverBurstScreen, destroyFeverGauge } from '../vr/ui-fever.js';

export async function boot(cfg = {}){
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  const GROUPS = {
    veg: ['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],
    fruit: ['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain: ['🍞','🥖','🥯','🥐','🍚','🍙','🍘'],
    protein: ['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy: ['🥛','🧀','🍦','🍨','🍮']
  };
  const ALLGOOD = [...new Set(Object.values(GROUPS).flat())];
  const GOOD = [...ALLGOOD, '⭐','💎','🛡️'];
  const BAD  = ['🍔','🍟','🍕','🍩','🍪','🥤','🧋','🍫'];

  ensureFeverGauge();
  let fever=0, feverActive=false, timer=0;
  function addFever(d){ fever=Math.max(0,Math.min(100,fever+d)); setFeverGauge(fever);
    if(!feverActive && fever>=100){ feverActive=true; setFeverGauge(100); setFlame(true); feverBurstScreen();
      timer=setTimeout(()=>{feverActive=false; setFlame(false); fever=0; setFeverGauge(0);},5000); } }

  let targetKey = Object.keys(GROUPS)[(Math.random()*5)|0];
  function isCorrect(ch){ return GROUPS[targetKey]?.includes(ch); }
  function nextGoal(){ targetKey = Object.keys(GROUPS)[(Math.random()*5)|0]; }

  function valGood(combo){ const base=22+combo*2; return Math.round(base*(feverActive?1.5:1)); }

  function onHitScreen(e){
    const d=e.detail||{}; const x=d.x,y=d.y;
    if(d.char==='⭐'){ burstAtScreen(x,y,{color:'#fde047',count:20}); floatScoreScreen(x,y,'+40 ⭐','#fde047'); addFever(+8); return; }
    if(d.char==='💎'){ burstAtScreen(x,y,{color:'#a78bfa',count:22}); floatScoreScreen(x,y,'+80 💎','#a78bfa'); addFever(+8); return; }
    if(d.char==='🛡️'){ burstAtScreen(x,y,{color:'#60a5fa',count:18}); floatScoreScreen(x,y,'🛡️+1','#93c5fd'); addFever(+6); return; }
    if(d.good){ burstAtScreen(x,y,{color:'#22c55e',count:16}); addFever(+5); }
    else{ burstAtScreen(x,y,{color:'#ef4444',count:14}); addFever(-12); }
    if(typeof d.delta==='number'){ floatScoreScreen(x,y,(d.delta>0?'+':'')+d.delta, d.delta>0?'#22c55e':'#ef4444'); }
  }
  window.addEventListener('hha:hit-screen', onHitScreen);

  function judge(ch, ctx){
    if(ch==='⭐') return { good:true, scoreDelta:40 };
    if(ch==='💎') return { good:true, scoreDelta:80 };
    if(ch==='🛡️') return { good:true, scoreDelta:0 };
    if(ALLGOOD.includes(ch)){
      // ถูกหมู่เท่านั้นถึงจะถือว่าดี
      if(isCorrect(ch)) {
        // เปลี่ยนเป้าเมื่อเก็บถูกสักจำนวนหนึ่ง (ง่าย ๆ: ทุก 3 ครั้ง)
        if(((ctx.combo||0)+1)%3===0) nextGoal();
        return { good:true, scoreDelta: valGood(ctx.combo||0) };
      } else {
        return { good:false, scoreDelta: -12 };
      }
    }
    // junk
    return { good:false, scoreDelta: -12 };
  }

  const api = await factoryBoot({
    host: cfg.host, difficulty: diff, duration: dur,
    pools: { good: GOOD, bad: BAD }, goodRate: 0.7, judge,
    onExpire: ev=>{ if(ev && ev.isGood===false) addFever(+2); }
  });

  window.addEventListener('hha:end', ()=>{
    try{ clearTimeout(timer); }catch{}
    setFlame(false); destroyFeverGauge();
    window.removeEventListener('hha:hit-screen', onHitScreen);
  }, { once:true });

  return api;
}
export default { boot };
