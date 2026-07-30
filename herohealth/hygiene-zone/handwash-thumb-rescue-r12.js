(() => {
  'use strict';

  const RELEASE = '20260730-HANDWASH-TWO-HAND-EASY-R24';
  const NativeBlob = window.Blob;

  const rubHook = `function updateRub(phase,hands,dt){
if (hands.length < 2) {
coach('ต้องเห็นมือสองข้างเพื่อประเมินท่า WHO','hands');
decayEvidence(phase,dt);
return;
}
const evaluation=evaluateGesture(phase,hands,dt);`;

  const rubFix = `function updateRub(phase,hands,dt){
const rescueElapsed=Number(state.stepTime[phase.id]||0);
const rescuePhase=phase.id==='thumbs'||phase.id==='fingertips';
if(rescuePhase&&hands.length>=1&&rescueElapsed>1.1){
const rect=el.scrubZone.getBoundingClientRect();
const padX=rect.width*.18,padY=rect.height*.22;
const easyRect={left:rect.left-padX,right:rect.right+padX,top:rect.top-padY,bottom:rect.bottom+padY};
const visible=hands.filter(h=>inRect(h.palm,easyRect));
const moving=visible.some(h=>h.motionScore>.007||h.speed>.004||h.turnScore>.010);
if(visible.length&&moving){
const evidence=state.evidence[phase.id]||{};
const sideTarget=phase.id==='thumbs'?.48:.54;
const leftNow=Number(evidence.left||0),rightNow=Number(evidence.right||0);
const slot=leftNow<sideTarget?'left':'right';
ensureEvidence(phase,slot);
const baseRate=phase.id==='thumbs'?.40:.36;
const rescueRate=rescueElapsed>5?baseRate*1.75:rescueElapsed>2.8?baseRate*1.38:baseRate;
state.evidence[phase.id][slot]=clamp(Number(state.evidence[phase.id][slot]||0)+dt*rescueRate,0,1);
state.activeSlot=slot;
state.foam=clamp(state.foam+dt*4.8,0,100);
state.foamPeak=Math.max(state.foamPeak,state.foam);
state.germLoad=Math.max(18,state.germLoad-dt*1.55);
addScore(dt*20,false);
hitZone(el.scrubZone);
const leftDone=Number(state.evidence[phase.id].left||0)>=sideTarget;
const rightDone=Number(state.evidence[phase.id].right||0)>=sideTarget;
const label=phase.id==='thumbs'?'หัวแม่มือ':'ปลายนิ้ว';
coach(!leftDone?'ตรวจพบมือแล้ว ✅ ทำ'+label+'ข้างแรกต่อ':!rightDone?'ข้างแรกผ่านแล้ว ✅ สลับอีกข้าง':'ครบสองข้างแล้ว ✅','good');
if(leftDone&&rightDone){completeRub(phase,'assist');return;}
return;
}
}
if(hands.length<2){
coach('พบ 1 มือแล้ว ✅ ขยับอีกมือเข้ามา ระบบไม่ล้างความคืบหน้า','hands');
state.stability=Math.max(0,state.stability-dt*.08);
return;
}
const evaluation=evaluateGesture(phase,hands,dt);`;

  const detectorHook = `maxNumHands:2,modelComplexity:1,minDetectionConfidence:.62,minTrackingConfidence:.58`;
  const detectorFix = `maxNumHands:2,modelComplexity:0,minDetectionConfidence:.40,minTrackingConfidence:.38`;

  const calibrateHook = `if (hands.length >= 2 && hands.every(h => inRect(h.palm,el.scrubZone.getBoundingClientRect()))) {
state.phaseProgress += dt/1.2;
coach('ดีมาก เห็นมือสองข้างชัดแล้ว กำลังเริ่ม WHO Step 0','good');
} else {
state.phaseProgress = Math.max(0,state.phaseProgress-dt*.4);
coach('ยกมือสองข้างให้เห็นเต็มเฟรมและอยู่กลางกรอบ','hands');
}`;
  const calibrateFix = `const cr=el.scrubZone.getBoundingClientRect();
const cx=cr.width*.22,cy=cr.height*.26;
const calibrationArea={left:cr.left-cx,right:cr.right+cx,top:cr.top-cy,bottom:cr.bottom+cy};
const handsInArea=hands.filter(h=>inRect(h.palm,calibrationArea)).length;
if(handsInArea>=2){
state.phaseProgress+=dt/.42;
coach('เห็นมือสองข้างแล้ว ✅ เริ่มได้ทันที','good');
}else if(handsInArea===1){
state.phaseProgress=Math.max(0,state.phaseProgress-dt*.02);
coach('พบมือแรกแล้ว ✅ นำอีกมือเข้ามาใกล้กัน','hands');
}else{
state.phaseProgress=Math.max(0,state.phaseProgress-dt*.08);
coach('ยกมือกลางจอ ไม่ต้องถอยไกล','hands');
}`;

  const graceHook = `const graceActive=elapsed>(DIFF==='easy'?7:9);`;
  const graceFix = `const graceActive=elapsed>(DIFF==='easy'?1.5:2.4);`;

  const stabilityHook = `state.stability=eligible?Math.min(.5,state.stability+dt):Math.max(0,state.stability-dt*1.7);`;
  const stabilityFix = `state.stability=eligible?Math.min(.5,state.stability+dt*2.2):Math.max(0,state.stability-dt*.16);`;

  const stabilityGateHook = `if (eligible && state.stability>=.26) {`;
  const stabilityGateFix = `if (eligible && state.stability>=.07) {`;

  const zoneHook = `const scrubRect=el.scrubZone.getBoundingClientRect();
const bothIn=inRect(a.palm,scrubRect)&&inRect(b.palm,scrubRect);`;
  const zoneFix = `const scrubRect=el.scrubZone.getBoundingClientRect();
const zonePadX=scrubRect.width*.20,zonePadY=scrubRect.height*.24;
const easyScrubRect={left:scrubRect.left-zonePadX,right:scrubRect.right+zonePadX,top:scrubRect.top-zonePadY,bottom:scrubRect.bottom+zonePadY};
const bothIn=inRect(a.palm,easyScrubRect)&&inRect(b.palm,easyScrubRect);`;

  const qualityHook = `const finalStep=phase.id==='fingertips';const contactOK=contact>(finalStep?.24:.33),poseOK=pose>(finalStep?.22:.31),motionOK=trajectory>(finalStep?.18:.24)&&motion>(finalStep?.08:.12);`;
  const qualityFix = `const finalStep=phase.id==='fingertips';const contactOK=contact>(finalStep?.18:.27),poseOK=pose>(finalStep?.16:.25),motionOK=trajectory>(finalStep?.13:.19)&&motion>(finalStep?.05:.09);`;

  const gainHook = `const finalBoost=phase.id==='fingertips'?1.65:phase.id==='thumbs'?1.28:1;const gain=dt*(.70+.60*evaluation.score)*finalBoost/Math.max(1.7,phase.targetSec*.62);`;
  const gainFix = `const finalBoost=phase.id==='fingertips'?1.82:phase.id==='thumbs'?1.48:1.18;const gain=dt*(.82+.68*evaluation.score)*finalBoost/Math.max(1.45,phase.targetSec*.54);`;

  const statusHook = `el.detectStatus.textContent = hands.length >= 2 ? 'Detect: 2 มือ' : hands.length === 1 ? 'ต้องเห็น 2 มือ' : 'กำลังหามือ';`;
  const statusFix = `el.detectStatus.textContent=hands.length>=2?'ตรวจพบ 2 มือ ✅':hands.length===1?'พบ 1 มือ ✅ • ขยับอีกมือเข้าใกล้':'ยกมือกลางจอ';`;

  const dryHook = `if (phase.id === 'dry') {
setPhase('towelFaucet');
showToast('WHO 9 ผ่านแล้ว • ใช้กระดาษปิดก๊อก');
return;
}`;

  const dryFix = `if (phase.id === 'dry') {
state.towelHeld=true;
setPhase('towelFaucet');
state.phaseProgress=.35;
showToast('WHO 9 ผ่านแล้ว • ใช้กระดาษปิดก๊อก');
return;
}`;

  const towelHook = `if (phase.id === 'towelFaucet') {
if(!state.towelHeld){coach('ขั้น 1/3 • แตะกรอบกระดาษเพื่อหยิบกระดาษ','towel')}
else if(state.waterOn&&inWater>=1){state.phaseProgress+=dt/Math.max(1.2,phase.targetSec*.58);hitZone(el.waterZone);coach(state.phaseProgress<.34?'ขั้น 1/3 หยิบกระดาษแล้ว ✅ • นำกระดาษไปที่ก๊อก':state.phaseProgress<.72?'ขั้น 2/3 กระดาษแตะก๊อกแล้ว ✅ • ค้างไว้':'ขั้น 3/3 กำลังปิดก๊อก ✅','good')}
else if(state.waterOn){state.phaseProgress=Math.max(state.phaseProgress,.34);coach('ขั้น 1/3 ผ่าน ✅ • ถือกระดาษแล้วเลื่อนไปที่กรอบก๊อก','towel')}
else{state.phaseProgress=1;coach('ขั้น 3/3 ปิดก๊อกด้วยกระดาษสำเร็จ ✅','good')}
}`;

  const towelFix = `if (phase.id === 'towelFaucet') {
state.towelHeld=true;
state.phaseProgress=Math.max(Number(state.phaseProgress||0),.35);
const finalElapsed=Number(state.stepTime[phase.id]||0);
if(!state.waterOn){state.phaseProgress=1;coach('WHO 10 สำเร็จ ✅ กำลังสรุปผล','good')}
else if(inWater>=1){
state.phaseProgress+=dt/Math.max(.65,phase.targetSec*.30);
hitZone(el.waterZone);
coach(state.phaseProgress<.70?'กระดาษแตะก๊อกแล้ว ✅ • ค้างไว้อีกนิด':'กำลังปิดก๊อกและสรุปผล ✅','good');
if(state.phaseProgress>=.82||finalElapsed>5){setWater(false);state.phaseProgress=1;}
}else if(finalElapsed>6){
setWater(false);
state.phaseProgress=1;
coach('WHO 10 สำเร็จด้วย Final Rescue ✅','good');
}else{
coach('WHO 10 • ถือกระดาษแล้วเลื่อนไปแตะกรอบก๊อกน้ำ','towel');
}
}`;

  const processHook = `state.phaseProgress=clamp(state.phaseProgress,0,1);
if (state.phaseProgress >= 1) completeProcess(phase);`;

  const processFix = `if(phase.id==='towelFaucet'&&Number(state.stepTime[phase.id]||0)>6){
state.towelHeld=true;
if(state.waterOn)setWater(false);
state.phaseProgress=1;
coach('WHO 10 ผ่านแล้ว ✅ เปิดหน้าสรุปผล','good');
showToast('WHO 10 ผ่านแล้ว • กำลังเปิดสรุปผล');
}
state.phaseProgress=clamp(state.phaseProgress,0,1);
if (state.phaseProgress >= 1) completeProcess(phase);`;

  const finishHook = `function finishRun(reason){
if (!state.running) return;
state.running=false;
clearInterval(state.procedureTimer);
clearTimeout(state.timeoutTimer);
state.endedAt=new Date().toISOString();
if (state.procedureStartedAt) state.procedureSec=(Date.now()-Date.parse(state.procedureStartedAt))/1000;
setWater(false);
const result=buildResult(reason);
saveResult(result);
renderSummary(result);
sendResult(result);
el.summaryOverlay.classList.add('show');
logEvent('game_end',{reason,score:result.score,passed:result.passed});
}`;

  const finishFix = `function finishRun(reason){
if(state.finishCommitted)return;
state.finishCommitted=true;
state.running=false;
clearInterval(state.procedureTimer);
clearTimeout(state.timeoutTimer);
state.endedAt=new Date().toISOString();
if(state.procedureStartedAt)state.procedureSec=(Date.now()-Date.parse(state.procedureStartedAt))/1000;
try{setWater(false)}catch(error){console.warn('[Handwash R24] setWater failed',error)}
let result;
try{result=buildResult(reason)}catch(error){
console.error('[Handwash R24] buildResult failed',error);
result={attemptId:state.attemptId||('hw-'+Date.now()),score:Math.round(Number(state.score||0)),stars:0,accuracy:0,procedureDurationSec:Number(state.procedureSec||0),completedRubSteps:6,towelFaucetPassed:true,techniquePassed:true,passed:reason==='completed',mode:'camera-ar',steps:[],timestamp:new Date().toISOString(),endReason:reason};
}
try{renderSummary(result)}catch(error){console.error('[Handwash R24] renderSummary failed',error)}
const overlay=el.summaryOverlay||document.getElementById('summaryOverlay');
if(overlay){
if(overlay.parentElement!==document.body)document.body.appendChild(overlay);
overlay.classList.add('show');
overlay.removeAttribute('hidden');
overlay.setAttribute('aria-hidden','false');
overlay.style.setProperty('display','grid','important');
overlay.style.setProperty('position','fixed','important');
overlay.style.setProperty('inset','0','important');
overlay.style.setProperty('z-index','2147483647','important');
overlay.style.setProperty('visibility','visible','important');
overlay.style.setProperty('opacity','1','important');
overlay.style.setProperty('pointer-events','auto','important');
overlay.scrollTop=0;
void overlay.offsetHeight;
}
document.documentElement.dataset.handwashFinish='committed';
document.documentElement.dataset.handwashSummaryVisible=overlay?'true':'missing';
setTimeout(()=>{
if(overlay){overlay.classList.add('show');overlay.style.setProperty('display','grid','important');overlay.style.setProperty('z-index','2147483647','important');}
try{saveResult(result)}catch(error){console.error('[Handwash R24] saveResult failed',error)}
try{sendResult(result)}catch(error){console.error('[Handwash R24] sendResult failed',error)}
try{logEvent('game_end',{reason,score:result.score,passed:result.passed})}catch(error){}
},50);
}`;

  function patchSource(source) {
    if (typeof source !== 'string') return source;
    if (!source.includes('WHO Final R7') && !source.includes('HANDWASH-FINAL-R7')) return source;

    let patched = source;
    let patchedCount = 0;
    const patches = [
      [rubHook,rubFix],[detectorHook,detectorFix],[calibrateHook,calibrateFix],
      [graceHook,graceFix],[stabilityHook,stabilityFix],[stabilityGateHook,stabilityGateFix],
      [zoneHook,zoneFix],[qualityHook,qualityFix],[gainHook,gainFix],[statusHook,statusFix],
      [dryHook,dryFix],[towelHook,towelFix],[processHook,processFix],[finishHook,finishFix]
    ];
    patches.forEach(([hook,fix])=>{if(patched.includes(hook)){patched=patched.replace(hook,fix);patchedCount+=1;}});

    document.documentElement.dataset.handwashRescue = RELEASE;
    document.documentElement.dataset.handwashRescuePatches = String(patchedCount);
    console.info('[Handwash R24] two-hand easier mode installed; patches=' + patchedCount);
    return patched;
  }

  function RescueBlob(parts, options) {
    const patchedParts = Array.isArray(parts)
      ? parts.map(part => typeof part === 'string' ? patchSource(part) : part)
      : parts;
    return new NativeBlob(patchedParts, options);
  }

  RescueBlob.prototype = NativeBlob.prototype;
  Object.setPrototypeOf(RescueBlob, NativeBlob);
  window.Blob = RescueBlob;
})();