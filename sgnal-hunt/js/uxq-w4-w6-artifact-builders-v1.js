/* UX Quest • W4–W6 Artifact Builders v1
 * Turns mission debriefs into editable Persona, Storyboard and Flow studio artifacts.
 */
(() => {
  'use strict';

  const path = String(location.pathname || '').toLowerCase();
  const id = path.includes('w4-user-insight-lab') ? 'w4' : path.includes('w5-concept-forge') ? 'w5' : path.includes('w6-flow-rescue') ? 'w6' : '';
  if (!id) return;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const key = `uxq.artifact-builder.${id}.v1`;

  const spec = {
    w4:{
      eyebrow:'W4 • Persona & Empathy Builder',
      title:'Persona Evidence Canvas',
      lead:'เปลี่ยน insight จากเกมให้เป็น Persona และ Empathy Map ที่ใช้ต่อในใบงานได้จริง โดยยึดสิ่งที่เห็นหรือได้ยินจากผู้ใช้ก่อนตีความ',
      fields:[
        ['persona','Persona + บริบท','เช่น เมย์ • นักศึกษาทำงานพิเศษที่กรอกใบสมัครทุนบนมือถือเป็นช่วง ๆ'],
        ['saydo','Says / Does','เช่น “ไม่แน่ใจว่าไฟล์ส่งหรือยัง” • ถ่ายภาพหน้าจอและกลับไปตรวจหน้าแรก'],
        ['thinkfeel','Thinks / Feels','เช่น กังวลว่าข้อมูลหาย และกลัวพลาดกำหนดส่ง'],
        ['pain','Pain / Friction','เช่น สถานะการบันทึกและรายการเอกสารที่ขาดไม่ชัด'],
        ['need','Need / Gain','เช่น ต้องการรู้ว่างานใดบันทึกแล้วและต้องทำอะไรต่อ'],
        ['pov','POV / HMW','เช่น เราจะช่วยผู้สมัครที่ทำงานเป็นช่วง ๆ กลับมาทำต่อได้มั่นใจอย่างไร?']
      ]
    },
    w5:{
      eyebrow:'W5 • Idea & Storyboard Builder',
      title:'Diverge → Select → Storyboard',
      lead:'สร้างอย่างน้อย 3 แนวคิดจาก HMW แล้วเลือกแนวคิดหนึ่งมาวาง storyboard 4 ช่องเพื่อเตรียมทำ prototype',
      fields:[
        ['hmw','HMW','เริ่มด้วย “เราจะช่วย…” โดยยังไม่ล็อกสี ปุ่ม หรือเทคโนโลยี'],
        ['ideaA','Idea A — แนวคิดแรก','แนวคิดช่วยลด friction อย่างไร'],
        ['ideaB','Idea B — แนวคิดทางเลือก','แตกต่างจาก Idea A อย่างไร'],
        ['ideaC','Idea C — แนวคิดที่สาม','ตอบ need ในอีกแนวหนึ่งอย่างไร'],
        ['scene1','Storyboard 1 • Context','ผู้ใช้อยู่ที่ไหน กำลังพยายามทำ task อะไร'],
        ['scene2','Storyboard 2 • Friction','ผู้ใช้ติดขัดหรือกังวลตรงไหน'],
        ['scene3','Storyboard 3 • Design Action','แนวคิดใหม่ช่วยให้ผู้ใช้ตัดสินใจหรือทำอะไรได้'],
        ['scene4','Storyboard 4 • Feedback / Outcome','ผู้ใช้รู้ว่าสำเร็จและต้องทำอะไรต่ออย่างไร']
      ],
      selectIdea:true
    },
    w6:{
      eyebrow:'W6 • Sitemap & Flow Builder',
      title:'Card Sort → Sitemap → User Flow',
      lead:'แปลงโครงสร้างที่ฝึกจาก Card Sort ให้เป็น Sitemap และ User Flow แบบย่อ โดยจัดกลุ่มตาม mental model ของผู้ใช้ ไม่ใช่ตามฝ่ายงาน',
      fields:[
        ['root','ชื่อบริการและ Task หลัก','เช่น ระบบจองอุปกรณ์ • ยืมกล้องสำหรับงานกลุ่ม'],
        ['nav1','กลุ่มนำทาง 1 + รายการย่อย','เช่น จองอุปกรณ์: เลือกวัน, ดูของว่าง, เงื่อนไข'],
        ['nav2','กลุ่มนำทาง 2 + รายการย่อย','เช่น การจองของฉัน: สถานะ, แก้ไข, ยกเลิก'],
        ['nav3','กลุ่มนำทาง 3 + รายการย่อย','เช่น รับ–คืน: จุดรับ, เวลา, ค่าปรับ, ความช่วยเหลือ'],
        ['flow1','Flow 1 • Entry','ผู้ใช้เริ่มจากจุดใด'],
        ['flow2','Flow 2 • Decision','ข้อมูลใดช่วยให้เลือก/เปรียบเทียบ'],
        ['flow3','Flow 3 • Confirm','ตรวจเงื่อนไขใดก่อนยืนยัน'],
        ['flow4','Flow 4 • State','ระบบบอกอะไรหลัง action สำคัญ'],
        ['flow5','Flow 5 • Next step','ผู้ใช้ทำอะไรต่อ หรือกลับมาติดตามงานอย่างไร']
      ]
    }
  }[id];

  function addStyle(){
    if (document.getElementById('uxq-artifact-builder-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-artifact-builder-style';
    style.textContent = '.uxq-artifact-builder{width:min(860px,100%);text-align:left;border:1px solid rgba(110,231,255,.4);border-radius:19px;padding:17px;background:linear-gradient(145deg,rgba(18,52,91,.50),rgba(155,140,255,.10));display:grid;gap:12px}.uxq-artifact-builder__eyebrow{font-size:.72rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#6ee7ff}.uxq-artifact-builder h3{margin:0;color:#fff;font-size:1.08rem}.uxq-artifact-builder p{margin:0;color:#dbe8ff;line-height:1.58;font-size:.9rem}.uxq-artifact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.uxq-artifact-field{display:grid;gap:6px}.uxq-artifact-field--wide{grid-column:1/-1}.uxq-artifact-field label{font-weight:850;color:#f1f7ff;font-size:.83rem}.uxq-artifact-field textarea{resize:vertical;min-height:74px;width:100%;border:1px solid rgba(181,205,255,.28);border-radius:11px;background:rgba(4,14,33,.52);color:#f4f8ff;padding:10px;font:inherit;line-height:1.45}.uxq-artifact-choice{display:flex;flex-wrap:wrap;gap:8px}.uxq-artifact-choice label{display:flex;gap:6px;align-items:center;border:1px solid rgba(181,205,255,.24);border-radius:10px;padding:8px 10px;color:#eaf3ff;font-size:.84rem;cursor:pointer}.uxq-artifact-choice input{accent-color:#6ee7ff}.uxq-artifact-save{justify-self:start;border:0;border-radius:11px;background:#6ee7ff;color:#06152e;padding:10px 14px;font-weight:900}.uxq-artifact-status{font-size:.82rem;color:#b8f9d2;min-height:18px}@media(max-width:720px){.uxq-artifact-grid{grid-template-columns:1fr}.uxq-artifact-field--wide{grid-column:auto}}';
    document.head.appendChild(style);
  }
  function read(){
    try { return JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key) || '{}'); }
    catch (error) { return {}; }
  }
  function save(data){
    const text = JSON.stringify(Object.assign({missionId:id,savedAt:new Date().toISOString()}, data));
    try { localStorage.setItem(key,text); return; } catch (error) {}
    try { sessionStorage.setItem(key,text); } catch (error) {}
  }
  function render(){
    const result = $('.uxq-results');
    if (!result || $('.uxq-artifact-builder', result)) return;
    addStyle();
    const prior = read();
    const fields = spec.fields.map(([name,label,placeholder], index) => `<div class="uxq-artifact-field ${index === 0 || name === 'hmw' || name === 'root' || name === 'pov' ? 'uxq-artifact-field--wide' : ''}"><label for="uxqArtifact_${esc(name)}">${esc(label)}</label><textarea id="uxqArtifact_${esc(name)}" data-artifact="${esc(name)}" placeholder="${esc(placeholder)}">${esc(prior[name] || '')}</textarea></div>`).join('');
    const selector = spec.selectIdea ? `<div class="uxq-artifact-field uxq-artifact-field--wide"><label>แนวคิดที่เลือกนำไปทำ Storyboard</label><div class="uxq-artifact-choice"><label><input type="radio" name="uxqSelectedIdea" value="ideaA" ${prior.selectedIdea === 'ideaA' ? 'checked' : ''}> Idea A</label><label><input type="radio" name="uxqSelectedIdea" value="ideaB" ${prior.selectedIdea === 'ideaB' ? 'checked' : ''}> Idea B</label><label><input type="radio" name="uxqSelectedIdea" value="ideaC" ${prior.selectedIdea === 'ideaC' ? 'checked' : ''}> Idea C</label></div></div>` : '';
    const board = document.createElement('section');
    board.className = 'uxq-artifact-builder';
    board.innerHTML = `<div class="uxq-artifact-builder__eyebrow">Studio Artifact • ${esc(spec.eyebrow)}</div><h3>${esc(spec.title)}</h3><p>${esc(spec.lead)}</p><div class="uxq-artifact-grid">${fields}${selector}</div><button type="button" class="uxq-artifact-save">บันทึก Artifact ในอุปกรณ์นี้</button><span class="uxq-artifact-status" aria-live="polite"></span>`;
    const anchor = $('.uxq-transfer-board', result) || $('.uxq-submission-receipt', result) || $('.uxq-takeaway', result);
    if (anchor) anchor.insertAdjacentElement('afterend', board); else result.appendChild(board);
    $('.uxq-artifact-save', board)?.addEventListener('click', () => {
      const data = {};
      $$('[data-artifact]', board).forEach((input) => { data[input.dataset.artifact] = String(input.value || '').trim(); });
      if (spec.selectIdea) data.selectedIdea = $('input[name="uxqSelectedIdea"]:checked', board)?.value || '';
      const required = spec.selectIdea ? Object.keys(data).filter((name) => name !== 'selectedIdea') : Object.keys(data);
      if (required.some((name) => !data[name]) || (spec.selectIdea && !data.selectedIdea)) {
        $('.uxq-artifact-status', board).textContent = 'กรอก Artifact ให้ครบก่อนบันทึก เพื่อให้ชิ้นงานนำไปใช้ต่อในใบงานได้จริง';
        return;
      }
      save(data);
      $('.uxq-artifact-status', board).textContent = 'บันทึก Artifact แล้ว — นำข้อความนี้ไปพัฒนาเป็น Persona / Storyboard / Sitemap และ User Flow ฉบับส่งงานได้';
    });
  }
  function boot(){
    render();
    new MutationObserver(() => requestAnimationFrame(render)).observe(document.documentElement,{childList:true,subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot,{once:true});
  else boot();
})();
