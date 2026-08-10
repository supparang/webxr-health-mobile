window.EW_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyBjv6Aph2zxS41V7YTtSmkEAgIBBJfvleI",
  authDomain: "englishweek-95869.firebaseapp.com",
  projectId: "englishweek-95869",
  storageBucket: "englishweek-95869.firebasestorage.app",
  messagingSenderId: "110133681532",
  appId: "1:110133681532:web:fce7270a8838b03addd8f9",
  measurementId: "G-3DCCL4D34V"
});

/* LEXICON X • Firebase Default-App Guard R4
 * Initialize Firebase in every fresh document and preload the per-player
 * analytics rollup wrapper. On Teacher Console, also capture the exact Auth UID
 * and teacher-role document values so role mismatches can be diagnosed safely.
 */
(function(){
  'use strict';
  const VERSION='2026-08-10-FIREBASE-DEFAULT-APP-GUARD-R4-TEACHER-DIAGNOSTIC';
  try{
    if(!window.firebase?.initializeApp) return;
    const apps=Array.isArray(firebase.apps)?firebase.apps:[];
    const app=apps.length?firebase.app():firebase.initializeApp(window.EW_FIREBASE_WEB_CONFIG);
    window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({
      version:VERSION,
      ready:true,
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

    const isTeacherConsole=/teacher-console\.html(?:$|\?)/.test(location.pathname+location.search) || /teacher-console\.html$/.test(location.pathname);
    if(isTeacherConsole && window.firebase?.auth && window.firebase?.firestore){
      const auth=firebase.auth();
      if(!auth.__ewTeacherDiagnosticWrapped){
        const originalSignIn=auth.signInWithEmailAndPassword.bind(auth);
        auth.signInWithEmailAndPassword=async function(email,password){
          const cred=await originalSignIn(email,password);
          let roleExists=false, role=null, readError='';
          try{
            const snap=await firebase.firestore().collection('ewp_teacher_roles').doc(cred.user.uid).get();
            roleExists=snap.exists;
            role=roleExists?(snap.data()||{}):null;
          }catch(error){
            readError=String(error?.code||error?.message||error);
          }
          window.EW_TEACHER_DIAGNOSTIC={
            version:VERSION,
            projectId:app?.options?.projectId||'',
            email:cred.user.email||'',
            uid:cred.user.uid||'',
            rolePath:`ewp_teacher_roles/${cred.user.uid||''}`,
            roleExists,
            role:role?.role??null,
            active:role?.active??null,
            roleType:role==null?null:typeof role.role,
            activeType:role==null?null:typeof role.active,
            readError
          };
          return cred;
        };
        auth.__ewTeacherDiagnosticWrapped=true;
      }

      const attachDiagnosticObserver=()=>{
        const box=document.getElementById('loginError');
        if(!box||box.__ewTeacherDiagnosticObserved)return;
        const appendDiagnostic=()=>{
          const d=window.EW_TEACHER_DIAGNOSTIC;
          if(!d||!box.textContent.includes('TEACHER_ROLE_REQUIRED'))return;
          const suffix=`\nUID: ${d.uid}\nRole path: ${d.rolePath}\nrole=${String(d.role)} (${String(d.roleType)}) • active=${String(d.active)} (${String(d.activeType)})${d.readError?`\nreadError=${d.readError}`:''}`;
          if(!box.textContent.includes('Role path:')) box.textContent+=suffix;
          box.style.whiteSpace='pre-wrap';
          box.style.wordBreak='break-word';
        };
        const observer=new MutationObserver(()=>setTimeout(appendDiagnostic,0));
        observer.observe(box,{childList:true,characterData:true,subtree:true});
        box.__ewTeacherDiagnosticObserved=true;
      };
      if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',attachDiagnosticObserver,{once:true});
      else attachDiagnosticObserver();
    }
  }catch(error){
    console.error('LEXICON X Firebase default-app guard failed',error);
    window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({
      version:VERSION,
      ready:false,
      error:String(error?.message||error)
    });
  }
})();
