(()=>{
'use strict';
if(window.__HH_HANDWASH_CLASSROOM_ASSIST_R45__)return;
window.__HH_HANDWASH_CLASSROOM_ASSIST_R45__=true;
const RELEASE='20260804-HANDWASH-CLASSROOM-DETECTION-ASSIST-R45';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('firebaseDirect')==='1'||q.get('singleAttempt')==='1';
if(!classroom)return;

const RUB=new Set(['palm','dorsum','interlaced','backsFingers','thumbs','fingertips','wrists']);
const PROCESS=new Set(['wet','soap','rinse','dry','towelFaucet']);
const LIMIT={calibrate:2,wet:3,soap:3,palm:5,dorsum:6,interlaced:6,backsFingers:6,thumbs:7,fingertips:7,wrists:9,rinse:3,dry:3,towelFaucet:4};
const used=Object.create(null);
let lastPhase='';
let phaseAt=Date.now();
let lastProgressAt=Date.now();
let lastEvidence=0;
let lastAssistAt=0;
let lastHandsAt=0;

function n(v){const m=String(v||'').match(/([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):0}
function phase(){return document.documentElement.dataset.handwashPhase||''}
function evidence(){return Math.max(0,Math.min(100,n(document.getElementById('evidenceText')?.textContent)))}
function hands(){return n(document.getElementById('chipHands')?.textContent)}
function running(){return !document.getElementById('startOverlay')?.classList.contains('show')&&!document.getElementById('summaryOverlay')?.classList.contains('show')}
function gesture(){return ['chipMotion','chipContact','chipPose'].some(id=>document.getElementById(id)?.classList.contains('good'))}
function toast(text){const node=document.getElementById('toast');if(!node)return;node.textContent=text;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),1500)}
function assist(p,reason){
 const now=Date.now(),button=document.getElementById('tapBtn');
 if(!button||button.disabled||now-lastAssistAt<1450||(used[p]||0)>=(LIMIT[p]||4))return false;
 button.click();used[p]=(used[p]||0)+1;lastAssistAt=now;lastProgressAt=now;
 document.documentElement.dataset.handwashClassroomAssist=RELEASE;
 document.documentElement.dataset.handwashClassroomAssistPhase=p;
 document.documentElement.dataset.handwashClassroomAssistCount=String(Object.values(used).reduce((a,b)=>a+b,0));
 toast(p==='wrists'?'ช่วยตรวจจับข้อมือแล้ว ✅ หมุนช้า ๆ ต่ออีกนิด':'ช่วยสะสมหลักฐานแล้ว ✅ ทำท่าช้า ๆ ต่อ');
 try{dispatchEvent(new CustomEvent('herohealth:handwash-classroom-assist',{detail:{release:RELEASE,phase:p,reason,count:used[p],ts:new Date().toISOString()}}))}catch(_){}
 return true;
}
function installComfort(){
 if(document.getElementById('hh-handwash-r45-style'))return;
 const s=document.createElement('style');s.id='hh-handwash-r45-style';s.textContent=`
 #tapBtn{opacity:.92!important;pointer-events:auto!important}
 html[data-handwash-phase="wrists"] #scrubZone{width:96vw!important;height:62vh!important;min-height:370px!important}
 html[data-handwash-phase="thumbs"] #scrubZone,html[data-handwash-phase="fingertips"] #scrubZone{width:94vw!important;height:60vh!important}
 `;document.head.appendChild(s);
}
function tick(){
 installComfort();if(!running())return;
 const now=Date.now(),p=phase(),ev=evidence(),hc=hands();
 if(p!==lastPhase){lastPhase=p;phaseAt=now;lastProgressAt=now;lastEvidence=ev;return}
 if(hc>0)lastHandsAt=now;
 if(ev>lastEvidence+.1){lastEvidence=ev;lastProgressAt=now;return}
 if(ev<lastEvidence-8){lastEvidence=ev;lastProgressAt=now;return}
 const age=now-phaseAt,stall=now-lastProgressAt,recentHands=now-lastHandsAt<8500,hasGesture=gesture();
 if(p==='calibrate'&&age>3000&&(hc>0||recentHands)){assist(p,'calibration_stall');return}
 if(RUB.has(p)){
   const wait=p==='wrists'?1500:(p==='thumbs'||p==='fingertips'?1850:2200);
   if(stall>wait&&(hc>0||recentHands||hasGesture||age>6500))assist(p,hc===0?'tracking_gap':'rub_threshold_stall');
   return;
 }
 if(PROCESS.has(p)&&stall>2600&&(hc>0||recentHands||age>6000))assist(p,'process_threshold_stall');
}
installComfort();setInterval(tick,300);
document.documentElement.dataset.handwashClassroomAssistR45=RELEASE;
window.HHHandwashClassroomAssistR45={release:RELEASE,get used(){return {...used}}};
console.info('[Handwash Classroom Detection Assist R45] installed',RELEASE);
})();
