(function(){
'use strict';

const VERSION='2026-08-19-ATTENDANCE-CHECKIN-V3-AUTH-READY-FAILSAFE';
const SESSION_IDS=Object.freeze(['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM']);
const STORAGE_KEY='LEXICON_X_ATTENDANCE_CHECKIN_V2';
const clean=v=>String(v==null?'':v).trim();
const nowIso=()=>new Date().toISOString();

function normalizeSession(value){
  const raw=clean(value).toUpperCase().replace(/\s+/g,'-').replace(/_/g,'-');
  if(!raw) return '';
  if(SESSION_IDS.includes(raw)) return raw;
  const compact=raw.replace(/-/g,'');
  const exact=SESSION_IDS.find(id=>id.replace(/-/g,'')===compact);
  if(exact) return exact;
  const m=raw.match(/(?:DAY|D)?-?([1-3])-?(AM|PM|MORNING|AFTERNOON)/);
  if(!m) return '';
  const part=m[2]==='MORNING'?'AM':m[2]==='AFTERNOON'?'PM':m[2];
  return `D${m[1]}-${part}`;
}

function sessionFromUrl(){
  const q=new URLSearchParams(location.search);
  for(const key of ['session','attendanceSessionId','checkin','sessionId','sessionCode','round','cohort']){
    const value=normalizeSession(q.get(key));
    if(value) return value;
  }
  return '';
}

function readStored(playerId){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(!saved || clean(saved.playerId)!==clean(playerId)) return '';
    return normalizeSession(saved.attendanceSessionId||saved.sessionId);
  }catch(_){ return ''; }
}

function saveStored(playerId,sessionId){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({
      playerId:clean(playerId),
      attendanceSessionId:sessionId,
      savedAt:nowIso(),
      version:VERSION
    }));
  }catch(_){ }
}

function firebaseReady(){
  return Boolean(window.firebase && firebase.auth && firebase.firestore);
}

async function ensureAuthReady(){
  if(!firebaseReady()) return null;
  let user=firebase.auth().currentUser;
  if(user) return user;
  try{
    if(typeof window.EW_STUDENT_AUTH_ISOLATION?.ensure==='function'){
      user=await window.EW_STUDENT_AUTH_ISOLATION.ensure();
    }
  }catch(error){
    console.warn('[LEXICON X] attendance auth ensure failed',error);
  }
  return user||firebase.auth().currentUser||null;
}

async function syncAttendance(playerId){
  const id=clean(playerId);
  if(!id || !firebaseReady()) return {ok:false,checkedIn:false,reason:'NOT_READY'};
  const user=await ensureAuthReady();
  if(!user) return {ok:false,checkedIn:false,reason:'AUTH_NOT_READY'};

  const db=firebase.firestore();
  const sessionRef=db.collection('ewp_player_sessions').doc(user.uid);
  const sessionSnap=await sessionRef.get();
  const current=sessionSnap.exists?(sessionSnap.data()||{}):{};

  // A Firebase anonymous/auth UID can survive player logout/login on the same
  // browser. Therefore an existing round is authoritative ONLY when the
  // session document belongs to the same playerId. This prevents QA-01 D1-AM
  // (or any previous learner) from contaminating QA-02 D1-PM on a shared device.
  const currentPlayerId=clean(current.playerId);
  const samePlayerSession=Boolean(currentPlayerId && currentPlayerId===id);
  const existing=samePlayerSession?normalizeSession(
    current.attendanceSessionId ||
    current.checkInSessionId ||
    current.sessionId ||
    current.sessionCode ||
    current.cohortId ||
    current.roundId ||
    current.round
  ):'';
  const requested=sessionFromUrl();
  const stored=readStored(id);

  // No pre-assignment: without an actual round QR/link the learner remains
  // NOT_CHECKED_IN. Stored value is player-bound and used only for resume.
  const chosen=existing || requested || stored;
  if(!chosen){
    const detail={
      ok:true,
      checkedIn:false,
      assigned:false,
      playerId:id,
      attendanceSessionId:'',
      sessionId:'UNASSIGNED',
      status:'NOT_CHECKED_IN',
      version:VERSION
    };
    window.dispatchEvent(new CustomEvent('lexicon-attendance-checkin',{detail}));
    window.dispatchEvent(new CustomEvent('lexicon-session-assignment',{detail}));
    return detail;
  }

  const stamp=nowIso();
  const firstCheckIn=!existing;
  const source=existing?'firebase-first-checkin':requested?'round-qr-link':'local-resume';

  await sessionRef.set({
    uid:user.uid,
    playerId:id,

    // Canonical attendance fields.
    attendanceSessionId:chosen,
    checkInSessionId:chosen,
    attendanceStatus:'CHECKED_IN',
    checkedIn:true,
    checkInSource:source,
    attendanceUpdatedAt:stamp,
    ...(firstCheckIn?{checkedInAt:stamp,firstCheckedInAt:stamp}:{}),

    // Compatibility mirrors for current Teacher Console / analytics.
    sessionId:chosen,
    sessionCode:chosen,
    cohortId:chosen,
    roundId:chosen,
    sessionLocked:true,
    sessionSource:source,
    sessionUpdatedAt:stamp,
    updatedAt:stamp,
    ...(firstCheckIn?{sessionAssignedAt:stamp}:{}),

    attendanceCheckInVersion:VERSION,
    sessionAssignmentVersion:VERSION
  },{merge:true});

  // Mirror attendance into progress after progress exists so the Teacher
  // Console can group the master roster without loading sessions.
  const progressRef=db.collection('ewp_progress').doc(id);
  const progressSnap=await progressRef.get().catch(()=>null);
  if(progressSnap && progressSnap.exists){
    await progressRef.set({
      playerId:id,
      attendanceSessionId:chosen,
      checkInSessionId:chosen,
      attendanceStatus:'CHECKED_IN',
      checkedIn:true,
      checkInSource:source,
      attendanceUpdatedAt:stamp,
      ...(firstCheckIn?{checkedInAt:stamp,firstCheckedInAt:stamp}:{}),

      sessionId:chosen,
      sessionCode:chosen,
      cohortId:chosen,
      roundId:chosen,
      sessionLocked:true,
      sessionSource:source,
      sessionUpdatedAt:stamp,
      ...(firstCheckIn?{sessionAssignedAt:stamp}:{}),

      attendanceCheckInVersion:VERSION,
      sessionAssignmentVersion:VERSION
    },{merge:true});
  }

  saveStored(id,chosen);
  const detail={
    ok:true,
    checkedIn:true,
    assigned:true,
    playerId:id,
    attendanceSessionId:chosen,
    sessionId:chosen,
    status:'CHECKED_IN',
    source,
    firstCheckIn,
    locked:true,
    version:VERSION
  };
  window.dispatchEvent(new CustomEvent('lexicon-attendance-checkin',{detail}));
  window.dispatchEvent(new CustomEvent('lexicon-session-assignment',{detail}));
  return detail;
}

function wrapAuthority(){
  const authority=window.EW_AUTHORITY;
  if(!authority || authority.__attendanceCheckInWrapped) return false;

  const originalProfileLookup=authority.profileLookup?.bind(authority);
  const originalResume=authority.resume?.bind(authority);
  if(typeof originalProfileLookup!=='function' || typeof originalResume!=='function') return false;

  const wrappedProfileLookup=async function(playerId,nickname){
    // The authority first validates the learner against the master roster.
    // Unknown production IDs therefore cannot self-register.
    const result=await originalProfileLookup(playerId,nickname);
    try{ await syncAttendance(result?.profile?.playerId||playerId); }
    catch(error){ console.warn('[LEXICON X] attendance check-in profile sync',error); }
    return result;
  };

  const wrappedResume=async function(playerId,nickname){
    const result=await originalResume(playerId,nickname);
    try{
      const attendance=await syncAttendance(result?.profile?.playerId||playerId);
      if(attendance?.checkedIn){
        result.profile={
          ...(result.profile||{}),
          attendanceSessionId:attendance.attendanceSessionId,
          sessionId:attendance.sessionId,
          sessionCode:attendance.sessionId
        };
        result.progress={
          ...(result.progress||{}),
          attendanceSessionId:attendance.attendanceSessionId,
          checkedIn:true,
          attendanceStatus:'CHECKED_IN',
          sessionId:attendance.sessionId,
          sessionCode:attendance.sessionId
        };
      }
      result.attendanceCheckIn=attendance;
      // Compatibility alias while older Passport UI still refers to session assignment.
      result.sessionAssignment=attendance;
    }catch(error){ console.warn('[LEXICON X] attendance check-in resume sync',error); }
    return result;
  };

  window.EW_AUTHORITY=Object.freeze({
    ...authority,
    profileLookup:wrappedProfileLookup,
    resume:wrappedResume,
    attendanceCheckInVersion:VERSION,
    sessionAssignmentVersion:VERSION,
    __attendanceCheckInWrapped:true,
    __sessionAssignmentWrapped:true
  });
  return true;
}

function currentEntrySession(){ return sessionFromUrl()||''; }

window.EW_ATTENDANCE_CHECKIN=Object.freeze({
  VERSION,
  SESSION_IDS,
  normalizeSession,
  currentEntrySession,
  syncAttendance
});

// Compatibility export for existing Passport code.
window.EW_SESSION_ASSIGNMENT=Object.freeze({
  VERSION,
  SESSION_IDS,
  normalizeSession,
  currentEntrySession,
  syncSession:syncAttendance,
  syncAttendance
});

if(!wrapAuthority()){
  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    if(wrapAuthority() || tries>=40) clearInterval(timer);
  },100);
}

}());
