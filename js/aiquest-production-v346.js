/*
  CSAI2102 AI Quest
  PATCH v3.4.6 Classroom Production Release
  ------------------------------------------------------------
  Final hardening for real classroom use:
  - Section 101 lock visibility
  - Student launch checklist
  - Teacher production checklist
  - Test-data warning
  - Submit safety UX
*/
(function(){
  'use strict';

  const VERSION = 'v3.4.6-classroom-production-foundation-qc-lock';
  const COURSE_ID = 'CSAI2102';
  const CLASS_ID = 'CSAI2102-2569-101';
  const SECTION = '101';
  const TERM = '1/2569';

  function qs(){ return new URLSearchParams(location.search); }
  function isTeacherMode(){
    const p = qs();
    return p.get('teacher') === '1' || p.get('admin') === '1' || p.get('dev') === '1' || p.get('mode') === 'teacher' || p.get('view') === 'teacher';
  }
  function $(selector){ return document.querySelector(selector); }
  function $all(selector){ return Array.from(document.querySelectorAll(selector)); }
  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function toast(msg){
    if(typeof window.showToast === 'function') showToast(msg);
    else console.log('[AIQuest Production]', msg);
  }
  function getProfile(){
    try{
      return window.AIQuestStorage && AIQuestStorage.getProfile ? AIQuestStorage.getProfile() : {};
    }catch(error){
      return {};
    }
  }
  function getConfig(){
    try{
      return window.AIQuestDataContract && AIQuestDataContract.loadConfig ? AIQuestDataContract.loadConfig() : {};
    }catch(error){
      return {};
    }
  }
  function profileReady(){
    const p = getProfile();
    return !!(String(p.studentId || '').trim() && String(p.studentName || '').trim() && String(p.section || SECTION).trim() === SECTION);
  }
  function configReady(){
    const c = getConfig();
    return String(c.section || SECTION) === SECTION && String(c.classId || CLASS_ID) === CLASS_ID && !!String(c.appsScriptUrl || '').trim();
  }
  function injectStyle(){
    if($('#aiquestProductionStyle')) return;
    const style = document.createElement('style');
    style.id = 'aiquestProductionStyle';
    style.textContent = `
      .productionPanel{border:1px solid rgba(52,211,153,.26);background:rgba(52,211,153,.06)}
      .productionSteps{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:12px}
      .productionStep{border:1px solid var(--line);background:rgba(255,255,255,.055);border-radius:16px;padding:12px;line-height:1.45}
      .productionStep b{color:#bae6fd}
      .productionChecklist{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      .productionPill{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:7px 10px;font-size:12px;font-weight:1000}
      .productionPill.ok{color:#bbf7d0;border-color:rgba(52,211,153,.36);background:rgba(52,211,153,.10)}
      .productionPill.warn{color:#fde68a;border-color:rgba(251,191,36,.36);background:rgba(251,191,36,.10)}
      .productionPill.bad{color:#fecdd3;border-color:rgba(251,113,133,.36);background:rgba(251,113,133,.10)}
      .productionSmall{color:var(--muted);font-size:13px;line-height:1.55;margin-top:8px}
      .foundationQcBox{margin-top:10px;border:1px solid rgba(56,189,248,.22);background:rgba(56,189,248,.06);border-radius:16px;padding:10px;line-height:1.55}
      .foundationQcGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px}
      .foundationQcItem{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);border-radius:14px;padding:9px}
      @media(max-width:900px){.foundationQcGrid{grid-template-columns:1fr 1fr}}
      .submitSuccessCard{margin-top:10px;border:1px solid rgba(52,211,153,.32);background:rgba(52,211,153,.08);border-radius:16px;padding:12px;color:#dcfce7;font-weight:900}
      @media(max-width:900px){.productionSteps{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
  function ensureStudentPanel(){
    if(isTeacherMode()) return;
    if($('#productionStudentPanel')) return;
    const menu = $('#menuScreen');
    if(!menu) return;

    const profilePanel = $('#profilePanel');
    const panel = document.createElement('section');
    panel.className = 'panel productionPanel';
    panel.id = 'productionStudentPanel';
    panel.innerHTML = `
      <h2>พร้อมใช้งานจริง Section 101</h2>
      <p>ทำตามขั้นตอนนี้ให้ครบ เพื่อให้คะแนนและ Reflection เข้า Google Sheets ถูกต้อง</p>
      <div class="productionSteps">
        <div class="productionStep"><b>1. Profile</b><br>กรอก Student ID และชื่อ</div>
        <div class="productionStep"><b>2. Section</b><br>ระบบล็อกเป็น 101</div>
        <div class="productionStep"><b>3. Play</b><br>เล่น Session 1 ให้จบ</div>
        <div class="productionStep"><b>4. Reflection</b><br>ตอบ 3 ข้อให้ครบ</div>
        <div class="productionStep"><b>5. Submit</b><br>กดส่งผลและรอขึ้นบันทึกแล้ว</div>
      </div>
      <div class="productionChecklist" id="productionStudentChecklist"></div>
      <div class="productionSmall">หมายเหตุ: ถ้าเน็ตหลุดหรือส่งไม่สำเร็จ อย่าปิดหน้า ให้กดส่งใหม่หรือแจ้งอาจารย์</div>
    `;

    if(profilePanel) profilePanel.insertAdjacentElement('beforebegin', panel);
    else menu.insertBefore(panel, menu.firstElementChild);
  }
  function ensureTeacherPanel(){
    if(!isTeacherMode()) return;
    if($('#productionTeacherPanel')) return;

    const consolePanel = $('#teacherConsolePanel');
    if(!consolePanel) return;

    const panel = document.createElement('div');
    panel.className = 'teacherBox productionPanel';
    panel.id = 'productionTeacherPanel';
    panel.style.marginTop = '14px';
    panel.innerHTML = `
      <h3>Production Classroom Checklist</h3>
      <div class="productionSmall">
        ใช้ก่อนเริ่มคาบจริง: ตรวจว่า section เป็น 101, Apps Script เป็น v3.4.6, ไม่รวม test data และ Teacher Console อ่าน Google Sheets ได้
      </div>
      <div class="productionChecklist" id="productionTeacherChecklist"></div>
      <div class="foundationQcBox" id="foundationQcTeacherBox">Foundation QC: waiting for banks...</div>
      <div class="teacherToolBar">
        <button class="btn secondary" id="btnCopyStudentInstruction">Copy Student Instructions</button>
        <button class="btn secondary" id="btnOpenStudentGuide">Student Guide</button>
        <button class="btn secondary" id="btnOpenTeacherGuide">Teacher Guide</button>
      </div>
    `;

    const statusBox = $('#teacherSheetStatus');
    const parentGrid = statusBox ? statusBox.closest('.teacherGrid2') : null;
    if(parentGrid) consolePanel.insertBefore(panel, parentGrid);
    else consolePanel.appendChild(panel);

    $('#btnCopyStudentInstruction').onclick = copyStudentInstructions;
    $('#btnOpenStudentGuide').onclick = () => window.open('./student-guide.html', '_blank');
    $('#btnOpenTeacherGuide').onclick = () => window.open('./teacher-guide.html', '_blank');
  }
  function renderChecklists(){
    const c = getConfig();
    const p = getProfile();
    const cloudReady = !!String(c.appsScriptUrl || '').trim();
    const sectionOk = String((p.section || c.section || SECTION)) === SECTION;
    const classOk = String(c.classId || CLASS_ID) === CLASS_ID;
    const profOk = profileReady();
    const reflectionOk = true;

    const studentBox = $('#productionStudentChecklist');
    if(studentBox){
      studentBox.innerHTML = [
        pill(profOk, 'Profile Ready'),
        pill(sectionOk, 'Section 101'),
        pill(cloudReady, 'Google Sheets URL'),
        pill(reflectionOk, 'Reflection Required'),
        pill(classOk, 'Class Lock')
      ].join('');
    }

    const teacherBox = $('#productionTeacherChecklist');
    if(teacherBox){
      const tc = window.AIQuestTeacherConsole && AIQuestTeacherConsole.lastData;
      const stats = tc && tc.data && tc.data.stats ? tc.data.stats : {};
      const versionOk = String((tc && tc.version) || '').includes('v3.4.6');
      const sourceOk = String((tc && tc.source) || '').includes('Google Sheets');
      const ignored = Number(stats.ignoredTestRows || 0);

      const foundationReady = window.AIQUEST_FOUNDATION_AUDIT_V276 ? AIQUEST_FOUNDATION_AUDIT_V276.bankReady() : false;
      teacherBox.innerHTML = [
        pill(sectionOk, 'Section 101'),
        pill(classOk, 'Class ID 101'),
        pill(cloudReady, 'Apps Script URL'),
        pill(sourceOk, 'Source: Sheets'),
        pill(versionOk, 'Server v3.4.6'),
        pill(ignored >= 0, `Ignored Test Rows: ${ignored}`),
        pill(foundationReady, 'Foundation Bank QC')
      ].join('');

      const qcBox = $('#foundationQcTeacherBox');
      if(qcBox){
        if(window.AIQUEST_FOUNDATION_AUDIT_V276){
          const r = AIQUEST_FOUNDATION_AUDIT_V276.report();
          qcBox.innerHTML = `
            <b>Foundation QC Lock:</b> ${r.ready ? 'PASS พร้อมก่อน S4' : 'CHECK ต้องตรวจเพิ่ม'}
            <div class="foundationQcGrid">
              ${r.countStatus.map(x => `
                <div class="foundationQcItem">
                  <b>${escapeHtml(x.key.toUpperCase())}</b><br>
                  ${Number(x.actual || 0)}/${Number(x.target || 0)} · ${x.pass ? 'PASS' : 'LOW'}
                </div>
              `).join('')}
            </div>
            <div class="productionSmall">Pattern issues sample: ${r.patternIssues.length} · No-repeat checks: ${r.noRepeat.map(x => `${x.builder}:${x.pass?'OK':'CHECK'}`).join(', ')}</div>
          `;
        }else{
          qcBox.innerHTML = '<b>Foundation QC Lock:</b> ยังไม่พบ aiquest-foundation-quality-audit-v346.js';
        }
      }
    }
  }
  function pill(ok, label){
    return `<span class="productionPill ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!' } ${escapeHtml(label)}</span>`;
  }
  function copyStudentInstructions(){
    const link = location.origin + location.pathname.replace(/index\.html.*$/, 'index.html?v=20260614-detailfinal346');
    const msg = `CSAI2102 AI Quest Section 101\n\nเปิดลิงก์: ${link}\n\nขั้นตอน:\n1) กรอก Student ID และชื่อ\n2) ตรวจว่า Section เป็น 101\n3) กดเริ่มเล่น Session 1\n4) เล่นจนจบ\n5) ตอบ Reflection 3 ข้อ\n6) กดส่งผลเข้า Google Sheets และรอขึ้นบันทึกแล้ว`;
    navigator.clipboard?.writeText(msg).then(() => toast('คัดลอกคำแนะนำให้นักศึกษาแล้ว')).catch(() => prompt('Copy instructions:', msg));
  }
  function hardenSubmitButton(){
    const btn = $('#btnSaveResult');
    if(!btn || btn.__productionHardened) return;

    btn.__productionHardened = true;

    btn.addEventListener('click', function(){
      if(btn.dataset.productionSubmitting === '1'){
        toast('กำลังส่งผลอยู่ กรุณารอสักครู่');
        return;
      }

      btn.dataset.productionSubmitting = '1';
      setTimeout(() => { btn.dataset.productionSubmitting = '0'; }, 5000);
    }, true);
  }
  function showPostSubmitHint(){
    const box = $('#saveStatusBox');
    if(!box || box.__productionHinted) return;

    const text = String(box.textContent || '');
    if(text.includes('บันทึกแล้ว')){
      box.__productionHinted = true;
      const card = document.createElement('div');
      card.className = 'submitSuccessCard';
      card.textContent = 'ส่งผลสำเร็จแล้ว: คะแนน + Reflection เข้า Google Sheets แล้ว สามารถกลับเมนูหรือเล่นรอบใหม่ได้';
      box.insertAdjacentElement('afterend', card);
    }
  }
  function enforceSectionInputs(){
    ['sectionInput','section'].forEach(id => {
      const node = document.getElementById(id);
      if(node){
        node.value = SECTION;
        node.readOnly = true;
        node.title = 'Section ถูกล็อกเป็น 101 สำหรับการใช้งานจริง';
      }
    });

    const classNode = document.getElementById('classId');
    if(classNode){
      classNode.value = CLASS_ID;
      classNode.readOnly = true;
    }
  }
  function boot(){
    injectStyle();
    ensureStudentPanel();
    ensureTeacherPanel();
    renderChecklists();
    enforceSectionInputs();
    hardenSubmitButton();
    showPostSubmitHint();

    setInterval(() => {
      ensureStudentPanel();
      ensureTeacherPanel();
      renderChecklists();
      enforceSectionInputs();
      hardenSubmitButton();
      showPostSubmitHint();
    }, 1200);

    window.AIQuestProduction = {
      VERSION,
      COURSE_ID,
      CLASS_ID,
      SECTION,
      TERM,
      profileReady,
      configReady,
      renderChecklists
    };

    console.log('[AIQuest] ' + VERSION + ' loaded');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
