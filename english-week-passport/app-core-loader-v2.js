(function(){
  "use strict";
  const VERSION="2026-08-07-APP-CORE-LOADER-V4-FIREBASE-AUTO-RETURN";
  const SOURCE_URL="./app.js?v=20260807-firebase-auto-return-source1";

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
      const receiptNeedle='if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");\n      state.authority = receipt.authority;';
      const summaryNeedle='renderStageSummary(stageId, receipt, durationMs);';
      const errorNeedle='RESUME_FAILED: "กู้คืนความก้าวหน้าไม่สำเร็จ"';

      if(!source.includes(buttonNeedle)||!source.includes(listenerNeedle)||!source.includes(handlerNeedle)){
        throw new Error("LOGIN_PATCH_POINT_NOT_FOUND");
      }
      if(!source.includes(receiptNeedle)||!source.includes(summaryNeedle)){
        throw new Error("FIREBASE_AUTO_RETURN_PATCH_POINT_NOT_FOUND");
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

      source=source.replace(
        receiptNeedle,
        `if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");
      const firebaseSaved = receipt.mode === "firebase" || receipt.authority?.mode === "firebase";
      if (!firebaseSaved) throw new Error(receipt.firebaseError || "FIREBASE_RECEIPT_REQUIRED");
      state.authority = receipt.authority;`
      );

      source=source.replace(
        summaryNeedle,
        `renderStageSummary(stageId, receipt, durationMs);
      if (stage.kind === "assessment") {
        const nextButton = document.getElementById("summaryNextBtn");
        if (nextButton) {
          nextButton.disabled = true;
          nextButton.textContent = "Firebase บันทึกสำเร็จ • กำลังกลับ Passport…";
        }
        showToast(stageId === "post_challenge"
          ? "บันทึก Post-Challenge ลง Firebase สำเร็จ • กำลังกลับ Passport"
          : "บันทึก Pre-Challenge ลง Firebase สำเร็จ • กำลังกลับ Passport", 1700);
        setTimeout(() => {
          if (state.activeStage === stageId && state.lastReceipt === receipt) renderPassport();
        }, 1900);
      }`
      );

      if(source.includes(errorNeedle)){
        source=source.replace(
          errorNeedle,
          `RESUME_FAILED: "กู้คืนความก้าวหน้าไม่สำเร็จ",
      FIREBASE_RECEIPT_REQUIRED: "ยังไม่ได้รับ Firebase receipt จึงยังไม่กลับ Passport",
      FIREBASE_AUTHORITY_URL_MISSING: "ยังไม่ได้เปิดใช้ Firebase Authority"`
        );
      }

      (0,eval)(`${source}\n//# sourceURL=english-week-passport-app-core-v4.js`);
      window.EW_APP_CORE_LOADER=Object.freeze({version:VERSION,directPress:true,firebaseReceiptRequired:true,assessmentAutoReturn:true});
    })
    .catch(error=>fail("EW app core loader failed",error));
}());