/* CSAI2601 UX Quest • Mission + Studio + Reflection Coordinator v2
 * Full node completion = mission_completed AND studio_submitted AND reflection_submitted.
 * Mission completion continues to control unlock; full completion controls course progress labels.
 */
(() => {
  'use strict';
  const config = window.UXQ_CLASSROOM_CONFIG || {};
  const params = new URLSearchParams(location.search || '');
  const ORDER = ['w1','w2','w3','b1','w4','w5','w6','w7','b2','w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const clean = (v,max=200) => String(v == null ? '' : v).trim().slice(0,max);
  let missionSnapshot = window.UXQMissionSheetSnapshot || null;
  let studioSnapshot = null;

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

  function missionPassed(id) {
    const row = missionSnapshot?.missions?.[id] || missionSnapshot?.missions?.[id.toUpperCase()] || {};
    return Boolean(row.completed || row.passed || Number(row.bestStars || row.stars || 0) >= 2);
  }
  function studioRow(id) {
    const nodes = studioSnapshot?.nodes || {};
    return nodes[id] || nodes[id.toUpperCase()] || (studioSnapshot?.items || []).find(item => String(item.nodeId || item.missionId || '').toLowerCase() === id) || {};
  }
  function studioSubmitted(row) {
    return Boolean(row.submitted || row.artifactSubmitted || row.studioSubmitted || ['submitted','approved','need_revision','reviewing'].includes(String(row.reviewStatus || row.status || '').toLowerCase()));
  }
  function reflectionSubmitted(row) {
    return Boolean(row.reflectionSubmitted || row.hasReflection || clean(row.reflection || '',5000).length > 0);
  }
  function nodeState(id) {
    const row = studioRow(id);
    const mission = missionPassed(id);
    const studio = studioSubmitted(row);
    const reflection = reflectionSubmitted(row);
    return {
      id, mission, studio, reflection,
      complete:Boolean(mission && studio && reflection),
      reviewStatus:clean(row.reviewStatus || row.status || 'not_submitted',40),
      projectId:clean(row.projectId || '',160)
    };
  }
  function allStates() { return ORDER.map(nodeState); }

  function installStyle(){
    if(document.getElementById('uxq-studio-status-style')) return;
    const st=document.createElement('style');
    st.id='uxq-studio-status-style';
    st.textContent=`
      .studio-overview{margin:18px 0;border:1px solid rgba(110,231,255,.28);border-radius:18px;padding:16px;background:linear-gradient(145deg,rgba(16,31,61,.94),rgba(7,17,36,.96));color:#eef6ff}
      .studio-overview h2{margin:0 0 8px}.studio-overview p{color:#aebedb;line-height:1.5}
      .studio-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}
      .studio-summary span{border:1px solid rgba(181,205,255,.25);border-radius:13px;padding:11px;color:#cbd9f2;background:rgba(3,13,31,.35)}
      .studio-summary b{display:block;color:#fff;font-size:1.05rem;margin-top:3px}.studio-summary .bad{color:#ffb0bd}.studio-summary .good{color:#79eda5}
      .studio-node-status{margin-top:9px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;font-size:.72rem}
      .studio-node-status span{border:1px solid rgba(181,205,255,.2);border-radius:999px;padding:4px 7px;text-align:center;color:#8294b8}
      .studio-node-status span.done{color:#79eda5;border-color:rgba(121,237,165,.45);background:rgba(121,237,165,.08)}
      .campaign-preview[data-node-complete='1']{outline:2px solid rgba(121,237,165,.34)}
      @media(max-width:760px){.studio-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.studio-node-status{grid-template-columns:1fr}}
    `;
    document.head.appendChild(st);
  }
  function card(){
    let box=document.getElementById('uxqStudioOverview');
    if(box) return box;
    const grid=document.querySelector('.overview-grid');
    if(!grid)return null;
    box=document.createElement('section');box.id='uxqStudioOverview';box.className='studio-overview';
    box.innerHTML='<h2>Mission + Studio Practice + Reflection</h2><p>กำลังรวมสถานะจาก Google Sheet…</p>';
    grid.insertAdjacentElement('afterend',box);
    return box;
  }

  function decorate(states){
    states.forEach(state => {
      const el = document.querySelector(`[data-node-id="${state.id}"]`) || document.querySelector(`[data-node="${state.id.toUpperCase()}"]`);
      if(!el) return;
      el.dataset.nodeComplete = state.complete ? '1' : '0';
      let status=el.querySelector('.studio-node-status');
      if(!status){status=document.createElement('div');status.className='studio-node-status';el.appendChild(status);}
      status.innerHTML = `<span class="${state.mission?'done':''}">Mission ${state.mission?'✓':'○'}</span><span class="${state.studio?'done':''}">Studio ${state.studio?'✓':'○'}</span><span class="${state.reflection?'done':''}">Reflection ${state.reflection?'✓':'○'}</span>`;
      const badge=el.querySelector('.stage-state');
      if(badge) badge.textContent = state.complete ? 'ครบ 3/3' : state.mission ? `Mission ผ่าน • ${Number(state.studio)+Number(state.reflection)}/2 งาน` : badge.textContent;
      const launch=el.querySelector('.campaign-launch');
      if(launch && state.mission){ launch.textContent = state.complete ? 'ดู/แก้ผลงาน' : 'ทำ Studio ต่อ'; }
    });
  }

  function updatePrimary(states){
    const missionCount=states.filter(x=>x.mission).length;
    const studioCount=states.filter(x=>x.studio).length;
    const reflectionCount=states.filter(x=>x.reflection).length;
    const completeCount=states.filter(x=>x.complete).length;
    const progress=document.getElementById('progress');
    if(progress) progress.textContent=`ครบ 3/3 ${completeCount}/${ORDER.length} • Mission ${missionCount}/${ORDER.length}`;

    const incomplete=states.find(x=>x.mission && !x.complete) || states.find(x=>!x.mission) || null;
    const title=document.getElementById('nextTitle');
    const desc=document.getElementById('nextDesc');
    const link=document.getElementById('nextLink');
    if(completeCount===ORDER.length){
      if(title) title.textContent='ครบทั้งหลักสูตร 19/19 Nodes';
      if(desc) desc.textContent='Mission, Studio Practice และ Reflection ได้รับการยืนยันครบทุก Node';
      if(link){link.textContent='Portfolio พร้อมตรวจ';link.href='#';link.setAttribute('aria-disabled','true');}
    } else if(incomplete){
      const id=incomplete.id.toUpperCase();
      if(title) title.textContent=incomplete.mission ? `${id} • ทำ Studio/Reflection ให้ครบ` : `${id} • Mission ถัดไป`;
      if(desc) desc.textContent=incomplete.mission
        ? `Mission ผ่านแล้ว • Studio ${incomplete.studio?'✓':'ยังไม่ส่ง'} • Reflection ${incomplete.reflection?'✓':'ยังไม่ส่ง'}`
        : 'ยังไม่ผ่าน Mission ตามลำดับจาก Google Sheet';
      if(link){link.href=`./csai2601-canonical-node-clean-v1.html?node=${encodeURIComponent(id)}&v=three-part-course-progress-v2-20260721`;link.textContent=incomplete.mission?'ทำงานต่อ →':'เริ่ม Mission →';link.setAttribute('aria-disabled','false');}
    }
    return {missionCount,studioCount,reflectionCount,completeCount};
  }

  function renderCombined(){
    installStyle();
    const box=card();
    if(!box || !missionSnapshot || !studioSnapshot) return;
    const states=allStates();
    const count=updatePrimary(states);
    const summary=studioSnapshot.summary||{};
    box.innerHTML=`<h2>ความก้าวหน้าครบ 3 ส่วน</h2><p>Node จะถือว่า “สมบูรณ์” เมื่อ Mission ผ่าน และ Google Sheet พบทั้ง Studio Practice กับ Weekly Reflection</p><div class="studio-summary"><span>Mission<b>${count.missionCount}/${ORDER.length}</b></span><span>Studio Practice<b>${count.studioCount}/${ORDER.length}</b></span><span>Weekly Reflection<b>${count.reflectionCount}/${ORDER.length}</b></span><span class="${count.completeCount===ORDER.length?'good':''}">Nodes Complete<b>${count.completeCount}/${ORDER.length}</b></span><span>Approved<b>${Number(summary.approvedCount||0)}</b></span><span class="${Number(summary.revisionCount||0)?'bad':''}">ต้องแก้<b>${Number(summary.revisionCount||0)}</b></span><span>Project continuity<b>${summary.continuityOk?'ปกติ':'พบหลาย Project ID'}</b></span><span>Portfolio<b>${studioSnapshot.portfolioReady&&count.completeCount===ORDER.length?'พร้อม':'ยังไม่ครบ'}</b></span></div>`;
    decorate(states);
    window.UXQCombinedCourseProgress={states,...count};
    window.dispatchEvent(new CustomEvent('uxq-three-part-course-progress', {detail:window.UXQCombinedCourseProgress}));
  }

  async function loadStudio(){
    installStyle();const box=card();const id=identity();
    if(!box||!id.studentId||!id.section){if(box)box.innerHTML='<h2>ความก้าวหน้าครบ 3 ส่วน</h2><p>กรุณาระบุรหัสนักศึกษาและ Section เพื่อดูสถานะจาก Sheet</p>';return;}
    if(!endpoint()){box.innerHTML='<h2>ความก้าวหน้าครบ 3 ส่วน</h2><p>ยังไม่ได้ตั้งค่า Studio Progress endpoint</p>';return;}
    try{const d=await jsonp(endpoint());if(!d?.ok)throw new Error(d?.error||'studio_progress_failed');studioSnapshot=d;window.UXQStudioProgress=d;renderCombined();}
    catch(e){box.innerHTML=`<h2>ความก้าวหน้าครบ 3 ส่วน</h2><p>ดึงสถานะ Studio/Reflection ไม่สำเร็จ: ${esc(e.message||e)}</p>`;}
  }

  window.addEventListener('uxq-mission-control-sheet-snapshot',event=>{missionSnapshot=event.detail?.snapshot||null;renderCombined();});
  window.addEventListener('uxq-sheet-progress-restored',event=>{missionSnapshot=event.detail||null;renderCombined();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loadStudio,700));else setTimeout(loadStudio,700);
})();