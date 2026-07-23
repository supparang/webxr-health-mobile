(()=>{
'use strict';
const ACTIVE='herohealth_learning_platform_rc2';
const KEEP_PREFIXES=['herohealth_student_resume_v6:'];
const REMOVE_PREFIXES=['herohealth_student_resume_v2:','herohealth_student_resume_v3:','herohealth_student_resume_v4:','herohealth_student_resume_v5:','herohealth_student_resume_store:'];
const nativeSet=Storage.prototype.setItem;
function isQuota(err){return !!err&&(err.name==='QuotaExceededError'||err.name==='NS_ERROR_DOM_QUOTA_REACHED'||err.code===22||err.code===1014)}
function cleanup(storage){
 try{
  const remove=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i)||'';
   if(REMOVE_PREFIXES.some(p=>k.startsWith(p)))remove.push(k);
   if(k.startsWith('herohealth_backend_sent_')||k.startsWith('herohealth_backend_queue_')){
    try{
     const v=JSON.parse(storage.getItem(k)||'[]');
     if(Array.isArray(v)&&v.length>300)nativeSet.call(storage,k,JSON.stringify(v.slice(-300)));
    }catch(_){}
   }
  }
  remove.forEach(k=>storage.removeItem(k));
  const resumes=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i)||'';
   if(KEEP_PREFIXES.some(p=>k.startsWith(p))){
    try{const v=JSON.parse(storage.getItem(k)||'{}');resumes.push({k,t:Date.parse(v.savedAt||v.lastAuthoritySyncAt||0)||0})}catch(_){resumes.push({k,t:0})}
   }
  }
  resumes.sort((a,b)=>b.t-a.t).slice(12).forEach(x=>storage.removeItem(x.k));
 }catch(_){}
}
Storage.prototype.setItem=function(key,value){
 try{return nativeSet.call(this,key,value)}catch(err){
  if(!isQuota(err))throw err;
  cleanup(this);
  try{return nativeSet.call(this,key,value)}catch(err2){
   if(key===ACTIVE){
    try{
     const s=JSON.parse(value||'{}');
     const compact={profile:s.profile||null,pendingProfile:s.pendingProfile||null,view:s.view||'student',completed:s.completed||{},scores:s.scores||{},gameCompleted:s.gameCompleted||{},gameScores:s.gameScores||{},group:s.group||null,activeMissionProfile:s.activeMissionProfile||'CLASS_60',sheetAuthority:s.sheetAuthority===true,legacyVerified:s.legacyVerified===true,authoritativeProgress:s.authoritativeProgress||null};
     return nativeSet.call(this,key,JSON.stringify(compact));
    }catch(_){}
   }
   console.warn('HeroHealth storage quota: write skipped',key);
  }
 }
};
try{cleanup(localStorage)}catch(_){}
})();
