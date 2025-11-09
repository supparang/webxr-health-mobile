// === modes/goodjunk.safe.js ===
import { SpawnSpace, createSpawnerPacer, defaultsByDifficulty, randIn } from '../vr/spawn-utils.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { burstAt, floatScore } from '../vr/shards.js';

export async function boot({ host, difficulty='normal', duration=60 }){
  const scene  = document.querySelector('a-scene');
  const origin = host.object3D.position;
  const pacer  = createSpawnerPacer();
  const def    = defaultsByDifficulty(difficulty);

  const GOOD = ['🍎','🍐','🍇','🍓','🥕','🥦','🍊','🍌','🍅','🥬'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍫','🧁','🥤','🌭','🍪'];

  let running = true, score=0, combo=0;

  function emitScore(delta, good){
    score = Math.max(0, score + delta);
    if(good){ combo+=1; } else { combo=0; }
    window.dispatchEvent(new CustomEvent('hha:score', {detail:{score, combo, delta, good}}));
  }

  function spawnOne(){
    if(!running) return;

    const isGood = Math.random() < 0.7;
    const pool = isGood ? GOOD : JUNK;
    const char = pool[(Math.random()*pool.length)|0];
    const el = emojiImage(char, 0.70, 128);

    const p = SpawnSpace.next(origin);
    el.setAttribute('position', `${p.x} ${p.y} ${p.z}`);
    el.object3D.position.z += (Math.random()*0.06 - 0.03);

    const life = randIn(def.life);
    const ttl = setTimeout(()=>{ if(el.parentNode){ el.parentNode.removeChild(el); emitScore(isGood? -2 : +1, false); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:0}})); } }, life);

    el.classList.add('clickable');
    el.addEventListener('click', ()=>{
      clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      if(el.parentNode) el.parentNode.removeChild(el);

      const delta = isGood ? +10 : -5;
      emitScore(delta, isGood);

      // FX
      burstAt(scene, wp, {color:isGood?'#34d399':'#ef4444', count:isGood?16:10, speed:isGood?1.0:0.7});
      floatScore(scene, wp, (delta>0?'+':'')+delta, {dur:800});
    });

    host.appendChild(el);
    pacer.track(el);
    pacer.schedule(randIn(def.gap), spawnOne);
  }

  // announce quest (สุ่ม 3 เควส—ตัวอย่าง)
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:'เก็บของดี 20 ชิ้น'}}));

  // timer
  let left=duration;
  const t = setInterval(()=>{ left=Math.max(0,left-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); if(left<=0){ end('timeout'); } },1000);

  function end(reason='done'){
    if(!running) return;
    running=false; clearInterval(t);
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason, score, comboMax:combo, misses:0, duration:duration}}));
  }

  spawnOne();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; pacer.schedule(randIn(def.gap), spawnOne);} }
  };
}
export default { boot };
