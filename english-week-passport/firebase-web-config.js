window.EW_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyBjv6Aph2zxS41V7YTtSmkEAgIBBJfvleI",
  authDomain: "englishweek-95869.firebaseapp.com",
  projectId: "englishweek-95869",
  storageBucket: "englishweek-95869.firebasestorage.app",
  messagingSenderId: "110133681532",
  appId: "1:110133681532:web:fce7270a8838b03addd8f9",
  measurementId: "G-3DCCL4D34V"
});

/* LEXICON X • Firebase App Isolation R5.1
 * Student pages use Firebase [DEFAULT] + Anonymous Auth.
 * Teacher Console uses named app LEXICON_TEACHER + Email/Password Auth.
 * This prevents a teacher login from replacing the student auth session when
 * teacher and student pages are open on the same supparang.github.io origin.
 */
(function(){
  'use strict';
  const VERSION='2026-08-11-FIREBASE-APP-ISOLATION-R5.1';
  const TEACHER_APP_NAME='LEXICON_TEACHER';
  try{
    if(!window.firebase?.initializeApp) return;
    const isTeacherConsole=/\/teacher-console\.html(?:$|\?)/.test(location.pathname+location.search) || /\/teacher-console\.html$/.test(location.pathname);

    if(isTeacherConsole){
      const authNamespace=firebase.auth;
      const firestoreNamespace=firebase.firestore;
      const originalAuth=authNamespace.bind(firebase);
      const originalFirestore=firestoreNamespace.bind(firebase);

      let teacherApp=null;
      try{ teacherApp=firebase.app(TEACHER_APP_NAME); }
      catch(_){ teacherApp=firebase.initializeApp(window.EW_FIREBASE_WEB_CONFIG,TEACHER_APP_NAME); }

      const teacherAuth=originalAuth(teacherApp);
      const teacherDb=originalFirestore(teacherApp);

      try{
        const persistence=authNamespace.Auth?.Persistence?.SESSION;
        if(persistence) teacherAuth.setPersistence(persistence).catch(()=>{});
      }catch(_){ }

      // Existing Teacher Console code expects firebase.auth()/firestore() with no
      // app argument. Preserve the compat namespace while routing no-argument
      // calls to the isolated named app.
      const authShim=function(app){ return app ? originalAuth(app) : teacherAuth; };
      for(const key of Object.keys(authNamespace)){
        try{ authShim[key]=authNamespace[key]; }catch(_){ }
      }
      if(authNamespace.Auth) authShim.Auth=authNamespace.Auth;
      if(authNamespace.EmailAuthProvider) authShim.EmailAuthProvider=authNamespace.EmailAuthProvider;
      if(authNamespace.GoogleAuthProvider) authShim.GoogleAuthProvider=authNamespace.GoogleAuthProvider;
      firebase.auth=authShim;

      const firestoreShim=function(app){ return app ? originalFirestore(app) : teacherDb; };
      for(const key of Object.keys(firestoreNamespace)){
        try{ firestoreShim[key]=firestoreNamespace[key]; }catch(_){ }
      }
      if(firestoreNamespace.FieldPath) firestoreShim.FieldPath=firestoreNamespace.FieldPath;
      if(firestoreNamespace.FieldValue) firestoreShim.FieldValue=firestoreNamespace.FieldValue;
      if(firestoreNamespace.Timestamp) firestoreShim.Timestamp=firestoreNamespace.Timestamp;
      firebase.firestore=firestoreShim;

      window.EW_TEACHER_FIREBASE=Object.freeze({
        version:VERSION,
        appName:TEACHER_APP_NAME,
        projectId:teacherApp.options.projectId,
        app:teacherApp,
        auth:teacherAuth,
        db:teacherDb
      });
      window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({
        version:VERSION,
        ready:true,
        isolatedTeacher:true,
        appName:TEACHER_APP_NAME,
        projectId:teacherApp.options.projectId
      });
      return;
    }

    // Passport/game pages retain the default anonymous app.
    const apps=Array.isArray(firebase.apps)?firebase.apps:[];
    const app=apps.find(a=>a.name==='[DEFAULT]') || firebase.initializeApp(window.EW_FIREBASE_WEB_CONFIG);
    window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({
      version:VERSION,
      ready:true,
      isolatedTeacher:false,
      appName:app?.name||'[DEFAULT]',
      projectId:app?.options?.projectId||window.EW_FIREBASE_WEB_CONFIG.projectId
    });

    if(!document.querySelector('script[data-ew-analytics-rollup]')){
      const script=document.createElement('script');
      script.src='./analytics-rollup-v1.js?v=20260810-rollup2-assessment-duration';
      script.async=false;
      script.dataset.ewAnalyticsRollup='2';
      document.head.appendChild(script);
    }
  }catch(error){
    console.error('LEXICON X Firebase app isolation failed',error);
    window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({
      version:VERSION,
      ready:false,
      error:String(error?.message||error)
    });
  }
})();
