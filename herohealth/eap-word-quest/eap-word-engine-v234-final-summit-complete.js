/* =========================================================
   EAP Word Quest • Final Summit Completion
   File: /herohealth/eap-word-quest/eap-word-engine-v234-final-summit-complete.js
   Version: v2.3.4-FINAL-SUMMIT-COMPLETE-122

   Final-screen only. When BG5 is visibly passed and all 20 path gates are
   complete, show a clear completion card and replace the stale “next mission”
   visual label with a truthful return-home action. Scoring, gates, logs and
   progress remain owned by the Core controller / v233 ledger.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.4-FINAL-SUMMIT-COMPLETE-122";
  if (window.__EAP_WORD_V234_FINAL_SUMMIT__) return;
  window.__EAP_WORD_V234_FINAL_SUMMIT__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  let queued = false;

  function isFinalSummary() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return false;
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    if (!/^BG5\s+(?:ผ่านแล้ว!|Complete)$/i.test(title)) return false;
    try {
      const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
      return Boolean(progress && Number(progress.passed) >= 20 && String(progress.next) === "DONE");
    } catch (err) {
      return false;
    }
  }

  function addStyle() {
    if ($("eapV234FinalStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV234FinalStyle";
    style.textContent = `
      #eapV234FinalCard{margin:12px 0;border:1px solid #86efac;border-radius:16px;padding:15px 16px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);color:#14532d;line-height:1.5;font-weight:850}
      #eapV234FinalCard b{display:block;font-size:19px;color:#166534;margin-bottom:4px}
      #eapV234FinalCard .eap234-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}
      #eapV234FinalCard .eap234-chip{display:inline-flex;border:1px solid #86efac;border-radius:999px;padding:5px 9px;background:#fff;color:#166534;font-size:12px;font-weight:950}
      #nextMissionBtn[data-eap-v234-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;min-width:205px!important}
      #nextMissionBtn[data-eap-v234-label]::after{content:attr(data-eap-v234-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      @media(max-width:680px){#nextMissionBtn[data-eap-v234-label]{width:100%!important;min-width:0!important}#nextMissionBtn[data-eap-v234-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function clearOldButtonLabels(button) {
    ["eapV228Label","eapV230Label","eapV231Label","eapV232Label","eapV233Label","eapV224Label"].forEach((key) => {
      if (button && button.dataset) delete button.dataset[key];
    });
  }

  function apply() {
    queued = false;
    addStyle();
    const root = $("summaryScreen") && ($("summaryScreen").querySelector(".summary-card") || $("summaryScreen"));
    const button = $("nextMissionBtn");
    if (!root || !button) return;

    if (!isFinalSummary()) {
      const old = $("eapV234FinalCard");
      if (old) old.remove();
      delete button.dataset.eapV234Label;
      return;
    }

    let card = $("eapV234FinalCard");
    if (!card) {
      card = document.createElement("section");
      card.id = "eapV234FinalCard";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin",card); else root.appendChild(card);
    }
    card.innerHTML = `
      <b>🏆 EAP Word Quest Complete!</b>
      คุณผ่านครบทั้ง 20 ภารกิจของ Vocabulary Arc แล้ว รวมถึง BG5 · Human Override Summit<br>
      ตอนนี้สามารถกลับหน้าแรกเพื่อดูเส้นทางที่สำเร็จแล้ว หรือทบทวน Weak Words ใน Word Deck ได้ตามต้องการ
      <div class="eap234-chips"><span class="eap234-chip">20/20 Missions</span><span class="eap234-chip">All 5 Boss Gates</span><span class="eap234-chip">Group 122</span></div>`;

    clearOldButtonLabels(button);
    const label = "กลับหน้าหลัก";
    button.dataset.eapV234Label = label;
    button.setAttribute("aria-label",label);
    button.title = "กลับหน้าแรกหลังจบ EAP Word Quest";
  }

  function requestApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener("eap-core-run-finished",()=>[0,120,360,800,1500].forEach((delay)=>setTimeout(requestApply,delay)));
  document.addEventListener("click",()=>[100,300,700].forEach((delay)=>setTimeout(requestApply,delay)),true);
  [0,160,500,1200,2200,3400].forEach((delay)=>setTimeout(requestApply,delay));

  window.inspectEapV234 = () => ({
    version:VERSION,
    finalSummary:isFinalSummary(),
    label:norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV234Label)
  });

  console.info("[EAP Word Quest] v234 final summit completion ready",{version:VERSION});
})();
