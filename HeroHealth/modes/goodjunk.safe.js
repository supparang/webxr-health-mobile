// === /HeroHealth/modes/goodjunk.safe.js (release) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // Pools
  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR = '⭐', DIA='💎', SHIELD='🛡️';

  // Tuning per difficulty
  const tune = {
    easy:   { nextGap:[360,560], life:[1400,1700], minDist:0.34, junkRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,480], life:[1200,1500], minDist:0.32, junkRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[240,420], life:[1000,1300], minDist:0.30, junkRate:0.42, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain = dur, timerId=0, loopId=0;

  // Mini-quests (3 จาก 10 แบบ)
  const QUESTS_POOL = drawThree('goodjunk', diff); // array of {id,label,check/prog/target}
  let qIdx = 0; // active quest index
  function questText(){ return `Quest ${qIdx+1}/3 — ${QUESTS_POOL[qIdx]?.label || 'กำลังสุ่ม…'}`; }
  function updateQuestHUD(){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }

  // Helper
  const rand = (a,b)=> a + Math.random()*(b-a);
  const nextGap = ()=> rand(C.nextGap[0], C.nextGap[1]);
  const lifeMs  = ()=> rand(C.life[0], C.life[1]);

  function tryAdvanceQuest() {
    const s = { score, goodCount:hits, junkMiss:misses, comboMax:maxCombo, feverCount:0, star:0, diamond:0, noMissTime:0 };
    const q = QUESTS_POOL[qIdx];
    if (!q) return;
    const done = q.check ? q.check(s) : false;
    if (done) {
      qIdx = Math.min(qIdx+1, QUESTS_POOL.length-1);
      if (qIdx < 3) updateQuestHUD();
    }
  }

  function end(reason='timeout') {
    if (!running) return;
    running=false;
    clearInterval(timerId); timerId=0;
    clearTimeout(loopId);   loopId=0;
    // Clean leftovers
    Array.from(host.querySelectorAll('a-image')).forEach(n=>n.parentNode && n.parentNode.removeChild(n));

    window.dispatchEvent(new CustomEvent('hha:end', {
      detail:{
        mode:'Good vs Junk', difficulty:diff, score, combo:maxCombo, misses, hits, spawns,
        duration:dur, questsCleared:qIdx+1, questsTotal:3, reason
      }
    }));
  }

  function emitScore() {
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));
  }

  function spawnOne() {
    if (!running) return;
    // limit concurrent
    const nowCount = host.querySelectorAll('a-image').length;
    if (nowCount >= C.maxConcurrent) { loopId=setTimeout(spawnOne, 120); return; }

    // decide type
    let ch, type;
    const r = Math.random();
    if      (r < 0.04) { ch=STAR;   type='star'; }
    else if (r < 0.06) { ch=DIA;    type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      const goodPick = Math.random() > C.junkRate; // good = true more often on easy
      ch   = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
      type = goodPick ? 'good' : 'junk';
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el);
    spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{ // expired = miss for GOOD only
      if (!el.parentNode) return;
      if (type==='good') { misses++; combo=0; score=Math.max(0, score-10); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); emitScore(); }
      try{ host.removeChild(el);}catch{}
      sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click', (ev)=>{
      if (!running) return;
      ev.preventDefault();
      clearTimeout(ttl);

      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      if (type==='good') {
        const val = 20 + combo*2;
        score += val; combo++; maxCombo = Math.max(maxCombo, combo); hits++;
        burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
        floatScore(scene, wp, '+'+val);
      } else if (type==='junk') {
        // Junk: ไม่กด = ไม่โดนโทษ / แต่ถ้ากด → โดนโทษ (ยุติ combo) เว้นแต่มี shield
        if (shield>0){ shield--; floatScore(scene, wp, 'Shield!'); burstAt(scene, wp, {color:'#60a5fa',count:14, speed:0.9}); }
        else { combo=0; score=Math.max(0, score-15); burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 }); floatScore(scene, wp, '-15'); }
      } else if (type==='star') {
        score += 40; burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 }); floatScore(scene, wp, '+40 ⭐');
      } else if (type==='diamond') {
        score += 80; burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 }); floatScore(scene, wp, '+80 💎');
      } else if (type==='shield') {
        shield = Math.min(3, shield+1); burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 }); floatScore(scene, wp, '🛡️+1');
      }

      emitScore();
      try{ host.removeChild(el);}catch{}
      sp.unmark(rec);
      tryAdvanceQuest();
    }, {passive:false});

    loopId = setTimeout(spawnOne, nextGap());
  }

  // time
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId = setInterval(()=>{
    if(!running) return;
    remain--; if(remain<0) remain=0;
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout');
  }, 1000);

  // start
  updateQuestHUD();
  spawnOne();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnOne(); } }
  };
}
export default { boot };
