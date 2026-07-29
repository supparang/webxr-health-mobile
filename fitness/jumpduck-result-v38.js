(()=>{'use strict';
const q=new URLSearchParams(location.search);
const state={promptStartedAt:0,promptText:'',lastLane:'',samples:[],lastResponseAt:0};
const clampMs=ms=>Math.max(0,Math.min(9999,Math.round(ms)));
function averageReaction(){if(!state.samples.length)return 0;return Math.round(state.samples.reduce((sum,row)=>sum+row.ms,0)/state.samples.length)}
function beginPrompt(){const warning=document.getElementById('warning');if(!warning||!warning.classList.contains('show'))return;const text=String(warning.textContent||'').trim();if(!text)return;if(!state.promptStartedAt||text!==state.promptText){state.promptStartedAt=performance.now();state.promptText=text}}
function clearPrompt(){state.promptStartedAt=0;state.promptText=''}
function recordResponse(kind){if(!state.promptStartedAt)return;const now=performance.now(),ms=clampMs(now-state.promptStartedAt);if(ms<70||ms>6000)return;if(now-state.lastResponseAt<100)return;state.samples.push({ms,kind,prompt:state.promptText.slice(0,80)});state.lastResponseAt=now;clearPrompt()}
function applyReactionAnalytics(target){if(!target||typeof target!=='object')return target;const avgReactionMs=averageReaction();target.avgReactionMs=avgReactionMs;target.reactionSampleCount=state.samples.length;target.reactionSamples=state.samples.slice(0,60);target.reactionBasis=state.samples.length?'warning-to-first-detected-body-or-touch-response-v38':'no-detected-response-after-warning-v38';target.reactionStatus=state.samples.length?'measured':'not-observed';target.resultFlowVersion='jumpduck-result-v3.8';target.gameVersion='jumpduck-production-v3.8-result-polish';return target}
const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){try{const target=window.__JUMPDUCK_LAST_RESULT__||JSON.parse(String(value||'{}'));applyReactionAnalytics(target);value=JSON.stringify(target)}catch(_){}}return nativeSetItem.call(this,key,value)};
function reactionLabel(){const avg=averageReaction();return avg?`${avg} ms`:'ไม่ได้วัดในรอบนี้'}
function polishResult(){const result=document.getElementById('result'),card=result?.querySelector('.card'),text=document.getElementById('resultText'),sync=document.getElementById('syncText');if(!result||result.classList.contains('hidden'))return;requestAnimationFrame(()=>{try{card.scrollTop=0;result.scrollTop=0;scrollTo({top:0,left:0,behavior:'instant'})}catch(_){scrollTo(0,0)}});if(text){const base=String(text.textContent||'');text.textContent=/Reaction\s+[^•\n]*/i.test(base)?base.replace(/Reaction\s+[^•\n]*/i,`Reaction ${reactionLabel()}`):`${base}${base?' • ':''}Reaction ${reactionLabel()}`}
const direct=window.parent===window||!q.get('studentId');if(direct&&sync)sync.textContent='ทดสอบเกมสำเร็จ • พร้อมกลับ Passport';syncRetryVisibility()}
function syncRetryVisibility(){const done=document.getElementById('done'),sync=document.getElementById('syncText');if(!done||!sync)return;let text=String(sync.textContent||'');const direct=window.parent===window||!q.get('studentId');if(direct&&/เปิดแบบทดสอบตรง|ผลพร้อมส่ง/i.test(text)){sync.textContent='ทดสอบเกมสำเร็จ • พร้อมกลับ Passport';text=sync.textContent}
const failure=/ไม่สำเร็จ|ล้มเหลว|failed|error|ลองใหม่|ส่งผลอีกครั้ง/i.test(text);done.classList.toggle('show-on-error',failure);done.classList.toggle('hidden',!failure);if(failure)done.textContent='ลองส่งผลอีกครั้ง'}
function boot(){const warning=document.getElementById('warning'),poseText=document.getElementById('poseText'),toast=document.getElementById('toast'),world=document.getElementById('world'),result=document.getElementById('result'),sync=document.getElementById('syncText');
if(warning)new MutationObserver(()=>{if(warning.classList.contains('show'))beginPrompt();else if(state.promptStartedAt&&performance.now()-state.promptStartedAt>6000)clearPrompt()}).observe(warning,{attributes:true,childList:true,characterData:true,subtree:true});
if(poseText)new MutationObserver(()=>{const match=String(poseText.textContent||'').match(/ช่อง\s*(ซ้าย|กลาง|ขวา)/);if(!match)return;const lane=match[1];if(state.lastLane&&lane!==state.lastLane)recordResponse('body_lane');state.lastLane=lane}).observe(poseText,{childList:true,characterData:true,subtree:true});
if(toast)new MutationObserver(()=>{if(/JUMP|DUCK|LEFT|RIGHT|CENTER|ซ้าย|ขวา|กลาง/i.test(String(toast.textContent||'')))recordResponse('body_gesture')}).observe(toast,{childList:true,characterData:true,subtree:true});
if(world)world.addEventListener('pointerdown',()=>recordResponse('touch_lane'),{capture:true});
if(result)new MutationObserver(polishResult).observe(result,{attributes:true,attributeFilter:['class']});
if(sync)new MutationObserver(syncRetryVisibility).observe(sync,{childList:true,characterData:true,subtree:true});
syncRetryVisibility()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
