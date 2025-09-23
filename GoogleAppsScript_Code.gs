
/**
 * Google Apps Script — Health Game Cloud v3/v4 (Full)
 * Sheet: logs, students
 */
function doPost(e){
  var body = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = ss.getSheetByName('logs') || ss.insertSheet('logs');
  if(log.getLastRow()==0) log.appendRow(['ts','sid','name','classId','school','totals_json','games_json','badges_json']);
  log.appendRow([new Date(), body.sid, body.name, body.classId, body.school, JSON.stringify(body.totals), JSON.stringify(body.games), JSON.stringify(body.badges)]);
  var st = ss.getSheetByName('students') || ss.insertSheet('students');
  if(st.getLastRow()==0) st.appendRow(['sid','name','classId','school','points','comps','badgeBonus','games_json','badges_json','updated']);
  var map = {}; var vals=st.getDataRange().getValues(); for(var i=1;i<vals.length;i++){ map[String(vals[i][0])] = i+1; }
  var row = map[body.sid];
  var values = [body.sid, body.name, body.classId, body.school, body.totals.points||0, body.totals.comps||0, body.totals.badgeBonus||0, JSON.stringify(body.games), JSON.stringify(body.badges), new Date()];
  if(row){ st.getRange(row,1,1,values.length).setValues([values]); } else { st.appendRow(values); }
  return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var st = ss.getSheetByName('students'); if(!st) return out_({rows:[]});
  var data = st.getDataRange().getValues(); data.shift();
  var scope = (e.parameter.scope||'school').toLowerCase();
  if(scope==='student'){
    var sid = e.parameter.sid;
    var row = data.find(function(r){ return String(r[0])===String(sid); });
    if(!row) return out_({});
    return out_(rowToObj_(row,true));
  }
  var rows = data.map(function(row){ return rowToObj_(row,false); });
  if(scope==='class'){
    var classId = e.parameter.classId, school=e.parameter.school;
    rows = rows.filter(function(r){ return r.classId===classId && r.school===school; });
  }else if(scope==='school'){
    var school = e.parameter.school;
    rows = rows.filter(function(r){ return r.school===school; });
  }else if(scope==='district'){
    // no filter
  }
  rows.sort(function(a,b){ return (b.points||0)-(a.points||0); });
  return out_({rows:rows});
}
function rowToObj_(r, includeJson){
  var obj = { sid:r[0], name:r[1], classId:r[2], school:r[3], points:r[4], comps:r[5], badgeBonus:r[6] };
  if(includeJson){
    try{ obj.games = JSON.parse(r[7]); }catch(e){ obj.games={}; }
    try{ obj.badges= JSON.parse(r[8]); }catch(e){ obj.badges={}; }
    obj.totals={ points:r[4], comps:r[5], badgeBonus:r[6] };
  }
  return obj;
}
function out_(o){ return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
