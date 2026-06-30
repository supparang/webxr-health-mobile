/* =========================================================
   EAP Word Quest • Teacher Local History → Sheets Sync
   File: /herohealth/eap-word-quest/eap-word-teacher-v244-local-history-sync.js
   Version: v2.4.4-TEACHER-LOCAL-HISTORY-SYNC-122

   The Teacher Dashboard and Student page share the same GitHub Pages origin.
   When a teacher opens this dashboard on the same device used for testing,
   this bridge sends the existing Core pass ledger to Google Sheets once and
   then reloads the cloud view. It does not alter any student progress.
========================================================= */
(() => {
  "use strict";

  if (window.__EAP_WORD_TEACHER_V244_LOCAL_HISTORY_SYNC__) return;
  window.__EAP_WORD_TEACHER_V244_LOCAL_HISTORY_SYNC__ = true;

  const VERSION = "v2.4.4-TEACHER-LOCAL-HISTORY-SYNC-122";
  const $ = (id) => document.getElementById(id);
  let started = false;

  function notify(message) {
    const node = $("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.remove("hide");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => node.classList.add("hide"), 4200);
  }

  function cloudReload() {
    const button = $("loadCloudBtn");
    if (button && typeof button.click === "function") button.click();
  }

  async function sync() {
    if (started) return;
    started = true;

    if (typeof window.inspectEapWordQuestHistoryBackfill !== "function" ||
        typeof window.syncEapWordQuestHistoryToSheets !== "function") {
      return;
    }

    const before = window.inspectEapWordQuestHistoryBackfill();
    if (!before || !before.endpointConfigured) return;

    if (Number(before.pending || 0) > 0) {
      notify(`กำลังย้ายประวัติ Core ${before.pending} ภารกิจเข้า Google Sheets…`);
      const result = await window.syncEapWordQuestHistoryToSheets();
      if (result && result.ok && Number(result.sent || 0) > 0) {
        notify(`ย้ายประวัติ ${result.sent} ภารกิจเข้า Google Sheets แล้ว`);
      }
    }

    // no-cors POST returns after the request has been accepted by the browser;
    // wait briefly before refreshing the JSONP teacher API.
    setTimeout(cloudReload, 1200);
  }

  function waitForBackfill(tryCount) {
    if (typeof window.syncEapWordQuestHistoryToSheets === "function") {
      sync();
      return;
    }
    if (tryCount >= 100) return;
    setTimeout(() => waitForBackfill(tryCount + 1), 50);
  }

  window.inspectEapTeacherV244 = () => ({ version: VERSION, started });
  waitForBackfill(0);
})();
