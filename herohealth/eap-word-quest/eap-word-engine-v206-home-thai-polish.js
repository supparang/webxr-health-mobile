/* =========================================================
   EAP Word Quest • Student Home Thai Polish
   File: /herohealth/eap-word-quest/eap-word-engine-v206-home-thai-polish.js
   Version: v2.0.6.1-HOME-THAI-EVENT-DRIVEN-122

   Student-facing UI only:
   - Translate Core session-card states, labels and action buttons.
   - Keep English Session titles and target terms for learning.
   - Remove runtime/version badges from the student header.
   - Event-driven only: no perpetual interval / DOM repaint loop.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.0.6.1-HOME-THAI-EVENT-DRIVEN-122";

  if (window.__EAP_WORD_V206_HOME_THAI__) return;
  window.__EAP_WORD_V206_HOME_THAI__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  let patchQueued = false;

  function addStyle() {
    if (document.getElementById("eapV206HomeStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV206HomeStyle";
    style.textContent = `
      .eap192-arc > h3{font-size:19px!important;color:#1e293b}
      .eap192-tag.eap206-status{font-weight:1000}
      .eap206-home-note{margin:5px 0 0;color:#64748b;font-size:12px;font-weight:760;line-height:1.35}
    `;
    document.head.appendChild(style);
  }

  function removeRuntimeBadges() {
    const top = document.querySelector(".topbar-right");
    if (!top) return;
    Array.from(top.querySelectorAll(".eap192-core-badge,[data-eap-debug-badge='true']")).forEach((node) => node.remove());
    Array.from(top.querySelectorAll("span,div")).forEach((node) => {
      const value = norm(node.textContent);
      if (/^(Core AI|Core Bank|Core)\s+v\d+/i.test(value)) node.remove();
    });
  }

  function translateArcHeading(node) {
    const map = {
      "Foundation Arc": "Arc 1 • ฐานการเรียนรู้",
      "Evidence Arc": "Arc 2 • อ่านและใช้หลักฐาน",
      "Academic Writing Arc": "Arc 3 • การเขียนเชิงวิชาการ",
      "Professional Academic Communication": "Arc 4 • การสื่อสารเชิงวิชาการ",
      "Global Academic Communication": "Arc 5 • บูรณาการการสื่อสาร"
    };
    const value = norm(node.textContent).replace(/\s*🔒\s*$/, "");
    if (map[value]) node.textContent = map[value] + (norm(node.textContent).includes("🔒") ? " 🔒" : "");
  }

  function translateTag(node) {
    const raw = norm(node.dataset.eap206Raw || node.textContent);
    node.dataset.eap206Raw = raw;
    const matchTargets = raw.match(/^(\d+)\s+targets$/i);
    const matchItems = raw.match(/^(\d+)\s+item variants$/i);
    const matchBest = raw.match(/^Best\s+(.+)$/i);
    let translated = raw;

    if (raw === "Passed") translated = "ผ่านแล้ว";
    else if (raw === "Open") translated = "เปิดเล่นได้";
    else if (raw === "Locked") translated = "ยังล็อก";
    else if (raw === "Core Aligned") translated = "ตรง Core";
    else if (matchTargets) translated = `${matchTargets[1]} คำเป้าหมาย`;
    else if (matchItems) translated = `${matchItems[1]} รูปแบบโจทย์`;
    else if (matchBest) translated = `สูงสุด ${matchBest[1]}`;

    if (node.textContent !== translated) node.textContent = translated;
    if (["Passed", "Open", "Locked"].includes(raw)) node.classList.add("eap206-status");
  }

  function translateHomeStats() {
    const labels = {
      "Mission Progress": "ความก้าวหน้าภารกิจ",
      "Passed Missions": "ภารกิจที่ผ่าน",
      "Core Bank Avg": "คะแนนเฉลี่ย Core",
      "Weak Targets": "คำที่ต้องทบทวน",
      "Core Runs": "รอบที่เล่นจาก Core"
    };
    document.querySelectorAll("#homeStats .stat span").forEach((node) => {
      const raw = norm(node.dataset.eap206Raw || node.textContent);
      node.dataset.eap206Raw = raw;
      if (labels[raw] && node.textContent !== labels[raw]) node.textContent = labels[raw];
    });
  }

  function translateCards() {
    document.querySelectorAll("#sessionGrid .eap192-arc > h3").forEach(translateArcHeading);
    document.querySelectorAll("#sessionGrid .eap192-tag").forEach(translateTag);

    document.querySelectorAll("#sessionGrid .eap192-start").forEach((button) => {
      const raw = norm(button.dataset.eap206Raw || button.textContent);
      button.dataset.eap206Raw = raw;
      if (raw === "Start" && button.textContent !== "เริ่มฝึก") button.textContent = "เริ่มฝึก";
      if (raw === "Replay" && button.textContent !== "เล่นซ้ำ") button.textContent = "เล่นซ้ำ";
    });

    document.querySelectorAll("#sessionGrid .eap192-session-card").forEach((card) => {
      if (card.querySelector(".eap206-home-note")) return;
      const status = card.querySelector(".eap192-card-top .eap192-tag");
      const raw = norm(status && status.dataset.eap206Raw);
      if (raw !== "Locked") return;
      const note = document.createElement("p");
      note.className = "eap206-home-note";
      note.textContent = "ผ่าน Arc ก่อนหน้าและ Vocabulary Boss ก่อน จึงจะเปิดภารกิจนี้";
      card.querySelector(".eap192-tags")?.insertAdjacentElement("beforebegin", note);
    });
  }

  function patch() {
    patchQueued = false;
    addStyle();
    removeRuntimeBadges();
    translateHomeStats();
    translateCards();
  }

  function schedulePatch() {
    if (patchQueued) return;
    patchQueued = true;
    requestAnimationFrame(patch);
  }

  document.addEventListener("click", () => setTimeout(schedulePatch, 80), true);
  window.addEventListener("eap-word-authority-ready", schedulePatch);
  window.addEventListener("eap-word-sheet-confirmed", schedulePatch);
  window.addEventListener("pageshow", schedulePatch);
  window.addEventListener("eap-word-home-rendered", schedulePatch);

  [0, 120, 450, 1000].forEach((delay) => setTimeout(schedulePatch, delay));

  window.inspectEapV206 = () => ({
    version: VERSION,
    intervalFree: true,
    runtimeBadges: document.querySelectorAll(".topbar-right .eap192-core-badge").length,
    homeCards: document.querySelectorAll("#sessionGrid .eap192-session-card").length,
    thaiStatuses: Array.from(document.querySelectorAll("#sessionGrid .eap192-card-top .eap192-tag")).filter((node) => /ผ่านแล้ว|เปิดเล่นได้|ยังล็อก/.test(norm(node.textContent))).length
  });

  console.info("[EAP Word Quest] v206 event-driven Thai polish ready", { version: VERSION });
})();
