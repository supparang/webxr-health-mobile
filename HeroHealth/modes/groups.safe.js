// === /HeroHealth/modes/groups.safe.js (latest) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';
function HUDFactory(){ /* same HUD as above, tiny inline */ 
  const make=(title)=>{document.querySelectorAll('[data-hha-ui="progress"]').forEach(n=>n.remove());
    const w=document.createElement('div');w.setAttribute('data-hha-ui','progress');
    Object.assign(w.style,{position:'fixed',left:'50%',bottom:'64px',transform:'translateX(-50%)',width:'min(640px,92vw)',zIndex:'910',color:'#e8eefc',background:'#0f172a99',border:'1px solid #334155',borderRadius:'14px',padding:'10px 12px',backdropFilter:'blur(6px)',font:'700 13px/1.3 system-ui'});
    w.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div id="ph-title">${title}</div><div id="ph-note" style="opacity:.85"></div></div>
    <div style="margin-bottom:8px"><div id="ph-goal-label" style="margin-bottom:4px">เป้า: -</div><div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="ph-goal-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)"></div></div></div>
    <div><div id="ph-q-label" style="margin-bottom:4px">Mini Quest —</div><div style="height:8px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="ph-q-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></div></div></div>`;
    document.body.appendChild(w); window.addEventListener('hha:dispose-ui',()=>{try{w.remove();}catch{}},{once:true});
    return{ setTitle:t=>w.querySelector('#ph-title').textContent=t,setNote:t=>w.querySelector('#ph-note').textContent=t||'',
      setGoal:(l,p)=>{w.querySelector('#ph-goal-label').textContent=l;w.querySelector('#ph-goal-bar').style.width=Math.min(100,Math.max(0,Math.round(p)))+'%';},
      setQuest:(l,p,d)=>{w.querySelector('#ph-q-label').textContent=(d?'✅ ':'')+l;w.querySelector('#ph-q-bar').style.width=Math.min(100,Math.max(0,Math.round(p)))+'%';}}};
  return { make };
}
export async function boot(cfg={}){
  const scene=document.querySelector('a-scene'); const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal'); const dur=Number(cfg.duration||(diff==='easy'?90:diff==='hard'?45:60));
  const GROUPS={veg:['🥦','🥕','🥬','🍅','🧄','🧅','🌽'],fruit:['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],grain:['🍞','🥖','🥯','🥐','🍚','🍙','🍘'],protein:['🐟','🍗','🍖','🥚','🫘','🥜'],dairy:['🥛','🧀','🍦','🍨','🍮']}; const ALL=Object.values(GROUPS).flat();
  const tune={easy:{nextGap:[360,560],life:[1500,1800],minDist:0.34,maxConcurrent:2},normal:{nextGap:[300,480],life:[1200,1500],minDist:0.32,maxConcurrent:3},hard:{nextGap:[240,420],life:[1000,1300],minDist:0.30,maxConcurrent:4}}; const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, target='veg', goalSize=1, correctPicked=0, remain=dur, timerId=0, loopId=0, wdId=0;
  const QUESTS=drawThree('groups',diff); let qIdx=0;

  const HUD=HUDFactory().make('Food Groups'); HUD.setNote(`โหมด: ${diff}`);
  function updGoal(){ HUD.setGoal(`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize} — ทำแล้ว ${correctPicked}/${goalSize}`, (correctPicked/goalSize)*100); }
  function stats(){ return {score,goodCount:hits,comboMax:maxCombo,junkMiss:misses,star:0,diamond:0,noMissTime:0,feverCount:0}; }
  function updQuest(){ const cur=QUESTS[qIdx]; const s=stats(); const have=(cur.prog?cur.prog(s):0)||0; const need=cur.target||1; HUD.setQuest(`Quest ${Math.min(3,qIdx+1)}/3 — ${cur.label} (${Math.min(need,have)}/${need})`, (have/need)*100, !!cur.check&&cur.check(s)); }

  function setNewGoal(){ const keys=Object.keys(GROUPS); target=keys[(Math.random()*keys.length)|0]; correctPicked=0; updGoal(); }
  setNewGoal(); updQuest();

  const rand=(a,b)=>a+Math.random()*(b-a); const nextGap=()=>rand(C.nextGap[0],C.nextGap[1]); const lifeMs=()=>rand(C.life[0],C.life[1]);

  function end(reason='timeout'){ if(!running) return; running=false; try{clearInterval(timerId);}catch{} try{clearTimeout(loopId);}catch{} try{clearInterval(wdId);}catch{} Array.from(host.querySelectorAll('a-image')).forEach(n=>{try{n.remove();}catch{}}); window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Food Groups',difficulty:diff,score,combo:maxCombo,misses,hits,spawns,duration:dur,questsCleared:QUESTS.filter(q=>q.check(stats())).length,questsTotal:3,reason}})); }

  function tryAdvanceQuest(){ const q=QUESTS[qIdx]; if(q?.check?.(stats())){ qIdx=Math.min(2,qIdx+1);} updQuest(); }

  function spawnOne(forceCenter){
    if(!running) return;
    const now=host.querySelectorAll('a-image').length; if(now>=C.maxConcurrent && !forceCenter){ loopId=setTimeout(spawnOne,120); return; }
    let ch; if(Math.random()<0.30){ const pool=GROUPS[target]; ch=pool[(Math.random()*pool.length)|0]; } else { ch=ALL[(Math.random()*ALL.length)|0]; }
    const inTarget=GROUPS[target].includes(ch);
    const pos=forceCenter?{x:0,y:0.12,z:-1.6}:sp.sample();
    const el=emojiImage(ch,0.68,128); el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y