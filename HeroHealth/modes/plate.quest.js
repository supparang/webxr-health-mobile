// === modes/plate.quest.js ===
import { SpawnSpace, createSpawnerPacer, defaultsByDifficulty, randIn } from '../vr/spawn-utils.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { burstAt, floatScore } from '../vr/shards.js';

export async function boot({ host, difficulty='normal', duration=60 }){
  const scene=document.querySelector('a-scene');
  const origin=host.object3D.position;
  const pacer=createSpawnerPacer();
  const def=defaultsByDifficulty(difficulty);

  const POOL=['🥗','🍗','🍞','🥦','🍅','🍎','🐟','🥔'];
  let score=0, combo=0, running=true;
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:'จัดจานสุขภาพให้ลงตัว!'}}));

  function emit(delta,good){ score=Math.max(0,score+delta); combo = good?combo+1:0;
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo,delta,good}})); }

  function spawnOne(){
    if(!running) return;
    const char=POOL[(Math.random()*POOL.length)|0];
    const el=emojiImage(char,.72,128);

    const p=SpawnSpace.next(origin);
    el.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    el.object3D.position.z+=(Math.random()*0.06-0.03);

    const life=randIn(def.life); const ttl=setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, life);

    el.classList.add('clickable');
    el.addEventListener('click', ()=>{
      clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREE.Vector3());
      if(el.parentNode) el.parentNode.removeChild(el);
      const good=true; const delta=+6; emit(delta,good); // ตัวอย่าง: ทุกชิ้นให้คะแนนเมื่อวางลงจานถูกจุด (ต่อยอดเองได้)
      burstAt(scene, wp, {color:'#f59e0b'});
      floatScore(scene, wp, '+6', {dur:800});
    });

    host.appendChild(el); pacer.track(el); pacer.schedule(randIn(def.gap), spawnOne);
  }

  let left=duration; const ti=setInterval(()=>{ left=Math.max(0,left-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}})); if(left<=0){ end('timeout'); }},1000);
  function end(reason){ if(!running) return; running=false; clearInterval(ti);
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score,comboMax:combo,duration}})); }

  spawnOne();
  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; pacer.schedule(randIn(def.gap), spawnOne);} } };
}
export default { boot };
