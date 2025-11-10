// === groups.safe.js (release) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';
import { waitAframe } from '../vr/three-safe.js';

export async function boot(cfg = {}) {
  await waitAframe();
  const THREE = window.THREE;

  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain:['🍞','🥖','🥯','🥐','🍚','🍙','🍘'],
    protein:['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦','🍨','🍮']
  };
  const ALL = Object.values(GROUPS).flat();

  const tune = {
    easy:{ nextGap:[360,560], life:[1500,1800], minDist:0.34, maxConcurrent:2 },
    normal:{ nextGap:[300,480], life:[1200,1500], minDist:0.32, maxConcurrent:3 },
    hard:{ nextGap:[240,420], life:[1000,1300], minDist:0.30, maxConcurrent:4 }
  };
  const C=tune[diff]||tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  let goalSize=1, correct=0;
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
  let remain=dur, timerId=0, loopId=0;

  const keys=Object.keys(GROUPS);
  let target = keys[(Math.random()*keys.length)|0];

  const QUESTS = drawThree('groups', diff);
  let qIdx=0;
  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0],C.life[1]);

  function setGoal(){
    target = keys[(Math.random()*keys.length)|0];
    correct=0;
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize}`}}));
  }
  setGoal();

  function end(reason='timeout'){
    if(!running) return;
    running=false; clearInterval(timerId); clearTimeout(loopId);
    Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Food Groups',difficulty:diff,score,combo:maxCombo,misses,hits,spawns,duration:dur,questsCleared:qIdx+1,questsTotal:3,reason}}));
  }
  function tryAdvanceQuest(){ const q=QUESTS[qIdx]; if(q?.check&&q.check({score,goodCount:hits,junkMiss:misses,comboMax:maxCombo,feverCount:0,star:0,diamond:0,noMissTime:0})){ qIdx=Math.min(2,qIdx+1);} }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length>=C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch; if(Math.random()<0.30){ const pool=GROUPS[target]; ch=pool[(Math.random()*pool.length)|0]; } else { ch=ALL[(Math.random()*ALL.length)|0]; }
    const inTarget = GROUPS[target].includes(ch);

    const pos=sp.sample();
    const el=emojiImage(ch,0.68,128); el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`); host.appendChild(el); spawns++;

    const rec=sp.markActive(pos);
    const ttl=setTimeout(()=>{ if(el.parentNode){ if(inTarget){ misses++; combo=0; score=Math.max(0,score-10); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); } el.remove(); sp.unmark(rec);} }, lifeMs());

    el.addEventListener('click', (ev)=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREE.Vector3());
      if(inTarget){
        const val=25+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; correct++;
        burstAt(scene,wp,{color:'#22c55e',count:18,speed:1.05}); floatScore(scene,wp,'+'+val);
        if(correct>=goalSize){ goalSize=Math.min(3,goalSize+1); setGoal(); }
      }else{
        combo=0; score=Math.max(0,score-12); burstAt(scene,wp,{color:'#ef4444',count:12,speed:0.9}); floatScore(scene,wp,'-12');
      }
      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      try{el.remove();}catch{} sp.unmark(rec); tryAdvanceQuest();
    }, {passive:false});

    loopId=setTimeout(spawnOne,nextGap());
  }

  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{ if(!running)return; remain=Math.max(0,remain-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout'); },1000);

  spawnOne();
  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnOne(); } } };
}
export default { boot };