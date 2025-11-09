// === modes/hydration.quest.js ===
import { emojiImage } from './emoji-sprite.js';
const emit=(n,d)=>{try{window.dispatchEvent(new CustomEvent(n,{detail:d}))}catch{}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rand=(a,b)=>a+Math.random()*(b-a);

// น้ำดื่ม/ของขับน้ำ/หวาน
const DRINK_GOOD = ['🥤','🫖','💧','🍵']; // 💧น้ำ, ชาไม่หวาน
const DRINK_BAD  = ['🥤','🧋','🍺','🍸','🍷','🍹']; // น้ำหวาน/คาเฟอีน/แอลกอฮอล์ (เกมเด็ก: ใช้เป็นตัวอย่าง)
const DRINK_NEUT=['🥛','🧃']; // นม/น้ำผลไม้

export async function boot(cfg={}){
  const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal');
  const duration=Number(cfg.duration||60);

  let running=true, tLeft=duration;
  let score=0, combo=0, comboMax=0, hits=0, misses=0, spawns=0;
  let hydro=50; // 0..100
  // เกณฑ์ GREEN zone
  const zone={low:35, high:70};
  if(diff==='easy'){ Object.assign(zone,{low:30,high:75}); }
  if(diff==='hard'){ Object.assign(zone,{low:40,high:65}); }

  // mini-quests 3 ใบ
  const deck=['stayGreen20','streak10','over2green3']; let qIndex=0;
  function questText(){
    const map={
      stayGreen20:'อยู่ในโซนพอดี 20 วิ',
      streak10:'ดื่มถูก 10 ครั้งติด',
      over2green3:'ลดจาก HIGH กลับ GREEN 3 ครั้ง'
    }; return map[deck[qIndex]]||'ภารกิจน้ำ';
  }
  let qState={greenSec:0, streak:0, overToGreen:0};
  emit('hha:quest',{text:`Quest 1/3 — ${questText()}`});

  // เวลา
  const timeId=setInterval(()=>{
    if(!running) return;
    tLeft=Math.max(0,tLeft-1);
    emit('hha:time',{sec:tLeft});

    // decay เบา ๆ ออกนอก GREEN
    if(hydro>zone.high) hydro=Math.max(zone.high, hydro-1);
    if(hydro<zone.low)  hydro=Math.min(zone.low,  hydro+1);

    // นับเวลาในโซน GREEN
    if(hydro>=zone.low && hydro<=zone.high) qState.greenSec++;

    checkQuest();
    if(tLeft<=0) end('timeout');
  },1000);

  function checkQuest(){
    const id=deck[qIndex];
    if(!id) return;
    let ok=false;
    if(id==='stayGreen20') ok=qState.greenSec>=20;
    if(id==='streak10') ok=qState.streak>=10;
    if(id==='over2green3') ok=qState.overToGreen>=3;
    if(ok){
      qIndex++;
      emit('hha:quest',{text: deck[qIndex]?`Quest ${qIndex+1}/3 — ${questText()}`:'เคลียร์เควสต์น้ำครบแล้ว!'});
    }
  }

  function zoneLabel(){
    if(hydro<zone.low) return 'LOW';
    if(hydro>zone.high) return 'HIGH';
    return 'GREEN';
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
    const typeR=Math.random();
    const pool = typeR<0.55 ? DRINK_GOOD : (typeR<0.8 ? DRINK_NEUT : DRINK_BAD);
    const emo = pool[(Math.random()*pool.length)|0];
    const el = emojiImage(emo,0.7,160);
    const x=rand(-0.5,0.5), y=rand(0.9,1.4), z=-1.6;
    el.setAttribute('class','clickable');
    el.setAttribute('position',`${x} ${y} ${z}`);

    const life = (diff==='easy')?2000:(diff==='hard')?1300:1600;
    let dead=false;
    const kill=()=>{ if(dead) return; dead=true; el.parentNode&&el.parentNode.removeChild(el); };

    el.addEventListener('click', ()=>{
      if(!running||dead) return;
      hits++;
      const before=zoneLabel();

      // ผลกระทบต่อเกจ
      if(DRINK_GOOD.includes(emo)) hydro=clamp(hydro+8,0,100);
      else if(DRINK_BAD.includes(emo)) hydro=clamp(hydro-10,0,100);
      else hydro=clamp(hydro+4,0,100); // neutral

      // ให้คะแนนตามโซน
      if(zoneLabel()==='GREEN'){
        const plus = (diff==='hard')?30:(diff==='easy')?20:25;
        score += plus; combo++; comboMax=Math.max(comboMax,combo);
        pop('+'+plus+' ✓GREEN', el.object3D.position);
      }else if(zoneLabel()==='HIGH'){
        // ถ้ายังสูง → โทษเบา ๆ
        score=Math.max(0, score-10); combo=0;
        pop('-10 HIGH', el.object3D.position);
      }else{
        score=Math.max(0, score-8); combo=0;
        pop('-8 LOW', el.object3D.position);
      }

      // นับ over→green
      if(before==='HIGH' && zoneLabel()==='GREEN') qState.overToGreen++;

      // streak (ถูก=GREEN เท่านั้น)
      if(zoneLabel()==='GREEN') qState.streak++; else qState.streak=0;

      emit('hha:score',{score, combo});
      coach(`ระดับน้ำ: ${Math.round(hydro)} (${zoneLabel()})`);
      checkQuest();
      kill();
    });

    setTimeout(()=>{
      if(dead||!running) return;
      // หมดอายุ = พลาด (ถือว่าไม่ดื่ม) → score ไม่เปลี่ยน แต่คอมโบตก
      combo=0; misses++; emit('hha:miss',{count:misses}); emit('hha:score',{score, combo});
      kill();
    }, life);

    host.appendChild(el); spawns++;
  }

  function coach(msg){ emit('hha:quest',{text:`Hydration — ${msg}`}); }

  let loopId=0;
  function gap(){ return (diff==='easy')? rand(540,680) : (diff==='hard')? rand(360,460) : rand(440,560); }
  function loop(){ if(!running) return; makeTarget(); loopId=setTimeout(loop, Math.round(gap())); }
  loop();

  function end(reason='done'){
    if(!running) return; running=false;
    clearInterval(timeId); clearTimeout(loopId);
    emit('hha:end',{
      mode:'Hydration',
      difficulty:diff, duration,
      score, combo, comboMax, hits, misses, spawns,
      questsCleared: qIndex>=3 ? 3 : qIndex, questsTotal:3, reason
    });
  }
  return { stop:()=>end('stop'), pause:()=>{running=false;clearTimeout(loopId)}, resume:()=>{if(!running){running=true;loop()}} };
}
export default { boot };
