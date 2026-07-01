/* =========================================================
   EAP Word Quest • Current Summary Sheets Receipt
   File: /herohealth/eap-word-quest/eap-word-engine-v265-current-summary-receipt.js
   Version: v2.6.5-CURRENT-SUMMARY-RECEIPT-122

   Captures the exact current EAP_V172_SUMMARY_STATE rather than relying only
   on history/backfill. It posts the current round through a hidden form and
   marks it complete only when the Sheets teacher API returns the same
   fingerprint. Old attempt history remains untouched.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.5-CURRENT-SUMMARY-RECEIPT-122";
  const GROUP = "122";
  const FLOW = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);
  const OUTBOX_KEY = "EAP_WORD_QUEST_CURRENT_SUMMARY_OUTBOX_V265";
  const SENT_KEY = "EAP_WORD_QUEST_CURRENT_SUMMARY_SENT_V265";
  const LAST_KEY = "EAP_WORD_QUEST_CURRENT_SUMMARY_LAST_V265";
  const RETRY = [800, 1800, 3200];

  if (window.__EAP_WORD_V265_CURRENT_SUMMARY_RECEIPT__) return;
  window.__EAP_WORD_V265_CURRENT_SUMMARY_RECEIPT__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const truthy = (value) => value === true || value === 1 || String(value).toLowerCase() === "true" || String(value) === "1";
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function jsonRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function jsonWrite(key, value) {
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
    const config = window.EAP_WORD_SHEET_CONFIG && window.EAP_WORD_SHEET_CONFIG.endpoint;
    try {
      return norm(helper || config || localStorage.getItem("EAP_WORD_SHEET_ENDPOINT") || "");
    } catch (error) {
      return norm(helper || config || "");
    }
  }

  function endpointReady() {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(endpoint());
  }

  function profile() {
    const saved = jsonRead("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    const nameInput = document.getElementById("studentNameInput");
    const idInput = document.getElementById("studentIdInput");
    return {
      studentName: norm((nameInput && nameInput.value) || saved.studentName || saved.name || ""),
      studentId: norm((idInput && idInput.value) || saved.studentId || saved.id || "")
    };
  }

  function usableIdentity(identity) {
    const id = norm(identity.studentId).toLowerCase();
    const name = norm(identity.studentName).toLowerCase();
    return Boolean(id && name) &&
      !["anon", "no-id", "unknown"].includes(id) &&
      !["anonymous", "hero", "student", "unknown"].includes(name);
  }

  function list(value) {
    if (Array.isArray(value)) return value.map(norm).filter(Boolean);
    if (typeof value === "string") return value.split(/[|,;]/).map(norm).filter(Boolean);
    return [];
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function fingerprint(record) {
    return [
      GROUP,
      norm(record.studentId),
      norm(record.studentName),
      norm(record.sessionId),
      Math.round(number(record.correct)),
      Math.round(number(record.total)),
      Math.round(number(record.accuracy)),
      norm(record.playedAt).slice(0, 19)
    ].join("|");
  }

  function recordFromSummaryState(state) {
    const result = state && state.result;
    const sessionId = norm(result && (result.id || result.sessionId)).toUpperCase();
    if (!result || !FLOW.has(sessionId)) return { record:null, reason:"invalid_summary" };

    const identity = profile();
    if (!usableIdentity(identity)) return { record:null, reason:"profile_incomplete", profile:identity };

    const correct = Math.max(0, Math.round(number(result.correct)));
    const total = Math.max(1, Math.round(number(result.total || result.questions, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(number(result.accuracy, (correct / total) * 100))));
    const playedAt = norm(state.renderedAt || result.playedAt || new Date().toISOString());
    const passThreshold = threshold(sessionId);

    const record = {
      source: "v265-current-summary-state",
      course: "EAP",
      game: "EAP Word Quest",
      group: GROUP,
      section: GROUP,
      studentName: identity.studentName,
      studentId: identity.studentId,
      arcId: norm(result.arcId),
      arc: norm(result.arc),
      sessionId,
      sessionTitle: norm(result.title || result.sessionTitle || sessionId),
      sessionType: norm(result.sessionType || (/^BG/.test(sessionId) ? "boss" : "session")),
      correct,
      total,
      accuracy,
      xp: Math.max(0, Math.round(number(result.xp, result.score))),
      score: Math.max(0, Math.round(number(result.score, result.xp))),
      maxCombo: Math.max(0, Math.round(number(result.maxCombo || result.combo))),
      passed: truthy(result.passed) || accuracy >= passThreshold,
      passThreshold,
      passStatus: norm(result.passStatus),
      cefrLevel: norm(result.cefrLevel || result.level),
      aiDifficulty: norm(result.aiDifficulty),
      aiPrediction: norm(result.aiPrediction),
      hintUsed: Math.max(0, Math.round(number(result.hintUsed || result.hintsUsed))),
      weakWords: list(result.weakWords || result.weak || result.weakWord),
      itemTypeWeak: list(result.itemTypeWeak),
      levelWeak: list(result.levelWeak),
      responseTimeAvg: Math.max(0, number(result.responseTimeAvg)),
      attempt: Math.max(1, Math.round(number(result.attempt, 1))),
      bossHp: Math.max(0, Math.round(number(result.boss && result.boss.hp))),
      bossMaxHp: Math.max(0, Math.round(number(result.boss && result.boss.max))),
      isBoss: truthy(result.isBoss) || /^BG/.test(sessionId),
      playedAt
    };

    record.fingerprint = fingerprint(record);
    return { record, reason:"" };
  }

  function outbox() {
    const rows = jsonRead(OUTBOX_KEY, []);
    return Array.isArray(rows) ? rows.filter((row) => row && row.fingerprint) : [];
  }

  function writeOutbox(rows) {
    jsonWrite(OUTBOX_KEY, (Array.isArray(rows) ? rows : []).slice(-60));
  }

  function sent() {
    const rows = jsonRead(SENT_KEY, []);
    return new Set(Array.isArray(rows) ? rows.map(norm).filter(Boolean) : []);
  }

  function markSent(value) {
    const rows = Array.from(sent());
    const clean = norm(value);
    if (clean && !rows.includes(clean)) rows.push(clean);
    jsonWrite(SENT_KEY, rows.slice(-180));
  }

  function queue(record) {
    if (!record || !record.fingerprint || sent().has(record.fingerprint)) return false;
    const rows = outbox();
    if (!rows.some((row) => norm(row.fingerprint) === record.fingerprint)) {
      rows.push(record);
      writeOutbox(rows);
      return true;
    }
    return false;
  }

  function dequeue(value) {
    const clean = norm(value);
    writeOutbox(outbox().filter((row) => norm(row.fingerprint) !== clean));
  }

  function statusBox() {
    let node = document.getElementById("eapWordCurrentSummaryReceiptV265");
    if (node) return node;
    const summary = document.getElementById("summaryScreen");
    const card = summary && summary.querySelector(".summary-card");
    if (!card) return null;

    node = document.createElement("section");
    node.id = "eapWordCurrentSummaryReceiptV265";
    node.setAttribute("aria-live", "polite");
    node.style.cssText = "display:none;margin:10px 0 0;padding:13px 16px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#1d4ed8;font-weight:850;line-height:1.45";
    const actions = card.querySelector(".summary-actions");
    if (actions) actions.before(node); else card.appendChild(node);
    return node;
  }

  function renderStatus(status) {
    const summary = document.getElementById("summaryScreen");
    if (!summary || !summary.classList.contains("active")) return;
    const node = statusBox();
    if (!node) return;

    const current = status || window.EAP_WORD_CURRENT_SUMMARY_STATUS || {};
    let text = "กำลังส่งผลรอบล่าสุดเข้า Google Sheets…";
    let bg = "#eff6ff", fg = "#1d4ed8", border = "#bfdbfe";

    if (current.verified) {
      text = `ผลรอบล่าสุดบันทึก Google Sheets ยืนยันแล้ว ✓ (${current.sessionId || "attempt"})`;
      bg = "#ecfdf5"; fg = "#047857"; border = "#bbf7d0";
    } else if (current.reason === "profile_incomplete") {
      text = "ยังไม่ได้ส่งผลรอบล่าสุด เพราะ Student Profile ยังไม่ครบ";
      bg = "#fff1f2"; fg = "#b42318"; border = "#fecdd3";
    } else if (current.reason === "receipt_not_found" || current.reason === "receipt_error") {
      text = "ยังไม่พบใบรับผลรอบล่าสุดจากชีต ระบบเก็บคิวไว้และจะลองส่งซ้ำ";
      bg = "#fff7ed"; fg = "#b45309"; border = "#fed7aa";
    } else if (current.reason === "endpoint_not_configured") {
      text = "ยังไม่พบ URL /exec สำหรับส่งผลรอบล่าสุด";
      bg = "#fff1f2"; fg = "#b42318"; border = "#fecdd3";
    }

    node.style.display = "block";
    node.style.background = bg;
    node.style.color = fg;
    node.style.borderColor = border;
    node.textContent = text;
  }

  function report(extra) {
    const state = Object.assign({
      version: VERSION,
      endpoint: endpoint(),
      endpointConfigured: endpointReady(),
      queued: outbox().length,
      sent: sent().size,
      updatedAt: new Date().toISOString()
    }, extra || {});
    window.EAP_WORD_CURRENT_SUMMARY_STATUS = state;
    renderStatus(state);
    return state;
  }

  function jsonp(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const callback = `__eapwqCurrent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const script = document.createElement("script");
      let finished = false;
      const finish = (error, data) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore) {}
        error ? reject(error) : resolve(data);
      };
      const timer = setTimeout(() => finish(new Error("timeout")), timeoutMs || 9000);
      window[callback] = (data) => finish(null, data);
      script.onerror = () => finish(new Error("network_error"));
      script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function receipt(fingerprintValue) {
    if (!endpointReady()) return { ok:false, reason:"endpoint_not_configured" };
    try {
      const payload = await jsonp(`${endpoint()}?action=eap_word_teacher&section=${encodeURIComponent(GROUP)}`);
      const logs = Array.isArray(payload && payload.logs) ? payload.logs : [];
      return { ok:true, found:logs.some((row) => norm(row && row.fingerprint) === norm(fingerprintValue)) };
    } catch (error) {
      return { ok:false, reason:"receipt_error" };
    }
  }

  function post(record) {
    return new Promise((resolve) => {
      if (!endpointReady()) {
        resolve({ ok:false, reason:"endpoint_not_configured" });
        return;
      }

      const frameName = `eapWordQuestCurrent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      frame.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:0";
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
        }, 650);
      } catch (error) {
        try { form.remove(); frame.remove(); } catch (ignore) {}
        resolve({ ok:false, reason:"post_failed" });
      }
    });
  }

  const running = new Set();
  async function deliver(record) {
    if (!record || !record.fingerprint || sent().has(record.fingerprint) || running.has(record.fingerprint)) return;
    running.add(record.fingerprint);

    try {
      report({ ok:true, reason:"checking", sessionId:record.sessionId });
      const sentResult = await post(record);
      if (!sentResult.ok) {
        queue(record);
        report({ ok:false, reason:sentResult.reason || "post_failed", sessionId:record.sessionId });
        return;
      }

      for (const delay of RETRY) {
        await pause(delay);
        const result = await receipt(record.fingerprint);
        if (result.ok && result.found) {
          markSent(record.fingerprint);
          dequeue(record.fingerprint);
          report({ ok:true, verified:true, sessionId:record.sessionId });
          return;
        }
      }

      queue(record);
      report({ ok:false, reason:"receipt_not_found", sessionId:record.sessionId });
    } finally {
      running.delete(record.fingerprint);
    }
  }

  function captureCurrentSummary() {
    const state = window.EAP_V172_SUMMARY_STATE;
    const normalized = recordFromSummaryState(state);
    if (!normalized.record) {
      if (normalized.reason === "profile_incomplete") {
        report({ ok:false, reason:normalized.reason, profile:normalized.profile });
      }
      return;
    }

    const marker = `${normalized.record.sessionId}|${normalized.record.playedAt}|${normalized.record.fingerprint}`;
    let previous = "";
    try { previous = localStorage.getItem(LAST_KEY) || ""; } catch (error) {}
    if (marker === previous && sent().has(normalized.record.fingerprint)) return;
    try { localStorage.setItem(LAST_KEY, marker); } catch (error) {}

    queue(normalized.record);
    deliver(normalized.record);
  }

  function recover() {
    captureCurrentSummary();
    outbox().forEach(deliver);
  }

  const observer = new MutationObserver(() => {
    const summary = document.getElementById("summaryScreen");
    if (summary && summary.classList.contains("active")) {
      renderStatus(window.EAP_WORD_CURRENT_SUMMARY_STATUS || { ok:true, reason:"checking" });
      setTimeout(recover, 120);
    }
  });

  observer.observe(document.body, { childList:true, subtree:true, characterData:true });
  window.addEventListener("eap-core-run-finished", () => setTimeout(recover, 120));
  document.addEventListener("click", () => setTimeout(recover, 180), true);
  window.addEventListener("online", recover);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recover(); });
  setInterval(captureCurrentSummary, 650);
  [700, 1700, 3300].forEach((delay) => setTimeout(recover, delay));

  window.inspectEapWordQuestCurrentSummaryReceipt = () => ({
    version: VERSION,
    endpoint: endpoint(),
    endpointConfigured: endpointReady(),
    profile: profile(),
    queued: outbox().length,
    sent: sent().size,
    state: window.EAP_V172_SUMMARY_STATE || null,
    status: window.EAP_WORD_CURRENT_SUMMARY_STATUS || null
  });
  window.flushEapWordQuestCurrentSummaryReceipt = recover;

  report({ ok:true, reason:"ready" });
  console.info("[EAP Word Quest] current summary receipt ready", window.inspectEapWordQuestCurrentSummaryReceipt());
})();
