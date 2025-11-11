// === Food Groups — เลือกให้ถูกหมู่เป้าหมาย, มี Goal + Mini ===
import { boot as baseBoot } from '../vr/mode-factory.js';

export async function boot(cfg={}){
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  const GROUPS = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍌','🍐','🍉'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦']
  };
  const ALL = Object.values(GROUPS).flat();
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const goodRate = 0.70;

  // เป้าหมู่สุ่มทีละรอบ
  const keys = Object.keys(GROUPS);
  let target = keys[(Math.random()*keys.length)|0];
  let goalTarget = 8, goalProg = 0; // เก็บของในหมู่เป้าให้ครบ
  function postGoal(){
    window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`เป้า: เลือกให้ถูกหมู่ (${target.toUpperCase()}) × ${goalTarget} — ${goalProg}/${goalTarget}`,progress:goalProg,target:goalTarget}}));
  }
  postGoal();

  // mini quests (สุ่ม 3)
  const POOL = [
    {id:'in10',label:'เลือกให้ถูกหมู่ 10 ชิ้น', target:10, prog:0, kind:'in'},
    {id:'combo12',label:'คอมโบ 12', target:12, prog:0, kind:'combo'},
    {id:'score400',label:'คะแนน 400+', target:400, prog:0, kind:'score'},
  ];
  let deck = POOL.slice().sort(()=>Math.random()-0.5);
  deck.length=3; let qIdx=0;
  function postQuest(){ const q=deck[qIdx]; window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:`Quest ${qIdx+1}/3 — ${q.label}`, prog:q.prog, target:q.target}})); }
  postQuest();

  function judge(ch, state){
    if(ch===STAR){ return {good:true, scoreDelta:40}; }
    if(ch===DIA){ return {good:true, scoreDelta:80}; }
    if(ch===SHIELD){ return {good:true, scoreDelta:0}; }
    const inTarget = GROUPS[target].includes(ch);
    if(inTarget){
      goalProg++; postGoal();
      const q=deck[qIdx]; if(q && q.kind==='in'){ q.prog++; postQuest(); if(q.prog>=q.target){ qIdx=Math.min(2,qIdx+1); postQuest(); } }
      return {good:true, scoreDelta: 25 + state.combo*2};
    }else{
      return {good:false, scoreDelta:-12};
    }
  }

  window.addEventListener('hha:score', e=>{
    const d=e.detail||{}; const q=deck[qIdx]; if(!q) return;
    if(q.kind==='combo'){ q.prog = Math.max(q.prog, d.combo||0); postQuest(); if(q.prog>=q.target){ qIdx=Math.min(2,qIdx+1); postQuest(); } }
    if(q.kind==='score'){ q.prog = Math.max(q.prog, d.score||0); postQuest(); if(q.prog>=q.target){ qIdx=Math.min(2,qIdx+1); postQuest(); } }
  });

  const onEnd=(e)=>{
    window.dispatchEvent(new CustomEvent('hha:quest-summary',{detail:{
      mode:'Food Groups',
      score:e.detail?.score||0,
      combo:e.detail?.combo||0,
      goalDone: goalProg>=goalTarget,
      questsCleared: qIdx+1, questsTotal:3
    }}));
    window.removeEventListener('hha:end', onEnd);
  };
  window.addEventListener('hha:end', onEnd, {once:true});

  return baseBoot({
    difficulty: diff,
    duration: dur,
    goodRate,
    pools:{ good:ALL, bad:[], star:[STAR], diamond:[DIA], shield:[SHIELD] },
    judge
  });
}

export default { boot };