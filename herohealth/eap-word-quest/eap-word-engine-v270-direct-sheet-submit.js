/* =========================================================
   EAP Word Quest • Direct Sheets Submit
   File: /herohealth/eap-word-quest/eap-word-engine-v270-direct-sheet-submit.js
   Version: v2.7.0-DIRECT-SHEET-SUBMIT-122

   Design goals
   - One sender only; no background ledger scan and no persistent delivery queue.
   - Submits only the round currently shown by the v172 summary/logger.
   - Uses a hidden HTML form POST that matches Apps Script e.parameter.payload.
   - Verifies the exact fingerprint via JSONP Teacher API before showing success.
   - Keeps no learner progress in this module and never clears Local Storage.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.7.0-DIRECT-SHEET-SUBMIT-122";
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbwxHHHw6Pk4rMdDnTM_6jxcL2GYdABc0hHFOlc8r_NS4D-siLYv0P-OZg3cfINE9A8X5A/exec";
  const GROUP = "122";
  const FLOW = new Set([
    "S1", "S2", "S3", "BG1", "S4", "S5", "S6", "BG2",
    "S7", "S8", "S9", "BG3", "S10", "S11", "S12", "BG4",
    "S13", "S14", "S15", "BG5"
  ]);

  if (window.__EAP_WORD_V270_DIRECT_SHEET_SUBMIT__) return;
  window.__EAP_WORD_V270_DIRECT_SHEET_SUBMIT__ = true;

  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  const sent = new Set();
  const pending = new Set();
  let lastSummaryToken = "";

  function validIdentity(record) {
    const id = norm(record && record.studentId).toLowerCase();
    const name = norm(record && record.studentName).toLowerCase();
    return Boolean(id && name) &&
      !["anon", "no-id", "unknown"].includes(id) &&
      !["anonymous", "hero", "student", "unknown"].includes(name);
  }

  function validRecord(record) {
    return Boolean(record) &&
      FLOW.has(norm(record.sessionId).toUpperCase()) &&
      validIdentity(record);
  }

  function currentRecord() {
    let record = window.EAP_LAST_LEARNING_LOG || null;

    const summary = window.EAP_V172_SUMMARY_STATE;
    if (
      (!record || !validRecord(record)) &&
      summary &&
      summary.result &&
      typeof window.logEapV172SummaryNow === "function"
    ) {
      try {
        record = window.logEapV172SummaryNow();
      } catch (error) {
        console.warn("[EAP Word Quest] could not build direct sheet record", error);
      }
    }

    if (!validRecord(record)) return null;

    const copy = Object.assign({}, record, {
      source: "v270-direct-current-summary",
      group: GROUP,
      section: GROUP,
      sessionId: norm(record.sessionId).toUpperCase(),
      studentName: norm(record.studentName),
      studentId: norm(record.studentId),
      playedAt: record.playedAt || new Date().toISOString()
    });

    if (!copy.fingerprint) {
      copy.fingerprint = [
        GROUP,
        copy.studentId,
        copy.studentName,
        copy.sessionId,
        copy.correct || 0,
        copy.total || 0,
        copy.accuracy || 0,
        String(copy.playedAt).slice(0, 19)
      ].join("|");
    }

    return copy;
  }

  function statusBox() {
    let node = document.getElementById("eapWordDirectSheetsStatus");
    if (node) return node;

    const summary = document.getElementById("summaryScreen");
    const card = summary && summary.querySelector(".summary-card");
    if (!card) return null;

    node = document.createElement("section");
    node.id = "eapWordDirectSheetsStatus";
    node.setAttribute("aria-live", "polite");
    node.style.cssText = "display:none;margin:12px 0;padding:13px 16px;border:1px solid #bfdbfe;border-radius:16px;background:#eff6ff;color:#174ea6;font-weight:850;line-height:1.45";

    const actions = card.querySelector(".summary-actions");
    if (actions) actions.before(node);
    else card.appendChild(node);

    return node;
  }

  function show(message, state) {
    const summary = document.getElementById("summaryScreen");
    if (!summary || !summary.classList.contains("active")) return;

    const node = statusBox();
    if (!node) return;

    const styles = {
      working: ["#eff6ff", "#174ea6", "#bfdbfe"],
      success: ["#ecfdf5", "#047857", "#bbf7d0"],
      warning: ["#fff7ed", "#b45309", "#fed7aa"],
      error: ["#fff1f2", "#b42318", "#fecdd3"]
    };

    const colors = styles[state || "working"] || styles.working;
    node.style.display = "block";
    node.style.background = colors[0];
    node.style.color = colors[1];
    node.style.borderColor = colors[2];
    node.innerHTML = "";

    const text = document.createElement("span");
    text.textContent = message;
    node.appendChild(text);

    if (state === "warning" || state === "error") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "ส่งผลรอบนี้อีกครั้ง";
      retry.style.cssText = "margin-left:10px;border:1px solid currentColor;border-radius:9px;background:transparent;color:inherit;padding:5px 9px;font-weight:900;cursor:pointer";
      retry.addEventListener("click", () => submitCurrent("manual_retry"));
      node.appendChild(retry);
    }
  }

  function formPost(record) {
    return new Promise((resolve) => {
      const frameName = "eapWordDirectPost_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
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
      frame.setAttribute("aria-hidden", "true");
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

  function jsonp(url, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      const callback = "__eapwq_v270_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const script = document.createElement("script");
      let closed = false;

      const finish = (error, data) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        try { delete window[callback]; } catch (ignore) { window[callback] = undefined; }
        try { script.remove(); } catch (ignore) {}
        error ? reject(error) : resolve(data);
      };

      const timer = setTimeout(() => finish(new Error("receipt_timeout")), timeoutMs);
      window[callback] = (data) => finish(null, data);
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
      console.warn("[EAP Word Quest] direct receipt check failed", error);
      return false;
    }
  }

  async function submit(record, reason) {
    if (!record || !validRecord(record)) {
      show("ยังส่งผลไม่ได้ เพราะชื่อหรือรหัสนักศึกษาไม่ครบ", "error");
      return;
    }

    const fp = norm(record.fingerprint);
    if (!fp || sent.has(fp) || pending.has(fp)) return;

    pending.add(fp);
    show("กำลังส่งผลรอบล่าสุดเข้า Google Sheets…", "working");

    try {
      const posted = await formPost(record);
      if (!posted) {
        show("ส่งผลรอบล่าสุดไม่สำเร็จ กรุณากดส่งอีกครั้ง", "warning");
        return;
      }

      const delays = [1200, 2600, 4200];
      for (const delay of delays) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (await verify(fp)) {
          sent.add(fp);
          show("ผลรอบล่าสุดบันทึก Google Sheets ยืนยันแล้ว ✓", "success");
          console.info("[EAP Word Quest] direct sheet receipt confirmed", { version: VERSION, reason, fingerprint: fp });
          return;
        }
      }

      show("ส่งคำขอแล้ว แต่ยังไม่พบแถวใน Google Sheets กรุณากดส่งอีกครั้ง", "warning");
    } finally {
      pending.delete(fp);
    }
  }

  function submitCurrent(reason) {
    const record = currentRecord();
    if (!record) {
      const summary = window.EAP_V172_SUMMARY_STATE;
      if (summary && summary.result) {
        show("พบผลรอบนี้แล้ว แต่ Profile ยังไม่ครบ กรุณากลับหน้าแรกและบันทึกชื่อกับรหัส", "error");
      }
      return;
    }

    const token = [record.sessionId, record.playedAt, record.fingerprint].join("|");
    if (reason !== "manual_retry" && token === lastSummaryToken) return;
    lastSummaryToken = token;
    submit(record, reason || "summary_ready");
  }

  function summaryActive() {
    const summary = document.getElementById("summaryScreen");
    return Boolean(summary && summary.classList.contains("active"));
  }

  window.addEventListener("eap-core-run-finished", () => {
    setTimeout(() => submitCurrent("core_finished"), 900);
  });

  document.addEventListener("click", () => {
    if (summaryActive()) setTimeout(() => submitCurrent("summary_click"), 250);
  }, true);

  setTimeout(() => {
    if (summaryActive()) submitCurrent("startup_summary");
  }, 1800);

  window.submitEapWordQuestCurrentResultToSheet = () => submitCurrent("manual_retry");
  window.inspectEapWordQuestDirectSheetSubmit = () => ({
    version: VERSION,
    endpoint: ENDPOINT,
    summaryActive: summaryActive(),
    currentRecord: currentRecord(),
    pending: Array.from(pending),
    sent: Array.from(sent)
  });

  console.info("[EAP Word Quest] direct sheet submit ready", { version: VERSION });
})();
