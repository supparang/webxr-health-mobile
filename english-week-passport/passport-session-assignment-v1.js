(function(){
'use strict';

const VERSION='2026-08-10-SESSION-ASSIGNMENT-V1-6ROUND-LOCKED';
const SESSION_IDS=Object.freeze(['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM']);
const STORAGE_KEY='LEXICON_X_SESSION_ASSIGNMENT_V1';
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
  for(const key of ['session','sessionId','sessionCode','round','cohort']){
    const value=normalizeSession(q.get(key));
    if(value) return value;
  }
  return '';
}

function readStored(playerId){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(!saved || clean(saved.playerId)!==clean(playerId)) return '';
    return normalizeSession(saved.sessionId);
  }catch(_){ return ''; }
}

function saveStored(playerId,sessionId){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({
      playerId:clean(playerId),
      sessionId,
      savedAt:nowIso(),
      version:VERSION
    }));
  }catch(_){ }
}

function firebaseReady(){
  return Boolean(window.firebase && firebase.auth && firebase.firestore);
}

async function syncSession(playerId){
  const id=clean(playerId);
  if(!id || !firebaseReady()) return {ok:false,assigned:false,reason:'NOT_READY'};
  const user=firebase.auth().currentUser;
  if(!user) return {ok:false,assigned:false,reason:'AUTH_NOT_READY'};

  const db=firebase.firestore();
  const sessionRef=db.collection('ewp_player_sessions').doc(user.uid);
  const sessionSnap=await sessionRef.get();
  const current=sessionSnap.exists?(sessionSnap.data()||{}):{};
  const existing=normalizeSession(current.sessionId||current.sessionCode||current.cohortId||current.roundId||current.round);
  const requested=sessionFromUrl();
  const stored=readStored(id);

  // Server assignment is authoritative once present. This prevents accidental
  // cohort switching when a learner later opens the wrong QR/session link.
  const chosen=existing || requested || stored;
  if(!chosen){
    window.dispatchEvent(new CustomEvent('lexicon-session-assignment',{detail:{ok:true,assigned:false,playerId:id,sessionId:'UNASSIGNED',version:VERSION}}));
    return {ok:true,assigned:false,playerId:id,sessionId:'UNASSIGNED',version:VERSION};
  }

  const stamp=nowIso();
  const firstAssignment=!existing;
  const source=existing?'firebase-locked':requested?'entry-link':'local-resume';

  await sessionRef.set({
    uid:user.uid,
    playerId:id,
    sessionId:chosen,
    sessionCode:chosen,
    cohortId:chosen,
    roundId:chosen,
    sessionLocked:true,
    sessionSource:source,
    sessionUpdatedAt:stamp,
    updatedAt:stamp,
    ...(firstAssignment?{sessionAssignedAt:stamp}:{}),
    sessionAssignmentVersion:VERSION
  },{merge:true});

  // Progress is already read by Teacher Console, so mirror the immutable
  // session assignment there. Do not create progress prematurely.
  const progressRef=db.collection('ewp_progress').doc(id);
  const progressSnap=await progressRef.get().catch(()=>null);
  if(progressSnap && progressSnap.exists){
    await progressRef.set({
      playerId:id,
      sessionId:chosen,
      sessionCode:chosen,
      cohortId:chosen,
      roundId:chosen,
      sessionLocked:true,
      sessionSource:source,
      sessionUpdatedAt:stamp,
      ...(firstAssignment?{sessionAssignedAt:stamp}:{}),
      sessionAssignmentVersion:VERSION
    },{merge:true});
  }

  saveStored(id,chosen);
  const detail={ok:true,assigned:true,playerId:id,sessionId:chosen,source,locked:true,version:VERSION};
  window.dispatchEvent(new CustomEvent('lexicon-session-assignment',{detail}));
  return detail;
}

function wrapAuthority(){
  const authority=window.EW_AUTHORITY;
  if(!authority || authority.__sessionAssignmentWrapped) return false;

  const originalProfileLookup=authority.profileLookup?.bind(authority);
  const originalResume=authority.resume?.bind(authority);
  if(typeof originalProfileLookup!=='function' || typeof originalResume!=='function') return false;

  const wrappedProfileLookup=async function(playerId,nickname){
    const result=await originalProfileLookup(playerId,nickname);
    try{ await syncSession(result?.profile?.playerId||playerId); }catch(error){ console.warn('[LEXICON X] session assignment profile sync',error); }
    return result;
  };

  const wrappedResume=async function(playerId,nickname){
    const result=await originalResume(playerId,nickname);
    try{
      const session=await syncSession(result?.profile?.playerId||playerId);
      if(session?.assigned){
        result.profile={...(result.profile||{}),sessionId:session.sessionId,sessionCode:session.sessionId};
        result.progress={...(result.progress||{}),sessionId:session.sessionId,sessionCode:session.sessionId};
        result.sessionAssignment=session;
      }
    }catch(error){ console.warn('[LEXICON X] session assignment resume sync',error); }
    return result;
  };

  window.EW_AUTHORITY=Object.freeze({
    ...authority,
    profileLookup:wrappedProfileLookup,
    resume:wrappedResume,
    sessionAssignmentVersion:VERSION,
    __sessionAssignmentWrapped:true
  });
  return true;
}

function currentEntrySession(){ return sessionFromUrl()||''; }

window.EW_SESSION_ASSIGNMENT=Object.freeze({
  VERSION,
  SESSION_IDS,
  normalizeSession,
  currentEntrySession,
  syncSession
});

if(!wrapAuthority()){
  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    if(wrapAuthority() || tries>=40) clearInterval(timer);
  },100);
}

}());
