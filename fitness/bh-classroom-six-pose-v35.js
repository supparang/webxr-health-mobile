(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el||!BH.CONFIG)return;

const RELEASE='20260731-BALANCE-CLASSROOM-BALANCED-BANK-V47';
const STORAGE_KEY='bh_classroom_sequence_last_v47';
const s=BH.state;
const e=BH.el;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

/*
 * Classroom policy
 * - Six poses per round only, to fit a 10-minute station and reduce mobile load.
 * - Uses only pose evaluators already validated in production.
 * - Twelve balanced sequence forms provide variety without changing task difficulty.
 * - Every round contains: center, left, right, tree-left, tree-right and boss.
 */
const POSE_LABELS={
  center:'sky_shield',
  left:'star_reach_left',
  right:'star_reach_right',
  treeLeft:'tree_balance_left_safe',
  treeRight:'tree_balance_right_safe',
  boss:'crystal_guardian'
};

const BANK=[
  {id:'C47-A01',steps:['center','left','right','treeLeft','treeRight','boss']},
  {id:'C47-A02',steps:['center','right','left','treeRight','treeLeft','boss']},
  {id:'C47-A03',steps:['center','left','treeLeft','right','treeRight','boss']},
  {id:'C47-A04',steps:['center','right','treeRight','left','treeLeft','boss']},
  {id:'C47-B01',steps:['center','treeLeft','left','treeRight','right','boss']},
  {id:'C47-B02',steps:['center','treeRight','right','treeLeft','left','boss']},
  {id:'C47-B03',steps:['center','left','treeRight','right','treeLeft','boss']},
  {id:'C47-B04',steps:['center','right','treeLeft','left','treeRight','boss']},
  {id:'C47-C01',steps:['center','treeLeft','right','left','treeRight','boss']},
  {id:'C47-C02',steps:['center','treeRight','left','right','treeLeft','boss']},
  {id:'C47-C03',steps:['center','treeLeft','treeRight','left','right','boss']},
  {id:'C47-C04',steps:['center','treeRight','treeLeft','right','left','boss']}
];

function getLastId(){
  try{return String(sessionStorage.getItem(STORAGE_KEY)||'')}catch(_){return ''}
}
function saveLastId(id){
  try{sessionStorage.setItem(STORAGE_KEY,id)}catch(_){}
}
function stableHash(text){
  let h=2166136261;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}
function identitySeed(){
  const params=new URLSearchParams(location.search);
  return [
    params.get('studentId')||params.get('sid')||params.get('pid')||'',
    params.get('group')||params.get('section')||'',
    s.roundId||'',
    Date.now().toString().slice(0,-4)
  ].join('|');
}
function chooseSequence(){
  const previous=getLastId();
  const available=BANK.filter(item=>item.id!==previous);
  const pool=available.length?available:BANK;
  const index=stableHash(identitySeed())%pool.length;
  const selected=pool[index]||pool[0]||BANK[0];
  saveLastId(selected.id);
  s.sequencePatternId=selected.id;
  s.sequencePatternLevel='easy';
  s.sequenceProfile='balanced-six-from-validated-pose-set';
  s.sequenceBankVersion=RELEASE;
  return selected.steps.slice();
}

Object.defineProperty(BH.CONFIG.easy,'sequence',{
  configurable:true,
  enumerable:true,
  get(){return chooseSequence()}
});

Object.assign(BH.CONFIG.easy,{
  hold:1150,
  gateMs:200,
  graceMs:1100,
  lostDebounceMs:1350,
  assistAfterMs:4000,
  maxAssist:3
});

const baseCalc=typeof BH.calcSummary==='function'?BH.calcSummary:null;
if(baseCalc){
  BH.calcSummary=reason=>{
    const summary=baseCalc(reason)||{};
    const order=Array.isArray(s.sequence)?s.sequence.slice():[];
    summary.classroomSequenceVersion=RELEASE;
    summary.classroomSequenceId=s.sequencePatternId||'';
    summary.classroomSequenceBankSize=BANK.length;
    summary.classroomPoseCount=6;
    summary.classroomPoseOrder=order;
    summary.classroomPoseLabels=order.map(key=>POSE_LABELS[key]||key);
    summary.classroomRandomization='balanced-form-without-immediate-repeat';
    summary.classroomPoseSet='six-validated-production-poses';
    summary.holdProfile='easy:1150|normal:1450|hard:1750';
    return summary;
  };
}

BH.CLASSROOM_SEQUENCE={
  release:RELEASE,
  id:'CLASSROOM-V47-BALANCED-12-FORMS',
  count:6,
  bankSize:BANK.length,
  bank:BANK.map(item=>({id:item.id,steps:item.steps.slice()})),
  fixedOrder:false,
  balanced:true,
  immediateRepeatBlocked:true,
  safetyProfile:'grade5-low-lift',
  poseSet:Object.keys(POSE_LABELS)
};

if(e.coachSub)e.coachSub.textContent='โหมดห้องเรียน • สุ่มสมดุล 6 ท่า • Easy • Safe Mode';

console.info('[BalanceHold] Balanced Classroom Sequence Bank v47 ready',BH.CLASSROOM_SEQUENCE);
})();
