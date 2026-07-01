/* =========================================================
   EAP Word Quest • Recovery CTA Visual Lock
   File: /herohealth/eap-word-quest/eap-word-engine-v224-recovery-cta-visual-lock.js
   Version: v2.6.7-STUDENT-BOOT-RESCUE-122

   Emergency stability hotfix
   - Keeps the established game/recovery modules.
   - Disables experimental Sheets receipt bridges v262/v264/v265 from the
     student boot path while the core game is stabilised.
   - Includes a visible-screen watchdog: a hidden/blank game view is restored
     to the Home screen without clearing progress or Local Storage.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.7-STUDENT-BOOT-RESCUE-122";
  if (window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__) return;
  window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  let queued = false;

  /* The static entry still references v262 from an earlier build. Mark it as
     already loaded before that static tag runs, so it safely returns without
     attaching extra observers or cross-origin delivery work. */
  window.__EAP_WORD_V262_VERIFIED_SHEET_BRIDGE__ = true;
  window.__EAP_WORD_V264_FORM_POST_RECEIPT__ = true;
  window.__EAP_WORD_V265_CURRENT_SUMMARY_RECEIPT__ = true;

  function corePassed(sessionId) {
    try {
      const saved = JSON.parse(localStorage.getItem("EAP_WORD_QUEST_PROFILE_V01") || "{}") || {};
      const rawId = norm(($('studentIdInput') && $('studentIdInput').value) || saved.studentId || saved.id || "no-id");
      const id = rawId.replace(/[^a-z0-9_-]/gi, "_") || "no-id";
      const key = `EAP_WORD_QUEST_CORE_V196_STATE_122_${id}`;
      const state = JSON.parse(localStorage.getItem(key) || "{}") || {};
      return Boolean(state.sessions && state.sessions[sessionId] && state.sessions[sessionId].passed);
    } catch (error) {
      return false;
    }
  }

  function summaryRecoverySession() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return "";
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+ฝึกเพิ่มอีกนิด/i);
    const sessionId = match ? match[1].toUpperCase() : "";
    return sessionId && !corePassed(sessionId) ? sessionId : "";
  }

  function addStyle() {
    if ($("eapV224RecoveryVisualStyle")) return;

    const style = document.createElement("style");
    style.id = "eapV224RecoveryVisualStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v224-label]{position:relative!important;min-width:242px!important;width:242px!important;max-width:242px!important;min-height:54px!important;overflow:hidden!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important}
      #nextMissionBtn[data-eap-v224-label]::after{content:attr(data-eap-v224-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      #eapWordBootRescue{display:none;margin:14px auto;max-width:960px;padding:12px 16px;border:1px solid #bfdbfe;border-radius:14px;background:#eff6ff;color:#174ea6;font-weight:800}
      @media(max-width:680px){#nextMissionBtn[data-eap-v224-label]{min-width:0!important;width:100%!important;max-width:none!important}#nextMissionBtn[data-eap-v224-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    addStyle();

    const button = $("nextMissionBtn");
    if (!button) return;

    const sessionId = summaryRecoverySession();
    if (!sessionId) {
      delete button.dataset.eapV224Label;
      button.removeAttribute("data-eap-v224-label");
      return;
    }

    const label = `เริ่ม ${sessionId} Recovery`;
    button.dataset.eapV224Label = label;
    button.setAttribute("aria-label", label);
    button.title = `เริ่มชุดทบทวน ${sessionId} โดยใช้โจทย์ใหม่`;
  }

  function requestApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  function visibleScreenExists() {
    return Array.from(document.querySelectorAll(".screen")).some((screen) => {
      const style = window.getComputedStyle(screen);
      const box = screen.getBoundingClientRect();
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 10 &&
        box.height > 10;
    });
  }

  function rescueBlankScreen() {
    addStyle();
    const home = $("homeScreen");
    if (!home || visibleScreenExists()) return false;

    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
      screen.style.removeProperty("display");
      screen.style.removeProperty("visibility");
      screen.style.removeProperty("opacity");
    });

    home.classList.add("active");
    home.style.setProperty("display", "block", "important");
    home.style.setProperty("visibility", "visible", "important");
    home.style.setProperty("opacity", "1", "important");

    let notice = $("eapWordBootRescue");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "eapWordBootRescue";
      notice.textContent = "กู้หน้าจอเกมแล้ว — ความก้าวหน้าในเครื่องยังอยู่ กรุณาเลือกเล่นต่อได้ตามปกติ";
      const shell = document.querySelector(".app-shell");
      if (shell) shell.prepend(notice);
    }
    notice.style.display = "block";
    console.warn("[EAP Word Quest] blank screen rescued", { version: VERSION });
    return true;
  }

  function loadStableGuards() {
    const load = (file, marker, tag) => {
      if (window[marker] || document.querySelector(`script[data-eap-runtime="${tag}"]`)) return;
      const script = document.createElement("script");
      script.src = `./${file}?v=20260701-${tag}`;
      script.async = false;
      script.dataset.eapRuntime = tag;
      document.head.appendChild(script);
    };

    load("eap-word-engine-v227-retained-pass-repair.js", "__EAP_WORD_V227_RETAINED_PASS_REPAIR__", "retained-pass");
    load("eap-word-engine-v229-recovery-round-integrity.js", "__EAP_WORD_V229_RECOVERY_ROUND_INTEGRITY__", "recovery-round");
    load("eap-word-engine-v233-pass-ledger-path.js", "__EAP_WORD_V233_PASS_LEDGER_PATH__", "pass-ledger-path");
    load("eap-word-engine-v234-final-summit-complete.js", "__EAP_WORD_V234_FINAL_SUMMIT__", "final-summit");
    load("eap-word-engine-v236-boss-round-recovery-integrity.js", "__EAP_WORD_V236_BOSS_ROUND_INTEGRITY__", "boss-round");
    load("eap-word-engine-v235-boss-summary-truth.js", "__EAP_WORD_V235_BOSS_SUMMARY_TRUTH__", "boss-summary");
    load("eap-word-engine-v237-bg5-full-recovery-director.js", "__EAP_WORD_V237_BG5_FULL_RECOVERY__", "bg5-full-recovery");
    load("eap-word-engine-v238-final-pass-commit.js", "__EAP_WORD_V238_FINAL_PASS_COMMIT__", "final-pass-commit");
    load("eap-word-engine-v239-home-completion-report.js", "__EAP_WORD_V239_HOME_COMPLETION__", "home-completion-report");
  }

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  document.addEventListener("click", () => [0, 120, 360, 760].forEach((delay) => setTimeout(requestApply, delay)), true);
  window.addEventListener("eap-core-run-finished", () => [0, 100, 300, 700].forEach((delay) => setTimeout(requestApply, delay)));
  [0, 160, 500, 1200, 2200].forEach((delay) => setTimeout(requestApply, delay));
  [800, 1800, 3500].forEach((delay) => setTimeout(rescueBlankScreen, delay));
  loadStableGuards();

  window.inspectEapV224 = () => ({
    version: VERSION,
    recoverySession: summaryRecoverySession(),
    visibleScreenExists: visibleScreenExists(),
    receiptBridgesDisabled: true
  });

  console.info("[EAP Word Quest] stable student boot + rescue ready", { version: VERSION });
})();
