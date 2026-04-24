// /english/js/teacher-dashboard-hotfix.js
// PATCH v20260424-teacher-dashboard-hotfix-r1
// ✅ Force load teacher=dashboard from Apps Script
// ✅ Render summary / filters / table / heatmap / risk / section / matrix
// ✅ Fix Endpoint: loading...
// ✅ Does not depend on old teacher.js internals

(function () {
  "use strict";

  const PATCH = "v20260424-teacher-dashboard-hotfix-r1";

  const ENDPOINT =
    window.TECHPATH_ATTENDANCE_ENDPOINT ||
    "https://script.google.com/macros/s/AKfycbwsW0ffV5W_A81bNdcj32TDvgVBEUOk6IDPqqmqpePCVhY0X56dEv1XIOh2ygu0AG7i/exec";

  const state = {
    rows: [],
    filteredRows: [],
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

  function setEndpointPill(text, ok = true) {
    const el = $("endpoint-pill");
    if (!el) return;
    el.textContent = text;
    el.style.borderColor = ok ? "rgba(46,213,115,.35)" : "rgba(255,107,129,.45)";
    el.style.color = ok ? "#b9ffd0" : "#ffd4db";
  }

  function normalizeRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((r) => ({
      visitId: safe(r.visitId, ""),
      studentId: safe(r.studentId, ""),
      studentName: safe(r.studentName, ""),
      classSection: safe(r.classSection, ""),
      sessionNo: safe(r.sessionNo, "S00"),
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
    }));
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
    const completed = rows.filter((r) => r.completed).length;
    const minTimeMet = rows.filter((r) => r.minTimeMet).length;
    const inProgress = rows.filter((r) => r.attendanceStatus === "in_progress").length;
    const entered = rows.filter((r) => r.attendanceStatus === "entered").length;

    const avgDurationSec = total
      ? Math.round(rows.reduce((s, r) => s + r.durationSec, 0) / total)
      : 0;

    const avgActiveTimeSec = total
      ? Math.round(rows.reduce((s, r) => s + r.activeTimeSec, 0) / total)
      : 0;

    const avgScore = total
      ? Math.round(rows.reduce((s, r) => s + r.score, 0) / total)
      : 0;

    return { total, completed, minTimeMet, inProgress, entered, avgDurationSec, avgActiveTimeSec, avgScore };
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
      ["Sessions ทั้งหมด", summary.total, ""],
      ["Completed", summary.completed, "ok"],
      ["Min time ผ่าน", summary.minTimeMet, "ok"],
      ["In progress", summary.inProgress, "warn"],
      ["Entered", summary.entered, "warn"],
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

      if (state.quick === "completed" && !r.completed) return false;
      if (state.quick === "not_completed" && r.completed) return false;
      if (state.quick === "in_progress" && r.attendanceStatus !== "in_progress") return false;
      if (state.quick === "min_fail" && r.minTimeMet) return false;

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

  function renderTable() {
    const tbody = $("students-tbody");
    const meta = $("table-meta");
    if (!tbody || !meta) return;

    meta.textContent = `${state.filteredRows.length} rows`;

    if (!state.filteredRows.length) {
      tbody.innerHTML = `<tr><td colspan="11">ไม่พบข้อมูล</td></tr>`;
      return;
    }

    tbody.innerHTML = state.filteredRows.map((r) => `
      <tr>
        <td>${escapeHtml(safe(r.studentId))}</td>
        <td>${escapeHtml(safe(r.studentName))}</td>
        <td>${escapeHtml(safe(r.classSection))}</td>
        <td>${escapeHtml(safe(r.sessionNo))}</td>
        <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(safe(r.attendanceStatus))}</span></td>
        <td>${escapeHtml(fmtSec(r.durationSec))}</td>
        <td>${escapeHtml(fmtSec(r.activeTimeSec))}</td>
        <td>${escapeHtml(r.score)}</td>
        <td class="${r.completed ? "yes" : "no"}">${r.completed ? "YES" : "NO"}</td>
        <td class="${r.minTimeMet ? "yes" : "no"}">${r.minTimeMet ? "YES" : "NO"}</td>
        <td>${escapeHtml(fmtDate(r.lastServerTs || r.firstServerTs))}</td>
      </tr>
    `).join("");
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

    const rows = state.filteredRows.filter((r) =>
      !r.completed || !r.minTimeMet || r.attendanceStatus === "in_progress" || r.attendanceStatus === "left"
    );

    meta.textContent = `${rows.length} rows`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6">ไม่มีรายการเสี่ยง</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.slice(0, 80).map((r) => `
      <tr>
        <td>${escapeHtml(safe(r.studentName))}<br><span style="color:#9db2c7;font-size:.82rem;">${escapeHtml(safe(r.studentId))}</span></td>
        <td>${escapeHtml(safe(r.classSection))}</td>
        <td>${escapeHtml(safe(r.sessionNo))}</td>
        <td><span class="tag ${tagClass(r.attendanceStatus)}">${escapeHtml(safe(r.attendanceStatus))}</span></td>
        <td>${escapeHtml(fmtSec(r.durationSec))}</td>
        <td class="${r.minTimeMet ? "yes" : "no"}">${r.minTimeMet ? "YES" : "NO"}</td>
      </tr>
    `).join("");
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
    if (footer) footer.textContent = `Build: ${PATCH} • Rows: ${state.rows.length} • ${new Date().toLocaleString("th-TH")}`;
  }

  async function loadDashboard() {
    try {
      const data = await fetchDashboard();
      state.rows = normalizeRows(data.rows || []);
      setEndpointPill(`Endpoint: OK • ${state.rows.length} rows`, true);

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
      $("btn-auto").textContent = `Auto refresh: ${state.auto ? "ON" : "OFF"}`;
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

  function boot() {
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
