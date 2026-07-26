(()=>{'use strict';
const q=new URLSearchParams(location.search),sid=q.get('studentId')||'',zone=q.get('zone')||'',gameId=q.get('gameId')||'';
if(!sid||window.parent===window)return;
const $=id=>document.getElementById(id),num=v=>{const n=Number(String(v??'').replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:0};
let sent=false,started=false,startedAt=0;
function setValue(ids,value){for(const id of ids){const el=$(id);if(el&&value){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}}}
function applyContext(){
 setValue(['studentId','studentIdInput','studentInput'],sid);
 setValue(['section','sectionInput'],q.get('section')||'');
 setValue(['classId','classInput','groupInput'],q.get('group')||q.get('section')||'');
 setValue(['playerName','nameInput','studentName'],q.get('fullName')||q.get('name')||'Hero');
 if(gameId==='balance-hold'){
  setValue(['difficulty'],'easy');setValue(['duration'],'60');
  let s=$('hh-classroom-contract-style');if(!s){s=document.createElement('style');s.id='hh-classroom-contract-style';s.textContent='.formGrid,.toggles,.eightPoseLegend,.concept,.safetyNote,#cameraTestBtn,#demoBtn,#homeBtn,#pauseBtn{display:none!important}#startOverlay .modal{max-width:520px!important}';document.head.appendChild(s)}
 }
 if(gameId==='handwash'){
  let s=$('hh-classroom-contract-style');if(!s){s=document.createElement('style');s.id='hh-classroom-contract-style';s.textContent='#startOverlay .form,#startOverlay .rules .rule:not(:nth-child(2)),#backBtn{display:none!important}';document.head.appendChild(s)}
 }
 if(gameId==='toothbrush'){
  let s=$('hh-classroom-contract-style');if(!s){s=document.createElement('style');s.id='hh-classroom-contract-style';s.textContent='.field,#homeBtn{display:none!important}';document.head.appendChild(s)}
 }
}
function markStarted(){if(started)return;started=true;startedAt=Date.now();try{parent.postMessage({type:'HEROHEALTH_GAME_STARTED'},location.origin)}catch(_){}}
function firstNumber(ids){for(const id of ids){const el=$(id);if(el){const v=num(el.textContent||el.value);if(v)return v}}return 0}
function readStored(){const keys=['HHA_BALANCE_HOLD_LAST_RESULT','HHA_HANDWASH_LAST_RESULT','toothbrush_pending_result','HHA_TOOTHBRUSH_LAST_RESULT'];for(const k of keys){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v)return v}catch(_){}}return window.__BALANCE_HOLD_LAST_RESULT__||window.__HANDWASH_LAST_RESULT__||window.__TOOTHBRUSH_LAST_RESULT__||{} }
function visible(el){if(!el)return false;const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&cs.opacity!=='0'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0}
function balanceActuallyFinished(){
 if(!started||Date.now()-startedAt<20000)return false;
 const raw=readStored();
 if(raw&&raw.completed===true&&num(raw.score)>=0)return true;
 const time=firstNumber(['hudTime','timeLeft','timer','countdownTime']);
 if(time===0&&Date.now()-startedAt>=45000)return true;
 const result=$('resultOverlay');
 const text=String(result?.innerText||'').trim();
 return visible(result)&&text.length>20&&/(จบภารกิจ|สรุปผล|คะแนน|สำเร็จ|completed)/i.test(text);
}
function looksFinished(){
 if(gameId==='balance-hold')return balanceActuallyFinished();
 if(!started)return false;
 const candidates=[$('resultOverlay'),$('resultScreen'),$('summaryScreen'),$('result'),$('summary')];
 if(candidates.some(visible))return true;
 const text=String(document.body?.innerText||'');
 return /(Healthy Hero|จบภารกิจ|สรุปผล|ผลการเล่น|ภารกิจสำเร็จ|completed)/i.test(text)&&!/(กำลังเล่น|พร้อมเริ่ม)/i.test(text.slice(0,180));
}
function submit(){if(sent||!looksFinished())return;const raw=readStored();const score=Math.max(num(raw.score),firstNumber(['hudScore','scoreText','summaryScore','sumScore','finalScore','score']));const accuracy=Math.max(num(raw.accuracy??raw.direction_accuracy),firstNumber(['hudAccuracy','accuracyText','summaryAccuracy','sumAccuracy','finalAcc','accuracy']));const payload={...raw,completed:true,passed:raw.passed!==false,score,accuracy,eventId:raw.eventId||raw.record_id||`HH-game-${zone}-${gameId}-${sid}-${Date.now()}`,inputMode:raw.inputMode||'classroom-ar',gameVersion:raw.gameVersion||`${gameId}-classroom-contract-v2`,autoSubmit:true};sent=true;try{localStorage.setItem(`HHA_${String(gameId).toUpperCase().replace(/-/g,'_')}_LAST_RESULT`,JSON.stringify(payload))}catch(_){}try{parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload},location.origin)}catch(_){}setTimeout(()=>{try{parent.document.getElementById('returnBtn')?.click()}catch(_){}},2300)}
applyContext();
addEventListener('click',e=>{const t=String(e.target?.textContent||'').toLowerCase();if(/เริ่ม|start|calibration|เปิดกล้อง/.test(t))markStarted()},{capture:true});
addEventListener('balancehold:started',markStarted);
new MutationObserver(()=>{applyContext();submit()}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true});
setInterval(submit,800);
})();