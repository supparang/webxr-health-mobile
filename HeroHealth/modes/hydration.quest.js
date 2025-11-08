// === Hydration — SAFE + Shards + Powerups (star/diamond/shield) ===
import { Particles } from '../vr/particles.js';

let running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
let spawnTimer=null, timeTimer=null, remain=0;
let level=50; // 0..100; โซนพอดี 40..60

let shieldUntil=0; const SHIELD_MS=6000;

const GOOD = ['💧','🥤','🧊','🚰'];
const BAD  = ['🍹','🧃']; // สิ่งที่ทำให้หลุดสมดุล
const POWERUPS=['⭐','💎','🛡️'];

const spriteLocal=(emo,px=160)=>{ const k=emo+'@'+px; spriteLocal.cache=spriteLocal.cache||{};
  if(spriteLocal.cache[k]) return spriteLocal.cache[k];
  const c=document.createElement('canvas'); c.width=c.height=px;
  const ctx=c.getContext('2d'); ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(px*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=px*0.07; ctx.fillText(emo,px/2,px/2);
  return (spriteLocal.cache[k]=c.toDataURL('image/png')); };

function emit(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} }
function now(){ return (typeof performance!=='undefined' && performance.now)? performance.now(): Date.now(); }
function hasShield(){ return now()<shieldUntil; }
function giveShield(ms=SHIELD_MS){ shieldUntil=Math.max(shieldUntil,now())+ms; emit('hha:powerup',{type:'shield',until:shieldUntil}); }
function popupText(txt,x,y,color){ const t=document.createElement('a-entity');
  t.setAttribute('troika-text',`value:${txt}; color:${color||'#fff'}; fontSize:0.09;`);
  t.setAttribute('position',`${x} ${y+0.05} -1.18`); host.appendChild(t);
  t.setAttribute('animation__rise',`property: position; to: ${x} ${y+0.32} -1.18; dur:520; easing:ease-out`);
  t.setAttribute('animation__fade',`property: opacity; to: 0; dur:520; easing:linear`);
  setTimeout(()=>{ try{t.remove();}catch{} },560); }

function meterTxt(){ return `Hydration ${Math.round(level)}%`; }

function makeTarget(emoji, type, diff){
  // type: 'good'|'bad'|'star'|'diamond'|'shield'
  const root=document.createElement('a-entity');
  const img=document.createElement('a-image');
  const px=(Math.random()*1.2-0.6), py=(Math.random()*0.5+0.55), pz=-1.2;
  img.setAttribute('src', spriteLocal(emoji,192));
  img.setAttribute('position',`${px} ${py} ${pz}`); img.setAttribute('width',0.42); img.setAttribute('height',0.42);
  img.classList.add('clickable'); root.appendChild(img);

  let clicked=false;
  const hit=()=>{
    if(clicked||!running) return; clicked=true; try{root.remove();}catch{};
    if(type==='good'){
      level = Math.min(100, level + 6);
      const inGreen = (level>=40 && level<=60);
      const plus = inGreen ? (20 + combo*2) : 12;
      score += plus; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration',kind:'good'});
      popupText('+'+plus,px,py,'#e6f7ff'); emit('hha:score',{score,combo});
    }else if(type==='bad'){
      const heavy = (level<40);
      level = Math.max(0, level - (heavy? 10:6));
      const loss = heavy? 25:15;
      if(hasShield()){
        Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration',kind:'shield'}); popupText('Shield!',px,py,'#c7f9cc');
      }else{
        combo=0; score=Math.max(0, score - loss); misses++; emit('hha:miss',{count:misses});
        Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration',kind:'bad'});
        popupText('-'+loss,px,py,'#ffd1d1'); emit('hha:score',{score,combo});
      }
    }else if(type==='star'){
      const plus=60; score+=plus; combo++; maxCombo=Math.max(maxCombo,combo); hits++;
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration',kind:'star'});
      popupText('+STAR '+plus,px,py,'#fff3b0'); emit('hha:score',{score,combo});
    }else if(type==='diamond'){
      const plus=120; score+=plus; combo+=2; maxCombo=Math.max(maxCombo,combo); hits++;
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration',kind:'diamond'});
      popupText('+DIAMOND '+plus,px,py,'#cfe8ff'); emit('hha:score',{score,combo});
    }else if(type==='shield'){
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration',kind:'shield'});
      popupText('🛡️ SHIELD',px,py,'#c7f9cc'); giveShield();
    }
    emit('hha:quest',{text: meterTxt()});
  };

  img.addEventListener('click',hit,{passive:false});
  img.addEventListener('touchstart',hit,{passive:false});

  let ttl=1700; if(diff==='easy') ttl=2000; else if(diff==='hard') ttl=1400;
  setTimeout(()=>{ if(!root.parentNode||clicked||!running) return; try{root.remove();}catch{}; spawns++; },ttl);

  return root;
}

function spawnLoop(diff){
  if(!running) return;
  const r=Math.random();
  let type, emoji;
  if(r<0.10){ const p=POWERUPS[(Math.random()*POWERUPS.length)|0]; emoji=p; type=(p==='⭐')?'star':(p==='💎')?'diamond':'shield'; }
  else if(r<0.45){ type='bad'; emoji=BAD[(Math.random()*BAD.length)|0]; }
  else{ type='good'; emoji=GOOD[(Math.random()*GOOD.length)|0]; }
  host.appendChild(makeTarget(emoji,type,diff)); spawns++;
  let gap=560; if(diff==='easy') gap=700; if(diff==='hard') gap=420;
  spawnTimer=setTimeout(()=>spawnLoop(diff),gap);
}

export async function boot(cfg={}){
  host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal'); remain=(+cfg.duration||60);

  running=true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0; level=50; shieldUntil=0;
  emit('hha:score',{score:0,combo:0});
  emit('hha:quest',{text:'Mini Quest — รักษาระดับน้ำให้อยู่ใน GREEN (40–60%) (⭐/💎/🛡️ ช่วยได้)'});
  emit('hha:time',{sec:remain});

  clearInterval(timeTimer);
  timeTimer=setInterval(()=>{ if(!running) return; remain--; if(remain<0) remain=0; emit('hha:time',{sec:remain});
    if(remain<=0) end('timeout');
  },1000);

  spawnLoop(diff);

  function end(reason){
    if(!running) return; running=false;
    try{clearTimeout(spawnTimer);}catch{}; try{clearInterval(timeTimer);}catch{};
    emit('hha:end',{reason, score, combo:maxCombo, misses, hits, spawns, duration:+cfg.duration||60, title:'Hydration', difficulty:diff, questsCleared:1, questsTotal:3});
  }
  return { stop(){end('stop');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnLoop(diff);} } };
}
export default { boot };
