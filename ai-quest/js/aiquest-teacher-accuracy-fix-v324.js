
(function(){
  'use strict';

  const VERSION = 'v3.2.4-teacher-accuracy-fix';

  function num(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function bestAccuracyFromRow(row){
    if(!row || typeof row !== 'object') return 0;

    const directKeys = [
      'accuracy', 'Accuracy', 'acc', 'Acc',
      'accuracyPct', 'accuracyPercent', 'percent', 'percentage'
    ];

    for(const k of directKeys){
      if(row[k] !== undefined && row[k] !== null && row[k] !== ''){
        const v = num(row[k], 0);
        if(v > 0) return Math.round(v);
      }
    }

    const correct = num(row.correct ?? row.correctCount ?? row.correct_items ?? row.correctItems, NaN);
    const total = num(row.total ?? row.totalCount ?? row.total_items ?? row.totalItems ?? row.questions, NaN);
    if(Number.isFinite(correct) && Number.isFinite(total) && total > 0){
      return Math.round((correct / total) * 100);
    }

    const score = num(row.score ?? row.Score ?? row.best ?? row.Best ?? row.latestScore, 0);
    if(score > 0) return Math.round(score);

    return 0;
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
        const acc = bestAccuracyFromRow(x);
        if(acc > 0 && (!Number(x.accuracy) || Number(x.accuracy) === 0)){
          x.accuracy = acc;
          x.accuracyPct = acc;
          patched++;
        }
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
      const ths = Array.from(table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')).map(x => (x.innerText || x.textContent || '').trim().toLowerCase());
      const accIndex = ths.findIndex(x => x.includes('accuracy') || x.includes('ความถูก'));
      const scoreIndex = ths.findIndex(x => x.includes('score') || x.includes('คะแนน') || x.includes('best'));
      if(accIndex < 0 || scoreIndex < 0) return;

      Array.from(table.querySelectorAll('tbody tr')).forEach(tr => {
        const cells = Array.from(tr.children);
        if(cells.length <= Math.max(accIndex, scoreIndex)) return;
        const accText = (cells[accIndex].innerText || cells[accIndex].textContent || '').trim();
        const scoreText = (cells[scoreIndex].innerText || cells[scoreIndex].textContent || '').trim();
        const accVal = Number(accText.replace('%',''));
        const scoreVal = Number(scoreText.replace('%',''));
        if((!Number.isFinite(accVal) || accVal === 0) && Number.isFinite(scoreVal) && scoreVal > 0){
          cells[accIndex].textContent = String(Math.round(scoreVal));
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
      patchedCells
    };
    return window.AIQUEST_TEACHER_ACCURACY_FIX.last;
  }

  window.AIQUEST_TEACHER_ACCURACY_FIX = {
    version: VERSION,
    bestAccuracyFromRow,
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

  if(!window.__AIQUEST_TEACHER_ACCURACY_OBSERVER_V324){
    window.__AIQUEST_TEACHER_ACCURACY_OBSERVER_V324 = new MutationObserver(() => {
      clearTimeout(window.__AIQUEST_TEACHER_ACCURACY_TIMER_V324);
      window.__AIQUEST_TEACHER_ACCURACY_TIMER_V324 = setTimeout(refresh, 150);
    });
    window.__AIQUEST_TEACHER_ACCURACY_OBSERVER_V324.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }

  console.log('[AIQuest] '+VERSION+' loaded', window.AIQUEST_TEACHER_ACCURACY_FIX);
})();
