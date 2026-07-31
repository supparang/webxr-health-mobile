(()=>{
'use strict';

const RELEASE='20260731-GAME-SHELL-AUTO-RETURN-R41.1-RECEIPT-GUARD';
const path=String(location.pathname||'');
if(!/game-shell-authority-r40\.html$/i.test(path))return;

const q=new URLSearchParams(location.search);
const sid=String(q.get('studentId')||q.get('sid')||'').trim();
const zone=String(q.get('zone')||'').trim();
const gameId=String(q.get('gameId')||'').trim();
const back=q.get('return')||'./index.html';
const endpoint=String(window.HH_CONFIG?.backend?.webAppUrl||'').trim();
const STATE_KEY='herohealth_learning_platform_rc2';
const QUEUE_KEY='herohealth_backend_queue_v10_full';
const SENT_KEY='herohealth_full_analytics_sent_v1';
const RESUME_PREFIX='herohealth_student_resume_v6:';

if(!sid||!zone||!gameId||!endpoint)return;

let navigating=false;
let polling=false;
let pollStartedAt=0;
let lastConfirmedApi=null;

const clean=v=>String(v==null?'':v).trim();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:undefined};
const yes=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function readJson(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}
  catch(_){return fallback}
}
function writeJson(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));return true}
  catch(_){return false}
}
function currentPayload(){
  const rows=readJson(QUEUE_KEY,[]);
  return rows.slice().reverse().find(payload=>
    clean(payload?.studentId)===sid &&
    clean(payload?.game?.zone||payload?.zone)===zone &&
    clean(payload?.game?.gameId||payload?.gameId)===gameId
  )||null;
}
function dequeue(eventId){
  if(!eventId)return;
  writeJson(QUEUE_KEY,readJson(QUEUE_KEY,[]).filter(payload=>clean(payload?.eventId)!==clean(eventId)));
}
function markSent(payload){
  if(!payload?.submissionKey||!payload?.eventId)return;
  const sent=readJson(SENT_KEY,{});
  sent[payload.submissionKey]={eventId:payload.eventId,sentAt:new Date().toISOString(),confirmedBy:RELEASE};
  writeJson(SENT_KEY,Object.fromEntries(Object.entries(sent).slice(-200)));
}
function jsonp(params,timeout=15000){
  return new Promise((resolve,reject)=>{
    const cb='HHAR41_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    let done=false;
    const finish=(error,data)=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      try{delete window[cb]}catch(_){}
      try{script.remove()}catch(_){}
      error?reject(error):resolve(data);
    };
    const timer=setTimeout(()=>finish(new Error('authority_timeout')),timeout);
    window[cb]=data=>finish(null,data);
    script.onerror=()=>finish(new Error('authority_load_failed'));
    script.src=endpoint+(endpoint.includes('?')?'&':'?')+new URLSearchParams({...params,callback:cb,clientVersion:RELEASE,_:Date.now()});
    document.head.appendChild(script);
  });
}
function gameResultCandidates(api){
  const key=`${zone}:${gameId}`;
  const roots=[api,api?.authoritativeState].filter(Boolean);
  const out=[];
  roots.forEach(root=>{
    const results=root?.gameResults||{};
    [results[key],results[gameId],results?.[zone]?.[gameId]].forEach(row=>{if(row&&typeof row==='object')out.push(row)});
  });
  return out;
}
function currentResultMatches(api,payload){
  if(!api||api.ok!==true||!payload)return false;
  const expectedEvent=clean(payload.eventId||payload.game?.eventId);
  const expectedScore=num(payload.game?.score);
  const expectedAccuracy=num(payload.game?.accuracy);
  const startedMs=Date.parse(payload.game?.startedAt||payload.game?.openedAt||payload.clientTs||'');
  return gameResultCandidates(api).some(row=>{
    const rowEvent=clean(row.eventId||row.event_id);
    if(expectedEvent&&rowEvent===expectedEvent)return true;
    const finishedMs=Date.parse(row.finishedAt||row.serverTs||row.clientTs||'');
    const score=num(row.score),accuracy=num(row.accuracy);
    const scoreMatches=expectedScore===undefined||score===undefined||Math.abs(score-expectedScore)<0.001;
    const accuracyMatches=expectedAccuracy===undefined||accuracy===undefined||Math.abs(accuracy-expectedAccuracy)<0.01;
    const timeMatches=Number.isFinite(startedMs)&&Number.isFinite(finishedMs)&&finishedMs>=startedMs-5000;
    return yes(row.completed)&&scoreMatches&&accuracyMatches&&timeMatches;
  });
}
function authorityGameCompleted(api){
  const roots=[api,api?.authoritativeState].filter(Boolean);
  return roots.some(root=>root?.gameCompleted?.[zone]?.[gameId]===true);
}
function mergeAuthority(api){
  const authority=api?.authoritativeState||api||{};
  const old=readJson(STATE_KEY,{});
  const apiGames=authority.gameCompleted||api?.gameCompleted||{};
  const oldGames=old.gameCompleted||{};
  const mergedGames={...oldGames,...apiGames,[zone]:{...(oldGames[zone]||{}),...(apiGames[zone]||{}),[gameId]:true}};
  const profile={...(old.profile||{}),...(authority.profile||{}),...(api?.profile||{}),studentId:sid};
  const next={
    ...old,
    ...authority,
    profile,
    completed:{...(old.completed||{}),...(authority.completed||{}),...(api?.completed||{})},
    gameCompleted:mergedGames,
    gameScores:{...(old.gameScores||{}),...(authority.gameScores||{}),...(api?.gameScores||{})},
    gameResults:{...(old.gameResults||{}),...(authority.gameResults||{}),...(api?.gameResults||{})},
    sheetAuthority:true,
    lastAuthoritySyncAt:new Date().toISOString(),
    sheetVersion:api?.version||authority.authorityVersion||old.sheetVersion||'',
    authoritativeProgress:authority.progress||api?.progress||null
  };
  writeJson(STATE_KEY,next);
  writeJson(RESUME_PREFIX+sid,next);
}
function returnUrl(api,pending=false){
  const url=new URL(back,location.href);
  url.searchParams.set('sid',sid);
  url.searchParams.set('authorityRefresh',Date.now());
  url.searchParams.set('gameSync','1');
  url.searchParams.set('autoNext','1');
  url.searchParams.set('shellVersion',RELEASE);
  url.searchParams.set('analyticsMode','full-once');
  if(pending)url.searchParams.set('pendingGameSync',`${zone}:${gameId}`);
  const next=api?.authoritativeState?.progress?.nextStep||api?.progress?.nextStep;
  if(next)url.searchParams.set('confirmedNext',next);
  return url.href;
}
function childFriendlyUi(mode='checking'){
  const overlay=document.getElementById('overlay');
  if(!overlay?.classList.contains('show'))return;
  const audit=document.getElementById('audit');
  const sync=document.getElementById('sync');
  const status=document.getElementById('status');
  const primary=document.getElementById('returnBtn');
  const secondary=document.getElementById('leaveBtn');
  if(audit)audit.textContent='บันทึกข้อมูลการเล่นครบถ้วนแล้ว';
  if(status)status.textContent=mode==='confirmed'?'บันทึกผลสำเร็จ':'กำลังตรวจสอบผล';
  if(sync){
    sync.classList.remove('error');
    sync.textContent=mode==='confirmed'
      ?'บันทึกผลสำเร็จ • กำลังกลับ Hero Passport…'
      :'กำลังยืนยันผลกับ Google Sheet และจะกลับ Hero Passport อัตโนมัติ…';
  }
  if(primary){
    primary.textContent=mode==='confirmed'?'กำลังกลับ Hero Passport…':'กำลังตรวจสอบผล…';
    primary.disabled=true;
  }
  if(secondary){
    secondary.style.display='none';
    secondary.disabled=true;
    secondary.setAttribute('aria-hidden','true');
    secondary.tabIndex=-1;
  }
}
function installReceiptGuard(){
  const overlay=document.getElementById('overlay');
  const secondary=document.getElementById('leaveBtn');
  const backButton=document.getElementById('back');
  if(secondary){
    secondary.style.display='none';
    secondary.disabled=true;
    secondary.setAttribute('aria-hidden','true');
    secondary.tabIndex=-1;
  }
  if(backButton&&!backButton.dataset.hhReceiptGuard){
    backButton.dataset.hhReceiptGuard='1';
    backButton.addEventListener('click',event=>{
      if(!overlay?.classList.contains('show')&&!polling&&!navigating)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      childFriendlyUi('checking');
      schedule();
    },true);
  }
}
async function confirmCurrentPayload(payload){
  if(!payload)return null;
  try{
    const event=await jsonp({action:'event',eventId:payload.eventId},10000).catch(()=>null);
    if(event?.ok===true&&event?.found===true){
      const api=await jsonp({action:'student',studentId:sid,reconcile:'1',force:'1'},15000).catch(()=>null);
      if(api?.ok===true&&authorityGameCompleted(api))return api;
      return {ok:true,eventConfirmed:true,authoritativeState:null};
    }
    const api=await jsonp({action:'student',studentId:sid,reconcile:'1',force:'1'},15000).catch(()=>null);
    if(currentResultMatches(api,payload))return api;
    if(api?.ok===true&&authorityGameCompleted(api)&&currentResultMatches(api,payload))return api;
  }catch(error){console.warn('[R41.1 authority check]',error)}
  return null;
}
async function navigateConfirmed(api,payload){
  if(navigating)return;
  navigating=true;
  lastConfirmedApi=api;
  if(api?.authoritativeState||api?.gameCompleted)mergeAuthority(api);
  dequeue(payload?.eventId);
  markSent(payload);
  childFriendlyUi('confirmed');
  await sleep(500);
  location.replace(returnUrl(api,false));
}
async function poll(){
  if(polling||navigating)return;
  installReceiptGuard();
  const overlay=document.getElementById('overlay');
  const payload=currentPayload();
  if(!overlay?.classList.contains('show')&&!payload)return;
  polling=true;
  if(!pollStartedAt)pollStartedAt=Date.now();
  childFriendlyUi('checking');
  try{
    const api=await confirmCurrentPayload(payload);
    if(api){await navigateConfirmed(api,payload);return}
    const age=Date.now()-pollStartedAt;
    if(age>90000){
      const sync=document.getElementById('sync');
      const primary=document.getElementById('returnBtn');
      const secondary=document.getElementById('leaveBtn');
      if(sync){
        sync.classList.add('error');
        sync.textContent='Google Sheet ยังไม่ตอบกลับ • ผลยังไม่ยืนยัน กรุณาตรวจผลอีกครั้ง';
      }
      if(primary){
        primary.textContent='ตรวจผลอีกครั้ง';
        primary.disabled=false;
        primary.onclick=()=>{
          pollStartedAt=Date.now();
          primary.disabled=true;
          primary.textContent='กำลังตรวจสอบผล…';
          schedule();
        };
      }
      if(secondary){secondary.style.display='none';secondary.disabled=true}
      return;
    }
  }finally{polling=false}
}

function schedule(){setTimeout(poll,80)}
new MutationObserver(()=>{installReceiptGuard();schedule()}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
addEventListener('DOMContentLoaded',()=>{installReceiptGuard();schedule()});
addEventListener('online',schedule);
setInterval(poll,1400);
installReceiptGuard();

window.HHGameShellAutoReturnR41={release:RELEASE,poll,currentPayload,installReceiptGuard,get lastConfirmedApi(){return lastConfirmedApi}};
})();
