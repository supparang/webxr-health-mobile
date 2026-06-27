/* AI Quest S2 AR Direct Launch v3.8.6 */
(()=>{
  "use strict";
  let navigating = false;

  function launchS2AR(){
    if(navigating) return;
    navigating = true;
    const u = new URL(location.href);
    u.searchParams.set("session", "s2");
    u.searchParams.set("ar", "hand");
    u.searchParams.set("from", "s2");
    u.searchParams.set("v", "20260627-s2-direct386");
    location.assign(u.toString());
  }

  function findButton(){
    const roots = [
      document.getElementById("aqS2ArEntry381"),
      document.querySelector("[data-aiquest-s2-ar]"),
      document.querySelector(".aiquest-s2-ar-entry"),
      document.querySelector("#aiquestS2ArEntry")
    ].filter(Boolean);

    for(const root of roots){
      const btn = root.querySelector("button,a,[role='button']");
      if(btn) return btn;
    }

    return [...document.querySelectorAll("button,a,[role='button']")]
      .find(el => String(el.textContent || "").replace(/\s+/g," ").trim() === "เริ่ม AR Practice") || null;
  }

  function bind(){
    const btn = findButton();
    if(!btn || btn.dataset.s2ArDirect386 === "1") return !!btn;

    btn.dataset.s2ArDirect386 = "1";
    btn.type = btn.tagName === "BUTTON" ? "button" : btn.type;
    btn.style.pointerEvents = "auto";
    btn.style.cursor = "pointer";
    btn.style.position = "relative";
    btn.style.zIndex = "999";

    const go = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      launchS2AR();
    };

    btn.addEventListener("click", go, true);
    btn.addEventListener("pointerup", go, true);
    console.log("[AIQuest S2 AR] button bound v386");
    return true;
  }

  function boot(){
    bind();
    new MutationObserver(bind).observe(document.documentElement, {childList:true, subtree:true});
    setInterval(bind, 750);
    console.log("[AIQuest S2 AR] direct-launch ready v386");
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();
})();
