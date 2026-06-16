/* =========================================================
   EAP Word Quest • Progress Sync / Next Mission Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v183-progress-sync-hotfix.js
   Version: v1.8.3-PROGRESS-SYNC-NEXT-MISSION

   Fix:
   - Summary overlay shows DONE too early
   - Use learning logs + report core as source of truth
   - Sync Next Mission after v172 overlay renders
   - Arc rule:
     within Arc = any S order
     Boss opens after all S in Arc passed
     next Arc opens after Boss passed
========================================================= */

"use strict";

(function(){
  const VERSION = "v1.8.3-PROGRESS-SYNC-NEXT-MISSION";
  const GROUP = "122";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";

  if(window.__EAP_WORD_QUEST_V183_PROGRESS_SYNC__){
    console.info("[EAP Word Quest] v183 progress sync already loaded");
    return;
  }

  window.__EAP_WORD_QUEST_V183_PROGRESS_SYNC__ = true;

  const COURSE_FLOW = [
    "S1","S2","S3","BG1",
    "S4","S5","S6","BG2",
    "S7","S8","S9","BG3",
    "S10","S11","S12","BG4",
    "S13","S14","S15","BG5"
  ];

  const ARCS = {
    ARC1:{ sessions:["S1","S2","S3"], boss:"BG1", unlockBy:null },
    ARC2:{ sessions:["S4","S5","S6"], boss:"BG2", unlockBy:"BG1" },
    ARC3:{ sessions:["S7","S8","S9"], boss:"BG3", unlockBy:"BG2" },
    ARC4:{ sessions:["S10","S11","S12"], boss:"BG4", unlockBy:"BG3" },
    ARC5:{ sessions:["S13","S14","S15"], boss:"BG5", unlockBy:"BG4" }
  };

  const TITLES = {
    S1:"Academic Profile",
    S2:"Project Introduction",
    S3:"Project Rationale & Target Users",
    BG1:"Vocabulary Boss 1",

    S4:"Tech Careers & Academic Roles",
    S5:"Team Communication",
    S6:"Progress Report & Responsibility",
    BG2:"Vocabulary Boss 2",

    S7:"Academic Email",
    S8:"Discussion & Meeting Language",
    S9:"Summary & Action Items",
    BG3:"Vocabulary Boss 3",

    S10:"System Explanation",
    S11:"Problem Report & Solution",
    S12:"User Guide & Instruction",
    BG4:"Vocabulary Boss 4",

    S13:"AI Report & Academic Summary",
    S14:"Portfolio, CV & Pitch",
    S15:"Final Presentation & Reflection",
    BG5:"Final Vocabulary Boss"
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

  function currentStudentKey(){
    const p = readProfile();
    return `${GROUP}|${p.studentId}|${p.studentName}`;
  }

  function statusFromAccuracy(acc){
    if(acc >= 90) return "Vocabulary Mastery";
    if(acc >= 75) return "Vocabulary Strong";
    if(acc >= 60) return "Vocabulary Ready";
    return "Keep Practicing";
  }

  function threshold(id){
    if(id === "BG5") return 75;
    if(/^BG[1-4]$/.test(id)) return 70;
    return 60;
  }

  function isPassedRecord(r){
    if(!r) return false;

    if(typeof r.passed === "boolean"){
      return r.passed;
    }

    return num(r.accuracy) >= threshold(r.sessionId || r.id || r.session);
  }

  function normalizeRecord(input){
    const sessionId = norm(input.sessionId || input.session || input.id || "");
    const correct = num(input.correct);
    const total = Math.max(1,num(input.total || input.questions || correct || 1));
    const accuracy = num(input.accuracy) || Math.round((correct / total) * 100);
    const profile = readProfile();

    return {
      group:GROUP,
      studentName:norm(input.studentName || profile.studentName),
      studentId:norm(input.studentId || profile.studentId),
      studentKey:`${GROUP}|${norm(input.studentId || profile.studentId)}|${norm(input.studentName || profile.studentName)}`,
      sessionId,
      sessionTitle:norm(input.sessionTitle || input.title || input.name || TITLES[sessionId] || sessionId),
      correct,
      total,
      accuracy,
      xp:num(input.xp),
      maxCombo:num(input.maxCombo || input.combo),
      passed:typeof input.passed === "boolean" ? input.passed : accuracy >= threshold(sessionId),
      playedAt:input.playedAt || input.at || input.updatedAt || new Date().toISOString(),
      source:input.source || "progress-sync"
    };
  }

  function getAllLogs(){
    if(typeof window.readEapWordQuestLogs === "function"){
      return window.readEapWordQuestLogs().map(normalizeRecord);
    }

    return [];
  }

  function getCurrentSummaryRecord(){
    const state = window.EAP_V172_SUMMARY_STATE;

    if(!state || !state.result){
      return null;
    }

    const r = state.result;

    return normalizeRecord({
      source:"v172-current-summary",
      sessionId:r.id,
      sessionTitle:r.title,
      correct:r.correct,
      total:r.total,
      accuracy:r.accuracy,
      xp:r.xp,
      maxCombo:r.maxCombo,
      passed:r.passed,
      playedAt:state.renderedAt || new Date().toISOString()
    });
  }

  function getStudentLogs(includeCurrent){
    const key = currentStudentKey();
    const profile = readProfile();

    const logs = getAllLogs().filter(r => {
      const sameGroup = String(r.group || r.section || GROUP) === GROUP;
      const sameId = norm(r.studentId) === norm(profile.studentId);
      const sameName = norm(r.studentName) === norm(profile.studentName);

      return sameGroup && (sameId || sameName || r.studentKey === key);
    });

    if(includeCurrent){
      const current = getCurrentSummaryRecord();
      if(current){
        logs.push(current);
      }
    }

    return logs;
  }

  function buildBestMap(logs){
    const map = {};

    logs.forEach(r => {
      if(!r.sessionId) return;

      const old = map[r.sessionId];

      if(!old){
        map[r.sessionId] = r;
        return;
      }

      if(num(r.accuracy) > num(old.accuracy)){
        map[r.sessionId] = r;
        return;
      }

      if(num(r.accuracy) === num(old.accuracy)){
        if(new Date(r.playedAt) > new Date(old.playedAt)){
          map[r.sessionId] = r;
        }
      }
    });

    return map;
  }

  function buildPassMap(bestMap){
    const pass = {};

    COURSE_FLOW.forEach(id => {
      pass[id] = isPassedRecord(bestMap[id]);
    });

    return pass;
  }

  function arcOf(id){
    for(const [arcId,arc] of Object.entries(ARCS)){
      if(arc.sessions.includes(id) || arc.boss === id){
        return arcId;
      }
    }

    return "ARC1";
  }

  function arcUnlocked(arcId,pass){
    const arc = ARCS[arcId];
    if(!arc) return false;
    if(!arc.unlockBy) return true;
    return Boolean(pass[arc.unlockBy]);
  }

  function missionUnlocked(id,pass){
    const arcId = arcOf(id);
    const arc = ARCS[arcId];

    if(!arcUnlocked(arcId,pass)){
      return false;
    }

    if(arc.sessions.includes(id)){
      return true;
    }

    if(arc.boss === id){
      return arc.sessions.every(sid => pass[sid]);
    }

    return false;
  }

  function allPassed(pass){
    return COURSE_FLOW.every(id => pass[id]);
  }

  function firstUnpassedInArc(arcId,pass){
    const arc = ARCS[arcId];
    if(!arc) return "";

    for(const sid of arc.sessions){
      if(!pass[sid]){
        return sid;
      }
    }

    if(!pass[arc.boss] && missionUnlocked(arc.boss,pass)){
      return arc.boss;
    }

    return "";
  }

  function firstUnlockedUnpassed(pass){
    for(const id of COURSE_FLOW){
      if(!pass[id] && missionUnlocked(id,pass)){
        return id;
      }
    }

    return "";
  }

  function computeNextMission(currentId,logs){
    const bestMap = buildBestMap(logs);
    const pass = buildPassMap(bestMap);

    /*
      ถ้า current ยังไม่ผ่าน ให้ replay current
    */
    if(currentId && COURSE_FLOW.includes(currentId) && !pass[currentId]){
      return {
        next:currentId,
        reason:"current-not-passed",
        bestMap,
        pass
      };
    }

    /*
      ห้าม DONE ถ้ายังไม่ผ่านครบจริง
    */
    if(allPassed(pass)){
      return {
        next:"DONE",
        reason:"all-passed",
        bestMap,
        pass
      };
    }

    /*
      ภายใน Arc ให้แนะนำตัวที่ยังไม่ผ่านก่อน
    */
    const currentArc = arcOf(currentId);
    const inArc = firstUnpassedInArc(currentArc,pass);

    if(inArc && missionUnlocked(inArc,pass)){
      return {
        next:inArc,
        reason:"same-arc-unpassed",
        bestMap,
        pass
      };
    }

    /*
      หา mission ถัดไปที่ปลดล็อกแล้วและยังไม่ผ่าน
    */
    const unlocked = firstUnlockedUnpassed(pass);

    if(unlocked){
      return {
        next:unlocked,
        reason:"first-unlocked-unpassed",
        bestMap,
        pass
      };
    }

    /*
      fallback: ถ้ายังไม่ครบ แต่ไม่มีตัวปลดล็อก แปลว่า dependency เพี้ยน
      ให้กลับไปตัวแรกที่ยังไม่ผ่านตาม flow
    */
    const firstMissing = COURSE_FLOW.find(id => !pass[id]) || "S1";

    return {
      next:firstMissing,
      reason:"fallback-first-missing",
      bestMap,
      pass
    };
  }

  function progressSummary(logs){
    const bestMap = buildBestMap(logs);
    const pass = buildPassMap(bestMap);
    const passed = COURSE_FLOW.filter(id => pass[id]).length;
    const played = COURSE_FLOW.filter(id => bestMap[id]).length;
    const avg = (() => {
      const vals = COURSE_FLOW
        .map(id => bestMap[id])
        .filter(Boolean)
        .map(r => num(r.accuracy));

      if(!vals.length) return 0;
      return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
    })();

    return {
      played,
      passed,
      total:COURSE_FLOW.length,
      progressText:`${passed}/${COURSE_FLOW.length}`,
      progressPercent:Math.round((passed / COURSE_FLOW.length) * 100),
      averageAccuracy:avg,
      status:statusFromAccuracy(avg),
      pass
    };
  }

  function removeOverlay(){
    const overlay = $("eapV172SummaryOverlay");
    if(overlay){
      overlay.remove();
    }
  }

  function clearScreenStyles(){
    document.querySelectorAll(".screen").forEach(screen => {
      screen.hidden = false;
      screen.style.display = "";
      screen.style.visibility = "";
      screen.style.opacity = "";
      screen.style.pointerEvents = "";
      screen.style.transform = "";
      screen.style.position = "";
      screen.style.zIndex = "";
    });
  }

  function showScreen(id){
    clearScreenStyles();

    document.querySelectorAll(".screen").forEach(screen => {
      screen.classList.toggle("active",screen.id === id);
    });

    window.scrollTo({
      top:0,
      behavior:"auto"
    });
  }

  function goHome(){
    removeOverlay();
    clearScreenStyles();

    try{
      if(typeof window.renderHomeStats === "function"){
        window.renderHomeStats();
      }

      if(typeof window.renderSessions === "function"){
        window.renderSessions();
      }
    }catch(err){
      console.warn("[EAP Word Quest] v183 home render warning:",err);
    }

    showScreen("homeScreen");

    if(typeof window.cleanEapVocabUi === "function"){
      setTimeout(window.cleanEapVocabUi,120);
    }
  }

  function startMission(id){
    removeOverlay();
    clearScreenStyles();

    if(id === "DONE"){
      goHome();
      return;
    }

    if(typeof window.startSession === "function"){
      window.startSession(id);
      return;
    }

    console.warn("[EAP Word Quest] v183 startSession missing");
    goHome();
  }

  function patchOverlayNext(){
    const state = window.EAP_V172_SUMMARY_STATE;
    const overlay = $("eapV172SummaryOverlay");

    if(!state || !state.result || !overlay){
      return null;
    }

    const result = state.result;
    const currentId = result.id;
    const logs = getStudentLogs(true);
    const sync = computeNextMission(currentId,logs);
    const progress = progressSummary(logs);
    const next = sync.next;

    /*
      sync state
    */
    result.next = next;
    result.progressText = progress.progressText;
    result.progressPercent = progress.progressPercent;
    result.syncReason = sync.reason;

    const nextText = next === "DONE"
      ? "จบคอร์ส / กลับหน้าแรก"
      : result.passed
        ? `ไปด่านถัดไป: ${next}`
        : `ฝึกอีกครั้ง: ${currentId}`;

    /*
      ปุ่มหลัก
    */
    const nextBtn = $("eap172Next");
    if(nextBtn){
      nextBtn.textContent = nextText;

      nextBtn.onclick = function(e){
        if(e){
          e.preventDefault();
          e.stopPropagation();
        }

        if(next === "DONE"){
          goHome();
          return;
        }

        startMission(result.passed ? next : currentId);
      };
    }

    /*
      กล่อง Next Mission ใน grid
    */
    const statCards = Array.from(overlay.querySelectorAll(".eap172-stat"));
    statCards.forEach(card => {
      const label = norm(card.querySelector("span") ? card.querySelector("span").textContent : "");

      if(label === "Next Mission"){
        const b = card.querySelector("b");
        if(b) b.textContent = result.passed ? next : currentId;
      }
    });

    /*
      เพิ่ม/อัปเดต progress bar เล็กใน overlay
    */
    let progressBox = $("eapV183ProgressBox");

    if(!progressBox){
      progressBox = document.createElement("div");
      progressBox.id = "eapV183ProgressBox";
      progressBox.style.cssText = [
        "margin-top:12px",
        "padding:12px 14px",
        "border-radius:16px",
        "background:#f8fafc",
        "border:1px solid #e2e8f0",
        "color:#334155",
        "font-weight:800"
      ].join(";");

      const reportBox = overlay.querySelector(".eap172-report");
      if(reportBox){
        reportBox.insertAdjacentElement("afterend",progressBox);
      }
    }

    progressBox.innerHTML = `
      Progress Sync: ${progress.progressText} passed
      • ${progress.progressPercent}%
      • Next: <b>${next}</b>
    `;

    window.EAP_V183_PROGRESS_SYNC_STATE = {
      version:VERSION,
      currentId,
      next,
      reason:sync.reason,
      progress,
      syncedAt:new Date().toISOString()
    };

    console.info("[EAP Word Quest] v183 progress synced:",window.EAP_V183_PROGRESS_SYNC_STATE);

    return window.EAP_V183_PROGRESS_SYNC_STATE;
  }

  function patchOldSummaryNext(){
    const summary = $("summaryScreen");
    if(!summary || !summary.classList.contains("active")){
      return null;
    }

    const state = window.EAP_V172_SUMMARY_STATE;
    const currentId = state && state.result ? state.result.id : "";

    if(!currentId) return null;

    const logs = getStudentLogs(true);
    const sync = computeNextMission(currentId,logs);
    const next = sync.next;

    const btn = $("nextMissionBtn");
    if(btn){
      btn.textContent = next === "DONE"
        ? "จบคอร์ส / กลับหน้าแรก"
        : `ไปด่านถัดไป: ${next}`;

      btn.dataset.v183NextMission = next;

      btn.onclick = function(e){
        if(e){
          e.preventDefault();
          e.stopPropagation();
        }

        if(next === "DONE"){
          goHome();
        }else{
          startMission(next);
        }
      };
    }

    return sync;
  }

  function syncNow(){
    const a = patchOverlayNext();
    const b = patchOldSummaryNext();

    return a || b || inspectProgress();
  }

  function inspectProgress(){
    const logs = getStudentLogs(true);
    const current = getCurrentSummaryRecord();
    const currentId = current ? current.sessionId : "";
    const sync = computeNextMission(currentId || "S1",logs);
    const progress = progressSummary(logs);

    const report = {
      version:VERSION,
      student:readProfile(),
      currentId,
      next:sync.next,
      reason:sync.reason,
      progress,
      passedMap:sync.pass,
      logs:logs.length,
      inspectedAt:new Date().toISOString()
    };

    console.table(Object.entries(sync.pass).map(([id,passed]) => ({
      mission:id,
      passed
    })));

    console.info("[EAP Word Quest] v183 progress inspection:",report);

    return report;
  }

  /*
    ดักปุ่มใน overlay แบบ capture อีกชั้น กัน onclick เดิมของ v172 พาไป DONE ผิด
  */
  window.addEventListener("click",function(e){
    const target = e.target && e.target.closest ? e.target.closest("#eap172Next") : null;
    if(!target) return;

    const state = patchOverlayNext();
    if(!state) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    if(state.next === "DONE"){
      goHome();
      return;
    }

    const result = window.EAP_V172_SUMMARY_STATE && window.EAP_V172_SUMMARY_STATE.result;
    const currentId = result ? result.id : state.next;
    const passed = result ? result.passed : true;

    startMission(passed ? state.next : currentId);
  },true);

  /*
    Sync หลัง overlay render
  */
  let lastRenderedAt = "";

  setInterval(() => {
    const state = window.EAP_V172_SUMMARY_STATE;
    if(!state || !state.renderedAt) return;

    if(state.renderedAt !== lastRenderedAt){
      lastRenderedAt = state.renderedAt;
      setTimeout(patchOverlayNext,80);
      setTimeout(patchOverlayNext,300);
      setTimeout(patchOverlayNext,700);
    }
  },500);

  /*
    Sync หลัง logger จับ log
  */
  setInterval(() => {
    const overlay = $("eapV172SummaryOverlay");
    if(overlay){
      patchOverlayNext();
    }
  },1500);

  window.syncEapProgressNextMission = syncNow;
  window.inspectEapProgressSync = inspectProgress;
  window.computeEapNextMissionFromLogs = function(currentId){
    return computeNextMission(currentId,getStudentLogs(true));
  };

  window.APP_VERSION = VERSION;

  const versionPill = $("versionPill");
  if(versionPill){
    versionPill.title = VERSION;
  }

  console.info("[EAP Word Quest] v183 progress sync hotfix ready:",{
    version:VERSION,
    group:GROUP,
    helpers:[
      "syncEapProgressNextMission()",
      "inspectEapProgressSync()",
      "computeEapNextMissionFromLogs('S1')"
    ]
  });
})();