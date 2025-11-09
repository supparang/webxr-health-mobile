// === modes/plate.quest.js ===
import { emojiImage } from '../vr/emoji-sprite.js';
const emit=(n,d)=>{try{window.dispatchEvent(new CustomEvent(n,{detail:d}))}catch{}};
const rand=(a,b)=>a+Math.random()*(b-a);

const GROUPS = {
  veg: ['🥦','🥕','🥬','🍅','🫑'],
  fruit:['🍎','🍌','🍊','🍓','🍇','🍍','🍐'],
  protein:['🐟','🍳','🧀','🥩','🍗','🥜'],
  grain:['🍞','🥖','🍚','🍝','🥨'],
  dairy:['🥛','🧈','🍦']
};

export async function boot(cfg={}){
  const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal');
  const duration=Number(cfg.duration||60);
  let running=true,tLeft=duration,score=0,combo=0,comboMax=0,hits=0,misses=0,spawns=0;

  // รอบ: ต้องเก็บครบ 5 หมู่
  let needed = new Set(Object.keys(GROUPS));

  // mini-quests
  const deck=['finishPlate','combo10','score400']; let qIndex=0;
  const map={finishPlate:'จัดครบ 5 หมู่ 1 ครั้ง', combo10:'คอมโบ 10', score400:'คะแนน 400+'};
  emit('hha:quest',{text:`Quest 1/3 — ${map[deck[qIndex]]}`});

  const timeId=setInterval(()=>{
    if(!running) return;
    tLeft=Math.max(0,tLeft-1); emit('hha:time',{sec:tLeft});
    if(tLeft<=0) end('timeout');
    if(deck[qIndex]==='combo10' && comboMax>=10){ qIndex++; emit('hha:quest',{text: deck[qIndex]?`Quest ${qIndex+1}/3 — ${map[deck[qIndex]]}`:'เคลียร์เควสต์ครบแล้ว!'}); }
    if(deck[qIndex]==='score400' && score>=400){ qIndex++; emit('hha:quest',{text: deck[qIndex]?`Quest ${qIndex+1}/3 — ${map[deck[qIndex]]}`:'เคลียร์เควสต์ครบแล้ว!'}); }
  },1000);

  function pop(txt,pos){
    const t=document.createElement('a-entity');
    t.setAttribute('text',`value:${txt}; color:#fff; align:center; width:2`);
    t.setAttribute('position',`${pos.x} ${pos.y+0.2} ${pos.z}`);
    host.appendChild(t);
    t.setAttribute('animation__rise',`property: position; to: ${pos.x} ${pos.y+0.6} ${pos.z}; dur:520; easing:easeOutCubic`);
    t.setAttribute('animation__fade',`property: opacity; to: 0; dur:520; easing:linear`);
    setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),540);
  }

  function makeTarget(){
    // bias ไปยังหมู่ที่ยังขาด
    let pool=[];
    if(Math.random()<0.65 && needed.size>0){
      const key=[...needed][(Math.random()*needed.size)|0];
      pool=GROUPS[key];
    }else{
      pool=Object.values(GROUPS).flat();
    }
    const emo=pool[(Math.random()*pool.length)|0];
    const el=emojiImage(emo,0.7,160);
    const x=rand(-0.5,0.5), y=rand(0.9,1.4), z=-1.6;
    el.setAttribute('class','clickable');
    el.setAttribute('position',`${x} ${y} ${z}`);

    const life = (diff==='easy')?2000:(diff==='hard')?1300:1600;
    let dead=false;
    const kill=()=>{ if(dead) return; dead=true; el.parentNode&&el.parentNode.removeChild(el); };

    el.addEventListener('click', ()=>{
      if(!running||dead) return; hits++;
      let group=''; for(const k of Object.keys(GROUPS)){ if(GROUPS[k].includes(emo)) group=k; }
      if(group){
        score+=24; combo++; comboMax=Math.max(comboMax,combo);
        needed.delete(group);
        pop('+24 ✓'+group.toUpperCase(), el.object3D.position);
        if(needed.size===0){
          // จบรอบ
          if(deck[qIndex]==='finishPlate'){ qIndex++; emit('hha:quest',{text: deck[qIndex]?`Quest ${qIndex+1}/3 — ${map[deck[qIndex]]}`:'เคลียร์เควสต์ครบแล้ว!'}); }
          // เริ่มรอบใหม่
          needed = new Set(Object.keys(GROUPS));
          emit('hha:quest',{text:`เริ่มรอบใหม่: จัดครบ 5 หมู่`});
        }
      }
      emit('hha:score',{score, combo});
      kill();
    });

    setTimeout(()=>{
      if(dead||!running) return;
      combo=0; misses++; emit('hha:miss',{count:misses}); emit('hha:score',{score, combo});
      kill();
    }, life);

    host.appendChild(el); spawns++;
  }

  function gap(){ return (diff==='easy')? Math.round(rand(540,680)) : (diff==='hard')? Math.round(rand(360,460)) : Math.round(rand(440,560)); }
  let loopId=0; function loop(){ if(!running) return; makeTarget(); loopId=setTimeout(loop, gap()); } loop();

  function end(reason='done'){
    if(!running) return; running=false;
    clearInterval(timeId); clearTimeout(loopId);
    const cleared = (qIndex>=3)?3:qIndex;
    emit('hha:end',{ mode:'Healthy Plate', difficulty:diff, duration, score, combo, comboMax, hits, misses, spawns, questsCleared:cleared, questsTotal:3, reason });
  }
  return { stop:()=>end('stop'), pause:()=>{running=false;clearTimeout(loopId)}, resume:()=>{if(!running){running=true;loop()}} };
}
export default { boot };
