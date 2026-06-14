/*
  CSAI2102 AI Quest
  PATCH v3.2.1 Teacher Console Session Switch
  ------------------------------------------------------------
  Teacher Mode = Teacher Console first, game tools hidden by default.
  Open with:
    /ai-quest/index.html?teacher=1
*/
(function(){
  'use strict';

  const VERSION = 'v3.2.1-teacher-console-session5-astar';
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
      classId:'CSAI2102-2569-101',
      term:'1/2569',
      section:'101',
      activeSession:'all'
    };

    let cfg = fallback;

    try{
      if(window.AIQuestDataContract && AIQuestDataContract.loadConfig){
        cfg = Object.assign({}, fallback, AIQuestDataContract.loadConfig());
      }
    }catch(error){}

    const p = qs();
    const explicitSession = p.get('sessionId') || p.get('session') || p.get('viewSession');

    if(explicitSession){
      cfg.activeSession = explicitSession;
    }else{
      try{
        const lastDefault = localStorage.getItem('AIQUEST_TEACHER_DEFAULT_VERSION');
        if(lastDefault !== VERSION){
          cfg.activeSession = 'all';
          localStorage.setItem('AIQUEST_TEACHER_DEFAULT_VERSION', VERSION);
          if(window.AIQuestDataContract && AIQuestDataContract.saveConfig){
            AIQuestDataContract.saveConfig(Object.assign({}, cfg, {activeSession:'all'}));
          }
        }
      }catch(error){}
    }

    if(!cfg.activeSession) cfg.activeSession = 'all';

    return cfg;
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
        margin-top:28px;
      }

      body.teacher-console #menuScreen{
        padding-top:18px !important;
      }

      body.teacher-console .topbar{
        z-index:50;
      }

      body.teacher-console .teacherConsolePanel{
        scroll-margin-top:128px;
      }

      .metricClarify{
        display:block;
        margin-top:5px;
        font-size:11px;
        line-height:1.25;
        color:rgba(226,232,240,.72);
      }

      .teacherMetric.softWarn{
        border-color:rgba(251,191,36,.35);
        background:rgba(251,191,36,.08);
      }



      .gateExplain{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-top:12px;
      }

      .gateExplainBox{
        border:1px solid rgba(255,255,255,.12);
        border-radius:16px;
        background:rgba(255,255,255,.055);
        padding:12px;
        line-height:1.55;
      }

      .gateExplainBox b{ color:#e0f2fe; }

      @media(max-width:780px){
        .gateExplain{grid-template-columns:1fr}
      }

      .masteryGateBox{
        border:1px solid rgba(56,189,248,.28);
        background:linear-gradient(135deg,rgba(56,189,248,.12),rgba(167,139,250,.10));
        border-radius:24px;
        padding:16px;
        margin-top:16px;
      }

      .masteryGateHeader{
        display:flex;
        justify-content:space-between;
        gap:14px;
        flex-wrap:wrap;
        align-items:flex-start;
      }

      .masteryGateTitle{
        font-size:22px;
        font-weight:1000;
        margin:0 0 4px;
      }

      .readinessBadge{
        border-radius:999px;
        padding:10px 14px;
        font-weight:1000;
        border:1px solid rgba(255,255,255,.18);
        background:rgba(255,255,255,.08);
      }

      .readinessBadge.good{color:#bbf7d0;border-color:rgba(52,211,153,.45);background:rgba(52,211,153,.12)}
      .readinessBadge.warn{color:#fde68a;border-color:rgba(251,191,36,.42);background:rgba(251,191,36,.11)}
      .readinessBadge.bad{color:#fecdd3;border-color:rgba(251,113,133,.45);background:rgba(251,113,133,.10)}

      .gateGrid{
        display:grid;
        grid-template-columns:repeat(6,1fr);
        gap:10px;
        margin-top:12px;
      }

      .gateCard{
        border:1px solid var(--line);
        border-radius:18px;
        background:rgba(255,255,255,.06);
        padding:12px;
        min-height:92px;
      }

      .gateCard .num{
        font-size:26px;
        font-weight:1000;
        line-height:1;
      }

      .gateCard .label{
        color:var(--muted);
        font-size:12px;
        margin-top:5px;
        line-height:1.35;
      }

      .gateProgress{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:12px;
      }

      .gateSession{
        border:1px solid rgba(255,255,255,.12);
        border-radius:18px;
        padding:12px;
        background:rgba(15,23,42,.45);
      }

      .gateSession b{
        display:block;
        margin-bottom:6px;
      }

      .gateBar{
        height:9px;
        border-radius:999px;
        background:rgba(255,255,255,.09);
        overflow:hidden;
        margin:7px 0;
      }

      .gateFill{
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg,#38bdf8,#22c55e);
      }

      .recommendList{
        margin-top:12px;
        line-height:1.7;
      }

      .recommendList .priority{
        display:block;
        margin-top:6px;
        padding:8px 10px;
        border:1px solid rgba(251,191,36,.28);
        background:rgba(251,191,36,.08);
        border-radius:14px;
      }

      @media(max-width:900px){
        .gateGrid,.gateProgress{grid-template-columns:1fr 1fr}
      }

      @media(max-width:640px){
        .gateGrid,.gateProgress{grid-template-columns:1fr}
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
          <select class="select" id="teacherSessionSelect" title="เลือก session ที่ต้องการดูผล">
            <option value="all">Class Progress: S1+S2+B1+S3</option>
            <option value="s1">Session 1: AI Awakening</option>
            <option value="s2">Session 2: Agent Builder</option>
            <option value="b1">Boss B1: Rookie AI Boss</option>
            <option value="s3">Session 3: Search Maze</option>
            <option value="s4">Session 4: Route Cost Challenge</option>
            <option value="s5">Session 5: A* Rescue Mission</option>
            <option value="b2">Boss B2: Search Arena Boss</option>
          </select>
          <button class="btn good" id="btnTeacherRefresh">Refresh from Sheets</button>
          <button class="btn secondary" id="btnCopyStudentLink">Copy Student Link</button>
          <button class="btn secondary" id="btnCopyTeacherLink">Copy Teacher Link</button>
          <button class="btn secondary" id="btnTeacherToggleTools">แสดงเครื่องมือทดสอบเกม</button>
          <button class="btn secondary" id="btnTeacherExportCsv">Export Risk CSV</button>
          <button class="btn secondary" id="btnCopyTeachingPlan">Copy Teaching Recommendation</button>
        </div>
      </div>

      <div class="teacherStatusGrid" id="teacherStatusGrid">
        ${metricSkeleton()}
      </div>

      <div id="teacherMasteryGateBox" class="masteryGateBox">
        กำลังวิเคราะห์ Class Mastery Gate...
      </div>

      <div class="teacherGrid2">
        <div class="teacherBox">
          <h3>Phase Analytics</h3>
          <div class="teacherSmallNote">
            S2/B1: ดูว่าเด็กอ่อน Agent / PEAS / Environment / Rationality / Final Attack ตรงไหน
          </div>
          <div id="teacherPhaseBox" style="margin-top:10px">กำลังโหลดข้อมูล...</div>
        </div>

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
    const copyPlanBtn = $('#btnCopyTeachingPlan');
    if(copyPlanBtn) copyPlanBtn.onclick = copyTeachingRecommendation;
    $('#btnCopyStudentLink').onclick = () => copyLink('student');
    $('#btnCopyTeacherLink').onclick = () => copyLink('teacher');

    const sessionSelect = $('#teacherSessionSelect');
    if(sessionSelect){
      const cfg = getConfig();
      sessionSelect.value = cfg.activeSession || 'all';
      sessionSelect.onchange = () => {
        if(window.AIQuestDataContract && AIQuestDataContract.saveConfig){
          AIQuestDataContract.saveConfig(Object.assign({}, getConfig(), {activeSession:sessionSelect.value}));
        }else{
          try{ localStorage.setItem('AIQUEST_ACTIVE_SESSION', sessionSelect.value); }catch(error){}
        }

        refreshConsole(true);
      };
    }
  }

  function metricSkeleton(){
    const labels = ['Students','Submitted','Not Submitted','Avg Latest','Avg Best','Mastery','Need Support','Reflection OK'];
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
      sessionId:config.activeSession || 'all'
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
    renderMasteryGate(data.masteryGate || null);
    renderPhaseAnalytics(data.phaseAnalytics || []);
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
      <span class="pillLike warn">View: ${escapeHtml(cfg.activeSession || 'all')}</span>
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
    const avgLatest = Number(stats.avgLatestScore != null ? stats.avgLatestScore : stats.avgScore || 0);
    const avgBest = Number(stats.avgBestScore != null ? stats.avgBestScore : stats.avgScore || 0);
    const mastery = Number(stats.masteryCount || 0);
    const need = Number(stats.needSupport || 0);
    const refl = Number(stats.reflectionComplete || 0);
    const reflPct = submitted ? Math.round(refl / submitted * 100) : 0;

    const data = window.AIQuestTeacherConsole && window.AIQuestTeacherConsole.lastData;
    const gate = data && data.data && data.data.masteryGate ? data.data.masteryGate : null;
    const active = String((getConfig().activeSession || 'all')).toLowerCase();
    const isClassGate = active === 'all' || active === '*';

    const supportLabel = isClassGate ? 'Need Review' : 'Need Support';
    const supportHint = isClassGate
      ? 'มีจุดที่ควรทบทวน แม้พร้อมไป S3 แล้ว'
      : 'ควรช่วยเพิ่ม';
    const supportCls = need ? (isClassGate && gate && Number(gate.readyPct || 0) >= 70 ? 'softWarn' : 'bad') : 'good';

    const metrics = [
      {label:'Students', value:total, cls:'', hint:'profile/attempt ทั้งหมด'},
      {label:'Submitted', value:submitted, cls:submitted >= total && total ? 'good' : 'warn', hint:'มี attempt แล้ว'},
      {label:'Not Submitted', value:notSubmitted, cls:notSubmitted ? 'bad' : 'good', hint:'ยังไม่มี attempt'},
      {label:'Avg Latest', value:avgLatest ? avgLatest.toFixed(1) : '0.0', cls:avgLatest >= 70 ? 'good' : avgLatest >= 60 ? 'warn' : 'bad', hint:'เฉลี่ยคะแนนล่าสุด'},
      {label:'Avg Best', value:avgBest ? avgBest.toFixed(1) : '0.0', cls:avgBest >= 70 ? 'good' : avgBest >= 60 ? 'warn' : 'bad', hint:'เฉลี่ยคะแนนดีที่สุด'},
      {label:'Mastery', value:mastery, cls:mastery ? 'good' : '', hint:'ผ่านระดับ Mastery'},
      {label:supportLabel, value:need, cls:supportCls, hint:supportHint},
      {label:'Reflection OK', value:reflPct + '%', cls:reflPct >= 90 ? 'good' : reflPct >= 70 ? 'warn' : 'bad', hint:'ครบในกลุ่มที่ส่งแล้ว'}
    ];

    grid.innerHTML = metrics.map(m => `
      <div class="teacherMetric ${m.cls || ''}">
        <div class="num">${escapeHtml(m.value)}</div>
        <div class="label">${escapeHtml(m.label)}</div>
        <div class="hint">${escapeHtml(m.hint)}</div>
        ${isClassGate && m.label === 'Need Review' && need ? '<span class="metricClarify">ไม่ใช่ fail: ใช้บอกจุดทบทวนก่อน S3</span>' : ''}
      </div>
    `).join('');
  }

  function normalizePhaseName(name){
    const raw = String(name || '').trim();
    const key = raw.toLowerCase().replace(/\s+/g,'_');

    const map = {
      'agent':'Agent Foundation',
      'agent_foundation':'Agent Foundation',
      'agent_or_not':'Agent Foundation',
      'ai_vs_automation':'AI vs Automation',
      'automation':'AI vs Automation',
      'peas':'PEAS Gate',
      'peas_builder':'PEAS Gate',
      'peas_gate':'PEAS Gate',
      'environment':'Environment Gate',
      'environment_classifier':'Environment Gate',
      'environment_gate':'Environment Gate',
      'rationality':'Rationality Gate',
      'rational_agent':'Rationality Gate',
      'rationality_gate':'Rationality Gate',
      'boss':'Final Attack',
      'adaptive_boss':'Final Attack',
      'rational_agent_boss':'Final Attack',
      'final_attack':'Final Attack',
      'state_space':'State Space',
      'bfs/dfs_trace':'BFS/DFS Trace',
      'bfs_dfs_trace':'BFS/DFS Trace',
      'maze_path':'Maze Path',
      'frontier_debug':'Frontier Debug',
      'trace_error_debug':'Trace Error Debug',
      'search_boss':'Search Boss',
      'cost_concept':'Cost Concept',
      'ucs_trace':'UCS Trace',
      'optimal_path':'Optimal Path',
      'frontier_cost':'Frontier Cost',
      'bfs_vs_ucs':'BFS vs UCS',
      'cost_boss':'Cost Boss',
      'astar_concept':'A* Concept',
      'a*_concept':'A* Concept',
      'astar_trace':'A* Trace',
      'a*_trace':'A* Trace',
      'astar_path':'A* Path',
      'a*_path':'A* Path',
      'astar_vs_greedy':'A* vs Greedy',
      'a*_vs_greedy':'A* vs Greedy',
      'astar_boss':'A* Boss',
      'a*_boss':'A* Boss',
      's3_search_core':'S3 Search Core',
      's4_cost_search':'S4 Cost Search',
      's5_heuristic_search':'S5 Heuristic Search',
      'final_search_duel':'Final Search Duel'
    };

    return map[key] || raw || 'Unknown';
  }

  function renderPhaseAnalytics(rows){
    const box = $('#teacherPhaseBox');
    if(!box) return;

    if(!rows || !rows.length){
      box.innerHTML = '<span class="teacherSmallNote">ยังไม่มี phase analytics สำหรับ session นี้</span>';
      return;
    }

    const merged = {};
    rows.forEach(row => {
      const phase = normalizePhaseName(row.phase || row.label || '-');
      if(!merged[phase]) merged[phase] = {phase, correct:0, total:0, wrong:0};
      merged[phase].correct += Number(row.correct || 0);
      merged[phase].total += Number(row.total || 0);
      merged[phase].wrong += Number(row.wrong || 0);
    });

    const ordered = ['AI vs Automation','Agent Foundation','PEAS Gate','Environment Gate','Rationality Gate','Final Attack','State Space','BFS/DFS Trace','Maze Path','Search Boss','Frontier Debug','Trace Error Debug','Cost Concept','UCS Trace','Optimal Path','Frontier Cost','BFS vs UCS','Cost Boss','A* Concept','A* Trace','A* Path','A* vs Greedy','A* Boss','S3 Search Core','S4 Cost Search','S5 Heuristic Search','Final Search Duel'];
    const list = Object.values(merged).sort((a,b) => {
      const ai = ordered.indexOf(a.phase);
      const bi = ordered.indexOf(b.phase);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || String(a.phase).localeCompare(String(b.phase));
    });

    box.innerHTML = list.map(row => {
      const total = Number(row.total || 0);
      const correct = Number(row.correct || 0);
      const pct = total ? Math.round(correct / total * 100) : 0;
      return `
        <div class="misBar">
          <div class="misBarTop">
            <span>${escapeHtml(row.phase || row.label || '-')}</span>
            <span>${correct}/${total} · ${pct}%</span>
          </div>
          <div class="misTrack"><div class="misFill" style="width:${Math.min(100,pct)}%"></div></div>
          <div class="teacherSmallNote">
            ${pct >= 80 ? 'ผ่านดี' : pct >= 60 ? 'ควรทบทวนบางจุด' : 'ควรสอนซ้ำ/ทำ remedial'}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMasteryGate(gate){
    const box = $('#teacherMasteryGateBox');
    if(!box) return;

    const active = String((getConfig().activeSession || 'all')).toLowerCase();
    if(active !== 'all' && active !== '*'){
      box.style.display = 'none';
      return;
    }

    box.style.display = '';

    if(!gate){
      box.innerHTML = `
        <div class="masteryGateHeader">
          <div>
            <div class="masteryGateTitle">Class Progress Gate</div>
            <div class="teacherSmallNote">ยังไม่มีข้อมูล gate จาก server</div>
          </div>
          <span class="readinessBadge warn">Waiting</span>
        </div>
      `;
      return;
    }

    const total = Number(gate.totalStudents || 0);
    const ready3 = Number(gate.readyForS3 || 0);
    const ready3Pct = Number(gate.readyPct || 0);
    const ready4 = Number(gate.readyForS4 || 0);
    const ready4Pct = Number(gate.readyForS4Pct || 0);
    const hasS3 = !!gate.hasS3Data;

    const activePct = hasS3 ? ready4Pct : ready3Pct;
    const badgeCls = activePct >= 70 ? 'good' : activePct >= 50 ? 'warn' : 'bad';
    const statusText = hasS3
      ? (ready4Pct >= 70 ? 'พร้อมต่อ S4 เมื่อเปิด' : ready4Pct >= 50 ? 'บางส่วนพร้อมต่อ S4' : 'ควร remedial S3 ก่อน S4')
      : (ready3Pct >= 70 ? 'พร้อมเปิด S3 (ผ่านขั้นต่ำ)' : ready3Pct >= 50 ? 'เปิด S3 ได้แบบมี Remedial' : 'ควรทบทวนก่อนเปิด S3');

    const stageProgress = gate.stageProgress || [];
    const recs = gate.recommendations || [];
    const topMis = gate.topMisconceptions || [];

    box.innerHTML = `
      <div class="masteryGateHeader">
        <div>
          <div class="masteryGateTitle">Class Progress Gate: S1 → S2 → B1 → S3</div>
          <div class="teacherSmallNote">
            ใช้ดูความพร้อมจาก foundation ไป Search Maze และเตรียมต่อ S4 Route Cost Challenge
          </div>
        </div>
        <span class="readinessBadge ${badgeCls}">${statusText} · ${activePct}%</span>
      </div>

      <div class="gateGrid">
        <div class="gateCard"><div class="num">${total}</div><div class="label">Students</div></div>
        <div class="gateCard"><div class="num">${ready3}</div><div class="label">Ready for S3<br>ผ่าน S1+S2+B1</div></div>
        <div class="gateCard"><div class="num">${ready4}</div><div class="label">Ready for S4<br>ผ่าน S3 แล้ว</div></div>
        <div class="gateCard"><div class="num">${Number(gate.needS1 || 0)}</div><div class="label">Need S1</div></div>
        <div class="gateCard"><div class="num">${Number(gate.needS2 || 0)}</div><div class="label">Need S2</div></div>
        <div class="gateCard"><div class="num">${Number(gate.needB1 || 0)}</div><div class="label">Need B1</div></div>
        <div class="gateCard"><div class="num">${Number(gate.needS3 || 0)}</div><div class="label">Need S3</div></div>
        <div class="gateCard"><div class="num">${Number(gate.challengeReady || 0)}</div><div class="label">Challenge Ready<br>S1-S3 mastery/คะแนนสูง</div></div>
      </div>

      <div class="gateExplain">
        <div class="gateExplainBox">
          <b>Ready for S3</b><br>
          ผ่านขั้นต่ำครบ S1, S2 และ B1 แล้ว สามารถเริ่ม Search Maze ได้
        </div>
        <div class="gateExplainBox">
          <b>Ready for S4</b><br>
          ผ่าน S3 Search Maze แล้ว พร้อมต่อ Route Cost / Uniform Cost Search เมื่อเปิด
        </div>
      </div>

      <div class="gateProgress">
        ${stageProgress.map(s => {
          const pct = total ? Math.round(Number(s.passed || 0) / total * 100) : 0;
          return `
            <div class="gateSession">
              <b>${escapeHtml(s.label || s.sessionId || '-')}</b>
              <div class="teacherSmallNote">Passed ${Number(s.passed || 0)}/${total} · Mastery ${Number(s.mastery || 0)}</div>
              <div class="gateBar"><div class="gateFill" style="width:${pct}%"></div></div>
              <div class="teacherSmallNote">Avg best ${Number(s.avgBest || 0).toFixed(1)} · Submitted ${Number(s.submitted || 0)}</div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="recommendList" id="teachingRecommendationText">
        <b>Teaching Recommendation</b><br>
        ${recs.length ? recs.map((r,idx) => `<span class="priority">${idx+1}. ${escapeHtml(r)}</span>`).join('') : '<span class="priority">ยังไม่มีคำแนะนำเฉพาะจุด</span>'}
        ${topMis.length ? `<br><b>Top Misconceptions:</b> ${topMis.slice(0,5).map(x => `${escapeHtml(x.key)} (${Number(x.count || 0)})`).join(', ')}` : ''}
      </div>
    `;
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

    const data = window.AIQuestTeacherConsole.lastData;
    const gate = data && data.data && data.data.masteryGate ? data.data.masteryGate : null;
    const active = String((getConfig().activeSession || 'all')).toLowerCase();
    const topMis = misconceptions && misconceptions[0] ? misconceptions[0].key : '';
    const avg = Number(stats.avgLatestScore != null ? stats.avgLatestScore : stats.avgScore || 0);
    const need = Number(stats.needSupport || 0);
    const refl = Number(stats.reflectionComplete || 0);
    const submitted = Number(stats.submittedStudents || 0);
    const total = Number(stats.totalStudents || 0);
    const notSubmitted = Number(stats.notSubmittedStudents != null ? stats.notSubmittedStudents : Math.max(0, total - submitted));

    const lines = [];

    if(gate && (active === 'all' || active === '*')){
      const hasS3 = !!gate.hasS3Data;
      const ready3Pct = Number(gate.readyPct || 0);
      const ready4Pct = Number(gate.readyForS4Pct || 0);
      const top = (gate.topMisconceptions || []).slice(0,3).map(x => x.key).filter(Boolean);

      if(hasS3){
        if(ready4Pct >= 70){
          lines.push(`พร้อมต่อ S4 Route Cost Challenge เมื่อเปิด: ผ่าน S3 แล้ว ${ready4Pct}%`);
          lines.push('ก่อน S4 ให้ทบทวน visited order, final path, BFS/DFS และแนวคิด cost ประมาณ 10 นาที');
        }else if(ready4Pct >= 50){
          lines.push(`บางส่วนพร้อมต่อ S4: readiness ${ready4Pct}%`);
          lines.push('ให้กลุ่มที่ยังไม่ผ่านทำ S3 Search Maze ซ้ำหรือ remedial ก่อนเปิด S4 เต็มห้อง');
        }else{
          lines.push(`ยังไม่ควรเปิด S4 ทันที: readiness S4 ${ready4Pct}% ต่ำกว่าเกณฑ์`);
          lines.push('ควร remedial S3 โดยเน้น State Space, BFS/DFS Trace และ Maze Path');
        }

        if(Number(gate.needS3 || 0) > 0) lines.push(`ให้ผู้เรียน ${Number(gate.needS3 || 0)} คนเล่น/แก้ S3 Search Maze ก่อน`);
      }else{
        if(ready3Pct >= 70){
          lines.push(`เปิด S3 Search Maze ได้: ห้องผ่านขั้นต่ำครบ S1→S2→B1 แล้ว ${ready3Pct}%`);
          lines.push('ก่อนเริ่ม S3 ให้ใช้ 10 นาทีแรกทบทวน misconception เด่นจาก S1/S2/B1');
        }else if(ready3Pct >= 50){
          lines.push(`เปิด S3 ได้แบบมี remedial คู่ขนาน: readiness ${ready3Pct}%`);
          lines.push('แบ่งผู้เรียนเป็น 2 กลุ่ม: กลุ่มพร้อมเริ่ม S3 และกลุ่ม remedial S2/B1');
        }else{
          lines.push(`ยังไม่ควรเปิด S3 ทันที: readiness ${ready3Pct}% ต่ำกว่าเกณฑ์`);
          lines.push('ควร remedial S1/S2/B1 อย่างน้อย 15–25 นาทีแล้วให้ทำ Boss ใหม่');
        }
      }

      if(Number(gate.needB1 || 0) > 0) lines.push(`ให้ผู้เรียน ${Number(gate.needB1 || 0)} คนทำ/แก้ B1 ก่อน`);
      if(Number(gate.needS2 || 0) > 0) lines.push(`ให้ผู้เรียน ${Number(gate.needS2 || 0)} คนทบทวน S2 Agent/PEAS/Environment`);
      if(Number(gate.needS1 || 0) > 0) lines.push(`ให้ผู้เรียน ${Number(gate.needS1 || 0)} คนเก็บ S1 ให้ผ่านก่อน`);
      if(top.length) lines.push(`คาบถัดไปควรยกตัวอย่างซ้ำเรื่อง ${top.join(', ')}`);
      if(Number(gate.challengeReady || 0) === 0 && (Number(gate.readyForS3 || 0) > 0 || Number(gate.readyForS4 || 0) > 0)){
        lines.push('หมายเหตุ: Ready คือผ่านขั้นต่ำ ส่วน Challenge Ready ต้อง mastery/คะแนนสูงครบ จึงอาจเป็น 0 ได้');
      }
    }else if(submitted === 0){
      lines.push('ยังไม่มีข้อมูลส่งผลจากนักศึกษา ให้เริ่มจากการทดสอบ Save Result 1 คนก่อน');
    }else{
      const sessionName = active === 's1' ? 'Session 1' : active === 's2' ? 'Session 2' : active === 'b1' ? 'Boss B1' : active === 's3' ? 'Session 3 Search Maze' : active === 's4' ? 'Session 4 Route Cost Challenge' : active === 's5' ? 'Session 5 A* Rescue Mission' : active === 'b2' ? 'Boss B2 Search Arena' : 'Session นี้';

      if(avg < 60){
        lines.push(`${sessionName}: คะแนนเฉลี่ยต่ำกว่า 60 ควร remedial ก่อน`);
      }else if(avg < 70){
        lines.push(`${sessionName}: คะแนนเฉลี่ยผ่านขั้นต่ำ ควรฝึกซ้ำเพื่อ mastery`);
      }else{
        lines.push(`${sessionName}: คะแนนเฉลี่ยดี สามารถต่อยอดไปด่านถัดไปได้`);
      }

      if(notSubmitted > 0) lines.push(`ยังไม่ส่ง ${notSubmitted} คน: ให้ตรวจรายชื่อใน Risk Students ก่อนปิดกิจกรรม`);
      if(need > 0) lines.push(`มีนักศึกษาที่ควรช่วยเพิ่ม ${need} คน: ดูตาราง Risk Students`);
      if(submitted && refl < submitted) lines.push('มี Reflection ไม่ครบ: ให้ผู้เรียนแก้ก่อนปิดคาบ');
      if(topMis) lines.push(`Misconception เด่น: ${topMis} — ควรยกตัวอย่างซ้ำในคาบถัดไป`);
    }

    const html = lines.map(line => `• ${escapeHtml(line)}`).join('<br>');
    box.innerHTML = `<div id="teacherDecisionText">${html}</div>`;
  }

  function renderSheetStatus(resp, stats){
    const box = $('#teacherSheetStatus');
    if(!box) return;

    const cfg = getConfig();

    box.innerHTML = `
      <b>Apps Script:</b><br>
      ${escapeHtml(cfg.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL)}<br><br>
      <b>Server version:</b> ${escapeHtml(resp.version || '-')}<br>
      <b>Avg latest:</b> ${Number(stats.avgLatestScore != null ? stats.avgLatestScore : stats.avgScore || 0)} |
      <b>Avg best:</b> ${Number(stats.avgBestScore != null ? stats.avgBestScore : stats.avgScore || 0)}<br>
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
      avgLatestScore:0,
      avgBestScore:0,
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
        stats.avgLatestScore = score || 0;
        stats.avgBestScore = score || 0;
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
        misconceptions:[],
        masteryGate:null
      }
    };
  }


  function buildCleanLink(mode){
    const url = new URL(location.href);
    url.search = '';

    if(mode === 'teacher'){
      url.searchParams.set('teacher', '1');
      url.searchParams.set('v', '20260612-b2return321');
    }else{
      url.searchParams.set('v', '20260612-b2return321');
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


  async function copyTeachingRecommendation(){
    const data = window.AIQuestTeacherConsole.lastData;
    const gate = data && data.data && data.data.masteryGate ? data.data.masteryGate : null;
    const decisionBox = $('#teacherDecisionText');
    const lines = [];

    lines.push('CSAI2102 AI Quest — Teaching Recommendation');

    if(gate){
      lines.push(`Ready for S3: ${Number(gate.readyForS3 || 0)}/${Number(gate.totalStudents || 0)} (${Number(gate.readyPct || 0)}%)`);
      lines.push(`Ready for S4: ${Number(gate.readyForS4 || 0)}/${Number(gate.totalStudents || 0)} (${Number(gate.readyForS4Pct || 0)}%)`);
      lines.push(`Need S1: ${Number(gate.needS1 || 0)}, Need S2: ${Number(gate.needS2 || 0)}, Need B1: ${Number(gate.needB1 || 0)}, Need S3: ${Number(gate.needS3 || 0)}, Challenge Ready: ${Number(gate.challengeReady || 0)}`);
      (gate.recommendations || []).forEach((r, i) => lines.push(`${i+1}. ${r}`));
      const top = (gate.topMisconceptions || []).slice(0,5).map(x => `${x.key} (${x.count})`).join(', ');
      if(top) lines.push(`Top Misconceptions: ${top}`);
    }

    if(decisionBox){
      lines.push('');
      lines.push(decisionBox.innerText.trim());
    }

    const text = lines.join('\\n');

    try{
      await navigator.clipboard.writeText(text);
      if(window.showToast) showToast('คัดลอก Teaching Recommendation แล้ว');
      else alert('Copied Teaching Recommendation');
    }catch(error){
      prompt('Copy Teaching Recommendation:', text);
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
