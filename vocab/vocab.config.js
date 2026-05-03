/* =========================================================
   /vocab/vocab.config.js
   TechPath Vocab Arena — Config
   PATCH: v20260503d
========================================================= */

(function(){
  "use strict";

  const ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec";

  window.VOCAB_APP = {
    version: "v20260503d",
    schema: "vocab-split-v1",
    source: "vocab.html",

    api: "vocab",

    /*
      ใช้ base endpoint ไม่ต้องใส่ ?api=vocab ตรงนี้
      logger จะเติม api=vocab ให้เองตอนส่งข้อมูล
    */
    sheetEndpoint: ENDPOINT,

    enableSheetLog: true,
    enableConsoleLog: true,

    selectedBank: "A",
    selectedDifficulty: "easy",
    selectedMode: "learn"
  };

  window.VOCAB_SHEET_ENDPOINT = ENDPOINT;

  console.log("[VOCAB CONFIG] loaded", window.VOCAB_APP);
})();
