
(function(){
  'use strict';

  const VERSION = 'v3.4.3-accuracy-payload-server';

  function numeric(v){
    if(v === null || v === undefined || v === '') return NaN;
    const n = Number(String(v).replace('%','').trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function accuracyFromRow(row){
    if(!row || typeof row !== 'object') return null;

    // 1) Use actual accuracy only if it exists and is meaningful.
    const directKeys = [
      'accuracy', 'Accuracy',
      'accuracyPct', 'accuracyPercent',
      'acc', 'Acc'
    ];
    for(const k of directKeys){
      const v = numeric(row[k]);
      if(Number.isFinite(v) && v > 0) return Math.round(v);
    }

    // 2) Compute only from correctness counts.
    const correct = numeric(
      row.correct ?? row.correctCount ?? row.correct_items ?? row.correctItems ?? row.correctAnswers
    );
    const total = numeric(
      row.total ?? row.totalCount ?? row.total_items ?? row.totalItems ?? row.questions ?? row.questionCount
    );

    if(Number.isFinite(correct) && Number.isFinite(total) && total > 0){
      return Math.round((correct / total) * 100);
    }

    // 3) Do NOT use score as accuracy. Score may include time/help/combo/bonus.
    return null;
  }

  function displayAccuracy(row){
    const acc = accuracyFromRow(row);
    return acc === null ? 'N/A' : String(acc);
  }

  function patchAttemptObjects(obj){
    if(!obj || typeof obj !== 'object') return 0;
    let patched = 0;

    function visit(x){
      if(!x || typeof x !== 'object') return;
      if(Array.isArray(x)){
        x.forEach(visit);
        return;
      }

      const looksAttempt =
        ('score' in x || 'Score' in x || 'stars' in x || 'Stars' in x || 'gate' in x || 'Gate' in x) &&
        ('time' in x || 'Time' in x || 'timestamp' in x || 'createdAt' in x || 'sessionId' in x || 'missionId' in x);

      if(looksAttempt){
        const acc = accuracyFromRow(x);
        if(acc === null){
          x.accuracyDisplay = 'N/A';
          x.accuracySource = 'missing-correct-total';
        }else{
          x.accuracy = acc;
          x.accuracyPct = acc;
          x.accuracyDisplay = String(acc);
          x.accuracySource = 'actual-or-correct-total';
        }
        patched++;
      }

      Object.keys(x).forEach(k => visit(x[k]));
    }

    visit(obj);
    return patched;
  }

  function patchGlobals(){
    let patched = 0;
    [
      'AIQUEST_TEACHER_DATA',
      'AIQUEST_TEACHER_CONSOLE_DATA',
      'AIQUEST_STUDENT_DETAIL_DATA',
      'teacherConsoleData',
      'studentDetailData',
      'lastTeacherConsole',
      'lastStudentDetail'
    ].forEach(name => {
      try{
        if(window[name]) patched += patchAttemptObjects(window[name]);
      }catch(e){}
    });
    return patched;
  }

  function patchAccuracyCells(){
    let changed = 0;
    const tables = Array.from(document.querySelectorAll('table'));
    tables.forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td'))
        .map(x => (x.innerText || x.textContent || '').trim().toLowerCase());

      const accIndex = headers.findIndex(x => x.includes('accuracy') || x.includes('ความถูก'));
      const scoreIndex = headers.findIndex(x => x.includes('score') || x.includes('คะแนน') || x.includes('best'));
      if(accIndex < 0) return;

      Array.from(table.querySelectorAll('tbody tr')).forEach(tr => {
        const cells = Array.from(tr.children);
        if(cells.length <= accIndex) return;

        const accText = (cells[accIndex].innerText || cells[accIndex].textContent || '').trim();
        const accVal = numeric(accText);

        /*
         * ถ้า accuracy เดิมเป็น 0 และไม่มีหลักฐาน correct/total ใน DOM
         * ห้ามเอา score มาแทน ให้แสดง N/A เพื่อความถูกต้องของรายงาน
         */
        if(!Number.isFinite(accVal) || accVal === 0){
          cells[accIndex].textContent = 'N/A';
          cells[accIndex].title = 'Accuracy ไม่มีข้อมูล correct/total จึงไม่ใช้ Score แทน';
          changed++;
        }
      });
    });
    return changed;
  }

  function refresh(){
    const patchedObjects = patchGlobals();
    const patchedCells = patchAccuracyCells();
    window.AIQUEST_TEACHER_ACCURACY_FIX.last = {
      at: new Date().toISOString(),
      patchedObjects,
      patchedCells,
      rule: 'accuracy = correct/total only; score is not used as fallback'
    };
    return window.AIQUEST_TEACHER_ACCURACY_FIX.last;
  }

  window.AIQUEST_TEACHER_ACCURACY_FIX = {
    version: VERSION,
    accuracyFromRow,
    displayAccuracy,
    patchAttemptObjects,
    patchAccuracyCells,
    refresh,
    last: null
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 300));
  }else{
    setTimeout(refresh, 300);
  }

  if(!window.__AIQUEST_TEACHER_ACCURACY_OBSERVER_V325){
    window.__AIQUEST_TEACHER_ACCURACY_OBSERVER_V325 = new MutationObserver(() => {
      clearTimeout(window.__AIQUEST_TEACHER_ACCURACY_TIMER_V325);
      window.__AIQUEST_TEACHER_ACCURACY_TIMER_V325 = setTimeout(refresh, 150);
    });
    window.__AIQUEST_TEACHER_ACCURACY_OBSERVER_V325.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_ACCURACY_FIX);
})();
