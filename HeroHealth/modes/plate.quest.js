import { boot as run } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

export async function boot(cfg = {}) {
  const deck = new MissionDeck().draw3();
  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍍','🍌'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦']
  };
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const ALL=Object.values(GROUPS).flat();
  let round={veg:false,fruit:false,grain:false,protein:false,dairy:false};
  let roundsCleared=0; const goalRounds=2;
  showGoal(`จัดครบ 5 หมู่ ${goalRounds} รอบ — คืบหน้า ${roundsCleared}/${goalRounds}`);

  function judge(ch, s){
    if (ch===STAR){ deck.onStar(); return {good:true,scoreDelta:40}; }
    if (ch===DIA ){ deck.onDiamond(); return {good:true,scoreDelta:80}; }
    if (ch===SHIELD){ return {good:true,scoreDelta:0}; }

    let hit=false;
    for(const k in GROUPS){ if(GROUPS[k].includes(ch)){ round[k]=true; hit=true; break; } }
    if (hit){
      if(Object.values(round).every(Boolean)){ roundsCleared++; round={veg:false,fruit:false,grain:false,protein:false,dairy:false}; showGoal(`จัดครบ 5 หมู่ ${goalRounds} รอบ — คืบหน้า ${roundsCleared}/${goalRounds}`); return {good:true, scoreDelta: 100}; }
      return {good:true, scoreDelta: 22 + s.combo*2};
    } else {
      deck.onJunk();
      return {good:false, scoreDelta:-10};
    }
  }

  const off = listen('hha:score', e=>{
    deck.updateScore(e.detail?.score||0);
    deck.updateCombo(e.detail?.combo||0);
    if (deck._autoAdvance()) showQuest(deck.getCurrent()?.label || 'ครบแล้ว!');
  });

  const g = await run({
    host: cfg.host, difficulty: cfg.difficulty || 'normal', duration: cfg.duration,
    pools:{ good:[...ALL, STAR, DIA, SHIELD], bad:[] }, goodRate:0.85, judge
  });

  return { stop(){off();g.stop();}, pause(){g.pause();deck.pause();}, resume(){deck.resume();g.resume();} };
}
function showGoal(t){ upsert('gl',t); } function showQuest(t){ upsert('ql',`Quest ${t}`); }
function upsert(id,text){ let p=document.getElementById('goalQuestPanel'); if(!p){p=document.createElement('div');p.id='goalQuestPanel';p.style.cssText='position:fixed;left:0;right:0;bottom:8px;padding:8px 14px;z-index:910;color:#e8eefc;font:600 14px system-ui';p.innerHTML='<div id="gl" style="margin-bottom:6px"></div><div id="ql"></div>';document.body.appendChild(p);} const el=document.getElementById(id); if(el) el.textContent=text; }
function listen(n,f){window.addEventListener(n,f);return()=>window.removeEventListener(n,f);}
export default { boot };