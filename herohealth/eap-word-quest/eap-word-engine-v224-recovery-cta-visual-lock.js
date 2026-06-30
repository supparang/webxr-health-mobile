/* =========================================================
   EAP Word Quest • Recovery CTA Visual Lock
   File: /herohealth/eap-word-quest/eap-word-engine-v224-recovery-cta-visual-lock.js
   Version: v2.6.2-RECOVERY-LOCK-LEDGER-LOADER-122
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.2-RECOVERY-LOCK-LEDGER-LOADER-122";
  if (window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__) return;
  window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  let queued = false;

  function corePassed(sessionId) {
    try {
      const saved = JSON.parse(localStorage.getItem("EAP_WORD_QUEST_PROFILE_V01") || "{}") || {};
      const rawId = norm(($('studentIdInput') && $('studentIdInput').value) || saved.studentId || saved.id || "no-id");
      const id = rawId.replace(/[^a-z0-9_-]/gi,"_") || "no-id";
      const key = `EAP_WORD_QUEST_CORE_V196_STATE_122_${id}`;
      const state = JSON.parse(localStorage.getItem(key) || "{}") || {};
      return Boolean(state.sessions && state.sessions[sessionId] && state.sessions[sessionId].passed);
    } catch (err) {
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
    if (button.dataset.eapV224Label !== label) button.dataset.eapV224Label = label;
    if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label",label);
    button.title = `เริ่มชุดทบทวน ${sessionId} โดยใช้โจทย์ใหม่`;
  }

  function requestApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  function loadFinalGuards() {
    const load = (file, marker, tag) => {
      if (window[marker] || document.querySelector(`script[data-eap-runtime="${tag}"]`)) return;
      const script = document.createElement("script");
      script.src = `./${file}?v=20260630-${tag}`;
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
    load("eap-word-sheet-config.js", "EAP_WORD_SHEET_CONFIG", "sheet-config-v260");
    load("eap-word-engine-v260-cloud-ledger-final.js", "__EAP_WORD_V260_CLOUD_LEDGER__", "cloud-ledger-v260");
    load("eap-word-engine-v245-profile-identity-sync.js", "__EAP_WORD_V245_PROFILE_IDENTITY_SYNC__", "profile-identity-sync-v260");
    load("eap-word-engine-v262-verified-sheet-bridge.js", "__EAP_WORD_V262_VERIFIED_SHEET_BRIDGE__", "verified-sheet-bridge-v262");
  }

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener("click",()=>[0,120,360,760].forEach((delay)=>setTimeout(requestApply,delay)),true);
  window.addEventListener("eap-core-run-finished",()=>[0,100,300,700].forEach((delay)=>setTimeout(requestApply,delay)));
  [0,160,500,1200,2200].forEach((delay)=>setTimeout(requestApply,delay));
  loadFinalGuards();

  window.inspectEapV224 = () => ({
    version:VERSION,
    recoverySession:summaryRecoverySession(),
    visibleLabel:norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV224Label)
  });

  console.info("[EAP Word Quest] final completion + verified cloud ledger loader ready",{version:VERSION});
})();
