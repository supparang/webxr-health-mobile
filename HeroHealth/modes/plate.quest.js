// === modes/plate.quest.js (fix cfg default, healthy plate + special slot) ===
import { emojiImage } from '../vr/emoji-sprite.js';
import { burstAt, floatScore } from '../vr/shards.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = (cfg.host) || document.getElementById('spawnHost') || scene;
  const diff  = String(cfg.difficulty || 'normal');
  const duration = Number.isFinite(+cfg.duration) ? +cfg.duration
                   : (diff==='easy'?90:(diff==='hard'?45:60));

  let running = true, score = 0, combo = 0, hits = 0, misses = 0, spawns = 0;

  const tune = {
    easy:   { gap:[450, 700], life:[1500, 1800] },
    normal: { gap:[380, 580], life:[1200, 1500] },
    hard:   { gap:[320, 500], life:[950,  1200] }
  };
  const T = tune[diff] || tune.normal;
  function nextGap(){ const [a,b]=T.gap;  return Math.floor(a + Math.random()*(b-a)); }
  function lifeMs(){  const [a,b]=T.life; return Math.floor(a + Math.random()*(b-a)); }

  // เป้าหมาย: เก็บให้ครบ 5 หมู่
  const GROUPS = {
    fruit:  ['🍎','🍌','🍊','🍇','🍓','🍍','🍐','🍉','🥝'],
    dairy:  ['🥛','🧀'],
    protein:['🐟','🥚','🍗','🥩','🫘','🥜'],
    grain:  ['🍞','🍚','🥖','🥯','🍝'],
    veg:    ['🥦','🥕','🥬','🍅','🌽']
  };
  const ALL = Object.values(GROUPS).flat();
  const need = new Set(Object.keys(GROUPS)); // ยังต้องการหมู่ใดบ้าง

  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }
  emit('hha:quest', {text:'Mini Quest: จัดจานให้ครบ 5 หมู่!'});

  function hitGroup(emoji){
    for (const [g, arr] of Object.entries(GROUPS)){
      if (arr.includes(emoji)) return g;
    }
    return null;
  }

  function spawnOne(){
    if(!running) return;
    const ch = ALL[(Math.random()*ALL.length)|0];

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
      // ถ้าของที่ต้องการแล้วพลาด → โดนโทษ
      const g = hitGroup(ch);
      if (g && need.has(g)) {
        combo = 0; score = Math.max(0, score-10); misses++;
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
        const g = hitGroup(ch);
        if (g){
          const plus = 25 + combo*2;
          score += plus; combo++; hits++;
          need.delete(g);
          burstAt(scene, wp, { mode:'plate', count:18, speed:1.0 });
          floatScore(scene, wp, `+${plus}`);
          if (need.size === 0) {
            emit('hha:quest', {text:'ครบ 5 หมู่แล้ว! จัดชุดต่อเนื่องเพื่อทำคะแนน!'});
          }
        } else {
          score = Math.max(0, score-10); combo = 0; misses++;
          burstAt(scene, wp, { mode:'plate', color:'#ef4444', count:12, speed:0.9 });
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
        mode:'Healthy Plate', difficulty:diff,
        score, comboMax:combo, misses, hits, spawns, duration,
        questsCleared: (need.size===0?1:0), questsTotal: 3
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
