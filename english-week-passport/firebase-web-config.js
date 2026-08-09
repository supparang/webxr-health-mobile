window.EW_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyBjv6Aph2zxS41V7YTtSmkEAgIBBJfvleI",
  authDomain: "englishweek-95869.firebaseapp.com",
  projectId: "englishweek-95869",
  storageBucket: "englishweek-95869.firebasestorage.app",
  messagingSenderId: "110133681532",
  appId: "1:110133681532:web:fce7270a8838b03addd8f9",
  measurementId: "G-3DCCL4D34V"
});

/* LEXICON X • Firebase Default-App Guard R1
 * The Passport Game Shell navigates to a fresh document for each game, so a
 * Firebase app initialized on the Passport page does not survive navigation.
 * Initialize the default app here as soon as the compat SDK is available,
 * before Firestore Direct Authority / Unified Pass Policy submit any result.
 */
(function(){
  'use strict';
  const VERSION='2026-08-09-FIREBASE-DEFAULT-APP-GUARD-R1';
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
  }catch(error){
    console.error('LEXICON X Firebase default-app guard failed',error);
    window.EW_FIREBASE_DEFAULT_APP_GUARD=Object.freeze({
      version:VERSION,
      ready:false,
      error:String(error?.message||error)
    });
  }
})();
