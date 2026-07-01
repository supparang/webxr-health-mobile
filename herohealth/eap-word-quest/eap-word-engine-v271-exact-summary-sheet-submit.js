/* =========================================================
   EAP Word Quest • Exact Summary Sheets Submit
   File: /herohealth/eap-word-quest/eap-word-engine-v271-exact-summary-sheet-submit.js
   Version: v2.7.1-EXACT-SUMMARY-SUBMIT-122

   Critical rule
   - The payload is built ONLY from the active EAP_V172_SUMMARY_STATE.
   - It never falls back to EAP_LAST_LEARNING_LOG, so a completed S2 cannot
     be mislabelled as a stale S1 from an earlier round.
   - No persistent outbox and no Local Storage writes.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.7.1-EXACT-SUMMARY-SUBMIT-122";
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec";
  const GROUP = "122";
  const FLOW = new Set([
    "S1", "S2", "S3", "BG1", "S4", "S5", "S6", "BG2",
    "S7", "S8", "S9", "BG3", "S10", "S11", "S12", "BG4",
    "S13", "S14", "S15", "BG5"
  ]);

  if (window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__) return;
  window.__EAP_WORD_V271_EXACT_SUMMARY_SUBMIT__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const truthy = (value) => value === true || value === 1 || String(value).toLowerCase() === "true" || String(value) === "1";
  const sent = new Set();
  const pending = new Set();
  let lastToken = "";

  function readProfile() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem("EAP_WORD_QUEST_PROFILE_V01") || "{}") || {};
    } catch (error) {}

    const nameInput = document.getElementById("studentNameInput");
    const idInput = document.getElementById("studentIdInput");
    const sectionInput = document.getElementById("sectionInput");

    return {
      studentName: norm((nameInput && nameInput.value) || saved.studentName || saved.name || ""),
      studentId: norm((idInput && idInput.value) || saved.studentId || saved.id || ""),
      section: norm((sectionInput && sectionInput.value) || saved.section || saved.group || GROUP) || GROUP
    };
  }

  function validProfile(profile) {
    const id = norm(profile && profile.studentId).toLowerCase();
    const name = norm(profile && profile.studentName).toLowerCase();
    return Boolean(id && name) &&
      !["anon", "no-id", "unknown"].includes(id) &&
      !["anonymous", "hero", "student", "unknown"].includes(name);
  }

  function asList(value) {
    if (Array.isArray(value)) return value.map(norm).filter(Boolean);
    if (typeof value === "string") return value.split(/[|,;]/).map(norm).filter(Boolean);
    return [];
  }

  function passThreshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function exactSummaryRecord() {
    const state = window.EAP_V172_SUMMARY_STATE;
    const result = state && state.result;
    if (!result) return null;

    const sessionId = norm(result.id || result.sessionId).toUpperCase();
    if (!FLOW.has(sessionId)) return null;

    const profile = readProfile();
    if (!validProfile(profile)) return { error: "profile_incomplete" };

    const correct = Math.max(0, Math.round(number(result.correct)));
    const total = Math.max(1, Math.round(number(result.total || result.questions, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(number(result.accuracy, (correct / total) * 100))));
    const playedAt = norm(state.renderedAt || result.playedAt || new Date().toISOString());
    const threshold = passThreshold(sessionId);

    const record = {
      source: "v271-exact-summary-state",
      course: "EAP",
      game: "EAP Word Quest",
      group: GROUP,
      section: GROUP,
      studentName: profile.studentName,
      studentId: profile.studentId,
      arcId: norm(result.arcId),
      arc: norm(result.arc),
      sessionId: sessionId,
      sessionTitle: norm(result.title || result.sessionTitle || sessionId),
      sessionType: norm(result.sessionType || (/^BG/.test(sessionId) ? "boss" : "session")),
      correct: correct,
      total: total,
      accuracy: accuracy,
      xp: Math.max(0, Math.round(number(result.xp, result.score))),
      score: Math.max(0, Math.round(number(result.score, result.xp))),
      maxCombo: Math.max(0, Math.round(number(result.maxCombo || result.combo))),
      passed: truthy(result.passed) || accuracy >= threshold,
      passThreshold: threshold,
      passStatus: norm(result.passStatus),
      cefrLevel: norm(result.cefrLevel || result.level),
      aiDifficulty: norm(result.aiDifficulty),
      aiPrediction: norm(result.aiPrediction),
      hintUsed: Math.max(0, Math.round(number(result.hintUsed || result.hintsUsed))),
      weakWords: asList(result.weakWords || result.weak || result.weakWord),
      itemTypeWeak: asList(result.itemTypeWeak),
      levelWeak: asList(result.levelWeak),
      responseTimeAvg: Math.max(0, number(result.responseTimeAvg)),
      attempt: Math.max(1, Math.round(number(result.attempt, 1))),
      bossHp: Math.max(0, Math.round(number(result.boss && result.boss.hp))),
      bossMaxHp: Math.max(0, Math.round(number(result.boss && result.boss.max))),
      isBoss: truthy(result.isBoss) || /^BG/.test(sessionId),
      playedAt: playedAt
    };

    record.fingerprint = [
      GROUP,
      record.studentId,
      record.studentName,
      record.sessionId,
      record.correct,
      record.total,
      record.accuracy,
      String(record.playedAt).slice(0, 19)
    ].join("|");

    return record;
  }

  function summaryActive() {
    const summary = document.getElementById("summaryScreen");
    return Boolean(summary && summary.classList.contains("active"));
  }

  function statusBox() {
    let node = document.getElementById("eapWordExactSummaryStatus");
    if (node) return node;

    const summary = document.getElementById("summaryScreen");
    const card = summary && summary.querySelector(".summary-card");
    if (!card) return null;

    node = document.createElement("section");
    node.id = "eapWordExactSummaryStatus";
    node.setAttribute("aria-live", "polite");
    node.style.cssText = "display:none;margin:12px 0;padding:13px 16px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#174ea6;font-weight:850;line-height:1.45";
    const actions = card.querySelector(".summary-actions");
    if (actions) actions.before(node); else card.appendChild(node);
    return node;
  }

  function show(message, mode) {
    if (!summaryActive()) return;
    const node = statusBox();
    if (!node) return;

    const palette = {
      working: ["#eff6ff", "#174ea6", "#bfdbfe"],
      success: ["#ecfdf5", "#047857", "#bbf7d0"],
      warning: ["#fff7ed", "#b45309", "#fed7aa"],
      error: ["#fff1f2", "#b42318", "#fecdd3"]
    };
    const colors = palette[mode] || palette.working;

    node.style.display = "block";
    node.style.background = colors[0];
    node.style.color = colors[1];
    node.style.borderColor = colors[2];
    node.innerHTML = "";

    const label = document.createElement("span");
    label.textContent = message;
    node.appendChild(label);

    if (mode === "warning" || mode === "error") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "ส่งผลรอบนี้อีกครั้ง";
      retry.style.cssText = "margin-left:10px;border:1px solid currentColor;border-radius:9px;background:transparent;color:inherit;padding:5px 9px;font-weight:900;cursor:pointer";
      retry.addEventListener("click", () => submitExactSummary("manual_retry"));
      node.appendChild(retry);
    }
  }

  function post(record) {
    return new Promise((resolve) => {
      const frameName = "eapWordExactPost_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const frame = document.createElement("iframe");
      const form = document.createElement("form");
      const payload = {
        action: "eap_word_attempt",
        schemaVersion: VERSION,
        clientTs: new Date().toISOString(),
        pageUrl: location.href,
        userAgent: navigator.userAgent || "",
        record: record
      };

      frame.name = frameName;
      frame.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:0";
      form.method = "POST";
      form.action = ENDPOINT;
      form.target = frameName;
      form.style.display = "none";

      [["action", "eap_word_attempt"], ["payload", JSON.stringify(payload)]].forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(frame);
      document.body.appendChild(form);

      try {
        form.submit();
        setTimeout(() => {
          try { form.remove(); frame.remove(); } catch (ignore) {}
          resolve(true);
        }, 700);
      } catch (error) {
        try { form.remove(); frame.remove(); } catch (ignore) {}
        resolve(false);
      }
    });
  }

  function jsonp(timeoutMs) {
    return new Promise((resolve, reject) => {
      const callback = "__eapwq_v271_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const script = document.createElement("script");
      let finished = false;
      const finish = (error, payload) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore) {}
        error ? reject(error) : resolve(payload);
      };
      const timer = setTimeout(() => finish(new Error("receipt_timeout")), timeoutMs || 9000);
      window[callback] = (payload) => finish(null, payload);
      script.onerror = () => finish(new Error("receipt_network_error"));
      script.src = ENDPOINT + "?action=eap_word_teacher&section=" + encodeURIComponent(GROUP) + "&callback=" + encodeURIComponent(callback) + "&_=" + Date.now();
      document.head.appendChild(script);
    });
  }

  async function verify(fingerprint) {
    try {
      const payload = await jsonp();
      const logs = Array.isArray(payload && payload.logs) ? payload.logs : [];
      return logs.some((row) => norm(row && row.fingerprint) === norm(fingerprint));
    } catch (error) {
      console.warn("[EAP Word Quest] exact summary receipt check failed", error);
      return false;
    }
  }

  async function submit(record, reason) {
    if (!record || record.error === "profile_incomplete") {
      show("ยังส่งผลไม่ได้ เพราะชื่อหรือรหัสนักศึกษาไม่ครบ", "error");
      return;
    }

    const fp = norm(record.fingerprint);
    if (!fp || sent.has(fp) || pending.has(fp)) return;

    pending.add(fp);
    show(`กำลังส่ง ${record.sessionId} รอบล่าสุดเข้า Google Sheets…`, "working");

    try {
      if (!(await post(record))) {
        show("ส่งผลรอบล่าสุดไม่สำเร็จ กรุณากดส่งอีกครั้ง", "warning");
        return;
      }

      for (const delay of [1200, 2500, 4200]) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (await verify(fp)) {
          sent.add(fp);
          show(`${record.sessionId} บันทึก Google Sheets ยืนยันแล้ว ✓`, "success");
          console.info("[EAP Word Quest] exact summary receipt confirmed", { version: VERSION, reason, sessionId: record.sessionId, fingerprint: fp });
          return;
        }
      }

      show(`ส่ง ${record.sessionId} แล้ว แต่ยังไม่พบแถวใน Google Sheets`, "warning");
    } finally {
      pending.delete(fp);
    }
  }

  function submitExactSummary(reason) {
    const record = exactSummaryRecord();
    if (!record) return;

    if (record.error) {
      submit(record, reason);
      return;
    }

    const token = [record.sessionId, record.playedAt, record.fingerprint].join("|");
    if (reason !== "manual_retry" && token === lastToken) return;
    lastToken = token;
    submit(record, reason || "summary_ready");
  }

  window.addEventListener("eap-core-run-finished", () => {
    [300, 900, 1600].forEach((delay) => setTimeout(() => submitExactSummary("core_finished"), delay));
  });

  const observer = new MutationObserver(() => {
    if (summaryActive()) setTimeout(() => submitExactSummary("summary_visible"), 100);
  });
  observer.observe(document.body, { childList:true, subtree:true, characterData:true });

  document.addEventListener("click", () => {
    if (summaryActive()) setTimeout(() => submitExactSummary("summary_click"), 180);
  }, true);

  setInterval(() => {
    if (summaryActive()) submitExactSummary("summary_poll");
  }, 900);

  window.submitEapWordQuestExactSummaryToSheet = () => submitExactSummary("manual_retry");
  window.inspectEapWordQuestExactSummarySubmit = () => ({
    version: VERSION,
    endpoint: ENDPOINT,
    profile: readProfile(),
    currentSummaryRecord: exactSummaryRecord(),
    pending: Array.from(pending),
    sent: Array.from(sent)
  });

  console.info("[EAP Word Quest] exact summary Sheets submit ready", { version: VERSION });
})();
