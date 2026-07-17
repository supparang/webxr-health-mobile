(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el||!BH.CONFIG)return;
const s=BH.state,e=BH.el,C=BH.clamp;
const RELEASE='20260717-BALANCE-HOLD-EIGHT-POSE-V17';

BH.RELEASE_VERSION=RELEASE;
BH.POSES={
  center:{name:'🛡️ Sky Shield',cue:'ยืนตรง กางแขนระดับไหล่ เท้าทั้งสองอยู่ใน Safe Zone',ghost:'center',tier:'foundation'},
  left:{name:'⭐ Star Reach • LEFT',cue:'เอื้อมและเอนซ้ายเล็กน้อย โดยไม่ยกเท้า',ghost:'left',tier:'foundation'},
  right:{name:'⭐ Star Reach • RIGHT',cue:'เอื้อมและเอนขวาเล็กน้อย โดยไม่ยกเท้า',ghost:'right',tier:'foundation'},
  treeLeft:{name:'🌳 Tree Balance • LEFT',cue:'ลงน้ำหนักขาซ้าย ยกเท้าขวาต่ำ ๆ หรือแตะปลายเท้าเพื่อความปลอดภัย',ghost:'tree-left',tier:'intermediate'},
  treeRight:{name:'🌳 Tree Balance • RIGHT',cue:'ลงน้ำหนักขาขวา ยกเท้าซ้ายต่ำ ๆ หรือแตะปลายเท้าเพื่อความปลอดภัย',ghost:'tree-right',tier:'intermediate'},
  airplaneLeft:{name:'✈️ Airplane • LEFT',cue:'ลงน้ำหนักขาซ้าย กางแขนและเอนตัวไปหน้าเพียงเล็กน้อย',ghost:'airplane-left',tier:'advanced'},
  airplaneRight:{name:'✈️ Airplane • RIGHT',cue:'ลงน้ำหนักขาขวา กางแขนและเอนตัวไปหน้าเพียงเล็กน้อย',ghost:'airplane-right',tier:'advanced'},
  crystalBoss:{name:'💎 Crystal Guardian • BOSS',cue:'กางแขนเฉียงขึ้น ยืนมั่นคง และค้างท่าปิดภารกิจ',ghost:'crystal-boss',tier:'boss'},
  boss:{name:'💎 Crystal Guardian • BOSS',cue:'กางแขนเฉียงขึ้น ยืนมั่นคง และค้างท่าปิดภารกิจ',ghost:'crystal-boss',tier:'boss'}
};

const BANK={
  easy:[
    {id:'E17-A',steps:['center','left','center','right','center']},
    {id:'E17-B',steps:['center','right','center','left','center']},
    {id:'E17-C',steps:['left','center','right','center','center']}
  ],
  normal:[
    {id:'N17-A',steps:['center','left','center','treeLeft','center','right','treeRight']},
    {id:'N17-B',steps:['center','right','center','treeRight','center','left','treeLeft']},
    {id:'N17-C',steps:['left','center','treeLeft','center','right','center','treeRight']}
  ],
  hard:[
    {id:'H17-A',steps:['center','treeLeft','airplaneLeft','center','treeRight','airplaneRight','boss']},
    {id:'H17-B',steps:['center','airplaneRight','treeRight','center','airplaneLeft','treeLeft','boss']},
    {id:'H17-C',steps:['left','treeLeft','airplaneLeft','center','right','treeRight','boss']}
  ]
};
const LAST='fitness_balance_hold_eight_pose_last_v17';
function last(){try{return JSON.parse(sessionStorage.getItem(LAST)||'{}')}catch(_){return {}}}
function choose(level){
  const map=last(),list=BANK[level]||BANK.normal,choices=list.filter(x=>x.id!==map[level]);
  const pick=(choices.length?choices:list)[Math.floor(Math.random()*(choices.length||list.length))];
  map[level]=pick.id;try{sessionStorage.setItem(LAST,JSON.stringify(map))}catch(_){}
  s.sequencePatternId=pick.id;s.sequencePatternLevel=level;return pick.steps.slice();
}
Object.keys(BANK).forEach(level=>Object.defineProperty(BH.CONFIG[level],'sequence',{configurable:true,enumerable:true,get(){return choose(level)}}));
BH.EIGHT_POSE_BANK=BANK;
BH.currentPoseKey=()=>s.currentKey==='boss'?'crystalBoss':s.currentKey;

function scoreNear(value,target,tolerance){return C(1-Math.abs(value-target)/Math.max(.001,tolerance),0,1)}
function angle(a,b,c){
  const ab={x:a.x-b.x,y:a.y-b.y},cb={x:c.x-b.x,y:c.y-b.y};
  const dot=ab.x*cb.x+ab.y*cb.y,den=Math.max(.0001,Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y));
  return Math.acos(C(dot/den,-1,1))*180/Math.PI;
}
function avg(arr){return arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length)}

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  if(['center','left','right'].includes(key))return baseEvaluate(lm,key);
  const cfg=BH.CONFIG[e.difficulty.value]||BH.CONFIG.normal;
  if(!lm||!s.calibration||!BH.poseFresh())return{valid:false,tracked:false,confidence:0,pose:0,stability:0,control:0,safe:0,feedback:'ยังไม่เห็นทั้งตัว',feetStable:false,movementSpeed:0};

  const conf=BH.keyConfidence(lm),shoulders=BH.mid(lm[11],lm[12]),hips=BH.mid(lm[23],lm[24]);
  const ankles=BH.mid(lm[27],lm[28]),shW=Math.max(.04,BH.dist(lm[11],lm[12]));
  const shoulderLevel=Math.abs(lm[11].y-lm[12].y),armLevel=(Math.abs(lm[15].y-lm[11].y)+Math.abs(lm[16].y-lm[12].y))/2;
  const leftExt=(lm[11].x-lm[15].x)/shW,rightExt=(lm[16].x-lm[12].x)/shW;
  const torsoAngle=BH.angleLine(shoulders,hips),torsoTilt=Math.abs(torsoAngle-90);
  const hipShift=(hips.x-s.calibration.center.x)/Math.max(.05,s.calibration.shoulderWidth);
  const ankleShift=BH.dist(ankles,s.calibration.ankleMid)/Math.max(.05,s.calibration.shoulderWidth);
  const leftKnee=angle(lm[23],lm[25],lm[27]),rightKnee=angle(lm[24],lm[26],lm[28]);
  const leftFootLift=(s.calibration.ankleL.y-lm[27].y)/Math.max(.2,s.calibration.bodyHeight);
  const rightFootLift=(s.calibration.ankleR.y-lm[28].y)/Math.max(.2,s.calibration.bodyHeight);
  const leftSupport=Math.abs(lm[27].x-s.calibration.ankleL.x)/Math.max(.05,s.calibration.shoulderWidth);
  const rightSupport=Math.abs(lm[28].x-s.calibration.ankleR.x)/Math.max(.05,s.calibration.shoulderWidth);
  const tracked=conf>=Math.max(.35,cfg.confidence-.12);

  let checks=[],feetStable=true,feedback='ยอดเยี่ยม ค้างไว้';
  if(key==='treeLeft'){
    feetStable=leftSupport<.65&&lm[27].v>.34;
    checks=[C((rightFootLift-.015)/.12,0,1),C((150-rightKnee)/55,0,1),scoreNear(leftKnee,174,24),C(1-Math.abs(hipShift)/.72,0,1),C(1-torsoTilt/20,0,1),C(1-shoulderLevel/.12,0,1)];
    if(rightFootLift<.012)feedback='ยกเท้าขวาขึ้นเล็กน้อย หรือแตะปลายเท้าไว้';
    else if(!feetStable)feedback='วางขาซ้ายให้อยู่ใน Safe Zone';
  }else if(key==='treeRight'){
    feetStable=rightSupport<.65&&lm[28].v>.34;
    checks=[C((leftFootLift-.015)/.12,0,1),C((150-leftKnee)/55,0,1),scoreNear(rightKnee,174,24),C(1-Math.abs(hipShift)/.72,0,1),C(1-torsoTilt/20,0,1),C(1-shoulderLevel/.12,0,1)];
    if(leftFootLift<.012)feedback='ยกเท้าซ้ายขึ้นเล็กน้อย หรือแตะปลายเท้าไว้';
    else if(!feetStable)feedback='วางขาขวาให้อยู่ใน Safe Zone';
  }else if(key==='airplaneLeft'){
    feetStable=leftSupport<.72&&lm[27].v>.34;
    checks=[C((rightFootLift-.025)/.16,0,1),scoreNear(leftKnee,170,28),C(1-armLevel/.22,0,1),C((leftExt-.50)/.46,0,1),C((rightExt-.50)/.46,0,1),C((torsoTilt-4)/25,0,1),C(1-Math.abs(hipShift)/.82,0,1)];
    if(rightFootLift<.02)feedback='เลื่อนเท้าขวาไปด้านหลังและยกต่ำ ๆ';
    else if(armLevel>.28)feedback='กางแขนให้อยู่ใกล้ระดับไหล่';
    else if(!feetStable)feedback='รักษาน้ำหนักบนขาซ้าย';
  }else if(key==='airplaneRight'){
    feetStable=rightSupport<.72&&lm[28].v>.34;
    checks=[C((leftFootLift-.025)/.16,0,1),scoreNear(rightKnee,170,28),C(1-armLevel/.22,0,1),C((leftExt-.50)/.46,0,1),C((rightExt-.50)/.46,0,1),C((torsoTilt-4)/25,0,1),C(1-Math.abs(hipShift)/.82,0,1)];
    if(leftFootLift<.02)feedback='เลื่อนเท้าซ้ายไปด้านหลังและยกต่ำ ๆ';
    else if(armLevel>.28)feedback='กางแขนให้อยู่ใกล้ระดับไหล่';
    else if(!feetStable)feedback='รักษาน้ำหนักบนขาขวา';
  }else{
    const handsUp=((lm[11].y-lm[15].y)+(lm[12].y-lm[16].y))/2;
    const spread=BH.dist(lm[27],lm[28])/Math.max(.05,s.calibration.ankleSpread);
    feetStable=ankleShift<.70&&spread>.55&&spread<1.9&&lm[27].v>.32&&lm[28].v>.32;
    checks=[C((handsUp-.05)/.22,0,1),C((leftExt-.34)/.56,0,1),C((rightExt-.34)/.56,0,1),C(1-torsoTilt/18,0,1),C(1-shoulderLevel/.11,0,1),C(1-Math.abs(hipShift)/.55,0,1)];
    if(handsUp<.04)feedback='ยกแขนเฉียงขึ้นเป็นรูปตัว V';
    else if(!feetStable)feedback='ยืนสองเท้าให้มั่นคงใน Safe Zone';
  }

  const pose=avg(checks)*100,center={x:shoulders.x,y:shoulders.y};
  s.centerHistory.push({x:center.x,y:center.y,t:BH.now()});if(s.centerHistory.length>20)s.centerHistory.shift();
  let jitter=.05;if(s.centerHistory.length>4){const m=s.centerHistory.reduce((o,p)=>({x:o.x+p.x,y:o.y+p.y}),{x:0,y:0});m.x/=s.centerHistory.length;m.y/=s.centerHistory.length;jitter=Math.sqrt(s.centerHistory.reduce((z,p)=>z+(p.x-m.x)**2+(p.y-m.y)**2,0)/s.centerHistory.length)}
  const stability=C(100-jitter*1550,0,100);let speed=0;if(s.lastCenter)speed=BH.dist(center,s.lastCenter)/Math.max(.016,(BH.now()-s.lastCenter.t)/1000);s.lastCenter={...center,t:BH.now()};
  const control=C(100-speed*150,0,100),safe=feetStable?C(100-Math.abs(hipShift)*45-ankleShift*20,0,100):25;
  const hardPose=['airplaneLeft','airplaneRight','crystalBoss'].includes(key),threshold=Math.max(56,cfg.poseThreshold-(hardPose?4:2)-s.assistLevel*3),safeThreshold=Math.max(46,cfg.safeThreshold-4-s.assistLevel*2);
  const valid=tracked&&conf>=cfg.confidence&&pose>=threshold&&safe>=safeThreshold;
  if(!tracked||conf<cfg.confidence)feedback='ถอยให้กล้องเห็นศีรษะถึงข้อเท้าและเพิ่มแสง';
  else if(stability<55)feedback='ลดการสั่น หายใจช้า ๆ และมองตรง';
  else if(pose<threshold&&feedback==='ยอดเยี่ยม ค้างไว้')feedback='ปรับร่างกายให้ใกล้ภาพตัวอย่างอีกนิด';
  return{valid,tracked,confidence:conf*100,pose,stability,control,safe,feedback,feetStable,movementSpeed:speed,threshold,safeThreshold};
};

const baseSetPoseUI=BH.setPoseUI;
BH.setPoseUI=()=>{
  baseSetPoseUI();
  const key=BH.currentPoseKey(),p=BH.POSES[key]||BH.POSES.center;
  e.poseName.textContent=p.name;e.poseCue.textContent=p.cue;e.ghost.className='poseGhost '+p.ghost;
  const advanced=['treeLeft','treeRight','airplaneLeft','airplaneRight'].includes(key);
  if(advanced)BH.setCoach(p.cue,'จับพนักเก้าอี้ได้หากยังไม่มั่นใจ • หยุดทันทีเมื่อเวียนศีรษะ','🧘','SAFE POSE');
};

const baseCalc=BH.calcSummary;
BH.calcSummary=reason=>{
  const x=baseCalc(reason);x.version=RELEASE;x.releaseVersion=RELEASE;
  x.poseTypes=['sky_shield','star_reach_left','star_reach_right','tree_left','tree_right','airplane_left','airplane_right','crystal_guardian'];
  x.poseCatalogSize=8;x.sequencePatternId=s.sequencePatternId||'';return x;
};
console.info('[BalanceHold] Eight Pose Progression v17 ready',RELEASE);
})();