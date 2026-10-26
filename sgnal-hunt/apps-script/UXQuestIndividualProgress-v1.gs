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

/* Stage answers are normally saved only with mission_completed events.
 * This view does not infer unfinished in-game clicks that were never sent.
 */
function UXQ_ipJson_(value) {
  try {
    const data = JSON.parse(String(value || '{}'));
    return data && typeof data === 'object' ? data : {};
  } catch (_) { return {}; }
}
function UXQ_ipStageSummary_(row) {
  const raw = UXQ_ipJson_(row.rawjson);
  const answers = Array.isArray(raw.answers) ? raw.answers.slice(0,32) : [];
  const groups = {};
  answers.forEach(function(answer) {
    if (!answer || typeof answer !== 'object') return;
    const id = String(answer.stageKey || 'reasoning').trim().slice(0,80);
    if (!groups[id]) groups[id] = {key:id, answered:0, correct:0, verified:0};
    groups[id].answered += 1;
    if (UXQ_ipBool_(answer.correct)) groups[id].correct += 1;
    if (UXQ_ipBool_(answer.verified)) groups[id].verified += 1;
  });
  return Object.keys(groups).slice(0,16).map(function(key){return groups[key];});
}
function UXQ_ipFields_(row) {
  const raw = UXQ_ipJson_(row.rawjson);
  let fields = Array.isArray(raw.artifactFields) ? raw.artifactFields : [];
  if (!fields.length) {
    try { const a = JSON.parse(row.artifactfields || '[]'); if (Array.isArray(a)) fields = a; }
    catch (_) {}
  }
  return fields.slice(0,8).filter(function(f){return f && typeof f === 'object';})
    .map(function(f) {
      return {
        key:String(f.key || '').slice(0,100),
        label:String(f.label || f.key || 'หลักฐาน').slice(0,180),
        filled:Boolean(String(f.value == null ? '' : f.value).trim()),
        required:UXQ_ipBool_(f.required)
      };
    });
}
/* Reflection provenance diagnostic for teacher-only QA.
 * Classification is READ-ONLY and returns presence/category only, never student responses.
 * A nonempty top-level reflection is ambiguous: receiver versions can synthesize
 * that field from problemSeen / uxReason / fixAndTest.
 */
function UXQ_ipAuditJson_(value) {
  const text = String(value || '').trim();
  if (!text) return {parsed:null,invalid:false};
  try {
    const parsed=JSON.parse(text);
    return {parsed:parsed,invalid:false};
  } catch (_) {
    return {parsed:null,invalid:true};
  }
}
function UXQ_ipAuditReflection_(row) {
  const rawParsed=UXQ_ipAuditJson_(row.rawjson);
  const sheetParsed=UXQ_ipAuditJson_(row.artifactfields);
  const raw=rawParsed.parsed && typeof rawParsed.parsed==='object' && !Array.isArray(rawParsed.parsed)
    ? rawParsed.parsed : {};
  const rawFields=Array.isArray(raw.artifactFields)?raw.artifactFields:[];
  const sheetFields=Array.isArray(sheetParsed.parsed)?sheetParsed.parsed:[];
  function reflectionField(fields) {
    return fields.filter(function(field){
      return field && typeof field==='object' &&
        String(field.key || '').trim().toLowerCase()==='reflection';
    })[0] || null;
  }
  const rawField=reflectionField(rawFields),sheetField=reflectionField(sheetFields);
  const authored=Boolean(
    (rawField && String(rawField.value == null?'':rawField.value).trim()) ||
    (sheetField && String(sheetField.value == null?'':sheetField.value).trim())
  );
  const rawText=String(raw.reflection || '').trim();
  const columnText=String(row.reflection || '').trim();
  const textPresent=Boolean(rawText || columnText);
  const hasField=Boolean(rawField || sheetField);
  let type='missing';
  if(authored) type='explicit';
  else if(hasField && textPresent) type='field_empty_but_text';
  else if(hasField) type='explicit_field_empty';
  else if(textPresent) type='top_level_only';
  else if(rawParsed.invalid || sheetParsed.invalid) type='unreadable';
  const concat=[row.problemseen,row.uxreason,row.fixandtest].map(function(v){
    return String(v || '').trim();
  }).filter(Boolean).join(' | ');
  const normalized=function(x){return String(x || '').replace(/\s+/g,' ').trim();};
  const matchesReceiverFallback=Boolean(
    type!=='explicit' && concat && normalized(columnText || rawText)===normalized(concat)
  );
  return {
    type:type,explicit:authored,textPresent:textPresent,
    source:authored?(rawField && String(rawField.value || '').trim()?'raw_artifactFields':'sheet_artifactFields'):'',
    hasField:hasField,
    rawInvalid:rawParsed.invalid,sheetInvalid:sheetParsed.invalid,
    mayBeSynthesized:matchesReceiverFallback
  };
}
function UXQ_ipReflectionAudit_(attemptRows,section) {
  // Last append wins, independently for every student W/B. No writing whatsoever.
  const latest={};
  let submissionRows=0;
  (attemptRows || []).forEach(function(row) {
    if(String(row.section || '')!==section || !String(row.studentid || '').trim())return;
    if(row.courseid && row.courseid!=='UXQ-ACT1-2026' && row.courseid!=='CSAI2601')return;
    const id=UXQ_ipMission_(row.missionid);
    if(!id || String(row.eventtype || '').toLowerCase()!=='artifact_submitted')return;
    submissionRows+=1;
    latest[row.studentid+'|'+id]=UXQ_ipAuditReflection_(row);
  });
  const categories=['explicit','field_empty_but_text','explicit_field_empty','top_level_only','unreadable','missing'];
  const counts={};
  categories.forEach(function(key){counts[key]=0;});
  const byNode={};
  UXQ_IP_NODE_ORDER.forEach(function(id){
    const row={missionId:id,submitted:0};
    categories.forEach(function(key){row[key]=0;});
    byNode[id]=row;
  });
  const uniqueStudents={};
  let suspicious=0,rawExplicit=0,sheetExplicit=0,invalid=0;
  Object.keys(latest).forEach(function(key){
    const idx=key.lastIndexOf('|'),sid=key.slice(0,idx),id=key.slice(idx+1);
    const status=latest[key];
    if(!byNode[id])return;
    uniqueStudents[sid]=true;
    counts[status.type]=(counts[status.type]||0)+1;
    byNode[id].submitted+=1;
    byNode[id][status.type]=(byNode[id][status.type]||0)+1;
    if(status.mayBeSynthesized)suspicious+=1;
    if(status.source==='raw_artifactFields')rawExplicit+=1;
    if(status.source==='sheet_artifactFields')sheetExplicit+=1;
    if(status.rawInvalid || status.sheetInvalid)invalid+=1;
  });
  return {
    section:section,studentCount:Object.keys(uniqueStudents).length,
    latestSubmittedNodeCount:Object.keys(latest).length,submissionRows:submissionRows,
    counts:counts,explicitSources:{rawFields:rawExplicit,sheetFields:sheetExplicit},
    possibleReceiverFallbackCount:suspicious,parseIssueCount:invalid,
    byNode:UXQ_IP_NODE_ORDER.map(function(id){return byNode[id];}),
    diagnosticOnly:true,source:'UXQuest_Attempts_latest_artifact_submission_per_student_node',
    note:'Top-level reflection may be receiver-generated. An empty or missing explicit field is not evidence that the student never wrote a reflection. No scores or rows were changed.'
  };
}

function UXQ_ipReflectionState_(row, fields) {
  const field = fields.filter(function(f){return f.key.toLowerCase() === 'reflection';})[0];
  if (field) return field.filled ? 'submitted' : 'missing';
  // Earlier receiver may construct reflection from problemSeen/uxReason/fixAndTest.
  // Do not falsely mark synthesized values as a student's reflection.
  const raw = UXQ_ipJson_(row.rawjson);
  return String(row.reflection || raw.reflection || '').trim() ? 'unverified' : 'missing';
}

function UXQ_ipFreshNode_(id) {
  return {
    id:id, attempts:0, passedEvidence:false, bestScore:null, bestStars:0,
    latestScore:null, accuracy:null, reason:null, lastAt:'',
    status:'locked', artifactSubmitted:false, artifactEventId:'',
    artifactAt:'', artifactUrl:'', reviewStatus:'not_submitted', reviewScore:null,
    missionStages:[], missionQuestions:0, missionVerified:0, missionCorrect:0,
    reasonRetryCount:0, reasonRetryAt:'', studioFields:[], requiredMissing:[],
    reflectionStatus:'not_submitted', reflectionSubmitted:false, reflectionEvidenceAudit:null,
    partsCompleted:0, fullThreePart:false, nextStep:''
  };
}
function UXQ_ipNewStudent_(row) {
  const nodes = {};
  UXQ_IP_NODE_ORDER.forEach(function(id){ nodes[id] = UXQ_ipFreshNode_(id); });
  return {
    studentId:row.studentid, studentName:row.studentname || row.studentid,
    section:row.section, nodes:nodes, completedCount:0, submittedCount:0,
    approvedCount:0, reflectionCount:0, fullThreePartCount:0,
    courseCompletedCount:0, nextCourseNode:'w1', historicalLockedCount:0, latestAt:''
  };
}
/* Read-only audit: why a student visible in the raw Sheet might be
 * absent from the 19-node progress matrix. Teacher-authenticated only.
 */
function UXQ_ipAuditIdentities_(attemptRows, students, section) {
  const raw = {};
  (attemptRows || []).forEach(function(row) {
    if (row.section !== section || !row.studentid) return;
    const key = String(row.studentid);
    if (!raw[key]) raw[key] = {studentId:key,studentName:row.studentname || key,
      rowCount:0, types:{}, courses:{}, missionIds:{}, accepted:0};
    const item = raw[key];
    item.rowCount += 1;
    const type = String(row.eventtype || '(blank)').toLowerCase();
    const course = String(row.courseid || '(blank)');
    const mission = String(row.missionid || '(blank)').toLowerCase();
    item.types[type] = (item.types[type] || 0) + 1;
    item.courses[course] = (item.courses[course] || 0) + 1;
    item.missionIds[mission] = (item.missionIds[mission] || 0) + 1;
    const allowedCourse = !row.courseid ||
      row.courseid === 'UXQ-ACT1-2026' || row.courseid === 'CSAI2601';
    if (allowedCourse && UXQ_ipMission_(mission) &&
      ['mission_completed','artifact_submitted','reason_retry_submitted'].indexOf(type) >= 0) {
      item.accepted += 1;
    }
  });
  const rawList = Object.keys(raw).sort(function(a,b){
    return a.localeCompare(b,'th',{numeric:true});
  }).map(function(id){return raw[id];});
  const excluded = rawList.filter(function(item) {
    return !students[section+'|'+item.studentId];
  }).map(function(item) {
    return {studentId:item.studentId, studentName:item.studentName,
      rows:item.rowCount, eventTypes:Object.keys(item.types),
      courseIds:Object.keys(item.courses), missionIds:Object.keys(item.missionIds),
      reason:item.accepted ? 'ตรวจตัวตน/การกรอง' : 'ไม่มีแถวที่ผ่านเงื่อนไขการนับ 19 ด่าน'};
  });
  return {rawSheetStudentCount:rawList.length, countedFromEvents:rawList.length-excluded.length,
    excludedCount:excluded.length, excluded:excluded.slice(0,50),
    omittedBeyond50:Math.max(0,excluded.length-50),
    note:'นับเฉพาะ Section ที่เลือกและข้อมูลใน UXQuest_Attempts เท่านั้น; Dashboard v6.2 อาจใช้เกณฑ์หรือแหล่งข้อมูลต่างกัน'};
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
    if (['mission_completed','artifact_submitted','reason_retry_submitted'].indexOf(type) < 0) return;
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
      node.missionStages = UXQ_ipStageSummary_(row);
      node.missionQuestions = node.missionStages.reduce(function(n,s){return n+s.answered;},0);
      node.missionVerified = node.missionStages.reduce(function(n,s){return n+s.verified;},0);
      node.missionCorrect = node.missionStages.reduce(function(n,s){return n+s.correct;},0);
    } else if (type === 'reason_retry_submitted') {
      node.reasonRetryCount += 1;
      node.reasonRetryAt = row.reasonretrysubmittedat || row.receivedat || '';
    } else {
      // The Sheet is append-only; the last matching submission is authoritative.
      node.artifactSubmitted = true;
      node.artifactEventId = row.eventid || '';
      node.artifactAt = row.artifactsubmittedat || row.receivedat || '';
      node.artifactUrl = UXQ_ipArtifactUrl_(row);
      node.studioFields = UXQ_ipFields_(row);
      node.requiredMissing = node.studioFields
        .filter(function(f){return f.required && !f.filled;})
        .map(function(f){return f.label;});
      node.reflectionStatus = UXQ_ipReflectionState_(row,node.studioFields);
      node.reflectionEvidenceAudit=UXQ_ipAuditReflection_(row);
      node.reflectionSubmitted = node.reflectionStatus === 'submitted';
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
      if (node.reflectionSubmitted) student.reflectionCount += 1;
      // 3/3 course activities do NOT change the official mission unlock policy.
      node.partsCompleted = Number(node.status === 'passed') +
        Number(node.artifactSubmitted) + Number(node.reflectionSubmitted);
      node.fullThreePart = node.partsCompleted === 3;
      if (node.fullThreePart) student.fullThreePartCount += 1;
      node.nextStep = node.status !== 'passed' ? 'mission' :
        !node.artifactSubmitted ? 'studio' :
        !node.reflectionSubmitted ? 'reflection' :
        node.reviewStatus === 'need_revision' ? 'revision' :
        node.reviewStatus === 'submitted' || node.reviewStatus === 'reviewing' ?
          'teacher_review' : 'complete';
    });
    let courseDone=0;
    while(courseDone<UXQ_IP_NODE_ORDER.length &&
          student.nodes[UXQ_IP_NODE_ORDER[courseDone]].fullThreePart) courseDone+=1;
    student.courseCompletedCount=courseDone;
    student.nextCourseNode=UXQ_IP_NODE_ORDER[courseDone]||'';
    UXQ_IP_NODE_ORDER.forEach(function(id,index){
      const node=student.nodes[id];
      // Preserve historical Mission/Studio evidence. Access is a separate
      // 3/3 status; attempts made under old unlock rules are never deleted.
      node.accessStatus=index>courseDone?'locked':index===courseDone?'ready':'completed';
      node.accessLockedBy=index>courseDone?UXQ_IP_NODE_ORDER[courseDone]:'';
      node.missionHistoryPassed=Boolean(node.passedEvidence);
      if(node.accessStatus==='locked' &&
         (node.attempts>0 || node.artifactSubmitted || node.passedEvidence)) {
        student.historicalLockedCount+=1;
      }
    });
  });
  const identityAudit = UXQ_ipAuditIdentities_(attemptRows, students, section);
  const reflectionAudit = UXQ_ipReflectionAudit_(attemptRows,section);
  // Find read-side parsing mismatches without modifying grades or statuses.
  // Example: rawJson has an empty field but artifactFields column has
  // a filled Reflection; source provenance is explicit, yet prior display
  // may still say 2/3 because it prefers rawJson unconditionally.
  reflectionAudit.explicitButNotCounted=0;
  reflectionAudit.byNode.forEach(function(row){row.explicitButNotCounted=0;});
  Object.keys(students).forEach(function(key) {
    UXQ_IP_NODE_ORDER.forEach(function(id,index) {
      const node=students[key].nodes[id];
      if(node.artifactSubmitted && node.reflectionEvidenceAudit &&
         node.reflectionEvidenceAudit.explicit && !node.reflectionSubmitted) {
        reflectionAudit.explicitButNotCounted+=1;
        reflectionAudit.byNode[index].explicitButNotCounted+=1;
      }
    });
  });
  const result = Object.keys(students).map(function(key){ return students[key]; })
    .sort(function(a,b){return a.studentId.localeCompare(b.studentId,'th',{numeric:true});});
  if (!rosterRows || !rosterRows.length) notices.push('ไม่มีชีต UXQuest_Roster: รายชื่อจะแสดงเฉพาะผู้ที่มีการบันทึกกิจกรรมแล้ว นักศึกษาที่ไม่เคยเข้าเล่นจะไม่ปรากฏ');
  return {ok:true,section:section,nodes:UXQ_IP_NODE_ORDER.map(function(id,i){return{id:id,label:UXQ_IP_NODE_LABELS[i]};}),
    students:result,studentCount:result.length,notices:notices,
    identityAudit:identityAudit,reflectionAudit:reflectionAudit,
    policy:'teacher_preview_three_part_contiguous_no_live_gate_claim',
    policyActivation:'unverified_pending_receiver_and_student_runtime_deploy',
    generatedAt:new Date().toISOString()};
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
