(() => {
  'use strict';

  const RELEASE = '20260717-HANDWASH-THUMB-RESCUE-R12';
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedHandwashThumbFetch(input, init) {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : String(input && input.url || '');

    if (!url.includes('handwash-who-v4.part2.txt')) return response;

    const source = await response.text();
    const hook = `function updateRub(phase,hands,dt){
if (hands.length < 2) {
coach('ต้องเห็นมือสองข้างเพื่อประเมินท่า WHO','hands');
decayEvidence(phase,dt);
return;
}`;

    const fix = `function updateRub(phase,hands,dt){
if (hands.length < 2) {
const elapsed=Number(state.stepTime[phase.id]||0);
const rescuePhase=phase.id==='fingertips'||phase.id==='thumbs';
const oneHandRescue=rescuePhase&&hands.length===1&&elapsed>2.5;
if(oneHandRescue){
const h=hands[0];
const rect=el.scrubZone.getBoundingClientRect();
const inZone=inRect(h.palm,rect);
const moving=h.motionScore>.035||h.speed>.015||h.turnScore>.04;
if(inZone&&moving){
const evidence=state.evidence[phase.id]||{};
const slot=Number(evidence.left||0)<.96?'left':'right';
ensureEvidence(phase,slot);
const baseGain=phase.id==='thumbs'?.58:.50;
const gain=dt*(elapsed>6?baseGain+.18:baseGain)/Math.max(1.35,phase.targetSec*.46);
state.evidence[phase.id][slot]=clamp(Number(state.evidence[phase.id][slot]||0)+gain,0,1);
state.activeSlot=slot;
state.foam=clamp(state.foam+dt*4.4,0,100);
state.foamPeak=Math.max(state.foamPeak,state.foam);
state.germLoad=Math.max(18,state.germLoad-dt*1.45);
addScore(dt*19,false);
hitZone(el.scrubZone);
coach(phase.id==='thumbs'?(slot==='left'?'โหมดช่วยหัวแม่มือ ✅ กำรอบนิ้วแล้วหมุนต่อ':'ข้างแรกผ่านแล้ว ✅ ทำซ้ำอีกข้าง'):(slot==='left'?'โหมดมือเดียว ✅ หมุนปลายนิ้วเป็นวงต่อ':'ข้างแรกผ่านแล้ว ✅ ทำซ้ำอีกข้าง'),'good');
if(rubDone(phase)) completeRub(phase,'assist');
}else{
coach(phase.id==='thumbs'?'วางมือในกรอบสีเหลือง • กำรอบหัวแม่มือแล้วหมุน':'วางมือในกรอบสีเหลือง • หมุนปลายนิ้วเป็นวง','hands');
}
return;
}
coach(rescuePhase?'ยกมือหนึ่งข้างเข้ากรอบ • ระบบจะช่วยตรวจทีละข้าง':'ต้องเห็นมือสองข้างเพื่อประเมินท่า WHO','hands');
decayEvidence(phase,dt);
return;
}`;

    let patched = source;

    if (patched.includes(hook)) {
      patched = patched.replace(hook, fix);
    } else if (!patched.includes("const rescuePhase=phase.id==='fingertips'||phase.id==='thumbs';")) {
      console.warn('[Handwash R12] updateRub hook not found');
    }

    const eligibleHook = "const eligible=evaluation.inZone&&evaluation.contactOK&&evaluation.poseOK&&evaluation.motionOK&&evaluation.score>=threshold;";
    const eligibleFix = "const adaptive=elapsed>(DIFF==='easy'?2.5:4.2);const coreOK=[evaluation.contactOK,evaluation.poseOK,evaluation.motionOK].filter(Boolean).length;const thumbAssist=phase.id==='thumbs'&&elapsed>3.5&&evaluation.inZone&&evaluation.motion>.06&&evaluation.score>=Math.max(.24,threshold-.24);const fingertipAssist=phase.id==='fingertips'&&elapsed>4&&evaluation.contact>.20&&evaluation.motion>.06;const eligible=evaluation.inZone&&(thumbAssist||fingertipAssist||(adaptive?(coreOK>=2&&evaluation.score>=Math.max(.27,threshold-.19)):(coreOK===3&&evaluation.score>=threshold)));";
    if (patched.includes(eligibleHook)) patched = patched.replace(eligibleHook, eligibleFix);

    const gainHook = "const gain=dt*(.48+.52*evaluation.score)/phase.targetSec;";
    const gainFix = "const rescueBoost=phase.id==='thumbs'?1.58:phase.id==='fingertips'?1.68:1;const gain=dt*(.72+.62*evaluation.score)*rescueBoost/Math.max(1.45,phase.targetSec*.56);";
    if (patched.includes(gainHook)) patched = patched.replace(gainHook, gainFix);

    console.info('[Handwash R12] thumb rescue installed');
    document.documentElement.dataset.handwashThumbRescue = RELEASE;

    return new Response(patched, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();
