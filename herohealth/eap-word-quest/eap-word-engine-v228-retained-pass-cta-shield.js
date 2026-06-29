/* =========================================================
   EAP Word Quest • Retained Pass CTA Shield
   File: /herohealth/eap-word-quest/eap-word-engine-v228-retained-pass-cta-shield.js
   Version: v2.2.8-RETAINED-PASS-CTA-SHIELD-122

   When a learner replays an already-passed Session and scores lower, the
   current round remains visible for feedback, while the primary action stays
   on the earned learning path. This is visual/UI only; the Core controller
   still owns the actual click route through startNext().
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.8-RETAINED-PASS-CTA-SHIELD-122";
  if (window.__EAP_WORD_V228_RETAINED_CTA__) return;
  window.__EAP_WORD_V228_RETAINED_CTA__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  let queued = false;

  function activeSummarySession() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return "";
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+ฝึกเพิ่มอีกนิด/i);
    return match ? match[1].toUpperCase() : "";
  }

  function model() {
    const sessionId = activeSummarySession();
    if (!sessionId) return null;
    try {
      const progress = typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
      const key = progress && progress.stateKey;
      const raw = key ? localStorage.getItem(key) : "";
      const state = raw ? JSON.parse(raw) : {};
      const earned = Boolean(state && state.sessions && state.sessions[sessionId] && state.sessions[sessionId].passed);
      const next = norm(progress && progress.next);
      return earned && next && next !== sessionId && next !== "DONE" ? { sessionId, next } : null;
    } catch (err) {
      return null;
    }
  }

  function addStyle() {
    if ($("eapV228RetainedStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV228RetainedStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v228-label]{position:relative!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important;min-width:218px!important}
      #nextMissionBtn[data-eap-v228-label]::after{content:attr(data-eap-v228-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;line-height:1.15!important;font-weight:950!important;white-space:nowrap!important;pointer-events:none!important}
      #eapV228RetainedNote{margin:10px 0;border:1px solid #bbf7d0;background:#ecfdf5;color:#166534;border-radius:14px;padding:10px 12px;font-weight:850;line-height:1.45}
      @media(max-width:680px){#nextMissionBtn[data-eap-v228-label]{width:100%!important;min-width:0!important}#nextMissionBtn[data-eap-v228-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    addStyle();
    const nextButton = $("nextMissionBtn");
    if (!nextButton) return;
    const state = model();
    const root = $("summaryScreen") && $("summaryScreen").querySelector(".summary-card");

    if (!state) {
      delete nextButton.dataset.eapV228Label;
      nextButton.removeAttribute("data-eap-v228-label");
      const note = $("eapV228RetainedNote");
      if (note) note.remove();
      return;
    }

    const label = `ไปทำ ${state.next} ต่อ`;
    nextButton.dataset.eapV228Label = label;
    nextButton.setAttribute("aria-label",label);
    nextButton.title = `ไปยังภารกิจถัดไป ${state.next}`;

    let note = $("eapV228RetainedNote");
    if (!note && root) {
      note = document.createElement("div");
      note.id = "eapV228RetainedNote";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin",note);
      else root.appendChild(note);
    }
    if (note) note.textContent = `รอบล่าสุดยังมีจุดให้ทบทวน แต่ ${state.sessionId} ผ่านจากรอบก่อนแล้ว จึงไปทำ ${state.next} ต่อได้`;
  }

  function requestApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener("eap-core-run-finished",()=>[0,120,350,800].forEach((delay)=>setTimeout(requestApply,delay)));
  document.addEventListener("click",()=>[80,260,640].forEach((delay)=>setTimeout(requestApply,delay)),true);
  [100,400,900,1700,2800].forEach((delay)=>setTimeout(requestApply,delay));

  window.inspectEapV228 = () => ({ version:VERSION, model:model(), label:norm($("nextMissionBtn") && $("nextMissionBtn").dataset.eapV228Label) });
  console.info("[EAP Word Quest] v228 retained-pass CTA shield ready",{version:VERSION});
})();
