(function(){
  "use strict";
  const VERSION="2026-08-07-PASSPORT-CANONICAL-ROUTE-LOADER-V1.5-CHAMPION471";
  let loaded=false;
  const routes=["./passport-canonical-routes-v1.js?v=20260807-champion471"];

  function loadRoutes(){
    if(loaded||!document.querySelector(".passport-map"))return;
    loaded=true;
    routes.forEach(src=>{
      const script=document.createElement("script");
      script.src=src;
      script.async=false;
      document.body.appendChild(script);
    });
  }

  loadRoutes();
  const observer=new MutationObserver(loadRoutes);
  observer.observe(document.getElementById("screen")||document.body,{childList:true,subtree:true});
  window.EW_PASSPORT_ROUTE_LOADER=Object.freeze({version:VERSION});
}());