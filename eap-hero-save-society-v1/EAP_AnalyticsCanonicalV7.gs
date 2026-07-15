/* =========================================================
   EAP Learning Analytics Dashboard v7 — CANONICAL
   Section 122 · Hero + Word Quest + Boss Speaking Review

   Deploy this file beside the current dashboard helpers, then make the
   dashboard call eapTeacherDashboardDataCanonicalV7(filters).

   Canonical rules
   1) Hero = one record per canonical student + session + skill.
   2) Boss Speaking = latest evidence per canonical student + B1–B5.
   3) Word Quest = Best and Latest per canonical student + session.
   4) Guest / QA / test identities are quarantined and excluded.
   5) Pending/resubmit Boss Speaking places the learner in review status.
========================================================= */

const EAP_ANALYTICS_V7_VERSION = 'v7.0-CANONICAL-OFFICIAL-LEARNERS-122';
const EAP_ANALYTICS_V7_BOSSES = ['B1','B2','B3','B4','B5'];
const EAP_ANALYTICS_V7_ORDER = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];
const EAP_ANALYTICS_V7_CONTRACT = {
  S1:{reading:'Core',speaking:'Support',listening:'Exposure',writing:'Exposure'},
  S2:{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},
  S3:{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},
  S4:{reading:'Core',listening:'Support',writing:'Exposure',speaking:'Exposure'},
  S5:{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},
  S6:{writing:'Core',reading:'Support',listening:'Exposure',speaking:'Exposure'},
  S7:{writing:'Core',speaking:'Support',reading:'Exposure',listening:'Exposure'},
  S8:{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},
  S9:{writing:'Core',speaking:'Support',reading:'Exposure',listening:'Exposure'},
  S10:{writing:'Core',reading:'Support',listening:'Exposure',speaking:'Exposure'},
  S11:{writing:'Core',speaking:'Support',reading:'Exposure',listening:'Exposure'},
  S12:{reading:'Core',writing:'Support',listening:'Exposure',speaking:'Exposure'},
  S13:{listening:'Core',writing:'Support',reading:'Exposure',speaking:'Exposure'},
  S14:{speaking:'Core',writing:'Support',reading:'Exposure',listening:'Exposure'},
  S15:{writing:'Core',speaking:'Support',reading:'Exposure',listening:'Exposure'}
};

function eapTeacherDashboardDataCanonicalV7(filters) {
  filters = filters || {};
  const section = eapA7Text_(filters.section, (typeof EAP_CONFIG !== 'undefined' && EAP_CONFIG.DEFAULT_SECTION) || '122');
  const query = eapA7Text_(filters.query || filters.q, '').toLowerCase();
  const wantedStatus = eapA7Text_(filters.status, '');
  const wantedParticipation = eapA7Text_(filters.participation, '');

  const heroPrepared = eapA7HeroRows_(section);
  const bossPrepared = eapA7BossRows_(section);
  const wordPrepared = eapA7WordRows_(section);
  const learnersAll = eapA7BuildLearners_(heroPrepared.records, bossPrepared.records, wordPrepared.records, section);

  let learners = learnersAll.slice();
  if (query) {
    learners = learners.filter(function(learner) {
      return [learner.studentId, learner.studentName, learner.currentRoute,
        learner.hero.records.map(function(r){ return r.sessionId + ' ' + r.skill; }).join(' ')
      ].join(' ').toLowerCase().indexOf(query) >= 0;
    });
  }
  if (wantedStatus) learners = learners.filter(function(x) { return x.status === wantedStatus; });
  if (wantedParticipation) learners = learners.filter(function(x) { return x.participation === wantedParticipation; });
  learners.sort(function(a,b) {
    return String(a.studentName).localeCompare(String(b.studentName)) || String(a.studentId).localeCompare(String(b.studentId));
  });

  const officialWordBest = [];
  learnersAll.forEach(function(learner) {
    (learner.wordQuest.bestRecords || []).forEach(function(record) {
      if (record.accuracy !== null) officialWordBest.push(record.accuracy);
    });
  });
  const officialWordPlayers = learnersAll.filter(function(x){ return x.wordQuest.records.length > 0; }).length;
  const heroCanonical = learnersAll.reduce(function(all,x){ return all.concat(x.hero.records); }, []);
  const bossCanonical = learnersAll.reduce(function(all,x){ return all.concat(x.bossSpeaking.records); }, []);
  const masteryRecords = heroCanonical.filter(function(r){ return r.scope === 'mastery'; });
  const exposureRecords = heroCanonical.filter(function(r){ return r.scope === 'exposure'; });

  return {
    ok:true,
    version:EAP_ANALYTICS_V7_VERSION,
    section:section,
    generatedAt:eapA7Now_(),
    overview:{
      learners:learnersAll.length,
      heroOnly:learnersAll.filter(function(x){ return x.participation === 'heroOnly'; }).length,
      wordQuestOnly:learnersAll.filter(function(x){ return x.participation === 'wordOnly'; }).length,
      both:learnersAll.filter(function(x){ return x.participation === 'both'; }).length,
      heroPlayers:learnersAll.filter(function(x){ return x.hero.records.length > 0; }).length,
      wordQuestPlayers:officialWordPlayers,
      masteryRecords:masteryRecords.length,
      exposureTouchpoints:exposureRecords.length,
      bossSpeakingEvidence:bossCanonical.length,
      bossPending:bossCanonical.filter(function(r){ return r.reviewState === 'pending'; }).length,
      bossReviewed:bossCanonical.filter(function(r){ return r.reviewState === 'reviewed'; }).length,
      bossResubmit:bossCanonical.filter(function(r){ return r.reviewState === 'resubmit'; }).length,
      heroAverage:eapA7AverageOrNull_(masteryRecords.map(function(r){ return r.bestScore; })),
      wordQuestAccuracyAverage:officialWordPlayers ? eapA7AverageOrNull_(officialWordBest) : null,
      needsSupport:learnersAll.filter(function(x){ return x.status === 'review'; }).length
    },
    dataQuality:{
      rawSummaryCount:heroPrepared.rawCount,
      canonicalHeroCount:heroPrepared.records.length,
      heroDuplicatesCollapsed:heroPrepared.duplicatesCollapsed,
      rawWordAttemptCount:wordPrepared.rawCount,
      canonicalWordSessionCount:wordPrepared.canonicalSessionCount,
      rawBossEvidenceCount:bossPrepared.rawCount,
      canonicalBossEvidenceCount:bossPrepared.records.length,
      bossDuplicatesCollapsed:bossPrepared.duplicatesCollapsed,
      quarantinedCount:heroPrepared.quarantined.length + wordPrepared.quarantined.length + bossPrepared.quarantined.length,
      quarantined:heroPrepared.quarantined.concat(wordPrepared.quarantined, bossPrepared.quarantined)
    },
    learners:learners
  };
}

function eapA7HeroRows_(section) {
  const rawRows = sh_('summary').getDataRange().getValues().slice(1)
    .map(function(row){ return rowObject_(H.summary, row); })
    .filter(function(row){ return eapA7Text_(row.section) === section; });
  const grouped = {}, quarantined = [];
  let validCount = 0;
  rawRows.forEach(function(row) {
    const identity = eapA7Identity_('hero', row.studentId, row.studentName, section);
    if (!identity.official) { quarantined.push(eapA7Quarantine_('hero',identity,row.sessionId,row.skill,identity.reason)); return; }
    const sessionId=eapA7Session_(row.sessionId), skill=eapA7Skill_(row.skill), role=eapA7Role_(sessionId,skill);
    if (!sessionId || !skill || !role) { quarantined.push(eapA7Quarantine_('hero',identity,sessionId,skill,'invalid_session_skill_contract')); return; }
    validCount++;
    const record={
      source:'hero',studentId:identity.studentId,studentName:identity.studentName,section:section,
      sessionId:sessionId,sessionTitle:eapA7Text_(row.sessionTitle),skill:skill,role:role,
      scope:role==='Exposure'?'exposure':'mastery',bestScore:eapA7Number_(row.bestScore,0),
      bestAccuracy:eapA7NullableNumber_(row.bestAccuracy),passed:eapA7Bool_(row.passed),
      attempts:eapA7Number_(row.attempts,0),reviewFlag:eapA7Text_(row.reviewFlag),
      updatedAt:eapA7Text_(row.updatedAt),legacyCompletion:eapA7Bool_(row.legacyCompletion)
    };
    const key=[record.studentId,record.sessionId,record.skill].join('|'), old=grouped[key];
    if (!old) { grouped[key]=record; return; }
    const better=record.bestScore>old.bestScore || (record.bestScore===old.bestScore && eapA7Time_(record.updatedAt)>=eapA7Time_(old.updatedAt));
    const chosen=better?record:old, other=better?old:record;
    chosen.passed=chosen.passed||other.passed;
    chosen.attempts=Math.max(chosen.attempts,other.attempts);
    chosen.bestAccuracy=eapA7MaxNullable_(chosen.bestAccuracy,other.bestAccuracy);
    chosen.reviewFlag=chosen.reviewFlag||other.reviewFlag;
    if(!chosen.sessionTitle) chosen.sessionTitle=other.sessionTitle;
    grouped[key]=chosen;
  });
  return {rawCount:rawRows.length,records:Object.keys(grouped).map(function(k){return grouped[k];}),duplicatesCollapsed:Math.max(0,validCount-Object.keys(grouped).length),quarantined:quarantined};
}

function eapA7BossRows_(section) {
  let raw=[];
  try { if(typeof eapEvidenceRows_==='function') raw=eapEvidenceRows_({section:section})||[]; } catch(error){ raw=[]; }
  const grouped={}, quarantined=[];
  let validCount=0;
  raw.forEach(function(row){
    const identity=eapA7Identity_('boss',row.studentId,row.studentName,section);
    if(!identity.official){quarantined.push(eapA7Quarantine_('boss',identity,row.sessionId,'Speaking',identity.reason));return;}
    const sessionId=eapA7Session_(row.sessionId);
    if(EAP_ANALYTICS_V7_BOSSES.indexOf(sessionId)<0){quarantined.push(eapA7Quarantine_('boss',identity,sessionId,'Speaking','not_b1_b5_speaking'));return;}
    validCount++;
    const status=eapA7ReviewStatus_(row.reviewStatus||row.teacherReviewStatus);
    const record=Object.assign({},row,{source:'boss',studentId:identity.studentId,studentName:identity.studentName,section:section,sessionId:sessionId,skill:'Speaking',reviewStatus:status.raw,reviewState:status.state,eventAt:eapA7Text_(row.teacherReviewedAt||row.createdAt||row.updatedAt)});
    const key=[record.studentId,record.sessionId].join('|'), old=grouped[key];
    if(!old||eapA7Time_(record.eventAt)>=eapA7Time_(old.eventAt)) grouped[key]=record;
  });
  return {rawCount:raw.length,records:Object.keys(grouped).map(function(k){return grouped[k];}),duplicatesCollapsed:Math.max(0,validCount-Object.keys(grouped).length),quarantined:quarantined};
}

function eapA7WordRows_(section) {
  let raw=[];
  try { if(typeof eapwqReadAttempts_==='function') raw=eapwqReadAttempts_(section)||[]; } catch(error){ raw=[]; }
  const bySession={}, quarantined=[], records=[];
  raw.forEach(function(row,index){
    const identity=eapA7Identity_('wordquest',row.studentId,row.studentName,section);
    if(!identity.official){quarantined.push(eapA7Quarantine_('wordquest',identity,row.sessionId,'',identity.reason));return;}
    const sessionId=eapA7Text_(row.sessionId).toUpperCase();
    if(!sessionId){quarantined.push(eapA7Quarantine_('wordquest',identity,'','','missing_session'));return;}
    const record={source:'wordquest',recordKey:eapA7Text_(row.fingerprint||row.attemptId||('word-'+index)),studentId:identity.studentId,studentName:identity.studentName,section:section,sessionId:sessionId,sessionTitle:eapA7Text_(row.sessionTitle),accuracy:eapA7NullableNumber_(row.accuracy),score:eapA7Number_(row.score,0),xp:eapA7Number_(row.xp,0),passed:eapA7Bool_(row.passed),weakWords:Array.isArray(row.weakWords)?row.weakWords:[],playedAt:eapA7Text_(row.playedAt||row.submittedAt||row.updatedAt),isBestAttempt:false,isLatestAttempt:false,sessionAttemptCount:1};
    records.push(record);
    const key=[record.studentId,record.sessionId].join('|');
    if(!bySession[key])bySession[key]=[];
    bySession[key].push(record);
  });
  Object.keys(bySession).forEach(function(key){
    const attempts=bySession[key];
    attempts.forEach(function(r){r.sessionAttemptCount=attempts.length;});
    const latest=attempts.slice().sort(function(a,b){return eapA7Time_(b.playedAt)-eapA7Time_(a.playedAt);})[0];
    const best=attempts.slice().sort(function(a,b){const aa=a.accuracy===null?-1:a.accuracy,ba=b.accuracy===null?-1:b.accuracy;return ba-aa||b.score-a.score||eapA7Time_(b.playedAt)-eapA7Time_(a.playedAt);})[0];
    if(latest)latest.isLatestAttempt=true;
    if(best)best.isBestAttempt=true;
  });
  records.sort(function(a,b){return eapA7Time_(b.playedAt)-eapA7Time_(a.playedAt);});
  return {rawCount:raw.length,records:records,canonicalSessionCount:Object.keys(bySession).length,quarantined:quarantined};
}

function eapA7BuildLearners_(heroRecords,bossRecords,wordRecords,section) {
  const map={};
  function ensure(id,name){
    if(!map[id])map[id]={studentId:id,studentName:name||'Unknown',section:section,hero:{records:[],masteryRecords:[],exposureRecords:[],avgScore:null,recordedThrough:'—'},bossSpeaking:{records:[],pending:0,reviewed:0,resubmit:0,status:'none'},wordQuest:{records:[],bestRecords:[],latestRecords:[],avgAccuracy:null,avgLatestAccuracy:null,weakWords:[]},participation:'heroOnly',currentRoute:'S1',status:'active',statusLabel:'Active'};
    if((!map[id].studentName||map[id].studentName==='Unknown')&&name)map[id].studentName=name;
    return map[id];
  }
  heroRecords.forEach(function(r){ensure(r.studentId,r.studentName).hero.records.push(r);});
  bossRecords.forEach(function(r){ensure(r.studentId,r.studentName).bossSpeaking.records.push(r);});
  wordRecords.forEach(function(r){ensure(r.studentId,r.studentName).wordQuest.records.push(r);});
  return Object.keys(map).map(function(id){
    const learner=map[id];
    learner.hero.records.sort(eapA7RecordSort_);
    learner.hero.masteryRecords=learner.hero.records.filter(function(r){return r.scope==='mastery';});
    learner.hero.exposureRecords=learner.hero.records.filter(function(r){return r.scope==='exposure';});
    learner.hero.avgScore=eapA7AverageOrNull_(learner.hero.masteryRecords.map(function(r){return r.bestScore;}));
    learner.hero.recordedThrough=eapA7LatestRoute_(learner.hero.records.map(function(r){return r.sessionId;}));
    learner.bossSpeaking.records.sort(function(a,b){return EAP_ANALYTICS_V7_ORDER.indexOf(a.sessionId)-EAP_ANALYTICS_V7_ORDER.indexOf(b.sessionId);});
    learner.bossSpeaking.pending=learner.bossSpeaking.records.filter(function(r){return r.reviewState==='pending';}).length;
    learner.bossSpeaking.reviewed=learner.bossSpeaking.records.filter(function(r){return r.reviewState==='reviewed';}).length;
    learner.bossSpeaking.resubmit=learner.bossSpeaking.records.filter(function(r){return r.reviewState==='resubmit';}).length;
    learner.bossSpeaking.status=learner.bossSpeaking.resubmit?'resubmit':learner.bossSpeaking.pending?'pending':learner.bossSpeaking.reviewed?'reviewed':'none';
    learner.wordQuest.bestRecords=learner.wordQuest.records.filter(function(r){return r.isBestAttempt;});
    learner.wordQuest.latestRecords=learner.wordQuest.records.filter(function(r){return r.isLatestAttempt;});
    learner.wordQuest.avgAccuracy=eapA7AverageOrNull_(learner.wordQuest.bestRecords.map(function(r){return r.accuracy;}).filter(function(v){return v!==null;}));
    learner.wordQuest.avgLatestAccuracy=eapA7AverageOrNull_(learner.wordQuest.latestRecords.map(function(r){return r.accuracy;}).filter(function(v){return v!==null;}));
    learner.wordQuest.weakWords=eapA7TopWords_(learner.wordQuest.latestRecords.reduce(function(out,r){return out.concat(r.weakWords||[]);},[]),5);
    const hasHero=learner.hero.records.length>0,hasWord=learner.wordQuest.records.length>0;
    learner.participation=hasHero&&hasWord?'both':hasWord?'wordOnly':'heroOnly';
    learner.currentRoute=eapA7CurrentRoute_(learner.hero.records,learner.bossSpeaking.records);
    const heroSupport=learner.hero.records.some(function(r){return /needs_support|review/i.test(r.reviewFlag);});
    const wordSupport=learner.wordQuest.latestRecords.some(function(r){if(r.accuracy===null||r.accuracy>=60||r.sessionAttemptCount<2)return false;const best=learner.wordQuest.bestRecords.filter(function(x){return x.sessionId===r.sessionId;})[0];return !!best&&best.accuracy!==null&&best.accuracy<60;});
    const bossSupport=learner.bossSpeaking.pending>0||learner.bossSpeaking.resubmit>0;
    learner.status=heroSupport||wordSupport||bossSupport?'review':'active';
    learner.statusLabel=learner.bossSpeaking.resubmit?'ให้ฝึกซ้ำ Boss Speaking':learner.bossSpeaking.pending?'รอตรวจ Boss Speaking':learner.status==='review'?'Needs support':'Active';
    return learner;
  });
}

function eapA7Identity_(source,studentId,studentName,section) {
  let id=eapA7Text_(studentId),name=eapA7Text_(studentName,'Unknown');
  try { if(typeof eapCanonicalIdentity_==='function'){const mapped=eapCanonicalIdentity_(source,id,name,section)||{};id=eapA7Text_(mapped.studentId,id);name=eapA7Text_(mapped.studentName,name);} } catch(error){}
  const material=[id,name].join(' ').toLowerCase(),sectionText=eapA7Text_(section).toLowerCase();
  let reason='';
  if(!id)reason='missing_student_id';
  else if(/qa|test/.test(sectionText))reason='qa_or_test_section';
  else if(/^(guest|anonymous|unknown|null|none|demo|sample|test|qa)([-_\s].*)?$/i.test(id))reason='non_official_student_id';
  else if(/\b(guest|anonymous|demo student|test student|qa student)\b/i.test(material))reason='non_official_student_name';
  return {studentId:id,studentName:name,official:!reason,reason:reason};
}
function eapA7Role_(sessionId,skill){if(EAP_ANALYTICS_V7_BOSSES.indexOf(sessionId)>=0)return ['reading','listening','writing','speaking'].indexOf(skill)>=0?'Integrated':'';const c=EAP_ANALYTICS_V7_CONTRACT[sessionId]||{};return c[skill]||'';}
function eapA7Session_(value){const raw=eapA7Text_(value).toUpperCase();let m=raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);if(m)return'S'+Number(m[1]);m=raw.match(/^B(?:OSS)?\s*0?([1-5])$/i);if(m)return'B'+Number(m[1]);if(/^\d+$/.test(raw))return'S'+Number(raw);return raw;}
function eapA7Skill_(value){return eapA7Text_(value).toLowerCase();}
function eapA7ReviewStatus_(value){const raw=eapA7Text_(value,'pending_teacher_review').toLowerCase();if(/resubmit|revise|revision|rework|needs[_ -]?work/.test(raw))return{raw:raw,state:'resubmit'};if(/reviewed|approved|accepted|complete|completed/.test(raw))return{raw:raw,state:'reviewed'};return{raw:raw||'pending_teacher_review',state:'pending'};}
function eapA7CurrentRoute_(heroRecords,bossRecords){const byKey={},bossBySession={};(heroRecords||[]).forEach(function(r){byKey[r.sessionId+'|'+r.skill]=r;});(bossRecords||[]).forEach(function(r){bossBySession[r.sessionId]=r;});for(let i=0;i<EAP_ANALYTICS_V7_ORDER.length;i++){const route=EAP_ANALYTICS_V7_ORDER[i];if(EAP_ANALYTICS_V7_BOSSES.indexOf(route)>=0){const complete=['reading','listening','writing','speaking'].every(function(skill){const r=byKey[route+'|'+skill];if(!r||!(r.passed||r.bestScore>=60))return false;if(skill==='speaking'){const ev=bossBySession[route];return !!ev&&ev.reviewState==='reviewed';}return true;});if(!complete)return route;}else{const contract=EAP_ANALYTICS_V7_CONTRACT[route]||{},required=Object.keys(contract).filter(function(skill){return contract[skill]!=='Exposure';});const complete=required.length&&required.every(function(skill){const r=byKey[route+'|'+skill];return !!r&&(r.passed||r.bestScore>=60);});if(!complete)return route;}}return'B5';}
function eapA7RecordSort_(a,b){return EAP_ANALYTICS_V7_ORDER.indexOf(a.sessionId)-EAP_ANALYTICS_V7_ORDER.indexOf(b.sessionId)||String(a.skill).localeCompare(String(b.skill));}
function eapA7LatestRoute_(routes){const valid=(routes||[]).filter(function(r){return EAP_ANALYTICS_V7_ORDER.indexOf(r)>=0;});valid.sort(function(a,b){return EAP_ANALYTICS_V7_ORDER.indexOf(a)-EAP_ANALYTICS_V7_ORDER.indexOf(b);});return valid.length?valid[valid.length-1]:'—';}
function eapA7Quarantine_(source,identity,sessionId,skill,reason){return{source:source,studentId:identity.studentId,studentName:identity.studentName,sessionId:eapA7Text_(sessionId),skill:eapA7Text_(skill),reason:reason};}
function eapA7Text_(value,fallback){const s=String(value===undefined||value===null?'':value).trim();return s||(fallback===undefined?'':String(fallback));}
function eapA7Number_(value,fallback){const n=Number(value);return isFinite(n)?n:(fallback||0);}
function eapA7NullableNumber_(value){if(value===''||value===null||value===undefined)return null;const n=Number(value);return isFinite(n)?n:null;}
function eapA7MaxNullable_(a,b){if(a===null)return b;if(b===null)return a;return Math.max(a,b);}
function eapA7Bool_(value){return value===true||String(value).toLowerCase()==='true'||String(value)==='1';}
function eapA7Time_(value){const t=new Date(String(value||'')).getTime();return isFinite(t)?t:0;}
function eapA7Now_(){try{return now_().iso;}catch(e){return new Date().toISOString();}}
function eapA7AverageOrNull_(values){if(!values||!values.length)return null;const nums=values.map(Number).filter(isFinite);if(!nums.length)return null;return Math.round(nums.reduce(function(a,b){return a+b;},0)/nums.length*100)/100;}
function eapA7TopWords_(words,limit){const c={};(words||[]).forEach(function(w){const k=eapA7Text_(w).toLowerCase();if(k)c[k]=(c[k]||0)+1;});return Object.keys(c).sort(function(a,b){return c[b]-c[a]||a.localeCompare(b);}).slice(0,Math.max(1,limit||5));}
