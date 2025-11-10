// === modes/goodjunk.safe.js (no THREE, use Particles) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { floatScore } from '../vr/shards.js';
import Particles from '../vr/particles.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR = '⭐', DIA='💎', SHIELD='🛡️';

  const tune = {
    easy:   { nextGap:[360,560], life:[1400,1700], minDist:0.34, junkRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,480], life:[1200,1500], minDist:0.32, junkRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[240,420], life:[1000,1300], minDist:0.30, junkRate:0.42, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  // state
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
  let shield=0, starCount=0, diamondCount=0, noMissSec=0;
  let remain=dur, timerId=0, loopId=0, noMissId=0;

  const QUESTS = drawThree('goodjunk', diff);
  let qIdx=0;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>Math.floor(rand(C.nextGap[0], C.nextGap[1]));
  const lifeMs =()=>Math.floor(rand(C.life[0], C.life[1]));
  const emitScore=()=>window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  const emitMiss =()=>window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}}));
  const questText = ()=>`Quest ${qIdx+1}/3 — ${QUESTS[qIdx]?.label || 'กำลังสุ่ม…'}`;
  const updateQuestHUD=()=>window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}}));
  updateQuestHUD();

  function stats(){ return {score, goodCount:hits, comboMax:maxCombo, star:starCount, diamond:diamondCount, junkMiss:misses, noMissTime:noMissSec, feverCount:0}; }
  function tryAdvanceQuest(){ const q=QUESTS[qIdx]; if(q?.check && q.check(stats())){ qIdx=Math.min(2,qIdx+1); updateQuestHUD(); } }

  function end(reason='timeout'){
    if(!running) return; running=false;
    clearInterval(timerId); clearTimeout(loopId); clearInterval(noMissId);
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{ try{ n.remove(); }catch{} });
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Good vs Junk', difficulty:diff, score, comboMax:maxCombo, misses, hits, spawns,
      duration:dur, questsCleared:Math.min(3,qIdx+1), questsTotal:3, reason
    }}));
  }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length >= C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch,type; const r=Math.random();
    if      (r<0.04){ ch=STAR; type='star'; }
    else if (r<0.06){ ch=DIA;  type='diamond'; }
    else if (r<0.10){ ch=SHIELD; type='shield'; }
    else { const good = Math.random() > C.junkRate; ch=(good?GOOD:JUNK)[(Math.random()* (good?GOOD:JUNK).length)|0]; type=good?'good':'junk'; }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.68, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ misses++; combo=0; score=Math.max(0,score-10); noMissSec=0; emitMiss(); emitScore(); }
      try{ el.remove(); }catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const p = el.getAttribute('position');

      if(type==='good'){
        const val=20+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
        Particles.burstShards(host,p,{theme:'goodjunk'}); floatScore(scene,p,'+'+val);
      }else if(type==='junk'){
        if (shield>0){ shield--; floatScore(scene,p,'Shield!'); Particles.burstShards(host,p,{theme:'goodjunk'}); }
        else { combo=0; score=Math.max(0,score-15); misses++; noMissSec=0; floatScore(scene,p,'-15'); Particles.burstShards(host,p,{theme:'goodjunk'}); emitMiss(); }
      }else if(type==='star'){ starCount++; score+=40; floatScore(scene,p,'+40 ⭐'); Particles.burstShards(host,p,{theme:'goodjunk'}); }
      else if(type==='diamond'){ diamondCount++; score+=80; floatScore(scene,p,'+80 💎'); Particles.burstShards(host,p,{theme:'goodjunk'}); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); floatScore(scene,p,'🛡️+1'); Particles.burstShards(host,p,{theme:'goodjunk'}); }

      emitScore();
      try{ el.remove(); }catch{}; sp.unmark(rec);
      tryAdvanceQuest();
      loopId=setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  // timers
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{ if(!running) return; remain=Math.max(0,remain-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout'); },1000);
  noMissId=setInterval(()=>{ if(running) noMissSec=Math.min(9999,noMissSec+1); },1000);

  spawnOne();
  return { stop(){ end('quit'); }, pause(){ running=false; }, resume(){ if(!running){ running=true; spawnOne(); } } };
}
export default { boot };