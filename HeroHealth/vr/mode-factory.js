// === vr/mode-factory.js — Production Core (score/combo/fever + FX + anti-overlap) ===
import { Difficulty } from './difficulty.js';
import { SFX }        from './sfx.js';

// helpers
const $ = (s)=>document.querySelector(s);
const sample = (a)=>a[Math.floor(Math.random()*a.length)];
const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));
const now    = ()=>performance.now();

// safe defaults
const MIN_DIST = 0.36;
const SLOT_COOLDOWN_MS = 520;
const TIME_BY_DIFF = { easy:45, normal:60, hard:75 };
const MAX_ACTIVE_BY_DIFF = { easy:1, normal:2, hard:2 };
const BUDGET_BY_DIFF     = { easy:1, normal:2, hard:2 };

// simple emoji node (text or image)
function makeEmoji(char,{scale=0.58}={}){
  const img=document.createElement('a-entity');
  img.setAttribute('text',{value:char, align:'center', width:2.2*scale, color:'#fff'});
  return img;
}

// spawn grid (ล่าง-กลางจอ)
function buildSlots(yBase=0.42){
  const xs=[-0.95, 0.00, 0.95];
  const ys=[ yBase, yBase+0.34 ];
  const slots=[]; let id=0;
  for(let ci=0; ci<xs.length; ci++){
    for(let ri=0; ri<ys.length; ri++){
      slots.push({ id:id++, col:ci, row:ri, x:xs[ci], y:ys[ri], z:-1.34, used:false, last:0 });
    }
  }
  return slots;
}
function takeSlot(slots, busyCols, busyRows, cooldownMs){
  const t=now();
  const free=slots.filter(s=>!s.used && (t-s.last)>=cooldownMs && !busyCols.has(s.col) && !busyRows.has(s.row));
  if(!free.length) return null;
  const s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s;
}
function releaseSlot(slot){ if(slot){ slot.used=false; slot.last=now(); } }

// tiny particle FX
function burst(host, p, color='#69f0ae'){
  const N=10;
  for(let i=0;i<N;i++){
    const e=document.createElement('a-entity');
    const dx=(Math.random()-0.5)*0.5, dy=(Math.random())*0.5, dz=(Math.random()-0.5)*0.5;
    e.setAttribute('geometry','primitive: sphere; radius: 0.02');
    e.setAttribute('material',`color:${color}; metalness:0; roughness:1; opacity:0.95`);
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    host.appendChild(e);
    e.setAttribute('animation__move',`property: position; to: ${p.x+dx} ${p.y+dy+0.12} ${p.z+dz}; dur: 420; easing: ease-out`);
    e.setAttribute('animation__fade',`property: material.opacity; to: 0; dur: 420; delay: 200; easing: linear`);
    setTimeout(()=>{ try{e.remove();}catch{} }, 700);
  }
}
function smoke(host, p){
  const e=document.createElement('a-entity');
  e.setAttribute('geometry','primitive: torus; radius:0.08; radiusTubular:0.01');
  e.setAttribute('material','color:#ff6b6b; opacity:0.85; shader:flat');
  e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
  host.appendChild(e);
  e.setAttribute('animation__grow','property: scale; to: 1.6 1.6 1.6; dur: 360; easing: ease-out');
  e.setAttribute('animation__fade','property: material.opacity; to: 0; dur: 360; delay: 120; easing: linear');
  setTimeout(()=>{ try{e.remove();}catch{} }, 560);
}
function screenShake(scene, amt=0.012, dur=120){
  try{
    const camRig = $('#camRig');
    if(!camRig) return;
    const p = camRig.getAttribute('position');
    camRig.setAttribute('position',`${p.x+amt} ${p.y} ${p.z}`);
    setTimeout(()=>camRig.setAttribute('position',`${p.x-amt} ${p.y} ${p.z}`), dur/2);
    setTimeout(()=>camRig.setAttribute('position',`${p.x} ${p.y} ${p.z}`), dur);
  }catch{}
}

// --------------------------------------------------
/**
 * boot({
 *   name, pools:{good:[], bad:[]}, judge(hitChar, ctx)->{good, scoreDelta, feverDelta}
 *   host, difficulty, duration, goal
 * })
 */
export async function boot(config = {}){
  const {
    name='mode',
    pools={ good:[], bad:[] },
    judge,
    host:givenHost,
    difficulty:givenDiff='normal',
    duration:givenDuration,
    goal=40
  } = config;

  // host
  let host=givenHost;
  if(!host){ const wrap=$('a-scene')||document.body; const auto=document.createElement('a-entity'); auto.id='spawnHost'; wrap.appendChild(auto); host=auto; }

  // sfx
  const sfx = new SFX?.('../assets/audio/') || {};
  try{ await sfx.unlock?.(); sfx.attachPageVisibilityAutoMute?.(); }catch{}

  const scene = $('a-scene') || document.body;

  // diff/time
  const diff = new Difficulty();
  const safe={ size:0.60, rate:520, life:2000 };
  const base=(diff?.config?.[givenDiff]) || (diff?.config?.normal) || safe;
  let duration = givenDuration || TIME_BY_DIFF[givenDiff] || 60;
  let spawnRateMs = Number(base.rate) || safe.rate;
  let lifetimeMs  = Number(base.life) || safe.life;
  let sizeFactor  = Math.max(0.40, (Number(base.size)||0.60)*0.80);
  let hitW        = (givenDiff==='easy'?0.50 : givenDiff==='hard'?0.40 : 0.46);

  // state
  let running=true, score=0, combo=0, comboMax=0, streak=0, lastGoodAt=now();
  let missionGood=0, missionBad=0;
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:duration}}));

  const slots=buildSlots();
  const active=new Set();
  const busyCols=new Set(), busyRows=new Set();
  let MAX_ACTIVE=MAX_ACTIVE_BY_DIFF[givenDiff] ?? 2;
  const BUDGET  =BUDGET_BY_DIFF[givenDiff] ?? 2;
  let issuedThisSec=0, spawnTicker, SPAWN_LOCK=false;
  const budgetTimer=setInterval(()=>{ issuedThisSec=0; }, 1000);

  // combo decay
  const comboDecay=setInterval(()=>{ if(!running) return; if(now()-lastGoodAt>2000 && combo>0){ combo--; window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); } },1000);

  // timer
  const secondTimer=setInterval(()=>{
    if(!running) return;
    duration = Math.max(0, duration-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:duration}}));
    if(duration<=0) endGame('timeout');
  },1000);

  // pause/resume
  const api = {
    pause(){ if(!running) return; running=false; clearTimeout(spawnTicker); },
    resume(){ if(running) return; running=true; loop(); },
    stop(){ endGame('stop'); }
  };
  window.addEventListener('blur', ()=>api.pause());
  window.addEventListener('focus',()=>api.resume());
  document.addEventListener('visibilitychange',()=>document.hidden?api.pause():api.resume());

  // loop
  function loop(){
    clearTimeout(spawnTicker);
    const tick=()=>{
      if(running && issuedThisSec<BUDGET) spawnOne();
      const cd=Math.max(340, spawnRateMs|0);
      spawnTicker=setTimeout(tick, cd);
    };
    tick();
  }
  loop();

  // spawn one
  function spawnOne(){
    if(!running) return;
    if(SPAWN_LOCK) return; SPAWN_LOCK=true;
    try{
      if(active.size>=MAX_ACTIVE || issuedThisSec>=BUDGET) return;

      const slot=takeSlot(slots, busyCols, busyRows, SLOT_COOLDOWN_MS);
      if(!slot) return;

      // ไม่ให้ชนกัน
      const tooClose=[...active].some(el=>{ const p=el.getAttribute('position'); const dx=p.x-slot.x, dy=p.y-slot.y; return (dx*dx+dy*dy)<(MIN_DIST*MIN_DIST); });
      if(tooClose){ releaseSlot(slot); return; }

      busyCols.add(slot.col); busyRows.add(slot.row); issuedThisSec++;

      const poolGood = pools.good||[];
      const poolBad  = pools.bad ||[];
      const isGood   = Math.random() < (poolBad.length?0.7:1.0);
      const char     = isGood ? sample(poolGood) : sample(poolBad.length?poolBad:poolGood);

      const el=makeEmoji(char,{scale:sizeFactor});
      el.setAttribute('position',`${slot.x} ${slot.y} ${slot.z}`);
      el.classList.add('clickable');
      const hit=document.createElement('a-plane');
      hit.setAttribute('width',hitW); hit.setAttribute('height',hitW);
      hit.setAttribute('material','opacity:0; transparent:true; side:double');
      hit.classList.add('clickable'); el.appendChild(hit);

      active.add(el);
      host.appendChild(el);

      // TTL
      const ttlMult=(givenDiff==='easy')?1.8:(givenDiff==='hard'?0.95:1.1);
      const ttl=Math.round(lifetimeMs*ttlMult*(1.05+Math.random()*0.35));
      const killer=setTimeout(()=>{ // miss
        missionBad++;
        combo=0; streak=0;
        window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
        cleanup();
      }, ttl);

      const fire=(ev)=>{
        ev?.stopPropagation?.(); ev?.preventDefault?.();
        clearTimeout(killer);

        let res={ good:true, scoreDelta:10, feverDelta:0 };
        if(typeof judge==='function') res = judge(char, { type:'hit', score, combo, streak });

        if(res.good){
          missionGood++; score += (res.scoreDelta??10); combo++; comboMax=Math.max(comboMax,combo); streak++; lastGoodAt=now();
          burst(host,{x:slot.x,y:slot.y,z:slot.z}, '#69f0ae'); sfx.popGood?.();
        }else{
          score=Math.max(0, score+(res.scoreDelta??-5)); combo=0; streak=0;
          smoke(host,{x:slot.x,y:slot.y,z:slot.z}); screenShake(scene);
          sfx.popBad?.();
          missionBad++;
        }
        window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));
        // update mini-quest summary (แบบกว้าง ๆ เผื่อไม่มีระบบภายนอก)
        window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`No-Junk: ${missionBad}/10 วิ | เป้าหมายหลัก เก็บของดี ${missionGood}/${goal} (ขยะ ${missionBad}/3)`}}));

        if(missionGood>=goal) endGame('goal');
        cleanup();
      };

      ['click','mousedown','touchstart','triggerdown'].forEach(evt=>{
        try{ hit.addEventListener(evt, fire, {passive:false}); }catch{}
        try{ el.addEventListener(evt,  fire, {passive:false}); }catch{}
      });

      function cleanup(){
        try{ el.remove(); }catch{}
        active.delete(el);
        busyCols.delete(slot.col); busyRows.delete(slot.row);
        releaseSlot(slot);
      }
    } finally { SPAWN_LOCK=false; }
  }

  function endGame(reason='stop'){
    if(!running) return; running=false;
    clearTimeout(spawnTicker); clearInterval(budgetTimer); clearInterval(secondTimer); clearInterval(comboDecay);
    try{ window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score,comboMax,missionGood,missionBad}})); }catch{}
  }

  return api; // สำคัญ: ไม่โยน api แบบ global ป้องกัน “Identifier 'api' has already been declared”
}

export default { boot };