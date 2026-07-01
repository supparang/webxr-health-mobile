/* =========================================================
 * UX Quest • Teacher Action Dashboard Patch v1
 * Turns reasoning analytics into three teaching actions:
 *   1) who needs immediate support,
 *   2) what the class should revisit,
 *   3) who is ready for a stretch task.
 *
 * Prerequisite: UXQ_ANTI_GUESS_DASHBOARD_PATCH.gs
 * This patch is read-only. It does not change scores, stars, or learner access.
 * ========================================================= */

function uxqGetTeacherActionView() {
  const base = uxqGetTeacherView();
  const attempts = (base.attempts || []).filter(uxqActionIsMissionAttempt_);
  const students = uxqActionStudents_(attempts);
  const patterns = uxqActionPatterns_(attempts);

  const needsHelp = students
    .filter(student => student.supportLevel === 'urgent' || student.supportLevel === 'review')
    .sort((a, b) => b.priorityScore - a.priorityScore || String(a.studentName).localeCompare(String(b.studentName)));

  const stretchReady = students
    .filter(student => student.supportLevel === 'stretch')
    .sort((a, b) => b.best.verifiedAccuracy - a.best.verifiedAccuracy || b.best.accuracy - a.best.accuracy)
    .slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      students: students.length,
      needsHelp: needsHelp.length,
      classPatterns: patterns.length,
      stretchReady: stretchReady.length
    },
    needsHelp: needsHelp.slice(0, 8),
    classPatterns: patterns.slice(0, 6),
    stretchReady: stretchReady,
    students: students
  };
}

function uxqActionIsMissionAttempt_(attempt) {
  if (!attempt) return false;
  const payload = uxqActionPayload_(attempt);
  const eventType = String(payload.eventType || attempt.eventType || '').trim();
  if (eventType === 'reason_retry_submitted') return false;
  // A mission row has answers/total; retries and blank legacy rows must not affect class analytics.
  return Array.isArray(attempt.answers) && attempt.answers.length > 0 || Number(attempt.total || 0) > 0;
}

function uxqActionPayload_(attempt) {
  // Base patch already reads payload into answers. This helper preserves compatibility with old rows.
  return attempt && attempt.payload && typeof attempt.payload === 'object' ? attempt.payload : {};
}

function uxqActionStudents_(attempts) {
  const groups = {};
  (attempts || []).forEach(attempt => {
    const key = String(attempt.studentId || attempt.studentName || 'unknown');
    if (!groups[key]) groups[key] = {
      studentId: attempt.studentId || '',
      studentName: attempt.studentName || attempt.studentId || 'ไม่ระบุชื่อ',
      section: attempt.section || '',
      attempts: []
    };
    groups[key].attempts.push(attempt);
  });

  return Object.keys(groups).map(key => {
    const student = groups[key];
    const sorted = student.attempts.slice().sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
    const latest = sorted[0] || {};
    const best = student.attempts.slice().sort((a, b) => Number(b.verifiedAccuracy || 0) - Number(a.verifiedAccuracy || 0) || Number(b.accuracy || 0) - Number(a.accuracy || 0))[0] || {};
    const focus = uxqActionFocus_(latest.answers || []);
    const support = uxqActionSupport_(latest, best, focus);

    return {
      studentId: student.studentId,
      studentName: student.studentName,
      section: student.section,
      attempts: student.attempts.length,
      latest: latest,
      best: best,
      focus: focus,
      supportLevel: support.level,
      priorityScore: support.priority,
      actionLabel: support.label,
      actionText: support.text,
      feedbackPrompt: uxqActionFeedbackPrompt_(focus, latest)
    };
  }).sort((a, b) => String(a.studentName).localeCompare(String(b.studentName)));
}

function uxqActionFocus_(answers) {
  const groups = {};
  (answers || []).forEach(answer => {
    if (!answer || answer.verified) return;
    const key = String(answer.stageKey || 'reasoning').toLowerCase();
    if (!groups[key]) groups[key] = { stageKey: key, count: 0, mainCorrectCount: 0, examples: [] };
    groups[key].count += 1;
    if (answer.correct) groups[key].mainCorrectCount += 1;
    if (groups[key].examples.length < 2) groups[key].examples.push({
      selected: String(answer.selected || ''),
      reasonSelected: String(answer.reasonSelected || '')
    });
  });
  return Object.keys(groups).map(key => groups[key])
    .sort((a, b) => b.count - a.count || a.stageKey.localeCompare(b.stageKey));
}

function uxqActionSupport_(latest, best, focus) {
  const verified = Number(latest.verifiedAccuracy || 0);
  const accuracy = Number(latest.accuracy || 0);
  const rapid = Boolean(latest.rapidAttemptFlag);
  const gaps = focus.reduce((sum, item) => sum + Number(item.count || 0), 0);

  if (rapid || verified < 55 || gaps >= 3) {
    return { level: 'urgent', priority: 100 + (55 - verified) + gaps * 5, label: 'ช่วยทันที', text: 'นัดดู Reason Check รายบุคคล แล้วถามให้ผู้เรียนเชื่อมพฤติกรรมผู้ใช้กับเหตุผลของตน' };
  }
  if (verified < 70 || gaps > 0 || accuracy < 62) {
    return { level: 'review', priority: 70 + (70 - verified) + gaps * 4, label: 'ทบทวนเหตุผล', text: 'ให้ผู้เรียนอธิบาย cause–effect ของคำตอบ 1 ข้อ และลองทำ Explain Why Retry' };
  }
  if (Number(best.verifiedAccuracy || 0) >= 85 && Number(best.accuracy || 0) >= 82) {
    return { level: 'stretch', priority: 0, label: 'พร้อมต่อยอด', text: 'ให้เป็นคู่คิด: เปรียบเทียบ 2 ทางแก้และออกแบบ test ที่พิสูจน์ความต่างได้' };
  }
  return { level: 'steady', priority: 0, label: 'ติดตามต่อ', text: 'ผ่านได้ดี ให้เล่นคดีใหม่เพื่อยืนยันว่าถ่ายโอนหลักคิดไปยังบริบทอื่นได้' };
}

function uxqActionPatterns_(attempts) {
  const groups = {};
  (attempts || []).forEach(attempt => {
    const studentKey = String(attempt.studentId || attempt.studentName || 'unknown');
    (uxqActionFocus_(attempt.answers || [])).forEach(item => {
      const mission = String(attempt.missionTitle || attempt.missionId || 'Mission');
      const key = mission + '|' + item.stageKey;
      if (!groups[key]) groups[key] = { mission: mission, stageKey: item.stageKey, incidents: 0, studentKeys: {}, examples: [] };
      groups[key].incidents += Number(item.count || 0);
      groups[key].studentKeys[studentKey] = true;
      if (groups[key].examples.length < 2) groups[key].examples = groups[key].examples.concat(item.examples || []).slice(0, 2);
    });
  });

  return Object.keys(groups).map(key => {
    const item = groups[key];
    const studentCount = Object.keys(item.studentKeys).length;
    return {
      mission: item.mission,
      stageKey: item.stageKey,
      incidents: item.incidents,
      studentCount: studentCount,
      lesson: uxqActionLesson_(item.stageKey),
      prompt: uxqActionClassPrompt_(item.stageKey),
      examples: item.examples
    };
  }).sort((a, b) => b.studentCount - a.studentCount || b.incidents - a.incidents || a.mission.localeCompare(b.mission));
}

function uxqActionLesson_(stage) {
  const map = {
    evidence: 'ทบทวนการเริ่มจากพฤติกรรมผู้ใช้ที่สังเกตได้ ไม่ใช่ความเห็นของทีม',
    hypothesis: 'ทบทวนการเชื่อม Evidence → friction / mental model โดยไม่โทษผู้ใช้',
    fix: 'ทบทวนการแยก “แก้ต้นเหตุ” ออกจาก “ทำหน้าจอดูดีขึ้น”',
    test: 'ทบทวนว่า Test ต้องวัด task success + understanding ไม่ใช่ความชอบอย่างเดียว',
    empathize: 'ทบทวนการเก็บบริบทและพฤติกรรมก่อนรีบเลือก solution',
    define: 'ทบทวน HMW ที่ระบุ user need และ barrier โดยไม่ล็อก solution',
    ideate: 'ทบทวน concept ที่ตอบ need และยังตั้งสมมติฐานให้ทดสอบได้',
    prototype: 'ทบทวนการทำต้นแบบเฉพาะ flow ที่เสี่ยงที่สุด',
    diagnose: 'ทบทวนการแยก intrinsic task difficulty ออกจาก extraneous load',
    prioritize: 'ทบทวน hierarchy ที่ทำให้ action ปัจจุบันเด่นกว่าสิ่งรอง',
    reduce: 'ทบทวน chunking, default และ progressive disclosure โดยไม่ซ่อนข้อมูลสำคัญ',
    validate: 'ทบทวนการวัดความเข้าใจและความผิดพลาดควบคู่กับเวลา',
    process: 'ทบทวนลำดับ Evidence → Need → Prototype → Test'
  };
  return map[String(stage || '').toLowerCase()] || 'ทบทวนการเชื่อมคำตอบกับพฤติกรรมผู้ใช้และผลที่ต้องพิสูจน์';
}

function uxqActionClassPrompt_(stage) {
  const map = {
    evidence: 'ให้ทั้งห้องขีดเส้นใต้ “พฤติกรรมที่สังเกตได้” และบอกว่าหลักฐานนี้ตัดสมมติฐานใดทิ้ง',
    hypothesis: 'ให้เปรียบ 2 สมมติฐาน แล้วอธิบายว่า evidence เดียวกันสนับสนุนข้อใดมากกว่า',
    fix: 'ให้จัดการ์ด “แก้สาเหตุ / แก้ปลายเหตุ / เพิ่มภาระ” ก่อนเลือกทางแก้',
    test: 'ให้แก้แผน test ที่วัดแค่ความชอบ ให้กลายเป็น task + metric + follow-up question',
    define: 'ให้ rewrite HMW จากโจทย์ที่ล็อก solution เป็น user need + barrier',
    prototype: 'ให้ลด prototype ที่ใหญ่เกินไปเหลือ flow เดียวที่ตอบคำถามเสี่ยงที่สุด',
    diagnose: 'ให้แยกบัตรข้อมูลเป็น “งานจำเป็น” กับ “ภาระที่ interface สร้างเพิ่ม”'
  };
  return map[String(stage || '').toLowerCase()] || 'ให้ผู้เรียนอธิบายเหตุผลของตัวเลือกโดยอ้างพฤติกรรมผู้ใช้และผลที่คาดว่าจะเกิด';
}

function uxqActionFeedbackPrompt_(focus, latest) {
  const top = (focus || [])[0];
  if (!top) return 'ให้ผู้เรียนเลือก 1 คำตอบของตน แล้วอธิบายว่าพฤติกรรมผู้ใช้ใดทำให้คำตอบนั้นน่าเชื่อ';
  const stage = String(top.stageKey || 'reasoning');
  return 'ลองทบทวน ' + stage + ': ' + uxqActionLesson_(stage);
}
