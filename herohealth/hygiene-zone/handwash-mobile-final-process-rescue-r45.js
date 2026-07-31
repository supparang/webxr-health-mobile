(()=>{
'use strict';
const RELEASE='20260731-HANDWASH-MOBILE-FINAL-PROCESS-RESCUE-R45.1';
const qs=new URLSearchParams(location.search);
const classroom=qs.get('classroom')==='1'||qs.get('view')==='mobile'||qs.get('ui')==='compact';
const mobile=matchMedia('(max-width:900px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||classroom;
if(!mobile)return;

const PROCESS={
  rinse:{limit:5,wait:1450,label:'ล้างน้ำ'},
  dry:{limit:5,wait:1450,label:'เช็ดให้แห้ง'},
  towelFaucet:{limit:4,wait:1250,label:'ใช้กระดาษปิดก๊อก'}
};
const counts=Object.create(null);
let activePhase='';
let phaseEnteredAt=Date.now();
let lastEvidence=0;
let lastProgressAt=Date.now();
let lastAssistAt=0;
let totalAssists=0;
let timeoutExtended=false;

function numberFrom(value){const m=String(value||'').match(/([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):0}
function phase(){return document.documentElement.dataset.handwashPhase||''}
function evidence(){return Math.max(0,Math.min(100,numberFrom(document.getElementById('evidenceText')?.textContent||'0')))}
function running(){return !document.getElementById('startOverlay')?.classList.contains('show')&&!document.getElementById('summaryOverlay')?.classList.contains('show')}
function hint(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');clearTimeout(hint.timer);hint.timer=setTimeout(()=>toast.classList.remove('show'),1550)}

function installTimeoutGrace(){
  if(window.__HH_HANDWASH_R45_TIMEOUT_PATCH__)return;
  window.__HH_HANDWASH_R45_TIMEOUT_PATCH__=true;
  const nativeSetTimeout=window.setTimeout.bind(window);
  window.setTimeout=function(handler,delay,...args){
    const ms=Number(delay||0);
    const source=typeof handler==='function'?Function.prototype.toString.call(handler):String(handler||'');
    if(!timeoutExtended&&ms>=85000&&ms<=130000&&/finishRun\(['\"]timeup['\"]\)/.test(source)){
      timeoutExtended=true;
      document.documentElement.dataset.handwashRoundLimitSec='180';
      console.info('[Handwash R45.1] classroom round limit extended',{fromMs:ms,toMs:180000});
      return nativeSetTimeout(handler,180000,...args);
    }
    return nativeSetTimeout(handler,delay,...args);
  };
}

function record(currentPhase,ev){
  counts[currentPhase]=(counts[currentPhase]||0)+1;
  totalAssists+=1;
  document.documentElement.dataset.handwashFinalProcessAssist=String(totalAssists);
  document.documentElement.dataset.handwashFinalProcessPhase=currentPhase;
  try{window.dispatchEvent(new CustomEvent('herohealth:handwash-final-process-assist',{detail:{release:RELEASE,phase:currentPhase,evidence:ev,phaseAssistCount:counts[currentPhase],totalAssists,timestamp:new Date().toISOString()}}))}catch(_){}
}

function assist(currentPhase,config,ev){
  const now=Date.now();
  if((counts[currentPhase]||0)>=config.limit||now-lastAssistAt<1100)return false;
  const tap=document.getElementById('tapBtn');
  if(!tap||tap.disabled)return false;
  tap.click();
  lastAssistAt=now;
  lastProgressAt=now;
  record(currentPhase,ev);
  hint(`ระบบช่วยขั้น ${config.label} ✅ ทำตามภาพต่อช้า ๆ`);
  return true;
}

function tick(){
  if(!running())return;
  const now=Date.now();
  const currentPhase=phase();
  const config=PROCESS[currentPhase];
  const ev=evidence();

  if(currentPhase!==activePhase){
    activePhase=currentPhase;
    phaseEnteredAt=now;
    lastProgressAt=now;
    lastEvidence=ev;
    return;
  }
  if(ev>lastEvidence+.12){lastEvidence=ev;lastProgressAt=now;return}
  if(ev<lastEvidence-8){lastEvidence=ev;lastProgressAt=now;return}
  if(!config)return;

  const stalledFor=now-lastProgressAt;
  const phaseAge=now-phaseEnteredAt;
  if(phaseAge>1800&&stalledFor>config.wait&&ev<99.5){
    assist(currentPhase,config,ev);
  }
}

installTimeoutGrace();
setInterval(tick,250);
document.documentElement.dataset.handwashFinalProcessRescue=RELEASE;
window.HHHandwashFinalProcessRescueR45={release:RELEASE,get totalAssists(){return totalAssists},get counts(){return {...counts}}};
console.info('[Handwash Final Process Rescue R45.1] installed',{release:RELEASE,classroom,mobileViewport:matchMedia('(max-width:900px)').matches});
})();
