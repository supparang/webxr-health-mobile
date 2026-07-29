(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el||!BH.CONFIG)return;

const RELEASE='20260729-BALANCE-CLASSROOM-SIX-POSE-V35';
const s=BH.state;
const e=BH.el;
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

// Fixed order for classroom comparability: six missions, six meaningful movement targets.
const CLASSROOM_SEQUENCE=[
  'center',
  'left',
  'right',
  'treeLeft',
  'treeRight',
  'boss'
];

Object.defineProperty(BH.CONFIG.easy,'sequence',{
  configurable:true,
  enumerable:true,
  get(){
    s.sequencePatternId='CLASSROOM-V35-6POSE-FIXED';
    s.sequencePatternLevel='easy';
    s.sequenceProfile='six-distinct-safe-poses';
    return CLASSROOM_SEQUENCE.slice();
  }
});

// Keep the six-pose round comfortably inside the 60-second classroom station.
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
    summary.classroomSequenceVersion=RELEASE;
    summary.classroomSequenceId='CLASSROOM-V35-6POSE-FIXED';
    summary.classroomPoseCount=6;
    summary.classroomPoseOrder=CLASSROOM_SEQUENCE.slice();
    summary.classroomPoseLabels=[
      'sky_shield',
      'star_reach_left',
      'star_reach_right',
      'tree_balance_left_safe',
      'tree_balance_right_safe',
      'crystal_guardian'
    ];
    summary.holdProfile='easy:1150|normal:1450|hard:1750';
    return summary;
  };
}

// Make the current classroom profile explicit for QA and analytics.
BH.CLASSROOM_SEQUENCE={
  release:RELEASE,
  id:'CLASSROOM-V35-6POSE-FIXED',
  count:6,
  steps:CLASSROOM_SEQUENCE.slice(),
  fixedOrder:true,
  safetyProfile:'grade5-low-lift'
};

if(e.coachSub){
  e.coachSub.textContent='โหมดห้องเรียน • 6 ท่า • Easy • Safe Mode';
}

console.info('[BalanceHold] Classroom Six Pose v35 ready',BH.CLASSROOM_SEQUENCE);
})();
