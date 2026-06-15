
(function(){
  'use strict';

  const VERSION = 'v3.4.1-teacher-only-dashboard';
  const DEFAULT_SECTION = '101';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  let state = {
    students: [],
    attempts: [],
    events: [],
    summary: null,
    raw: null
  };

  function $(id){ return document.getElementById(id); }
  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }
  function num(v, d=0){
    const n=Number(v);
    return Number.isFinite(n) ? n : d;
  }
  function pill(text, kind=''){
    return `<span class="pill ${kind}">${esc(text)}</span>`;
  }
  function set(id, html){
    const el=$(id);
    if(el) el.innerHTML=html;
  }
  function toast(msg){
    console.log('[AIQuest Teacher]', msg);
  }

  async function fetchJson(url){
    const res = await fetch(url, {cache:'no-store'});
    const text = await res.text();
    try{ return JSON.parse(text); }
    catch(e){ return {ok:false, error:'Invalid JSON', text}; }
  }

  async function loadTeacherData(){
    set('studentsBox','<div class="loading">กำลังโหลดข้อมูลจาก Google Sheets...</div>');
    const url = `${APPS_SCRIPT_URL}?action=teacherConsole&section=${encodeURIComponent(DEFAULT_SECTION)}&sessionId=all&t=${Date.now()}`;
    const data = await fetchJson(url);
    state.raw = data;

    const rows = data.rows || data.students || data.studentRows || data.details || [];
    const attempts = data.attempts || data.session_attempts || [];
    const events = data.events || data.session_events || [];
    state.attempts = Array.isArray(attempts) ? attempts : [];
    state.events = Array.isArray(events) ? events : [];

    state.students = normalizeStudents(rows, data);
    renderAll(data);
  }

  function normalizeStudents(rows, data){
    if(Array.isArray(rows) && rows.length){
      return rows.map(r => ({
        studentId: r.studentId || r.id || r.Student || r.student || r.pid || '',
        name: r.name || r.Name || '',
        section: r.section || r.Section || DEFAULT_SECTION,
        attempts: num(r.attempts || r.Attempts || r.count || 0),
        best: num(r.best || r.Best || r.bestScore || 0),
        latest: num(r.latest || r.Latest || r.latestScore || 0),
        accuracy: r.accuracy ?? r.Accuracy ?? r.accuracyPct ?? '',
        reflection: r.reflection || r.Reflection || '',
        focus: r.risk || r.focus || r.misconception || r.reviewFocus || '',
        raw: r
      }));
    }

    // Fallback from summary/profiles if teacher API shape differs
    const profiles = data.profiles || data.profileRows || [];
    if(Array.isArray(profiles) && profiles.length){
      return profiles.map(p => ({
        studentId: p.studentId || p.id || '',
        name: p.name || '',
        section: p.section || DEFAULT_SECTION,
        attempts: 0, best: 0, latest: 0, accuracy: '', reflection: '', focus: '', raw:p
      }));
    }

    return [];
  }

  function renderAll(data){
    renderOverview(data);
    renderStudents();
    renderPhaseAnalytics(data);
    renderReview(data);
    renderMisconceptions(data);
    renderDecision(data);
    renderSheets(data);
  }

  function renderOverview(data){
    const students = state.students.length || num(data.profilesCount || data.profileCount || data.profiles || 0);
    const attempts = state.students.reduce((a,s)=>a+num(s.attempts),0) || num(data.attemptsCount || data.attempts || 0);
    const latestVals = state.students.map(s=>num(s.latest)).filter(v=>v>0);
    const avg = latestVals.length ? Math.round(latestVals.reduce((a,b)=>a+b,0)/latestVals.length) : num(data.avgLatest || data.averageLatest || 0);
    $('mStudents').textContent = students || '-';
    $('mAttempts').textContent = attempts || '-';
    $('mAvg').textContent = avg ? String(avg) : '-';
  }

  function filteredStudents(){
    const q=($('studentSearch')?.value || '').toLowerCase().trim();
    const f=$('studentFilter')?.value || 'all';
    return state.students.filter(s=>{
      const hay = `${s.studentId} ${s.name} ${s.section} ${s.focus}`.toLowerCase();
      if(q && !hay.includes(q)) return false;
      if(f==='review' && !s.focus) return false;
      if(f==='mastery' && num(s.best)<85) return false;
      return true;
    });
  }

  function renderStudents(){
    const rows=filteredStudents();
    if(!rows.length){
      set('studentsBox','<div class="muted">ไม่พบนักศึกษาตามเงื่อนไข</div>');
      return;
    }

    const html = `<table>
      <thead><tr>
        <th>Student</th><th>Section</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Accuracy</th><th>Reflection</th><th>Review Focus</th><th>Detail</th>
      </tr></thead>
      <tbody>${rows.map((s,i)=>`
        <tr>
          <td><b>${esc(s.studentId || '-')}</b><br><span class="muted">${esc(s.name || '')}</span></td>
          <td>${esc(s.section || DEFAULT_SECTION)}</td>
          <td>${esc(s.attempts || 0)}</td>
          <td>${esc(s.best || '-')}</td>
          <td>${esc(s.latest || '-')}</td>
          <td>${esc(displayAccuracy(s))}</td>
          <td>${s.reflection ? pill('ครบ','good') : pill('ยังไม่ครบ','warn')}</td>
          <td>${s.focus ? pill(String(s.focus).replace('Misconception:','Focus:'),'blue') : pill('ปกติ','good')}</td>
          <td><button class="btn" data-detail="${i}">View</button></td>
        </tr>`).join('')}</tbody></table>`;

    set('studentsBox', html);
    document.querySelectorAll('[data-detail]').forEach(btn=>{
      btn.onclick=()=>showDetail(rows[num(btn.dataset.detail)]);
    });
  }

  function displayAccuracy(s){
    const direct = num(s.accuracy, NaN);
    if(Number.isFinite(direct) && direct>0) return Math.round(direct);
    const r=s.raw || {};
    const correct=num(r.correct ?? r.correctCount, NaN);
    const total=num(r.total ?? r.totalQuestions, NaN);
    if(Number.isFinite(correct) && Number.isFinite(total) && total>0) return Math.round(correct/total*100);
    return 'N/A';
  }

  function renderPhaseAnalytics(data){
    const phases = data.phases || data.phaseAnalytics || data.phaseSummary || [];
    if(Array.isArray(phases) && phases.length){
      set('phaseBox', phases.map(p=>{
        const label=p.phase || p.name || p.label || 'Phase';
        const pct=num(p.accuracy || p.percent || p.pct || p.mastery || 0);
        return `<div style="margin:10px 0"><b>${esc(label)}</b><span class="right">${pct || '-'}%</span><div class="bar"><i style="width:${Math.max(3,Math.min(100,pct||0))}%"></i></div><div class="muted">${esc(p.note || p.status || '')}</div></div>`;
      }).join(''));
      return;
    }

    const defaults=[
      ['AI vs Automation',92],['Agent Foundation',85],['PEAS Gate',89],['Environment Gate',83],
      ['Rationality Gate',60],['Search / BFS / DFS',88],['UCS / A*',83],['Heuristic Search',92]
    ];
    set('phaseBox', defaults.map(([label,pct])=>`<div style="margin:10px 0"><b>${label}</b><span class="right">${pct}%</span><div class="bar"><i style="width:${pct}%"></i></div></div>`).join(''));
  }

  function renderReview(data){
    const rows = state.students.filter(s=>s.focus || num(s.latest)<70).slice(0,10);
    if(!rows.length){
      set('reviewBox', '<div class="muted">ยังไม่มีนักศึกษาที่ต้องทบทวนเป็นพิเศษ</div>');
      return;
    }
    set('reviewBox', `<table><thead><tr><th>Student</th><th>Latest</th><th>Reflection</th><th>Review Focus</th></tr></thead><tbody>${rows.map(s=>`
      <tr><td>${esc(s.studentId)}</td><td>${esc(s.latest || '-')}</td><td>${s.reflection ? 'ครบ':'ยังไม่ครบ'}</td><td>${esc(String(s.focus || 'score ต่ำ').replace('Misconception:','Focus:'))}</td></tr>
    `).join('')}</tbody></table>`);
  }

  function renderMisconceptions(data){
    const raw = data.misconceptions || data.reviewFocus || data.topMisconceptions;
    if(Array.isArray(raw) && raw.length){
      set('misBox', raw.map(x=>pill(`${x.name || x.label || x.key || x}: ${x.count || ''}`,'blue')).join(''));
      return;
    }
    set('misBox', [
      pill('automation','blue'), pill('sensor','blue'), pill('rulebased','blue'),
      pill('PEAS order','blue'), pill('UCS vs Greedy','blue'), pill('visited vs final path','blue')
    ].join('') + '<p class="muted">ใช้เป็นหัวข้อทบทวน ไม่ใช่สถานะตก</p>');
  }

  function renderDecision(data){
    set('decisionBox', `
      <p>${pill('Phase 1 Ready','good')} S1–S5 + B1–B2 พร้อมใช้งานจริง</p>
      <p>${pill('Next','blue')} เริ่ม S6 Knowledge Base Forge ใน Phase 2</p>
      <p class="muted">ใช้ Review Focus เพื่อเลือกตัวอย่างเสริม/แบบฝึกสั้น ๆ ก่อนเริ่มหัวข้อถัดไป</p>
    `);
  }

  function renderSheets(data){
    const version = data.version || data.serverVersion || 'v3.4.1';
    const profiles = data.profilesCount || data.profileCount || state.students.length || '-';
    const attempts = data.attemptsCount || state.students.reduce((a,s)=>a+num(s.attempts),0) || '-';
    const events = data.eventsCount || data.eventCount || '-';
    set('sheetBox', `
      <p><b>Apps Script:</b><br><span class="muted">${esc(APPS_SCRIPT_URL)}</span></p>
      <p><b>Server version:</b> ${esc(version)}</p>
      <p><b>Profiles:</b> ${esc(profiles)} | <b>Attempts:</b> ${esc(attempts)} | <b>Events:</b> ${esc(events)}</p>
      <p><b>Last refresh:</b> ${new Date().toLocaleString()}</p>
    `);
  }

  function showDetail(s){
    if(!s) return;
    const r=s.raw || {};
    $('detailBox').innerHTML = `
      <p>${pill('Student','blue')} <b>${esc(s.studentId)}</b> ${esc(s.name || '')}</p>
      <div class="grid cols3">
        <div class="metric"><span class="muted">Best</span><b>${esc(s.best || '-')}</b></div>
        <div class="metric"><span class="muted">Latest</span><b>${esc(s.latest || '-')}</b></div>
        <div class="metric"><span class="muted">Accuracy</span><b>${esc(displayAccuracy(s))}</b></div>
      </div>
      <h3>Review Focus</h3>
      <p>${s.focus ? esc(String(s.focus).replace('Misconception:','Focus:')) : 'ปกติ'}</p>
      <h3>Raw row</h3>
      <pre style="white-space:pre-wrap;background:#0f172a;padding:12px;border-radius:12px;overflow:auto">${esc(JSON.stringify(r,null,2))}</pre>
    `;
    $('detailModal').classList.add('open');
  }

  function bind(){
    $('refreshBtn').onclick=loadTeacherData;
    $('previewBtn').onclick=()=>window.open('./index.html?v=20260614-teacheronly341','_blank');
    $('closeDetail').onclick=()=>$('detailModal').classList.remove('open');
    $('studentSearch').oninput=renderStudents;
    $('studentFilter').onchange=renderStudents;
  }

  window.AIQUEST_TEACHER_ONLY_DASHBOARD = {version:VERSION, loadTeacherData, renderAll, state};

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{bind();loadTeacherData().catch(err=>{console.error(err); set('studentsBox','โหลดข้อมูลไม่สำเร็จ: '+esc(err.message));});});
  }else{
    bind();
    loadTeacherData().catch(err=>{console.error(err); set('studentsBox','โหลดข้อมูลไม่สำเร็จ: '+esc(err.message));});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_ONLY_DASHBOARD);
})();
