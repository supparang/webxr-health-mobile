/* CSAI2601 UX Quest • Field-Aware Questions W8-W15 v1
 * Runs before canonical-node-player.
 * Converts W8-W15 rich item-bank fields into playable question signals.
 */
(() => {
  'use strict';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;
  const byId = (id) => content.nodes.find((node) => String(node.id || '').toUpperCase() === id);
  const clean = (v) => String(v == null ? '' : v).trim();
  const join = (items) => items.map(clean).filter(Boolean).join(' • ');

  function enhance(id, rounds, checks, concepts, artifact, mapper) {
    const node = byId(id);
    if (!node) return;
    node.missionRounds = rounds;
    node.reasonChecks = checks;
    node.concepts = concepts;
    node.artifact = artifact;
    if (Array.isArray(node.seedCases)) node.seedCases = node.seedCases.map((c) => Object.assign({}, c, mapper(c)));
    node.fieldAwareVersion = 'v20260708-w8-w15-field-aware-v1';
  }

  enhance('W8', ['Check evidence chain','Find blueprint mismatch','Rank critique priority','Choose revision plan','Write design rationale'], ['จุดใดทำให้ evidence chain ขาด','Mismatch นี้กระทบผู้ใช้หรือ task อย่างไร','Revision ใดควรแก้ก่อนเพราะกระทบ outcome มากที่สุด'], ['UX blueprint','Evidence chain','Critique priority','Revision plan','Design rationale'], 'Midterm UX Blueprint', (c) => ({ user:'ผู้ตรวจ blueprint', friction:join([`Evidence chain: ${c.evidenceChain || ''}`,`Mismatch: ${c.mismatch || c.issue || ''}`,`Critique priority: ${c.critiquePriority || ''}`,`Revision: ${c.revision || ''}`,`Rationale: ${c.rationale || ''}`]) }));
  enhance('W9', ['Detect pattern inconsistency','Merge component pattern','Define component states','Name component correctly','Explain system consistency'], ['Component ใดควรรวมเป็น pattern เดียวกัน','State ใดจำเป็นต่อการใช้จริง','Consistency ลดภาระผู้ใช้อย่างไร'], ['Design system','Component','Variant','State','Naming convention'], 'UI Kit Charter', (c) => ({ user:'ผู้ออกแบบ design system', friction:join([`Component: ${c.component || ''}`,`Inconsistency: ${c.inconsistency || c.issue || ''}`,`States: ${c.state || ''}`,`Naming: ${c.naming || ''}`,`Rule: ${c.systemRule || ''}`]) }));
  enhance('W10', ['Find responsive issue','Find accessibility issue','Choose breakpoint','Fix touch/reading problem','Check focus/contrast'], ['ข้อใดเป็น responsive issue','ข้อใดเป็น accessibility issue','fix นี้ช่วยผู้ใช้ทั่วไปและผู้ใช้ที่มีข้อจำกัดอย่างไร'], ['Responsive design','Accessibility','Breakpoint','Touch target','Contrast / Focus'], 'Responsive + Accessibility Plan', (c) => ({ user:'ผู้ทดสอบหลายอุปกรณ์', friction:join([`Responsive: ${c.responsiveIssue || c.issue || ''}`,`A11y: ${c.a11yIssue || ''}`,`Breakpoint: ${c.breakpoint || ''}`,`Fix: ${c.fix || ''}`,`Check: ${c.check || ''}`]) }));
  enhance('W11', ['Map color meaning','Choose typography hierarchy','Check contrast','Adjust spacing scale','Defend visual decision'], ['สีและ status meaning นี้สื่อสารผิดหรือถูกอย่างไร','Typography hierarchy ช่วยการอ่านอย่างไร','Visual decision นี้ผ่าน accessibility หรือไม่'], ['Color system','Typography','Contrast','Spacing scale','Visual accessibility'], 'Visual Style Guide', (c) => ({ user:'ผู้ออกแบบ visual style guide', friction:join([`Color: ${c.colorIssue || c.issue || ''}`,`Typography: ${c.typographyIssue || ''}`,`Contrast: ${c.contrast || ''}`,`Spacing: ${c.spacing || ''}`,`Decision: ${c.visualDecision || ''}`]) }));
  enhance('W12', ['Choose component state','Prevent double submit / dead end','Write useful microcopy','Choose confirmation feedback','Design recovery path'], ['State ใดจำเป็นก่อนและหลัง action','Microcopy ใดลดความกังวลของผู้ใช้','Recovery path ช่วยให้ผู้ใช้ไปต่ออย่างไร'], ['Interaction design','Component states','Feedback','Microcopy','Recovery'], 'Component State Spec', (c) => ({ user:'ผู้ใช้ที่ทำ action สำคัญ', friction:join([`State issue: ${c.stateIssue || c.issue || ''}`,`Feedback: ${c.feedback || ''}`,`Microcopy: ${c.microcopy || ''}`,`Prevention: ${c.prevention || ''}`,`Recovery: ${c.recovery || ''}`]) }));
  enhance('W13', ['Check testable task','Find missing prototype link','Check interaction state','Validate error path','Defend prototype rationale'], ['Prototype นี้ทดสอบ task ใดได้จริง','จุดใดยังเป็น mockup ไม่ใช่ prototype','Error path นี้ทำให้ผู้ใช้กลับไปแก้ได้หรือไม่'], ['High-fidelity prototype','Prototype flow','Interactive link','Error path','Design rationale'], 'Clickable Hi-fi Prototype', (c) => ({ user:'ผู้ทดสอบ prototype', friction:join([`Task: ${c.task || ''}`,`Missing link: ${c.missingLink || c.issue || ''}`,`Interaction: ${c.interaction || ''}`,`Error path: ${c.errorPath || ''}`,`Rationale: ${c.rationale || ''}`]) }));
  enhance('W14', ['Read test evidence','Classify usability finding','Rank severity','Choose evidence-based fix','Plan retest'], ['Severity สูงสุดมาจากหลักฐานใด','Fix นี้สัมพันธ์กับ evidence อย่างไร','Retest ใดพิสูจน์ก่อน-หลังได้จริง'], ['Usability test','Finding','Severity','Evidence-based fix','Retest'], 'Usability Iteration Log', (c) => ({ user:'ทีมทดสอบ usability', friction:join([`Evidence: ${c.evidence || c.issue || ''}`,`Finding: ${c.finding || ''}`,`Severity: ${c.severity || ''}`,`Fix: ${c.fix || ''}`,`Retest: ${c.retest || ''}`]) }));
  enhance('W15', ['Check case narrative','Find evidence gap','Order portfolio story','Select testing proof','Prepare presentation defense'], ['Case study ที่ดีต้องเริ่มจากอะไร','Evidence gap ใดทำให้ portfolio ไม่น่าเชื่อถือ','Proof ใดควรนำไปป้องกัน design decision'], ['UX case study','Narrative','Evidence gap','Testing proof','Presentation defense'], 'Final UX/UI Case Study Portfolio', (c) => ({ user:'ผู้ชม portfolio / กรรมการ', friction:join([`Narrative: ${c.narrative || ''}`,`Evidence gap: ${c.evidenceGap || c.issue || ''}`,`Story order: ${c.storyOrder || ''}`,`Proof: ${c.proof || ''}`,`Defense: ${c.defense || ''}`]) }));

  window.CSAI2601_UXQ_FIELD_AWARE_W8_W15_V1 = Object.freeze({ version:'v20260708-w8-w15-field-aware-v1', nodes:['W8','W9','W10','W11','W12','W13','W14','W15'] });
})();
