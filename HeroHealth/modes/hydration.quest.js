// === modes/hydration.quest.js (fix cfg default, water gauge friendly, emoji drops) ===
import { emojiImage } from '../vr/emoji-sprite.js';
import { burstAt, floatScore } from '../vr/shards.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = (cfg.host) || document.getElementById('spawnHost') || scene;
  const diff  = String(cfg.difficulty || 'normal');
  const duration = Number.isFinite(+cfg.duration) ? +cfg.duration
                   : (diff==='easy'?90:(diff==='hard'?45:60));

  let running = true, score = 0, combo = 0, hits = 0, misses = 0, spawns = 0;
  let water = 0; // 0..100

  const tune = {
    easy:   { gap:[450, 700], life:[1500, 1800] },
    normal: { gap:[380, 580], life:[1200, 1500] },
    hard:   { gap:[320, 500], life:[950,  1200] }
  };
  const T = tune[diff] || tune.normal;
  function nextGap(){ const [a,b]=T.gap;  return Math.floor(a + Math.random()*(b-a)); }
  function lifeMs(){  const [a,b]=T.life; return Math.floor(a + Math.random()*(b-a)); }

  const GOOD = ['💧','🚰','🥤','🫗']; // เน้นน้ำ/ดื่ม
  const JUNK = ['🍺','🥤','🧋','🍻']; // ตัวอย่าง: เครื่องดื่มหวาน/แอลกอฮอล์

  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }

  // แจ้ง mission
  emit('hha:quest', {text:'Mini Quest: เติมน้ำให้ถึงเกจ 100% !'});

  // HUD fever ใช้ไม่ได้ตรงนี้ แต่เราใช้ water เป็น gauge ฝั่งโหมดเอง
  function updateWater(delta){
    water = Math.max(0, Math.min(100, water + delta));
    // สื่อสารผ่าน fever bar reuse (แค่โชว์ระดับ)
    window.dispatchEvent(new CustomEvent('hha:fever', {detail:{state:'change', level:water, active:false}}));
  }

  function spawnOne(){
    if(!running) return;
    const isGood = Math.random() > 0.35;
    const ch = (isGood ? GOOD : JUNK)[(Math.random()*(isGood?GOOD:JUNK).length)|0];

    const x = -0.7 + Math.random()*1.4;
    const y = -0.05 + Math.random()*0.50;
    const z = -1.6;

    const el = emojiImage(ch, 0.7, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${x} ${y} ${z}`);
    host.appendChild(el);
    spawns++;

    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      // ถ้าเป็นน้ำดีแล้วไม่ทัน → ลงโทษเล็กน้อย (น้ำลด)
      if (GOOD.includes(ch)) {
        combo = 0; score = Math.max(0, score-5); misses++;
        updateWater(-5);
        emit('hha:miss', {count:misses});
        emit('hha:score', {score, combo});
      }
      try{ host.removeChild(el);}catch{}
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      ev.preventDefault();
      clearTimeout(ttl);
      try{
        const wp = el.object3D.getWorldPosition
          ? el.object3D.getWorldPosition(new THREE.Vector3())
          : {x:x,y:y,z:z};
        if (isGood){
          const plus = 15 + combo*2;
          score += plus; combo++; hits++;
          updateWater(+12);
          burstAt(scene, wp, { mode:'hydration', count:16, speed:1.0 });
          floatScore(scene, wp, `+${plus}`);
        } else {
          score = Math.max(0, score-10); combo = 0; misses++;
          updateWater(-10);
          burstAt(scene, wp, { mode:'hydration', color:'#ef4444', count:12, speed:0.9 });
          floatScore(scene, wp, `-10`, '#ffb4b4');
          emit('hha:miss', {count:misses});
        }
        emit('hha:score', {score, combo});
      }finally{
        try{ host.removeChild(el);}catch{}
      }
    }, {passive:false});
  }

  let spawnTimer = null;
  (function loop(){ if(!running) return; spawnOne(); spawnTimer = setTimeout(loop, nextGap()); })();

  let left = duration;
  emit('hha:time', {sec:left});
  const timeTimer = setInterval(()=>{
    if(!running) return;
    left = Math.max(0, left-1);
    emit('hha:time',{sec:left});
    if(left<=0){
      running=false;
      clearInterval(timeTimer);
      clearTimeout(spawnTimer);
      emit('hha:end', {
        mode:'Hydration', difficulty:diff,
        score, comboMax:combo, misses, hits, spawns, duration,
        questsCleared: water>=100 ? 1 : 0, questsTotal: 3
      });
    }
  }, 1000);

  return {
    stop(){ running=false; try{ clearInterval(timeTimer); clearTimeout(spawnTimer);}catch{} },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; (function loop(){ if(!running) return; spawnOne(); spawnTimer=setTimeout(loop,nextGap()); })(); } }
  };
}
export default { boot };
