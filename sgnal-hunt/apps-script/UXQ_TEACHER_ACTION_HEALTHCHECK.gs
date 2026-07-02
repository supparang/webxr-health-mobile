/* UX Quest • Teacher Action Dashboard Health Check
 * Run uxqTeacherActionHealthCheck() in Apps Script after pasting the dashboard patches.
 * This function is read-only and does not edit Sheets, scores, or learner data.
 */

function uxqTeacherActionHealthCheck() {
  const result = {
    ok: true,
    checkedAt: new Date().toISOString(),
    checks: [],
    preview: null
  };

  function check(name, passed, detail) {
    result.checks.push({ name: name, passed: Boolean(passed), detail: String(detail || '') });
    if (!passed) result.ok = false;
  }

  check('ฟังก์ชันข้อมูลครูหลัก', typeof uxqGetTeacherView === 'function',
    'ต้องมี uxqGetTeacherView() จาก UXQ_ANTI_GUESS_DASHBOARD_PATCH.gs');
  check('ฟังก์ชันแดชบอร์ดการสอน', typeof uxqGetTeacherActionView === 'function',
    'ต้องมี uxqGetTeacherActionView() จาก UXQ_TEACHER_ACTION_DASHBOARD_PATCH.gs');
  check('ฟังก์ชันชื่อภารกิจไทย', typeof uxqActionMissionName_ === 'function',
    'ต้องมีการแมปชื่อ W1–W4 และ B1 เป็นไทย');
  check('ฟังก์ชันชื่อขั้นไทย', typeof uxqActionStageName_ === 'function',
    'ต้องมีการแมป stage ของ W4: listen, separate, insight');

  if (typeof uxqActionMissionName_ === 'function') {
    const expected = {
      w1: 'W1 • นักสืบปัญหา UX',
      w2: 'W2 • คิดเชิงออกแบบ',
      w3: 'W3 • ลดภาระความคิด',
      b1: 'B1 • บอสพายุความสับสน',
      w4: 'W4 • ห้องแล็บถอดรหัสผู้ใช้'
    };
    Object.keys(expected).forEach(id => {
      check('ชื่อภารกิจ ' + id, uxqActionMissionName_(id) === expected[id], uxqActionMissionName_(id));
    });
  }

  if (typeof uxqActionStageName_ === 'function') {
    const expected = { listen:'ฟังสัญญาณผู้ใช้', separate:'แยกสิ่งที่เห็นจริง', insight:'สกัดความเข้าใจเชิงลึก' };
    Object.keys(expected).forEach(id => {
      check('ชื่อขั้น W4: ' + id, uxqActionStageName_(id) === expected[id], uxqActionStageName_(id));
    });
  }

  if (typeof uxqGetTeacherActionView === 'function') {
    try {
      const view = uxqGetTeacherActionView();
      result.preview = {
        students: Number(view && view.summary && view.summary.students || 0),
        needsHelp: Number(view && view.summary && view.summary.needsHelp || 0),
        classPatterns: Number(view && view.summary && view.summary.classPatterns || 0),
        stretchReady: Number(view && view.summary && view.summary.stretchReady || 0)
      };
      check('สร้างข้อมูลแดชบอร์ด', Boolean(view && view.summary && Array.isArray(view.students)), 'สร้างข้อมูลสำเร็จ');
    } catch (error) {
      check('สร้างข้อมูลแดชบอร์ด', false, error && error.message ? error.message : error);
    }
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
