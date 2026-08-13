/* CSAI2601 UX Quest • Canonical Content Final Authority v3
 * Two-phase owner:
 *   phase 1 (before player): restore canonical metadata after legacy enrichment.
 *   phase 2 (last script): own visible Mission + Reason Check wording.
 *
 * Source of truth = immutable snapshot captured immediately after
 * uxq-csai2601-canonical-content-v1.js.
 *
 * SAFETY: never changes data-choice/data-reason IDs, correctness, scores,
 * attempts, unlock order, identity, analytics or Sheet/Firebase writes.
 */
(() => {
  'use strict';

  const VERSION = '20260813-CANONICAL-CONTENT-FINAL-AUTHORITY-V3';
  const existing = window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3;
  if (existing) {
    existing.activateVisible();
    existing.run();
    return;
  }

  const SNAP = window.CSAI2601_UXQ_CANONICAL_SNAPSHOT_V1;
  const LIVE = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!SNAP || !Array.isArray(SNAP.nodes) || !LIVE || !Array.isArray(LIVE.nodes)) return;

  const qs = new URLSearchParams(location.search || '');
  const NODE = String(qs.get('node') || qs.get('id') || '').toUpperCase();
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clean = value => String(value == null ? '' : value).replace(/\s+/g,' ').trim();
  const clone = value => JSON.parse(JSON.stringify(value));

  const CANONICAL_KEYS = [
    'type','order','unlockAfter','covers','title','missionTitle','focus','concepts',
    'learningOutcomes','casePrompt','bossScenario','missionRounds','reasonChecks',
    'artifact','artifactChecklist','dashboardEvidence','completionRule','sourceOfTruth','aiRule'
  ];

  function restoreCanonicalMetadata() {
    SNAP.nodes.forEach(src => {
      const target = LIVE.nodes.find(node => String(node.id || '').toUpperCase() === String(src.id || '').toUpperCase());
      if (!target || Object.isFrozen(target)) return;
      CANONICAL_KEYS.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(src,key)) target[key] = clone(src[key]);
      });
      target.canonicalAuthorityVersion = VERSION;
      target.sourceAlignment = 'canonical curriculum/PDF concepts → Mission → Reason Check → Studio → Reflection';
    });
    document.documentElement.dataset.uxqCanonicalContentAuthority = VERSION;
  }

  const GUIDE = Object.freeze({
    W1:[
      ['หลักฐานใดชี้ Friction ที่กระทบงานหลักของผู้ใช้','เลือกพฤติกรรม/จุดติดขัดที่ทำให้ User Goal หรือ Task ไม่สำเร็จ ไม่ตัดสินจากความสวยเพียงอย่างเดียว'],
      ['ข้อใดจำแนก UI, UX และ Front-end ได้ถูกต้อง','UI คือสิ่งที่ผู้ใช้เห็น/โต้ตอบ UX คือประสบการณ์ตลอด task และ Front-end ทำ behavior/feedback ของ interface ให้เกิดขึ้นจริง'],
      ['ควร Trace task failure อย่างไร','เชื่อม User Goal → Action/Interface → จุดที่ติด → Feedback/สถานะที่ขาด → ผลต่อ Task'],
      ['Fix ใดตรงกับ Friction มากที่สุด','แก้ interaction/information/feedback ที่เป็นสาเหตุของ task failure และระบุผลที่คาดว่าจะดีขึ้น'],
      ['จะ Validate แนวทางแก้อย่างไร','ทดสอบ task เดิมแล้วเปรียบเทียบ task success, เวลา, error หรือหลักฐานพฤติกรรมก่อน–หลัง']
    ],
    W2:[
      ['วิธีวิจัยใดเหมาะกับคำถามผู้ใช้มากที่สุด','เลือก Interview/Observation/Survey ให้ตรงกับสิ่งที่ต้องรู้ กลุ่มผู้ใช้ เวลา และข้อจำกัดด้าน ethics/privacy'],
      ['คำถามใดควรถูกซ่อมเพราะชี้นำคำตอบ','เปลี่ยนคำถามชี้นำเป็นคำถามปลายเปิดที่ถามพฤติกรรม เหตุผล และบริบทจริงของผู้ใช้'],
      ['ข้อใดเป็น Evidence ไม่ใช่ Assumption','ใช้สิ่งที่สังเกต/ได้ยิน/เก็บจากผู้ใช้จริง และแยกสิ่งที่ทีมคาดเดาออกอย่างชัดเจน'],
      ['ควรสังเคราะห์ Insight อย่างไร','หา pattern จากหลักฐานหลายชิ้นแล้วอธิบาย need/pain/context โดยไม่สรุปเกินข้อมูล'],
      ['Persona ที่ใช้ตัดสินใจออกแบบควรสร้างอย่างไร','สร้าง Persona/Empathy Map จาก research evidence พร้อม goal, behavior, constraint และไม่แต่ง stereotype']
    ],
    W3:[
      ['จุดใดเพิ่ม Cognitive Load มากที่สุด','เลือกจุดที่บังคับให้ผู้ใช้จำ เปรียบเทียบหลายอย่าง หรือค้นหาสถานะเองระหว่างทำ task'],
      ['Task Flow ที่ดีควรวางอย่างไร','จัดลำดับ Start → Action/Decision → Outcome ให้ตรง mental model และลดขั้นตอนที่ไม่จำเป็น'],
      ['ข้อใดเป็น Memory Burden ที่ควรลด','เปลี่ยนจาก recall เป็น recognition เช่น แสดงตัวเลือก สถานะ หรือข้อมูลที่ต้องใช้ ณ จุดตัดสินใจ'],
      ['วิธีใดป้องกัน Error ก่อนเกิดได้ดีกว่า','ใช้ constraint, validation, clear affordance และ feedback ก่อน/ขณะ action แทนรอ error ตอนจบ'],
      ['Low-fi Wireframe ใหม่ควรพิสูจน์อะไร','แสดงว่า revised flow, hierarchy และ feedback ลด cognitive friction ของ task ได้อย่างไร']
    ],
    B1:[
      ['Audit defense ใดเริ่มจากหลักฐานถูกต้อง','เริ่มจาก User/Task/Friction/Impact และแยกปัญหา UI, UX, Front-end จากหลักฐานจริง'],
      ['Evidence defense ใดแข็งแรงที่สุด','เชื่อม research method → evidence → insight/persona โดยระบุ assumption และ ethics ที่ยังต้องตรวจ'],
      ['Cognitive diagnosis ใดอธิบายปัญหาได้','ใช้ cognitive load, mental model, recognition/recall, affordance หรือ feedback อธิบาย task failure'],
      ['Flow repair ใดป้องกันได้','ปรับ task flow/wireframe จาก evidence และ psychology พร้อมอธิบายเหตุผลของ before–after'],
      ['Reflection defense ใดครบ','สรุป Evidence → Decision → Repair → Validation และระบุสิ่งที่ยังไม่รู้/ต้องทดสอบต่อ']
    ],
    W4:[
      ['ควร Cluster Evidence อย่างไรเพื่อหา Insight','จัดกลุ่มหลักฐานตาม pattern ของพฤติกรรม/need/pain ไม่จัดตาม solution ที่ทีมอยากทำ'],
      ['Root Cause ใดควรถูกใช้ Define ปัญหา','เลือกสาเหตุที่ย้อนกลับไปหา evidence ได้และอธิบายว่าทำไม user need/task จึงติดขัด'],
      ['Problem Statement ใดมีคุณภาพ','ระบุ User + Need/Context + Why/Outcome โดยยังไม่ล็อก solution'],
      ['HMW ใดเหมาะหลัง Define','ใช้ HMW เป็นเทคนิค reframing หลังมี evidence/problem เพื่อเปิดหลายแนวทาง ไม่ฝังคำตอบไว้ในคำถาม'],
      ['Inclusive Check ใดต้องทำก่อนเลือกแนวทาง','ตรวจ excluded users, accessibility needs และ bias ว่าแนวทางจะทิ้งหรือเพิ่มภาระให้ใคร']
    ],
    W5:[
      ['Ideation รอบแรกควรทำอย่างไร','สร้างทางเลือกหลายแบบ เช่น Crazy 8s ก่อนคัดเลือก เพื่อไม่ยึดติดกับ idea แรกหรือ AI suggestion แรก'],
      ['ควรใช้ AI-assisted suggestion อย่างไร','ใช้ AI ช่วยขยายทางเลือก แต่ตรวจความถูกต้อง บริบท user evidence และไม่ยอมรับผลลัพธ์อัตโนมัติ'],
      ['Concept ควรถูกเปรียบเทียบด้วยเกณฑ์ใด','ประเมิน Desirability + Feasibility + Viability และความสอดคล้องกับ Problem/HMW ด้วยเกณฑ์เดียวกัน'],
      ['AI/Ethics risk ใดต้องตรวจ','ตรวจ Bias, Privacy และ Transparency พร้อมบันทึกว่า AI มี contribution ตรงไหนและมนุษย์ตรวจอะไร'],
      ['เหตุใดจึงเลือก Concept นี้','เลือกแนวคิดจาก evidence + criteria + risk review และระบุสมมติฐานที่จะ prototype/test ต่อ']
    ],
    W6:[
      ['Content Inventory ควรเริ่มจากอะไร','รวบรวม content/function ที่ผู้ใช้ต้องใช้จริง ระบุเจ้าของ/ความซ้ำ/ความสำคัญก่อนจัดโครงสร้าง'],
      ['ควร Group Content อย่างไร','จัดกลุ่มตาม mental model และ task ของผู้ใช้ เช่น card sorting evidence ไม่ยึดโครงสร้างหน่วยงานเป็นหลัก'],
      ['Navigation Label ที่ดีควรเป็นแบบใด','ใช้คำที่ผู้ใช้เข้าใจและคาดเดาปลายทางได้ หลีกเลี่ยงศัพท์ระบบหรือชื่อหน่วยงานที่ไม่บอก task'],
      ['Sitemap ที่ดีควรสะท้อนอะไร','แสดง hierarchy/grouping/navigation ที่ช่วยให้ผู้ใช้คาดตำแหน่งข้อมูลและเส้นทางหลักได้'],
      ['จะ Test Findability อย่างไร','ให้ผู้ใช้หา content/task เป้าหมายจาก navigation แล้ววัดว่าหาถูก ทางไหน และติดตรง label/group ใด']
    ],
    W7:[
      ['Happy Path ควรวางอย่างไร','เชื่อม Start → Action/Decision → Success ให้สั้น ชัด และสอดคล้องกับ User Goal'],
      ['Error/Alternative Path ใดห้ามขาด','เพิ่มทางเมื่อข้อมูลผิด เงื่อนไขไม่พร้อม หรือผู้ใช้เปลี่ยนทาง พร้อม recovery/next step'],
      ['Mobile Content Priority ควรตัดสินจากอะไร','จัดลำดับจาก user goal และ task frequency/importance ไม่ย่อ desktop ทุกอย่างลงมือถือ'],
      ['Low-fi Mobile Wireframe ควรแสดงอะไร','แสดง hierarchy, CTA, content grouping และ flow ที่ทำ task หลักได้บนพื้นที่จำกัด'],
      ['Desktop Adaptation ควรเปลี่ยนเมื่อใด','ปรับ layout เมื่อ content/interaction ต้องการพื้นที่เพิ่ม โดยรักษา task priority และ responsive behavior เดิม']
    ],
    B2:[
      ['Evidence Chain ใดครบที่สุด','เชื่อม Research Evidence → Insight/Problem/HMW → Concept → IA → Flow → Responsive Wireframe'],
      ['Problem Defense ใดป้องกันได้','อธิบาย root cause/problem/HMW จาก evidence พร้อม inclusion/bias check ไม่เริ่มจาก feature'],
      ['IA Defense ใดถูกต้อง','ปกป้อง content grouping, labels, sitemap และ findability จาก mental model/task evidence'],
      ['Flow Defense ใดครบ','มี happy + error/alternative path และอธิบายว่าทำไมเส้นทางนี้ลด friction'],
      ['Responsive Wireframe Defense ใดน่าเชื่อถือ','เชื่อม mobile-first priority → wireframe → desktop adaptation และระบุสิ่งที่จะ test ต่อ']
    ],
    W8:[
      ['Evidence Chain ของ UX Blueprint ขาดตรงไหน','ตรวจว่า Research → Problem → Idea → IA → Flow → Wireframe ย้อนหลักฐานได้ครบ ไม่มีส่วนที่กระโดดจาก assumption'],
      ['Mismatch ใดควรแก้ก่อน','เลือกความไม่สอดคล้องที่กระทบ user goal/task outcome มากที่สุด ไม่ใช่จุดที่ตกแต่งง่ายที่สุด'],
      ['Design Critique ที่มีคุณภาพควรเป็นอย่างไร','ระบุ Evidence/Observation → Impact → Question/Suggestion โดยวิจารณ์งาน ไม่วิจารณ์คน'],
      ['Revision Priority ควรจัดจากอะไร','จัด backlog ตามผลกระทบต่อ task/evidence gap, severity และต้นทุน ไม่ตามคนพูดดังที่สุด'],
      ['Blueprint Defense ใดแข็งแรง','ปกป้อง decision ด้วย evidence chain และบอก limitation/สิ่งที่ต้อง validate ต่อ']
    ],
    W9:[
      ['Visual Tone ควรถูกกำหนดจากอะไร','กำหนดจาก brand/context/user task และ readability ไม่เลือกจากความชอบส่วนตัวอย่างเดียว'],
      ['Design Token ใดควรถูกสร้างก่อนทำ UI ซ้ำ','กำหนด color, typography, spacing/grid และ semantic token ให้มีชื่อ/ความหมายที่ใช้ซ้ำได้'],
      ['Visual Hierarchy ที่ดีทำหน้าที่อะไร','ช่วยให้ผู้ใช้เห็นลำดับข้อมูลและ action สำคัญด้วย type, spacing, grid และ emphasis ที่สม่ำเสมอ'],
      ['Contrast ควรถูกตรวจอย่างไร','ตรวจ text/action/status ในบริบทใช้งานจริงและไม่ใช้สีอย่างเดียวสื่อความหมาย'],
      ['UI Kit Foundations ที่ดีควรแสดงอะไร','ใช้ visual tokens กับ core UI elements อย่างสม่ำเสมอพร้อมกฎ icon/readability ไม่ใช่สะสมหน้าจอสวย']
    ],
    W10:[
      ['Responsive Issue ใดกระทบ Task จริง','เลือกปัญหา layout/content/action ที่ล้น อ่านยาก หรือใช้ไม่ได้เมื่อ viewport/input เปลี่ยน'],
      ['Breakpoint ควรถูกเลือกจากอะไร','เลือกจากจุดที่ content/layout เริ่มเสีย usability ไม่ยึดชื่อรุ่นอุปกรณ์เพียงอย่างเดียว'],
      ['Touch Target ควรถูก Repair อย่างไร','ทำ action แตะได้ชัด มีพื้นที่/ระยะห่างเหมาะสม และไม่บีบเนื้อหาเพียงเพื่อให้พอดีจอ'],
      ['Focus/Form Accessibility ควรตรวจอะไร','ตรวจ keyboard path, visible focus, label/instruction/error association และ semantic structure'],
      ['จะ Verify Accessibility อย่างไร','ตรวจ contrast, keyboard/focus, labels/alt text/semantics และลองทำ task โดยไม่พึ่ง mouse/สีอย่างเดียว']
    ],
    W11:[
      ['UI Duplication ใดควรถูกยกระดับเป็น Component','รวม pattern ที่มี role/behavior ซ้ำเป็น reusable component แทนสร้างเฉพาะหน้า'],
      ['Component Specification ควรบอกอะไร','ระบุ anatomy, purpose, content rule, responsive behavior และ semantic/front-end note ที่ developer ใช้ได้'],
      ['Variant ควรถูกสร้างเมื่อใด','สร้างเมื่อ component role เดิมต้องมีความแตกต่างที่มีเหตุผล ไม่สร้าง variant ตามความชอบทุกหน้า'],
      ['Token/State Mapping ใดห้ามขาด','เชื่อม token กับ default/focus/hover/disabled/loading/error/success ตาม behavior ที่ใช้จริง'],
      ['Implementation Note ใดช่วย Front-end มากที่สุด','อธิบาย naming, semantics, CSS/layout behavior, responsive rule และ state logic ให้ trace กลับ design spec ได้']
    ],
    B3:[
      ['Visual Audit ใดต้องแก้ก่อน','แก้ token/hierarchy/contrast ที่ไม่สม่ำเสมอและกระทบการอ่านหรือ action หลัก'],
      ['Responsive Repair ใดป้องกันได้','ใช้ content-driven breakpoint/flexible layout/touch behavior และแสดงหลักฐานหลาย viewport'],
      ['Accessibility Repair ใดจำเป็น','แก้ keyboard/focus/label/contrast/semantic issue ที่ทำให้ task หลักใช้ไม่ได้'],
      ['Component Defense ใดแข็งแรง','ปกป้อง reusable component, variants, states, naming และ token mapping จาก role/behavior จริง'],
      ['Front-end Handoff Defense ใดครบ','ส่ง visual/responsive/a11y/component specs พร้อม semantics/behavior ที่ลดความคลาดเคลื่อนระหว่าง Figma กับ code']
    ],
    W12:[
      ['Trigger และ Rule ควรถูก Map อย่างไร','ระบุ user/system trigger แล้วกำหนด rule/state transition ที่คาดเดาและทดสอบได้'],
      ['Feedback แบบใดควรเกิด','ให้ feedback ทันเวลาและสื่อสถานะ/ผล/next step หลัง action'],
      ['จะ Prevent Duplicate/Error อย่างไร','ใช้ validation/disabled/loading/constraint ที่ลด error โดยรักษาข้อมูลและทางไปต่อ'],
      ['Microcopy ใดช่วย Recovery','เขียนข้อความสั้น ชัด ระบุปัญหาและ action ที่ผู้ใช้ทำแก้ได้'],
      ['Recovery Path ใดเหมาะ','รักษาบริบท/ข้อมูล ให้แก้เฉพาะจุดและ retry/alternative path โดยไม่เริ่มใหม่ทั้งหมด']
    ],
    W13:[
      ['Prototype ต้องทำ Task ใดให้ทดสอบได้','เชื่อม main task end-to-end ให้คลิกได้จริงและกำหนด success outcome'],
      ['Missing Link ใดต้อง Repair','แก้ dead end/overlay/back/confirm/error path ที่ทำให้ผู้ทดสอบไปต่อไม่ได้'],
      ['States ใดต้อง Verify ใน Prototype','ตรวจ component/interaction states สำคัญและ responsive behavior ไม่ใช่มีแต่ happy-path static screen'],
      ['Behavior Documentation ควรบอกอะไร','บอก trigger, transition/state, constraint, content rule และ prototype limitation ที่ภาพอย่างเดียวอธิบายไม่ได้'],
      ['Handoff Package ใดพร้อมพัฒนา','มี component references, measurements/tokens, assets, responsive rules และ developer notes เชื่อมกับ prototype']
    ],
    W14:[
      ['ควรเลือก Evaluation Method ใด','เลือก Heuristic/Cognitive Walkthrough/Usability Test ให้ตรงคำถามและสิ่งที่ต้องการ evidence'],
      ['Evidence ใดมาจากผู้ใช้จริง','แยก observation/think-aloud/task result จาก expert heuristic finding และ opinion ของทีม'],
      ['Metric ใดตอบผลของ Task','ตีความ task success, time on task, error rate, SUS หรือ metric ที่ตรง outcome ไม่ใช้ตัวเลขที่ไม่ตอบคำถาม'],
      ['Severity ควรถูกจัดจากอะไร','พิจารณาผลกระทบต่อ task ความถี่/ความรุนแรงและ evidence ไม่เรียงจาก fix ที่ทำง่าย'],
      ['Iteration/Retest Plan ใดพิสูจน์ผล','เชื่อม Finding → Fix rationale → Before/After → metric/task เดิม → Retest พร้อม limitation']
    ],
    B4:[
      ['Interaction Defense ใดครบ','เชื่อม trigger/rule → feedback/prevention/microcopy/recovery กับ task และ accessibility'],
      ['Prototype Audit ใดพร้อม','main/error/alternative path และ states คลิกทดสอบได้ พร้อมระบุ prototype limitation'],
      ['Evidence Defense ใดแข็งแรง','แยก evaluation method/finding/metric แล้วใช้หลักฐานสนับสนุน severity และ fix'],
      ['Iteration Defense ใดป้องกันได้','เชื่อม Before → Evidence-based Fix → After → Retest และไม่สรุปเกิน metric'],
      ['Handoff Readiness ใดครบ','มี interaction/prototype specs, evaluation evidence, limitations และ developer handoff checklist']
    ],
    W15:[
      ['Case Study Narrative ควรเริ่มจากอะไร','เริ่ม Problem/Context → Target Users → Research Evidence ก่อนแสดง final UI'],
      ['Evidence Coverage ใดทำให้ Portfolio น่าเชื่อถือ','trace Problem/HMW → IA/Flow → Wireframe → Visual/System → Responsive/A11y → Prototype → Evaluation'],
      ['Iteration ควรถูกเล่าอย่างไร','แสดง Finding/Metric → Before/After Decision → Retest/Outcome พร้อม limitation ไม่โชว์แต่ final screen'],
      ['AI Contribution ควร Disclosure อย่างไร','ระบุ AI tool/contribution, risk/bias/privacy check และ Human Decision/verification อย่างโปร่งใส'],
      ['Professional Readiness ต้องพิสูจน์อะไร','แสดง handoff/front-end readiness, outcome, limitations, reflection และป้องกัน design decisions ด้วย evidence']
    ]
  });

  const WRONG_DEFAULT = [
    'เลือกจากความสวยหรือความชอบของทีมก่อนหลักฐานผู้ใช้',
    'เลือกสิ่งที่ทำง่าย/เร็วที่สุดแม้ไม่เชื่อมกับ user task',
    'เพิ่ม feature หรือ solution ก่อนตรวจ evidence, constraint และผลกระทบ'
  ];
  const WRONG_AI = [
    'ใช้คำตอบแรกจาก AI เป็น final decision โดยไม่ตรวจ evidence',
    'เลือก concept ที่ AI สร้างได้เร็วที่สุดโดยไม่ใช้เกณฑ์',
    'ไม่ต้องบันทึก AI contribution หาก final UI ดูดี'
  ];
  const WRONG_REASONS = [
    'ความชอบของทีมไม่ใช่หลักฐานว่า user outcome ดีขึ้น',
    'ความเร็วในการทำไม่ได้ยืนยันว่า decision ตรงกับ problem/task',
    'การข้าม evidence/validation ทำให้เหตุผลและผลลัพธ์ตรวจสอบย้อนกลับไม่ได้'
  ];

  function stageIndex() {
    const meter = clean($('.hud .meter b')?.textContent || '');
    const m = meter.match(/(\d+)\s*\/\s*(\d+)/);
    return Math.max(0, Math.min(4, Number(m?.[1] || 1) - 1));
  }
  function snapshotNode() {
    return SNAP.nodes.find(node => String(node.id || '').toUpperCase() === NODE) || null;
  }
  function canonicalTask() {
    const node = snapshotNode();
    if (!node) return null;
    const s = stageIndex();
    const guide = GUIDE[NODE]?.[s];
    const round = node.missionRounds?.[s] || `Decision ${s + 1}`;
    return {
      node, stage:s, round,
      prompt:guide?.[0] || `${node.title}: ${round} — ข้อใดสอดคล้องกับหลักฐานและเป้าหมายผู้ใช้มากที่สุด`,
      correct:guide?.[1] || `เลือกแนวทางที่เชื่อม ${round} กับ evidence, user task และผลที่ตรวจสอบได้`,
      reason:node.reasonChecks?.[s % Math.max(1,node.reasonChecks?.length || 1)] ||
        `เหตุผลต้องเชื่อม ${round} กับ evidence และ user outcome`
    };
  }
  function wrongChoices(node) {
    const ai = (node?.concepts || []).some(c => /AI-assisted|AI contribution|Bias|Privacy|Transparency/i.test(String(c)));
    return ai ? WRONG_AI : WRONG_DEFAULT;
  }
  const isCorrectChoice = btn => /^c\d*/i.test(String(btn.getAttribute('data-choice') || ''));
  function wrongChoiceIndex(btn) {
    const id = String(btn.getAttribute('data-choice') || '');
    const m = id.match(/^d\d+-(\d+)/i);
    return m ? Number(m[1]) % 3 : 0;
  }
  function isCorrectReason(btn) {
    const id = String(btn.getAttribute('data-reason') || '');
    return /-0$/.test(id) || /correct/i.test(id);
  }
  function wrongReasonIndex(btn) {
    const id = String(btn.getAttribute('data-reason') || '');
    const m = id.match(/-(\d+)$/);
    return m ? Math.max(0, Number(m[1]) - 1) % 3 : 0;
  }
  function setOption(btn, label, helper='') {
    const b = $('b',btn), span = $('span',btn);
    if (b && clean(b.textContent) !== label) b.textContent = label;
    else if (!b && clean(btn.textContent) !== label) btn.textContent = label;
    if (span) {
      const value = helper || '';
      if (clean(span.textContent) !== value) span.textContent = value;
    }
  }

  function applyQuestion() {
    if (NODE === 'W12') return; // dedicated canonical W12 v4 is the owner.
    const task = canonicalTask();
    const q = $('.question');
    if (!task || !q || $('.feedback',q)) return;
    const prompt = $('.prompt',q), instruction = $('.instruction',q);
    const note = `${task.node.casePrompt || task.node.bossScenario || task.node.focus} • Canonical round: ${task.round}`;
    if (prompt && clean(prompt.textContent) !== task.prompt) prompt.textContent = task.prompt;
    if (instruction && clean(instruction.textContent) !== clean(note)) instruction.textContent = note;
    const wrong = wrongChoices(task.node);
    $$(':scope > .options .option[data-choice]',q).slice(0,4).forEach(btn => {
      const label = isCorrectChoice(btn) ? task.correct : wrong[wrongChoiceIndex(btn)];
      setOption(btn,label,isCorrectChoice(btn) ? 'เชื่อมกับ Canonical concept และหลักฐานของรอบนี้' : 'กับดัก: ไม่ trace กลับไปหา evidence/user task');
    });
    q.dataset.uxqCanonicalOwner = `${VERSION}-${NODE}-${task.stage}`;
  }

  function applyReason() {
    if (NODE === 'W12') return;
    const task = canonicalTask();
    const box = $('.verify');
    if (!task || !box) return;
    const h = $('h3',box), intro = $('p',box);
    if (h) h.textContent = `Reason Check • ${task.round}`;
    if (intro) intro.textContent = `อธิบายด้วยหลักฐาน: ${task.reason}`;
    $$('.option[data-reason]',box).slice(0,4).forEach(btn => {
      const label = isCorrectReason(btn)
        ? `${task.reason} — เหตุผลต้อง trace จาก evidence ไปยัง decision และ user/task outcome`
        : WRONG_REASONS[wrongReasonIndex(btn)];
      setOption(btn,label,'');
    });
    box.dataset.uxqCanonicalReasonOwner = `${VERSION}-${NODE}-${task.stage}`;
  }

  const W12_STABLE_PROMPTS = [
    'Trigger และ Rule ของ interaction นี้ควรกำหนดอย่างไร',
    'Feedback แบบใดควรเกิดหลัง action นี้',
    'วิธีใดป้องกัน duplicate action หรือ error ได้ตรงที่สุด',
    'Microcopy ใดช่วยให้ผู้ใช้เข้าใจและแก้ปัญหาได้จริง',
    'Recovery path ใดช่วยให้ผู้ใช้กลับไปทำ task ต่อได้'
  ];
  function installW12StableStyle() {
    if (NODE !== 'W12' || $('#uxqW12CanonicalStableStyleV4')) return;
    const style = document.createElement('style');
    style.id = 'uxqW12CanonicalStableStyleV4';
    style.textContent = `
      body[data-uxq-node="W12"] .question .prompt[data-uxq-w12-canonical-owner="true"]{
        position:relative!important;display:block!important;min-height:1.55em!important;
        font-size:0!important;line-height:0!important;color:transparent!important;
        animation:none!important;transition:none!important;
      }
      body[data-uxq-node="W12"] .question .prompt[data-uxq-w12-canonical-owner="true"]::after{
        content:attr(data-uxq-w12-canonical-prompt)!important;display:block!important;
        color:#f4f7ff!important;font-size:clamp(1.45rem,2.3vw,2rem)!important;
        font-weight:800!important;line-height:1.25!important;white-space:normal!important;
      }`;
    document.head.appendChild(style);
  }
  function applyW12StablePrompt() {
    if (NODE !== 'W12') return;
    document.body.setAttribute('data-uxq-node','W12');
    const prompt = $('.question .prompt');
    if (!prompt) return;
    prompt.setAttribute('data-uxq-w12-canonical-owner','true');
    prompt.setAttribute('data-uxq-w12-canonical-prompt',W12_STABLE_PROMPTS[stageIndex()] || W12_STABLE_PROMPTS[0]);
  }

  let visibleActive = false;
  let observer = null;
  let timer = 0;
  function run() {
    restoreCanonicalMetadata();
    if (!visibleActive) return;
    applyQuestion();
    applyReason();
    installW12StableStyle();
    applyW12StablePrompt();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(run,20);
  }
  function activateVisible() {
    if (visibleActive) return;
    visibleActive = true;
    run();
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('click',schedule,true);
    window.addEventListener('uxq-round-changed',schedule);
    window.addEventListener('uxq-question-rendered',schedule);
  }

  restoreCanonicalMetadata();
  window.CSAI2601_UXQ_CANONICAL_FINAL_AUTHORITY_V3 = Object.freeze({
    version:VERSION,
    order:Object.freeze(SNAP.nodes.map(node => node.id)),
    restoreCanonicalMetadata,
    activateVisible,
    run
  });
})();