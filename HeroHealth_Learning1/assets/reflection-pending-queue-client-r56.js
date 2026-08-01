(()=>{
'use strict';
const RELEASE='20260801-REFLECTION-PENDING-QUEUE-CLIENT-R56';
const STATE_KEY='herohealth_learning_platform_rc2';
const ENDPOINT=String(window.HH_CONFIG?.backend?.webAppUrl||'').trim();
const clean=v=>String(v==null?'':v).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}};
const write=v=>localStorage.setItem(STATE_KEY,JSON.stringify(v));
const state=read();
const sid=clean(state?.profile?.studentId||new URLSearchParams(location.search).get('studentId'));

function jsonp(params,timeout=30000){
  return new Promise((resolve,reject)=>{
    if(!ENDPOINT)return reject(new Error('backend_endpoint_missing'));
    const cb='HHRPQ56_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
    const script=document.createElement('script');let done=false;
    const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(_){}try{script.remove()}catch(_){}err?reject(err):resolve(data)};
    const timer=setTimeout(()=>finish(new Error('sheet_timeout')),timeout);
    window[cb]=data=>finish(null,data);
    script.onerror=()=>finish(new Error('sheet_load_failed'));
    script.src=ENDPOINT+'?'+new URLSearchParams({...params,callback:cb,clientVersion:RELEASE,_:Date.now()});
    document.head.appendChild(script);
  });
}
function deviceId(){
  const key='hh_device_id_v1';let value=localStorage.getItem(key);
  if(!value){value='dev-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);localStorage.setItem(key,value)}
  return value;
}
function validReflection(r){return r&&Number(r.understand)>0&&clean(r.best)&&clean(r.action)}
function basePayload(reflection){
  const current=read(),p=current.profile||{};
  const pendingId=clean(current.pendingReflectionAuthority?.pendingId)||('RPQ-'+sid+'-'+Date.now());
  return {eventId:'HH-reflection-pending-'+sid+'-'+pendingId,eventType:'reflection_pending',studentId:sid,clientTs:new Date().toISOString(),pendingId,sourceDeviceId:deviceId(),profile:{fullName:p.fullName||'',section:p.section||'',group:p.group||current.group||''},reflection,platformVersion:window.HH_CONFIG?.platformVersion||'',queueVersion:RELEASE};
}
async function savePending(reflection){
  if(!sid||!validReflection(reflection))throw new Error('reflection_incomplete');
  const payload=basePayload(reflection);
  const ack=await jsonp({action:'submit',payload:JSON.stringify(payload)});
  if(!ack?.ok)throw new Error(ack?.error||'pending_save_failed');
  const current=read();
  current.reflection=reflection;
  current.pendingReflectionAuthority={studentId:sid,pendingId:ack.pendingId||payload.pendingId,status:'PENDING',createdAt:new Date().toISOString(),serverSide:true,version:RELEASE};
  write(current);
  return {...ack,pendingId:ack.pendingId||payload.pendingId};
}
async function getPending(){
  if(!sid)return {ok:false,found:false,error:'missing_studentId'};
  return jsonp({action:'reflectionPendingGet',studentId:sid,force:'1'});
}
async function commitPending(pendingId){
  const result=await jsonp({action:'reflectionPendingCommit',studentId:sid,pendingId:pendingId||'',force:'1'});
  if(!result?.ok)throw new Error(result?.error||'pending_commit_failed');
  return result;
}
async function confirmAuthority(){
  for(let i=1;i<=12;i++){
    await sleep(500+i*180);
    const api=await jsonp({action:'student',studentId:sid,reconcile:'1',force:'1'}).catch(()=>null);
    const authority=api?.authoritativeState||api;
    if(api?.ok&&authority?.completed?.reflection===true){
      const current=read();
      const next={...current,...authority,profile:{...(current.profile||{}),...(authority.profile||api.profile||{}),studentId:sid},completed:{...(current.completed||{}),...(authority.completed||api.completed||{})},reflection:authority.reflection||api.reflection||current.reflection,progress:authority.progress||api.progress||current.progress,authoritativeProgress:authority.progress||api.progress||current.authoritativeProgress,pendingReflectionAuthority:null,sheetAuthority:true,lastAuthoritySyncAt:new Date().toISOString(),reflectionQueueVersion:RELEASE};
      write(next);return api;
    }
  }
  throw new Error('reflection_authority_not_confirmed');
}
async function recoverAcrossDevices(){
  if(!sid)return false;
  const current=read();
  if(current?.completed?.reflection===true)return true;
  const pending=await getPending();
  if(!pending?.ok||!pending?.found)return false;
  if(validReflection(pending.reflection)){
    current.reflection=pending.reflection;
    current.pendingReflectionAuthority={studentId:sid,pendingId:pending.pendingId,status:pending.status||'PENDING',serverSide:true,recoveredAcrossDevice:true,version:RELEASE};
    write(current);
  }
  await commitPending(pending.pendingId);
  await confirmAuthority();
  return true;
}

function installReflectionForm(){
  if(!/\/assessment\/reflection\.html$/i.test(location.pathname))return;
  const form=document.getElementById('form');
  if(!form||form.dataset.rpq56==='1')return;
  form.dataset.rpq56='1';
  form.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();
    const fd=new FormData(form);
    const reflection={understand:Number(fd.get('understand'))||0,best:clean(fd.get('best')),action:clean(fd.get('action')),submittedAt:read().reflection?.submittedAt||new Date().toISOString()};
    const button=document.getElementById('submitBtn'),status=document.getElementById('status');
    const show=(text,error=false)=>{if(!status)return;status.hidden=false;status.className='status'+(error?' error':'');status.textContent=text};
    if(!validReflection(reflection)){show('กรุณาตอบ Reflection ให้ครบ','error');return}
    if(button){button.disabled=true;button.textContent='กำลังบันทึก Pending บน Google Sheet…'}
    try{
      show('ขั้นที่ 1/3 กำลังเก็บสำเนา Reflection บน Server…');
      const pending=await savePending(reflection);
      show('ขั้นที่ 2/3 Server เก็บ Pending แล้ว\nกำลังยืนยันเป็น Reflection ฉบับสมบูรณ์…');
      await commitPending(pending.pendingId);
      show('ขั้นที่ 3/3 กำลังตรวจสอบสถานะจาก Google Sheet…');
      await confirmAuthority();
      show('✓ Google Sheet ยืนยัน Reflection แล้ว\nกำลังกลับ Hero Passport');
      await sleep(650);
      const url=new URL('../index.html',location.href);url.searchParams.set('studentId',sid);url.searchParams.set('authorityRefresh',Date.now());url.searchParams.set('v','20260801-rpq56-confirmed');location.replace(url.href);
    }catch(error){
      console.error('[Reflection Pending Queue R56]',error);
      show('ยังยืนยัน Reflection ไม่สำเร็จ\nแต่คำตอบถูกเก็บบน Server Pending Queue แล้ว สามารถกู้จากเครื่องอื่นได้','error');
      if(button){button.disabled=false;button.textContent='ตรวจและส่ง Reflection อีกครั้ง'}
    }
  },true);
}

async function prefillFromServer(){
  if(!/\/assessment\/reflection\.html$/i.test(location.pathname)||!sid)return;
  const pending=await getPending().catch(()=>null);
  if(!pending?.found||!validReflection(pending.reflection))return;
  const form=document.getElementById('form');if(!form)return;
  try{form.elements.understand.value=String(pending.reflection.understand||'');form.elements.best.value=String(pending.reflection.best||'');form.elements.action.value=pending.reflection.action||''}catch(_){}
  const current=read();current.reflection=pending.reflection;current.pendingReflectionAuthority={studentId:sid,pendingId:pending.pendingId,status:pending.status||'PENDING',serverSide:true,recoveredAcrossDevice:true,version:RELEASE};write(current);
}

function boot(){installReflectionForm();prefillFromServer();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.HHReflectionPendingQueue={version:RELEASE,savePending,getPending,commitPending,confirmAuthority,recoverAcrossDevices};
console.info('[Reflection Pending Queue Client R56] installed',RELEASE);
})();