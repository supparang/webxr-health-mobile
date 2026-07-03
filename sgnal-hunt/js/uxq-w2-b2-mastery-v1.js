/* UX Quest • W2–B2 Mastery Layer v1
 * Adds mission-specific interactive studios, boss pressure and replay transfer boards.
 * Runs after the core mission engine so existing case banks remain intact.
 */
(() => {
  'use strict';

  const path = String(location.pathname || '').toLowerCase();
  const missionId =
    path.includes('w2-design-thinking-sprint') ? 'w2' :
    path.includes('w3-cognitive-load-escape') ? 'w3' :
    path.includes('b1-cognitive-storm') ? 'b1' :
    path.includes('w4-user-insight-lab') ? 'w4' :
    path.includes('w5-concept-forge') ? 'w5' :
    path.includes('w6-flow-rescue') ? 'w6' :
    path.includes('b2-flow-fortress') ? 'b2' : '';

  if (!missionId) return;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const shuffle = (items) => {
    const next = Array.from(items || []);
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };
  const missionKey = `uxq.mastery.${missionId}.v1`;
  const transferKey = `uxq.transfer.${missionId}.v1`;
  let bypassStart = false;
  let bypassNext = false;
  let preflightDone = false;
  let bossMisses = 0;
  let bossGateAt = 0;
  let lastFeedbackKey = '';
  let observerStarted = false;

  const M = {
    w2: {
      label: 'W2 • Design Thinking Sprint',
      badge: 'Design Process Navigator',
      introTitle: 'Sprint Board: อย่าข้ามจากปัญหาไปสู่หน้าจอ',
      intro: 'จัดลำดับกระบวนการ Human-Centered Design ก่อนเริ่มคดี แล้วใช้คดีสุ่มฝึก Empathize → Define → Ideate → Prototype → Test แบบมีเหตุผล',
      focus: ['Empathize', 'Define', 'Ideate', 'Prototype', 'Test'],
      challenge: 'เรียงลำดับ Design Thinking ให้ถูกก่อนเริ่มภารกิจ',
      transfer: {
        title: 'Sprint Transfer Board',
        lead: 'บันทึกแกนการออกแบบของระบบจริง 1 ระบบ เพื่อนำไปใช้ใน HCD Sprint Brief',
        fields: [
          ['user', 'ผู้ใช้และบริบท', 'เช่น นักศึกษาที่รีบจองคิวบนมือถือระหว่างเปลี่ยนคาบ'],
          ['hmw', 'HMW ที่ยังไม่ล็อก solution', 'เช่น เราจะช่วยให้…ได้อย่างไร?'],
          ['test', 'ต้นแบบแรกและสิ่งที่จะทดสอบ', 'เช่น ให้ผู้ใช้ 5 คนทำ task แล้ววัด…']
        ]
      }
    },
    w3: {
      label: 'W3 • Cognitive Load Escape',
      badge: 'Cognitive Load Pathfinder',
      introTitle: 'Focus Ladder: สิ่งสำคัญต้องชนะสิ่งที่สวย',
      intro: 'จัดลำดับสิ่งที่ผู้ใช้ต้องเห็นก่อน เพื่อฝึก Visual Hierarchy, Feedback และการลดภาระการคิด ก่อนเข้าสู่คดี Cognitive Load',
      focus: ['Primary task', 'Hierarchy', 'Memory load', 'Feedback', 'Recovery'],
      challenge: 'จัดลำดับข้อมูลบนหน้าจอให้ลด cognitive load',
      transfer: {
        title: 'Cognitive Load Repair Note',
        lead: 'เลือกหน้าจอจริง 1 หน้า แล้วบันทึกสิ่งที่ผู้ใช้ต้องเห็นก่อนและสิ่งที่ควรลดหรือย้ายออก',
        fields: [
          ['task', 'Task หลักของหน้าจอ', 'เช่น ตรวจวันนัดและยืนยันการจอง'],
          ['friction', 'ข้อมูล/องค์ประกอบที่สร้างภาระ', 'เช่น มีปุ่มเด่นเท่ากัน 6 ปุ่มและสถานะถูกซ่อนไว้'],
          ['repair', 'การจัด hierarchy หรือ feedback ที่จะเปลี่ยน', 'เช่น ทำ primary action เด่น และย้ายรายละเอียดรองลงมา']
        ]
      }
    },
    b1: {
      label: 'B1 • Cognitive Storm',
      badge: 'Cognitive Storm Defender',
      introTitle: 'Boss Radar: พายุความสับสนกำลังซ่อนสาเหตุจริง',
      intro: 'ด่านบอสรวม W1–W3: คัดหลักฐาน ตั้งโจทย์ วางกระบวนการ ลดความสับสน และพิสูจน์ด้วยต้นแบบ ภารกิจจะใช้ Boss Pressure และ Countermeasure เมื่อเหตุผลยังไม่แน่น',
      focus: ['Phase 1: Signal Scan', 'Phase 2: Break the Noise', 'Phase 3: Proof Seal'],
      challenge: 'คัดหลักฐานจริง 3 ชิ้นก่อนเข้าสู่ Boss Storm',
      boss: true,
      transfer: {
        title: 'B1 Design Defense Note',
        lead: 'สรุปการป้องกันการตัดสินใจออกแบบ 1 รอบ: หลักฐาน → การตัดสินใจ → วิธีพิสูจน์',
        fields: [
          ['evidence', 'หลักฐานที่ทำให้คุณเชื่อว่าปัญหานี้สำคัญ', 'ระบุพฤติกรรมหรือข้อมูลที่สังเกตได้'],
          ['decision', 'การตัดสินใจออกแบบที่แก้คอขวด', 'อธิบายว่าจะเปลี่ยนอะไรและเพราะอะไร'],
          ['proof', 'เกณฑ์พิสูจน์ผล', 'เช่น task success, เวลา, ความผิดพลาด หรือความมั่นใจ']
        ]
      }
    },
    w4: {
      label: 'W4 • User Insight Lab',
      badge: 'Persona Signal Mapper',
      introTitle: 'Persona Signal Board: อย่าสร้าง Persona จากการเดา',
      intro: 'เชื่อมคำพูด พฤติกรรม ความรู้สึก และ need ก่อนเข้าสู่ User Insight Lab เพื่อให้ Persona และ Empathy Map มีฐานจากหลักฐานผู้ใช้',
      focus: ['Quote', 'Observation', 'Think / Feel', 'Need', 'POV / HMW'],
      challenge: 'จับคู่ Observation กับ Need ของผู้ใช้ให้ถูก',
      transfer: {
        title: 'Persona & Empathy Snapshot',
        lead: 'สร้าง Persona Snapshot หลังจบคดี แล้วนำไปต่อเป็น Persona และ Empathy Map ในใบงาน',
        fields: [
          ['persona', 'ชื่อย่อ Persona + บริบท', 'เช่น เมย์ • นักศึกษาทำงานพิเศษที่กรอกทุนบนมือถือเป็นช่วง ๆ'],
          ['saydo', 'Say / Do ที่สังเกตได้', 'เช่น ถ่ายภาพหน้าจอและกลับมาเริ่มตรวจจากหน้าแรก'],
          ['thinkfeel', 'Think / Feel และ Need ที่ซ่อนอยู่', 'เช่น กลัวข้อมูลหาย ต้องการรู้ว่างานใดทำต่อ']
        ]
      }
    },
    w5: {
      label: 'W5 • Concept Forge',
      badge: 'Concept Forge Strategist',
      introTitle: 'Storyboard Forge: เปลี่ยน Insight ให้เห็นเป็น journey',
      intro: 'จัดลำดับเรื่องราวของผู้ใช้ก่อนเข้าสู่ Concept Forge แล้วใช้คดีสุ่มฝึก Problem Statement → HMW → Idea → Storyboard → Prototype Scope',
      focus: ['Problem frame', 'HMW', 'Idea burst', 'Storyboard', 'Prototype scope'],
      challenge: 'เรียง Storyboard จากบริบทไปสู่ผลลัพธ์ที่ผู้ใช้ตรวจสอบได้',
      transfer: {
        title: 'Concept & Storyboard Transfer',
        lead: 'บันทึกแนวคิดที่พร้อมนำไปวาด Storyboard 4 ช่องในใบงาน Week 5',
        fields: [
          ['hmw', 'HMW ของแนวคิดนี้', 'เริ่มด้วย “เราจะช่วย…” และไม่ล็อกสี/ปุ่ม/เทคโนโลยี'],
          ['idea', 'แนวคิดที่เลือกและ friction ที่ลดได้', 'อธิบายว่าแนวคิดช่วย task หลักอย่างไร'],
          ['scene', 'ฉากสำคัญของ Storyboard', 'บริบท → action → feedback/state → ผลลัพธ์']
        ]
      }
    },
    w6: {
      label: 'W6 • Flow Rescue',
      badge: 'Flow Rescue Architect',
      introTitle: 'Card Sort Station: โครงสร้างที่ดีเริ่มจาก mental model',
      intro: 'ทำ quick card sort ก่อนเข้าสู่ Flow Rescue แล้วใช้คดีสุ่มฝึก Entry → Information Architecture → Bottleneck → User Flow → Test',
      focus: ['Entry point', 'Information architecture', 'Bottleneck', 'User flow', 'Task success'],
      challenge: 'จัดข้อมูล 6 รายการเข้ากลุ่มที่ผู้ใช้คาดหวัง',
      transfer: {
        title: 'Sitemap & Flow Transfer',
        lead: 'สรุปโครงสร้างและ flow ที่ต้องนำไปวาดเป็น Sitemap / User Flow ในใบงาน Week 6',
        fields: [
          ['groups', 'กลุ่มข้อมูล/ป้ายกำกับที่ผู้ใช้เข้าใจ', 'เช่น จองอุปกรณ์ / การจองของฉัน / รับ–คืนอย่างไร'],
          ['bottleneck', 'Bottleneck ที่ต้องแก้ก่อน', 'เช่น หลังยืนยันผู้ใช้ไม่รู้สถานะและจุดรับของ'],
          ['flow', 'User Flow ฉบับย่อ', 'Entry → เลือก → ตรวจเงื่อนไข → ยืนยัน → State / Next step']
        ]
      }
    },
    b2: {
      label: 'B2 • Flow Fortress',
      badge: 'Flow Fortress Commander',
      introTitle: 'Fortress Brief: จาก Insight สู่ Flow ที่พิสูจน์ได้',
      intro: 'บอสรวม W4–W6: อ่าน insight ให้ถูก สร้าง HMW จัด IA วาง user flow และพิสูจน์ผล Boss Pressure จะเพิ่มเมื่อเลือกทางที่ไม่เชื่อมกับ task จริง',
      focus: ['Phase 1: Insight Intel', 'Phase 2: Architecture Gate', 'Phase 3: Decision Siege'],
      challenge: 'เลือกหลักฐานเชิง Insight ที่ใช้เปิดด่าน Flow Fortress',
      boss: true,
      transfer: {
        title: 'B2 Flow Defense Board',
        lead: 'สรุปการออกแบบ Flow Defense 1 ชุด เพื่อใช้ปกป้อง Sitemap และ User Flow ของงานจริง',
        fields: [
          ['insight', 'Insight ที่นำไปสู่ flow นี้', 'ระบุแรงกังวล/need ที่อธิบายพฤติกรรมผู้ใช้'],
          ['flow', 'จุดตัดสินใจและ state สำคัญ', 'Entry → decision → feedback → next step'],
          ['proof', 'วิธีทดสอบว่า flow ใหม่ดีขึ้น', 'task success / เวลา / ความผิดพลาด / ความมั่นใจ']
        ]
      }
    }
  }[missionId];

  function addStyle(){
    if (document.getElementById('uxq-w2b2-mastery-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w2b2-mastery-style';
    style.textContent = `
      .uxq-mastery-card{margin:2px 0 6px;padding:16px;border:1px solid rgba(155,140,255,.42);border-radius:18px;background:linear-gradient(145deg,rgba(155,140,255,.13),rgba(110,231,255,.07));display:grid;gap:10px}.uxq-mastery-card__eyebrow{font-size:.72rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:#cabfff}.uxq-mastery-card h3{margin:0;color:#fff;font-size:1rem}.uxq-mastery-card p{margin:0;color:#d7e4ff;line-height:1.58;font-size:.9rem}.uxq-mastery-chiprow{display:flex;flex-wrap:wrap;gap:7px}.uxq-mastery-chip{border:1px solid rgba(181,205,255,.23);border-radius:999px;background:rgba(5,16,37,.36);padding:6px 9px;color:#dfeaff;font-weight:750;font-size:.75rem}
      .uxq-mastery-radar{margin:0 0 14px;padding:11px 13px;border-left:3px solid #9b8cff;border-radius:0 13px 13px 0;background:rgba(155,140,255,.10);display:grid;gap:4px}.uxq-mastery-radar b{font-size:.84rem;color:#d5ccff}.uxq-mastery-radar span{font-size:.83rem;color:#dce8ff;line-height:1.45}
      .uxq-boss-console{margin:0 0 14px;padding:12px 14px;border:1px solid rgba(255,209,102,.5);border-radius:15px;background:linear-gradient(135deg,rgba(101,73,18,.30),rgba(55,27,67,.25));display:grid;gap:7px}.uxq-boss-console__top{display:flex;justify-content:space-between;gap:10px;align-items:center}.uxq-boss-console__top b{font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;color:#ffe2a0}.uxq-boss-console__top span{font-size:.78rem;color:#fff}.uxq-boss-console__bar{height:9px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}.uxq-boss-console__bar i{display:block;height:100%;width:100%;border-radius:inherit;background:linear-gradient(90deg,#77e9a4,#ffd166,#ff97a6);transition:width .24s ease}.uxq-boss-console__note{font-size:.78rem;color:#e8e2ff;line-height:1.45}
      .uxq-mastery-modal{position:fixed;z-index:3000;inset:0;padding:14px;display:grid;place-items:center;background:rgba(2,8,22,.82);backdrop-filter:blur(7px)}.uxq-mastery-modal__panel{width:min(820px,100%);max-height:min(92vh,900px);overflow:auto;border:1px solid rgba(110,231,255,.46);border-radius:22px;background:linear-gradient(150deg,#172d57,#07152f);box-shadow:0 24px 80px rgba(0,0,0,.54);padding:clamp(18px,4vw,32px)}.uxq-mastery-modal__kicker{margin:0 0 8px;font-size:.74rem;letter-spacing:.11em;text-transform:uppercase;font-weight:900;color:#6ee7ff}.uxq-mastery-modal h2{margin:0;color:#fff;font-size:clamp(1.35rem,3vw,2rem);line-height:1.18}.uxq-mastery-modal__lede{margin:9px 0 0;color:#d4e0fa;line-height:1.62}.uxq-mastery-modal__error{min-height:20px;margin:12px 0 0;color:#ffbdc8;font-weight:750}.uxq-mastery-modal__good{margin:13px 0 0;padding:12px;border:1px solid rgba(119,233,164,.52);border-radius:13px;background:rgba(39,112,77,.16);color:#dfffe9;line-height:1.55}.uxq-mastery-modal__actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.uxq-mastery-modal button{font:inherit}.uxq-mastery-action{border:0;border-radius:12px;padding:11px 14px;background:#6ee7ff;color:#06142d;font-weight:900}.uxq-mastery-action--ghost{background:transparent;color:#ecf5ff;border:1px solid rgba(181,205,255,.32)}
      .uxq-sequence{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:17px}.uxq-sequence__panel{border:1px solid rgba(181,205,255,.22);border-radius:15px;padding:12px;background:rgba(4,14,33,.36)}.uxq-sequence__panel h3{margin:0 0 9px;color:#b6dfff;font-size:.84rem}.uxq-sequence-list{display:grid;gap:8px}.uxq-sequence-item{border:1px solid rgba(181,205,255,.22);border-radius:11px;padding:10px;text-align:left;background:rgba(16,35,69,.66);color:#eef7ff;font-weight:750;line-height:1.4}.uxq-sequence-item:not(:disabled):hover{border-color:#6ee7ff;transform:translateY(-1px)}.uxq-sequence-item:disabled{opacity:.58}.uxq-sequence-picked{display:flex;gap:9px;align-items:flex-start;border:1px solid rgba(155,140,255,.46);border-radius:11px;padding:10px;color:#f2efff;background:rgba(155,140,255,.12);line-height:1.4}.uxq-sequence-picked b{color:#cabfff}.uxq-sort-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.uxq-sort-card{border:1px solid rgba(181,205,255,.23);border-radius:13px;padding:11px;background:rgba(4,14,33,.38);display:grid;gap:8px}.uxq-sort-card b{color:#fff;font-size:.9rem}.uxq-sort-card select{width:100%;border:1px solid rgba(110,231,255,.35);border-radius:9px;background:#0a1a37;color:#eef7ff;padding:9px}.uxq-choice-board{display:grid;gap:10px;margin-top:16px}.uxq-choice-option{display:flex;gap:9px;align-items:flex-start;border:1px solid rgba(181,205,255,.24);border-radius:13px;padding:11px;color:#eaf3ff;background:rgba(4,14,33,.38);line-height:1.45;cursor:pointer}.uxq-choice-option:has(input:checked){border-color:#6ee7ff;background:rgba(110,231,255,.10)}.uxq-choice-option input{margin-top:4px;accent-color:#6ee7ff}
      .uxq-transfer-board{width:min(760px,100%);text-align:left;border:1px solid rgba(155,140,255,.52);border-radius:18px;padding:16px;background:rgba(155,140,255,.10);display:grid;gap:11px}.uxq-transfer-board__eyebrow{font-size:.72rem;font-weight:900;letter-spacing:.1em;color:#cabfff;text-transform:uppercase}.uxq-transfer-board h3{margin:0;color:#fff;font-size:1.05rem}.uxq-transfer-board p{margin:0;color:#d9e5ff;line-height:1.58;font-size:.9rem}.uxq-transfer-field{display:grid;gap:6px}.uxq-transfer-field label{font-size:.83rem;font-weight:850;color:#eef6ff}.uxq-transfer-field textarea{resize:vertical;min-height:68px;width:100%;border:1px solid rgba(181,205,255,.26);border-radius:11px;background:rgba(4,14,33,.52);color:#f0f7ff;padding:10px;font:inherit;line-height:1.45}.uxq-transfer-save{justify-self:start;border:0;border-radius:11px;padding:10px 13px;background:#9b8cff;color:#16102b;font-weight:900}.uxq-transfer-status{font-size:.82rem;color:#b9f6d0;min-height:18px}
      @media(max-width:760px){.uxq-sequence,.uxq-sort-grid{grid-template-columns:1fr}.uxq-mastery-modal{padding:9px}.uxq-mastery-modal__panel{padding:18px;border-radius:18px}.uxq-mastery-card{padding:13px}.uxq-boss-console__top{align-items:flex-start;flex-direction:column;gap:3px}}
    `;
    document.head.appendChild(style);
  }

  function readJson(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || ''); }
    catch (error) { return fallback; }
  }
  function writeJson(key, value){
    const text = JSON.stringify(value);
    try { localStorage.setItem(key, text); return; } catch (error) {}
    try { sessionStorage.setItem(key, text); } catch (error) {}
  }
  function readPreflight(){ return readJson(missionKey, null); }
  function savePreflight(data){ writeJson(missionKey, Object.assign({ missionId, completedAt:new Date().toISOString() }, data || {})); }
  function removeModal(){ $('.uxq-mastery-modal')?.remove(); }

  function choiceOptions(items, name){
    return items.map((item, index) => `<label class="uxq-choice-option"><input type="checkbox" name="${esc(name)}" value="${index}" data-correct="${item.correct ? '1' : '0'}"><span>${esc(item.label)}</span></label>`).join('');
  }

  function sequenceTask(def){
    const items = shuffle(def.items.map((label, index) => ({ id:index, label })));
    let picked = [];
    const body = `<div class="uxq-sequence"><section class="uxq-sequence__panel"><h3>การ์ดที่ยังไม่เรียง</h3><div class="uxq-sequence-list" id="uxqSequenceSource"></div></section><section class="uxq-sequence__panel"><h3>ลำดับที่คุณเลือก</h3><div class="uxq-sequence-list" id="uxqSequencePicked"></div></section></div><div class="uxq-mastery-modal__actions"><button type="button" class="uxq-mastery-action" id="uxqSequenceCheck">ตรวจลำดับ</button><button type="button" class="uxq-mastery-action uxq-mastery-action--ghost" id="uxqSequenceReset">เริ่มใหม่</button></div>`;
    return {
      body,
      bind(panel, complete){
        const source = $('#uxqSequenceSource', panel);
        const target = $('#uxqSequencePicked', panel);
        const render = () => {
          source.innerHTML = items.filter((item) => !picked.includes(item.id)).map((item) => `<button type="button" class="uxq-sequence-item" data-sequence-id="${item.id}">${esc(item.label)}</button>`).join('') || '<p class="uxq-small-note">เลือกครบแล้ว ตรวจลำดับได้</p>';
          target.innerHTML = picked.map((id, index) => `<div class="uxq-sequence-picked"><b>${index + 1}</b><span>${esc(def.items[id])}</span></div>`).join('') || '<p class="uxq-small-note">แตะการ์ดด้านซ้ายเพื่อเรียงลำดับ</p>';
        };
        source.addEventListener('click', (event) => {
          const button = event.target.closest('[data-sequence-id]');
          if (!button) return;
          const id = Number(button.dataset.sequenceId);
          if (!picked.includes(id)) picked.push(id);
          render();
        });
        $('#uxqSequenceReset', panel)?.addEventListener('click', () => { picked = []; render(); });
        $('#uxqSequenceCheck', panel)?.addEventListener('click', () => {
          if (picked.length !== def.items.length) return setMessage(panel, 'จัดการ์ดให้ครบทุกใบก่อนตรวจลำดับ', false);
          const correct = picked.every((id, index) => id === index);
          if (!correct) return setMessage(panel, def.retry, false);
          setMessage(panel, def.success, true, () => complete({ type:'sequence', score:1 }));
        });
        render();
      }
    };
  }

  function sortTask(def){
    const body = `<div class="uxq-sort-grid">${def.items.map((item, index) => `<label class="uxq-sort-card"><b>${esc(item.label)}</b><select data-sort-index="${index}"><option value="">เลือกกลุ่ม…</option>${def.groups.map((group) => `<option value="${esc(group)}">${esc(group)}</option>`).join('')}</select></label>`).join('')}</div><div class="uxq-mastery-modal__actions"><button type="button" class="uxq-mastery-action" id="uxqSortCheck">ตรวจการจัดกลุ่ม</button></div>`;
    return {
      body,
      bind(panel, complete){
        $('#uxqSortCheck', panel)?.addEventListener('click', () => {
          const selects = $$('[data-sort-index]', panel);
          if (selects.some((select) => !select.value)) return setMessage(panel, 'จัดกลุ่มการ์ดให้ครบก่อนตรวจคำตอบ', false);
          const correctCount = selects.filter((select) => select.value === def.items[Number(select.dataset.sortIndex)].group).length;
          if (correctCount !== def.items.length) return setMessage(panel, `คุณจัดกลุ่มถูก ${correctCount}/${def.items.length} ใบ — ${def.retry}`, false);
          setMessage(panel, def.success, true, () => complete({ type:'sort', score:1 }));
        });
      }
    };
  }

  function checkTask(def){
    const items = shuffle(def.items);
    const body = `<div class="uxq-choice-board">${choiceOptions(items, 'uxqMasteryChoice')}</div><div class="uxq-mastery-modal__actions"><button type="button" class="uxq-mastery-action" id="uxqChoiceCheck">ยืนยันการเลือก</button></div>`;
    return {
      body,
      bind(panel, complete){
        $('#uxqChoiceCheck', panel)?.addEventListener('click', () => {
          const checks = $$('input[name="uxqMasteryChoice"]:checked', panel);
          if (checks.length !== def.count) return setMessage(panel, `เลือกให้ครบ ${def.count} ข้อก่อน`, false);
          const correct = checks.every((input) => input.dataset.correct === '1');
          if (!correct) return setMessage(panel, def.retry, false);
          setMessage(panel, def.success, true, () => complete({ type:'triage', score:1 }));
        });
      }
    };
  }

  function pairTask(def){
    const body = `<div class="uxq-sort-grid">${def.prompts.map((item, index) => `<label class="uxq-sort-card"><b>${esc(item.prompt)}</b><select data-pair-index="${index}"><option value="">เลือกคำตอบ…</option>${item.options.map((option) => `<option value="${esc(option.value)}" data-correct="${option.correct ? '1' : '0'}">${esc(option.label)}</option>`).join('')}</select></label>`).join('')}</div><div class="uxq-mastery-modal__actions"><button type="button" class="uxq-mastery-action" id="uxqPairCheck">ตรวจ Persona Signal</button></div>`;
    return {
      body,
      bind(panel, complete){
        $('#uxqPairCheck', panel)?.addEventListener('click', () => {
          const selects = $$('[data-pair-index]', panel);
          if (selects.some((select) => !select.value)) return setMessage(panel, 'เลือกคำตอบให้ครบก่อนเข้าสู่ Insight Lab', false);
          const correct = selects.every((select) => select.options[select.selectedIndex].dataset.correct === '1');
          if (!correct) return setMessage(panel, def.retry, false);
          setMessage(panel, def.success, true, () => complete({ type:'persona-signal', score:1 }));
        });
      }
    };
  }

  function taskForMission(){
    if (missionId === 'w2') return sequenceTask({
      items:['Empathize: เก็บพฤติกรรมและบริบทผู้ใช้','Define: เขียนโจทย์จาก need และ obstacle','Ideate: สร้างทางเลือกหลายแนว','Prototype: ทำเฉพาะช่วงที่เสี่ยงที่สุด','Test: ให้ผู้ใช้ทำ task แล้วเก็บหลักฐาน'],
      retry:'ลำดับนี้เริ่มจาก solution เร็วเกินไป ลองย้อนกลับไปถามว่า “เราเข้าใจผู้ใช้ก่อนหรือยัง?”',
      success:'ถูกต้อง — กระบวนการเริ่มจากผู้ใช้และกลับไปพิสูจน์กับผู้ใช้ ไม่ใช่เริ่มจากหน้าจอ'
    });
    if (missionId === 'w3') return sequenceTask({
      items:['Primary task: สิ่งที่ผู้ใช้ต้องทำตอนนี้','Decision data: ข้อมูลที่จำเป็นต่อการตัดสินใจ','Feedback / State: สิ่งที่บอกว่าระบบรับรู้หรือสำเร็จแล้ว','Secondary details: รายละเอียดที่อ่านเพิ่มได้ภายหลัง'],
      retry:'ลองคิดจากผู้ใช้ที่กำลังรีบ: เขาต้องทำอะไรและต้องเห็นอะไรก่อนจึงไม่ต้องเดา?',
      success:'ถูกต้อง — hierarchy ที่ดีทำให้ task และข้อมูลตัดสินใจมาก่อนรายละเอียดรอง'
    });
    if (missionId === 'w4') return pairTask({
      prompts:[
        {prompt:'Observation ที่เก็บได้',options:[
          {value:'obs1',label:'ผู้ใช้ถ่ายภาพหน้าจอและกลับมาเริ่มตรวจจากหน้าแรก',correct:true},
          {value:'obs2',label:'ผู้ใช้ไม่เก่งเทคโนโลยี',correct:false},
          {value:'obs3',label:'ทีมควรทำปุ่มให้ใหญ่ขึ้น',correct:false}
        ]},
        {prompt:'Need ที่อธิบายพฤติกรรมนี้',options:[
          {value:'need1',label:'ต้องการความมั่นใจว่างานที่ค้างไว้ไม่สูญหายและรู้ว่าต้องทำอะไรต่อ',correct:true},
          {value:'need2',label:'ต้องการเมนูจำนวนมากที่สุด',correct:false},
          {value:'need3',label:'ต้องการเรียนรู้คำย่อของระบบ',correct:false}
        ]},
        {prompt:'Emotional signal ที่ควรใส่ใน Empathy Map',options:[
          {value:'feel1',label:'กังวลว่าจะทำข้อมูลหายหรือส่งไม่สำเร็จ',correct:true},
          {value:'feel2',label:'อยากเห็นภาพเคลื่อนไหวมากที่สุด',correct:false},
          {value:'feel3',label:'ต้องการให้ขั้นตอนยาวขึ้นเพื่อความท้าทาย',correct:false}
        ]}
      ],
      retry:'แยกให้ชัด: Observation คือสิ่งที่เห็นจริง ส่วน Need / Feel คือสิ่งที่ใช้ตีความจากหลักฐาน',
      success:'ถูกต้อง — Persona ที่ดีเชื่อม Say / Do กับ Think / Feel และ Need โดยไม่เหมารวมผู้ใช้'
    });
    if (missionId === 'w5') return sequenceTask({
      items:['บริบท: ผู้ใช้กำลังพยายามทำ task ในสถานการณ์ใด','อุปสรรค: จุดที่ผู้ใช้หยุด งง หรือกังวล','แนวคิดช่วยเหลือ: ระบบช่วยลด friction อย่างไร','Feedback / ผลลัพธ์: ผู้ใช้รู้ว่าสำเร็จและต้องทำอะไรต่อ'],
      retry:'Storyboard ไม่ได้เริ่มจากโลโก้หรือหน้าสวยที่สุด แต่เริ่มจากบริบทและ task ของผู้ใช้',
      success:'ถูกต้อง — storyboard ที่ดีเห็นการเดินทางจาก context ไปสู่ outcome ที่ตรวจสอบได้'
    });
    if (missionId === 'w6') return sortTask({
      groups:['เริ่มงาน / ค้นหา','ตัดสินใจ / เปรียบเทียบ','ยืนยัน / สถานะ'],
      items:[
        {label:'เลือกวันและเวลาที่ต้องการ',group:'เริ่มงาน / ค้นหา'},
        {label:'กรองตามจำนวนคนและอุปกรณ์',group:'เริ่มงาน / ค้นหา'},
        {label:'เปรียบเทียบตัวเลือก 2 ห้อง',group:'ตัดสินใจ / เปรียบเทียบ'},
        {label:'ดูเงื่อนไขก่อนจอง',group:'ตัดสินใจ / เปรียบเทียบ'},
        {label:'เห็นเลขอ้างอิงและสถานะการจอง',group:'ยืนยัน / สถานะ'},
        {label:'เห็นจุดรับของหรือ next step',group:'ยืนยัน / สถานะ'}
      ],
      retry:'ลองจัดตาม journey ของผู้ใช้: ก่อนเลือก → ระหว่างตัดสินใจ → หลังยืนยัน ไม่ใช่ตามทีมงานหลังบ้าน',
      success:'ถูกต้อง — Card Sort ช่วยให้ Sitemap และ User Flow ใช้ภาษาตาม task ของผู้ใช้'
    });
    return checkTask({
      count:3,
      items:[
        {label:'ผู้ใช้เปิดหน้าจองซ้ำหลังยืนยัน เพราะไม่เห็นสถานะและเลขอ้างอิง',correct:true},
        {label:'ทีมออกแบบชอบพื้นหลังสีเข้มมากกว่า',correct:false},
        {label:'ผู้ใช้สลับระหว่างสามเมนูแล้วถามว่าต้องทำอะไรก่อน',correct:true},
        {label:'ระบบมีฟีเจอร์มากกว่าคู่แข่ง',correct:false},
        {label:'ผู้ใช้บอกว่ากลัวเลือกผิด เพราะเงื่อนไขสำคัญถูกเห็นหลังยืนยัน',correct:true}
      ],
      retry:'Boss Intel ต้องเป็นพฤติกรรมหรือคำพูดที่อธิบาย task failure ได้ ไม่ใช่ความชอบของทีม หรือจำนวนฟีเจอร์',
      success:'Boss Intel พร้อม — คุณเลือกหลักฐานที่ใช้กำหนดทิศการออกแบบได้จริง'
    });
  }

  function setMessage(panel, text, good, done){
    const node = $('.uxq-mastery-modal__error', panel);
    if (!node) return;
    node.className = good ? 'uxq-mastery-modal__good' : 'uxq-mastery-modal__error';
    node.textContent = text;
    if (good) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'uxq-mastery-action';
      button.textContent = 'เริ่มภารกิจหลัก →';
      button.addEventListener('click', () => done?.());
      $('.uxq-mastery-modal__actions', panel)?.appendChild(button);
    }
  }

  function openPreflight(){
    if ($('.uxq-mastery-modal')) return;
    addStyle();
    const task = taskForMission();
    const modal = document.createElement('section');
    modal.className = 'uxq-mastery-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', M.challenge);
    modal.innerHTML = `<div class="uxq-mastery-modal__panel"><p class="uxq-mastery-modal__kicker">${esc(M.label)} • Mission Warm-up</p><h2>${esc(M.challenge)}</h2><p class="uxq-mastery-modal__lede">${esc(M.intro)}</p>${task.body}<div class="uxq-mastery-modal__error" aria-live="polite"></div><div class="uxq-mastery-modal__actions"><button type="button" class="uxq-mastery-action--ghost" id="uxqMasteryCancel">กลับไปดู Briefing</button></div></div>`;
    document.body.appendChild(modal);
    $('#uxqMasteryCancel', modal)?.addEventListener('click', removeModal);
    task.bind(modal, (result) => {
      savePreflight(result);
      preflightDone = true;
      removeModal();
      bypassStart = true;
      setTimeout(() => $('#uxqStart')?.click(), 0);
    });
  }

  function phaseFor(questionNo){
    if (!M.boss) return '';
    if (missionId === 'b1') {
      if (questionNo <= 2) return 'Phase 1 • Signal Scan';
      if (questionNo <= 4) return 'Phase 2 • Break the Noise';
      return 'Phase 3 • Proof Seal';
    }
    if (questionNo <= 3) return 'Phase 1 • Insight Intel';
    if (questionNo <= 6) return 'Phase 2 • Architecture Gate';
    return 'Phase 3 • Decision Siege';
  }

  function questionNo(){
    const meter = $('.uxq-hud .uxq-meter b');
    const match = String(meter?.textContent || '').match(/(\d+)\s*\//);
    return match ? Number(match[1]) : 0;
  }

  function renderBossConsole(){
    if (!M.boss) return;
    const game = $('.uxq-game');
    if (!game) return;
    const num = questionNo();
    let panel = $('.uxq-boss-console', game);
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'uxq-boss-console';
      const anchor = $('.uxq-casebar', game);
      if (anchor) anchor.insertAdjacentElement('afterend', panel); else game.prepend(panel);
    }
    const integrity = Math.max(15, 100 - bossMisses * 22);
    panel.innerHTML = `<div class="uxq-boss-console__top"><b>${esc(phaseFor(num) || 'Boss Phase')}</b><span>Boss Pressure ${bossMisses}/4</span></div><div class="uxq-boss-console__bar"><i style="width:${integrity}%"></i></div><div class="uxq-boss-console__note">คำตอบที่ไม่เชื่อมกับ task จะตัด combo และสะสมแรงกดดัน • เมื่อแรงกดดันสูง ต้องผ่าน Countermeasure ก่อนเดินหน้าต่อ</div>`;
  }

  function renderRadar(){
    const question = $('.uxq-question');
    if (!question || $('.uxq-mastery-radar', question)) return;
    const stage = String($('.uxq-stage')?.textContent || '').trim();
    const focus = M.focus[Math.min(M.focus.length - 1, Math.max(0, questionNo() - 1))] || M.focus[0];
    const card = document.createElement('aside');
    card.className = 'uxq-mastery-radar';
    card.innerHTML = `<b>${esc(M.label)} • ${esc(focus)}</b><span>${esc(stage ? `รอบนี้ใช้เลนส์ “${focus}” ร่วมกับ ${stage}` : `รอบนี้ใช้เลนส์ “${focus}” ก่อนเลือกคำตอบ`)}</span>`;
    question.insertBefore(card, question.firstChild);
  }

  function injectIntro(){
    const hero = $('.uxq-hero');
    if (!hero || $('.uxq-mastery-card', hero)) return;
    addStyle();
    const prior = readPreflight();
    const card = document.createElement('section');
    card.className = 'uxq-mastery-card';
    card.innerHTML = `<div class="uxq-mastery-card__eyebrow">Mission-specific Studio Layer</div><h3>${esc(M.introTitle)}</h3><p>${esc(M.intro)}</p><div class="uxq-mastery-chiprow">${M.focus.map((item) => `<span class="uxq-mastery-chip">${esc(item)}</span>`).join('')}</div>${prior ? '<p class="uxq-small-note">Warm-up ก่อนหน้าถูกบันทึกแล้ว แต่รอบนี้ยังใช้ Casefile ชุดใหม่และคำตอบสลับตำแหน่ง</p>' : ''}`;
    const actions = $('.uxq-actions', hero);
    if (actions) actions.insertAdjacentElement('beforebegin', card); else hero.appendChild(card);
  }

  function readTransfer(){ return readJson(transferKey, {}); }
  function writeTransfer(data){ writeJson(transferKey, Object.assign({ missionId, savedAt:new Date().toISOString() }, data || {})); }

  function injectTransfer(){
    const result = $('.uxq-results');
    if (!result || $('.uxq-transfer-board', result)) return;
    const saved = readTransfer();
    const board = document.createElement('section');
    board.className = 'uxq-transfer-board';
    board.innerHTML = `<div class="uxq-transfer-board__eyebrow">Studio Artifact • ${esc(M.label)}</div><h3>${esc(M.transfer.title)}</h3><p>${esc(M.transfer.lead)}</p>${M.transfer.fields.map(([id,label,placeholder]) => `<div class="uxq-transfer-field"><label for="uxqTransfer_${esc(id)}">${esc(label)}</label><textarea id="uxqTransfer_${esc(id)}" data-transfer="${esc(id)}" placeholder="${esc(placeholder)}">${esc(saved[id] || '')}</textarea></div>`).join('')}<button type="button" class="uxq-transfer-save">บันทึก Studio Note ในอุปกรณ์นี้</button><span class="uxq-transfer-status" aria-live="polite"></span>`;
    const anchor = $('.uxq-takeaway', result) || $('.uxq-submission-receipt', result);
    if (anchor) anchor.insertAdjacentElement('afterend', board); else result.appendChild(board);
    $('.uxq-transfer-save', board)?.addEventListener('click', () => {
      const data = {};
      $$('[data-transfer]', board).forEach((field) => { data[field.dataset.transfer] = String(field.value || '').trim(); });
      if (Object.values(data).some((value) => !value)) {
        $('.uxq-transfer-status', board).textContent = 'กรอก Studio Note ให้ครบ 3 ส่วนก่อนบันทึก';
        return;
      }
      writeTransfer(data);
      $('.uxq-transfer-status', board).textContent = 'บันทึก Studio Note แล้ว — นำข้อความนี้ไปพัฒนาต่อในใบงาน/ต้นแบบของคุณ';
    });
  }

  function openCountermeasure(){
    if ($('.uxq-mastery-modal')) return;
    const modal = document.createElement('section');
    modal.className = 'uxq-mastery-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `<div class="uxq-mastery-modal__panel"><p class="uxq-mastery-modal__kicker">Boss Countermeasure</p><h2>แรงกดดันสูง: หยุดดู task ก่อนตอบต่อ</h2><p class="uxq-mastery-modal__lede">ก่อนเข้าสู่ phase ถัดไป เลือกหลักคิดที่ช่วยกู้ flow ให้ผู้ใช้ได้จริง</p><div class="uxq-choice-board"><label class="uxq-choice-option"><input type="radio" name="uxqCounter" value="good"> <span>กลับไปดู task, หลักฐาน และ decision point ที่ทำให้ผู้ใช้หยุดหรือไม่มั่นใจ</span></label><label class="uxq-choice-option"><input type="radio" name="uxqCounter" value="bad1"> <span>เลือกสีที่ทีมชอบก่อน แล้วค่อยหาว่าผู้ใช้ติดตรงไหน</span></label><label class="uxq-choice-option"><input type="radio" name="uxqCounter" value="bad2"> <span>เพิ่มทุกฟีเจอร์เพื่อลดคำถามของผู้ใช้</span></label></div><div class="uxq-mastery-modal__error" aria-live="polite"></div><div class="uxq-mastery-modal__actions"><button type="button" class="uxq-mastery-action" id="uxqCounterCheck">ใช้ Countermeasure</button></div></div>`;
    document.body.appendChild(modal);
    $('#uxqCounterCheck', modal)?.addEventListener('click', () => {
      const selected = $('input[name="uxqCounter"]:checked', modal);
      const error = $('.uxq-mastery-modal__error', modal);
      if (!selected) { error.textContent = 'เลือกหลักคิดก่อนกลับสู่ด่านบอส'; return; }
      if (selected.value !== 'good') { error.textContent = 'ยังไม่ใช่ — วิธีนี้เริ่มจาก solution หรือเพิ่มภาระ แทนที่จะกลับไปหา task และหลักฐาน'; return; }
      error.className = 'uxq-mastery-modal__good';
      error.textContent = 'Countermeasure สำเร็จ — กลับไปเชื่อม task → evidence → decision แล้วเดินหน้าต่อ';
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'uxq-mastery-action'; button.textContent = 'กลับเข้าสู่ Phase ถัดไป →';
      button.addEventListener('click', () => {
        removeModal();
        bypassNext = true;
        $('#uxqNext')?.click();
      });
      $('.uxq-mastery-modal__actions', modal)?.appendChild(button);
    });
  }

  function observeFeedback(){
    if (!M.boss) return;
    const feedback = $('.uxq-feedback');
    const key = `${questionNo()}|${feedback?.className || ''}`;
    if (!feedback || key === lastFeedbackKey) return;
    lastFeedbackKey = key;
    if (feedback.classList.contains('uxq-feedback--bad')) {
      bossMisses += 1;
      if (bossMisses >= 2 && bossMisses > bossGateAt) bossGateAt = bossMisses;
    }
    renderBossConsole();
  }

  function enhance(){
    injectIntro();
    renderRadar();
    renderBossConsole();
    observeFeedback();
    injectTransfer();
  }

  function attach(){
    if (observerStarted) return;
    observerStarted = true;
    addStyle();
    document.addEventListener('click', (event) => {
      const start = event.target instanceof Element ? event.target.closest('#uxqStart') : null;
      if (start) {
        if (bypassStart) { bypassStart = false; return; }
        if (!preflightDone) {
          event.preventDefault();
          event.stopImmediatePropagation();
          openPreflight();
        }
        return;
      }
      if (!M.boss) return;
      const next = event.target instanceof Element ? event.target.closest('#uxqNext') : null;
      if (!next) return;
      if (bypassNext) { bypassNext = false; return; }
      if (bossGateAt && bossGateAt === bossMisses) {
        event.preventDefault();
        event.stopImmediatePropagation();
        bossGateAt = 0;
        openCountermeasure();
      }
    }, true);
    const root = document.documentElement;
    const observer = new MutationObserver(() => requestAnimationFrame(enhance));
    observer.observe(root, { childList:true, subtree:true });
    enhance();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once:true });
  else attach();
})();
