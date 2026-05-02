/* =========================================================
   /vocab/vocab.logger.js
   TechPath Vocab Arena — Google Sheet Logger
   ใช้ endpoint ล่าสุดจาก vocab.config.js
   PATCH: 2026-05-01
   ========================================================= */

(function(){
  "use strict";

  function cfg(){
    return window.VOCAB_APP_CONFIG || {};
  }

  function nowIso(){
    return new Date().toISOString();
  }

  function getEndpoint(){
    const c = cfg();

    if(window.buildVocabEndpoint){
      return window.buildVocabEndpoint(
        c.endpoint || window.VOCAB_SHEET_ENDPOINT || window.VOCAB_ENDPOINT_LATEST || "",
        c.api || "vocab"
      );
    }

    return c.endpoint || window.VOCAB_SHEET_ENDPOINT || "";
  }

  function getInputValue(id, fallback){
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : String(fallback || "");
  }

  function getUrlParam(name, fallback){
    try{
      const p = new URLSearchParams(location.search);
      return p.get(name) || fallback || "";
    }catch(e){
      return fallback || "";
    }
  }

  function getStudentContext(){
    const saved = window.VocabStorage
      ? window.VocabStorage.loadStudentProfile()
      : {};

    const displayName =
      getInputValue("v63DisplayName") ||
      getUrlParam("name") ||
      getUrlParam("nick") ||
      saved.display_name ||
      saved.displayName ||
      "Hero";

    const studentId =
      getInputValue("v63StudentId") ||
      getUrlParam("student_id") ||
      getUrlParam("sid") ||
      getUrlParam("pid") ||
      saved.student_id ||
      saved.studentId ||
      "anon";

    const section =
      getInputValue("v63Section") ||
      getUrlParam("section") ||
      saved.section ||
      "";

    const sessionCode =
      getInputValue("v63SessionCode") ||
      getUrlParam("session_code") ||
      getUrlParam("studyId") ||
      saved.session_code ||
      saved.sessionCode ||
      "";

    return {
      display_name: displayName,
      student_id: studentId,
      section: section,
      session_code: sessionCode
    };
  }

  function saveStudentContextFromForm(){
    const ctx = getStudentContext();

    if(window.VocabStorage){
      window.VocabStorage.saveStudentProfile(ctx);
    }

    return ctx;
  }

  function getRuntimeContext(){
    const c = cfg();

    let bank = c.defaultBank || "A";
    let difficulty = c.defaultDifficulty || "easy";
    let mode = c.defaultMode || "learn";
    let sessionId = "";

    try{
      if(window.VOCAB_APP){
        bank = window.VOCAB_APP.selectedBank || bank;
        difficulty = window.VOCAB_APP.selectedDifficulty || difficulty;
        mode = window.VOCAB_APP.selectedMode || mode;
      }
    }catch(e){}

    try{
      if(window.vocabGame){
        bank = window.vocabGame.bank || bank;
        difficulty = window.vocabGame.difficulty || difficulty;
        mode = window.vocabGame.mode || mode;
        sessionId = window.vocabGame.sessionId || "";
      }
    }catch(e){}

    if(!sessionId){
      sessionId = "vocab_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    }

    return {
      session_id: sessionId,
      bank: bank,
      difficulty: difficulty,
      mode: mode
    };
  }

  function toFormBody(payload){
    const body = new URLSearchParams();

    Object.entries(payload || {}).forEach(([key, value]) => {
      if(value === undefined || value === null) return;

      if(typeof value === "object"){
        body.append(key, JSON.stringify(value));
      }else{
        body.append(key, String(value));
      }
    });

    return body;
  }

  function saveLocal(payload){
    const c = cfg();

    if(c.enableLocalQueue === false) return;

    if(window.VocabStorage){
      window.VocabStorage.pushLocalQueue(
        c.queueKey || "VOCAB_SPLIT_LOG_QUEUE",
        payload,
        900
      );
    }
  }

  function postToSheet(payload){
    const c = cfg();
    const endpoint = getEndpoint();

    if(!endpoint || c.enableSheetLog === false){
      return Promise.resolve({
        ok: false,
        skipped: true,
        reason: "endpoint-disabled"
      });
    }

    const body = toFormBody(payload);

    return fetch(endpoint, {
      method: "POST",
      mode: c.requestMode || "no-cors",
      headers: {
        "Content-Type": c.requestContentType || "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: body
    }).then(() => {
      return {
        ok: true,
        mode: c.requestMode || "no-cors"
      };
    }).catch(err => {
      console.warn("[VOCAB LOGGER] post failed", err);

      return {
        ok: false,
        error: String(err && err.message ? err.message : err)
      };
    });
  }

  function logEvent(action, data){
    const c = cfg();
    const student = getStudentContext();
    const runtime = getRuntimeContext();

    const payload = Object.assign({
      api: c.api || "vocab",
      source: c.source || "vocab.html",
      schema: c.schema || "vocab-split-v1",
      version: c.version || "vocab-split-v1",

      action: action || "event",
      event_type: action || "event",
      timestamp: nowIso(),
      client_ts: nowIso(),

      page_url: location.href,
      user_agent: navigator.userAgent || "",

      endpoint_version: "AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i"
    }, runtime, student, data || {});

    if(c.enableConsoleLog !== false){
      console.log("[VOCAB LOG]", payload);
    }

    saveLocal(payload);
    postToSheet(payload);

    return payload;
  }

  function logSessionStart(extra){
    return logEvent("session_start", extra || {});
  }

  function logTermAnswer(extra){
    return logEvent("term_answer", extra || {});
  }

  function logSessionEnd(extra){
    return logEvent("session_end", extra || {});
  }

  function logStudentProfile(extra){
    return logEvent("student_profile_update", extra || {});
  }

  function testEndpoint(){
    return logEvent("manual_endpoint_test", {
      test: 1,
      message: "Vocab endpoint test from frontend",
      endpoint: getEndpoint()
    });
  }

  /*
    Backward compatible:
    ถ้าโค้ดเก่ายังเรียก logVocabEventV6 อยู่ จะยังใช้ได้
  */
  window.logVocabEventV6 = function(type, data){
    return logEvent(type, data || {});
  };

  window.VocabLogger = {
    getEndpoint,
    getStudentContext,
    saveStudentContextFromForm,
    getRuntimeContext,
    logEvent,
    logSessionStart,
    logTermAnswer,
    logSessionEnd,
    logStudentProfile,
    testEndpoint
  };

  console.log("[VOCAB LOGGER] loaded", getEndpoint());
})();
