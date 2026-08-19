(function(){
  "use strict";
  const VERSION="2026-08-19-LEXICON-X-AUTH-SHELL-V2-ROUND-CONTINUITY";
  const cfg=window.EW_CONFIG;
  const key=cfg?.cacheKeys?.identity||"ew_identity";
  const ATTENDANCE_KEY='LEXICON_X_ATTENDANCE_CHECKIN_V2';

  function readIdentity(){
    try{return JSON.parse(localStorage.getItem(key)||"null");}
    catch(_){return null;}
  }
  function normalizeSession(value){
    const raw=String(value==null?'':value).trim().toUpperCase().replace(/\s+/g,'-').replace(/_/g,'-');
    const valid=['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM'];
    if(valid.includes(raw)) return raw;
    const compact=raw.replace(/-/g,'');
    return valid.find(id=>id.replace(/-/g,'')===compact)||'';
  }
  function readStoredRound(playerId){
    try{
      const saved=JSON.parse(localStorage.getItem(ATTENDANCE_KEY)||'null');
      if(!saved||String(saved.playerId||'').trim()!==String(playerId||'').trim()) return '';
      return normalizeSession(saved.attendanceSessionId||saved.sessionId);
    }catch(_){return '';}
  }
  function roundFromUrl(){
    const q=new URLSearchParams(location.search);
    for(const k of ['session','attendanceSessionId','checkin','sessionId','sessionCode','round','cohort']){
      const value=normalizeSession(q.get(k));
      if(value) return value;
    }
    return '';
  }
  function goLogin(reason){
    const suffix=reason?`?auth=${encodeURIComponent(reason)}&v=20260819-auth2`:`?v=20260819-auth2`;
    location.replace(`./index.html${suffix}`);
  }
  const identity=readIdentity();
  if(!identity?.playerId){
    goLogin("required");
    return;
  }

  function goPassport(){
    const round=roundFromUrl()||readStoredRound(identity.playerId);
    const q=new URLSearchParams();
    q.set('resume','memory');
    if(round) q.set('session',round);
    q.set('v','20260819-auth2');
    location.href=`./index.html?${q.toString()}`;
  }
  function logout(){
    try{localStorage.removeItem(key);}catch(_){}
    try{sessionStorage.clear();}catch(_){}
    location.replace("./index.html?logout=1&v=20260819-auth2");
  }
  function installStyle(){
    if(document.getElementById("lxAuthStyle"))return;
    const style=document.createElement("style");
    style.id="lxAuthStyle";
    style.textContent=`
      .lx-auth-chip{max-width:760px;margin:0 auto 10px;padding:8px 12px;border:1px solid rgba(94,231,255,.24);border-radius:12px;background:rgba(8,27,43,.78);display:flex;align-items:center;justify-content:space-between;gap:10px;color:#c8e9f7;font-size:.78rem}
      .lx-auth-chip strong{color:#fff}.lx-auth-chip small{color:#79bdd9}
      #exit[data-auth-logout="1"]{font-size:1.25rem}
    `;
    document.head.appendChild(style);
  }
  function installUi(){
    installStyle();
    const app=document.querySelector(".app");
    const top=document.querySelector(".top");
    if(app&&top&&!document.getElementById("lxAuthChip")){
      const chip=document.createElement("div");
      chip.id="lxAuthChip";
      chip.className="lx-auth-chip";
      const name=identity.nickname||identity.fullName||"Player";
      chip.innerHTML=`<span><strong>${String(name).replace(/[&<>"']/g," ")}</strong><br><small>Player ID: ${String(identity.playerId).replace(/[&<>"']/g," ")}</small></span><span>Session active</span>`;
      top.insertAdjacentElement("afterend",chip);
    }
    const back=document.getElementById("back");
    if(back){back.type="button";back.setAttribute("aria-label","กลับ Passport");back.onclick=goPassport;}
    const exit=document.getElementById("exit");
    if(exit){exit.type="button";exit.textContent="↪";exit.dataset.authLogout="1";exit.setAttribute("aria-label","ออกจากระบบ");exit.onclick=logout;}
  }

  installUi();
  const timer=setInterval(installUi,250);
  setTimeout(()=>clearInterval(timer),6000);
  window.addEventListener("pageshow",installUi);
  window.EW_LEXICON_X_AUTH=Object.freeze({version:VERSION,playerId:identity.playerId,goPassport,logout,getRound:()=>roundFromUrl()||readStoredRound(identity.playerId)});
}());
