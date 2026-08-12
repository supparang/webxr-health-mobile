(function(){
  "use strict";
  const VERSION="2026-08-12-PASSPORT-ROUTE-LOADER-R16-READ-BUDGET";
  let loaded=false;
  const routes=[
    "./passport-canonical-routes-v1.js?v=20260812-read-budget-r14",
    "./journey-client-v1.js?v=20260812-read-budget-v10",
    "./passport-journey-routes-v1.js?v=20260812-read-budget-r14"
  ];

  function loadRoutes(){
    if(loaded||!document.querySelector(".passport-map"))return;
    loaded=true;
    let chain=Promise.resolve();
    routes.forEach(src=>{
      chain=chain.then(()=>new Promise((resolve,reject)=>{
        const script=document.createElement("script");
        script.src=src;
        script.async=false;
        script.onload=resolve;
        script.onerror=reject;
        document.body.appendChild(script);
      }));
    });
    chain.catch(error=>console.error("EW route loader failed",error));
  }

  loadRoutes();
  const observer=new MutationObserver(loadRoutes);
  observer.observe(document.getElementById("screen")||document.body,{childList:true,subtree:true});
  window.EW_PASSPORT_ROUTE_LOADER=Object.freeze({version:VERSION});
}());