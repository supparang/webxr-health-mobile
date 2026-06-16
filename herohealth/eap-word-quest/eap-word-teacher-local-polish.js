/* =========================================================
   EAP Word Quest • Teacher Local Dashboard Polish
   File: /herohealth/eap-word-quest/eap-word-teacher-local-polish.js
   Version: v1.8.5-TEACHER-LOCAL-MOBILE-POLISH

   Role:
   - Mobile-friendly Teacher Dashboard
   - Local + CSV workflow only
   - No Apps Script / Google Sheets yet
   - Better empty state
   - Fix horizontal overflow
   - Add clear explanation when logs = 0
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.5-TEACHER-LOCAL-MOBILE-POLISH";

  if(window.__EAP_TEACHER_LOCAL_POLISH__){
    console.info("[EAP Word Quest] teacher local polish already loaded");
    return;
  }

  window.__EAP_TEACHER_LOCAL_POLISH__ = true;

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function injectStyle(){
    if($("eapTeacherLocalPolishStyle")) return;

    const style = document.createElement("style");
    style.id = "eapTeacherLocalPolishStyle";
    style.textContent = `
      /* === v1.8.5 Teacher Local Mobile Polish === */

      html,
      body{
        width:100%;
        max-width:100%;
        overflow-x:hidden !important;
      }

      body{
        background:#f6f8ff;
      }

      .shell{
        width:100%;
        max-width:1280px;
      }

      .notice{
        border-color:#c7d2fe !important;
        background:linear-gradient(135deg,#eef2ff,#ecfeff) !important;
      }

      .eap185-empty{
        border:1px dashed #cbd5e1;
        background:#f8fafc;
        color:#475569;
        border-radius:18px;
        padding:16px;
        line-height:1.55;
        font-weight:750;
      }

      .eap185-empty b{
        color:#3730a3;
      }

      .eap185-step-list{
        margin:10px 0 0;
        padding-left:18px;
      }

      .eap185-step-list li{
        margin:5px 0;
      }

      .eap185-mini-note{
        margin-top:10px;
        padding:10px 12px;
        border-radius:14px;
        background:#fff7ed;
        color:#9a3412;
        border:1px solid #fed7aa;
        font-weight:800;
        line-height:1.45;
      }

      .eap185-mobile-cards{
        display:none;
      }

      .eap185-student-card{
        border:1px solid #e2e8f0;
        background:#fff;
        border-radius:18px;
        padding:14px;
        box-shadow:0 8px 20px rgba(15,23,42,.05);
        margin-bottom:10px;
      }

      .eap185-student-card h3{
        margin:0 0 6px;
        font-size:18px;
      }

      .eap185-student-meta{
        color:#64748b;
        font-weight:750;
        font-size:13px;
        margin-bottom:10px;
      }

      .eap185-card-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:10px;
      }

      .eap185-card-stat{
        border:1px solid #e2e8f0;
        border-radius:14px;
        padding:10px;
        background:#f8fafc;
      }

      .eap185-card-stat b{
        display:block;
        font-size:18px;
      }

      .eap185-card-stat span{
        color:#64748b;
        font-size:11px;
        font-weight:900;
      }

      @media(max-width:720px){
        body{
          padding:10px !important;
        }

        .shell{
          width:100% !important;
          max-width:100% !important;
          margin:0 !important;
        }

        .topbar{
          display:block !important;
          margin-bottom:12px !important;
        }

        .topbar h1{
          font-size:30px !important;
          line-height:1.08 !important;
        }

        .subtitle{
          font-size:13px !important;
          line-height:1.45 !important;
        }

        .top-actions{
          width:100% !important;
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:8px !important;
          margin-top:12px !important;
        }

        .top-actions .pill,
        .top-actions .btn{
          width:100% !important;
        }

        .panel{
          width:100% !important;
          padding:14px !important;
          border-radius:18px !important;
          margin-bottom:12px !important;
          box-shadow:0 10px 26px rgba(15,23,42,.07) !important;
        }

        .panel-head{
          display:block !important;
          margin-bottom:12px !important;
        }

        .panel-head h2{
          font-size:22px !important;
        }

        .panel-head p{
          font-size:13px !important;
        }

        .notice{
          padding:12px !important;
          border-radius:16px !important;
          font-size:13px !important;
          margin-bottom:12px !important;
        }

        .overview-grid{
          display:grid !important;
          grid-template-columns:1fr 1fr !important;
          gap:8px !important;
        }

        .stat{
          min-height:78px !important;
          padding:12px !important;
          border-radius:16px !important;
        }

        .stat b{
          font-size:22px !important;
        }

        .stat span{
          font-size:11px !important;
        }

        .toolbar{
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:8px !important;
          margin-top:12px !important;
        }

        .toolbar input,
        .toolbar select,
        .toolbar button,
        .toolbar label.btn,
        .toolbar .btn{
          width:100% !important;
          min-width:0 !important;
        }

        .grid-2{
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:12px !important;
        }

        .table-wrap{
          width:100% !important;
          max-width:100% !important;
          overflow-x:auto !important;
          -webkit-overflow-scrolling:touch !important;
        }

        table{
          min-width:680px !important;
          font-size:13px !important;
        }

        th,
        td{
          padding:10px 12px !important;
        }

        .arc-grid{
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:8px !important;
        }
      }

      @media(max-width:460px){
        .overview-grid{
          grid-template-columns:1fr !important;
        }

        table{
          min-width:620px !important;
        }

        .eap185-card-grid{
          grid-template-columns:1fr !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function patchNotice(){
    const notices = Array.from(document.querySelectorAll(".notice"));
    if(!notices.length) return;

    notices[0].innerHTML = `
      <b>Local + CSV Mode:</b>
      หน้านี้อ่านข้อมูลจากเครื่องที่เปิด Teacher Dashboard เท่านั้น
      ถ้านักศึกษาเล่นจากมือถือหรือเครื่องของตนเอง ให้ Export CSV จากหน้า Student แล้วนำมา Import ที่ปุ่ม
      <b>Import Student CSV</b>
      <div class="eap185-mini-note">
        ตอนนี้ยังไม่ใช้ Google Sheets / Firebase ตามที่อาจารย์สั่งพักไว้ก่อน
      </div>
    `;
  }

  function addEmptyState(){
    const report = window.EAP_TEACHER_PAGE_REPORT;
    const hasLogs = report && report.overview && Number(report.overview.totalLogs || 0) > 0;

    if(hasLogs){
      const old = $("eap185TeacherEmptyState");
      if(old) old.remove();
      return;
    }

    const overviewPanel = $("overviewGrid") ? $("overviewGrid").closest(".panel") : null;
    if(!overviewPanel || $("eap185TeacherEmptyState")) return;

    const box = document.createElement("div");
    box.id = "eap185TeacherEmptyState";
    box.className = "eap185-empty";
    box.innerHTML = `
      <b>ยังไม่มีข้อมูลในเครื่องนี้</b><br>
      ถ้าเปิด Teacher Dashboard จากมือถือ/เครื่องใหม่ ตัวเลขจะเป็น 0 เพราะข้อมูลเดิมอยู่ใน localStorage ของเครื่องที่นักศึกษาเล่น
      <ol class="eap185-step-list">
        <li>ให้นักศึกษาเปิดหน้า Student แล้ว Export CSV</li>
        <li>อาจารย์เปิดหน้านี้ แล้วกด Import Student CSV</li>
        <li>กด Refresh เพื่อดู Group 122 Overview</li>
      </ol>
    `;

    const toolbar = overviewPanel.querySelector(".toolbar");
    if(toolbar){
      toolbar.insertAdjacentElement("beforebegin",box);
    }else{
      overviewPanel.appendChild(box);
    }
  }

  function makeStudentMobileCards(){
    const report = window.EAP_TEACHER_PAGE_REPORT;
    if(!report || !Array.isArray(report.students)) return;

    let box = $("eap185StudentMobileCards");
    const studentPanel = $("studentBody") ? $("studentBody").closest(".panel") : null;

    if(!studentPanel) return;

    if(!box){
      box = document.createElement("div");
      box.id = "eap185StudentMobileCards";
      box.className = "eap185-mobile-cards";
      const tableWrap = studentPanel.querySelector(".table-wrap");
      if(tableWrap){
        tableWrap.insertAdjacentElement("beforebegin",box);
      }else{
        studentPanel.appendChild(box);
      }
    }

    const qEl = $("searchInput");
    const statusEl = $("statusFilter");
    const q = qEl ? norm(qEl.value).toLowerCase() : "";
    const status = statusEl ? statusEl.value : "ALL";

    const rows = report.students.filter(s => {
      if(status !== "ALL" && s.status !== status) return false;
      if(!q) return true;

      const hay = [
        s.studentName,
        s.studentId,
        s.status,
        s.lastSession,
        ...(s.weakWords || [])
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    box.innerHTML = rows.length ? rows.map(s => `
      <div class="eap185-student-card" data-key="${escapeHtml(s.studentKey)}">
        <h3>${escapeHtml(s.studentName || "-")}</h3>
        <div class="eap185-student-meta">
          ID: ${escapeHtml(s.studentId || "-")} • Group 122
        </div>
        <span class="tag ${statusClass(s.status)}">${escapeHtml(s.status || "-")}</span>
        <div class="eap185-card-grid">
          <div class="eap185-card-stat"><b>${escapeHtml(s.progressText || "0/20")}</b><span>Progress</span></div>
          <div class="eap185-card-stat"><b>${escapeHtml(s.averageAccuracy || 0)}%</b><span>Average Accuracy</span></div>
          <div class="eap185-card-stat"><b>${escapeHtml(s.bestAccuracy || 0)}%</b><span>Best Accuracy</span></div>
          <div class="eap185-card-stat"><b>${escapeHtml(s.totalXp || 0)}</b><span>Total XP</span></div>
        </div>
      </div>
    `).join("") : `
      <div class="eap185-empty">
        ยังไม่มีรายชื่อนักศึกษาในข้อมูลปัจจุบัน
      </div>
    `;

    box.querySelectorAll(".eap185-student-card").forEach(card => {
      card.addEventListener("click",() => {
        const key = card.dataset.key;
        const row = document.querySelector('.student-row[data-key="' + cssEscape(key) + '"]');
        if(row) row.click();
      });
    });
  }

  function patchMobileStudentListVisibility(){
    const studentPanel = $("studentBody") ? $("studentBody").closest(".panel") : null;
    if(!studentPanel) return;

    const styleId = "eap185StudentCardVisibilityStyle";
    if($(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @media(max-width:720px){
        #eap185StudentMobileCards{
          display:block;
        }

        #eap185StudentMobileCards + .table-wrap{
          display:none;
        }
      }

      @media(min-width:721px){
        #eap185StudentMobileCards{
          display:none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function statusClass(status){
    const s = norm(status).toLowerCase();

    if(s.includes("risk")) return "risk";
    if(s.includes("review")) return "review";
    if(s.includes("mastery")) return "mastery";
    if(s.includes("strong")) return "strong";
    if(s.includes("ready")) return "ready";

    return "";
  }

  function escapeHtml(v){
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function cssEscape(v){
    if(window.CSS && typeof window.CSS.escape === "function"){
      return window.CSS.escape(v);
    }

    return String(v).replace(/["\\]/g,"\\$&");
  }

  function patchToolbarLabels(){
    const map = {
      "Import Local Stats":"Import Local Stats",
      "Export Learning Logs CSV":"Export Logs CSV",
      "Export Student Summary CSV":"Export Summary CSV",
      "Import Student CSV":"Import Student CSV"
    };

    document.querySelectorAll("button,label.btn").forEach(el => {
      const text = norm(el.textContent);
      if(map[text]){
        el.textContent = map[text];
      }
    });
  }

  function patchAll(){
    injectStyle();
    patchNotice();
    addEmptyState();
    makeStudentMobileCards();
    patchMobileStudentListVisibility();
    patchToolbarLabels();

    window.EAP_TEACHER_LOCAL_POLISH_STATE = {
      version:VERSION,
      patchedAt:new Date().toISOString()
    };
  }

  const oldRender = window.renderEapTeacherPage;
  if(typeof oldRender === "function" && !oldRender.__eap185Wrapped){
    const wrapped = function(){
      const result = oldRender.apply(this,arguments);
      setTimeout(patchAll,80);
      setTimeout(patchAll,300);
      return result;
    };
    wrapped.__eap185Wrapped = true;
    window.renderEapTeacherPage = wrapped;
  }

  [0,100,300,700,1200].forEach(ms => setTimeout(patchAll,ms));

  document.addEventListener("click",() => {
    setTimeout(patchAll,120);
    setTimeout(patchAll,400);
  },true);

  window.polishEapTeacherLocal = patchAll;

  console.info("[EAP Word Quest] teacher local mobile polish ready:",{
    version:VERSION,
    helpers:["polishEapTeacherLocal()"]
  });
})();