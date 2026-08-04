(function(){
  "use strict";
  const VERSION="2026-08-04-PASSPORT-ROUTE-LOADER-PLAYABLE5";
  let loaded=false;
  const routes=[
    "./word-match-route.js?v=20260804-playable5",
    "./category-ar-route.js?v=20260803-category4",
    "./sentence-route.js?v=20260803-sentence2",
    "./action-detective-route.js?v=20260803-action5"
  ];

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