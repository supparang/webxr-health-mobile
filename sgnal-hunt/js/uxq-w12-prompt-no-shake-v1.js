/* CSAI2601 UX Quest • PDF Content Alignment Authority v2
 * Expanded from the former W12 Prompt No-Shake Authority.
 *
 * PURPOSE
 * 1) Keep W12 prompt visually stable.
 * 2) Align Mission wording/reason checks for W5, W8, W15 and B1-B4 with
 *    concepts evidenced in the course PDF sources.
 * 3) Make every Studio Reflection node-specific and traceable to the same
 *    concept chain used in its Mission.
 *
 * SAFETY
 * - Never changes data-choice/data-reason IDs, correctness, score, attempts,
 *   unlock order, analytics, Sheet/Firebase writes, or student identity.
 * - HMW is treated as an ideation/reframing technique after Define; it is not
 *   represented as a verbatim concept from the primary PDF source.
 */
(() => {
  'use strict';

  const qs = new URLSearchParams(location.search || '');
  const NODE = String(qs.get('node') || qs.get('id') || '').toUpperCase();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();

  const ALIGN_VERSION = '20260813-PDF-CONTENT-ALIGNMENT-V2';

  const SOURCE_CONCEPTS = Object.freeze({
    W5: ['user evidence','insight','define problem','root cause','ideation','prototype/test','HMW as reframing technique'],
    W8: ['W1-W7 evidence chain','user research','persona','problem definition','IA/user flow','wireframe','revision'],
    W12:['system status visibility','error prevention','clear/actionable messages','confirmation feedback','recovery'],
    W15:['case narrative','evidence-to-decision traceability','design evolution','usability evidence','iteration','limitations/next test'],
    B1:['user/task/friction','HCD evidence','mental model/cognitive load/feedback','testable repair'],
    B2:['research evidence','persona','define/ideate','IA/user flow','wireframe','test idea'],
    B3:['design system consistency','responsive design','accessibility','visual hierarchy/readability'],
    B4:['component states/feedback/recovery','interactive prototype','usability evidence','iteration/retest']
  });

  const REFLECTIONS = Object.freeze({
    W1:'หลักฐานใดทำให้คุณเปลี่ยนจากการตัดสินว่า “หน้าจอสวย/ไม่สวย” ไปเป็นการอธิบาย User → Task → Friction → Impact → Fix → Test?',
    W2:'Assumption ใดเสี่ยงที่สุดในโครงการ และคุณจะตรวจสอบกับผู้ใช้ใด ด้วยวิธีใด ก่อนตัดสินใจออกแบบ?',
    W3:'จุดใดของหน้าจอขัดกับ mental model เพิ่ม cognitive load หรือให้ feedback ไม่พอ และหลักฐานอะไรจะใช้ทดสอบการแก้?',
    B1:'เมื่อรวม W1-W3 หลักฐานใดเชื่อม User/Task → HCD → Psychology → Fix → Test ได้แข็งแรงที่สุด และช่องว่างใดยังต้องพิสูจน์?',
    W4:'ข้อมูลใดใน Persona/Need มาจากคำพูดหรือพฤติกรรมผู้ใช้จริง และข้อมูลใดยังเป็น assumption ที่ต้องเก็บหลักฐานเพิ่ม?',
    W5:'จาก Evidence/Insight ที่มี คุณ Define ปัญหาและ root cause อย่างไร และ HMW ช่วยเปิดทางเลือกโดยไม่ล็อก solution เร็วเกินไปอย่างไร? ระบุสิ่งที่ยังต้องทดสอบด้วย',
    W6:'การจัดกลุ่มข้อมูลและเส้นทางใดสะท้อน mental model ของผู้ใช้ และ bottleneck/error path ใดยังเสี่ยงทำให้ task ไม่สำเร็จ?',
    W7:'Wireframe decision ใดเชื่อมกับ user goal และ flow ชัดที่สุด และส่วนใดยังต้องทดสอบก่อนเพิ่มรายละเอียด visual?',
    B2:'เมื่อรวม W4-W7 หลักฐานจาก Research → Problem/Ideation → IA/Flow → Wireframe เชื่อมกันตรงไหน และตรงไหนยังเป็น assumption?',
    W8:'เมื่อย้อนตรวจ W1-W7 evidence chain จุดใดเป็นหลักฐานจริง จุดใดเป็น mismatch/assumption และ revision ใดควรทำก่อนเพราะกระทบ task outcome มากที่สุด?',
    W9:'Component/pattern ใดควรทำให้สม่ำเสมอเพื่อช่วยผู้ใช้เรียนรู้ระบบได้เร็วขึ้น และ state/variant ใดยังขาด?',
    W10:'Responsive/Accessibility fix ใดช่วยให้ task ใช้ได้จริงในหลายบริบท และคุณจะตรวจ contrast, focus, label, keyboard/touch อย่างไร?',
    W11:'การตัดสินใจด้านสี typography spacing หรือ hierarchy ข้อใดอธิบายได้จากความหมาย/readability มากกว่าความชอบส่วนตัว?',
    B3:'เมื่อรวม W9-W11 systemic issue ใดควรแก้ก่อนเพื่อเพิ่ม consistency, responsive usability และ accessibility พร้อมกัน?',
    W12:'State, prevention, microcopy, feedback หรือ recovery ข้อใดช่วยให้ผู้ใช้รู้สถานะ ป้องกัน/กู้ error และไปต่อได้มากที่สุด เพราะอะไร?',
    W13:'ส่วนใดของงานยังเป็นเพียง mockup และ interaction/error path ใดต้องเพิ่มเพื่อให้ prototype ทดสอบ main task ได้จริง?',
    W14:'Finding ใดจาก usability test เปลี่ยนความเชื่อเดิมของทีม และ evidence ใดนำไปสู่ fix, severity และ retest plan?',
    B4:'เมื่อรวม W12-W14 การแก้ใดมี evidence รองรับแข็งแรงที่สุด และข้อสรุปใดยังต้องรอ retest ก่อนจึงจะยืนยันได้?',
    W15:'Design decision ใดใน case study เชื่อม User Evidence → Decision → Design → Test → Iteration ชัดที่สุด และ limitation/next test ที่ต้องยอมรับคืออะไร?'
  });

  function patchStudioReflections() {
    const pack = window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;
    const items = pack && Array.isArray(pack.items) ? pack.items : [];
    items.forEach(item => {
      const id = String(item && item.id || '').toUpperCase();
      const prompt = REFLECTIONS[id];
      if (!prompt || !item || Object.isFrozen(item)) return;
      item.reflectionPrompt = prompt;
      item.sourceAlignmentVersion = ALIGN_VERSION;
      const field = Array.isArray(item.fields) ? item.fields.find(f => f && f.key === 'reflection') : null;
      if (field && !Object.isFrozen(field)) {
        field.placeholder = prompt;
        field.label = id.startsWith('B') ? `Boss Reflection ${id}` : `Weekly Reflection ${id}`;
        field.minLength = Math.max(Number(field.minLength || 0), 40);
      }
    });
  }

  function patchNodeMetadata() {
    const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
    if (!content || !Array.isArray(content.nodes)) return;
    const patch = (id, concepts, checks) => {
      const node = content.nodes.find(n => String(n && n.id || '').toUpperCase() === id);
      if (!node || Object.isFrozen(node)) return;
      node.concepts = concepts.slice();
      node.reasonChecks = checks.slice();
      node.sourceAlignmentVersion = ALIGN_VERSION;
      node.sourceAlignment = 'course PDF concept → applied scenario → reason check → studio artifact → reflection';
    };
    patch('W5', SOURCE_CONCEPTS.W5, [
      'Insight นี้ย้อนกลับไปหา evidence/พฤติกรรมผู้ใช้ได้อย่างไร',
      'Problem statement ระบุ user + need/context โดยยังไม่ล็อก solution หรือไม่',
      'HMW ทำหน้าที่เปิดพื้นที่ ideation หลัง Define อย่างไร และ concept ที่เลือกยังทดสอบได้หรือไม่'
    ]);
    patch('W8', SOURCE_CONCEPTS.W8, [
      'Evidence chain จาก W1-W7 ขาดหรือตีกันตรงไหน',
      'Mismatch นี้กระทบ user task/outcome อย่างไร',
      'Revision priority นี้อ้างหลักฐานและเกณฑ์ผลกระทบ ไม่ใช่ความชอบ ใช่หรือไม่'
    ]);
    patch('W12', SOURCE_CONCEPTS.W12, [
      'สถานะทำให้ผู้ใช้รู้ว่าระบบกำลังทำอะไรหรือไม่',
      'Prevention/message ลด error และบอกวิธีแก้ที่ทำได้หรือไม่',
      'Feedback/recovery ทำให้ผู้ใช้ไปต่อโดยไม่เสียงานเกินจำเป็นหรือไม่'
    ]);
    patch('W15', SOURCE_CONCEPTS.W15, [
      'แต่ละ design decision มี evidence trace กลับไปหาผู้ใช้หรือผลทดสอบหรือไม่',
      'Case narrative แสดงการเปลี่ยนแปลงจาก evidence ไม่ใช่เพียงภาพ final UI หรือไม่',
      'มี limitation และ next test ที่ไม่สรุปเกินหลักฐานหรือไม่'
    ]);
    patch('B1', SOURCE_CONCEPTS.B1, ['เชื่อม user/task/friction กับ HCD evidence','อธิบาย psychology ด้วย mental model/load/feedback','กำหนดวิธีพิสูจน์ fix']);
    patch('B2', SOURCE_CONCEPTS.B2, ['เชื่อม research กับ persona/problem','ใช้ Define/Ideate ก่อนเลือก concept','เชื่อม IA/flow/wireframe กับ test idea']);
    patch('B3', SOURCE_CONCEPTS.B3, ['system consistency มีผลต่อผู้ใช้','responsive/a11y decision มีเหตุผลจาก task/context','visual hierarchy/readability ไม่ใช่ style-only']);
    patch('B4', SOURCE_CONCEPTS.B4, ['state/feedback/recovery รองรับ task','prototype ต้องคลิกทดสอบได้','finding → fix → retest traceable']);
  }

  function currentStageIndex() {
    const meter = clean($('.hud .meter b')?.textContent || '');
    const m = meter.match(/^(\d+)\s*\/\s*\d+/);
    return m ? Math.max(0, Number(m[1]) - 1) : 0;
  }

  function currentCase() {
    const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
    const node = (content?.nodes || []).find(n => String(n && n.id || '').toUpperCase() === NODE);
    const pill = clean($('.top .pill')?.textContent || '');
    const match = pill.match(/((?:W(?:[1-9]|1[0-5])|B[1-4])-C\d{1,3})/i);
    const id = match ? match[1].toUpperCase() : '';
    return (node?.seedCases || []).find(c => String(c && c.id || '').toUpperCase() === id) || {};
  }

  const genericWrong = [
    'เลือกจากความสวยหรือความชอบก่อนหลักฐานผู้ใช้',
    'เลือกสิ่งที่ทีมทำง่ายที่สุดแม้ไม่แก้ task',
    'เพิ่ม feature หรือข้อความโดยยังไม่ตรวจ root cause'
  ];
  const genericWrongReasons = [
    'ความชอบของทีมไม่ใช่หลักฐานของ user outcome',
    'ความสะดวกของทีมไม่ยืนยันว่า task ของผู้ใช้ดีขึ้น',
    'การเพิ่ม solution ก่อนเข้าใจสาเหตุทำให้ตรวจเหตุผลย้อนกลับไม่ได้'
  ];

  function taskW5(c, s) {
    const tasks = [
      {prompt:'ข้อใดเป็น Insight ที่เหมาะสำหรับใช้ Define ปัญหา', note:`สถานการณ์: ${c.context || 'โครงการ UX'} • เริ่มจาก evidence/พฤติกรรม ไม่ใช่ solution`, correct:`${c.insight || 'สรุป pattern ของพฤติกรรม/ความต้องการที่ย้อนกลับไปหา evidence ได้'}`, reason:'Insight ที่ใช้ได้ต้องสังเคราะห์จากหลักฐานหรือ pattern ของผู้ใช้ และยังไม่ควรกระโดดเป็น feature'},
      {prompt:'Root cause ใดควรนำไปตรวจต่อก่อนเลือกวิธีแก้', note:`สถานการณ์: ${c.context || 'โครงการ UX'} • แยกสาเหตุออกจากอาการที่มองเห็น`, correct:`${c.rootCause || 'สาเหตุที่อธิบายว่าทำไม user task จึงติดขัดและตรวจสอบต่อได้'}`, reason:'Root cause ที่ดีเชื่อม evidence กับเหตุของ friction และทำให้ทีมรู้ว่าต้องตรวจอะไรต่อ'},
      {prompt:'Problem statement ใดอยู่ในขั้น Define โดยยังไม่ล็อก Solution', note:`สถานการณ์: ${c.context || 'โครงการ UX'} • ระบุ user + need/context + เหตุผลจาก evidence`, correct:`${c.problemStatement || 'ระบุผู้ใช้ ความต้องการ/บริบท และผลต่อ task โดยไม่ฝังชื่อ feature ลงไป'}`, reason:'ขั้น Define ควรจัดกรอบปัญหาจาก insight ของผู้ใช้ก่อนตัดสินใจว่าจะสร้าง feature ใด'},
      {prompt:'หลัง Define ปัญหาแล้ว HMW ใดช่วยเปิดพื้นที่ Ideation ได้ดีที่สุด', note:`สถานการณ์: ${c.context || 'โครงการ UX'} • HMW ใช้เป็นเทคนิค reframing เพื่อสร้างหลายทางเลือก ไม่ใช่หลักฐานแทนผู้ใช้`, correct:`${c.hmw || 'เราจะช่วยให้ผู้ใช้บรรลุเป้าหมายนี้ได้อย่างไร โดยยังเปิดหลายแนวทาง'}`, reason:'HMW ที่ดีเกิดหลังเข้าใจ/Define ปัญหา และไม่ฝังคำตอบไว้ในคำถาม จึงช่วยเปิดหลาย concept ให้เปรียบเทียบ'},
      {prompt:'Concept direction ใด trace กลับไปหา Evidence และยังทดสอบได้', note:`สถานการณ์: ${c.context || 'โครงการ UX'} • เลือก concept เพราะแก้ root cause ไม่ใช่เพราะดูทันสมัย`, correct:`${c.concept || 'แนวคิดที่ตอบ root cause และกำหนด task/outcome สำหรับทดสอบได้'}`, reason:'Concept ที่ป้องกันได้ต้องเชื่อม evidence → problem/root cause → design decision และระบุวิธีพิสูจน์ผลได้'}
    ];
    return tasks[s] || tasks[0];
  }

  function taskW8(c, s) {
    const tasks = [
      {prompt:'เมื่อรวม W1-W7 Evidence chain ขาดตรงไหน', note:`Checkpoint synthesis • ${c.context || 'UX Blueprint'} • ตรวจ Problem → User/Persona → Flow → Wireframe`, correct:c.evidenceChain || 'ระบุจุดที่ design decision ไม่มีหลักฐานผู้ใช้หรือไม่เชื่อมกับขั้นก่อนหน้า', reason:'W8 เป็น synthesis checkpoint จึงต้องตรวจ traceability ของหลักฐาน ไม่ใช่เพิ่มทฤษฎีใหม่'},
      {prompt:'Mismatch ใดกระทบ User Task มากที่สุด', note:`Checkpoint synthesis • ${c.mismatch || c.issue || 'ตรวจความไม่สอดคล้องของ blueprint'}`, correct:c.mismatch || c.issue || 'เลือก mismatch ที่ทำให้ผู้ใช้เริ่ม/ตัดสินใจ/จบ task ไม่ได้', reason:'Priority ควรพิจารณาผลต่อ task outcome และ evidence ไม่ใช่ความสวยของชิ้นงาน'},
      {prompt:'Critique ใดควรถูกจัดเป็น Revision Priority ก่อน', note:'ใช้ impact ต่อผู้ใช้ + ความแข็งแรงของ evidence เป็นเกณฑ์', correct:c.critiquePriority || 'แก้ประเด็นที่ทำให้ task ล้มเหลวหรือทำให้หลักฐานกับ design decision ขัดกันก่อน', reason:'Feedback มีน้ำหนักต่างกัน การจัดลำดับควรผูกกับ user impact และความเสี่ยงของการตัดสินใจ'},
      {prompt:'Revision plan ใดตรวจผล Before–After ได้', note:'ระบุสิ่งที่เปลี่ยน เหตุผล และ outcome ที่จะวัด', correct:c.revision || 'แก้จุด mismatch ที่ระบุ พร้อมกำหนด task/measure เพื่อเปรียบเทียบก่อน–หลัง', reason:'Revision ที่ดีต้องทำให้เราพิสูจน์ได้ว่าการเปลี่ยน design ช่วย task มากขึ้นจริง'},
      {prompt:'Design rationale ใดป้องกัน Blueprint ได้', note:'อธิบายจาก evidence และเหตุผล ไม่ใช่ preference', correct:c.rationale || 'เชื่อม user evidence → decision → expected task outcome → วิธีตรวจสอบ', reason:'Rationale ที่ตรวจสอบได้ทำให้ผู้อื่นย้อนตามได้ว่าทำไมจึงตัดสินใจแบบนั้น'}
    ];
    return tasks[s] || tasks[0];
  }

  function taskW15(c, s) {
    const tasks = [
      {prompt:'Case study ควรเริ่มจากหลักฐานอะไร ไม่ใช่เริ่มจาก Final UI', note:`Portfolio synthesis • ${c.context || 'Final Case Study'}`, correct:c.narrative || 'เริ่มจาก user/problem/context และ evidence ที่ทำให้ทีมต้องตัดสินใจออกแบบ', reason:'Case study ที่น่าเชื่อถือแสดง problem และ evidence ก่อน solution เพื่อให้เห็นเหตุผลของงาน'},
      {prompt:'Evidence gap ใดทำให้ Design Decision ยังป้องกันไม่ได้', note:`Portfolio synthesis • ${c.evidenceGap || c.issue || 'ตรวจ traceability'}`, correct:c.evidenceGap || c.issue || 'ระบุ decision ที่ไม่มี user evidence/ผลทดสอบรองรับหรือสรุปเกินข้อมูล', reason:'Portfolio ไม่ควรเปลี่ยน assumption ให้ดูเหมือน fact ต้องแสดงช่องว่างหลักฐานอย่างตรงไปตรงมา'},
      {prompt:'ลำดับ Portfolio Story ใดแสดง Design Evolution ชัดที่สุด', note:'เล่าให้เห็นว่าหลักฐานเปลี่ยนการตัดสินใจอย่างไร', correct:c.storyOrder || 'Problem/User → Evidence → Decision → Flow/Wireframe/UI → Prototype → Test → Iteration', reason:'ลำดับนี้ทำให้เห็นสายเหตุผลและการพัฒนางาน ไม่ใช่เพียงรวบรวมภาพหน้าจอ'},
      {prompt:'Testing proof ใดใช้สนับสนุน Before–After ได้', note:'เลือกหลักฐานจาก task จริงหรือ usability finding', correct:c.proof || 'ใช้ observation/task result/error/time/finding ที่เชื่อมกับการแก้และผลหลังแก้', reason:'Proof ต้องสะท้อนพฤติกรรมหรือผลของ task จึงจะสนับสนุน design decision ได้ดีกว่า preference อย่างเดียว'},
      {prompt:'Final Defense ใดน่าเชื่อถือและไม่สรุปเกินหลักฐาน', note:'ปกป้อง decision พร้อมยอมรับ limitation และ next test', correct:c.defense || 'อธิบาย evidence → decision → result พร้อมระบุข้อจำกัดและสิ่งที่ยังต้องทดสอบต่อ', reason:'การยอมรับ limitation/next test ทำให้ข้อสรุปอยู่ในขอบเขตของหลักฐานและพร้อมพัฒนาต่อ'}
    ];
    return tasks[s] || tasks[0];
  }

  function taskBoss(id, c, s) {
    const maps = {
      B1:[
        ['บอส B1: ควรเริ่มวิเคราะห์จาก User/Task/Friction ใดก่อน', c.uxProblem || c.issue || 'ระบุ friction จาก task และหลักฐานก่อนแก้ UI','เริ่มจาก user/task ทำให้การแก้ต่อไปมี problem evidence ไม่ใช่ visual preference'],
        ['หลักฐาน HCD ใดต้องเก็บก่อน Prototype', c.hcdEvidence || 'สังเกต/สัมภาษณ์ task จริงและแยก evidence ออกจาก assumption','HCD ต้องให้ผู้ใช้และบริบทจริงเป็นฐานของ decision ก่อนสร้าง solution'],
        ['หลัก Psychology ใดอธิบายปัญหานี้ได้', c.psychology || 'mental model / cognitive load / attention / feedback ตามอาการของผู้ใช้','Psychology มีหน้าที่อธิบายกลไกของ friction ไม่ใช่ใช้เป็นคำศัพท์ตกแต่งเหตุผล'],
        ['Fix ใดเชื่อม Evidence + HCD + Psychology', c.fix || 'ปรับข้อมูล/feedback/task path ตรงสาเหตุและมีเหตุผลจากผู้ใช้','Fix ที่ดี trace กลับไปหา evidence และอธิบายผลต่อ task ได้'],
        ['จะพิสูจน์ Fix อย่างไร', c.proof || 'กำหนด user task และวัด success/error/time/next-step comprehension','การทดสอบ outcome ช่วยแยก improvement จริงออกจากความชอบของทีม']
      ],
      B2:[
        ['บอส B2: Research evidence ใดรองรับ Persona/Need นี้', c.persona || 'ใช้ quote/behavior/pain point ที่เก็บจากผู้ใช้จริง','Persona ต้องเป็น representation ที่อิง research ไม่ใช่ตัวละครที่ทีมแต่งจากความคาดเดา'],
        ['จาก Insight ควร Define/Reframe ปัญหาอย่างไร', c.problem || 'เขียน problem จาก user need/root cause แล้วใช้ HMW เป็น prompt เปิด ideation โดยไม่ล็อก feature','B2 ต้องรักษาลำดับ evidence → Define → Ideate; HMW เป็นเครื่องมือ reframing หลังเข้าใจปัญหา'],
        ['IA/User Flow ใดตรง Mental Model และ Task', c.flow || 'จัดข้อมูล/ทางเข้า/happy+error path ให้สอดคล้องกับวิธีที่ผู้ใช้คาดว่าจะทำงาน','IA และ flow ควรสะท้อน user mental model และลดการจำ/หลงทาง'],
        ['Wireframe decision ใด trace กลับไปหา Flow', c.wireframe || 'จัด hierarchy/CTA/layout ตาม user goal และ flow ที่พิสูจน์ไว้','Wireframe เป็น representation สำหรับตรวจ flow/hierarchy ไม่ใช่การตกแต่ง final UI'],
        ['B2 Defense chain ใดครบ', c.defense || 'Research evidence → Persona/Need → Define/Ideate → IA/Flow → Wireframe → Test idea','สายนี้ทำให้ทุก design decision ย้อนกลับไปหา evidence และมีทางพิสูจน์ต่อ']
      ],
      B3:[
        ['บอส B3: System inconsistency ใดเพิ่มภาระการเรียนรู้', c.pattern || 'รวม component ที่ทำหน้าที่เดียวกันและกำหนด variant/state/naming ที่สม่ำเสมอ','Consistency ช่วยให้ผู้ใช้เรียนรู้ pattern เดิมซ้ำได้และลด cognitive load'],
        ['Responsive decision ใดมาจาก Content/Context', c.responsive || 'ปรับ layout/navigation/touch target เมื่อเนื้อหาเริ่มใช้งานยากในขนาดจอจริง','Breakpoint ควรตอบการใช้งานและ content ไม่ใช่เลือกรุ่นอุปกรณ์ตามความนิยมอย่างเดียว'],
        ['Accessibility issue ใดกระทบ Task', c.accessibility || 'ตรวจ contrast, label, focus/keyboard และ touch target ที่ขัดขวางการทำงาน','Accessible design เพิ่ม perceptibility/operability และมักช่วยผู้ใช้ทั่วไปด้วย'],
        ['Visual hierarchy ใดสื่อ Meaning และ Readability', c.visual || 'ใช้ color/type/spacing hierarchy ให้ข้อมูลสำคัญและสถานะอ่านได้ชัด','Visual system ต้องสนับสนุน comprehension ไม่ใช่เพียงความสวย/branding'],
        ['B3 Defense ควรยืนยันอะไร', c.defense || 'Consistency + Responsive + Accessibility + Readability เชื่อมกับ user task','System defense ที่ดีอธิบายผลต่อผู้ใช้ทั้งระบบ ไม่ใช่แค่ความสะดวกของ design team']
      ],
      B4:[
        ['บอส B4: State/Feedback/Recovery ใดขาดจาก Task', c.state || 'เพิ่ม state ที่บอกสถานะ ป้องกัน error และให้ผู้ใช้กู้กลับได้','Interaction state ต้องทำให้ผู้ใช้รู้ว่าเกิดอะไรขึ้นและมีทางไปต่อเมื่อผิดพลาด'],
        ['Prototype ส่วนใดต้อง Interactive จึงทดสอบได้', c.prototype || 'main flow + critical state + error/alternative path ต้องคลิกและย้อนกลับได้','Prototype มีคุณค่าเมื่อใช้จำลอง task/interaction เพื่อทดสอบ ไม่ใช่เพียงภาพเหมือน final UI'],
        ['Severity ควรจัดจาก Evidence อะไร', c.evaluation || 'พิจารณา task failure/error/frequency/impact จากการสังเกตผู้ใช้','Severity ต้องสัมพันธ์กับผลต่อผู้ใช้ ไม่ใช่ความยากง่ายในการแก้ของทีม'],
        ['Iteration ใด Evidence-based', c.iteration || 'แก้ตาม finding ที่ระบุ แล้ว retest task เดิมด้วยเกณฑ์เดียวกัน','Modify-and-retest ทำให้ทราบว่าการแก้ลดปัญหาจริงหรือสร้างปัญหาใหม่'],
        ['B4 Defense ใดไม่สรุปเกินหลักฐาน', c.defense || 'State/Prototype → Test Evidence → Finding/Severity → Fix → Retest พร้อม limitation','การยืนยันผลหลัง retest และระบุ limitation ทำให้ข้อสรุปมีขอบเขตที่ป้องกันได้']
      ]
    };
    const row = (maps[id] || maps.B1)[s] || (maps[id] || maps.B1)[0];
    return {prompt:row[0], note:`${id} synthesis • ${c.context || 'Integrated UX case'}`, correct:row[1], reason:row[2]};
  }

  function taskFor(c, s) {
    if (NODE === 'W5') return taskW5(c, s);
    if (NODE === 'W8') return taskW8(c, s);
    if (NODE === 'W15') return taskW15(c, s);
    if (/^B[1-4]$/.test(NODE)) return taskBoss(NODE, c, s);
    return null;
  }

  function setOptionText(btn, label, helper) {
    if (!btn) return;
    const b = $('b', btn);
    const span = $('span', btn);
    if (b && clean(b.textContent) !== label) b.textContent = label;
    if (span) span.textContent = helper || '';
  }

  function applyAlignedQuestion() {
    if (!['W5','W8','W15','B1','B2','B3','B4'].includes(NODE)) return;
    const q = $('.question');
    if (!q || $('.feedback', q) || $('.verify')) return;
    const stage = currentStageIndex();
    const c = currentCase();
    const t = taskFor(c, stage);
    if (!t) return;
    const mark = `${ALIGN_VERSION}:${NODE}:${clean($('.top .pill')?.textContent)}:${stage}`;
    if (q.dataset.pdfAlignment === mark && clean($('.prompt', q)?.textContent) === t.prompt) return;
    const prompt = $('.prompt', q);
    const instruction = $('.instruction', q);
    if (prompt) prompt.textContent = t.prompt;
    if (instruction) instruction.textContent = t.note;

    const correct = $(`.options .option[data-choice^="c${stage}"]`, q) || $('.options .option[data-choice^="c"]', q);
    setOptionText(correct, t.correct, 'คำตอบที่ trace กลับไปหา evidence/concept ของด่านนี้ได้');
    const wrongButtons = $$(`.options .option[data-choice^="d${stage}-"]`, q);
    wrongButtons.slice(0,3).forEach((btn, i) => setOptionText(btn, genericWrong[i], 'กับดัก: เหตุผลไม่เชื่อมกับหลักฐานผู้ใช้'));
    q.dataset.pdfAlignment = mark;
  }

  function reasonIndex(btn) {
    const id = String(btn.getAttribute('data-reason') || '');
    const m = id.match(/-(\d+)$/);
    return m ? Number(m[1]) : -1;
  }
  function isCorrectReason(btn) {
    const id = String(btn.getAttribute('data-reason') || '');
    return /-0$/.test(id) || /correct/i.test(id);
  }

  function applyAlignedReason() {
    if (!['W5','W8','W15','B1','B2','B3','B4'].includes(NODE)) return;
    const box = $('.verify');
    if (!box) return;
    const stage = currentStageIndex();
    const c = currentCase();
    const t = taskFor(c, stage);
    if (!t) return;
    const h = $('h3', box);
    const intro = $('p', box);
    if (h) h.textContent = `ตรวจเหตุผล • ${t.prompt}`;
    if (intro) intro.textContent = 'เลือกเหตุผลที่เชื่อม Concept → Evidence → User/Task outcome ได้จริง';
    $$('.option[data-reason]', box).slice(0,4).forEach(btn => {
      if (isCorrectReason(btn)) setOptionText(btn, t.reason, 'เหตุผลนี้ตรวจสอบย้อนกลับได้');
      else {
        const idx = reasonIndex(btn);
        const w = genericWrongReasons[Math.max(0, idx - 1) % 3];
        setOptionText(btn, w, 'เหตุผลนี้ไม่พอสำหรับการป้องกัน design decision');
      }
    });
  }

  // W12 visual no-shake uses the same canonical order as W12 Content Integrity v3.
  const W12_PROMPTS = [
    'ระหว่างระบบกำลังประมวลผล ผู้ใช้ควรเห็นสถานะใด',
    'วิธีใดป้องกันข้อผิดพลาดก่อนเกิดปัญหาได้ตรงที่สุด',
    'Microcopy ใดช่วยให้ผู้ใช้แก้ข้อผิดพลาดได้จริง',
    'Feedback หลังทำรายการแบบใดช่วยให้ผู้ใช้รู้ผลและขั้นตอนถัดไป',
    'Recovery path ใดช่วยให้ผู้ใช้กลับไปทำงานต่อโดยเสียงานน้อยที่สุด'
  ];

  function installW12NoShakeStyle() {
    if (NODE !== 'W12' || $('#uxqW12PromptNoShakeStyleV2')) return;
    const style = document.createElement('style');
    style.id = 'uxqW12PromptNoShakeStyleV2';
    style.textContent = `
      body[data-uxq-node="W12"] .question .prompt[data-uxq-w12-visual-owner="true"] {
        position:relative!important;display:block!important;min-height:1.55em!important;height:auto!important;
        overflow:visible!important;font-size:0!important;line-height:0!important;color:transparent!important;
        transform:none!important;animation:none!important;transition:none!important;contain:layout paint!important;
      }
      body[data-uxq-node="W12"] .question .prompt[data-uxq-w12-visual-owner="true"]::after {
        content:attr(data-uxq-w12-prompt)!important;display:block!important;min-height:1.55em!important;
        color:#f4f7ff!important;font:inherit!important;font-size:clamp(1.45rem,2.3vw,2rem)!important;
        font-weight:800!important;line-height:1.25!important;letter-spacing:0!important;white-space:normal!important;
        transform:none!important;animation:none!important;transition:none!important;
      }
    `;
    document.head.appendChild(style);
  }

  function renderStableW12Prompt() {
    if (NODE !== 'W12') return;
    const prompt = $('.question .prompt');
    if (!prompt) return;
    document.body.setAttribute('data-uxq-node', 'W12');
    const stage = Math.max(0, Math.min(4, currentStageIndex()));
    const text = W12_PROMPTS[stage] || W12_PROMPTS[0];
    prompt.setAttribute('data-uxq-w12-visual-owner', 'true');
    prompt.setAttribute('data-uxq-w12-prompt', text);
  }

  function run() {
    patchStudioReflections();
    patchNodeMetadata();
    installW12NoShakeStyle();
    renderStableW12Prompt();
    applyAlignedQuestion();
    applyAlignedReason();
  }

  let timer = 0;
  function schedule(delay = 70) {
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule(0), { once:true });
  else schedule(0);

  document.addEventListener('click', () => {
    schedule(40);
    setTimeout(run, 180);
    setTimeout(run, 420);
  }, true);

  window.addEventListener('uxq-round-changed', () => schedule(0));
  window.addEventListener('uxq-question-rendered', () => schedule(0));

  const root = $('#uxqCanonicalNode') || document.body;
  new MutationObserver(() => schedule(70)).observe(root, {childList:true, subtree:true});

  window.CSAI2601_UXQ_PDF_CONTENT_ALIGNMENT_V2 = Object.freeze({
    version:ALIGN_VERSION,
    alignedNodes:Object.freeze(['W5','W8','W12','W15','B1','B2','B3','B4']),
    reflectionNodes:Object.freeze(Object.keys(REFLECTIONS)),
    policy:Object.freeze({progressionChanged:false,scoringIdsChanged:false,hmwRole:'post-Define reframing/ideation technique'})
  });
})();
