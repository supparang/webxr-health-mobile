/* CSAI2601 UX Quest • Course Alignment Bridge v2.1
 * Canonical Studio owner for W1-W15 + B1-B4.
 *
 * The immutable snapshot is used only to BUILD canonical Studio evidence.
 * Runtime/question enrichment must use the LIVE canonical nodes because legacy
 * item-bank and field-aware layers extend seedCases/missionRounds in place.
 *
 * Progress, score, correctness, unlock order, identity and Sheet writes are not changed.
 */
(() => {
  'use strict';

  const VERSION = '20260814-COURSE-ALIGNMENT-BRIDGE-V2.1-LIVE-RUNTIME';
  const LIVE = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const SNAP = window.CSAI2601_UXQ_CANONICAL_SNAPSHOT_V1;
  if (!LIVE || !Array.isArray(LIVE.nodes)) return;

  // Snapshot is authoritative for the Studio schema only. Never expose frozen
  // snapshot nodes to runtime enrichers that intentionally mutate node fields.
  const STUDIO_SOURCE_NODES = Array.isArray(SNAP?.nodes) ? SNAP.nodes : LIVE.nodes;
  const RUNTIME_NODES = LIVE.nodes;
  const clone = value => JSON.parse(JSON.stringify(value));
  const textField = (key, label, placeholder, rows=4, minLength=35) => ({
    key, label, required:true, minLength, placeholder:placeholder || '', format:'text', rows
  });
  const urlField = (key, label, placeholder) => ({
    key, label, required:true, minLength:0, placeholder, format:'url', rows:2
  });

  const REFLECTIONS = Object.freeze({
    W1:'หลักฐานใดทำให้คุณแยกได้ว่าปัญหานี้เป็น UI, UX หรือ front-end feedback และจะทดสอบ Fix กับ user task อย่างไร?',
    W2:'ข้อมูลใดเป็น evidence จริง ข้อมูลใดยังเป็น assumption และข้อจำกัดด้าน ethics/privacy ใดต้องคำนึงก่อนสรุป Persona?',
    W3:'จุดใดเพิ่ม cognitive load หรือบังคับ recall และ Revised flow/wireframe ลดภาระนั้นด้วยหลัก psychology ใด?',
    B1:'เมื่อรวม W1-W3 หลักฐานใดเชื่อม UX audit → research → cognitive reasoning → flow repair ได้แข็งแรงที่สุด และช่องว่างใดยังต้องพิสูจน์?',
    W4:'Evidence cluster ใดนำไปสู่ root cause/problem statement นี้ ใครอาจถูกกีดกัน และ HMW เปิดทางเลือกโดยไม่ล็อก solution เร็วเกินไปหรือไม่?',
    W5:'คุณสร้างทางเลือกหลายแบบและคัดเลือก concept ด้วย desirability/feasibility/viability อย่างไร AI ช่วยอะไร และมนุษย์ตรวจ bias/privacy/transparency ตรงไหน?',
    W6:'การจัดกลุ่ม content, label, sitemap และ navigation นี้ตรงกับ mental model อย่างไร และจะทดสอบ findability ของผู้ใช้จริงอย่างไร?',
    W7:'Happy/error/alternative path เชื่อมกับ mobile-first wireframe อย่างไร และ desktop adaptation ใดต้องเปลี่ยนเพราะ content—not device name?',
    B2:'เมื่อรวม W4-W7 สาย Evidence → Problem → Idea → IA → Flow → Responsive Wireframe เชื่อมกันตรงไหน และจุดใดยังเป็น assumption?',
    W8:'Evidence chain จุดใดไม่สอดคล้องกัน Critique ใดควรแก้ก่อนเพราะกระทบ user/task outcome และ revision backlog จะพิสูจน์ผลอย่างไร?',
    W9:'Color/type/spacing/grid/token decision ใดสร้าง visual hierarchy ที่ชัดโดยไม่ลด readability/contrast และหลักฐานใดรองรับ?',
    W10:'Responsive/accessibility issue ใดทำให้ task ล้มเหลว และ breakpoint, touch target, focus, label, keyboard/semantic fix ใดแก้ได้ตรงจุด?',
    W11:'UI ที่ซ้ำควรถูกยกระดับเป็น component/variant/state อย่างไร และ specification ใดทำให้ Figma → front-end implementation ไม่คลาดเคลื่อน?',
    B3:'เมื่อรวม W9-W11 systemic issue ใดควรแก้ก่อนเพื่อเพิ่ม visual consistency, responsive accessibility, component quality และ handoff readiness?',
    W12:'Trigger/rule, feedback, prevention, microcopy หรือ recovery จุดใดลดความไม่แน่ใจ/ความผิดพลาดของผู้ใช้ได้มากที่สุด และเพราะอะไร?',
    W13:'Prototype ส่วนใดทดสอบ task ได้จริง ส่วนใดยังเป็น mockup และ handoff package ต้องเพิ่มอะไรให้ developer นำไปพัฒนาต่อได้?',
    W14:'วิธีประเมินและ metric ใดตอบคำถามนี้ Finding ใดมี severity สูง และ before/after + retest ใดพิสูจน์ว่า iteration ดีขึ้นจริง?',
    B4:'เมื่อรวม W12-W14 fix ใดเชื่อม Interaction → Prototype → Evidence/Metrics → Iteration → Handoff ได้แข็งแรงที่สุด และข้อจำกัดใดยังต้องระบุ?',
    W15:'Case study แสดง Evidence → Decision → Design → Test → Iteration → Outcome/Limitations อย่างไร AI contribution คืออะไร และ human accountability อยู่ตรงไหน?'
  });

  function checklistGroups(checklist, maxGroups=4) {
    const list = Array.isArray(checklist) ? checklist.filter(Boolean).map(String) : [];
    if (!list.length) return [['Evidence / Artifact']];
    const groups = Array.from({length:Math.min(maxGroups, list.length)}, () => []);
    list.forEach((label, index) => groups[index % groups.length].push(label));
    return groups.filter(group => group.length);
  }

  function canonicalStudioItem(node) {
    const checklist = Array.isArray(node.artifactChecklist) ? node.artifactChecklist.slice() : [];
    const groups = checklistGroups(checklist, 4);
    const taskFields = groups.map((group, index) => textField(
      `artifactEvidence${index + 1}`,
      group.join(' • '),
      `อธิบาย/ชี้หลักฐานตาม Canonical checklist: ${group.join(' • ')}`,
      4,
      35
    ));
    const reflectionPrompt = REFLECTIONS[node.id] ||
      `จาก ${node.title} หลักฐานใดรองรับการตัดสินใจของคุณ สิ่งใดยังเป็น assumption และจะตรวจสอบต่ออย่างไร?`;

    const fields = [
      textField('projectId','Project ID เดิม','ใช้ Project ID เดียวตั้งแต่ W1-W15',2,4),
      urlField('figmaUrl','Figma URL','https://www.figma.com/...'),
      urlField('projectUrl','Project URL','ลิงก์ผลงาน/ต้นแบบ/เว็บไซต์ของโครงการ'),
      urlField('evidenceUrl','Evidence URL','ลิงก์หลักฐาน เช่น Drive, รูป, รายงาน หรือผลทดสอบ'),
      ...taskFields,
      textField('reflection', node.type === 'boss' ? `Boss Reflection ${node.id}` : `Weekly Reflection ${node.id}`, reflectionPrompt,4,40)
    ];

    return {
      id:node.id,
      phase:node.type === 'boss' ? 'Boss Defense' : 'Studio',
      canonicalArtifact:node.artifact,
      studioTitle:`${node.id} • ${node.title}`,
      objective:node.focus,
      suggestedMinutes:node.type === 'boss' ? 55 : 75,
      practiceFlow:Array.isArray(node.missionRounds) ? node.missionRounds.slice() : [],
      fields,
      reflectionPrompt,
      selfChecks:checklist,
      evidenceMap:{
        canonicalChecklist:checklist,
        artifactFields:taskFields.map(field => field.key),
        learnedPoint:'reflection'
      },
      dashboardFields:Array.from(new Set(fields.map(field => field.key).concat(node.dashboardEvidence || []))),
      courseAlignmentVersion:SNAP?.version || LIVE.version,
      completionRule:node.completionRule,
      aiRule:node.aiRule,
      sourceOfTruth:node.sourceOfTruth,
      sourceAlignment:'canonical artifactChecklist → Studio evidence → Reflection'
    };
  }

  const items = STUDIO_SOURCE_NODES.map(node => canonicalStudioItem(clone(node)));
  const byId = id => items.find(item => item.id === String(id || '').trim().toUpperCase()) || null;

  window.CSAI2601_UXQ_STUDIO_PRACTICE_V1 = Object.freeze({
    version:VERSION,
    canonicalContentVersion:SNAP?.version || LIVE.version,
    phase:'ALL19-CANONICAL-STUDIO',
    policy:Object.freeze({
      officialProgressSource:'Google Sheet',
      projectContinuity:true,
      missionRequired:true,
      artifactRequired:true,
      reflectionRequired:true,
      requiredUrls:['figmaUrl','projectUrl','evidenceUrl']
    }),
    items:Object.freeze(items),
    byId
  });

  // IMPORTANT: runtime node content must reference LIVE mutable nodes. The outer
  // API can be frozen safely; its node objects must remain extensible until all
  // item-bank/field-aware enrichment layers have finished loading.
  window.CSAI2601_UXQ_NODE_CONTENT = Object.freeze({
    version:VERSION,
    nodes:RUNTIME_NODES,
    byId:id => RUNTIME_NODES.find(node => String(node.id || '').toUpperCase() === String(id || '').toUpperCase()) || null,
    courseAlignment:LIVE.courseAlignment,
    source:'LIVE_CANONICAL_RUNTIME'
  });

  document.documentElement.dataset.uxqCourseAlignment = VERSION;
  window.dispatchEvent(new CustomEvent('csai2601:course-alignment-ready', {
    detail:{version:VERSION, canonicalContentVersion:SNAP?.version || LIVE.version, nodeCount:items.length}
  }));
})();