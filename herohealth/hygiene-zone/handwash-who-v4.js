(() => {
'use strict';
const RELEASE='20260717-HANDWASH-FINAL-R7';
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
const ELIGIBLE_FIX="const adaptive=elapsed>(DIFF==='easy'?3.0:5.0);const coreOK=[evaluation.contactOK,evaluation.poseOK,evaluation.motionOK].filter(Boolean).length;const fingertipAssist=phase.id==='fingertips'&&elapsed>4&&evaluation.contact>.24&&evaluation.motion>.08;const eligible=evaluation.inZone&&(fingertipAssist||(adaptive?(coreOK>=2&&evaluation.score>=Math.max(.30,threshold-.16)):(coreOK===3&&evaluation.score>=threshold)));";
const SLOT_HOOK="const slot=phase.side?evaluation.slot:'both';";
const SLOT_FIX="const slot=phase.side?(evaluation.slot||(phase.id==='fingertips'&&elapsed>5?(state.activeSlot==='left'?'right':'left') :'')):'both';";
const GAIN_HOOK="const gain=dt*(.48+.52*evaluation.score)/phase.targetSec;";
const GAIN_FIX="const finalBoost=phase.id==='fingertips'?1.65:phase.id==='thumbs'?1.28:1;const gain=dt*(.70+.60*evaluation.score)*finalBoost/Math.max(1.7,phase.targetSec*.62);";
const QUALITY_HOOK="const contactOK=contact>.41,poseOK=pose>.39,motionOK=trajectory>.32&&motion>.19;";
const QUALITY_FIX="const finalStep=phase.id==='fingertips';const contactOK=contact>(finalStep?.24:.33),poseOK=pose>(finalStep?.22:.31),motionOK=trajectory>(finalStep?.18:.24)&&motion>(finalStep?.08:.12);";
const TIP_HOOK='el.missionTip.textContent=phase.tip;';
const TIP_FIX="el.missionTip.textContent=kidGuide(phase.id,'start');";
const DECAY_HOOK="state.evidence[phase.id][slot]=Math.max(0,state.evidence[phase.id][slot]-dt*.025);";
const DECAY_FIX="state.evidence[phase.id][slot]=Math.max(0,state.evidence[phase.id][slot]-dt*.001);";
const TIMEOUT_HOOK=`state.timeoutTimer = setTimeout(() => {
if (state.running) finishRun('timeup');
}, 90000);`;
const TIMEOUT_FIX=`const requested=Number(qs.get('time')||0);const mode=String(qs.get('roundMode')||qs.get('playMode')||'').toLowerCase();const roundLimitSec=requested>=90?Math.min(240,requested):mode==='challenge'?90:mode==='standard'?120:180;window.HH_HANDWASH_ROUND_LIMIT_SEC=roundLimitSec;state.timeoutTimer=setTimeout(()=>{if(state.running)finishRun('timeup')},roundLimitSec*1000);showToast('รอบนี้มีเวลา '+roundLimitSec+' วินาที • ทำช้า ๆ ตาม Coach');`;
const WET_HOOK=`if (phase.id === 'wet') {
if (state.waterOn && inWater >= 2) {
state.phaseProgress += dt/phase.targetSec;
state.germLoad = Math.max(96,state.germLoad-dt*.5);
hitZone(el.waterZone);
coach('WHO 0: ทำให้มือทั้งสองข้างเปียกทั่ว','good');
} else coach(state.waterOn?'นำมือสองข้างเข้าใต้น้ำ':'เปิดน้ำก่อน แล้วนำมือสองข้างเข้าใต้น้ำ','water');
}`;
const WATER_FIX=`if (phase.id === 'wet') {
const r=el.waterZone.getBoundingClientRect();const area={left:r.left-r.width*.9,right:r.right+r.width*.9,top:r.top-r.height*.15,bottom:r.bottom+r.height*2};const n=palms.filter(p=>inRect(p,area)).length;
if(state.waterOn&&n>=1){state.phaseProgress+=dt*(n>=2?1.55:1.05)/Math.max(1.7,phase.targetSec*.68);state.germLoad=Math.max(96,state.germLoad-dt*.5);hitZone(el.waterZone);coach(n>=2?'น้ำโดนมือสองข้างแล้ว ✅ ค้างอีกนิด':'น้ำโดนหนึ่งมือแล้ว ✅ เลื่อนอีกมือเข้ามา','good')}else if(state.waterOn&&hands.length){state.phaseProgress+=dt*.22;coach('เปิดน้ำแล้ว ✅ เลื่อนฝ่ามือมาใต้สายน้ำกลางจอ','water')}else coach(state.waterOn?'เลื่อนฝ่ามือมาใต้สายน้ำกลางจอ':'กดปุ่ม เปิดน้ำ ก่อน','water')
}`;
const RINSE_HOOK=`if (phase.id === 'rinse') {
if (state.waterOn && inWater >= 2) {
state.phaseProgress += dt/phase.targetSec;
state.foam = Math.max(0,state.foam-dt*25);
state.germLoad = Math.max(4,state.germLoad-dt*4.5);
hitZone(el.waterZone);
coach('WHO 8: ล้างสบู่ออกจากมือให้หมด','good');
} else coach(state.waterOn?'นำมือสองข้างเข้าใต้น้ำเพื่อล้างฟอง':'เปิดน้ำเพื่อล้างฟอง','water');
}`;
const RINSE_FIX=`if (phase.id === 'rinse') {
const r=el.waterZone.getBoundingClientRect();const area={left:r.left-r.width*.9,right:r.right+r.width*.9,top:r.top-r.height*.15,bottom:r.bottom+r.height*2};const n=palms.filter(p=>inRect(p,area)).length;
if(state.waterOn&&n>=1){state.phaseProgress+=dt*(n>=2?1.55:1.05)/Math.max(1.8,phase.targetSec*.62);state.foam=Math.max(0,state.foam-dt*(n>=2?34:23));state.germLoad=Math.max(4,state.germLoad-dt*5);hitZone(el.waterZone);coach(n>=2?'WHO 8: ล้างครบสองมือ ✅ ค้างอีกนิด':'ล้างมือแรกแล้ว ✅ เลื่อนอีกมือใต้สายน้ำ','good')}else if(state.waterOn&&hands.length){state.phaseProgress+=dt*.18;coach('เปิดน้ำแล้ว • เลื่อนมือเข้าแนวน้ำสีฟ้า','water')}else coach(state.waterOn?'เลื่อนมือเข้าแนวน้ำสีฟ้า':'กดเปิดน้ำเพื่อล้างฟอง','water')
}`;
const TOWEL_HOOK=`if (phase.id === 'towelFaucet') {
if (!state.towelHeld) {
coach('หยิบกระดาษที่ใช้เช็ดมือก่อน','towel');
} else if (state.waterOn && inWater >= 1) {
state.phaseProgress += dt/phase.targetSec;
hitZone(el.waterZone);
coach('WHO 10: ใช้กระดาษปิดก๊อก ไม่สัมผัสก๊อกด้วยมือสะอาด','good');
} else if (!state.waterOn) {
coach('ก๊อกถูกปิดก่อนใช้กระดาษ ระบบจะนับเป็นความเสี่ยงปนเปื้อนซ้ำ','contamination');
} else coach('ถือกระดาษแล้วนำมือไปบริเวณก๊อกน้ำ','towel');
}`;
const TOWEL_FIX=`if (phase.id === 'towelFaucet') {
if(!state.towelHeld){coach('ขั้น 1/3 • แตะกรอบกระดาษเพื่อหยิบกระดาษ','towel')}
else if(state.waterOn&&inWater>=1){state.phaseProgress+=dt/Math.max(1.2,phase.targetSec*.58);hitZone(el.waterZone);coach(state.phaseProgress<.34?'ขั้น 1/3 หยิบกระดาษแล้ว ✅ • นำกระดาษไปที่ก๊อก':state.phaseProgress<.72?'ขั้น 2/3 กระดาษแตะก๊อกแล้ว ✅ • ค้างไว้':'ขั้น 3/3 กำลังปิดก๊อก ✅','good')}
else if(state.waterOn){state.phaseProgress=Math.max(state.phaseProgress,.34);coach('ขั้น 1/3 ผ่าน ✅ • ถือกระดาษแล้วเลื่อนไปที่กรอบก๊อก','towel')}
else{state.phaseProgress=1;coach('ขั้น 3/3 ปิดก๊อกด้วยกระดาษสำเร็จ ✅','good')}
}`;
const FINGER_HOOK=`} else if (phase.id==='fingertips') {
const dAB=dist(a.tipsCenter,b.palm)/pair.scale,dBA=dist(b.tipsCenter,a.palm)/pair.scale;
slot=dAB<dBA?a.key:b.key;
contact=clamp((.77-Math.min(dAB,dBA))/.53,0,1);
pose=avgNumber([Math.max(a.fistScore,a.openScore*.42),Math.max(b.fistScore,b.openScore*.42)]);
trajectory=avgNumber([pair.circularity,motion]);
score=weighted([contact,.39,pose,.23,trajectory,.38]);`;
const FINGER_FIX=`} else if (phase.id==='fingertips') {
const dAB=dist(a.tipsCenter,b.palm)/pair.scale,dBA=dist(b.tipsCenter,a.palm)/pair.scale;
slot=dAB<dBA?a.key:b.key;const near=Math.min(dAB,dBA);
contact=clamp((1.02-near)/.78,0,1);pose=Math.max(.32,avgNumber([a.fistScore,b.fistScore,a.openScore*.35,b.openScore*.35]));trajectory=Math.max(pair.circularity*.82,motion*.88,pair.oscillation*.55);score=weighted([contact,.46,pose,.14,trajectory,.40]);`;
const TIME_SCORE_HOOK='const withinWhoTime=state.procedureSec>=40&&state.procedureSec<=60;';
const TIME_SCORE_FIX="const roundLimitSec=Number(window.HH_HANDWASH_ROUND_LIMIT_SEC||180);const withinWhoTime=state.procedureSec>0&&state.procedureSec<=roundLimitSec;";
const TARGET_HOOK='procedureDurationSec:round(state.procedureSec,2),targetDurationMinSec:40,targetDurationMaxSec:60,';
const TARGET_FIX='procedureDurationSec:round(state.procedureSec,2),targetDurationMinSec:0,targetDurationMaxSec:Number(window.HH_HANDWASH_ROUND_LIMIT_SEC||180),roundMode:Number(window.HH_HANDWASH_ROUND_LIMIT_SEC||180)<=90?\'challenge\':Number(window.HH_HANDWASH_ROUND_LIMIT_SEC||180)<=120?\'standard\':\'practice\',';
const SUMMARY_TITLE_HOOK="el.summaryTitle.textContent=result.passed?'ผ่าน WHO Handwashing Standard':result.techniquePassed?'ลำดับถูกต้อง แต่เวลายังไม่อยู่ในช่วง 40–60 วินาที':'ยังมีขั้น WHO ที่ควรฝึกเพิ่ม';";
const SUMMARY_TITLE_FIX="el.summaryTitle.textContent=result.passed?'ผ่านครบ WHO Handwashing 🎉':result.techniquePassed?'ทำครบทุกขั้นแล้ว • ลองลดเวลาในรอบถัดไป':'เกือบครบแล้ว • ดูขั้นที่มีคำว่า ควรฝึกเพิ่ม';";
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
const guides={palm:'1) ประกบฝ่ามือ  2) กางนิ้ว  3) ถูซ้าย–ขวาช้า ๆ',dorsum:'1) ฝ่ามือทับหลังมือ  2) สอดนิ้ว  3) ถูแล้วสลับข้าง',interlaced:'1) ประกบฝ่ามือ  2) ประสานนิ้ว  3) ถูซอกนิ้ว',backsFingers:'1) งอนิ้ว  2) หลังนิ้วแตะฝ่ามือ  3) ถูไป–กลับ',thumbs:'1) กำหัวแม่มือ  2) หมุนเป็นวง  3) สลับข้าง',fingertips:'1) จีบปลายนิ้ว  2) แตะกลางฝ่ามือ  3) หมุนวงเล็ก ๆ แล้วสลับข้าง'};
const base=guides[id]||'ทำตามคำแนะนำบนจอช้า ๆ';if(reason==='zone')return 'ย้ายมือเข้ากรอบสีเหลือง • '+base;if(reason==='contact')return id==='fingertips'?'ให้ปลายนิ้วแตะกลางฝ่ามือจริง ๆ • '+base:'ให้มือแตะกันจริง • '+base;if(reason==='pose')return 'หยุด 1 วินาที แล้วจัดมือใหม่ • '+base;if(reason==='motion')return id==='thumbs'||id==='fingertips'?'หมุนวงเล็ก ๆ ช้า ๆ ต่อเนื่อง • '+base:'ถูไป–กลับระยะสั้น • '+base;if(reason==='switch')return 'ข้างแรกผ่านแล้ว ✅ สลับทำอีกข้าง';if(slot)return 'จับท่าได้แล้ว ✅ ทำข้าง '+slotLabel(slot)+' ต่ออีกนิด';return base}
function coachMessage(phase,reason,slot){return kidGuide(phase.id,reason,slot)}`;
const files=[1,2,3,4].map(n=>`./handwash-who-v4.part${n}.txt?cv=${RELEASE}`);
installLayout();document.documentElement.dataset.handwashRuntime='loading';
Promise.all(files.map(url=>fetch(url,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`load failed ${r.status}: ${url}`);return r.text()}))).then(parts=>{
const source=parts.join('');
const required=[RUNTIME_MARKER,DOM_HOOK,PHASE_HOOK,SUMMARY_HOOK,GO_HOOK,ELIGIBLE_HOOK,SLOT_HOOK,GAIN_HOOK,QUALITY_HOOK,TIP_HOOK,DECAY_HOOK,TIMEOUT_HOOK,WET_HOOK,RINSE_HOOK,TOWEL_HOOK,FINGER_HOOK,TIME_SCORE_HOOK,TARGET_HOOK,SUMMARY_TITLE_HOOK,COACH_HOOK];
const valid=source.trimStart().startsWith('(() => {')&&source.trimEnd().endsWith('})();')&&required.every(x=>source.includes(x))&&source.length>40000;
if(!valid)throw new Error('WHO Final R7 runtime integrity check failed');
let runtime=source.replace(DOM_HOOK,DOM_FIX).replace(PHASE_HOOK,PHASE_FIX).replace(SUMMARY_HOOK,SUMMARY_FIX).replace(GO_HOOK,GO_FIX).replace(ELIGIBLE_HOOK,ELIGIBLE_FIX).replace(SLOT_HOOK,SLOT_FIX).replace(GAIN_HOOK,GAIN_FIX).replace(QUALITY_HOOK,QUALITY_FIX).replace(TIP_HOOK,TIP_FIX).replace(DECAY_HOOK,DECAY_FIX).replace(TIMEOUT_HOOK,TIMEOUT_FIX).replace(WET_HOOK,WATER_FIX).replace(RINSE_HOOK,RINSE_FIX).replace(TOWEL_HOOK,TOWEL_FIX).replace(FINGER_HOOK,FINGER_FIX).replace(TIME_SCORE_HOOK,TIME_SCORE_FIX).replace(TARGET_HOOK,TARGET_FIX).replace(SUMMARY_TITLE_HOOK,SUMMARY_TITLE_FIX).replace(COACH_HOOK,COACH_FIX);
if(runtime.includes(ZONE_HOOK))runtime=runtime.replace(ZONE_HOOK,ZONE_FIX);
const blobUrl=URL.createObjectURL(new Blob([runtime],{type:'text/javascript;charset=utf-8'}));const script=document.createElement('script');script.src=blobUrl;script.async=false;script.dataset.handwashWhoRuntime=RELEASE;script.onload=()=>{document.documentElement.dataset.handwashRuntime='ready';enableStart();URL.revokeObjectURL(blobUrl)};script.onerror=()=>{URL.revokeObjectURL(blobUrl);showFailure('compiled runtime could not start')};document.head.appendChild(script)
}).catch(error=>showFailure(error?.message||String(error)));
function enableStart(){const b=document.getElementById('startBtn');if(b){b.disabled=false;b.textContent='เริ่ม WHO Technique • Final R7'}}
function showFailure(message){console.error('Handwash WHO loader',message);document.documentElement.dataset.handwashRuntime='failed';const s=document.getElementById('detectStatus');if(s)s.textContent='โหลดเกมไม่สำเร็จ';const b=document.getElementById('startBtn');if(b){b.disabled=false;b.textContent='แตะเพื่อลองโหลดใหม่';b.onclick=()=>location.reload()}const t=document.getElementById('toast');if(t){t.textContent='โหลด WHO Final R7 ไม่สำเร็จ กรุณารีเฟรช';t.classList.add('show')}}
function installLayout(){const style=document.createElement('style');style.id='handwashFinalR7Layout';style.textContent=`
:root{--hw-side:clamp(14px,2.2vw,34px)}#scrubZone{top:60%!important;left:50%!important;width:min(57vw,820px)!important;height:min(44vh,430px)!important;min-width:430px;min-height:260px;transform:translate(-50%,-50%)!important;border-radius:38px!important}html[data-handwash-phase="calibrate"] #scrubZone{width:min(68vw,960px)!important;height:min(51vh,510px)!important}#waterZone{top:29%!important;left:50%!important;width:200px!important;height:210px!important;transform:translateX(-50%)!important;border-radius:34px!important}html[data-handwash-phase="wet"] #waterZone,html[data-handwash-phase="rinse"] #waterZone{height:280px!important;background:linear-gradient(180deg,rgba(87,223,255,.20),rgba(87,223,255,.05))!important}#soapZone{left:var(--hw-side)!important;bottom:156px!important;width:126px!important;height:112px!important}#towelZone{right:var(--hw-side)!important;bottom:156px!important;width:126px!important;height:112px!important}.coach{top:39%!important;right:var(--hw-side)!important;width:min(350px,32vw)!important;max-height:39vh;overflow:auto;border:2px solid rgba(255,226,123,.5)!important}.coach p{font-size:clamp(12px,1.9vw,16px)!important;line-height:1.5!important}.who-strip{min-height:48px}.phase-chip{min-width:82px!important;font-size:10px!important;padding:7px 8px!important}html[data-handwash-runtime="loading"] #startBtn{opacity:.72;cursor:wait}
@media(max-width:760px){#scrubZone{top:55%!important;width:91vw!important;height:35vh!important;min-width:0;min-height:215px}#waterZone{top:27%!important;width:160px!important;height:225px!important}html[data-handwash-phase="wet"] #waterZone,html[data-handwash-phase="rinse"] #waterZone{height:310px!important}.coach{right:8px!important;bottom:158px!important;top:auto!important;width:min(80vw,340px)!important;max-height:28vh}.coach p{font-size:13px!important}#soapZone{left:10px!important;bottom:168px!important;width:98px!important;height:92px!important}#towelZone{right:10px!important;bottom:168px!important;width:98px!important;height:92px!important}.overlay{place-items:start center!important}.card{margin:auto 0;max-height:calc(100dvh - 24px);overflow:auto}}
@media(max-width:480px){#scrubZone{top:54%!important;width:93vw!important;height:32vh!important}.coach{width:84vw!important}.zone b{font-size:28px!important}.zone span{font-size:8px!important}}
`;document.head.appendChild(style)}
})();