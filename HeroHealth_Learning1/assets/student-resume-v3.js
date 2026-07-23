(()=>{
'use strict';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
const PREFIX='herohealth_student_resume_v3:';
const OLD_PREFIXES=['herohealth_student_resume_v2:','herohealth_student_resume_store:'];
const MIGRATION_KEY='herohealth_resume_v3_migrated';
function read(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch(_){return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
function cleanId(v){return String(v||'').trim().replace(/\s+/g,'')}
function resumeKey(id){return PREFIX+cleanId(id)}
function blankState(){const C=window.HH_CONFIG||{};return{profile:null,pendingProfile:null,view:'student',completed:{pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false},scores:{},gameCompleted:{hygiene:{},nutrition:{},fitness:{}},gameScores:{},gameResults:{},group:null,stationRound:1,classRunning:false,secondsLeft:(C.stationMinutes||10)*60,processedEventIds:[],activeMissionProfile:C.activeMissionProfile||'CLASS_60'}}
function migrateOnce(){if(localStorage.getItem(MIGRATION_KEY)==='1')return;for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)||'';if(OLD_PREFIXES.some(p=>k.startsWith(p)))localStorage.removeItem(k)}localStorage.setItem(MIGRATION_KEY,'1')}
function current(){return read(ACTIVE_KEY,{})}
function snapshot(state=current()){
 const id=cleanId(state?.profile?.studentId);if(!id)return false;
 const saved={...state,pendingProfile:null,view:'student',savedAt:new Date().toISOString()};
 return write(resumeKey(id),saved)
}
function restore(id,profile){
 const saved=read(resumeKey(id),null);if(!saved||cleanId(saved?.profile?.studentId)!==cleanId(id))return null;
 const restored={...saved,profile:{...(saved.profile||{}),...(profile||{})},pendingProfile:null,group:(profile?.group||saved.group||saved?.profile?.group||null),view:'student'};
 write(ACTIVE_KEY,restored);return restored
}
function install(){
 if(!window.HH){setTimeout(install,30);return}if(window.HH.__resumeV3)return;
 const originalConfirm=window.HH.confirmLogin?.bind(window.HH);
 window.HH.confirmLogin=function(){
  const s=current(),p=s.pendingProfile,id=cleanId(p?.studentId);if(!id)return originalConfirm?.();
  if(restore(id,p)){location.reload();return}
  const fresh={...blankState(),pendingProfile:p};write(ACTIVE_KEY,fresh);location.reload()
 };
 window.HH.logout=function(){
  const s=current();if(!s?.profile)return;
  if(!confirm('ออกจาก Hero Passport ของผู้เล่นนี้?\nความคืบหน้าจะถูกเก็บไว้เพื่อกลับมาเล่นต่อ'))return;
  snapshot(s);write(ACTIVE_KEY,blankState());location.reload()
 };
 window.HH.__resumeV3=true;snapshot()
}
migrateOnce();
const initial=current();if(!initial?.profile&&!initial?.pendingProfile)write(ACTIVE_KEY,blankState());
addEventListener('pagehide',()=>snapshot());
addEventListener('visibilitychange',()=>{if(document.hidden)snapshot()});
setInterval(()=>snapshot(),2000);
install();
window.HHStudentResume={snapshot,restore,blankState};
})();