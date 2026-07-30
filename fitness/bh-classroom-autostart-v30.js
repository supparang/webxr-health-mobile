(()=>{
'use strict';

const initial=new URLSearchParams(location.search);
const explicitStandalone=
  initial.get('classroom')==='0'||
  initial.get('standalone')==='1'||
  initial.get('qa')==='1'||
  ['standalone','research','demo','qa'].includes(String(initial.get('mode')||'').toLowerCase());

if(explicitStandalone)return;

// The canonical Balance Hold page is a student-classroom page by default.
// Normalize direct/history links before later UI modules read the query string.
const normalizedUrl=new URL(location.href);
if(!normalizedUrl.searchParams.has('classroom'))normalizedUrl.searchParams.set('classroom','1');
if(!normalizedUrl.searchParams.has('mode'))normalizedUrl.searchParams.set('mode','classroom');
if(!normalizedUrl.searchParams.has('source'))normalizedUrl.searchParams.set('source','herohealth');
if(!normalizedUrl.searchParams.has('diff'))normalizedUrl.searchParams.set('diff','easy');
if(!normalizedUrl.searchParams.has('time'))normalizedUrl.searchParams.set('time','60');
try{history.replaceState(history.state,'',normalizedUrl.href)}catch(_){}

const q=new URLSearchParams(location.search);
const $=id=>document.getElementById(id);
const set=(id,value)=>{
  const element=$(id);
  if(!element)return;
  element.value=value;
  element.dispatchEvent(new Event('change',{bubbles:true}));
};
const hide=element=>{if(element){element.classList.add('hidden');element.style.display='none'}};

const sid=q.get('studentId')||q.get('sid')||q.get('pid')||'';
const section=q.get('section')||'';
const group=q.get('group')||q.get('classId')||'ป.5';
const name=q.get('studentName')||q.get('fullName')||q.get('name')||q.get('playerName')||'Hero';

let started=false;
let attempts=0;
let fallbackShown=false;

function prepareValues(){
  set('playerName',name);
  set('studentId',sid);
  set('classId',group);
  set('section',section);
  set('difficulty','easy');
  set('duration','60');

  const skeleton=$('showSkeleton');
  if(skeleton&&!skeleton.checked)skeleton.click();
  const sound=$('soundOn');
  if(sound&&!sound.checked)sound.click();
  const safe=$('safeMode');
  if(safe&&!safe.checked)safe.click();

  hide($('cameraTestBtn'));
  hide($('demoBtn'));

  const coachSub=$('coachSub');
  if(coachSub)coachSub.textContent='ภารกิจทรงตัว 6 ท่า • โหมดปลอดภัย';
  const coachMain=$('coachMain');
  if(coachMain)coachMain.textContent='ให้กล้องเห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง';
}

function gameHasStarted(){
  const phase=String(window.BH?.state?.phase||'').toLowerCase();
  const calibration=$('calibrationOverlay');
  const calibrationVisible=calibration&&!calibration.classList.contains('hidden')&&getComputedStyle(calibration).display!=='none';
  return calibrationVisible||['calibration','countdown','playing','transition','ended'].includes(phase);
}

function compactFallback(){
  if(fallbackShown||gameHasStarted())return;
  fallbackShown=true;
  const overlay=$('startOverlay');
  const startButton=$('startBtn');
  if(!overlay||!startButton)return;

  overlay.classList.remove('hidden');
  overlay.style.display='flex';
  const heading=overlay.querySelector('h1');
  const lead=overlay.querySelector('.lead');
  if(heading)heading.textContent='ภารกิจทรงตัว';
  if(lead)lead.textContent='แตะปุ่มด้านล่างเพื่อเปิดกล้องและเริ่มตรวจท่าทาง';
  startButton.textContent='📷 เริ่มภารกิจ';
  startButton.disabled=false;
  startButton.style.display='';
  startButton.onclick=null;
  startButton.addEventListener('click',()=>{
    overlay.classList.add('hidden');
    overlay.style.display='none';
  },{once:true});
}

function tryStart(){
  attempts+=1;
  prepareValues();

  const overlay=$('startOverlay');
  const startButton=$('startBtn');
  const coreReady=!!(window.BH&&window.BH.state&&typeof window.BH.beginCalibration==='function');

  if(overlay){
    overlay.classList.add('hidden');
    overlay.style.display='none';
  }

  if(!started&&startButton&&coreReady){
    started=true;
    try{startButton.click()}catch(error){console.warn('[BalanceHold AutoStart] button start failed',error)}

    window.setTimeout(()=>{
      if(gameHasStarted())return;
      try{window.BH.beginCalibration()}catch(error){
        console.warn('[BalanceHold AutoStart] direct calibration failed',error);
        started=false;
      }
    },700);
  }

  if(!gameHasStarted()&&attempts<25){
    window.setTimeout(tryStart,180);
  }
}

function apply(){
  prepareValues();
  tryStart();
  window.setTimeout(compactFallback,3200);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',apply,{once:true});
}else{
  apply();
}

console.info('[BalanceHold] Classroom AutoStart v31 ready');
})();
