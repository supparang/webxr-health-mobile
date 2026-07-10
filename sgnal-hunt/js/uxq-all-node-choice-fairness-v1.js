/* CSAI2601 UX Quest • All-node Choice Fairness Guard v2
   Scope: W1-W15 and B1-B4.
   Fix: v1 over-normalized choices and made repeated generic distractors.
   v2 keeps scoring ids intact, but rewrites visible labels by stage role:
   - correct button = data-choice starts with c
   - distractors = data-choice starts with d
   - labels are short, balanced, and stage-specific
*/
(() => {
  'use strict';

  const VERSION = 'v20260709-choice-fairness-stage-aware-v2';
  const qs = new URLSearchParams(location.search);
  const NODE = String(qs.get('node') || qs.get('id') || 'W1').toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(NODE)) return;

  const escText = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const lower = (v) => escText(v).toLowerCase();

  const nodeFallback = {
    W1: ['เลือก friction จาก task', 'เลือกจากความสวย', 'เลือกจากเสียงทีม', 'เลือกที่แก้ง่ายสุด'],
    W2: ['ใช้ evidence ก่อนออกแบบ', 'เดาจากความรู้สึก', 'ทำ wireframe ทันที', 'เลือกตามโจทย์ทีม'],
    W3: ['ลด load ที่ทำให้พลาด', 'เพิ่มสีให้ดูน่าสนใจ', 'ใส่ข้อความทุกจุด', 'ปล่อยให้ผู้ใช้เดา'],
    W4: ['ถามเพื่อหา evidence', 'ถามเพื่อยืนยันไอเดีย', 'ถามกว้างเกินไป', 'ถามตามใจทีม'],
    W5: ['เขียน problem จาก insight', 'เขียน solution ก่อน', 'เขียนกว้างเกินไป', 'เขียนตาม feature'],
    W6: ['จัด flow ตาม task', 'ใส่ทุกเมนูหน้าแรก', 'ข้าม error path', 'จัดตามเมนูเดิม'],
    W7: ['จัด priority ตาม goal', 'ทำทุกอย่างเด่นเท่ากัน', 'ซ่อน action สำคัญ', 'เน้นภาพก่อนงาน'],
    W8: ['ต่อ chain จาก evidence', 'แก้จากความชอบ', 'ข้าม mismatch', 'สรุปโดยไม่มี proof'],
    W9: ['ใช้ pattern เดียวกัน', 'สร้างปุ่มใหม่ทุกหน้า', 'ใช้ชื่อไม่สม่ำเสมอ', 'ไม่กำหนด state'],
    W10:['ปรับ layout ตามจอ', 'ย่อทุกอย่างให้เล็ก', 'ใช้ desktop เหมือนเดิม', 'ไม่ตรวจ touch target'],
    W11:['เลือกตาม system rule', 'เลือกตามความสวย', 'เพิ่มข้อมูลมากขึ้น', 'ใช้แบบเดิมต่อไป'],
    W12:['แสดง state ให้ชัด', 'ซ่อน error message', 'ใช้คำสั่งกำกวม', 'ไม่เตรียม recovery'],
    W13:['เชื่อม prototype ตาม task', 'ลิงก์เฉพาะหน้าสวย', 'ข้าม error path', 'ไม่ทดสอบ interaction'],
    W14:['จัด severity จาก impact', 'แก้สิ่งที่ง่ายก่อน', 'แก้จากความชอบ', 'ไม่วาง retest'],
    W15:['เล่าจาก evidence สู่ผลลัพธ์', 'โชว์ภาพอย่างเดียว', 'ข้ามเหตุผล design', 'ไม่ตอบข้อจำกัด'],
    B1: ['เลือกจาก evidence chain', 'เลือกจากความสวย', 'เลือกตามทีม', 'เลือกที่เร็วสุด'],
    B2: ['เชื่อม flow กับ wireframe', 'วางปุ่มให้ใหญ่ที่สุด', 'รวมทุกอย่างหน้าเดียว', 'ข้าม persona'],
    B3: ['คุม system ให้สม่ำเสมอ', 'ทำแต่ละหน้าคนละแบบ', 'ละเลย accessibility', 'เลือกสีตามชอบ'],
    B4: ['ทดสอบและ iterate จากผล', 'จบที่ prototype สวย', 'แก้ทุกอย่างพร้อมกัน', 'ไม่บันทึก evidence']
  };

  const rules = [
    { re:/color|สี|status|token/i, set:['กำหนดสีตามสถานะ','ใช้สีตามความชอบ','ใส่สีหลายแบบ','ใช้สีเดียวทุกสถานะ'] },
    { re:/typography|type|font|heading|ตัวอักษร|หัวข้อ/i, set:['จัด hierarchy ตัวอักษร','ทำทุกข้อความเท่ากัน','ใช้ฟอนต์หลายแบบ','ลดระยะห่างจนแน่น'] },
    { re:/contrast|readability|accessibility|อ่าน|คอนทราสต์/i, set:['เพิ่ม contrast ให้อ่านได้','เลือกสีสวยแต่จาง','ใช้สีใกล้พื้นหลัง','ลดขนาดตัวอักษร'] },
    { re:/spacing|white space|ระยะห่าง|ช่องว่าง/i, set:['จัด spacing ให้ช่วยอ่าน','อัดข้อมูลให้แน่นขึ้น','เว้นช่องว่างแบบสุ่ม','ซ่อนข้อมูลรองทั้งหมด'] },
    { re:/visual|style|signal|guide|สัญญาณภาพ/i, set:['บันทึกกติกาใน guide','เลือกตามภาพที่ชอบ','ปรับทีละหน้าเอง','ใช้สีแทนทุกอย่าง'] },

    { re:/friction|pain|stuck|ติดขัด|สะดุด/i, set:['เลือกจุดที่ task สะดุด','เลือกจุดที่ดูไม่สวย','เลือกจุดที่ทีมพูดบ่อย','เลือกจุดที่แก้ง่ายสุด'] },
    { re:/goal|need|user goal|เป้าหมาย/i, set:['จับงานหลักของผู้ใช้','เลือกสิ่งที่ผู้ใช้น่าชอบ','รวมทุก goal เท่ากัน','เลือกข้อมูลที่เยอะสุด'] },
    { re:/impact|failure|ผลกระทบ|task failure/i, set:['แยกผลกระทบต่อ task','นับเป็น UI ทั้งหมด','ถือว่าโค้ดเร็วก็พอ','สรุปว่าเป็นความสวย'] },
    { re:/fix|repair|decision|choose|แก้|ปรับ/i, set:['เลือก fix ที่วัดผลได้','เพิ่มคำอธิบายทุกจุด','เลือกที่ทีมทำง่าย','ทำให้ดูทันสมัยก่อน'] },
    { re:/proof|test|validate|retest|พิสูจน์|ทดสอบ|วัด/i, set:['วัด task success หลังใช้','ถามว่าชอบหรือไม่','ดูยอดเข้าหน้าเว็บ','ให้ทีมโหวตดีไซน์'] },

    { re:/evidence|หลักฐาน|classify|ข้อมูล/i, set:['จัด evidence ให้ตรงปัญหา','ใช้ความเห็นแทนข้อมูล','เลือกข้อมูลที่เยอะสุด','ข้ามข้อมูลที่ขัดแย้ง'] },
    { re:/HCD|human|process|กระบวนการ/i, set:['เริ่มจากผู้ใช้จริง','เริ่มจากหน้าจอสวย','เริ่มจาก feature ใหม่','เริ่มจากสิ่งที่ทำง่าย'] },
    { re:/assumption|สมมติฐาน|trap/i, set:['แยก assumption ออก','เชื่อเดาแรกของทีม','ใช้ตัวอย่างเดียวพอ','ข้ามการตรวจสอบ'] },
    { re:/interview|question|ถาม|วิจัย/i, set:['ถามเพื่อหาเหตุผลจริง','ถามนำให้ตอบตามเรา','ถามกว้างจนจับไม่ได้','ถามเฉพาะความชอบ'] },
    { re:/insight|root|problem|HMW|ปัญหา/i, set:['เขียนจาก root cause','เริ่มจาก solution','เขียนให้กว้างที่สุด','รวมหลายปัญหาในข้อเดียว'] },

    { re:/flow|path|journey|IA|navigation|ขั้นตอน/i, set:['จัดลำดับตามงานหลัก','ใส่ทุกทางเลือกก่อน','ข้ามจุดผิดพลาด','จัดตามเมนูเดิม'] },
    { re:/wireframe|layout|grid|card|priority|hierarchy/i, set:['จัด priority ตาม goal','ทำทุกส่วนเด่นเท่ากัน','ซ่อน CTA สำคัญ','เลือก layout ที่สวยสุด'] },
    { re:/CTA|button|action|ปุ่ม/i, set:['วาง CTA ตามงานหลัก','เพิ่มหลายปุ่มพร้อมกัน','ทำปุ่มใหญ่ทุกปุ่ม','ย้าย CTA ไปท้ายหน้า'] },
    { re:/mobile|responsive|touch|breakpoint/i, set:['เพิ่ม touch target สำคัญ','ย่อ desktop ลงมือถือ','ซ่อนขั้นตอนหลัก','ใช้ hover เป็นหลัก'] },

    { re:/pattern|component|design system/i, set:['ใช้ pattern สม่ำเสมอ','ทำปุ่มใหม่ทุกหน้า','เปลี่ยนชื่อ component','ใช้สีตามแต่ละทีม'] },
    { re:/state|feedback|loading|error/i, set:['แสดง state ให้ชัด','ซ่อน feedback','ใช้ข้อความกำกวม','ไม่บอก next step'] },
    { re:/microcopy|wording|copy|ข้อความ/i, set:['เขียน copy ช่วยตัดสินใจ','เขียนยาวทุกจุด','ใช้ศัพท์เทคนิค','ไม่อธิบาย error'] },
    { re:/prototype|link|interaction/i, set:['เชื่อมลิงก์ตาม task','เชื่อมเฉพาะหน้าหลัก','ไม่ทำ error path','ปล่อยปุ่มบางจุดว่าง'] },
    { re:/severity|evaluation|finding|priority/i, set:['จัด severity ตาม impact','แก้สิ่งที่ง่ายก่อน','แก้ตามความชอบ','ไม่วาง retest'] },
    { re:/portfolio|defense|rationale/i, set:['อธิบายด้วย evidence','โชว์ภาพอย่างเดียว','เล่า feature ทั้งหมด','ข้ามข้อจำกัด'] },

    { re:/RAG|citation|retrieval|source|hallucination/i, set:['ตรวจ source กับ citation','เชื่อคำตอบที่ลื่น','ไม่ตรวจ retrieval','ใช้เอกสารเก่าเงียบ ๆ'] },
  ];

  function stageText() {
    const parts = [
      document.querySelector('.hud .meter b')?.textContent,
      document.querySelector('.case .kicker')?.textContent,
      document.querySelector('.case h1')?.textContent,
      document.querySelector('.case p')?.textContent,
      document.querySelector('.question .hint')?.textContent,
      document.querySelector('.question .prompt')?.textContent
    ];
    return parts.map(escText).filter(Boolean).join(' • ');
  }

  function choiceSet() {
    const text = stageText();
    const rule = rules.find(r => r.re.test(text));
    return (rule?.set || nodeFallback[NODE] || nodeFallback.W1).slice(0,4);
  }

  function dataChoice(el) { return String(el.getAttribute('data-choice') || el.dataset.choice || ''); }
  function isCorrect(el) { return /^c\d*/i.test(dataChoice(el)); }
  function distractorIndex(el) {
    const m = dataChoice(el).match(/^d\d+-(\d+)/i);
    return m ? Number(m[1]) : 0;
  }

  function setButton(button, label) {
    const id = dataChoice(button);
    button.dataset.uxqFairOriginal = button.dataset.uxqFairOriginal || escText(button.textContent);
    button.innerHTML = `<span class="uxqFairLetter">${button.closest('.options') ? Array.from(button.closest('.options').children).indexOf(button) >= 0 ? String.fromCharCode(65 + Array.from(button.closest('.options').children).indexOf(button)) : '' : ''}</span><span class="uxqFairText"></span>`;
    const text = button.querySelector('.uxqFairText');
    if (text) text.textContent = label;
    button.setAttribute('data-choice', id);
  }

  function apply() {
    const question = document.querySelector('.question');
    if (!question || question.dataset.uxqFairApplied === VERSION) return;
    if (question.querySelector('.verify, .feedback')) return;
    const buttons = Array.from(question.querySelectorAll('.options [data-choice]')).filter(b => b.offsetParent !== null).slice(0,4);
    if (buttons.length < 4) return;

    const set = choiceSet();
    const correctLabel = set[0];
    const wrongLabels = set.slice(1);
    buttons.forEach((button) => {
      const label = isCorrect(button) ? correctLabel : wrongLabels[distractorIndex(button) % wrongLabels.length];
      setButton(button, label);
    });
    question.dataset.uxqFairApplied = VERSION;
    question.dataset.uxqFairVersion = VERSION;
    addBadge(question, 'stage-specific / no repeated generic');
  }

  function addBadge(question, text) {
    if (question.querySelector('.uxqFairnessBadge')) return;
    const badge = document.createElement('div');
    badge.className = 'uxqFairnessBadge';
    badge.textContent = `✅ choice fairness: ${text}`;
    const prompt = question.querySelector('.prompt') || question.firstElementChild;
    if (prompt?.parentElement) prompt.parentElement.insertBefore(badge, prompt.nextSibling);
  }

  function css() {
    if (document.getElementById('uxqChoiceFairnessV2CSS')) return;
    const style = document.createElement('style');
    style.id = 'uxqChoiceFairnessV2CSS';
    style.textContent = `
      .uxqFairnessBadge{display:inline-flex;align-items:center;margin:.45rem 0 .75rem;padding:.34rem .68rem;border:1px solid rgba(94,234,212,.55);background:rgba(20,184,166,.14);color:#bbf7d0;border-radius:999px;font-weight:900;font-size:.78rem}
      .option .uxqFairLetter{display:inline-grid;place-items:center;min-width:1.9rem;height:1.55rem;margin-right:.55rem;border:1px solid rgba(103,232,249,.65);background:rgba(8,145,178,.22);color:#a5f3fc;border-radius:999px;font-weight:1000;font-size:.78rem;line-height:1}
      .option .uxqFairText{display:inline;line-height:1.32;overflow-wrap:anywhere}
      .question>.options .option{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;min-height:5.7rem!important;display:flex!important;align-items:flex-start!important;gap:.1rem!important}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    css();
    apply();
    let timer = 0;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(apply, 40); };
    new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });
    window.addEventListener('click', () => setTimeout(apply, 70), true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
