import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';

const POOL = ['🍎','🍌','🥦','🍞','🥩','🐟','🥛','🍚','🥕','🍇'];

export async function boot(cfg={}){
  const host=document.getElementById('spawnHost'), scene=document.querySelector('a-scene');
  const diff=String(cfg.difficulty||'normal');
  const tune = {
    easy:{nextGap:[650,950],life:[1700,2000],minDist:0.36},
    normal:{nextGap:[500,750],life:[1300,1600],minDist:0.32},
    hard:{nextGap:[380,560],life:[1000,1300],minDist:0.30}
  }[diff];

  const sp = makeSpawner({ bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6}, minDist:tune.minDist });

  function nextGap(){const[a,b]=tune.nextGap;return a+Math.random()*(b-a);}
  function lifeMs(){const[a,b]=tune.life;return a+Math.random()*(b-a);}

  // เป้า: จัด “ครบ 5 หมู่” แล้วขึ้นรอบใหม่
  let roundGot=new Set(), totalScore=0;

  function spawnOne(){
    const ch = POOL[(Math.random()*POOL.length)|0];
    const pos=sp.sample();
    const el=emojiImage(ch,0.68,128); el.classList.add('clickable');
    el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el);
    const rec = sp.markActive({x:pos.x,y:pos.y,z:pos.z});
    const ttl = setTimeout(()=>{ try{host.removeChild(el);}catch{} sp.unmark(rec); }, lifeMs());

    el.addEventListener('click',(ev)=>{
      ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
      floatScore(scene, wp, '+20');
      totalScore += 20;
      roundGot.add(groupOf(ch));
      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:totalScore, combo:0}}));
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`จัดจานให้ครบ 5 หมู่: ${roundGot.size}/5`}}));
      try{host.removeChild(el);}catch{} sp.unmark(rec);

      if (roundGot.size>=5){ roundGot.clear(); /* รอบใหม่ */ }
    }, {passive:false});
  }

  function groupOf(ch){
    if ('🍎🍌🍇'.includes(ch)) return 'fruit';
    if ('🥦🥕'.includes(ch))   return 'veg';
    if ('🍞🍚'.includes(ch))   return 'carb';
    if ('🥩🐟'.includes(ch))   return 'protein';
    return 'dairy';
  }

  function loop(){ spawnOne(); setTimeout(loop,nextGap()); }
  loop();
  return { stop(){}, pause(){}, resume(){} };
}
export default { boot };
