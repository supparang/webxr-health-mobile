/* =========================================================
   EAP Word Quest • Recovery CTA Visual Lock
   File: /herohealth/eap-word-quest/eap-word-engine-v224-recovery-cta-visual-lock.js
   Version: v2.6.8-STUDENT-BOOT-STORAGE-RECOVERY-122

   Emergency stability hotfix
   - Keeps established game/recovery modules.
   - Disables experimental Sheets receipt bridges v262/v264/v265 at boot.
   - Frees Local Storage safely when quota is full:
       * retains Profile, canonical stats, core pass/progress state
       * compacts statistics/history to a safe size
       * removes duplicate stats and retired delivery queues only
   - Never clears Sheets data or current core session progress.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.8-STUDENT-BOOT-STORAGE-RECOVERY-122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const STATS_KEY = "EAP_WORD_QUEST_STATS_V160";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";

  if (window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__) return;
  window.__EAP_WORD_V224_RECOVERY_VISUAL_LOCK__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  let queued = false;

  /* The static entry still references v262 from an earlier build. Mark it as
     already loaded before that static tag runs, so it safely returns without
     attaching extra observers or cross-origin delivery work. */
  window.__EAP_WORD_V262_VERIFIED_SHEET_BRIDGE__ = true;
  window.__EAP_WORD_V264_FORM_POST_RECEIPT__ = true;
  window.__EAP_WORD_V265_CURRENT_SUMMARY_RECEIPT__ = true;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function listStorageKeys() {
    const keys = [];
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) keys.push(key);
      }
    } catch (error) {}
    return keys;
  }

  function quotaError(error) {
    const text = String((error && error.name) || "") + " " + String((error && error.message) || "");
    return /quota|exceeded|storage/i.test(text);
  }

  function storageBytes() {
    let bytes = 0;
    listStorageKeys().forEach((key) => {
      try { bytes += (key.length + String(localStorage.getItem(key) || "").length) * 2; } catch (error) {}
    });
    return bytes;
  }

  function compactProfile(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    return {
      studentName: norm(value.studentName || value.name || ""),
      studentId: norm(value.studentId || value.id || ""),
      section: "122",
      group: "122",
      course: "English for Academic Purposes",
      year: "Year 2",
      storageRecoveredAt: new Date().toISOString()
    };
  }

  function compactHistory(rows, limit) {
    const history = Array.isArray(rows) ? rows.slice() : [];
    return history
      .sort((a, b) => String((b && (b.at || b.playedAt)) || "").localeCompare(String((a && (a.at || a.playedAt)) || "")))
      .slice(0, limit)
      .map((row) => {
        const item = row && typeof row === "object" ? row : {};
        return {
          at: item.at || item.playedAt || new Date().toISOString(),
          studentName: norm(item.studentName || (item.profile && item.profile.studentName) || ""),
          studentId: norm(item.studentId || (item.profile && item.profile.studentId) || ""),
          section: norm(item.section || (item.profile && item.profile.section) || "122") || "122",
          session: norm(item.session || item.sessionId || ""),
          name: norm(item.name || item.sessionTitle || ""),
          questions: Number(item.questions || item.total || 0),
          correct: Number(item.correct || 0),
          accuracy: Number(item.accuracy || 0),
          xp: Number(item.xp || item.score || 0),
          maxCombo: Number(item.maxCombo || 0),
          passed: Boolean(item.passed),
          isBoss: Boolean(item.isBoss),
          weakWords: Array.isArray(item.weakWords) ? item.weakWords.slice(0, 8) : []
        };
      });
  }

  function compactWords(words, limit) {
    const source = words && typeof words === "object" ? words : {};
    const rows = Object.keys(source).map((word) => {
      const item = source[word] && typeof source[word] === "object" ? source[word] : {};
      return {
        word,
        seen: Number(item.seen || 0),
        correct: Number(item.correct || 0),
        wrong: Number(item.wrong || 0),
        lastSeen: item.lastSeen || "",
        levels: item.levels && typeof item.levels === "object" ? item.levels : {},
        types: item.types && typeof item.types === "object" ? item.types : {},
        sessions: item.sessions && typeof item.sessions === "object" ? item.sessions : {}
      };
    });

    rows.sort((a, b) => (b.wrong - a.wrong) || (b.seen - a.seen) || String(b.lastSeen).localeCompare(String(a.lastSeen)));
    const output = {};
    rows.slice(0, limit).forEach((item) => {
      output[item.word] = {
        seen: item.seen,
        correct: item.correct,
        wrong: item.wrong,
        lastSeen: item.lastSeen,
        levels: item.levels,
        types: item.types,
        sessions: item.sessions
      };
    });
    return output;
  }

  function compactStats(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const sessions = source.sessions && typeof source.sessions === "object" ? source.sessions : {};
    return {
      version: "v2.6.8-storage-recovered",
      createdAt: source.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rounds: Number(source.rounds || 0),
      correct: Number(source.correct || 0),
      total: Number(source.total || 0),
      totalXp: Number(source.totalXp || 0),
      sessions,
      words: compactWords(source.words, 160),
      history: compactHistory(source.history, 24),
      profileSnapshot: compactProfile(source.profileSnapshot || readJson(PROFILE_KEY, {})),
      compactedBy: VERSION
    };
  }

  function compactLogs(raw) {
    const rows = Array.isArray(raw) ? raw.slice() : [];
    return rows
      .sort((a, b) => String((b && b.playedAt) || "").localeCompare(String((a && a.playedAt) || "")))
      .slice(0, 80)
      .map((item) => {
        const row = item && typeof item === "object" ? item : {};
        return {
          logVersion: row.logVersion || "v2.6.8",
          source: norm(row.source || "student-game"),
          course: "EAP",
          game: "EAP Word Quest",
          group: "122",
          section: "122",
          studentName: norm(row.studentName || ""),
          studentId: norm(row.studentId || ""),
          arcId: norm(row.arcId || ""),
          arc: norm(row.arc || ""),
          sessionId: norm(row.sessionId || row.session || ""),
          sessionTitle: norm(row.sessionTitle || row.name || ""),
          sessionType: norm(row.sessionType || ""),
          correct: Number(row.correct || 0),
          total: Number(row.total || row.questions || 0),
          accuracy: Number(row.accuracy || 0),
          xp: Number(row.xp || row.score || 0),
          maxCombo: Number(row.maxCombo || 0),
          passed: Boolean(row.passed),
          passThreshold: Number(row.passThreshold || 0),
          weakWords: Array.isArray(row.weakWords) ? row.weakWords.slice(0, 10) : [],
          hintUsed: Number(row.hintUsed || 0),
          aiDifficulty: norm(row.aiDifficulty || ""),
          aiPrediction: norm(row.aiPrediction || ""),
          playedAt: row.playedAt || new Date().toISOString(),
          fingerprint: norm(row.fingerprint || "")
        };
      });
  }

  function removeRetiredDeliveryKeys(report) {
    const removable = /^(EAP_WORD_QUEST_(SHEET_RECEIPT|FORM_POST|CURRENT_SUMMARY|CLOUD|SYNC|DELIVERY|OUTBOX))/i;
    listStorageKeys().forEach((key) => {
      if (!removable.test(key)) return;
      try {
        localStorage.removeItem(key);
        report.removed.push(key);
      } catch (error) {}
    });
  }

  function removeDuplicateStatsKeys(report) {
    ["EAP_WORD_QUEST_STATS_V161", "EAP_WORD_QUEST_STATS_V01"].forEach((key) => {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          report.removed.push(key);
        }
      } catch (error) {}
    });
  }

  function setWithRetry(key, value, report) {
    const encoded = JSON.stringify(value);
    try {
      localStorage.setItem(key, encoded);
      report.saved.push({ key, chars: encoded.length });
      return true;
    } catch (error) {
      if (!quotaError(error)) return false;
      return false;
    }
  }

  function recoverStorageQuota() {
    const report = {
      version: VERSION,
      beforeBytes: storageBytes(),
      removed: [],
      saved: [],
      profileRecovered: false,
      statsRecovered: false,
      logsRecovered: false,
      error: "",
      recoveredAt: new Date().toISOString()
    };

    try {
      const profile = compactProfile(readJson(PROFILE_KEY, {}));
      const stats = compactStats(readJson(STATS_KEY, {}));
      const logs = compactLogs(readJson(LOG_KEY, []));

      removeRetiredDeliveryKeys(report);
      removeDuplicateStatsKeys(report);

      /* Remove originals before writing reduced safe forms. Session progress is
         inside compact stats and is recreated immediately below. */
      try { localStorage.removeItem(LOG_KEY); } catch (error) {}
      try { localStorage.removeItem(STATS_KEY); } catch (error) {}
      try { localStorage.removeItem(PROFILE_KEY); } catch (error) {}

      report.profileRecovered = setWithRetry(PROFILE_KEY, profile, report);
      report.statsRecovered = setWithRetry(STATS_KEY, stats, report);
      report.logsRecovered = setWithRetry(LOG_KEY, logs, report);

      /* Last-resort space release: only transient bilingual support preferences.
         Never remove core V196 pass/progress keys. */
      if (!report.profileRecovered || !report.statsRecovered) {
        listStorageKeys().forEach((key) => {
          if (!/^EAP_WORD_QUEST_LANGUAGE_SUPPORT_V198/i.test(key)) return;
          try { localStorage.removeItem(key); report.removed.push(key); } catch (error) {}
        });
        if (!report.profileRecovered) report.profileRecovered = setWithRetry(PROFILE_KEY, profile, report);
        if (!report.statsRecovered) report.statsRecovered = setWithRetry(STATS_KEY, stats, report);
        if (!report.logsRecovered) report.logsRecovered = setWithRetry(LOG_KEY, logs, report);
      }

      report.afterBytes = storageBytes();
    } catch (error) {
      report.error = String((error && error.message) || error);
    }

    window.EAP_WORD_QUEST_STORAGE_RECOVERY_REPORT = report;
    return report;
  }

  function showStorageNotice(report) {
    if (!report || !report.profileRecovered) return;
    let node = $("eapWordStorageRecoveryNotice");
    if (!node) {
      node = document.createElement("div");
      node.id = "eapWordStorageRecoveryNotice";
      node.style.cssText = "display:none;margin:12px auto;max-width:1060px;padding:12px 16px;border:1px solid #bbf7d0;border-radius:14px;background:#ecfdf5;color:#047857;font-weight:800";
      const shell = document.querySelector(".app-shell");
      if (shell) shell.prepend(node);
    }
    node.textContent = "จัดพื้นที่ในอุปกรณ์เรียบร้อยแล้ว — เก็บ Profile และความก้าวหน้า Session ไว้ พร้อมใช้งานต่อได้";
    node.style.display = "block";
  }

  function corePassed(sessionId) {
    try {
      const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") || {};
      const rawId = norm(($('studentIdInput') && $('studentIdInput').value) || saved.studentId || saved.id || "no-id");
      const id = rawId.replace(/[^a-z0-9_-]/gi, "_") || "no-id";
      const key = `EAP_WORD_QUEST_CORE_V196_STATE_122_${id}`;
      const state = JSON.parse(localStorage.getItem(key) || "{}") || {};
      return Boolean(state.sessions && state.sessions[sessionId] && state.sessions[sessionId].passed);
    } catch (error) {
      return false;
    }
  }

  function summaryRecoverySession() {
    const screen = $("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return "";
    const title = norm($("summaryTitle") && $("summaryTitle").textContent);
    const match = title.match(/^(S(?:1[0-5]|[1-9])|BG[1-5])\s+ฝึกเพิ่มอีกนิด/i);
    const sessionId = match ? match[1].toUpperCase() : "";
    return sessionId && !corePassed(sessionId) ? sessionId : "";
  }

  function addStyle() {
    if ($("eapV224RecoveryVisualStyle")) return;

    const style = document.createElement("style");
    style.id = "eapV224RecoveryVisualStyle";
    style.textContent = `
      #nextMissionBtn[data-eap-v224-label]{position:relative!important;min-width:242px!important;width:242px!important;max-width:242px!important;min-height:54px!important;overflow:hidden!important;color:transparent!important;font-size:0!important;line-height:0!important;text-shadow:none!important}
      #nextMissionBtn[data-eap-v224-label]::after{content:attr(data-eap-v224-label)!important;position:absolute!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;font-size:18px!important;font-weight:950!important;line-height:1.15!important;white-space:nowrap!important;pointer-events:none!important}
      #eapWordBootRescue{display:none;margin:14px auto;max-width:960px;padding:12px 16px;border:1px solid #bfdbfe;border-radius:14px;background:#eff6ff;color:#174ea6;font-weight:800}
      @media(max-width:680px){#nextMissionBtn[data-eap-v224-label]{min-width:0!important;width:100%!important;max-width:none!important}#nextMissionBtn[data-eap-v224-label]::after{font-size:17px!important}}
    `;
    document.head.appendChild(style);
  }

  function apply() {
    queued = false;
    addStyle();

    const button = $("nextMissionBtn");
    if (!button) return;

    const sessionId = summaryRecoverySession();
    if (!sessionId) {
      delete button.dataset.eapV224Label;
      button.removeAttribute("data-eap-v224-label");
      return;
    }

    const label = `เริ่ม ${sessionId} Recovery`;
    button.dataset.eapV224Label = label;
    button.setAttribute("aria-label", label);
    button.title = `เริ่มชุดทบทวน ${sessionId} โดยใช้โจทย์ใหม่`;
  }

  function requestApply() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  function visibleScreenExists() {
    return Array.from(document.querySelectorAll(".screen")).some((screen) => {
      const style = window.getComputedStyle(screen);
      const box = screen.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && box.width > 10 && box.height > 10;
    });
  }

  function rescueBlankScreen() {
    addStyle();
    const home = $("homeScreen");
    if (!home || visibleScreenExists()) return false;

    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
      screen.style.removeProperty("display");
      screen.style.removeProperty("visibility");
      screen.style.removeProperty("opacity");
    });

    home.classList.add("active");
    home.style.setProperty("display", "block", "important");
    home.style.setProperty("visibility", "visible", "important");
    home.style.setProperty("opacity", "1", "important");

    let notice = $("eapWordBootRescue");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "eapWordBootRescue";
      notice.textContent = "กู้หน้าจอเกมแล้ว — ความก้าวหน้าในเครื่องยังอยู่ กรุณาเลือกเล่นต่อได้ตามปกติ";
      const shell = document.querySelector(".app-shell");
      if (shell) shell.prepend(notice);
    }
    notice.style.display = "block";
    console.warn("[EAP Word Quest] blank screen rescued", { version: VERSION });
    return true;
  }

  function loadStableGuards() {
    const load = (file, marker, tag) => {
      if (window[marker] || document.querySelector(`script[data-eap-runtime="${tag}"]`)) return;
      const script = document.createElement("script");
      script.src = `./${file}?v=20260701-${tag}`;
      script.async = false;
      script.dataset.eapRuntime = tag;
      document.head.appendChild(script);
    };

    load("eap-word-engine-v227-retained-pass-repair.js", "__EAP_WORD_V227_RETAINED_PASS_REPAIR__", "retained-pass");
    load("eap-word-engine-v229-recovery-round-integrity.js", "__EAP_WORD_V229_RECOVERY_ROUND_INTEGRITY__", "recovery-round");
    load("eap-word-engine-v233-pass-ledger-path.js", "__EAP_WORD_V233_PASS_LEDGER_PATH__", "pass-ledger-path");
    load("eap-word-engine-v234-final-summit-complete.js", "__EAP_WORD_V234_FINAL_SUMMIT__", "final-summit");
    load("eap-word-engine-v236-boss-round-recovery-integrity.js", "__EAP_WORD_V236_BOSS_ROUND_INTEGRITY__", "boss-round");
    load("eap-word-engine-v235-boss-summary-truth.js", "__EAP_WORD_V235_BOSS_SUMMARY_TRUTH__", "boss-summary");
    load("eap-word-engine-v237-bg5-full-recovery-director.js", "__EAP_WORD_V237_BG5_FULL_RECOVERY__", "bg5-full-recovery");
    load("eap-word-engine-v238-final-pass-commit.js", "__EAP_WORD_V238_FINAL_PASS_COMMIT__", "final-pass-commit");
    load("eap-word-engine-v239-home-completion-report.js", "__EAP_WORD_V239_HOME_COMPLETION__", "home-completion-report");
  }

  const observer = new MutationObserver(requestApply);
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  document.addEventListener("click", () => [0, 120, 360, 760].forEach((delay) => setTimeout(requestApply, delay)), true);
  window.addEventListener("eap-core-run-finished", () => [0, 100, 300, 700].forEach((delay) => setTimeout(requestApply, delay)));

  const recovery = recoverStorageQuota();
  [0, 160, 500, 1200, 2200].forEach((delay) => setTimeout(requestApply, delay));
  [800, 1800, 3500].forEach((delay) => setTimeout(rescueBlankScreen, delay));
  setTimeout(() => showStorageNotice(recovery), 400);
  loadStableGuards();

  window.inspectEapV224 = () => ({
    version: VERSION,
    recoverySession: summaryRecoverySession(),
    visibleScreenExists: visibleScreenExists(),
    storageRecovery: window.EAP_WORD_QUEST_STORAGE_RECOVERY_REPORT || null,
    receiptBridgesDisabled: true
  });

  console.info("[EAP Word Quest] stable boot + storage recovery ready", { version: VERSION, recovery });
})();
