// === modes/goodjunk.safe.js ===
import { emojiImage } from '../vr/emoji-sprite.js';

const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍊','🍌','🍐','🥬','🍚','🥛','🐟','🍞','🍍','🥝'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🌭','🍫'];

const QUEST_POOL = [
  {id:'good10', label:'เก็บของดี 10 ชิ้น',      done:s=>s.good>=10, prog:s=>`${Math.min(10,s.good)}/10`},
  {id:'combo10',label:'คอมโบแตะ 10',            done:s=>s.comboMax>=10, prog:s=>`${Math.min(10,s.comboMax)}/10`},
  {id:'fever1', label:'เข้า FEVER 1 ครั้ง',      done:s=>s.fever>=1, prog:s=>`${Math.min(1,s.fever)}/1`},
  {id:'avoid5', label:'หลีกเลี่ยงขยะ 5 ครั้ง',  done:s=>s.avoid>=5, prog:s=>`${Math.min(5,s.avoid)}/5`},
  {id:'score300',label:'ทำคะแนน 300+',           done:s=>s.score>=300, prog:s=>`${Math.min(300,s.score)}/300`},
  {id:'good20', label:'เก็บของดี 20 ชิ้น',      done:s=>s.good>=20, prog:s=>`${Math.min(20,s.good)}/20`},
  {id:'combo15',label:'คอมโบแตะ 15',            done:s=>s.comboMax>=15, prog:s=>`${Math.min(15,s.comboMax)}/15`},
  {id:'fever2', label:'เข้า FEVER 2 ครั้ง',      done:s=>s.fever>=2,  prog:s=>`${Math.min(2,s.fever)}/2`},
  {id:'star3',  label:'เก็บ ⭐ 3 ดวง',           done:s=>s.star>=3,   prog:s=>`${Math.min(3,s.star)}/3`},
  {id:'diamond1',label:'เก็บ 💎 1 เม็ด',        done:s=>s.diamond>=1,prog:s=>`${Math.min(1,s.diamond)}/1`},
];

function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=(a,b)=>a+Math.random()*(b-a);

export async function boot(cfg={}){
  const host = cfg.host || document.getElementById('spawnHost');
  const diff = String(cfg.difficulty||'normal');
  const duration = Number(cfg.duration||60);

  // tuning by diff
  const lifeBy = {easy: 1900, normal: 1600, hard: 1300};
  const gapBy  = {easy: [520,650], normal:[420,560], hard:[330,440]};
  const scoreGood = {easy:20, normal:22, hard:24};
  const scoreJunkPenalty = {easy:12, normal:15, hard:18};

  let running=true, tLeft=duration;
  let score=0, combo=0, comboMax=0, hits=0, misses=0, spawns=0;
  let fever=false, feverGauge=0, feverTimer=null, feverNeed=10;
  // stats for quests
  const stats = {good:0, avoid:0, fever:0, star:0, diamond:0, score:0, comboMax:0};
  // quest deck: pick 3 unique
  const pool=[...QUEST_POOL];
  const deck=[];
  while(deck.length<3 && pool.length){
    const i=(Math.random()*pool.length)|0; deck.push(pool.splice(i,1)[0]);
  }
  let qIndex=0;

  // initial HUD
  emit('hha:score', {score, combo});
  emit('hha:quest', {text:`Quest 1/3 — ${deck[0].label} (เริ่ม!)`});
  emit('hha:fever', {state:'end'});

  // time loop
  const timeId=setInterval(()=>{
    if(!running) return;
    tLeft=Math.max(0,tLeft-1);
    emit('hha:time',{sec:tLeft});
    if(tLeft<=0){ end('timeout'); }
  },1000);

  function nextGap(){
    const [a,b]=gapBy[diff]||gapBy.normal;
    // เร่งเล็กน้อยตอน fever
    const g = fever ? 0.85 : 1.0;
    return Math.round(rand(a,b)*g);
  }

  function startFever(){
    if(fever) return;
    fever=true; feverGauge=100;
    emit('hha:fever',{state:'start', level:100});
    clearTimeout(feverTimer);
    feverTimer=setTimeout(()=>endFever(), 10000);
    stats.fever++; // quest
    coach('FEVER ON! คะแนน x2');
  }
  function endFever(){
    if(!fever) return;
    fever=false; feverGauge=0;
    emit('hha:fever',{state:'end'});
  }

  function coach(msg){
    // ใช้ badgeQuest เป็น coach line สั้นๆ (ไม่บัง HUD)
    emit('hha:quest',{text: (deck[qIndex]?`Quest ${qIndex+1}/3 — ${deck[qIndex].label} | `:'')+msg});
  }

  function checkQuestProgress(){
    const q=deck[qIndex];
    if(!q) return;
    const ok = q.done(stats);
    const prog = q.prog? q.prog(stats):'';
    emit('hha:quest',{text:`Quest ${qIndex+1}/3 — ${q.label} ${prog?`(${prog})`:''}`});
    if(ok){
      qIndex++;
      if(deck[qIndex]){
        coach('สุดยอด! ไปภารกิจถัดไป');
        emit('hha:quest',{text:`Quest ${qIndex+1}/3 — ${deck[qIndex].label} (เริ่ม!)`});
      }else{
        coach('เคลียร์ครบ 3 เควสต์แล้ว! ลุยทำคะแนนต่อ');
      }
    }
  }

  function popScore(txt, pos){
    const t=document.createElement('a-entity');
    t.setAttribute('text', `value:${txt}; color:#fff; align:center; width:2`);
    t.setAttribute('position', `${pos.x} ${pos.y+0.18} ${pos.z}`);
    host.appendChild(t);
    t.setAttribute('animation__rise', 'property: position; to: '+pos.x+' '+(pos.y+0.6)+' '+pos.z+'; dur:520; easing:easeOutCubic');
    t.setAttribute('animation__fade', 'property: opacity; to: 0; dur:520; easing:linear');
    setTimeout(()=>t.parentNode&&t.parentNode.removeChild(t),540);
  }

  function shardsBurst(pos, color='#8ecae6'){
    const root=document.createElement('a-entity');
    root.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    for(let i=0;i<10;i++){
      const s=document.createElement('a-sphere');
      s.setAttribute('radius', 0.02);
      s.setAttribute('color', color);
      const dx=rand(-0.4,0.4), dy=rand(0.1,0.7), dz=rand(-0.4,0.4);
      s.setAttribute('position', `0 0 0`);
      s.setAttribute('animation__go', `property: position; to: ${dx} ${dy} ${dz}; dur:520; easing:easeOutQuad`);
      s.setAttribute('animation__fade', `property: material.opacity; to: 0; dur:520; easing:linear`);
      root.appendChild(s);
    }
    host.appendChild(root);
    setTimeout(()=>root.parentNode&&root.parentNode.removeChild(root),560);
  }

  function makeTarget(){
    // pick good/junk/star/diamond (star/diamond rare)
    const r=Math.random();
    let emoji, kind='good';
    if(r<0.06){ emoji='⭐'; kind='star'; }
    else if(r<0.02){ emoji='💎'; kind='diamond'; }
    else if(r<0.70){ emoji=GOOD[(Math.random()*GOOD.length)|0]; kind='good'; }
    else { emoji=JUNK[(Math.random()*JUNK.length)|0]; kind='junk'; }

    const el = emojiImage(emoji, 0.7, 160);
    // place in central band
    const x = rand(-0.5,0.5);
    const y = rand(0.9,1.4); // กลางจอจริง ๆ
    const z = -1.6;
    el.setAttribute('class','clickable');
    el.setAttribute('position', `${x} ${y} ${z}`);

    let died=false, clicked=false;
    const kill=()=>{ if(died) return; died=true; el.parentNode&&el.parentNode.removeChild(el); };

    el.addEventListener('click', ()=>{
      if(!running || clicked) return; clicked=true;
      hits++;
      if(kind==='good'){
        const base=scoreGood[diff]||22;
        const plus=fever? base*2 : base;
        score+=plus;
        combo++; comboMax=Math.max(comboMax,combo);
        stats.good++; stats.score=score; stats.comboMax=comboMax;
        if(combo>=feverNeed && !fever) startFever();
        popScore('+'+plus, el.object3D.position);
        shardsBurst(el.object3D.position, '#7dd3fc');
      }else if(kind==='junk'){
        // จับ "เลี่ยงขยะ": ถ้ากด = โทษ, ถ้าไม่กดจนหมดอายุ = นับ avoid
        combo=0;
        score=Math.max(0, score - (scoreJunkPenalty[diff]||15));
        popScore('-'+(scoreJunkPenalty[diff]||15), el.object3D.position);
        shardsBurst(el.object3D.position, '#fca5a5');
      }else if(kind==='star'){
        score+=40; stats.star++; popScore('+40 ⭐', el.object3D.position); shardsBurst(el.object3D.position, '#fde68a');
      }else if(kind==='diamond'){
        score+=80; stats.diamond++; popScore('+80 💎', el.object3D.position); shardsBurst(el.object3D.position, '#a7f3d0');
      }
      emit('hha:score',{score, combo});
      checkQuestProgress();
      kill();
    });

    const life = lifeBy[diff]||1600;
    setTimeout(()=>{
      if(died||!running) return;
      // miss: only punish good-miss; junk-miss becomes "avoid"
      if(el.parentNode) el.parentNode.removeChild(el);
      if(kind==='good'){
        misses++; combo=0;
        stats.score=score; // unchanged
        emit('hha:miss',{count:misses});
      }else if(kind==='junk'){
        stats.avoid++;
        checkQuestProgress();
      }
    }, life);

    host.appendChild(el);
    spawns++;
  }

  // spawn loop
  let loopId=0;
  function loop(){
    if(!running) return;
    makeTarget();
    loopId=setTimeout(loop, nextGap());
  }

  function end(reason='done'){
    if(!running) return;
    running=false;
    clearInterval(timeId);
    clearTimeout(loopId);
    clearTimeout(feverTimer);
    endFever();
    emit('hha:end',{
      mode:'Good vs Junk',
      difficulty:diff,
      duration,
      score, combo, comboMax, hits, misses, spawns,
      questsCleared: qIndex>=3 ? 3 : qIndex,
      questsTotal: 3,
      reason
    });
  }

  // start!
  loop();

  return {
    stop: ()=>end('stop'),
    pause: ()=>{ running=false; clearTimeout(loopId); },
    resume: ()=>{ if(!running){ running=true; loop(); } }
  };
}

export default { boot };
