/* CSAI2601 UX Quest • Course Alignment Bridge v1
 * Makes Mission, Studio, Reflection and evidence requirements consume the
 * v20260728 canonical W1-W15 + B1-B4 curriculum as one source of truth.
 */
(() => {
  'use strict';

  const VERSION = 'v20260728-course-alignment-bridge-v1';
  const CONTENT = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!CONTENT || !Array.isArray(CONTENT.nodes)) return;

  const REQUIRED_URL_FIELDS = Object.freeze([
    { key:'figmaUrl', label:'Figma URL', required:true, format:'url', minLength:0, rows:2, placeholder:'https://www.figma.com/...' },
    { key:'projectUrl', label:'Project URL', required:true, format:'url', minLength:0, rows:2, placeholder:'ลิงก์ผลงาน/ต้นแบบ/เว็บไซต์ของโครงการ' },
    { key:'evidenceUrl', label:'Evidence URL', required:true, format:'url', minLength:0, rows:2, placeholder:'ลิงก์หลักฐาน เช่น Drive, รูป, รายงาน หรือผลทดสอบ' }
  ]);

  const clone = value => JSON.parse(JSON.stringify(value));
  const textField = (key, label, placeholder, rows=4) => ({
    key, label, required:true, minLength:35, placeholder:placeholder || '', format:'text', rows
  });

  function canonicalStudioItem(node, existing) {
    const item = existing ? clone(existing) : {
      id:node.id,
      phase:node.type === 'boss' ? 'Boss Defense' : 'Studio',
      suggestedMinutes:node.type === 'boss' ? 55 : 75,
      rubric:[]
    };

    const oldFields = Array.isArray(item.fields) ? item.fields : [];
    const preservedProjectId = oldFields.find(field => field && field.key === 'projectId') ||
      textField('projectId','Project ID เดิม','ใช้ Project ID เดียวตั้งแต่ W1-W15',2);
    preservedProjectId.minLength = 4;

    const taskFields = oldFields.filter(field => field && !['projectId','figmaUrl','projectUrl','evidenceUrl','reflection'].includes(field.key));
    const checklist = Array.isArray(node.artifactChecklist) ? node.artifactChecklist : [];

    if (!taskFields.length) {
      checklist.slice(0,4).forEach((label, index) => {
        taskFields.push(textField(`artifactEvidence${index + 1}`, String(label), `อธิบายหรือแนบหลักฐาน: ${label}`));
      });
    }

    const reflection = oldFields.find(field => field && field.key === 'reflection') ||
      textField('reflection',`Reflection ${node.id}`,'สิ่งที่เรียนรู้ หลักฐานที่ใช้ตัดสินใจ และสิ่งที่จะปรับปรุงต่อ',4);
    reflection.label = `Reflection ${node.id} • ${node.title}`;
    reflection.placeholder = Array.isArray(node.reasonChecks) && node.reasonChecks.length
      ? `สะท้อนจากคำถาม: ${node.reasonChecks.join(' • ')}`
      : reflection.placeholder;

    item.canonicalArtifact = node.artifact;
    item.studioTitle = `${node.id} • ${node.title}`;
    item.objective = node.focus;
    item.practiceFlow = Array.isArray(node.missionRounds) ? node.missionRounds.slice() : [];
    item.reflectionPrompt = reflection.placeholder;
    item.selfChecks = checklist.slice();
    item.fields = [preservedProjectId, ...REQUIRED_URL_FIELDS.map(clone), ...taskFields, reflection];
    item.dashboardFields = Array.from(new Set(item.fields.map(field => field.key).concat(node.dashboardEvidence || [])));
    item.courseAlignmentVersion = CONTENT.version;
    item.completionRule = node.completionRule;
    item.aiRule = node.aiRule;
    item.sourceOfTruth = node.sourceOfTruth;
    return item;
  }

  const oldPack = window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;
  const oldItems = Array.isArray(oldPack?.items) ? oldPack.items : [];
  const oldById = new Map(oldItems.map(item => [String(item.id || '').toUpperCase(), item]));
  const items = CONTENT.nodes.map(node => canonicalStudioItem(node, oldById.get(String(node.id).toUpperCase())));
  const byId = id => items.find(item => item.id === String(id || '').trim().toUpperCase()) || null;

  window.CSAI2601_UXQ_STUDIO_PRACTICE_V1 = Object.freeze({
    version:VERSION,
    canonicalContentVersion:CONTENT.version,
    phase:'ALL19-COURSE-ALIGNED',
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

  window.CSAI2601_UXQ_NODE_CONTENT = Object.freeze({
    version:VERSION,
    byId:CONTENT.byId,
    nodes:CONTENT.nodes,
    courseAlignment:CONTENT.courseAlignment,
    requiredEvidence:CONTENT.requiredEvidence
  });

  document.documentElement.dataset.uxqCourseAlignment = CONTENT.version;
  window.dispatchEvent(new CustomEvent('csai2601:course-alignment-ready', {
    detail:{ version:VERSION, canonicalContentVersion:CONTENT.version, nodeCount:items.length }
  }));
})();