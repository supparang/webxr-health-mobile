window.EW_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyBjv6Aph2zxS41V7YTtSmkEAgIBBJfvleI",
  authDomain: "englishweek-95869.firebaseapp.com",
  projectId: "englishweek-95869",
  storageBucket: "englishweek-95869.firebasestorage.app",
  messagingSenderId: "110133681532",
  appId: "1:110133681532:web:fce7270a8838b03addd8f9",
  measurementId: "G-3DCCL4D34V"
});

/* LEXICON X • Firebase App Isolation + Event-Day Light R6
 * Teacher Console: isolated named Firebase app.
 * Student pages: default anonymous app + Event-Day Light authority bridge.
 * Heavy analytics rollup is intentionally disabled on event day to protect
 * Spark quota; progress/check-in/completion remain authoritative.
 */
(function(){
  'use strict';
  const VERSION='2026-08-11-FIREBASE-EVENT-DAY-LIGHT-R6';
  const TEACHER_APP_NAME='LEXICON_TEACHER';
  try{
    if(!window.firebase?.initializeApp) return;
    const isTeacherConsole=/\/teacher-console\.html(?:$|\?)/.test(location.pathname+location.search) || /\/teacher-console\.html$/.test(location.pathname);

    if(isTeacherConsole){
      const authNamespace=firebase.auth;
      const firestoreNamespace=firebase.firestore;
      const originalAuth=authNamespace.bind(firebase);
      const originalFirestore=firestoreNamespace.bind(firebase);
      const AuthStatic=authNamespace.Auth;
      const EmailAuthProviderStatic=authNamespace.EmailAuthProvider;
      const GoogleAuthProviderStatic=authNamespace.GoogleAuthProvider;
      const FieldPathStatic=firestoreNamespace.FieldPath;
      const FieldValueStatic=firestoreNamespace.FieldValue;
      const TimestampStatic=firestoreNamespace.Timestamp;
      const GeoPointStatic=firestoreNamespace.GeoPoint;
      const BlobStatic=firestoreNamespace.Blob;

      let teacherApp=null;
      try{ teacherApp=firebase.app(TEACHER_APP_NAME); }
      catch(_){ teacherApp=firebase.initializeApp(window.EW_FIREBASE_WEB_CONFIG,TEACHER_APP_NAME); }

      const teacherAuth=originalAuth(teacherApp);
      const teacherDb=originalFirestore(teacherApp);
      try{
        const persistence=AuthStatic?.Persistence?.SESSION;
        if(persistence) teacherAuth.setPersistence(persistence).catch(()=>{});
      }catch(_){ }

      const authShim=function(app){ return app ? originalAuth(app) : teacherAuth; };
      if(AuthStatic) authShim.Auth=AuthStatic;
      if(EmailAuthProviderStatic) authShim.EmailAuthProvider=EmailAuthProviderStatic;
      if(GoogleAuthProviderStatic) authShim.GoogleAuthProvider=GoogleAuthProviderStatic;

      const firestoreShim=function(app){ return app ? originalFirestore(app) : teacherDb; };
      if(FieldPathStatic) firestoreShim.FieldPath=FieldPathStatic;
      if(FieldValueStatic) firestoreShim.FieldValue=FieldValueStatic;
      if(TimestampStatic) firestoreShim.Timestamp=TimestampStatic;
      if(GeoPointStatic) firestoreShim.GeoPoint=GeoPointStatic;
      if(BlobStatic) firestoreShim.Blob=BlobStatic;

      try{
        for(const key of Object.getOwnPropertyNames(authNamespace)){
          if(['length','name','prototype','arguments','caller'].includes(key)) continue;
          if(Object.prototype.hasOwnProperty.call(authShim,key)) continue;
          const d=Object.getOwnPropertyDescriptor(authNamespace,key);
          if(d) Object.defineProperty(authShim,key,d);
        }
      }catch(_){ }
      try{
        for(const key of Object.getOwnPropertyNames(firestoreNamespace)){
          if(['length','name','prototype','arguments','caller'].includes(key)) continue;
          if(Object.prototype.hasOwnProperty.call(firestoreShim,key)) continue;
          const d=Object.getOwnPropertyDescriptor(firestoreNamespace,key);
          if(d) Object.defineProperty(firestoreShim,key,d);
        }
      }catch(_){ }

      firebase.auth=authShim;
      firebase.firestore=firestoreShim;
      window.EW_TEACHER_FIREBASE={version:VERSION,appName:TEACHER_APP_NAME,projectId:teacherApp.options.projectId,app:teacherApp,auth:teacherAuth,db:teacherDb,FieldPath:FieldPathStatic,FieldValue:FieldValueStatic,Timestamp:TimestampStatic};
      window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({version:VERSION,ready:true,isolatedTeacher:true,appName:TEACHER_APP_NAME,projectId:teacherApp.options.projectId,fieldPathReady:Boolean(FieldPathStatic?.documentId)});
      return;
    }

    const apps=Array.isArray(firebase.apps)?firebase.apps:[];
    const app=apps.find(a=>a.name==='[DEFAULT]') || firebase.initializeApp(window.EW_FIREBASE_WEB_CONFIG);
    window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({version:VERSION,ready:true,isolatedTeacher:false,appName:app?.name||'[DEFAULT]',projectId:app?.options?.projectId||window.EW_FIREBASE_WEB_CONFIG.projectId,eventDayLightMode:true});
    window.EW_EVENT_DAY_LIGHT_MODE=Object.freeze({enabled:true,version:VERSION,heavyAnalytics:false});

    // Do NOT load analytics-rollup-v1.js in Event-Day mode.
    // It is useful for research analytics but unnecessary for participant-count use.

    // Every current game shell already loads firebase-web-config.js before the
    // direct authority. Wait until the direct authority appears, then overlay the
    // lightweight bridge. This avoids editing every individual game page.
    let attempts=0;
    const attachLightBridge=()=>{
      attempts+=1;
      if(window.EW_AUTHORITY?.eventDayLightMode) return;
      if(window.EW_AUTHORITY?.directFirestoreVersion){
        if(!document.querySelector('script[data-ew-event-day-light]')){
          const script=document.createElement('script');
          script.src='./firebase-authority-bridge.js?v=20260811-event-day-light-r6';
          script.async=false;
          script.dataset.ewEventDayLight='1';
          document.head.appendChild(script);
        }
        return;
      }
      if(attempts<120) setTimeout(attachLightBridge,50);
    };
    setTimeout(attachLightBridge,0);
  }catch(error){
    console.error('LEXICON X Firebase Event-Day setup failed',error);
    window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({version:VERSION,ready:false,error:String(error?.message||error)});
  }
})();
