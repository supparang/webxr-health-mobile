/* CSAI2102 AI Quest — Teacher AR Readiness v4.0.8
   Supplementary teaching view for S1/S2 AR evidence.
   Uses only deduplicated session_events and never changes learner scores,
   stars, gates, or main-session mastery.
*/
(() => {
  'use strict';

  const CARD_ID = 'aiquestArReadinessV408';
  let lastFingerprint = '';

  const $ = (id) => document.getElementById(id);
  const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
  const parse = (value) => {
    if (!value || typeof value === 'object') return value || {};
    try { return JSON.parse(String(value)); }
    catch (_) { return {}; }
  };
  const dateValue = (value) => Date.parse(value || '') || 0;
  const timeText = (value) => {
    const seconds = Math.max(0, Math.round(num(value)));
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  function rawStudents(){
    const app = window.AIQUEST_TEACHER_ONLY_DASHBOARD || null;
    const state = app?.state || {};
    const raw = state.raw || {};
    const data = raw.data || raw;
    const all = data.allStudents || raw.allStudents || [];
    return Array.isArray(all) ? all : [];
  }

  function allArEvents(){
    const rows = [];

    rawStudents().forEach((student) => {
      const events = Array.isArray(student.recentEvents) ? student.recentEvents : [];
      events.forEach((event) => {
        const type = String(event?.eventType || '').toLowerCase();
        if (type !== 's1_ar_complete' && type !== 's2_ar_complete') return;

        const trace = parse(event.yourAnswer);
        rows.push({
          type,
          studentId: String(student.studentId || event.studentId || ''),
          studentName: String(student.studentName || student.name || ''),
          section: String(student.section || event.section || '101'),
          score: Math.round(num(trace.score ?? trace.arScore ?? event.scoreDelta)),
          correct: num(trace.correct ?? trace.arCorrect ?? event.combo),
          total: num(trace.total ?? trace.arTotal),
          help: num(trace.helpUsed ?? trace.arHelpUsed),
          usedSec: num(trace.usedSec ?? trace.arUsedSec),
          input: String(trace.inputMode ?? trace.arInputMode ?? 'hand_or_mouse_touch'),
          completedAt: String(trace.completedAt || event.clientTs || event.serverTs || '')
        });
      });
    });

    return rows.sort((a, b) => dateValue(b.completedAt) - dateValue(a.completedAt));
  }

  function fingerprint(row){
    return [
      row.type,
      row.studentId,
      row.completedAt,
      row.score,
      row.correct,
      row.total,
      row.help,
      row.usedSec,
      row.input
    ].join('|');
  }

  function uniqueEvents(rows){
    const seen = new Map();
    (rows || []).forEach((row) => {
      const key = fingerprint(row);
      if (!seen.has(key)) seen.set(key, row);
    });
    return [...seen.values()].sort((a, b) => dateValue(b.completedAt) - dateValue(a.completedAt));
  }

  function card(){
    let box = $(CARD_ID);
    if (box) return box;

    const studentsCard = $('studentsBox')?.closest('.card');
    if (!studentsCard) return null;

    box = document.createElement('section');
    box.id = CARD_ID;
    box.className = 'card';
    box.style.marginBottom = '14px';
    studentsCard.insertAdjacentElement('beforebegin', box);
    return box;
  }

  function latest(rows){
    return rows.slice().sort((a, b) => dateValue(b.completedAt) - dateValue(a.completedAt))[0] || null;
  }

  function best(rows){
    return rows.slice().sort((a, b) =>
      num(b.score) - num(a.score) || dateValue(b.completedAt) - dateValue(a.completedAt)
    )[0] || null;
  }

  function evidenceText(row){
    if (!row) return '<span class="pill warn">ยังไม่มี</span>';
    const tone = row.score >= 85 ? 'good' : 'warn';
    return `<span class="pill ${tone}">${esc(row.score)}%</span><br><span class="muted">${esc(row.correct)}/${esc(row.total || '-')} • ${esc(timeText(row.usedSec))}</span>`;
  }

  function nextStep(s1, latestS2, bestS2){
    if (!latestS2) {
      return {
        tone: 'warn',
        label: 'รอ S2 AR evidence',
        text: 'ให้ลอง Agent Builder อย่างน้อย 1 รอบ เพื่อดู Agent / PEAS / Environment'
      };
    }

    if (latestS2.score >= 85) {
      return {
        tone: 'good',
        label: 'S2 evidence strong',
        text: 'เปลี่ยนคดีรอบถัดไปเพื่อยืนยันว่าแยก Agent / PEAS / Environment ได้ข้ามบริบท'
      };
    }

    if (bestS2 && bestS2.score >= 85) {
      return {
        tone: 'warn',
        label: 'Mastery exists • latest review',
        text: `เคยทำได้ ${bestS2.score}% แต่รอบล่าสุด ${latestS2.score}% — ทบทวน Environment → PEAS ก่อนลองใหม่`
      };
    }

    if (latestS2.score >= 67) {
      return {
        tone: 'warn',
        label: 'Practice Environment → PEAS',
        text: 'ชี้ให้เห็นว่า Environment คือโลก/บริบทที่ agent ทำงาน ไม่ใช่ sensor หรือ action'
      };
    }

    return {
      tone: 'warn',
      label: 'Guided replay recommended',
      text: 'เริ่มจาก Agent or Not แล้วไล่ PEAS ทีละส่วนก่อนกลับไปทำ S2 AR ใหม่'
    };
  }

  function render(){
    const box = card();
    if (!box) return;

    const rows = uniqueEvents(allArEvents());
    if (!rows.length) {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h2 style="margin:0">AR Readiness by Learner</h2>
            <p class="muted" style="margin:7px 0 0">สรุปหลักฐาน S1/S2 AR เพื่อวางจุดฝึกต่อรายคน</p>
          </div>
          <span class="pill warn">ยังไม่มี AR evidence</span>
        </div>`;
      return;
    }

    const learners = new Map();
    rows.forEach((row) => {
      const key = row.studentId || `${row.studentName}__${row.section}`;
      if (!learners.has(key)) {
        learners.set(key, {
          studentId: row.studentId,
          studentName: row.studentName,
          section: row.section,
          s1: [],
          s2: []
        });
      }
      learners.get(key)[row.type === 's1_ar_complete' ? 's1' : 's2'].push(row);
    });

    const people = [...learners.values()]
      .map((person) => {
        const latestS1 = latest(person.s1);
        const latestS2 = latest(person.s2);
        const bestS2 = best(person.s2);
        return Object.assign(person, {
          latestS1,
          latestS2,
          bestS2,
          next: nextStep(latestS1, latestS2, bestS2)
        });
      })
      .sort((a, b) => (a.section + a.studentName + a.studentId).localeCompare(b.section + b.studentName + b.studentId));

    const s1Runs = rows.filter((row) => row.type === 's1_ar_complete').length;
    const s2Runs = rows.filter((row) => row.type === 's2_ar_complete').length;
    const latestSecure = people.filter((person) => person.latestS2 && person.latestS2.score >= 85).length;

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <h2 style="margin:0">AR Readiness by Learner</h2>
          <p class="muted" style="margin:7px 0 0">สรุปหลักฐานเสริม S1/S2 AR แบบ Latest + Best เพื่อช่วยตัดสินใจว่าจะฝึกต่อจุดใด</p>
        </div>
        <span class="pill blue">Supplementary only • ไม่เปลี่ยนคะแนนหรือ gate หลัก</span>
      </div>

      <div class="grid cols3" style="margin-top:12px">
        <div class="metric"><span class="muted">AR learners</span><b>${people.length}</b></div>
        <div class="metric"><span class="muted">S1 / S2 evidence</span><b>${s1Runs} / ${s2Runs}</b></div>
        <div class="metric"><span class="muted">Latest S2 ≥85%</span><b>${latestSecure}/${people.filter((person) => person.latestS2).length}</b></div>
      </div>

      <div style="overflow:auto;max-height:420px;margin-top:12px">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>S1 AR latest</th>
              <th>S2 AR latest</th>
              <th>S2 best</th>
              <th>Evidence</th>
              <th>Teacher next step</th>
            </tr>
          </thead>
          <tbody>${people.map((person) => `
            <tr>
              <td><b>${esc(person.studentId || '-')}</b><br><span class="muted">${esc(person.studentName || '')} • ${esc(person.section || '')}</span></td>
              <td>${evidenceText(person.latestS1)}</td>
              <td>${evidenceText(person.latestS2)}</td>
              <td>${evidenceText(person.bestS2)}</td>
              <td>${person.s2.length} real S2 run${person.s2.length === 1 ? '' : 's'}<br><span class="muted">S1 ${person.s1.length} run${person.s1.length === 1 ? '' : 's'}</span></td>
              <td><span class="pill ${person.next.tone}">${esc(person.next.label)}</span><br><span class="muted">${esc(person.next.text)}</span></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  function fingerprintAll(){
    return uniqueEvents(allArEvents())
      .map((row) => [row.type, row.studentId, row.completedAt, row.score, row.correct, row.total, row.help, row.usedSec].join('|'))
      .join('||');
  }

  function refresh(){
    const next = fingerprintAll();
    if (next === lastFingerprint && $(CARD_ID)) return;
    lastFingerprint = next;
    render();
  }

  function boot(){
    refresh();
    setInterval(refresh, 1100);
  }

  window.AIQUEST_TEACHER_AR_READINESS = Object.freeze({
    version: 'v4.0.8-ar-readiness',
    getRecords: () => uniqueEvents(allArEvents()),
    refresh
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
