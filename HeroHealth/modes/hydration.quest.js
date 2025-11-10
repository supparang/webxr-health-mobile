// === hydration.quest.js (release; Water Gauge safe) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

const THREEV = (globalThis.AFRAME && AFRAME.THREE);

/* Water Gauge DOM */
function destroyWaterGauge(){ const el=document.getElementById('waterWrap'); if(el) el.remove(); }
function ensureWaterGauge(){
  destroyWaterGauge();
  const wrap=document.createElement('div'); wrap.id='waterWrap'; wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style,{position:'fixed',left:'50%',bottom:'56px',transform:'translateX(-50%)',
    width:'min(540px,86vw)',zIndex:'900',color:'#e8eefc',background:'#0f172a99',
    border:'1px solid #334155',borderRadius:'12px',padding:'10px 12px',backdropFilter:'blur(6px)',fontWeight:'800'});
  wrap.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>Water</span><span id="waterLbl">Balanced</span></div>
    <div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
      <div id="waterFill" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div></div>`;
  document.body.appendChild(wrap);
}
function setWater(val){
  const f=document.getElementById('waterFill'), l=document.getElementById('waterLbl'); if(!f||!l) return;
  const pct=Math.max(0,Math.min(100,Math.round(val))); f.style.width=pct+'%';
  let zone='Low'; if(pct>=40&&pct<=70) zone='Balanced'; else if(pct>70) zone='High'; l.textContent=zone;
  f.style.background=(zone==='Balanced')?'linear-gradient(90deg,#06d6a0,#37d67a)'
    :(zone==='High'?'linear-gradient(90deg,#22c55e,#93c5fd)':'linear-gradient(90deg,#f59e0b,#ef4444)');
}

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

  ensureWaterGauge();

  const GOOD=['💧','🚰','🥛','🍊','🍋'];
  const BAD =['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune={
    easy:{nextGap:[380,560],life:[1400,1700],minDist:0.34,badRate:0.28,maxConcurrent:2},
    normal:{nextGap:[300,500],life:[1200,1500],minDist:0.32,badRate:0.35,maxConcurrent:3},
    hard:{nextGap:[260,460],life:[1000,1300],minDist:0.30,badRate:0.40,maxConcurrent:4}
  };
  const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let water=55, remain=dur, tTimer=0, tLoop=0; setWater(water);

  const QUESTS=drawThree('hydration',diff); let qIdx=0;
  const pushQuest=()=>window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${qIdx+1}/3 — ${QUESTS[qIdx]?.label||'รักษาระดับน้ำให้พอดี'}`}})); pushQuest();

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0],C.life[1]);
  const zone=()=> (water>=40&&water<=70)?'GREEN':(water>70?'HIGH':'LOW');
  const emitScore=()=>window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));

  function applyHit(type, wp){
    if(type==='good'){
      const val=20+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
      water=Math.min(100,water+6); burstAt(scene,wp,{color:'#22c55e',count:18,speed:1.0}); floatScore(scene,wp,'+'+val);
    }else if(type==='bad'){
      if(shield>0){ shield--; floatScore(scene,wp,'Shield!'); burstAt(scene,wp,{color:'#60a5fa',count:14,speed:0.9}); }
      else{ if(zone()==='HIGH'){ score+=5; floatScore(scene,wp,'+5 (High)'); } else { score=Math.max(0,score-20); combo=0; floatScore(scene,wp,'-20'); }
            water=Math.max(0,water-8); burstAt(scene,wp,{color:'#ef4444',count:12,speed:0.9}); }
    }else if(type==='star'){ score+=40; burstAt(scene,wp,{color:'#fde047',count:20,speed:1.1}); floatScore(scene,wp,'+40 ⭐'); }
    else if(type==='diamond'){ score+=80; burstAt(scene,wp,{color:'#a78bfa',count:24,speed:1.2}); floatScore(scene,wp,'+80 💎'); }
    else if(type==='shield'){ shield=Math.min(3,shield+1); burstAt(scene,wp,{color:'#60a5fa',count:18,speed:1.0}); floatScore(scene,wp,'🛡️+1'); }
    setWater(water); emitScore();
  }

  function tryQuest(){ const s={score,goodCount:hits,junkMiss:misses,comboMax:maxCombo,feverCount:0,star:0,diamond:0,noMissTime:0};
    const q=QUESTS[qIdx]; if(!q?.check) return; if(q.check(s)){ qIdx=Math.min(2,qIdx+1); pushQuest(); } }

  function end(reason='timeout'){ if(!running) return; running=false;
    clearInterval(tTimer); clearTimeout(tLoop); destroyWaterGauge();
    host.querySelectorAll('a-image').forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Hydration', difficulty:diff, score, combo:maxCombo, misses, hits, spawns, duration:dur,
      questsCleared:qIdx+1, questsTotal:3, reason
    }}));
  }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length >= C.maxConcurrent){ tLoop=setTimeout(spawnOne,120); return; }

    let ch,type; const r=Math.random();
    if(r<0.05){ ch=STAR; type='star'; }
    else if(r<0.07){ ch=DIA; type='diamond'; }
    else if(r<0.10){ ch=SHIELD; type='shield'; }
    else { const good=Math.random()>C.badRate; ch=(good?GOOD:BAD)[(Math.random()* (good?GOOD:BAD).length)|0]; type=good?'good':'bad'; }

    const pos=sp.sample();
    const el=emojiImage(ch,0.7,128); el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++; const rec=sp.markActive(pos);

    const ttl=setTimeout(()=>{ if(!el.parentNode) return;
      if(type==='good'){ water=Math.max(0,water-4); score=Math.max(0,score-8); combo=0;
        window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:++misses}})); setWater(water); emitScore(); }
      el.remove(); sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',ev=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREEV.Vector3());
      applyHit(type, wp); el.remove(); sp.unmark(rec); tryQuest();
      tLoop=setTimeout(spawnOne,nextGap());
    }, {passive:false});

    tLoop=setTimeout(spawnOne,nextGap());
  }

  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  tTimer=setInterval(()=>{ if(!running) return; remain=Math.max(0,remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout');
  },1000);

  // ให้ index เรียกเคลียร์ UI ได้
  const disposer=()=>destroyWaterGauge(); window.addEventListener('hha:dispose-ui',disposer,{once:true});

  spawnOne();
  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnOne(); }} };
}
export default { boot };