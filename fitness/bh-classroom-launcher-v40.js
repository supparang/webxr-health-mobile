(()=>{
'use strict';

const RELEASE='20260730-BALANCE-CLASSROOM-LAUNCHER-V40';
const original=new URLSearchParams(location.search);
const standalone=
  original.get('classroom')==='0'||
  original.get('standalone')==='1'||
  original.get('qa')==='1'||
  ['standalone','research','demo','qa'].includes(String(original.get('mode')||'').toLowerCase());
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
let started=false;
let fallbackTimer=0;

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

function phaseStarted(){
  const phase=String(window.BH?.state?.phase||'').toLowerCase();
  return ['calibration','countdown','playing','transition','ended'].includes(phase);
}

function showFallback(message){
  if(phaseStarted())return;
  const overlay=byId('startOverlay');
  const button=byId('startBtn');
  const lead=overlay?.querySelector('.lead');
  if(overlay){
    overlay.classList.remove('hidden');
    overlay.style.display='flex';
  }
  if(lead)lead.textContent=message||'แตะเริ่มอีกครั้งเพื่อเปิดกล้อง';
  if(button){
    button.disabled=false;
    button.textContent='📷 เริ่มภารกิจ';
  }
  started=false;
}

function handleStart(){
  if(started)return;
  started=true;
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

  clearTimeout(fallbackTimer);
  fallbackTimer=window.setTimeout(()=>{
    if(!phaseStarted())showFallback('กล้องยังไม่เริ่ม กรุณาแตะปุ่มอีกครั้ง');
  },4500);
}

function bind(){
  prepare();
  const button=byId('startBtn');
  if(!button)return;
  button.addEventListener('click',handleStart,{capture:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();

console.info('[BalanceHold] Stable classroom launcher ready',RELEASE);
})();
