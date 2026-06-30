/* =========================================================
   EAP Word Quest • Verified Google Sheets Bridge
   File: /herohealth/eap-word-quest/eap-word-engine-v262-verified-sheet-bridge.js
   Version: v2.6.2-VERIFIED-SHEET-BRIDGE-122

   Why this exists
   - A no-cors POST can resolve without exposing a server-side error.
   - A result is considered synced only after a JSONP read of the Teacher API
     finds its exact fingerprint in Google Sheets.
   - Invalid profiles are visibly blocked instead of silently disappearing.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.6.2-VERIFIED-SHEET-BRIDGE-122";
  const GROUP = "122";
  const FLOW = new Set([
    "S1","S2","S3","BG1","S4","S5","S6","BG2",
    "S7","S8","S9","BG3","S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ]);
  const OUTBOX_KEY = "EAP_WORD_QUEST_VERIFIED_BRIDGE_OUTBOX_V262";
  const SENT_KEY = "EAP_WORD_QUEST_VERIFIED_BRIDGE_SENT_V262";
  const MAX_OUTBOX = 600;
  const MAX_SENT = 1800;
  const RECEIPT_WAIT_MS = [700, 1500, 2600];

  if (window.__EAP_WORD_V262_VERIFIED_SHEET_BRIDGE__) return;
  window.__EAP_WORD_V262_VERIFIED_SHEET_BRIDGE__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bool = (value) => value === true || value === 1 || String(value).toLowerCase() === "true";
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  function validEndpoint(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\//i.test(norm(url));
  }

  function threshold(sessionId) {
    if (sessionId === "BG5") return 75;
    if (/^BG/.test(sessionId)) return 70;
    return 60;
  }

  function currentProfile() {
    const stored = readJson("EAP_WORD_QUEST_PROFILE_V01", {}) || {};
    const byId = (id) => document.getElementById(id);
    return {
      studentName: norm((byId("studentNameInput") && byId("studentNameInput").value) || stored.studentName || stored.name || ""),
      studentId: norm((byId("studentIdInput") && byId("studentIdInput").value) || stored.studentId || stored.id || "")
    };
  }

  function validIdentity(studentId, studentName) {
    const id = norm(studentId).toLowerCase();
    const name = norm(studentName).toLowerCase();
    return Boolean(id && name) &&
      !["anon", "no-id", "unknown"].includes(id) &&
      !["anonymous", "hero", "student", "unknown"].includes(name);
  }

  function fingerprint(record) {
    return [
      GROUP,
      norm(record.studentId),
      norm(record.studentName).toLowerCase(),
      norm(record.sessionId).toUpperCase(),
      Math.round(num(record.correct)),
      Math.round(num(record.total)),
      Math.round(num(record.accuracy)),
      norm(record.playedAt).slice(0, 19)
    ].join("|");
  }

  function normalize(input) {
    const source = input && typeof input === "object" ? input : {};
    const sessionId = norm(source.sessionId || source.session || source.id).toUpperCase();
    if (!FLOW.has(sessionId)) return { record:null, reason:"invalid_session" };

    const profile = currentProfile();
    const studentId = norm(source.studentId || source.idNumber || source.studentCode || profile.studentId);
    const studentName = norm(source.studentName || source.name || profile.studentName);
    if (!validIdentity(studentId, studentName)) {
      return {
        record:null,
        reason:"profile_incomplete",
        profile:{ studentId, studentName }
      };
    }

    const correct = Math.max(0, Math.round(num(source.correct)));
    const total = Math.max(1, Math.round(num(source.total || source.questions, correct || 1)));
    const accuracy = Math.max(0, Math.min(100, Math.round(num(source.accuracy, (correct / total) * 100))));
    const playedAt = norm(source.playedAt || source.endedAt || source.at || source.updatedAt || new Date().toISOString());
    const passThreshold = Math.max(0, Math.round(num(source.passThreshold, threshold(sessionId))));

    const record = {
      source: norm(source.source || "student-core"),
      course: norm(source.course || "EAP"),
      game: norm(source.game || "EAP Word Quest"),
      group: GROUP,
      section: GROUP,
      studentName,
      studentId,
      arcId: norm(source.arcId),
      arc: norm(source.arc),
      sessionId,
      sessionTitle: norm(source.sessionTitle || sessionId),
      sessionType: norm(source.sessionType || (/^BG/.test(sessionId) ? "boss" : "session")),
      correct,
      total,
      accuracy,
      xp: Math.max(0, Math.round(num(source.xp, source.score))),
      score: Math.max(0, Math.round(num(source.score, source.xp))),
      maxCombo: Math.max(0, Math.round(num(source.maxCombo || source.combo))),
      passed: bool(source.passed) || accuracy >= passThreshold,
      passThreshold,
      passStatus: norm(source.passStatus),
      cefrLevel: norm(source.cefrLevel || source.level),
      aiDifficulty: norm(source.aiDifficulty),
      aiPrediction: norm(source.aiPrediction),
      hintUsed: Math.max(0, Math.round(num(source.hintUsed || source.hintsUsed))),
      weakWords: Array.isArray(source.weakWords) ? source.weakWords : [],
      itemTypeWeak: Array.isArray(source.itemTypeWeak) ? source.itemTypeWeak : [],
      levelWeak: Array.isArray(source.levelWeak) ? source.levelWeak : [],
      responseTimeAvg: Math.max(0, num(source.responseTimeAvg)),
      attempt: Math.max(1, Math.round(num(source.attempt, 1))),
      bossHp: Math.max(0, Math.round(num(source.bossHp))),
      bossMaxHp: Math.max(0, Math.round(num(source.bossMaxHp))),
      isBoss: bool(source.isBoss) || /^BG/.test(sessionId),
      playedAt
    };
    record.fingerprint = norm(source.fingerprint) || fingerprint(record);
    return { record, reason:"" };
  }

  function readOutbox() {
    const rows = readJson(OUTBOX_KEY, []);
    return Array.isArray(rows) ? rows.filter((row) => row && row.fingerprint) : [];
  }

  function writeOutbox(rows) {
    writeJson(OUTBOX_KEY, (Array.isArray(rows) ? rows : []).slice(-MAX_OUTBOX));
  }

  function readSent() {
    const rows = readJson(SENT_KEY, []);
    return new Set(Array.isArray(rows) ? rows.map(norm).filter(Boolean) : []);
  }

  function markVerified(fingerprintValue) {
    const rows = Array.from(readSent());
    const value = norm(fingerprintValue);
    if (value && !rows.includes(value)) rows.push(value);
    writeJson(SENT_KEY, rows.slice(-MAX_SENT));
  }

  function enqueue(record) {
    if (!record || !record.fingerprint || readSent().has(record.fingerprint)) return false;
    const rows = readOutbox();
    if (rows.some((row) => norm(row.fingerprint) === record.fingerprint)) return false;
    rows.push(record);
    writeOutbox(rows);
    return true;
  }

  function emitStatus(extra) {
    const status = Object.assign({
      version: VERSION,
      endpoint: endpoint(),
      endpointConfigured: validEndpoint(endpoint()),
      queued: readOutbox().length,
      verifiedCount: readSent().size,
      updatedAt: new Date().toISOString()
    }, extra || {});
    window.EAP_WORD_VERIFIED_SHEET_STATUS = status;
    window.dispatchEvent(new CustomEvent("eap-word-verified-sheet-status", { detail:status }));
    renderStatusCard(status);
  }

  function jsonp(url, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      const callback = `__eapwqReceipt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const script = document.createElement("script");
      const timer = setTimeout(() => done(new Error("receipt_timeout")), timeoutMs);
      let finished = false;

      function done(error, data) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore) {}
        error ? reject(error) : resolve(data);
      }

      window[callback] = (data) => done(null, data);
      script.onerror = () => done(new Error("receipt_network_error"));
      script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function verifyReceipt(fingerprintValue) {
    const url = endpoint();
    if (!validEndpoint(url)) return { ok:false, reason:"endpoint_not_configured" };
    try {
      const payload = await jsonp(`${url}?action=eap_word_teacher&section=${encodeURIComponent(GROUP)}`);
      const logs = Array.isArray(payload && payload.logs) ? payload.logs : [];
      const found = logs.some((row) => norm(row && row.fingerprint) === norm(fingerprintValue));
      return { ok:true, found, count:logs.length };
    } catch (error) {
      return { ok:false, reason:String(error && error.message || error) };
    }
  }

  async function postRecord(record) {
    const url = endpoint();
    if (!validEndpoint(url)) return { ok:false, reason:"endpoint_not_configured" };
    try {
      await fetch(url, {
        method:"POST",
        mode:"no-cors",
        credentials:"omit",
        cache:"no-store",
        keepalive:true,
        headers:{ "Content-Type":"text/plain;charset=utf-8" },
        body:JSON.stringify({
          action:"eap_word_attempt",
          schemaVersion:VERSION,
          clientTs:new Date().toISOString(),
          pageUrl:location.href,
          userAgent:navigator.userAgent || "",
          record
        })
      });
      return { ok:true };
    } catch (error) {
      return { ok:false, reason:String(error && error.message || error) };
    }
  }

  let flushing = false;
  async function flush(reason) {
    if (flushing) return { ok:false, reason:"already_flushing" };
    const url = endpoint();
    if (!validEndpoint(url)) {
      emitStatus({ ok:false, reason:"endpoint_not_configured" });
      return { ok:false, reason:"endpoint_not_configured" };
    }

    flushing = true;
    try {
      const pending = readOutbox();
      const remaining = [];
      let verified = 0;
      let lastFailure = "";

      for (const record of pending) {
        const sent = await postRecord(record);
        if (!sent.ok) {
          remaining.push(record);
          lastFailure = sent.reason || "post_failed";
          continue;
        }

        let receipt = { ok:false, found:false, reason:"not_checked" };
        for (const delay of RECEIPT_WAIT_MS) {
          await pause(delay);
          receipt = await verifyReceipt(record.fingerprint);
          if (receipt.ok && receipt.found) break;
        }

        if (receipt.ok && receipt.found) {
          markVerified(record.fingerprint);
          verified += 1;
        } else {
          remaining.push(record);
          lastFailure = receipt.reason || "server_receipt_not_found";
        }
      }

      writeOutbox(remaining);
      const response = {
        ok:remaining.length === 0,
        reason:remaining.length ? lastFailure || "verification_pending" : reason || "verified",
        verified,
        queued:remaining.length
      };
      emitStatus(response);
      return response;
    } finally {
      flushing = false;
    }
  }

  function localRows() {
    try {
      const rows = typeof window.readEapWordQuestLogs === "function"
        ? window.readEapWordQuestLogs()
        : [];
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      return [];
    }
  }

  async function backfill(reason) {
    let queued = 0;
    let invalid = null;
    const rows = localRows();
    rows.forEach((row) => {
      const normalized = normalize(row);
      if (!normalized.record) {
        if (normalized.reason === "profile_incomplete") invalid = normalized.profile || currentProfile();
        return;
      }
      if (enqueue(normalized.record)) queued += 1;
    });

    if (invalid) {
      emitStatus({ ok:false, reason:"profile_incomplete", profile:invalid, queued:readOutbox().length });
      return { ok:false, reason:"profile_incomplete", queued, profile:invalid };
    }
    return flush(reason || "startup_backfill");
  }

  function statusBox() {
    let box = document.getElementById("eapV262SheetStatus");
    if (box) return box;
    const host = document.querySelector("#summaryScreen .summary-card") || document.getElementById("summaryScreen");
    if (!host) return null;
    box = document.createElement("section");
    box.id = "eapV262SheetStatus";
    box.setAttribute("aria-live", "polite");
    box.style.cssText = "margin:16px 0 0;padding:14px 16px;border:1px solid #dbe4ee;border-radius:16px;font-weight:800;line-height:1.45;display:none";
    const actions = host.querySelector(".summary-actions");
    if (actions) actions.before(box); else host.appendChild(box);
    return box;
  }

  function renderStatusCard(status) {
    const summary = document.getElementById("summaryScreen");
    if (!summary || !summary.classList.contains("active")) return;
    const box = statusBox();
    if (!box) return;
    const state = status || window.EAP_WORD_VERIFIED_SHEET_STATUS || {};
    const profile = state.profile || currentProfile();
    let message = "กำลังตรวจสอบการบันทึก Google Sheets…";
    let tone = "#eff6ff|#1d4ed8|#bfdbfe";

    if (state.reason === "profile_incomplete") {
      message = `ยังไม่ได้บันทึกผลเข้า Google Sheets เพราะ Student Profile ไม่ครบ (ชื่อ: ${norm(profile.studentName) || "—"}, รหัส: ${norm(profile.studentId) || "—"}) กรุณากลับหน้าแรก กรอกชื่อและรหัสจริง แล้วกด Save Profile ก่อนเล่นรอบถัดไป`;
      tone = "#fff1f2|#b42318|#fecdd3";
    } else if (state.ok && state.verified) {
      message = `บันทึก Google Sheets ยืนยันแล้ว ✓ (${state.verified} attempt)`;
      tone = "#ecfdf5|#047857|#bbf7d0";
    } else if (state.ok && state.reason === "verified") {
      message = "บันทึก Google Sheets ยืนยันแล้ว ✓";
      tone = "#ecfdf5|#047857|#bbf7d0";
    } else if (state.reason === "server_receipt_not_found" || state.reason === "verification_pending") {
      message = "ส่งผลแล้ว แต่ยังไม่พบใบรับจาก Google Sheets ระบบจะเก็บคิวไว้และลองส่งซ้ำเมื่อเปิดหน้าเกมอีกครั้ง";
      tone = "#fff7ed|#b45309|#fed7aa";
    } else if (state.reason === "endpoint_not_configured") {
      message = "ยังไม่พบ URL /exec สำหรับ Google Sheets";
      tone = "#fff1f2|#b42318|#fecdd3";
    }

    const [bg, fg, border] = tone.split("|");
    box.style.display = "block";
    box.style.background = bg;
    box.style.color = fg;
    box.style.borderColor = border;
    box.textContent = message;
  }

  async function capture(result) {
    const normalized = normalize(result);
    if (!normalized.record) {
      emitStatus({ ok:false, reason:normalized.reason, profile:normalized.profile || currentProfile() });
      return { ok:false, reason:normalized.reason };
    }
    enqueue(normalized.record);
    return flush("completed_round");
  }

  window.addEventListener("eap-core-run-finished", (event) => {
    const result = event && event.detail;
    if (result && result.sessionId) setTimeout(() => capture(result), 120);
  });

  window.addEventListener("eap-word-verified-sheet-status", (event) => {
    renderStatusCard(event && event.detail);
  });

  document.addEventListener("click", () => {
    setTimeout(() => renderStatusCard(window.EAP_WORD_VERIFIED_SHEET_STATUS), 180);
  }, true);

  window.addEventListener("online", () => backfill("network_restored"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") backfill("page_visible");
  });

  [900, 2400, 5200].forEach((delay) => setTimeout(() => backfill("startup_backfill"), delay));

  window.inspectEapWordQuestVerifiedSheetBridge = () => ({
    version:VERSION,
    endpoint:endpoint(),
    endpointConfigured:validEndpoint(endpoint()),
    queued:readOutbox().length,
    verifiedCount:readSent().size,
    profile:currentProfile(),
    status:window.EAP_WORD_VERIFIED_SHEET_STATUS || null
  });
  window.flushEapWordQuestVerifiedSheetBridge = () => flush("manual_flush");
  window.backfillEapWordQuestVerifiedSheetBridge = () => backfill("manual_backfill");

  emitStatus({ ok:true, reason:"ready" });
  console.info("[EAP Word Quest] verified Sheets bridge ready", window.inspectEapWordQuestVerifiedSheetBridge());
})();
