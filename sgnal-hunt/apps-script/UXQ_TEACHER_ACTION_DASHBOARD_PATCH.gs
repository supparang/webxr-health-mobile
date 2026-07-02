/* =========================================================
 * UX Quest • Teacher Action Dashboard Patch v2
 * Thai-first actions for W1–W4 and B1.
 * Prerequisite: UXQ_ANTI_GUESS_DASHBOARD_PATCH.gs
 * Read-only: never changes learner scores, stars, or access.
 * ========================================================= */

function uxqGetTeacherActionView() {
  const base = uxqGetTeacherView();
  const attempts = (base.attempts || []).filter(uxqActionIsMissionAttempt_);
  const students = uxqActionStudents_(attempts);
  const patterns = uxqActionPatterns_(attempts);
  const needsHelp = students.filter(s => s.supportLevel === 'urgent' || s.supportLevel === 'review')
    .sort((a, b) => b.priorityScore - a.priorityScore || String(a.studentName).localeCompare(String(b.studentName)));
  const stretchReady = students.filter(s => s.supportLevel === 'stretch')
    .sort((a, b) => b.best.verifiedAccuracy - a.best.verifiedAccuracy || b.best.accuracy - a.best.accuracy).slice(0, 8);
  return {generatedAt:new Date().toISOString(),summary:{students:students.length,needsHelp:needsHelp.length,classPatterns:patterns.length,stretchReady:stretchReady.length},needsHelp:needsHelp.slice(0,8),classPatterns:patterns.slice(0,6),stretchReady:stretchReady,students:students};
}

function uxqActionIsMissionAttempt_(attempt) {
  if (!attempt) return false;
  const payload = uxqActionPayload_(attempt);
  if (String(payload.eventType || attempt.eventType || '').trim() === 'reason_retry_submitted') return false;
  return (Array.isArray(attempt.answers) && attempt.answers.length > 0) || Number(attempt.total || 0) > 0;
}
function uxqActionPayload_(attempt) { return attempt && attempt.payload && typeof attempt.payload === 'object' ? attempt.payload : {}; }
function uxqActionMissionName_(value) {
  const m={w1:'W1 • นักสืบปัญหา UX',w2:'W2 • คิดเชิงออกแบบ',w3:'W3 • ลดภาระความคิด',b1:'B1 • บอสพายุความสับสน',w4:'W4 • ห้องแล็บถอดรหัสผู้ใช้'};
  return m[String(value || '').toLowerCase()] || String(value || 'ภารกิจ');
}
function uxqActionStageName_(value) {
  const m={evidence:'หลักฐาน',hypothesis:'สมมติฐาน',fix:'วิธีแก้',test:'ทดสอบ',empathize:'เข้าใจผู้ใช้',define:'ตั้งโจทย์',ideate:'สร้างแนวคิด',prototype:'ต้นแบบ',diagnose:'หาจุดที่ทำให้คิดเกินจำเป็น',prioritize:'จัดลำดับสิ่งสำคัญ',reduce:'ลดภาระความคิด',validate:'ตรวจผล',process:'กระบวนการออกแบบ',listen:'ฟังสัญญาณผู้ใช้',separate:'แยกสิ่งที่เห็นจริง',insight:'สกัดความเข้าใจเชิงลึก'};
  return m[String(value || '').toLowerCase()] || String(value || 'ตรวจเหตุผล');
}

function uxqActionStudents_(attempts) {
  const groups = {};
  (attempts || []).forEach(a => {
    const key=String(a.studentId || a.studentName || 'unknown');
    if (!groups[key]) groups[key]={studentId:a.studentId || '',studentName:a.studentName || a.studentId || 'ไม่ระบุชื่อ',section:a.section || '',attempts:[]};
    groups[key].attempts.push(a);
  });
  return Object.keys(groups).map(key => {
    const student=groups[key];
    const sorted=student.attempts.slice().sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt)));
    const latest=sorted[0] || {};
    const best=student.attempts.slice().sort((a,b)=>Number(b.verifiedAccuracy||0)-Number(a.verifiedAccuracy||0)||Number(b.accuracy||0)-Number(a.accuracy||0))[0] || {};
    const focus=uxqActionFocus_(latest.answers || []), support=uxqActionSupport_(latest,best,focus);
    return {studentId:student.studentId,studentName:student.studentName,section:student.section,attempts:student.attempts.length,latest:latest,best:best,focus:focus,supportLevel:support.level,priorityScore:support.priority,actionLabel:support.label,actionText:support.text,feedbackPrompt:uxqActionFeedbackPrompt_(focus,latest)};
  }).sort((a,b)=>String(a.studentName).localeCompare(String(b.studentName)));
}

function uxqActionFocus_(answers) {
  const groups={};
  (answers || []).forEach(answer=>{
    if (!answer || answer.verified) return;
    const key=String(answer.stageKey || 'reasoning').toLowerCase();
    if (!groups[key]) groups[key]={stageKey:key,count:0,mainCorrectCount:0,examples:[]};
    groups[key].count += 1;
    if (answer.correct) groups[key].mainCorrectCount += 1;
    if (groups[key].examples.length < 2) groups[key].examples.push({selected:String(answer.selected || ''),reasonSelected:String(answer.reasonSelected || '')});
  });
  return Object.keys(groups).map(k=>groups[k]).sort((a,b)=>b.count-a.count || a.stageKey.localeCompare(b.stageKey));
}

function uxqActionSupport_(latest,best,focus) {
  const verified=Number(latest.verifiedAccuracy||0),accuracy=Number(latest.accuracy||0),rapid=Boolean(latest.rapidAttemptFlag),gaps=focus.reduce((s,i)=>s+Number(i.count||0),0);
  if (rapid || verified < 55 || gaps >= 3) return {level:'urgent',priority:100+(55-verified)+gaps*5,label:'ช่วยทันที',text:'นัดดูการตรวจเหตุผลรายบุคคล แล้วให้ผู้เรียนเชื่อมพฤติกรรมผู้ใช้กับเหตุผลของตน'};
  if (verified < 70 || gaps > 0 || accuracy < 62) return {level:'review',priority:70+(70-verified)+gaps*4,label:'ทบทวนเหตุผล',text:'ให้ผู้เรียนอธิบายความเชื่อมโยงของคำตอบ 1 ข้อ แล้วลองตอบเหตุผลใหม่'};
  if (Number(best.verifiedAccuracy||0) >= 85 && Number(best.accuracy||0) >= 82) return {level:'stretch',priority:0,label:'พร้อมต่อยอด',text:'ให้เป็นคู่คิด: เปรียบเทียบ 2 ทางแก้ และออกแบบการทดสอบที่พิสูจน์ความต่างได้'};
  return {level:'steady',priority:0,label:'ติดตามต่อ',text:'ผ่านได้ดี ให้เล่นคดีใหม่เพื่อยืนยันว่าถ่ายโอนหลักคิดไปยังบริบทอื่นได้'};
}

function uxqActionPatterns_(attempts) {
  const groups={};
  (attempts || []).forEach(a=>{
    const studentKey=String(a.studentId || a.studentName || 'unknown');
    uxqActionFocus_(a.answers || []).forEach(item=>{
      const missionId=String(a.missionId || '').toLowerCase();
      const mission=uxqActionMissionName_(missionId || a.missionTitle || '');
      const key=mission+'|'+item.stageKey;
      if(!groups[key]) groups[key]={mission:mission,stageKey:item.stageKey,incidents:0,studentKeys:{},examples:[]};
      groups[key].incidents += Number(item.count || 0); groups[key].studentKeys[studentKey]=true;
      if(groups[key].examples.length<2) groups[key].examples=groups[key].examples.concat(item.examples||[]).slice(0,2);
    });
  });
  return Object.keys(groups).map(k=>{const i=groups[k],studentCount=Object.keys(i.studentKeys).length;return {mission:i.mission,stageKey:i.stageKey,incidents:i.incidents,studentCount:studentCount,lesson:uxqActionLesson_(i.stageKey),prompt:uxqActionClassPrompt_(i.stageKey),examples:i.examples};}).sort((a,b)=>b.studentCount-a.studentCount || b.incidents-a.incidents || a.mission.localeCompare(b.mission));
}

function uxqActionLesson_(stage) {
  const map={
    evidence:'ทบทวนการเริ่มจากพฤติกรรมผู้ใช้ที่สังเกตได้ ไม่ใช่ความเห็นของทีม',
    hypothesis:'ทบทวนการเชื่อมหลักฐานกับสาเหตุ โดยไม่โทษผู้ใช้',
    fix:'ทบทวนการแยก “แก้ต้นเหตุ” ออกจาก “ทำหน้าจอดูดีขึ้น”',
    test:'ทบทวนว่าการทดสอบต้องวัดการทำงานสำเร็จและความเข้าใจ ไม่ใช่ความชอบอย่างเดียว',
    empathize:'ทบทวนการเก็บบริบทและพฤติกรรมก่อนรีบเลือกวิธีแก้',
    define:'ทบทวนการตั้งโจทย์ที่ระบุความต้องการและอุปสรรค โดยไม่ล็อกวิธีแก้',
    ideate:'ทบทวนแนวคิดที่ตอบความต้องการและยังตั้งสมมติฐานให้ทดสอบได้',
    prototype:'ทบทวนการทำต้นแบบเฉพาะลำดับการใช้งานที่เสี่ยงที่สุด',
    diagnose:'ทบทวนการแยกความยากที่จำเป็นของงาน ออกจากภาระที่หน้าจอสร้างเพิ่ม',
    prioritize:'ทบทวนการจัดลำดับให้สิ่งที่ต้องทำตอนนี้เด่นกว่าสิ่งรอง',
    reduce:'ทบทวนการจัดข้อมูลเป็นกลุ่ม ใช้ค่าเริ่มต้น และเปิดรายละเอียดเมื่อจำเป็น',
    validate:'ทบทวนการวัดความเข้าใจและความผิดพลาดควบคู่กับเวลา',
    process:'ทบทวนลำดับ หลักฐาน → ความต้องการ → ต้นแบบ → ทดสอบ',
    listen:'ทบทวนการฟังคำพูดผู้ใช้โดยไม่รีบตีความเป็นวิธีแก้',
    separate:'ทบทวนการแยกสิ่งที่เห็นจริงออกจากข้อสันนิษฐานของทีม',
    insight:'ทบทวนการสกัดความเข้าใจเชิงลึกจากพฤติกรรม ความรู้สึก และอุปสรรค'
  };
  return map[String(stage || '').toLowerCase()] || 'ทบทวนการเชื่อมคำตอบกับพฤติกรรมผู้ใช้และผลที่ต้องพิสูจน์';
}
function uxqActionClassPrompt_(stage) {
  const map={
    evidence:'ให้ทั้งห้องขีดเส้นใต้พฤติกรรมที่สังเกตได้ และบอกว่าหลักฐานนี้ตัดข้อสันนิษฐานใดทิ้ง',
    hypothesis:'ให้เปรียบ 2 สมมติฐาน แล้วอธิบายว่าหลักฐานเดียวกันสนับสนุนข้อใดมากกว่า',
    fix:'ให้จัดการ์ด “แก้สาเหตุ / แก้ปลายเหตุ / เพิ่มภาระ” ก่อนเลือกวิธีแก้',
    test:'ให้แก้แผนทดสอบที่วัดแค่ความชอบ ให้กลายเป็นงาน + ตัวชี้วัด + คำถามต่อยอด',
    define:'ให้เขียนโจทย์ใหม่จากโจทย์ที่ล็อกวิธีแก้ เป็นความต้องการผู้ใช้ + อุปสรรค',
    prototype:'ให้ลดต้นแบบที่ใหญ่เกินไปเหลือเส้นทางเดียวที่ตอบคำถามเสี่ยงที่สุด',
    diagnose:'ให้แยกบัตรข้อมูลเป็น “งานจำเป็น” กับ “ภาระที่หน้าจอสร้างเพิ่ม”',
    prioritize:'ให้เรียงการ์ดตามสิ่งที่ผู้ใช้ต้องทำตอนนี้ แล้วอธิบายเหตุผล',
    reduce:'ให้ยุบข้อมูลที่ไม่จำเป็นในจังหวะแรก และตัดสินใจว่าอะไรควรเปิดเมื่อผู้ใช้ขอดู',
    listen:'ให้แยกคำพูดผู้ใช้ออกจากวิธีแก้ที่ทีมเผลอเสนอ',
    separate:'ให้ติดป้าย “สิ่งที่เห็นจริง / ข้อสันนิษฐาน / วิธีแก้” ให้ข้อมูลแต่ละบัตร',
    insight:'ให้จับคู่พฤติกรรมกับแรงจูงใจหรืออุปสรรค แล้วเขียนประโยคความเข้าใจเชิงลึก 1 ประโยค'
  };
  return map[String(stage || '').toLowerCase()] || 'ให้ผู้เรียนอธิบายเหตุผลของตัวเลือกโดยอ้างพฤติกรรมผู้ใช้และผลที่คาดว่าจะเกิด';
}
function uxqActionFeedbackPrompt_(focus,latest) {
  const top=(focus || [])[0];
  if(!top) return 'ให้ผู้เรียนเลือก 1 คำตอบของตน แล้วอธิบายว่าพฤติกรรมผู้ใช้ใดทำให้คำตอบนั้นน่าเชื่อ';
  const stage=String(top.stageKey || 'reasoning');
  return 'ลองทบทวน “'+uxqActionStageName_(stage)+'”: '+uxqActionLesson_(stage);
}