window.EW_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyBjv6Aph2zxS41V7YTtSmkEAgIBBJfvleI",
  authDomain: "englishweek-95869.firebaseapp.com",
  projectId: "englishweek-95869",
  storageBucket: "englishweek-95869.firebasestorage.app",
  messagingSenderId: "110133681532",
  appId: "1:110133681532:web:fce7270a8838b03addd8f9",
  measurementId: "G-3DCCL4D34V"
});

/* LEXICON X • Firebase App Isolation R5
 * Student pages use the Firebase [DEFAULT] app with anonymous auth.
 * Teacher Console uses a named app (LEXICON_TEACHER) so Email/Password
 * authentication never replaces the student's anonymous session when both
 * pages are open in the same browser/origin.
 */
(function(){
  'use strict';
  const VERSION='2026-08-11-FIREBASE-APP-ISOLATION-R5';
  const TEACHER_APP_NAME='LEXICON_TEACHER';
  try{
    if(!window.firebase?.initializeApp) return;
    const isTeacherConsole=/\/teacher-console\.html(?:$|\?)/.test(location.pathname+location.search) || /\/teacher-console\.html$/.test(location.pathname);

    if(isTeacherConsole){
      const originalAuth=firebase.auth.bind(firebase);
      const originalFirestore=firebase.firestore.bind(firebase);
      let teacherApp=null;
      try{ teacherApp=firebase.app(TEACHER_APP_NAME); }
      catch(_){ teacherApp=firebase.initializeApp(window.EW_FIREBASE_WEB_CONFIG,TEACHER_APP_NAME); }
      const teacherAuth=originalAuth(teacherApp);
      const teacherDb=originalFirestore(teacherApp);

      // Session persistence is enough for a teacher tab and deliberately does
      // not overwrite the student's [DEFAULT] anonymous auth record.
      try{ teacherAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(()=>{}); }catch(_){ }

      // Compatibility shim: existing Teacher Console code calls firebase.auth()
      // and firebase.firestore() without an app argument. Route only those
      // no-argument calls to the isolated teacher app.
      firebase.auth=function(app){ return app ? originalAuth(app) : teacherAuth; };
      Object.assign(firebase.auth, originalAuth);
      firebase.auth.Auth=originalAuth.Auth;
      firebase.firestore=function(app){ return app ? originalFirestore(app) : teacherDb; };
      Object.assign(firebase.firestore, originalFirestore);
      firebase.firestore.FieldPath=originalFirestore.FieldPath;

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

    // Student / Passport / game pages keep the [DEFAULT] Firebase app.
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
