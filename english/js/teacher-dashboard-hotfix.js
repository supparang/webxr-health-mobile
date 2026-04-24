// /english/js/teacher-dashboard-hotfix.js
// PATCH v20260424-teacher-dashboard-polish-r5
// ✅ Force load teacher=dashboard from Apps Script
// ✅ Smart rows: compact repeated visits by student/section/session
// ✅ S00/Lobby is entry only, not At Risk
// ✅ Student Detail panel with S01–S15 progress and attempts
// ✅ Does not load old teacher.js

(function () {
  "use strict";

  const PATCH = "v20260424-teacher-dashboard-polish-r5";

  const ENDPOINT =
    window.TECHPATH_ATTENDANCE_ENDPOINT ||
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec";

  const state = {
    rawRows: [],
    rows: [],
    filteredRows: [],
    selectedKey: "",
    selectedRow: null,
    filters: {
      search: "",
      section: "",
      status: "",
      session: "",
      minTime: ""
    },
    quick: "all",
    auto: true,
    timer: null
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safe(value, fallback = "-") {
    const s = String(value ?? "").trim();
    return s || fallback;
  }

  function bool(value) {
    if (value === true) return true;
    const s = String(value ?? "").trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtSec(value) {
    const n = Math.max(0, Math.floor(num(value)));
    const m = String(Math.floor(n / 60)).padStart(2, "0");
    const s = String(n % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function fmtDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("th-TH");
  }

  function sessionList() {
    return ["S00", ...Array.from({ length: 15 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`)];
  }

  function normalizeSessionNo(value) {
    const s = String(value ?? "").trim();
    if (!s || s.toLowerCase() === "lobby") return "S00";

    const m = s.match(/^S?(\d{1,2})$/i);
    if (m) return `S${String(Number(m[1])).padStart(2, "0")}`;

    return s;
  }

  function isLearningSession(sessionNo) {
    const s = normalizeSessionNo(sessionNo);
    return /^S(0[1-9]|1[0-5])$/.test(s);
  }

  function isRiskRow(r) {
    if (!isLearningSession(r.sessionNo)) return false;

    const status = String(r.attendanceStatus || "").toLowerCase();

    return (
      status === "failed" ||
      status === "left" ||
      status === "in_progress" ||
      !r.completed ||
      !r.minTimeMet
    );
  }

  function studentKey(r) {
    const id = String(r.studentId || "").trim();
    const name = String(r.studentName || "").trim().toLowerCase();
    const sec = String(r.classSection || "").trim().toLowerCase();
    const s = normalizeSessionNo(r.sessionNo);

    if (id) return `${id}|${sec}|${s}`;
    return `${name || "unknown"}|${sec}|${s}`;
  }

  function personKey(r) {
    const id = String(r.studentId || "").trim();
    const name = String(r.studentName || "").trim().toLowerCase();
    const sec = String(r.classSection || "").trim().toLowerCase();

    if (id) return `${id}|${sec}`;
    return `${name || "unknown"}|${sec}`;
  }

  function rowKey(r) {
    return studentKey(r);
  }

  function samePerson(a, b) {
    return personKey(a) === personKey(b);
  }

  function rowScoreForMerge(r) {
    let score = 0;

    if (r.completed) score += 1000000;
    if (r.minTimeMet) score += 500000;
    if (r.attendanceStatus === "completed") score += 300000;
    if (r.attendanceStatus === "in_progress") score += 100000;

    score += Math.min(99999, Number(r.score) || 0);
    score += Math.min(99999, Number(r.durationSec) || 0);
    score += Math.min(99999, Number(r.activeTimeSec) || 0);

    const t = new Date(r.lastServerTs || r.firstServerTs || r.lastActiveAt || 0).getTime();
    if (Number.isFinite(t)) score += Math.floor(t / 100000000);

    return score;
  }

  function compactLatestRows(rows) {
    const map = new Map();

    rows.forEach((r) => {
      const key = studentKey(r);
      const old = map.get(key);

      if (!old) {
        map.set(key, { ...r, rawCount: 1 });
        return;
      }

      const rawCount = (old.rawCount || 1) + 1;
      const better = rowScoreForMerge(r) >= rowScoreForMerge(old) ? r : old;

      map.set(key, {
        ...better,
        rawCount
      });
    });

    return [...map.values()].sort((a, b) => {
      const sessionCmp = String(a.sessionNo || "").localeCompare(String(b.sessionNo || ""));
      if (sessionCmp !== 0) return sessionCmp;

      const sectionCmp = String(a.classSection || "").localeCompare(String(b.classSection || ""));
      if (sectionCmp !== 0) return sectionCmp;

      return String(a.studentName || "").localeCompare(String(b.studentName || ""));
    });
  }

  function riskReason(r) {
    if (!isLearningSession(r.sessionNo)) return "entry only";
    if (r.attendanceStatus === "failed") return "failed";
    if (r.attendanceStatus === "left") return "left early";
    if (r.attendanceStatus === "in_progress") return "still learning";
    if (!r.completed) return "not completed";
    if (!r.minTimeMet) return "min time fail";
    return "ok";
  }

  function getPersonSmartRows(row) {
    if (!row) return [];
    return state.rows
      .filter((r) => samePerson(r, row))
      .sort((a, b) => normalizeSessionNo(a.sessionNo).localeCompare(normalizeSessionNo(b.sessionNo)));
  }

  function getPersonRawRows(row) {
    if (!row) return [];
    return state.rawRows
      .filter((r) => samePerson(r, row))
      .sort((a, b) => {
        const aa = new Date(a.lastServerTs || a.firstServerTs || a.lastActiveAt || 0).getTime();
        const bb = new Date(b.lastServerTs || b.firstServerTs || b.lastActiveAt || 0).getTime();
        return bb - aa;
      });
  }

  function statusLabel(status) {
    const s = String(status || "").toLowerCase();
    if (s === "completed") return "Completed";
    if (s === "in_progress") return "In Progress";
    if (s === "entered") return "Entered";
    if (s === "failed") return "Failed";
    if (s === "left") return "Left";
    return status || "-";
  }

  function setEndpointPill(text, ok = true) {
    const el = $("endpoint-pill");
    if (!el) return;
    el.textContent = text;
    el.style.borderColor = ok ? "rgba(46,213,115,.35)" : "rgba(255,107,129,.45)";
    el.style.color = ok ? "#b9ffd0" : "#ffd4db";
  }

  function normalizeRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((r) => {
      const sessionNo = normalizeSessionNo(r.sessionNo);

      return {
        visitId: safe(r.visitId, ""),
        studentId: safe(r.studentId, ""),
        studentName: safe(r.studentName, ""),
        classSection: safe(r.classSection, ""),
        sessionNo,
        lessonId: safe(r.lessonId, "techpath-vr"),
        pageUrl: safe(r.pageUrl, ""),
        enteredAt: r.enteredAt || "",
        startedAt: r.startedAt || "",
        finishedAt: r.finishedAt || "",
        lastActiveAt: r.lastActiveAt || "",
        durationSec: num(r.durationSec),
        activeTimeSec: num(r.activeTimeSec),
        actionsCount: num(r.actionsCount),
        score: num(r.score),
        completed: bool(r.completed),
        attendanceStatus: safe(r.attendanceStatus, "entered"),
        minTimeMet: bool(r.minTimeMet),
        firstServerTs: r.firstServerTs || "",
        lastServerTs: r.lastServerTs || "",
        userAgent: safe(r.userAgent, "")
      };
    });
  }

  async function fetchDashboard() {
    const url = new URL(ENDPOINT);
    url.searchParams.set("teacher", "dashboard");
    url.searchParams.set("_t", String(Date.now()));

    setEndpointPill("Endpoint: loading...", true);

    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Teacher dashboard request failed");
    }

    return data;
  }

  function deriveSummary(rows) {
    const total = rows.length;
    const entryRows = rows.filter((r) => !isLearningSession(r.sessionNo));
    const learningRows = rows.filter((r) => isLearningSession(r.sessionNo));

    const completed = learningRows.filter((r) => r.completed).length;
    const minTimeMet = learningRows.filter((r) => r.minTimeMet).length;
    const inProgress = learningRows.filter((r) => r.attendanceStatus === "in_progress").length;
    const atRisk = learningRows.filter((r) => isRiskRow(r)).length;

    const avgDurationSec = learningRows.length
      ? Math.round(learningRows.reduce((s, r) => s + r.durationSec, 0) / learningRows.length)
      : 0;

    const avgActiveTimeSec = learningRows.length
      ? Math.round(learningRows.reduce((s, r) => s + r.activeTimeSec, 0) / learningRows.length)
      : 0;

    const avgScore = learningRows.length
      ? Math.round(learningRows.reduce((s, r) => s + r.score, 0) / learningRows.length)
      : 0;

    return {
      total,
      entryCount: entryRows.length,
      learningCount: learningRows.length,
      completed,
      minTimeMet,
      inProgress,
      atRisk,
      avgDurationSec,
      avgActiveTimeSec,
      avgScore
    };
  }

  function fillSelect(id, items, label) {
    const el = $(id);
    if (!el) return;

    const old = el.value;
    const unique = [...new Set(items.filter(Boolean))].sort();

    el.innerHTML =
      `<option value="">${escapeHtml(label)}</option>` +
      unique.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");

    if (unique.includes(old)) el.value = old;
  }

  function renderSummary(summary) {
    const root = $("summary-cards");
    if (!root) return;

    if (!summary || !summary.total) {
      root.innerHTML = `<div class="panel card"><div class="k">No data</div><div class="v">-</div></div>`;
      return;
    }

    const cards = [
      ["รายการทั้งหมด", summary.total, ""],
      ["เข้าเว็บ / Lobby", summary.entryCount, "warn"],
      ["ด่านเรียนจริง", summary.learningCount, ""],
      ["Completed", summary.completed, "ok"],
      ["Min time ผ่าน", summary.minTimeMet, "ok"],
      ["At Risk", summary.atRisk, summary.atRisk ? "bad" : "ok"],
      ["Avg Duration", fmtSec(summary.avgDurationSec), ""],
      ["Avg Score", summary.avgScore, ""]
    ];

    root.innerHTML = cards.map(([k, v, cls]) => `
      <div class="panel card ${cls}">
        <div class="k">${escapeHtml(k)}</div>
        <div class="v">${escapeHtml(v)}</div>
      </div>
    `).join("");
  }

  function applyFilters() {
    const q = state.filters.search.toLowerCase().trim();

    state.filteredRows = state.rows.filter((r) => {
      if (state.filters.section && r.classSection !== state.filters.section) return false;
      if (state.filters.status && r.attendanceStatus !== state.filters.status) return false;
      if (state.filters.session && r.sessionNo !== state.filters.session) return false;
      if (state.filters.minTime === "yes" && !r.minTimeMet) return false;
      if (state.filters.minTime === "no" && r.minTimeMet) return false;

      if (state.quick === "completed" && (!isLearningSession(r.sessionNo) || !r.completed)) return false;
      if (state.quick === "not_completed" && (!isLearningSession(r.sessionNo) || r.completed)) return false;
      if (state.quick === "in_progress" && (!isLearningSession(r.sessionNo) || r.attendanceStatus !== "in_progress")) return false;
      if (state.quick === "min_fail" && (!isLearningSession(r.sessionNo) || r.minTimeMet)) return false;

      if (q) {
        const hay = [r.studentId, r.studentName, r.classSection, r.sessionNo, r.attendanceStatus]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }

  function tagClass(status) {
    if (status === "completed") return "completed";
    if (status === "in_progress") return "in_progress";
    if (status === "left") return "left";
    if (status === "failed") return "left";
    return "entered";
  }

  function detailMetric(label, value, cls = "") {
    return `
      <div class="mini-card ${cls}">
        <div class="k">${escapeHtml(label)}</div>
        <div class="v">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function renderSessionTimeline(row) {
    const rows = getPersonSmartRows(row).filter((r) => isLearningSession(r.sessionNo));
    const byS = new Map(rows.map((r) => [normalizeSessionNo(r.sessionNo), r]));

    return Array.from({ length: 15 }, (_, i) => {
      const s = `S${String(i + 1).padStart(2, "0")}`;
      const r = byS.get(s);

      if (!r) {
        return `<div class="matrix-badge zero" title="${s}: no data">${s}</div>`;
      }

      const cls = r.completed && r.minTimeMet
        ? "done"
        : r.completed
          ? "warn2"
          : isRiskRow(r)
            ? "risk"
            : "zero";

      const title = `${s}: ${statusLabel(r.attendanceStatus)} • ${fmtSec(r.durationSec)} • score ${r.score}`;

      return `<div class="matrix-badge ${cls}" title="${escapeHtml(title)}">${s}</div>`;
    }).join("");
  }

  function renderAttemptList(row) {
    const attempts = getPersonRawRows(row)
      .filter((r) => normalizeSessionNo(r.sessionNo) === normalizeSessionNo(row.sessionNo))
      .slice(0, 12);

    if (!attempts.length) {
      return `<div class="detail-empty">ยังไม่มี attempt raw สำหรับด่านนี้</div>`;
    }

    return `
      <div class="session-list">
        ${attempts.map((r, idx) => `
          <div class="session-item">
            <div class="top">
              <div class="name">Attempt ${idx + 1} • ${escapeHtml(safe(r.sessionNo))}</div>
              <div class="meta">${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</div>
            </div>
            <div class="meta">
              Status: ${escapeHtml(statusLabel(r.attendanceStatus))}
              • Duration: ${escapeHtml(fmtSec(r.durationSec))}
              • Active: ${escapeHtml(fmtSec(r.activeTimeSec))}
              • Score: ${escapeHtml(r.score)}
              • Min time: ${r.minTimeMet ? "YES" : "NO"}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderStudentDetail(row) {
    const root = $("detail-body");
    if (!root) return;

    if (!row) {
      root.innerHTML = `<div class="detail-empty">เลือกแถวทางซ้ายเพื่อดูรายละเอียดผู้เรียน</div>`;
      return;
    }

    const personRows = getPersonSmartRows(row);
    const learningRows = personRows.filter((r) => isLearningSession(r.sessionNo));
    const entryRows = personRows.filter((r) => !isLearningSession(r.sessionNo));
    const rawRows = getPersonRawRows(row);

    const completed = learningRows.filter((r) => r.completed).length;
    const minOk = learningRows.filter((r) => r.minTimeMet).length;
    const risk = learningRows.filter((r) => isRiskRow(r)).length;
    const bestScore = learningRows.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0);
    const totalDuration = learningRows.reduce((s, r) => s + (Number(r.durationSec) || 0), 0);
    const totalActive = learningRows.reduce((s, r) => s + (Number(r.activeTimeSec) || 0), 0);

    const selectedRisk = riskReason(row);
    const selectedIsRisk = isRiskRow(row);

    root.innerHTML = `
      <div class="kv">
        <div class="k">Student</div>
        <div>${escapeHtml(safe(row.studentName))}</div>

        <div class="k">Student ID</div>
        <div>${escapeHtml(safe(row.studentId))}</div>

        <div class="k">Section</div>
        <div>${escapeHtml(safe(row.classSection))}</div>

        <div class="k">Selected S</div>
        <div>${escapeHtml(safe(row.sessionNo))}</div>

        <div class="k">Status</div>
        <div><span class="tag ${tagClass(row.attendanceStatus)}">${escapeHtml(statusLabel(row.attendanceStatus))}</span></div>

        <div class="k">Risk</div>
        <div class="${selectedIsRisk ? "no" : "yes"}">${escapeHtml(selectedIsRisk ? selectedRisk : "OK")}</div>
      </div>

      <div class="mini-grid">
        ${detailMetric("ด่านเรียนจริง", learningRows.length)}
        ${detailMetric("Completed", completed, completed ? "ok" : "")}
        ${detailMetric("Min time ผ่าน", minOk, minOk ? "ok" : "")}
        ${detailMetric("At Risk", risk, risk ? "bad" : "ok")}
        ${detailMetric("Best Score", bestScore)}
        ${detailMetric("Total Duration", fmtSec(totalDuration))}
        ${detailMetric("Total Active", fmtSec(totalActive))}
        ${detailMetric("Raw Visits", rawRows.length)}
      </div>

      <div class="section-title">S01–S15 Progress</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${renderSessionTimeline(row)}
      </div>

      <div class="section-title">Selected Session</div>
      <div class="mini-grid">
        ${detailMetric("Session", row.sessionNo)}
        ${detailMetric("Duration", fmtSec(row.durationSec))}
        ${detailMetric("Active", fmtSec(row.activeTimeSec))}
        ${detailMetric("Score", row.score)}
        ${detailMetric("Completed", row.completed ? "YES" : "NO", row.completed ? "ok" : "bad")}
        ${detailMetric("Min Time", row.minTimeMet ? "YES" : "NO", row.minTimeMet ? "ok" : "bad")}
      </div>

      <div class="section-title">Attempts ในด่านนี้</div>
      ${renderAttemptList(row)}

      ${entryRows.length ? `
        <div class="section-title">Entry / Lobby records</div>
        <div class="event-list">
          ${entryRows.slice(0, 6).map((r) => `
            <div class="event-item">
              <div class="top">
                <div class="name">${escapeHtml(safe(r.sessionNo))}</div>
                <div class="meta">${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</div>
              </div>
              <div class="meta">${escapeHtml(statusLabel(r.attendanceStatus))} • ${escapeHtml(fmtSec(r.durationSec))}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    `;
  }

  function highlightSelectedRows() {
    document.querySelectorAll("[data-student-row-key]").forEach((tr) => {
      tr.classList.toggle("student-row-active", tr.getAttribute("data-student-row-key") === state.selectedKey);
    });

    document.querySelectorAll("[data-risk-row-key]").forEach((tr) => {
      tr.classList.toggle("student-row-active", tr.getAttribute("data-risk-row-key") === state.selectedKey);
    });
  }

  function selectDetailRow(key) {
    const row = state.filteredRows.find((r) => rowKey(r) === key) || state.rows.find((r) => rowKey(r) === key) || null;
    state.selectedKey = key || "";
    state.selectedRow = row;
    renderStudentDetail(row);
    highlightSelectedRows();
  }

  function renderTable() {
    const tbody = $("students-tbody");
    const meta = $("table-meta");
    if (!tbody || !meta) return;

    meta.textContent = `${state.filteredRows.length} rows`;

    if (!state.filteredRows.length) {
      tbody.innerHTML = `<tr><td colspan="11">ไม่พบข้อมูล</td></tr>`;
      renderStudentDetail(null);
      return;
    }

    tbody.innerHTML = state.filteredRows.map((r) => {
      const key = rowKey(r);

      return `
        <tr data-student-row-key="${escapeHtml(key)}">
          <td>${escapeHtml(safe(r.studentId))}</td>
          <td>
            ${escapeHtml(safe(r.studentName))}
            ${r.rawCount > 1 ? `<br><span style="color:#ffd166;font-size:.78rem;">${r.rawCount} visits merged</span>` : ""}
          </td>
          <td>${escapeHtml(safe(r.classSection))}</td>
          <td>${escapeHtml(safe(r.sessionNo))}</td>
          <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(statusLabel(r.attendanceStatus))}</span></td>
          <td>${escapeHtml(fmtSec(r.durationSec))}</td>
          <td>${escapeHtml(fmtSec(r.activeTimeSec))}</td>
          <td>${escapeHtml(r.score)}</td>
          <td class="${r.completed ? "yes" : "no"}">${r.completed ? "YES" : "NO"}</td>
          <td class="${r.minTimeMet ? "yes" : "no"}">${r.minTimeMet ? "YES" : "NO"}</td>
          <td>${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-student-row-key]").forEach((tr) => {
      tr.addEventListener("click", () => {
        selectDetailRow(tr.getAttribute("data-student-row-key") || "");
      });
    });

    if (state.selectedKey && state.filteredRows.some((r) => rowKey(r) === state.selectedKey)) {
      renderStudentDetail(state.filteredRows.find((r) => rowKey(r) === state.selectedKey));
    } else {
      renderStudentDetail(state.filteredRows[0]);
      state.selectedKey = rowKey(state.filteredRows[0]);
      state.selectedRow = state.filteredRows[0];
    }

    highlightSelectedRows();
  }

  function renderHeatmap() {
    const root = $("session-heatmap-grid");
    const meta = $("heatmap-meta");
    if (!root || !meta) return;

    const sessions = sessionList().map((s) => ({
      sessionNo: s,
      total: 0,
      completed: 0,
      inProgress: 0,
      minFail: 0
    }));

    const map = new Map(sessions.map((x) => [x.sessionNo, x]));

    state.filteredRows.forEach((r) => {
      const item = map.get(r.sessionNo);
      if (!item) return;
      item.total += 1;
      if (r.completed) item.completed += 1;
      if (r.attendanceStatus === "in_progress") item.inProgress += 1;
      if (!r.minTimeMet) item.minFail += 1;
    });

    const active = sessions.filter((x) => x.total > 0).length;
    meta.textContent = `${active} active sessions`;

    root.innerHTML = sessions.map((r) => {
      const lv =
        r.total <= 0 ? "lv0" :
        r.total === 1 ? "lv1" :
        r.total === 2 ? "lv2" :
        r.total <= 4 ? "lv3" :
        r.total <= 7 ? "lv4" : "lv5";

      return `
        <div class="heatmap-cell ${lv}">
          <div class="s">${escapeHtml(r.sessionNo)}</div>
          <div class="n">${escapeHtml(r.total)}</div>
          <div class="m">
            complete ${escapeHtml(r.completed)}<br>
            in progress ${escapeHtml(r.inProgress)}<br>
            min fail ${escapeHtml(r.minFail)}
          </div>
        </div>
      `;
    }).join("");
  }

  function renderRisk() {
    const tbody = $("risk-tbody");
    const meta = $("risk-meta");
    if (!tbody || !meta) return;

    const rows = state.filteredRows.filter((r) => isRiskRow(r));

    meta.textContent = `${rows.length} rows`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6">ไม่มีรายการเสี่ยง</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.slice(0, 80).map((r) => {
      const key = rowKey(r);

      return `
        <tr data-risk-row-key="${escapeHtml(key)}">
          <td>
            ${escapeHtml(safe(r.studentName))}
            <br><span style="color:#9db2c7;font-size:.82rem;">${escapeHtml(safe(r.studentId))}</span>
            <br><span style="color:#ffd166;font-size:.78rem;">${escapeHtml(riskReason(r))}</span>
          </td>
          <td>${escapeHtml(safe(r.classSection))}</td>
          <td>${escapeHtml(safe(r.sessionNo))}</td>
          <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(statusLabel(r.attendanceStatus))}</span></td>
          <td>${escapeHtml(fmtSec(r.durationSec))}</td>
          <td class="${r.minTimeMet ? "yes" : "no"}">${r.minTimeMet ? "YES" : "NO"}</td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-risk-row-key]").forEach((tr) => {
      tr.addEventListener("click", () => {
        selectDetailRow(tr.getAttribute("data-risk-row-key") || "");
      });
    });

    highlightSelectedRows();
  }

  function renderSectionSummary() {
    const tbody = $("section-summary-tbody");
    const meta = $("section-meta");
    if (!tbody || !meta) return;

    const map = new Map();

    state.filteredRows.forEach((r) => {
      const sec = r.classSection || "-";
      if (!map.has(sec)) {
        map.set(sec, {
          section: sec,
          total: 0,
          completed: 0,
          minTimeMet: 0,
          duration: 0,
          active: 0,
          score: 0
        });
      }

      const g = map.get(sec);
      g.total += 1;
      if (r.completed) g.completed += 1;
      if (r.minTimeMet) g.minTimeMet += 1;
      g.duration += r.durationSec;
      g.active += r.activeTimeSec;
      g.score += r.score;
    });

    const rows = [...map.values()].sort((a, b) => a.section.localeCompare(b.section));
    meta.textContent = `${rows.length} sections`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7">ไม่พบข้อมูล</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.section)}</td>
        <td>${escapeHtml(r.total)}</td>
        <td class="yes">${escapeHtml(r.completed)}</td>
        <td class="${r.minTimeMet === r.total ? "yes" : "no"}">${escapeHtml(r.minTimeMet)}</td>
        <td>${escapeHtml(fmtSec(r.total ? Math.round(r.duration / r.total) : 0))}</td>
        <td>${escapeHtml(fmtSec(r.total ? Math.round(r.active / r.total) : 0))}</td>
        <td>${escapeHtml(r.total ? Math.round(r.score / r.total) : 0)}</td>
      </tr>
    `).join("");
  }

  function renderMatrix() {
    const tbody = $("section-session-matrix-tbody");
    const meta = $("matrix-meta");
    if (!tbody || !meta) return;

    const sessions = sessionList().filter((s) => s !== "S00");
    const sections = [...new Set(state.filteredRows.map((r) => r.classSection || "-"))].sort();

    meta.textContent = `${sections.length} sections`;

    if (!sections.length) {
      tbody.innerHTML = `<tr><td colspan="19">ไม่พบข้อมูล</td></tr>`;
      return;
    }

    tbody.innerHTML = sections.map((sec) => {
      const rows = state.filteredRows.filter((r) => (r.classSection || "-") === sec);
      const total = rows.length;
      const done = rows.filter((r) => r.completed).length;
      const minOk = rows.filter((r) => r.minTimeMet).length;

      const cells = sessions.map((s) => {
        const count = rows.filter((r) => r.sessionNo === s).length;
        const cls = count === 0 ? "zero" : count <= 2 ? "low" : count <= 5 ? "mid" : "high";
        return `<td class="center"><span class="matrix-badge ${cls}">${count}</span></td>`;
      }).join("");

      return `
        <tr>
          <td>${escapeHtml(sec)}</td>
          <td>${escapeHtml(total)}</td>
          <td class="yes">${escapeHtml(done)}</td>
          <td class="${minOk === total ? "yes" : "no"}">${escapeHtml(minOk)}</td>
          ${cells}
        </tr>
      `;
    }).join("");
  }

  function renderSectionChips() {
    const root = $("section-chip-row");
    if (!root) return;

    const sections = [...new Set(state.rows.map((r) => r.classSection).filter(Boolean))].sort();

    root.innerHTML =
      `<button class="section-chip ${state.filters.section ? "" : "active"}" data-sec="" type="button">ทุก Section</button>` +
      sections.map((s) =>
        `<button class="section-chip ${state.filters.section === s ? "active" : ""}" data-sec="${escapeHtml(s)}" type="button">${escapeHtml(s)}</button>`
      ).join("");

    root.querySelectorAll("[data-sec]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.filters.section = btn.getAttribute("data-sec") || "";
        const el = $("filter-section");
        if (el) el.value = state.filters.section;
        rerender();
      });
    });
  }

  function rerender() {
    applyFilters();

    renderSummary(deriveSummary(state.filteredRows));
    renderSectionChips();
    renderTable();
    renderHeatmap();
    renderRisk();
    renderSectionSummary();
    renderMatrix();

    const footer = $("footer-note");
    if (footer) {
      footer.textContent =
        `Build: ${PATCH} • Smart rows: ${state.rows.length} • Raw rows: ${state.rawRows.length} • ${new Date().toLocaleString("th-TH")}`;
    }
  }

  async function loadDashboard() {
    try {
      const data = await fetchDashboard();

      state.rawRows = normalizeRows(data.rows || []);
      state.rows = compactLatestRows(state.rawRows);

      setEndpointPill(
        `Endpoint: OK • ${state.rows.length} students/S • raw ${state.rawRows.length}`,
        true
      );

      fillSelect("filter-section", state.rows.map((r) => r.classSection), "ทุก Section");
      fillSelect("filter-status", state.rows.map((r) => r.attendanceStatus), "ทุกสถานะ");
      fillSelect("filter-session", state.rows.map((r) => r.sessionNo), "ทุก S");

      rerender();
    } catch (err) {
      console.error("[Teacher Hotfix] load failed:", err);
      setEndpointPill("Endpoint: ERROR", false);

      const root = $("summary-cards");
      if (root) {
        root.innerHTML = `<div class="panel card bad"><div class="k">Load error</div><div class="v">!</div></div>`;
      }

      const footer = $("footer-note");
      if (footer) footer.textContent = `Build: ${PATCH} • ERROR: ${err.message || err}`;
    }
  }

  function updateQuickUI() {
    document.querySelectorAll("#quick-filters [data-qf]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.qf === state.quick);
    });
  }

  function exportCsv(rows, prefix) {
    if (!rows.length) {
      alert("ไม่มีข้อมูลสำหรับ export");
      return;
    }

    const headers = [
      "visitId",
      "studentId",
      "studentName",
      "classSection",
      "sessionNo",
      "lessonId",
      "enteredAt",
      "startedAt",
      "finishedAt",
      "lastActiveAt",
      "durationSec",
      "activeTimeSec",
      "actionsCount",
      "score",
      "completed",
      "attendanceStatus",
      "minTimeMet",
      "firstServerTs",
      "lastServerTs",
      "rawCount",
      "pageUrl"
    ];

    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${prefix}-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bind() {
    $("filter-search")?.addEventListener("input", (e) => {
      state.filters.search = e.target.value || "";
      rerender();
    });

    $("filter-section")?.addEventListener("change", (e) => {
      state.filters.section = e.target.value || "";
      rerender();
    });

    $("filter-status")?.addEventListener("change", (e) => {
      state.filters.status = e.target.value || "";
      rerender();
    });

    $("filter-session")?.addEventListener("change", (e) => {
      state.filters.session = e.target.value || "";
      rerender();
    });

    $("filter-minTime")?.addEventListener("change", (e) => {
      state.filters.minTime = e.target.value || "";
      rerender();
    });

    $("btn-refresh")?.addEventListener("click", loadDashboard);

    $("btn-auto")?.addEventListener("click", () => {
      state.auto = !state.auto;
      const btn = $("btn-auto");
      if (btn) btn.textContent = `Auto refresh: ${state.auto ? "ON" : "OFF"}`;
    });

    $("btn-export")?.addEventListener("click", () => exportCsv(state.filteredRows, "techpath-attendance"));

    $("btn-export-section")?.addEventListener("click", () => exportCsv(state.filteredRows, "techpath-section"));

    $("btn-show-unfinished")?.addEventListener("click", () => {
      state.quick = "not_completed";
      updateQuickUI();
      rerender();
    });

    $("btn-show-minfail")?.addEventListener("click", () => {
      state.quick = "min_fail";
      updateQuickUI();
      rerender();
    });

    $("btn-clear-fastfilters")?.addEventListener("click", () => {
      state.quick = "all";
      updateQuickUI();
      rerender();
    });

    document.querySelectorAll("#quick-filters [data-qf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.quick = btn.dataset.qf || "all";
        updateQuickUI();
        rerender();
      });
    });

    $("mobile-filter-toggle")?.addEventListener("click", () => {
      document.body.classList.toggle("filters-collapsed");
      const collapsed = document.body.classList.contains("filters-collapsed");
      const btn = $("mobile-filter-toggle");
      if (btn) btn.textContent = collapsed ? "แสดง Filters" : "ซ่อน Filters";
    });
  }

  function ensurePolishCss() {
    if (document.getElementById("teacher-polish-r5-css")) return;

    const style = document.createElement("style");
    style.id = "teacher-polish-r5-css";
    style.textContent = `
      .student-row-active{
        background:rgba(123,237,255,.12)!important;
        outline:1px solid rgba(123,237,255,.35);
        outline-offset:-1px;
      }

      .detail .mini-card.ok .v{
        color:var(--ok);
      }

      .detail .mini-card.bad .v{
        color:var(--bad);
      }

      .detail .matrix-badge{
        margin:0 2px 4px 0;
        cursor:default;
      }

      .detail .matrix-badge.done{
        color:#b9ffd0;
        background:rgba(46,213,115,.13);
        border-color:rgba(46,213,115,.24);
      }

      .detail .matrix-badge.warn2{
        color:#ffeaa7;
        background:rgba(241,196,15,.12);
        border-color:rgba(241,196,15,.20);
      }

      .detail .matrix-badge.risk{
        color:#ffd4db;
        background:rgba(255,107,129,.14);
        border-color:rgba(255,107,129,.24);
      }

      @media (max-width:700px){
        .student-row-active{
          outline:2px solid rgba(123,237,255,.45);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    ensurePolishCss();
    bind();
    loadDashboard();

    state.timer = setInterval(() => {
      if (state.auto) loadDashboard();
    }, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
