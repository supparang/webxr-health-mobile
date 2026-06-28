/* =========================================================
   EAP Word Quest • Summary Learning Language Polish
   File: /herohealth/eap-word-quest/eap-word-engine-v204-summary-language-polish.js
   Version: v2.0.4-SUMMARY-THAI-AI-WEAK-WORDS-122

   Student-facing polish only:
   - Translate Summary status into clear Thai.
   - Turn Core AI summary into Thai-first learning guidance.
   - Render Weak Words as readable chips, not a long text string.
   - Never creates additional summary/path cards.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.0.4-SUMMARY-THAI-AI-WEAK-WORDS-122";

  if (window.__EAP_WORD_V204_SUMMARY_LANGUAGE__) return;
  window.__EAP_WORD_V204_SUMMARY_LANGUAGE__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
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

  function predictionThai(value) {
    const text = norm(value);
    const map = {
      "Collecting evidence": "กำลังเก็บข้อมูลเพิ่มเพื่อปรับระดับคำถาม",
      "Ready for Challenge Mode": "พร้อมท้าทายระดับสูง (Challenge Mode)",
      "Ready for Main Mission": "พร้อมกลับไปทำ Main Mission",
      "Ready, but review recommended": "พร้อมระดับหนึ่ง แต่ควรทบทวนก่อน",
      "At Risk — replay with AI Help": "ควรฝึกเพิ่มด้วย AI Help ก่อน"
    };
    return map[text] || text || "กำลังประเมินความพร้อม";
  }

  function recommendationThai(value) {
    const text = norm(value);
    const map = {
      "Answer a few more items so AI can calibrate the next difficulty.": "ตอบเพิ่มอีกเล็กน้อย เพื่อให้ AI ปรับระดับคำถามได้แม่นขึ้น",
      "Try No-Hint Challenge for B1+ application tasks.": "ลอง Challenge แบบไม่ใช้ Hint เพื่อฝึกโจทย์ประยุกต์ระดับ B1+",
      "Continue to the Main Mission, then replay only weak targets.": "ไปทำ Main Mission ได้ แล้วค่อยกลับมาฝึกเฉพาะคำที่ยังไม่แม่น",
      "Review feedback and replay this Session with context questions.": "อ่าน feedback แล้วเล่นซ้ำ โดยเน้นการใช้คำจากบริบท",
      "Use AI Help, review weak targets, then replay before the Boss Gate.": "ใช้ AI Help ทบทวนคำที่พลาด แล้วเล่นซ้ำก่อนเข้าสู่ Boss Gate"
    };
    return map[text] || text || "อ่าน feedback และเลือกฝึกคำที่ยังไม่แม่น";
  }

  function injectStyle() {
    if ($("eapV204SummaryStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV204SummaryStyle";
    style.textContent = `
      #eapV195Summary .eap204-title{font-weight:1000;font-size:16px;margin-bottom:4px}
      #eapV195Summary .eap204-line{margin-top:4px}
      #eapV195Summary .eap204-weak{margin-top:8px;color:#7c2d12;font-size:13px;font-weight:850}
      #summaryWeakWords.eap204-words{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start}
      #summaryWeakWords .eap204-word{display:inline-flex;align-items:center;max-width:100%;border:1px solid #fdba74;background:#fff7ed;color:#9a3412;border-radius:999px;padding:6px 10px;line-height:1.25;font-size:13px;font-weight:900;overflow-wrap:anywhere}
      #summaryWeakWords .eap204-word-note{flex-basis:100%;color:#64748b;font-size:13px;font-weight:750;line-height:1.4}
      .eap204-status-pass{color:#047857!important}.eap204-status-replay{color:#c2410c!important;font-size:15px!important}
    `;
    document.head.appendChild(style);
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
    value.classList.toggle("eap204-status-pass", passed);
    value.classList.toggle("eap204-status-replay", !passed);
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
      ? `${terms.map((term) => `<span class="eap204-word">${esc(term)}</span>`).join("")}<span class="eap204-word-note">คำเหล่านี้คือเป้าหมายสำหรับฝึกซ้ำ ไม่ใช่คะแนนติดลบ</span>`
      : `<span class="eap204-word-note">รอบนี้ยังไม่มีคำที่ระบบจัดเป็น Weak Word</span>`;
    if (box.innerHTML !== html) box.innerHTML = html;
    box.classList.add("eap204-words");
  }

  function localizeAiSummary(root, run) {
    const box = $("eapV195Summary");
    if (!box || !root.contains(box)) return;

    let ai = null;
    try {
      ai = typeof window.getEapCoreAiState === "function" ? window.getEapCoreAiState() : null;
    } catch (err) {
      ai = null;
    }

    const difficulty = norm(ai && ai.difficulty) || norm(run && run.aiDifficulty) || "A2+";
    const prediction = predictionThai(ai && ai.prediction || run && run.aiPrediction);
    const recommendation = recommendationThai(ai && ai.recommendation);
    const weak = weakTerms(run);
    const html = `
      <div class="eap204-title">AI Learning Coach</div>
      <div class="eap204-line"><b>ระดับคำถาม:</b> ${esc(difficulty)} • <b>ความพร้อม:</b> ${esc(prediction)}</div>
      <div class="eap204-line"><b>คำแนะนำ:</b> ${esc(recommendation)}</div>
      ${weak.length ? `<div class="eap204-weak"><b>คำที่ควรทบทวน:</b> ${weak.map(esc).join(" • ")}</div>` : ""}
    `;
    if (box.innerHTML !== html) box.innerHTML = html;
  }

  function render() {
    const root = summaryRoot();
    const run = result();
    if (!root || !run) return;
    localizeStatus(root, run);
    localizeWeakWords(root, run);
    localizeAiSummary(root, run);
  }

  function observeSummary() {
    const observer = new MutationObserver(() => requestAnimationFrame(render));
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    window.EAP_V204_SUMMARY_OBSERVER = observer;
  }

  injectStyle();
  observeSummary();
  [0,150,500,1000].forEach((delay) => setTimeout(render, delay));

  window.inspectEapV204 = () => ({
    version: VERSION,
    summaryVisible: Boolean(summaryRoot()),
    weakWordChips: document.querySelectorAll("#summaryWeakWords .eap204-word").length,
    thaiAiReady: Boolean($("eapV195Summary") && /AI Learning Coach/.test($("eapV195Summary").textContent))
  });

  console.info("[EAP Word Quest] v204 summary language polish ready", { version:VERSION });
})();
