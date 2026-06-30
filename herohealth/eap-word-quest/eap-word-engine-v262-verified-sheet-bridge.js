/* =========================================================
   EAP Word Quest • Verified Google Sheets Bridge
   Version: v2.6.3-RECOVERY-RECEIPT-BRIDGE-122

   Sends completed results, keeps unsent rows locally, and confirms a result
   only after the Teacher API returns the exact fingerprint from Sheets.
   A summary-screen observer is included so the bridge still runs when an
   older completion event is missed by a late-loaded runtime.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.3-RECOVERY-RECEIPT-BRIDGE-122";
  const GROUP = "122";
  const FLOW = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);
  const OUTBOX = "EAP_WORD_QUEST_SHEET_RECEIPT_OUTBOX_V263";
  const SENT = "EAP_WORD_QUEST_SHEET_RECEIPT_SENT_V263";
  const MAX = 900;
  const WAIT = [700, 1600, 3000];
  const inFlight = new Set();
  const lastTry = new Map();

  if (window.__EAP_WORD_V262_VERIFIED_SHEET_BRIDGE__) return;
  window.__EAP_WORD_V262_VERIFIED_SHEET_BRIDGE__ = true;

  const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  const number = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = (v) => v === true || v === 1 || String(v).toLowerCase() === "true" || String(v) === "1";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    const saved = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    const nameInput = document.getElementById("studentNameInput");
    const idInput = document.getElementById("studentIdInput");
    return {
      studentName: norm((nameInput && nameInput.value) || saved.studentName || saved.name || ""),
      studentId: norm((idInput && idInput.value) || saved.studentId || saved.id || "")
    };
  }

  function usableIdentity(studentId, studentName) {
    const id = norm(studentId).toLowerCase();
    const name = norm(studentName).toLowerCase();
    return Boolean(id && name) &&
      !["anon", "no-id", "unknown"].includes(id) &&
      !["anonymous", "hero", "student", "unknown"].includes(name);
  }

  function passThreshold(sessionId) {
    if (sessionId === "BG5") return 75;
    return /^BG/.test(sessionId) ? 70 : 60;
  }

  function fingerprint(record) {
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
    if (!usableIdentity(studentId, studentName)) {
      return { record:null, reason:"profile_incomplete", profile:{ studentId, studentName } };
    }

    const correct = Math.max(0, Math.round(number(input.correct)));
    const total = Math.max(1, Math.round(number(input.total || input.questions, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(number(input.accuracy, (correct / total) * 100))));
    const playedAt = norm(input.playedAt || input.endedAt || input.at || input.updatedAt || new Date().toISOString());
    const threshold = Math.max(0, Math.round(number(input.passThreshold, passThreshold(sessionId))));

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
      passed: bool(input.passed) || accuracy >= threshold,
      passThreshold: threshold,
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
      isBoss: bool(input.isBoss) || /^BG/.test(sessionId),
      playedAt
    };
    record.fingerprint = norm(input.fingerprint) || fingerprint(record);
    return { record, reason:"" };
  }

  function getOutbox() {
    const rows = readJson(OUTBOX, []);
    return Array.isArray(rows) ? rows.filter((row) => row && row.fingerprint) : [];
  }

  function setOutbox(rows) {
    writeJson(OUTBOX, (Array.isArray(rows) ? rows : []).slice(-MAX));
  }

  function getSent() {
    const rows = readJson(SENT, []);
    return new Set(Array.isArray(rows) ? rows.map(norm).filter(Boolean) : []);
  }

  function setSent(value) {
    const rows = Array.from(getSent());
    const fp = norm(value);
    if (fp && !rows.includes(fp)) rows.push(fp);
    writeJson(SENT, rows.slice(-MAX));
  }

  function queue(record) {
    if (!record || !record.fingerprint || getSent().has(record.fingerprint)) return false;
    const rows = getOutbox();
    if (!rows.some((row) => norm(row.fingerprint) === record.fingerprint)) {
      rows.push(record);
      setOutbox(rows);
      return true;
    }
    return false;
  }

  function removeQueued(fingerprintValue) {
    const fp = norm(fingerprintValue);
    setOutbox(getOutbox().filter((row) => norm(row.fingerprint) !== fp));
  }

  function box() {
    let node = document.getElementById("eapWordSheetsReceiptV263");
    if (node) return node;
    const screen = document.getElementById("summaryScreen");
    const card = screen && screen.querySelector(".summary-card");
    if (!card) return null;
    node = document.createElement("section");
    node.id = "eapWordSheetsReceiptV263";
    node.setAttribute("aria-live", "polite");
    node.style.cssText = "display:none;margin:14px 0 0;padding:13px 16px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#1d4ed8;font-weight:850;line-height:1.45";
    const actions = card.querySelector(".summary-actions");
    if (actions) actions.before(node); else card.appendChild(node);
    return node;
  }

  function show(status) {
    const screen = document.getElementById("summaryScreen");
    if (!screen || !screen.classList.contains("active")) return;
    const node = box();
    if (!node) return;

    const state = status || window.EAP_WORD_SHEETS_RECEIPT_STATUS || {};
    const p = state.profile || profile();
    let text = "กำลังตรวจสอบการบันทึก Google Sheets…";
    let background = "#eff6ff", foreground = "#1d4ed8", border = "#bfdbfe";

    if (state.reason === "profile_incomplete") {
      text = `ยังไม่ได้ส่งผล เพราะ Profile ไม่ครบ — ชื่อ: ${norm(p.studentName) || "—"}, รหัส: ${norm(p.studentId) || "—"}`;
      background = "#fff1f2"; foreground = "#b42318"; border = "#fecdd3";
    } else if (state.verified) {
      text = `บันทึก Google Sheets ยืนยันแล้ว ✓ (${state.sessionId || "attempt"})`;
      background = "#ecfdf5"; foreground = "#047857"; border = "#bbf7d0";
    } else if (state.reason === "receipt_not_found" || state.reason === "post_failed" || state.reason === "receipt_error") {
      text = "ยังไม่พบใบรับจาก Google Sheets — ระบบเก็บผลไว้และจะลองส่งใหม่อัตโนมัติ";
      background = "#fff7ed"; foreground = "#b45309"; border = "#fed7aa";
    } else if (state.reason === "endpoint_not_configured") {
      text = "ยังไม่พบ URL /exec ของ Google Sheets";
      background = "#fff1f2"; foreground = "#b42318"; border = "#fecdd3";
    } else if (state.reason === "ready") {
      text = "ระบบตรวจรับ Google Sheets พร้อม — กำลังตรวจผลรอบนี้";
    }

    node.style.display = "block";
    node.style.background = background;
    node.style.color = foreground;
    node.style.borderColor = border;
    node.textContent = text;
  }

  function setStatus(extra) {
    const state = Object.assign({
      version: VERSION,
      endpoint: endpoint(),
      endpointConfigured: endpointReady(),
      queued: getOutbox().length,
      verifiedCount: getSent().size,
      updatedAt: new Date().toISOString()
    }, extra || {});
    window.EAP_WORD_SHEETS_RECEIPT_STATUS = state;
    window.dispatchEvent(new CustomEvent("eap-word-sheets-receipt-status", { detail:state }));
    show(state);
    return state;
  }

  function jsonp(url, timeout = 9000) {
    return new Promise((resolve, reject) => {
      const callback = `__eapwqReceipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const script = document.createElement("script");
      let done = false;
      const finish = (error, data) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore) {}
        error ? reject(error) : resolve(data);
      };
      const timer = setTimeout(() => finish(new Error("receipt_timeout")), timeout);
      window[callback] = (data) => finish(null, data);
      script.onerror = () => finish(new Error("receipt_network_error"));
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

  async function post(record) {
    if (!endpointReady()) return { ok:false, reason:"endpoint_not_configured" };
    try {
      await fetch(endpoint(), {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "eap_word_attempt",
          schemaVersion: VERSION,
          clientTs: new Date().toISOString(),
          pageUrl: location.href,
          userAgent: navigator.userAgent || "",
          record
        })
      });
      return { ok:true };
    } catch (error) {
      return { ok:false, reason:"post_failed" };
    }
  }

  async function deliver(record) {
    if (!record || !record.fingerprint || getSent().has(record.fingerprint)) return;
    const previous = lastTry.get(record.fingerprint) || 0;
    if (inFlight.has(record.fingerprint) || Date.now() - previous < 3500) return;
    inFlight.add(record.fingerprint);
    lastTry.set(record.fingerprint, Date.now());
    try {
      setStatus({ ok:true, reason:"checking", sessionId:record.sessionId });
      const sent = await post(record);
      if (!sent.ok) {
        queue(record);
        setStatus({ ok:false, reason:sent.reason, sessionId:record.sessionId });
        return;
      }
      for (const delay of WAIT) {
        await sleep(delay);
        const result = await receipt(record.fingerprint);
        if (result.ok && result.found) {
          setSent(record.fingerprint);
          removeQueued(record.fingerprint);
          setStatus({ ok:true, verified:true, sessionId:record.sessionId });
          return;
        }
      }
      queue(record);
      setStatus({ ok:false, reason:"receipt_not_found", sessionId:record.sessionId });
    } finally {
      inFlight.delete(record.fingerprint);
    }
  }

  function capture(raw) {
    const normalized = normalize(raw);
    if (!normalized.record) {
      setStatus({ ok:false, reason:normalized.reason, profile:normalized.profile || profile() });
      return;
    }
    queue(normalized.record);
    deliver(normalized.record);
  }

  function recover() {
    const last = window.EAP_V195_LAST_RESULT || window.EAP_V196_LAST_RESULT || window.EAP_V192_LAST_RESULT;
    if (last && last.sessionId) capture(last);
    try {
      const rows = typeof window.readEapWordQuestLogs === "function" ? window.readEapWordQuestLogs() : [];
      if (Array.isArray(rows)) rows.slice(-120).forEach(capture);
    } catch (error) {}
    getOutbox().forEach(deliver);
  }

  function observeSummary() {
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      setTimeout(() => {
        pending = false;
        show(window.EAP_WORD_SHEETS_RECEIPT_STATUS || { reason:"ready" });
        recover();
      }, 120);
    };
    new MutationObserver(refresh).observe(document.body, { childList:true, subtree:true, characterData:true });
    document.addEventListener("click", refresh, true);
    window.addEventListener("eap-core-run-finished", (event) => {
      capture(event && event.detail);
      refresh();
    });
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recover();
    });
    [700, 1800, 3800].forEach((delay) => setTimeout(recover, delay));
  }

  window.inspectEapWordQuestVerifiedSheetBridge = () => ({
    version: VERSION,
    endpoint: endpoint(),
    endpointConfigured: endpointReady(),
    profile: profile(),
    queued: getOutbox().length,
    verifiedCount: getSent().size,
    status: window.EAP_WORD_SHEETS_RECEIPT_STATUS || null
  });
  window.flushEapWordQuestVerifiedSheetBridge = recover;

  observeSummary();
  setStatus({ ok:true, reason:"ready" });
  console.info("[EAP Word Quest] Sheets receipt bridge ready", window.inspectEapWordQuestVerifiedSheetBridge());
})();
