(function(){
  "use strict";
  const VERSION="2026-08-07-APP-CORE-LOADER-V5-ASSESSMENT-RESUME";
  const SOURCE_URL="./app.js?v=20260807-assessment-resume-source1";

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
      const loginResumeNeedle='if (progress().preDone) renderPassport(); else renderWelcome();';
      const startStageNeedle='  function startStage(stageId) {';
      const renderQuestionNeedle='    renderQuestion();\n  }\n\n  function renderQuestion() {';
      const answerSaveNeedle='    document.getElementById("nextBtn").hidden = false;\n  }';
      const receiptNeedle='if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");\n      state.authority = receipt.authority;';
      const clearCheckpointNeedle='      state.authority = receipt.authority;\n      state.lastReceipt = receipt;';
      const summaryNeedle='renderStageSummary(stageId, receipt, durationMs);';
      const errorNeedle='RESUME_FAILED: "กู้คืนความก้าวหน้าไม่สำเร็จ"';

      if(!source.includes(buttonNeedle)||!source.includes(listenerNeedle)||!source.includes(handlerNeedle)){
        throw new Error("LOGIN_PATCH_POINT_NOT_FOUND");
      }
      if(!source.includes(loginResumeNeedle)||!source.includes(startStageNeedle)||!source.includes(renderQuestionNeedle)||!source.includes(answerSaveNeedle)){
        throw new Error("ASSESSMENT_RESUME_PATCH_POINT_NOT_FOUND");
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
        loginResumeNeedle,
        `if (progress().preDone) {
        renderPassport();
      } else if (typeof authorityApi.getAssessmentCheckpoint === "function") {
        const pending = await authorityApi.getAssessmentCheckpoint(playerId, "pre");
        const checkpoint = pending?.checkpoint || null;
        if (checkpoint && Number(checkpoint.currentIndex || 0) > 0) {
          showToast(\`พบ Pre-Challenge ที่ทำค้างไว้ • กลับมาต่อข้อ \${Math.min(Number(checkpoint.currentIndex || 0) + 1, Number(checkpoint.total || 10))}\`, 3200);
          startStage("pre_challenge", checkpoint);
        } else {
          renderWelcome();
        }
      } else {
        renderWelcome();
      }`
      );

      source=source.replace(
        startStageNeedle,
        `  function assessmentTypeForStage(stageId) {
    return stageId === "pre_challenge" ? "pre" : stageId === "post_challenge" ? "post" : "";
  }

  function assessmentFormForStage(stageId) {
    const type = assessmentTypeForStage(stageId);
    if (!type) return "";
    return window.EW_ROTATION?.actualForm?.(type) || (type === "pre" ? "A" : "B");
  }

  function checkpointQuestionIds() {
    return state.questions.map(item => String(item?.id || ""));
  }

  function checkpointMatches(checkpoint) {
    if (!checkpoint || Number(checkpoint.total || 0) !== state.questions.length) return false;
    const expected = checkpointQuestionIds();
    const supplied = Array.isArray(checkpoint.questionIds) ? checkpoint.questionIds.map(String) : [];
    return supplied.length === expected.length && supplied.every((id,index) => id === expected[index]);
  }

  function applyAssessmentCheckpoint(checkpoint) {
    state.index = Math.max(0, Math.min(state.questions.length, Number(checkpoint.currentIndex || 0)));
    state.answers = Array.isArray(checkpoint.answers) ? checkpoint.answers.slice(0, state.index) : [];
    state.correct = Math.max(0, Number(checkpoint.correct || 0));
    state.points = Math.max(0, Number(checkpoint.points || 0));
    state.combo = Math.max(0, Number(checkpoint.combo || 0));
    state.startedAt = Date.now() - Math.max(0, Number(checkpoint.elapsedMs || 0));
    state.answered = false;
  }

  function assessmentCheckpointPayload() {
    const assessmentType = assessmentTypeForStage(state.activeStage);
    if (!assessmentType || !state.identity) return null;
    const assignment = window.EW_ROTATION?.getAssignment?.(state.identity.playerId) || null;
    return {
      playerId: state.identity.playerId,
      nickname: profile().nickname || profile().fullName,
      assessmentType,
      formId: assessmentFormForStage(state.activeStage),
      currentIndex: Math.min(state.questions.length, state.index + (state.answered ? 1 : 0)),
      total: state.questions.length,
      answers: state.answers,
      questionIds: checkpointQuestionIds(),
      correct: state.correct,
      points: state.points,
      combo: state.combo,
      elapsedMs: Math.max(0, Date.now() - state.startedAt),
      passportRotation: assignment?.passportRotation || "",
      assessmentRotation: assignment?.assessmentRotation || "",
      randomSeed: assignment?.randomSeed || 0,
      sourceVersion: "2026-08-07-ASSESSMENT-RESUME-V1"
    };
  }

  function saveAssessmentCheckpointNow() {
    const payload = assessmentCheckpointPayload();
    if (!payload || typeof authorityApi.saveAssessmentCheckpoint !== "function") return Promise.resolve(null);
    return Promise.resolve(authorityApi.saveAssessmentCheckpoint(payload)).catch(error => {
      console.warn("Assessment checkpoint save failed", error);
      return null;
    });
  }

  function startStage(stageId, resumeCheckpoint) {`
      );

      source=source.replace(
        renderQuestionNeedle,
        `    const assessmentType = assessmentTypeForStage(stageId);
    if (assessmentType && resumeCheckpoint) {
      if (checkpointMatches(resumeCheckpoint)) {
        applyAssessmentCheckpoint(resumeCheckpoint);
        if (state.index < state.questions.length) {
          showToast(\`กลับมาต่อข้อ \${state.index + 1} / \${state.questions.length}\`, 2600);
        }
      } else {
        console.warn("Ignored stale assessment checkpoint", resumeCheckpoint);
        authorityApi.clearAssessmentCheckpoint?.(state.identity?.playerId, assessmentType).catch?.(()=>{});
      }
    } else if (assessmentType && resumeCheckpoint === undefined && typeof authorityApi.getAssessmentCheckpoint === "function") {
      showLoading("กำลังตรวจจุดที่ทำค้าง…");
      authorityApi.getAssessmentCheckpoint(state.identity?.playerId, assessmentType)
        .then(result => startStage(stageId, result?.checkpoint || null))
        .catch(error => {
          console.warn("Assessment checkpoint lookup failed", error);
          startStage(stageId, null);
        })
        .finally(hideLoading);
      return;
    }
    renderQuestion();
  }

  function renderQuestion() {`
      );

      source=source.replace(
        answerSaveNeedle,
        `    const nextBtn = document.getElementById("nextBtn");
    nextBtn.hidden = false;
    if (assessmentTypeForStage(state.activeStage)) {
      nextBtn.dataset.checkpoint = "saving";
      saveAssessmentCheckpointNow().then(result => {
        if (!nextBtn.isConnected) return;
        nextBtn.dataset.checkpoint = result?.mode === "firebase" ? "firebase" : "local";
      });
    }
  }`
      );

      source=source.replace(
        receiptNeedle,
        `if (!receipt?.ok || !receipt.authority) throw new Error(receipt?.error || "RECEIPT_MISSING");
      const firebaseSaved = receipt.mode === "firebase" || receipt.authority?.mode === "firebase";
      if (!firebaseSaved) throw new Error(receipt.firebaseError || "FIREBASE_RECEIPT_REQUIRED");
      state.authority = receipt.authority;`
      );

      if(source.includes(clearCheckpointNeedle)){
        source=source.replace(
          clearCheckpointNeedle,
          `      state.authority = receipt.authority;
      if (stage.kind === "assessment" && typeof authorityApi.clearAssessmentCheckpoint === "function") {
        await authorityApi.clearAssessmentCheckpoint(
          state.identity.playerId,
          stageId === "pre_challenge" ? "pre" : "post"
        );
      }
      state.lastReceipt = receipt;`
        );
      }

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
      FIREBASE_AUTHORITY_URL_MISSING: "ยังไม่ได้เปิดใช้ Firebase Authority",
      ASSESSMENT_CHECKPOINT_ENDPOINT_MISSING: "ระบบกู้คืนข้อสอบยังไม่พร้อม"`
        );
      }

      (0,eval)(`${source}\n//# sourceURL=english-week-passport-app-core-v5.js`);
      window.EW_APP_CORE_LOADER=Object.freeze({version:VERSION,directPress:true,firebaseReceiptRequired:true,assessmentAutoReturn:true,assessmentResume:true});
    })
    .catch(error=>fail("EW app core loader failed",error));
}());
