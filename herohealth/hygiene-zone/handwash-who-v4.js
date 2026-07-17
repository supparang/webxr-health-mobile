(() => {
'use strict';
const RELEASE='20260717-HANDWASH-KID-COACH-R5';
const RUNTIME_MARKER='20260716-HANDWASH-WHO-V4-R1';
const DOM_HOOK="document.addEventListener('DOMContentLoaded', init);";
const DOM_FIX="if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init,{once:true});}else{init();}";
const ZONE_HOOK="const ZONE_URL = qs.get('zone') || '../hygiene-zone-v2.html';";
const ZONE_FIX="const ZONE_URL=qs.get('zoneReturn')||qs.get('return')||qs.get('back')||'../hygiene-zone.html';";
const PHASE_HOOK='state.phase = id;';
const PHASE_FIX="state.phase=id;document.documentElement.dataset.handwashPhase=id;";
const SUMMARY_HOOK='el.summaryZoneBtn.onclick = goZone;';
const SUMMARY_FIX='el.summaryZoneBtn.onclick = goCooldown;';
const GO_HOOK='function goZone(){stopCamera();location.href=ZONE_URL}';
const GO_FIX=`function goCooldown(){
stopCamera();
const gate=new URL('../warmup-gate.html',location.href);
const keep=['pid','name','nick','studentId','playerId','classId','classLevel','section','diff','view','mode','studyId','conditionGroup','session_code','log','api','seed','sheet'];
keep.forEach(k=>{const v=qs.get(k);if(v)gate.searchParams.set(k,v)});
gate.searchParams.set('phase','cooldown');gate.searchParams.set('game','handwash');gate.searchParams.set('gameId','handwash');gate.searchParams.set('zone','hygiene');gate.searchParams.set('zoneReturn',ZONE_URL);gate.searchParams.set('next',ZONE_URL);gate.searchParams.set('cv','${RELEASE}');
location.href=gate.toString();
}
function goZone(){stopCamera();location.href=ZONE_URL}`;
const ELIGIBLE_HOOK="const eligible=evaluation.inZone&&evaluation.contactOK&&evaluation.poseOK&&evaluation.motionOK&&evaluation.score>=threshold;";
const ELIGIBLE_FIX="const adaptive=elapsed>(DIFF==='easy'?3.5:5.5);const coreOK=[evaluation.contactOK,evaluation.poseOK,evaluation.motionOK].filter(Boolean).length;const eligible=evaluation.inZone&&(adaptive?(coreOK>=2&&evaluation.score>=Math.max(.36,threshold-.10)):(coreOK===3&&evaluation.score>=threshold));";
const GAIN_HOOK="const gain=dt*(.48+.52*evaluation.score)/phase.targetSec;";
const GAIN_FIX="const gain=dt*(.62+.58*evaluation.score)/Math.max(2.0,phase.targetSec*.68);";
const QUALITY_HOOK="const contactOK=contact>.41,poseOK=pose>.39,motionOK=trajectory>.32&&motion>.19;";
const QUALITY_FIX="const contactOK=contact>.34,poseOK=pose>.32,motionOK=trajectory>.25&&motion>.13;";
const TIP_HOOK='el.missionTip.textContent=phase.tip;';
const TIP_FIX="el.missionTip.textContent=kidGuide(phase.id,'start');";
const DECAY_HOOK="state.evidence[phase.id][slot]=Math.max(0,state.evidence[phase.id][slot]-dt*.025);";
const DECAY_FIX="state.evidence[phase.id][slot]=Math.max(0,state.evidence[phase.id][slot]-dt*.003);";
const COACH_HOOK=`function coachMessage(phase,reason,slot){
if (!reason) return phase.side&&slot?\`ดีมาก ทำข้าง \${slotLabel(slot)} ต่อเนื่อง แล้วสลับอีกข้าง\`:phase.tip;
if (reason==='zone') return 'นำมือทั้งสองข้างเข้ากลาง WHO RUB ZONE';
if (reason==='contact') return 'ให้พื้นผิวมือสัมผัสกันมากขึ้นตามภาพท่า';
if (reason==='pose') return 'จัดรูปมือและทิศฝ่ามือให้ตรงกับท่า WHO';
if (reason==='motion') return phase.id==='thumbs'||phase.id==='fingertips'?'หมุนถูเป็นวงให้ต่อเนื่อง':'ถูไป–กลับให้ต่อเนื่อง';
if (reason==='switch') return 'ทำอีกข้างและสลับมือให้ครบ';
return phase.tip;
}`;
const COACH_FIX=`function kidGuide(id,reason,slot){
const guides={
palm:'1) ประกบฝ่ามือ  2) กางนิ้วสบาย ๆ  3) ถูซ้าย–ขวาช้า ๆ',
dorsum:'1) วางฝ่ามือบนหลังมืออีกข้าง  2) สอดนิ้วเข้าซอก  3) ถูไป–กลับแล้วสลับข้าง',
interlaced:'1) ประกบฝ่ามือ  2) สอดนิ้วประสานกัน  3) ถูซอกนิ้วไป–กลับ',
backsFingers:'1) งอนิ้วเข้าหากัน  2) วางหลังนิ้วบนฝ่ามือ  3) ถูไป–กลับเบา ๆ',
thumbs:'1) กำรอบหัวแม่มือ  2) หมุนรอบนิ้วเป็นวง  3) ทำอีกข้าง',
fingertips:'1) จีบปลายนิ้วรวมกัน  2) วางบนฝ่ามืออีกข้าง  3) หมุนเป็นวงแล้วสลับข้าง'
};
const base=guides[id]||'ทำตามท่าบนจออย่างช้า ๆ';
if(reason==='zone')return 'ย้ายมือทั้งสองข้างให้อยู่ในกรอบสีเหลืองก่อน • '+base;
if(reason==='contact')return 'ขยับมือให้แตะกันจริง แล้วทำต่อ • '+base;
if(reason==='pose')return 'หยุดก่อน 1 วินาที จัดรูปมือใหม่ • '+base;
if(reason==='motion')return (id==='thumbs'||id==='fingertips'?'หมุนเป็นวงช้า ๆ ให้เห็นชัด • ':'ถูไป–กลับช้า ๆ ระยะสั้น • ')+base;
if(reason==='switch')return 'ข้างแรกผ่านแล้ว ✅ ตอนนี้สลับทำอีกข้าง';
if(slot)return 'จับท่าได้แล้ว ✅ ทำข้าง '+slotLabel(slot)+' ต่ออีกนิด'+(id==='dorsum'||id==='thumbs'||id==='fingertips'?' แล้วระบบจะให้สลับข้าง':'');
return base;
}
function coachMessage(phase,reason,slot){return kidGuide(phase.id,reason,slot)}`;
const files=[1,2,3,4].map(n=>`./handwash-who-v4.part${n}.txt?cv=${RELEASE}`);
installLayout();document.documentElement.dataset.handwashRuntime='loading';
Promise.all(files.map(url=>fetch(url,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`load failed ${r.status}: ${url}`);return r.text()}))).then(parts=>{
const source=parts.join('');
const required=[RUNTIME_MARKER,DOM_HOOK,PHASE_HOOK,SUMMARY_HOOK,GO_HOOK,ELIGIBLE_HOOK,GAIN_HOOK,QUALITY_HOOK,TIP_HOOK,DECAY_HOOK,COACH_HOOK];
const valid=source.trimStart().startsWith('(() => {')&&source.trimEnd().endsWith('})();')&&required.every(x=>source.includes(x))&&source.length>40000;
if(!valid)throw new Error('WHO Kid Coach runtime integrity check failed');
let runtime=source.replace(DOM_HOOK,DOM_FIX).replace(PHASE_HOOK,PHASE_FIX).replace(SUMMARY_HOOK,SUMMARY_FIX).replace(GO_HOOK,GO_FIX).replace(ELIGIBLE_HOOK,ELIGIBLE_FIX).replace(GAIN_HOOK,GAIN_FIX).replace(QUALITY_HOOK,QUALITY_FIX).replace(TIP_HOOK,TIP_FIX).replace(DECAY_HOOK,DECAY_FIX).replace(COACH_HOOK,COACH_FIX);
if(runtime.includes(ZONE_HOOK))runtime=runtime.replace(ZONE_HOOK,ZONE_FIX);
const blobUrl=URL.createObjectURL(new Blob([runtime],{type:'text/javascript;charset=utf-8'}));
const script=document.createElement('script');script.src=blobUrl;script.async=false;script.dataset.handwashWhoRuntime=RELEASE;
script.onload=()=>{document.documentElement.dataset.handwashRuntime='ready';enableStart();URL.revokeObjectURL(blobUrl)};
script.onerror=()=>{URL.revokeObjectURL(blobUrl);showFailure('compiled runtime could not start')};document.head.appendChild(script);
}).catch(error=>showFailure(error?.message||String(error)));
function enableStart(){const b=document.getElementById('startBtn');if(b){b.disabled=false;b.textContent='เริ่ม WHO Technique • Kid Coach'}}
function showFailure(message){console.error('Handwash WHO loader',message);document.documentElement.dataset.handwashRuntime='failed';const s=document.getElementById('detectStatus');if(s)s.textContent='โหลดเกมไม่สำเร็จ';const b=document.getElementById('startBtn');if(b){b.disabled=false;b.textContent='แตะเพื่อลองโหลดใหม่';b.onclick=()=>location.reload()}const t=document.getElementById('toast');if(t){t.textContent='โหลด WHO Technique ไม่สำเร็จ กรุณารีเฟรช';t.classList.add('show')}}
function installLayout(){const style=document.createElement('style');style.id='handwashKidCoachR5Layout';style.textContent=`
:root{--hw-side:clamp(14px,2.2vw,34px)}
#scrubZone{top:60%!important;left:50%!important;width:min(55vw,790px)!important;height:min(43vh,420px)!important;min-width:430px;min-height:260px;transform:translate(-50%,-50%)!important;border-radius:38px!important}
html[data-handwash-phase="calibrate"] #scrubZone{top:60%!important;width:min(68vw,960px)!important;height:min(51vh,510px)!important;border-radius:44px!important;background:rgba(255,226,123,.10)!important}
#waterZone{top:34%!important;left:50%!important;width:140px!important;height:108px!important}#soapZone{left:var(--hw-side)!important;bottom:156px!important;width:126px!important;height:112px!important}#towelZone{right:var(--hw-side)!important;bottom:156px!important;width:126px!important;height:112px!important}
.coach{top:39%!important;right:var(--hw-side)!important;width:min(340px,31vw)!important;max-height:38vh;overflow:auto;border:2px solid rgba(255,226,123,.48)!important}.coach strong{font-size:12px!important}.coach p{font-size:clamp(12px,1.9vw,16px)!important;line-height:1.5!important}.who-strip{min-height:48px}.phase-chip{min-width:82px!important;font-size:10px!important;line-height:1.2!important;padding:7px 8px!important}html[data-handwash-runtime="loading"] #startBtn{opacity:.72;cursor:wait}
@media(max-width:900px){#scrubZone{top:58%!important;width:74vw!important;height:37vh!important;min-width:0;min-height:225px}.coach{top:auto!important;right:12px!important;bottom:174px!important;width:min(350px,48vw)!important}.phase-chip{min-width:76px!important}}
@media(max-width:760px){#scrubZone{top:55%!important;width:88vw!important;height:34vh!important;min-height:215px}html[data-handwash-phase="calibrate"] #scrubZone{top:54%!important;width:92vw!important;height:40vh!important}#waterZone{top:31%!important;width:112px!important;height:88px!important}#soapZone{left:10px!important;bottom:168px!important;width:98px!important;height:92px!important}#towelZone{right:10px!important;bottom:168px!important;width:98px!important;height:92px!important}.coach{right:8px!important;bottom:158px!important;width:min(76vw,330px)!important;max-height:27vh}.coach p{font-size:13px!important}.who-strip{min-height:44px}.phase-chip{min-width:70px!important;font-size:9px!important}.overlay{place-items:start center!important}.card{margin:auto 0;max-height:calc(100dvh - 24px);overflow:auto}.card h2{font-size:clamp(24px,8vw,34px)!important}}
@media(max-width:480px){#scrubZone{top:54%!important;width:91vw!important;height:31vh!important;min-height:195px}.coach{width:80vw!important}.zone b{font-size:28px!important}.zone span{font-size:8px!important}}
`;document.head.appendChild(style)}
})();