// Offline, student-data-free regression test for S1 Reading receipts.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const transport=readFileSync(new URL('../eap-sheet-transport-v124.js',import.meta.url),'utf8');
const router=readFileSync(new URL('../../herohealth/eap-word-quest/apps-script/SharedWebAppRouter.gs',import.meta.url),'utf8');
const endpoint='https://script.google.com/macros/s/QA-READING-CONTRACT/exec';
const payload={
  action:'submit_attempt',submissionKind:'fresh_evidence_v118',
  attemptId:'QA-READING-001',studentId:'QA-READING-USER',studentName:'QA Test',
  section:'122-QA',sessionId:'1',skill:'Reading',score:'88',
  accuracy:'88',passed:'true',legacyCompletion:'false'
};
function attemptUrl(p){
  const url=new URL(endpoint);
  Object.entries(p).forEach(([key,value])=>url.searchParams.set(key,String(value)));
  return url.toString();
}
function browserHarness(nativeFetch){
  const storage=new Map();
  storage.set('EAP_HERO_ACTIVE_PLAYER_V1',JSON.stringify({studentId:payload.studentId,section:payload.section}));
  const listeners={};
  const calls=[];
  const win={
    EAP_SHEET_CONFIG:{enabled:true,webAppUrl:endpoint,section:'122-QA'},
    fetch:(...args)=>{calls.push(args);return nativeFetch(...args);},
    addEventListener:(event,fn)=>{listeners[event]=fn;},
    EAPPlayerResumeStableJSONP:{request:()=>true}
  };
  const sandbox={
    window:win,URL,Promise,Date,Number,JSON,String,Array,Object,Math,RegExp,Error,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    location:{href:'https://qa.example/hero'},
    setTimeout:()=>0,setInterval:()=>0,
    console
  };
  vm.runInNewContext(transport,sandbox,{filename:'eap-sheet-transport-v124.js'});
  return {win,calls,listeners,storage};
}
function official(evidenceId,score=88,studentId=payload.studentId){
  return {ok:true,authorityMode:'EAP_Progress-single-source-of-truth',
    studentId,section:payload.section,routeProgress:{
      S1:{skills:{Reading:{score,evidenceId,passed:true}}}
    }};
}
function scriptHarness(){
  let received=null,mirrored=null;
  const output=s=>({text:s,setMimeType(){return this;}});
  const sandbox={
    ContentService:{createTextOutput:output,MimeType:{JSON:'json',JAVASCRIPT:'js'}},
    eapHeroSubmitAttemptGuarded_:(p)=>{received=p;return {ok:true,attemptId:p.attemptId,score:p.score};},
    eapProgressUpsertV150_:(p)=>{mirrored=p;return {ok:true,routeId:'S1',skill:'Reading',score:Number(p.score),passed:Number(p.score)>=60,completed:false,passedSkillCount:1,requiredSkillCount:2};},
    console
  };
  vm.runInNewContext(router,sandbox,{filename:'SharedWebAppRouter.gs'});
  const post=p=>JSON.parse(sandbox.doPost({postData:{contents:JSON.stringify(p)}}).text);
  return {post,get received(){return received;},get mirrored(){return mirrored;}};
}
// Never infer official receipt from an opaque network response.
{
  const h=browserHarness(()=>Promise.resolve({type:'opaque',status:0,ok:false}));
  assert.equal(h.win.EAPHeroTrustedTransportV124.diagnostics().pending,0);
  const response=await h.win.fetch(attemptUrl(payload),{mode:'no-cors'});
  assert.equal(response.type,'opaque');
  assert.equal(response.status,0);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0][0],endpoint);
  assert.equal(h.calls[0][1].method,'POST');
  const body=JSON.parse(h.calls[0][1].body);
  assert.equal(body.attemptId,payload.attemptId);
  assert.equal(body.evidenceId,payload.attemptId);
  assert.equal(body.routeId,'S1');
  assert.equal(body.score,'88');
  assert.equal(h.win.EAPHeroTrustedTransportV124.diagnostics().pending,1);
  assert.equal(h.win.EAPHeroTrustedTransportV124.reconcile(official('NOT-THE-SAME-ID')),false);
  assert.equal(h.win.EAPHeroTrustedTransportV124.reconcile(official(payload.attemptId,60)),false);
  assert.equal(h.win.EAPHeroTrustedTransportV124.diagnostics().pending,1);
  await assert.rejects(h.win.fetch(attemptUrl({...payload,score:'99'})),/Conflicting score/);
  assert.equal(h.win.EAPHeroTrustedTransportV124.reconcile(official(payload.attemptId)),true);
  assert.equal(h.win.EAPHeroTrustedTransportV124.diagnostics().pending,0);
  assert.equal(h.win.EAPHeroTrustedTransportV124.diagnostics().confirmed,1);
  await h.win.fetch(attemptUrl(payload));
  assert.equal(h.calls.length,1,'confirmed attempt must not be posted again');
}
// Network error must not erase a queued attempt, including across retry.
{
  const h=browserHarness(()=>Promise.reject(new Error('network unavailable')));
  await assert.rejects(h.win.fetch(attemptUrl(payload)),/network unavailable/);
  assert.equal(h.win.EAPHeroTrustedTransportV124.diagnostics().pending,1);
  const map=JSON.parse(h.storage.get('EAP_HERO_VERIFIED_ATTEMPT_PENDING_V124'));
  const key=Object.keys(map)[0];map[key].lastSentAt=0;
  h.storage.set('EAP_HERO_VERIFIED_ATTEMPT_PENDING_V124',JSON.stringify(map));
  h.win.EAPHeroTrustedTransportV124.retryPending();
  await Promise.resolve();await Promise.resolve();
  assert.equal(h.calls.length,2);
  assert.equal(JSON.parse(h.calls[1][1].body).attemptId,payload.attemptId);
}
// A local score alone never creates a submission.
{
  const h=browserHarness(()=>Promise.resolve({type:'opaque',status:0}));
  h.storage.set('EAP_HERO_PROGRESS_V3',JSON.stringify({
    portfolio:[{sessionId:'S1',skill:'Reading',score:100,pendingSheetSync:true}]
  }));
  assert.equal(h.win.EAPHeroTrustedTransportV124.diagnostics().pending,0);
  assert.equal(h.calls.length,0);
}
// Backend: one guarded attempt, one EAP_Progress mirror, fail closed.
{
  const h=scriptHarness();
  const good=h.post({...payload,evidenceId:payload.attemptId});
  assert.equal(good.ok,true);
  assert.equal(good.progressConfirmed,true);
  assert.equal(h.received.attemptId,payload.attemptId);
  assert.equal(h.mirrored.evidenceId,payload.attemptId);
  const invalid=h.post({...payload,evidenceId:'DIFFERENT'});
  assert.equal(invalid.ok,false);
  const h2=scriptHarness();
  const low=h2.post({...payload,evidenceId:payload.attemptId,score:35,passed:true});
  assert.equal(low.ok,true);
  assert.equal(h2.mirrored.passed,false,'low score must not become an official pass');
}
console.log('EAP S1 Reading receipt contract: PASS (no real students or network)');