// === Hero Health — modes/plate.quest.js ===
import { Particles } from '../vr/particles.js';

function uvFromEvent(e){
  const x = (e && (e.clientX!=null)) ? e.clientX / window.innerWidth  : 0.5;
  const y = (e && (e.clientY!=null)) ? e.clientY / window.innerHeight : 0.6;
  return [x, y];
}

export async function boot(config = {}) {
  let score=0, combo=0, timeLeft=Number(config.duration||60), running=true;

  const GROUPS = ['Carb','Protein','Veg','Fruit','Dairy'];
  let need = new Set(GROUPS); // ต้องครบ 5 หมู่

  function questText(){
    window.dispatchEvent(new CustomEvent('hha:quest',{
      detail:{ text:`Plate — จัดให้ครบ 5 หมู่: [${[...need].join(', ')}]` }
    }));
  }
  questText();

  const timer=setInterval(()=>{ if(!running) return;
    timeLeft=Math.max(0,timeLeft-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    if(timeLeft<=0) end();
  },1000);

  function end(){ if(!running) return; running=false; clearInterval(timer);
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{score,combo}})); }

  function award(delta,isGood,e){
    combo = isGood ? Math.max(1,combo+1) : 0;
    score += delta;
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
    const [u,v]=uvFromEvent(e);
    Particles.hit(u,v,{score:Math.abs(delta),combo:Math.max(1,combo),isGood});
  }

  function spawnFood(){
    const g = GROUPS[(Math.random()*GROUPS.length)|0];
    const btn=document.createElement('button');
    btn.textContent=g;
    Object.assign(btn.style,{
      position:'fixed', left:(10+Math.random()*80)+'vw', top:(20+Math.random()*60)+'vh',
      padding:'8px 10px', borderRadius:'10px', border:'1px solid #334155',
      background:'#0b1222', color:'#fff', cursor:'pointer'
    });
    document.body.appendChild(btn);
    btn.onclick=(e)=>{
      const isGood = need.has(g);
      if(isGood){ need.delete(g); award(+7,true,e); }
      else{ award(-5,false,e); }
      questText();
      try{ btn.remove(); }catch{}
      if(need.size===0){
        // ครบ 5 หมู่ → เริ่มรอบใหม่
        need = new Set(GROUPS);
        questText();
      }
    };
    setTimeout(()=>{ try{ btn.remove(); }catch{} }, 1700);
  }

  const spawner=setInterval(()=>{ if(running) spawnFood(); }, 650);

  return { stop(){running=false;clearInterval(timer);clearInterval(spawner);},
           pause(){running=false;}, resume(){running=true;} };
}

export default { boot };