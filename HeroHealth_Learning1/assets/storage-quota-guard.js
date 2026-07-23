(()=>{
'use strict';
const ACTIVE='herohealth_learning_platform_rc2';
const CURRENT_RESUME='herohealth_student_resume_v6:';
const REMOVE_PREFIXES=[
 'herohealth_student_resume_v2:','herohealth_student_resume_v3:','herohealth_student_resume_v4:',
 'herohealth_student_resume_v5:','herohealth_student_resume_store:',
 'herohealth_backend_sent_','herohealth_backend_queue_'
];
const nativeSet=Storage.prototype.setItem;
let quotaBlocked=false;
function isQuota(err){return !!err&&(err.name==='QuotaExceededError'||err.name==='NS_ERROR_DOM_QUOTA_REACHED'||err.code===22||err.code===1014)}
function compactState(value){
 try{
  const s=JSON.parse(value||'{}');
  return JSON.stringify({
   profile:s.profile||null,pendingProfile:s.pendingProfile||null,view:s.view||'student',
   completed:s.completed||{},scores:s.scores||{},gameCompleted:s.gameCompleted||{},gameScores:s.gameScores||{},
   group:s.group||null,activeMissionProfile:s.activeMissionProfile||'CLASS_60',
   sheetAuthority:s.sheetAuthority===true,legacyVerified:s.legacyVerified===true,
   authoritativeProgress:s.authoritativeProgress||null,lastAuthoritySyncAt:s.lastAuthoritySyncAt||''
  });
 }catch(_){return value}
}
function cleanup(storage){
 try{
  const remove=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i)||'';
   if(REMOVE_PREFIXES.some(p=>k.startsWith(p))&&!k.startsWith(CURRENT_RESUME))remove.push(k);
  }
  remove.forEach(k=>storage.removeItem(k));
  const resumes=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i)||'';
   if(k.startsWith(CURRENT_RESUME)){
    try{const v=JSON.parse(storage.getItem(k)||'{}');resumes.push({k,t:Date.parse(v.savedAt||v.lastAuthoritySyncAt||0)||0})}catch(_){resumes.push({k,t:0})}
   }
  }
  resumes.sort((a,b)=>b.t-a.t).slice(2).forEach(x=>storage.removeItem(x.k));
 }catch(_){}
}
Storage.prototype.setItem=function(key,value){
 if(quotaBlocked&&key!==ACTIVE)return;
 try{return nativeSet.call(this,key,value)}catch(err){
  if(!isQuota(err))throw err;
  cleanup(this);
  try{return nativeSet.call(this,key,key===ACTIVE?compactState(value):value)}catch(err2){
   if(key===ACTIVE){
    try{return nativeSet.call(this,key,compactState(value))}catch(_){}
   }
   quotaBlocked=true;
  }
 }
};
try{cleanup(localStorage)}catch(_){}
window.HHStorageGuard={cleanup:()=>cleanup(localStorage),isQuotaBlocked:()=>quotaBlocked};
})();