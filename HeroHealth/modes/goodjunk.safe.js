// === /HeroHealth/modes/goodjunk.safe.js (latest) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

/* ---------- Single-row HUD (Goal + Current Mini Quest) ---------- */
function makeProgressHUD(title){
  document.querySelectorAll('[data-hha-ui="progress"]').forEach(n=>n.remove());
  const w = document.createElement('div');
  w.setAttribute('data-hha-ui','progress');
  Object.assign(w.style,{
    position:'fixed',left:'50%',bottom:'64px',transform:'translateX(-50%)',
    width:'min(640px,92vw)',zIndex:'910',color:'#e8eefc',background:'#0f172a99',
    border:'1px solid #334155',borderRadius:'14px',padding:'10px 12px',
    backdropFilter:'blur(6px)',font:'700 13px/1.3 system-ui'
  });
  w.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div id="ph-title">${title}</div><div id="ph-note" style="opacity:.85"></div>
    </div>
    <div id="ph-goal" style="margin-bottom:8px">
      <div id="ph-goal-label" style="margin-bottom:4px">เป้า: -</div>
      <div style="height:10px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
        <div id="ph-goal-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#22c55e,#86efac)"></div>
      </div>
    </div>
    <div id="ph-quest">
      <div id="ph-q-label" style="margin-bottom:4px">Mini Quest —</div>
      <div style="height:8px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
        <div id="ph-q-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#60a5fa,#a78bfa)"></div>
      </div>
    </div>`;
  document.body.appendChild(w);
  window.addEventListener('hha:dispose-ui',()=>{try{w.remove();}catch{}},{once:true});
  return {
    setTitle:t=>w.querySelector('#ph-title').textContent=t,
    setNote:t=>w.querySelector('#ph-note').textContent=t||'',
    setGoal:(label,p)=>{ w.querySelector('#ph-goal-label').textContent=label; w.querySelector('#ph-goal-bar').style.width=Math.max(0,Math.min(100,Math.round(p)))+'%'; },
    setQuest:(label,p,done)=>{ w.querySelector('#ph-q-label').textContent=(done?'✅ ':'')+label; w.querySelector('#ph-q-bar').style.width=Math.max(0,Math.min(100,Math.round(p)))+'%'; }
  };
}

export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
  const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune={ easy:{nextGap:[360,560],life:[1400,1700],minDist:0.34,junkRate:0.28,maxConcurrent:2},
               normal:{nextGap:[300,480],life:[1200,1500],minDist:0.32,junkRate:0.35,maxConcurrent:3},
               hard:{nextGap:[240,420],life:[1000,1300],minDist:0.30,junkRate:0.42,maxConcurrent:4}};
  const C=tune[diff]||tune.normal;
  const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:C.minDist,decaySec:2.2});

  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0, starCount=0, diamondCount=0, noMissSec=0;
  let remain=dur, timerId=0, loopId=0, noMissId=0, wdId=0;

  const QUESTS = drawThree('goodjunk', diff);
  let qIdx=0;

  const HUD = makeProgressHUD('Good vs Junk');
  HUD.setNote(`โหมด: ${diff}`);
  function stats(){ return {score,goodCount:hits,comboMax:maxCombo,star:starCount,diamond:diamondCount,junkMiss:misses,noMissTime:noMissSec,feverCount:0}; }
  function updHUD(){
    HUD.setGoal(`เป้า: เก็บของดีให้ได้ 25 ชิ้น — คืบหน้า ${hits}/25`, (hits/25)*100);
    const cur=QUESTS[qIdx]; const s=stats(); const have=(cur.prog?cur.prog(s):0)||0; const need=cur.target||1;
    HUD.setQuest(`Quest ${Math.min(3,qIdx+1)}/3 — ${cur.label} (${Math.min(need,have)}/${need})`, (have/need)*100, !!cur.check&&cur.check(s));
  }

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>Math.floor(rand(C.nextGap[0],C.nextGap[1]));
  const lifeMs =()=>Math.floor(rand(C.life[0],C.life[1]));

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); }
  function end(reason='timeout'){
    if(!running) return; running=false;
    try{clearInterval(timerId);}catch{} try{clearTimeout(loopId);}catch{} try{clearInterval(noMissId);}catch{} try{clearInterval(wdId);}catch{}
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{try{n.remove();}catch{}});
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:'Good vs Junk',difficulty:diff,score,comboMax:maxCombo,misses,hits,spawns,duration:dur,questsCleared:QUESTS.filter(q=>q.check(stats())).length,questsTotal:3,reason}}));
  }

  function tryAdvanceQuest(){ const cur=QUESTS[qIdx]; if(cur?.check?.(stats())){ qIdx=Math.min(2,qIdx+1);} updHUD(); }

  function spawnOne(forceCenter){
    if(!running) return;
    const nowCount = host.querySelectorAll('a-image').length;
    if(nowCount>=C.maxConcurrent && !forceCenter){ loopId=setTimeout(spawnOne,100); return; }

    let ch,type;
    const r=Math.random();
    if      (r<0.04){ ch=STAR; type='star'; }
    else if (r<0.06){ ch=DIA;  type='diamond'; }
    else if (r<0.10){ ch=SHIELD; type='shield'; }
    else{
      const goodPick = Math.random() > C.junkRate;
      ch = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
      type = goodPick ? 'good':'junk';
    }

    const pos = forceCenter ? {x:0,y:0.12,z:-1.6} : sp.sample();
    const el = emojiImage(ch,0.68,128);
    el.classList.add('clickable'); el.setAttribute('position',`${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec=sp.markActive(pos);
    const ttl=setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ misses++; combo=0; score=Math.max(0,score-10); noMissSec=0; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); emitScore(); }
      try{host.removeChild(el);}catch{} sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',ev=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp=el.object3D.getWorldPosition(new THREE.Vector3());
      if(type==='good'){ const val=20+combo*2; score+=val; combo++; maxCombo=Math.max(maxCombo,combo); hits++; burstAt(scene,wp,{color:'#22c55e',count:18,speed:1.0}); floatScore(scene,wp,'+'+val); }
      else if(type==='junk'){ if(shield>0){ shield--; floatScore(scene,wp,'Shield!'); burstAt(scene,wp,{color:'#60a5fa',count:14,speed:0.9}); } else { combo=0; score=Math.max(0,score-15); misses++; noMissSec=0; burstAt(scene,wp,{color:'#ef4444',count:12,speed:0.9}); floatScore(scene,wp,'-15'); window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:misses}})); } }
      else if(type==='star'){ starCount++; score+=40; burstAt(scene,wp,{color:'#fde047',count:20,speed:1.1}); floatScore(scene,wp,'+40 ⭐'); }
      else if(type==='diamond'){ diamondCount++; score+=80; burstAt(scene,wp,{color:'#a78bfa',count:24,speed:1.2}); floatScore(scene,wp,'+80 💎'); }
      else if(type==='shield'){ shield=Math.min(3,shield+1); burstAt(scene,wp,{color:'#60a5fa',count:18,speed:1.0}); floatScore(scene,wp,'🛡️+1'); }

      emitScore(); try{host.removeChild(el);}catch{} sp.unmark(rec); tryAdvanceQuest();
      loopId=setTimeout(spawnOne,nextGap());
    },{passive:false});

    if(!forceCenter) loopId=setTimeout(spawnOne,nextGap());
  }

  // no-miss timer
  noMissId=setInterval(()=>{ if(running) noMissSec=Math.min(9999,noMissSec+1); },1000);

  // watchdog 2s: ไม่มีเป้า -> สปอว์นกลางจอ
  wdId=setInterval(()=>{ if(!running) return; if(host.querySelectorAll('a-image').length===0) spawnOne(true); },2000);

  // time HUD
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
  timerId=setInterval(()=>{ if(!running) return; remain=Math.max(0,remain-1); window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}})); if(remain<=0) end('timeout'); },1000);

  updHUD(); spawnOne(true); // เริ่มด้วยลูกแรกกลางจอชัวร์ ๆ

  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnOne(true);} } };
}
export default { boot };