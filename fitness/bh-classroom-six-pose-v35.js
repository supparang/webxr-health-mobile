(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el||!BH.CONFIG)return;

const RELEASE='20260809-BALANCE-CLASSROOM-PROGRESSIVE-ROTATION-V56-BOSS-FAIR';
const s=BH.state;
const e=BH.el;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

/*
 * HeroHealth Grade 5 classroom policy
 * - No student-facing Easy / Normal / Hard selection.
 * - Every student performs the SAME six-pose set.
 * - Pose 1 is a fixed warm-up and Pose 6 is a fixed boss.
 * - The four middle poses use deterministic balanced rotation from studentId only.
 * - The same student receives the same order on every replay.
 * - Difficulty progresses by pose position (hold / pose / safe thresholds), not by a level setting.
 */
const POSE_LABELS={
  center:'sky_shield_warmup',
  left:'star_reach_left',
  right:'star_reach_right',
  treeLeft:'tree_balance_left_safe',
  treeRight:'tree_balance_right_safe',
  boss:'crystal_guardian_boss'
};

const MIDDLE=['left','right','treeLeft','treeRight'];
const ROTATIONS=[
  ['left','right','treeLeft','treeRight'],
  ['right','left','treeRight','treeLeft'],
  ['left','treeLeft','right','treeRight'],
  ['right','treeRight','left','treeLeft'],
  ['treeLeft','left','treeRight','right'],
  ['treeRight','right','treeLeft','left'],
  ['left','treeRight','right','treeLeft'],
  ['right','treeLeft','left','treeRight'],
  ['treeLeft','right','left','treeRight'],
  ['treeRight','left','right','treeLeft'],
  ['treeLeft','treeRight','left','right'],
  ['treeRight','treeLeft','right','left']
].map((steps,index)=>({id:`P56-R${String(index+1).padStart(2,'0')}`,steps}));

const PROGRESSION=[
  {stage:'warmup',hold:1600,pose:60,safe:46,gate:220,label:'Warm-up'},
  {stage:'middle-1',hold:1800,pose:62,safe:48,gate:230,label:'Challenge 1'},
  {stage:'middle-2',hold:1900,pose:64,safe:49,gate:240,label:'Challenge 2'},
  {stage:'middle-3',hold:2050,pose:65,safe:50,gate:250,label:'Challenge 3'},
  {stage:'middle-4',hold:2200,pose:66,safe:51,gate:260,label:'Challenge 4'},
  {stage:'boss',hold:2300,pose:64,safe:54,gate:260,label:'Boss'}
];

function stableHash(text){
  let h=2166136261;
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}
function studentIdentity(){
  const id=String(
    q.get('studentId')||q.get('sid')||q.get('pid')||
    s.ctx?.studentId||s.ctx?.playerId||''
  ).trim();
  return id||'anonymous-classroom';
}
function chooseRotation(){
  const identity=studentIdentity();
  const selected=ROTATIONS[stableHash(identity)%ROTATIONS.length]||ROTATIONS[0];
  const steps=['center',...selected.steps,'boss'];
  s.sequencePatternId=selected.id;
  s.sequenceProfile='fixed-warmup-balanced-middle-fixed-boss';
  s.sequenceBankVersion=RELEASE;
  s.sequenceStudentKeyHash=stableHash(identity).toString(16);
  s.sequenceDeterministic=true;
  return steps;
}
function currentProfile(){
  const index=Math.max(0,Math.min(PROGRESSION.length-1,Number(s.index)||0));
  return PROGRESSION[index];
}

if(e.difficulty){
  e.difficulty.value='easy';
  e.difficulty.disabled=true;
  e.difficulty.setAttribute('aria-hidden','true');
  e.difficulty.dataset.classroomPolicy='single-progressive-profile';
}

Object.defineProperty(BH.CONFIG.easy,'sequence',{
  configurable:true,
  enumerable:true,
  get(){return chooseRotation()}
});
for(const [property,key] of [['hold','hold'],['poseThreshold','pose'],['safeThreshold','safe'],['gateMs','gate']]){
  Object.defineProperty(BH.CONFIG.easy,property,{
    configurable:true,
    enumerable:true,
    get(){return currentProfile()[key]}
  });
}
Object.assign(BH.CONFIG.easy,{
  confidence:.46,
  graceMs:760,
  lostDebounceMs:1000,
  assistAfterMs:6500,
  maxAssist:2
});

function deterministicBossKey(){
  return stableHash(studentIdentity()+'|boss')%2===0?'left':'right';
}
if(typeof BH.resetRoundState==='function'){
  const baseResetRoundState=BH.resetRoundState;
  BH.resetRoundState=()=>{
    const result=baseResetRoundState();
    s.bossKey=deterministicBossKey();
    return result;
  };
}
if(typeof BH.completePose==='function'){
  const baseCompletePose=BH.completePose;
  BH.completePose=(ev,required)=>{
    const result=baseCompletePose(ev,required);
    if(s.currentKey==='boss')s.bossKey=deterministicBossKey();
    return result;
  };
}

const baseSetPoseUI=typeof BH.setPoseUI==='function'?BH.setPoseUI:null;
if(baseSetPoseUI){
  BH.setPoseUI=()=>{
    const result=baseSetPoseUI();
    const p=currentProfile();
    if(e.coachSub)e.coachSub.textContent=`${p.label} • ค้าง ${Math.round(p.hold/100)/10} วินาที • ท่า ${Math.min((Number(s.index)||0)+1,6)}/6`;
    return result;
  };
}

const baseCalc=typeof BH.calcSummary==='function'?BH.calcSummary:null;
if(baseCalc){
  BH.calcSummary=reason=>{
    const summary=baseCalc(reason)||{};
    const order=Array.isArray(s.sequence)?s.sequence.slice():[];
    summary.classroomSequenceVersion=RELEASE;
    summary.classroomSequenceId=s.sequencePatternId||'';
    summary.classroomSequenceBankSize=ROTATIONS.length;
    summary.classroomPoseCount=6;
    summary.classroomPoseOrder=order;
    summary.classroomPoseLabels=order.map(key=>POSE_LABELS[key]||key);
    summary.classroomRandomization='deterministic-balanced-rotation-by-studentId';
    summary.classroomReplayOrderStable=true;
    summary.classroomStudentHash=s.sequenceStudentKeyHash||'';
    summary.classroomPoseSet='same-six-poses-for-all-students';
    summary.classroomProgression='fixed-warmup -> four-balanced-middle-poses -> fixed-boss';
    summary.classroomLevelSelection=false;
    summary.classroomDifficultyPolicy='single-progressive-profile';
    summary.classroomProgressionProfile=PROGRESSION.map((p,index)=>({index:index+1,...p}));
    summary.classroomBossDirection=s.bossKey||deterministicBossKey();
    return summary;
  };
}

BH.CLASSROOM_SEQUENCE={
  release:RELEASE,
  id:'CLASSROOM-V56-DETERMINISTIC-PROGRESSIVE-BOSS-FAIR',
  count:6,
  bankSize:ROTATIONS.length,
  bank:ROTATIONS.map(item=>({id:item.id,steps:['center',...item.steps,'boss']})),
  fixedWarmup:'center',
  middlePoseSet:MIDDLE.slice(),
  fixedBoss:'boss',
  samePoseSetForAll:true,
  deterministicByStudentId:true,
  replayOrderStable:true,
  levelSelection:false,
  progression:PROGRESSION.map((p,index)=>({index:index+1,...p})),
  safetyProfile:'grade5-low-lift-balanced-detection',
  poseSet:Object.keys(POSE_LABELS)
};

document.documentElement.dataset.bhClassroomSequence='v56-progressive-boss-fair';
document.documentElement.dataset.bhLevelSelection='off';
if(e.coachSub)e.coachSub.textContent='ภารกิจ 6 ท่า • เริ่มง่ายและท้าทายขึ้นจนถึง Boss';
console.info('[BalanceHold] Classroom Progressive Rotation V56 ready',BH.CLASSROOM_SEQUENCE);
})();