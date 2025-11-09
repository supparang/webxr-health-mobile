// === modes/groups.safe.js ===
import { emojiImage } from './emoji-sprite.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=(a,b)=>a+Math.random()*(b-a);
function emit(n,d){ try{window.dispatchEvent(new CustomEvent(n,{detail:d}))}catch{} }

const GROUPS = {
  veg: ['🥦','🥕','🥬','🍅','🫑'],
  fruit:['🍎','🍌','🍊','🍓','🍇','🍍','🍐'],
  protein:['🐟','🍳','🧀','🥩','🍗','🥜'],
  grain:['🍞','🥖','🍚','🍝','🥨'],
  dairy:['🥛','🧈','🍦','🥛']
};
const ALL = Object.values(GROUPS).flat();

export async function boot(cfg={}){
  const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal');
  const duration=Number(cfg.duration||60);

  // เป้าต่อรอบ (1→2→3 ถ้าไม่พลาด)
  let roundGoal=1;
  const lifeBy={easy:2000,normal:1600,hard:1300};
  const gapBy={easy:[540,680],normal:[440,560],hard:[360,460]};

  let running=true, tLeft=duration, score=0, combo=0, comboMax=0, hits=0, misses=0, spawns=0;
  let neededType='veg', needLeft=roundGoal;

  // mini quests (สุ่ม 3 จาก 10 แบบสั้น ๆ)
  const pool=['veg5','fruit5','protein3','grain3','dairy3','combo10','score300','noMiss10','mix10','streak8'];
  const deck=[]; while(deck.length<3){ const p=pool.splice((Math.random()*pool.length)|0,1)[0]; deck.push(p); }
  let qIndex=0;
  function questText(){
    const map={
      veg5:'เก็บผัก 5 ชิ้น', fruit5:'เก็บผลไม้ 5 ชิ้น', protein3:'โปรตีน 3 ชิ้น',
      grain3:'ธัญพืช 3 ชิ้น', dairy3:'นม/นมถั่ว 3 ชิ้น', combo10:'คอมโบ 10',
      score300:'คะแนน 300+', noMiss10:'ไม่พลาด 10 วิ', mix10:'รวมหมวด 10 ชิ้น', streak8:'ต่อเนื่อง 8'
    };
    return map[deck[qIndex]]||'ภารกิจพิเศษ';
  }
  let stat={veg:0,fruit:0,protein:0,grain:0,dairy:0,mix:0,noMiss:0};
  emit('hha:quest',{text:`Quest 1/3 — ${questText()}`});

  const timeId=setInterval(()=>{
    if(!running) return;
    tLeft=Math.max(0,tLeft-1); emit('hha:time',{sec:tLeft});
    stat.noMiss++; // สำหรับ noMiss
    if(tLeft<=0) end('timeout');
    checkQuest();
  },1000);

  function checkQuest(){
    const id=deck[qIndex];
    if(!id) return;
    let done=false;
    if(id==='veg5') done=stat.veg>=5;
    if(id==='fruit5') done=stat.fruit>=5;
    if(id==='protein3') done=stat.protein>=3;
    if(id==='grain3') done=stat.grain>=3;
    if(id==='dairy3') done=stat.dairy>=3;
    if(id==='combo10') done=comboMax>=10;
    if(id==='score300') done=score>=300;
    if(id==='noMiss10') done=stat.noMiss>=10;
    if(id==='mix10') done=stat.mix>=10;
    if(id==='streak8') done=comboMax>=8;

    if(done){
      qIndex++;
      if(deck[qIndex]) emit('hha:quest',{text:`Quest ${qIndex+1}/3 — ${questText()}`});
      else emit('hha:quest',{text:`เคลียร์เควสต์ครบแล้ว!`});
    }
  }

  function labelOf(emoji){
    for(const k of Object.keys(GROUPS)){
      if(GROUPS[k].includes(emoji)) return k;
    }
    return 'other';
  }

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
    // ตัด bias ให้ตรงกับ neededType มากขึ้น
    const pool = Math.random()<0.65 ? GROUPS[neededType] : ALL;
    const emo = pool[(Math.random()*pool.length)|0];
    const el = emojiImage(emo, 0.7, 160);
    const x=rand(-0.5,0.5), y=rand(0.9,1.4), z=-1.6;
    el.setAttribute('class','clickable');
    el.setAttribute('position',`${x} ${y} ${z}`);
    const life=lifeBy[diff]||1600;

    let dead=false;
    const kill=()=>{ if(dead) return; dead=true; el.parentNode&&el.parentNode.removeChild(el); };

    el.addEventListener('click', ()=>{
      if(!running||dead) return;
      hits++;
      const g=labelOf(emo);
      stat[g]++; stat.mix++;
      if(g===neededType){
        score+=25; combo++; comboMax=Math.max(comboMax,combo);
        needLeft--;
        pop('+25', el.object3D.position);
        if(needLeft<=0){
          // รอบใหม่: ถ้ายังไม่พลาดเลย → เพิ่มเป้ารอบสูงสุด 3
          roundGoal = Math.min(3, roundGoal+1);
          // สุ่มหมวดใหม่
          const keys=Object.keys(GROUPS);
          neededType=keys[(Math.random()*keys.length)|0];
          needLeft=roundGoal;
          emit('hha:quest',{text:`รอบใหม่: เลือกหมวด ${neededType.toUpperCase()} (${roundGoal} ชิ้น)`});
        }
      }else{
        // พลาดรอบนี้
        combo=0; misses++;
        roundGoal=1; // รีเซ็ตเป้ารอบ
        needLeft=1;
        emit('hha:miss',{count:misses});
        emit('hha:quest',{text:`พลาด! เริ่มใหม่: เลือกหมวด ${neededType.toUpperCase()} (1 ชิ้น)`});
      }
      emit('hha:score',{score, combo});
      checkQuest();
      kill();
    });

    setTimeout(()=>{
      if(dead||!running) return;
      // หมดอายุ = พลาดรอบ (แต่ไม่หักคะแนน)
      combo=0; misses++; roundGoal=1; needLeft=1;
      emit('hha:miss',{count:misses});
      emit('hha:score',{score, combo});
      kill();
    }, life);

    host.appendChild(el);
    spawns++;
  }

  function nextGap(){
    const [a,b]=gapBy[diff]||gapBy.normal;
    return Math.round(rand(a,b));
  }

  let loopId=0;
  function loop(){ if(!running) return; makeTarget(); loopId=setTimeout(loop, nextGap()); }

  // init needed group
  neededType = Object.keys(GROUPS)[(Math.random()*5)|0];
  needLeft = roundGoal;
  emit('hha:quest',{text:`เริ่ม: เลือกหมวด ${neededType.toUpperCase()} (${roundGoal} ชิ้น)`});

  // time start & loop
  const timeStart = setTimeout(()=>{},0);
  const timeKeep = timeStart; // no-op to keep symmetry
  loop();

  function end(reason='done'){
    if(!running) return;
    running=false;
    clearInterval(timeId);
    clearTimeout(loopId);
    emit('hha:end', {
      mode:'Food Groups',
      difficulty:diff,
      duration,
      score, combo, comboMax, hits, misses, spawns,
      questsCleared: qIndex>=3 ? 3 : qIndex,
      questsTotal: 3,
      reason
    });
  }

  return { stop:()=>end('stop'), pause:()=>{running=false;clearTimeout(loopId)}, resume:()=>{if(!running){running=true;loop()}} };
}
export default { boot };
