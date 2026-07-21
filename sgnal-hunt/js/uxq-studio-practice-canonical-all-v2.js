/* CSAI2601 UX Quest • Studio Practice Canonical Pack v2
 * Full course: W1-W15 + B1-B4
 * Keeps official unlock on Sheet-confirmed mission_completed until migration approval.
 */
(() => {
  'use strict';

  const VERSION = '20260721-STUDIO-PRACTICE-ALL19-V2';
  const POLICY = Object.freeze({
    officialProgressSource:'Google Sheet mission_completed contiguous path',
    unlockChangedByThisPack:false,
    teacherReviewRequiredForNextNode:false,
    projectContinuity:true,
    reflectionRequired:true
  });
  const RUBRIC = Object.freeze([
    {key:'evidence',label:'Evidence',weight:25},
    {key:'reasoning',label:'UX Reasoning',weight:25},
    {key:'artifactQuality',label:'Artifact Quality',weight:25},
    {key:'validation',label:'Validation',weight:15},
    {key:'reflection',label:'Reflection & Revision',weight:10}
  ]);

  const F = (key,label,minLength=35,placeholder='',format='text',rows=4) => ({key,label,required:true,minLength,placeholder,format,rows});
  const base = (id, artifact, title, objective, minutes, taskFields, reflectionPrompt, checks, flow, phase='Studio') => {
    const fields = [
      F('projectId','Project ID เดิม',4,'ใช้ Project ID เดียวตั้งแต่ W1-W15','text',2),
      F('figmaUrl','Figma / Evidence URL',0,'https://www.figma.com/...','url',2),
      ...taskFields,
      F('reflection',`Reflection ${id}`,40,reflectionPrompt,'text',4)
    ];
    return {
      id,phase,canonicalArtifact:artifact,studioTitle:title,objective,suggestedMinutes:minutes,
      practiceFlow:flow,
      fields,
      reflectionPrompt,
      selfChecks:checks,
      evidenceMap:{problemSeen:fields[2].key,uxReason:fields[3].key,fixAndTest:[fields[4].key,fields[5].key],learnedPoint:'reflection'},
      dashboardFields:fields.map(x=>x.key),rubric:RUBRIC
    };
  };

  const items = [
    base('W1','UX First Impression Audit','UX First Impression Audit','แยก UI, UX และ front-end feedback จากหลักฐานของผู้ใช้',55,[
      F('targetUserTaskContext','ผู้ใช้ + Task + Context',40),F('frictionEvidence','Friction และหลักฐาน',50),F('impactAnalysis','ผลกระทบต่อ Task',40),F('initialFixAndTest','แนวทางแก้ + วิธีทดสอบ',55)
    ],'สิ่งใดที่เคยคิดว่าเป็นเพียง UI แต่จริง ๆ กระทบ UX หรือ feedback อย่างไร',[
      'ระบุ User Goal และ Task ชัด','มีหลักฐาน ไม่ใช่ความรู้สึก','แยก UI/UX/feedback ได้','Fix ตรงกับ friction','Test วัดผลของ task'
    ],['เลือกโครงการจริง','จับหลักฐานหน้าจอ','ระบุผู้ใช้และ task','วิเคราะห์ friction/impact','เสนอ fix และ test']),

    base('W2','UX Process Map / HCD Sprint Brief','HCD Sprint Brief','วางกระบวนการ HCD และแยก evidence ออกจาก assumption ก่อนออกแบบ',55,[
      F('initialProblem','Initial Problem',50),F('evidenceVsAssumption','Evidence vs Assumption',60),F('dataCollectionPlan','แผนเก็บข้อมูล',50),F('hcdProcessMap','HCD Process Map',50)
    ],'Assumption ใดเสี่ยงที่สุด และจะตรวจสอบกับใคร ด้วยวิธีใด',[
      'ใช้โครงการเดิม','ยังไม่กระโดดไป Persona/HMW','แยก evidence/assumption','วิธีวิจัยตรงคำถาม','Process เชื่อม evidence กับ decision'
    ],['ใช้ผล W1','เขียน problem แบบไม่ล็อก solution','แยก evidence/assumption','เลือกผู้ให้ข้อมูล','วาง HCD process']),

    base('W3','Cognitive Load Repair Note','Cognitive Load Repair + Before–After','ใช้ psychology วิเคราะห์และซ่อมหน้าจอโดยไม่เน้นความสวยอย่างเดียว',70,[
      F('confusingPoint','จุดสับสนหรือภาระการจำ',50),F('psychologyDiagnosis','Psychology Diagnosis',60),F('beforeAfterDecision','Before → After Decision',60),F('validationPlan','วิธีตรวจ Before–After',45)
    ],'ส่วนใดของ Before–After ยังเป็นสมมติฐาน และต้องทดสอบอะไรต่อ',[
      'แก้การใช้งานไม่ใช่แค่สไตล์','เลือกหลัก psychology ถูก','ลด recall/เพิ่ม feedback','ไม่เพิ่มข้อความเกินจำเป็น','มี validation plan'
    ],['เลือกหน้าจอจาก W1','วินิจฉัย load/attention','จับคู่ psychology','ทำ Before–After','วาง validation']),

    base('B1','Foundation UX Defense Sheet','Foundation UX Defense','สังเคราะห์ W1-W3 เป็นสายหลักฐานและปกป้องการตัดสินใจ',50,[
      F('evidenceChain','User → Task → Friction → Impact',70),F('hcdPsychologyDefense','HCD + Psychology Defense',70),F('repairDefense','เหตุผลปกป้องแนวทางแก้',60),F('testRevisionPriority','Test + Revision Priority',50)
    ],'ความคิดเริ่มต้นของโครงการเปลี่ยนไปอย่างไรหลังผ่าน W1-W3',[
      'เชื่อม W1-W3 ได้','มี evidence chain','แยก assumption','ปกป้อง fix ด้วยเหตุผล','มี revision priority'
    ],['สรุป friction','ตรวจ evidence/assumption','อธิบาย psychology','ปกป้อง repair','กำหนด test/revision'],'Boss Defense'),

    base('W4','Interview Note + Persona Lite','User Research & Persona Lite','เก็บและตีความข้อมูลผู้ใช้จริงเพื่อสร้าง Persona Lite',75,[
      F('researchObjectiveQuestions','Research Objective + Interview Questions',60),F('observedEvidence','Quote / Behaviour / Pain Point',70),F('personaLite','Persona Goal + Constraint',60),F('designOpportunity','Design Opportunity',45)
    ],'ข้อมูลใดใน Persona มาจากหลักฐาน และข้อมูลใดยังเป็นเพียงสมมติฐาน',[
      'คำถามไม่ชี้นำ','มี quote/behaviour','Persona เกี่ยวกับ task','Pain point ไม่ใช่ solution','Opportunity ยังเปิดกว้าง'
    ],['กำหนด objective','เขียนคำถาม','เก็บ quote/behaviour','สร้าง persona lite','หา opportunity']),

    base('W5','Problem Statement + HMW + Concept Storyboard','Define & Ideation Studio','เปลี่ยน insight เป็น problem statement, HMW และ storyboard ที่แก้ root cause',70,[
      F('problemStatement','Problem Statement',60),F('rootCauseEvidence','Root Cause + Evidence',55),F('hmwConcept','HMW + Concept Selection',65),F('storyboard','Storyboard Summary',50)
    ],'แนวคิดที่เลือกแก้ root cause จริงหรือเพียงแก้อาการปลายเหตุ เพราะอะไร',[
      'Problem ระบุ user/need/context','Root cause มีหลักฐาน','HMW เปิดหลายทาง','Concept ไม่ล็อกเร็วเกินไป','Storyboard แสดง task outcome'
    ],['สกัด insight','เขียน problem','หา root cause','สร้าง HMW/แนวคิด','ทำ storyboard']),

    base('W6','Sitemap + Main User Flow + Error Path','IA & User Flow Studio','จัดโครงสร้างข้อมูลและเส้นทางผู้ใช้ครบ happy, alternative และ error path',75,[
      F('sitemapDecision','Sitemap + Grouping Rationale',60),F('mainFlow','Main User Flow',60),F('decisionErrorPath','Decision + Error/Alternative Path',65),F('bottleneckFix','Bottleneck + Fix',50)
    ],'จุดใดใน flow เสี่ยงทำให้ผู้ใช้หลุดมากที่สุด และจะลดความเสี่ยงอย่างไร',[
      'Grouping ตรง mental model','มี start/end','Decision ชัด','มี error/alternative path','ระบุ bottleneck'
    ],['จัดกลุ่ม content','ทำ sitemap','วาง happy path','เพิ่ม decision/error','ตรวจ bottleneck']),

    base('W7','Low-fi Wireframe 5 screens','Low-fi Wireframe Studio','สร้าง wireframe 5 หน้าจอด้วย grid, hierarchy, CTA และ mobile-first',80,[
      F('screenFlow','5 Screens + Screen Flow',60),F('hierarchyRationale','Visual Hierarchy Rationale',55),F('ctaGridDecision','CTA + Grid/Spacing Decision',55),F('mobileAdaptation','Mobile-first Adaptation',50)
    ],'องค์ประกอบใดถูกลดความสำคัญหรือเลื่อนตำแหน่ง และตัดสินใจจาก user goal อย่างไร',[
      'ครบ 5 screens','Hierarchy ตรง goal','CTA ชัด','Grid/spacing สม่ำเสมอ','คิด mobile-first'
    ],['เลือก main flow','ร่าง 5 screens','จัด priority','วาง CTA/grid','ตรวจ mobile']),

    base('B2','Flow/Wireframe Defense Sheet','Research-to-Wireframe Defense','ปกป้องสาย Research → Problem → IA → Flow → Wireframe',55,[
      F('researchProblemChain','Research → Problem Chain',70),F('personaFlowFit','Persona → Flow Fit',65),F('wireframeDefense','Wireframe Defense',65),F('revisionPriority','Revision Priority',50)
    ],'หลักฐานใดสำคัญที่สุดต่อการตัดสินใจใน wireframe และเพราะเหตุใด',[
      'เชื่อม W4-W7','Persona ตรง flow','Flow มี error path','Wireframe ตรง evidence','มี revision priority'
    ],['สรุป insight','ปกป้อง problem','ตรวจ flow','ปกป้อง wireframe','กำหนด revision'],'Boss Defense'),

    base('W8','Midterm UX Blueprint','Midterm Studio Checkpoint','รวม W1-W7 เป็น blueprint และตรวจ evidence chain ก่อนกลางภาค',70,[
      F('blueprintSummary','Problem + Persona + Flow + Wireframe',75),F('evidenceGap','Evidence Gap / Mismatch',60),F('peerCritique','Peer Critique Received',55),F('revisionPlan','Revision Plan',55)
    ],'Feedback ใดควรแก้ก่อน เพราะกระทบผู้ใช้หรือความน่าเชื่อถือของหลักฐานมากที่สุด',[
      'Blueprint ครบ','องค์ประกอบเชื่อมกัน','พบ mismatch','มี peer evidence','จัดลำดับ revision'
    ],['รวม artifact','ตรวจ evidence chain','หา mismatch','รับ peer critique','เขียน revision plan']),

    base('W9','UI Kit Charter','Pattern Library & Design System','สร้าง component system, states และ naming convention ที่สม่ำเสมอ',75,[
      F('componentInventory','Component Inventory',60),F('variantStateRules','Variants + States',65),F('namingTokens','Naming + Token Rules',55),F('consistencyRationale','Consistency Rationale',50)
    ],'ความสม่ำเสมอช่วยลดภาระผู้ใช้อย่างไร ไม่ใช่เพียงช่วยทีมออกแบบอย่างไร',[
      'มี Button/Input/Card/Nav/Alert','States ครบ','Naming ชัด','Tokens ใช้ซ้ำ','อธิบายผลต่อผู้ใช้'
    ],['สำรวจ component','รวม pattern','กำหนด variants/states','ตั้ง naming/tokens','ตรวจ consistency']),

    base('W10','Responsive + Accessibility Plan','Responsive & Accessibility Studio','ออกแบบหลายอุปกรณ์พร้อม contrast, focus, touch target และ form accessibility',80,[
      F('responsiveLayouts','Desktop + Mobile Layout',60),F('breakpointRationale','Breakpoint Rationale',50),F('accessibilityAudit','Contrast / Focus / Label Audit',65),F('touchKeyboardPlan','Touch Target + Keyboard Plan',55)
    ],'Accessibility fix ใดช่วยทั้งผู้ใช้ที่มีข้อจำกัดและผู้ใช้ทั่วไปมากที่สุด เพราะอะไร',[
      'Desktop/mobile ใช้งานได้','Breakpoint มีเหตุผล','Contrast ผ่าน','Focus/label ชัด','Touch target เหมาะสม'
    ],['ตรวจ layout','ปรับ responsive','เลือก breakpoint','audit accessibility','บันทึก fix']),

    base('W11','Visual Style Guide','Visual Style Guide','สร้างระบบสี ตัวอักษร spacing และ visual accessibility ที่มีความหมาย',75,[
      F('colorTokens','Color Tokens + Meaning',60),F('typeHierarchy','Typography Hierarchy',55),F('spacingStatusSystem','Spacing + Status Colors',55),F('visualAccessibility','Readability + Contrast Note',50)
    ],'การตัดสินใจด้านภาพข้อใดมีเหตุผลจากความหมายและ accessibility มากกว่าความชอบส่วนตัว',[
      'สีมี semantic meaning','Type hierarchy ชัด','Spacing scale สม่ำเสมอ','Status colors ไม่สับสน','Contrast/readability ผ่าน'
    ],['กำหนด color tokens','วาง type scale','กำหนด spacing','กำหนด status colors','ตรวจ accessibility']),

    base('B3','Interface System Defense Sheet','Interface System Defense','ปกป้อง Design System + Responsive + Accessibility จาก W9-W11',55,[
      F('systemConsistency','System Consistency Evidence',65),F('responsiveDefense','Responsive Decision Defense',60),F('a11yDefense','Accessibility Defense',65),F('systemRevision','System Revision Priority',50)
    ],'ถ้าต้องแก้เพียงหนึ่ง systemic issue ก่อน ควรแก้อะไรและเพราะเหตุใด',[
      'เชื่อม W9-W11','Component consistent','Responsive มีเหตุผล','A11y มีหลักฐาน','มี system revision'
    ],['ตรวจ component system','ปกป้อง responsive','ตรวจ a11y','เชื่อม visual tokens','จัด revision'],'Boss Defense'),

    base('W12','Component State Spec','Interaction & Component States','ออกแบบ loading, empty, error, success, confirmation และ microcopy',75,[
      F('stateInventory','State Inventory',60),F('feedbackRecovery','Feedback + Recovery Flow',65),F('microcopy','Error/Success Microcopy',55),F('doubleSubmitPrevention','Prevention + Confirmation Rule',55)
    ],'State ใดลดความกังวลหรือป้องกันความผิดพลาดของผู้ใช้ได้มากที่สุด และอย่างไร',[
      'States ครบ','Feedback ทันเวลา','Recovery ชัด','Microcopy บอกวิธีแก้','ป้องกัน double submit'
    ],['สำรวจ interaction','กำหนด states','เขียน microcopy','ออกแบบ recovery','ตรวจ prevention']),

    base('W13','Clickable Hi-fi Prototype','Hi-fi Prototype Studio','สร้าง prototype ที่ทดสอบ main task และ error/alternative path ได้จริง',85,[
      F('prototypeScope','5-8 Screens + Main Task',60),F('interactionLinks','Interaction / Link Coverage',60),F('errorAlternativePath','Error / Alternative Path',55),F('rationaleTestability','Design Rationale + Testability',55)
    ],'ส่วนใดของงานยังเป็นเพียง mockup และต้องเพิ่ม interaction ใดจึงจะทดสอบ task ได้จริง',[
      'มี 5-8 screens','Main flow คลิกได้','Error path คลิกได้','States สำคัญครบ','ทดสอบ task ได้'
    ],['รวม UI system','เชื่อม main flow','เพิ่ม overlays/states','เพิ่ม error path','ทดลอง task']),

    base('W14','Usability Iteration Log','Usability Test & Iteration','วาง test, อ่านหลักฐาน, จัด severity, แก้ และวาง retest',85,[
      F('testProtocol','Task + Participant + Protocol',65),F('findingsSeverity','Findings + Severity',70),F('beforeAfterFix','Evidence-based Before/After Fix',65),F('retestPlan','Retest Plan',50)
    ],'Finding ใดเปลี่ยนความเชื่อเดิมของทีมมากที่สุด และหลักฐานใดทำให้ต้องเปลี่ยน',[
      'Task ชัด','บันทึกพฤติกรรม','Severity มีเหตุผล','Fix อิง evidence','มี retest'
    ],['เขียน protocol','ทดสอบผู้ใช้','จัด findings/severity','แก้ prototype','วาง retest']),

    base('B4','Prototype Validation Defense Sheet','Prototype Validation Defense','ปกป้องการแก้ prototype ด้วย evidence, severity และ before-after',55,[
      F('testEvidence','Test Evidence Summary',70),F('severityDefense','Severity Defense',60),F('iterationDefense','Before/After Iteration Defense',70),F('finalRetestPriority','Final Retest Priority',50)
    ],'Fix ใดมีหลักฐานแข็งแรงที่สุด และจุดใดยังไม่ควรสรุปจนกว่าจะ retest',[
      'เชื่อม W12-W14','Evidence ชัด','Severity มีเหตุผล','Before/after อธิบายได้','กำหนด retest'
    ],['อ่าน evidence','จัด severity','ปกป้อง fix','ตรวจ before-after','กำหนด retest'],'Boss Defense'),

    base('W15','Final UX/UI Case Study Portfolio','Final Portfolio Studio','สรุปโครงการเป็น case study ที่เล่า evidence → decision → design → test → iteration',90,[
      F('caseNarrative','Problem + User + Evidence Narrative',75),F('designEvolution','Flow → Wireframe → UI → Prototype',75),F('testingIteration','Testing + Iteration Evidence',70),F('presentationReadiness','Portfolio + Presentation Readiness',55)
    ],'โครงการนี้เปลี่ยนวิธีคิดเรื่อง UX/UI ของตนอย่างไร จุดแข็ง จุดอ่อน และสิ่งที่จะพัฒนาต่อคืออะไร',[
      'Narrative ครบ','Evidence เชื่อม decision','แสดง evolution','มี testing/iteration','พร้อมนำเสนอ'
    ],['จัดเรื่องราว','เลือก evidence','แสดง design evolution','สรุป test/iteration','เตรียม presentation'])
  ];

  const byId = id => items.find(item => item.id === String(id || '').trim().toUpperCase()) || null;
  window.CSAI2601_UXQ_STUDIO_PRACTICE_V1 = Object.freeze({version:VERSION,phase:'ALL19',policy:POLICY,items:Object.freeze(items),byId});
})();
