window.EW_FIREBASE_WEB_CONFIG = Object.freeze({
  apiKey: "AIzaSyBjv6Aph2zxS41V7YTtSmkEAgIBBJfvleI",
  authDomain: "englishweek-95869.firebaseapp.com",
  projectId: "englishweek-95869",
  storageBucket: "englishweek-95869.firebasestorage.app",
  messagingSenderId: "110133681532",
  appId: "1:110133681532:web:fce7270a8838b03addd8f9",
  measurementId: "G-3DCCL4D34V"
});

/* LEXICON X • Firebase Default-App Guard R2
 * Initialize Firebase in every fresh Game Shell document and preload the
 * per-player analytics rollup wrapper. The rollup waits for EW_AUTHORITY and
 * then records Pre/Post/game attempts and durations into ewp_game_summary.
 */
(function(){
  'use strict';
  const VERSION='2026-08-09-FIREBASE-DEFAULT-APP-GUARD-R2-ROLLUP';
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
      script.src='./analytics-rollup-v1.js?v=20260809-rollup1';
      script.async=false;
      script.dataset.ewAnalyticsRollup='1';
      document.head.appendChild(script);
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
