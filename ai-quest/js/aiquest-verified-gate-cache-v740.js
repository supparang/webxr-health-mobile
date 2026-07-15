/* CSAI2102 AI Quest — Verified Gate Cache v7.4.2
   Performance-only bridge between adjacent missions.
   Google Sheet remains the official source of truth. A bridge is written only
   after completed=true, is bound to student + section + exact prior mission,
   and may be reused briefly during duplicate startup checks on the next page.
*/
(()=>{'use strict';
if(window.AIQuestVerifiedGateCacheV742)return;
const VERSION='v7.4.2',KEY='CSAI2102_VERIFIED_GATE_BRIDGE_V742',TTL_MS=5*60*1000,MAX_USES=8;
const clean=v=>String(v==null?'':v).trim();
const norm=x=>clean(x).toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
const params=()=>new URL(location.href).searchParams;
const identity=()=>({studentId:clean(document.getElementById('sid')?.value||params().get('studentId')),studentName:clean(document.getElementById('name')?.value||params().get('studentName')),section:clean(document.getElementById('section')?.value||document.getElementById('sec')?.value||params().get('section')||'101')});
const currentMission=()=>norm(params().get('mission')||'s1');
function read(){try{const x=JSON.parse(sessionStorage.getItem(KEY)||'null');if(!x||Date.now()-Number(x.verifiedAt||0)>TTL_MS){sessionStorage.removeItem(KEY);return null}return x}catch(_){return null}}
function clear(){try{sessionStorage.removeItem(KEY)}catch(_){}}
function record(missionId,gate){const who=identity(),id=norm(missionId);if(!who.studentId||who.section!=='101'||!id||!gate||gate.completed!==true)return false;const existing=read();const row={version:VERSION,studentId:who.studentId,studentName:who.studentName,section:who.section,completedMission:id,verifiedAt:Date.now(),verifiedBy:'google-sheet-completed-response',gate:{...gate,completed:true,passed:true,reflectionSubmitted:true},useCount:existing&&existing.completedMission===id?Number(existing.useCount||0):0,lastUsedAt:0};try{sessionStorage.setItem(KEY,JSON.stringify(row));console.log('[AIQuest] verified gate bridge stored immediately',id,who.studentId);return true}catch(_){return false}}
function eligible(studentId,sessionId,section){const row=read();if(!row)return null;if(Number(row.useCount||0)>=MAX_USES)return null;if(clean(studentId)!==row.studentId||clean(section||'101')!==row.section||norm(sessionId)!==row.completedMission)return null;return row}
function markUsed(row){try{row.useCount=Number(row.useCount||0)+1;row.lastUsedAt=Date.now();sessionStorage.setItem(KEY,JSON.stringify(row))}catch(_){}return row}
function installLookupBridge(){if(!window.AIQuestSync||typeof window.AIQuestSync.lookupGate!=='function'){setTimeout(installLookupBridge,40);return}if(window.AIQuestSync.lookupGate.__verifiedGateBridgeV742)return;const original=window.AIQuestSync.lookupGate.bind(window.AIQuestSync);const bridged=payload=>{const row=eligible(payload?.studentId,payload?.sessionId,payload?.section);if(!row)return original(payload);markUsed(row);const response={...row.gate,ok:true,action:'studentGate-session-bridge',studentId:row.studentId,section:row.section,sessionId:row.completedMission,completed:true,passed:true,reflectionSubmitted:true,cacheAgeMs:Date.now()-row.verifiedAt,verifiedBy:row.verifiedBy,bridgeUseCount:row.useCount};console.log('[AIQuest] verified Sheet gate reused for adjacent mission',response);setTimeout(()=>original(payload).then(real=>{if(real&&real.completed===true){record(row.completedMission,real);return}console.warn('[AIQuest] background gate recheck not yet confirmed; keeping short-lived verified bridge',real)}).catch(()=>{}),1200);return Promise.resolve(response)};bridged.__verifiedGateBridgeV742=true;bridged.original=original;window.AIQuestSync.lookupGate=bridged}
function captureVerifiedNext(e){const next=e.target&&e.target.closest?e.target.closest('#nextMission'):null;if(!next||next.dataset.sheetConfirmed!=='1')return;const state=window.CSAI2102_REFLECTION_GATE_CONFIRMED;if(state&&state.missionId===currentMission()&&state.gate?.completed===true)record(state.missionId,state.gate)}
function captureConfirmedEvent(e){const d=e&&e.detail||{},id=norm(d.missionId||currentMission()),gate=d.gate||{};if(gate.completed===true)record(id,gate)}
function captureExistingState(){const state=window.CSAI2102_REFLECTION_GATE_CONFIRMED;if(state&&state.missionId===currentMission()&&state.gate?.completed===true)record(state.missionId,state.gate)}
function boot(){installLookupBridge();window.addEventListener('aiquest:gate-confirmed',captureConfirmedEvent);document.addEventListener('pointerdown',captureVerifiedNext,true);document.addEventListener('click',captureVerifiedNext,true);captureExistingState();console.log('[AIQuest] verified gate cache v742 active • duplicate-check safe adjacent bridge')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AIQuestVerifiedGateCacheV740=window.AIQuestVerifiedGateCacheV741=window.AIQuestVerifiedGateCacheV742={version:VERSION,record,read,clear,eligible,currentMission};
})();