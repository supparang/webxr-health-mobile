/* =========================================================
   EAP Word Quest • Form POST + Sheets Receipt Bridge
   File: /herohealth/eap-word-quest/eap-word-engine-v264-form-post-receipt.js
   Version: v2.6.4-FORM-POST-RECEIPT-122

   Uses a hidden cross-origin HTML form instead of fetch(no-cors), then
   verifies receipt from eap_word_teacher JSONP before showing success.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.4-FORM-POST-RECEIPT-122";
  const GROUP = "122";
  const FLOW = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);
  const OUTBOX_KEY = "EAP_WORD_QUEST_FORM_POST_OUTBOX_V264";
  const SENT_KEY = "EAP_WORD_QUEST_FORM_POST_SENT_V264";
  const RETRY_DELAYS = [900, 1800, 3200];
  const MAX_ROWS = 600;
  const inFlight = new Set();

  if (window.__EAP_WORD_V264_FORM_POST_RECEIPT__) return;
  window.__EAP_WORD_V264_FORM_POST_RECEIPT__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const truthy = (value) => value === true || value === 1 || String(value).toLowerCase() === "true" || String(value) === "1";
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function endpoint() {
    const helper = typeof window.getEapWordSheetEndpoint === "function"
      ? window.getEapWordSheetEndpoint()
      : "";
    const configured = window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint;
    try {
      return norm(helper || configured || localStorage.getItem("EAP_WORD_SHEET_ENDPOINT") || "");
    } catch (error) {
      return norm(helper || configured || "");
    }
  }

  function endpointReady() {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(endpoint());
  }

  function profile() {
    const saved = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    const nameInput = document.getElementById("studentNameInput");
    const idInput = document.getElementById("studentIdInput");
    return {
      studentName: norm((nameInput && nameInput.value) || saved.studentName || saved.name || ""),
      studentId: norm((idInput && idInput.value) || saved.studentId || saved.id || "")
    };
  }

  function validIdentity(studentId, studentName) {
    const id = norm(studentId).toLowerCase();
    const name = norm(studentName).toLowerCase();
    return Boolean(id && name) &&
      !["anon","no-id","unknown"].includes(id) &&
      !["anonymous","hero","student","unknown"].includes(name);
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function makeFingerprint(record) {
    return [
      GROUP,
      norm(record.studentId),
      norm(record.studentName).toLowerCase(),
      norm(record.sessionId).toUpperCase(),
      Math.round(number(record.correct)),
      Math.round(number(record.total)),
      Math.round(number(record.accuracy)),
      norm(record.playedAt).slice(0, 19)
    ].join("|");
  }

  function normalize(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const sessionId = norm(input.sessionId || input.session || input.id).toUpperCase();
    if (!FLOW.has(sessionId)) return { record:null, reason:"invalid_session" };

    const p = profile();
    const studentId = norm(input.studentId || input.idNumber || input.studentCode || p.studentId);
    const studentName = norm(input.studentName || input.name || p.studentName);
    if (!validIdentity(studentId, studentName)) {
      return { record:null, reason:"profile_incomplete", profile:{ studentId, studentName } };
    }

    const correct = Math.max(0, Math.round(number(input.correct)));
    const total = Math.max(1, Math.round(number(input.total || input.questions, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(number(input.accuracy, (correct / total) * 100))));
    const playedAt = norm(input.playedAt || input.endedAt || input.at || input.updatedAt || new Date().toISOString());
    const passThreshold = Math.max(0, Math.round(number(input.passThreshold, threshold(sessionId))));

    const record = {
      source: norm(input.source || "student-core"),
      course: norm(input.course || "EAP"),
      game: norm(input.game || "EAP Word Quest"),
      group: GROUP,
      section: GROUP,
      studentName,
      studentId,
      arcId: norm(input.arcId),
      arc: norm(input.arc),
      sessionId,
      sessionTitle: norm(input.sessionTitle || sessionId),
      sessionType: norm(input.sessionType || (/^BG/.test(sessionId) ? "boss" : "session")),
      correct,
      total,
      accuracy,
      xp: Math.max(0, Math.round(number(input.xp, input.score))),
      score: Math.max(0, Math.round(number(input.score, input.xp))),
      maxCombo: Math.max(0, Math.round(number(input.maxCombo || input.combo))),
      passed: truthy(input.passed) || accuracy >= passThreshold,
      passThreshold,
      passStatus: norm(input.passStatus),
      cefrLevel: norm(input.cefrLevel || input.level),
      aiDifficulty: norm(input.aiDifficulty),
      aiPrediction: norm(input.aiPrediction),
      hintUsed: Math.max(0, Math.round(number(input.hintUsed || input.hintsUsed))),
      weakWords: Array.isArray(input.weakWords) ? input.weakWords.slice(0, 12) : [],
      itemTypeWeak: Array.isArray(input.itemTypeWeak) ? input.itemTypeWeak.slice(0, 8) : [],
      levelWeak: Array.isArray(input.levelWeak) ? input.levelWeak.slice(0, 8) : [],
      responseTimeAvg: Math.max(0, number(input.responseTimeAvg)),
      attempt: Math.max(1, Math.round(number(input.attempt, 1))),
      bossHp: Math.max(0, Math.round(number(input.bossHp))),
      bossMaxHp: Math.max(0, Math.round(number(input.bossMaxHp))),
      isBoss: truthy(input.isBoss) || /^BG/.test(sessionId),
      playedAt
    };
    record.fingerprint = norm(input.fingerprint) || makeFingerprint(record);
    return { record, reason:"" };
  }

  function outbox() {
    const rows = readJson(OUTBOX_KEY, []);
    return Array.isArray(rows) ? rows.filter((row) => row && row.fingerprint) : [];
  }

  function saveOutbox(rows) {
    writeJson(OUTBOX_KEY, (Array.isArray(rows) ? rows : []).slice(-MAX_ROWS));
  }

  function sentSet() {
    const rows = readJson(SENT_KEY, []);
    return new Set(Array.isArray(rows) ? rows.map(norm).filter(Boolean) : []);
  }

  function markSent(fingerprint) {
    const rows = Array.from(sentSet());
    const value = norm(fingerprint);
    if (value && !rows.includes(value)) rows.push(value);
    writeJson(SENT_KEY, rows.slice(-MAX_ROWS));
  }

  function enqueue(record) {
    if (!record || !record.fingerprint || sentSet().has(record.fingerprint)) return false;
    const rows = outbox();
    if (rows.some((row) => norm(row.fingerprint) === record.fingerprint)) return false;
    rows.push(record);
    saveOutbox(rows);
    return true;
  }

  function dequeue(fingerprint) {
    const target = norm(fingerprint);
    saveOutbox(outbox().filter((row) => norm(row.fingerprint) !== target));
  }

  function statusBox() {
    let box = document.getElementById("eapWordSheetsFormStatus");
    if (box) return box;
    const summary = document.getElementById("summaryScreen");
    const card = summary && summary.querySelector(".summary-card");
    if (!card) return null;
    box = document.createElement("section");
    box.id = "eapWordSheetsFormStatus";
    box.setAttribute("aria-live", "polite");
    box.style.cssText = "display:none;margin:14px 0 0;padding:13px 16px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#1d4ed8;font-weight:850;line-height:1.45";
    const actions = card.querySelector(".summary-actions");
    if (actions) actions.before(box); else card.appendChild(box);
    return box;
  }

  function draw(status) {
    const summary = document.getElementById("summaryScreen");
    if (!summary || !summary.classList.contains("active")) return;
    const box = statusBox();
    if (!box) return;

    const state = status || window.EAP_WORD_FORM_POST_STATUS || {};
    const p = state.profile || profile();
    let message = "กำลังตรวจสอบการบันทึก Google Sheets…";
    let background = "#eff6ff", foreground = "#1d4ed8", border = "#bfdbfe";

    if (state.verified) {
      message = `บันทึก Google Sheets ยืนยันแล้ว ✓ (${state.sessionId || "attempt"})`;
      background = "#ecfdf5"; foreground = "#047857"; border = "#bbf7d0";
    } else if (state.reason === "profile_incomplete") {
      message = `ยังไม่ได้ส่งผล เพราะ Profile ไม่ครบ — ชื่อ: ${norm(p.studentName) || "—"}, รหัส: ${norm(p.studentId) || "—"}`;
      background = "#fff1f2"; foreground = "#b42318"; border = "#fecdd3";
    } else if (state.reason === "receipt_not_found" || state.reason === "receipt_error" || state.reason === "post_failed") {
      message = "ยังไม่พบใบรับจาก Google Sheets — ระบบเก็บผลไว้และจะลองส่งใหม่อัตโนมัติ";
      background = "#fff7ed"; foreground = "#b45309"; border = "#fed7aa";
    } else if (state.reason === "endpoint_not_configured") {
      message = "ยังไม่พบ URL /exec ของ Google Sheets";
      background = "#fff1f2"; foreground = "#b42318"; border = "#fecdd3";
    }

    box.style.display = "block";
    box.style.background = background;
    box.style.color = foreground;
    box.style.borderColor = border;
    box.textContent = message;
  }

  function report(extra) {
    const status = Object.assign({
      version: VERSION,
      endpoint: endpoint(),
      endpointConfigured: endpointReady(),
      queued: outbox().length,
      verifiedCount: sentSet().size,
      updatedAt: new Date().toISOString()
    }, extra || {});
    window.EAP_WORD_FORM_POST_STATUS = status;
    draw(status);
    return status;
  }

  function jsonp(url, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      const callback = `__eapwqFormReceipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const script = document.createElement("script");
      let ended = false;
      const finish = (error, data) => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore) {}
        error ? reject(error) : resolve(data);
      };
      const timer = setTimeout(() => finish(new Error("receipt_timeout")), timeoutMs);
      window[callback] = (data) => finish(null, data);
      script.onerror = () => finish(new Error("receipt_network_error"));
      script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function hasReceipt(fingerprint) {
    if (!endpointReady()) return { ok:false, reason:"endpoint_not_configured" };
    try {
      const payload = await jsonp(`${endpoint()}?action=eap_word_teacher&section=${encodeURIComponent(GROUP)}`);
      const logs = Array.isArray(payload && payload.logs) ? payload.logs : [];
      return { ok:true, found:logs.some((row) => norm(row && row.fingerprint) === norm(fingerprint)) };
    } catch (error) {
      return { ok:false, reason:"receipt_error" };
    }
  }

  function formPost(record) {
    return new Promise((resolve) => {
      if (!endpointReady()) {
        resolve({ ok:false, reason:"endpoint_not_configured" });
        return;
      }

      const frameName = `eapWordQuestPost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const frame = document.createElement("iframe");
      const form = document.createElement("form");
      const payload = {
        action: "eap_word_attempt",
        schemaVersion: VERSION,
        clientTs: new Date().toISOString(),
        pageUrl: location.href,
        userAgent: navigator.userAgent || "",
        record
      };

      frame.name = frameName;
      frame.style.cssText = "position:absolute;width:1px;height:1px;border:0;left:-9999px;top:-9999px";
      form.method = "POST";
      form.action = endpoint();
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
          resolve({ ok:true });
        }, 500);
      } catch (error) {
        try { form.remove(); frame.remove(); } catch (ignore) {}
        resolve({ ok:false, reason:"post_failed" });
      }
    });
  }

  async function deliver(record) {
    if (!record || !record.fingerprint || sentSet().has(record.fingerprint) || inFlight.has(record.fingerprint)) return;
    inFlight.add(record.fingerprint);
    try {
      report({ ok:true, reason:"checking", sessionId:record.sessionId });
      const posted = await formPost(record);
      if (!posted.ok) {
        enqueue(record);
        report({ ok:false, reason:posted.reason || "post_failed", sessionId:record.sessionId });
        return;
      }

      for (const delay of RETRY_DELAYS) {
        await wait(delay);
        const receipt = await hasReceipt(record.fingerprint);
        if (receipt.ok && receipt.found) {
          markSent(record.fingerprint);
          dequeue(record.fingerprint);
          report({ ok:true, verified:true, sessionId:record.sessionId });
          return;
        }
      }

      enqueue(record);
      report({ ok:false, reason:"receipt_not_found", sessionId:record.sessionId });
    } finally {
      inFlight.delete(record.fingerprint);
    }
  }

  function capture(raw) {
    const normalized = normalize(raw);
    if (!normalized.record) {
      report({ ok:false, reason:normalized.reason, profile:normalized.profile || profile() });
      return;
    }
    enqueue(normalized.record);
    deliver(normalized.record);
  }

  function recover() {
    const last = window.EAP_V195_LAST_RESULT || window.EAP_V196_LAST_RESULT || window.EAP_V192_LAST_RESULT;
    if (last && last.sessionId) capture(last);
    try {
      const rows = typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : [];
      if (Array.isArray(rows)) rows.slice(-120).forEach(capture);
    } catch (error) {}
    outbox().forEach(deliver);
  }

  function start() {
    window.addEventListener("eap-core-run-finished", (event) => capture(event && event.detail));
    const observer = new MutationObserver(() => {
      const summary = document.getElementById("summaryScreen");
      if (summary && summary.classList.contains("active")) {
        draw(window.EAP_WORD_FORM_POST_STATUS || { ok:true, reason:"checking" });
        recover();
      }
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    document.addEventListener("click", () => setTimeout(recover, 140), true);
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recover(); });
    [700, 1800, 3600].forEach((delay) => setTimeout(recover, delay));
  }

  window.inspectEapWordQuestFormPostBridge = () => ({
    version: VERSION,
    endpoint: endpoint(),
    endpointConfigured: endpointReady(),
    profile: profile(),
    queued: outbox().length,
    verifiedCount: sentSet().size,
    status: window.EAP_WORD_FORM_POST_STATUS || null
  });
  window.flushEapWordQuestFormPostBridge = recover;

  start();
  report({ ok:true, reason:"ready" });
  console.info("[EAP Word Quest] form-post receipt bridge ready", window.inspectEapWordQuestFormPostBridge());
})();
