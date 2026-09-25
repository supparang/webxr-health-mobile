/**
 * UXQuestAnalyticsReceiverPatch-v4.gs
 * Paste into the PUBLIC Student Receiver Apps Script project.
 * This file does not declare doPost/doGet. Call UXQAR_tryHandle(payload)
 * from the existing receiver router before the normal mission_completed route.
 */
var UXQAR_VERSION='20260718-UXQAR-V4';
var UXQAR_TZ='Asia/Bangkok';

function UXQAR_tryHandle(payload){
  payload=payload||{};
  var type=String(payload.action||payload.event_type||'').toLowerCase();
  if(type==='uxq_item_response') return UXQAR_append_('UXQuest_Item_Responses',[
    'logged_at','attempt_id','event_id','participant_id','student_id','student_name','section','instructor','mission_id','boss_id','question_id','question_version','concept','difficulty_tag','option_order','selected_option','correct_option','is_correct','response_time_ms','reason_id','selected_reason','correct_reason','reason_correct','hint_used','retry_number','rapid_flag','source_url','game_version'
  ],payload);
  if(type==='uxq_reflection') return UXQAR_append_('UXQuest_Reflections',[
    'logged_at','attempt_id','participant_id','student_id','student_name','section','mission_id','problem_seen','ux_reason','fix_and_test','reflection_text','quality_auto','quality_teacher','quality_final','coder_note','version'
  ],payload);
  return null;
}

function UXQAR_append_(sheetName,headers,p){
  var lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    var ss=UXQAR_ss_();
    var sh=ss.getSheetByName(sheetName)||ss.insertSheet(sheetName);
    if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setFrozenRows(1);
    var logged=p.logged_at||Utilities.formatDate(new Date(),UXQAR_TZ,"yyyy-MM-dd'T'HH:mm:ssXXX");
    var row=headers.map(function(h){
      if(h==='logged_at')return logged;
      if(h==='version')return p.version||p.logger_version||UXQAR_VERSION;
      var v=p[h];
      if(v===undefined||v===null)return'';
      if(typeof v==='object')return JSON.stringify(v);
      return v;
    });
    sh.appendRow(row);
    return{ok:true,handled:true,type:p.action||p.event_type,sheet:sheetName,version:UXQAR_VERSION};
  }finally{lock.releaseLock();}
}
function UXQAR_ss_(){
  var id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(id)return SpreadsheetApp.openById(id);
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('Missing SPREADSHEET_ID and no active spreadsheet');
  return ss;
}

/* Existing doPost integration example:
function doPost(e){
  var p=JSON.parse((e.postData&&e.postData.contents)||'{}');
  var analytics=UXQAR_tryHandle(p);
  if(analytics) return ContentService.createTextOutput(JSON.stringify(analytics)).setMimeType(ContentService.MimeType.JSON);
  return EXISTING_UXQ_RECEIVER_HANDLER(p);
}
*/
