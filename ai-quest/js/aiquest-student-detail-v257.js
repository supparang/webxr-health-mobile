/*
  CSAI2102 AI Quest
  PATCH v2.5.7 Student Detail Session 2
  Adds an all-students table + per-student detail modal to Teacher Console.
*/
(function(){
  'use strict';

  const VERSION = 'v2.5.7-student-detail-session2';

  function qs(){ return new URLSearchParams(location.search); }
  function isTeacherMode(){
    const p = qs();
    return p.get('teacher') === '1' || p.get('admin') === '1' || p.get('dev') === '1' || p.get('mode') === 'teacher' || p.get('view') === 'teacher';
  }
  function $(selector){ return document.querySelector(selector); }
  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function injectStyle(){
    if($('#aiquestStudentDetailStyle')) return;
    const style = document.createElement('style');
    style.id = 'aiquestStudentDetailStyle';
    style.textContent = `
      .studentSearchRow{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
      .studentSearchRow input,.studentSearchRow select{flex:1 1 220px;background:rgba(255,255,255,.06);color:var(--text);border:1px solid var(--line);border-radius:14px;padding:10px 12px}
      .teacherModalBack{position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:120;display:none;align-items:center;justify-content:center;padding:18px}
      .teacherModalBack.show{display:flex}
      .teacherModal{width:min(1180px,100%);max-height:90vh;overflow:auto;background:#0f172a;border:1px solid var(--line);border-radius:26px;box-shadow:0 24px 70px rgba(0,0,0,.5);padding:18px}
      .teacherModalTop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
      .teacherModalTop h3{margin:0;font-size:24px}
      .studentDetailGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}
      .studentDetailCard{border:1px solid var(--line);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}.studentDetailCard b{color:#bae6fd}
      .reflectionBlock{border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(255,255,255,.045);margin-top:10px;line-height:1.65}
      .eventMini{margin-top:8px;padding:10px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.045);font-size:13px;line-height:1.55}
      .viewDetailBtn{padding:7px 9px;border-radius:999px;border:1px solid rgba(56,189,248,.35);background:rgba(56,189,248,.12);color:#bae6fd;font-weight:1000;cursor:pointer}
      .viewDetailBtn:hover{filter:brightness(1.12)}

      .studentDetailGrid6{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:14px 0}
      .studentDetailCard.good{border-color:rgba(52,211,153,.38);background:rgba(52,211,153,.08)}
      .studentDetailCard.warn{border-color:rgba(251,191,36,.42);background:rgba(251,191,36,.08)}
      .studentDetailCard.bad{border-color:rgba(251,113,133,.42);background:rgba(251,113,133,.08)}
      .studentDetailFull{margin-top:14px}
      .studentDetailSectionTitle{font-size:18px;font-weight:1000;margin:4px 0 10px}
      .recommendList{margin:0;padding-left:20px;line-height:1.75}
      .reflectionQuality{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .reflectionQuality .rq{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:5px 8px;font-weight:900;font-size:12px}
      .reflectionQuality .good{color:#bbf7d0;border-color:rgba(52,211,153,.36);background:rgba(52,211,153,.10)}
      .reflectionQuality .warn{color:#fde68a;border-color:rgba(251,191,36,.36);background:rgba(251,191,36,.10)}
      .reflectionQuality .bad{color:#fecdd3;border-color:rgba(251,113,133,.36);background:rgba(251,113,133,.10)}
      .wrongTable{min-width:900px}
      .attemptTrendGood{color:#bbf7d0;font-weight:1000}
      .attemptTrendWarn{color:#fde68a;font-weight:1000}
      .attemptTrendBad{color:#fecdd3;font-weight:1000}
      @media(max-width:980px){.studentDetailGrid6{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:680px){.studentDetailGrid6{grid-template-columns:repeat(2,1fr)}}

      @media(max-width:780px){.studentDetailGrid{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    if($('#teacherAllStudentsPanel')) return;
    const consolePanel = $('#teacherConsolePanel');
    if(!consolePanel) return;
    const decisionBox = $('#teacherDecisionBox');
    const parentGrid = decisionBox ? decisionBox.closest('.teacherGrid2') : null;

    const panel = document.createElement('div');
    panel.className = 'teacherBox';
    panel.id = 'teacherAllStudentsPanel';
    panel.style.marginTop = '14px';
    panel.innerHTML = `
      <h3>All Students Detail</h3>
      <div class="teacherSmallNote">ดูนักศึกษาทุกคน กด View เพื่อดู attempts, reflection, misconception และ event รายคน</div>
      <div class="studentSearchRow">
        <input id="studentSearchInput" placeholder="ค้นหา studentId / ชื่อ / section">
        <select id="studentRiskFilter">
          <option value="all">ทั้งหมด</option>
          <option value="risk">เฉพาะคนที่ควรช่วย</option>
          <option value="notSubmitted">ยังไม่ส่ง</option>
          <option value="reflectionMissing">Reflection ไม่ครบ</option>
          <option value="mastery">Mastery</option>
        </select>
      </div>
      <div class="teacherTableWrap">
        <table class="teacherTable">
          <thead><tr><th>Student</th><th>Section</th><th>Attempts</th><th>Best</th><th>Latest</th><th>Reflection</th><th>Risk</th><th>Detail</th></tr></thead>
          <tbody id="teacherAllStudentsBody"><tr><td colspan="8">กำลังโหลดข้อมูล...</td></tr></tbody>
        </table>
      </div>
    `;

    if(parentGrid) consolePanel.insertBefore(panel, parentGrid);
    else consolePanel.appendChild(panel);

    const modal = document.createElement('div');
    modal.className = 'teacherModalBack';
    modal.id = 'studentDetailModal';
    modal.innerHTML = `
      <div class="teacherModal">
        <div class="teacherModalTop">
          <div><h3 id="studentDetailTitle">Student Detail</h3><div class="teacherSmallNote" id="studentDetailSub"></div></div>
          <div class="teacherToolBar" style="margin-top:0">
            <button class="btn secondary" id="btnStudentDetailExport">Export Student JSON</button>
            <button class="btn secondary" id="btnStudentDetailClose">ปิด</button>
          </div>
        </div>
        <div id="studentDetailContent"></div>
      </div>`;
    document.body.appendChild(modal);

    $('#studentSearchInput').oninput = renderAllStudentsFromState;
    $('#studentRiskFilter').onchange = renderAllStudentsFromState;
    $('#btnStudentDetailClose').onclick = closeStudentDetail;
    $('#studentDetailModal').onclick = e => { if(e.target && e.target.id === 'studentDetailModal') closeStudentDetail(); };
    $('#btnStudentDetailExport').onclick = exportCurrentStudentJson;
  }

  function getAllStudents(){
    const data = window.AIQuestTeacherConsole && window.AIQuestTeacherConsole.lastData;
    const d = data && data.data ? data.data : {};
    return d.allStudents || d.studentsDetail || d.risks || [];
  }

  function renderAllStudentsFromState(){
    const body = $('#teacherAllStudentsBody');
    if(!body) return;
    const all = getAllStudents();
    const q = ($('#studentSearchInput')?.value || '').trim().toLowerCase();
    const filter = $('#studentRiskFilter')?.value || 'all';
    let list = all.slice();
    if(q){ list = list.filter(s => [s.studentId,s.studentName,s.section].join(' ').toLowerCase().includes(q)); }
    if(filter === 'risk') list = list.filter(s => (s.risks || []).length);
    else if(filter === 'notSubmitted') list = list.filter(s => !Number(s.attemptCount || 0));
    else if(filter === 'reflectionMissing') list = list.filter(s => Number(s.attemptCount || 0) && !s.reflectionComplete);
    else if(filter === 'mastery') list = list.filter(s => !!s.mastered);

    if(!list.length){ body.innerHTML = '<tr><td colspan="8">ไม่พบนักศึกษาตามเงื่อนไข</td></tr>'; return; }

    body.innerHTML = list.map(s => {
      const risks = (s.risks || []).map(tag => `<span class="riskTag ${/ต่ำ|ไม่ครบ|ยังไม่ส่ง|ผิด|help|Help|remedial/i.test(tag) ? 'bad' : 'warn'}">${escapeHtml(tag)}</span>`).join(' ') || '<span class="riskTag good">ปกติ</span>';
      return `<tr>
        <td><b>${escapeHtml(s.studentId || '-')}</b><br>${escapeHtml(s.studentName || '')}</td>
        <td>${escapeHtml(s.section || '-')}</td>
        <td>${Number(s.attemptCount || 0)}</td>
        <td>${escapeHtml(s.bestScore ?? '-')}</td>
        <td>${escapeHtml(s.latestScore ?? '-')}</td>
        <td>${s.reflectionComplete ? '<span class="riskTag good">ครบ</span>' : '<span class="riskTag bad">ไม่ครบ</span>'}</td>
        <td>${risks}</td>
        <td><button class="viewDetailBtn" data-student-id="${escapeHtml(s.studentId || '')}">View</button></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('.viewDetailBtn').forEach(btn => { btn.onclick = () => openStudentDetail(btn.getAttribute('data-student-id')); });
  }


  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function getChronologicalAttempts(s){
    return (s.attempts || []).slice().sort((a,b) => String(a.clientTs || a.serverTs || '').localeCompare(String(b.clientTs || b.serverTs || '')));
  }

  function getScoreTrend(s){
    const atts = getChronologicalAttempts(s).filter(a => a.score !== '' && a.score != null);
    if(atts.length < 2){
      return {label:'ยังไม่มีแนวโน้ม', cls:'attemptTrendWarn', delta:0};
    }

    const first = num(atts[0].score);
    const latest = num(atts[atts.length - 1].score);
    const delta = latest - first;

    if(delta >= 10) return {label:`ดีขึ้น +${delta}`, cls:'attemptTrendGood', delta};
    if(delta <= -10) return {label:`ลดลง ${delta}`, cls:'attemptTrendBad', delta};
    if(delta > 0) return {label:`ดีขึ้นเล็กน้อย +${delta}`, cls:'attemptTrendGood', delta};
    if(delta < 0) return {label:`ลดลงเล็กน้อย ${delta}`, cls:'attemptTrendWarn', delta};
    return {label:'คงที่', cls:'attemptTrendWarn', delta};
  }

  function reflectionQuality(s){
    const r = s.latestReflection || {};
    const vals = [
      String(r.reflection1 || '').trim(),
      String(r.reflection2 || '').trim(),
      String(r.reflection3 || '').trim()
    ];

    const missing = vals.filter(v => !v).length;
    const short = vals.filter(v => v && v.length < 20).length;
    const good = vals.filter(v => v.length >= 30).length;

    if(missing){
      return {label:'ไม่ครบ', cls:'bad', score:0, missing, short, good, detail:`ยังว่าง ${missing} ข้อ`};
    }

    if(short){
      return {label:'สั้นเกินไป', cls:'warn', score:1, missing, short, good, detail:`สั้นกว่า 20 ตัวอักษร ${short} ข้อ`};
    }

    if(good >= 2){
      return {label:'ดี', cls:'good', score:2, missing, short, good, detail:'อธิบายได้พอประเมิน'};
    }

    return {label:'พอใช้', cls:'warn', score:1, missing, short, good, detail:'ควรเพิ่มเหตุผลหรือยกตัวอย่าง'};
  }

  function gateLabel(a){
    const score = num(a.score);
    const stars = num(a.stars);

    if(score >= 85 && stars >= 3) return '<span class="riskTag good">Mastery</span>';
    if(score >= 70) return '<span class="riskTag good">Proficient</span>';
    if(score >= 60) return '<span class="riskTag warn">Clear</span>';
    if(score > 0) return '<span class="riskTag bad">Remedial</span>';
    return '<span class="riskTag warn">ไม่ระบุ</span>';
  }

  function bossLabel(a){
    const score = num(a.score);
    const bossWin = a.bossWin === true || String(a.bossWin).toLowerCase() === 'true';

    if(bossWin && score >= 70) return '<span class="riskTag good">ชนะ</span>';
    if(bossWin && score < 70) return '<span class="riskTag warn">ชนะ? ตรวจ</span>';
    if(!bossWin && score >= 60) return '<span class="riskTag warn">ไม่ชัด</span>';
    if(score > 0) return '<span class="riskTag bad">ยังไม่ชนะ</span>';
    return '<span class="riskTag warn">ไม่ระบุ</span>';
  }

  function isWrongEvent(e){
    const v = String(e.isCorrect || '').toLowerCase().trim();

    if(['false','ไม่ถูก','0','no'].includes(v)) return true;

    const ya = String(e.yourAnswer || '').trim();
    const ca = String(e.correctAnswer || '').trim();

    if(ya && ca && ya !== '-' && ca !== '-' && ya !== ca) return true;

    return false;
  }

  function recommendationsForStudent(s){
    const out = [];
    const trend = getScoreTrend(s);
    const rq = reflectionQuality(s);
    const latest = num(s.latestScore);
    const mis = (s.misconceptions || []).slice().sort((a,b) => num(b.count) - num(a.count));
    const top = mis[0];

    if(!num(s.attemptCount)){
      out.push('ยังไม่มี attempt: ให้ตรวจว่าเข้าหน้าเกมและกดส่งผลเข้า Google Sheets แล้วหรือยัง');
      return out;
    }

    if(latest < 60) out.push('คะแนนล่าสุดต่ำกว่า 60: ควรให้ทำ Remedial Quest ก่อนขึ้น Session ถัดไป');
    else if(latest < 70) out.push('คะแนนล่าสุดผ่านขั้นต่ำ: ควรให้ฝึกเพิ่มเพื่อเพิ่มความมั่นใจก่อน Challenge');
    else if(latest >= 85) out.push('คะแนนล่าสุดดี: สามารถให้ต่อยอดด้วยคำถาม Challenge หรืออธิบายเหตุผลเพิ่ม');

    if(trend.delta <= -10) out.push('แนวโน้มคะแนนลดลงชัดเจน: ควรถามว่ารอบล่าสุดติดเรื่องเวลา/ความเข้าใจ/การเดาคำตอบหรือไม่');
    else if(trend.delta >= 10) out.push('แนวโน้มคะแนนดีขึ้น: เหมาะสำหรับเสริมโจทย์ระดับสูงขึ้น');

    if(rq.cls === 'bad') out.push('Reflection ยังไม่ครบ: ให้กลับไปเขียนให้ครบทั้ง 3 ข้อก่อนปิดกิจกรรม');
    else if(rq.cls === 'warn') out.push('Reflection ยังสั้น: ให้เพิ่มเหตุผล ตัวอย่าง หรือเชื่อมกับ Mini Project');

    if(top){
      const k = String(top.key || '').toLowerCase();

      if(k.includes('automation')){
        out.push('Misconception หลักคือ automation: ให้ย้ำความต่างระหว่าง automation ที่ทำตามกฎ กับ AI ที่ใช้ข้อมูล/เรียนรู้/คาดการณ์');
      }else if(k.includes('sensor')){
        out.push('Misconception หลักคือ sensor: ให้ย้ำว่า sensor เป็นแหล่งข้อมูล ไม่ใช่ AI โดยตัวมันเอง');
      }else if(k.includes('rule')){
        out.push('Misconception หลักคือ rule-based: ให้เปรียบเทียบระบบ if-then กับระบบเรียนรู้จากข้อมูล');
      }else if(k.includes('bigdata')){
        out.push('Misconception หลักคือ big data: ให้ย้ำว่ามีข้อมูลมากไม่ได้แปลว่าเป็น AI ถ้าไม่มีการวิเคราะห์/เรียนรู้');
      }else{
        out.push(`Misconception เด่นคือ ${top.key}: ควรยกตัวอย่างซ้ำแบบเฉพาะจุด`);
      }
    }

    if(!out.length) out.push('ภาพรวมดี: ให้ทำโจทย์ประยุกต์หรืออธิบายแนวคิดด้วยตัวอย่างใหม่');

    return out;
  }


  function openStudentDetail(studentId){
    const s = getAllStudents().find(x => String(x.studentId || '') === String(studentId || ''));

    if(!s){
      alert('ไม่พบข้อมูลนักศึกษา: ' + studentId);
      return;
    }

    window.AIQuestTeacherConsole.currentStudent = s;

    const chronological = getChronologicalAttempts(s);
    const attempts = chronological.slice().reverse();
    const events = s.recentEvents || [];
    const wrongEvents = events.filter(isWrongEvent);
    const showEvents = wrongEvents.length ? wrongEvents : events.slice(0, 12);
    const trend = getScoreTrend(s);
    const rq = reflectionQuality(s);
    const recommendations = recommendationsForStudent(s);
    const risks = (s.risks || []).map(tag => `<span class="riskTag bad">${escapeHtml(tag)}</span>`).join(' ') || '<span class="riskTag good">ปกติ</span>';
    const mis = (s.misconceptions || []).slice(0,10).map(m => `<span class="riskTag warn">${escapeHtml(m.key)}: ${Number(m.count || 0)}</span>`).join(' ') || 'ยังไม่มี misconception ชัดเจน';
    const latestReflection = s.latestReflection || {};

    $('#studentDetailTitle').textContent = `${s.studentId || '-'} · ${s.studentName || ''}`;
    $('#studentDetailSub').textContent = `Section ${s.section || '-'} · Attempts ${Number(s.attemptCount || 0)} · Best ${s.bestScore ?? '-'} · Latest ${s.latestScore ?? '-'}`;

    $('#studentDetailContent').innerHTML = `
      <div class="studentDetailGrid6">
        <div class="studentDetailCard good"><b>Best Score</b><br>${escapeHtml(s.bestScore ?? '-')}</div>
        <div class="studentDetailCard ${num(s.latestScore) >= 70 ? 'good' : num(s.latestScore) >= 60 ? 'warn' : 'bad'}"><b>Latest Score</b><br>${escapeHtml(s.latestScore ?? '-')}</div>
        <div class="studentDetailCard"><b>Attempt Count</b><br>${Number(s.attemptCount || 0)}</div>
        <div class="studentDetailCard"><b>Trend</b><br><span class="${trend.cls}">${escapeHtml(trend.label)}</span></div>
        <div class="studentDetailCard"><b>Help Used</b><br>${escapeHtml(s.helpUsed ?? '-')}</div>
        <div class="studentDetailCard ${rq.cls}"><b>Reflection Quality</b><br>${escapeHtml(rq.label)}</div>
      </div>

      <div class="reflectionBlock">
        <div class="studentDetailSectionTitle">Recommendation for this student</div>
        <ul class="recommendList">
          ${recommendations.map(x => `<li>${escapeHtml(x)}</li>`).join('')}
        </ul>
      </div>

      <div class="reflectionBlock">
        <b>Risk:</b><br>${risks}
        <br><br>
        <b>Misconception:</b><br>${mis}
      </div>

      <div class="reflectionBlock">
        <div class="studentDetailSectionTitle">Latest Reflection</div>
        <b>1)</b> ${escapeHtml(latestReflection.reflection1 || '-')}<br>
        <b>2)</b> ${escapeHtml(latestReflection.reflection2 || '-')}<br>
        <b>3)</b> ${escapeHtml(latestReflection.reflection3 || '-')}
        <div class="reflectionQuality">
          <span class="rq ${rq.cls}">${escapeHtml(rq.label)}</span>
          <span class="rq ${rq.short ? 'warn' : 'good'}">${escapeHtml(rq.detail)}</span>
        </div>
      </div>

      <div class="teacherBox studentDetailFull">
        <h3>Attempts</h3>
        <div class="teacherTableWrap">
          <table class="teacherTable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Help</th>
                <th>Stars</th>
                <th>Gate</th>
                <th>Boss</th>
              </tr>
            </thead>
            <tbody>
              ${attempts.length ? attempts.map(a => `
                <tr>
                  <td>${escapeHtml(a.clientTs || a.serverTs || '-')}</td>
                  <td>${escapeHtml(a.score ?? '-')}</td>
                  <td>${escapeHtml(a.accuracy ?? '-')}</td>
                  <td>${escapeHtml(a.helpUsed ?? '-')}</td>
                  <td>${escapeHtml(a.stars ?? '-')}</td>
                  <td>${gateLabel(a)}</td>
                  <td>${bossLabel(a)}</td>
                </tr>
              `).join('') : '<tr><td colspan="7">ยังไม่มี attempt</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="teacherBox studentDetailFull">
        <h3>${wrongEvents.length ? 'Wrong Items / Events to Review' : 'Recent Events'}</h3>
        <div class="teacherSmallNote">
          ${wrongEvents.length ? 'แสดงข้อ/เหตุการณ์ที่น่าทบทวนก่อน เพื่อให้อาจารย์ช่วยรายคนได้เร็ว' : 'ยังไม่พบ wrong item ชัดเจน จึงแสดง event ล่าสุดแทน'}
        </div>
        <div class="teacherTableWrap" style="margin-top:10px">
          <table class="teacherTable wrongTable">
            <thead>
              <tr>
                <th>Time</th>
                <th>Phase</th>
                <th>Prompt</th>
                <th>Your Answer</th>
                <th>Correct</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              ${showEvents.length ? showEvents.map(e => `
                <tr>
                  <td>${escapeHtml(e.serverTs || '-')}</td>
                  <td>${escapeHtml(e.phase || e.eventType || '-')}</td>
                  <td>${escapeHtml(e.prompt || '')}</td>
                  <td>${escapeHtml(e.yourAnswer || '-')}</td>
                  <td>${escapeHtml(e.correctAnswer || '-')}</td>
                  <td>${isWrongEvent(e) ? '<span class="riskTag bad">ควรทบทวน</span>' : '<span class="riskTag warn">event</span>'}</td>
                </tr>
              `).join('') : '<tr><td colspan="6">ยังไม่มี event รายคน</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;

    $('#studentDetailModal').classList.add('show');
  }


  function closeStudentDetail(){ $('#studentDetailModal')?.classList.remove('show'); }
  function exportCurrentStudentJson(){
    const s = window.AIQuestTeacherConsole.currentStudent;
    if(!s){ alert('ยังไม่ได้เลือกนักศึกษา'); return; }
    const blob = new Blob([JSON.stringify(s, null, 2)], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `aiquest-student-${s.studentId || 'detail'}.json`; a.click(); URL.revokeObjectURL(url);
  }

  function patchRefresh(){
    const api = window.AIQuestTeacherConsole;
    if(!api || api.__studentDetailPatched) return false;
    const original = api.refreshConsole;
    api.refreshConsole = async function(showToastFlag){
      const result = await original.call(api, showToastFlag);
      setTimeout(renderAllStudentsFromState, 80);
      return result;
    };
    api.__studentDetailPatched = true;
    return true;
  }

  function boot(){
    if(!isTeacherMode()) return;
    injectStyle();
    ensurePanel();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      ensurePanel();
      patchRefresh();
      renderAllStudentsFromState();
      if(tries > 20) clearInterval(timer);
    }, 400);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.AIQuestStudentDetail = {VERSION, renderAllStudentsFromState, openStudentDetail};
  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
