/* CSAI2601 UX Quest • Studio Practice Canonical Pack v1
 * Phase 1: W1-W3 + B1
 * Curriculum source: uxq-csai2601-canonical-content-v1.js
 * This pack adds structured studio practice without changing official unlock rules.
 */
(() => {
  'use strict';

  const VERSION = '20260721-STUDIO-PRACTICE-PHASE1-V1';
  const POLICY = Object.freeze({
    officialProgressSource: 'Google Sheet mission_completed contiguous path',
    unlockChangedByThisPack: false,
    teacherReviewRequiredForNextNode: false,
    note: 'Studio submission is learning evidence. Official unlock remains controlled by the existing Sheet-authoritative mission flow until a later migration is explicitly approved.'
  });

  const COMMON_RUBRIC = Object.freeze([
    { key:'evidence', label:'Evidence', weight:25, description:'อิงหลักฐานผู้ใช้หรือพฤติกรรมที่ตรวจสอบได้' },
    { key:'reasoning', label:'UX Reasoning', weight:25, description:'เชื่อมหลัก UX/UI กับการตัดสินใจได้ชัดเจน' },
    { key:'artifactQuality', label:'Artifact Quality', weight:25, description:'ผลงานครบตามโจทย์และสื่อสารได้' },
    { key:'validation', label:'Validation', weight:15, description:'มีวิธีตรวจสอบหรือทดสอบผลที่เหมาะสม' },
    { key:'reflection', label:'Reflection & Revision', weight:10, description:'สะท้อนสิ่งที่เรียนรู้และระบุจุดที่จะปรับ' }
  ]);

  const items = [
    {
      id:'W1',
      phase:'Foundation Studio',
      canonicalArtifact:'UX First Impression Audit',
      studioTitle:'UX First Impression Audit • ตรวจเว็บ/ระบบเดิมจากมุมผู้ใช้',
      objective:'แยก UI, UX และ front-end feedback พร้อมระบุ user goal, friction, impact, fix และ test idea จากหลักฐาน ไม่ใช่ความชอบส่วนตัว',
      suggestedMinutes:55,
      practiceFlow:[
        'เลือกเว็บหรือระบบจริง 1 ระบบที่ใช้ต่อเนื่องเป็นโครงการประจำรายวิชา',
        'จับภาพหน้าจอหรือระบุหน้าที่ผู้ใช้พบปัญหา',
        'กำหนดผู้ใช้หลัก งานที่ต้องทำ และบริบทการใช้งาน',
        'วิเคราะห์ friction และผลกระทบต่อ task outcome',
        'เสนอแนวทางแก้เบื้องต้นและวิธีทดสอบ'
      ],
      fields:[
        { key:'projectId', label:'Project ID / ชื่อโครงการ', required:true, minLength:4, rows:2, placeholder:'เช่น UXQ-201-6500123-StudentService' },
        { key:'figmaUrl', label:'Figma Board / Evidence Board URL', required:true, format:'url', rows:2, placeholder:'https://www.figma.com/...' },
        { key:'targetUserTaskContext', label:'ผู้ใช้หลัก + Task + Context', required:true, minLength:40, rows:4, placeholder:'ผู้ใช้คือใคร กำลังทำงานอะไร ใช้อุปกรณ์/สถานการณ์ใด' },
        { key:'frictionEvidence', label:'Friction และหลักฐานที่พบ', required:true, minLength:50, rows:4, placeholder:'ระบุสิ่งที่ผู้ใช้ติดขัด พร้อม screenshot, observation หรือพฤติกรรมที่รองรับ' },
        { key:'impactAnalysis', label:'ผลกระทบต่อผู้ใช้และ Task', required:true, minLength:40, rows:4, placeholder:'ผู้ใช้ล้มเหลว ช้า สับสน หรือเกิด error ตรงไหน' },
        { key:'initialFix', label:'แนวทางแก้เบื้องต้น', required:true, minLength:40, rows:4, placeholder:'เสนอการแก้ที่สัมพันธ์กับ friction ไม่ใช่เพียงเปลี่ยนสีหรือความสวย' },
        { key:'testIdea', label:'วิธีทดสอบว่า UX ดีขึ้น', required:true, minLength:40, rows:4, placeholder:'ระบุ task success, time, error หรือความเข้าใจ next step' },
        { key:'reflection', label:'Reflection หลังทำ W1', required:true, minLength:30, rows:3, placeholder:'สิ่งที่เคยคิดว่าเป็น UI แต่พบว่าเกี่ยวกับ UX/feedback อย่างไร' }
      ],
      selfChecks:[
        'ฉันระบุ User Goal และ Task ชัดเจน',
        'ฉันมีหลักฐาน ไม่ได้ใช้ความรู้สึกส่วนตัวเพียงอย่างเดียว',
        'ฉันแยก UI, UX และ front-end feedback ได้',
        'แนวทางแก้สัมพันธ์กับ friction ที่พบ',
        'วิธีทดสอบวัดพฤติกรรมหรือผลลัพธ์ของ task'
      ],
      evidenceMap:{ problemSeen:'frictionEvidence', uxReason:'impactAnalysis', fixAndTest:['initialFix','testIdea'], learnedPoint:'reflection' },
      dashboardFields:['projectId','figmaUrl','targetUserTaskContext','frictionEvidence','impactAnalysis','initialFix','testIdea','reflection'],
      rubric:COMMON_RUBRIC
    },
    {
      id:'W2',
      phase:'Foundation Studio',
      canonicalArtifact:'UX Process Map / HCD Sprint Brief',
      studioTitle:'HCD Sprint Brief • วางกระบวนการก่อนเริ่มออกแบบ',
      objective:'กำหนดปัญหาเริ่มต้น กลุ่มผู้ใช้ หลักฐานที่มี สมมติฐานที่ต้องตรวจ และเส้นทาง HCD โดยยังไม่กระโดดไปทำ Persona, HMW หรือหน้าจอจริง',
      suggestedMinutes:55,
      practiceFlow:[
        'ใช้ Project ID เดียวกับ W1',
        'สรุป initial problem จาก UX Audit โดยไม่รีบล็อก solution',
        'แยกสิ่งที่รู้จากหลักฐานออกจาก assumption',
        'ระบุกลุ่มผู้ใช้และวิธีเก็บข้อมูลที่เหมาะสม',
        'จัดทำ HCD process map และผลลัพธ์ที่ต้องการจาก sprint'
      ],
      fields:[
        { key:'projectId', label:'Project ID เดิมจาก W1', required:true, minLength:4, rows:2, placeholder:'ใช้ Project ID เดียวกับ W1' },
        { key:'figmaUrl', label:'Figma Board URL', required:true, format:'url', rows:2, placeholder:'https://www.figma.com/...' },
        { key:'initialProblem', label:'Initial Problem จาก W1', required:true, minLength:50, rows:4, placeholder:'อธิบายปัญหาโดยยังไม่กำหนด solution ตายตัว' },
        { key:'userGroups', label:'กลุ่มผู้ใช้ที่เกี่ยวข้อง', required:true, minLength:30, rows:3, placeholder:'ผู้ใช้หลัก ผู้ใช้รอง และผู้มีส่วนเกี่ยวข้อง' },
        { key:'evidenceVsAssumption', label:'Evidence vs Assumption', required:true, minLength:60, rows:5, placeholder:'แยกอย่างน้อย 2 หลักฐาน และ 2 สมมติฐานที่ต้องตรวจสอบ' },
        { key:'dataCollectionPlan', label:'วิธีเก็บข้อมูลและเหตุผล', required:true, minLength:50, rows:4, placeholder:'จะสัมภาษณ์ สังเกต หรือวิเคราะห์อะไร จากใคร เพราะเหตุใด' },
        { key:'hcdProcessMap', label:'HCD / Design Thinking Process Map', required:true, minLength:50, rows:4, placeholder:'Empathize → Define → Ideate → Prototype → Test พร้อมผลลัพธ์แต่ละช่วง' },
        { key:'reflection', label:'Reflection หลังทำ W2', required:true, minLength:30, rows:3, placeholder:'สมมติฐานใดเสี่ยงที่สุด และจะตรวจสอบอย่างไร' }
      ],
      selfChecks:[
        'หัวข้อโครงการแคบพอที่จะทำต่อจน W15',
        'ฉันยังไม่สร้าง Persona/HMW แทนหลักฐานที่ยังไม่มี',
        'ฉันแยก Evidence กับ Assumption อย่างชัดเจน',
        'แผนเก็บข้อมูลตรงกับคำถามที่ต้องการรู้',
        'Process Map เชื่อม user → evidence → decision → proof'
      ],
      evidenceMap:{ problemSeen:'initialProblem', uxReason:'evidenceVsAssumption', fixAndTest:['dataCollectionPlan','hcdProcessMap'], learnedPoint:'reflection' },
      dashboardFields:['projectId','figmaUrl','initialProblem','userGroups','evidenceVsAssumption','dataCollectionPlan','hcdProcessMap','reflection'],
      rubric:COMMON_RUBRIC
    },
    {
      id:'W3',
      phase:'Foundation Studio',
      canonicalArtifact:'Cognitive Load Repair Note',
      studioTitle:'Cognitive Load Repair Note + Before–After Redesign',
      objective:'วิเคราะห์หน้าจอเดิมด้วย cognitive load, attention, recognition vs recall, feedback, mental model และ error prevention แล้วสร้าง Before–After ที่แก้สาเหตุ ไม่ใช่เพียงทำให้สวยขึ้น',
      suggestedMinutes:70,
      practiceFlow:[
        'เลือกหน้าจอจากโครงการเดิมที่มี friction ชัดเจน',
        'ระบุชนิดของ cognitive/interaction problem',
        'จับคู่ปัญหากับหลักจิตวิทยาที่เกี่ยวข้อง',
        'สร้าง Before–After Redesign ใน Figma',
        'อธิบายเหตุผลและวิธีตรวจว่าแบบใหม่ลดภาระผู้ใช้'
      ],
      fields:[
        { key:'projectId', label:'Project ID เดิม', required:true, minLength:4, rows:2, placeholder:'ใช้ Project ID เดียวกับ W1–W2' },
        { key:'figmaUrl', label:'Figma Before–After URL', required:true, format:'url', rows:2, placeholder:'https://www.figma.com/...' },
        { key:'confusingPoint', label:'จุดที่ผู้ใช้สับสน/ต้องจำ/ขาด feedback', required:true, minLength:50, rows:4, placeholder:'ระบุจุดเกิดปัญหาและพฤติกรรมที่สังเกตได้' },
        { key:'psychologyDiagnosis', label:'การวินิจฉัยด้วยหลักจิตวิทยา', required:true, minLength:60, rows:5, placeholder:'Cognitive load, attention, recognition vs recall, affordance, feedback, mental model หรือ error prevention' },
        { key:'beforeAfterDecision', label:'สิ่งที่เปลี่ยนจาก Before → After', required:true, minLength:60, rows:5, placeholder:'ระบุการจัดลำดับ ลดสิ่งรบกวน เพิ่ม feedback หรือป้องกัน error' },
        { key:'whyItHelps', label:'เหตุผลว่าแบบใหม่ช่วยผู้ใช้อย่างไร', required:true, minLength:50, rows:4, placeholder:'เชื่อมการเปลี่ยนแปลงกับ task outcome และหลัก psychology' },
        { key:'validationPlan', label:'แผนตรวจสอบ Before–After', required:true, minLength:40, rows:4, placeholder:'เช่น 5-second test, task success, error, time หรือการอธิบาย next step' },
        { key:'reflection', label:'Reflection หลังทำ W3', required:true, minLength:30, rows:3, placeholder:'ส่วนใดของงานยังเป็นสมมติฐานและควรทดสอบต่อ' }
      ],
      selfChecks:[
        'Before–After แก้ปัญหาการใช้งาน ไม่ใช่เพียงเปลี่ยนสไตล์',
        'ฉันระบุหลักจิตวิทยาที่เกี่ยวข้องได้ถูกต้อง',
        'ฉันลดการจำและเพิ่ม recognition/feedback เมื่อจำเป็น',
        'ฉันไม่เพิ่มข้อความจำนวนมากจน cognitive load สูงขึ้น',
        'ฉันมีวิธีทดสอบ Before–After'
      ],
      evidenceMap:{ problemSeen:'confusingPoint', uxReason:['psychologyDiagnosis','whyItHelps'], fixAndTest:['beforeAfterDecision','validationPlan'], learnedPoint:'reflection' },
      dashboardFields:['projectId','figmaUrl','confusingPoint','psychologyDiagnosis','beforeAfterDecision','whyItHelps','validationPlan','reflection'],
      rubric:COMMON_RUBRIC
    },
    {
      id:'B1',
      phase:'Foundation Defense',
      canonicalArtifact:'Foundation UX Defense Sheet',
      studioTitle:'Foundation UX Defense • ปกป้องการตัดสินใจจาก W1–W3',
      objective:'สังเคราะห์ UI/UX, HCD และ Psychology เพื่อแสดงสายหลักฐานจากปัญหา → หลักฐาน → การวินิจฉัย → แนวทางแก้ → วิธีทดสอบ',
      suggestedMinutes:45,
      practiceFlow:[
        'เลือก friction สำคัญที่สุดจาก W1',
        'ระบุหลักฐานและ assumption ที่ต้องแยกจาก W2',
        'อธิบาย psychology diagnosis จาก W3',
        'ปกป้อง Before–After decision ด้วยเหตุผล',
        'ระบุ revision priority และการทดสอบรอบถัดไป'
      ],
      fields:[
        { key:'projectId', label:'Project ID เดิม', required:true, minLength:4, rows:2, placeholder:'ใช้ Project ID เดียวกับ W1–W3' },
        { key:'figmaUrl', label:'Foundation Defense Board URL', required:true, format:'url', rows:2, placeholder:'https://www.figma.com/...' },
        { key:'evidenceChain', label:'Evidence Chain: User → Task → Friction → Impact', required:true, minLength:70, rows:5, placeholder:'สรุปสายหลักฐานโดยไม่ข้ามไปที่ solution' },
        { key:'hcdDefense', label:'HCD Defense: Evidence vs Assumption', required:true, minLength:60, rows:5, placeholder:'สิ่งที่รู้จริง สิ่งที่ยังไม่รู้ และวิธีตรวจสอบ' },
        { key:'psychologyDefense', label:'Psychology Defense', required:true, minLength:60, rows:5, placeholder:'อธิบาย cognitive load, attention, feedback หรือ mental model ที่เกี่ยวข้อง' },
        { key:'repairDefense', label:'เหตุผลปกป้องแนวทางแก้', required:true, minLength:60, rows:5, placeholder:'ทำไมแนวทางแก้สัมพันธ์กับ friction และหลักฐาน' },
        { key:'testAndRevision', label:'Test + Revision Priority', required:true, minLength:50, rows:4, placeholder:'จะทดสอบอะไร แก้อะไรก่อน และเพราะเหตุใด' },
        { key:'reflection', label:'Foundation Reflection', required:true, minLength:40, rows:4, placeholder:'สิ่งที่เปลี่ยนไปจากความคิดเริ่มต้น และสิ่งที่ต้องเก็บข้อมูลเพิ่ม' }
      ],
      selfChecks:[
        'ฉันเชื่อม W1–W3 เป็นสายเหตุผลเดียวกัน',
        'ฉันไม่ใช้ภาพสวยแทนหลักฐาน',
        'แนวทางแก้สัมพันธ์กับ user goal และ friction',
        'ฉันแยกสิ่งที่รู้จริงออกจาก assumption',
        'ฉันกำหนด test/revision priority ได้'
      ],
      evidenceMap:{ problemSeen:'evidenceChain', uxReason:['hcdDefense','psychologyDefense'], fixAndTest:['repairDefense','testAndRevision'], learnedPoint:'reflection' },
      dashboardFields:['projectId','figmaUrl','evidenceChain','hcdDefense','psychologyDefense','repairDefense','testAndRevision','reflection'],
      rubric:COMMON_RUBRIC
    }
  ];

  function byId(id) {
    return items.find(item => item.id === String(id || '').trim().toUpperCase()) || null;
  }

  window.CSAI2601_UXQ_STUDIO_PRACTICE_V1 = Object.freeze({
    version:VERSION,
    phase:'W1-W3+B1',
    policy:POLICY,
    items:Object.freeze(items),
    byId
  });
})();
