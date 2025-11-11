// === /HeroHealth/modes/groups.safe.js (release with Goal/Quest HUD & Refill) ===
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

function makeHUD(title){ /* same mini HUD as goodjunk, compact impl */ 
  document.querySelectorAll('[data-hha-ui="progress"]').forEach(n=>n.remove());
  const w=document.createElement('div'); w.setAttribute('data-hha-ui','progress');
  Object.assign(w.style,{position:'fixed',left:'50%',bottom:'64px',transform:'translateX(-50%)',width:'min(640px,92vw)',zIndex:'910',color:'#e8eefc',background:'#0f172a99',border:'1px solid #334155',borderRadius:'14px',padding:'10px 12px',backdropFilter:'blur(6px)',font:'700 13px/1.3 system-ui'});
  w.innerHTML=`<div style="display:flex;justify-content:space-between"><div id="t"></div><div id="n" style="opacity:.85"></div></div>
  <div id="gL" style="margin:6px 0 4px">เป้า: -</div>
  <div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="gB" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)"></div></div>
  <div id="qs"></div>`;
  const qs=w.querySelector('#qs'); for(let i=0;i<3;i++){ const r=document.createElement('div'); r.style.margin='6px 0 0'; r.innerHTML=`<div id="l${i}" style="margin-bottom:3px"></div><div style="height:8px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="b${i}" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></div></div>`; qs.appendChild(r); }
  document.body.appendChild(w);
  window.addEventListener('hha:dispose-ui',()=>{try{w.remove();}catch{}},{once:true});
  return {
    setTitle:s=>w.querySelector('#t').textContent=s, setNote:s=>w.querySelector('#n').textContent=s||'',
    setGoal:(lab,p)=>{w.querySelector('#gL').textContent=lab; w.querySelector('#gB').style.width=Math.max(0,Math.min(100,Math.round(p)))+'%';},
    setQ:(i,lab,p,active,done)=>{const L=w.querySelector('#l'+i),B=w.querySelector('#b'+i); if(!L||!B)return; L.textContent=(done?'✅ ':'')+(active?'▶️ ':'')+lab; B.style.width=Math.max(0,Math.min(100,Math.round(p)))+'%';}
  };
}

export async function boot(cfg={}) {
  const scene=document.querySelector('a-scene');
  const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal');
  const dur =Number(cfg.duration||(diff==='easy'?90:diff==='hard'?45:60));

  const GROUPS={ veg:['🥦','🥕','🥬','🍅','🌽'], fruit:['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'], grain:['🍞','🥖','🍚','🍘'], protein:['🐟','🍗','🥚','🫘','🥜'], dairy:['🥛','🧀','🍦'] };
  const ALL=Object.values(GROUPS).flat();
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune={ easy:{nextGap:[360,560],life:[1500,1800],minDist:0.34,maxConcurrent:2},
               normal:{nextGap:[300,480],life:[1200,1500],minDist:0.32,maxConcurrent:3},
               hard:{nextGap:[240,420],life:[1000,1300],minDist:0.30,maxConcurrent:4}};
  const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  const HUD=makeHUD('Food Groups');

  // Goal: “เลือกให้ถูกหมู่” ขนาดเป้าไต่ระดับ 1→2→3 (ถ้าไม่พลาด)
  let goalSize=1, correctPicked=0;

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain=dur, timerId=0, loopId=0, refill=0;

  // รอบเป้าหมู่
  const keys=Object.keys(GROUPS);
  let target=keys[(Math.random()*keys.length)|0];

  function setNewGoal(){
    target=keys[(Math.random()*keys.length)|0];
    correctPicked=0;
  }

  // Mini quests
  function pickQ(){ return drawThree('groups', diff); }
  let QUESTS=pickQ(); let qIdx=0;

  function questProg(i,stats){ const q=QUESTS[i]; if(!q) return {pct:0,label:'-'}; const have=(q.prog?q.prog(stats):0)||0; const need=q.target||1; return {pct:Math.min(100,Math.round((have/need)*100)), label:`${q.label} (${Math.min(need,have)}/${need})`, done: !!(q.check&&q.check(stats))}; }
  function snapshot(){ return {score,goodCount:hits,junkMiss:misses,comboMax:maxCombo,feverCount:0,star:0,diamond:0,noMissTime:0}; }
  function updateHUD(){
    HUD.setGoal(`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize} — ทำแล้ว ${correctPicked}/${goalSize}`, Math.round((correctPicked/goalSize)*100));
    HUD.setTitle('Food Groups'+(refill?` (Refill +${refill})`:'')); window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${Math.min(3,qIdx+1)}/3 — ${QUESTS[qIdx]?.label||'-'}`}}));
    const s=snapshot(); for(let i=0;i<3;i++){ const {pct,label,done}=questProg(i,s); HUD.setQ(i,label,pct,i===qIdx,done); }
  }
  function advanceQ(){ const q=QUESTS[qIdx]; if(q && q.check && q.check(snapshot())){ qIdx=Math.min(2,qIdx+1); if(qIdx===2 && QUESTS[2].check(snapshot()) && remain>5){ QUESTS=pickQ(); qIdx=0; refill++; } updateHUD(); } }

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0],C.life[1]);

  function end(reason='timeout'){
    if(!running) return; running=false;
    clearInterval(timerId); clearTimeout(loopId);
    document.querySelectorAll('[data-hha-ui="progress"]').forEach(n=>n.remove());
    Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove());
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Food Groups',difficulty:diff,score,combo:maxCombo,misses,hits,spawns,duration:dur,questsCleared:3,questsTotal:3,reason}}));
  }

  function worldPosOf(el){ try{ const v=new (window.AFRAME?AFRAME.THREE.Vector3:window.THREE?.Vector3||function(){})(); if(el.object3D&&el.object3D.getWorldPosition) return el.object3D.getWorldPosition(v);}catch{} const p=el.getAttribute('position')||{x:0,y:0,z:-1.6}; return {x:+p.x||0,y:+p.y||0,z:+p.z||-1.6}; }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length>=C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch,type='food',groupKey; const r=Math.random();
    if      (r<0.05){ ch=STAR; type='star'; }
    else if (r<0.07){ ch='💎'; type='diamond'; }
    else if (r<0.10){ ch='🛡️'; type='shield'; }
    else {
      if (Math.random()<0.30){ groupKey=target; } else { groupKey=keys[(Math.random()*keys.length)|0]; }
      const pool=GROUPS[groupKey]; ch=pool[(Math.random()*pool.length)|0];
    }

    const pos=sp.sample(); const el=emojiImage(ch,0.7,128);
    el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`); host.appendChild(el); spawns++;
    const rec=sp.markActive(pos);
    const ttl=setTimeout(()=>{ if(!el.parentNode) return; if(type==='food' && groupKey===target){ misses++; combo=0; score=Math.max(0,score-10); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); } try{host.removeChild(el);}catch{} sp.unmark(rec); updateHUD(); }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp=worldPosOf(el);
      if(type==='food'){
        const inTarget=(groupKey===target);
        if(inTarget){
          const val=25+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; correctPicked++;
          burstAt(scene, wp, {color:'#22c55e',count:18,speed:1.05}); floatScore(scene, wp, '+'+val);
          if (correctPicked>=goalSize){ goalSize=Math.min(3,goalSize+1); setNewGoal(); }
        } else {
          combo=0; score=Math.max(0,score-12); burstAt(scene, wp, {color:'#ef4444',count:12,speed:0.9}); floatScore(scene, wp, '-12');
        }
      } else if(type==='star'){ score+=40; burstAt(scene,wp,{color:'#fde047',count:20,speed:1.1}); floatScore(scene,wp,'+40 ⭐'); }
      else if(type==='diamond'){ score+=80; burstAt(scene,wp,{color:'#a78bfa',count:24,speed:1.2}); floatScore(scene,wp,'+80 💎'); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); burstAt(scene,wp,{color:'#60a5fa',count:18,speed:1.0}); floatScore(scene,wp,'🛡️+1'); }

      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
      try{ host.removeChild(el);}catch{} sp.unmark(rec);
      advanceQ(); updateHUD();
      loopId=setTimeout(spawnOne,nextGap());
    },{passive:false});

    loopId=setTimeout(spawnOne,nextGap());
  }

  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{ if(!running) return; remain=Math.max(0,remain-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout'); else updateHUD(); },1000);

  updateHUD(); spawnOne();
  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnOne(); } } };
}
export default { boot };