/* =========================================================
   EAP Word Quest • Final Learner Safety Guard + Weak Recovery
   File: /herohealth/eap-word-quest/eap-word-engine-v215-release-guard-weak-recovery.js
   Version: v2.1.5-RELEASE-GUARD-WEAK-RECOVERY-122

   Final student release safeguards:
   - Hides the internal Target: answer tag before students answer.
   - Localises visible question tags and internal start toasts.
   - Adds a direct "ฝึกคำที่พลาด" action on summaries with Weak Words.
   - Runs a non-destructive full-bank preflight audit across S1–S15/BG1–BG5.
   - Does not change scoring, answer order, gates, item selection, AI rules,
     stored progress or teacher logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.1.5-RELEASE-GUARD-WEAK-RECOVERY-122";

  if (window.__EAP_WORD_V215_RELEASE_GUARD__) return;
  window.__EAP_WORD_V215_RELEASE_GUARD__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const key = (value) => norm(value).toLowerCase().replace(/[’']/g, "");

  function currentResult() {
    return window.EAP_V203_LAST_RESULT ||
      window.EAP_V202_LAST_RESULT ||
      window.EAP_V196_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      window.EAP_V192_LAST_RESULT ||
      null;
  }

  function gameActive() {
    const screen = $("gameScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function summaryActive() {
    const screen = $("summaryScreen");
    return Boolean(screen && screen.classList.contains("active"));
  }

  function addStyle() {
    if ($("eapV215ReleaseGuardStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV215ReleaseGuardStyle";
    style.textContent = `
      #questionTags .eap215-tag{display:inline-flex;align-items:center;border:1px solid #dbeafe;background:#f8fafc;color:#475569;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900}
      #summaryWeakPracticeBtn{border-color:#fed7aa!important;background:#fff7ed!important;color:#9a3412!important}
      #summaryWeakPracticeBtn:hover:not(:disabled){background:#ffedd5!important;border-color:#fdba74!important}
      @media(max-width:680px){#summaryWeakPracticeBtn{font-size:16px!important}.eap215-tag{font-size:11px!important}}
    `;
    document.head.appendChild(style);
  }

  function localizeQuestionTags() {
    if (!gameActive()) return;
    const root = $("questionTags");
    if (!root) return;

    const typeMap = {
      definition:"ความหมาย",
      context:"ใช้บริบท",
      application:"สถานการณ์",
      repair:"เลือกให้เหมาะ",
      boss:"Boss Challenge",
      "boss-recovery":"Boss Warm-up"
    };

    Array.from(root.querySelectorAll("span")).forEach((tag, index) => {
      const raw = norm(tag.dataset.eapV215Raw || tag.textContent);
      tag.dataset.eapV215Raw = raw;
      if (/^Target\s*:/i.test(raw) || /^Mission target\s*:/i.test(raw)) {
        tag.remove();
        return;
      }
      if (index === 2 || /^(core|chunk|stretch|spiral|director-rest)$/i.test(raw)) {
        tag.remove();
        return;
      }
      if (/^(A2\+?|B1\+?)$/i.test(raw)) {
        tag.textContent = `ระดับ ${raw}`;
      } else if (typeMap[key(raw)]) {
        tag.textContent = typeMap[key(raw)];
      }
      tag.classList.add("eap215-tag");
    });
  }

  function localizeToast() {
    const toast = $("toast");
    if (!toast || toast.hidden) return;
    const text = norm(toast.textContent);
    const start = text.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+Core Bank started$/i);
    if (start) toast.textContent = `เริ่ม ${start[1].toUpperCase()} แล้ว • อ่านบริบทก่อนเลือกคำตอบ`;
    if (/^Core v195 progress reset$/i.test(text)) toast.textContent = "เริ่มความก้าวหน้าใหม่แล้ว";
  }

  function ensureWeakRecoveryButton() {
    if (!summaryActive()) return;
    const actions = document.querySelector("#summaryScreen .summary-actions");
    const run = currentResult();
    if (!actions || !run) return;

    let button = $("summaryWeakPracticeBtn");
    if (!button) {
      button = document.createElement("button");
      button.id = "summaryWeakPracticeBtn";
      button.type = "button";
      button.className = "btn secondary";
      button.textContent = "ฝึกคำที่พลาด";
      const deck = $("summaryDeckBtn");
      if (deck) deck.insertAdjacentElement("beforebegin", button);
      else actions.appendChild(button);
    }

    const weak = Array.isArray(run.weakWords) ? run.weakWords.filter(Boolean) : [];
    button.hidden = weak.length === 0;
    button.disabled = weak.length === 0;
    button.title = weak.length
      ? `ฝึกซ้ำเฉพาะคำที่พลาดใน ${run.sessionId}`
      : "รอบนี้ไม่มีคำที่ต้องทบทวน";
  }

  function startWeakRecovery() {
    const run = currentResult();
    const sid = norm(run && run.sessionId).toUpperCase();
    if (!/^(S(?:1[0-5]|[1-9])|BG[1-5])$/.test(sid)) return;
    if (document.body && document.body.dataset) document.body.dataset.sessionId = sid;
    const game = $("gameScreen");
    if (game && game.dataset) game.dataset.sessionId = sid;
    if (typeof window.startEapCoreSession === "function") {
      window.startEapCoreSession(sid, "weak");
    }
  }

  function choiceIssue(item) {
    const issues = [];
    const choices = Array.isArray(item && item.choices) ? item.choices : [];
    const correct = choices.filter((choice) => choice && choice.correct);
    if (choices.length !== 4) issues.push("choices_not_four");
    if (correct.length !== 1) issues.push("correct_count_not_one");
    const seen = new Set();
    choices.forEach((choice) => {
      const itemKey = key(choice && choice.text);
      if (!itemKey || seen.has(itemKey)) issues.push("duplicate_or_blank_choice");
      seen.add(itemKey);
    });
    if (!norm(item && item.target) || !norm(item && item.answerTerm)) issues.push("missing_target_or_answer");
    const stem = `${norm(item && item.question)} ${norm(item && item.context)}`;
    if (/\b(answer|correct answer)\s*:/i.test(stem)) issues.push("answer_leak_text");
    return issues;
  }

  function runPreflight() {
    const bank = window.EAP_CORE_QUESTION_BANK;
    const order = bank && Array.isArray(bank.sessionOrder) ? bank.sessionOrder.slice() : [];
    const report = {
      version:VERSION,
      ready:Boolean(bank && order.length === 20),
      sessionCount:order.length,
      itemTotal:bank && Number(bank.itemTotal) || 0,
      sessions:{},
      issues:[],
      checkedAt:new Date().toISOString()
    };

    if (!bank || !order.length) {
      report.issues.push("missing_core_bank_or_session_order");
      return report;
    }

    order.forEach((sessionId) => {
      const rows = Array.isArray(bank.bySession && bank.bySession[sessionId]) ? bank.bySession[sessionId] : [];
      const issues = rows.flatMap((item) => choiceIssue(item).map((issue) => `${item.id}:${issue}`));

      if (/^BG[1-5]$/i.test(sessionId) && typeof window.getEapCoreBoss === "function") {
        const boss = window.getEapCoreBoss(sessionId) || {};
        const allowed = new Set(Array.isArray(boss.sourceSessions) ? boss.sourceSessions : []);
        rows.forEach((item) => {
          if (item.sourceSessionId && allowed.size && !allowed.has(item.sourceSessionId)) {
            issues.push(`${item.id}:boss_source_outside_arc`);
          }
        });
      }

      report.sessions[sessionId] = { items:rows.length, issues };
      report.issues.push(...issues);
    });
    report.ready = report.ready && report.issues.length === 0;
    return report;
  }

  function patch() {
    addStyle();
    localizeQuestionTags();
    localizeToast();
    ensureWeakRecoveryButton();
  }

  document.addEventListener("click", (event) => {
    const button = event.target && event.target.closest ? event.target.closest("#summaryWeakPracticeBtn") : null;
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      startWeakRecovery();
      return;
    }
    [60,180,460].forEach((delay) => setTimeout(patch, delay));
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(patch));
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });

  addStyle();
  [0,100,350,900,1500].forEach((delay) => setTimeout(patch, delay));
  setTimeout(() => {
    const preflight = runPreflight();
    window.EAP_WORD_RELEASE_PREFLIGHT = preflight;
    if (preflight.ready) console.info("[EAP Word Quest] Release preflight passed", preflight);
    else console.warn("[EAP Word Quest] Release preflight needs review", preflight);
  }, 1700);

  window.inspectEapReleaseQA = () => window.EAP_WORD_RELEASE_PREFLIGHT || runPreflight();
  window.inspectEapV215 = () => ({
    version:VERSION,
    gameActive:gameActive(),
    summaryActive:summaryActive(),
    targetLeakVisible:Array.from(document.querySelectorAll("#questionTags span")).some((node) => /^Target\s*:/i.test(norm(node.textContent))),
    weakRecoveryVisible:Boolean($("summaryWeakPracticeBtn") && !$("summaryWeakPracticeBtn").hidden),
    preflight:window.EAP_WORD_RELEASE_PREFLIGHT || null
  });

  console.info("[EAP Word Quest] v215 release guard + weak recovery ready", { version:VERSION });
})();
