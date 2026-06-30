/* EAP Hero Teacher Dashboard server helpers.
   Add this as a second .gs file in the same Apps Script project as Code.gs v3.
*/

function showEapTeacherDashboard() {
  const html = HtmlService
    .createHtmlOutputFromFile('EAP_TeacherDashboard')
    .setWidth(1280)
    .setHeight(760);
  SpreadsheetApp.getUi().showModelessDialog(html, 'EAP Hero Teacher Dashboard');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('EAP Hero')
    .addItem('เปิด Teacher Dashboard', 'showEapTeacherDashboard')
    .addToUi();
}

function eapTeacherDashboardData(filters) {
  filters = filters || {};
  const section = text_(filters.section, EAP_CONFIG.DEFAULT_SECTION);
  const query = text_(filters.query, '').toLowerCase();
  const wantedStatus = text_(filters.status, '');
  const rows = sh_('summary').getDataRange().getValues().slice(1)
    .map(r => rowObject_(H.summary, r))
    .filter(r => text_(r.section) === section);

  const byStudent = {};
  rows.forEach(r => {
    const id = text_(r.studentId);
    if (!id) return;
    if (!byStudent[id]) {
      byStudent[id] = {
        studentId: id,
        studentName: text_(r.studentName),
        section: text_(r.section),
        skills: 0,
        scoreTotal: 0,
        scoreCount: 0,
        legacyCompletion: 0,
        reviewCount: 0
      };
    }
    const s = byStudent[id];
    s.skills++;
    if (text_(r.legacyCompletion).toUpperCase() === 'TRUE') s.legacyCompletion++;
    else { s.scoreTotal += number_(r.bestScore, 0); s.scoreCount++; }
    if (text_(r.reviewFlag)) s.reviewCount++;
  });

  let students = Object.keys(byStudent).map(id => {
    const s = byStudent[id];
    const status = s.reviewCount ? 'review' : (s.legacyCompletion ? 'legacy' : 'active');
    return {
      studentId: s.studentId,
      studentName: s.studentName,
      section: s.section,
      skills: s.skills,
      avgBestScore: s.scoreCount ? Math.round((s.scoreTotal / s.scoreCount) * 100) / 100 : 0,
      legacyCompletion: s.legacyCompletion,
      reviewCount: s.reviewCount,
      status: status
    };
  });

  if (query) {
    students = students.filter(s => (s.studentId + ' ' + s.studentName + ' ' + s.section).toLowerCase().includes(query));
  }
  if (wantedStatus) students = students.filter(s => s.status === wantedStatus);
  students.sort((a, b) => String(a.studentName).localeCompare(String(b.studentName)));

  const realRows = rows.filter(r => text_(r.legacyCompletion).toUpperCase() !== 'TRUE');
  const total = realRows.reduce((sum, r) => sum + number_(r.bestScore, 0), 0);
  return {
    summary: {
      students: Object.keys(byStudent).length,
      skillRecords: rows.length,
      avgBestScore: realRows.length ? Math.round((total / realRows.length) * 100) / 100 : 0,
      needsSupport: rows.filter(r => text_(r.reviewFlag) === 'needs_support').length,
      legacyOnly: rows.filter(r => text_(r.reviewFlag) === 'legacy_completion_only').length,
      updatedAt: now_().iso
    },
    students: students
  };
}

function eapTeacherStudentDetail(studentId) {
  const id = text_(studentId, '');
  const rows = sh_('summary').getDataRange().getValues().slice(1)
    .map(r => rowObject_(H.summary, r))
    .filter(r => text_(r.studentId) === id)
    .sort((a, b) => Number(a.sessionId) - Number(b.sessionId) || text_(a.skill).localeCompare(text_(b.skill)));
  return {
    studentId: id,
    studentName: rows.length ? text_(rows[0].studentName) : '',
    records: rows
  };
}
