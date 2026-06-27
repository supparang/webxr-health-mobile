/* =========================================================
   CSAI2102 AI Quest
   S1 AR Visible Entry
   File: /ai-quest/js/aiquest-s1-ar-entry-v374.js
   Version: v3.7.4-s1-ar-visible-entry
========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.7.4-s1-ar-visible-entry";
  const ENTRY_ID = "s1ArVisibleEntryV374";
  const $ = (id) => document.getElementById(id);

  function isNormalS1() {
    const query = new URLSearchParams(location.search);
    const session = String(query.get("session") || "").toLowerCase();
    const ar = String(query.get("ar") || "").toLowerCase();
    return (session === "s1" || session === "m1") && !ar;
  }

  function getSavedResult() {
    const keys = [
      "AIQUEST_S1_AR_RESULT_V368",
      "AIQUEST_S1_AR_RESULT_V366",
      "AIQUEST_S1_AR_RESULT_V365B",
      "AIQUEST_S1_AR_PRACTICE_RESULT_V365"
    ];
    for (const key of keys) {
      try {
        const item = JSON.parse(localStorage.getItem(key) || "null");
        if (item && item.arCompleted) return item;
      } catch (_) {}
    }
    return null;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[ch]));
  }

  function injectStyle() {
    if ($("s1ArVisibleEntryStyleV374")) return;
    const style = document.createElement("style");
    style.id = "s1ArVisibleEntryStyleV374";
    style.textContent = `
      #${ENTRY_ID}{
        margin:12px 0 16px;padding:14px 16px;border-radius:18px;
        border:1px solid rgba(34,211,238,.36);
        background:linear-gradient(135deg,rgba(8,47,73,.82),rgba(15,23,42,.94));
        box-shadow:0 12px 30px rgba(2,6,23,.18);
        display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap
      }
      #${ENTRY_ID} .s1ar-copy{min-width:0}
      #${ENTRY_ID} .s1ar-kicker{font-size:12px;font-weight:900;color:#a5f3fc;letter-spacing:.04em}
      #${ENTRY_ID} .s1ar-title{margin-top:3px;font-size:18px;font-weight:900;color:#f8fafc}
      #${ENTRY_ID} .s1ar-note{margin-top:4px;font-size:13px;line-height:1.42;color:#cbd5e1}
      #${ENTRY_ID} .s1ar-status{margin-top:7px;font-size:12px;font-weight:800;color:#bbf7d0}
      #${ENTRY_ID} .s1ar-go{
        border:0;border-radius:13px;padding:12px 15px;cursor:pointer;white-space:nowrap;
        color:#082f49;background:linear-gradient(135deg,#67e8f9,#86efac);
        font:900 14px system-ui;box-shadow:0 8px 20px rgba(34,211,238,.20)
      }
      #${ENTRY_ID} .s1ar-go:hover{filter:brightness(1.06);transform:translateY(-1px)}
      @media(max-width:620px){
        #${ENTRY_ID}{align-items:stretch}
        #${ENTRY_ID} .s1ar-go{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function findAnchor() {
    const headings = [...document.querySelectorAll("h1,h2,h3")];
    const heading = headings.find((node) => /AI Awakening|1:\s*AI/i.test(node.textContent || ""));
    if (!heading) return null;
    return heading.closest(".mission-panel,.session-panel,.game-panel,.card,section,main,div") || heading.parentElement;
  }

  function launchAr() {
    const current = new URL(location.href);
    const target = new URL("index.html", location.href);
    target.searchParams.set("session", "s1");
    target.searchParams.set("ar", "hand");
    target.searchParams.set("from", "s1");
    target.searchParams.set("v", "20260627-s1ar-entry374");

    try {
      sessionStorage.setItem("AIQUEST_S1_AR_RETURN", current.pathname + current.search);
    } catch (_) {}

    location.href = target.toString();
  }

  function mount() {
    if (!isNormalS1() || $(ENTRY_ID)) return false;
    const anchor = findAnchor();
    if (!anchor) return false;

    injectStyle();
    const result = getSavedResult();
    const total = Number(result?.total || 0);
    const correct = Number(result?.correct || 0);
    const score = Math.round(Number(result?.arScore ?? result?.accuracy ?? 0));

    const box = document.createElement("aside");
    box.id = ENTRY_ID;
    box.setAttribute("aria-label", "S1 AR Practice");
    box.innerHTML = `
      <div class="s1ar-copy">
        <div class="s1ar-kicker">OPTIONAL AR PRACTICE • S1</div>
        <div class="s1ar-title">📷 AI Object Scanner</div>
        <div class="s1ar-note">ใช้กล้องและมือ หรือ mouse/touch เพื่อแยก AI, Automation, Sensor-only, Rule-based และ Prediction</div>
        ${result?.arCompleted
          ? `<div class="s1ar-status">✓ เล่นล่าสุด ${escapeHtml(correct)}/${escapeHtml(total)} • ${escapeHtml(score)}% • ส่งหลักฐานกิจกรรมเสริมแล้ว</div>`
          : `<div class="s1ar-status">กิจกรรมเสริม • ไม่กระทบคะแนนหรือการผ่าน S1 หลัก</div>`}
      </div>
      <button type="button" class="s1ar-go" id="s1ArVisibleGoV374">
        ${result?.arCompleted ? "เล่น AR อีกครั้ง" : "เริ่ม AR Practice"}
      </button>
    `;

    anchor.insertAdjacentElement("afterend", box);
    $("s1ArVisibleGoV374")?.addEventListener("click", launchAr);
    return true;
  }

  function boot() {
    if (!isNormalS1()) return;
    if (mount()) return;

    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 12000);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

  console.log("[AIQuest] " + VERSION + " loaded");
})();
