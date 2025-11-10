// === plate.quest.js (release) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

const THREEV = (globalThis.AFRAME && AFRAME.THREE);

export async function boot(cfg = {}) {
  await new Promise(res=>{
    if (globalThis.AFRAME?.THREE) return res();
    const iv=setInterval(()=>{ if(globalThis.AFRAME?.THREE){ clearInterval(iv); res(); }},30);
    window.addEventListener('load',()=>{ if(globalThis.AFRAME?.THREE){ clearInterval(iv); res(); }},{once:true});
  });

  const scene=document.querySelector('a-scene');
  const host =cfg.host || document.getElementById('spawnHost');
  const diff =String(cfg.difficulty || 'normal');
  const dur  =Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS={
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦']
  };
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune={ easy:{nextGap:[360,560],life:[1400,1700],minDist:0.34,maxConcurrent:2},
               normal:{nextGap:[300,480],life:[1200,1500],minDist:0.32,maxConcurrent:3},
               hard:{nextGap:[240,420],life:[1000,1300],minDist:0.30,maxConcurrent:4} };
  const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  let roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};
  const roundCleared=()=>Object.values(roundDone).every(Boolean);

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain=dur, tTimer=0, tLoop=0;

  const QUESTS=drawThree('plate',diff); let qIdx=0;
  const pushQuest=()=>window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${qIdx+1}/3 — ${QUESTS[qIdx]?.label || 'จัดครบ 5 หมู่!'}`}})); pushQuest();

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0],C.life[1]);

  function end(reason='timeout'){ if(!running) return; running=false;
    clearInterval(tTimer); clearTimeout(tLoop);
    host.querySelectorAll('a-image').forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Healthy Plate', difficulty:diff, score, combo:maxCombo, misses, hits, spawns, duration:dur,
      questsCleared:qIdx+1, questsTotal:3, reason
    }}));
  }
  function tryQuest(){ const s={score,goodCount:hits,junkMiss:misses,comboMax:maxCombo,feverCount:0,star:0,diamond:0,noMissTime:0};
    const q=QUESTS[qIdx]; if(!q?.check) return; if(q.check(s)){ qIdx=Math.min(2,qIdx+1); pushQuest(); } }

  function spawnOne(){
    if(!running) return;
    if (host.querySelectorAll('a-image').length >= C.maxConcurrent){ tLoop=setTimeout(spawnOne,120); return; }

    let ch,type='food', key; const r=Math.random();
    if(r<0.05){ ch=STAR; type='star'; }
    else if(r<0.07){ ch=DIA; type='diamond'; }
    else if(r<0.10){ ch=SHIELD; type='shield'; }
    else { const keys=Object.keys(GROUPS); key=keys[(Math.random()*keys.length)|0]; const pool=GROUPS[key]; ch=pool[(Math.random()*pool.length)|0]; }

    const pos=sp.sample();
    const el=emojiImage(ch,0.68,128); el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++; const rec=sp.markActive(pos);

    const ttl=setTimeout(()=>{ if(!el.parentNode) return;
      if(type==='food'){ misses++; combo=0; score=Math.max(0,score-10); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }
      el.remove(); sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',ev=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREEV.Vector3());

      if(type==='food'){
        const val=22+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; roundDone[key]=true;
        burstAt(scene,wp,{color:'#22c55e',count:18,speed:1.05}); floatScore(scene,wp,'+'+val);
        if(roundCleared()){ roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false}; score+=100; floatScore(scene,wp,'ROUND +100'); }
      }else if(type==='star'){ score+=40; burstAt(scene,wp,{color:'#fde047',count:20,speed:1.1}); floatScore(scene,wp,'+40 ⭐'); }
      else if(type==='diamond'){ score+=80; burstAt(scene,wp,{color:'#a78bfa',count:24,speed:1.2}); floatScore(scene,wp,'+80 💎'); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); burstAt(scene,wp,{color:'#60a5fa',count:18,speed:1.0}); floatScore(scene,wp,'🛡️+1'); }

      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      el.remove(); sp.unmark(rec); tryQuest();
      tLoop=setTimeout(spawnOne,nextGap());
    }, {passive:false});

    tLoop=setTimeout(spawnOne,nextGap());
  }

  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  tTimer=setInterval(()=>{ if(!running) return; remain=Math.max(0,remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout');
  },1000);

  spawnOne();
  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnOne(); }} };
}
export default { boot };