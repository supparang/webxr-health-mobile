/* CSAI2601 UX Quest • Canonical Progress Sanitizer v1
 * Rewrites the replaceable local cache so official pass flags mirror
 * diagnostics.canonicalPassedMissionIds from Google Sheet only.
 */
(() => {
  'use strict';
  const VERSION='20260722-CANONICAL-PROGRESS-SANITIZER-V1';
  const ORDER=['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];

  function sanitize(result){
    if(!result?.ok||!window.UXQProgress)return null;
    const list=result?.diagnostics?.canonicalPassedMissionIds;
    if(!Array.isArray(list))return null;
    const passed=new Set(list.map(v=>String(v||'').trim().toLowerCase()).filter(id=>ORDER.includes(id)));
    const progress=window.UXQProgress.get();
    const missions=progress.missions||{};

    ORDER.forEach(id=>{
      const row=missions[id];
      if(!row)return;
      const official=passed.has(id);
      row.completed=official;
      row.passed=official;
      if(row.lastResult&&typeof row.lastResult==='object')row.lastResult.passed=official;
      row.sheetConfirmed=official;
      row.authority='google_sheet_canonical';
    });

    progress.missions=missions;
    const saved=window.UXQProgress.save(progress);
    window.UXQCanonicalPassedMissionIds=Array.from(passed);
    window.dispatchEvent(new CustomEvent('uxq-canonical-progress-sanitized',{detail:{version:VERSION,passed:Array.from(passed),progress:saved}}));
    return saved;
  }

  window.addEventListener('uxq-sheet-progress-restored',event=>sanitize(event.detail));
  window.addEventListener('uxq-mission-control-sheet-snapshot',event=>sanitize(event.detail?.snapshot));
  window.UXQCanonicalProgressSanitizer=Object.freeze({version:VERSION,sanitize});
})();