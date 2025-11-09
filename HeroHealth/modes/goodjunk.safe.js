// === modes/goodjunk.safe.js (anti-cluster + quest/fever) ===
import { emojiImage } from '../vr/emoji-sprite.js';
import { burstAt, floatScore } from '../vr/shards.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = (cfg.host) || document.getElementById('spawnHost') || scene;
  const diff  = String(cfg.difficulty || 'normal');
  const duration = Number.isFinite(+cfg.duration) ? +cfg.duration
                   : (diff==='easy'?90:(diff==='hard'?45:60));

  let running = true, score = 0, combo = 0, hits = 0, misses = 0, spawns = 0;

  // ---------- Mini Quest: เก็บของดีติดกัน 10 ----------
  const questTarget = 10;
  let questStreak = 0;
  let questDone   = false;
  const emit = (n,d)=>{ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})) }catch{} };
  function setQuestText(){
    const text = questDone
      ? 'Mini Quest — สำเร็จ! FEVER กำลังทำงาน…'
      : `Mini Quest: เก็บของดีติดกัน 10 ชิ้น (${questStreak}/${questTarget})`;
    emit('hha:quest', {text});
  }
  setQuestText();

  // ---------- Tuning ----------
  const tune = {
    easy:   { gap:[420, 640], life:[1500,1800], minDist:0.36, maxActive:3 },
    normal: { gap:[360, 520], life:[1200,1500], minDist:0.32, maxActive:4 },
    hard:   { gap:[300, 440], life:[ 950,1200], minDist:0.30, maxActive:5 }
  };
  const T = tune[diff] || tune.normal;

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  function nextGap(){ const [a,b]=T.gap;  return Math.floor(a + Math.random()*(b-a)); }
  function lifeMs(){  const [a,b]=T.life; return Math.floor(a + Math.random()*(b-a)); }

  // ---------- Anti-cluster spawner (simple O(N) with min distance) ----------
  // พื้นที่กลางจอ: x ∈ [-0.75,0.75], y ∈ [-0.05,0.50], z = -1.6
  const bounds = { x:[-0.75,0.75], y:[-0.05,0.50], z:-1.6 };
  const active = []; // {x,y,el}
  function dist2(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }
  function sampleNonOverlap(minDist){
    const min2 = minDist*minDist;
    const padX = Math.max(0.02, minDist*0.6);
    const padY = Math.max(0.02, minDist*0.6);
    const xr = [bounds.x[0]+padX, bounds.x[1]-padX];
    const yr = [bounds.y[0]+padY, bounds.y[1]-padY];

    // ลองสุ่มหลายครั้งเพื่อหาจุดว่าง
    for(let tries=0; tries<28; tries++){
      const p = { x: xr[0] + Math.random()*(xr[1]-xr[0]),
                  y: yr[0] + Math.random()*(yr[1]-yr[0]),
                  z: bounds.z };
      let ok = true;
      for(let i=0;i<active.length;i++){
        if (dist2(p, active[i]) < min2){ ok=false; break; }
      }
      if(ok) return p;
    }
    // ไม่เจอ → เลือกจุดที่ "ไกลสุด" จากชิ้นที่ใกล้ที่สุดในชุดตัวอย่าง
    let best=null, bestScore=-1;
    for(let s=0;s<24;s++){
      const p = { x: xr[0] + Math.random()*(xr[1]-xr[0]),
                  y: yr[0] + Math.random()*(yr[1]-yr[0]),
                  z: bounds.z };
      let dmin = Infinity;
      for(let i=0;i<active.length;i++){
        dmin = Math.min(dmin, Math.sqrt(dist2(p, active[i])));
      }
      if(dmin>bestScore){ best=p; bestScore=dmin; }
    }
    return best || { x:(xr[0]+xr[1])/2, y:(yr[0]+yr[1])/2, z: bounds.z };
  }

  function spawnOne(){
    if(!running) return;
    // จำกัดจำนวนชิ้นบนจอ
    if (active.length >= T.maxActive) return;

    const isGood = Math.random()>0.35;
    const ch = isGood ? GOOD[(Math.random()*GOOD.length)|0]
                      : JUNK[(Math.random()*JUNK.length)|0];

    const p = sampleNonOverlap(T.minDist);
    const el = emojiImage(ch, 0.7, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${p.x} ${p.y} ${p.z}`);
    host.appendChild(el);
    spawns++;
    const node = {x:p.x,y:p.y,el};
    active.push(node);

    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      // หมดอายุ
      if (GOOD.includes(ch)) {
        questStreak = 0; combo = 0; score = Math.max(0, score-10); misses++;
        emit('hha:miss', {count:misses});
        emit('hha:score', {score, combo});
        if(!questDone) setQuestText();
      }
      try{ host.removeChild(el);}catch{}
      // remove from active
      const idx = active.indexOf(node); if(idx>-1) active.splice(idx,1);
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      ev.preventDefault();
      clearTimeout(ttl);
      try{
        const wp = el.object3D?.getWorldPosition
          ? el.object3D.getWorldPosition(new THREE.Vector3())
          : {x:p.x,y:p.y,z:p.z};

        if (isGood){
          const plus = 20 + combo*2;
          score += plus; combo++; hits++;

          if (!questDone){
            questStreak += 1;
            if (questStreak >= questTarget){
              questDone = true;
              emit('hha:fever', {state:'start', level:100, active:true});
            }
            setQuestText();
          }

          burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0, mode:'goodjunk' });
          floatScore(scene, wp, `+${plus}`, '#b7f7c2');
        } else {
          score = Math.max(0, score-15); combo = 0; misses++;
          if (!questDone && questStreak>0){ questStreak = 0; setQuestText(); }
          burstAt(scene, wp, { color:'#ef4444', count:14, speed:0.9, mode:'goodjunk' });
          floatScore(scene, wp, `-15`, '#ffb4b4');
          emit('hha:miss', {count:misses});
        }
        emit('hha:score', {score, combo});
      }finally{
        try{ host.removeChild(el);}catch{}
        const idx = active.indexOf(node); if(idx>-1) active.splice(idx,1);
      }
    }, {passive:false});
  }

  // ลูปสปอน
  let spawnTimer = null;
  (function loop(){ if(!running) return; spawnOne(); spawnTimer = setTimeout(loop, nextGap()); })();

  // เวลาเกม
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
      emit('hha:fever', {state:'end', level:0, active:false});
      emit('hha:end', {
        mode:'Good vs Junk', difficulty:diff,
        score, comboMax:combo, misses, hits, spawns, duration,
        questsCleared: questDone?1:0, questsTotal: 1
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
