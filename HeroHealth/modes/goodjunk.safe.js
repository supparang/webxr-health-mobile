// === modes/goodjunk.safe.js (fix: cfg default, safe locals, no globals) ===
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
    easy:   { gap:[420, 640], life:[1500,1800] },
    normal: { gap:[360, 520], life:[1200,1500] },
    hard:   { gap:[300, 440], life:[950, 1200] }
  };
  const T = tune[diff] || tune.normal;

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})) }catch{} }
  function nextGap(){ const [a,b]=T.gap;  return Math.floor(a + Math.random()*(b-a)); }
  function lifeMs(){  const [a,b]=T.life; return Math.floor(a + Math.random()*(b-a)); }

  function spawnOne(){
    if(!running) return;
    const isGood = Math.random()>0.35;
    const ch = isGood ? GOOD[(Math.random()*GOOD.length)|0]
                      : JUNK[(Math.random()*JUNK.length)|0];

    // ตำแหน่งกึ่งกลางจอ (แถบใช้งาน 0.0..1.0 หน้าจอ) map ไป world: x ∈ [-0.7,0.7], y ∈ [-0.05,0.45]
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
      // พลาด: good พลาดโดนโทษ, junk ปล่อยผ่าน
      if (GOOD.includes(ch)) {
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

        if (isGood){
          const plus = 20 + combo*2;
          score += plus; combo++; hits++;
          burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0, mode:'goodjunk' });
          floatScore(scene, wp, `+${plus}`, '#b7f7c2');
        } else {
          // junk โดนหัก
          score = Math.max(0, score-15); combo = 0; misses++;
          burstAt(scene, wp, { color:'#ef4444', count:14, speed:0.9, mode:'goodjunk' });
          floatScore(scene, wp, `-15`, '#ffb4b4');
          emit('hha:miss', {count:misses});
        }

        emit('hha:score', {score, combo});
      }finally{
        try{ host.removeChild(el);}catch{}
      }
    }, {passive:false});
  }

  // วนสแปว์น
  let spawnTimer = null;
  (function loop(){ if(!running) return; spawnOne(); spawnTimer = setTimeout(loop, nextGap()); })();

  // นับเวลาจบเกม
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
        mode:'Good vs Junk', difficulty:diff,
        score, comboMax:combo, misses, hits, spawns, duration
      });
    }
  }, 1000);

  // แสดง Mini Quest แรก
  emit('hha:quest', {text:'Mini Quest: เก็บของดีติดกันให้ได้ 10 ชิ้น!'});

  return {
    stop(){ running=false; try{ clearInterval(timeTimer); clearTimeout(spawnTimer);}catch{} },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; (function loop(){ if(!running) return; spawnOne(); spawnTimer=setTimeout(loop,nextGap()); })(); } }
  };
}

export default { boot };
