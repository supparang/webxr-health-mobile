/* =========================================================
   EAP Word Quest • Summary Learning Language Polish
   File: /herohealth/eap-word-quest/eap-word-engine-v204-summary-language-polish.js
   Version: v2.0.5-SUMMARY-TRUTH-HEADER-CLEAN-122

   Student-facing polish only:
   - Translate Summary status into clear Thai.
   - Make AI Coach reflect the current run, not historical aggregate state.
   - Render Weak Words as readable chips.
   - Remove runtime/debug version badges from Student Mode.
   - Never creates additional summary/path cards.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.0.5-SUMMARY-TRUTH-HEADER-CLEAN-122";

  if (window.__EAP_WORD_V205_SUMMARY_TRUTH__) return;
  window.__EAP_WORD_V205_SUMMARY_TRUTH__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const esc = (value) => norm(value).replace(/[&<>'"]/g, (ch) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", "\"":"&quot;"
  }[ch]));

  function result() {
    return window.EAP_V203_LAST_RESULT ||
      window.EAP_V202_LAST_RESULT ||
      window.EAP_V196_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      null;
  }

  function summaryRoot() {
    const screen = $("summaryScreen");
    return screen && screen.classList.contains("active")
      ? screen.querySelector(".summary-card") || screen
      : null;
  }

  function passThreshold(run) {
    const sessionId = norm(run && run.sessionId);
    if (sessionId === "BG5") return 75;
    return /^BG[1-5]$/i.test(sessionId) ? 70 : 60;
  }

  function injectStyle() {
    if ($("eapV205SummaryStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV205SummaryStyle";
    style.textContent = `
      #eapV195Summary .eap205-title{font-weight:1000;font-size:16px;margin-bottom:4px}
      #eapV195Summary .eap205-line{margin-top:5px}
      #eapV195Summary .eap205-weak{margin-top:8px;color:#7c2d12;font-size:13px;font-weight:850}
      #summaryWeakWords.eap205-words{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
      #summaryWeakWords .eap205-word{display:inline-flex;align-items:center;max-width:100%;border:1px solid #fdba74;background:#fff7ed;color:#9a3412;border-radius:999px;padding:6px 10px;line-height:1.25;font-size:13px;font-weight:900;overflow-wrap:anywhere}
      #summaryWeakWords .eap205-word-note{flex-basis:100%;color:#64748b;font-size:13px;font-weight:750;line-height:1.4}
      .eap205-status-pass{color:#047857!important}.eap205-status-replay{color:#c2410c!important;font-size:15px!important}
      .topbar-right .eap192-core-badge,.topbar-right [data-eap-debug-badge="true"]{display:none!important}
      body.eap205-header-clean .topbar > div:first-child > .subtitle{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function cleanStudentHeader() {
    document.body.classList.add("eap205-header-clean");
    const top = document.querySelector(".topbar-right");
    if (!top) return;
    Array.from(top.querySelectorAll("span,div")).forEach((node) => {
      const text = norm(node.textContent);
      if (/^Core AI v\d+/i.test(text) || /^Core v\d+/i.test(text) || /^Core Bank v\d+/i.test(text)) {
        node.dataset.eapDebugBadge = "true";
        node.remove();
      }
    });
  }

  function findStat(root, label) {
    const wanted = norm(label).toLowerCase();
    return Array.from(root.querySelectorAll(".stat,.summary-stat,.mini")).find((card) =>
      norm(card.textContent).toLowerCase().includes(wanted)
    ) || null;
  }

  function localizeStatus(root, run) {
    const card = findStat(root, "status");
    if (!card) return;
    const value = card.querySelector("b,strong,.value") || card.firstElementChild;
    if (!value) return;
    const passed = Boolean(run && run.passed);
    value.textContent = passed ? "ผ่านแล้ว" : "ฝึกเพิ่มอีกนิด";
    value.classList.toggle("eap205-status-pass", passed);
    value.classList.toggle("eap205-status-replay", !passed);
    value.title = passed ? "ผ่านเกณฑ์ของ Session นี้แล้ว" : "รอบนี้ยังไม่ผ่านเกณฑ์ แต่สามารถฝึกซ้ำได้";
  }

  function weakTerms(run) {
    const values = Array.isArray(run && run.weakWords) ? run.weakWords : [];
    const seen = new Set();
    return values.map(norm).filter((term) => {
      const key = term.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  }

  function localizeWeakWords(root, run) {
    const box = $("summaryWeakWords");
    if (!box || !root.contains(box)) return;
    const terms = weakTerms(run);
    const html = terms.length
      ? `${terms.map((term) => `<span class="eap205-word">${esc(term)}</span>`).join("")}<span class="eap205-word-note">คำเหล่านี้คือเป้าหมายสำหรับฝึกซ้ำ ไม่ใช่คะแนนติดลบ</span>`
      : `<span class="eap205-word-note">รอบนี้ยังไม่มีคำที่ระบบจัดเป็น Weak Word</span>`;
    if (box.innerHTML !== html) box.innerHTML = html;
    box.classList.add("eap205-words");
  }

  function currentRunGuidance(run) {
    const accuracy = Math.max(0, Math.min(100, Math.round(num(run && run.accuracy))));
    const threshold = passThreshold(run);
    const passed = Boolean(run && run.passed);
    const level = norm(run && (run.aiDifficulty || run.difficulty)) || "Mixed A2–B1+";

    if (!passed && accuracy < threshold) {
      return {
        level,
        status: `รอบนี้ยังไม่ผ่านเกณฑ์ ${threshold}%`,
        advice: "ใช้ AI Help ทบทวน Weak Words แล้วเล่นซ้ำ โดยอ่านบริบทก่อนเลือกคำตอบ"
      };
    }
    if (accuracy >= 90) {
      return {
        level,
        status: "ผ่านรอบนี้อย่างแข็งแรง พร้อมลอง Challenge Mode",
        advice: "เล่น Challenge ได้ แต่ควรเก็บ Weak Words ไว้ทบทวนก่อนเข้าสู่ Boss Gate"
      };
    }
    if (passed) {
      return {
        level,
        status: "ผ่านเกณฑ์ของรอบนี้แล้ว",
        advice: "ไปทำภารกิจถัดไปได้ และกลับมาฝึกเฉพาะ Weak Words เมื่อมีเวลา"
      };
    }
    return {
      level,
      status: "ยังควรเก็บข้อมูลเพิ่ม",
      advice: "ตอบเพิ่มและใช้ feedback เพื่อให้ AI ปรับระดับได้แม่นขึ้น"
    };
  }

  function localizeAiSummary(root, run) {
    const box = $("eapV195Summary");
    if (!box || !root.contains(box)) return;

    const guide = currentRunGuidance(run);
    const weak = weakTerms(run);
    const html = `
      <div class="eap205-title">AI Learning Coach</div>
      <div class="eap205-line"><b>ระดับโจทย์รอบนี้:</b> ${esc(guide.level)}</div>
      <div class="eap205-line"><b>ผลการเรียนรอบนี้:</b> ${esc(guide.status)}</div>
      <div class="eap205-line"><b>คำแนะนำ:</b> ${esc(guide.advice)}</div>
      ${weak.length ? `<div class="eap205-weak"><b>คำที่ควรทบทวน:</b> ${weak.map(esc).join(" • ")}</div>` : ""}
    `;
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function translateRewardChips(root, run) {
    const reward = root.querySelector("#eapV203RewardBox,#eapV202RewardBox,#eapV199RewardBox");
    if (!reward) return;
    Array.from(reward.querySelectorAll("span")).forEach((chip) => {
      const text = norm(chip.textContent);
      if (/^Base\s+/i.test(text)) chip.textContent = text.replace(/^Base/i, "คะแนนฐาน");
      if (/^Pass\s+–/i.test(text)) chip.textContent = "รอบนี้ยังไม่ผ่าน";
      if (/^Pass\s+✓/i.test(text)) chip.textContent = "ผ่านเกณฑ์ ✓";
      if (/^Max Combo\s+/i.test(text)) chip.textContent = text.replace(/^Max Combo/i, "คอมโบสูงสุด");
    });
  }

  function render() {
    cleanStudentHeader();
    const root = summaryRoot();
    const run = result();
    if (!root || !run) return;
    localizeStatus(root, run);
    localizeWeakWords(root, run);
    localizeAiSummary(root, run);
    translateRewardChips(root, run);
  }

  function observeSummary() {
    const observer = new MutationObserver(() => requestAnimationFrame(render));
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    window.EAP_V205_SUMMARY_OBSERVER = observer;
  }

  injectStyle();
  observeSummary();
  [0,150,500,1000].forEach((delay) => setTimeout(render, delay));
  setInterval(cleanStudentHeader, 1200);

  window.inspectEapV205 = () => ({
    version: VERSION,
    summaryVisible: Boolean(summaryRoot()),
    weakWordChips: document.querySelectorAll("#summaryWeakWords .eap205-word").length,
    currentRunAccuracy: num(result() && result().accuracy),
    debugBadges: Array.from(document.querySelectorAll(".topbar-right *")).filter((node) => /^Core AI v\d+/i.test(norm(node.textContent))).length,
    thaiAiReady: Boolean($("eapV195Summary") && /ผลการเรียนรอบนี้/.test($("eapV195Summary").textContent))
  });

  console.info("[EAP Word Quest] v205 current-run AI summary + header clean ready", { version:VERSION });
})();
