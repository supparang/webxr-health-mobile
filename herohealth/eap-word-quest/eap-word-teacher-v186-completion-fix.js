/* =========================================================
   EAP Word Quest • Teacher Completion Recovery + Compact Detail
   File: /herohealth/eap-word-quest/eap-word-teacher-v186-completion-fix.js
   Version: v1.8.6-TEACHER-COMPLETION-RECOVERY-DETAIL-COMPACT

   Fix:
   - Student page shows all missions passed, but teacher report shows 15/20
   - Recover missing learning logs from stats.sessions
   - Compact Individual Report Arc Progress
   - Add learning path alert for skipped/missing logs
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.6-TEACHER-COMPLETION-RECOVERY-DETAIL-COMPACT";
  const GROUP = "122";

  if(window.__EAP_TEACHER_V186_COMPLETION_FIX__){
    console.info("[EAP Word Quest] v186 completion fix already loaded");
    return;
  }

  window.__EAP_TEACHER_V186_COMPLETION_FIX__ = true;

  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";

  const STATS_KEYS = [
    "EAP_WORD_QUEST_STATS_V160",
    "EAP_WORD_QUEST_STATS_V161",
    "EAP_WORD_QUEST_STATS_V01"
  ];

  const COURSE_FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  const TITLES = {
    S1:"Academic Profile",
    S2:"Project Introduction",
    S3:"Project Rationale & Target Users",
    BG1:"Vocabulary Boss 1",

    S4:"Tech Jobs / Careers",
    S5:"Workplace Communication",
    S6:"Team Progress & Responsibility",
    BG2:"Vocabulary Boss 2",

    S7:"Professional Email",
    S8:"Meeting / Discussion",
    S9:"Discussion Summary & Action Items",
    BG3:"Vocabulary Boss 3",

    S10:"System Explanation",
    S11:"Bug Report / Problem Solving",
    S12:"User Guide / Technical Instruction",
    BG4:"Vocabulary Boss 4",

    S13:"AI Report / Academic Summary",
    S14:"CV / Interview / Pitch",
    S15:"Final Project Presentation & Reflection",
    BG5:"Final Boss Gate"
  };

  const ARC_META = {
    S1:["ARC1","Arc 1"], S2:["ARC1","Arc 1"], S3:["ARC1","Arc 1"], BG1:["ARC1","Arc 1"],
    S4:["ARC2","Arc 2"], S5:["ARC2","Arc 2"], S6:["ARC2","Arc 2"], BG2:["ARC2","Arc 2"],
    S7:["ARC3","Arc 3"], S8:["ARC3","Arc 3"], S9:["ARC3","Arc 3"], BG3:["ARC3","Arc 3"],
    S10:["ARC4","Arc 4"], S11:["ARC4","Arc 4"], S12:["ARC4","Arc 4"], BG4:["ARC4","Arc 4"],
    S13:["ARC5","Arc 5"], S14:["ARC5","Arc 5"], S15:["ARC5","Arc 5"], BG5:["ARC5","Arc 5"]
  };

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? "" : v).replace(/\s+/g," ").trim();
  }

  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function readJson(key,fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(err){
      return fallback;
    }
  }

  function readProfile(){
    const p = readJson(PROFILE_KEY,{}) || {};

    return {
      studentName:norm(p.studentName || p.name || "Anonymous"),
      studentId:norm(p.studentId || p.id || "anon"),
      group:GROUP,
      section:GROUP
    };
  }

  function sessionType(id){
    if(id === "BG5") return "finalBoss";
    if(/^BG/.test(id)) return "boss";
    return "session";
  }

  function defaultTotal(id){
    if(id === "BG5") return 30;
    if(/^BG/.test(id)) return 24;
    return 12;
  }

  function statusFromAccuracy(acc){
    if(acc >= 90) return "Vocabulary Mastery";
    if(acc >= 75) return "Vocabulary Strong";
    if(acc >= 60) return "Vocabulary Ready";
    return "Keep Practicing";
  }

  function predictionFromAccuracy(acc){
    if(acc >= 75) return "Ready for Main Mission";
    if(acc >= 60) return "Ready, but review recommended";
    return "At Risk — replay with AI Help";
  }

  function difficultyFromAccuracy(acc){
    if(acc >= 90) return "B1+";
    if(acc >= 75) return "B1";
    if(acc >= 60) return "A2+";
    return "A2";
  }

  function threshold(id){
    if(id === "BG5") return 75;
    if(/^BG[1-4]$/.test(id)) return 70;
    return 60;
  }

  function recordKey(r){
    return [
      norm(r.group || r.section || GROUP),
      norm(r.studentId),
      norm(r.studentName),
      norm(r.sessionId)
    ].join("|");
  }

  function currentStudentIdentity(){
    const logs = typeof window.readEapWordQuestLogs === "function"
      ? window.readEapWordQuestLogs()
      : [];

    const latest = logs.slice().sort((a,b) => new Date(b.playedAt || b.at || 0) - new Date(a.playedAt || a.at || 0))[0];

    if(latest && (latest.studentId || latest.studentName)){
      return {
        studentName:norm(latest.studentName || "Anonymous"),
        studentId:norm(latest.studentId || "anon"),
        group:GROUP,
        section:GROUP
      };
    }

    return readProfile();
  }

  function collectStatsSessionRecords(){
    const profile = currentStudentIdentity();
    const records = [];

    STATS_KEYS.forEach(key => {
      const stats = readJson(key,null);
      if(!stats || !stats.sessions || typeof stats.sessions !== "object") return;

      const snapshot = stats.profileSnapshot || {};
      const studentName = norm(snapshot.studentName || profile.studentName || "Anonymous");
      const studentId = norm(snapshot.studentId || profile.studentId || "anon");

      COURSE_FLOW.forEach(id => {
        const s = stats.sessions[id];
        if(!s || typeof s !== "object") return;

        const played =
          Boolean(s.played) ||
          Boolean(s.passed) ||
          num(s.rounds) > 0 ||
          num(s.total) > 0 ||
          num(s.correct) > 0 ||
          num(s.bestAccuracy) > 0;

        if(!played) return;

        const acc = Math.round(
          num(s.bestAccuracy) ||
          (num(s.total) > 0 ? (num(s.correct) / num(s.total)) * 100 : 0)
        );

        const total = num(s.bestTotal) || defaultTotal(id);
        const correct = Math.max(0, Math.min(total, Math.round((acc / 100) * total)));
        const [arcId,arc] = ARC_META[id] || ["UNKNOWN","Unknown Arc"];

        records.push({
          logVersion:VERSION,
          source:`stats-session-recovery:${key}`,

          course:"EAP",
          game:"EAP Word Quest",
          role:"Vocabulary Side Quest",
          mainGame:"EAP Hero Save the Society",

          group:GROUP,
          section:GROUP,
          studentName,
          studentId,

          arcId,
          arc,
          sessionId:id,
          sessionTitle:TITLES[id] || id,
          sessionType:sessionType(id),

          correct,
          total,
          accuracy:acc,
          xp:num(s.bestXp) || Math.round(num(s.xp) / Math.max(1,num(s.rounds))) || num(s.xp),
          maxCombo:num(s.bestCombo || s.maxCombo || 0),

          passed:typeof s.passed === "boolean" ? s.passed : acc >= threshold(id),
          passThreshold:threshold(id),
          passStatus:statusFromAccuracy(acc),

          cefrLevel:difficultyFromAccuracy(acc),
          aiDifficulty:difficultyFromAccuracy(acc),
          aiPrediction:predictionFromAccuracy(acc),

          hintUsed:0,
          weakWords:[],
          itemTypeWeak:[],
          levelWeak:[],

          responseTimeAvg:0,
          attempt:num(s.rounds) || 1,

          bossHp:0,
          bossMaxHp:/^BG/.test(id) ? 1 : 0,
          isBoss:/^BG/.test(id),

          playedAt:s.lastPlayed || s.lastPassed || stats.updatedAt || stats.createdAt || new Date().toISOString()
        });
      });
    });

    return records;
  }

  function existingSessionMap(){
    const logs = typeof window.readEapWordQuestLogs === "function"
      ? window.readEapWordQuestLogs()
      : [];

    const map = new Map();

    logs.forEach(r => {
      if(!r.sessionId) return;
      map.set(recordKey(r),r);
    });

    return map;
  }

  function recoverCompletionFromStats(){
    if(typeof window.logEapWordQuestResult !== "function"){
      console.warn("[EAP Word Quest] logEapWordQuestResult() not found");
      return { ok:false, recovered:0, reason:"logger-missing" };
    }

    const existing = existingSessionMap();
    const recovered = [];
    const candidates = collectStatsSessionRecords();

    candidates.forEach(r => {
      const key = recordKey(r);
      const old = existing.get(key);

      /*
        ถ้ามี log session นั้นอยู่แล้ว ไม่สร้างซ้ำ
        แต่ถ้า old ยังไม่ผ่าน แล้ว stats บอกผ่าน ให้ recover ทับเป็น record ใหม่
      */
      if(old && old.passed){
        return;
      }

      if(old && !r.passed){
        return;
      }

      window.logEapWordQuestResult(r);
      recovered.push(r);
      existing.set(key,r);
    });

    if(typeof window.renderEapTeacherPage === "function"){
      setTimeout(window.renderEapTeacherPage,80);
      setTimeout(window.renderEapTeacherPage,350);
    }

    console.info("[EAP Word Quest] v186 completion recovered:",{
      version:VERSION,
      recovered:recovered.length,
      records:recovered
    });

    return {
      ok:true,
      recovered:recovered.length,
      records:recovered
    };
  }

  function findPathGaps(report){
    if(!report || !Array.isArray(report.students)) return [];

    const gaps = [];

    report.students.forEach(student => {
      const bySession = {};
      (student.records || []).forEach(r => {
        if(r.sessionId && r.passed){
          bySession[r.sessionId] = true;
        }
      });

      COURSE_FLOW.forEach((id,idx) => {
        const laterPassed = COURSE_FLOW.slice(idx + 1).some(nextId => bySession[nextId]);
        if(!bySession[id] && laterPassed){
          gaps.push({
            studentName:student.studentName,
            studentId:student.studentId,
            missing:id,
            message:`${student.studentName} มีผลในด่านหลังแล้ว แต่ยังไม่มี log ของ ${id}`
          });
        }
      });
    });

    return gaps;
  }

  function injectStyle(){
    if($("eapTeacherV186Style")) return;

    const style = document.createElement("style");
    style.id = "eapTeacherV186Style";
    style.textContent = `
      #studentDetail .arc-grid{
        grid-template-columns:1fr !important;
        gap:8px !important;
      }

      #studentDetail .arc-card{
        min-height:auto !important;
        display:grid !important;
        grid-template-columns:1fr auto !important;
        column-gap:10px !important;
        align-items:center !important;
      }

      #studentDetail .arc-card h4{
        font-size:13px !important;
        line-height:1.25 !important;
        margin:0 !important;
      }

      #studentDetail .arc-card .mini-progress{
        grid-column:1 / -1 !important;
        margin:8px 0 4px !important;
      }

      #studentDetail .arc-card small{
        grid-column:1 / -1 !important;
        color:#64748b !important;
        font-weight:800 !important;
      }

      .eap186-path-alert{
        border:1px solid #fed7aa;
        background:#fff7ed;
        color:#9a3412;
        border-radius:18px;
        padding:14px 16px;
        font-weight:800;
        line-height:1.5;
        margin-top:12px;
      }

      .eap186-path-alert b{
        color:#c2410c;
      }

      .eap186-recover-btn{
        border:1px solid #c7d2fe !important;
        background:#eef2ff !important;
        color:#3730a3 !important;
        box-shadow:none !important;
      }
    `;

    document.head.appendChild(style);
  }

  function addRecoverButton(){
    const toolbar = document.querySelector(".toolbar");
    if(!toolbar || $("eap186RecoverBtn")) return;

    const btn = document.createElement("button");
    btn.id = "eap186RecoverBtn";
    btn.type = "button";
    btn.className = "btn secondary eap186-recover-btn";
    btn.textContent = "Recover Completion";
    btn.onclick = () => {
      const res = recoverCompletionFromStats();

      if(typeof window.renderEapTeacherPage === "function"){
        window.renderEapTeacherPage();
      }

      alert(`Recovered ${res.recovered || 0} missing completion records`);
    };

    toolbar.insertBefore(btn,toolbar.firstChild);
  }

  function patchTeacherAlert(){
    const box = $("teacherAlert");
    const report = window.EAP_TEACHER_PAGE_REPORT;

    if(!box || !report) return;

    const gaps = findPathGaps(report);
    let old = $("eap186PathAlert");

    if(!gaps.length){
      if(old) old.remove();
      return;
    }

    if(!old){
      old = document.createElement("div");
      old.id = "eap186PathAlert";
      old.className = "eap186-path-alert";
      box.insertAdjacentElement("afterbegin",old);
    }

    const sample = gaps.slice(0,6).map(g => g.missing).join(", ");

    old.innerHTML = `
      <b>Learning Path Alert:</b>
      พบ log บางด่านขาดหาย เช่น ${sample}
      แต่มีผลในด่านหลังแล้ว จึงควรกด <b>Recover Completion</b>
      เพื่อกู้ completion จาก session stats
    `;
  }

  function patchAll(){
    injectStyle();
    addRecoverButton();
    patchTeacherAlert();

    window.EAP_TEACHER_V186_STATE = {
      version:VERSION,
      patchedAt:new Date().toISOString()
    };
  }

  function autoRecoverIfNeeded(){
    const report = typeof window.buildEapTeacherReport === "function"
      ? window.buildEapTeacherReport()
      : null;

    if(!report || !report.students || !report.students.length) return;

    const maxPassed = Math.max(...report.students.map(s => Number(s.passedSessions || 0)));
    const possible = collectStatsSessionRecords().filter(r => r.passed).length;

    if(possible > maxPassed){
      recoverCompletionFromStats();
    }
  }

  const oldRender = window.renderEapTeacherPage;
  if(typeof oldRender === "function" && !oldRender.__eap186Wrapped){
    const wrapped = function(){
      const result = oldRender.apply(this,arguments);
      setTimeout(patchAll,80);
      setTimeout(patchAll,300);
      return result;
    };

    wrapped.__eap186Wrapped = true;
    window.renderEapTeacherPage = wrapped;
  }

  [0,150,400,900].forEach(ms => setTimeout(patchAll,ms));
  setTimeout(autoRecoverIfNeeded,700);
  setTimeout(patchAll,1200);

  window.recoverEapTeacherCompletion = recoverCompletionFromStats;
  window.inspectEapTeacherCompletionCandidates = collectStatsSessionRecords;
  window.patchEapTeacherV186 = patchAll;

  console.info("[EAP Word Quest] v186 teacher completion fix ready:",{
    version:VERSION,
    helpers:[
      "recoverEapTeacherCompletion()",
      "inspectEapTeacherCompletionCandidates()",
      "patchEapTeacherV186()"
    ]
  });
})();
