// === modes/plate.quest.js (no THREE, Particles) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { floatScore } from '../vr/shards.js';
import Particles from '../vr/particles.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg = {}) {
  const scene=document.querySelector('a-scene');
  const host = cfg.host || document.getElementById('spawnHost');
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS={ veg:['🥦','🥕','🥬','🍅','🌽'], fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],
                 grain:['🍞','🥖','🍚','🍘'], protein:['🐟','🍗','🥚','🫘','🥜'], dairy:['🥛','🧀','🍦'] };
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune={ easy:{nextGap:[360,560],life:[1400,1700],minDist:0.34,maxConcurrent:2},
               normal:{nextGap:[300,480],life:[1200,1500],minDist:0.32,maxConcurrent:3},
               hard:{nextGap:[240,420],life:[1000,1300],minDist:0.30,maxConcurrent:4}};
  const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  let roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};
  const roundCleared=()=>Object.values(roundDone).every(Boolean);

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain=dur, timerId=0, loopId=0;

  const QUESTS=drawThree('plate',diff); let qIdx=0;

  const rand=(a,b)=>a+Math.random()*(b-a), nextGap=()=>rand(C.nextGap[0],C.nextGap[1]), lifeMs=()=>rand(C.life[0],C.life[1]);

  function end(reason='timeout'){
    if(!running) return; running=false;
    clearInterval(timerId); clearTimeout(loopId);
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{try{n.remove();}catch{}});
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Healthy Plate', difficulty:diff, score, comboMax:maxCombo, misses, hits, spawns,
      duration:dur, questsCleared:Math.min(3,qIdx+1), questsTotal:3, reason
    }}));
  }
  function tryAdvanceQuest(){ const s={score,goodCount:hits,comboMax:maxCombo}; const q=QUESTS[qIdx]; if(q?.check && q.check(s)){ qIdx=Math.min(2,qIdx+1); } }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length>=C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch,type='food', groupKey; const r=Math.random();
    if      (r<0.05){ ch=STAR; type='star'; }
    else if (r<0.07){ ch=DIA;  type='diamond'; }
    else if (r<0.10){ ch=SHIELD; type='shield'; }
    else { const keys=Object.keys(GROUPS); groupKey=keys[(Math.random()*keys.length)|0]; const pool=GROUPS[groupKey]; ch=pool[(Math.random()*pool.length)|0]; }

    const pos=sp.sample();
    const el=emojiImage(ch,0.68,128); el.classList.add('clickable');
    el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`); host.appendChild(el); spawns++;

    const rec=sp.markActive(pos);
    const ttl=setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='food'){ misses++; combo=0; score=Math.max(0,score-10); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }
      try{ el.remove(); }catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const p=el.getAttribute('position');

      if(type==='food'){
        const val=22+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
        roundDone[groupKey]=true; Particles.burstShards(host,p,{theme:'plate'}); floatScore(scene,p,'+'+val);
        if(roundCleared()){ roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false}; score+=100; floatScore(scene,p,'ROUND +100'); }
      } else if(type==='star'){ score+=40; Particles.burstShards(host,p,{theme:'plate'}); floatScore(scene,p,'+40 ⭐'); }
      else if(type==='diamond'){ score+=80; Particles.burstShards(host,p,{theme:'plate'}); floatScore(scene,p,'+80 💎'); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); Particles.burstShards(host,p,{theme:'plate'}); floatScore(scene,p,'🛡️+1'); }

      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      try{ el.remove(); }catch{}; sp.unmark(rec); tryAdvanceQuest();
      loopId=setTimeout(spawnOne,nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne,nextGap());
  }

  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:dur}}));
  timerId=setInterval(()=>{ if(!running) return; remain=Math.max(0,--remain); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout'); },1000);

  spawnOne();
  return { stop(){ end('quit'); }, pause(){ running=false; }, resume(){ if(!running){ running=true; spawnOne(); } } };
}
export default { boot };