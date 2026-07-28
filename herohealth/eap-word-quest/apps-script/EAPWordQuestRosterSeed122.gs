/* =========================================================
   EAP Word Quest • Official Roster Seed • Section 122
   Version: 20260728-EAPWQ-ROSTER-23-V2-TIMEOUT-SAFE

   Run EAPWQ_AUTHORITY_installPhase12() once after adding all
   Apps Script files. The installer:
   - retries transient Spreadsheet service timeouts
   - opens the spreadsheet only once
   - creates/repairs the roster sheet
   - writes the full roster in one batch
   - is idempotent by studentId
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
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = eapwqaInstallSpreadsheet_();
    const sh = eapwqaInstallEnsureRosterSheet_(ss);
    const seed = eapwqaInstallSeedRoster_(sh);
    return {
      ok:true,
      version:'20260728-EAPWQ-ROSTER-23-V2-TIMEOUT-SAFE',
      spreadsheetId:ss.getId(),
      rosterSheet:sh.getName(),
      seed:seed,
      nextStep:'Deploy > Manage deployments > Edit > New version, then test eap_word_authority_health.'
    };
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function EAPWQ_AUTHORITY_seedOfficialRoster122() {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = eapwqaInstallSpreadsheet_();
    const sh = eapwqaInstallEnsureRosterSheet_(ss);
    return eapwqaInstallSeedRoster_(sh);
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function eapwqaInstallSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = String(props.getProperty('EAPWQ_SPREADSHEET_ID') || '').trim();
  const ss = eapwqaInstallRetry_('open spreadsheet', function() {
    return savedId ? SpreadsheetApp.openById(savedId) : SpreadsheetApp.getActiveSpreadsheet();
  }, 5);
  if (!ss) throw new Error('EAP Word Quest spreadsheet is unavailable. Open this Apps Script from the target Google Sheet and run again.');
  if (!savedId) {
    eapwqaInstallRetry_('save spreadsheet id', function() {
      props.setProperty('EAPWQ_SPREADSHEET_ID', ss.getId());
      return true;
    }, 3);
  }
  return ss;
}

function eapwqaInstallEnsureRosterSheet_(ss) {
  let sh = eapwqaInstallRetry_('find roster sheet', function() {
    return ss.getSheetByName(EAPWQA_ROSTER_SHEET);
  }, 5);

  if (!sh) {
    sh = eapwqaInstallRetry_('create roster sheet', function() {
      return ss.insertSheet(EAPWQA_ROSTER_SHEET);
    }, 5);
  }

  const dimensions = eapwqaInstallRetry_('inspect roster sheet', function() {
    return {
      lastRow:sh.getLastRow(),
      lastColumn:Math.max(1,sh.getLastColumn())
    };
  }, 5);

  if (dimensions.lastRow === 0) {
    eapwqaInstallRetry_('write roster headers', function() {
      sh.getRange(1,1,1,EAPWQA_ROSTER_HEADERS.length).setValues([EAPWQA_ROSTER_HEADERS]);
      SpreadsheetApp.flush();
      return true;
    }, 5);
  } else {
    const current = eapwqaInstallRetry_('read roster headers', function() {
      return sh.getRange(1,1,1,dimensions.lastColumn).getValues()[0].map(function(value) {
        return String(value == null ? '' : value).trim();
      });
    }, 5);
    const next = current.slice();
    EAPWQA_ROSTER_HEADERS.forEach(function(header) {
      if (next.indexOf(header) < 0) next.push(header);
    });
    if (next.length !== current.length) {
      eapwqaInstallRetry_('repair roster headers', function() {
        sh.getRange(1,1,1,next.length).setValues([next]);
        SpreadsheetApp.flush();
        return true;
      }, 5);
    }
  }

  try { sh.setFrozenRows(1); } catch (ignore) {}
  return sh;
}

function eapwqaInstallSeedRoster_(sh) {
  const meta = eapwqaInstallRetry_('read roster dimensions', function() {
    return {
      width:Math.max(sh.getLastColumn(),EAPWQA_ROSTER_HEADERS.length),
      lastRow:sh.getLastRow()
    };
  }, 5);

  const headers = eapwqaInstallRetry_('read roster headers for seed', function() {
    return sh.getRange(1,1,1,meta.width).getValues()[0].map(function(value) {
      return String(value == null ? '' : value).trim();
    });
  }, 5);

  const index = {};
  headers.forEach(function(header,i) {
    index[String(header || '').toLowerCase().replace(/[\s_\-]+/g,'')] = i;
  });

  const required = ['studentId','studentName','section','status','email','updatedAt','note'];
  required.forEach(function(header) {
    const key = String(header).toLowerCase().replace(/[\s_\-]+/g,'');
    if (index[key] == null) throw new Error('Missing roster header: ' + header);
  });

  const existing = meta.lastRow > 1
    ? eapwqaInstallRetry_('read existing roster', function() {
        return sh.getRange(2,1,meta.lastRow - 1,meta.width).getValues();
      }, 5)
    : [];

  const output = existing.map(function(row) {
    const copy = row.slice();
    while (copy.length < meta.width) copy.push('');
    return copy;
  });
  const rowById = {};
  output.forEach(function(row,rowIndex) {
    const raw = row[index['studentid']];
    const id = String(raw == null ? '' : raw).replace(/\.0$/,'').replace(/\s+/g,'');
    if (id && rowById[id] == null) rowById[id] = rowIndex;
  });

  let inserted = 0;
  let updated = 0;
  const now = Utilities.formatDate(new Date(),'Asia/Bangkok',"yyyy-MM-dd'T'HH:mm:ssXXX");

  EAPWQA_OFFICIAL_ROSTER_122.forEach(function(item) {
    const studentId = item[0];
    const studentName = item[1];
    let rowIndex = rowById[studentId];
    let row;

    if (rowIndex == null) {
      row = new Array(meta.width).fill('');
      rowIndex = output.length;
      output.push(row);
      rowById[studentId] = rowIndex;
      inserted += 1;
    } else {
      row = output[rowIndex];
      updated += 1;
    }

    row[index['studentid']] = studentId;
    row[index['studentname']] = studentName;
    row[index['section']] = '122';
    row[index['status']] = 'active';
    row[index['updatedat']] = now;
    row[index['note']] = 'Official Section 122 roster';
  });

  if (output.length) {
    eapwqaInstallRetry_('write official roster batch', function() {
      sh.getRange(2,1,output.length,meta.width).setValues(output);
      SpreadsheetApp.flush();
      return true;
    }, 5);
  }

  return {
    ok:true,
    version:'20260728-EAPWQ-ROSTER-23-V2-TIMEOUT-SAFE',
    sheet:sh.getName(),
    officialStudents:EAPWQA_OFFICIAL_ROSTER_122.length,
    inserted:inserted,
    updated:updated,
    totalRows:output.length,
    generatedAt:now
  };
}

function eapwqaInstallRetry_(label,operation,maxAttempts) {
  const attempts = Math.max(1,Number(maxAttempts || 4));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      const message = String(error && error.message || error);
      const transient = /timed out|service spreadsheets|internal error|try again|rate limit|temporarily unavailable/i.test(message);
      if (!transient || attempt >= attempts) {
        throw new Error(label + ' failed: ' + message);
      }
      Utilities.sleep(Math.min(8000,600 * Math.pow(2,attempt - 1)));
    }
  }

  throw lastError || new Error(label + ' failed');
}
