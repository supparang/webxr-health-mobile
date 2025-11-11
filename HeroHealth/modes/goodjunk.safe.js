// === /HeroHealth/modes/goodjunk.safe.js (final) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore, setShardMode } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg = {}) {
  setShardMode('goodjunk');
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const tune = {
    easy:   { nextGap:[480,720], life:[1400,1700], minDist:0.34, maxConcurrent:2 },
    normal: { nextGap:[360,600], life:[1200,1500], minDist:0.32, maxConcurrent:3 },
    hard:   { nextGap:[260,480], life:[1000,1300], minDist:0.30, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6}, minDist:C.minDist });

  const GOOD=['🍎','🍓','🍇','🥦','🥕','🥬','🍊','🍌','🍍','🍚','🥗'];
  const JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  let running=true,score=0,combo=0,maxCombo=0,misses=0,hits=0,spawns=0,shield=0;
  let remain=dur, timerId=0, loopId=0, questIdx=0;
  const QUESTS = drawThree('goodjunk', diff);
  let goalCount=0, goalTarget=10;

  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:QUESTS[0].label,currentIndex:0,total:3}}));

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(...C.nextGap), lifeMs=()=>rand(...C.life);

  function emitGoal(){ 
    window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`เป้า: เก็บของดี ${goalCount}/${goalTarget}`,value:goalCount,max:goalTarget,mode:'Good vs Junk'}})); 
  }
  emitGoal();

  function tryAdvanceQuest(){
    const s={score,goodCount:hits,junkMiss:misses,comboMax:maxCombo};
    const q=QUESTS[questIdx];
    if(q&&q.check(s)){ questIdx++; if(questIdx<QUESTS.length)
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:QUESTS[questIdx].label,currentIndex:questIdx,total:3}})); }
  }

  function end(reason='timeout'){
    if(!running)return; running=false;
    clearInterval(timerId); clearTimeout(loopId);
    Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Good vs Junk',score,combo:maxCombo,misses,hits,questsCleared:questIdx,questsTotal:3,reason}}));
  }

  function spawnOne(){
    if(!running)return;
    const nNow=host.querySelectorAll('a-image').length;
    if(nNow>=C.maxConcurrent){ loopId=setTimeout(spawnOne,150); return; }

    let ch,type='good';
    const r=Math.random();
    if(r<0.05){ ch=STAR; type='star'; }
    else if(r<0.07){ ch=DIA; type='diamond'; }
    else if(r<0.1){ ch=SHIELD; type='shield'; }
    else{
      const isGood=Math.random()>0.35;
      ch=(isGood?GOOD:JUNK)[(Math.random()*(isGood?GOOD:JUNK).length)|0];
      type=isGood?'good':'junk';
    }

    const pos=sp.sample();
    const el=emojiImage(ch,0.7,128);
    el.classList.add('clickable');
    el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec=sp.markActive(pos);
    const ttl=setTimeout(()=>{
      if(!el.parentNode)return;
      if(type==='good'){ misses++; combo=0; score=Math.max(0,score-10); goalCount=Math.max(0,goalCount-1);}
      el.remove(); sp.unmark(rec);
    },lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running)return;
      ev.preventDefault(); clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREE.Vector3());
      if(type==='good'){
        const val=20+combo*2; score+=val; hits++; combo++; maxCombo=Math.max(maxCombo,combo);
        burstAt(scene,wp,{color:'#22c55e',count:18,speed:1.0}); floatScore(scene,wp,'+'+val);
        goalCount++; if(goalCount>=goalTarget){ goalTarget+=5; emitGoal(); }
      } else if(type==='junk'){
        score=Math.max(0,score-15); combo=0;
        burstAt(scene,wp,{color:'#ef4444',count:14,speed:0.9}); floatScore(scene,wp,'-15');
      } else if(type==='star'){ score+=40; floatScore(scene,wp,'+40 ⭐'); burstAt(scene,wp,{color:'#fde047',count:20}); }
      else if(type==='diamond'){ score+=80; floatScore(scene,wp,'+80 💎'); burstAt(scene,wp,{color:'#a78bfa',count:24}); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); floatScore(scene,wp,'🛡️+1'); burstAt(scene,wp,{color:'#60a5fa',count:18}); }

      el.remove(); sp.unmark(rec);
      tryAdvanceQuest(); emitGoal();
      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      loopId=setTimeout(spawnOne,nextGap());
    },{passive:false});
  }

  timerId=setInterval(()=>{ if(!running)return; remain--; window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end(); },1000);
  spawnOne();
  return{stop:()=>end('quit')};
}
export default {boot};