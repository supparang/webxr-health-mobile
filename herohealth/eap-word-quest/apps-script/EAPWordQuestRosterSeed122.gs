/* =========================================================
   EAP Word Quest • Official Roster Seed • Section 122
   Version: 20260728-EAPWQ-ROSTER-23-V1

   Run EAPWQ_AUTHORITY_installPhase12() once after adding all
   Apps Script files. The function is idempotent and upserts by studentId.
========================================================= */

const EAPWQA_OFFICIAL_ROSTER_122 = [
  ['6811500542','นายรณชัย ตู้โภค'],
  ['6811501326','นายกานต์กวิน สมนาม'],
  ['6811503355','นางสาวณัฐธยาน์ จุ่นสำราญ'],
  ['6811503751','นายดิฐวัต คำประเสริฐ'],
  ['6811503769','นายอนรรฆ ใจฟู'],
  ['6811504221','นายสุทธินนท์ บุญส่ง'],
  ['6811504460','นายสุวพิชญ์ บรรจง'],
  ['6811505848','นายสรวิชญ์ สร้อยทอง'],
  ['6811507679','นางสาวดลญชนก สุขทั่วญาติ'],
  ['6811507935','นายปัณณวัฒน์ ไชยวรรัตน์'],
  ['6811509436','นายเวทพิสิฐ วงศ์ทิพย์สถาน'],
  ['6811511390','นายพีระพัฒน์ นารอด'],
  ['6811511408','นายพีรพล บุญส่ง'],
  ['6811511424','นายณัฐรัตน์ เศรษฐี'],
  ['6811511465','นายปัณณธร สงหลำ'],
  ['6811511473','นายปัณณวัฒน์ วรรณสา'],
  ['6811512109','นาย ศิณะ ม่วงเกตุ'],
  ['6811512125','นายภูริภัทร์ ยศวิมล'],
  ['6811512414','นางสาวญาศินันท์ ทรัพย์สมาน'],
  ['6811512653','นายบุญญฤทธิ์ แสงธนู'],
  ['6811512927','นายอกนิษฐ์ นิลดำ'],
  ['6811513669','นางสาวเนตรชนก ลำธาร'],
  ['6811514485','นายพลพล วิชาธรรม']
];

function EAPWQ_AUTHORITY_installPhase12() {
  const setup = EAPWQ_AUTHORITY_setup();
  const seed = EAPWQ_AUTHORITY_seedOfficialRoster122();
  return {
    ok:Boolean(setup && setup.ok && seed && seed.ok),
    setup:setup,
    seed:seed,
    nextStep:'Deploy > Manage deployments > Edit > New version, then test eap_word_authority_health.'
  };
}

function EAPWQ_AUTHORITY_seedOfficialRoster122() {
  const ss = eapwqaSpreadsheet_();
  const sh = eapwqaEnsureSheet_(ss,EAPWQA_ROSTER_SHEET,EAPWQA_ROSTER_HEADERS);
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const width = Math.max(sh.getLastColumn(),EAPWQA_ROSTER_HEADERS.length);
    const headers = sh.getRange(1,1,1,width).getValues()[0].map(eapwqaText_);
    const index = {};
    headers.forEach(function(header,i) { index[eapwqaKey_(header)] = i; });
    const required = ['studentId','studentName','section','status','email','updatedAt','note'];
    required.forEach(function(header) {
      if (index[eapwqaKey_(header)] == null) throw new Error('Missing roster header: ' + header);
    });

    const lastRow = sh.getLastRow();
    const existing = lastRow > 1 ? sh.getRange(2,1,lastRow - 1,width).getValues() : [];
    const rowById = {};
    existing.forEach(function(row,rowIndex) {
      const id = eapwqaStudentId_(row[index[eapwqaKey_('studentId')]]);
      if (id) rowById[id] = rowIndex;
    });

    let inserted = 0;
    let updated = 0;
    const now = eapwqaNow_();
    EAPWQA_OFFICIAL_ROSTER_122.forEach(function(item) {
      const studentId = item[0];
      const studentName = item[1];
      const values = new Array(width).fill('');
      values[index[eapwqaKey_('studentId')]] = studentId;
      values[index[eapwqaKey_('studentName')]] = studentName;
      values[index[eapwqaKey_('section')]] = EAPWQA_GROUP;
      values[index[eapwqaKey_('status')]] = 'active';
      values[index[eapwqaKey_('updatedAt')]] = now;
      values[index[eapwqaKey_('note')]] = 'Official Section 122 roster';

      if (rowById[studentId] == null) {
        sh.appendRow(values);
        inserted += 1;
      } else {
        const targetRow = rowById[studentId] + 2;
        const old = existing[rowById[studentId]].slice();
        old[index[eapwqaKey_('studentName')]] = studentName;
        old[index[eapwqaKey_('section')]] = EAPWQA_GROUP;
        old[index[eapwqaKey_('status')]] = 'active';
        old[index[eapwqaKey_('updatedAt')]] = now;
        old[index[eapwqaKey_('note')]] = 'Official Section 122 roster';
        sh.getRange(targetRow,1,1,width).setValues([old]);
        updated += 1;
      }
    });

    sh.setFrozenRows(1);
    sh.autoResizeColumns(1,Math.min(width,7));
    return {
      ok:true,
      version:'20260728-EAPWQ-ROSTER-23-V1',
      sheet:sh.getName(),
      officialStudents:EAPWQA_OFFICIAL_ROSTER_122.length,
      inserted:inserted,
      updated:updated,
      generatedAt:now
    };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}
