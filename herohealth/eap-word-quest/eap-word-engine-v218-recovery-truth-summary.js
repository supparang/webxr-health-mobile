/* =========================================================
   EAP Word Quest • Recovery Truth Summary
   File: /herohealth/eap-word-quest/eap-word-engine-v218-recovery-truth-summary.js
   Version: v2.1.8-RECOVERY-TRUTH-SUMMARY-122

   Purpose:
   - Show recovery advice from the latest result of the same Session.
   - Remove stale global "challenge mode" summaries after a low score.
   - Preserve the existing Core controller, scoring, gate, XP and logging.
   - Ensure Replay/Continue supplies the intended Session id before v209
     selects the next round, so recovery selection cannot inherit another
     Session's difficulty.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.1.8-RECOVERY-TRUTH-SUMMARY-122";
  if (window.__EAP_WORD_V218_RECOVERY_TRUTH__) return;
  window.__EAP_WORD_V218_RECOVERY_TRUTH__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const esc = (value) => norm(value).replace(/[&<>"']/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  const isSessionId = (value) => /^(S(?:1[0-5]|[1-9])|BG[1-5])$/i.test(norm(value));

  function currentResult() {
    return window.EAP_V203_LAST_RESULT ||
      window.EAP_V196_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      window.EAP_V192_LAST_RESULT ||
      null;
  }

  function summaryRoot() {
    const screen = $("summaryScreen");
    return screen && screen.classList.contains("active")
      ? screen.querySelector(".summary-card") || screen
      : null;
  }

  function addStyle() {
    if ($("eapV218Style")) return;
    const style = document.createElement("style");
    style.id = "eapV218Style";
    style.textContent = `
      /* Older global coaches can contradict the latest Session result. */
      #eapV195Summary,#eapV195SummaryBox,#eapV198SummaryGuide{display:none!important}
      #eapV218RecoveryPlan{margin:12px 0;border:1px solid #bfdbfe;border-radius:18px;padding:14px 16px;background:linear-gradient(135deg,#eff6ff,#f8fafc);color:#1e3a8a;line-height:1.48;font-weight:800}
      #eapV218RecoveryPlan b{font-weight:1000;color:#1d4ed8}
      #eapV218RecoveryPlan .eap218-row{margin-top:7px}
      #eapV218RecoveryPlan .eap218-chip{display:inline-flex;align-items:center;border:1px solid #bfdbfe;background:#fff;border-radius:999px;padding:5px 9px;margin:8px 6px 0 0;font-size:12px;font-weight:950;color:#1d4ed8}
      #eapV218RecoveryPlan.recovery{border-color:#fed7aa;background:linear-gradient(135deg,#fff7ed,#fffbeb);color:#9a3412}
      #eapV218RecoveryPlan.recovery b,#eapV218RecoveryPlan.recovery .eap218-chip{color:#9a3412}
      #eapV218RecoveryPlan.recovery .eap218-chip{border-color:#fed7aa}
      @media(max-width:680px){#eapV218RecoveryPlan{padding:14px;border-radius:18px;font-size:14px}}
    `;
    document.head.appendChild(style);
  }

  function nextPlan(result) {
    const accuracy = Math.max(0, Math.min(100, Math.round(Number(result && result.accuracy) || 0)));
    const isBoss = /^BG/i.test(norm(result && result.sessionId));
    if (isBoss) {
      return accuracy >= 70
        ? { kind:"ready", title:"ผ่าน Boss แล้ว", detail:"ไป Arc ถัดไปได้ และทบทวน Weak Words เฉพาะเมื่ออยากเพิ่มความแม่น", chips:["ผ่านเกณฑ์","ไป Arc ถัดไป"] }
        : { kind:"recovery", title:"Boss Recovery รอบถัดไป", detail:"เริ่มด้วยคำทบทวนจากสาม Session ก่อน แล้วค่อยกลับไปโจทย์บูรณาการ", chips:["ทบทวน 7","บูรณาการ 8","ท้าทาย 3"] };
    }
    if (accuracy < 45) {
      return { kind:"recovery", title:"Recovery รอบถัดไป • A2+ Foundation", detail:"ผลรอบนี้บอกว่ายังไม่ควรเจอโจทย์ Challenge เพิ่ม ระบบจะเริ่มจากคำ/วลีพื้นฐานและบริบทสั้นก่อน", chips:["Warm-up 8","Core 4","Challenge 0"] };
    }
    if (accuracy < 60) {
      return { kind:"recovery", title:"Recovery รอบถัดไป • A2+ → B1", detail:"ทบทวนคำหลักและใช้บริบทก่อน แล้วค่อยเพิ่มโจทย์ประยุกต์ทีละข้อ", chips:["Warm-up 6","Core 5","Challenge 1"] };
    }
    if (accuracy < 75) {
      return { kind:"ready", title:"รอบถัดไป • B1 Context", detail:"ผ่านเกณฑ์แล้ว รอบถัดไปยังเน้นบริบทจริงเป็นหลัก ไม่เร่งความยากเกินไป", chips:["Warm-up 4","Core 6","Challenge 2"] };
    }
    return { kind:"ready", title:"รอบถัดไป • B1 + Challenge", detail:"พร้อมเพิ่มโจทย์ประยุกต์เล็กน้อย โดยยังรักษาแกนคำศัพท์และบริบทของ Session นี้", chips:["Warm-up 3","Core 6","Challenge 3"] };
  }

  function renderSummary() {
    addStyle();
    const root = summaryRoot();
    const result = currentResult();
    if (!root || !result || !isSessionId(result.sessionId)) return;

    const plan = nextPlan(result);
    let box = $("eapV218RecoveryPlan");
    if (!box) {
      box = document.createElement("section");
      box.id = "eapV218RecoveryPlan";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin", box);
      else root.appendChild(box);
    }

    const signature = [result.sessionId, result.accuracy, result.correct, result.total, plan.title, plan.detail].join("|");
    if (box.dataset.eapV218Signature === signature) return;
    box.dataset.eapV218Signature = signature;
    box.className = `eap192-summary-box ${plan.kind}`;
    box.innerHTML = `
      <b>แผนเรียนจากผลของ ${esc(result.sessionId)} รอบนี้</b>
      <div class="eap218-row"><b>${esc(plan.title)}</b></div>
      <div class="eap218-row">ได้ ${esc(result.correct)}/${esc(result.total)} ข้อ (${esc(result.accuracy)}%) • ${esc(plan.detail)}</div>
      <div>${plan.chips.map((chip) => `<span class="eap218-chip">${esc(chip)}</span>`).join("")}</div>`;
  }

  function setUpcomingSession(sessionId) {
    const sid = norm(sessionId).toUpperCase();
    if (!isSessionId(sid)) return;
    if (document.body && document.body.dataset) document.body.dataset.sessionId = sid;
    const game = $("gameScreen");
    if (game && game.dataset) game.dataset.sessionId = sid;
  }

  function prepareReplay(event) {
    const target = event.target && event.target.closest ? event.target.closest("button") : null;
    if (!target) return;
    const id = target.id || "";
    const result = currentResult();

    if (id === "replayBtn" || id === "nextMissionBtn") {
      const sid = norm(result && result.sessionId).toUpperCase();
      if (isSessionId(sid) && !result.passed) setUpcomingSession(sid);
    }

    const direct = norm(target.dataset && target.dataset.startSession).toUpperCase();
    if (isSessionId(direct)) setUpcomingSession(direct);
  }

  document.addEventListener("click", (event) => {
    prepareReplay(event);
    [120, 420, 850].forEach((delay) => setTimeout(renderSummary, delay));
  }, true);
  window.addEventListener("eap-core-run-finished", () => [80, 280, 700].forEach((delay) => setTimeout(renderSummary, delay)));
  [250, 800, 1500].forEach((delay) => setTimeout(renderSummary, delay));

  window.inspectEapV218 = () => {
    const result = currentResult();
    return {
      version: VERSION,
      result: result ? { sessionId:result.sessionId, accuracy:result.accuracy, passed:result.passed } : null,
      nextPlan: result ? nextPlan(result) : null,
      summaryVisible: Boolean(summaryRoot())
    };
  };

  console.info("[EAP Word Quest] v218 recovery-truth summary ready", { version:VERSION });
})();
