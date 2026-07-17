(() => {
  'use strict';

  const RELEASE = '20260717-HANDWASH-FINAL-STEP-R16';
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

  const towelHook = `else if(state.waterOn&&inWater>=1){state.phaseProgress+=dt/Math.max(1.2,phase.targetSec*.58);hitZone(el.waterZone);coach(state.phaseProgress<.34?'ขั้น 1/3 หยิบกระดาษแล้ว ✅ • นำกระดาษไปที่ก๊อก':state.phaseProgress<.72?'ขั้น 2/3 กระดาษแตะก๊อกแล้ว ✅ • ค้างไว้':'ขั้น 3/3 กำลังปิดก๊อก ✅','good')}`;

  const towelFix = `else if(state.waterOn&&inWater>=1){state.phaseProgress+=dt/Math.max(.85,phase.targetSec*.42);hitZone(el.waterZone);if(state.phaseProgress>=.90||Number(state.stepTime[phase.id]||0)>8){state.phaseProgress=1;setWater(false);coach('ขั้น 3/3 ปิดก๊อกด้วยกระดาษสำเร็จ ✅','good')}else{coach(state.phaseProgress<.34?'ขั้น 1/3 หยิบกระดาษแล้ว ✅ • นำกระดาษไปที่ก๊อก':state.phaseProgress<.72?'ขั้น 2/3 กระดาษแตะก๊อกแล้ว ✅ • ค้างไว้':'ขั้น 3/3 กำลังปิดก๊อก ✅','good')}}`;

  function patchSource(source) {
    if (typeof source !== 'string') return source;
    if (!source.includes('WHO Final R7') && !source.includes('HANDWASH-FINAL-R7')) return source;

    let patched = source;
    if (patched.includes(rubHook)) {
      patched = patched.replace(rubHook, rubFix);
    } else if (!patched.includes("const rescuePhase=phase.id==='thumbs'||phase.id==='fingertips';")) {
      console.warn('[Handwash R16] compiled updateRub hook not found');
    }

    if (patched.includes(towelHook)) {
      patched = patched.replace(towelHook, towelFix);
    } else if (!patched.includes("state.phaseProgress>=.90||Number(state.stepTime[phase.id]||0)>8")) {
      console.warn('[Handwash R16] towel faucet hook not found');
    }

    document.documentElement.dataset.handwashRescue = RELEASE;
    console.info('[Handwash R16] rub rescue and final-step auto-complete installed');
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
