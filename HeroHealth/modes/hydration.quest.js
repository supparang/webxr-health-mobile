// === Hydration — SAFE + Shards (theme: hydration) ===
import { Particles } from '../vr/particles.js';

let running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
let spawnTimer=null, timeTimer=null, remain=0;
let level=50; // 0..100 เป้าน้ำ “พอดี” = 40..60

const GOOD = ['💧','🥤','🧊','🚰'];   // ใช้ปรับระดับเข้าโซน
const BAD  = ['🍹','🍺','🧃','🍷'];   // ตัวล่อ (โหมดนี้ถือเป็นไม่ดีต่อสมดุล)

const spriteLocal=(emo,px=160)=>{ const k=emo+'@'+px; spriteLocal.cache=spriteLocal.cache||{};
  if(spriteLocal.cache[k]) return spriteLocal.cache[k];
  const c=document.createElement('canvas'); c.width=c.height=px;
  const ctx=c.getContext('2d'); ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(px*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.3)'; ctx.shadowBlur=px*0.07; ctx.fillText(emo,px/2,px/2);
  return (spriteLocal.cache[k]=c.toDataURL('image/png')); };

function emit(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} }
function popupText(txt,x,y,color){ const t=document.createElement('a-entity');
  t.setAttribute('troika-text',`value:${txt}; color:${color||'#fff'}; fontSize:0.09;`);
  t.setAttribute('position',`${x} ${y+0.05} -1.18`); host.appendChild(t);
  t.setAttribute('animation__rise',`property: position; to: ${x} ${y+0.32} -1.18; dur:520; easing:ease-out`);
  t.setAttribute('animation__fade',`property: opacity; to: 0; dur:520; easing:linear`);
  setTimeout(()=>{ try{t.remove();}catch{} },560); }

function meterTxt(){ return `Hydration ${Math.round(level)}%`; }

function makeTarget(emoji, type, diff){
  const root=document.createElement('a-entity');
  const img=document.createElement('a-image');
  const px=(Math.random()*1.6-0.8), py=(Math.random()*0.7+0.6), pz=-1.2;
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
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration'});
      popupText('+'+plus,px,py,'#e6f7ff');
      emit('hha:score',{score,combo});
    }else{
      // ของไม่ดี: ถ้าระดับน้ำต่ำอยู่แล้ว → โทษแรง (ไฟลุกเชิงสัญลักษณ์ด้วยสี shard)
      const heavy = (level<40);
      level = Math.max(0, level - (heavy? 10:6));
      const malus = heavy? 25:15;
      combo=0; score=Math.max(0, score-malus); misses++;
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'hydration'});
      popupText('-'+malus,px,py,'#ffd1d1');
      emit('hha:score',{score,combo}); emit('hha:miss',{count:misses});
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
  const goodPick = Math.random()>0.35;
  const pool = goodPick?GOOD:BAD;
  const emoji=pool[(Math.random()*pool.length)|0];
  host.appendChild(makeTarget(emoji, goodPick?'good':'bad', diff)); spawns++;
  let gap=560; if(diff==='easy') gap=700; if(diff==='hard') gap=420;
  spawnTimer=setTimeout(()=>spawnLoop(diff),gap);
}

export async function boot(cfg={}){
  host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal'); remain=(+cfg.duration||60);

  running=true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0; level=50;
  emit('hha:score',{score:0,combo:0});
  emit('hha:quest',{text:'Mini Quest — รักษาระดับน้ำให้อยู่ในโซน GREEN (40–60%)'});
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
