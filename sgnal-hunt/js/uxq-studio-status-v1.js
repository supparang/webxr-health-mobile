/* CSAI2601 UX Quest • Student Studio Status v1
 * Read-only UI enhancement for Mission Control.
 * Requires action=uxq_student_studio_progress to be routed to UXQ_getStudentStudioProgress_.
 */
(() => {
  'use strict';
  const config = window.UXQ_CLASSROOM_CONFIG || {};
  const params = new URLSearchParams(location.search || '');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean = (v,max=200) => String(v == null ? '' : v).trim().slice(0,max);

  function identity() {
    let p = {};
    try { p = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId:clean(p.studentId || params.get('studentId') || params.get('sid'),80),
      section:clean(p.section || params.get('section') || config.defaultSection,80)
    };
  }
  function endpoint() { return clean(config.receiverUrl || config.progressUrl || '',800); }
  function jsonp(url) {
    return new Promise((resolve,reject) => {
      const cb = `uxqStudioCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const s = document.createElement('script');
      const timer = setTimeout(() => done(new Error('studio_progress_timeout')),12000);
      function done(err,data){ clearTimeout(timer); try{delete window[cb]}catch(_){window[cb]=undefined}s.remove(); err?reject(err):resolve(data); }
      window[cb] = data => done(null,data);
      s.onerror = () => done(new Error('studio_progress_network'));
      s.src = `${url}${url.includes('?')?'&':'?'}action=uxq_student_studio_progress&studentId=${encodeURIComponent(identity().studentId)}&section=${encodeURIComponent(identity().section)}&courseId=${encodeURIComponent(config.courseId||'UXQ-ACT1-2026')}&callback=${encodeURIComponent(cb)}&_=${Date.now()}`;
      document.head.appendChild(s);
    });
  }
  function installStyle(){ if(document.getElementById('uxq-studio-status-style')) return; const st=document.createElement('style');st.id='uxq-studio-status-style';st.textContent=`.studio-overview{margin:18px 0;border:1px solid rgba(110,231,255,.28);border-radius:18px;padding:16px;background:linear-gradient(145deg,rgba(16,31,61,.94),rgba(7,17,36,.96));color:#eef6ff}.studio-overview h2{margin:0 0 8px}.studio-summary{display:flex;gap:8px;flex-wrap:wrap}.studio-summary span{border:1px solid rgba(181,205,255,.25);border-radius:999px;padding:7px 10px;color:#cbd9f2}.studio-summary .bad{color:#ffb0bd}.studio-summary .good{color:#79eda5}.studio-node-status{margin-top:7px;font-size:.78rem}.studio-node-status.submitted{color:#ffd166}.studio-node-status.approved{color:#79eda5}.studio-node-status.need_revision{color:#ff96a8}.studio-node-status.not_submitted{color:#8294b8}`;document.head.appendChild(st);}
  function card(){ let box=document.getElementById('uxqStudioOverview'); if(box) return box; const grid=document.querySelector('.overview-grid'); if(!grid)return null; box=document.createElement('section');box.id='uxqStudioOverview';box.className='studio-overview';box.innerHTML='<h2>Studio Practice & Reflection</h2><p>กำลังดึงสถานะจาก Google Sheet…</p>';grid.insertAdjacentElement('afterend',box);return box; }
  function decorate(data){ const nodes=data.nodes||{}; document.querySelectorAll('[data-node-id],.mission-card,.up-next-card').forEach(el=>{const text=(el.dataset.nodeId||el.querySelector?.('[data-node-id]')?.dataset.nodeId||el.textContent||'').toLowerCase();const id=(text.match(/\b(w(?:[1-9]|1[0-5])|b[1-4])\b/)||[])[1];if(!id||!nodes[id])return;let status=el.querySelector('.studio-node-status');if(!status){status=document.createElement('div');status.className='studio-node-status';el.appendChild(status);}const n=nodes[id];status.className=`studio-node-status ${n.reviewStatus}`;status.textContent=n.reviewStatus==='approved'?'Studio: Approved':n.reviewStatus==='need_revision'?'Studio: ต้องแก้ไข':n.submitted?'Studio: ส่งแล้ว':'Studio: ยังไม่ส่ง';}); }
  async function load(){installStyle();const box=card();const id=identity();if(!box||!id.studentId||!id.section){if(box)box.innerHTML='<h2>Studio Practice & Reflection</h2><p>กรุณาระบุรหัสนักศึกษาและ Section เพื่อดูสถานะจาก Sheet</p>';return;}if(!endpoint()){box.innerHTML='<h2>Studio Practice & Reflection</h2><p>ยังไม่ได้ตั้งค่า Studio Progress endpoint</p>';return;}try{const d=await jsonp(endpoint());if(!d?.ok)throw new Error(d?.error||'studio_progress_failed');const s=d.summary||{};box.innerHTML=`<h2>Studio Practice & Reflection</h2><div class="studio-summary"><span>ส่งแล้ว ${Number(s.submittedCount||0)}/${Number(s.totalNodes||19)}</span><span class="good">Approved ${Number(s.approvedCount||0)}</span><span class="${Number(s.revisionCount||0)?'bad':''}">ต้องแก้ ${Number(s.revisionCount||0)}</span><span>Project continuity: ${s.continuityOk?'ปกติ':'ตรวจพบหลาย Project ID'}</span><span>Portfolio: ${d.portfolioReady?'พร้อมสร้าง':'ยังไม่ครบ'}</span></div>`;decorate(d);window.UXQStudioProgress=d;}catch(e){box.innerHTML=`<h2>Studio Practice & Reflection</h2><p>ดึงสถานะไม่สำเร็จ: ${esc(e.message||e)}</p>`;}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,700));else setTimeout(load,700);
  window.addEventListener('uxq-cloud-progress-restored',()=>setTimeout(load,300));
})();
