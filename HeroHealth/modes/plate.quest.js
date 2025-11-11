// === /HeroHealth/modes/plate.quest.js (final) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore, setShardMode } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

export async function boot(cfg={}) {
  setShardMode('plate');
  const scene=document.querySelector('a-scene');
  const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal');
  const dur=Number(cfg.duration||(diff==='easy'?90:diff==='hard'?45:60));
  const GROUPS={veg:['🥦','🥕','🥬','🍅','🌽'],fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain:['🍞','🍚','🍘'],protein:['🐟','🍗','🥚','🥜'],dairy:['🥛','🧀','🍦']};
  const ALL=Object.values(GROUPS).flat(); const STAR='⭐',DIA='💎',SHIELD='🛡️';
  const tune={easy:{nextGap:[360,560],life:[1400,1700],minDist:0.34,maxConcurrent:2},
    normal:{nextGap:[300,480],life:[1200,1500],minDist:0.32,maxConcurrent:3},
    hard:{nextGap:[240,420],life:[1000,1300],minDist:0.30,maxConcurrent:4}};
  const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist});
  let score=0,combo=0,maxCombo=0,hits=0,misses=0,spawns=0,shield=0,remain=dur,running=true;
  let roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};
  const QUESTS=drawThree('plate',diff); let questIdx=0;

  function roundCleared(){return Object.values(roundDone).every(Boolean);}
  window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:QUESTS[0].label,currentIndex:0,total:3}}));

  function emitGoal(){
    const done=Object.values(roundDone).filter(Boolean).length;
    window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`จัดครบหมู่ ${done}/5`,value:done,max:5,mode:'Plate'}}));
  } emitGoal();

  function tryQuest(){
    const s={score,comboMax:maxCombo}; const q=QUESTS[questIdx];
    if(q&&q.check(s)){questIdx++;if(questIdx<QUESTS.length)
      window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:QUESTS[questIdx].label,currentIndex:questIdx,total:3}}));}
  }

  function end(reason='timeout'){
    running=false; clearInterval(timerId); clearTimeout(loopId);
    Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Plate',score,combo:maxCombo,hits,misses,questsCleared:questIdx,questsTotal:3,reason}}));
  }

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(...C.nextGap), lifeMs=()=>rand(...C.life);

  function spawnOne(){
    if(!running)return; if(host.querySelectorAll('a-image').length>=C.maxConcurrent){loopId=setTimeout(spawnOne,100);return;}
    let ch,type='food',group;
    const r=Math.random();
    if(r<0.05){ch=STAR;type='star';}
    else if(r<0.07){ch=DIA;type='diamond';}
    else if(r<0.1){ch=SHIELD;type='shield';}
    else{const keys=Object.keys(GROUPS);group=keys[(Math.random()*keys.length)|0];const pool=GROUPS[group];ch=pool[(Math.random()*pool.length)|0];}
    const pos=sp.sample();const el=emojiImage(ch,0.7,128);el.classList.add('clickable');
    el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);host.appendChild(el);spawns++;
    const rec=sp.markActive(pos);const ttl=setTimeout(()=>{el.remove();sp.unmark(rec);},lifeMs());
    el.addEventListener('click',(ev)=>{if(!running)return;ev.preventDefault();clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREE.Vector3());
      if(type==='food'){const val=22+combo*2;score+=val;combo++;maxCombo=Math.max(maxCombo,combo);hits++;roundDone[group]=true;
        burstAt(scene,wp,{color:'#22c55e',count:18});floatScore(scene,wp,'+'+val);
        if(roundCleared()){score+=100;roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};floatScore(scene,wp,'ROUND +100');}
        emitGoal();}
      else if(type==='star'){score+=40;floatScore(scene,wp,'+40 ⭐');burstAt(scene,wp,{color:'#fde047',count:20});}
      else if(type==='diamond'){score+=80;floatScore(scene,wp,'+80 💎');burstAt(scene,wp,{color:'#a78bfa',count:24});}
      else if(type==='shield'){shield=Math.min(3,shield+1);floatScore(scene,wp,'🛡️+1');burstAt(scene,wp,{color:'#60a5fa',count:18});}
      el.remove();sp.unmark(rec);tryQuest();window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      loopId=setTimeout(spawnOne,nextGap());
    },{passive:false});
  }
  const timerId=setInterval(()=>{if(!running)return;remain--;window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));if(remain<=0)end();},1000);
  spawnOne();
}
export default {boot};