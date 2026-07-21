/* =========================================================
 * CSAI2601 UX Quest • Studio Workflow v1
 * No doGet/doPost declarations in this file.
 * Google Sheet is the sole source of truth for studio status,
 * teacher review, revision and portfolio readiness.
 * ========================================================= */

const UXQ_STUDIO_VERSION = '20260721-STUDIO-WORKFLOW-V1';
const UXQ_STUDIO_NODES = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
const UXQ_STUDIO_REVIEW_SHEET = 'UXQuest_Studio_Reviews';
const UXQ_STUDIO_AUDIT_SHEET = 'UXQuest_Studio_Audit';

const UXQ_STUDIO_REVIEW_HEADERS = [
  'reviewId','receivedAt','courseId','section','studentId','studentName','projectId','missionId',
  'artifactEventId','linkedAttemptId','reviewStatus','evidenceScore','reasoningScore','artifactScore',
  'validationScore','reflectionScore','totalScore','teacherComment','revisionRequired','reviewedBy',
  'reviewedAt','revisionNo','previousReviewId'
];

const UXQ_STUDIO_AUDIT_HEADERS = [
  'auditId','receivedAt','actor','action','studentId','section','missionId','projectId','reviewId','detailJson'
];

function UXQ_setupStudioWorkflow() {
  const ss = UXQ_studioSpreadsheet_();
  UXQ_studioEnsureSheet_(ss, UXQ_STUDIO_REVIEW_SHEET, UXQ_STUDIO_REVIEW_HEADERS);
  UXQ_studioEnsureSheet_(ss, UXQ_STUDIO_AUDIT_SHEET, UXQ_STUDIO_AUDIT_HEADERS);
  return { ok:true, version:UXQ_STUDIO_VERSION, sheets:[UXQ_STUDIO_REVIEW_SHEET, UXQ_STUDIO_AUDIT_SHEET] };
}

function UXQ_getStudentStudioProgress_(e) {
  const p = (e && e.parameter) || e || {};
  const studentId = UXQ_studioText_(p.studentId, 80);
  const section = UXQ_studioText_(p.section, 80);
  const courseId = UXQ_studioText_(p.courseId || 'UXQ-ACT1-2026', 120);
  if (!studentId || !section) return { ok:false, error:'missing_identity' };

  const rows = UXQ_studioArtifactRows_().filter(function(row) {
    return row.studentId === studentId && row.section === section && (!row.courseId || row.courseId === courseId);
  });
  const reviews = UXQ_studioReviewRows_().filter(function(row) {
    return row.studentId === studentId && row.section === section && (!row.courseId || row.courseId === courseId);
  });

  const latestReview = {};
  reviews.forEach(function(row) {
    const id = row.missionId;
    if (!id) return;
    if (!latestReview[id] || String(row.reviewedAt || row.receivedAt) >= String(latestReview[id].reviewedAt || latestReview[id].receivedAt)) latestReview[id] = row;
  });

  const nodes = {};
  rows.forEach(function(row) {
    const id = row.missionId;
    if (UXQ_STUDIO_NODES.indexOf(id) < 0) return;
    if (!nodes[id]) nodes[id] = { missionId:id, submitted:false, submissions:0, latestSubmittedAt:'', projectId:'', figmaUrl:'', reflection:'', reviewStatus:'not_reviewed', totalScore:'', teacherComment:'', revisionRequired:false };
    const node = nodes[id];
    node.submitted = true;
    node.submissions += 1;
    if (!node.latestSubmittedAt || row.artifactSubmittedAt >= node.latestSubmittedAt) {
      node.latestSubmittedAt = row.artifactSubmittedAt;
      node.projectId = row.projectId;
      node.figmaUrl = row.figmaUrl;
      node.reflection = row.reflection;
      node.artifactEventId = row.eventId;
      node.linkedAttemptId = row.linkedAttemptId;
    }
  });

  UXQ_STUDIO_NODES.forEach(function(id) {
    if (!nodes[id]) nodes[id] = { missionId:id, submitted:false, submissions:0, latestSubmittedAt:'', projectId:'', figmaUrl:'', reflection:'', reviewStatus:'not_submitted', totalScore:'', teacherComment:'', revisionRequired:false };
    const review = latestReview[id];
    if (review) {
      nodes[id].reviewStatus = review.reviewStatus || 'reviewing';
      nodes[id].totalScore = review.totalScore;
      nodes[id].teacherComment = review.teacherComment;
      nodes[id].revisionRequired = UXQ_studioBool_(review.revisionRequired);
      nodes[id].reviewedAt = review.reviewedAt;
    } else if (nodes[id].submitted) nodes[id].reviewStatus = 'submitted';
  });

  const submittedCount = UXQ_STUDIO_NODES.filter(function(id){ return nodes[id].submitted; }).length;
  const approvedCount = UXQ_STUDIO_NODES.filter(function(id){ return nodes[id].reviewStatus === 'approved'; }).length;
  const revisionCount = UXQ_STUDIO_NODES.filter(function(id){ return nodes[id].reviewStatus === 'need_revision'; }).length;
  const projectIds = {};
  UXQ_STUDIO_NODES.forEach(function(id){ if (nodes[id].projectId) projectIds[nodes[id].projectId] = true; });

  return {
    ok:true, version:UXQ_STUDIO_VERSION, studentId:studentId, section:section, courseId:courseId,
    nodes:nodes, summary:{ submittedCount:submittedCount, approvedCount:approvedCount, revisionCount:revisionCount, totalNodes:UXQ_STUDIO_NODES.length, projectIds:Object.keys(projectIds), continuityOk:Object.keys(projectIds).length <= 1 },
    portfolioReady:submittedCount === UXQ_STUDIO_NODES.length && revisionCount === 0,
    generatedAt:new Date().toISOString()
  };
}

function UXQ_teacherStudioOverview(filters) {
  filters = filters || {};
  const section = UXQ_studioText_(filters.section, 80);
  const query = UXQ_studioText_(filters.query, 120).toLowerCase();
  const artifacts = UXQ_studioArtifactRows_().filter(function(row) {
    if (section && row.section !== section) return false;
    if (query && [row.studentId,row.studentName,row.projectId,row.missionId].join(' ').toLowerCase().indexOf(query) < 0) return false;
    return true;
  });
  const reviews = UXQ_studioReviewRows_();
  const reviewByArtifact = {};
  reviews.forEach(function(row) {
    const key = row.artifactEventId || [row.studentId,row.section,row.missionId].join('|');
    if (!reviewByArtifact[key] || String(row.reviewedAt || row.receivedAt) >= String(reviewByArtifact[key].reviewedAt || reviewByArtifact[key].receivedAt)) reviewByArtifact[key] = row;
  });

  const records = artifacts.map(function(row) {
    const key = row.eventId || [row.studentId,row.section,row.missionId].join('|');
    const review = reviewByArtifact[key] || {};
    return Object.assign({}, row, {
      reviewStatus:review.reviewStatus || 'submitted', totalScore:review.totalScore || '', teacherComment:review.teacherComment || '', revisionRequired:UXQ_studioBool_(review.revisionRequired), reviewedAt:review.reviewedAt || ''
    });
  }).sort(function(a,b){ return String(b.artifactSubmittedAt).localeCompare(String(a.artifactSubmittedAt)); });

  const students = {};
  records.forEach(function(row) {
    const key = row.section + '|' + row.studentId;
    if (!students[key]) students[key] = { studentId:row.studentId, studentName:row.studentName, section:row.section, projectIds:{}, submitted:0, approved:0, needRevision:0, latest:'' };
    const s = students[key];
    s.submitted += 1;
    if (row.projectId) s.projectIds[row.projectId] = true;
    if (row.reviewStatus === 'approved') s.approved += 1;
    if (row.reviewStatus === 'need_revision') s.needRevision += 1;
    if (row.artifactSubmittedAt > s.latest) s.latest = row.artifactSubmittedAt;
  });

  return { ok:true, version:UXQ_STUDIO_VERSION, records:records, students:Object.keys(students).map(function(key){ const s=students[key]; s.projectIds=Object.keys(s.projectIds); s.continuityOk=s.projectIds.length<=1; return s; }), generatedAt:new Date().toISOString() };
}

function UXQ_teacherReviewStudio(input) {
  input = input || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const status = UXQ_studioText_(input.reviewStatus, 40).toLowerCase();
    if (['reviewing','need_revision','approved'].indexOf(status) < 0) throw new Error('invalid_review_status');
    const scores = ['evidenceScore','reasoningScore','artifactScore','validationScore','reflectionScore'].map(function(key){ return UXQ_studioClamp_(Number(input[key] || 0),0,4); });
    const total = Math.round((scores[0]*25 + scores[1]*25 + scores[2]*25 + scores[3]*15 + scores[4]*10) / 4);
    const row = {
      reviewId:Utilities.getUuid(), receivedAt:new Date().toISOString(), courseId:UXQ_studioText_(input.courseId || 'UXQ-ACT1-2026',120), section:UXQ_studioText_(input.section,80), studentId:UXQ_studioText_(input.studentId,80), studentName:UXQ_studioText_(input.studentName,120), projectId:UXQ_studioText_(input.projectId,160), missionId:UXQ_studioMission_(input.missionId), artifactEventId:UXQ_studioText_(input.artifactEventId,160), linkedAttemptId:UXQ_studioText_(input.linkedAttemptId,160), reviewStatus:status, evidenceScore:scores[0], reasoningScore:scores[1], artifactScore:scores[2], validationScore:scores[3], reflectionScore:scores[4], totalScore:total, teacherComment:UXQ_studioText_(input.teacherComment,3000), revisionRequired:status === 'need_revision', reviewedBy:UXQ_studioText_(input.reviewedBy || Session.getActiveUser().getEmail() || 'teacher',160), reviewedAt:new Date().toISOString(), revisionNo:Number(input.revisionNo || 0), previousReviewId:UXQ_studioText_(input.previousReviewId,160)
    };
    if (!row.studentId || !row.section || !row.missionId) throw new Error('missing_review_identity');
    const ss = UXQ_studioSpreadsheet_();
    const sheet = UXQ_studioEnsureSheet_(ss, UXQ_STUDIO_REVIEW_SHEET, UXQ_STUDIO_REVIEW_HEADERS);
    UXQ_studioAppend_(sheet, UXQ_STUDIO_REVIEW_HEADERS, row);
    UXQ_studioAudit_('teacher_review', row.reviewedBy, row, { status:status, totalScore:total });
    return { ok:true, review:row };
  } finally { lock.releaseLock(); }
}

function UXQ_teacherPortfolioData(input) {
  input = input || {};
  const studentId = UXQ_studioText_(input.studentId,80);
  const section = UXQ_studioText_(input.section,80);
  if (!studentId || !section) throw new Error('missing_identity');
  const progress = UXQ_getStudentStudioProgress_({ studentId:studentId, section:section, courseId:input.courseId || 'UXQ-ACT1-2026' });
  const artifacts = UXQ_studioArtifactRows_().filter(function(row){ return row.studentId===studentId && row.section===section; });
  const latest = {};
  artifacts.forEach(function(row){ if (!latest[row.missionId] || row.artifactSubmittedAt >= latest[row.missionId].artifactSubmittedAt) latest[row.missionId]=row; });
  return { ok:true, version:UXQ_STUDIO_VERSION, studentId:studentId, section:section, progress:progress, artifacts:UXQ_STUDIO_NODES.map(function(id){ return latest[id] || { missionId:id }; }), generatedAt:new Date().toISOString() };
}

function UXQ_studioArtifactRows_() {
  const sheet = UXQ_studioAttemptsSheet_();
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data.shift();
  const idx = {}; headers.forEach(function(h,i){ idx[UXQ_studioKey_(h)] = i; });
  return data.filter(function(row){ return String(row[idx.eventtype] || '').trim().toLowerCase() === 'artifact_submitted'; }).map(function(row){
    const raw = UXQ_studioParse_(idx.rawjson===undefined ? '' : row[idx.rawjson]);
    const fields = Array.isArray(raw.artifactFields) ? raw.artifactFields : [];
    const map = {}; fields.forEach(function(f){ map[String(f.key||'')] = String(f.value||''); });
    return {
      eventId:UXQ_studioCell_(row,idx,'eventid'), linkedAttemptId:UXQ_studioCell_(row,idx,'linkedattemptid'), courseId:UXQ_studioCell_(row,idx,'courseid'), section:UXQ_studioCell_(row,idx,'section'), studentId:UXQ_studioCell_(row,idx,'studentid'), studentName:UXQ_studioCell_(row,idx,'studentname'), missionId:UXQ_studioMission_(UXQ_studioCell_(row,idx,'missionid')), projectId:String(raw.projectId || map.projectId || ''), figmaUrl:String(raw.figmaUrl || map.figmaUrl || ''), artifactType:UXQ_studioCell_(row,idx,'artifacttype'), reflection:UXQ_studioCell_(row,idx,'reflection') || String(map.reflection || ''), artifactSubmittedAt:UXQ_studioCell_(row,idx,'artifactsubmittedat') || UXQ_studioCell_(row,idx,'receivedat'), artifactFields:fields, rawJson:raw
    };
  });
}

function UXQ_studioReviewRows_() {
  const ss = UXQ_studioSpreadsheet_();
  const sheet = UXQ_studioEnsureSheet_(ss, UXQ_STUDIO_REVIEW_SHEET, UXQ_STUDIO_REVIEW_HEADERS);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues(); const headers = values.shift();
  return values.map(function(row){ const obj={}; headers.forEach(function(h,i){ obj[h]=row[i]; }); return obj; });
}

function UXQ_studioAudit_(action, actor, row, detail) {
  const ss = UXQ_studioSpreadsheet_();
  const sheet = UXQ_studioEnsureSheet_(ss, UXQ_STUDIO_AUDIT_SHEET, UXQ_STUDIO_AUDIT_HEADERS);
  UXQ_studioAppend_(sheet, UXQ_STUDIO_AUDIT_HEADERS, { auditId:Utilities.getUuid(), receivedAt:new Date().toISOString(), actor:actor, action:action, studentId:row.studentId, section:row.section, missionId:row.missionId, projectId:row.projectId, reviewId:row.reviewId, detailJson:JSON.stringify(detail || {}) });
}

function UXQ_studioSpreadsheet_() { let id=''; try { id=String(UXQ_RECEIVER_SPREADSHEET_ID||'').trim(); } catch(e){} if (!id) id=String(PropertiesService.getScriptProperties().getProperty('UXQ_RECEIVER_SPREADSHEET_ID')||'').trim(); return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); }
function UXQ_studioAttemptsSheet_() { const ss=UXQ_studioSpreadsheet_(); return ss.getSheetByName(typeof UXQ_ATTEMPTS_SHEET!=='undefined'&&UXQ_ATTEMPTS_SHEET?UXQ_ATTEMPTS_SHEET:'UXQuest_Attempts'); }
function UXQ_studioEnsureSheet_(ss,name,headers){ let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); if(sh.getLastColumn()<headers.length || sh.getLastRow()===0){ sh.getRange(1,1,1,headers.length).setValues([headers]); sh.setFrozenRows(1); } return sh; }
function UXQ_studioAppend_(sheet,headers,obj){ sheet.getRange(sheet.getLastRow()+1,1,1,headers.length).setValues([headers.map(function(h){ return obj[h]===undefined?'':obj[h]; })]); }
function UXQ_studioCell_(row,idx,key){ return idx[key]===undefined?'':String(row[idx[key]]||'').trim(); }
function UXQ_studioKey_(v){ return String(v==null?'':v).trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g,''); }
function UXQ_studioText_(v,max){ let s=String(v==null?'':v).trim(); if(max&&s.length>max)s=s.slice(0,max); return /^[=+\-@]/.test(s)?"'"+s:s; }
function UXQ_studioMission_(v){ const m=String(v||'').toLowerCase().match(/(?:^|[^a-z0-9])(w(?:[1-9]|1[0-5])|b[1-4])(?:$|[^a-z0-9])/i)||String(v||'').toLowerCase().match(/^(w(?:[1-9]|1[0-5])|b[1-4])$/i); return m?String(m[1]).toLowerCase():''; }
function UXQ_studioBool_(v){ return v===true||v===1||String(v).toLowerCase()==='true'||String(v)==='1'; }
function UXQ_studioClamp_(v,min,max){ return Math.max(min,Math.min(max,Number(v)||0)); }
function UXQ_studioParse_(v){ try{return JSON.parse(String(v||'{}'));}catch(e){return{};} }
