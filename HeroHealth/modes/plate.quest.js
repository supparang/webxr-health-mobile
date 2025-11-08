// === Healthy Plate — SAFE + Shards (theme: plate) ===
import { Particles } from '../vr/particles.js';

let running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
let spawnTimer=null, timeTimer=null, remain=0;

const CATS = ['veggie','fruit','grain','protein','dairy'];
const POOL = {
  veggie:['🥦','🥕','🥬','🍅','🌽','🥒'],
  fruit :['🍎','🍊','🍌','🍇','🍓','🍍','🥝','🍐'],
  grain :['🍞','🥖','🍚','🥯'],
  protein:['🍗','🥩','🐟','🥚','🫘'],
  dairy:['🥛','🧈','🧀','🍦']
};
const SPECIAL = ['⭐','💎']; // โบนัสสุ่ม

let needed = new Set(CATS); // ต้องเก็บครบรอบละ 5 หมู่

const spriteLocal=(emo,px=160)=>{ const k=emo+'@'+px; spriteLocal.cache=spriteLocal.cache||{};
  if(spriteLocal.cache[k]) return spriteLocal.cache[k];
  const c=document.createElement('canvas'); c.width=c.height=px;
  const ctx=c.getContext('2d'); ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(px*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=px*0.07; ctx.fillText(emo,px/2,px/2);
  return (spriteLocal.cache[k]=c.toDataURL('image/png')); };

function emit(n,d){ try{window.dispatchEvent(new CustomEvent(n,{detail:d}))}catch{} }
function popupText(txt,x,y,color){ const t=document.createElement('a-entity');
  t.setAttribute('troika-text',`value:${txt}; color:${color||'#fff'}; fontSize:0.09;`);
  t.setAttribute('position',`${x} ${y+0.05} -1.18`); host.appendChild(t);
  t.setAttribute('animation__rise',`property: position; to: ${x} ${y+0.32} -1.18; dur:520; easing:ease-out`);
  t.setAttribute('animation__fade',`property: opacity; to: 0; dur:520; easing:linear`);
  setTimeout(()=>{ try{t.remove();}catch{} },560); }

function updateQuest(){
  const remain=[...needed].map(s=>s.toUpperCase()).join(', ') || 'ครบ 5 หมู่แล้ว! เริ่มรอบใหม่';
  emit('hha:quest',{text:'Mini Quest — จัดจานให้ครบ: '+remain});
}

function startNewRound(){
  needed = new Set(CATS);
  updateQuest();
}

function makeTarget(emoji, catOrSpecial, diff){
  const root=document.createElement('a-entity');
  const img=document.createElement('a-image');
  const px=(Math.random()*1.6-0.8), py=(Math.random()*0.7+0.6), pz=-1.2;
  img.setAttribute('src', spriteLocal(emoji,192));
  img.setAttribute('position',`${px} ${py} ${pz}`); img.setAttribute('width',0.42); img.setAttribute('height',0.42);
  img.classList.add('clickable'); root.appendChild(img);

  let clicked=false;
  const hit=()=>{
    if(clicked||!running) return; clicked=true; try{root.remove();}catch{};
    if(catOrSpecial==='special'){
      const plus=40; score+=plus; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'plate'});
      popupText('+BONUS '+plus,px,py,'#fff1b8');
      emit('hha:score',{score,combo});
    }else{
      // ของหมวด
      if(needed.has(catOrSpecial)){
        needed.delete(catOrSpecial);
        const plus=30 + combo*2; score+=plus; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
        Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'plate'});
        popupText('+'+plus,px,py,'#fffbe6');
        emit('hha:score',{score,combo});
        if(needed.size===0){ // ครบ 5 หมู่
          startNewRound();
        }else updateQuest();
      }else{
        // เก็บซ้ำหมวดที่ไม่ต้องแล้ว → ไม่ได้คะแนน
        popupText('หมวดนี้ครบแล้ว',px,py,'#a5b4fc');
      }
    }
  };
  img.addEventListener('click',hit,{passive:false});
  img.addEventListener('touchstart',hit,{passive:false});

  let ttl=1700; if(diff==='easy') ttl=2000; else if(diff==='hard') ttl=1400;
  setTimeout(()=>{ if(!root.parentNode||clicked||!running) return; try{root.remove();}catch{}; spawns++; },ttl);

  return root;
}

function spawnLoop(diff){
  if(!running) return;
  const roll=Math.random();
  if(roll<0.15){ // พิเศษ 15%
    const s=SPECIAL[(Math.random()*SPECIAL.length)|0];
    host.appendChild(makeTarget(s,'special',diff));
  }else{
    const cat=CATS[(Math.random()*CATS.length)|0];
    const pool=POOL[cat]; const e=pool[(Math.random()*pool.length)|0];
    host.appendChild(makeTarget(e,cat,diff));
  }
  spawns++;
  let gap=560; if(diff==='easy') gap=700; if(diff==='hard') gap=420;
  spawnTimer=setTimeout(()=>spawnLoop(diff),gap);
}

export async function boot(cfg={}){
  host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal'); remain=(+cfg.duration||60);

  running=true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0;
  startNewRound(); emit('hha:score',{score:0,combo:0}); emit('hha:time',{sec:remain});

  clearInterval(timeTimer);
  timeTimer=setInterval(()=>{ if(!running) return; remain--; if(remain<0) remain=0; emit('hha:time',{sec:remain}); if(remain<=0) end('timeout'); },1000);

  spawnLoop(diff);

  function end(reason){
    if(!running) return; running=false;
    try{clearTimeout(spawnTimer);}catch{}; try{clearInterval(timeTimer);}catch{};
    emit('hha:end',{reason, score, combo:maxCombo, misses, hits, spawns, duration:+cfg.duration||60, title:'Healthy Plate', difficulty:diff, questsCleared:(needed.size===0?3:2), questsTotal:3});
  }
  return { stop(){end('stop');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnLoop(diff);} } };
}
export default { boot };
