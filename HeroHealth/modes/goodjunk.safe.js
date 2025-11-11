// === /HeroHealth/modes/goodjunk.safe.js (MissionDeck-ready) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  // Mini-quest deck (3 ใบ + bonus ถ้าเวลาเหลือ)
  const md = new MissionDeck(); md.draw3();
  function questText(){ return `Quest ${md.currentIndex+1}/3 — ${md.getCurrent()?.label || 'กำลังเริ่ม…'}`; }
  function updateQuestHUD(){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }
  updateQuestHUD();

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

  const sp = makeSpawner({
    bounds:{ x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6 },
    minDist:C.minDist,
    decaySec:2.2
  });

  // State
  let running=true;
  let score=0, combo=0, maxCombo=0;
  let misses=0, hits=0, spawns=0;
  let shield=0;                 
  let remain = dur;
  let timeId=0, loopId=0, watchdogId=0;

  const rand=(a,b)=> a + Math.random()*(b-a);
  const nextGap=()=> Math.floor(rand(C.nextGap[0], C.nextGap[1]));
  const lifeMs =()=> Math.floor(rand(C.life[0], C.life[1]));

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }
  function emitMiss(){ window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }
  function afterHitAdvance(){
    md.updateScore(score); md.updateCombo(combo);
    if (md._autoAdvance()) updateQuestHUD();
  }

  function maybeAddBonusQuests() {
    if (remain>0 && md.isCleared()) {
      const more = new MissionDeck(); more.draw3();
      // เติมใบที่ไม่ซ้ำ
      more.deck.forEach(q=>{ if(!md.deck.find(x=>x.id===q.id)) md.deck.push(q); });
      updateQuestHUD();
    }
  }

  function end(reason='timeout'){
    if(!running) return; running=false;
    try{ clearInterval(timeId);}catch{}
    try{ clearTimeout(loopId);}catch{}
    try{ clearInterval(watchdogId);}catch{}
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{ try{ n.remove(); }catch{} });
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Good vs Junk', difficulty:diff, score, comboMax:maxCombo, misses, hits, spawns,
      duration:dur, questsCleared: md.getProgress().filter(q=>q.done).length, questsTotal: md.deck.length, reason
    }}));
  }

  function spawnOne(){
    if(!running) return;
    const now = host.querySelectorAll('a-image').length;
    if(now>=C.maxConcurrent){ loopId=setTimeout(spawnOne,100); return; }

    // pick type
    let ch, type;
    const r = Math.random();
    if      (r < 0.04) { ch=STAR;   type='star'; }
    else if (r < 0.06) { ch=DIA;    type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      const goodPick = Math.random() > C.junkRate;
      ch   = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
      type = goodPick ? 'good' : 'junk';
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ misses++; combo=0; score=Math.max(0, score-10); emitMiss(); emitScore(); md.onJunk(); afterHitAdvance(); }
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return;
      ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());

      if(type==='good'){
        const val = 20 + combo*2;
        score += val; combo++; maxCombo=Math.max(maxCombo, combo); hits++;
        md.onGood();
        burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
        floatScore(scene, wp, '+'+val);
      } else if (type==='junk'){
        if(shield>0){ shield--; floatScore(scene, wp, 'Shield!'); burstAt(scene, wp, {color:'#60a5fa',count:14, speed:0.9}); }
        else{ combo=0; score=Math.max(0, score-15); misses++; emitMiss(); md.onJunk(); burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 }); floatScore(scene, wp, '-15'); }
      } else if (type==='star'){
        score += 40; md.onStar(); burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 }); floatScore(scene, wp, '+40 ⭐');
      } else if (type==='diamond'){
        score += 80; md.onDiamond(); burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 }); floatScore(scene, wp, '+80 💎');
      } else if (type==='shield'){
        shield = Math.min(3, shield+1); burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 }); floatScore(scene, wp, '🛡️+1');
      }

      emitScore();
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
      afterHitAdvance();
      loopId=setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  // time
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timeId=setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout');
    else maybeAddBonusQuests();
  },1000);

  // watchdog
  watchdogId=setInterval(()=>{ if(running && !host.querySelector('a-image')) spawnOne(); }, 1800);

  // go
  window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}}));
  spawnOne();

  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnOne(); } } };
}
export default { boot };