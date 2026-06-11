/*
  CSAI2102 AI Quest
  PATCH v2.4.1 Teacher Console Hotfix
  ------------------------------------------------------------
  Teacher Mode = Teacher Console first, game tools hidden by default.
  Open with:
    /ai-quest/index.html?teacher=1
*/
(function(){
  'use strict';

  const VERSION = 'v2.4.1-teacher-console-hotfix';
  const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  function qs(){
    return new URLSearchParams(location.search);
  }

  function isTeacherMode(){
    const p = qs();
    return (
      p.get('teacher') === '1' ||
      p.get('admin') === '1' ||
      p.get('dev') === '1' ||
      p.get('mode') === 'teacher' ||
      p.get('view') === 'teacher'
    );
  }

  function $(selector){
    return document.querySelector(selector);
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function getConfig(){
    const fallback = {
      appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
      courseId:'CSAI2102',
      classId:'CSAI2102-2569-SEC01',
      term:'1/2569',
      section:'SEC01',
      activeSession:'s1'
    };

    try{
      if(window.AIQuestDataContract && AIQuestDataContract.loadConfig){
        return Object.assign({}, fallback, AIQuestDataContract.loadConfig());
      }
    }catch(error){}

    return fallback;
  }

  function injectStyle(){
    if($('#aiquestTeacherConsoleStyle')) return;

    const style = document.createElement('style');
    style.id = 'aiquestTeacherConsoleStyle';
    style.textContent = `
      body.teacher-console:not(.show-teacher-game-tools) .hero,
      body.teacher-console:not(.show-teacher-game-tools) #profilePanel,
      body.teacher-console:not(.show-teacher-game-tools) #gateSupportPanel,
      body.teacher-console:not(.show-teacher-game-tools) #adaptiveCoachPanel,
      body.teacher-console:not(.show-teacher-game-tools) #classroomEntryPanel,
      body.teacher-console:not(.show-teacher-game-tools) #runModePanel,
      body.teacher-console:not(.show-teacher-game-tools) .layout{
        display:none !important;
      }

      body.teacher-console .teacherConsolePanel{
        display:block;
      }

      .teacherConsolePanel{
        margin-top:16px;
      }

      .teacherConsoleHeader{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        flex-wrap:wrap;
      }

      .teacherConsoleHeader h2{
        font-size:clamp(24px,3vw,34px);
        margin:0;
      }

      .teacherConsoleSub{
        color:var(--muted);
        line-height:1.6;
        margin-top:6px;
      }

      .teacherStatusGrid{
        display:grid;
        grid-template-columns:repeat(7,1fr);
        gap:10px;
        margin-top:16px;
      }

      .teacherMetric{
        border:1px solid var(--line);
        background:rgba(255,255,255,.06);
        border-radius:18px;
        padding:14px;
        min-height:96px;
      }

      .teacherMetric .num{
        font-size:30px;
        font-weight:1000;
        line-height:1;
        letter-spacing:-.03em;
      }

      .teacherMetric .label{
        margin-top:7px;
        color:var(--muted);
        font-size:12px;
        font-weight:900;
        line-height:1.35;
      }

      .teacherMetric.good{border-color:rgba(52,211,153,.38);background:rgba(52,211,153,.08)}
      .teacherMetric.warn{border-color:rgba(251,191,36,.42);background:rgba(251,191,36,.08)}
      .teacherMetric.bad{border-color:rgba(251,113,133,.42);background:rgba(251,113,133,.08)}

      .teacherGrid2{
        display:grid;
        grid-template-columns:1.2fr .8fr;
        gap:14px;
        margin-top:14px;
      }

      .teacherBox{
        border:1px solid var(--line);
        background:rgba(255,255,255,.045);
        border-radius:20px;
        padding:14px;
      }

      .teacherBox h3{
        margin:0 0 10px;
        font-size:18px;
      }

      .teacherTableWrap{
        overflow:auto;
        max-height:390px;
        border-radius:16px;
        border:1px solid var(--line);
      }

      .teacherTable{
        width:100%;
        border-collapse:collapse;
        min-width:720px;
        font-size:13px;
      }

      .teacherTable th,
      .teacherTable td{
        padding:10px 10px;
        border-bottom:1px solid rgba(255,255,255,.08);
        text-align:left;
        vertical-align:top;
      }

      .teacherTable th{
        position:sticky;
        top:0;
        background:#101a2e;
        color:#bae6fd;
        z-index:1;
      }

      .teacherTable tr:last-child td{
        border-bottom:0;
      }

      .riskTag{
        display:inline-flex;
        margin:2px 4px 2px 0;
        padding:4px 7px;
        border-radius:999px;
        font-size:11px;
        font-weight:900;
        border:1px solid rgba(251,191,36,.32);
        background:rgba(251,191,36,.10);
        color:#fde68a;
      }

      .riskTag.bad{
        border-color:rgba(251,113,133,.36);
        background:rgba(251,113,133,.10);
        color:#fecdd3;
      }

      .riskTag.good{
        border-color:rgba(52,211,153,.34);
        background:rgba(52,211,153,.10);
        color:#bbf7d0;
      }

      .misBar{
        margin:9px 0;
      }

      .misBarTop{
        display:flex;
        justify-content:space-between;
        gap:12px;
        font-size:13px;
        font-weight:900;
      }

      .misTrack{
        margin-top:5px;
        height:10px;
        border-radius:999px;
        overflow:hidden;
        border:1px solid var(--line);
        background:rgba(255,255,255,.06);
      }

      .misFill{
        height:100%;
        background:linear-gradient(90deg,#38bdf8,#a78bfa);
        width:0%;
      }

      .teacherToolBar{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:14px;
      }

      .teacherSmallNote{
        color:var(--muted);
        font-size:13px;
        line-height:1.55;
      }

      .teacherHealth{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin-top:10px;
      }

      .teacherHealth .pillLike{
        display:inline-flex;
        border:1px solid var(--line);
        background:rgba(255,255,255,.06);
        padding:7px 9px;
        border-radius:999px;
        font-size:12px;
        font-weight:900;
      }

      .teacherHealth .ok{
        color:#bbf7d0;
        border-color:rgba(52,211,153,.34);
        background:rgba(52,211,153,.10);
      }

      .teacherHealth .warn{
        color:#fde68a;
        border-color:rgba(251,191,36,.34);
        background:rgba(251,191,36,.10);
      }

      .teacherHealth .bad{
        color:#fecdd3;
        border-color:rgba(251,113,133,.34);
        background:rgba(251,113,133,.10);
      }

      @media(max-width:1000px){
        .teacherStatusGrid{grid-template-columns:repeat(3,1fr)}
        .teacherGrid2{grid-template-columns:1fr}
      }

      @media(max-width:680px){
        .teacherStatusGrid{grid-template-columns:repeat(2,1fr)}
        .teacherMetric .num{font-size:24px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureConsolePanel(){
    if($('#teacherConsolePanel')) return;

    const menu = $('#menuScreen');
    if(!menu) return;

    const panel = document.createElement('section');
    panel.className = 'panel teacherConsolePanel';
    panel.id = 'teacherConsolePanel';

    panel.innerHTML = `
      <div class="teacherConsoleHeader">
        <div>
          <h2>Teacher Console</h2>
          <div class="teacherConsoleSub" id="teacherConsoleSub">
            สรุปชั้นเรียนจาก Google Sheets: คะแนน / ส่งงาน / Reflection / Misconception / นักศึกษาที่ควรช่วย
          </div>
          <div class="teacherHealth" id="teacherHealthBox"></div>
        </div>
        <div class="teacherToolBar">
          <button class="btn good" id="btnTeacherRefresh">Refresh from Sheets</button>
          <button class="btn secondary" id="btnCopyStudentLink">Copy Student Link</button>
          <button class="btn secondary" id="btnCopyTeacherLink">Copy Teacher Link</button>
          <button class="btn secondary" id="btnTeacherToggleTools">แสดงเครื่องมือทดสอบเกม</button>
          <button class="btn secondary" id="btnTeacherExportCsv">Export Risk CSV</button>
        </div>
      </div>

      <div class="teacherStatusGrid" id="teacherStatusGrid">
        ${metricSkeleton()}
      </div>

      <div class="teacherGrid2">
        <div class="teacherBox">
          <h3>Risk Students / Students to Support</h3>
          <div class="teacherSmallNote">
            ใช้ดูว่าใครคะแนนต่ำ ใช้ AI Help เยอะ Reflection ไม่ครบ หรือยังไม่ส่ง
          </div>
          <div class="teacherTableWrap" style="margin-top:10px">
            <table class="teacherTable">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Section</th>
                  <th>Best</th>
                  <th>Latest</th>
                  <th>Help</th>
                  <th>Reflection</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody id="teacherRiskBody">
                <tr><td colspan="7">กำลังโหลดข้อมูล...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="teacherBox">
          <h3>Misconception Summary</h3>
          <div class="teacherSmallNote">
            ใช้ตัดสินใจว่าคาบถัดไปควรสอนซ้ำเรื่องใด
          </div>
          <div id="teacherMisBox" style="margin-top:10px">
            กำลังโหลดข้อมูล...
          </div>
        </div>
      </div>

      <div class="teacherGrid2">
        <div class="teacherBox">
          <h3>Teaching Decision</h3>
          <div id="teacherDecisionBox" class="teacherSmallNote">
            กำลังวิเคราะห์...
          </div>
        </div>

        <div class="teacherBox">
          <h3>Google Sheets Status</h3>
          <div id="teacherSheetStatus" class="teacherSmallNote">
            กำลังตรวจสอบ...
          </div>
        </div>
      </div>
    `;

    const first = menu.firstElementChild;
    if(first) menu.insertBefore(panel, first);
    else menu.appendChild(panel);

    $('#btnTeacherRefresh').onclick = () => refreshConsole(true);
    $('#btnTeacherToggleTools').onclick = toggleTeacherTools;
    $('#btnTeacherExportCsv').onclick = exportRiskCsv;
    $('#btnCopyStudentLink').onclick = () => copyLink('student');
    $('#btnCopyTeacherLink').onclick = () => copyLink('teacher');
  }

  function metricSkeleton(){
    const labels = ['Students','Submitted','Not Submitted','Avg Score','Mastery','Need Support','Reflection OK'];
    return labels.map(label => `
      <div class="teacherMetric">
        <div class="num">-</div>
        <div class="label">${label}</div>
      </div>
    `).join('');
  }

  function toggleTeacherTools(){
    document.body.classList.toggle('show-teacher-game-tools');
    const on = document.body.classList.contains('show-teacher-game-tools');
    const btn = $('#btnTeacherToggleTools');
    if(btn) btn.textContent = on ? 'ซ่อนเครื่องมือทดสอบเกม' : 'แสดงเครื่องมือทดสอบเกม';
  }

  function jsonp(url, params){
    return new Promise((resolve, reject) => {
      const cb = 'AIQ_TEACHER_JSONP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const u = new URL(url);

      Object.entries(params || {}).forEach(([k,v]) => {
        if(v != null && v !== '') u.searchParams.set(k, v);
      });

      u.searchParams.set('callback', cb);
      u.searchParams.set('_', Date.now());

      const script = document.createElement('script');
      let done = false;

      const timer = setTimeout(() => {
        if(done) return;
        done = true;
        cleanup();
        reject(new Error('Teacher Console request timeout'));
      }, 12000);

      function cleanup(){
        clearTimeout(timer);
        try{ delete window[cb]; }catch(error){ window[cb] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = data => {
        if(done) return;
        done = true;
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        if(done) return;
        done = true;
        cleanup();
        reject(new Error('Teacher Console JSONP failed'));
      };

      script.src = u.toString();
      document.body.appendChild(script);
    });
  }

  async function fetchConsoleData(){
    const config = getConfig();
    const url = config.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;

    const response = await jsonp(url, {
      action:'teacherConsole',
      courseId:config.courseId || 'CSAI2102',
      classId:config.classId || '',
      term:config.term || '',
      section:config.section || '',
      sessionId:config.activeSession || 's1'
    });

    if(!response || !response.ok){
      throw new Error(response && response.error ? response.error : 'Teacher Console data failed');
    }

    return response;
  }

  async function refreshConsole(showToastFlag){
    if(!isTeacherMode()) return;

    setHealth('กำลังโหลดข้อมูลจาก Google Sheets...', 'warn');

    try{
      const data = await fetchConsoleData();
      renderConsole(data);
      window.AIQuestTeacherConsole.lastData = data;

      if(showToastFlag && window.showToast){
        showToast('โหลด Teacher Console แล้ว');
      }
    }catch(error){
      renderConsole(localFallbackData(error));
      setHealth('โหลดจาก Google Sheets ไม่สำเร็จ ใช้ข้อมูล local fallback: ' + error.message, 'bad');
    }
  }

  function renderConsole(resp){
    const data = resp.data || resp || {};
    const stats = data.stats || {};

    renderHealth(resp, stats);
    renderMetrics(stats);
    renderRisks(data.risks || []);
    renderMisconceptions(data.misconceptions || []);
    renderDecision(stats, data.risks || [], data.misconceptions || []);
    renderSheetStatus(resp, stats);
  }

  function renderHealth(resp, stats){
    const cfg = getConfig();
    const box = $('#teacherHealthBox');
    if(!box) return;

    const source = resp.source || 'Google Sheets';
    const updated = resp.serverTs || new Date().toISOString();

    box.innerHTML = `
      <span class="pillLike ok">Source: ${escapeHtml(source)}</span>
      <span class="pillLike ok">Class: ${escapeHtml(cfg.classId || '-')}</span>
      <span class="pillLike ok">Section: ${escapeHtml(cfg.section || '-')}</span>
      <span class="pillLike ${Number(stats.failedSync || 0) > 0 ? 'bad' : 'ok'}">Sync: ${Number(stats.failedSync || 0) > 0 ? 'Check' : 'OK'}</span>
      <span class="pillLike warn">Updated: ${escapeHtml(updated)}</span>
    `;
  }

  function setHealth(message, type){
    const box = $('#teacherHealthBox');
    if(!box) return;
    box.innerHTML = `<span class="pillLike ${type || 'warn'}">${escapeHtml(message)}</span>`;
  }

  function renderMetrics(stats){
    const grid = $('#teacherStatusGrid');
    if(!grid) return;

    const total = Number(stats.totalStudents || 0);
    const submitted = Number(stats.submittedStudents || 0);
    const notSubmitted = Number(stats.notSubmittedStudents != null ? stats.notSubmittedStudents : Math.max(0, total - submitted));
    const avg = Number(stats.avgScore || 0);
    const mastery = Number(stats.masteryCount || 0);
    const need = Number(stats.needSupport || 0);
    const refl = Number(stats.reflectionComplete || 0);

    const reflPct = submitted ? Math.round(refl / submitted * 100) : 0;

    const metrics = [
      {label:'Students', value:total, cls:'', hint:'profile/attempt ทั้งหมด'},
      {label:'Submitted', value:submitted, cls:submitted >= total && total ? 'good' : 'warn', hint:'มี attempt แล้ว'},
      {label:'Not Submitted', value:notSubmitted, cls:notSubmitted ? 'bad' : 'good', hint:'ยังไม่มี attempt'},
      {label:'Avg Score', value:avg ? avg.toFixed(1) : '0.0', cls:avg >= 70 ? 'good' : avg >= 60 ? 'warn' : 'bad', hint:'เฉลี่ยจากผู้ส่งแล้ว'},
      {label:'Mastery', value:mastery, cls:mastery ? 'good' : '', hint:'ผ่านระดับ Mastery'},
      {label:'Need Support', value:need, cls:need ? 'bad' : 'good', hint:'ควรช่วยเพิ่ม'},
      {label:'Reflection OK', value:reflPct + '%', cls:reflPct >= 90 ? 'good' : reflPct >= 70 ? 'warn' : 'bad', hint:'ครบในกลุ่มที่ส่งแล้ว'}
    ];

    grid.innerHTML = metrics.map(m => `
      <div class="teacherMetric ${m.cls}">
        <div class="num">${escapeHtml(m.value)}</div>
        <div class="label">${escapeHtml(m.label)}<br><span class="teacherSmallNote">${escapeHtml(m.hint)}</span></div>
      </div>
    `).join('');
  }

  function renderRisks(risks){
    const body = $('#teacherRiskBody');
    if(!body) return;

    if(!risks.length){
      body.innerHTML = `<tr><td colspan="7">ยังไม่พบนักศึกษาที่ต้องช่วยเป็นพิเศษ หรือยังไม่มีข้อมูล attempt</td></tr>`;
      return;
    }

    body.innerHTML = risks.slice(0, 80).map(r => {
      const tags = (r.risks || []).map(tag => {
        const bad = /ต่ำ|ไม่ครบ|ยังไม่ส่ง|ผิด|help|Help|remedial/i.test(tag);
        return `<span class="riskTag ${bad ? 'bad' : 'warn'}">${escapeHtml(tag)}</span>`;
      }).join(' ');

      return `
        <tr>
          <td><b>${escapeHtml(r.studentId || '-')}</b><br>${escapeHtml(r.studentName || '')}</td>
          <td>${escapeHtml(r.section || '-')}</td>
          <td>${escapeHtml(r.bestScore ?? '-')}</td>
          <td>${escapeHtml(r.latestScore ?? '-')}</td>
          <td>${escapeHtml(r.helpUsed ?? '-')}</td>
          <td>${r.reflectionComplete ? '<span class="riskTag good">ครบ</span>' : '<span class="riskTag bad">ไม่ครบ</span>'}</td>
          <td>${tags || '<span class="riskTag good">ปกติ</span>'}</td>
        </tr>
      `;
    }).join('');
  }

  function renderMisconceptions(items){
    const box = $('#teacherMisBox');
    if(!box) return;

    if(!items.length){
      box.innerHTML = 'ยังไม่มี misconception ชัดเจน';
      return;
    }

    const max = Math.max(...items.map(x => Number(x.count || 0)), 1);

    box.innerHTML = items.slice(0, 10).map(item => {
      const pct = Math.round(Number(item.count || 0) / max * 100);
      return `
        <div class="misBar">
          <div class="misBarTop">
            <span>${escapeHtml(item.key || item.name || '-')}</span>
            <span>${Number(item.count || 0)}</span>
          </div>
          <div class="misTrack"><div class="misFill" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');
  }

  function renderDecision(stats, risks, misconceptions){
    const box = $('#teacherDecisionBox');
    if(!box) return;

    const topMis = misconceptions && misconceptions[0] ? misconceptions[0].key : '';
    const avg = Number(stats.avgScore || 0);
    const need = Number(stats.needSupport || 0);
    const refl = Number(stats.reflectionComplete || 0);
    const submitted = Number(stats.submittedStudents || 0);
    const total = Number(stats.totalStudents || 0);
    const notSubmitted = Number(stats.notSubmittedStudents != null ? stats.notSubmittedStudents : Math.max(0, total - submitted));

    const lines = [];

    if(submitted === 0){
      lines.push('ยังไม่มีข้อมูลส่งผลจากนักศึกษา ให้เริ่มจากการทดสอบ Save Result 1 คนก่อน');
    }else{
      if(avg < 60){
        lines.push('คะแนนเฉลี่ยต่ำกว่า 60: ควรทบทวน concept หลักก่อนขึ้น Session 2');
      }else if(avg < 70){
        lines.push('คะแนนเฉลี่ยอยู่ระดับผ่านขั้นต่ำ: ควรให้ Practice/Remedial เพิ่มก่อน Challenge');
      }else{
        lines.push('คะแนนเฉลี่ยดี: สามารถต่อยอดไป Session 2 ได้');
      }

      if(notSubmitted > 0){
        lines.push(`ยังไม่ส่ง ${notSubmitted} คน: ให้ตรวจรายชื่อใน Risk Students ก่อนปิดกิจกรรม`);
      }

      if(need > 0){
        lines.push(`มีนักศึกษาที่ควรช่วยเพิ่ม ${need} คน: ดูตาราง Risk Students`);
      }

      if(submitted && refl < submitted){
        lines.push('มี Reflection ไม่ครบ: ให้ผู้เรียนแก้ก่อนปิดคาบ');
      }

      if(topMis){
        lines.push(`Misconception เด่น: ${topMis} — ควรยกตัวอย่างซ้ำในคาบถัดไป`);
      }
    }

    box.innerHTML = lines.map(line => `• ${escapeHtml(line)}`).join('<br>');
  }

  function renderSheetStatus(resp, stats){
    const box = $('#teacherSheetStatus');
    if(!box) return;

    const cfg = getConfig();

    box.innerHTML = `
      <b>Apps Script:</b><br>
      ${escapeHtml(cfg.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL)}<br><br>
      <b>Server version:</b> ${escapeHtml(resp.version || '-')}<br>
      <b>Profiles:</b> ${Number(stats.profileRows || 0)} |
      <b>Attempts:</b> ${Number(stats.attemptRows || 0)} |
      <b>Events:</b> ${Number(stats.eventRows || 0)}<br>
      <b>Ignored test rows:</b> ${Number(stats.ignoredTestRows || 0)} |
      <b>Include test:</b> ${stats.includeTestData ? 'YES' : 'NO'}<br>
      <b>Last refresh:</b> ${escapeHtml(resp.serverTs || '-')}
    `;
  }

  function localFallbackData(error){
    const stats = {
      totalStudents:0,
      submittedStudents:0,
      avgScore:0,
      masteryCount:0,
      needSupport:0,
      notSubmittedStudents:0,
      reflectionComplete:0,
      profileRows:0,
      attemptRows:0,
      eventRows:0
    };

    const risks = [];

    try{
      const profile = window.AIQuestStorage ? AIQuestStorage.getProfile() : {};
      const stateRaw = localStorage.getItem('CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS');
      const state = stateRaw ? JSON.parse(stateRaw) : {};

      const score = state.bestScore && state.bestScore.m1 ? Number(state.bestScore.m1) : 0;
      const mastered = !!(state.mastered && state.mastered.m1);

      if(profile.studentId){
        stats.totalStudents = 1;
        stats.submittedStudents = score ? 1 : 0;
        stats.avgScore = score || 0;
        stats.masteryCount = mastered ? 1 : 0;
        stats.needSupport = score && score < 60 ? 1 : 0;
        stats.notSubmittedStudents = score ? 0 : 1;

        risks.push({
          studentId:profile.studentId,
          studentName:profile.studentName,
          section:profile.section,
          bestScore:score || '-',
          latestScore:score || '-',
          helpUsed:'-',
          reflectionComplete:false,
          risks: score < 60 ? ['คะแนนต่ำ'] : ['local fallback']
        });
      }
    }catch(e){}

    return {
      ok:true,
      source:'Local fallback',
      error:String(error && error.message || error),
      version:VERSION,
      serverTs:new Date().toISOString(),
      data:{
        stats,
        risks,
        misconceptions:[]
      }
    };
  }


  function buildCleanLink(mode){
    const url = new URL(location.href);
    url.search = '';

    if(mode === 'teacher'){
      url.searchParams.set('teacher', '1');
      url.searchParams.set('v', '20260611-hotfix241');
    }else{
      url.searchParams.set('v', '20260611-hotfix241');
    }

    return url.toString();
  }

  async function copyLink(mode){
    const link = buildCleanLink(mode);

    try{
      await navigator.clipboard.writeText(link);
      if(window.showToast){
        showToast((mode === 'teacher' ? 'คัดลอก Teacher Link แล้ว' : 'คัดลอก Student Link แล้ว'));
      }else{
        alert('Copied: ' + link);
      }
    }catch(error){
      prompt('Copy link:', link);
    }
  }

  function exportRiskCsv(){
    const data = window.AIQuestTeacherConsole.lastData;
    const risks = data && data.data && data.data.risks ? data.data.risks : [];

    if(!risks.length){
      alert('ยังไม่มีข้อมูล Risk Students สำหรับ export');
      return;
    }

    const headers = ['studentId','studentName','section','bestScore','latestScore','helpUsed','reflectionComplete','risks'];
    const rows = [headers].concat(risks.map(r => headers.map(h => {
      if(h === 'risks') return (r.risks || []).join('; ');
      return r[h] == null ? '' : String(r[h]);
    })));

    const csv = rows.map(row => row.map(cell => '"' + String(cell).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = 'aiquest-risk-students.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function boot(){
    if(!isTeacherMode()) return;

    injectStyle();
    document.body.classList.add('teacher-console');
    document.body.classList.remove('show-teacher-game-tools');

    ensureConsolePanel();

    setTimeout(() => refreshConsole(false), 80);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  window.AIQuestTeacherConsole = {
    VERSION,
    isTeacherMode,
    refreshConsole,
    fetchConsoleData,
    lastData:null
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
