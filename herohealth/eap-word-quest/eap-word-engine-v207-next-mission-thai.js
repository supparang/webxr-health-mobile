/* =========================================================
   EAP Word Quest • Next Mission Truth + Home Thai Labels
   File: /herohealth/eap-word-quest/eap-word-engine-v207-next-mission-thai.js
   Version: v2.0.7-NEXT-MISSION-TRUTH-THAI-122

   Student-facing UI only:
   - Home "continue" button always reflects the Core controller's next mission.
   - Keeps v196 click handling unchanged; this only fixes its visible label.
   - Localizes remaining setup labels without touching progress, gates or logs.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.0.7-NEXT-MISSION-TRUTH-THAI-122";

  if (window.__EAP_WORD_V207_NEXT_MISSION__) return;
  window.__EAP_WORD_V207_NEXT_MISSION__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function nextInfo() {
    try {
      const progress = typeof window.getEapCoreProgress === "function"
        ? window.getEapCoreProgress()
        : null;
      const id = norm(progress && progress.next);
      if (!id) return { id:"", title:"" };

      let title = "";
      if (id !== "DONE" && typeof window.getEapCoreSession === "function") {
        const session = window.getEapCoreSession(id);
        title = norm(session && session.title);
      }
      if (id !== "DONE" && !title && typeof window.getEapCoreBoss === "function") {
        const boss = window.getEapCoreBoss(id);
        title = norm(boss && boss.title);
      }
      return { id, title };
    } catch (err) {
      return { id:"", title:"" };
    }
  }

  function syncQuickStart() {
    const button = $("quickStartBtn");
    if (!button) return;

    const next = nextInfo();
    if (!next.id) {
      button.textContent = "กำลังเตรียมภารกิจ…";
      button.disabled = true;
      return;
    }

    button.disabled = false;
    button.dataset.coreNextMission = next.id;

    if (next.id === "DONE") {
      button.textContent = "ดูสรุปความก้าวหน้า";
      button.title = "ผ่าน Vocabulary Mission ครบแล้ว";
      return;
    }

    button.textContent = `ไปทำ ${next.id} ต่อ`;
    button.title = next.title ? `${next.id} · ${next.title}` : next.id;
    button.setAttribute("aria-label", next.title ? `ไปทำ ${next.id} ${next.title} ต่อ` : `ไปทำ ${next.id} ต่อ`);
  }

  function replaceExactText(selector, replacements) {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.children && node.children.length > 0) return;
      const raw = norm(node.dataset.eap207Raw || node.textContent);
      node.dataset.eap207Raw = raw;
      if (Object.prototype.hasOwnProperty.call(replacements, raw)) {
        node.textContent = replacements[raw];
      }
    });
  }

  function localizeSetup() {
    const exact = {
      "Student Mode": "โหมดผู้เรียน",
      "Student Profile": "ข้อมูลผู้เรียน",
      "Student Name": "ชื่อผู้เรียน",
      "Student ID": "รหัสนักศึกษา",
      "Group": "กลุ่มเรียน",
      "Save Profile": "บันทึกข้อมูล",
      "Reset Profile": "รีเซ็ตข้อมูล",
      "Mode": "ระดับโจทย์",
      "Round Size": "จำนวนข้อ",
      "Daily Challenge": "ภารกิจประจำวัน",
      "Speed Run 60s": "Speed Run 60 วินาที",
      "Sessions": "Sessions"
    };
    replaceExactText("label span,button,span", exact);

    const select = $("modeSelect");
    if (select) {
      const options = {
        "mixed":"ผสม A2–B1+",
        "A2":"A2 • ความหมาย",
        "A2+":"A2+ • คำจำกัดความ",
        "B1":"B1 • ใช้บริบท",
        "B1+":"B1+ • เชิงวิชาการ"
      };
      Array.from(select.options).forEach((option) => {
        if (options[option.value]) option.textContent = options[option.value];
      });
    }

    const size = $("roundSizeSelect");
    if (size) {
      Array.from(size.options).forEach((option) => {
        const n = Number(option.value);
        if (Number.isFinite(n) && n > 0) option.textContent = `${n} ข้อ`;
      });
    }
  }

  function patch() {
    localizeSetup();
    syncQuickStart();
  }

  document.addEventListener("click", () => {
    [40, 180, 550].forEach((delay) => setTimeout(patch, delay));
  }, true);

  [0, 100, 350, 900, 1600].forEach((delay) => setTimeout(patch, delay));
  setInterval(patch, 1200);

  window.inspectEapV207 = () => ({
    version: VERSION,
    next: nextInfo(),
    buttonText: norm($("quickStartBtn") && $("quickStartBtn").textContent),
    buttonDisabled: Boolean($("quickStartBtn") && $("quickStartBtn").disabled)
  });

  console.info("[EAP Word Quest] v207 next-mission truth ready", { version: VERSION });
})();
