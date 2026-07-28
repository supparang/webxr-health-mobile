/* =========================================================
   EAP Word Quest • Official Name Lookup
   File: EAPWordQuestNameLookup.gs
   Version: 20260728-EAPWQ-NAME-LOOKUP-V1

   Depends on helper functions in EAPWordQuestAuthority.gs.
   Search is restricted to active students in Section 122.
========================================================= */

const EAPWQN_VERSION = '20260728-EAPWQ-NAME-LOOKUP-V1';
const EAPWQN_MAX_RESULTS = 8;
const EAPWQN_MIN_QUERY_LENGTH = 3;

function eapWordNameLookup_(params) {
  const p = params || {};
  const section = eapwqaSection_(p.section || p.group);
  const queryText = eapwqaText_(p.name || p.studentName || p.q || p.query);
  const queryKey = eapwqnNameKey_(queryText);

  if (section !== EAPWQA_GROUP) {
    return eapwqaFail_('section_not_allowed', {
      action:'eap_word_name_lookup',
      nameLookupVersion:EAPWQN_VERSION
    });
  }

  if (queryKey.length < EAPWQN_MIN_QUERY_LENGTH) {
    return eapwqaFail_('name_query_too_short', {
      action:'eap_word_name_lookup',
      minimumCharacters:EAPWQN_MIN_QUERY_LENGTH,
      nameLookupVersion:EAPWQN_VERSION
    });
  }

  const ss = eapwqaSpreadsheet_();
  const rosterSheet = eapwqaFindRosterSheet_(ss);
  if (!rosterSheet) {
    return eapwqaFail_('roster_not_ready', {
      action:'eap_word_name_lookup',
      expectedSheet:EAPWQA_ROSTER_SHEET,
      nameLookupVersion:EAPWQN_VERSION
    });
  }

  const rows = eapwqaObjects_(rosterSheet);
  if (!rows.length) {
    return eapwqaFail_('roster_empty', {
      action:'eap_word_name_lookup',
      rosterSheet:rosterSheet.getName(),
      nameLookupVersion:EAPWQN_VERSION
    });
  }

  const matches = rows.map(function(row) {
    const studentId = eapwqaStudentId_(eapwqaPick_(row, [
      'studentId','student_id','id','รหัสนักศึกษา','รหัส'
    ]));
    const studentName = eapwqaText_(eapwqaPick_(row, [
      'studentName','student_name','name','ชื่อ','ชื่อ-สกุล','ชื่อ นามสกุล'
    ]));
    const rowSection = eapwqaSection_(eapwqaPick_(row, [
      'section','group','class','กลุ่ม','หมู่เรียน'
    ]));
    const status = eapwqaText_(eapwqaPick_(row, [
      'status','active','สถานะ'
    ]) || 'active').toLowerCase();
    const nameKey = eapwqnNameKey_(studentName);
    const score = eapwqnMatchScore_(queryKey, nameKey);

    if (!studentId || !studentName || rowSection !== EAPWQA_GROUP) return null;
    if (['inactive','disabled','withdrawn','drop','0','false'].indexOf(status) >= 0) return null;
    if (score <= 0) return null;

    return {
      score:score,
      studentId:studentId,
      maskedStudentId:eapwqnMaskId_(studentId),
      studentName:studentName,
      section:EAPWQA_GROUP,
      status:status || 'active'
    };
  }).filter(Boolean).sort(function(a,b) {
    return b.score - a.score || a.studentName.localeCompare(b.studentName,'th');
  }).slice(0,EAPWQN_MAX_RESULTS).map(function(item) {
    return {
      studentId:item.studentId,
      maskedStudentId:item.maskedStudentId,
      studentName:item.studentName,
      section:item.section,
      status:item.status
    };
  });

  return {
    ok:true,
    action:'eap_word_name_lookup',
    official:true,
    authority:'google_sheet_roster',
    version:EAPWQA_VERSION,
    nameLookupVersion:EAPWQN_VERSION,
    query:queryText,
    count:matches.length,
    matches:matches,
    rosterSheet:rosterSheet.getName(),
    generatedAt:eapwqaNow_()
  };
}

function eapwqnNameKey_(value) {
  return eapwqaText_(value)
    .toLowerCase()
    .replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|miss|ms\.?)\s*/i,'')
    .replace(/[\s._\-–—/\\()\[\]{}]+/g,'');
}

function eapwqnMatchScore_(queryKey,nameKey) {
  if (!queryKey || !nameKey) return 0;
  if (nameKey === queryKey) return 100;
  if (nameKey.indexOf(queryKey) === 0) return 90;
  if (nameKey.indexOf(queryKey) >= 0) return 75;
  return 0;
}

function eapwqnMaskId_(studentId) {
  const id = eapwqaStudentId_(studentId);
  if (id.length <= 6) return id;
  return id.slice(0,4) + '••••' + id.slice(-2);
}
