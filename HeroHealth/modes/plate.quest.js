// === Healthy Plate — เก็บให้ครบ 5 หมู่/รอบ + Mini Quests ===
import { boot as baseBoot } from '../vr/mode-factory.js';

export async function boot(cfg={}){
  const diff = String(cfg.difficulty||'normal');
  const dur  = Number(cfg.duration||60);

  const G = {
    veg:['🥦','🥕','🥬','🍅','🌽'],
    fruit:['🍎','🍓','🍇','🍊','🍌','🍐'],
    grain:['🍞','🥖','🍚','🍘'],
    protein:['🐟','🍗','🥚','🫘','🥜'],
    dairy:['🥛','🧀','🍦'],
  };
  const ALL = Object.values(G).flat();
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  const goodRate = 0.70;

  // Goal: ครบรอบ (ทั้ง 5 หมู่)
  let roundDone = {veg:false,fruit:false,grain:false,protein:false,dairy:false};
  let rounds=0;
  function roundCleared(){ return Object.values(roundDone).every(Boolean); }
  function postGoal(){
    const got = Object.values(roundDone).filter(Boolean).length;
    window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`เป้า: จัดครบ 5 หมู่ (ได้แล้ว ${got}/5) — รอบที่ ${rounds}`,progress:got,target:5}}));
  }
  postGoal();

  // Mini quests
  const POOL = [
    {id:'round2',label:'จัดครบ 5 หมู่ 2 รอบ', target:2, prog:0, kind:'round'},
    {id:'combo12',label:'คอมโบ 12', target:12, prog:0, kind:'combo'},
    {id:'score450',label:'คะแนน 450+', target:450, prog:0, kind:'score'}
  ];
  let deck = POOL.slice().sort(()=>Math.random()-0.5); deck.length=3; let qIdx=0;
  const postQuest=()=>{const q=deck[qIdx]; window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:`Quest ${qIdx+1}/3 — ${q.label}`, prog:q.prog, target:q.target}}));};
  postQuest();

  function judge(ch, state){
    if(ch===STAR){ return {good:true, scoreDelta:40}; }
    if(ch===DIA){ return {good:true, scoreDelta:80}; }
    if(ch===SHIELD){ return {good:true, scoreDelta:0}; }

    // map ch → group
    let gKey=null;
    for(const k in G){ if(G[k].includes(ch)){ gKey=k; break; } }
    if(!gKey) return {good:false, scoreDelta:-10};

    roundDone[gKey] = true; postGoal();
    if(roundCleared()){
      rounds++; roundDone={veg:false,fruit:false,grain:false,protein:false,dairy:false};
      postGoal();
      const q=deck[qIdx]; if(q&&q.kind==='round'){ q.prog=rounds; postQuest(); if(q.prog>=q.target){ qIdx=Math.min(2,qIdx+1); postQuest(); } }
    }
    return {good:true, scoreDelta: 22 + state.combo*2};
  }

  window.addEventListener('hha:score', e=>{
    const d=e.detail||{}; const q=deck[qIdx]; if(!q) return;
    if(q.kind==='combo'){ q.prog = Math.max(q.prog, d.combo||0); postQuest(); if(q.prog>=q.target){ qIdx=Math.min(2,qIdx+1); postQuest(); } }
    if(q.kind==='score'){ q.prog = Math.max(q.prog, d.score||0); postQuest(); if(q.prog>=q.target){ qIdx=Math.min(2,qIdx+1); postQuest(); } }
  });

  const onEnd=(e)=>{
    window.dispatchEvent(new CustomEvent('hha:quest-summary',{detail:{
      mode:'Healthy Plate',
      score:e.detail?.score||0,
      combo:e.detail?.combo||0,
      goalDone: rounds>=1, // อย่างน้อย 1 รอบ
      questsCleared:qIdx+1, questsTotal:3
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