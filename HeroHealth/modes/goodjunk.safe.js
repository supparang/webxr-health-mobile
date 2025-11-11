// === /HeroHealth/modes/goodjunk.safe.js (fever + fx) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { floatScoreScreen, burstAtScreen } from '../vr/ui-water.js';
import { ensureFeverGauge, setFeverGauge, setFlame, feverBurstScreen, destroyFeverGauge } from '../vr/ui-fever.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  // pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐','⭐','💎','🛡️'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  // fever state
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

  // score formula
  function valueForGood(combo){
    const base = 20 + combo*2;
    return Math.round(base * (feverActive ? 1.5 : 1));
  }

  // handle hits (from factory)
  function onHitScreen(e){
    const d=e.detail||{}; const x=d.x,y=d.y;
    if(d.char==='⭐'){ burstAtScreen(x,y,{color:'#fde047',count:20}); floatScoreScreen(x,y,'+40 ⭐','#fde047'); addFever(+8); return; }
    if(d.char==='💎'){ burstAtScreen(x,y,{color:'#a78bfa',count:22}); floatScoreScreen(x,y,'+80 💎','#a78bfa'); addFever(+8); return; }
    if(d.char==='🛡️'){ burstAtScreen(x,y,{color:'#60a5fa',count:18}); floatScoreScreen(x,y,'🛡️+1','#93c5fd'); addFever(+6); return; }
    if(d.good){ burstAtScreen(x,y,{color:'#22c55e',count:16}); addFever(+5); }
    else{ burstAtScreen(x,y,{color:'#ef4444',count:14}); addFever(-12); }
    // คะแนนแสดงโดย factory ผ่าน hha:score แล้ว เราซ้ำด้วยตัวเลขสั้นๆ
    if(typeof d.delta==='number'){
      floatScoreScreen(x,y,(d.delta>0?'+':'')+d.delta, d.delta>0?'#22c55e':'#ef4444');
    }
  }
  window.addEventListener('hha:hit-screen', onHitScreen);

  // judge: ตัดสินคะแนน/พฤติกรรมตามตัวอักษรที่กด
  let comboLocal = 0; // เฉพาะใช้คำนวณค่าคลิกครั้งถัดไป
  function judge(ch, ctx){
    // powerups
    if(ch==='⭐') { comboLocal = Math.max(comboLocal, ctx.combo||0); return { good:true, scoreDelta:40 }; }
    if(ch==='💎'){ comboLocal = Math.max(comboLocal, ctx.combo||0); return { good:true, scoreDelta:80 }; }
    if(ch==='🛡️'){ return { good:true, scoreDelta:0 }; } // (ให้เอาไปใช้เองได้ถ้าจะเพิ่มโล่จริง)

    const isGood = GOOD.includes(ch);
    if(isGood){
      const val = valueForGood(ctx.combo||0);
      comboLocal = (ctx.combo||0)+1;
      return { good:true, scoreDelta:val };
    } else {
      comboLocal = 0;
      return { good:false, scoreDelta:-15 };
    }
  }

  // boot
  const api = await factoryBoot({
    host: cfg.host, difficulty: diff, duration: dur,
    pools: { good: GOOD, bad: JUNK }, goodRate: 0.66,
    judge,
    onExpire: ev => { // junk ที่หมดอายุ = หลีกขยะ (นับ quest ฝั่งคุณที่ listen 'hha:expired' ได้)
      // ลดคะแนน/เพิ่มก็แล้วแต่ดีไซน์ ที่นี่ไม่ทำอะไร แค่ปล่อยอีเวนต์จาก factory อยู่แล้ว
      addFever(+2);
    }
  });

  // cleanup
  window.addEventListener('hha:end', ()=>{
    try{ clearTimeout(feverTimer); }catch{}
    setFlame(false); destroyFeverGauge();
    window.removeEventListener('hha:hit-screen', onHitScreen);
  }, { once:true });

  return api;
}
export default { boot };
