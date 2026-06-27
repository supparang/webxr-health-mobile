/* AI Quest S2 AR Direct Launch v3.8.5 */
(()=>{
  "use strict";

  const ENTRY_ID = "aqS2ArEntry381";
  let navigating = false;

  function launch(){
    if(navigating) return;
    navigating = true;
    const url = new URL(location.href);
    url.searchParams.set("session", "s2");
    url.searchParams.set("ar", "agent");
    url.searchParams.set("from", "s2");
    url.searchParams.set("v", "20260627-s2-direct385");
    location.assign(url.toString());
  }

  function bind(){
    const card = document.getElementById(ENTRY_ID);
    if(!card) return false;

    const btn = card.querySelector("button");
    if(!btn) return false;

    btn.type = "button";
    btn.style.pointerEvents = "auto";
    btn.style.cursor = "pointer";
    btn.style.position = "relative";
    btn.style.zIndex = "1000";

    if(btn.dataset.s2ArDirect385 === "1") return true;
    btn.dataset.s2ArDirect385 = "1";

    ["click", "pointerup", "touchend"].forEach((type)=>{
      btn.addEventListener(type, (event)=>{
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        launch();
      }, true);
    });

    console.log("[AIQuest S2 AR] direct button bound v385");
    return true;
  }

  function boot(){
    const observer = new MutationObserver(bind);
    observer.observe(document.documentElement, {childList:true, subtree:true});
    setInterval(bind, 500);
    bind();
    console.log("[AIQuest S2 AR] direct-launch ready v385");
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once:true});
  }else{
    boot();
  }
})();
