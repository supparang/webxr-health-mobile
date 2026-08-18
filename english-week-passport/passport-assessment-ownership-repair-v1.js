(function(){
  'use strict';

  const VERSION='2026-08-18-PASSPORT-ASSESSMENT-OWNERSHIP-REPAIR-V1';
  const base=window.EW_AUTHORITY;
  if(!base || typeof base.submitAssessment!=='function'){
    console.warn('EW assessment ownership repair: authority not ready');
    return;
  }

  const clean=value=>String(value==null?'':value).trim();

  function isPermissionError(error){
    const code=clean(error?.code).toLowerCase();
    const message=clean(error?.message).toLowerCase();
    return code.includes('permission-denied')
      || message.includes('missing or insufficient permissions')
      || message.includes('permission-denied');
  }

  async function ensureStudentUser(){
    if(window.EW_STUDENT_AUTH_ISOLATION?.ensure){
      return window.EW_STUDENT_AUTH_ISOLATION.ensure();
    }
    const auth=firebase.auth();
    if(auth.currentUser?.isAnonymous) return auth.currentUser;
    if(auth.currentUser) await auth.signOut();
    const result=await auth.signInAnonymously();
    return result?.user || auth.currentUser;
  }

  async function ensureOwnership(playerId,force){
    const id=clean(playerId);
    if(!id) throw new Error('PLAYER_ID_REQUIRED');
    const user=await ensureStudentUser();
    if(!user?.uid) throw new Error('FIREBASE_AUTH_UID_MISSING');

    const db=firebase.firestore();
    const sessionRef=db.collection('ewp_player_sessions').doc(user.uid);
    let snap=null;
    if(!force){
      snap=await sessionRef.get();
      const data=snap.exists ? (snap.data()||{}) : {};
      if(snap.exists && clean(data.playerId)===id && clean(data.uid||user.uid)===user.uid){
        return {ok:true,repaired:false,uid:user.uid};
      }
    }

    await sessionRef.set({
      uid:user.uid,
      playerId:id,
      claimedAt:snap?.exists ? (snap.data()?.claimedAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      sourceVersion:VERSION,
      sourceMode:'assessment-ownership-repair'
    },{merge:true});

    return {ok:true,repaired:true,uid:user.uid};
  }

  async function submitAssessment(payload){
    const playerId=clean(payload?.playerId);
    await ensureOwnership(playerId,false);
    try{
      return await base.submitAssessment(payload);
    }catch(error){
      if(!isPermissionError(error)) throw error;
      console.warn('EW assessment ownership repair: permission denied, repairing ownership and retrying once',error);
      await ensureOwnership(playerId,true);
      return base.submitAssessment(payload);
    }
  }

  window.EW_AUTHORITY=Object.freeze({
    ...base,
    submitAssessment
  });

  window.EW_ASSESSMENT_OWNERSHIP_REPAIR=Object.freeze({
    version:VERSION,
    ensureOwnership
  });
}());
