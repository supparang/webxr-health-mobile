/**
 * CSAI2102 Coding Status Repair v3.1.2
 * Add this file to the same Apps Script project after AIQuestCoding_Receiver.gs.
 * It replaces only GET_CODING_STATUS/AUDIT_CODING_STATUS lookup behavior.
 * No doGet/doPost declarations.
 */
(function(root){
  'use strict';

  var Q = root.AIQCODING = root.AIQCODING || {};
  Q.STATUS_REPAIR_VERSION = '20260727-AIQ-CODING-STATUS-REPAIR-V3.1.2';

  function text(v){ return String(v == null ? '' : v).trim(); }
  function key(v){ return text(v).toLowerCase().replace(/[^a-z0-9]/g,''); }
  function number(v){ var n=Number(v); return isFinite(n) ? n : 0; }
  function truth(v){
    return v === true || [
      'true','1','yes','y','pass','passed','complete','completed','mastered','submitted'
    ].indexOf(text(v).toLowerCase()) >= 0;
  }
  function student(v){
    var s=text(v).replace(/^['\s]+|['\s]+$/g,'');
    if (/^\d+\.0+$/.test(s)) s=s.replace(/\.0+$/,'');
    return s;
  }
  function section(v){
    var s=text(v).replace(/^['\s]+|['\s]+$/g,'');
    if (!s) return '101';
    if (/^\d+\.0+$/.test(s)) s=s.replace(/\.0+$/,'');
    if (/^\d+$/.test(s)) s=String(Number(s));
    return s;
  }
  function session(v){
    var s=text(v).toUpperCase().replace(/[\s_:\-]+/g,'');
    var m=s.match(/^(?:MISSION|SESSION|M)?(S?(?:[1-9]|1[0-5])|B[1-5])$/);
    if (!m) return '';
    s=m[1];
    if (/^\d+$/.test(s)) s='S'+s;
    return s;
  }
  function pick(row,names){
    for (var i=0;i<names.length;i++) {
      var n=names[i];
      if (row[n] !== undefined && text(row[n]) !== '') return row[n];
      var k=key(n);
      if (row[k] !== undefined && text(row[k]) !== '') return row[k];
    }
    return '';
  }
  function objectRows(sh){
    if (!sh || sh.getLastRow()<2 || sh.getLastColumn()<1) return [];
    var values=sh.getDataRange().getDisplayValues();
    var headers=values[0].map(text);
    return values.slice(1).filter(function(r){
      return r.some(function(v){ return text(v)!==''; });
    }).map(function(r,idx){
      var o={_sheet:sh.getName(),_row:idx+2};
      headers.forEach(function(h,i){
        if (!h) return;
        o[h]=r[i];
        o[key(h)]=r[i];
      });
      return o;
    });
  }
  function looksCodingSheet(sh){
    if (!sh || sh.getLastColumn()<1) return false;
    var hs=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(key);
    var hasStudent=hs.some(function(h){return ['studentid','student','pid'].indexOf(h)>=0;});
    var hasSession=hs.some(function(h){return ['sessionid','session','missionid','mission'].indexOf(h)>=0;});
    var hasEvidence=hs.some(function(h){
      return [
        'codingscore','completedcode','modifiedcode','challengecode','predictionsanswer',
        'predictionanswer','validationmode','codingcompleted','quizscore','runscore','modifyscore'
      ].indexOf(h)>=0;
    });
    var name=sh.getName().toLowerCase();
    return (hasStudent && hasSession && hasEvidence) || /coding/.test(name);
  }
  function allRows(){
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('SPREADSHEET_NOT_FOUND');
    var out=[];
    ss.getSheets().forEach(function(sh){
      if (looksCodingSheet(sh)) out=out.concat(objectRows(sh));
    });
    return out;
  }
  function identity(row){
    return {
      studentId:student(pick(row,['student_id','studentId','studentid','id','pid'])),
      studentName:text(pick(row,['student_name','studentName','studentname','name','nickname'])),
      section:section(pick(row,['section','section_id','sectionId','class_section'])),
      sessionId:session(pick(row,['session_id','sessionId','session','mission_id','missionId','mission']))
    };
  }
  function score(row){
    var direct=pick(row,['coding_score','codingScore','best_score','bestScore','score','total_score','totalScore']);
    if (text(direct)!=='') return number(direct);
    return number(pick(row,['run_score','runScore']))+
      number(pick(row,['modify_score','modifyScore']))+
      number(pick(row,['challenge_score','challengeScore']))+
      Math.min(20,number(pick(row,['quiz_score','quizScore']))*4);
  }
  function complete(row){
    return score(row)>=60 || truth(pick(row,[
      'completed','passed','mastered','status','coding_completed','codingCompleted'
    ]));
  }
  function submittedAt(row){
    return text(pick(row,[
      'submitted_at','submittedAt','serverTs','clientTs','timestamp','created_at','createdAt','updatedAt'
    ]));
  }
  function same(row,target){
    var x=identity(row);
    return x.studentId===target.studentId &&
      x.section===target.section &&
      x.sessionId===target.sessionId;
  }
  function candidateDebug(rows,target){
    return rows.map(function(r){
      var x=identity(r);
      return {
        sheet:r._sheet,row:r._row,studentId:x.studentId,studentName:x.studentName,
        section:x.section,sessionId:x.sessionId,score:score(r),completed:complete(r)
      };
    }).filter(function(x){
      return x.studentId===target.studentId ||
        (target.studentName && x.studentName.toLowerCase()===target.studentName.toLowerCase()) ||
        x.sessionId===target.sessionId;
    }).slice(0,40);
  }

  Q.getStatus_ = function(payload){
    payload=payload||{};
    var target={
      studentId:student(payload.studentId),
      studentName:text(payload.studentName),
      section:section(payload.section||'101'),
      sessionId:session(payload.sessionId||payload.missionId)
    };
    if (!target.studentId || !target.sessionId) {
      return {ok:false,code:'MISSING_STATUS_IDENTITY',target:target,version:Q.STATUS_REPAIR_VERSION};
    }

    var rows=allRows();
    var matches=rows.filter(function(r){return same(r,target);});
    matches.sort(function(a,b){return submittedAt(a).localeCompare(submittedAt(b));});

    var bestScore=0,completed=false,sources={},latest=matches.length?matches[matches.length-1]:null;
    matches.forEach(function(r){
      bestScore=Math.max(bestScore,score(r));
      completed=completed||complete(r);
      sources[r._sheet]=true;
    });

    return {
      ok:true,
      action:'GET_CODING_STATUS',
      studentId:target.studentId,
      studentName:target.studentName,
      section:target.section,
      sessionId:target.sessionId,
      found:matches.length>0,
      completed:completed||bestScore>=60,
      latestScore:latest?score(latest):0,
      bestScore:bestScore,
      attemptCount:matches.length,
      latestAttempt:matches.length,
      submittedAt:latest?submittedAt(latest):'',
      sourceSheets:Object.keys(sources),
      scannedCodingRows:rows.length,
      authority:'Google Sheet coding evidence, exact normalized student ID',
      version:Q.STATUS_REPAIR_VERSION
    };
  };

  Q.auditStatus_ = function(payload){
    var result=Q.getStatus_(payload);
    var rows=allRows();
    var target={
      studentId:student(payload&&payload.studentId),
      studentName:text(payload&&payload.studentName),
      section:section(payload&&payload.section||'101'),
      sessionId:session(payload&&(payload.sessionId||payload.missionId))
    };
    result.debug={
      target:target,
      scannedSheets:SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(looksCodingSheet).map(function(sh){return sh.getName();}),
      totalCodingRows:rows.length,
      nearMatches:candidateDebug(rows,target)
    };
    return result;
  };

  var previousHandle=Q.handle;
  Q.handle=function(payload){
    var action=text((payload||{}).action).toUpperCase();
    if(action==='GET_CODING_STATUS') return Q.getStatus_(payload);
    if(action==='AUDIT_CODING_STATUS') return Q.auditStatus_(payload);
    return typeof previousHandle==='function' ? previousHandle(payload) : {
      ok:false,code:'UNKNOWN_CODING_ACTION',action:action,version:Q.STATUS_REPAIR_VERSION
    };
  };

  root.TEST_AIQCODING_S2_KK_V312=function(){
    var result=Q.auditStatus_({studentId:'12',studentName:'KK',section:'101',sessionId:'S2'});
    Logger.log(JSON.stringify(result));
    return result;
  };
})(this);
