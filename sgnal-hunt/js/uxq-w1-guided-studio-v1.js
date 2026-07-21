/* CSAI2601 UX Quest • W1 Guided Studio v1
 * Reorganizes the existing canonical W1 fields into a clear seven-step assignment.
 * Uses existing fields/validation/submission. No Sheet or Apps Script changes.
 */
(() => {
  'use strict';
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const node = String(new URLSearchParams(location.search).get('node') || '').toUpperCase();
  if (node !== 'W1') return;

  let step = 0;
  const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const STEP_META = [
    ['ชิ้นงานที่ต้องส่ง','ดูภาพรวมก่อนเริ่ม'],
    ['ตั้งโครงการและสร้าง Figma','สร้างไฟล์สำหรับ UX Audit'],
    ['Frame A • ผู้ใช้และงาน','กำหนด User, Task และ Context'],
    ['Frame B • จุดติดขัด','ทำ Annotation จากหลักฐาน'],
    ['Frame C • ผลกระทบและแนวทางแก้','เชื่อม Impact → Fix → Test'],
    ['Reflection','สรุปสิ่งที่เรียนรู้'],
    ['ตรวจงานและส่ง','วาง URL ยืนยัน Self-check แล้ว Submit']
  ];

  function installStyle() {
    if (document.getElementById('uxq-w1-guided-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w1-guided-style-v1';
    style.textContent = `
      .artifact[data-w1-guided='1']{position:relative}
      .artifact[data-w1-guided='1']>.studio-flow,.artifact[data-w1-guided='1']>.studio-policy{display:none!important}
      .w1-guide{display:grid;gap:12px}
      .w1-guide__progress{position:sticky;top:8px;z-index:20;padding:11px;border:1px solid rgba(110,231,255,.35);border-radius:15px;background:rgba(5,18,42,.97);box-shadow:0 10px 28px rgba(0,0,0,.28)}
      .w1-guide__top{display:flex;justify-content:space-between;gap:12px;align-items:center}.w1-guide__top b{font-size:1rem}.w1-guide__top span{font-size:.8rem;color:#b9cbea}
      .w1-guide__bar{height:8px;margin-top:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.w1-guide__bar i{display:block;height:100%;background:linear-gradient(90deg,#6ee7ff,#79eda5);transition:.2s}
      .w1-guide__steps{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-top:8px}.w1-guide__dot{padding:5px 3px;border:1px solid rgba(181,205,255,.18);border-radius:999px;text-align:center;font-size:.64rem;color:#8295b8}.w1-guide__dot.is-active{background:#6ee7ff;color:#071124;border-color:#6ee7ff;font-weight:900}.w1-guide__dot.is-done{color:#79eda5;border-color:rgba(121,237,165,.5)}
      .w1-guide__panel{display:none;gap:13px}.w1-guide__panel.is-active{display:grid}
      .w1-brief{display:grid;gap:10px;padding:15px;border:1px solid rgba(110,231,255,.28);border-radius:15px;background:rgba(110,231,255,.055)}
      .w1-brief h3,.w1-brief h4{margin:0}.w1-brief p{margin:0;line-height:1.55;color:#d5e3fa}.w1-brief ol,.w1-brief ul{margin:0;padding-left:1.25rem;display:grid;gap:7px;color:#dce9ff;line-height:1.5}
      .w1-output{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.w1-output article{padding:11px;border:1px solid rgba(181,205,255,.2);border-radius:13px;background:rgba(3,13,31,.38)}.w1-output b{display:block;color:#fff;margin-bottom:5px}.w1-output small{color:#afc0dd;line-height:1.45}
      .w1-example{padding:10px 12px;border-left:4px solid #ffd166;border-radius:10px;background:rgba(255,209,102,.08);color:#ffe8af;line-height:1.5}
      .w1-figma-actions{display:flex;gap:8px;flex-wrap:wrap}.w1-figma-actions a{display:inline-grid;place-items:center;min-height:42px;padding:8px 14px;border-radius:11px;background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124;text-decoration:none;font-weight:900}.w1-figma-actions span{align-self:center;color:#b8c9e6;font-size:.8rem}
      .w1-guide__nav{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:4px}.w1-guide__nav button{min-height:46px;border-radius:12px;border:1px solid rgba(110,231,255,.35);font:inherit;font-weight:900;cursor:pointer}.w1-guide__prev{background:rgba(255,255,255,.04);color:#dce9ff}.w1-guide__next{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}.w1-guide__nav button:disabled{opacity:.35;cursor:not-allowed}
      .artifact[data-w1-guided='1']>.studio-field,.artifact[data-w1-guided='1']>.studio-checks,.artifact[data-w1-guided='1']>.studio-validation,.artifact[data-w1-guided='1']>.actions{display:none!important}
      .w1-guide__panel .studio-field,.w1-guide__panel .studio-checks,.w1-guide__panel .studio-validation,.w1-guide__panel .actions{display:grid!important}
      .w1-guide__panel .actions{gap:8px}.w1-guide__panel .actions .btn{min-height:48px}
      @media(max-width:760px){
        .w1-guide__progress{top:4px;padding:9px}.w1-guide__top b{font-size:.88rem}.w1-guide__top span{font-size:.7rem}
        .w1-guide__steps{grid-template-columns:repeat(7,28px);overflow-x:auto;justify-content:start;padding-bottom:3px}.w1-guide__dot{font-size:.58rem;padding:4px 2px}
        .w1-output{grid-template-columns:1fr}.w1-brief{padding:12px}.w1-brief p,.w1-brief li{font-size:.88rem}
        .w1-guide__nav{position:sticky;bottom:8px;z-index:18;padding:7px;border-radius:13px;background:rgba(5,18,42,.96);box-shadow:0 8px 22px rgba(0,0,0,.32)}
        .w1-guide__nav button{min-height:44px;font-size:.84rem}
      }
    `;
    document.head.appendChild(style);
  }

  function field(artifact, key) {
    return artifact.querySelector(`[data-studio-key="${key}"]`)?.closest('.studio-field') || null;
  }

  function panel(index, html = '') {
    const section = document.createElement('section');
    section.className = 'w1-guide__panel';
    section.dataset.w1Step = String(index);
    if (html) section.innerHTML = html;
    return section;
  }

  function add(panelEl, elements) {
    elements.filter(Boolean).forEach(el => panelEl.appendChild(el));
  }

  function build() {
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact || artifact.dataset.w1Guided === '1') return;

    // Remove the earlier generic mobile wizard wrappers, restoring their children first.
    artifact.querySelectorAll('.uxq-wizard-panel').forEach(wrapper => {
      while (wrapper.firstChild) artifact.insertBefore(wrapper.firstChild, wrapper);
      wrapper.remove();
    });
    artifact.querySelector('.uxq-wizard-progress')?.remove();
    artifact.querySelector('.uxq-wizard-nav')?.remove();
    delete artifact.dataset.mobileWizard;

    const projectId = field(artifact,'projectId');
    const figmaUrl = field(artifact,'figmaUrl');
    const context = field(artifact,'targetUserTaskContext');
    const friction = field(artifact,'frictionEvidence');
    const impact = field(artifact,'impactAnalysis');
    const fix = field(artifact,'initialFix');
    const test = field(artifact,'testIdea');
    const reflection = field(artifact,'reflection');
    const checks = artifact.querySelector('.studio-checks');
    const validation = artifact.querySelector('.studio-validation');
    const actions = artifact.querySelector(':scope > .actions');
    if (![projectId,figmaUrl,context,friction,impact,fix,test,reflection,checks,actions].every(Boolean)) return;

    artifact.dataset.w1Guided = '1';
    const guide = document.createElement('div');
    guide.className = 'w1-guide';
    guide.innerHTML = `<div class="w1-guide__progress"><div class="w1-guide__top"><b data-w1-title></b><span data-w1-count></span></div><div class="w1-guide__bar"><i></i></div><div class="w1-guide__steps">${STEP_META.map((_,i)=>`<span class="w1-guide__dot">${i+1}</span>`).join('')}</div></div>`;

    const p0 = panel(0, `<div class="w1-brief"><h3>ชิ้นงาน W1: UX First Impression Audit Board</h3><p>เลือกเว็บหรือระบบจริง 1 ระบบ แล้วทำ Board ใน Figma เพื่อแสดงว่า “ผู้ใช้ติดตรงไหน เพราะอะไร กระทบงานอย่างไร และจะพิสูจน์แนวทางแก้อย่างไร”</p><div class="w1-output"><article><b>Frame A — Context</b><small>Screenshot หน้าจอจริง + ผู้ใช้หลัก + Task + สถานการณ์ใช้งาน</small></article><article><b>Frame B — UX Audit</b><small>วง/ลูกศร/หมายเลขกำกับ Friction พร้อมหลักฐาน ไม่ใช้ความชอบส่วนตัว</small></article><article><b>Frame C — Decision</b><small>Impact ต่อ Task + แนวทางแก้เบื้องต้น + วิธีวัดผล</small></article></div><div class="w1-example"><b>สิ่งที่ไม่ต้องทำใน W1:</b> ยังไม่ต้องสร้าง Wireframe, Persona หรือ Before–After Redesign</div></div>`);

    const p1 = panel(1, `<div class="w1-brief"><h3>สร้างไฟล์ Figma ก่อน</h3><ol><li>กด “เปิด Figma” แล้วสร้าง Design file ใหม่</li><li>ตั้งชื่อไฟล์: <b>W1-UX-Audit-รหัสนักศึกษา</b></li><li>สร้าง 3 Frames ชื่อ <b>A-Context</b>, <b>B-UX-Audit</b>, <b>C-Fix-Test</b></li><li>กลับมากรอก Project ID ด้านล่าง</li></ol><div class="w1-figma-actions"><a href="https://www.figma.com/files/" target="_blank" rel="noopener">เปิด Figma</a><span>Figma → New design file</span></div></div>`);
    add(p1,[projectId]);

    const p2 = panel(2, `<div class="w1-brief"><h3>ทำ Frame A — Context</h3><ol><li>ใส่ Screenshot หน้าจอจริงที่เลือก</li><li>เขียนว่าใครคือผู้ใช้หลัก</li><li>ระบุ Task ที่ผู้ใช้ต้องทำให้สำเร็จ</li><li>ระบุอุปกรณ์และสถานการณ์ใช้งาน</li></ol><div class="w1-example">ตัวอย่าง: นักศึกษาปี 1 ต้องตรวจสอบสถานะลงทะเบียนบนมือถือ ระหว่างเดินทาง และต้องรู้ทันทีว่าวิชาใดลงสำเร็จ</div></div>`);
    add(p2,[context]);

    const p3 = panel(3, `<div class="w1-brief"><h3>ทำ Frame B — UX Audit Annotation</h3><ol><li>วงหรือใส่หมายเลขบนจุดที่ผู้ใช้ติดขัดอย่างน้อย 3 จุด</li><li>ทุกจุดต้องมีคำอธิบายพฤติกรรมที่สังเกตได้</li><li>แยกว่าเป็น UI, UX หรือ front-end feedback</li><li>แนบหลักฐาน เช่น screenshot, click/error, การย้อนกลับ หรือขั้นตอนที่ผู้ใช้หาไม่เจอ</li></ol><div class="w1-example">เขียน “ผู้ใช้กดเมนูผิด 2 ครั้งเพราะชื่อเมนูไม่ตรงกับ Task” ดีกว่าเขียน “เมนูไม่สวย”</div></div>`);
    add(p3,[friction]);

    const p4 = panel(4, `<div class="w1-brief"><h3>ทำ Frame C — Impact, Fix และ Test</h3><ol><li>บอกว่าปัญหากระทบ Task อย่างไร</li><li>เสนอ Fix ที่ตรงกับสาเหตุของ Friction</li><li>กำหนดวิธีพิสูจน์ว่าแบบแก้ดีขึ้น</li></ol><div class="w1-example">ตัวชี้วัดที่ใช้ได้: Task success, เวลา, จำนวน error, จำนวนการย้อนกลับ หรือความเข้าใจขั้นตอนถัดไป</div></div>`);
    add(p4,[impact,fix,test]);

    const p5 = panel(5, `<div class="w1-brief"><h3>Reflection W1</h3><p>สะท้อนว่าสิ่งใดที่ตอนแรกคิดว่าเป็นเพียงปัญหา UI แต่จริง ๆ กระทบ UX, Task success หรือ feedback ของระบบ และหลักฐานใดทำให้เปลี่ยนความคิด</p></div>`);
    add(p5,[reflection]);

    const p6 = panel(6, `<div class="w1-brief"><h3>วางลิงก์และตรวจงานก่อนส่ง</h3><ol><li>ใน Figma กด Share</li><li>ตั้งสิทธิ์ให้ผู้ตรวจเปิดดูได้</li><li>กด Copy link</li><li>วางลิงก์ในช่อง Figma URL ด้านล่าง</li><li>เช็ก Self-check ทุกข้อ แล้วกด Submit</li></ol><div class="w1-example">ลิงก์ต้องขึ้นต้นด้วย https:// และเปิดดู Board A/B/C ได้จริง</div></div>`);
    add(p6,[figmaUrl,checks,validation,actions]);

    [p0,p1,p2,p3,p4,p5,p6].forEach(p => guide.appendChild(p));
    const nav = document.createElement('div');
    nav.className = 'w1-guide__nav';
    nav.innerHTML = '<button type="button" class="w1-guide__prev">ย้อนกลับ</button><button type="button" class="w1-guide__next">เริ่มทำ</button>';
    guide.appendChild(nav);

    const head = artifact.querySelector('.studio-head');
    head?.insertAdjacentElement('afterend',guide);
    nav.querySelector('.w1-guide__prev').addEventListener('click',()=>show(step-1,artifact));
    nav.querySelector('.w1-guide__next').addEventListener('click',()=>show(step+1,artifact));
    show(0,artifact);
  }

  function show(next, artifact) {
    const panels = Array.from(artifact.querySelectorAll('.w1-guide__panel'));
    step = Math.max(0,Math.min(panels.length-1,next));
    panels.forEach((p,i)=>p.classList.toggle('is-active',i===step));
    const meta = STEP_META[step];
    artifact.querySelector('[data-w1-title]').textContent = `ขั้นที่ ${step+1} • ${meta[0]}`;
    artifact.querySelector('[data-w1-count]').textContent = `${step+1}/7`;
    artifact.querySelector('.w1-guide__bar i').style.width = `${((step+1)/7)*100}%`;
    artifact.querySelectorAll('.w1-guide__dot').forEach((dot,i)=>{dot.classList.toggle('is-active',i===step);dot.classList.toggle('is-done',i<step);});
    const prev = artifact.querySelector('.w1-guide__prev');
    const nextBtn = artifact.querySelector('.w1-guide__next');
    prev.disabled = step===0;
    nextBtn.hidden = step===panels.length-1;
    nextBtn.textContent = step===0?'เริ่มทำ':step===5?'ไปตรวจงาน':'ถัดไป';
    artifact.querySelector('.w1-guide__progress')?.scrollIntoView?.({behavior:'smooth',block:'start'});
  }

  let timer;
  const schedule = () => { clearTimeout(timer); timer=setTimeout(()=>{installStyle();build();},120); };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(ROOT,{childList:true,subtree:true});
  window.UXQW1GuidedStudioV1=Object.freeze({build,version:'20260721-W1-GUIDED-STUDIO-V1'});
})();