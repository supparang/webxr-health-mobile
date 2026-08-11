(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||!BH.CONFIG||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el;
const RELEASE='20260811-BALANCE-GRADE5-FAIR-COACH-V61-INSTRUCTION-GATE';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

/* Legacy detector-key compatibility:
 * treeLeft detector = learner raises RIGHT leg
 * treeRight detector = learner raises LEFT leg
 */
const PROFILE={
  center:{label:'Ready Balance',title:'🛡️ ยืนกางแขน',cue:'ยืนตรง กางแขนระดับไหล่ แล้วค้างไว้',voice:'ท่าที่หนึ่ง ยืนตรง กางแขนระดับไหล่ แล้วค้างไว้',pose:60,safe:44,stability:46,control:42,confidence:40,hold:1600,gate:220,learnerSide:'center',instructionMin:1800},
  left:{label:'Star Reach Left',title:'⭐ เอื้อมซ้าย',cue:'ค่อย ๆ เอียงตัวไปทางซ้าย แล้วค้างไว้',voice:'ค่อย ๆ เอียงตัวไปทางซ้าย แล้วค้างไว้',pose:62,safe:46,stability:48,control:44,confidence:41,hold:1900,gate:230,learnerSide:'left',instructionMin:1800},
  right:{label:'Star Reach Right',title:'⭐ เอื้อมขวา',cue:'ค่อย ๆ เอียงตัวไปทางขวา แล้วค้างไว้',voice:'ค่อย ๆ เอียงตัวไปทางขวา แล้วค้างไว้',pose:63,safe:47,stability:49,control:45,confidence:41,hold:2000,gate:240,learnerSide:'right',instructionMin:1800},
  treeLeft:{label:'Tree Balance Right Leg',title:'🌳 ยกขาขวา',cue:'ยกขาขวาขึ้นเล็กน้อย รักษาสมดุล แล้วค้างไว้',voice:'ยกขาขวาขึ้นเพียงเล็กน้อย รักษาสมดุล แล้วค้างไว้',pose:65,safe:49,stability:52,control:47,confidence:42,hold:2200,gate:250,learnerSide:'right',instructionMin:2200},
  treeRight:{label:'Tree Balance Left Leg',title:'🌳 ยกขาซ้าย',cue:'ยกขาซ้ายขึ้นเล็กน้อย รักษาสมดุล แล้วค้างไว้',voice:'ยกขาซ้ายขึ้นเพียงเล็กน้อย รักษาสมดุล แล้วค้างไว้',pose:66,safe:50,stability:53,control:48,confidence:42,hold:2300,gate:260,learnerSide:'left',instructionMin:2200},
  // Core adds +450 ms to Boss. Base 1850 => effective classroom hold = 2300 ms.
  boss:{label:'Crystal Guardian Boss',title:'💎 Crystal Guardian',cue:'กางแขนระดับไหล่ เอียงตามทิศ Boss แล้วค้างให้นิ่ง',voice:'ด่านสุดท้าย กางแขนระดับไหล่ เอียงตามทิศที่กำหนด แล้วค้างให้นิ่ง',pose:60,safe:48,stability:50,control:45,confidence:40,hold:1850,gate:220,learnerSide:'boss',instructionMin:2400}
};

function canonicalKey(key){
  key=String(key||'');
  if(key==='crystalBoss'||key.toLowerCase().includes('boss'))return'boss';
  return PROFILE[key]?key:'center';
}
function currentKey(){return String(s.currentKey||'')==='boss'?'boss':canonicalKey(s.currentKey||(Array.isArray(s.sequence)?s.sequence[s.index]:''));}
function profile(key=currentKey()){return PROFILE[canonicalKey(key)]||PROFILE.center;}
function evaluationProfile(key){return String(s.currentKey||'')==='boss'?PROFILE.boss:profile(key)}

for(const [prop,field] of [['hold','hold'],['poseThreshold','pose'],['safeThreshold','safe'],['gateMs','gate']]){
  try{Object.defineProperty(BH.CONFIG.easy,prop,{configurable:true,enumerable:true,get(){return PROFILE[currentKey()][field]}})}catch(_){ }
}
Object.assign(BH.CONFIG.easy,{confidence:.40,graceMs:820,lostDebounceMs:1050,assistAfterMs:5200,maxAssist:1});

let instructionToken='';
let instructionLocked=false;
let instructionStartedAt=0;
let instructionMinUntil=0;
let instructionFallbackTimer=0;
let instructionUnlockTimer=0;

function setInstructionLocked(value){
  instructionLocked=!!value;
  s.grade5InstructionLocked=instructionLocked;
  if(e.holdText&&instructionLocked)e.holdText.textContent='0%';
  if(e.holdRing&&instructionLocked)e.holdRing.style.setProperty('--hold','0deg');
}
function unlockInstructionGate(token){
  if(token!==instructionToken||!instructionLocked)return;
  const now=performance.now();
  if(now<instructionMinUntil){
    clearTimeout(instructionUnlockTimer);
    instructionUnlockTimer=setTimeout(()=>unlockInstructionGate(token),Math.max(40,instructionMinUntil-now));
    return;
  }
  const pausedFor=Math.max(0,now-instructionStartedAt);
  // Instruction time must not reduce the child's active challenge time.
  if(Number.isFinite(Number(s.startedAt)))s.startedAt+=pausedFor;
  if(Number.isFinite(Number(s.transitionStart)))s.transitionStart+=pausedFor;
  s.holdMs=0;s.gateMs=0;s.invalidSince=0;s.lastValidAt=0;
  setInstructionLocked(false);
  if(e.coachMain)e.coachMain.textContent='พร้อม… เริ่ม! ทำท่าตามคำสั่งได้เลย';
  if(e.coachSub)e.coachSub.textContent='ระบบเริ่มตรวจท่าและนับ % แล้ว';
  if(e.coachBadge)e.coachBadge.textContent='เริ่ม';
}
function armInstructionGate(token,p){
  if(token===instructionToken)return false;
  instructionToken=token;
  instructionStartedAt=performance.now();
  instructionMinUntil=instructionStartedAt+Number(p.instructionMin||1800);
  clearTimeout(instructionFallbackTimer);clearTimeout(instructionUnlockTimer);
  s.holdMs=0;s.gateMs=0;
  setInstructionLocked(true);
  if(e.coachMain)e.coachMain.textContent='🔊 ฟังคำสั่งให้จบก่อน';
  if(e.coachSub)e.coachSub.textContent=p.cue;
  if(e.coachBadge)e.coachBadge.textContent='ฟัง';
  // Safety fallback if browser speech events do not fire.
  instructionFallbackTimer=setTimeout(()=>unlockInstructionGate(token),4200);
  return true;
}

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  const isBoss=String(s.currentKey||'')==='boss';
  const p=evaluationProfile(key);
  const assist=Math.max(0,Math.min(1,Number(s.assistLevel||0)));
  const poseFloor=Math.max(isBoss?56:58,p.pose-assist*2);
  const safeFloor=Math.max(isBoss?45:42,p.safe-assist*2);
  const stabilityFloor=Math.max(isBoss?47:44,p.stability-assist*2);
  const controlFloor=Math.max(isBoss?42:40,p.control-assist*2);
  const confidenceFloor=Math.max(38,p.confidence-assist);
  const confidence=Number(r.confidence||0),pose=Number(r.pose||0),safe=Number(r.safe||0),stability=Number(r.stability||0),control=Number(r.control||0);

  r.valid=!!r.tracked&&confidence>=confidenceFloor&&pose>=poseFloor&&safe>=safeFloor&&stability>=stabilityFloor&&control>=controlFloor;
  r.threshold=poseFloor;r.safeThreshold=safeFloor;r.requiredStability=stabilityFloor;r.requiredControl=controlFloor;r.requiredConfidence=confidenceFloor;
  r.grade5FairCoach=true;r.grade5FairCoachVersion=RELEASE;r.poseProfile=p.label;r.learnerSide=p.learnerSide;

  // Never award a pose while its spoken/visual instruction is still running.
  if(instructionLocked){
    r.valid=false;
    r.instructionLocked=true;
    r.feedback='🔊 ฟังคำสั่งให้จบก่อน • ระบบจะเริ่มนับเมื่อขึ้น “เริ่ม!”';
    return r;
  }

  if(r.valid){
    const required=p.hold+(isBoss?450:0);
    const remain=Math.max(0,Math.ceil((required-(s.holdMs||0))/1000));
    r.feedback=remain>0?`✅ ท่าถูกแล้ว • ค้างไว้อีก ${remain} วินาที`:'🎉 สำเร็จ!';
  }else if(!r.tracked||confidence<confidenceFloor)r.feedback='ขยับให้กล้องเห็นศีรษะ ไหล่ สะโพก และเข่าชัดขึ้น';
  else if(safe<safeFloor)r.feedback='ขยับเข้ากลางภาพอีกนิด';
  else if(pose<poseFloor){
    if(isBoss){
      const direction=String(s.bossKey||key||'right');
      r.feedback=direction==='left'?'กางแขนแล้วเอียงไหล่ไปทางซ้ายอีกเล็กน้อย':'กางแขนแล้วเอียงไหล่ไปทางขวาอีกเล็กน้อย';
    }else{
      const k=canonicalKey(key);
      if(k==='center')r.feedback='กางแขนให้ใกล้ระดับไหล่อีกนิด';
      else if(k==='treeLeft')r.feedback='ยกขาขวาขึ้นอีกเล็กน้อย แล้วค้างไว้';
      else if(k==='treeRight')r.feedback='ยกขาซ้ายขึ้นอีกเล็กน้อย แล้วค้างไว้';
      else r.feedback='เอียงตัวตามทิศทางอีกเล็กน้อย';
    }
  }else if(stability<stabilityFloor)r.feedback='ท่าถูกแล้ว • ลดการแกว่งอีกนิด แล้ว % จะเริ่มสะสม';
  else if(control<controlFloor)r.feedback='ขยับช้าลง และควบคุมไหล่กับสะโพกให้นิ่งขึ้น';
  return r;
};

let spokenKey='';
function speak(text,onEnd){
  if(e.soundOn&&e.soundOn.checked===false){if(typeof onEnd==='function')setTimeout(onEnd,0);return}
  if(!('speechSynthesis'in window)||!text){if(typeof onEnd==='function')setTimeout(onEnd,0);return}
  try{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);u.lang='th-TH';u.rate=.92;u.pitch=1.03;u.volume=1;
    if(typeof onEnd==='function'){u.onend=onEnd;u.onerror=onEnd}
    speechSynthesis.speak(u);
  }catch(_){if(typeof onEnd==='function')setTimeout(onEnd,0)}
}
function instructionForCurrent(){
  if(String(s.currentKey||'')==='boss'){
    const dir=String(s.bossKey||'right');
    return dir==='left'
      ?{...PROFILE.boss,cue:'กางแขนระดับไหล่ เอียงไหล่ไปทางซ้ายเล็กน้อย แล้วค้างให้นิ่ง',voice:'ด่านสุดท้าย กางแขนระดับไหล่ เอียงไหล่ไปทางซ้ายเล็กน้อย แล้วค้างให้นิ่ง'}
      :{...PROFILE.boss,cue:'กางแขนระดับไหล่ เอียงไหล่ไปทางขวาเล็กน้อย แล้วค้างให้นิ่ง',voice:'ด่านสุดท้าย กางแขนระดับไหล่ เอียงไหล่ไปทางขวาเล็กน้อย แล้วค้างให้นิ่ง'};
  }
  return PROFILE[currentKey()]||PROFILE.center;
}
function applyInstruction(force=false){
  const p=instructionForCurrent();
  if(e.poseName)e.poseName.textContent=p.title;
  if(e.poseCue)e.poseCue.textContent=p.cue;
  const effective=p.hold+(String(s.currentKey||'')==='boss'?450:0);
  const token=`${Number(s.index)||0}|${String(s.currentKey||'')}|${String(s.bossKey||'')}`;
  const isNew=armInstructionGate(token,p);
  if(e.coachMain&&instructionLocked)e.coachMain.textContent='🔊 ฟังคำสั่งให้จบก่อน';
  if(e.coachSub&&instructionLocked)e.coachSub.textContent=`${Math.min((Number(s.index)||0)+1,6)}/6 • ${p.cue}`;
  else if(e.coachSub)e.coachSub.textContent=`${Math.min((Number(s.index)||0)+1,6)}/6 • ${p.label} • ค้าง ${(effective/1000).toFixed(1)} วินาที`;
  if(isNew||force||spokenKey!==token){
    spokenKey=token;
    speak(p.voice,()=>unlockInstructionGate(token));
  }
}

if(typeof BH.setPoseUI==='function'){
  const base=BH.setPoseUI;
  BH.setPoseUI=(...args)=>{const out=base(...args);setTimeout(()=>applyInstruction(),0);return out};
}
if(typeof BH.completePose==='function'){
  const base=BH.completePose;
  BH.completePose=(...args)=>{const out=base(...args);setTimeout(()=>applyInstruction(),450);return out};
}
const watcher=setInterval(()=>{
  if(['ready','play','playing'].includes(String(s.phase||'')))applyInstruction();
  if(['result','finished','done'].includes(String(s.phase||''))){clearInterval(watcher);clearTimeout(instructionFallbackTimer);clearTimeout(instructionUnlockTimer)}
},500);

if(typeof BH.calcSummary==='function'){
  const base=BH.calcSummary;
  BH.calcSummary=reason=>{
    const x=base(reason)||{};
    x.grade5FairCoachVersion=RELEASE;
    x.grade5Progression='warmup-fair -> reach-moderate -> tree-challenging -> boss-challenging-passable';
    x.grade5InstructionMode='thai-visual-plus-speech-gated-before-detection';
    x.instructionTimeExcludedFromChallenge=true;
    x.treeLearnerSideMapping={treeLeft:'right',treeRight:'left',reason:'legacy-detector-key-compatibility-v37'};
    x.bossEffectiveHoldMs=2300;
    x.bossProfileFix='currentKey-boss-overrides-direction-key-v60';
    x.grade5PoseProfiles=Object.fromEntries(Object.entries(PROFILE).map(([k,p])=>[k,{label:p.label,learnerSide:p.learnerSide,pose:p.pose,safe:p.safe,stability:p.stability,control:p.control,confidence:p.confidence,hold:p.hold,instructionMin:p.instructionMin}]));
    return x;
  };
}
window.HH_BALANCE_GRADE5_FAIR_COACH={release:RELEASE,profile:PROFILE,treeLearnerSideMapping:{treeLeft:'right',treeRight:'left'},bossEffectiveHoldMs:2300,instructionGate:true};
document.documentElement.dataset.bhGrade5FairCoach='v61-instruction-gate';
console.info('[BalanceHold] Grade 5 Fair Coach Instruction Gate ready',RELEASE,PROFILE);
})();
