// === /sgnal-hunt/js/uxq-csai2601-canonical-content-v1.js ===
// CSAI2601 UX Quest Canonical Content Pack
// Scope: W1-W15 + B1-B4. No B5.
// This file is intentionally data-first so weekly game pages, Mission Control and Teacher Dashboard
// can reuse the same curriculum map without hard-coding inconsistent labels.

(function () {
  'use strict';

  const COURSE_ID = 'CSAI2601';
  const VERSION = 'v20260708-canonical-w15-b4';

  const DASHBOARD_FIELDS = [
    'studentId','studentName','section','courseId','nodeId','caseId','missionId',
    'score','stars','accuracy','correct','wrong','timeUsed','retryCount','hintUsed',
    'selectedAnswer','selectedReason','reasonCheckPassed','artifactSubmitted',
    'reflection','learnedPoint','misconception','bossGatePassed','timestamp'
  ];

  const ANTI_GUESSING_RULES = [
    'Shuffle answer order every attempt.',
    'Rotate case variants and keep a recent-case no-repeat window.',
    'Do not make the longest option consistently correct.',
    'Use plausible distractors tagged by misconception.',
    'Require Reason Check for high mastery.',
    'Do not award 3 stars from speed alone.',
    'Record retry improvement and reasoning changes.',
    'Boss Gates must combine multiple prior concepts.'
  ];

  const RUBRIC = {
    excellent: 'วิเคราะห์จากหลักฐาน เชื่อมโยง UX/UI ถูกต้อง อธิบายเหตุผลชัด ผลงานเชื่อม user → problem → flow → interface → prototype → evaluation ได้ครบ',
    good: 'เข้าใจหลักการส่วนใหญ่ วิเคราะห์ได้ค่อนข้างถูก แต่บางจุดยังขาดหลักฐานหรือเหตุผลประกอบ',
    developing: 'เข้าใจบางส่วน แต่ยังสับสนระหว่าง UI/UX หรือออกแบบจากความเห็นส่วนตัวมากกว่าหลักฐาน',
    beginning: 'ตอบหรือออกแบบโดยไม่มีเหตุผลชัด ไม่เชื่อมโยงกับผู้ใช้ ปัญหา หรือหลักฐาน'
  };

  const nodes = [
    {
      id: 'W1', type: 'week', order: 1, unlockAfter: null,
      title: 'UX First Contact', missionTitle: 'UX First Responder',
      focus: 'เข้าใจ UI, UX และ Front-end Design',
      concepts: ['UI vs UX','Front-end Design','User goal','Task','Context','Friction','Impact','Fix','Test idea'],
      learningOutcomes: [
        'แยก UI, UX และ Front-end Design ได้',
        'วิเคราะห์ user/task/context/friction ได้',
        'อธิบายปัญหาจากหลักฐาน ไม่ใช่ความรู้สึกส่วนตัว'
      ],
      casePrompt: 'ระบบลงทะเบียนเรียนดูสวยแต่ผู้ใช้หาปุ่มยืนยันไม่พบ ต้องวิเคราะห์ว่าเป็นปัญหา UI, UX หรือ front-end feedback',
      missionRounds: ['Identify friction','Match user goal','Judge UI/UX/front-end impact','Choose fix','Plan test'],
      reasonChecks: [
        'หลักฐานใดทำให้คิดว่านี่คือปัญหา UX ไม่ใช่แค่ UI',
        'ถ้าแก้สีหรือปุ่มอย่างเดียว ปัญหาจะหายจริงหรือไม่ เพราะอะไร',
        'ผู้ใช้จะล้มเหลวที่ขั้นตอนไหน'
      ],
      artifact: 'UX First Impression Audit',
      artifactChecklist: ['Screenshot/description','User goal','Friction','Impact','Suggested fix','Test idea'],
      dashboardEvidence: ['selectedFriction','selectedFix','reasonCheck','retryCount','learnedPoint'],
      seedCases: [
        { id:'W1-C01', context:'ระบบลงทะเบียนเรียน', friction:'ปุ่มยืนยันไม่เด่น', misconception:'คิดว่าแค่เปลี่ยนสีคือแก้ UX ครบ' },
        { id:'W1-C02', context:'เว็บห้องสมุด', friction:'ค้นหาหนังสือแล้วไม่รู้สถานะว่าง/ถูกยืม', misconception:'เพิ่มข้อความยาวโดยไม่แก้ feedback' },
        { id:'W1-C03', context:'ระบบคำร้องออนไลน์', friction:'ผู้ใช้ไม่รู้ว่าต้องแนบไฟล์ใดก่อนส่ง', misconception:'โทษผู้ใช้ว่าอ่านไม่ละเอียด' },
        { id:'W1-C04', context:'แอปกิจกรรมนักศึกษา', friction:'เมนูสำคัญซ่อนอยู่ลึก', misconception:'เพิ่มไอคอนโดยไม่จัดลำดับงานผู้ใช้' }
      ]
    },
    {
      id: 'W2', type: 'week', order: 2, unlockAfter: 'W1',
      title: 'Human-Centered Design', missionTitle: 'Evidence Before Design',
      focus: 'ออกแบบจากผู้ใช้ ไม่ใช่จากความชอบส่วนตัว',
      concepts: ['Human-Centered Design','Design Thinking','Empathize','Define','Ideate','Prototype','Test','Evidence vs assumption'],
      learningOutcomes: [
        'อธิบายกระบวนการ HCD / Design Thinking ได้',
        'แยก evidence กับ assumption ได้',
        'เลือกวิธีเริ่มออกแบบจากข้อมูลผู้ใช้ได้เหมาะสม'
      ],
      casePrompt: 'ทีมต้องปรับระบบจองคิวห้องพยาบาลมหาวิทยาลัย โดยมีผู้ใช้หลายกลุ่มและข้อจำกัดเวลา',
      missionRounds: ['Classify evidence','Order HCD process','Detect assumption trap','Choose research target','Plan small test'],
      reasonChecks: [
        'ทำไมจึงไม่ควรเริ่มจากการวาดหน้าจอทันที',
        'ข้อมูลใดเป็น evidence และข้อมูลใดเป็น assumption',
        'ถ้าเวลาเก็บข้อมูลจำกัด ควรเก็บจากใครก่อน เพราะอะไร'
      ],
      artifact: 'UX Process Map / HCD Sprint Brief',
      artifactChecklist: ['Initial problem','User groups','Data collection method','Insight to find','Design decision path'],
      dashboardEvidence: ['processOrder','evidenceVsAssumptionAccuracy','userGroupChoice','reasonCheck','reflection'],
      seedCases: [
        { id:'W2-C01', context:'จองคิวห้องพยาบาล', user:'นักศึกษาใหม่', risk:'รีบทำ prototype ก่อนรู้สาเหตุ' },
        { id:'W2-C02', context:'ระบบยืมห้องเรียน', user:'เจ้าหน้าที่ตารางสอน', risk:'ฟังเฉพาะผู้บริหาร ไม่ฟังผู้ใช้จริง' },
        { id:'W2-C03', context:'เว็บทุนการศึกษา', user:'นักศึกษาทุน', risk:'ใช้ assumption ว่าเด็กอ่านประกาศครบ' },
        { id:'W2-C04', context:'ระบบแจ้งซ่อม', user:'แม่บ้าน/ช่าง/ผู้แจ้ง', risk:'ออกแบบจาก flow ของคนทำระบบ ไม่ใช่ผู้แจ้งปัญหา' }
      ]
    },
    {
      id: 'W3', type: 'week', order: 3, unlockAfter: 'W2',
      title: 'Psychology for Interface Design', missionTitle: 'Mind Load Rescue',
      focus: 'จิตวิทยาผู้ใช้กับการออกแบบหน้าจอ',
      concepts: ['Cognitive load','Recognition vs recall','Attention','Affordance','Feedback','Mental model','Error prevention','Decision fatigue'],
      learningOutcomes: [
        'อธิบายผลของ cognitive load ต่อการใช้หน้าจอได้',
        'เลือก feedback/error prevention ที่ลดภาระผู้ใช้ได้',
        'วิเคราะห์ปัญหาจาก mental model และ attention ได้'
      ],
      casePrompt: 'ผู้ใช้กรอกฟอร์มสมัครสมาชิกแล้วระบบแจ้ง error หลังจากกดส่ง โดยไม่บอกว่าช่องใดผิด',
      missionRounds: ['Diagnose load','Find missing feedback','Choose prevention','Reduce recall','Validate repair'],
      reasonChecks: [
        'ปัญหานี้เกี่ยวกับ memory, attention หรือ feedback อย่างไร',
        'การเพิ่มคำอธิบายมาก ๆ อาจทำให้ UX แย่ลงอย่างไร',
        'วิธีใดช่วยให้ผู้ใช้จำได้น้อยลงแต่ทำได้มากขึ้น'
      ],
      artifact: 'Cognitive Load Repair Note',
      artifactChecklist: ['Confusing point','Type of cognitive load','Psychology concept','Repair decision','Why it helps'],
      dashboardEvidence: ['psychologyConcept','selectedRepair','reasonCheck','wrongConcepts','retryImprovement'],
      seedCases: [
        { id:'W3-C01', context:'ฟอร์มสมัครสมาชิก', issue:'error รวมหลัง submit', concept:'feedback/error prevention' },
        { id:'W3-C02', context:'เมนูตั้งค่าระบบ', issue:'ชื่อเมนูไม่ตรง mental model', concept:'mental model' },
        { id:'W3-C03', context:'หน้าชำระเงิน', issue:'มีตัวเลือกมากเกินไป', concept:'decision fatigue' },
        { id:'W3-C04', context:'ระบบค้นหาวิชา', issue:'ต้องจำรหัสวิชาเอง', concept:'recognition over recall' }
      ]
    },
    {
      id: 'B1', type: 'boss', order: 4, unlockAfter: 'W3', covers: ['W1','W2','W3'],
      title: 'Foundation Boss', missionTitle: 'Cognitive Storm',
      focus: 'UI/UX + HCD + Psychology Defense',
      bossScenario: 'ระบบบริการนักศึกษามี 3 ปัญหา: หาเมนูไม่เจอ, error ไม่ชัด, ข้อมูลมากจนตัดสินใจไม่ได้ ผู้เรียนต้องวิเคราะห์จาก UI/UX, HCD และ psychology',
      missionRounds: ['Identify problem','Match evidence','Choose fix','Reason defense','Retry improvement'],
      passCriteria: { minAccuracy: 70, minReasonPass: 3, reflectionRequired: true },
      reasonChecks: [
        'ปัญหานี้มีหลักฐานจากพฤติกรรมผู้ใช้อะไร',
        'ควรเก็บข้อมูลเพิ่มก่อนออกแบบอะไร',
        'แนวทางแก้เกี่ยวข้องกับ psychology อย่างไร'
      ],
      artifact: 'Foundation UX Defense Sheet',
      dashboardEvidence: ['bossGatePassed','reasonDefenseScore','evidenceMatchAccuracy','retryImprovement','reflection'],
      seedCases: [
        { id:'B1-C01', context:'ระบบบริการนักศึกษา', concepts:['UI','UX','HCD','cognitive load'] },
        { id:'B1-C02', context:'ระบบขอเอกสารออนไลน์', concepts:['user goal','feedback','error prevention'] },
        { id:'B1-C03', context:'แอปกิจกรรมมหาวิทยาลัย', concepts:['attention','assumption','test idea'] }
      ]
    },
    {
      id: 'W4', type: 'week', order: 5, unlockAfter: 'B1',
      title: 'User Empathy & Research', missionTitle: 'Empathy Detective',
      focus: 'เข้าใจผู้ใช้ด้วยข้อมูลจริง',
      concepts: ['User research','Interview question','Observation','Pain point','Need','Goal','Motivation','Empathy map','Persona lite'],
      learningOutcomes: ['ออกแบบคำถามสัมภาษณ์เบื้องต้นได้','แยก fact/opinion/pain point/design opportunity ได้','สร้าง persona lite จากหลักฐานได้'],
      casePrompt: 'ออกแบบระบบจองอุปกรณ์ห้องปฏิบัติการโดยต้องเข้าใจปัญหาของนักศึกษาและเจ้าหน้าที่',
      missionRounds: ['Choose interview question','Classify evidence','Extract pain point','Build persona lite','Select opportunity'],
      reasonChecks: ['คำถามใดเป็นคำถามนำ','Insight ใดนำไปสู่การออกแบบได้จริง','Persona ที่ดีต้องมีข้อมูลอะไรที่เกี่ยวข้องกับการใช้งาน'],
      artifact: 'Interview Note + Persona Lite',
      artifactChecklist: ['Interview objective','3-5 questions','Observed pain points','Persona goal','Persona constraint'],
      dashboardEvidence: ['interviewQuestionQuality','painPointDetected','personaCompleteness','reasonCheck'],
      seedCases: [
        { id:'W4-C01', context:'จองอุปกรณ์แล็บ', user:'นักศึกษา', data:'ไม่รู้สถานะอนุมัติ' },
        { id:'W4-C02', context:'แจ้งซ่อมห้องเรียน', user:'เจ้าหน้าที่', data:'รับเรื่องซ้ำหลายช่องทาง' },
        { id:'W4-C03', context:'สมัครกิจกรรม', user:'นักศึกษาทำงานพิเศษ', data:'พลาด deadline เพราะประกาศกระจัดกระจาย' }
      ]
    },
    {
      id: 'W5', type: 'week', order: 6, unlockAfter: 'W4',
      title: 'Define Problem & Ideation', missionTitle: 'Problem Alchemist',
      focus: 'จาก insight สู่แนวคิดออกแบบ',
      concepts: ['Problem statement','How Might We','Root cause','Ideation','Crazy 8s','Concept selection','Storyboard'],
      learningOutcomes: ['เขียน problem statement ได้เฉพาะเจาะจง','สร้าง HMW ที่เปิดทางแก้หลายแบบ','เลือก solution ที่แก้ root cause ได้'],
      casePrompt: 'นักศึกษาไม่ส่งคำร้องออนไลน์เพราะไม่รู้ว่าเอกสารใดจำเป็น ต้องเขียน HMW และเลือกแนวคิดแก้ปัญหา',
      missionRounds: ['Find root cause','Write problem frame','Select HMW','Choose concept','Storyboard next step'],
      reasonChecks: ['Problem statement นี้เฉพาะเจาะจงพอหรือไม่','Solution แก้ root cause หรือแค่ปลายเหตุ','HMW ที่ดีเปิดทางให้คิดหลายวิธีอย่างไร'],
      artifact: 'Problem Statement + HMW + Concept Storyboard',
      artifactChecklist: ['User group','Need/problem','Root cause','HMW','Concept storyboard'],
      dashboardEvidence: ['problemStatementQuality','hmwQuality','solutionFit','storyboardSubmitted'],
      seedCases: [
        { id:'W5-C01', context:'คำร้องออนไลน์', rootCause:'ไม่รู้เอกสารจำเป็น' },
        { id:'W5-C02', context:'จองห้องประชุม', rootCause:'ไม่เห็นข้อจำกัดก่อนจอง' },
        { id:'W5-C03', context:'เว็บทุน', rootCause:'เงื่อนไขกระจัดกระจายและภาษายาก' }
      ]
    },
    {
      id: 'W6', type: 'week', order: 7, unlockAfter: 'W5',
      title: 'Information Architecture & User Flow', missionTitle: 'Flow Architect',
      focus: 'โครงสร้างข้อมูลและเส้นทางผู้ใช้',
      concepts: ['Information architecture','Content grouping','Navigation','Sitemap','User flow','Happy path','Error path','Alternative path'],
      learningOutcomes: ['จัดกลุ่มข้อมูลและเมนูได้','สร้าง sitemap ได้','ออกแบบ user flow ที่มี happy path และ error path ได้'],
      casePrompt: 'ระบบยืมอุปกรณ์ออนไลน์มีเมนูซ้ำ ผู้ใช้ไม่รู้ว่าเริ่มจากจอง ยืม หรือตรวจสอบสถานะ',
      missionRounds: ['Group content','Select navigation','Build happy path','Add error path','Find bottleneck'],
      reasonChecks: ['เมนูใดควรรวม/แยก เพราะอะไร','จุดใดใน flow เสี่ยงทำให้ผู้ใช้หลุด','Error path ที่จำเป็นคืออะไร'],
      artifact: 'Sitemap + Main User Flow + Error Path',
      artifactChecklist: ['Sitemap','Start point','Decision points','Confirmation','Error/alternative path'],
      dashboardEvidence: ['sitemapQuality','flowCompleteness','errorPathIncluded','reasonCheck'],
      seedCases: [
        { id:'W6-C01', context:'ยืมอุปกรณ์ออนไลน์', issue:'เมนูซ้ำและสถานะไม่ชัด' },
        { id:'W6-C02', context:'จองคิวคลินิก', issue:'เลือกบริการก่อนรู้เวลาว่างไม่ได้' },
        { id:'W6-C03', context:'สมัครอบรม', issue:'flow ขาดเมื่อที่นั่งเต็ม' }
      ]
    },
    {
      id: 'W7', type: 'week', order: 8, unlockAfter: 'W6',
      title: 'Wireframe, Grid & Visual Hierarchy', missionTitle: 'Wireframe Rescue',
      focus: 'วางหน้าจอให้ผู้ใช้เห็นสิ่งสำคัญก่อน',
      concepts: ['Low-fi wireframe','Grid system','Layout','Visual hierarchy','Content priority','CTA placement','Scannability','Mobile-first'],
      learningOutcomes: ['สร้าง low-fi wireframe ได้','จัด priority ของเนื้อหาได้','วาง CTA และ layout ให้สอดคล้องกับ user goal ได้'],
      casePrompt: 'หน้าแรกระบบบริการนักศึกษามีประกาศ ข่าว เมนูด่วน และสถานะคำร้องปนกัน ต้องจัดลำดับใหม่',
      missionRounds: ['Rank content priority','Choose layout','Place CTA','Check scannability','Adapt to mobile'],
      reasonChecks: ['องค์ประกอบใดสำคัญที่สุดสำหรับ user goal','CTA ควรอยู่ตรงไหน เพราะอะไร','ถ้าใช้บนมือถือ layout ต้องเปลี่ยนอย่างไร'],
      artifact: 'Low-fi Wireframe 5 screens',
      artifactChecklist: ['5 screens','Grid/spacing','Visual hierarchy','CTA placement','Mobile consideration'],
      dashboardEvidence: ['hierarchyChoice','ctaPlacement','mobileConsideration','wireframeSubmitted'],
      seedCases: [
        { id:'W7-C01', context:'หน้าแรกบริการนักศึกษา', goal:'ตรวจสถานะคำร้องเร็ว' },
        { id:'W7-C02', context:'หน้าเลือกวิชา', goal:'เปรียบเทียบเวลา/หน่วยกิต' },
        { id:'W7-C03', context:'หน้าสมัครกิจกรรม', goal:'เห็นเงื่อนไขและปุ่มสมัครทันที' }
      ]
    },
    {
      id: 'B2', type: 'boss', order: 9, unlockAfter: 'W7', covers: ['W4','W5','W6','W7'],
      title: 'Flow & Wireframe Boss', missionTitle: 'Flow Fortress',
      focus: 'Research to Structure Defense',
      bossScenario: 'ผู้เรียนได้รับ brief ระบบจองบริการมหาวิทยาลัย ต้องวิเคราะห์ผู้ใช้ จัดกลุ่มปัญหา วาง user flow และเลือก wireframe ที่เหมาะสม',
      missionRounds: ['Identify user need','Select problem statement','Build flow','Detect broken flow','Wireframe defense'],
      passCriteria: { requiredFlow: ['start','decision','confirmation','errorPath'], minReasonPassPct: 70 },
      reasonChecks: ['Wireframe ตอบ persona ใด','Flow มี error path ครบหรือไม่','ปัญหาที่แก้เชื่อมกับ insight ใด'],
      artifact: 'Flow/Wireframe Defense Sheet',
      dashboardEvidence: ['bossGatePassed','flowCompleteness','wireframeDefense','reasonDefenseScore','reflection'],
      seedCases: [
        { id:'B2-C01', context:'จองบริการมหาวิทยาลัย', concepts:['persona','problem','flow','wireframe'] },
        { id:'B2-C02', context:'ระบบยืมคืนอุปกรณ์', concepts:['insight','IA','error path','CTA'] }
      ]
    },
    {
      id: 'W8', type: 'week', order: 10, unlockAfter: 'B2',
      title: 'Midterm Studio', missionTitle: 'Midterm Studio Checkpoint',
      focus: 'Design Review & Blueprint',
      concepts: ['Midterm design review','UX blueprint','Evidence-based critique','Design rationale','Revision plan','Peer feedback'],
      learningOutcomes: ['รวมงาน W1-W7 เป็น UX Blueprint ได้','รับ feedback และจัดลำดับการแก้ได้','เชื่อม problem/persona/flow/wireframe ได้'],
      casePrompt: 'ตรวจ blueprint ที่ persona ไม่ตรง flow, problem ไม่ตรง wireframe หรือ wireframe ไม่มี evidence รองรับ',
      missionRounds: ['Check evidence chain','Find mismatch','Rank critique','Choose revision','Write rationale'],
      reasonChecks: ['จุดใดในงานยังไม่มีหลักฐานรองรับ','Feedback ใดควรแก้ก่อน เพราะกระทบผู้ใช้มากที่สุด','ถ้าต้องตัดงานบางส่วน ควรรักษาส่วนใดไว้'],
      artifact: 'Midterm UX Blueprint',
      artifactChecklist: ['Problem','Persona','User flow','Wireframe','Evidence','Revision plan'],
      dashboardEvidence: ['blueprintCompleteness','critiqueQuality','revisionPriority','reflection'],
      seedCases: [
        { id:'W8-C01', context:'Blueprint mismatch', issue:'Persona บอกใช้มือถือ แต่ wireframe desktop-only' },
        { id:'W8-C02', context:'Evidence gap', issue:'Flow เพิ่มขั้นตอนโดยไม่มีหลักฐานผู้ใช้' }
      ]
    },
    {
      id: 'W9', type: 'week', order: 11, unlockAfter: 'W8',
      title: 'Pattern Library & Design System', missionTitle: 'Pattern Keeper',
      focus: 'สร้างระบบออกแบบให้สม่ำเสมอ',
      concepts: ['Design system','Pattern library','UI kit','Component','Variant','State','Naming convention','Consistency'],
      learningOutcomes: ['อธิบาย design system/pattern library ได้','สร้าง component states ได้','วาง naming convention ได้'],
      casePrompt: 'เว็บไซต์มีปุ่ม 8 แบบ สีไม่สม่ำเสมอ และ CTA ไม่เป็นระบบ ต้องจัด pattern ใหม่',
      missionRounds: ['Detect inconsistency','Merge pattern','Define states','Name component','Explain consistency'],
      reasonChecks: ['Component ใดควรรวมเป็น pattern เดียวกัน','State ของปุ่มต้องมีอะไรบ้าง','Consistency ช่วยผู้ใช้อย่างไร ไม่ใช่แค่ช่วยนักออกแบบอย่างไร'],
      artifact: 'UI Kit Charter',
      artifactChecklist: ['Button','Input','Card','Navigation','Alert','Default/hover/focus/disabled/error/success states'],
      dashboardEvidence: ['componentConsistency','stateCompleteness','namingQuality','patternReason'],
      seedCases: [
        { id:'W9-C01', context:'ปุ่มหลายแบบ', issue:'primary/secondary ใช้สีปนกัน' },
        { id:'W9-C02', context:'ฟอร์มหลายหน้า', issue:'error state ไม่สม่ำเสมอ' }
      ]
    },
    {
      id: 'W10', type: 'week', order: 12, unlockAfter: 'W9',
      title: 'Responsive Design & Accessibility', missionTitle: 'Responsive Guardian',
      focus: 'ออกแบบให้ใช้ได้หลายอุปกรณ์และเข้าถึงได้',
      concepts: ['Responsive web design','Breakpoints','Mobile-first','Flexible grid','Touch target','Accessibility','Contrast','Keyboard focus','Alt text','Form accessibility'],
      learningOutcomes: ['ออกแบบ responsive layout ได้','ระบุ accessibility issue ได้','เลือก breakpoint/touch target/focus state ได้เหมาะสม'],
      casePrompt: 'ระบบลงทะเบียนดีบน desktop แต่บนมือถือปุ่มเล็ก ตารางล้นจอ และข้อความ error อ่านไม่ชัด',
      missionRounds: ['Find responsive issue','Find a11y issue','Choose breakpoint','Fix touch target','Check focus/contrast'],
      reasonChecks: ['ปัญหาใดเป็น responsive issue','ปัญหาใดเป็น accessibility issue','การออกแบบที่เข้าถึงได้ช่วยผู้ใช้ทั่วไปอย่างไร'],
      artifact: 'Responsive + Accessibility Plan',
      artifactChecklist: ['Desktop layout','Mobile layout','Breakpoint decision','Contrast check','Keyboard/focus note','Touch target note'],
      dashboardEvidence: ['responsiveFix','accessibilityDetection','contrastDecision','mobileReason'],
      seedCases: [
        { id:'W10-C01', context:'ตารางลงทะเบียน', issue:'ล้นจอบนมือถือ' },
        { id:'W10-C02', context:'ฟอร์มสมัคร', issue:'focus state ไม่ชัดและ label หาย' }
      ]
    },
    {
      id: 'W11', type: 'week', order: 13, unlockAfter: 'W10',
      title: 'Color, Typography & Visual Accessibility', missionTitle: 'Visual Signal Control',
      focus: 'ภาษาภาพของอินเทอร์เฟซ',
      concepts: ['Color system','Typography','Readability','Contrast','Visual tone','Brand personality','Spacing scale','Visual accessibility'],
      learningOutcomes: ['เลือกสีและ type hierarchy ตามความหมายได้','ตรวจ readability/contrast ได้','สร้าง visual style guide ได้'],
      casePrompt: 'แอปสุขภาพใช้สีแดงจำนวนมากจนผู้ใช้คิดว่าเป็น error ทุกจุด และใช้ font เล็กเกินไป',
      missionRounds: ['Map color meaning','Choose type hierarchy','Check contrast','Adjust spacing','Defend visual decision'],
      reasonChecks: ['สีใดควรใช้กับ action/warning/success/error','Typography hierarchy ช่วยการอ่านอย่างไร','Visual style ที่สวยแต่ contrast ต่ำควรผ่านหรือไม่ เพราะอะไร'],
      artifact: 'Visual Style Guide',
      artifactChecklist: ['Color tokens','Typography scale','Spacing scale','Status color','Accessibility note'],
      dashboardEvidence: ['colorMeaningAccuracy','typographyHierarchy','accessibilityReason','styleGuideSubmitted'],
      seedCases: [
        { id:'W11-C01', context:'แอปสุขภาพ', issue:'สีแดงถูกใช้ทั้ง error และ CTA' },
        { id:'W11-C02', context:'เว็บสมัครเรียน', issue:'หัวข้อ/เนื้อหา/คำเตือนไม่มีลำดับสายตา' }
      ]
    },
    {
      id: 'B3', type: 'boss', order: 14, unlockAfter: 'W11', covers: ['W9','W10','W11'],
      title: 'Interface System Boss', missionTitle: 'Design System Siege',
      focus: 'Pattern, Responsive & Accessibility Defense',
      bossScenario: 'UI ชุดหนึ่งมี component ไม่สม่ำเสมอ responsive พัง และ accessibility ต่ำ ต้องซ่อมระบบด้วยเหตุผล',
      missionRounds: ['Detect inconsistency','Fix component state','Responsive repair','Accessibility check','System defense'],
      passCriteria: { consistencyRequired: true, responsiveDecisionRequired: true, accessibilityIssueRequired: true, minReasonPassPct: 70 },
      reasonChecks: ['ระบบ component ลดภาระผู้ใช้อย่างไร','Responsive decision ใดจำเป็นที่สุด','Accessibility issue ใดกระทบงานหลักที่สุด'],
      artifact: 'Interface System Defense Sheet',
      dashboardEvidence: ['bossGatePassed','componentConsistency','responsiveDecision','a11yDetection','reasonDefenseScore'],
      seedCases: [
        { id:'B3-C01', context:'ระบบบริการนักศึกษา multi-page', concepts:['component','responsive','contrast','typography'] },
        { id:'B3-C02', context:'portal สมัครกิจกรรม', concepts:['design system','touch target','visual hierarchy'] }
      ]
    },
    {
      id: 'W12', type: 'week', order: 15, unlockAfter: 'B3',
      title: 'Interaction Design & Component States', missionTitle: 'Interaction Signal',
      focus: 'อินเทอร์แอกชันที่ทำให้ผู้ใช้มั่นใจ',
      concepts: ['Interaction design','Component states','Feedback','Loading','Empty state','Error state','Success state','Confirmation','Microcopy'],
      learningOutcomes: ['ออกแบบ state ของ component ได้','เลือก feedback ที่ลดความกังวลผู้ใช้ได้','เขียน microcopy สำหรับ error/success ได้'],
      casePrompt: 'ผู้ใช้กดส่งคำร้องแล้วไม่รู้ว่าระบบกำลังโหลด สำเร็จ หรือผิดพลาด จึงกดซ้ำหลายรอบ',
      missionRounds: ['Choose loading state','Prevent double submit','Write microcopy','Choose confirmation','Design recovery'],
      reasonChecks: ['State ใดจำเป็นก่อน/หลังการกดปุ่ม','Microcopy ใดลดความกังวลของผู้ใช้','Confirmation จำเป็นเมื่อใด และเมื่อใดไม่ควรใช้'],
      artifact: 'Component State Spec',
      artifactChecklist: ['Button state','Form state','Loading state','Error message','Empty state','Success feedback'],
      dashboardEvidence: ['stateSelection','feedbackQuality','microcopyReason','errorPreventionChoice'],
      seedCases: [
        { id:'W12-C01', context:'ส่งคำร้อง', issue:'กดซ้ำเพราะไม่มี loading/disabled state' },
        { id:'W12-C02', context:'ค้นหาข้อมูลว่าง', issue:'empty state ไม่บอกทางไปต่อ' }
      ]
    },
    {
      id: 'W13', type: 'week', order: 16, unlockAfter: 'W12',
      title: 'High-fidelity Prototype', missionTitle: 'Prototype Builder',
      focus: 'สร้างต้นแบบที่ทดสอบได้จริง',
      concepts: ['High-fidelity design','Prototype flow','Interactive link','Figma prototype','Scenario-based prototype','Prototype limitation','Design rationale'],
      learningOutcomes: ['สร้าง prototype ที่ทดสอบ task ได้จริง','ตรวจ flow/link/state ใน prototype ได้','อธิบาย design rationale ได้'],
      casePrompt: 'แปลง wireframe และ UI kit เป็น prototype ที่ผู้ใช้ทดลองงานหลักได้อย่างน้อย 1 flow',
      missionRounds: ['Check testable task','Find missing link','Check modal/overlay','Validate error path','Defend rationale'],
      reasonChecks: ['Prototype นี้ทดสอบ task ใดได้จริง','จุดใดยังเป็น mockup ไม่ใช่ prototype','ถ้าผู้ใช้หลงทางใน prototype แปลว่าปัญหาอยู่ที่อะไร'],
      artifact: 'Clickable Hi-fi Prototype',
      artifactChecklist: ['5-8 screens','1 main flow','1 error/alternative path','Important component states','Design rationale'],
      dashboardEvidence: ['prototypeCompleteness','flowTestable','interactionIssueDetected','rationaleSubmitted'],
      seedCases: [
        { id:'W13-C01', context:'Prototype จองบริการ', issue:'ปุ่ม confirm ไม่มี destination' },
        { id:'W13-C02', context:'Prototype form', issue:'error path ไม่สามารถกลับไปแก้ได้' }
      ]
    },
    {
      id: 'W14', type: 'week', order: 17, unlockAfter: 'W13',
      title: 'Evaluation & Iteration', missionTitle: 'Evidence Lab',
      focus: 'ทดสอบ ใช้หลักฐาน และปรับปรุง',
      concepts: ['Heuristic evaluation','Cognitive walkthrough','Usability test','Task success','Error','Time on task','Severity','Evidence-based iteration','Test-modify-retest'],
      learningOutcomes: ['วาง usability test แบบย่อได้','จัดระดับ severity จากหลักฐานได้','เลือก fix และ retest idea ได้'],
      casePrompt: 'ผู้ใช้ทดลอง prototype แล้วทำ task ไม่สำเร็จ 2 จุด ต้องจัดลำดับความรุนแรงและเลือกแก้ก่อน',
      missionRounds: ['Read test evidence','Classify finding','Rank severity','Choose evidence-based fix','Plan retest'],
      reasonChecks: ['ปัญหาใดมี severity สูงสุด เพราะอะไร','หลักฐานใดมาจากผู้ใช้ ไม่ใช่ความเห็นของทีม','การแก้ไขใดควรทดสอบซ้ำ'],
      artifact: 'Usability Iteration Log',
      artifactChecklist: ['Test task','Participant note','Finding','Severity','Fix','Before/after','Retest idea'],
      dashboardEvidence: ['evaluationMethod','severityDecision','evidenceBasedFix','iterationLogSubmitted'],
      seedCases: [
        { id:'W14-C01', context:'Usability test 5 คน', issue:'3 คนหา submit ไม่เจอ' },
        { id:'W14-C02', context:'Walkthrough', issue:'ผู้ใช้เข้าใจคำว่า verify ผิด' }
      ]
    },
    {
      id: 'B4', type: 'boss', order: 18, unlockAfter: 'W14', covers: ['W12','W13','W14'],
      title: 'Validation Boss', missionTitle: 'Prototype Validation Defense',
      focus: 'Prototype & Evaluation Defense',
      bossScenario: 'Prototype มีผลทดสอบจากผู้ใช้ 5 คน พบปัญหาหลายระดับ ผู้เรียนต้องจัดลำดับ แก้ไข และอธิบายเหตุผลจากหลักฐาน',
      missionRounds: ['Read test evidence','Rank severity','Choose fix','Defend iteration','Final reflection'],
      passCriteria: { severityRequired: true, evidenceFixRequired: true, beforeAfterRequired: true, minReasonPassPct: 70 },
      reasonChecks: ['Fix ที่เลือกสัมพันธ์กับ evidence ใด','Before/after ดีขึ้นเพราะอะไร','ควร retest จุดใดก่อนส่ง final'],
      artifact: 'Prototype Validation Defense Sheet',
      dashboardEvidence: ['bossGatePassed','severityDecision','evidenceBasedFix','beforeAfterReason','reflection'],
      seedCases: [
        { id:'B4-C01', context:'Prototype service portal', concepts:['state','prototype','usability test','iteration'] },
        { id:'B4-C02', context:'Student request app', concepts:['microcopy','flow','severity','retest'] }
      ]
    },
    {
      id: 'W15', type: 'week', order: 19, unlockAfter: 'B4',
      title: 'Final Studio & UX/UI Portfolio', missionTitle: 'Portfolio Finalizer',
      focus: 'สรุปงานเป็นกรณีศึกษา',
      concepts: ['UX case study','Portfolio structure','Storytelling','Evidence-decision-design-test','Final presentation','Reflection','Professional critique'],
      learningOutcomes: ['จัดทำ UX/UI case study ได้ครบกระบวนการ','นำเสนอ evidence-decision-design-test ได้','สะท้อนการเรียนรู้และการปรับปรุงงานได้'],
      casePrompt: 'ตรวจ portfolio ที่มีแต่ภาพสวยแต่ขาด narrative, evidence, testing result และ design decision',
      missionRounds: ['Check case narrative','Find evidence gap','Order portfolio story','Select testing proof','Prepare presentation defense'],
      reasonChecks: ['Case study ที่ดีต้องเริ่มจากอะไร','ภาพ prototype อย่างเดียวพอหรือไม่','หลักฐานใดควรนำมาใช้ใน final presentation'],
      artifact: 'Final UX/UI Case Study Portfolio',
      artifactChecklist: ['Project title','Problem background','Target user','Research evidence','Persona/Journey/Flow','Wireframe','UI system','Prototype','Usability findings','Iteration','Final reflection'],
      dashboardEvidence: ['portfolioCompleteness','evidenceCoverage','presentationReadiness','finalReflection'],
      seedCases: [
        { id:'W15-C01', context:'Portfolio review', issue:'มี final UI แต่ไม่มี problem/evidence' },
        { id:'W15-C02', context:'Presentation rehearsal', issue:'อธิบาย decision ไม่เชื่อม usability finding' }
      ]
    }
  ];

  const progression = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    order: node.order,
    unlockAfter: node.unlockAfter,
    title: node.title,
    missionTitle: node.missionTitle,
    focus: node.focus,
    artifact: node.artifact
  }));

  function byId(id) {
    return nodes.find((node) => String(node.id).toLowerCase() === String(id).toLowerCase()) || null;
  }

  function nextAfter(id) {
    const node = byId(id);
    if (!node) return null;
    return nodes.find((candidate) => candidate.order === node.order + 1) || null;
  }

  function requiredEvidence(id) {
    const node = byId(id);
    if (!node) return DASHBOARD_FIELDS.slice();
    return Array.from(new Set(DASHBOARD_FIELDS.concat(node.dashboardEvidence || [])));
  }

  function sampleCase(id, index) {
    const node = byId(id);
    const bank = node && Array.isArray(node.seedCases) ? node.seedCases : [];
    if (!bank.length) return null;
    return bank[Math.abs(Number(index) || 0) % bank.length];
  }

  window.CSAI2601_UXQ_CANONICAL_CONTENT_V1 = {
    courseId: COURSE_ID,
    version: VERSION,
    scope: 'W1-W15 + B1-B4; no B5',
    dashboardFields: DASHBOARD_FIELDS,
    antiGuessingRules: ANTI_GUESSING_RULES,
    rubric: RUBRIC,
    nodes,
    progression,
    byId,
    nextAfter,
    requiredEvidence,
    sampleCase
  };

  window.dispatchEvent(new CustomEvent('csai2601:uxq-content-ready', {
    detail: { courseId: COURSE_ID, version: VERSION, nodeCount: nodes.length }
  }));
})();
