// === /HeroHealth/modes/plate.quest.js (latest) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';
function HUD(){ const w=document.createElement('div'); w.setAttribute('data-hha-ui','progress');
  Object.assign(w.style,{position:'fixed',left:'50%',bottom:'64px',transform:'translateX(-50%)',width:'min(640px,92vw)',zIndex:'910',color:'#e8eefc',background:'#0f172a99',border:'1px solid #334155',borderRadius:'14px',padding:'10px 12px',backdropFilter:'blur(6px)',font:'700 13px/1.3 system-ui'}); 
  w.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div id="t">Healthy Plate</div><div id="n" style="opacity:.85"></div></div>
  <div style="margin-bottom:8px"><div id="gl" style="margin-bottom:4px">เป้า: จัดครบ 5 หมู่</div><div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="gb" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)"></div></div></div>
  <div><div id="ql" style="margin-bottom:4px">Mini Quest —</div><div style="height:8px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="qb" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></div></div></div>`;
  document.body.appendChild(w); window.addEventListener('hha:dispose-ui',()=>{try{w.remove();}catch{}},{once:true});
  return { setNote:t=>w.querySelector('#n').textContent=t||'', setGoal:(l,p)=>{w.querySelector('#gl').textContent=l; w.querySelector('#gb').style.width=Math.max(0,Math.min(100,Math.round(p)))+'%';}, setQuest:(l,p,d)=>{w.querySelector('#ql').textContent=(d?'✅ ':'')+l; w.querySelector('#qb').style.width=Math.max(0,Math.min(100,Math.round(p)))+'%';} };
}
export async function boot(cfg={}){
  const scene=document.querySelector('a-scene'); const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal'); const dur=Number(cfg.duration||(diff==='easy'?90:diff==='hard'?45:60));
  const GROUPS={veg:['🥦','🥕','🥬','🍅','🌽'],fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],grain:['🍞','🥖','🍚','🍘'],protein:['🐟','🍗','🥚','🫘','🥜'],dairy:['🥛','🧀','🍦']}; const keys=Object.keys(GROUPS);
  const ALL=Object.values(GROUPS).flat(); const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const tune={easy:{nextGap:[360,560],life:[1400,1700],minDist:0.34,maxConcurrent:2},normal:{nextGap:[300,480],life:[1200,1500],minDist:0.32,maxConcurrent:3},hard:{nextGap:[240,420],life:[1000,1300],minDist:0.30,maxConcurrent:4}}; const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0, remain=dur, timerId=0, loopId=0, wdId=0;
  let roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};
  const HUDi=HUD(); HUDi.setNote(`โหมด: ${diff}`);

  const QUESTS=drawThree('plate',diff); let qIdx=0;
  function stats(){ return {score,goodCount:hits,junkMiss:misses,comboMax:maxCombo,feverCount:0,star:0,diamond:0,noMissTime:0}; }
  function updQuest(){ const q=QUESTS[qIdx]; const s=stats(); const have=(q.prog?q.prog(s):0)||0; const need=q.target||1; HUDi.setQuest(`Quest ${Math.min(3,qIdx+1)}/3 — ${q.label} (${Math.min(need,have)}/${need})`, (have/need)*100, !!q.check&&q.check(s)); }
  function updGoal(){ const done=Object.values(roundDone).filter(Boolean).length; HUDi.setGoal(`เป้า: จัดครบ 5 หมู่ — คืบหน้า ${done}/5`, (done/5)*100); }
  updQuest(); updGoal();

  const rand=(a,b)=>a+Math.random()*(b-a); const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]); const lifeMs=()=>rand(C.life[0],C.life[1]);

  function end(reason='timeout'){ if(!running) return; running=false; try{clearInterval(timerId);}catch{} try{clearTimeout(loopId);}catch{} try{clearInterval(wdId);}catch{} Array.from(host.querySelectorAll('a-image')).forEach(n=>{try{n.remove();}catch{}}); window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Healthy Plate',difficulty:diff,score,combo:maxCombo,misses,hits,spawns,duration:dur,questsCleared:QUESTS.filter(q=>q.check(stats())).length,questsTotal:3,reason}})); }
  function tryAdvanceQuest(){ const q=QUESTS[qIdx]; if(q?.check?.(stats())){ qIdx=Math.min(2,qIdx+1);} updQuest(); }

  function spawnOne(forceCenter){
    if(!running) return;
    const now=host.querySelectorAll('a-image').length; if(now>=C.maxConcurrent && !forceCenter){ loopId=setTimeout(spawnOne,120); return; }
    let ch,type='food', groupKey; const r=Math.random();
    if(r<0.05){ ch=STAR; type='star'; } else if(r<0.07){ ch='💎'; type='diamond'; } else if(r<0.10){ ch='🛡️'; type='shield'; }
    else { groupKey = keys[(Math.random()*keys.length)|0]; const pool=GROUPS[groupKey]; ch=pool[(Math.random()*pool.length)|0]; }
    const pos=forceCenter?{x:0,y:0.12,z:-1.6}:sp.sample();
    const el=emojiImage(ch,0.68,128); el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`); host.appendChild(el); spawns++;
    const rec=sp.markActive(pos); const ttl=setTimeout(()=>{ if(!el.parentNode) return; if(type==='food'){ misses++; combo=0; score=Math.max(0,score-10); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); } try{host.removeChild(el);}catch{} sp.unmark(rec); }, lifeMs());
    el.addEventListener('click',ev=>{ if(!running) return; ev.preventDefault(); clearTimeout(ttl); const wp=el.object3D.getWorldPosition(new THREE.Vector3());
      if(type==='food'){ const val=22+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; roundDone[groupKey]=true; burstAt(scene,wp,{color:'#22c55e',count:18,speed:1.05}); floatScore(scene,wp,'+'+val);
        if(Object.values(roundDone).every(Boolean)){ roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false}; floatScore(scene,wp,'ROUND +100'); score+=100; } updGoal(); }
      else if(type==='star'){ score+=40; burstAt(scene,wp,{color:'#fde047',count:20,speed:1.1}); floatScore(scene,wp,'+40 ⭐'); }
      else if(type==='diamond'){ score+=80; burstAt(scene,wp,{color:'#a78bfa',count:24,speed:1.2}); floatScore(scene,wp,'+80 💎'); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); burstAt(scene,wp,{color:'#60a5fa',count:18,speed:1.0}); floatScore(scene,wp,'🛡️+1'); }
      window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); try{host.removeChild(el);}catch{} sp.unmark(rec); tryAdvanceQuest(); loopId=setTimeout(spawnOne,nextGap()); },{passive:false});
    if(!forceCenter) loopId=setTimeout(spawnOne,nextGap());
  }

  // watchdog
  wdId=setInterval(()=>{ if(!running) return; if(host.querySelectorAll('a-image').length===0) spawnOne(true); },2000);

  // time
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{ if(!running) return; remain--; if(remain<0) remain=0; window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout'); },1000);

  spawnOne(true);
  return { stop(){end('quit');}, pause(){running=false;}, resume(){if(!running){running=true; spawnOne(true);}} };
}
export default { boot };