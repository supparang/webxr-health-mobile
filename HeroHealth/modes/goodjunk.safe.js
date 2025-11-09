// Good vs Junk — ป้องกัน “เป้ากระจุก” + Adaptive + Coach + MiniQuest
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');

  // duration ตามระดับ ถ้าไม่ส่งเข้ามา
  const defaultDur = { easy:90, normal:60, hard:45 }[diff] || 60;
  let left = Number(cfg.duration || defaultDur);

  // ปรับความยาก + กันกระจุก
  const tune = {
    easy:   { gap:[420,640], life:[1500,1800], minDist:0.36, maxActiveMin:2, maxActiveMax:4 },
    normal: { gap:[360,520], life:[1200,1500], minDist:0.32, maxActiveMin:2, maxActiveMax:5 },
    hard:   { gap:[300,440], life:[ 950,1200], minDist:0.30, maxActiveMin:2, maxActiveMax:6 },
  };
  const T = tune[diff] || tune.normal;

  const sp = makeSpawner({
    bounds: { x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 },
    minDist: T.minDist,
    decaySec: 2.2
  });

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

  let score=0, combo=0, misses=0, running=true;
  const active = [];
  const deck = new MissionDeck(); deck.draw3(); // ใช้ pool เริ่มต้นของ MissionDeck
  fireQuest();

  // adaptive state
  let currentMaxActive = T.maxActiveMin;
  const recent = { hits:0, misses:0, lastMissAt:performance.now(), lastAdjustAt:performance.now() };

  // time loop
  const tmr = setInterval(()=>{
    if(!running) return;
    left = Math.max(0, left-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:left}}));
    deck.second();
    if (deck.isCleared()) {
      fireQuest('Mini Quest สำเร็จ! FEVER กำลังทำงาน…');
    }
    if (left<=0) end('timeout');
  }, 1000);

  function nextGap(){ const [a,b]=T.gap; return a + Math.random()*(b-a); }
  function lifeMs(){  const [a,b]=T.life;return a + Math.random()*(b-a); }

  function spawnOne(){
    if (!running) return;
    if (active.length >= currentMaxActive) return;

    const isGood = Math.random() > 0.35;
    const ch = isGood ? pick(GOOD) : pick(JUNK);

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el);

    const rec = sp.markActive(pos);
    active.push(el);

    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if (isGood) { // พลาดของดี → โทษ
        combo=0; score=Math.max(0, score-10); misses++;
        recent.misses++; recent.lastMissAt = performance.now();
        window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
        deck.onJunk(); // ถือว่า “พลาด”
      }
      try{ host.removeChild(el);}catch{}
      sp.unmark(rec);
      active.splice(active.indexOf(el),1);
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      ev.preventDefault();
      clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      const val = isGood ? (20 + combo*2) : -15;

      if (isGood){ combo++; recent.hits++; deck.onGood(); } else { combo=0; deck.onJunk(); }
      score = Math.max(0, score + val);

      burstAt(scene, wp, { color: isGood?'#22c55e':'#ef4444', count:isGood?18:12, speed:isGood?1.0:0.8 });
      floatScore(scene, wp, (val>0?'+':'')+val);

      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));

      try{ host.removeChild(el);}catch{}
      sp.unmark(rec);
      active.splice(active.indexOf(el),1);
    }, {passive:false});
  }

  // main spawn loop + watchdog
  (function loop(){ if(!running) return; spawnOne(); setTimeout(loop, nextGap()); })();
  const wd = setInterval(()=>{ if(running && active.length===0) spawnOne(); }, 1800);

  // adaptive controller
  const adapt = setInterval(()=>{
    if(!running) return;
    const now = performance.now();
    const secMiss = (now - recent.lastMissAt)/1000;
    const secAdj  = (now - recent.lastAdjustAt)/1000;

    // ramp up
    if (secMiss >= 6 && recent.hits >= 5 && secAdj >= 5) {
      const before = currentMaxActive;
      currentMaxActive = Math.min(T.maxActiveMax, currentMaxActive+1);
      if (currentMaxActive>before) {
        scaleGapBy(0.90);
        coach(`สุดยอด! ลุยที่ ${currentMaxActive} เป้า 🔥`);
        recent.hits = 0; recent.lastAdjustAt = now;
      }
    }
    // soften on recent miss
    if (secMiss < 2 && secAdj >= 2) {
      const before = currentMaxActive;
      currentMaxActive = Math.max(T.maxActiveMin, currentMaxActive-1);
      if (currentMaxActive<before) {
        scaleGapBy(1.05);
        coach(`ไม่เป็นไร ผ่อนลงเหลือ ${currentMaxActive} เป้า ✨`);
        recent.hits = 0; recent.lastAdjustAt = now;
      }
    }
  }, 1000);

  function scaleGapBy(f){
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const [ga,gb]=T.gap, na=clamp(Math.round(ga*f),220,1200), nb=clamp(Math.round(gb*f),280,1600);
    T.gap=[Math.min(na,nb), Math.max(na,nb)];
  }
  function coach(text){ window.dispatchEvent(new CustomEvent('hha:coach',{detail:{text}})); }
  function fireQuest(text){
    if (!text) {
      const cur = deck.getCurrent();
      const prog = deck.getProgress();
      const done = prog.filter(p=>p.done).length;
      const label = cur ? cur.label : 'Mini Quest';
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${done+1}/3: ${label}`}}));
    } else {
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text}}));
    }
  }

  function end(reason='done'){
    if(!running) return;
    running=false;
    clearInterval(tmr); clearInterval(wd); clearInterval(adapt);

    // cleanup nodes
    const nodes=[...active]; active.length=0;
    nodes.forEach(n=>{ try{ n.remove(); }catch{} });

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        reason, score, comboMax:combo, misses, duration:defaultDur,
        mode:'Good vs Junk', difficulty:diff,
        questsCleared: deck.getProgress().filter(p=>p.done).length,
        questsTotal: 3
      }
    }));
  }

  // เผื่อภายนอกเรียกหยุด
  return { stop:()=>end('quit'), pause:()=>running=false, resume:()=>{ if(!running){ running=true; } } };
}

function pick(a){ return a[(Math.random()*a.length)|0]; }
export default { boot };
