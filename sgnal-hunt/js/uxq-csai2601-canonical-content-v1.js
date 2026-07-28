// === /sgnal-hunt/js/uxq-csai2601-canonical-content-v1.js ===
// CSAI2601 UX Quest Canonical Content Pack
// Scope: W1-W15 + B1-B4. No B5.
// Revision: full course-description alignment for UX/UI, front-end thinking,
// responsive design, accessibility, interaction, design systems, evaluation,
// developer handoff and responsible AI-assisted design.

(function () {
  'use strict';

  const COURSE_ID = 'CSAI2601';
  const VERSION = 'v20260728-course-description-100pct-alignment';

  const COURSE_ALIGNMENT = {
    vision: 'Design with AI, Design for Humans',
    projectModel: 'โครงการ UX/UI เดียวต่อเนื่องตั้งแต่ W1 ถึง W15',
    requiredFlow: ['Mission', 'Studio/Artifact', 'Reflection', 'Unlock'],
    requiredEvidence: ['Figma URL', 'Project URL', 'Evidence URL'],
    domains: [
      'UX/UI foundations', 'Human-centered design', 'User research',
      'Cognitive psychology', 'Information architecture', 'Interaction design',
      'Responsive and mobile-first design', 'Accessibility and inclusive design',
      'Visual design', 'Design systems', 'Front-end thinking',
      'Prototype and developer handoff', 'Evaluation and iteration',
      'Responsible AI-assisted design', 'Professional portfolio'
    ]
  };

  const DASHBOARD_FIELDS = [
    'studentId','studentName','section','courseId','nodeId','caseId','missionId',
    'score','stars','accuracy','correct','wrong','timeUsed','retryCount','hintUsed',
    'selectedAnswer','selectedReason','reasonCheckPassed','artifactSubmitted',
    'figmaUrl','projectUrl','evidenceUrl','reflection','learnedPoint','misconception',
    'aiToolUsed','aiContribution','humanDecision','aiRiskChecked','accessibilityChecked',
    'responsiveChecked','handoffReady','bossGatePassed','timestamp'
  ];

  const ANTI_GUESSING_RULES = [
    'Shuffle answer order every attempt.',
    'Rotate case variants and keep a recent-case no-repeat window.',
    'Use plausible distractors tagged by misconception.',
    'Require a reason check for high mastery.',
    'Do not award mastery from speed alone.',
    'Record retry improvement and reasoning changes.',
    'Boss Gates must synthesize prior weeks.',
    'AI-generated output must be reviewed and justified by the student.'
  ];

  const RUBRIC = {
    excellent: 'ใช้หลักฐานผู้ใช้ เชื่อม problem → flow → interface → prototype → evaluation → iteration ได้ครบ ออกแบบเข้าถึงได้ ตอบสนองหลายหน้าจอ ส่งต่อพัฒนาได้ และอธิบายบทบาท AI กับการตัดสินใจของมนุษย์ชัดเจน',
    good: 'เชื่อมกระบวนการออกแบบได้เกือบครบ มีเหตุผลและหลักฐานส่วนใหญ่ แต่บางจุดยังขาด accessibility, responsive, handoff หรือการตรวจสอบ AI',
    developing: 'เข้าใจบางส่วน แต่การตัดสินใจยังอิงความชอบส่วนตัว หลักฐานไม่พอ หรือผลงานแต่ละส่วนยังไม่เชื่อมกัน',
    beginning: 'ผลงานขาดหลักฐานผู้ใช้ เหตุผล กระบวนการทดสอบ และไม่สามารถอธิบายการตัดสินใจด้าน UX/UI ได้'
  };

  const common = {
    completionRule: 'Mission + Studio/Artifact + Reflection ครบ และมี Figma URL + Project URL + Evidence URL',
    sourceOfTruth: 'Google Sheet',
    aiRule: 'AI ช่วยค้นทางเลือก วิเคราะห์ หรือร่างได้ แต่ผู้เรียนต้องตรวจสอบ อธิบาย และรับผิดชอบการตัดสินใจสุดท้าย'
  };

  const nodes = [
    {
      id:'W1', type:'week', order:1, unlockAfter:null,
      title:'UX/UI & Front-end Foundations', missionTitle:'UX First Responder',
      focus:'แยก UI, UX และ Front-end พร้อมตรวจประสบการณ์ใช้งานจริง',
      concepts:['UI vs UX','Front-end role','User goal','Task','Context','Friction','Feedback','Evidence-based UX audit'],
      learningOutcomes:['แยก UI/UX/front-end ได้','วิเคราะห์ user-task-context-friction ได้','เสนอ fix และ test idea จากหลักฐานได้'],
      casePrompt:'ตรวจระบบบริการนักศึกษาที่ดูสวยแต่ผู้ใช้ทำงานหลักไม่สำเร็จ',
      missionRounds:['Identify friction','Classify UI/UX/front-end','Trace task failure','Choose fix','Plan validation'],
      reasonChecks:['หลักฐานใดชี้ว่าปัญหาไม่ได้อยู่ที่ความสวย','front-end feedback ที่ขาดส่งผลต่อ UX อย่างไร','จะพิสูจน์ว่าแนวทางแก้ดีขึ้นได้อย่างไร'],
      artifact:'UX Audit + Project Brief',
      artifactChecklist:['Screenshot/evidence','Target user','User goal','Friction','Impact','Fix hypothesis','Test idea','Project scope'],
      dashboardEvidence:['uxAuditQuality','frontEndClassification','evidenceQuality'],
      seedCases:[{id:'W1-C01',context:'ระบบลงทะเบียน',issue:'ปุ่มยืนยันและสถานะส่งไม่ชัด'},{id:'W1-C02',context:'เว็บห้องสมุด',issue:'ค้นหาได้แต่ไม่รู้สถานะหนังสือ'}],
      ...common
    },
    {
      id:'W2', type:'week', order:2, unlockAfter:'W1',
      title:'Human-Centered Design & User Research', missionTitle:'Evidence Before Design',
      focus:'เข้าใจผู้ใช้ด้วยการวิจัย ไม่ออกแบบจากสมมติฐาน',
      concepts:['HCD','Design Thinking','Interview','Observation','Survey','Ethics','Sampling','Evidence vs assumption','Persona','Empathy map'],
      learningOutcomes:['วางแผนวิจัยผู้ใช้เบื้องต้นได้','สร้าง persona/empathy map จากข้อมูลได้','คำนึงถึงจริยธรรมและความเป็นส่วนตัวได้'],
      casePrompt:'ศึกษาผู้ใช้หลายกลุ่มของระบบจองบริการมหาวิทยาลัยภายใต้เวลาจำกัด',
      missionRounds:['Choose research method','Repair leading question','Classify evidence','Synthesize insight','Build persona'],
      reasonChecks:['ทำไมวิธีวิจัยนี้เหมาะกับคำถาม','คำถามใดมีอคติ','ข้อมูลใดห้ามสรุปเกินหลักฐาน'],
      artifact:'Research Plan + Persona + Empathy Map',
      artifactChecklist:['Research objective','Participants','Method','Ethics/privacy','Interview questions','Evidence notes','Persona','Empathy map'],
      dashboardEvidence:['researchMethodFit','questionQuality','ethicsChecked','personaEvidence'],
      seedCases:[{id:'W2-C01',context:'จองคิวห้องพยาบาล',issue:'ทีมฟังเฉพาะผู้บริหาร'},{id:'W2-C02',context:'ระบบแจ้งซ่อม',issue:'คำถามสัมภาษณ์ชี้นำคำตอบ'}],
      ...common
    },
    {
      id:'W3', type:'week', order:3, unlockAfter:'W2',
      title:'Cognitive UX & Task Flow', missionTitle:'Mind Load Rescue',
      focus:'ใช้จิตวิทยาการรับรู้เพื่อออกแบบ task flow และ low-fi wireframe',
      concepts:['Cognitive load','Recognition vs recall','Attention','Mental model','Affordance','Feedback','Error prevention','Task flow','Low-fi wireframe'],
      learningOutcomes:['วิเคราะห์ cognitive friction ได้','สร้าง task flow ที่ลดภาระผู้ใช้ได้','ออกแบบ low-fi ก่อน–หลังพร้อมเหตุผลได้'],
      casePrompt:'ผู้ใช้กรอกฟอร์มยาวและพบ error หลัง submit โดยไม่รู้ว่าต้องแก้ตรงไหน',
      missionRounds:['Diagnose cognitive load','Map task flow','Find memory burden','Choose prevention','Repair wireframe'],
      reasonChecks:['จุดใดบังคับให้ผู้ใช้จำ','feedback ใดต้องเกิดก่อน submit','wireframe ใหม่ลด cognitive load อย่างไร'],
      artifact:'Cognitive UX Analysis + Task Flow + Before–After Low-fi Wireframe',
      artifactChecklist:['Current task flow','Cognitive issue','Psychology principle','Revised flow','Before wireframe','After wireframe','Design rationale'],
      dashboardEvidence:['cognitiveDiagnosis','flowQuality','beforeAfterReason'],
      seedCases:[{id:'W3-C01',context:'ฟอร์มสมัครสมาชิก',issue:'error รวมหลัง submit'},{id:'W3-C02',context:'ค้นหารายวิชา',issue:'ต้องจำรหัสวิชาเอง'}],
      ...common
    },
    {
      id:'B1', type:'boss', order:4, unlockAfter:'W3', covers:['W1','W2','W3'],
      title:'Foundation Evidence Defense', missionTitle:'Cognitive Storm',
      focus:'ป้องกันแนวคิดโครงการด้วย UX audit, research และ cognitive reasoning',
      bossScenario:'วิเคราะห์ระบบจริงและป้องกันข้อเสนอ redesign ด้วยหลักฐานผู้ใช้และหลักจิตวิทยา',
      missionRounds:['Audit defense','Evidence defense','Cognitive diagnosis','Flow repair','Reflection defense'],
      passCriteria:{minAccuracy:70,minReasonPassPct:70,artifactRequired:true,reflectionRequired:true},
      reasonChecks:['หลักฐานใดรองรับ problem','research insight เปลี่ยน design decision อย่างไร','แนวทางแก้ลด cognitive friction อย่างไร'],
      artifact:'Foundation Defense Pack',
      artifactChecklist:['UX audit','Research evidence','Persona/empathy map','Task flow','Before–after wireframe','Reason defense'],
      dashboardEvidence:['bossGatePassed','evidenceChain','reasonDefenseScore'],
      seedCases:[{id:'B1-C01',context:'student service portal',concepts:['UI/UX','research','cognitive load','task flow']}],
      ...common
    },
    {
      id:'W4', type:'week', order:5, unlockAfter:'B1',
      title:'Define, HMW & Inclusive Design', missionTitle:'Problem Framer',
      focus:'สังเคราะห์ insight เป็นปัญหาที่ออกแบบได้และครอบคลุมผู้ใช้หลากหลาย',
      concepts:['Affinity mapping','Insight','Root cause','Problem statement','How Might We','Inclusive design','Accessibility needs','Bias'],
      learningOutcomes:['สังเคราะห์ข้อมูลเป็น insight ได้','เขียน problem statement/HMW ได้','ระบุ excluded users และความเสี่ยงด้านอคติได้'],
      casePrompt:'ข้อมูลผู้ใช้หลายกลุ่มขัดแย้งกัน ต้องเลือกปัญหาที่ควรแก้และไม่ทิ้งผู้ใช้ชายขอบ',
      missionRounds:['Cluster evidence','Find root cause','Write problem statement','Select HMW','Check inclusion'],
      reasonChecks:['problem นี้มาจากหลักฐานใด','ใครอาจถูกกีดกัน','HMW เปิดทางเลือกมากพอหรือไม่'],
      artifact:'Insight Map + Problem Statement + HMW + Inclusion Check',
      artifactChecklist:['Evidence clusters','Insight','Root cause','Problem statement','HMW','Excluded-user check','Bias note'],
      dashboardEvidence:['insightQuality','problemFrameQuality','inclusionChecked'],
      seedCases:[{id:'W4-C01',context:'ระบบทุนการศึกษา',issue:'ภาษาซับซ้อนและไม่รองรับผู้ใช้บางกลุ่ม'}],
      ...common
    },
    {
      id:'W5', type:'week', order:6, unlockAfter:'W4',
      title:'Ideation, AI-assisted Design & Ethics', missionTitle:'Idea Lab',
      focus:'สร้างและคัดเลือกแนวคิดอย่างมีเหตุผล พร้อมใช้ AI อย่างรับผิดชอบ',
      concepts:['Ideation','Crazy 8s','Concept selection','Feasibility','Desirability','Viability','AI-assisted ideation','Bias','Privacy','Transparency'],
      learningOutcomes:['สร้างทางเลือกหลายแบบได้','คัดเลือกแนวคิดด้วยเกณฑ์ได้','บันทึกบทบาท AI และตรวจความเสี่ยงได้'],
      casePrompt:'ใช้ AI ช่วยเสนอแนวทาง แต่ต้องแยกข้อเสนอของ AI ออกจากการตัดสินใจของทีม',
      missionRounds:['Generate alternatives','Check AI suggestion','Score concepts','Detect bias/risk','Select concept'],
      reasonChecks:['AI ช่วยส่วนใด','ข้อเสนอใดต้องไม่เชื่อโดยอัตโนมัติ','เหตุใดแนวคิดที่เลือกจึงเหมาะกับผู้ใช้'],
      artifact:'Concept Matrix + Storyboard + AI Contribution Record',
      artifactChecklist:['At least 3 concepts','Selection criteria','Concept matrix','Storyboard','AI tool/prompt summary','AI risk check','Human final decision'],
      dashboardEvidence:['conceptDiversity','selectionReason','aiContribution','aiRiskChecked','humanDecision'],
      seedCases:[{id:'W5-C01',context:'AI ideation for student portal',issue:'ข้อเสนอทั่วไปไม่อิง evidence'}],
      ...common
    },
    {
      id:'W6', type:'week', order:7, unlockAfter:'W5',
      title:'Information Architecture & Navigation', missionTitle:'Flow Architect',
      focus:'จัดโครงสร้างข้อมูลและ navigation ให้ตรง mental model',
      concepts:['Information architecture','Content inventory','Card sorting','Sitemap','Navigation','Labeling','Search','Findability'],
      learningOutcomes:['จัดกลุ่มข้อมูลได้','สร้าง sitemap/navigation ได้','ทดสอบ labeling และ findability ได้'],
      casePrompt:'ระบบมีเมนูซ้ำ ชื่อไม่ตรงภาษาผู้ใช้ และค้นหางานหลักไม่พบ',
      missionRounds:['Inventory content','Group content','Choose labels','Build sitemap','Test findability'],
      reasonChecks:['label ใดตรง mental model','เมนูใดควรรวม','จะทดสอบ IA อย่างไร'],
      artifact:'Content Inventory + Sitemap + Navigation Test',
      artifactChecklist:['Content list','Grouping rationale','Sitemap','Navigation labels','Search/filter note','Tree-test plan'],
      dashboardEvidence:['iaQuality','labelingQuality','findabilityPlan'],
      seedCases:[{id:'W6-C01',context:'ระบบยืมอุปกรณ์',issue:'เมนูจอง/ยืม/สถานะซ้ำซ้อน'}],
      ...common
    },
    {
      id:'W7', type:'week', order:8, unlockAfter:'W6',
      title:'User Flow, Wireframe & Responsive Foundations', missionTitle:'Wireframe Rescue',
      focus:'ออกแบบเส้นทางและหน้าจอแบบ mobile-first ที่รองรับ happy/error/alternative paths',
      concepts:['User flow','Happy path','Error path','Alternative path','Low-fi wireframe','Grid','Visual hierarchy','Mobile-first','Responsive planning'],
      learningOutcomes:['สร้าง user flow ครบเส้นทางได้','สร้าง low-fi wireframe ได้','วาง responsive behavior เบื้องต้นได้'],
      casePrompt:'ออกแบบ flow งานหลักให้ทำได้ทั้งมือถือและ desktop โดยไม่สูญเสียลำดับความสำคัญ',
      missionRounds:['Build happy path','Add error path','Rank content','Wireframe mobile','Plan desktop adaptation'],
      reasonChecks:['จุดตัดสินใจใดสำคัญ','mobile-first เปลี่ยนลำดับข้อมูลอย่างไร','error path ช่วย recovery อย่างไร'],
      artifact:'User Flow + Low-fi Responsive Wireframe',
      artifactChecklist:['Happy path','Error/alternative path','5 screens','Mobile wireframe','Desktop adaptation note','CTA hierarchy'],
      dashboardEvidence:['flowCompleteness','wireframeQuality','responsiveChecked'],
      seedCases:[{id:'W7-C01',context:'สมัครกิจกรรม',issue:'มือถือเห็น CTA ช้าและไม่มี error recovery'}],
      ...common
    },
    {
      id:'B2', type:'boss', order:9, unlockAfter:'W7', covers:['W4','W5','W6','W7'],
      title:'Research-to-Wireframe Defense', missionTitle:'Flow Fortress',
      focus:'ป้องกันสายธาร evidence → problem → idea → IA → flow → wireframe',
      bossScenario:'นำเสนอและป้องกันโครงสร้างกับ wireframe ที่พัฒนาจากหลักฐานจริง พร้อม inclusion และ AI record',
      missionRounds:['Evidence chain','Problem defense','IA defense','Flow defense','Responsive wireframe defense'],
      passCriteria:{minReasonPassPct:70,evidenceChainRequired:true,inclusionRequired:true,responsiveRequired:true},
      reasonChecks:['wireframe เชื่อม insight ใด','IA สอดคล้อง mental model อย่างไร','AI มีอิทธิพลต่อแนวคิดอย่างไรและตรวจสอบแล้วหรือไม่'],
      artifact:'Research-to-Wireframe Defense Pack',
      artifactChecklist:['Insight/problem/HMW','Concept decision','AI record','Sitemap','User flow','Responsive low-fi','Inclusion check'],
      dashboardEvidence:['bossGatePassed','evidenceChain','iaDefense','flowDefense','responsiveChecked'],
      seedCases:[{id:'B2-C01',context:'university service system',concepts:['problem','AI ideation','IA','flow','responsive wireframe']}],
      ...common
    },
    {
      id:'W8', type:'week', order:10, unlockAfter:'B2',
      title:'Midterm Studio & Design Critique', missionTitle:'Midterm Checkpoint',
      focus:'รวมงานครึ่งภาค ตรวจความสอดคล้อง และวาง revision backlog',
      concepts:['Design critique','Evidence chain','Peer review','UX blueprint','Prioritization','Revision backlog','Presentation'],
      learningOutcomes:['รวมงานเป็น blueprint ได้','วิจารณ์ด้วยหลักฐานได้','จัดลำดับ revision ได้'],
      casePrompt:'ตรวจความไม่สอดคล้องระหว่าง persona, problem, IA, flow และ wireframe',
      missionRounds:['Check evidence chain','Find mismatch','Give critique','Prioritize revision','Defend blueprint'],
      reasonChecks:['ส่วนใดขาดหลักฐาน','feedback ใดควรแก้ก่อน','การแก้ใดกระทบ user goal มากที่สุด'],
      artifact:'Midterm UX Blueprint + Revision Backlog',
      artifactChecklist:['Evidence chain','Problem','Persona','IA','Flow','Wireframe','Critique notes','Prioritized backlog'],
      dashboardEvidence:['blueprintCompleteness','critiqueQuality','revisionPriority'],
      seedCases:[{id:'W8-C01',context:'midterm blueprint',issue:'persona mobile-first แต่ wireframe desktop-only'}],
      ...common
    },
    {
      id:'W9', type:'week', order:11, unlockAfter:'W8',
      title:'Visual Design, UI Kit & Design Tokens', missionTitle:'Visual System Builder',
      focus:'สร้างภาษาภาพและ foundations ที่สม่ำเสมอ',
      concepts:['Color','Typography','Spacing','Grid','Iconography','Design token','UI kit','Visual hierarchy','Contrast'],
      learningOutcomes:['สร้าง visual system ได้','กำหนด tokens ได้','ตรวจ contrast/readability ได้'],
      casePrompt:'สร้าง visual language จาก low-fi โดยไม่สูญเสีย usability และ accessibility',
      missionRounds:['Define visual tone','Create tokens','Build hierarchy','Check contrast','Apply UI kit'],
      reasonChecks:['token ช่วย consistency อย่างไร','สีใดมีความหมายเชิงสถานะ','visual choice ใดเสี่ยงต่อ accessibility'],
      artifact:'Visual Style Guide + UI Kit Foundations',
      artifactChecklist:['Color tokens','Typography scale','Spacing/grid tokens','Icon rule','Contrast evidence','Core UI elements'],
      dashboardEvidence:['tokenQuality','visualHierarchy','accessibilityChecked'],
      seedCases:[{id:'W9-C01',context:'student app UI kit',issue:'สีและ spacing ไม่เป็นระบบ'}],
      ...common
    },
    {
      id:'W10', type:'week', order:12, unlockAfter:'W9',
      title:'Responsive & Accessible Interface', missionTitle:'Inclusive Responsive Guardian',
      focus:'ออกแบบ mobile, tablet และ desktop ตาม WCAG-oriented practice',
      concepts:['Responsive design','Breakpoints','Flexible layout','Touch target','WCAG','Contrast','Keyboard','Focus','Label','Alt text','Semantic structure'],
      learningOutcomes:['ออกแบบ responsive behavior ได้','ตรวจ accessibility issue ได้','กำหนด focus/keyboard/form accessibility ได้'],
      casePrompt:'ซ่อม interface ที่ใช้ได้บน desktop แต่ล้มเหลวบน mobile และ keyboard',
      missionRounds:['Diagnose responsive issue','Choose breakpoint','Repair touch target','Repair focus/form','Verify accessibility'],
      reasonChecks:['breakpoint นี้มาจาก content หรือ device','keyboard user ทำ task ได้ครบหรือไม่','accessibility fix ช่วยผู้ใช้ทั่วไปอย่างไร'],
      artifact:'Responsive Screens + Accessibility Audit',
      artifactChecklist:['Mobile/tablet/desktop','Breakpoint rationale','Touch targets','Contrast','Keyboard/focus','Labels/alt text','Accessibility findings'],
      dashboardEvidence:['responsiveChecked','accessibilityChecked','breakpointReason','keyboardPath'],
      seedCases:[{id:'W10-C01',context:'registration table',issue:'ล้นจอ ปุ่มเล็ก และ focus ไม่ชัด'}],
      ...common
    },
    {
      id:'W11', type:'week', order:13, unlockAfter:'W10',
      title:'Design System, Components & Front-end Thinking', missionTitle:'System Architect',
      focus:'สร้าง component library ที่เชื่อม Figma กับการพัฒนา front-end',
      concepts:['Design system','Component','Variant','State','Token','Naming','Reusable pattern','HTML semantics','CSS layout thinking','Component specification'],
      learningOutcomes:['สร้าง reusable components ได้','กำหนด naming/variants/states ได้','อธิบาย mapping จาก design สู่ front-end ได้'],
      casePrompt:'รวม UI ที่ซ้ำและไม่สม่ำเสมอให้เป็น component system พร้อม specification',
      missionRounds:['Detect duplication','Define component','Create variants','Map token/state','Write implementation note'],
      reasonChecks:['อะไรควรเป็น component','state ใดห้ามขาด','developer ต้องรู้อะไรจาก design spec'],
      artifact:'Design System + Component Specification',
      artifactChecklist:['Tokens','Buttons/inputs/cards/navigation','Variants','States','Naming','Responsive behavior','Semantic/front-end notes'],
      dashboardEvidence:['componentConsistency','stateCompleteness','frontEndMapping','handoffReady'],
      seedCases:[{id:'W11-C01',context:'multi-page portal',issue:'ปุ่ม 8 แบบและ error state ไม่ตรงกัน'}],
      ...common
    },
    {
      id:'B3', type:'boss', order:14, unlockAfter:'W11', covers:['W9','W10','W11'],
      title:'Interface System Defense', missionTitle:'Design System Siege',
      focus:'ป้องกัน visual, responsive, accessibility และ component system',
      bossScenario:'ตรวจและซ่อม interface system ที่ไม่สม่ำเสมอ ไม่ responsive และไม่ accessible พร้อมส่งต่อ front-end',
      missionRounds:['Visual audit','Responsive repair','Accessibility repair','Component defense','Front-end handoff defense'],
      passCriteria:{minReasonPassPct:70,responsiveRequired:true,accessibilityRequired:true,handoffRequired:true},
      reasonChecks:['system นี้ลด cognitive burden อย่างไร','accessibility issue ใดกระทบ task หลัก','spec ใดช่วยลดความคลาดเคลื่อนตอนพัฒนา'],
      artifact:'Interface System Defense Pack',
      artifactChecklist:['Visual system','Responsive evidence','Accessibility audit','Component library','Front-end mapping','Defense rationale'],
      dashboardEvidence:['bossGatePassed','systemConsistency','responsiveChecked','accessibilityChecked','handoffReady'],
      seedCases:[{id:'B3-C01',context:'responsive service portal',concepts:['tokens','a11y','components','front-end handoff']}],
      ...common
    },
    {
      id:'W12', type:'week', order:15, unlockAfter:'B3',
      title:'Interaction Design, Micro-interactions & Content', missionTitle:'Interaction Signal',
      focus:'ออกแบบ behavior, states, feedback และ microcopy ตลอด interaction',
      concepts:['Interaction design','Micro-interaction','Trigger','Rule','Feedback','Loop','Loading','Empty','Error','Success','Confirmation','Microcopy'],
      learningOutcomes:['ออกแบบ interaction states ได้','ใช้ microcopy ลดความกังวลได้','ออกแบบ recovery และ prevention ได้'],
      casePrompt:'ผู้ใช้กดส่งซ้ำเพราะไม่มี loading, disabled, confirmation หรือ recovery state',
      missionRounds:['Map trigger/rule','Design feedback','Prevent duplicate action','Write microcopy','Design recovery'],
      reasonChecks:['feedback ต้องเกิดเมื่อใด','animation ใดมีประโยชน์หรือรบกวน','error message ช่วย recovery อย่างไร'],
      artifact:'Interaction Specification + State Matrix',
      artifactChecklist:['Trigger/rule/feedback','Loading/empty/error/success','Keyboard/focus behavior','Microcopy','Motion note','Recovery path'],
      dashboardEvidence:['interactionQuality','stateCompleteness','microcopyReason','accessibilityChecked'],
      seedCases:[{id:'W12-C01',context:'submit request',issue:'ไม่มี loading และกดซ้ำได้'}],
      ...common
    },
    {
      id:'W13', type:'week', order:16, unlockAfter:'W12',
      title:'High-fidelity Prototype & Developer Handoff', missionTitle:'Prototype Builder',
      focus:'สร้าง prototype ที่ทดสอบได้และเตรียมส่งต่อพัฒนา',
      concepts:['High-fidelity prototype','Interactive flow','Figma prototype','Variables/variants','Prototype limitation','Design specification','Asset export','Developer handoff'],
      learningOutcomes:['สร้าง prototype ครบ task ได้','ตรวจ states/links/error paths ได้','จัดทำ handoff package ได้'],
      casePrompt:'แปลงระบบออกแบบเป็น prototype ที่ใช้งานทดสอบได้พร้อม specification',
      missionRounds:['Build testable task','Repair missing link','Verify states','Document behavior','Prepare handoff'],
      reasonChecks:['prototype ทดสอบอะไรได้จริง','ส่วนใดเป็นเพียงภาพจำลอง','developer ต้องใช้ข้อมูลใด'],
      artifact:'Clickable Hi-fi Prototype + Handoff Package',
      artifactChecklist:['Main task','Error/alternative path','States','Responsive prototype','Component references','Measurements/tokens','Assets','Developer notes'],
      dashboardEvidence:['prototypeCompleteness','flowTestable','handoffReady','frontEndMapping'],
      seedCases:[{id:'W13-C01',context:'booking prototype',issue:'confirm link และ error recovery ขาด'}],
      ...common
    },
    {
      id:'W14', type:'week', order:17, unlockAfter:'W13',
      title:'Heuristic Evaluation, Usability Testing & Iteration', missionTitle:'Evidence Lab',
      focus:'ประเมินด้วยหลายวิธี วัดผล และปรับปรุงจากหลักฐาน',
      concepts:['Heuristic evaluation','Cognitive walkthrough','Usability testing','Task success','Time on task','Error rate','SUS','Severity','Think-aloud','Iteration','Retest'],
      learningOutcomes:['เลือกวิธีประเมินได้','เก็บและตีความ usability metrics ได้','จัดลำดับ fix และ retest ได้'],
      casePrompt:'เปรียบเทียบ heuristic findings กับผลทดสอบผู้ใช้และเลือกสิ่งที่ต้องแก้ก่อน',
      missionRounds:['Choose method','Read evidence','Calculate/interpret metrics','Rank severity','Plan iteration/retest'],
      reasonChecks:['method ใดตอบคำถามนี้','finding ใดเป็น evidence จากผู้ใช้','ผลดีขึ้นวัดจากอะไร'],
      artifact:'Evaluation Report + Iteration Log',
      artifactChecklist:['Method','Participants/tasks','Metrics','Findings','Severity','Before/after','Fix rationale','Retest plan','Limitations'],
      dashboardEvidence:['evaluationMethod','metricInterpretation','severityDecision','evidenceBasedFix'],
      seedCases:[{id:'W14-C01',context:'usability test',issue:'3/5 คนหา submit ไม่พบและ task time สูง'}],
      ...common
    },
    {
      id:'B4', type:'boss', order:18, unlockAfter:'W14', covers:['W12','W13','W14'],
      title:'Prototype Validation & Handoff Defense', missionTitle:'Validation Defense',
      focus:'ป้องกัน interaction, prototype, evaluation, iteration และ handoff',
      bossScenario:'ใช้หลักฐานทดสอบตัดสินใจแก้ prototype และยืนยันความพร้อมก่อนส่งมอบ',
      missionRounds:['Interaction defense','Prototype audit','Evidence defense','Iteration defense','Handoff readiness'],
      passCriteria:{minReasonPassPct:70,evidenceFixRequired:true,beforeAfterRequired:true,handoffRequired:true},
      reasonChecks:['fix เชื่อม evidence ใด','before/after ดีขึ้นจาก metric ใด','สิ่งใดยังเป็นข้อจำกัดก่อนพัฒนา'],
      artifact:'Prototype Validation & Handoff Defense Pack',
      artifactChecklist:['Interaction spec','Prototype','Evaluation evidence','Metrics','Before/after','Retest','Handoff checklist','Limitations'],
      dashboardEvidence:['bossGatePassed','evidenceBasedFix','beforeAfterReason','handoffReady'],
      seedCases:[{id:'B4-C01',context:'validated service prototype',concepts:['interaction','prototype','metrics','iteration','handoff']}],
      ...common
    },
    {
      id:'W15', type:'week', order:19, unlockAfter:'B4',
      title:'Final UX/UI Case Study & Professional Portfolio', missionTitle:'Portfolio Finalizer',
      focus:'สื่อสารกระบวนการ ผลลัพธ์ จริยธรรม และการเตรียมพัฒนาจริง',
      concepts:['UX case study','Portfolio storytelling','Evidence-decision-design-test','Outcome','Limitations','AI contribution record','Professional presentation','Front-end readiness'],
      learningOutcomes:['จัดทำ case study ครบกระบวนการได้','นำเสนอผลลัพธ์และข้อจำกัดได้','อธิบาย AI contribution และ human accountability ได้'],
      casePrompt:'ปรับ portfolio ที่มีเพียงภาพสวยให้เป็นกรณีศึกษาที่พิสูจน์กระบวนการและผลลัพธ์',
      missionRounds:['Build narrative','Check evidence','Show iteration','Disclose AI contribution','Defend professional readiness'],
      reasonChecks:['case study ต้องพิสูจน์อะไร','ผลลัพธ์ใดวัดได้','AI ช่วยอะไรและมนุษย์ตรวจสอบอะไร'],
      artifact:'Final UX/UI Case Study Portfolio + Presentation',
      artifactChecklist:['Problem/context','Target users','Research evidence','Problem/HMW','IA/flow','Wireframe','Visual/design system','Responsive/accessibility','Interaction/prototype','Evaluation metrics','Iteration','Handoff','AI contribution record','Limitations','Final reflection'],
      dashboardEvidence:['portfolioCompleteness','evidenceCoverage','aiContribution','humanDecision','presentationReadiness'],
      seedCases:[{id:'W15-C01',context:'portfolio review',issue:'มี final UI แต่ขาด evidence, metrics และ AI disclosure'}],
      ...common
    }
  ];

  const progression = nodes.map((node) => ({
    id:node.id, type:node.type, order:node.order, unlockAfter:node.unlockAfter,
    title:node.title, missionTitle:node.missionTitle, focus:node.focus, artifact:node.artifact
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
    courseId:COURSE_ID,
    version:VERSION,
    scope:'W1-W15 + B1-B4; no B5',
    courseAlignment:COURSE_ALIGNMENT,
    dashboardFields:DASHBOARD_FIELDS,
    antiGuessingRules:ANTI_GUESSING_RULES,
    rubric:RUBRIC,
    nodes,
    progression,
    byId,
    nextAfter,
    requiredEvidence,
    sampleCase
  };

  window.dispatchEvent(new CustomEvent('csai2601:uxq-content-ready', {
    detail:{courseId:COURSE_ID,version:VERSION,nodeCount:nodes.length}
  }));
})();