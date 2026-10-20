/* CSAI2601 UX Quest - PRIVATE individual W/B progress, 2026-10-20.
 * Paste ONLY into the private Teacher Apps Script Web App.
 * Do not expose this code through the public student receiver.
 * No doGet/doPost definitions: existing deployment owns routing.
 */
const UXQ_IP_NODE_ORDER = [
  'w1','w2','w3','b1','w4','w5','w6','w7','b2',
  'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'
];
const UXQ_IP_NODE_LABELS = [
  'W1 • UX Detective','W2 • Design Thinking','W3 • Cognitive Load','B1 • Cognitive Storm',
  'W4 • User Insight','W5 • Problem Framing','W6 • User Flow','W7 • Wireframe','B2 • Flow Defense',
  'W8 • Midterm Studio','W9 • UI Kit','W10 • Responsive & Accessibility','W11 • Visual Style',
  'B3 • Interface System','W12 • Interaction States','W13 • Hi-fi Prototype',
  'W14 • Usability & Iteration','B4 • Prototype Validation','W15 • Portfolio'
];

function UXQ_ipAuthorize_() {
  const props = PropertiesService.getScriptProperties();
  const allowed = String(props.getProperty('UXQ_TEACHER_EMAILS') || '')
    .split(/[,;\s]+/).map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean);
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  // Never treat Session.getEffectiveUser() as a viewer: it is often the deployer.
  if (!allowed.length || !email || allowed.indexOf(email) < 0) {
    throw new Error('ไม่ได้รับอนุญาต: ต้องใช้บัญชีอาจารย์ที่กำหนดไว้ใน UXQ_TEACHER_EMAILS');
  }
  return email;
}

function UXQ_ipSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = String(props.getProperty('UXQ_IP_SPREADSHEET_ID') || '').trim();
  if (!id && typeof UXQ_TEACHER_SPREADSHEET_ID !== 'undefined') {
    id = String(UXQ_TEACHER_SPREADSHEET_ID || '').trim();
  }
  if (!id && typeof UXQ_RECEIVER_SPREADSHEET_ID !== 'undefined') {
    id = String(UXQ_RECEIVER_SPREADSHEET_ID || '').trim();
  }
  if (!id) throw new Error('ยังไม่ได้ตั้ง UXQ_IP_SPREADSHEET_ID ใน Script Properties');
  return SpreadsheetApp.openById(id);
}

function UXQ_ipKey_(x) {
  return String(x == null ? '' : x).trim().toLowerCase().replace(/[^a-z0-9]/g,'');
}
function UXQ_ipRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const columns = values.shift().map(UXQ_ipKey_);
  return values.map(function(row) {
    const obj = {};
    columns.forEach(function(key,i){ if (key) obj[key] = String(row[i] == null ? '' : row[i]).trim(); });
    return obj;
  });
}
function UXQ_ipBool_(x) {
  return x === true || x === 1 || /^(true|1|yes|passed|ผ่าน)$/i.test(String(x || '').trim());
}
function UXQ_ipNumber_(x) {
  const n = Number(String(x == null ? '' : x).replace(/,/g,''));
  return Number.isFinite(n) ? n : 0;
}
function UXQ_ipMission_(x) {
  const id = String(x || '').trim().toLowerCase();
  return UXQ_IP_NODE_ORDER.indexOf(id) >= 0 ? id : '';
}
function UXQ_ipArtifactUrl_(row) {
  let p = {};
  try { p = JSON.parse(row.rawjson || '{}'); } catch (_) {}
  let url = String(p.figmaUrl || p.evidenceUrl || '').trim();
  const fields = Array.isArray(p.artifactFields) ? p.artifactFields : [];
  if (!url) {
    fields.some(function(f) {
      if (!f || !/^(figmaUrl|evidenceUrl)$/i.test(String(f.key || ''))) return false;
      url = String(f.value || '').trim(); return true;
    });
  }
  if (!/^https:\/\/[^\s<>"]+$/i.test(url)) return '';
  return url.slice(0,1000);
}
function UXQ_ipFreshNode_(id) {
  return {
    id:id, attempts:0, passedEvidence:false, bestScore:null, bestStars:0,
    latestScore:null, accuracy:null, reason:null, lastAt:'',
    status:'locked', artifactSubmitted:false, artifactEventId:'',
    artifactAt:'', artifactUrl:'', reviewStatus:'not_submitted', reviewScore:null
  };
}
function UXQ_ipNewStudent_(row) {
  const nodes = {};
  UXQ_IP_NODE_ORDER.forEach(function(id){ nodes[id] = UXQ_ipFreshNode_(id); });
  return {
    studentId:row.studentid, studentName:row.studentname || row.studentid,
    section:row.section, nodes:nodes, completedCount:0, submittedCount:0,
    approvedCount:0, latestAt:''
  };
}
/** Pure aggregation: test with fixtures; relies on no Google services. */
function UXQ_ipBuild_(attemptRows, reviewRows, rosterRows, section) {
  const students = {};
  const notices = [];
  function studentFor(row) {
    if (!row.studentid || row.section !== section) return null;
    const key = row.section + '|' + row.studentid;
    if (!students[key]) students[key] = UXQ_ipNewStudent_(row);
    if (row.studentname && (!students[key].studentName || students[key].studentName === row.studentid)) {
      students[key].studentName = row.studentname;
    }
    return students[key];
  }
  (rosterRows || []).forEach(studentFor);
  (attemptRows || []).forEach(function(row) {
    if (row.courseid && row.courseid !== 'UXQ-ACT1-2026' && row.courseid !== 'CSAI2601') return;
    const id = UXQ_ipMission_(row.missionid);
    if (!id) return;
    const type = String(row.eventtype || '').toLowerCase();
    if (type !== 'mission_completed' && type !== 'artifact_submitted') return;
    const student = studentFor(row);
    if (!student) return;
    const node = student.nodes[id];
    if (type === 'mission_completed') {
      node.attempts += 1;
      const score = UXQ_ipNumber_(row.score);
      const stars = UXQ_ipNumber_(row.stars);
      node.bestScore = node.bestScore === null ? score : Math.max(node.bestScore,score);
      node.bestStars = Math.max(node.bestStars,stars);
      node.passedEvidence = node.passedEvidence || UXQ_ipBool_(row.passed) || stars >= 2;
      node.latestScore = score;
      node.accuracy = UXQ_ipNumber_(row.accuracy);
      node.reason = UXQ_ipNumber_(row.verifiedaccuracy);
      node.lastAt = row.completedat || row.receivedat || '';
    } else {
      // The Sheet is append-only; the last matching submission is authoritative.
      node.artifactSubmitted = true;
      node.artifactEventId = row.eventid || '';
      node.artifactAt = row.artifactsubmittedat || row.receivedat || '';
      node.artifactUrl = UXQ_ipArtifactUrl_(row);
    }
    student.latestAt = row.receivedat || student.latestAt;
  });
  const lastReviews = {};
  (reviewRows || []).forEach(function(row) {
    if (!row.studentid || row.section !== section) return;
    const id = UXQ_ipMission_(row.missionid);
    if (!id) return;
    lastReviews[row.section+'|'+row.studentid+'|'+id] = row;
  });
  Object.keys(students).forEach(function(key) {
    const student = students[key];
    let completed = 0;
    // Official unlock counts only the contiguous passed prefix, not isolated passes.
    while (completed < UXQ_IP_NODE_ORDER.length &&
      student.nodes[UXQ_IP_NODE_ORDER[completed]].passedEvidence) completed += 1;
    student.completedCount = completed;
    UXQ_IP_NODE_ORDER.forEach(function(id,index) {
      const node = student.nodes[id];
      if (index < completed) node.status = 'passed';
      else if (node.passedEvidence) node.status = 'out_of_sequence';
      else if (index > completed) node.status = 'locked';
      else node.status = node.attempts ? 'retry' : 'ready';
      if (node.artifactSubmitted) {
        student.submittedCount += 1;
        node.reviewStatus = 'submitted';
        const review = lastReviews[key+'|'+id];
        // Do not transfer an older approval to a newer student submission.
        if (review && (!review.artifacteventid ||
                       (node.artifactEventId && review.artifacteventid === node.artifactEventId))) {
          const s = String(review.reviewstatus || '').toLowerCase();
          if (['approved','need_revision','reviewing'].indexOf(s) >= 0) {
            node.reviewStatus = s;
            node.reviewScore = review.totalscore === '' ? null : UXQ_ipNumber_(review.totalscore);
          }
        }
        if (node.reviewStatus === 'approved') student.approvedCount += 1;
      }
    });
  });
  const result = Object.keys(students).map(function(key){ return students[key]; })
    .sort(function(a,b){return a.studentId.localeCompare(b.studentId,'th',{numeric:true});});
  if (!rosterRows || !rosterRows.length) notices.push('ไม่มีชีต UXQuest_Roster: รายชื่อจะแสดงเฉพาะผู้ที่มีการบันทึกกิจกรรมแล้ว นักศึกษาที่ไม่เคยเข้าเล่นจะไม่ปรากฏ');
  return {ok:true,section:section,nodes:UXQ_IP_NODE_ORDER.map(function(id,i){return{id:id,label:UXQ_IP_NODE_LABELS[i]};}),
    students:result,studentCount:result.length,notices:notices,
    policy:'sheet_only_mission_completed_contiguous_w1_to_w15',generatedAt:new Date().toISOString()};
}

function UXQ_ipGetDashboard(input) {
  UXQ_ipAuthorize_();
  const requested = String(input && input.section || '101').trim();
  const allowedSections = String(PropertiesService.getScriptProperties()
    .getProperty('UXQ_TEACHER_SECTIONS') || '101')
    .split(/[,;\s]+/).map(function(x){return x.trim();}).filter(Boolean);
  if (allowedSections.indexOf(requested) < 0) throw new Error('ไม่อนุญาตให้ดู Section นี้');
  const ss = UXQ_ipSpreadsheet_();
  const attemptsSheet = ss.getSheetByName('UXQuest_Attempts');
  if (!attemptsSheet) throw new Error('ไม่พบ UXQuest_Attempts');
  const reviews = ss.getSheetByName('UXQuest_Studio_Reviews');
  const roster = ss.getSheetByName('UXQuest_Roster');
  return UXQ_ipBuild_(
    UXQ_ipRows_(attemptsSheet),
    UXQ_ipRows_(reviews),
    UXQ_ipRows_(roster),
    requested
  );
}
