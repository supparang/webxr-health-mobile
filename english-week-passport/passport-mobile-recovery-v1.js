(function(){
  "use strict";
  const VERSION="2026-08-07-PASSPORT-MOBILE-RECOVERY-V2-FROM-GAME";

  function unlockScroll(){
    if(!document.querySelector('.passport-map'))return;
    const html=document.documentElement;
    const body=document.body;
    const app=document.getElementById("app");
    const screen=document.getElementById("screen");
    const loading=document.getElementById("loading");
    const passport=document.querySelector('.passport-map');

    // Welcome/login layouts intentionally use viewport locks. They must never
    // survive once the Passport map has been rendered after a game return.
    screen?.classList.remove('welcome-mode','login-mode');
    body?.classList.remove('ew-welcome-single-screen','ew-login-single-screen');

    [html,body,app,screen,passport].forEach(el=>{
      if(!el)return;
      el.style.removeProperty("overflow");
      el.style.removeProperty("overflow-y");
      el.style.removeProperty("position");
      el.style.removeProperty("height");
      el.style.removeProperty("max-height");
      el.style.removeProperty("touch-action");
      el.style.removeProperty("pointer-events");
      el.removeAttribute('inert');
    });

    html.style.overflowX="hidden";
    html.style.overflowY="auto";
    body.style.overflowX="hidden";
    body.style.overflowY="auto";
    body.style.position="static";
    body.style.height="auto";
    body.style.minHeight="100dvh";
    body.style.touchAction="pan-y pinch-zoom";
    body.style.webkitOverflowScrolling="touch";
    if(app){
      app.style.minHeight="100dvh";
      app.style.height="auto";
      app.style.overflow="visible";
      app.style.touchAction="pan-y pinch-zoom";
      app.style.pointerEvents="auto";
    }
    if(screen){
      screen.style.height="auto";
      screen.style.minHeight="0";
      screen.style.overflow="visible";
      screen.style.touchAction="pan-y pinch-zoom";
      screen.style.pointerEvents="auto";
    }
    if(passport){
      passport.style.overflow="visible";
      passport.style.touchAction="pan-y pinch-zoom";
      passport.style.pointerEvents="auto";
    }

    [html,body,app,screen].forEach(el=>{
      if(!el)return;
      ["no-scroll","scroll-lock","modal-open","loading","is-loading","touch-lock"].forEach(cls=>el.classList.remove(cls));
    });

    if(loading?.hidden){
      loading.style.pointerEvents="none";
      loading.style.display="none";
    }

    document.querySelectorAll('.stage-card.ready,.stage-card.passed').forEach(card=>{
      card.style.pointerEvents='auto';
      card.style.touchAction='manipulation';
      card.removeAttribute('inert');
    });
  }

  function recoverWhenPassport(){
    if(!document.querySelector(".passport-map"))return;
    unlockScroll();
    requestAnimationFrame(unlockScroll);
    setTimeout(unlockScroll,80);
    setTimeout(unlockScroll,240);
    setTimeout(unlockScroll,700);
  }

  const style=document.createElement("style");
  style.textContent=`
    html,body{overflow-x:hidden!important;overscroll-behavior-y:auto!important}
    body:has(.passport-map){overflow-y:auto!important;position:static!important;height:auto!important;touch-action:pan-y pinch-zoom!important;-webkit-overflow-scrolling:touch!important}
    body:has(.passport-map) .app-shell,
    body:has(.passport-map) .screen,
    body:has(.passport-map) .passport-map{height:auto!important;max-height:none!important;overflow:visible!important;touch-action:pan-y pinch-zoom!important;pointer-events:auto!important}
    .loading-layer[hidden]{display:none!important;pointer-events:none!important}
    .passport-map{min-height:max-content}
    .passport-map .stage-card.ready,.passport-map .stage-card.passed{pointer-events:auto!important;touch-action:manipulation!important}
  `;
  document.head.appendChild(style);

  recoverWhenPassport();
  new MutationObserver(recoverWhenPassport).observe(document.getElementById("screen")||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","class","style"]});
  window.addEventListener("pageshow",recoverWhenPassport);
  window.addEventListener("focus",recoverWhenPassport);
  window.addEventListener("popstate",recoverWhenPassport);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)recoverWhenPassport()});

  window.EW_PASSPORT_MOBILE_RECOVERY=Object.freeze({version:VERSION,unlockScroll,recoverWhenPassport});
}());