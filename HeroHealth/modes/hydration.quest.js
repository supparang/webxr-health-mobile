// === Hydration — มี Water Gauge + Goal & Mini Quests ===
import { boot as baseBoot } from '../vr/mode-factory.js';

export async function boot(cfg={}){
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  const GOOD = ['💧','🚰','🥛','🍊','🍋'];
  const BAD  = ['🧋','🥤','🍺','🍹','🧃'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const goodRate = (diff==='easy')?0.72:(diff==='hard')?0.58:0.66;

  // Water system
  let water = 55; // 0..100
  window.dispatchEvent(new CustomEvent('hha:water-ui',{detail:{show:true}}));
  window.dispatchEvent(new CustomEvent('hha:water',{detail:{val:water}}));
  const zone = ()=> (water>=40 && water<=70)?'Balanced':(water>70?'High':'Low');

  // Goal: รักษาให้อยู่ในโซน Balanced อย่างน้อย 20 วินาที
  let goalTarget = 20, goalProg = 0;
  let lastZone = zone();
  // Mini quest pool (10 ใบ → สุ่ม 3)
  const POOL = [
    {id:'combo10', label:'คอมโบ 10', target:10, prog:0, kind:'combo'},
    {id:'balanced15', label:'Balanced 15 วิ', target:15, prog:0, kind:'timerBal'},
    {id:'drink12', label:'เก็บ 💧/🥛 12 ชิ้น', target:12, prog:0, kind:'good'},
    {id:'avoid5', label:'หลีกของหวาน 5 ครั้ง', target:5, prog:0, kind:'avoid'},
    {id:'star2', label:'เก็บ ⭐ 2', target:2, prog:0, kind:'star'},
    {id:'dia1', label:'เก็บ 💎 1', target:1, prog:0, kind:'diamond'},
    {id:'combo15', label:'คอมโบ 15', target:15, prog:0, kind:'combo'},
    {id:'high5', label:'ขึ้น High 5 ครั้ง', target:5, prog:0, kind:'high'},
    {id:'low0', label:'ไม่ตก Low 10 วิ', target:10, prog:0, kind:'noLow'},
    {id:'score350', label:'คะแนน 350+', target:350, prog:0, kind:'score'}
  ];
  function draw3(){
    const a = POOL.slice().sort(()=>Math.random()-0.5).slice(0,3);
    a.forEach(q=>q.prog=0);
    return a;
  }
  let deck = draw3(); let qIdx = 0;
  function postQuest(){
    const q = deck[qIdx];
    window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:`Quest ${qIdx+1}/3 — ${q.label}`, prog:q.prog, target:q.target}}));
  }
  window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`เป้า: อยู่โซน Balanced ให้ครบ ${goalTarget} วิ — ${goalProg}/${goalTarget}`,progress:goalProg,target:goalTarget}}));
  postQuest();

  // per-second timer: นับ goal + quests แบบเวลา
  const secId = setInterval(()=>{
    const z = zone();
    if(z==='Balanced'){ goalProg++; }
    const q = deck[qIdx];
    if(q){
      if(q.kind==='timerBal' && z==='Balanced'){ q.prog++; }
      if(q.kind==='noLow' && z!=='Low'){ q.prog++; }
      postQuest();
      if(q.prog>=q.target){ qIdx++; if(qIdx>=3){ deck = draw3(); qIdx=0; } postQuest(); }
    }
    window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`เป้า: อยู่โซน Balanced ให้ครบ ${goalTarget} วิ — ${goalProg}/${goalTarget}`,progress:goalProg,target:goalTarget}}));
  },1000);

  let comboMax=0, highCount=0;

  function judge(ch, state){
    // specials
    if(ch===STAR){ const q=deck[qIdx]; if(q&&q.kind==='star'){ q.prog++; postQuest(); } return {good:true, scoreDelta:40}; }
    if(ch===DIA){  const q=deck[qIdx]; if(q&&q.kind==='diamond'){ q.prog++; postQuest(); } return {good:true, scoreDelta:80}; }
    if(ch===SHIELD){ return {good:true, scoreDelta:0}; }

    const good = GOOD.includes(ch);
    if(good){
      water = Math.min(100, water+6);
      window.dispatchEvent(new CustomEvent('hha:water',{detail:{val:water}}));
      const q=deck[qIdx]; if(q&&q.kind==='good'){ q.prog++; postQuest(); }
      comboMax = Math.max(comboMax, state.combo+1);
      return {good:true, scoreDelta: 20 + state.combo*2};
    } else {
      // bad drink: ถ้าอยู่ High → +5 คะแนน, ไม่งั้น -20
      let delta = (zone()==='High')? 5 : -20;
      water = Math.max(0, water-8);
      window.dispatchEvent(new CustomEvent('hha:water',{detail:{val:water}}));
      const z = zone();
      if(z==='High' && lastZone!=='High'){ highCount++; const q=deck[qIdx]; if(q&&q.kind==='high'){ q.prog++; postQuest(); } }
      lastZone = z;
      return {good:false, scoreDelta: delta};
    }
  }

  // sync combo & score quests
  window.addEventListener('hha:score', e=>{
    const d=e.detail||{};
    comboMax = Math.max(comboMax, d.combo||0);
    const q=deck[qIdx];
    if(!q) return;
    if(q.kind==='combo'){ q.prog = Math.max(q.prog, comboMax); postQuest(); }
    if(q.kind==='score'){ q.prog = Math.max(q.prog, d.score||0); postQuest(); }
    if(q.prog>=q.target){ qIdx++; if(qIdx>=3){ deck=draw3(); qIdx=0; } postQuest(); }
  });

  const onEnd = (e)=>{
    clearInterval(secId);
    window.dispatchEvent(new CustomEvent('hha:water-ui',{detail:{show:false}}));
    window.dispatchEvent(new CustomEvent('hha:quest-summary',{detail:{
      mode:'Hydration',
      score:e.detail?.score||0,
      combo:e.detail?.combo||0,
      goalDone: goalProg>=goalTarget,
      questsCleared:3, questsTotal:3
    }}));
    window.removeEventListener('hha:end', onEnd);
  };
  window.addEventListener('hha:end', onEnd, {once:true});

  return baseBoot({
    difficulty: diff,
    duration: dur,
    goodRate,
    pools:{ good:GOOD, bad:BAD, star:[STAR], diamond:[DIA], shield:[SHIELD] },
    judge
  });
}

export default { boot };