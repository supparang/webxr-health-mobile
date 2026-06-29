/* UX Quest • Result Footer Sync v1.1 */
(() => {
  'use strict';

  function statusLine(state){
    const lines = {
      confirmed: 'สถานะการส่ง: ระบบยืนยันการบันทึกแล้ว',
      dispatched_unverified: 'สถานะการส่ง: ส่งคำขอผลลัพธ์ไปยัง Student Receiver แล้ว • ผู้สอนตรวจผลได้ใน Teacher Dashboard',
      dispatching: 'สถานะการส่ง: บันทึกในอุปกรณ์แล้ว • กำลังส่งคำขอไปยังระบบชั้นเรียน',
      queued: 'สถานะการส่ง: บันทึกในอุปกรณ์แล้ว • รอส่งเมื่ออุปกรณ์กลับมาออนไลน์',
      profile_incomplete: 'สถานะการส่ง: บันทึกเฉพาะในอุปกรณ์นี้ • ข้อมูลผู้เรียนยังไม่ครบ',
      local_only: 'สถานะการส่ง: บันทึกเฉพาะในอุปกรณ์นี้'
    };
    return lines[state] || lines.local_only;
  }

  function refresh(){
    const result = document.querySelector('.uxq-results');
    const footer = result?.querySelector('.uxq-footer-note');
    const receipt = window.UXQSubmissionReceipt?.getLast?.();
    if (!footer || !receipt) return;
    const next = statusLine(receipt.state);
    if (footer.textContent !== next) footer.textContent = next;
  }

  function boot(){
    refresh();
    window.addEventListener('uxq:submission-receipt', () => window.setTimeout(refresh, 0));
    const root = document.getElementById('uxqApp') || document.body;
    new MutationObserver(refresh).observe(root, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
