// === /HeroHealth/modes/hydration.quest.js (DOM fallback; Water Gauge + quests + effects-safe) ===
const THREE = (typeof window!=='undefined' && window.AFRAME && window.AFRAME.THREE)
  ? window.AFRAME.THREE : (typeof window!=='undefined' ? window.THREE : null);

import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { drawThree } from '../vr/quests-powerups.js';

/* ---------------- HUD: Water Gauge ---------------- */
function destroyWaterGauge(){
  const el = document.getElementById('waterWrap');
  if (el) { try { el.remove(); } catch {} }
}
function ensureWaterGauge() {
  destroyWaterGauge();
  const wrap = document.createElement('div');
  wrap.id='waterWrap'; wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style,{
    position:'fixed',left:'50%',bottom:'56px',transform:'translateX(-50%)',
    width:'min(540px,86vw)',zIndex:'900',color:'#e8eefc',
    background:'#0f172a99',border:'1px solid #334155',borderRadius:'12px',
    padding:'10px 12px',backdropFilter:'blur(6px)',fontWeight:'800'
  });
  wrap.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>Water</span><span id="waterLbl">Balanced</span>
    </div>
    <div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
      <div id="waterFill" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div>
    </div>`;
  document.body.appendChild(wrap);
}
function setWaterGauge(val){
  const f=document.getElementById('waterFill'), l=document.getElementById('waterLbl');
  if(!f||!l) return;
  const pct=Math.max(0,Math.min(100,Math.round(val)));
  f.style.width=pct+'%';
  let zone='Low'; if(pct>=40&&pct<=70) zone='Balanced'; else if(pct>70) zone='High';
  l.textContent=zone;
  f.style.background=(zone==='Balanced')
    ?'linear-gradient(90deg,#06d6a0,#37d67a)'
    :(zone==='High'?'linear-gradient(90deg,#22c55e,#93c5fd)':'linear-gradient(90deg,#f59e0b,#ef4444)');
}

/* ---------------- helpers ---------------- */
function qs(k){ return new URLSearchParams(location.search).get(k); }
const DEBUG = (qs('debug')==='1'||qs('debug')==='true');

function dlog(){ if(DEBUG) console.log('[HYD]', ...arguments); }

function emitScore(score,combo){
  try{ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); }catch{}
}
function emitTime(sec){
  try{ window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec}})); }catch{}
}
function setQuestText(txt){
  try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:txt||'Mini Quest'}})); }catch{}
}

/* ---------------- Game ---------------- */
export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  ensureWaterGauge();

  // item pools
  const GOOD = ['💧','🚰','🥛','🍊','🍋'];
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune = {
    easy:   { nextGap:[380,560], life:[1400,1700], minDist:0.34, badRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,500], life:[1200,1500], minDist:0.32, badRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[260,460], life:[1000,1300], minDist:0.30, badRate:0.40, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  // state
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain=dur, timerId=0, loopId=0, disposeHandler=null;
  let water = 55; setWaterGauge(water);

  // quests (สุ่ม 3 ใบ)
  const QUESTS_POOL = drawThree('hydration', diff);
  let qIdx=0;
  function updQuest(){ setQuestText(`Quest ${qIdx+1}/3 — ${QUESTS_POOL[qIdx]?.label || 'รักษาระดับน้ำให้พอดี'}`); }
  updQuest();

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0], C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0], C.life[1]);
  const zone =()=> (water>=40 && water<=70) ? 'GREEN' : (water>70 ? 'HIGH':'LOW');

  function applyHit(type, wpText){
    if (type==='good'){
      const val = 20 + combo*2;
      score += val; combo++; maxCombo=Math.max(maxCombo, combo); hits++;
      water = Math.min(100, water + 6);
      floatScore(scene, {x:0,y:0,z:0}, '+'+val); // text overlay ok
    } else if (type==='bad'){
      if (shield>0){ shield--; floatScore(scene, {x:0,y:0,z:0}, 'Shield!'); }
      else{
        if (zone()==='HIGH'){ score += 5; floatScore(scene, {x:0,y:0,z:0}, '+5 (High)'); }
        else { score = Math.max(0, score - 20); combo=0; floatScore(scene, {x:0,y:0,z:0}, '-20'); }
        water = Math.max(0, water - 8);
      }
    } else if (type==='star'){
      score += 40; floatScore(scene, {x:0,y:0,z:0}, '+40 ⭐');
    } else if (type==='diamond'){
      score += 80; floatScore(scene, {x:0,y:0,z:0}, '+80 💎');
    } else if (type==='shield'){
      shield = Math.min(3, shield+1); floatScore(scene, {x:0,y:0,z:0}, '🛡️+1');
    }
    setWaterGauge(water);
    emitScore(score,combo);
  }

  function tryAdvanceQuest(){
    const s = { score, goodCount:hits, junkMiss:misses, comboMax:maxCombo, feverCount:0, star:0, diamond:0, noMissTime:0 };
    const q = QUESTS_POOL[qIdx]; if (!q) return;
    const done = q.check ? q.check(s) : false;
    if (done) { qIdx = Math.min(2, qIdx+1); updQuest(); }
  }

  /* ---------- Fallback DOM layer: always visible targets ---------- */
  // ใช้เมื่อ: A-Frame สไปรท์ไม่โชว์ หรืออยากบังคับด้วย ?dom=1
  const FORCE_DOM = (qs('dom')==='1' || !window.AFRAME);
  const layerId = 'hydro-layer';
  function makeLayer(){
    let old=document.getElementById(layerId);
    if(old) try{ old.remove(); }catch{}
    const L=document.createElement('div'); L.id=layerId; L.setAttribute('data-hha-ui','');
    L.style.position='fixed'; L.style.inset='0'; L.style.zIndex='650';
    document.body.appendChild(L); return L;
  }
  let layer = null;
  function vw(){ return Math.max(320, window.innerWidth||320); }
  function vh(){ return Math.max(320, window.innerHeight||320); }

  function spawnDOM(){
    if(!running) return;
    if(!layer) layer=makeLayer();
    const el = document.createElement('div');
    el.className='hha-tgt';
    el.style.position='absolute';
    el.style.transform='translate(-50%,-50%)';
    el.style.filter='drop-shadow(0 8px 14px rgba(0,0,0,.5))';
    el.style.transition='transform .12s ease, opacity .24s ease';
    el.style.fontSize=(diff==='easy'?74:diff==='hard'?56:64)+'px';
    el.style.lineHeight='1'; el.style.opacity='1'; el.style.pointerEvents='auto';

    // pick type
    let ch, type; const r=Math.random();
    if      (r<0.05){ ch=STAR; type='star'; }
    else if (r<0.07){ ch=DIA;  type='diamond'; }
    else if (r<0.10){ ch=SHIELD; type='shield'; }
    else{
      const good = Math.random()>C.badRate;
      ch = (good?GOOD:BAD)[(Math.random()*(good?GOOD:BAD).length)|0];
      type = good?'good':'bad';
    }
    el.textContent = ch;

    // position
    const x=Math.floor(vw()*0.12 + Math.random()*vw()*0.76);
    const y=Math.floor(vh()*0.18 + Math.random()*vh()*0.62);
    el.style.left=x+'px'; el.style.top=y+'px';

    let clicked=false;
    const life = lifeMs();
    const ttl = setTimeout(()=>{
      if(clicked||!running) return;
      if(type==='good'){ water=Math.max(0, water-4); score=Math.max(0, score-8); combo=0; misses++; setWaterGauge(water); emitScore(score,combo); }
      try{ layer.removeChild(el); }catch{}
    }, life);

    function onHit(ev){
      if(clicked) return; clicked=true; try{ev.preventDefault();}catch{}
      clearTimeout(ttl);
      applyHit(type,'DOM');
      el.style.transform='translate(-50%,-50%) scale(.85)'; el.style.opacity='.12';
      setTimeout(()=>{ try{ layer.removeChild(el); }catch{} }, 140);
      tryAdvanceQuest();
      loopId=setTimeout(FORCE_DOM?spawnDOM:spawn3D, nextGap());
    }
    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    layer.appendChild(el);
    loopId=setTimeout(FORCE_DOM?spawnDOM:spawn3D, nextGap());
  }

  function spawn3D(){
    if(!running) return;
    if(!host || !window.AFRAME){ spawnDOM(); return; }
    if(host.querySelectorAll('a-image').length >= C.maxConcurrent){ loopId=setTimeout(spawn3D,120); return; }

    let ch, type; const r=Math.random();
    if      (r < 0.05) { ch=STAR; type='star'; }
    else if (r < 0.07) { ch=DIA;  type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      const good = Math.random() > C.badRate;
      ch = (good ? GOOD : BAD)[(Math.random() * (good?GOOD:BAD).length)|0];
      type = good ? 'good' : 'bad';
    }

    const pos = sp.sample();
    let el;
    try{
      el = emojiImage(ch, 0.7, 128);
    }catch(e){
      dlog('emojiImage failed, fallback DOM', e);
      spawnDOM(); return;
    }
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ water=Math.max(0, water-4); score=Math.max(0, score-8); combo=0; misses++; setWaterGauge(water); emitScore(score,combo); }
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return;
      ev.preventDefault(); clearTimeout(ttl);
      let wp = {x:0,y:0,z:0};
      try{ if(THREE) wp = el.object3D.getWorldPosition(new THREE.Vector3()); }catch{}
      applyHit(type, wp);
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
      tryAdvanceQuest();
      loopId=setTimeout(FORCE_DOM?spawnDOM:spawn3D, nextGap());
    }, {passive:false});

    loopId=setTimeout(FORCE_DOM?spawnDOM:spawn3D, nextGap());
  }

  // เวลา
  emitTime(dur);
  timerId = setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    emitTime(remain);
    if(remain<=0) end('timeout');
  },1000);

  function end(reason='timeout'){
    if(!running) return; running=false;
    try { clearInterval(timerId); } catch {}
    try { clearTimeout(loopId); } catch {}
    if (disposeHandler) { window.removeEventListener('hha:dispose-ui', disposeHandler); disposeHandler=null; }
    destroyWaterGauge();
    try{ Array.from(host.querySelectorAll('a-image')).forEach(n=>n.remove()); }catch{}
    try{ const L=document.getElementById(layerId); if(L) L.remove(); }catch{}
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Hydration', difficulty:diff, score, combo:maxCombo, misses, hits, spawns,
      duration:dur, questsCleared:qIdx+1, questsTotal:3, reason
    }}));
  }

  disposeHandler = ()=>{ destroyWaterGauge(); const L=document.getElementById(layerId); if(L) L.remove(); };
  window.addEventListener('hha:dispose-ui', disposeHandler);

  // go!
  (FORCE_DOM?spawnDOM:spawn3D)();

  return {
    stop(){ end('quit'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; (FORCE_DOM?spawnDOM:spawn3D)(); } }
  };
}

// window fallback + default export
if (typeof window!=='undefined'){ window.HHA_BOOT = boot; }
export default { boot };