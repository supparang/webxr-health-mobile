import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';

const DRINKS = {
  good:['💧','🥛','🍵'],
  bad:['🥤','🧋','🍺'] // (ถ้ามี)
};

export async function boot(cfg={}){
  const host=document.getElementById('spawnHost'), scene=document.querySelector('a-scene');
  const diff=String(cfg.difficulty||'normal');

  const tune = {
    easy:{nextGap:[650,900],life:[1600,1900],minDist:0.36},
    normal:{nextGap:[500,720],life:[1300,1600],minDist:0.32},
    hard:{nextGap:[380,560],life:[1000,1300],minDist:0.30}
  }[diff];
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6}, minDist:tune.minDist });

  let gauge = 50; // 0..100 (กลางคือโซนพอดี)
  function inGreen(){ return gauge>=40 && gauge<=60; }

  function nextGap(){const[a,b]=tune.nextGap;return a+Math.random()*(b-a);}
  function lifeMs(){const[a,b]=tune.life;return a+Math.random()*(b-a);}

  function spawnOne(){
    const isGood = Math.random()<0.65;
    const ch = (isGood? DRINKS.good:DRINKS.bad)[(Math.random()* (isGood?DRINKS.good.length:DRINKS.bad.length))|0];
    const pos=sp.sample();
    const el=emojiImage(ch,0.7,128); el.classList.add('clickable');
    el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el);
    const rec = sp.markActive({x:pos.x,y:pos.y,z:pos.z});
    const ttl = setTimeout(()=>{ try{host.removeChild(el);}catch{} sp.unmark(rec); }, lifeMs());

    el.addEventListener('click',(ev)=>{
      ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      if (isGood){ gauge = Math.min(100, gauge + (inGreen()? +6 : +10)); score += inGreen()? 20:10; }
      else{       gauge = Math.max(0,   gauge - (inGreen()?  -8 :  12)); score = Math.max(0, score - (inGreen()? 5:15)); }

      burstAt(scene, wp, { color: isGood? '#22c55e':'#ef4444', count: 16, speed: 1.0 });
      floatScore(scene, wp, (isGood?'+':'')+(isGood?(inGreen()?20:10):-(inGreen()?5:15)));

      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo:0}}));
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Hydration: ${Math.round(gauge)}% (เป้า 40–60%)`}}));

      try{host.removeChild(el);}catch{} sp.unmark(rec);
    }, {passive:false});
  }

  let score=0;
  function loop(){ spawnOne(); setTimeout(loop,nextGap()); }
  loop();
  return { stop(){}, pause(){}, resume(){} };
}
export default { boot };
