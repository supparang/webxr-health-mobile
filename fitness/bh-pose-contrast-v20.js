(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el||!BH.CONFIG)return;
const s=BH.state,e=BH.el;
const RELEASE='20260717-BALANCE-HOLD-HIGH-CONTRAST-FLOW-V20';
const LAST='fitness_balance_hold_contrast_last_v20';
const BANK={
  easy:[
    {id:'E20-LR',steps:['center','left','right','center','left']},
    {id:'E20-RL',steps:['center','right','left','center','right']},
    {id:'E20-LRC',steps:['left','right','center','left','right']}
  ],
  normal:[
    {id:'N20-LR-T',steps:['center','left','right','treeLeft','center','treeRight','right']},
    {id:'N20-RL-T',steps:['center','right','left','treeRight','center','treeLeft','left']},
    {id:'N20-T-LR',steps:['left','right','treeLeft','center','treeRight','left','right']}
  ],
  hard:[
    {id:'H20-LR-A',steps:['center','left','right','treeLeft','airplaneRight','treeRight','boss']},
    {id:'H20-RL-A',steps:['center','right','left','treeRight','airplaneLeft','treeLeft','boss']},
    {id:'H20-A-LR',steps:['left','right','airplaneLeft','center','airplaneRight','treeLeft','boss']}
  ]
};
function getLast(){try{return JSON.parse(sessionStorage.getItem(LAST)||'{}')}catch(_){return {}}}
function choose(level){
  const map=getLast(),list=BANK[level]||BANK.normal,choices=list.filter(x=>x.id!==map[level]);
  const pick=(choices.length?choices:list)[Math.floor(Math.random()*(choices.length||list.length))];
  map[level]=pick.id;try{sessionStorage.setItem(LAST,JSON.stringify(map))}catch(_){}
  s.sequencePatternId=pick.id;s.sequencePatternLevel=level;return pick.steps.slice();
}
Object.keys(BANK).forEach(level=>Object.defineProperty(BH.CONFIG[level],'sequence',{configurable:true,enumerable:true,get(){return choose(level)}}));
BH.HIGH_CONTRAST_BANK=BANK;

function overlay(){
  let n=document.getElementById('bhTransitionCueV20');
  if(n)return n;
  n=document.createElement('div');n.id='bhTransitionCueV20';n.className='bhTransitionCueV20 hidden';
  n.innerHTML='<div class="bhTransitionArrow">↔</div><div class="bhTransitionText">เปลี่ยนท่า</div>';
  e.stage.appendChild(n);return n;
}
function directionFor(key){
  if(key==='left'||key==='treeLeft'||key==='airplaneLeft')return{arrow:'←',text:'ขยับไปทางซ้าย'};
  if(key==='right'||key==='treeRight'||key==='airplaneRight')return{arrow:'→',text:'ขยับไปทางขวา'};
  if(key==='boss'||key==='crystalBoss')return{arrow:'⬆',text:'ยกแขนเป็นรูปตัว V'};
  return{arrow:'●',text:'กลับมายืนตรงกลาง'};
}
const baseSetPoseUI=BH.setPoseUI;
BH.setPoseUI=()=>{
  baseSetPoseUI();
  const key=BH.currentPoseKey?.()||s.currentKey,d=directionFor(key),n=overlay();
  n.querySelector('.bhTransitionArrow').textContent=d.arrow;
  n.querySelector('.bhTransitionText').textContent=d.text;
  n.classList.remove('hidden');
  s.poseTransitionLockUntil=BH.now()+720;
  setTimeout(()=>n.classList.add('hidden'),700);
  if(key==='left')e.poseCue.textContent='เอื้อมแขนซ้ายและเอนลำตัวไปซ้ายให้เห็นชัด เท้ายังอยู่ที่เดิม';
  else if(key==='right')e.poseCue.textContent='เอื้อมแขนขวาและเอนลำตัวไปขวาให้เห็นชัด เท้ายังอยู่ที่เดิม';
};
const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  if(BH.now()<(s.poseTransitionLockUntil||0)){
    r.valid=false;r.transitionPreview=true;r.feedback='👀 ดูลูกศร แล้วเปลี่ยนท่าตามด้านที่กำหนด';
  }
  return r;
};
if(typeof BH.calcSummary==='function'){
  const baseCalc=BH.calcSummary;
  BH.calcSummary=reason=>{const x=baseCalc(reason)||{};x.poseFlowVersion=RELEASE;return x};
}
console.info('[BalanceHold] High-Contrast Pose Flow v20 ready',RELEASE);
})();