/**
 * HeroHealth Authority V9 • Assessment Evidence Recovery
 * Version: 2026-07-30-PRODUCTION-V9-ASSESSMENT-AUTHORITY
 *
 * INSTALLATION
 * 1) Keep HeroHealthClassroomReceiver.gs for common helpers, submit routes and analytics.
 * 2) Remove/comment ONLY the old doGet(e) and doPost(e) declarations from that file.
 * 3) Add this whole file to the same Apps Script project.
 * 4) Deploy > Manage deployments > Edit > New version > Deploy.
 *
 * Purpose
 * - Google Sheet remains the sole authority.
 * - Reads HH_Assessments despite legacy/reordered/renamed headers.
 * - Never asks a learner to repeat Pre-test when valid Sheet evidence exists.
 * - Adds action=studentDebug for transparent diagnosis.
 */

const HH_AUTHORITY_V9 = '2026-07-30-PRODUCTION-V9-ASSESSMENT-AUTHORITY';

function doGet(e) {
  const action = text_(e && e.parameter && e.parameter.action || 'ping');
  try {
    if (action === 'submit') return output_(acceptPayload_(parsePayload_(e)),e);
    const ss = getHHSpreadsheet_();
    const sid = cleanStudentId_(e && e.parameter && (e.parameter.studentId || e.parameter.pid));
    if (action === 'student') return output_(HHV9_buildStudentAuthority_(ss,sid),e);
    if (action === 'studentDebug') return output_(HHV9_studentDebug_(ss,sid),e);
    if (action === 'event') return output_(buildEventPayload_(ss,e),e);
    if (action === 'live') return output_(buildLivePayload_(ss,e),e);
    if (action === 'reconcileStudent') return output_(HHV9_rebuildStudentLive_(sid),e);
    if (action === 'reconcileAll') return output_(HHV9_rebuildAllLive_(),e);
    if (action === 'setup') return output_(HH_setupSheets(),e);
    return output_({
      ok:true,
      service:'HeroHealth Classroom Receiver',
      version:HH_AUTHORITY_V9,
      baseVersion:typeof HH_VERSION==='undefined'?'':HH_VERSION,
      authority:'google_sheet',
      assessmentAuthority:'header-resilient-v9',
      studentDebug:true,
      ts:new Date().toISOString()
    },e);
  } catch (err) {
    logErrorSafe_('',e && e.parameter && e.parameter.studentId,err,{action:action,parameters:e && e.parameter || {}});
    return output_({ok:false,error:String(err && err.message || err),version:HH_AUTHORITY_V9},e);
  }
}

function doPost(e) {
  return json_(acceptPayload_(parsePayload_(e)));
}

function HHV9_key_(v) {
  return String(v == null ? '' : v)
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\()\[\]]+/g,'');
}

function HHV9_pick_(row,aliases) {
  if (!row) return '';
  const map={};
  Object.keys(row).forEach(k=>map[HHV9_key_(k)]=row[k]);
  for (let i=0;i<aliases.length;i++) {
    const k=HHV9_key_(aliases[i]);
    if (Object.prototype.hasOwnProperty.call(map,k) && map[k] !== '' && map[k] != null) return map[k];
  }
  return '';
}

function HHV9_normalizeAssessment_(v) {
  const x=HHV9_key_(v);
  if (x==='pre'||x==='pretest'||x==='ก่อนเรียน'||x==='แบบทดสอบก่อนเรียน') return 'pretest';
  if (x==='post'||x==='posttest'||x==='หลังเรียน'||x==='แบบทดสอบหลังเรียน') return 'posttest';
  return x;
}

function HHV9_sheetRows_(sh) {
  if (!sh || sh.getLastRow()<2 || sh.getLastColumn()<1) return [];
  const values=sh.getDataRange().getValues();
  const rawHeaders=values.shift();
  const headers=rawHeaders.map((h,i)=>String(h||('column'+(i+1))).trim());
  return values.filter(r=>r.some(v=>v!==''&&v!=null)).map((r,rowIndex)=>{
    const o={__rowNumber:rowIndex+2};
    headers.forEach((h,i)=>o[h]=r[i]);
    return o;
  });
}

function HHV9_studentIdFromRow_(row) {
  return cleanStudentId_(HHV9_pick_(row,[
    'studentId','student_id','student id','pid','sid','รหัสนักเรียน','รหัส','เลขประจำตัวนักเรียน'
  ]));
}

function HHV9_rowsForStudent_(sh,sid) {
  const id=cleanStudentId_(sid);
  return HHV9_sheetRows_(sh).filter(row=>HHV9_studentIdFromRow_(row)===id);
}

function HHV9_assessmentType_(row) {
  let value=HHV9_pick_(row,[
    'assessment','assessmentType','assessment_type','type','mode','testType','test_type','แบบทดสอบ','ประเภท'
  ]);
  if (!value) {
    const payload=HHV9_pick_(row,['payloadJson','payload','json']);
    try {
      const p=typeof payload==='string'?JSON.parse(payload):payload;
      value=p && p.assessment && (p.assessment.type||p.assessment.assessmentType) || p && (p.assessmentType||p.type) || '';
    } catch (_) {}
  }
  return HHV9_normalizeAssessment_(value);
}

function HHV9_score_(row) {
  const direct=HHV9_pick_(row,['score','คะแนน','rawScore','correct','correctCount']);
  const n=Number(direct);
  if (direct!=='' && Number.isFinite(n)) return n;
  const payload=HHV9_pick_(row,['payloadJson','payload','json']);
  try {
    const p=typeof payload==='string'?JSON.parse(payload):payload;
    const v=p && p.assessment && p.assessment.score;
    return Number.isFinite(Number(v))?Number(v):undefined;
  } catch (_) { return undefined; }
}

function HHV9_total_(row) {
  const direct=HHV9_pick_(row,['total','totalScore','จำนวนข้อ','ข้อทั้งหมด']);
  const n=Number(direct);
  if (direct!=='' && Number.isFinite(n)) return n;
  const payload=HHV9_pick_(row,['payloadJson','payload','json']);
  try {
    const p=typeof payload==='string'?JSON.parse(payload):payload;
    const v=p && p.assessment && p.assessment.total;
    return Number.isFinite(Number(v))?Number(v):undefined;
  } catch (_) { return undefined; }
}

function HHV9_dateValue_(row) {
  return HHV9_pick_(row,['serverTs','timestamp','serverTimestamp','clientTs','submittedAt','date','เวลา','วันที่']);
}

function HHV9_latest_(rows) {
  if (!rows || !rows.length) return null;
  return rows.slice().sort((a,b)=>dateMs_(HHV9_dateValue_(b))-dateMs_(HHV9_dateValue_(a)))[0]||rows[rows.length-1];
}

function HHV9_profile_(rows,sid) {
  const row=HHV9_latest_(rows);
  if (!row) return null;
  return {
    studentId:cleanStudentId_(sid),
    fullName:text_(HHV9_pick_(row,['fullName','studentName','name','ชื่อ','ชื่อสกุล'])),
    section:text_(HHV9_pick_(row,['section','class','room','ห้อง','ชั้น'])),
    group:text_(HHV9_pick_(row,['group','conditionGroup','กลุ่ม'])).toUpperCase()
  };
}

function HHV9_gameRows_(rows,zone,gameId) {
  return rows.filter(row=>
    normalizeZone_(HHV9_pick_(row,['zone','domain','ฐาน']))===zone &&
    normalizeGameId_(HHV9_pick_(row,['gameId','game','mission','เกม']))===gameId
  );
}

function HHV9_boolFromRow_(row,aliases) {
  return bool_(HHV9_pick_(row,aliases));
}

function HHV9_buildStudentAuthority_(ss,sid) {
  if(!sid) return {ok:false,error:'missing_studentId',version:HH_AUTHORITY_V9};
  HH_setupSheets();

  const profiles=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.profiles),sid);
  const assessments=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.assessments),sid);
  const games=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.games),sid);
  const summaries=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.gameSummary),sid);
  const reflections=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.reflections),sid);
  const progresses=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.progress),sid);
  const lives=HHV9_rowsForStudent_(ss.getSheetByName(HH_SHEETS.live),sid);

  const preRows=assessments.filter(r=>HHV9_assessmentType_(r)==='pretest');
  const postRows=assessments.filter(r=>HHV9_assessmentType_(r)==='posttest');
  const pre=HHV9_latest_(preRows);
  const post=HHV9_latest_(postRows);
  const live=HHV9_latest_(lives);

  let profile=HHV9_profile_(profiles,sid);
  if(!profile) profile=HHV9_profile_(assessments,sid);
  if(!profile) profile=HHV9_profile_(games,sid);
  if(!profile) profile=HHV9_profile_(lives,sid);

  const group=text_(profile&&profile.group || live&&HHV9_pick_(live,['group','กลุ่ม'])).toUpperCase()||'A';
  if(profile) profile.group=group;

  const completed={
    pretest:preRows.length>0,
    hygiene:false,
    nutrition:false,
    fitness:false,
    posttest:postRows.length>0,
    reflection:reflections.length>0
  };
  const gameCompleted={hygiene:{},nutrition:{},fitness:{}};
  const gameScores={},gameResults={};

  Object.keys(HH_GAME_CATALOG).forEach(zone=>{
    HH_GAME_CATALOG[zone].forEach(gameId=>{
      const rows=HHV9_gameRows_(games,zone,gameId);
      const latest=HHV9_latest_(rows);
      const done=rows.some(r=>HHV9_boolFromRow_(r,['completed','complete','missionComplete','จบเกม']));
      gameCompleted[zone][gameId]=done;
      if(latest){
        const key=zone+':'+gameId;
        const score=number_(HHV9_pick_(latest,['score','คะแนน','totalScore']));
        const accuracy=number_(HHV9_pick_(latest,['accuracy','ความแม่นยำ','correctRate']));
        gameScores[key]=score;
        gameResults[key]={
          zone:zone,gameId:gameId,score:score,accuracy:accuracy,
          passed:HHV9_boolFromRow_(latest,['passed','pass','skillCriteriaMet']),
          completed:done,
          finishedAt:iso_(HHV9_dateValue_(latest)),
          eventId:text_(HHV9_pick_(latest,['eventId','event_id']))
        };
      }
    });
    completed[zone]=HH_GAME_CATALOG[zone].every(id=>gameCompleted[zone][id]===true);
  });

  const evidenceCount=(completed.pretest?1:0)+countGames_(gameCompleted)+(completed.posttest?1:0)+(completed.reflection?1:0);
  const nextStep=authoritativeNextStep_(completed,gameCompleted,group);
  const latestReflection=HHV9_latest_(reflections);
  const scores={};
  const preScore=pre?HHV9_score_(pre):undefined;
  const postScore=post?HHV9_score_(post):undefined;
  if(preScore!==undefined)scores.pretest=preScore;
  if(postScore!==undefined)scores.posttest=postScore;

  const progress={
    progressPct:Math.round(evidenceCount*100/9),
    completedCount:evidenceCount,
    totalSteps:9,
    nextStep:nextStep,
    missionComplete:evidenceCount===9
  };

  const state={
    profile:profile,
    group:group,
    completed:completed,
    scores:scores,
    gameCompleted:gameCompleted,
    gameScores:gameScores,
    gameResults:gameResults,
    reflection:latestReflection?{
      understand:number_(HHV9_pick_(latestReflection,['understand','ความเข้าใจ'])),
      best:text_(HHV9_pick_(latestReflection,['best','สิ่งที่ทำได้ดี'])),
      action:text_(HHV9_pick_(latestReflection,['action','สิ่งที่จะทำต่อ'])),
      submittedAt:iso_(HHV9_dateValue_(latestReflection))
    }:null,
    progress:progress,
    sheetAuthority:true,
    authorityVersion:HH_AUTHORITY_V9
  };

  return {
    ok:true,
    version:HH_AUTHORITY_V9,
    baseVersion:typeof HH_VERSION==='undefined'?'':HH_VERSION,
    authority:'google_sheet',
    studentId:sid,
    found:!!(profile||assessments.length||games.length||reflections.length||progresses.length||lives.length),
    profile:state.profile,
    live:live?normalizeLive_({
      studentId:sid,
      fullName:HHV9_pick_(live,['fullName','studentName','name']),
      section:HHV9_pick_(live,['section','class','room']),
      group:HHV9_pick_(live,['group']),
      currentStep:HHV9_pick_(live,['currentStep','nextStep']),
      status:HHV9_pick_(live,['status']),
      progressPct:HHV9_pick_(live,['progressPct']),
      completedCount:HHV9_pick_(live,['completedCount']),
      missionComplete:HHV9_pick_(live,['missionComplete']),
      online:HHV9_pick_(live,['online']),
      lastSeen:HHV9_pick_(live,['lastSeen']),
      lastEventType:HHV9_pick_(live,['lastEventType']),
      lastEventId:HHV9_pick_(live,['lastEventId'])
    }):null,
    completed:completed,
    scores:scores,
    gameCompleted:gameCompleted,
    gameScores:gameScores,
    gameResults:gameResults,
    reflection:state.reflection,
    progress:progress,
    authoritativeState:state,
    evidence:{
      assessments:assessments.length,
      pretestRows:preRows.length,
      posttestRows:postRows.length,
      games:games.length,
      gameSummaries:summaries.length,
      reflections:reflections.length,
      progressRows:progresses.length,
      liveRows:lives.length
    },
    generatedAt:new Date().toISOString()
  };
}

function HHV9_studentDebug_(ss,sid) {
  if(!sid) return {ok:false,error:'missing_studentId',version:HH_AUTHORITY_V9};
  const sh=ss.getSheetByName(HH_SHEETS.assessments);
  const headers=sh&&sh.getLastColumn()?sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0]:[];
  const all=HHV9_sheetRows_(sh);
  const matched=all.filter(r=>HHV9_studentIdFromRow_(r)===sid);
  const authority=HHV9_buildStudentAuthority_(ss,sid);
  return {
    ok:true,
    version:HH_AUTHORITY_V9,
    studentId:sid,
    assessmentSheet:HH_SHEETS.assessments,
    assessmentHeaders:headers,
    totalAssessmentRows:all.length,
    matchedAssessmentRows:matched.length,
    matched:matched.slice(-10).map(r=>({
      rowNumber:r.__rowNumber,
      studentId:HHV9_studentIdFromRow_(r),
      assessmentRaw:HHV9_pick_(r,['assessment','assessmentType','type','mode','แบบทดสอบ']),
      assessmentNormalized:HHV9_assessmentType_(r),
      score:HHV9_score_(r),
      total:HHV9_total_(r),
      eventId:text_(HHV9_pick_(r,['eventId','event_id'])),
      timestamp:iso_(HHV9_dateValue_(r))
    })),
    decision:{
      pretest:authority.completed&&authority.completed.pretest===true,
      posttest:authority.completed&&authority.completed.posttest===true,
      progress:authority.progress,
      nextStep:authority.progress&&authority.progress.nextStep
    }
  };
}

function HHV9_rebuildStudentLive_(studentId) {
  const sid=cleanStudentId_(studentId);
  if(!sid)return{ok:false,error:'missing_studentId',version:HH_AUTHORITY_V9};
  const ss=getHHSpreadsheet_();
  const api=HHV9_buildStudentAuthority_(ss,sid);
  if(!api.ok)return api;
  const s=api.authoritativeState,p=s.profile||{};
  const sh=ensureSheet_(ss,HH_SHEETS.live,HH_HEADERS[HH_SHEETS.live]);
  const row=findRow_(sh,1,sid);
  const v=[
    sid,p.fullName||'',p.section||'',p.group||s.group||'',
    s.progress.nextStep,
    'Reconciled V9 from Sheet evidence',
    s.progress.progressPct,s.progress.completedCount,s.progress.missionComplete,
    false,new Date(),'reconcile','HH-RECONCILE-V9-'+sid+'-'+Date.now()
  ];
  if(row)sh.getRange(row,1,1,v.length).setValues([v]);else sh.appendRow(v);
  SpreadsheetApp.flush();
  return{
    ok:true,
    version:HH_AUTHORITY_V9,
    studentId:sid,
    completed:s.completed,
    progress:s.progress,
    evidence:api.evidence
  };
}

function HHV9_rebuildAllLive_() {
  const ss=getHHSpreadsheet_(),ids={};
  Object.values(HH_SHEETS).forEach(name=>{
    HHV9_sheetRows_(ss.getSheetByName(name)).forEach(row=>{
      const sid=HHV9_studentIdFromRow_(row);
      if(sid)ids[sid]=true;
    });
  });
  const list=Object.keys(ids).sort();
  return{
    ok:true,
    version:HH_AUTHORITY_V9,
    count:list.length,
    results:list.map(HHV9_rebuildStudentLive_)
  };
}
