(()=>{
'use strict';
const RELEASE='20260731-HANDWASH-MOBILE-FINAL-STEP-FINISHER-R46';
const qs=new URLSearchParams(location.search);
const classroom=qs.get('classroom')==='1'||qs.get('view')==='mobile'||qs.get('ui')==='compact';
const enabled=matchMedia('(max-width:900px)').matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||classroom;
if(!enabled)return;

const CONFIG={
  rinse:{max:8,firstDelay:900,repeatDelay:850,label:'ล้างน้ำ'},
  dry:{max:8,firstDelay:850,repeatDelay:800,label:'เช็ดให้แห้ง'},
  towelFaucet:{max:7,firstDelay:750,repeatDelay:750,label:'ใช้กระดาษปิดก๊อก'}
};
const counts=Object.create(null);
let current='';
let enteredAt=Date.now();
let lastClickAt=0;
let total=0;
let timeoutPatched=false;

function num(value){const m=String(value||'').match(/([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):0}
function phase(){return document.documentElement.dataset.handwashPhase||''}
function evidence(){return Math.max(0,Math.min(100,num(document.getElementById('evidenceText')?.textContent||'0')))}
function running(){return !document.getElementById('startOverlay')?.classList.contains('show')&&!document.getElementById('summaryOverlay')?.classList.contains('show')}
function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1450)}

function patchTimeout(){
  if(window.__HH_HANDWASH_R46_TIMEOUT_PATCH__)return;
  window.__HH_HANDWASH_R46_TIMEOUT_PATCH__=true;
  const nativeSetTimeout=window.setTimeout.bind(window);
  window.setTimeout=function(handler,delay,...args){
    const ms=Number(delay||0);
    const source=typeof handler==='function'?Function.prototype.toString.call(handler):String(handler||'');
    if(!timeoutPatched&&ms>=85000&&ms<=190000&&/finishRun\(['\"]timeup['\"]\)/.test(source)){
      timeoutPatched=true;
      document.documentElement.dataset.handwashRoundLimitSec='240';
      console.info('[Handwash R46] classroom round limit protected',{fromMs:ms,toMs:240000});
      return nativeSetTimeout(handler,240000,...args);
    }
    return nativeSetTimeout(handler,delay,...args);
  };
}

function record(id,ev,reason){
  counts[id]=(counts[id]||0)+1;
  total+=1;
  document.documentElement.dataset.handwashR46AssistCount=String(total);
  document.documentElement.dataset.handwashR46AssistPhase=id;
  try{window.dispatchEvent(new CustomEvent('herohealth:handwash-final-step-assist',{detail:{release:RELEASE,phase:id,evidence:ev,reason,phaseAssistCount:counts[id],totalAssists:total,timestamp:new Date().toISOString()}}))}catch(_){}
}

function clickAssist(id,config,ev,reason){
  const now=Date.now();
  if(total>=24||(counts[id]||0)>=config.max||now-lastClickAt<config.repeatDelay)return false;
  const button=document.getElementById('tapBtn');
  if(!button||button.disabled)return false;
  button.click();
  lastClickAt=now;
  record(id,ev,reason);
  toast(`ระบบช่วยปิดขั้น ${config.label} ✅ ทำตามภาพต่อ`);
  return true;
}

function tick(){
  if(!running())return;
  const now=Date.now();
  const id=phase();
  const config=CONFIG[id];
  if(id!==current){current=id;enteredAt=now;lastClickAt=0;return}
  if(!config)return;
  const ev=evidence();
  const age=now-enteredAt;
  if(ev>=99.5)return;

  // Final-process steps must not remain at 90–99% until timeout.
  const nearComplete=ev>=90;
  const delay=nearComplete?450:config.firstDelay;
  if(age>delay&&now-lastClickAt>config.repeatDelay){
    clickAssist(id,config,ev,nearComplete?'near_complete_finisher':'guided_process_assist');
  }
}

patchTimeout();
setInterval(tick,220);
document.documentElement.dataset.handwashFinalStepFinisher=RELEASE;
window.HHHandwashFinalStepFinisherR46={release:RELEASE,get totalAssists(){return total},get counts(){return {...counts}}};
console.info('[Handwash Final Step Finisher R46] installed',{release:RELEASE,classroom,enabled});
})();
