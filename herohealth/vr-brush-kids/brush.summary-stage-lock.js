/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.summary-stage-lock.js
 * PATCH v20260513-P46-BRUSH-KIDS-SUMMARY-STAGE-LOCK
 *
 * Purpose:
 * - กัน Summary/Compact Summary โผล่ในหน้า Prep / Howto / Gameplay
 * - ลบ card "เยี่ยมมาก!" ที่ค้างผิดจังหวะ
 * - อนุญาตให้ Summary แสดงเฉพาะหลังจบเกมจริงเท่านั้น
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const PATCH_ID = 'v20260513-P46-BRUSH-KIDS-SUMMARY-STAGE-LOCK';

  const SUMMARY_ARTIFACTS = [
    '#hha-brush-compact-override-card',
    '#hha-brush-compact-override-actions',
    '#hha-brush-compact-card',
    '#hha-brush-compact-actions',
    '#hha-brush-summary-final-card',
    '#hha-brush-summary-final-actions-clean',
    '#hha-summary-mount-rescue-card',
    '#hha-summary-mount-rescue-actions',
    '#hha-summary-restore-card',
    '#hha-summary-restore-actions',
    '#hha-summary-authority-surface-card',
    '#hha-summary-authority-actions',
    '#hha-summary-repair-surface-card',
    '#hha-brush-summary-bridge-note',
    '#hha-brush-boss-gate-card',
    '#hha-boss-compact-card'
  ];

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
  }

  function cleanTextWithoutInjectedSummary(){
    /*
     * สำคัญ:
     * ห้ามให้ข้อความจาก card ที่เรา inject เอง เช่น "เยี่ยมมาก!"
     * มาหลอกตัวตรวจว่าเป็น Summary
     */
    let clone = null;

    try{
      clone = DOC.body.cloneNode(true);
    }catch(_){
      return text();
    }

    SUMMARY_ARTIFACTS.forEach(sel => {
      try{
        clone.querySelectorAll(sel).forEach(el => el.remove());
      }catch(_){}
    });

    try{
      clone.querySelectorAll('[data-compact-hidden="1"],[data-boss-compact="1"]').forEach(el => el.remove());
    }catch(_){}

    return text(clone);
  }

  function getTopMetrics(){
    const t = cleanTextWithoutInjectedSummary();

    function first(re, fallback){
      const m = t.match(re);
      return m ? Number(m[1]) || 0 : (fallback || 0);
    }

    const score = first(/คะแนน\s*[\r\n\s:]*([0-9]+)/i, 0);
    const combo = first(/Combo\s*[\r\n\s:]*([0-9]+)/i, 0);
    const clean = first(/Clean\s*[\r\n\s:]*([0-9]+)\s*%/i, 0);
    const plaque = first(/Plaque\s*[\r\n\s:]*([0-9]+)\s*%/i, 100);

    const zoneMatch =
      t.match(/Zone\s*[\r\n\s]*([0-9]+)\s*\/\s*([0-9]+)/i) ||
      t.match(/แปรงครบ\s*:?\s*([0-9]+)\s*\/\s*([0-9]+)/i);

    const zoneDone = zoneMatch ? Number(zoneMatch[1]) || 0 : 0;
    const zoneTotal = zoneMatch ? Number(zoneMatch[2]) || 6 : 6;

    return { score, combo, clean, plaque, zoneDone, zoneTotal };
  }

  function looksLikePrepOrHowto(){
    const t = cleanTextWithoutInjectedSummary();

    if(/พร้อมแปรงฟัน|เริ่มแปรงฟัน|พร้อมแล้ว ไปเล่นจริง|เข้าเกมเลย/i.test(t)) return true;
    if(/วิธีเล่น|แนวคิด simulation|ลายยาสีฟัน|ลองใส่ใหม่|Prep|ยังไม่ได้ใส่ยาสีฟัน/i.test(t)) return true;
    if(/แปรงฟันให้ครบทุกโซน|เห็นตำแหน่งจริงในช่องปาก/i.test(t)) return true;

    const m = getTopMetrics();

    /*
     * หน้าเริ่มเกม/Prep มักเป็น 0,0,0,100,0/6
     */
    if(
      m.score <= 0 &&
      m.combo <= 0 &&
      m.clean <= 0 &&
      m.plaque >= 90 &&
      m.zoneDone <= 0
    ){
      return true;
    }

    return false;
  }

  function hasRealEndMarkers(){
    const t = cleanTextWithoutInjectedSummary();

    /*
     * ต้องเป็น marker หลังจบจริง ไม่ใช่คำจาก HUD หรือการ์ดที่ inject เอง
     */
    return (
      /Replay Challenge|Best Score|Best Clean|Tooth Pet Rescue/i.test(t) ||
      /Boss\s*:\s*(ชนะแล้ว|แพ้|ยังไม่ชนะ)/i.test(t) ||
      /Surface Mastery\s*:\s*[0-9]+\s*%/i.test(t) ||
      /Clean Teeth\s*:\s*[0-9]+\s*%/i.test(t)
    );
  }

  function shouldAllowSummary(){
    const run = String(param('run','')).toLowerCase();
    const stage = String(param('stage','')).toLowerCase();
    const phase = String(param('phase','')).toLowerCase();

    if(phase === 'warmup' || phase === 'cooldown') return false;
    if(stage === 'prep' || stage === 'howto' || stage === 'practice') return false;
    if(run === 'prep' || run === 'howto' || run === 'practice' || run === 'warmup') return false;

    if(looksLikePrepOrHowto()) return false;

    return hasRealEndMarkers();
  }

  function removeSummaryArtifacts(){
    SUMMARY_ARTIFACTS.forEach(sel => {
      try{
        DOC.querySelectorAll(sel).forEach(el => {
          try{ el.remove(); }
          catch(_){ el.style.display = 'none'; }
        });
      }catch(_){}
    });

    try{
      DOC.querySelectorAll('[data-boss-compact="1"]').forEach(el => el.remove());
    }catch(_){}

    if(DOC.documentElement){
      DOC.documentElement.classList.remove(
        'hha-brush-summary-compact',
        'hha-brush-compact-override',
        'hha-summary-mount-rescue',
        'hha-brush-summary-final',
        'hha-boss-compact-sync'
      );
    }

    if(DOC.body){
      DOC.body.classList.remove(
        'hha-brush-summary-compact',
        'hha-brush-compact-override',
        'hha-summary-mount-rescue',
        'hha-brush-summary-final',
        'hha-boss-compact-sync',
        'hha-boss-teacher-open'
      );

      DOC.body.style.paddingBottom = '';
    }
  }

  function restoreHiddenByCompact(){
    /*
     * ถ้า P43 เคยซ่อน panel ไว้ผิดจังหวะ ให้คืนกลับ
     */
    try{
      DOC.querySelectorAll('[data-compact-hidden="1"]').forEach(el => {
        el.style.display = '';
        el.style.visibility = '';
        el.style.pointerEvents = '';
        el.removeAttribute('data-compact-hidden');
      });
    }catch(_){}

    try{
      DOC.querySelectorAll('[data-boss-softened="1"]').forEach(el => {
        el.style.opacity = '';
        el.removeAttribute('data-boss-softened');
      });
    }catch(_){}
  }

  function apply(){
    const allow = shouldAllowSummary();

    DOC.documentElement.setAttribute('data-brush-summary-stage-lock', allow ? 'summary' : 'not-summary');
    if(DOC.body){
      DOC.body.setAttribute('data-brush-summary-stage-lock', allow ? 'summary' : 'not-summary');
    }

    if(!allow){
      removeSummaryArtifacts();
      restoreHiddenByCompact();
    }

    try{
      WIN.HHA_BRUSH_SUMMARY_STAGE_LOCK_STATE = {
        patch: PATCH_ID,
        allowSummary: allow,
        metrics: getTopMetrics(),
        prep: looksLikePrepOrHowto(),
        endMarkers: hasRealEndMarkers()
      };
    }catch(_){}
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(apply, 80);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true
      });
    }catch(_){}

    setTimeout(apply, 40);
    setTimeout(apply, 200);
    setTimeout(apply, 700);
    setTimeout(apply, 1400);
    setTimeout(apply, 2600);
  }

  function expose(){
    WIN.HHA_BRUSH_SUMMARY_STAGE_LOCK = {
      patch: PATCH_ID,
      apply,
      shouldAllowSummary,
      looksLikePrepOrHowto,
      hasRealEndMarkers,
      getTopMetrics
    };
  }

  function boot(){
    expose();
    observe();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
