/* =========================================================
   EAP Hero Teacher Review Contract v20260708
   Safe V2:
   - Completes teacher-check metadata for every S1-S15 and B1-B5 route.
   - Does NOT mutate the frozen content pack object.
   - Normal sessions: Core + Support are mastery evidence; Exposure is participation evidence.
   - Boss Gates: all four skills are integrated; Boss Speaking requires teacher review.
   - Does not change student score/pass logic; used by Sheet bridge and teacher dashboard metadata.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-TEACHER-REVIEW-CONTRACT-S15-B5-V2-SAFE';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const SKILLS = ['reading','listening','writing','speaking'];
  let CONTRACT_CACHE = null;

  const FEEDBACK_CODES = [
    { code:'CL', label:'Clarity', th:'ชัดเจน เข้าใจง่าย' },
    { code:'PR', label:'Pronunciation', th:'ออกเสียง/คำสำคัญ' },
    { code:'FL', label:'Fluency', th:'ความต่อเนื่อง' },
    { code:'ST', label:'Structure', th:'โครงสร้างคำตอบ' },
    { code:'EV', label:'Evidence', th:'ใช้หลักฐานจาก source' },
    { code:'QA', label:'Question Alignment', th:'ตรงคำถาม/ภารกิจ' }
  ];

  const SKILL_EVIDENCE = {
    reading: {
      evidenceType:'auto_quiz_with_reason',
      teacherCheck:'ตรวจ main idea / evidence / เหตุผลจาก source หากคะแนนต่ำหรือเด็กขอทบทวน',
      requiredFields:['attemptId','studentId','routeId','skill','score','accuracy','scenarioId','answer','reasonCheck'],
      rubric:['main idea correct','evidence matches source','no unsupported claim','reason is clear']
    },
    listening: {
      evidenceType:'auto_quiz_with_listening_focus',
      teacherCheck:'ตรวจ key point / example / signpost จาก listening log หากคะแนนต่ำ',
      requiredFields:['attemptId','studentId','routeId','skill','score','accuracy','scenarioId','listeningFocus'],
      rubric:['key point correct','example identified','no invented detail','signpost noticed']
    },
    writing: {
      evidenceType:'short_written_response',
      teacherCheck:'ครูตรวจได้จาก output + source + checklist โดยเน้น point/evidence/limitation',
      requiredFields:['evidenceId','studentId','routeId','skill','prompt','output','score','scenarioId','teacherComment'],
      rubric:['clear point','source detail','student own words','limitation/next action','academic tone']
    },
    speaking: {
      evidenceType:'speaking_note_or_boss_review',
      teacherCheck:'Normal speaking เก็บ note เป็น evidence; Boss speaking ต้องรอ teacher review',
      requiredFields:['evidenceId','studentId','routeId','skill','output','durationSec','targetRange','teacherReviewStatus','feedbackCodes'],
      rubric:['opening','one detail/evidence','closing','duration target','frame/cue used']
    }
  };

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function key(value){ return clean(value).toUpperCase(); }
  function pack(){ const data = window[PACK_NAME]; return data && Array.isArray(data.routes) ? data : null; }
  function isBoss(route){ return route && route.routeType === 'boss_gate'; }
  function roleOf(route, skill){ return clean(route && route.skillContract && route.skillContract[skill] || 'Exposure'); }
  function scopeOf(role){ return role === 'Exposure' ? 'exposure' : 'mastery'; }
  function routeNumber(route){ const m = clean(route && route.routeId).match(/^S(\d+)$/i); return m ? Number(m[1]) : ''; }
  function teacherRequired(route, skill){ return !!(route && isBoss(route) && skill === 'speaking'); }
  function reviewStatusDefault(route, skill){
    if (teacherRequired(route, skill)) return 'pending_teacher_review';
    if (skill === 'writing') return 'teacher_can_review_optional';
    return 'auto_evidence_review_optional';
  }
  function masteryEligible(route, skill){
    const role = roleOf(route, skill);
    return isBoss(route) || role === 'Core' || role === 'Support' || role === 'Integrated';
  }

  function teacherTask(route, skill){
    const base = SKILL_EVIDENCE[skill] || SKILL_EVIDENCE.reading;
    const role = roleOf(route, skill);
    const boss = isBoss(route);
    return {
      routeId: clean(route.routeId),
      routeType: clean(route.routeType),
      weekNo: routeNumber(route),
      routeTitle: clean(route.title),
      cefrBand: clean(route.cefrBand),
      skill: skill,
      skillRole: role,
      scope: scopeOf(role),
      masteryEligible: masteryEligible(route, skill),
      teacherReviewRequired: teacherRequired(route, skill),
      teacherReviewStatusDefault: reviewStatusDefault(route, skill),
      evidenceType: base.evidenceType,
      teacherCheck: base.teacherCheck,
      requiredFields: base.requiredFields,
      rubric: base.rubric,
      feedbackCodes: boss || skill === 'speaking' ? FEEDBACK_CODES : [],
      passEvidenceRule: boss
        ? 'Boss Gate evidence must include integrated response; speaking requires teacher review.'
        : (role === 'Exposure'
          ? 'Exposure is recorded but does not block progress.'
          : 'Core/Support evidence counts toward mastery when score and completion criteria are met.'),
      sheetTabs: ['attempts','summary','evidence','eap-v132-events','eap-v132-quality-audit']
    };
  }

  function routeContract(route){
    const tasks = SKILLS.map(skill => teacherTask(route, skill));
    return {
      version: VERSION,
      routeId: clean(route.routeId),
      routeType: clean(route.routeType),
      weekNo: routeNumber(route),
      routeTitle: clean(route.title),
      cefrBand: clean(route.cefrBand),
      focus: clean(route.focus),
      completeContent: true,
      fourSkillsIncluded: tasks.every(task => !!task.skill),
      masterySkills: tasks.filter(task => task.masteryEligible).map(task => task.skill),
      exposureSkills: tasks.filter(task => !task.masteryEligible).map(task => task.skill),
      teacherReviewRequiredSkills: tasks.filter(task => task.teacherReviewRequired).map(task => task.skill),
      teacherCanReviewSkills: tasks.map(task => task.skill),
      feedbackCodes: isBoss(route) ? FEEDBACK_CODES : [],
      teacherChecklist: tasks,
      evidenceReadiness: {
        hasPrompt:true,
        hasOutput:true,
        hasScore:true,
        hasScenarioMeta:true,
        hasReplayMeta:true,
        hasChoiceGuardMeta:true,
        bossSpeakingTeacherReview: isBoss(route)
      }
    };
  }

  function build(){
    const data = pack();
    const contracts = {};
    if (!data) return contracts;
    data.routes.forEach(route => {
      const contract = routeContract(route);
      contracts[contract.routeId] = contract;
    });
    CONTRACT_CACHE = contracts;
    return contracts;
  }

  function all(){
    return CONTRACT_CACHE || build();
  }

  function route(routeId){
    const contracts = all();
    return contracts[key(routeId)] || null;
  }

  function task(routeId, skill){
    const contract = route(routeId);
    const skillKey = clean(skill).toLowerCase();
    return contract && contract.teacherChecklist.find(item => item.skill === skillKey) || null;
  }

  function apply(){
    build();
    return { ok:true, version:VERSION, routes:Object.keys(CONTRACT_CACHE || {}).length, frozenPackSafe:true };
  }

  window.EAPTeacherReviewContract = {
    version: VERSION,
    feedbackCodes: FEEDBACK_CODES,
    skillEvidence: SKILL_EVIDENCE,
    apply,
    route,
    task,
    all
  };

  apply();
})();