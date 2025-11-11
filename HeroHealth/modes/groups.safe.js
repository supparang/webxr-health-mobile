import { boot as run } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const deck = new MissionDeck().draw3();
  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍌','🍍','🥝','🍐','🍉'],
    grain:['🍞','🥖','🥯','🍚','🍙','🍘'],
    protein:['🐟','🍗','🍖','🥚','🫘','🥜'],
    dairy:['🥛','🧀']
  };
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const keys = Object.keys(GROUPS);
  let target = keys[(Math.random()*keys.length)|0];
  let goalSize=1, ok=0;

  const ALL = keys.flatMap(k=>GROUPS[k]);
  showGoal(`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize} — คืบหน้า ${ok}/${goalSize}`);

  function newGoal(){
    target = keys[(Math.random()*keys.length)|0];
    goalSize = Math.min(3, goalSize+1);
    ok=0;
    showGoal(`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize} — คืบหน้า ${ok}/${goalSize}`);
  }

  function judge(ch, s){
    if (ch===STAR){ deck.onStar(); return {good:true, scoreDelta:40}; }
    if (ch===DIA ){ deck.onDiamond(); return {good:true, scoreDelta:80}; }
    if (ch===SHIELD){ return {good:true, scoreDelta:0}; }

    const inTarget = GROUPS[target].includes(ch);
    if (inTarget){
      ok++; deck.onGood();
      showGoal(`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalSize} — คืบหน้า ${ok}/${goalSize}`);
      if (ok>=goalSize) newGoal();
      return {good:true, scoreDelta: 25 + s.combo*2};
    } else {
      deck.onJunk();
      return {good:false, scoreDelta: -12};
    }
  }

  const off = listen('hha:score', e=>{
    deck.updateScore(e.detail?.score||0);
    deck.updateCombo(e.detail?.combo||0);
    if (deck._autoAdvance()) showQuest(deck.getCurrent()?.label || 'ครบแล้ว!');
  });

  const g = await run({
    host: cfg.host,
    difficulty: cfg.difficulty || 'normal',
    duration: cfg.duration,
    pools: { good:[...ALL, STAR, DIA, SHIELD], bad:[] }, // เราใช้ judge แยกใน/นอกเป้า
    goodRate: 0.85,
    judge
  });

  return { stop(){off();g.stop();}, pause(){g.pause();deck.pause();}, resume(){deck.resume();g.resume();} };
}

function showGoal(t){ upsert('gl',t); }
function showQuest(t){ upsert('ql',`Quest ${t}`); }
function upsert(id, text){
  let p=document.getElementById('goalQuestPanel'); if(!p){p=document.createElement('div');p.id='goalQuestPanel';p.style.cssText='position:fixed;left:0;right:0;bottom:8px;padding:8px 14px;z-index:910;color:#e8eefc;font:600 14px system-ui';p.innerHTML='<div id="gl" style="margin-bottom:6px"></div><div id="ql"></div>';document.body.appendChild(p);}
  const el=document.getElementById(id); if(el) el.textContent=text;
}
function listen(n,f){window.addEventListener(n,f);return()=>window.removeEventListener(n,f);}
export default { boot };