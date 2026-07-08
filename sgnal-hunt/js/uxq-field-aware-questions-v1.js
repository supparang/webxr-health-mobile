/* CSAI2601 UX Quest • Field-Aware Questions v1
 * Runs before canonical-node-player.
 * Converts W4-W7 rich item-bank fields into playable question signals.
 */
(() => {
  'use strict';

  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const byId = (id) => content.nodes.find((node) => String(node.id || '').toUpperCase() === id);
  const clean = (v) => String(v == null ? '' : v).trim();
  const join = (items) => items.map(clean).filter(Boolean).join(' • ');

  function enhanceCases(nodeId, mapper) {
    const node = byId(nodeId);
    if (!node || !Array.isArray(node.seedCases)) return;
    node.seedCases = node.seedCases.map((item) => Object.assign({}, item, mapper(item)));
    node.fieldAwareVersion = 'v20260708-field-aware-v1';
  }

  enhanceCases('W4', (c) => ({
    user: clean(c.user) || 'นักศึกษาที่ให้ข้อมูลผู้ใช้',
    friction: join([
      `ข้อมูลที่พบ: ${c.data || c.issue || c.friction || ''}`,
      `Pain point: ${c.painPoint || ''}`,
      `Persona need: ${c.personaNeed || ''}`,
      `คำถามวิจัยที่ควรถาม: ${c.question || ''}`
    ]),
    fieldAwareFocus: 'research question → pain point → persona need'
  }));

  enhanceCases('W5', (c) => ({
    user: clean(c.user) || 'นักศึกษาที่ต้อง define problem และ ideate',
    friction: join([
      `Insight: ${c.insight || ''}`,
      `Root cause: ${c.rootCause || ''}`,
      `Problem statement: ${c.problemStatement || ''}`,
      `HMW: ${c.hmw || ''}`,
      `Concept: ${c.concept || ''}`
    ]),
    fieldAwareFocus: 'insight → root cause → problem statement → HMW → concept'
  }));

  enhanceCases('W6', (c) => ({
    user: clean(c.user) || 'นักศึกษาที่ต้องจัด IA และ user flow',
    friction: join([
      `Issue: ${c.issue || ''}`,
      `Group/Sitemap: ${c.group || ''}`,
      `Navigation entry: ${c.nav || ''}`,
      `Happy path: ${c.happyPath || ''}`,
      `Error path: ${c.errorPath || ''}`,
      `Bottleneck: ${c.bottleneck || ''}`
    ]),
    fieldAwareFocus: 'group/sitemap → navigation → happy path → error path → bottleneck'
  }));

  enhanceCases('W7', (c) => ({
    user: clean(c.user) || 'นักศึกษาที่ต้องออกแบบ wireframe',
    friction: join([
      `Issue: ${c.issue || ''}`,
      `Goal: ${c.goal || ''}`,
      `Priority: ${c.priority || ''}`,
      `Layout: ${c.layout || ''}`,
      `CTA: ${c.cta || ''}`,
      `Mobile: ${c.mobile || ''}`
    ]),
    fieldAwareFocus: 'visual priority → layout → CTA → mobile wireframe'
  }));

  function patchNode(id, missionRounds, reasonChecks, concepts, artifact) {
    const node = byId(id);
    if (!node) return;
    node.missionRounds = missionRounds;
    node.reasonChecks = reasonChecks;
    node.concepts = concepts;
    if (artifact) node.artifact = artifact;
  }

  patchNode('W4',
    ['Choose research question','Find pain point','Define persona need','Separate evidence from assumption','Plan interview / observation'],
    [
      'คำถามนี้ช่วยให้เข้าใจผู้ใช้จริง ไม่ใช่เดาเองอย่างไร',
      'Pain point นี้มาจากข้อมูลใดของผู้ใช้',
      'Persona need นี้ควรนำไปใช้ตัดสินใจออกแบบอย่างไร'
    ],
    ['Research question','Pain point','Persona need','Evidence vs assumption','Interview / Observation'],
    'Empathy Research Note'
  );

  patchNode('W5',
    ['Extract insight','Identify root cause','Write problem statement','Choose HMW question','Select concept direction'],
    [
      'ทำไม insight นี้ไม่ใช่แค่ observation ผิวเผิน',
      'Root cause นี้เชื่อมกับ problem statement อย่างไร',
      'HMW นี้เปิดทางให้ ideate โดยไม่ล็อก solution เร็วเกินไปอย่างไร'
    ],
    ['Insight','Root cause','Problem statement','How Might We','Concept direction'],
    'Problem Definition & HMW Sheet'
  );

  patchNode('W6',
    ['Group sitemap content','Choose navigation entry','Build happy path','Design error path','Find flow bottleneck'],
    [
      'การจัดกลุ่มนี้ตรงกับ mental model ของผู้ใช้อย่างไร',
      'Navigation entry นี้ช่วยให้ผู้ใช้เริ่มงานถูกจุดอย่างไร',
      'Error path นี้ลดการหลุดจาก flow อย่างไร'
    ],
    ['Information Architecture','Sitemap','Navigation','Happy path','Error path','Bottleneck'],
    'IA Sitemap & User Flow Sheet'
  );

  patchNode('W7',
    ['Set visual priority','Choose wireframe layout','Pick primary CTA','Adapt mobile layout','Avoid hierarchy trap'],
    [
      'Priority นี้ช่วยให้ผู้ใช้เห็นสิ่งที่ต้องทำก่อนอย่างไร',
      'Layout นี้รองรับ goal และ content hierarchy อย่างไร',
      'CTA และ mobile layout นี้ลด friction ได้อย่างไร'
    ],
    ['Wireframe','Grid','Visual hierarchy','Primary CTA','Mobile layout'],
    'Wireframe Priority Sheet'
  );

  window.CSAI2601_UXQ_FIELD_AWARE_QUESTIONS_V1 = Object.freeze({ version:'v20260708-field-aware-v1', nodes:['W4','W5','W6','W7'] });
})();
