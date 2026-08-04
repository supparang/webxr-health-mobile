(function(){
  "use strict";
  const VERSION="2026-08-04-APP-CORE-LOADER-V3-DIRECT-PRESS";
  const SOURCE_URL="./app.js?v=20260804-core7-source";

  function fail(message,error){
    console.error(message,error||"");
    const screen=document.getElementById("screen");
    if(screen){
      screen.innerHTML='<section class="hero-card"><div class="hero-emoji">⚠️</div><h1>เริ่มระบบไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></section>';
    }
  }

  fetch(SOURCE_URL,{cache:"no-store"})
    .then(response=>{
      if(!response.ok)throw new Error(`APP_HTTP_${response.status}`);
      return response.text();
    })
    .then(source=>{
      const buttonNeedle='<button class="btn btn-primary" type="submit">ตรวจสอบรหัสและเริ่มภารกิจ</button>';
      const listenerNeedle='document.getElementById("loginForm").addEventListener("submit", handleLogin);';
      const handlerNeedle='async function handleLogin(event) {\n    event.preventDefault();\n    const form = new FormData(event.currentTarget);';

      if(!source.includes(buttonNeedle)||!source.includes(listenerNeedle)||!source.includes(handlerNeedle)){
        throw new Error("LOGIN_PATCH_POINT_NOT_FOUND");
      }

      source=source.replace(
        buttonNeedle,
        '<button id="loginStartBtn" class="btn btn-primary" type="button" style="touch-action:manipulation!important;pointer-events:auto!important">ตรวจสอบรหัสและเริ่มภารกิจ</button>'
      );

      source=source.replace(
        listenerNeedle,
        `const loginForm = document.getElementById("loginForm");
    const loginStartBtn = document.getElementById("loginStartBtn");
    let loginPressBusy = false;
    const runLoginDirect = event => {
      if (event) event.preventDefault();
      if (loginPressBusy) return;
      loginPressBusy = true;
      loginStartBtn.textContent = "กำลังตรวจสอบ…";
      loginStartBtn.disabled = true;
      Promise.resolve(handleLoginFromForm(loginForm)).finally(() => {
        loginPressBusy = false;
        if (loginStartBtn.isConnected) {
          loginStartBtn.disabled = false;
          loginStartBtn.textContent = "ตรวจสอบรหัสและเริ่มภารกิจ";
        }
      });
    };
    loginStartBtn.addEventListener("pointerdown", runLoginDirect, { passive:false });
    loginStartBtn.addEventListener("touchstart", runLoginDirect, { passive:false });
    loginStartBtn.addEventListener("click", runLoginDirect, { passive:false });
    loginForm.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      runLoginDirect(event);
    });`
      );

      source=source.replace(
        handlerNeedle,
        'async function handleLoginFromForm(formElement) {\n    const form = new FormData(formElement);'
      );

      (0,eval)(`${source}\n//# sourceURL=english-week-passport-app-core-v3.js`);
      window.EW_APP_CORE_LOADER=Object.freeze({version:VERSION,directPress:true});
    })
    .catch(error=>fail("EW app core loader failed",error));
}());
