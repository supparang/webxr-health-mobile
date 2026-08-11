(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||!BH.CONFIG||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el;
const RELEASE='20260811-BALANCE-GRADE5-FAIR-COACH-V59-TUNED-LR';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

/*
 * IMPORTANT LEGACY KEY NOTE
 * bh-classroom-tree-knee-proof-v37 defines:
 *   treeLeft  -> detector expects RIGHT leg lift
 *   treeRight -> detector expects LEFT leg lift
 * Keep detector keys unchanged for compatibility with sequence/ghost/analytics,
 * but make all learner-facing title/cue/voice match the ACTUAL detected leg.
 */
const PROFILE={
  center:{label:'Ready Balance',title:'🛡️ ยืนกางแขน',cue:'ยืนตรง กางแขนระดับไหล่ แล้วค้างไว้',voice:'ท่าที่หนึ่ง ยืนตรง กางแขนระดับไหล่ แล้วค้างไว้',pose:60,safe:44,stability:46,control:42,confidence:40,hold:1600,gate:220,advanced:false,learnerSide:'center'},
  left:{label:'Star Reach Left',title:'⭐ เอื้อมซ้าย',cue:'ค่อย ๆ เอียงตัวไปทางซ้าย แล้วค้างไว้',voice:'ค่อย ๆ เอียงตัวไปทางซ้าย แล้วค้างไว้',pose:62,safe:46,stability:48,control:44,confidence:41,hold:1900,gate:230,advanced:false,learnerSide:'left'},
  right:{label:'Star Reach Right',title:'⭐ เอื้อมขวา',cue:'ค่อย ๆ เอียงตัวไปทางขวา แล้วค้างไว้',voice:'ค่อย ๆ เอียงตัวไปทางขวา แล้วค้างไว้',pose:63,safe:47,stability:49,control:45,confidence:41,hold:2000,gate:240,advanced:false,learnerSide:'right'},
  treeLeft:{label:'Tree Balance Right Leg',title:'🌳 ยกขาขวา',cue:'ยกขาขวาขึ้นเล็กน้อย รักษาสมดุล แล้วค้างไว้',voice:'ยกขาขวาขึ้นเพียงเล็กน้อย รักษาสมดุล แล้วค้างไว้',pose:65,safe:49,stability:52,control:47,confidence:42,hold:2200,gate:250,advanced:true,learnerSide:'right'},
  treeRight:{label:'Tree Balance Left Leg',title:'🌳 ยกขาซ้าย',cue:'ยกขาซ้ายขึ้นเล็กน้อย รักษาสมดุล แล้วค้างไว้',voice:'ยกขาซ้ายขึ้นเพียงเล็กน้อย รักษาสมดุล แล้วค้างไว้',pose:66,safe:50,stability:53,control:48,confidence:42,hold:2300,gate:260,advanced:true,learnerSide:'left'},
  boss:{label:'Crystal Guardian Boss',title:'💎 Crystal Guardian',cue:'รักษาสมดุลตามท่า Boss ให้สำเร็จ',voice:'ด่านสุดท้าย รักษาสมดุลตามท่าให้สำเร็จ',pose:67,safe:52,stability:55,control:50,confidence:43,hold:2500,gate:280,advanced:true,learnerSide:'boss'}
};

function canonicalKey(key){
  key=String(key||'');
  if(key==='crystalBoss'||key.toLowerCase().includes('boss'))return'boss';
  return PROFILE[key]?key:'center';
}
function currentKey(){return canonicalKey(s.currentKey||(Array.isArray(s.sequence)?s.sequence[s.index]:''));}
function profile(key=currentKey()){return PROFILE[canonicalKey(key)]||PROFILE.center;}

for(const [prop,field] of [['hold','hold'],['poseThreshold','pose'],['safeThreshold','safe'],['gateMs','gate']]){
  try{Object.defineProperty(BH.CONFIG.easy,prop,{configurable:true,enumerable:true,get(){return profile()[field]}})}catch(_){ }
}
Object.assign(BH.CONFIG.easy,{confidence:.40,graceMs:760,lostDebounceMs:1000,assistAfterMs:5500,maxAssist:1});

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  const p=profile(key);
  const assist=Math.max(0,Math.min(1,Number(s.assistLevel||0)));
  // One-step assist only after sustained effort: easier, but never an automatic pass.
  const poseFloor=Math.max(58,p.pose-assist*2);
  const safeFloor=Math.max(42,p.safe-assist*2);
  const stabilityFloor=Math.max(44,p.stability-assist*2);
  const controlFloor=Math.max(40,p.control-assist*2);
  const confidenceFloor=Math.max(38,p.confidence-assist);
  const confidence=Number(r.confidence||0),pose=Number(r.pose||0),safe=Number(r.safe||0),stability=Number(r.stability||0),control=Number(r.control||0);
  r.valid=!!r.tracked&&confidence>=confidenceFloor&&pose>=poseFloor&&safe>=safeFloor&&stability>=stabilityFloor&&control>=controlFloor;
  r.threshold=poseFloor;r.safeThreshold=safeFloor;r.requiredStability=stabilityFloor;r.requiredControl=controlFloor;r.requiredConfidence=confidenceFloor;
  r.grade5FairCoach=true;r.grade5FairCoachVersion=RELEASE;r.poseProfile=p.label;r.learnerSide=p.learnerSide;
  if(r.valid){
    const remain=Math.max(0,Math.ceil((p.hold-(s.holdMs||0))/1000));
    r.feedback=remain>0?`✅ ท่าถูกแล้ว • ค้างไว้อีก ${remain} วินาที`:'🎉 สำเร็จ!';
  }else if(!r.tracked||confidence<confidenceFloor)r.feedback='ขยับให้กล้องเห็นศีรษะ ไหล่ สะโพก และเข่าชัดขึ้น';
  else if(safe<safeFloor)r.feedback='ขยับเข้ากลางภาพอีกนิด';
  else if(pose<poseFloor){
    const k=canonicalKey(key);
    if(k==='center')r.feedback='กางแขนให้ใกล้ระดับไหล่อีกนิด';
    else if(k==='treeLeft')r.feedback='ยกขาขวาขึ้นอีกเล็กน้อย แล้วค้างไว้';
    else if(k==='treeRight')r.feedback='ยกขาซ้ายขึ้นอีกเล็กน้อย แล้วค้างไว้';
    else r.feedback='เอียงตัวตามทิศทางอีกเล็กน้อย';
  }else if(stability<stabilityFloor)r.feedback='ท่าถูกแล้ว แต่ยังแกว่ง • ค้างให้นิ่งขึ้น';
  else if(control<controlFloor)r.feedback='ขยับช้าลง และควบคุมไหล่กับสะโพกให้นิ่งขึ้น';
  return r;
};

let spokenKey='';
function speak(text){
  if(e.soundOn&&e.soundOn.checked===false)return;
  if(!('speechSynthesis'in window)||!text)return;
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang='th-TH';u.rate=.92;u.pitch=1.03;u.volume=1;
    speechSynthesis.speak(u);
  }catch(_){ }
}
function applyInstruction(force=false){
  const key=currentKey(),p=profile(key);
  if(e.poseName)e.poseName.textContent=p.title;
  if(e.poseCue)e.poseCue.textContent=p.cue;
  if(e.coachMain&&(s.phase==='ready'||s.phase==='play'||s.phase==='playing'))e.coachMain.textContent=p.cue;
  if(e.coachSub)e.coachSub.textContent=`${Math.min((Number(s.index)||0)+1,6)}/6 • ${p.label} • ค้าง ${(p.hold/1000).toFixed(1)} วินาที`;
  const token=`${Number(s.index)||0}|${key}`;
  if(force||spokenKey!==token){spokenKey=token;speak(p.voice)}
}

if(typeof BH.setPoseUI==='function'){
  const base=BH.setPoseUI;
  BH.setPoseUI=(...args)=>{const out=base(...args);setTimeout(()=>applyInstruction(),0);return out};
}
if(typeof BH.completePose==='function'){
  const base=BH.completePose;
  BH.completePose=(...args)=>{const out=base(...args);setTimeout(()=>applyInstruction(true),450);return out};
}

const watcher=setInterval(()=>{
  if(['ready','play','playing'].includes(String(s.phase||'')))applyInstruction();
  if(['result','finished','done'].includes(String(s.phase||'')))clearInterval(watcher);
},500);

if(typeof BH.calcSummary==='function'){
  const base=BH.calcSummary;
  BH.calcSummary=reason=>{
    const x=base(reason)||{};
    x.grade5FairCoachVersion=RELEASE;
    x.grade5Progression='warmup-fair -> reach-moderate -> tree-challenging -> boss-challenging-passable';
    x.grade5InstructionMode='thai-visual-plus-speech';
    x.treeLearnerSideMapping={treeLeft:'right',treeRight:'left',reason:'legacy-detector-key-compatibility-v37'};
    x.grade5PoseProfiles=Object.fromEntries(Object.entries(PROFILE).map(([k,p])=>[k,{label:p.label,learnerSide:p.learnerSide,pose:p.pose,safe:p.safe,stability:p.stability,control:p.control,confidence:p.confidence,hold:p.hold}]));
    return x;
  };
}
window.HH_BALANCE_GRADE5_FAIR_COACH={release:RELEASE,profile:PROFILE,treeLearnerSideMapping:{treeLeft:'right',treeRight:'left'}};
document.documentElement.dataset.bhGrade5FairCoach='v59-tuned-lr';
console.info('[BalanceHold] Grade 5 Fair Coach tuned LR ready',RELEASE,PROFILE);
})();
