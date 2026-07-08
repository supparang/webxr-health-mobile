// === /sgnal-hunt/js/uxq-csai2601-item-bank-w8-w15-v1.js ===
// CSAI2601 UX Quest Item Banks: W8-W15, 40 cases per weekly node.
(function () {
  'use strict';
  const VERSION = 'v20260708-w8-w15-320cases';
  const content = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  if (!content || !Array.isArray(content.nodes)) return;

  const configs = {
    W8: {
      contexts: ['UX Blueprint ระบบบริการนักศึกษา','Blueprint ระบบจองบริการมหาวิทยาลัย','Blueprint ระบบยืมอุปกรณ์','Blueprint เว็บทุนการศึกษา','Blueprint LMS รายวิชา','Blueprint ระบบคำร้องออนไลน์','Blueprint ระบบสมัครกิจกรรม','Blueprint ระบบห้องสมุด','Blueprint ระบบตารางสอบ','Blueprint ระบบแนะแนวอาชีพ'],
      issues: ['persona ไม่ตรงกับ user flow','problem statement ไม่ตรงกับ wireframe','wireframe ไม่มี evidence รองรับ','revision plan เลือกแก้จุดที่ไม่กระทบ task'],
      make(ctx, issue, i, j) { return { context:ctx, issue, evidenceChain:`Problem → Persona → Flow → Wireframe ต้องเชื่อมกันใน ${ctx}`, mismatch:issue, critiquePriority:j === 0 ? 'แก้ persona-flow mismatch ก่อน เพราะทำให้ flow ผิดผู้ใช้' : j === 1 ? 'แก้ problem-wireframe mismatch ก่อน เพราะหน้าจอไม่ตอบปัญหาหลัก' : j === 2 ? 'เติม evidence ก่อนป้องกัน design decision ลอย' : 'จัดลำดับ revision ตามผลต่อ task success', revision:`ปรับ blueprint รอบ ${j + 1} โดยระบุ before/after และหลักฐานรองรับ`, rationale:'ใช้ critique จาก evidence ไม่ใช่ความชอบส่วนตัว' }; }
    },
    W9: {
      contexts: ['UI kit ระบบบริการนักศึกษา','Pattern library ระบบคำร้อง','Design system LMS','UI kit เว็บทุน','Pattern library ระบบจองห้อง','ระบบปุ่ม/ฟอร์มสมัครกิจกรรม','UI kit ห้องสมุด','ระบบแจ้งซ่อม','เว็บตารางสอบ','ระบบแนะแนวอาชีพ'],
      issues: ['primary/secondary button ใช้สีปนกัน','form error state ไม่สม่ำเสมอ','card component มี spacing และชื่อไม่เป็นระบบ','navigation/alert ใช้ style ไม่ตรงความหมาย'],
      make(ctx, issue, i, j) { return { context:ctx, issue, component:j === 0 ? 'Button' : j === 1 ? 'Form input' : j === 2 ? 'Card' : 'Navigation / Alert', inconsistency:issue, state:j === 0 ? 'default/hover/focus/disabled/loading' : j === 1 ? 'default/focus/error/success/help' : j === 2 ? 'default/selected/empty/loading' : 'default/active/warning/error/success', naming:`ใช้ชื่อ pattern แบบ role-purpose-state ใน ${ctx}`, systemRule:'รวม pattern ซ้ำ ลด variant ที่ไม่มีความหมาย และกำหนด state ให้ครบ' }; }
    },
    W10: {
      contexts: ['หน้าลงทะเบียนบนมือถือ','ฟอร์มสมัครกิจกรรม','ตารางสอบ responsive','ระบบจองห้องบนมือถือ','เว็บทุนบนมือถือ','LMS assignment mobile','ห้องสมุด mobile search','ระบบคำร้อง responsive','หน้าโปรไฟล์นักศึกษา','dashboard คะแนนบนมือถือ'],
      issues: ['ตารางล้นจอบนมือถือ','ปุ่มเล็กกดพลาด','contrast ต่ำอ่าน error ไม่ออก','ไม่มี keyboard focus/label ชัดเจน'],
      make(ctx, issue, i, j) { return { context:ctx, issue, responsiveIssue:j <= 1 ? issue : 'layout ไม่ปรับตามขนาดหน้าจอ', a11yIssue:j >= 2 ? issue : 'touch target และ focus state ต้องชัด', breakpoint:'ใช้ mobile-first แล้วแตก layout เมื่อเนื้อหาเริ่มอ่านยาก ไม่ใช่ตาม device รุ่นเดียว', fix:j === 0 ? 'เปลี่ยนตารางเป็น card/list ที่อ่านทีละรายการได้' : j === 1 ? 'เพิ่ม touch target และระยะห่างปุ่ม' : j === 2 ? 'เพิ่ม contrast และข้อความ error ใกล้ช่องที่ผิด' : 'เพิ่ม label, focus state และ keyboard path', check:'ตรวจ task บนมือถือ + keyboard + contrast ก่อนผ่าน' }; }
    },
    W11: {
      contexts: ['แอปสุขภาพนักศึกษา','เว็บสมัครเรียน','dashboard คะแนน','ระบบแจ้งเตือนทุน','LMS course page','ระบบห้องสมุด','ระบบคำร้องออนไลน์','เว็บกิจกรรม','หน้า profile','ระบบแจ้งซ่อม'],
      issues: ['สีแดงถูกใช้ทั้ง error และ CTA','font เล็กและ hierarchy ไม่ชัด','contrast ต่ำในป้ายสถานะ','spacing ไม่สม่ำเสมอจนอ่านยาก'],
      make(ctx, issue, i, j) { return { context:ctx, issue, colorIssue:j === 0 || j === 2 ? issue : 'status color ไม่สื่อความหมาย', typographyIssue:j === 1 ? issue : 'หัวข้อ เนื้อหา และคำเตือนไม่แยกชั้น', contrast:j === 2 ? 'ต้องผ่าน contrast สำหรับข้อความสำคัญ' : 'ต้องใช้สีไม่แทนความหมายเพียงอย่างเดียว', spacing:j === 3 ? 'กำหนด spacing scale ให้กลุ่มข้อมูลอ่านเป็นชุด' : 'ใช้ spacing เพื่อแบ่งกลุ่มและลด cognitive load', visualDecision:'กำหนด color token, type scale และ status meaning ก่อนทำภาพสวย' }; }
    },
    W12: {
      contexts: ['ส่งคำร้องออนไลน์','ค้นหาข้อมูลว่าง','ชำระเงินกิจกรรม','อัปโหลดงาน','จองห้องประชุม','สมัครทุน','ส่งแบบฟอร์มสุขภาพ','ระบบรีเซ็ตรหัสผ่าน','จองคิวอาจารย์','แจ้งซ่อมห้องเรียน'],
      issues: ['กดซ้ำเพราะไม่มี loading/disabled state','empty state ไม่บอกทางไปต่อ','error message กว้างและไม่บอกวิธีแก้','success feedback ไม่ให้ receipt หรือ next step'],
      make(ctx, issue, i, j) { return { context:ctx, issue, stateIssue:j === 0 ? 'loading + disabled state' : j === 1 ? 'empty state' : j === 2 ? 'error state' : 'success state', feedback:issue, microcopy:j === 2 ? 'บอกว่าผิดตรงไหน ทำไม และแก้อย่างไร' : j === 1 ? 'บอกว่าทำไมว่างและควรเริ่มตรงไหน' : 'บอกสถานะปัจจุบันและขั้นตอนถัดไป', prevention:j === 0 ? 'disable ปุ่มระหว่างส่งและกัน double submit' : 'ออกแบบ state ให้ผู้ใช้ไม่ทำผิดซ้ำ', recovery:'ให้ทางกลับ/แก้ไข/ลองใหม่โดยไม่ต้องเริ่มทั้งหมด' }; }
    },
    W13: {
      contexts: ['Prototype จองบริการ','Prototype form คำร้อง','Prototype สมัครกิจกรรม','Prototype LMS assignment','Prototype ห้องสมุด','Prototype เว็บทุน','Prototype จองคิว','Prototype dashboard คะแนน','Prototype แจ้งซ่อม','Prototype portfolio flow'],
      issues: ['ปุ่ม confirm ไม่มี destination','error path ไม่สามารถกลับไปแก้ได้','modal/overlay ปิดไม่ได้หรือ state หาย','flow หลักยังคลิกทดสอบไม่ได้ครบ'],
      make(ctx, issue, i, j) { return { context:ctx, issue, task:`ทดสอบ main task ของ ${ctx}`, missingLink:j === 0 || j === 3 ? issue : 'interactive link ยังไม่ครบ main flow', interaction:j === 2 ? issue : 'state และ transition ต้องบอกผลหลังคลิก', errorPath:j === 1 ? issue : 'ต้องมี alternative/error path อย่างน้อย 1 ทาง', rationale:'prototype ต้องทดสอบ task จริงได้ ไม่ใช่ภาพ mockup เฉย ๆ' }; }
    },
    W14: {
      contexts: ['Usability test ระบบบริการ','Walkthrough ระบบคำร้อง','Test prototype จองห้อง','Test LMS assignment','Test เว็บทุน','Test ห้องสมุด','Test ระบบแจ้งซ่อม','Test dashboard คะแนน','Test สมัครกิจกรรม','Test portfolio prototype'],
      issues: ['3 ใน 5 คนหา submit ไม่เจอ','ผู้ใช้เข้าใจคำว่า verify ผิด','ใช้เวลานานเพราะ flow วนกลับ','error ทำให้ผู้ใช้ไปต่อไม่ได้'],
      make(ctx, issue, i, j) { return { context:ctx, issue, evidence:`หลักฐานทดสอบ: ${issue}`, finding:j === 0 ? 'finding จาก task failure หลายคน' : j === 1 ? 'finding จาก wording/mental model' : j === 2 ? 'finding จาก time on task สูง' : 'finding จาก blocker ที่หยุด task', severity:j === 3 || j === 0 ? 'high ถ้าทำให้ task ไม่สำเร็จ' : 'medium ถ้าทำให้ช้า/สับสนแต่ยังไปต่อได้', fix:j === 1 ? 'แก้ microcopy แล้ว retest ความเข้าใจ' : 'แก้ flow/CTA/state ตาม evidence', retest:'ให้ผู้ใช้ทำ task เดิมอีกครั้ง แล้วเทียบ success/time/error' }; }
    },
    W15: {
      contexts: ['Portfolio review ระบบบริการนักศึกษา','Case study เว็บทุน','Portfolio UX LMS','Final presentation ระบบคำร้อง','Case study ระบบจองห้อง','Portfolio ห้องสมุด','Presentation ระบบสมัครกิจกรรม','Case study แจ้งซ่อม','Portfolio dashboard คะแนน','Final UX/UI case study'],
      issues: ['มี final UI แต่ไม่มี problem/evidence','decision ไม่เชื่อม usability finding','story เล่าแต่ภาพสวย ไม่เล่ากระบวนการ','testing proof ไม่ชัดใน presentation'],
      make(ctx, issue, i, j) { return { context:ctx, issue, narrative:'เล่า problem → user → evidence → decision → design → test → iteration', evidenceGap:j === 0 || j === 2 ? issue : 'ขาดหลักฐานเชื่อมการตัดสินใจ', storyOrder:'เริ่มจากปัญหาและผู้ใช้ก่อนโชว์ final UI', proof:j === 3 ? issue : 'ใช้ usability finding / before-after / task result เป็น proof', defense:'อธิบายว่าทำไมตัดสินใจออกแบบแบบนี้จากหลักฐาน ไม่ใช่ความชอบ' }; }
    }
  };

  function pad(n) { return String(n).padStart(3, '0'); }
  function buildCases(id, cfg) {
    const out = [];
    cfg.contexts.forEach((ctx, i) => cfg.issues.forEach((issue, j) => {
      const n = (i * cfg.issues.length) + j + 1;
      out.push(Object.assign({ id:`${id}-C${pad(n)}`, context:ctx, issue, variant:j + 1 }, cfg.make(ctx, issue, i, j)));
    }));
    return out;
  }
  function uniqById(list) {
    const seen = new Set();
    return (list || []).filter((item) => { const id = String(item && item.id || '').trim(); if (!id || seen.has(id)) return false; seen.add(id); return true; });
  }
  const counts = {};
  Object.keys(configs).forEach((id) => {
    const node = content.nodes.find((n) => String(n.id || '').toUpperCase() === id);
    if (!node) return;
    const cases = buildCases(id, configs[id]);
    node.seedCases = uniqById(cases.concat(Array.isArray(node.seedCases) ? node.seedCases : []));
    node.itemBankVersion = VERSION;
    node.minReplayCases = 40;
    node.targetReplayCases = 40;
    counts[id] = cases.length;
  });
  window.CSAI2601_UXQ_ITEM_BANK_W8_W15_V1 = Object.freeze({ version:VERSION, counts });
})();
