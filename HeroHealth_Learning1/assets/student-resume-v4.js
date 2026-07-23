(()=>{
'use strict';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
const PREFIX='herohealth_student_resume_v4:';
function read(key,fallback=null){try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw)}catch(_){return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
function cleanId(v){return String(v||'').trim().replace(/\s+/g,'')}
function resumeKey(id){return PREFIX+cleanId(id)}
function blankState(){const C=window.HH_CONFIG||{};return{profile:null,pendingProfile:null,view:'student',completed:{pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false},scores:{},gameCompleted:{hygiene:{},nutrition:{},fitness:{}},gameScores:{},gameResults:{},group:null,stationRound:1,classRunning:false,secondsLeft:(C.stationMinutes||10)*60,processedEventIds:[],activeMissionProfile:C.activeMissionProfile||'CLASS_60'}}
function current(){return read(ACTIVE_KEY,{})||{}}
function validSaved(saved,id){return !!saved&&cleanId(saved?.profile?.studentId)===cleanId(id)}
function snapshot(state=current()){
 const id=cleanId(state?.profile?.studentId);if(!id)return false;
 const saved={...state,pendingProfile:null,view:'student',group:state.group||state.profile?.group||null,savedAt:new Date().toISOString()};
 return write(resumeKey(id),saved)
}
function restore(id,profile){
 const saved=read(resumeKey(id),null);if(!validSaved(saved,id))return null;
 const restored={...blankState(),...saved,profile:{...(saved.profile||{}),...(profile||{})},pendingProfile:null,group:profile?.group||saved.group||saved?.profile?.group||null,view:'student'};
 restored.completed={...blankState().completed,...(saved.completed||{})};
 restored.gameCompleted={...blankState().gameCompleted,...(saved.gameCompleted||{})};
 write(ACTIVE_KEY,restored);return restored
}
function createFresh(profile){
 const fresh={...blankState(),profile:{...(profile||{})},pendingProfile:null,group:profile?.group||null,view:'student'};
 write(ACTIVE_KEY,fresh);write(resumeKey(profile?.studentId),fresh);return fresh
}
function install(){
 if(!window.HH){setTimeout(install,30);return}if(window.HH.__resumeV4)return;
 window.HH.confirmLogin=function(){
  const s=current(),p=s.pendingProfile,id=cleanId(p?.studentId);if(!id)return;
  if(restore(id,p)){location.reload();return}
  createFresh(p);location.reload()
 };
 window.HH.logout=function(){
  const s=current();if(!s?.profile)return;
  if(!confirm('ออกจาก Hero Passport ของผู้เล่นนี้?\nความคืบหน้าจะถูกเก็บไว้เพื่อกลับมาเล่นต่อ'))return;
  snapshot(s);write(ACTIVE_KEY,blankState());location.reload()
 };
 window.HH.__resumeV4=true;
 const s=current();if(s?.profile)snapshot(s)
}
const initial=current();
// Never carry a different learner's active progress into the login screen.
if(!initial?.profile)write(ACTIVE_KEY,blankState());
addEventListener('pagehide',()=>snapshot());
addEventListener('visibilitychange',()=>{if(document.hidden)snapshot()});
setInterval(()=>snapshot(),2000);
install();
window.HHStudentResume={snapshot,restore,createFresh,blankState};
})();
