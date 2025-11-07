// === Hero Health — modes/goodjunk.safe.js ===
// DROP-IN: ใช้แทนที่ทั้งไฟล์ได้ หรือคัดเฉพาะส่วน "ADD" ไปใส่ในไฟล์เดิม

import { Particles } from '../vr/particles.js';

// ---------- ADD: utilities ----------
function uvFromEvent(e){
  // เดาพิกัดจอจากอีเวนต์คลิก (ถ้าไม่มี ใช้ค่ากลาง)
  const x = (e && (e.clientX!=null)) ? e.clientX / window.innerWidth  : 0.5;
  const y = (e && (e.clientY!=null)) ? e.clientY / window.innerHeight : 0.6;
  return [x, y];
}

export async function boot(config = {}) {
  const host = (config && config.host) || document.getElementById('spawnHost');
  let score = 0, combo = 0, timeLeft = Number(config.duration||60);
  let running = true;

  // HUD tick (เวลา)
  const timer = setInterval(()=>{
    if(!running) return;
    timeLeft = Math.max(0, timeLeft - 1);
    window.dispatchEvent(new CustomEvent('hha:time', { detail:{ sec: timeLeft } }));
    if(timeLeft <= 0){ end(); }
  }, 1000);

  function end(){
    if(!running) return;
    running = false;
    clearInterval(timer);
    window.dispatchEvent(new CustomEvent('hha:end', { detail:{ score, combo } }));
  }

  // ---------- ADD: award() + quest text ----------
  function setQuestText(txt){
    window.dispatchEvent(new CustomEvent('hha:quest', { detail:{ text: txt } }));
  }
  setQuestText('No-Junk  | เก็บของดี 8 ชิ้น (ขยะ ≤3)');

  function award(delta, isGood, e){
    // คะแนน & คอมโบ
    if(isGood){ combo = Math.max(1, combo + 1); } else { combo = 0; }
    score += delta;
    window.dispatchEvent(new CustomEvent('hha:score', { detail:{ score, combo } }));

    // เอฟเฟ็กต์
    const [u,v] = uvFromEvent(e);
    Particles.hit(u, v, { score: Math.abs(delta), combo: Math.max(1,combo), isGood });
  }

  // ---------- สุ่มเป้าแบบ DOM (อีมูเลตง่าย ๆ) ----------
  const GOOD = ['🍎','🍐','🍊','🍓','🍇','🥝','🥦','🥕','🥗','🐟','🥛','🍞'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🧋','🥤','🍫','🍰'];

  function spawnOne(){
    if(!running) return;
    const isGood = Math.random() < 0.7;
    const emoji  = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];

    const el = document.createElement('div');
    el.textContent = emoji;
    Object.assign(el.style, {
      position:'fixed', left:(10+Math.random()*80)+'vw', top:(20+Math.random()*60)+'vh',
      fontSize:'min(10vw,64px)', filter:'drop-shadow(0 0 10px #fff3)', cursor:'pointer', userSelect:'none',
      transition:'transform 120ms ease-out'
    });
    document.body.appendChild(el);

    const onHit = (e)=>{
      el.onclick = null;
      el.style.transform='scale(0.85)';
      setTimeout(()=>{ try{ el.remove(); }catch{} }, 120);
      // ให้คะแนน
      award(isGood? +10 : -5, isGood, e);
    };
    el.onclick = onHit;

    // lifetime
    setTimeout(()=>{ try{ el.remove(); }catch{} }, 1500);
  }

  // spawn loop
  const spawner = setInterval(spawnOne, 550);

  // คืน API
  return {
    stop(){ running=false; clearInterval(timer); clearInterval(spawner); },
    pause(){ running=false; },
    resume(){ running=true; }
  };
}

export default { boot };