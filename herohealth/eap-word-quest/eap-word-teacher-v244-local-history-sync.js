/* =========================================================
   EAP Word Quest • Teacher Local History → Sheets Sync
   File: /herohealth/eap-word-quest/eap-word-teacher-v244-local-history-sync.js
   Version: v2.4.4-TEACHER-LOCAL-HISTORY-SYNC-122

   Moves existing Core history from this browser to Sheets, then reloads the
   cloud report. Also reloads after the current Student Profile name/ID has
   been synchronized (for example KK → KP).
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

  window.addEventListener("eap-word-profile-identity-synced", (event) => {
    const detail = event && event.detail;
    if (!detail || !detail.ok || !detail.sent) return;
    notify(`อัปเดตชื่อ ${detail.profile && detail.profile.studentName ? detail.profile.studentName : "ผู้เรียน"} ใน Google Sheets แล้ว`);
    setTimeout(cloudReload, 1000);
  });

  window.inspectEapTeacherV244 = () => ({ version: VERSION, started });
  waitForBackfill(0);
})();
