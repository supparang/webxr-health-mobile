(function(){
  "use strict";
  const VERSION="2026-08-04-PASSPORT-MOBILE-RECOVERY-V1";

  function unlockScroll(){
    const html=document.documentElement;
    const body=document.body;
    const app=document.getElementById("app");
    const screen=document.getElementById("screen");
    const loading=document.getElementById("loading");

    [html,body,app,screen].forEach(el=>{
      if(!el)return;
      el.style.removeProperty("overflow");
      el.style.removeProperty("overflow-y");
      el.style.removeProperty("position");
      el.style.removeProperty("height");
      el.style.removeProperty("max-height");
      el.style.removeProperty("touch-action");
    });

    html.style.overflowY="auto";
    body.style.overflowY="auto";
    body.style.touchAction="pan-y pinch-zoom";
    body.style.webkitOverflowScrolling="touch";
    if(app){
      app.style.minHeight="100dvh";
      app.style.overflow="visible";
      app.style.touchAction="pan-y pinch-zoom";
    }
    if(screen){
      screen.style.overflow="visible";
      screen.style.touchAction="pan-y pinch-zoom";
    }

    [html,body,app].forEach(el=>{
      if(!el)return;
      ["no-scroll","scroll-lock","modal-open","loading","is-loading"].forEach(cls=>el.classList.remove(cls));
    });

    if(loading){
      if(loading.hidden){
        loading.style.pointerEvents="none";
        loading.style.display="none";
      }else{
        loading.style.pointerEvents="auto";
      }
    }
  }

  function recoverWhenPassport(){
    if(!document.querySelector(".passport-map"))return;
    unlockScroll();
    requestAnimationFrame(unlockScroll);
    setTimeout(unlockScroll,120);
    setTimeout(unlockScroll,500);
  }

  const style=document.createElement("style");
  style.textContent=`
    html,body{overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-y:auto!important}
    body{touch-action:pan-y pinch-zoom!important;-webkit-overflow-scrolling:touch!important}
    .app-shell,.screen,.passport-map{overflow:visible!important;touch-action:pan-y pinch-zoom!important}
    .loading-layer[hidden]{display:none!important;pointer-events:none!important}
    .passport-map{min-height:max-content}
  `;
  document.head.appendChild(style);

  recoverWhenPassport();
  new MutationObserver(recoverWhenPassport).observe(document.getElementById("screen")||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","class","style"]});
  window.addEventListener("pageshow",recoverWhenPassport);
  window.addEventListener("focus",recoverWhenPassport);

  window.EW_PASSPORT_MOBILE_RECOVERY=Object.freeze({version:VERSION,unlockScroll});
}());
