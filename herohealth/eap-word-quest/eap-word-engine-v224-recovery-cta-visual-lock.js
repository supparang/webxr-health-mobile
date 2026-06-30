/* =========================================================
   EAP Word Quest • Recovery CTA Visual Lock
   File: /herohealth/eap-word-quest/eap-word-engine-v224-recovery-cta-visual-lock.js
   Version: v2.2.4-RECOVERY-LOCK-FINAL-LOADER-122

   Keeps a stable Recovery CTA only for a Session that has not passed yet.
   Loads the small retained-pass and recovery-size guards plus one final
   progress authority. Older overlapping summary-state patches are no longer
   loaded from this runtime entry point.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.4-RECOVERY-LOCK-FINAL-LOADER-122";
  if (window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__) return;
  window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  let queued = false;

  function corePassed(sessionId) {
    try {
      const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
      const key = progress && progress.stateKey;
      const raw = key ? localStorage.getItem(key) : "";
      const state = raw ? JSON.parse(raw) : {};
      return Boolean(state && state.sessions && state.sessions[sessionId] && state.sessions[sessionId].passed);
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
    load("eap-word-engine-v232-final-progress-authority.js", "__EAP_WORD_V232_FINAL_PROGRESS_AUTHORITY__", "final-progress");
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

  console.info("[EAP Word Quest] v224 final recovery loader ready",{version:VERSION});
})();
