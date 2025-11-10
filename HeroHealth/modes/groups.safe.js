// === groups.safe.js (release) ===
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
    easy:   { nextGap:[360,560], life:[1500,1800], minDist:0.34, maxConcurrent:2 },
    normal: { nextGap:[300,480], life:[1200,1500], minDist:0.32, maxConcurrent:3 },
    hard:   { nextGap:[240,420], life:[1000,1300], minDist:0.30, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  let goalSize=1, picked=0, running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
  let remain=dur, tTimer=0, tLoop=0;

  const keys=Object.keys(GROUPS);
  let target=keys[(Math.random()*keys.length)|0];

  const QUESTS = drawThree('groups', diff);
  let qIdx=0;
  const pushQuest = txt => window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:txt}}));
  function setNewGoal(){
    target = keys[(Math.random()*keys.length)|0];
    picked = 0;
    pushQuest(`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize}`);
  }
  setNewGoal();

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0],C.life[1]);

  function end(reason='timeout'){
    if(!running) return; running=false;
    clearInterval(tTimer); clearTimeout(tLoop);
    host.querySelectorAll('a-image').forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Food Groups', difficulty:diff, score, combo:maxCombo, misses, hits, spawns, duration:dur,
      questsCleared:qIdx+1, questsTotal:3, reason
    }}));
  }
  function tryQuest(){
    const s={score,goodCount:hits,junkMiss:misses,comboMax:maxCombo,feverCount:0,star:0,diamond:0,noMissTime:0};
    const q=QUESTS[qIdx]; if(!q?.check) return;
    if(q.check(s)){ qIdx=Math.min(2,qIdx+1); pushQuest(`Quest ${qIdx+1}/3 — ${QUESTS[qIdx].label}`); }
  }

  function spawnOne(){
    if(!running) return;
    if (host.querySelectorAll('a-image').length >= C.maxConcurrent){ tLoop=setTimeout(spawnOne,120); return; }

    let ch; // 70% random, 30% target group
    if (Math.random()<0.30){ const pool=GROUPS[target]; ch=pool[(Math.random()*pool.length)|0]; }
    else { ch=ALL[(Math.random()*ALL.length)|0]; }
    const inTarget = GROUPS[target].includes(ch);

    const pos=sp.sample();
    const el=emojiImage(ch,0.68,128); el.classList.add('clickable');
    el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`); host.appendChild(el); spawns++;
    const rec=sp.markActive(pos);

    const ttl=setTimeout(()=>{ if(!el.parentNode) return;
      if(inTarget){ misses++; combo=0; score=Math.max(0,score-10); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }
      el.remove(); sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',ev=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREEV.Vector3());
      if(inTarget){
        const val=25+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; picked++;
        burstAt(scene,wp,{color:'#22c55e',count:18,speed:1.05}); floatScore(scene,wp,'+'+val);
        if (picked>=goalSize){ goalSize=Math.min(3,goalSize+1); setNewGoal(); }
      }else{
        combo=0; score=Math.max(0,score-12); burstAt(scene,wp,{color:'#ef4444',count:12,speed:0.9}); floatScore(scene,wp,'-12');
      }
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