/* CSAI2601 UX Quest • Artifact Identity v1
 * Rewrites the post-game debrief so W1-W15 and B1-B4 do not all use the same
 * "ปัญหา → เหตุผล → วิธีแก้" template.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const txt = (el) => String(el?.textContent || '').trim();
  const qp = () => new URLSearchParams(location.search || '');
  const nodeId = () => String(qp().get('node') || qp().get('id') || 'W1').toUpperCase();

  const cfg = {
    W1:{ icon:'🔎', title:'Friction Scan Debrief', banner:'สรุปแบบนักสแกน UX: Friction → User goal → Proof', fields:['1) Friction ที่พบ','2) User goal ที่ถูกกระทบ','3) Proof / วิธีทดสอบ'], placeholders:['ผู้ใช้ติดตรงไหนใน task นี้','ผู้ใช้ต้องการทำอะไรให้สำเร็จ','จะวัด task success / เวลา / error อย่างไร'], chips:[['หาเมนูไม่เจอ','ปุ่มหลักไม่เด่น','feedback ไม่ชัด','ข้อมูลเยอะเกินไป'],['ทำงานหลักไม่สำเร็จ','ไม่เห็นขั้นตอนถัดไป','ต้องเดาเอง','เสียเวลา'],['ลองทำ task เดิม','วัด task success','จับเวลา','นับ error']]},
    W2:{ icon:'🧭', title:'HCD Evidence Lab Debrief', banner:'สรุปแบบ HCD: Assumption → Evidence → Small test', fields:['1) Assumption / Risk ของทีม','2) Evidence ที่ควรเก็บ','3) Small test ถัดไป'], placeholders:['ทีมกำลังเดาอะไรโดยยังไม่มีหลักฐาน','ควรสัมภาษณ์/สังเกต/ทดสอบอะไรกับผู้ใช้','ให้ผู้ใช้ทำ task ใดเพื่อเช็กสมมติฐาน'], chips:[['ทีมเดา solution','ฟัง stakeholder เดียว','เริ่ม prototype เร็วไป','เข้าใจผู้ใช้ไม่ครบ'],['สัมภาษณ์ผู้ใช้','สังเกต task','card sorting','tree test'],['ลองทำ task จริง','ถามเหตุผลหลังทำ','เทียบก่อน-หลัง','เก็บ pain point']]},
    W3:{ icon:'🧠', title:'Psychology Signal Debrief', banner:'สรุปแบบจิตวิทยา UI: Concept → Cognitive load → Repair', fields:['1) Psychology concept','2) ภาระ/ความสับสนของผู้ใช้','3) Repair + validate'], placeholders:['เช่น mental model, feedback, attention, working memory','ผู้ใช้ต้องจำ/เดา/ตัดสินใจมากเกินไปตรงไหน','จะแก้และให้ผู้ใช้ลอง task เดิมอย่างไร'], chips:[['mental model','feedback','attention','working memory'],['ต้องจำเอง','ตัวเลือกเยอะ','ไม่เห็นสถานะ','เข้าใจคำผิด'],['ลด load','เพิ่ม feedback','ใช้คำผู้ใช้','validate task เดิม']]},
    W4:{ icon:'🕵️', title:'Research Detective Note', banner:'สรุปแบบนักวิจัย: Question → Pain point → Persona need', fields:['1) Research question','2) Pain point จากหลักฐาน','3) Persona need / observation ต่อ'], placeholders:['คำถามไม่ชี้นำที่ควรถาม','pain point ที่เห็นจากข้อมูลผู้ใช้','need ของ persona และจะสังเกตอะไรต่อ'], chips:[['ถามไม่ชี้นำ','สังเกต task','interview','context inquiry'],['เสียเวลา','ติดขั้นตอน','ไม่มั่นใจ','หาไม่เจอ'],['need ชัดเจน','persona ใหม่','observe ต่อ','เก็บ evidence เพิ่ม']]},
    W5:{ icon:'💡', title:'Problem/HMW Studio Sheet', banner:'สรุปแบบ Define: Insight → Root cause → HMW', fields:['1) Insight','2) Root cause / Problem statement','3) HMW / Concept direction'], placeholders:['insight จากผู้ใช้คืออะไร','สาเหตุหลักและ problem statement คืออะไร','How Might We และแนวคิดแก้เบื้องต้น'], chips:[['insight จริง','ไม่ใช่ observation ผิวเผิน','user need','pain point'],['root cause','problem statement','เฉพาะเจาะจง','ไม่กว้างเกินไป'],['HMW เปิดกว้าง','ไม่ล็อก solution','concept ทดสอบได้','prototype idea']]},
    W6:{ icon:'🗺️', title:'Flow Mapper Sheet', banner:'สรุปแบบ Flow: Group → Navigation → Error path', fields:['1) IA / sitemap group','2) Happy path / navigation','3) Error path / bottleneck'], placeholders:['ควรจัดกลุ่มข้อมูลอย่างไร','ผู้ใช้เริ่มตรงไหนและเดิน flow อย่างไร','ถ้าติดขัดจะ recovery อย่างไร'], chips:[['จัดตาม mental model','sitemap group','task group','ลดเมนูซ้ำ'],['navigation entry','happy path','ยืนยันสถานะ','next step'],['error path','recovery','bottleneck','ลดการย้อนกลับ']]},
    W7:{ icon:'📐', title:'Wireframe Priority Sheet', banner:'สรุปแบบ Wireframe: Priority → Layout → CTA/Mobile', fields:['1) Visual priority','2) Layout decision','3) CTA / Mobile adjustment'], placeholders:['อะไรควรเด่นที่สุดบนหน้าจอ','layout ใดรองรับ goal และ content hierarchy','CTA และ mobile layout ควรปรับอย่างไร'], chips:[['priority แรก','ข้อมูลหลัก','status สำคัญ','ลดสิ่งรบกวน'],['card layout','stepper','sticky CTA','comparison'],['primary CTA','mobile-first','touch target','ลดการซูม']]},
    W8:{ icon:'🧩', title:'Midterm Blueprint Review', banner:'สรุปแบบ Blueprint: Evidence chain → Mismatch → Revision', fields:['1) Evidence chain','2) Mismatch ที่พบ','3) Revision priority'], placeholders:['problem-persona-flow-wireframe เชื่อมกันไหม','ส่วนใดไม่ตรงกัน','ควรแก้อะไรก่อนและเพราะอะไร'], chips:[['problem','persona','flow','wireframe'],['persona ไม่ตรง flow','evidence gap','wireframe ไม่ตอบ problem','rationale ขาด'],['แก้ก่อน','revision plan','before/after','priority']]},
    W9:{ icon:'🧱', title:'Pattern Matrix Note', banner:'สรุปแบบ Design System: Component → State → Rule', fields:['1) Component / pattern issue','2) States / variants ที่ต้องมี','3) Naming / system rule'], placeholders:['component ใดซ้ำหรือไม่สม่ำเสมอ','state ใดจำเป็นต่อการใช้งาน','ตั้งชื่อและ rule อย่างไร'], chips:[['button','input','card','alert'],['default','focus','error','disabled'],['naming rule','variant','consistency','UI kit']]},
    W10:{ icon:'📱', title:'Responsive/A11y Audit', banner:'สรุปแบบ Audit: Responsive issue → A11y issue → Fix/check', fields:['1) Responsive issue','2) Accessibility issue','3) Fix + check'], placeholders:['ปัญหาบนมือถือคืออะไร','contrast/focus/label/touch target ติดตรงไหน','จะแก้และตรวจ task อย่างไร'], chips:[['ตารางล้นจอ','ปุ่มเล็ก','ต้องซูม','layout ไม่ยืดหยุ่น'],['contrast','focus','label','touch target'],['mobile-first','card list','keyboard test','contrast check']]},
    W11:{ icon:'🎨', title:'Visual Signal Guide', banner:'สรุปแบบ Visual: Color → Type → Accessibility', fields:['1) Color/status meaning','2) Typography/spacing hierarchy','3) Contrast/accessibility decision'], placeholders:['สีสื่อความหมายผิดไหม','ลำดับตัวอักษร/spacing ช่วยอ่านอย่างไร','contrast และ visual accessibility ผ่านไหม'], chips:[['error','success','warning','CTA'],['heading','body','status','spacing scale'],['contrast','readability','ไม่ใช้สีอย่างเดียว','style token']]},
    W12:{ icon:'⚡', title:'Interaction State Spec', banner:'สรุปแบบ Interaction: State → Microcopy → Recovery', fields:['1) Component state','2) Feedback / microcopy','3) Recovery / prevention'], placeholders:['ต้องมี loading/error/success/empty state ใด','ข้อความควรบอกอะไรให้ผู้ใช้มั่นใจ','จะกันกดซ้ำหรือช่วยกลับมาแก้ได้อย่างไร'], chips:[['loading','disabled','error','success'],['microcopy','receipt','next step','status'],['recovery','prevent double submit','try again','ไม่เริ่มใหม่']]},
    W13:{ icon:'🔗', title:'Prototype Link Check', banner:'สรุปแบบ Prototype: Task → Link → Error path', fields:['1) Testable task','2) Missing link / interaction','3) Error path / rationale'], placeholders:['prototype ทดสอบ task ใดได้จริง','link/state/modal ใดขาด','error path และ rationale คืออะไร'], chips:[['main task','scenario','clickable flow','prototype goal'],['missing link','modal','overlay','state'],['error path','recovery','rationale','testable']]},
    W14:{ icon:'🧪', title:'Usability Iteration Log', banner:'สรุปแบบ Evidence Lab: Finding → Severity → Retest', fields:['1) Test evidence / finding','2) Severity decision','3) Evidence-based fix + retest'], placeholders:['หลักฐานจากผู้ใช้บอกอะไร','severity สูง/กลาง/ต่ำเพราะอะไร','จะแก้และ retest task เดิมอย่างไร'], chips:[['task failure','user quote','time on task','error'],['high severity','medium severity','blocker','confusion'],['fix','before/after','retest','วัดผลซ้ำ']]},
    W15:{ icon:'🏁', title:'Portfolio Defense Prep', banner:'สรุปแบบ Portfolio: Narrative → Evidence → Proof', fields:['1) Case narrative','2) Evidence gap / design decision','3) Testing proof / presentation defense'], placeholders:['story ของ case study เริ่มจากอะไร','หลักฐานใดเชื่อม decision','จะป้องกันงานด้วย proof อะไร'], chips:[['problem','user','process','story'],['evidence gap','design decision','usability finding','iteration'],['before/after','testing proof','presentation','reflection']]},
    B1:{ icon:'👹', title:'Boss B1 Defense Sheet', banner:'Boss B1: UI/UX + HCD + Psychology + Proof', fields:['1) UX issue หลัก','2) HCD/Psychology evidence','3) Fix + proof'], placeholders:['ปัญหาหลักที่กระทบ task','หลักฐานผู้ใช้และหลัก psychology ที่เกี่ยวข้อง','จะแก้และพิสูจน์อย่างไร'], chips:[['UI issue','UX friction','task fail','next step'],['HCD evidence','mental model','feedback','cognitive load'],['fix','task success','time','error']]},
    B2:{ icon:'🐉', title:'Boss B2 Chain Defense', banner:'Boss B2: Evidence → Problem → Flow → Wireframe', fields:['1) Persona/problem chain','2) Flow/wireframe chain','3) Defense / test idea'], placeholders:['persona และ problem เชื่อมหลักฐานไหม','flow และ wireframe เชื่อมกันอย่างไร','จะป้องกันและทดสอบ chain นี้อย่างไร'], chips:[['persona','problem','HMW','insight'],['IA','happy path','error path','wireframe'],['defense','test idea','priority','CTA']]},
    B3:{ icon:'🛡️', title:'Boss B3 Interface Defense', banner:'Boss B3: Pattern + Responsive + Accessibility', fields:['1) Pattern/system issue','2) Responsive/accessibility issue','3) System defense'], placeholders:['component/state/naming มีปัญหาอะไร','mobile/a11y กระทบ task อย่างไร','จะป้องกันระบบ interface อย่างไร'], chips:[['component','state','variant','naming'],['responsive','contrast','focus','touch target'],['consistency','a11y evidence','system rule','visual token']]},
    B4:{ icon:'🔥', title:'Boss B4 Validation Defense', banner:'Boss B4: State → Prototype → Evidence → Retest', fields:['1) State/prototype issue','2) Usability evidence/severity','3) Fix + retest defense'], placeholders:['state หรือ prototype flow ขาดตรงไหน','หลักฐานทดสอบและ severity คืออะไร','fix และ retest จะพิสูจน์อย่างไร'], chips:[['state','prototype link','error path','microcopy'],['finding','severity','task failure','evidence'],['fix','before/after','retest','iteration']]}
  };

  function nodeCfg() { return cfg[nodeId()] || cfg.W1; }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function chipButton(text, target) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'uxq-quick-chip';
    btn.textContent = text;
    btn.addEventListener('click', () => {
      const area = document.querySelector(`.artifact textarea[data-debrief-index="${target}"]`);
      if (!area) return;
      const value = area.value.trim();
      area.value = value ? `${value}, ${text}` : text;
      area.dispatchEvent(new Event('input', { bubbles: true }));
      area.focus();
    });
    return btn;
  }
  function chipRow(title, chips, target) {
    const wrap = document.createElement('div');
    wrap.className = 'uxq-chip-row';
    const b = document.createElement('b');
    b.textContent = title;
    const list = document.createElement('div');
    list.className = 'uxq-chip-list';
    chips.forEach((chip) => list.appendChild(chipButton(chip, target)));
    wrap.appendChild(b);
    wrap.appendChild(list);
    return wrap;
  }

  function apply() {
    const artifact = $('.artifact');
    if (!artifact) return;
    const id = nodeId();
    if (artifact.dataset.artifactIdentity === id) return;
    const c = nodeCfg();

    const kicker = $('.kicker', artifact);
    if (kicker) kicker.textContent = `${c.icon} ${id} • ภารกิจหลังเล่น`;
    const h2 = $('h2', artifact);
    if (h2) h2.textContent = c.title;
    const intro = $('p:not(.kicker)', artifact);
    if (intro) intro.textContent = 'เลือกชิปช่วยสรุปได้ แล้วเติมเป็นประโยคสั้น ๆ ให้ตรงกับภารกิจของด่านนี้';

    const banner = $('[data-playful-debrief]', artifact) || $('.uxq-debrief-banner', artifact);
    if (banner) banner.innerHTML = `<span>${c.icon} ${id} Mission Debrief</span><b>${c.banner}</b>`;

    const labels = $$('label', artifact);
    labels.forEach((label, index) => {
      const b = $('b', label);
      const area = $('textarea', label);
      if (!area) return;
      if (index < 3) {
        label.classList.add('uxq-main-debrief-field');
        if (b) b.textContent = c.fields[index] || `ช่องที่ ${index + 1}`;
        area.placeholder = c.placeholders[index] || '';
        area.dataset.debriefIndex = String(index);
        area.rows = 2;
        label.style.display = 'grid';
      } else {
        label.classList.add('uxq-extra-field');
      }
    });

    let panel = $('[data-chip-panel]', artifact);
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'uxq-chip-panel';
      panel.setAttribute('data-chip-panel', '1');
      const firstLabel = $('label', artifact);
      if (firstLabel) artifact.insertBefore(panel, firstLabel);
      else artifact.appendChild(panel);
    }
    clear(panel);
    c.chips.forEach((chips, i) => panel.appendChild(chipRow(c.fields[i] || `ช่องที่ ${i + 1}`, chips, i)));

    const saveBtn = $('[data-save-artifact]', artifact);
    if (saveBtn) saveBtn.textContent = `บันทึก ${id} Debrief`;
    artifact.dataset.artifactIdentity = id;
  }

  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(apply, 30); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
