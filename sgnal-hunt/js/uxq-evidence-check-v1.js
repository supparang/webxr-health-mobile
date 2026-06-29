/* UX Quest • Evidence-Pair Verification v1 */
(() => {
  'use strict';

  const checks = [];
  const state = () => ({
    total: checks.length,
    verified: checks.filter((item) => item.correct).length
  });

  function standardFor(stage){
    const value = String(stage || '').toLowerCase();
    if (value.includes('evidence')) return 'ยึดพฤติกรรมจริง บริบท และจุดที่ผู้ใช้ติดขัด';
    if (value.includes('test')) return 'วัดพฤติกรรมและผลลัพธ์จาก task ที่ผู้ใช้ทำได้จริง';
    return 'เชื่อมหลักฐานเกี่ยวกับผู้ใช้เข้ากับการตัดสินใจที่ตรวจสอบได้';
  }

  window.UXQEvidencePair = Object.freeze({
    version: 'uxq-evidence-pair-v1',
    getSummary: state,
    standardFor
  });
})();
