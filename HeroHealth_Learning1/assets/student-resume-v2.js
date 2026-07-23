(()=>{
'use strict';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
const PREFIX='herohealth_student_resume_v2:';
function read(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(_){return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
function cleanId(v){return String(v||'').trim().replace(/\s+/g,'')}
function resumeKey(id){return PREFIX+cleanId(id)}
function current(){return read(ACTIVE_KEY,{})}
function snapshot(state=current()){
 const id=cleanId(state?.profile?.studentId);
 if(!id)return false;
 const saved={...state,pendingProfile:null,view:'student',savedAt:new Date().toISOString()};
 return write(resumeKey(id),saved);
}
function restore(id,profile){
 const key=resumeKey(id),saved=read(key,null);
 if(!saved||cleanId(saved?.profile?.studentId)!==cleanId(id))return null;
 const restored={...saved,profile:{...(saved.profile||{}),...(profile||{})},pendingProfile:null,group:(profile?.group||saved.group||saved?.profile?.group||null),view:'student'};
 write(ACTIVE_KEY,restored);
 return restored;
}
function install(){
 if(!window.HH){setTimeout(install,30);return}
 if(window.HH.__resumeV2)return;
 const originalConfirm=window.HH.confirmLogin?.bind(window.HH);
 const originalLogout=window.HH.logout?.bind(window.HH);
 window.HH.confirmLogin=function(){
  const s=current(),p=s.pendingProfile;
  const id=cleanId(p?.studentId);
  if(id&&restore(id,p)){location.reload();return}
  originalConfirm?.();
  setTimeout(()=>snapshot(),0);
 };
 window.HH.logout=function(){
  const s=current();
  if(!s?.profile)return originalLogout?.();
  if(!confirm('ออกจาก Hero Passport ของผู้เล่นนี้?\nความคืบหน้าจะถูกเก็บไว้เพื่อกลับมาเล่นต่อ'))return;
  snapshot(s);
  const blank={...s,profile:null,pendingProfile:null,group:null,view:'student'};
  write(ACTIVE_KEY,blank);
  location.reload();
 };
 window.HH.__resumeV2=true;
 snapshot();
}
addEventListener('pagehide',()=>snapshot());
addEventListener('visibilitychange',()=>{if(document.hidden)snapshot()});
addEventListener('storage',e=>{if(e.key===ACTIVE_KEY)setTimeout(()=>snapshot(),0)});
setInterval(()=>snapshot(),2000);
install();
window.HHStudentResume={snapshot,restore};
})();
