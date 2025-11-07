// === Hero Health — modes/groups.safe.js ===
import { Particles } from '../vr/particles.js';

// ---------- ADD: helpers ----------
function uvFromEvent(e){
  const x = (e && (e.clientX!=null)) ? e.clientX / window.innerWidth  : 0.5;
  const y = (e && (e.clientY!=null)) ? e.clientY / window.innerHeight : 0.6;
  return [x, y];
}

export async function boot(config = {}) {
  const host = (config && config.host) || document.getElementById('spawnHost');
  let score=0, combo=0, timeLeft=Number(config.duration||60), running=true;

  const timer = setInterval(()=>{ if(!running) return;
    timeLeft=Math.max(0,timeLeft-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:timeLeft}}));
    if(timeLeft<=0){ end(); }
  },1000);

  function end(){ if(!running) return; running=false; clearInterval(timer);
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{score,combo}})); }

  function setQuest(t){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:t}})); }
  setQuest('เลือกหมวดตามโจทย์ | เพิ่มเป้า 1→3 เมื่อทำถูกติดกัน');

  function award(delta,isGood,e){
    combo = isGood ? Math.max(1,combo+1) : 0;
    score += delta;
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
    const [u,v]=uvFromEvent(e);
    Particles.hit(u,v,{score:Math.abs(delta),combo:Math.max(1,combo),isGood});
  }

  // Mock: โจทย์สุ่ม “ผัก/ผลไม้/โปรตีน/แป้ง/นม”
  const GROUPS = ['Veg','Fruit','Protein','Carb','Dairy'];
  let current = GROUPS[(Math.random()*GROUPS.length)|0];
  setQuest(`Goal: ${current}  | ทำให้ครบเพื่อเพิ่มจำนวนเป้า`);

  // เป้า
  function spawnItems(n=1){
    for(let i=0;i<n;i++){
      const el=document.createElement('button');
      el.textContent = GROUPS[(Math.random()*GROUPS.length)|0];
      Object.assign(el.style,{
        position:'fixed', left:(10+Math.random()*80)+'vw', top:(20+Math.random()*60)+'vh',
        padding:'8px 10px', borderRadius:'10px', border:'1px solid #334155',
        background:'#0b1222', color:'#fff', cursor:'pointer', userSelect:'none'
      });
      document.body.appendChild(el);
      el.onclick=(e)=>{
        const isGood = (el.textContent===current);
        award(isGood?+8:-4, isGood, e);
        try{ el.remove(); }catch{}
      };
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 1600);
    }
  }

  let pack=1;
  const spawner=setInterval(()=>{
    if(!running) return;
    spawnItems(pack);
    // เพิ่มจำนวนเป้าเมื่อคอมโบสูง
    if(combo>0 && combo%4===0) pack = Math.min(3, pack+1);
  },700);

  return { stop(){running=false;clearInterval(timer);clearInterval(spawner);},
           pause(){running=false;}, resume(){running=true;} };
}

export default { boot };