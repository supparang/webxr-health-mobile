(()=>{
'use strict';
const RELEASE='20260718-HANDWASH-RESEARCH-FORM-TRANSPORT-R26';
const qs=new URLSearchParams(location.search);
const ENDPOINT=qs.get('sheet')||window.HH_HANDWASH_SHEET_ENDPOINT||'https://script.google.com/macros/s/AKfycbwdwozSPj0QwEYkclrxAqjZcN2E_uSqAVqAV9ev2_0PWCW1k9riLE_LLMksschpFcNZ-A/exec';
const OUTBOX='herohealth:hygiene:handwash:research:r25:outbox';
const SENT='herohealth:hygiene:handwash:research:r25:sent';
let busy=false;
function read(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch(_){return f}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}
function status(text){['deliveryText','hw24Delivery'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=text});const d=document.getElementById('handwashTopLayerSummaryR24');const x=d&&d.querySelector('#hw24Delivery');if(x)x.textContent=text}
function formPost(payload){return new Promise(resolve=>{
 const token='hwrs26_'+Date.now()+'_'+Math.random().toString(36).slice(2);
 const frame=document.createElement('iframe');frame.name=token;frame.style.display='none';
 const form=document.createElement('form');form.method='POST';form.action=ENDPOINT;form.target=token;form.style.display='none';
 const input=document.createElement('input');input.type='hidden';input.name='payload_json';input.value=JSON.stringify(payload);form.appendChild(input);
 document.body.append(frame,form);
 let done=false;const finish=()=>{if(done)return;done=true;setTimeout(()=>{form.remove();frame.remove();resolve()},250)};
 frame.addEventListener('load',finish,{once:true});
 setTimeout(finish,4500);
 form.submit();
 })}
function receipt(sessionId,expected){return new Promise(resolve=>{
 const cb='__hwrs26_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');
 const timer=setTimeout(()=>done({confirmed:false,timeout:true}),10000);
 function done(v){clearTimeout(timer);try{delete window[cb]}catch(_){}s.remove();resolve(v||{})}
 window[cb]=done;
 const u=new URL(ENDPOINT);u.searchParams.set('api','handwash_research');u.searchParams.set('type','receipt');u.searchParams.set('sessionId',sessionId);u.searchParams.set('expectedEvents',String(expected||0));u.searchParams.set('callback',cb);u.searchParams.set('_',Date.now());
 s.onerror=()=>done({confirmed:false,error:'receipt_load_failed'});s.src=u.toString();document.head.appendChild(s);
 })}
async function flush(){if(busy||!navigator.onLine)return;const box=read(OUTBOX,[]);if(!box.length)return;busy=true;
 try{
  const remain=[],sent=read(SENT,{});
  for(const item of box){
   if(sent[item.sessionId])continue;
   try{
    status('กำลังส่งผ่าน Form Transport R26…');
    await formPost({api:'handwash_research',type:'handwash_session_summary',payload:item.summary});
    await formPost({api:'handwash_research',type:'handwash_event_batch',meta:{session_id:item.summary.session_id,participant_id:item.summary.participant_id,student_name:item.summary.student_name,class_level:item.summary.class_level,class_id:item.summary.class_id,section:item.summary.section,study_id:item.summary.study_id},events:item.events});
    await new Promise(r=>setTimeout(r,1800));
    const rc=await receipt(item.sessionId,item.events.length);
    console.info('[Handwash R26] receipt',item.sessionId,rc);
    if(rc.confirmed){sent[item.sessionId]={at:Date.now(),summaryRow:rc.summaryRow,eventCount:rc.eventCount};status('ยืนยันแล้ว ✅ Summary แถว '+rc.summaryRow+' • Events '+rc.eventCount+' รายการ')}
    else{item.tries=(Number(item.tries)||0)+1;item.lastTry=Date.now();remain.push(item);status('ยังไม่ยืนยัน • R26 จะส่งซ้ำอัตโนมัติ')}
   }catch(error){item.tries=(Number(item.tries)||0)+1;item.lastError=String(error&&error.message||error);remain.push(item);console.error('[Handwash R26] transport failed',error)}
  }
  write(SENT,sent);write(OUTBOX,remain);
 }finally{busy=false}
}
window.addEventListener('online',flush);setInterval(flush,5000);document.addEventListener('DOMContentLoaded',flush,{once:true});
document.documentElement.dataset.handwashResearchTransport=RELEASE;
console.info('[Handwash R26] hidden-form transport installed',ENDPOINT);
flush();
})();