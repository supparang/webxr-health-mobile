(()=>{
'use strict';

const RELEASE='20260730-BALANCE-CLASSROOM-LAUNCHER-V40.1';
const originalQuery=new URLSearchParams(location.search);
const standalone=
  originalQuery.get('classroom')==='0'||
  originalQuery.get('standalone')==='1'||
  originalQuery.get('qa')==='1'||
  ['standalone','research','demo','qa'].includes(String(originalQuery.get('mode')||'').toLowerCase());
if(standalone)return;

const normalized=new URL(location.href);
if(!normalized.searchParams.has('classroom'))normalized.searchParams.set('classroom','1');
if(!normalized.searchParams.has('mode'))normalized.searchParams.set('mode','classroom');
if(!normalized.searchParams.has('source'))normalized.searchParams.set('source','herohealth');
if(!normalized.searchParams.has('diff'))normalized.searchParams.set('diff','easy');
if(!normalized.searchParams.has('time'))normalized.searchParams.set('time','60');
try{history.replaceState(history.state,'',normalized.href)}catch(_){}

const q=new URLSearchParams(location.search);
const byId=id=>document.getElementById(id);
let inFlight=false;

function setValue(id,value){
  const element=byId(id);
  if(!element)return;
  element.value=value;
  element.dispatchEvent(new Event('change',{bubbles:true}));
}

function prepare(){
  document.body.classList.add('bh-classroom-stable');
  setValue('playerName',q.get('studentName')||q.get('fullName')||q.get('name')||'Hero');
  setValue('studentId',q.get('studentId')||q.get('sid')||q.get('pid')||'');
  setValue('classId',q.get('group')||q.get('classId')||'ป.5');
  setValue('section',q.get('section')||'');
  setValue('difficulty','easy');
  setValue('duration','60');

  const skeleton=byId('showSkeleton');
  const sound=byId('soundOn');
  const safe=byId('safeMode');
  if(skeleton)skeleton.checked=true;
  if(sound)sound.checked=true;
  if(safe)safe.checked=true;

  const overlay=byId('startOverlay');
  const button=byId('startBtn');
  if(overlay){
    overlay.classList.remove('hidden');
    overlay.style.display='flex';
  }
  if(button){
    button.hidden=false;
    button.disabled=false;
    button.textContent='📷 เริ่มภารกิจ';
  }
}

function activePhase(){
  const phase=String(window.BH?.state?.phase||'').toLowerCase();
  if(phase==='camera'){
    return !!(window.BH?.state?.stream||byId('camera')?.srcObject);
  }
  return ['calibration','ready','countdown','play','paused','transition','summary','ended'].includes(phase);
}

function showStart(message){
  if(activePhase())return;
  const overlay=byId('startOverlay');
  const button=byId('startBtn');
  const lead=overlay?.querySelector('.lead');
  if(overlay){
    overlay.classList.remove('hidden');
    overlay.style.display='flex';
  }
  if(lead)lead.textContent=message||'แตะปุ่มเพื่อเปิดกล้องและเริ่มตรวจท่าทาง';
  if(button){
    button.disabled=false;
    button.textContent='📷 เริ่มภารกิจ';
  }
}

function hideStart(){
  const overlay=byId('startOverlay');
  const button=byId('startBtn');
  if(button){
    button.disabled=true;
    button.textContent='กำลังเปิดกล้อง…';
  }
  if(overlay){
    overlay.classList.add('hidden');
    overlay.style.display='none';
  }
}

function bind(){
  prepare();
  const button=byId('startBtn');
  if(!button)return;

  const originalStart=typeof button.onclick==='function'
    ? button.onclick.bind(button)
    : (typeof window.BH?.beginCalibration==='function'?window.BH.beginCalibration.bind(window.BH):null);

  button.onclick=async event=>{
    if(inFlight||activePhase())return;
    inFlight=true;
    hideStart();
    try{
      if(!originalStart)throw new Error('balance_start_handler_missing');
      await originalStart(event);
      if(!activePhase())showStart('เปิดกล้องไม่สำเร็จ กรุณาตรวจสิทธิ์กล้องแล้วลองใหม่');
    }catch(error){
      console.warn('[BalanceHold Launcher] start failed',error);
      showStart('เปิดกล้องไม่สำเร็จ กรุณาตรวจสิทธิ์กล้องแล้วลองใหม่');
    }finally{
      inFlight=false;
    }
  };
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();

console.info('[BalanceHold] Stable classroom launcher ready',RELEASE);
})();
