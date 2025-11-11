// === /HeroHealth/modes/hydration.quest.js (release; uses ui-water.js) ===
const THREE = window.THREE;
import { waitAframe } from '../vr/aframe-wait.js';
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';
import { ensureWaterGauge, destroyWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

export async function boot(cfg = {}) {
  await waitAframe(); // map AFRAME.THREE -> window.THREE เมื่อพร้อม

  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // แสดง/รีเซ็ต Water Gauge จากโมดูล ui-water
  ensureWaterGauge();

  // item pools
  const GOOD = ['💧','🚰','🥛','🍊','🍋'];
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune = {
    easy:   { nextGap:[380,560], life:[1400,1700], minDist:0.34, badRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,500], life:[1200,1500], minDist:0.32, badRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[260,460], life:[1000,1300], minDist:0.30, badRate:0.40, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  // state
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain=dur, timerId=0, loopId=0, disposeHandler=null, secondTick=null;
  let water = 55; setWaterGauge(water);

  // quests 3 ใบตามระดับจาก drawThree
  const QUESTS_POOL = drawThree('hydration', diff);
  let qIdx=0;

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0], C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0], C.life[1]);

  function updateQuestHUD(){
    const txt = `Quest ${qIdx+1}/3 — ${QUESTS_POOL[qIdx]?.label || 'รักษาระดับน้ำให้พอดี'}`;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:txt}}));
  }
  updateQuestHUD();

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }

  function applyHit(type, wp){
    if (type==='good'){
      const val = 20 + combo*2;
      score += val; combo++; maxCombo=Math.max(maxCombo, combo); hits++;
      water = Math.min(100, water + 6);
      burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
      floatScore(scene, wp, '+'+val);
    } else if (type==='bad'){
      if (shield>0){ shield--; floatScore(scene, wp, 'Shield!'); burstAt(scene, wp, {color:'#60a5fa',count:14, speed:0.9}); }
      else{
        if (zoneFrom(water)==='HIGH'){ score += 5; floatScore(scene, wp, '+5 (High)'); }
        else { score = Math.max(0, score - 20); combo=0; floatScore(scene, wp, '-20'); }
        water = Math.max(0, water - 8);
        burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 });
      }
    } else if (type==='star'){
      score += 40; burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 }); floatScore(scene, wp, '+40 ⭐');
    } else if (type==='diamond'){
      score += 80; burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 }); floatScore(scene, wp, '+80 💎');
    } else if (type==='shield'){
      shield = Math.min(3, shield+1); burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 }); floatScore(scene, wp, '🛡️+1');
    }
    setWaterGauge(water);
    emitScore();
  }

  function tryAdvanceQuest(){
    const s = { score, goodCount:hits, junkMiss:misses, comboMax:maxCombo, feverCount:0, star:0, diamond:0, noMissTime:0, shield };
    const q = QUESTS_POOL[qIdx];
    if (!q) return;
    const done = q.check ? q.check(s) : false;
    if (done) {
      qIdx = Math.min(2, qIdx+1);
      updateQuestHUD();
    }
  }

  function end(reason='timeout'){
    if(!running) return;
    running=false;

    try { clearInterval(timerId); } catch {}
    try { clearTimeout(loopId); } catch {}
    try { clearInterval(secondTick); } catch {}
    if (disposeHandler) { window.removeEventListener('hha:dispose-ui', disposeHandler); disposeHandler=null; }

    // ล้าง UI น้ำ + เป้าที่ค้าง
    destroyWaterGauge();
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{ try{ n.remove(); }catch{} });

    // สรุปผล
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Hydration', difficulty:diff, score, comboMax, combo, misses, hits, spawns,
      duration:dur, questsCleared: qIdx+1, questsTotal:3, reason
    }}));
  }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length >= C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch, type;
    const r=Math.random();
    if      (r < 0.05) { ch=STAR; type='star'; }
    else if (r < 0.07) { ch=DIA;  type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      const good = Math.random() > C.badRate;
      ch = (good ? GOOD : BAD)[(Math.random()* (good?GOOD:BAD).length)|0];
      type = good ? 'good' : 'bad';
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.7, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ water=Math.max(0, water-4); score=Math.max(0, score-8); combo=0; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:++misses}})); setWaterGauge(water); emitScore(); }
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return;
      ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      applyHit(type, wp);
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
      tryAdvanceQuest();
      loopId=setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  // เวลา + เควสต์จับเวลา (noMissTime ผ่าน MissionDeck เดิมเราจับที่เกมนี้)
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:dur}}));
  timerId = setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout');
  },1000);

  // no-miss counter (ถ้าพลาด เรารีเซ็ตใน applyHit / miss handler)
  secondTick = setInterval(()=>{
    if(!running) return;
    // ใช้ water "Balanced" เป็นตัวบูสต์ progress ให้เควสต์บาลานซ์
    // ถ้าอยากใช้ MissionDeck แยก ให้เชื่อมในอนาคต
  },1000);

  // รับสัญญาณให้ล้าง UI (จาก index ตอนเปลี่ยนโหมด)
  disposeHandler = ()=> destroyWaterGauge();
  window.addEventListener('hha:dispose-ui', disposeHandler);

  // go!
  spawnOne();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnOne(); } }
  };
}
export default { boot };