(()=>{'use strict';
const q=new URLSearchParams(location.search),sid=q.get('studentId')||'',zone=q.get('zone')||'',gameId=q.get('gameId')||'';
if(!sid||window.parent===window)return;
const $=id=>document.getElementById(id),num=v=>{const n=Number(String(v??'').replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:0};
let sent=false,started=false,startedAt=0;
function setValue(ids,value){for(const id of ids){const el=$(id);if(el&&value){el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}}}
function injectMobileUI(){
 if(gameId!=='balance-hold')return;
 let s=$('hh-classroom-mobile-ui');
 if(!s){s=document.createElement('style');s.id='hh-classroom-mobile-ui';s.textContent=`
 .formGrid,.toggles,.eightPoseLegend,.concept,.safetyNote,#cameraTestBtn,#demoBtn,#homeBtn,#pauseBtn{display:none!important}
 #startOverlay .modal{max-width:520px!important}
 @media(max-width:760px){
  html,body,.app,#app,.stage{width:100%!important;max-width:none!important;min-height:100dvh!important;height:100dvh!important;overflow:hidden!important}
  .topbar{display:none!important}
  .stage{position:fixed!important;inset:0!important;border-radius:0!important}
  #camera,#poseCanvas,.tint{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important}
  .hud{position:absolute!important;top:max(8px,env(safe-area-inset-top))!important;left:6px!important;right:6px!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;z-index:20!important}
  .hudCard{min-width:0!important;padding:7px 6px!important;border-radius:12px!important;text-align:center!important}
  .hudCard small{font-size:9px!important;line-height:1!important}.hudCard b{font-size:17px!important;line-height:1.1!important}.hudCard .meter{height:3px!important;margin-top:4px!important}
  .hudCard:nth-child(n+4){display:none!important}
  .poseBanner{position:absolute!important;top:82px!important;left:8px!important;right:8px!important;z-index:18!important;text-align:center!important}
  .poseName{display:inline-flex!important;padding:7px 12px!important;border-radius:999px!important;font-size:16px!important}.poseCue{margin-top:4px!important;padding:5px 8px!important;font-size:12px!important;line-height:1.25!important;background:rgba(255,255,255,.82)!important;border-radius:10px!important}
  .energy{position:absolute!important;left:8px!important;right:8px!important;bottom:72px!important;padding:7px 9px!important;border-radius:12px!important;z-index:18!important}.energyTitle{font-size:11px!important}.energyGrid{gap:5px!important}.energyItem{font-size:9px!important}.energy .meter{height:4px!important}
  .coach{position:absolute!important;left:8px!important;right:8px!important;bottom:max(8px,env(safe-area-inset-bottom))!important;padding:8px 10px!important;min-height:54px!important;border-radius:14px!important;z-index:21!important}.coachIcon{font-size:22px!important}.coachText{min-width:0!important}.coachText>div{font-size:13px!important;line-height:1.2!important}.coachText small{display:none!important}.coachBadge{font-size:10px!important;padding:5px 7px!important}
  .safeZone{inset:24% 18% 19%!important}.poseGhost{transform:translate(-50%,-50%) scale(.74)!important;opacity:.55!important}.crystal{transform:scale(.72)!important}.holdRing{transform:translate(-50%,-50%) scale(.78)!important}.holdText{font-size:22px!important}
  #calibrationOverlay,#startOverlay,#resultOverlay{padding:8px!important;align-items:center!important;overflow:auto!important}
  #calibrationOverlay .modal,#startOverlay .modal,#resultOverlay .modal{width:min(94vw,480px)!important;max-height:calc(100dvh - 24px)!important;overflow:auto!important;padding:16px!important;border-radius:18px!important}
  .modalHead{gap:8px!important}.modalIcon{font-size:34px!important}.modal h1,.modal h2{font-size:22px!important;margin:4px 0!important}.lead{font-size:13px!important;line-height:1.35!important}.actions{gap:8px!important}.btn{min-height:48px!important}
  .calibrationSteps{gap:6px!important}.calStep{padding:8px!important;font-size:12px!important}.cameraHints{display:grid!important;gap:4px!important;font-size:11px!important}
 }
 @media(max-width:760px) and (orientation:landscape){
  .hud{grid-template-columns:repeat(3,120px)!important;right:auto!important}.poseBanner{top:8px!important;left:390px!important;right:8px!important;text-align:right!important}.energy{left:8px!important;right:auto!important;width:310px!important}.coach{left:auto!important;width:44%!important}
 }
 `;document.head.appendChild(s)}
 try{
  const pd=parent.document;let ps=pd.getElementById('hh-mobile-shell-ui');if(!ps){ps=pd.createElement('style');ps.id='hh-mobile-shell-ui';ps.textContent=`
  @media(max-width:760px){
   .bar{height:42px!important;padding:4px 6px!important;gap:6px!important}.bar b{font-size:14px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.bar .status{font-size:10px!important}.bar button{min-height:34px!important;padding:5px 8px!important;border-radius:9px!important;font-size:13px!important}
   iframe{top:42px!important;height:calc(100dvh - 42px)!important}.loading,.overlay{inset:42px 0 0!important}.overlay{padding:8px!important;align-items:center!important;overflow:auto!important}.overlay .card{width:min(94vw,460px)!important;max-height:calc(100dvh - 58px)!important;overflow:auto!important;padding:16px!important;border-radius:18px!important}.overlay .card>div:first-child{font-size:38px!important}.overlay h1{font-size:24px!important;margin:5px 0!important}.overlay .score{font-size:34px!important}.overlay p{margin:8px 0!important;font-size:13px!important}.overlay .btn{min-height:48px!important}
  }`;pd.head.appendChild(ps)}
 }catch(_){}
}
function applyContext(){
 setValue(['studentId','studentIdInput','studentInput'],sid);
 setValue(['section','sectionInput'],q.get('section')||'');
 setValue(['classId','classInput','groupInput'],q.get('group')||q.get('section')||'');
 setValue(['playerName','nameInput','studentName'],q.get('fullName')||q.get('name')||'Hero');
 if(gameId==='balance-hold'){setValue(['difficulty'],'easy');setValue(['duration'],'60');injectMobileUI()}
 if(gameId==='handwash'){let s=$('hh-classroom-contract-style');if(!s){s=document.createElement('style');s.id='hh-classroom-contract-style';s.textContent='#startOverlay .form,#startOverlay .rules .rule:not(:nth-child(2)),#backBtn{display:none!important}';document.head.appendChild(s)}}
 if(gameId==='toothbrush'){let s=$('hh-classroom-contract-style');if(!s){s=document.createElement('style');s.id='hh-classroom-contract-style';s.textContent='.field,#homeBtn{display:none!important}';document.head.appendChild(s)}}
}
function markStarted(){if(started)return;started=true;startedAt=Date.now();try{parent.postMessage({type:'HEROHEALTH_GAME_STARTED'},location.origin)}catch(_){} }
function firstNumber(ids){for(const id of ids){const el=$(id);if(el){const v=num(el.textContent||el.value);if(v)return v}}return 0}
function readStored(){const keys=['HHA_BALANCE_HOLD_LAST_RESULT','HHA_HANDWASH_LAST_RESULT','toothbrush_pending_result','HHA_TOOTHBRUSH_LAST_RESULT'];for(const k of keys){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v)return v}catch(_){}}return window.__BALANCE_HOLD_LAST_RESULT__||window.__HANDWASH_LAST_RESULT__||window.__TOOTHBRUSH_LAST_RESULT__||{} }
function visible(el){if(!el)return false;const cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&cs.opacity!=='0'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0}
function balanceActuallyFinished(){if(!started||Date.now()-startedAt<20000)return false;const raw=readStored();if(raw&&raw.completed===true&&num(raw.score)>=0)return true;const time=firstNumber(['hudTime','timeLeft','timer','countdownTime']);if(time===0&&Date.now()-startedAt>=45000)return true;const result=$('resultOverlay'),text=String(result?.innerText||'').trim();return visible(result)&&text.length>20&&/(จบภารกิจ|สรุปผล|คะแนน|สำเร็จ|completed)/i.test(text)}
function looksFinished(){if(gameId==='balance-hold')return balanceActuallyFinished();if(!started)return false;const candidates=[$('resultOverlay'),$('resultScreen'),$('summaryScreen'),$('result'),$('summary')];if(candidates.some(visible))return true;const text=String(document.body?.innerText||'');return /(Healthy Hero|จบภารกิจ|สรุปผล|ผลการเล่น|ภารกิจสำเร็จ|completed)/i.test(text)&&!/(กำลังเล่น|พร้อมเริ่ม)/i.test(text.slice(0,180))}
function submit(){if(sent||!looksFinished())return;const raw=readStored();const score=Math.max(num(raw.score),firstNumber(['hudScore','scoreText','summaryScore','sumScore','finalScore','score']));const accuracy=Math.max(num(raw.accuracy??raw.direction_accuracy),firstNumber(['hudAccuracy','accuracyText','summaryAccuracy','sumAccuracy','finalAcc','accuracy']));const payload={...raw,completed:true,passed:raw.passed!==false,score,accuracy,eventId:raw.eventId||raw.record_id||`HH-game-${zone}-${gameId}-${sid}-${Date.now()}`,inputMode:raw.inputMode||'classroom-ar',gameVersion:raw.gameVersion||`${gameId}-classroom-contract-v3-mobile`,autoSubmit:true};sent=true;try{localStorage.setItem(`HHA_${String(gameId).toUpperCase().replace(/-/g,'_')}_LAST_RESULT`,JSON.stringify(payload))}catch(_){}try{parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload},location.origin)}catch(_){}setTimeout(()=>{try{parent.document.getElementById('returnBtn')?.click()}catch(_){}},2300)}
applyContext();
addEventListener('click',e=>{const t=String(e.target?.textContent||'').toLowerCase();if(/เริ่ม|start|calibration|เปิดกล้อง/.test(t))markStarted()},{capture:true});
addEventListener('balancehold:started',markStarted);
new MutationObserver(()=>{applyContext();submit()}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true});
setInterval(submit,800);
})();