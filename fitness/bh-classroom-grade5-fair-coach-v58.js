(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el||!BH.CONFIG||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el;
const RELEASE='20260811-BALANCE-GRADE5-FAIR-COACH-V58';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const PROFILE={
  center:{label:'Ready Balance',title:'🛡️ ยืนกางแขน',cue:'ยืนตรง กางแขนระดับไหล่ แล้วค้างไว้',voice:'ท่าที่หนึ่ง ยืนตรง กางแขนระดับไหล่ แล้วค้างไว้',pose:58,safe:42,stability:42,control:40,confidence:40,hold:1400,gate:180,advanced:false},
  left:{label:'Star Reach Left',title:'⭐ เอื้อมซ้าย',cue:'ค่อย ๆ เอียงตัวไปทางซ้าย แล้วค้างไว้',voice:'ค่อย ๆ เอียงตัวไปทางซ้าย แล้วค้างไว้',pose:60,safe:44,stability:45,control:42,confidence:40,hold:1700,gate:210,advanced:false},
  right:{label:'Star Reach Right',title:'⭐ เอื้อมขวา',cue:'ค่อย ๆ เอียงตัวไปทางขวา แล้วค้างไว้',voice:'ค่อย ๆ เอียงตัวไปทางขวา แล้วค้างไว้',pose:61,safe:45,stability:47,control:43,confidence:41,hold:1800,gate:220,advanced:false},
  treeLeft:{label:'Tree Balance Left',title:'🌳 ทรงตัวซ้าย',cue:'ยกเท้าซ้ายขึ้นเล็กน้อย รักษาสมดุล แล้วค้างไว้',voice:'ยกเท้าซ้ายขึ้นเพียงเล็กน้อย รักษาสมดุล แล้วค้างไว้',pose:63,safe:47,stability:50,control:45,confidence:42,hold:1950,gate:230,advanced:true},
  treeRight:{label:'Tree Balance Right',title:'🌳 ทรงตัวขวา',cue:'ยกเท้าขวาขึ้นเล็กน้อย รักษาสมดุล แล้วค้างไว้',voice:'ยกเท้าขวาขึ้นเพียงเล็กน้อย รักษาสมดุล แล้วค้างไว้',pose:64,safe:48,stability:52,control:46,confidence:42,hold:2100,gate:240,advanced:true},
  boss:{label:'Crystal Guardian Boss',title:'💎 Crystal Guardian',cue:'รักษาสมดุลตามท่า Boss ให้สำเร็จ',voice:'ด่านสุดท้าย รักษาสมดุลตามท่าให้สำเร็จ',pose:65,safe:50,stability:54,control:48,confidence:43,hold:2300,gate:250,advanced:true}
};

function canonicalKey(key){
  key=String(key||'');
  if(key==='crystalBoss'||key.toLowerCase().includes('boss'))return'boss';
  return PROFILE[key]?key:'center';
}
function currentKey(){return canonicalKey(s.currentKey||(Array.isArray(s.sequence)?s.sequence[s.index]:''));}
function profile(key=currentKey()){return PROFILE[canonicalKey(key)]||PROFILE.center;}

// The classroom profile is deliberately progressive. Warm-up confirms body detection;
// later poses add balance demand; Boss is the hardest but remains Grade-5 passable.
for(const [prop,field] of [['hold','hold'],['poseThreshold','pose'],['safeThreshold','safe'],['gateMs','gate']]){
  try{Object.defineProperty(BH.CONFIG.easy,prop,{configurable:true,enumerable:true,get(){return profile()[field]}})}catch(_){ }
}
Object.assign(BH.CONFIG.easy,{confidence:.40,graceMs:820,lostDebounceMs:1100,assistAfterMs:4500,maxAssist:2});

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  const r=baseEvaluate(lm,key)||{};
  const p=profile(key);
  const assist=Math.max(0,Math.min(2,Number(s.assistLevel||0)));
  // Assist only nudges thresholds after a child has genuinely tried for several seconds.
  const poseFloor=Math.max(54,p.pose-assist*2);
  const safeFloor=Math.max(38,p.safe-assist*2);
  const stabilityFloor=Math.max(38,p.stability-assist*2);
  const controlFloor=Math.max(36,p.control-assist*2);
  const confidenceFloor=Math.max(36,p.confidence-assist);
  const confidence=Number(r.confidence||0),pose=Number(r.pose||0),safe=Number(r.safe||0),stability=Number(r.stability||0),control=Number(r.control||0);
  r.valid=!!r.tracked&&confidence>=confidenceFloor&&pose>=poseFloor&&safe>=safeFloor&&stability>=stabilityFloor&&control>=controlFloor;
  r.threshold=poseFloor;r.safeThreshold=safeFloor;r.requiredStability=stabilityFloor;r.requiredControl=controlFloor;r.requiredConfidence=confidenceFloor;
  r.grade5FairCoach=true;r.grade5FairCoachVersion=RELEASE;r.poseProfile=p.label;
  if(r.valid){
    const remain=Math.max(0,Math.ceil((p.hold-(s.holdMs||0))/1000));
    r.feedback=remain>0?`✅ ถูกต้อง! ค้างไว้ ${remain} วินาที`:'🎉 สำเร็จ!';
  }else if(!r.tracked||confidence<confidenceFloor)r.feedback='ขยับให้กล้องเห็นศีรษะ ไหล่ สะโพก และเข่าชัดขึ้น';
  else if(safe<safeFloor)r.feedback='ขยับเข้ากลางภาพอีกนิด';
  else if(pose<poseFloor)r.feedback=canonicalKey(key)==='center'?'กางแขนระดับไหล่อีกนิด':'ทำตามเงาท่าอีกนิด';
  else if(stability<stabilityFloor)r.feedback='ดีแล้ว ค้างนิ่งอีกนิด';
  else if(control<controlFloor)r.feedback='ขยับช้าลงอีกนิด';
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

// Keep the first instruction visible/audible once the game reaches ready/play.
const watcher=setInterval(()=>{
  if(['ready','play','playing'].includes(String(s.phase||'')))applyInstruction();
  if(['result','finished','done'].includes(String(s.phase||'')))clearInterval(watcher);
},500);

if(typeof BH.calcSummary==='function'){
  const base=BH.calcSummary;
  BH.calcSummary=reason=>{
    const x=base(reason)||{};
    x.grade5FairCoachVersion=RELEASE;
    x.grade5Progression='warmup-easy -> reach-easy-medium -> tree-medium-challenging -> boss-challenging-passable';
    x.grade5InstructionMode='thai-visual-plus-speech';
    x.grade5PoseProfiles=Object.fromEntries(Object.entries(PROFILE).map(([k,p])=>[k,{label:p.label,pose:p.pose,safe:p.safe,stability:p.stability,control:p.control,confidence:p.confidence,hold:p.hold}]));
    return x;
  };
}
window.HH_BALANCE_GRADE5_FAIR_COACH={release:RELEASE,profile:PROFILE};
document.documentElement.dataset.bhGrade5FairCoach='v58';
console.info('[BalanceHold] Grade 5 Fair Coach ready',RELEASE,PROFILE);
})();
