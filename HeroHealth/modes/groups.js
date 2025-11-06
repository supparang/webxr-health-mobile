// === modes/groups.safe.js (VR Groups Mode / 2025-11-06) ===
// โหมด: จัดหมวดอาหารให้ถูกต้อง (เลือกของดีตามหมวด)
// ใช้ Emoji สีจริง 🍎 ผ่าน EmojiSprite, รองรับ Fever + MiniQuest + Difficulty

import Difficulty from '../vr/difficulty.js';
import Emoji from '../vr/emoji-sprite.js';
import { Fever } from '../vr/fever.js';
import MiniQuest from '../vr/miniquest.js';
import { MissionDeck } from '../vr/mission.js';
import { Particles } from '../vr/particles.js';
import { SFX } from '../vr/sfx.js';

// ---------- ข้อมูลพื้นฐาน ----------
// ---------- ข้อมูลพื้นฐาน (updated 20 items per group) ----------
const GROUPS = {
  fruits: [
    '🍎','🍏','🍌','🍇','🍓','🍍','🍉','🍐','🍊','🫐',
    '🥝','🍋','🍒','🍈','🥭','🍑','🍅','🍆','🥥','🍠'
  ],
  veggies: [
    '🥦','🥕','🥬','🌽','🍆','🧄','🧅','🥒','🥔','🍄',
    '🌶️','🍠','🥑','🫑','🥗','🥦','🥬','🍀','🌰','🍋'
  ],
  protein: [
    '🐟','🥚','🥜','🍗','🥩','🍖','🧆','🍤','🦐','🦑',
    '🍢','🍣','🥓','🥩','🍳','🫘','🍛','🍱','🥪','🍙'
  ],
  grains: [
    '🍞','🍚','🥖','🥨','🍙','🍘','🥯','🥐','🍩','🍪',
    '🥞','🧇','🥨','🍰','🍛','🍡','🥟','🍠','🥮','🥖'
  ],
  dairy: [
    '🥛','🧀','🍦','🍨','🍧','🥞','🧈','🍮','🍰','🍩',
    '🥯','🍫','🍪','🧋','🍹','🍨','🍶','🍼','🍯','🍧'
  ],
  water: [
    '💧','🫗','🥤','🧃','☕','🍵','🥛','🧋','🍶','🍹',
    '🍸','🍷','🍺','🧊','🍻','🫖','🥂','🍾','🧴','🧊'
  ]
};

// ---------- กลุ่มของขยะ (JUNK) ----------
const JUNK = [
  '🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰',
  '🍫','🍬','🍭','🥤','🧋','🍹','🍾','🍨','🍧','🍿'
];

const TARGET_ROTATION = ['fruits','veggies','protein','grains','dairy','water'];

const $ = s => document.querySelector(s);
const sample = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

// ---------- ฟังก์ชันช่วย ----------
function setHudText(el, text){
  if(!el) return;
  try {
    if (el.hasAttribute('troika-text'))
      el.setAttribute('troika-text','value',text);
    else if (el.getAttribute('text')!=null)
      el.setAttribute('text',{value:text});
    else el.textContent = text;
  } catch{}
}

function makeLabel(host, text, pos='0 1.7 -1.6'){
  const e=document.createElement('a-entity');
  e.setAttribute('position',pos);
  e.setAttribute('troika-text',`value:${text}; align:center; color:#fff; anchor:center; fontSize:0.08;`);
  host.appendChild(e);
  return e;
}

function labelOf(g){
  const map={fruits:'ผลไม้',veggies:'ผัก',protein:'โปรตีน',grains:'ธัญพืช',dairy:'นม/เนย',water:'น้ำ'};
  return map[g]||g;
}

// ---------- ตัวหลัก ----------
export async function boot({host,duration=60,difficulty='normal',goal=40}={}){

  if(!host){
    const wrap=$('a-scene')||document.body;
    const auto=document.createElement('a-entity');
    auto.id='spawnHost'; wrap.appendChild(auto); host=auto;
  }

  const sfx=new SFX('../assets/audio/');
  await sfx.unlock();
  sfx.attachPageVisibilityAutoMute();

  const scene=$('a-scene')||document.body;
  const fever=new Fever(scene,null);
  const mq=new MiniQuest(
    {tQ1:$('#tQ1'),tQ2:$('#tQ2'),tQ3:$('#tQ3')},
    {coach_start:$('#coach_start'),coach_good:$('#coach_good'),
     coach_warn:$('#coach_warn'),coach_fever:$('#coach_fever'),
     coach_quest:$('#coach_quest'),coach_clear:$('#coach_clear')}
  );
  mq.start(goal);

  const missions=new MissionDeck();
  missions.draw3();

  const diff=new Difficulty();
  diff.set(difficulty);

  const hudTitle=$('#hudTarget')||makeLabel(host,'','0 1.75 -1.6');
  let targetGroup=sample(TARGET_ROTATION);
  setHudText(hudTitle,`เลือกให้ถูกหมวด: ${labelOf(targetGroup)}`);

  // -------- State --------
  let running=true;
  let missionGood=0,score=0,streak=0,combo=0;
  let lastTargetSwitch=0;
  const startAt=performance.now();

  const cfg=diff.scaleForFPS(diff.get(),60,60);
  let rateMs=cfg.rate,lifeMs=cfg.life,sizeFactor=cfg.size;

  // ---------- หมุนหมวด ----------
  function maybeRotate(sec){
    if(sec-lastTargetSwitch>12+Math.random()*6){
      lastTargetSwitch=sec;
      const pool=TARGET_ROTATION.filter(g=>g!==targetGroup);
      targetGroup=sample(pool);
      setHudText(hudTitle,`เลือกให้ถูกหมวด: ${labelOf(targetGroup)}`);
      sfx.playCoach('start');
    }
  }

  // ---------- สปอน ----------
  function spawnOne(){
    if(!running) return;
    const roll=Math.random();
    let kind='correct';
    if(roll>0.62) kind=(roll>0.85)?'junk':'wrong';
    let char='⭐';
    if(kind==='correct') char=sample(GROUPS[targetGroup]);
    else if(kind==='wrong'){
      const others=Object.keys(GROUPS).filter(k=>k!==targetGroup);
      char=sample(GROUPS[sample(others)]);
    } else char=sample(JUNK);

    const el=Emoji.fromChar(char,{size:96,scale:sizeFactor,glow:true,shadow:true});
    const px=(Math.random()*1.4-0.7);
    const py=(Math.random()*0.8+1.0);
    const pz=-(Math.random()*0.6+1.2);
    el.setAttribute('position',`${px} ${py} ${pz}`);
    const ttl=lifeMs;
    const killer=setTimeout(()=>el.remove(),ttl);
    el.addEventListener('click',()=>{clearTimeout(killer);onHit({kind,px,py,pz,el});},{once:true});
    host.appendChild(el);
  }

  // ---------- การคลิก ----------
  function onHit({kind,px,py,pz,el}){
    el.remove();
    if(kind==='correct'){
      missionGood++;score+=10;combo++;streak++;
      sfx.popGood();
      Particles.burst(host,{x:px,y:py,z:pz},'#69f0ae');
      if(streak%6===0) fever.add(8);
      mq.good({score,combo,streak,missionGood});
      if(missionGood>=goal){mq.mission(missionGood);sfx.star();Particles.spark(host,{x:0,y:1.4,z:-1.4});}
    }else{
      score=Math.max(0,score-5);combo=0;streak=0;
      sfx.popBad();Particles.smoke(host,{x:px,y:py,z:pz});mq.junk();
    }
  }

  // ---------- วนเวลา ----------
  const spawnTimer=setInterval(spawnOne,rateMs);
  const tickTimer=setInterval(()=>{
    if(!running) return;
    const sec=Math.floor((performance.now()-startAt)/1000);
    mq.second(); maybeRotate(sec);
  },1000);
  const endTimer=setTimeout(()=>endGame(),duration*1000);

  function endGame(){
    if(!running) return;
    running=false;clearInterval(spawnTimer);clearInterval(tickTimer);clearTimeout(endTimer);
    fever.end(); sfx.playCoach('clear');
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{score,missionGood,goal}}));
  }

  return {
    pause(){running=false;clearInterval(spawnTimer);},
    resume(){if(!running){running=true;setInterval(spawnOne,rateMs);}},
    stop(){endGame();}
  };
}
