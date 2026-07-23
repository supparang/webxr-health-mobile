(()=>{
'use strict';
const ACTIVE_KEY='herohealth_learning_platform_rc2';
const STORE_PREFIX='herohealth_student_resume_v1:';
const EMPTY_STATE={
  profile:null,pendingProfile:null,view:'student',
  completed:{pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false},
  scores:{},gameCompleted:{hygiene:{},nutrition:{},fitness:{}},gameScores:{},gameResults:{},group:null,
  stationRound:1,classRunning:false,secondsLeft:600,processedEventIds:[],activeMissionProfile:'CLASS_60'
};
function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch(_){return fallback}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(_){return false}}
function studentIdOf(s){return String(s?.profile?.studentId||s?.pendingProfile?.studentId||'').trim()}
function resumeKey(studentId){return STORE_PREFIX+String(studentId||'').trim()}
function saveActive(){
 const s=read(ACTIVE_KEY);const sid=String(s?.profile?.studentId||'').trim();
 if(!sid)return false;
 const copy={...s,lastSavedAt:new Date().toISOString()};
 copy.pendingProfile=null;
 return write(resumeKey(sid),copy);
}
function restoreFor(profile,current){
 const sid=String(profile?.studentId||'').trim();
 const saved=read(resumeKey(sid));
 if(!saved)return {...EMPTY_STATE,activeMissionProfile:current?.activeMissionProfile||'CLASS_60',profile:{...profile},group:profile.group,pendingProfile:null,view:'student'};
 return {
   ...EMPTY_STATE,...saved,
   completed:{...EMPTY_STATE.completed,...(saved.completed||{})},
   gameCompleted:{
     hygiene:{...(saved.gameCompleted?.hygiene||{})},
     nutrition:{...(saved.gameCompleted?.nutrition||{})},
     fitness:{...(saved.gameCompleted?.fitness||{})}
   },
   profile:{...profile},group:profile.group,pendingProfile:null,view:'student',
   activeMissionProfile:saved.activeMissionProfile||current?.activeMissionProfile||'CLASS_60',
   resumedAt:new Date().toISOString()
 };
}
function install(){
 if(!window.HH)return setTimeout(install,50);
 const originalConfirm=window.HH.confirmLogin;
 window.HH.confirmLogin=function(){
   const current=read(ACTIVE_KEY,{});const profile=current?.pendingProfile;
   if(!profile)return originalConfirm?.();
   const restored=restoreFor(profile,current);
   write(ACTIVE_KEY,restored);
   location.reload();
 };
 window.HH.logout=function(){
   const current=read(ACTIVE_KEY,{});const sid=String(current?.profile?.studentId||'').trim();
   if(!sid){write(ACTIVE_KEY,{...EMPTY_STATE});location.reload();return;}
   if(!confirm('ออกจาก Hero Passport ของผู้เล่นนี้? ความคืบหน้าจะถูกเก็บไว้และกลับมาเล่นต่อได้'))return;
   saveActive();
   const loggedOut={...EMPTY_STATE,activeMissionProfile:current.activeMissionProfile||'CLASS_60',lastLogoutStudentId:sid};
   write(ACTIVE_KEY,loggedOut);
   location.reload();
 };
 window.HHResume={saveActive,restoreFor,resumeKey};
 setInterval(saveActive,1000);
 addEventListener('pagehide',saveActive);
 addEventListener('beforeunload',saveActive);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)saveActive()});
}
install();
})();
