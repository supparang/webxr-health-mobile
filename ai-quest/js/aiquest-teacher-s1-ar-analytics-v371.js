/* =========================================================
   CSAI2102 AI Quest — Teacher S1 AR Event Analytics
   File: /ai-quest/js/aiquest-teacher-s1-ar-analytics-v371.js
   Version: v3.7.3-s1-ar-event-analytics

   Reads `s1_ar_complete` events from Server Summary.
   These are supplementary events, not session_attempt rows.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v3.7.3-s1-ar-event-analytics";
  const $ = (id) => document.getElementById(id);
  let lastFingerprint = "";
  let detailObserver = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[ch]));
  }

  function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function parse(value) {
    if (!value || typeof value === "object") return value || null;
    try { return JSON.parse(String(value)); } catch (_) { return null; }
  }

  function app() {
    return window.AIQUEST_TEACHER_ONLY_DASHBOARD || null;
  }

  function serverStudents() {
    const raw = app()?.state?.raw || {};
    const data = raw?.data || raw;
    const all = data?.allStudents || raw?.allStudents || [];
    return Array.isArray(all) ? all : [];
  }

  function eventRecord(event, student) {
    if (String(event?.eventType || "").toLowerCase() !== "s1_ar_complete") return null;

    const trace = parse(event.yourAnswer) || {};
    const score = Math.round(num(trace.score ?? trace.arScore ?? event.scoreDelta));
    const correct = num(trace.correct ?? trace.arCorrect ?? event.combo);
    const total = num(trace.total ?? trace.arTotal);
    const help = num(trace.helpUsed ?? trace.arHelpUsed);
    const seconds = num(trace.usedSec ?? trace.arUsedSec);
    const input = String(trace.inputMode ?? trace.arInputMode ?? "hand_or_mouse_touch");
    const completedAt = String(trace.completedAt || event.serverTs || "");

    return {
      studentId: String(student?.studentId || ""),
      studentName: String(student?.studentName || ""),
      score,
      correct,
      total,
      help,
      seconds,
      input,
      completedAt,
      source: "session_events"
    };
  }

  function records() {
    const list = [];
    serverStudents().forEach((student) => {
      const events = Array.isArray(student?.recentEvents) ? student.recentEvents : [];
      events.forEach((event) => {
        const record = eventRecord(event, student);
        if (record) list.push(record);
      });
    });

    // Latest completed AR activity by learner.
    const latest = new Map();
    list.forEach((record) => {
      const key = record.studentId || `anonymous-${record.completedAt}`;
      const previous = latest.get(key);
      const previousAt = Date.parse(previous?.completedAt || "") || 0;
      const currentAt = Date.parse(record.completedAt || "") || 0;
      if (!previous || currentAt >= previousAt) latest.set(key, record);
    });

    return Array.from(latest.values()).sort((a, b) =>
      String(a.studentId).localeCompare(String(b.studentId), undefined, { numeric: true })
    );
  }

  function labelInput(value) {
    const key = String(value || "").toLowerCase();
    if (key.includes("pinch")) return "Hand pinch";
    if (key.includes("dwell")) return "Hand dwell";
    if (key.includes("hand")) return "Hand / Mouse / Touch";
    if (key.includes("mouse") || key.includes("touch")) return "Mouse / Touch";
    return value || "ไม่ระบุ";
  }

  function timeText(value) {
    const seconds = Math.max(0, Math.round(num(value)));
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  }

  function dateText(value) {
    const time = Date.parse(value || "");
    return time ? new Date(time).toLocaleString() : (value || "-");
  }

  function container() {
    let box = $("s1ArTeacherAnalyticsV371");
    if (box) return box;

    const studentsCard = $("studentsBox")?.closest(".card");
    if (!studentsCard) return null;

    box = document.createElement("section");
    box.id = "s1ArTeacherAnalyticsV371";
    box.className = "card";
    box.style.marginBottom = "14px";
    studentsCard.insertAdjacentElement("beforebegin", box);
    return box;
  }

  function renderDashboard() {
    const box = container();
    if (!box) return;

    const data = records();
    if (!data.length) {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">S1 AR Practice</h2>
            <p class="muted" style="margin:7px 0 0">AI Object Scanner • กิจกรรมเสริม แยกจากคะแนน S1 หลัก</p>
          </div>
          <span class="pill warn">ยังไม่มี AR event จาก Server Summary</span>
        </div>
        <div class="loading" style="margin-top:12px">
          เมื่อผู้เรียนจบ AR ระบบจะบันทึก <code>s1_ar_complete</code> ลง session_events อัตโนมัติ<br>
          ไม่ต้องเล่น S1 ปกติซ้ำ และกิจกรรมนี้ไม่เพิ่ม/ไม่ทับคะแนน S1 หลัก
        </div>
      `;
      return;
    }

    const average = Math.round(data.reduce((sum, row) => sum + row.score, 0) / data.length);
    const correct = data.reduce((sum, row) => sum + row.correct, 0);
    const total = data.reduce((sum, row) => sum + row.total, 0);

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">S1 AR Practice</h2>
          <p class="muted" style="margin:7px 0 0">AI Object Scanner • หลักฐานกิจกรรมเสริมจาก session_events</p>
        </div>
        <span class="pill good">✓ Real AR events ${data.length} คน</span>
      </div>
      <div class="grid cols3" style="margin-top:12px">
        <div class="metric"><span class="muted">AR completed</span><b>${data.length}</b></div>
        <div class="metric"><span class="muted">Avg AR score</span><b>${average}%</b></div>
        <div class="metric"><span class="muted">Correct / total</span><b>${correct}/${total || "-"}</b></div>
      </div>
      <div style="overflow:auto;margin-top:12px">
        <table>
          <thead>
            <tr>
              <th>Student</th><th>AR score</th><th>Correct</th><th>Help</th>
              <th>Time</th><th>Input</th><th>Completed</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((row) => `
              <tr>
                <td><b>${esc(row.studentId || "-")}</b><br><span class="muted">${esc(row.studentName || "")}</span></td>
                <td><span class="pill ${row.score >= 85 ? "good" : "warn"}">${esc(row.score)}%</span></td>
                <td>${esc(row.correct)}/${esc(row.total || "-")}</td>
                <td>${esc(row.help)}</td>
                <td>${esc(timeText(row.seconds))}</td>
                <td>${esc(labelInput(row.input))}</td>
                <td>${esc(dateText(row.completedAt))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function currentStudentId() {
    const text = $("detailBox")?.textContent || "";
    const match = text.match(/Student\s+([^\s]+)/i);
    return match ? String(match[1]) : "";
  }

  function renderDetail() {
    const modal = $("detailModal");
    const detail = $("detailBox");
    if (!modal?.classList.contains("open") || !detail) return;
    $("s1ArDetailV371")?.remove();

    const row = records().find((item) => item.studentId === currentStudentId());
    if (!row) return;

    const card = document.createElement("section");
    card.id = "s1ArDetailV371";
    card.className = "card";
    card.style.marginTop = "12px";
    card.innerHTML = `
      <h3>S1 AR Practice <span class="pill blue">Supplementary</span></h3>
      <p class="muted" style="margin-top:-3px">AI Object Scanner • session_events • ไม่ทับคะแนน S1 หลัก</p>
      <div class="grid cols3" style="margin-top:10px">
        <div class="metric"><span class="muted">AR score</span><b>${esc(row.score)}%</b></div>
        <div class="metric"><span class="muted">Correct</span><b>${esc(row.correct)}/${esc(row.total || "-")}</b></div>
        <div class="metric"><span class="muted">Help</span><b>${esc(row.help)}</b></div>
      </div>
      <p style="margin:12px 0 0"><b>Control:</b> ${esc(labelInput(row.input))} &nbsp;•&nbsp; <b>Time:</b> ${esc(timeText(row.seconds))}</p>
    `;

    const progress = Array.from(detail.querySelectorAll(".card,section")).find((element) =>
      /Session Progress/i.test(element.textContent || "")
    );
    if (progress) progress.before(card);
    else detail.appendChild(card);
  }

  function fingerprint() {
    const students = serverStudents();
    return students.map((student) => {
      const events = Array.isArray(student.recentEvents) ? student.recentEvents : [];
      return `${student.studentId}:${events.map((event) => `${event.eventType}|${event.serverTs}|${event.yourAnswer}`).join("~")}`;
    }).join("||");
  }

  function refresh() {
    const next = fingerprint();
    if (next !== lastFingerprint || !$("s1ArTeacherAnalyticsV371")) {
      lastFingerprint = next;
      renderDashboard();
    }
    renderDetail();
  }

  function boot() {
    refresh();
    setInterval(refresh, 900);

    const detail = $("detailBox");
    if (detail && !detailObserver) {
      detailObserver = new MutationObserver(() => setTimeout(renderDetail, 0));
      detailObserver.observe(detail, { childList: true, subtree: true });
    }
  }

  window.AIQUEST_TEACHER_S1_AR_ANALYTICS = {
    version: VERSION,
    getRecords: records,
    refresh
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();

  console.log("[AIQuest] " + VERSION + " loaded", window.AIQUEST_TEACHER_S1_AR_ANALYTICS);
})();
