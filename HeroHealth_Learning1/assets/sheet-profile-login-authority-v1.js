(()=>{
'use strict';
const VERSION='20260730-SHEET-PROFILE-LOGIN-AUTHORITY-V3-TRANSPORT-FALLBACK';
const KEY='herohealth_learning_platform_rc2';
const ENDPOINT=(window.HH_CONFIG?.backend?.webAppUrl||'https://script.google.com/macros/s/AKfycbwa-OSdqWS7uPne01wNr5a42PgKfAoxmUUm7yMcUx2D0C0OnbjrbppNUHkfjUxm79Fz/exec').trim();
const clean=v=>String(v??'').trim().replace(/\s+/g,'');
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}};
const write=v=>localStorage.setItem(KEY,JSON.stringify(v));
function toast(text){let n=document.createElement('div');n.className='toast';n.textContent=text;document.body.appendChild(n);setTimeout(()=>n.remove(),7000)}
function busy(on,text){let box=document.getElementById('hh-sheet-profile-login');if(on&&!box){box=document.createElement('div');box.id='hh-sheet-profile-login';box.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.9);display:grid;place-items:center;padding:24px;color:#fff;font:800 18px system-ui;text-align:center;line-height:1.6;white-space:pre-line';document.body.appendChild(box)}if(box){box.textContent=text||'กำลังตรวจสอบรหัสจาก Google Sheet…';if(!on)box.remove()}}
function parsePayload(text){
  const raw=String(text||'').trim();
  if(!raw)throw new Error('sheet_empty_response');
  try{return JSON.parse(raw)}catch(_){}
  const first=raw.indexOf('('),last=raw.lastIndexOf(')');
  if(first>0&&last>first){try{return JSON.parse(raw.slice(first+1,last))}catch(_){}}
  throw new Error('sheet_invalid_response');
}
async function fetchTransport(studentId,paramName){
  const q=new URLSearchParams({action:'student',callback:'',_:String(Date.now()),loginAuthority:'sheet-v3'});
  q.set(paramName,studentId);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch(ENDPOINT+'?'+q.toString(),{method:'GET',cache:'no-store',redirect:'follow',credentials:'omit',signal:controller.signal});
    if(!res.ok)throw new Error('sheet_http_'+res.status);
    return parsePayload(await res.text());
  }finally{clearTimeout(timer)}
}
function jsonpTransport(studentId,paramName){
  return new Promise((resolve,reject)=>{
    const cb='HHLOGIN_'+Date.now()+'_'+Math.random().toString(36).slice(2),s=document.createElement('script');
    let done=false;
    const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(_){};s.remove();err?reject(err):resolve(data)};
    const timer=setTimeout(()=>finish(new Error('sheet_timeout')),18000);
    window[cb]=data=>finish(null,data);
    s.onerror=()=>finish(new Error('sheet_load_failed'));
    const q=new URLSearchParams({action:'student',callback:cb,_:String(Date.now()),loginAuthority:'sheet-v3'});
    q.set(paramName,studentId);
    s.src=ENDPOINT+'?'+q.toString();
    s.async=true;
    s.referrerPolicy='no-referrer';
    (document.head||document.body).appendChild(s);
  });
}
async function requestStudent(studentId){
  const attempts=[];
  for(const paramName of ['studentId','sid','pid']){
    try{return await fetchTransport(studentId,paramName)}catch(err){attempts.push('fetch:'+paramName+':'+(err?.message||err))}
    try{return await jsonpTransport(studentId,paramName)}catch(err){attempts.push('jsonp:'+paramName+':'+(err?.message||err))}
  }
  const e=new Error('sheet_all_transports_failed');e.attempts=attempts;throw e;
}
function validProfile(api,sid){
  const p=api?.authoritativeState?.profile||api?.student?.profile||api?.profile||api?.student||null;
  const found=api?.found===true||api?.ok===true&&!!p;
  if(!found||!p)return null;
  const resolvedId=clean(p.studentId||p.sid||p.pid||api.studentId||api.sid||api.pid);
  if(resolvedId!==sid)return null;
  const group=String(p.group||api?.authoritativeState?.group||api?.group||'').trim().toUpperCase();
  const fullName=String(p.fullName||p.studentName||p.name||'').trim();
  const section=String(p.section||api?.section||'').trim();
  if(!fullName||!section||!group)return null;
  return{studentId:resolvedId,fullName,section,group,nickname:String(p.nickname||'').trim(),active:true,sheetAuthority:true,source:'HH_Profiles'};
}
async function lookup(form){
  const sid=clean(new FormData(form).get('studentId'));
  if(!sid){toast('กรุณากรอกรหัสนักเรียน');return}
  busy(true,'กำลังตรวจสอบรหัส '+sid+'\nจาก HH_Profiles ใน Google Sheet');
  try{
    localStorage.removeItem('hh_mobile_working_endpoint');
    const api=await requestStudent(sid),profile=validProfile(api,sid);
    if(!profile){busy(false);toast('ไม่พบรหัสนักเรียนที่ใช้งานได้ใน HH_Profiles กรุณาติดต่อครู');return}
    const state=read();
    state.pendingProfile=profile;state.profile=null;state.view='student';state.sheetLoginAuthority=VERSION;state.sheetLoginVerifiedAt=new Date().toISOString();
    write(state);localStorage.removeItem('herohealth_active_student_id');busy(false);location.reload();
  }catch(err){
    busy(false);console.error('[Sheet Profile Login]',err,err?.attempts||[]);
    toast('เชื่อม Google Sheet ไม่สำเร็จ ระบบลองทุกช่องทางแล้ว กรุณาตรวจ Apps Script Deployment');
  }
}
function install(){if(!window.HH){setTimeout(install,30);return}window.HH.lookup=lookup;window.HH.__sheetProfileLoginAuthority=VERSION;document.documentElement.dataset.hhSheetProfileLogin='V3';console.info('[HeroHealth] Sheet profile login authority installed',VERSION)}
install();
})();