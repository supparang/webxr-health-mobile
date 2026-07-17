(() => {
  'use strict';

  const RELEASE = '20260717-HANDWASH-RUNTIME-RESCUE-R13';
  const NativeBlob = window.Blob;

  const hook = `function updateRub(phase,hands,dt){
if (hands.length < 2) {
coach('ต้องเห็นมือสองข้างเพื่อประเมินท่า WHO','hands');
decayEvidence(phase,dt);
return;
}
const evaluation=evaluateGesture(phase,hands,dt);`;

  const fix = `function updateRub(phase,hands,dt){
const elapsed=Number(state.stepTime[phase.id]||0);
const rescuePhase=phase.id==='thumbs'||phase.id==='fingertips';
if(rescuePhase&&hands.length>=1&&elapsed>2.5){
const rect=el.scrubZone.getBoundingClientRect();
const visible=hands.filter(h=>inRect(h.palm,rect));
const moving=visible.some(h=>h.motionScore>.035||h.speed>.014||h.turnScore>.045);
if(visible.length&&moving){
const evidence=state.evidence[phase.id]||{};
const slot=Number(evidence.left||0)<.96?'left':'right';
ensureEvidence(phase,slot);
const phaseBoost=phase.id==='thumbs'?1.12:1.24;
const gain=dt*phaseBoost*(elapsed>7?.72:.54)/Math.max(1.35,phase.targetSec*.46);
state.evidence[phase.id][slot]=clamp(Number(state.evidence[phase.id][slot]||0)+gain,0,1);
state.activeSlot=slot;
state.foam=clamp(state.foam+dt*4.5,0,100);
state.foamPeak=Math.max(state.foamPeak,state.foam);
state.germLoad=Math.max(18,state.germLoad-dt*1.45);
addScore(dt*20,false);
hitZone(el.scrubZone);
const label=phase.id==='thumbs'?'หัวแม่มือ':'ปลายนิ้ว';
coach(slot==='left'?'โหมดช่วย'+label+' ✅ หมุนเป็นวงต่ออีกนิด':'ข้างแรกผ่านแล้ว ✅ ทำซ้ำอีกข้าง','good');
if(rubDone(phase)) completeRub(phase,'assist');
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

  function patchSource(source) {
    if (typeof source !== 'string') return source;
    if (!source.includes('function updateRub(phase,hands,dt){')) return source;
    if (!source.includes('WHO Final R7') && !source.includes('HANDWASH-FINAL-R7')) return source;
    if (!source.includes(hook)) {
      console.warn('[Handwash R13] compiled updateRub hook not found');
      return source;
    }
    const patched = source.replace(hook, fix);
    document.documentElement.dataset.handwashRescue = RELEASE;
    console.info('[Handwash R13] post-integrity thumb/fingertip rescue installed');
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
