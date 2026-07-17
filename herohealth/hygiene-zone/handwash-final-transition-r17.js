(() => {
  'use strict';
  const RELEASE='20260717-HANDWASH-FINAL-TRANSITION-R17';
  const NativeBlob=window.Blob;

  const dryHook=`if (phase.id === 'dry') {
setPhase('towelFaucet');
showToast('WHO 9 ผ่านแล้ว • ใช้กระดาษปิดก๊อก');
return;
}`;
  const dryFix=`if (phase.id === 'dry') {
state.towelHeld=true;
setPhase('towelFaucet');
state.phaseProgress=Math.max(Number(state.phaseProgress||0),.35);
showToast('WHO 9 ผ่านแล้ว • ใช้กระดาษปิดก๊อก');
return;
}`;

  const towelHook=`if (phase.id === 'towelFaucet') {
if(!state.towelHeld){coach('ขั้น 1/3 • แตะกรอบกระดาษเพื่อหยิบกระดาษ','towel')}
else if(state.waterOn&&inWater>=1){state.phaseProgress+=dt/Math.max(1.2,phase.targetSec*.58);hitZone(el.waterZone);coach(state.phaseProgress<.34?'ขั้น 1/3 หยิบกระดาษแล้ว ✅ • นำกระดาษไปที่ก๊อก':state.phaseProgress<.72?'ขั้น 2/3 กระดาษแตะก๊อกแล้ว ✅ • ค้างไว้':'ขั้น 3/3 กำลังปิดก๊อก ✅','good')}
else if(state.waterOn){state.phaseProgress=Math.max(state.phaseProgress,.34);coach('ขั้น 1/3 ผ่าน ✅ • ถือกระดาษแล้วเลื่อนไปที่กรอบก๊อก','towel')}
else{state.phaseProgress=1;coach('ขั้น 3/3 ปิดก๊อกด้วยกระดาษสำเร็จ ✅','good')}
}`;
  const towelFix=`if (phase.id === 'towelFaucet') {
state.towelHeld=true;
state.phaseProgress=Math.max(Number(state.phaseProgress||0),.35);
const finalElapsed=Number(state.stepTime[phase.id]||0);
if(!state.waterOn){state.phaseProgress=1;coach('ขั้น 3/3 ปิดก๊อกด้วยกระดาษสำเร็จ ✅','good')}
else if(inWater>=1){state.phaseProgress+=dt/Math.max(.70,phase.targetSec*.34);hitZone(el.waterZone);coach(state.phaseProgress<.72?'ขั้น 2/3 กระดาษแตะก๊อกแล้ว ✅ • ค้างไว้':'ขั้น 3/3 กำลังปิดก๊อก ✅','good');if(state.phaseProgress>=.90||finalElapsed>6){state.phaseProgress=1;setWater(false)}}
else if(finalElapsed>8){state.phaseProgress=1;setWater(false);coach('Final Rescue ✅ ปิดก๊อกด้วยกระดาษสำเร็จ','good')}
else{coach('ถือกระดาษแล้วเลื่อนไปแตะกรอบก๊อกน้ำ','towel')}
}`;

  function patchSource(source){
    if(typeof source!=='string') return source;
    if(!source.includes('WHO Final R7')&&!source.includes('HANDWASH-FINAL-R7')) return source;
    let patched=source;
    if(patched.includes(dryHook)) patched=patched.replace(dryHook,dryFix);
    if(patched.includes(towelHook)) patched=patched.replace(towelHook,towelFix);
    document.documentElement.dataset.handwashFinalTransition=RELEASE;
    console.info('[Handwash R17] final transition rescue installed');
    return patched;
  }

  function RescueBlob(parts,options){
    const patchedParts=Array.isArray(parts)?parts.map(part=>typeof part==='string'?patchSource(part):part):parts;
    return new NativeBlob(patchedParts,options);
  }
  RescueBlob.prototype=NativeBlob.prototype;
  Object.setPrototypeOf(RescueBlob,NativeBlob);
  window.Blob=RescueBlob;
})();
