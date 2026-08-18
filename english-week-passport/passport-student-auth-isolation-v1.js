(function(){
  'use strict';

  const VERSION='2026-08-18-PASSPORT-STUDENT-AUTH-ISOLATION-V1';
  const base=window.EW_AUTHORITY;
  if(!base){
    console.warn('EW student auth isolation: authority not ready');
    return;
  }

  let authReadyPromise=null;

  function getAuth(){
    if(!window.firebase?.auth) throw new Error('FIREBASE_AUTH_SDK_MISSING');
    const app=(firebase.apps||[]).find(item=>item.name==='[DEFAULT]') || firebase.app();
    return firebase.auth(app);
  }

  async function ensureStudentAnonymousAuth(){
    if(authReadyPromise) return authReadyPromise;

    authReadyPromise=(async()=>{
      const auth=getAuth();
      const current=auth.currentUser;

      // The roster importer/older teacher tools used the DEFAULT Firebase app.
      // If that teacher session survives in the browser, student Firestore rules
      // can reject Passport writes. Student Passport must always use anonymous auth.
      if(current && !current.isAnonymous){
        console.warn('EW student auth isolation: replacing non-anonymous session', current.uid, current.email||'');
        await auth.signOut();
      }

      if(auth.currentUser?.isAnonymous){
        window.dispatchEvent(new CustomEvent('ew-student-auth-ready',{detail:{
          version:VERSION,
          uid:auth.currentUser.uid,
          replacedTeacherSession:Boolean(current && !current.isAnonymous)
        }}));
        return auth.currentUser;
      }

      const result=await auth.signInAnonymously();
      const user=result?.user || auth.currentUser;
      if(!user?.isAnonymous) throw new Error('STUDENT_ANONYMOUS_AUTH_REQUIRED');

      window.dispatchEvent(new CustomEvent('ew-student-auth-ready',{detail:{
        version:VERSION,
        uid:user.uid,
        replacedTeacherSession:Boolean(current && !current.isAnonymous)
      }}));
      return user;
    })().catch(error=>{
      console.error('EW student auth isolation failed',error);
      window.dispatchEvent(new CustomEvent('ew-student-auth-error',{detail:{
        version:VERSION,
        code:String(error?.code||''),
        message:String(error?.message||error)
      }}));
      throw error;
    }).finally(()=>{
      authReadyPromise=null;
    });

    return authReadyPromise;
  }

  function wrap(name){
    const fn=base?.[name];
    if(typeof fn!=='function') return fn;
    return async function(){
      await ensureStudentAnonymousAuth();
      return fn.apply(base,arguments);
    };
  }

  const wrapped={...base};
  [
    'health','profileLookup','resume','submitAssessment','submitGame',
    'getAssessmentCheckpoint','saveAssessmentCheckpoint','clearAssessmentCheckpoint'
  ].forEach(name=>{
    if(typeof base[name]==='function') wrapped[name]=wrap(name);
  });

  window.EW_AUTHORITY=Object.freeze(wrapped);
  window.EW_STUDENT_AUTH_ISOLATION=Object.freeze({
    version:VERSION,
    ensure:ensureStudentAnonymousAuth,
    get current(){
      try{return getAuth().currentUser||null;}catch(_){return null;}
    }
  });

  // Proactively repair the persisted Firebase session before the learner submits.
  ensureStudentAnonymousAuth().catch(()=>{});
}());
