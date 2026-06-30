/* =========================================================
   EAP Word Quest • Boss Summary Truth
   File: /herohealth/eap-word-quest/eap-word-engine-v235-boss-summary-truth.js
   Version: v2.3.5-BOSS-SUMMARY-TRUTH-122

   Final Boss-summary presentation guard.
   The earlier generic Boss plan used 70% for every Boss, but BG5 requires
   75%. This guard reads the visible Summary score, applies the official
   threshold for the exact Boss, and keeps the recovery plan + primary CTA
   truthful. It does not write progress, alter scores, or change gates.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.5-BOSS-SUMMARY-TRUTH-122";
  const BOSS = new Set(["BG1","BG2","BG3","BG4","BG5"]);

  if (window.__EAP_WORD_V235_BOSS_SUMMARY_TRUTH__) return;
  window.__EAP_WORD_V235_BOSS_SUMMARY_TRUTH__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  let queued = false;

  function threshold(id) {
    return id === "BG5" ? 75 : 70;
  }

  function fullRoundSize(id) {
    return id === "BG5" ? 24 : 18;
  }

  function summaryModel() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return null;

    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(BG[1-5])\s+(ผ่านแล้ว!|ฝึกเพิ่มอีกนิด|Complete|Needs Review)/i);
    if (!match) return null;

    const sessionId = match[1].toUpperCase();
    if (!BOSS.has(sessionId)) return null;

    const statsText = norm($("summaryStats") && $("summaryStats").textContent);
    const pair = statsText.match(/(\d+)\s*\/\s*(\d+)/);
    const pct = statsText.match(/(\d+)\s*%/);
    const live = window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || {};
    const sameRun = norm(live.sessionId).toUpperCase() === sessionId;
    const correct = Math.max(0, Math.round(Number(sameRun ? live.correct : pair && pair[1]) || 0));
    const total = Math.max(1, Math.round(Number(sameRun ? live.total : pair && pair[2]) || 1));
    const accuracy = Math.max(0, Math.min(100, Math.round(Number(sameRun ? live.accuracy : pct && pct[1]) || ((correct / total) * 100))));
    const required = threshold(sessionId);
    const needed = Math.ceil((total * required) / 100);

    return {
      sessionId,
      correct,
      total,
      accuracy,
      required,
      needed,
      passed: accuracy >= required && correct >= needed,
      title
    };
  }

  function addStyle() {
    if ($("eapV235BossSummaryStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV235BossSummaryStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v235-label]{
        position:relative!important;
        min-width:250px!important;
        width:250px!important;
        max-width:250px!important;
        min-height:54px!important;
        overflow:hidden!important;
        color:transparent!important;
        font-size:0!important;
        line-height:0!important;
        text-shadow:none!important;
      }
      #nextMissionBtn[data-eap-v235-label]::after{
        content:attr(data-eap-v235-label)!important;
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
      #eapV218RecoveryPlan[data-eap-v235-boss-fail="true"]{border-color:#fed7aa!important;background:linear-gradient(135deg,#fff7ed,#fffbeb)!important;color:#9a3412!important}
      #eapV218RecoveryPlan[data-eap-v235-boss-fail="true"] b,#eapV218RecoveryPlan[data-eap-v235-boss-fail="true"] .eap218-chip{color:#9a3412!important}
      #eapV218RecoveryPlan[data-eap-v235-boss-fail="true"] .eap218-chip{border-color:#fed7aa!important}
      @media(max-width:680px){
        #nextMissionBtn[data-eap-v235-label]{min-width:0!important;width:100%!important;max-width:none!important}
        #nextMissionBtn[data-eap-v235-label]::after{font-size:17px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function clear(labelButton) {
    if (!labelButton) return;
    delete labelButton.dataset.eapV235Label;
    labelButton.removeAttribute("data-eap-v235-label");
  }

  function renderFailedBoss(model) {
    const root = $("summaryScreen") && ($("summaryScreen").querySelector(".summary-card") || $("summaryScreen"));
    if (!root) return;

    let plan = $("eapV218RecoveryPlan");
    if (!plan) {
      plan = document.createElement("section");
      plan.id = "eapV218RecoveryPlan";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin",plan); else root.appendChild(plan);
    }

    const nextTotal = fullRoundSize(model.sessionId);
    const nextNeeded = Math.ceil((nextTotal * model.required) / 100);
    const signature = `${model.sessionId}|${model.correct}/${model.total}|${model.accuracy}|${model.required}|${nextTotal}`;
    if (plan.dataset.eapV235Signature !== signature) {
      plan.dataset.eapV235Signature = signature;
      plan.dataset.eapV235BossFail = "true";
      plan.className = "eap192-summary-box recovery";
      plan.innerHTML = `
        <b>แผนเรียนจากผล ${model.sessionId} รอบนี้</b>
        <div class="eap218-row"><b>Boss Recovery รอบถัดไป</b></div>
        <div class="eap218-row">ผลรอบนี้ได้ ${model.correct}/${model.total} ข้อ (${model.accuracy}%) ซึ่งยังต่ำกว่าเกณฑ์ ${model.required}% ของ ${model.sessionId}</div>
        <div class="eap218-row">รอบถัดไปจะกลับมาเป็น ${model.sessionId} รอบเต็ม ${nextTotal} ข้อ และต้องตอบถูกอย่างน้อย ${nextNeeded}/${nextTotal} ข้อเพื่อผ่าน</div>
        <div><span class="eap218-chip">Boss รอบเต็ม ${nextTotal} ข้อ</span><span class="eap218-chip">ทบทวน Weak Words</span><span class="eap218-chip">โจทย์บูรณาการ</span></div>`;
    }

    const next = $("nextMissionBtn");
    if (next) {
      const label = `เริ่ม ${model.sessionId} Recovery`;
      /* Keep the controller's semantic route: nextMission() remains the same Boss. */
      if (next.textContent !== label) next.textContent = label;
      next.dataset.eapV235Label = label;
      next.setAttribute("aria-label",label);
      next.title = `${model.sessionId} รอบเต็มผ่านที่ ${nextNeeded}/${nextTotal}`;
    }

    const replay = $("replayBtn");
    if (replay && replay.textContent !== `เล่น ${model.sessionId} อีกครั้ง`) {
      replay.textContent = `เล่น ${model.sessionId} อีกครั้ง`;
    }
  }

  function apply() {
    queued = false;
    addStyle();
    const model = summaryModel();
    const next = $("nextMissionBtn");
    if (!model || model.passed) {
      clear(next);
      const plan = $("eapV218RecoveryPlan");
      if (plan) delete plan.dataset.eapV235BossFail;
      return;
    }
    renderFailedBoss(model);
  }

  function requestApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  window.addEventListener("eap-core-run-finished", () => [0,100,300,700,1300].forEach((delay) => setTimeout(requestApply, delay)));
  document.addEventListener("click", () => [80,250,600].forEach((delay) => setTimeout(requestApply, delay)), true);
  [0,120,360,800,1600,2600].forEach((delay) => setTimeout(requestApply, delay));

  window.inspectEapV235 = () => ({ version:VERSION, model:summaryModel(), label:norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV235Label) });
  console.info("[EAP Word Quest] v235 Boss summary truth ready", { version:VERSION });
})();
