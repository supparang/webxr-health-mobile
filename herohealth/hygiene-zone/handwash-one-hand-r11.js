(() => {
  'use strict';

  const RELEASE = '20260717-HANDWASH-ONE-HAND-R11';
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedHandwashFetch(input, init) {
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
const oneHandRescue=phase.id==='fingertips'&&hands.length===1&&elapsed>3;
if(oneHandRescue){
const h=hands[0];
const rect=el.scrubZone.getBoundingClientRect();
const inZone=inRect(h.palm,rect);
const moving=h.motionScore>.045||h.speed>.018;
if(inZone&&moving){
const evidence=state.evidence[phase.id]||{};
const slot=Number(evidence.left||0)<.96?'left':'right';
ensureEvidence(phase,slot);
const gain=dt*(elapsed>7?.62:.46)/Math.max(1.5,phase.targetSec*.52);
state.evidence[phase.id][slot]=clamp(Number(state.evidence[phase.id][slot]||0)+gain,0,1);
state.activeSlot=slot;
state.foam=clamp(state.foam+dt*4.2,0,100);
state.foamPeak=Math.max(state.foamPeak,state.foam);
state.germLoad=Math.max(18,state.germLoad-dt*1.35);
addScore(dt*18,false);
hitZone(el.scrubZone);
coach(slot==='left'?'โหมดมือเดียว ✅ หมุนปลายนิ้วเป็นวงต่ออีกนิด':'ข้างแรกผ่านแล้ว ✅ ใช้มือนี้ทำท่าซ้ำแทนอีกข้าง','good');
if(rubDone(phase)) completeRub(phase,'assist');
}else{
coach('โหมดมือเดียว • วางมือในกรอบสีเหลืองแล้วหมุนปลายนิ้วเป็นวง','hands');
}
return;
}
coach(phase.id==='fingertips'?'ยกมือหนึ่งข้างเข้ากรอบ • ระบบจะช่วยตรวจทีละข้าง':'ต้องเห็นมือสองข้างเพื่อประเมินท่า WHO','hands');
decayEvidence(phase,dt);
return;
}`;

    if (!source.includes(hook)) {
      console.warn('[Handwash R11] updateRub hook not found');
      return new Response(source, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }

    const patched = source.replace(hook, fix);
    console.info('[Handwash R11] one-hand rescue installed');
    document.documentElement.dataset.handwashOneHand = RELEASE;

    return new Response(patched, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  };
})();
