// === Hero Health — modes/hydration.quest.js ===
import { Particles } from '../vr/particles.js';

function uvFromEvent(e){
  const x = (e && (e.clientX!=null)) ? e.clientX / window.innerWidth  : 0.5;
  const y = (e && (e.clientY!=null)) ? e.clientY / window.innerHeight : 0.6;
  return [x, y];
}

export async function boot(config = {}) {
  let score=0, combo=0, timeLeft=Number(config.duration||60), running=true;
  let zone = 'LOW'; // LOW/GREEN/HIGH

  function setQuestText(){
    const text = `Hydration — Zone: ${zone} | GREEN 0/20s | Streak 0/10 | Recover HIGH → GREEN ≤3s`;
    window.dispatchEvent(new CustomEvent('hha:quest', { detail:{ text } }));
  }
  setQuestText();

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

  // ปุ่ม “ดื่มน้ำ/กินของเค็ม/เย็น ฯลฯ” จำลอง
  function spawnChoices(){
    const items = [
      {name:'Drink Water',        effect:+1,  good: zone!=='HIGH' },
      {name:'Salty Snack',        effect:+1,  good:false },
      {name:'Ice Tea (sweet)',    effect:+1,  good:false },
      {name:'Rest / Pause',       effect:-1,  good: zone==='HIGH' },
    ];
    items.forEach((it,i)=>{
      const btn=document.createElement('button');
      btn.textContent=it.name;
      Object.assign(btn.style,{
        position:'fixed', left:(8+ i*24)+'vw', bottom:'10vh',
        padding:'10px 12px', borderRadius:'10px', border:'1px solid #334155',
        background:'#0b1222', color:'#fff', cursor:'pointer'
      });
      document.body.appendChild(btn);
      btn.onclick=(e)=>{
        // ปรับโซนแบบง่าย
        if(it.effect>0){
          zone = (zone==='LOW')?'GREEN':(zone==='GREEN')?'HIGH':'HIGH';
        }else{
          zone = (zone==='HIGH')?'GREEN':(zone==='GREEN')?'LOW':'LOW';
        }
        setQuestText();

        // กติกาคะแนน: GREEN = ดี, LOW/HIGH = เสี่ยง
        const good = (zone==='GREEN');
        const delta = good ? +6 : -6;
        award(delta, good, e);
      };
    });
  }
  spawnChoices();

  return { stop(){running=false;clearInterval(timer);}, pause(){running=false;}, resume(){running=true;} };
}

export default { boot };