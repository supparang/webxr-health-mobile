(() => {
'use strict';
const RELEASE='20260717-HANDWASH-CANONICAL-WHO-V4-R3';
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
gate.searchParams.set('phase','cooldown');gate.searchParams.set('game','handwash');gate.searchParams.set('gameId','handwash');gate.searchParams.set('zone','hygiene');gate.searchParams.set('zoneReturn',ZONE_URL);gate.searchParams.set('next',ZONE_URL);gate.searchParams.set('return',ZONE_URL);gate.searchParams.set('back',ZONE_URL);gate.searchParams.set('hub',ZONE_URL);gate.searchParams.set('cv','${RELEASE}');
location.href=gate.toString();
}
function goZone(){stopCamera();location.href=ZONE_URL}`;
const files=[1,2,3,4].map(n=>`./handwash-who-v4.part${n}.txt?cv=${RELEASE}`);
installLayout();document.documentElement.dataset.handwashRuntime='loading';
Promise.all(files.map(url=>fetch(url,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`load failed ${r.status}: ${url}`);return r.text()}))).then(parts=>{
const source=parts.join('');
const valid=source.trimStart().startsWith('(() => {')&&source.trimEnd().endsWith('})();')&&source.includes(RUNTIME_MARKER)&&source.includes(DOM_HOOK)&&source.includes(PHASE_HOOK)&&source.includes(SUMMARY_HOOK)&&source.includes(GO_HOOK)&&source.length>40000;
if(!valid)throw new Error('WHO runtime integrity check failed');
let runtime=source.replace(DOM_HOOK,DOM_FIX).replace(PHASE_HOOK,PHASE_FIX).replace(SUMMARY_HOOK,SUMMARY_FIX).replace(GO_HOOK,GO_FIX);
if(runtime.includes(ZONE_HOOK))runtime=runtime.replace(ZONE_HOOK,ZONE_FIX);
const blobUrl=URL.createObjectURL(new Blob([runtime],{type:'text/javascript;charset=utf-8'}));
const script=document.createElement('script');script.src=blobUrl;script.async=false;script.dataset.handwashWhoRuntime=RELEASE;
script.onload=()=>{document.documentElement.dataset.handwashRuntime='ready';enableStart();URL.revokeObjectURL(blobUrl)};
script.onerror=()=>{URL.revokeObjectURL(blobUrl);showFailure('compiled runtime could not start')};document.head.appendChild(script);
}).catch(error=>showFailure(error?.message||String(error)));
function enableStart(){const b=document.getElementById('startBtn');if(b){b.disabled=false;b.textContent='เริ่ม WHO Technique'}}
function showFailure(message){console.error('Handwash WHO loader',message);document.documentElement.dataset.handwashRuntime='failed';const s=document.getElementById('detectStatus');if(s)s.textContent='โหลดเกมไม่สำเร็จ';const b=document.getElementById('startBtn');if(b){b.disabled=false;b.textContent='แตะเพื่อลองโหลดใหม่';b.onclick=()=>location.reload()}const t=document.getElementById('toast');if(t){t.textContent='โหลด WHO Technique ไม่สำเร็จ กรุณารีเฟรช';t.classList.add('show')}}
function installLayout(){const style=document.createElement('style');style.id='handwashCanonicalR3Layout';style.textContent=`
:root{--hw-side:clamp(14px,2.2vw,34px)}
#scrubZone{top:60%!important;left:50%!important;width:min(52vw,760px)!important;height:min(42vh,410px)!important;min-width:420px;min-height:250px;transform:translate(-50%,-50%)!important;border-radius:38px!important}
html[data-handwash-phase="calibrate"] #scrubZone{top:60%!important;width:min(66vw,940px)!important;height:min(50vh,500px)!important;border-radius:44px!important;background:rgba(255,226,123,.10)!important}
#waterZone{top:34%!important;left:50%!important;width:140px!important;height:108px!important}#soapZone{left:var(--hw-side)!important;bottom:156px!important;width:126px!important;height:112px!important}#towelZone{right:var(--hw-side)!important;bottom:156px!important;width:126px!important;height:112px!important}
.coach{top:42%!important;right:var(--hw-side)!important;width:min(300px,28vw)!important;max-height:34vh;overflow:auto}.who-strip{min-height:48px}.phase-chip{min-width:82px!important;font-size:10px!important;line-height:1.2!important;padding:7px 8px!important}html[data-handwash-runtime="loading"] #startBtn{opacity:.72;cursor:wait}
@media(max-width:900px){#scrubZone{top:58%!important;width:72vw!important;height:36vh!important;min-width:0;min-height:220px}.coach{top:auto!important;right:12px!important;bottom:174px!important;width:min(320px,44vw)!important}.phase-chip{min-width:76px!important}}
@media(max-width:760px){#scrubZone{top:56%!important;width:84vw!important;height:33vh!important;min-height:210px}html[data-handwash-phase="calibrate"] #scrubZone{top:55%!important;width:90vw!important;height:39vh!important}#waterZone{top:31%!important;width:112px!important;height:88px!important}#soapZone{left:10px!important;bottom:168px!important;width:98px!important;height:92px!important}#towelZone{right:10px!important;bottom:168px!important;width:98px!important;height:92px!important}.coach{right:10px!important;bottom:166px!important;width:min(62vw,286px)!important;max-height:24vh}.who-strip{min-height:44px}.phase-chip{min-width:70px!important;font-size:9px!important}.overlay{place-items:start center!important}.card{margin:auto 0;max-height:calc(100dvh - 24px);overflow:auto}.card h2{font-size:clamp(24px,8vw,34px)!important}}
@media(max-width:480px){#scrubZone{top:55%!important;width:88vw!important;height:30vh!important;min-height:190px}.coach{width:65vw!important}.zone b{font-size:28px!important}.zone span{font-size:8px!important}}
`;document.head.appendChild(style)}
})();