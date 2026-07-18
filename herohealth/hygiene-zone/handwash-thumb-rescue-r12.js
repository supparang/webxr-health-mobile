(() => {
  'use strict';

  const RELEASE = '20260718-HANDWASH-WHO10-PROCESS-GUARD-R19';
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
if(rescuePhase&&hands.length>=1&&rescueElapsed>2.2){
const rect=el.scrubZone.getBoundingClientRect();
const visible=hands.filter(h=>inRect(h.palm,rect));
const moving=visible.some(h=>h.motionScore>.018||h.speed>.009||h.turnScore>.025);
if(visible.length&&moving){
const evidence=state.evidence[phase.id]||{};
const sideTarget=phase.id==='thumbs'?.58:.68;
const leftNow=Number(evidence.left||0),rightNow=Number(evidence.right||0);
const slot=leftNow<sideTarget?'left':'right';
ensureEvidence(phase,slot);
const baseRate=phase.id==='thumbs'?.26:.23;
const rescueRate=rescueElapsed>8?baseRate*1.65:rescueElapsed>5?baseRate*1.28:baseRate;
state.evidence[phase.id][slot]=clamp(Number(state.evidence[phase.id][slot]||0)+dt*rescueRate,0,1);
state.activeSlot=slot;
state.foam=clamp(state.foam+dt*4.5,0,100);
state.foamPeak=Math.max(state.foamPeak,state.foam);
state.germLoad=Math.max(18,state.germLoad-dt*1.45);
addScore(dt*20,false);
hitZone(el.scrubZone);
const leftDone=Number(state.evidence[phase.id].left||0)>=sideTarget;
const rightDone=Number(state.evidence[phase.id].right||0)>=sideTarget;
const label=phase.id==='thumbs'?'หัวแม่มือ':'ปลายนิ้ว';
coach(!leftDone?'โหมดช่วย'+label+' ✅ ทำข้างแรกต่ออีกนิด':!rightDone?'ข้างแรกผ่านแล้ว ✅ สลับทำอีกข้าง':'ครบสองข้างแล้ว ✅','good');
if(leftDone&&rightDone){completeRub(phase,'assist');return;}
return;
}
if(hands.length<2){
coach(phase.id==='thumbs'?'ยกมือเข้ากรอบแล้วหมุนรอบหัวแม่มือ':'ยกมือเข้ากรอบแล้วหมุนปลายนิ้วเป็นวง','hands');
return;
}
}
if (hands.length < 2) {
coach('ต้องเห็นมือสองข้างเพื่อประเมินท่า WHO','hands');
decayEvidence(phase,dt);
return;
}
const evaluation=evaluateGesture(phase,hands,dt);`;

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

  function patchSource(source) {
    if (typeof source !== 'string') return source;
    if (!source.includes('WHO Final R7') && !source.includes('HANDWASH-FINAL-R7')) return source;

    let patched = source;
    let patchedCount = 0;
    if (patched.includes(rubHook)) { patched = patched.replace(rubHook, rubFix); patchedCount += 1; }
    if (patched.includes(dryHook)) { patched = patched.replace(dryHook, dryFix); patchedCount += 1; }
    if (patched.includes(towelHook)) { patched = patched.replace(towelHook, towelFix); patchedCount += 1; }
    if (patched.includes(processHook)) { patched = patched.replace(processHook, processFix); patchedCount += 1; }

    document.documentElement.dataset.handwashRescue = RELEASE;
    document.documentElement.dataset.handwashRescuePatches = String(patchedCount);
    console.info('[Handwash R19] WHO10 process guard installed; patches=' + patchedCount);
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