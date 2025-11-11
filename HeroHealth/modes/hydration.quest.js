// === /HeroHealth/modes/hydration.quest.js (release; Water Gauge + HUD + Refill) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

/* Water Gauge */
function makeWaterGauge(){
  // clean previous
  document.getElementById('waterWrap')?.remove();
  const w=document.createElement('div'); w.id='waterWrap'; w.setAttribute('data-hha-ui','progress');
  Object.assign(w.style,{position:'fixed',left:'50%',bottom:'112px',transform:'translateX(-50%)',width:'min(640px,92vw)',zIndex:'910',color:'#e8eefc',background:'#0f172a99',border:'1px solid #334155',borderRadius:'14px',padding:'10px 12px',backdropFilter:'blur(6px)',font:'700 13px/1.3 system-ui'});
  w.innerHTML=`<div style="display:flex;justify-content:space-between"><div>Hydration</div><div id="wl">Balanced</div></div>
  <div style="height:10px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="wf" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div></div>`;
  document.body.appendChild(w);
  window.addEventListener('hha:dispose-ui',()=>{try{w.remove();}catch{}},{once:true});
  return {
    set(v){
      const f=document.getElementById('wf'), l=document.getElementById('wl'); if(!f||!l) return;
      const pct=Math.max(0,Math.min(100,Math.round(v))); f.style.width=pct+'%';
      let zone='Low'; if(pct>=40&&pct<=70) zone='Balanced'; else if(pct>70) zone='High';
      l.textContent=zone;
      f.style.background = zone==='Balanced' ? 'linear-gradient(90deg,#06d6a0,#37d67a)' : (zone==='High'?'linear-gradient(90deg,#22c55e,#93c5fd)':'linear-gradient(90deg,#f59e0b,#ef4444)');
    }
  };
}

/* Progress HUD (goal + mini) */
function makeHUD(){
  document.querySelectorAll('[data-hha-ui="progress-mini"]').forEach(n=>n.remove());
  const w=document.createElement('div'); w.setAttribute('data-hha-ui','progress-mini');
  Object.assign(w.style,{position:'fixed',left:'50%',bottom:'64px',transform:'translateX(-50%)',width:'min(640px,92vw)',zIndex:'910',color:'#e8eefc',background:'#0f172a99',border:'1px solid #334155',borderRadius:'14px',padding:'10px 12px',backdropFilter:'blur(6px)',font:'700 13px/1.3 system-ui'});
  w.innerHTML=`<div id="t" style="margin-bottom:6px">Goal: รักษาระดับน้ำ</div>
  <div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="g" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)"></div></div>
  <div id="qs"></div>`;
  const qs=w.querySelector('#qs'); for(let i=0;i<3;i++){ const r=document.createElement('div'); r.style.margin='6px 0 0'; r.innerHTML=`<div id="l${i}" style="margin-bottom:3px"></div><div style="height:8px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="b${i}" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></div></div>`; qs.appendChild(r); }
  document.body.appendChild(w);
  window.addEventListener('hha:dispose-ui',()=>{try{w.remove();}catch{}},{once:true});
  return {
    setGoal:(lab,p)=>{ w.querySelector('#t').textContent=lab; w.querySelector('#g').style.width=Math.max(0,Math.min(100,Math.round(p)))+'%'; },
    setQ:(i,lab,p,active,done)=>{ const L=w.querySelector('#l'+i),B=w.querySelector('#b'+i); if(!L||!B)return; L.textContent=(done?'✅ ':'')+(active?'▶️ ':'')+lab; B.style.width=Math.max(0,Math.min(100,Math.round(p)))+'%'; }
  };
}

export async function boot(cfg={}) {
  const scene=document.querySelector('a-scene');
  const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal');
  const dur =Number(cfg.duration||(diff==='easy'?90:diff==='hard'?45:60));

  const GOOD=['💧','🚰','🥛','🍊','🍋'];
  const BAD =['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune={ easy:{nextGap:[380,560],life:[1400,1700],minDist:0.34,badRate:0.28,maxConcurrent:2},
               normal:{nextGap:[300,500],life:[1200,1500],minDist:0.32,badRate:0.35,maxConcurrent:3},
               hard:{nextGap:[260,460],life:[1000,1300],minDist:0.30,badRate:0.40,maxConcurrent:4} };
  const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  const Water=makeWaterGauge();
  const HUD = makeHUD();

  // Goal: รักษา “Balanced” นานตามระดับ
  const GOAL_SEC={easy:20,normal:30,hard:40}[diff]||30;
  let balancedSec=0;

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let water=55, remain=dur, timerId=0, loopId=0, refill=0;

  let feverLv=0, feverOn=false;
  function addFever(dx){ feverLv=Math.max(0,Math.min(100,feverLv+dx)); window.dispatchEvent(new CustomEvent('hha:fever',{detail:{level:feverLv}})); if(!feverOn&&feverLv>=100){ feverOn=true; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'start'}})); } if(feverOn&&feverLv<=0){ feverOn=false; window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'end'}})); } }

  function zone(){ return water>=40&&water<=70?'GREEN':(water>70?'HIGH':'LOW'); }

  // Mini quests (เพิ่มเป็น 10 ใบในไฟล์ quests-powerups.js แล้ว) — drawThree จะสุ่ม 3
  function pickQ(){ return drawThree('hydration', diff); }
  let QUESTS=pickQ(); let qIdx=0;

  function questProg(i,stats){ const q=QUESTS[i]; if(!q) return {pct:0,label:'-'}; const have=(q.prog?q.prog(stats):0)||0; const need=q.target||1; return {pct:Math.min(100,Math.round((have/need)*100)), label:`${q.label} (${Math.min(need,have)}/${need})`, done: !!(q.check&&q.check(stats))}; }
  function snapshot(){ return {score,goodCount:hits,junkMiss:misses,comboMax:maxCombo,feverCount:feverOn?1:0,star:0,diamond:0,noMissTime:balancedSec}; }

  function updateHUD(){
    const gPct=Math.min(100,Math.round((balancedSec/GOAL_SEC)*100));
    HUD.setGoal(`Goal: รักษา Balanced ให้ถึง ${GOAL_SEC}s — ${Math.min(GOAL_SEC,balancedSec)}s`, gPct);
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${Math.min(3,qIdx+1)}/3 — ${QUESTS[qIdx]?.label||'-'}`}}));
    const s=snapshot(); for(let i=0;i<3;i++){ const {pct,label,done}=questProg(i,s); HUD.setQ(i,label,pct,i===qIdx,done); }
  }
  function advanceQ(){ const q=QUESTS[qIdx]; if(q && q.check && q.check(snapshot())){ qIdx=Math.min(2,qIdx+1); if(qIdx===2 && QUESTS[2].check(snapshot()) && remain>5){ QUESTS=pickQ(); qIdx=0; refill++; } updateHUD(); } }

  function applyHit(type, wp){
    if(type==='good'){
      const val=(feverOn?28:20)+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
      water=Math.min(100, water+6); addFever(+10);
      burstAt(scene, wp, {color:'#22c55e',count:18,speed:1.0}); floatScore(scene, wp, '+'+val);
    }else if(type==='bad'){
      if(shield>0){ shield--; floatScore(scene,wp,'Shield!'); burstAt(scene,wp,{color:'#60a5fa',count:14,speed:0.9}); }
      else{
        if(zone()==='HIGH'){ score+=5; floatScore(scene,wp,'+5 (High)'); }
        else{ score=Math.max(0,score-20); combo=0; floatScore(scene,wp,'-20'); misses++; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }
        water=Math.max(0,water-8); addFever(-16);
        burstAt(scene, wp, {color:'#ef4444',count:12,speed:0.9});
      }
    }else if(type==='star'){ score+=40; addFever(+22); burstAt(scene,wp,{color:'#fde047',count:20,speed:1.1}); floatScore(scene,wp,'+40 ⭐'); }
    else if(type==='diamond'){ score+=80; addFever(+30); burstAt(scene,wp,{color:'#a78bfa',count:24,speed:1.2}); floatScore(scene,wp,'+80 💎'); }
    else if(type==='shield'){ shield=Math.min(3,shield+1); burstAt(scene,wp,{color:'#60a5fa',count:18,speed:1.0}); floatScore(scene,wp,'🛡️+1'); }
    Water.set(water);
    window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
  }

  function worldPosOf(el){ try{ const v=new (window.AFRAME?AFRAME.THREE.Vector3:window.THREE?.Vector3||function(){})(); if(el.object3D&&el.object3D.getWorldPosition) return el.object3D.getWorldPosition(v);}catch{} const p=el.getAttribute('position')||{x:0,y:0,z:-1.6}; return {x:+p.x||0,y:+p.y||0,z:+p.z||-1.6}; }

  function end(reason='timeout'){
    if(!running) return; running=false;
    clearInterval(timerId); clearTimeout(loopId);
    document.querySelectorAll('[data-hha-ui="progress"],[data-hha-ui="progress-mini"]').forEach(n=>n.remove());
    Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Hydration',difficulty:diff,score,combo:maxCombo,misses,hits,spawns,duration:dur,questsCleared:3,questsTotal:3,reason}}));
    if (feverOn) window.dispatchEvent(new CustomEvent('hha:fever',{detail:{state:'end'}}));
  }

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0],C.life[1]);

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length>=C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch,type; const r=Math.random();
    if      (r<0.05){ ch=STAR; type='star'; }
    else if (r<0.07){ ch=DIA;  type='diamond'; }
    else if (r<0.10){ ch=SHIELD; type='shield'; }
    else { const good=Math.random()>C.badRate; ch=(good?GOOD:BAD)[(Math.random()*(good?GOOD:BAD).length)|0]; type=good?'good':'bad'; }

    const pos=sp.sample(); const el=emojiImage(ch,0.7,128);
    el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`); host.appendChild(el); spawns++;
    const rec=sp.markActive(pos);
    const ttl=setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ water=Math.max(0,water-4); score=Math.max(0,score-8); combo=0; misses++; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); }
      try{ host.removeChild(el);}catch{} sp.unmark(rec); Water.set(water); updateHUD();
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp=worldPosOf(el);
      applyHit(type, wp);
      try{ host.removeChild(el);}catch{} sp.unmark(rec);
      advanceQ(); updateHUD();
      loopId=setTimeout(spawnOne,nextGap());
    },{passive:false});

    loopId=setTimeout(spawnOne,nextGap());
  }

  // time (นับ Balanced sec)
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  Water.set(water);
  timerId=setInterval(()=>{
    if(!running) return;
    remain=Math.max(0,remain-1);
    if(zone()==='GREEN') balancedSec++;
    updateHUD();
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout');
  },1000);

  updateHUD();
  spawnOne();

  return { stop(){end('quit');}, pause(){running=false;}, resume(){if(!running){running=true; spawnOne();}} };
}
export default { boot };