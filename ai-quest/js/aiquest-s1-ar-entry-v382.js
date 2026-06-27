/* AI Quest S1 AR Visible Entry — strict session guard | v3.8.2
   Fix: never inject S1 AR card into S2/S3/... gameplay. */
(()=>{
  "use strict";
  const ID="aiquestS1ArEntryV382",$=i=>document.getElementById(i);

  function isStrictS1(){
    const p=new URLSearchParams(location.search);
    const session=String(p.get("session")||"").toLowerCase();
    const mission=String(p.get("mission")||"").toLowerCase();
    const ar=String(p.get("ar")||"").toLowerCase();
    if(ar) return false;
    return session==="s1" || session==="m1" || mission==="m1" || mission==="s1";
  }
  function getResult(){
    try{return JSON.parse(localStorage.getItem("AIQUEST_S1_AR_RESULT_V368")||"null")}catch(_){return null}
  }
  function launch(){
    const u=new URL(location.href);
    u.searchParams.set("session","s1");
    u.searchParams.set("ar","hand");
    u.searchParams.set("from","s1");
    u.searchParams.set("v","20260627-s1entry382");
    location.href=u.toString();
  }
  function removeWrongCard(){
    ["aiquestS1ArEntryV374","aiquestS1ArEntryV375","s1entry368"].forEach(id=>$(id)?.remove());
  }
  function mount(){
    /* always clean legacy S1 AR cards off non-S1 screens */
    if(!isStrictS1()){
      removeWrongCard();
      return;
    }
    const area=$("gameArea");
    const screen=$("gameScreen");
    if(!area || !screen?.classList.contains("active")) return;

    const result=getResult();
    const old=$(ID);
    const card=document.createElement("section");
    card.id=ID;
    card.style.cssText="margin:0 0 14px;padding:15px;border:1px solid rgba(45,212,191,.52);border-radius:20px;background:linear-gradient(135deg,rgba(19,78,74,.45),rgba(15,23,42,.94));display:flex;gap:14px;justify-content:space-between;align-items:center;flex-wrap:wrap";
    card.innerHTML=`
      <div>
        <div style="font-size:17px;font-weight:1000;color:#ccfbf1">🖐️ S1 AR Practice: AI Object Scanner</div>
        <p style="margin:5px 0;color:#bae6fd;font-size:13px">ฝึกแยก AI, Automation, Sensor-only, Rule-based และ Prediction ด้วยกล้องหรือ mouse/touch</p>
        ${result?.arCompleted
          ? `<div style="margin-top:8px;color:#bbf7d0;font-size:12px;font-weight:900">✓ เล่น AR แล้ว: ${result.correct}/${result.total} • ${result.arScore||result.accuracy}% • ผลกิจกรรมเสริมถูกส่งแล้ว</div>`
          : `<div style="margin-top:8px;color:#bbf7d0;font-size:12px;font-weight:900">กิจกรรมเสริม • ไม่กระทบคะแนนหรือการผ่าน S1 หลัก</div>`}
      </div>
      <button type="button" style="border:0;border-radius:15px;padding:12px 15px;background:linear-gradient(135deg,#99f6e4,#67e8f9);color:#042f2e;font-weight:1000;cursor:pointer">${result?.arCompleted?"ฝึก AR อีกครั้ง":"เริ่ม AR Practice"}</button>`;
    card.querySelector("button").onclick=launch;
    if(old) old.replaceWith(card); else area.insertBefore(card,area.firstChild);
  }
  function boot(){
    const mo=new MutationObserver(()=>requestAnimationFrame(mount));
    mo.observe(document.body,{childList:true,subtree:true});
    setInterval(mount,800);
    mount();
    console.log("[AIQuest] v3.8.2-s1-ar-entry-strict-session loaded");
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",boot):boot();
})();