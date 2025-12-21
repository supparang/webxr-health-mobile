// === /herohealth/vr/hha-summary.js ===
// Global End Summary Binder (IIFE)
// ✅ listens: hha:end
// ✅ shows #end-overlay and fills values
// ✅ grade: SSS, SS, S, A, B, C
// ✅ uses window.__GJ_QUEST_META__ if exists

(function(root){
  'use strict';

  const $ = (id)=>document.getElementById(id);
  const safeText = (el, v)=>{ try{ if (el) el.textContent = String(v ?? ''); }catch(_){ } };

  function gradeFrom(stats){
    const score = Number(stats.score||0);
    const miss  = Number(stats.misses||0);
    const combo = Number(stats.comboMax||0);
    const good  = Number(stats.goodHits||0);

    // โหดแบบเกมจริง: เน้น miss ต่ำ + combo สูง
    let pts = 0;
    pts += Math.min(60, score / 18);     // score weight
    pts += Math.min(25, combo * 1.6);    // combo weight
    pts += Math.min(20, good * 0.45);    // good weight
    pts -= Math.min(35, miss * 6.5);     // miss penalty

    // normalize
    const p = Math.max(0, Math.min(120, pts));

    if (p >= 105) return 'SSS';
    if (p >= 92)  return 'SS';
    if (p >= 80)  return 'S';
    if (p >= 62)  return 'A';
    if (p >= 44)  return 'B';
    return 'C';
  }

  function showSummary(stats){
    const overlay = $('end-overlay');
    if (!overlay) return;

    const meta = root.__GJ_QUEST_META__ || {};
    const goals = Number(meta.goalsCleared ?? stats.goalsCleared ?? 0) | 0;
    const minis = Number(meta.minisCleared ?? stats.minisCleared ?? 0) | 0;

    const grade = gradeFrom({ ...stats, goalsCleared:goals, minisCleared:minis });

    safeText($('end-grade'), `GRADE: ${grade}`);
    safeText($('end-score'), stats.score|0);
    safeText($('end-good'),  (stats.goodHits|0));
    safeText($('end-miss'),  (stats.misses|0));
    safeText($('end-combo'), (stats.comboMax|0));
    safeText($('end-goals'), goals);
    safeText($('end-minis'), minis);

    overlay.classList.add('show');

    const btnClose = $('end-close');
    const btnRestart = $('end-restart');

    if (btnClose && !btnClose.__bound){
      btnClose.__bound = true;
      btnClose.addEventListener('click', ()=>{
        overlay.classList.remove('show');
      });
    }

    if (btnRestart && !btnRestart.__bound){
      btnRestart.__bound = true;
      btnRestart.addEventListener('click', ()=>{
        // restart: reload same url (keeps query)
        try{ location.reload(); }catch(_){}
      });
    }
  }

  function bind(){
    if (bind.__done) return;
    bind.__done = true;

    root.addEventListener('hha:end', (e)=>{
      const d = e.detail || {};
      showSummary(d);
    });
  }

  // bind once
  try{ bind(); }catch(_){}
})(window);