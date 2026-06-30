/* =========================================================
   EAP Word Quest • Home Completion Report
   File: /herohealth/eap-word-quest/eap-word-engine-v239-home-completion-report.js
   Version: v2.3.9-HOME-COMPLETION-REPORT-122

   When all 20 Vocabulary Arc gates are complete, the old Core behaviour for
   the Home CTA was startNext() -> toast("ครบทุกด่านแล้ว") -> goHome().
   Because the learner is already on Home, the visible “ดูสรุปความก้าวหน้า”
   button looked like it did nothing.

   This Home-only layer turns that completed CTA into a real final learning
   report. It does not modify scores, pass state, gates, logs, item banks, or
   teacher data.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.3.9-HOME-COMPLETION-REPORT-122";
  const TOTAL = 20;
  const GROUP = "122";

  if (window.__EAP_WORD_V239_HOME_COMPLETION__) return;
  window.__EAP_WORD_V239_HOME_COMPLETION__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const escapeHtml = (value) => norm(value).replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  let queued = false;

  function onHome() {
    const screen = $("homeScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function progress() {
    try {
      return typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null;
    } catch (err) {
      return null;
    }
  }

  function completed() {
    const model = progress();
    return Boolean(model && String(model.next) === "DONE" && Number(model.passed) >= TOTAL);
  }

  function homeButton() {
    return $("eapV239CompletionBtn") || $("quickStartBtn");
  }

  function getHomeStats() {
    const root = $("homeStats");
    if (!root) return [];
    return Array.from(root.querySelectorAll(".stat")).map((card) => ({
      value: norm(card.querySelector("b") && card.querySelector("b").textContent),
      label: norm(card.querySelector("span") && card.querySelector("span").textContent)
    })).filter((item) => item.value || item.label);
  }

  function addStyle() {
    if ($("eapV239CompletionStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV239CompletionStyle";
    style.textContent = `
      #eapV239CompletionReport[hidden]{display:none!important}
      #eapV239CompletionReport{margin-top:14px;border:1px solid #86efac;border-radius:18px;padding:17px;background:linear-gradient(135deg,#ecfdf5,#eff6ff);color:#14532d;box-shadow:0 10px 26px rgba(22,101,52,.08)}
      #eapV239CompletionReport h3{margin:0 0 5px;color:#166534;font-size:22px;line-height:1.25}
      #eapV239CompletionReport p{margin:0;color:#166534;line-height:1.55;font-weight:750}
      #eapV239CompletionReport .eap239-top{display:flex;gap:12px;align-items:flex-start;justify-content:space-between}
      #eapV239CompletionReport .eap239-kicker{display:inline-flex;align-items:center;gap:6px;margin-bottom:5px;border:1px solid #86efac;border-radius:999px;padding:4px 8px;background:#fff;font-size:12px;font-weight:950;color:#166534}
      #eapV239CompletionReport .eap239-score{flex:0 0 auto;border:1px solid #86efac;border-radius:14px;background:#fff;padding:10px 13px;text-align:center;color:#166534;font-weight:950}
      #eapV239CompletionReport .eap239-score b{display:block;font-size:24px;line-height:1}
      #eapV239CompletionReport .eap239-score span{display:block;margin-top:4px;font-size:11px}
      #eapV239CompletionReport .eap239-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:9px;margin-top:13px}
      #eapV239CompletionReport .eap239-stat{border:1px solid #bbf7d0;border-radius:13px;background:#fff;padding:10px}
      #eapV239CompletionReport .eap239-stat b{display:block;font-size:19px;line-height:1.15;color:#166534}
      #eapV239CompletionReport .eap239-stat span{display:block;margin-top:4px;font-size:12px;line-height:1.3;color:#166534;font-weight:800}
      #eapV239CompletionReport .eap239-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}
      #eapV239CompletionReport .eap239-actions button{min-height:42px}
      #eapV239CompletionBtn{position:relative!important}
      @media(max-width:680px){
        #eapV239CompletionReport{padding:14px}
        #eapV239CompletionReport .eap239-top{display:block}
        #eapV239CompletionReport .eap239-score{display:inline-block;margin-top:10px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureReport() {
    const button = homeButton();
    if (!button) return null;
    let report = $("eapV239CompletionReport");
    if (report) return report;

    report = document.createElement("section");
    report.id = "eapV239CompletionReport";
    report.hidden = true;
    report.setAttribute("aria-live", "polite");
    report.setAttribute("tabindex", "-1");

    const controls = button.closest(".student-controls") || button.parentElement;
    if (controls) controls.insertAdjacentElement("afterend", report);
    else button.insertAdjacentElement("afterend", report);
    return report;
  }

  function renderReport() {
    const report = ensureReport();
    if (!report) return;
    const stats = getHomeStats();
    const model = progress() || {};
    const cards = stats.length
      ? stats.map((item) => `<div class="eap239-stat"><b>${escapeHtml(item.value)}</b><span>${escapeHtml(item.label)}</span></div>`).join("")
      : `<div class="eap239-stat"><b>${Number(model.passed) || TOTAL}/${TOTAL}</b><span>ความก้าวหน้าภารกิจ</span></div>`;

    report.innerHTML = `
      <div class="eap239-top">
        <div>
          <div class="eap239-kicker">🏆 ผ่านครบแล้ว • Group ${GROUP}</div>
          <h3>รายงานผลสำเร็จ EAP Word Quest</h3>
          <p>คุณผ่าน Vocabulary Arc ครบทั้ง ${TOTAL}/${TOTAL} ภารกิจ และผ่าน Vocabulary Boss ครบ 5/5 ด่านแล้ว รายงานนี้สรุปผลเพื่อใช้ทบทวนและติดตามการพัฒนาต่อจากนี้</p>
        </div>
        <div class="eap239-score"><b>${Number(model.passed) || TOTAL}/${TOTAL}</b><span>Mission Complete</span></div>
      </div>
      <div class="eap239-stats">${cards}</div>
      <div class="eap239-actions">
        <button class="btn primary-play" id="eapV239OpenDeck" type="button">เปิด Word Deck ทบทวน</button>
        <button class="btn secondary" id="eapV239CloseReport" type="button">ซ่อนรายงาน</button>
      </div>`;
  }

  function openReport() {
    if (!completed()) return;
    const report = ensureReport();
    if (!report) return;
    renderReport();
    report.hidden = false;
    setTimeout(() => report.scrollIntoView({ behavior:"smooth", block:"start" }), 20);
    setTimeout(() => report.focus({ preventScroll:true }), 120);
  }

  function closeReport() {
    const report = $("eapV239CompletionReport");
    if (report) report.hidden = true;
    const button = homeButton();
    if (button) button.focus({ preventScroll:true });
  }

  function switchButtonToReport() {
    const button = homeButton();
    if (!button || !completed()) return;
    if (button.id !== "eapV239CompletionBtn") button.id = "eapV239CompletionBtn";
    button.disabled = false;
    button.textContent = "ดูรายงานผลสำเร็จ";
    button.title = "ดูรายงานสรุปหลังผ่าน EAP Word Quest ครบ 20/20";
    button.setAttribute("aria-label", "ดูรายงานผลสำเร็จ EAP Word Quest");
    button.dataset.eapV239Completion = "true";
    ensureReport();
  }

  function restoreNormalButton() {
    const button = $("eapV239CompletionBtn");
    if (!button) return;
    button.id = "quickStartBtn";
    delete button.dataset.eapV239Completion;
    const report = $("eapV239CompletionReport");
    if (report) report.hidden = true;
  }

  function apply() {
    queued = false;
    addStyle();
    if (!onHome()) return;
    if (completed()) switchButtonToReport();
    else restoreNormalButton();
  }

  function requestApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  document.addEventListener("click", (event) => {
    const target = event.target && event.target.closest ? event.target.closest("button,a") : null;
    if (!target) return;

    if (target.id === "eapV239CompletionBtn") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openReport();
      return;
    }

    if (target.id === "eapV239CloseReport") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeReport();
      return;
    }

    if (target.id === "eapV239OpenDeck") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const deck = $("wordDeckBtn");
      if (deck) deck.click();
    }
  }, true);

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  window.addEventListener("eap-core-run-finished", () => [0,150,500,1100].forEach((delay) => setTimeout(requestApply, delay)));
  document.addEventListener("click", () => [100,400,1000].forEach((delay) => setTimeout(requestApply, delay)), true);
  [0,120,360,900,1700,2800].forEach((delay) => setTimeout(requestApply, delay));

  window.inspectEapV239 = () => ({
    version: VERSION,
    onHome: onHome(),
    completed: completed(),
    progress: progress(),
    buttonId: homeButton() && homeButton().id,
    reportVisible: Boolean($("eapV239CompletionReport") && !$("eapV239CompletionReport").hidden)
  });

  console.info("[EAP Word Quest] v239 home completion report ready", { version:VERSION });
})();
