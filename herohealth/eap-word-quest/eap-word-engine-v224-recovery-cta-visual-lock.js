/* =========================================================
   EAP Word Quest • Recovery CTA Visual Lock
   File: /herohealth/eap-word-quest/eap-word-engine-v224-recovery-cta-visual-lock.js
   Version: v2.2.4-RECOVERY-CTA-VISUAL-LOCK-122

   A presentation-only guard for Summary screens that say “ฝึกเพิ่มอีกนิด”.
   Older summary scripts can still refresh the button's underlying text while
   they render progress. This patch paints one fixed Recovery label without
   writing the button text itself, so there is no visible word swapping.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.4-RECOVERY-CTA-VISUAL-LOCK-122";
  if (window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__) return;
  window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  let queued = false;

  function summaryRecoverySession() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return "";
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+ฝึกเพิ่มอีกนิด/i);
    return match ? match[1].toUpperCase() : "";
  }

  function addStyle() {
    if ($("eapV224RecoveryVisualStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV224RecoveryVisualStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v224-label]{
        position:relative!important;
        min-width:242px!important;
        width:242px!important;
        max-width:242px!important;
        min-height:54px!important;
        overflow:hidden!important;
        color:transparent!important;
        font-size:0!important;
        line-height:0!important;
        text-shadow:none!important;
      }
      #nextMissionBtn[data-eap-v224-label]::after{
        content:attr(data-eap-v224-label)!important;
        position:absolute!important;
        inset:0!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        color:#fff!important;
        font-size:18px!important;
        font-weight:950!important;
        line-height:1.15!important;
        white-space:nowrap!important;
        pointer-events:none!important;
      }
      @media(max-width:680px){
        #nextMissionBtn[data-eap-v224-label]{min-width:0!important;width:100%!important;max-width:none!important}
        #nextMissionBtn[data-eap-v224-label]::after{font-size:17px!important}
      }
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

  function loadSummaryPassCommit() {
    if (window.__EAP_WORD_V226_SUMMARY_PASS_COMMIT__ || document.querySelector("script[data-eap-v226-summary-pass]")) return;
    const script = document.createElement("script");
    script.src = "./eap-word-engine-v226-summary-pass-commit.js?v=20260629-v226-summary-pass";
    script.async = false;
    script.dataset.eapV226SummaryPass = "true";
    document.head.appendChild(script);
  }

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  document.addEventListener("click",()=>[0,120,360,760].forEach((delay)=>setTimeout(requestApply,delay)),true);
  window.addEventListener("eap-core-run-finished",()=>[0,100,300,700].forEach((delay)=>setTimeout(requestApply,delay)));
  [0,160,500,1200].forEach((delay)=>setTimeout(requestApply,delay));
  loadSummaryPassCommit();

  window.inspectEapV224 = () => ({
    version:VERSION,
    recoverySession:summaryRecoverySession(),
    visibleLabel:norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV224Label)
  });

  console.info("[EAP Word Quest] v224 stable Recovery CTA ready",{version:VERSION});
})();
