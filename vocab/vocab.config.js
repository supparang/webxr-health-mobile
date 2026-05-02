/* =========================================================
   /vocab/vocab.config.js
   TechPath Vocab Arena — Endpoint + App Config
   PATCH: 2026-05-01
   ========================================================= */

(function(){
  "use strict";

  const LATEST_VOCAB_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec";

  function buildEndpoint(url, api){
    url = String(url || "").trim();
    api = String(api || "vocab").trim();

    if(!url) return "";

    try{
      const u = new URL(url, location.href);

      if(!u.searchParams.get("api")){
        u.searchParams.set("api", api);
      }

      return u.toString();
    }catch(e){
      return url.indexOf("?") >= 0
        ? url + "&api=" + encodeURIComponent(api)
        : url + "?api=" + encodeURIComponent(api);
    }
  }

  const endpointWithApi = buildEndpoint(LATEST_VOCAB_ENDPOINT, "vocab");

  window.VOCAB_ENDPOINT_LATEST = LATEST_VOCAB_ENDPOINT;
  window.VOCAB_SHEET_ENDPOINT = endpointWithApi;

  window.VOCAB_APP_CONFIG = {
    appName: "TechPath Vocab Arena",
    version: "vocab-split-v1-20260501",
    schema: "vocab-split-v1",
    source: "vocab.html",

    api: "vocab",
    endpoint: endpointWithApi,
    rawEndpoint: LATEST_VOCAB_ENDPOINT,

    queueKey: "VOCAB_SPLIT_LOG_QUEUE",
    profileKey: "VOCAB_SPLIT_STUDENT_PROFILE",
    lastSummaryKey: "VOCAB_SPLIT_LAST_SUMMARY",

    enableSheetLog: true,
    enableConsoleLog: true,
    enableLocalQueue: true,

    requestMode: "no-cors",
    requestContentType: "application/x-www-form-urlencoded;charset=UTF-8",

    defaultBank: "A",
    defaultDifficulty: "easy",
    defaultMode: "learn"
  };

  window.buildVocabEndpoint = buildEndpoint;

  console.log("[VOCAB CONFIG] loaded", {
    version: window.VOCAB_APP_CONFIG.version,
    endpoint: window.VOCAB_APP_CONFIG.endpoint
  });
})();
