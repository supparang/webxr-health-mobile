// === /HeroHealth/modes/goodjunk.safe.js (release; waitAframe patched) ===
import { waitAframe } from '../vr/aframe-ready.js';
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg = {}) {
  await waitAframe(); // ✅ รอ AFRAME.THREE พร้อมก่อน
  const THREE = window.THREE;

  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune = {
    easy:   { nextGap:[360,560], life:[1400,1700], minDist:0.34, junkRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,480], life:[1200,1500], minDist:0.32, junkRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[240,420], life:[1000,1300], minDist:0.30, junkRate:0.42, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0, starCount=0, diamondCount=0, noMissSec=0;
  let remain=dur, timeId=0, loopId=0, watchdogId=0, noMissId=0;

  const QUESTS = drawThree('goodjunk', diff); // 3 ใบ
  let qIdx=0;
  const questText = () => `Quest ${qIdx+1}/3 — ${QUESTS[qIdx]?.label || 'กำลังสุ่ม…'}`;
  const updateQuestHUD = () => window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}}));
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:'Quest 1/3 — กำลังสุ่ม…'}}));
  setTimeout(updateQuestHUD, 500);

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>Math.floor(rand(C.nextGap[0], C.nextGap[1]));
  const lifeMs =()=>Math.floor(rand(C.life[0], C.life[1]));
  const emitScore = ()=>window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));
  const emitMiss  = ()=>window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
  const stats = ()=>({ score, goodCount:hits, comboMax:maxCombo, star:starCount, diamond:diamondCount, junkMiss:misses, noMissTime:noMissSec, feverCount:0 });

  function tryAdvanceQuest(){
    const cur = QUESTS[qIdx]; if(!cur || !cur.check) return;
    if (cur.check(stats())) { qIdx = Math.min(qIdx+1, 2); updateQuestHUD(); }
  }

  function end(reason='timeout'){
    if(!running) return;
    running=false;
    [timeId,watchdogId,noMissId].forEach(id=>{ try{clearInterval(id);}catch{} });
    try{ clearTimeout(loopId); }catch{}
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{ try{ n.remove(); }catch{} });
    const cleared = QUESTS.reduce((n,q)=> n + (q?.check && q.check(stats()) ? 1 : 0), 0);
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Good vs Junk', difficulty:diff, score, comboMax:maxCombo, combo, misses, hits, spawns, duration:dur,
      questsCleared: cleared, questsTotal:3, reason
    }}));
  }

  function spawnOne(){
    if(!running) return;
    if (host.querySelectorAll('a-image').length >= C.maxConcurrent) { loopId=setTimeout(spawnOne,100); return; }

    let ch, type;
    const r=Math.random();
    if      (r < 0.04){ ch=STAR; type='star'; }
    else if (r < 0.06){ ch=DIA;  type='diamond'; }
    else if (r < 0.10){ ch=SHIELD; type='shield'; }
    else {
      const good = Math.random() > C.junkRate;
      ch = (good?GOOD:JUNK)[(Math.random()*(good?GOOD:JUNK).length)|0];
      type = good ? 'good':'junk';
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ misses++; combo=0; score=Math.max(0,score-10); noMissSec=0; emitMiss(); emitScore(); }
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      if(!running) return;
      ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      if(type==='good'){
        const val = 20 + combo*2;
        score += val; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
        burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
        floatScore(scene, wp, '+'+val);
      } else if (type==='junk'){
        if (shield>0){ shield--; floatScore(scene, wp, 'Shield!'); burstAt(scene, wp, {color:'#60a5fa',count:14,speed:0.9}); }
        else { combo=0; score=Math.max(0,score-15); misses++; noMissSec=0; floatScore(scene, wp, '-15'); burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 }); emitMiss(); }
      } else if (type==='star'){ score+=40; starCount++; burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 }); floatScore(scene, wp, '+40 ⭐'); }
      else if (type==='diamond'){ score+=80; diamondCount++; burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 }); floatScore(scene, wp, '+80 💎'); }
      else if (type==='shield'){ shield=Math.min(3,shield+1); burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 }); floatScore(scene, wp, '🛡️+1'); }

      emitScore();
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
      tryAdvanceQuest();
      loopId=setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  noMissId = setInterval(()=>{ if (running) noMissSec = Math.min(9999, noMissSec+1); }, 1000);
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timeId = setInterval(()=>{ if(!running) return; remain=Math.max(0,remain-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout'); },1000);
  watchdogId = setInterval(()=>{ if(running && !host.querySelector('a-image')) spawnOne(); }, 1800);

  emitScore();
  spawnOne();

  return { stop(){ end('quit'); }, pause(){ running=false; }, resume(){ if(!running){ running=true; spawnOne(); } } };
}
export default { boot };
