import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';

const GROUPS = {
  veg:['🥦','🥕','🥬','🍅','🫐','🍓'],
  protein:['🐟','🥚','🍗','🥩','🧀','🥜'],
  carb:['🍞','🍚','🍝','🥨','🥔','🌽'],
  fruit:['🍎','🍌','🍊','🍍','🍇','🍐'],
  dairy:['🥛','🧈','🍦','🧀']
};
const ALL = Object.values(GROUPS).flat();

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

  // goal 1/2/3 (อัปโดยความยาก)
  let goalCount = {easy:1,normal:2,hard:3}[diff];

  function spawnOne(){
    const ch = ALL[(Math.random()*ALL.length)|0];
    const pos = sp.sample();
    const el=emojiImage(ch,0.68,128);
    el.classList.add('clickable');
    el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el);
    const rec = sp.markActive({x:pos.x,y:pos.y,z:pos.z});
    const ttl = setTimeout(()=>{ try{host.removeChild(el);}catch{} sp.unmark(rec); }, lifeMs());

    el.addEventListener('click', (ev)=>{
      ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      // ตรวจหมวดเป้าปัจจุบัน (ให้โหมดตั้ง targetGroup ไว้เอง)
      const ok = GROUPS[targetGroup].includes(ch);
      burstAt(scene, wp, { color: ok?'#22c55e':'#ef4444', count: ok?18:10, speed: ok?1.0:0.8 });
      floatScore(scene, wp, ok?'+25':'-10');
      if (ok) { score+=25; hitGoalCount++; } else { score=Math.max(0,score-10); }
      // ส่ง HUD + เควสต์
      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo:0}}));
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เลือกหมวด: ${targetGroup} — ${hitGoalCount}/${goalCount}`}}));

      try{host.removeChild(el);}catch{} sp.unmark(rec);

      // เป้าหมดรอบนี้?
      if (hitGoalCount>=goalCount) nextRound(); // รีเซ็ต targetGroup ใหม่สุ่ม + เพิ่มความท้าทาย
    }, {passive:false});
  }

  function loop(){ spawnOne(); setTimeout(loop,nextGap()); }
  // เตรียมรอบแรก
  let targetGroup = 'veg', score=0, hitGoalCount=0;
  function nextRound(){
    const keys = Object.keys(GROUPS);
    targetGroup = keys[(Math.random()*keys.length)|0];
    hitGoalCount = 0;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้าหมวดใหม่: ${targetGroup.toUpperCase()} — ${hitGoalCount}/${goalCount}`}}));
  }
  nextRound(); loop();

  return { stop(){}, pause(){}, resume(){} };
}
export default { boot };
