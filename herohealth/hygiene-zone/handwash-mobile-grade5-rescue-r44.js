(()=>{
'use strict';
const RELEASE='20260731-HANDWASH-MOBILE-GRADE5-RESCUE-R44';
const mobile=matchMedia('(max-width:900px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
if(!mobile)return;

const RUB_PHASES=new Set(['palm','dorsum','interlaced','backsFingers','thumbs','fingertips','wrists']);
const PROCESS_PHASES=new Set(['wet','soap','rinse','dry','towelFaucet']);
const PHASE_LIMIT={calibrate:1,wet:3,soap:3,palm:4,dorsum:5,interlaced:4,backsFingers:4,thumbs:5,fingertips:5,wrists:5,rinse:3,dry:3,towelFaucet:3};
const assistsByPhase=Object.create(null);
let totalAssists=0;
let lastAssistAt=0;
let lastEvidence=0;
let lastProgressAt=Date.now();
let phaseEnteredAt=Date.now();
let previousPhase='';
let lastHandsSeenAt=0;
let lastHintAt=0;

function numberFrom(value){const m=String(value||'').match(/([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):0}
function phase(){return document.documentElement.dataset.handwashPhase||''}
function evidence(){return Math.max(0,Math.min(100,numberFrom(document.getElementById('evidenceText')?.textContent||'0')))}
function handCount(){return numberFrom(document.getElementById('chipHands')?.textContent||'0')}
function running(){return !document.getElementById('startOverlay')?.classList.contains('show')&&!document.getElementById('summaryOverlay')?.classList.contains('show')}
function good(id){return document.getElementById(id)?.classList.contains('good')===true}
function motionEvidence(){return good('chipMotion')||good('chipContact')||good('chipPose')}
function showHint(message){
 const now=Date.now();if(now-lastHintAt<1800)return;lastHintAt=now;
 const toast=document.getElementById('toast');if(!toast)return;
 toast.textContent=message;toast.classList.add('show');
 clearTimeout(showHint.timer);showHint.timer=setTimeout(()=>toast.classList.remove('show'),1700);
}
function recordAssist(currentPhase,reason,hands,ev){
 totalAssists+=1;assistsByPhase[currentPhase]=(assistsByPhase[currentPhase]||0)+1;
 document.documentElement.dataset.handwashMobileAssistCount=String(totalAssists);
 document.documentElement.dataset.handwashMobileAssistPhase=currentPhase;
 document.documentElement.dataset.handwashMobileAssistReason=reason;
 try{window.dispatchEvent(new CustomEvent('herohealth:handwash-mobile-assist',{detail:{release:RELEASE,phase:currentPhase,reason,hands,evidence:ev,totalAssists,phaseAssists:assistsByPhase[currentPhase],ts:new Date().toISOString()}}))}catch(_){}
}
function assist(currentPhase,reason,hands,ev){
 const now=Date.now();
 const limit=PHASE_LIMIT[currentPhase]||3;
 if(totalAssists>=34||(assistsByPhase[currentPhase]||0)>=limit||now-lastAssistAt<2300)return false;
 const tap=document.getElementById('tapBtn');
 if(!tap||tap.disabled)return false;
 tap.click();lastAssistAt=now;lastProgressAt=now;recordAssist(currentPhase,reason,hands,ev);
 const label=RUB_PHASES.has(currentPhase)?'ระบบช่วยสะสมหลักฐานท่ามือ':currentPhase==='calibrate'?'ระบบช่วยเริ่มการตรวจจับ':'ระบบช่วยยืนยันขั้นตอน';
 showHint(`${label} ✅ ทำท่าต่อช้า ๆ`);
 return true;
}
function installMobileComfort(){
 if(document.getElementById('hhHandwashMobileR44Style'))return;
 const style=document.createElement('style');style.id='hhHandwashMobileR44Style';style.textContent=`
 @media(max-width:900px){
  #scrubZone{width:98vw!important;height:58vh!important;min-height:360px!important;max-height:none!important;top:61%!important}
  #waterZone{width:min(76vw,340px)!important;height:min(34vh,310px)!important;top:37%!important}
  html[data-handwash-phase="wet"] #waterZone,html[data-handwash-phase="rinse"] #waterZone{width:min(82vw,370px)!important;height:min(42vh,350px)!important}
  #soapZone,#towelZone{width:min(31vw,136px)!important;height:min(19vh,142px)!important;bottom:96px!important}
  .mission p{white-space:normal!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important}
  .coach{max-height:72px!important}.coach p{white-space:normal!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important}
  #tapBtn b{font-size:0!important}#tapBtn b:after{content:'ระบบช่วย';font-size:9px!important}
 }
 `;document.head.appendChild(style);
 const rule=[...document.querySelectorAll('.rule')].find(n=>/Mobile Grade 5/i.test(n.textContent||''));
 if(rule)rule.innerHTML='<b>Mobile Grade 5</b> ช่วยเมื่อตรวจจับมือซ้อนหรือหลุดชั่วคราว';
}
function tick(){
 installMobileComfort();
 if(!running())return;
 const now=Date.now(),currentPhase=phase(),ev=evidence(),hands=handCount();
 if(currentPhase!==previousPhase){previousPhase=currentPhase;phaseEnteredAt=now;lastProgressAt=now;lastEvidence=ev;return}
 if(hands>0)lastHandsSeenAt=now;
 if(ev>lastEvidence+.15){lastEvidence=ev;lastProgressAt=now;return}
 if(ev<lastEvidence-8){lastEvidence=ev;lastProgressAt=now;return}
 const stalledFor=now-lastProgressAt;
 const phaseAge=now-phaseEnteredAt;
 const recentlySawHands=now-lastHandsSeenAt<6500;
 const hasGesture=motionEvidence();

 if(currentPhase==='calibrate'){
  if(phaseAge>4200&&(hands>=1||recentlySawHands))assist(currentPhase,'calibration_stall',hands,ev);
  return;
 }
 if(RUB_PHASES.has(currentPhase)){
  if(stalledFor>2800&&(hands>=1||hasGesture||recentlySawHands)){
   const reason=hands===0?'tracking_lost':hands===1?'one_hand_occlusion':'pose_threshold_stall';
   assist(currentPhase,reason,hands,ev);
  }
  return;
 }
 if(PROCESS_PHASES.has(currentPhase)){
  const wait=currentPhase==='towelFaucet'?3000:3400;
  if(stalledFor>wait&&(hands>=1||recentlySawHands||phaseAge>7000))assist(currentPhase,'process_stall',hands,ev);
 }
}

installMobileComfort();
setInterval(tick,400);
addEventListener('DOMContentLoaded',installMobileComfort,{once:true});
document.documentElement.dataset.handwashMobileRescueR44=RELEASE;
window.HHHandwashMobileRescueR44={release:RELEASE,get totalAssists(){return totalAssists},get assistsByPhase(){return {...assistsByPhase}}};
console.info('[Handwash Mobile Rescue R44] installed',RELEASE);
})();
