/* CSAI2601 UX Quest • Unified Student Runtime Authority v1.1
 * One final controller for every W1-W15 / B1-B4 student node.
 * Coordinates learner identity, mission state, canonical layout, project/studio,
 * three-part status, navigation and late-render cleanup.
 * Google Sheet remains the only official authority.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  const preview = q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '');
  if (preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').trim().toUpperCase();
  const BANNER_ID = 'uxqStudentRuntimeBanner';
  const STYLE_ID = 'uxq-student-runtime-authority-v1-style';
  let gateOpen = false;
  let queued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function profile(){
    let p = {};
    try { p = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId:String(p.studentId || q.get('studentId') || q.get('sid') || '').trim(),
      studentName:String(p.studentName || q.get('studentName') || q.get('name') || '').trim(),
      section:String(p.section || q.get('section') || '').trim()
    };
  }
  function complete(p){
    try { return Boolean(window.UXQIdentity?.isComplete?.(p)); }
    catch (_) { return Boolean(p.studentId && p.studentName && p.section); }
  }
  function initials(p){
    const s = String(p.studentName || p.studentId || 'UX').trim();
    const a = s.split(/\s+/).filter(Boolean);
    return (a.length > 1 ? a[0][0] + a[a.length-1][0] : s.slice(0,2)).toUpperCase();
  }

  function missionRecord(){
    try { return window.UXQProgress?.get?.()?.missions?.[NODE.toLowerCase()] || {}; }
    catch (_) { return {}; }
  }
  function missionSummary(){
    const row = missionRecord();
    const history = Array.isArray(row.history) ? row.history : [];
    const candidates = [row.lastResult || {}, ...history];
    const stars = Math.max(num(row.bestStars), ...candidates.map(x => num(x.stars)));
    const score = Math.max(num(row.bestScore), ...candidates.map(x => num(x.score)));
    const attempted = Boolean(num(row.attempts) || history.length || stars || score);
    const localPass = Boolean(row.completed || candidates.some(x => x.passed === true) || stars >= 2);
    return {row,stars,score,attempted,localPass};
  }
  function officialCount(){
    const badge = document.querySelector('#uxqThreePartCompletion .uxq-3part__count');
    const m = String(badge?.textContent || '').match(/([0-3])\s*\/\s*3/);
    return m ? Number(m[1]) : null;
  }

  function installStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${BANNER_ID}{position:sticky;top:0;z-index:900;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;width:min(1280px,calc(100% - 24px));margin:10px auto 14px;padding:11px 13px;border:1px solid rgba(110,231,255,.42);border-radius:15px;background:rgba(5,18,42,.98);box-shadow:0 12px 30px rgba(0,0,0,.3);backdrop-filter:blur(10px)}
      #${BANNER_ID} .uxq-sra__avatar{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#6ee7ff,#7f7cff);color:#071124;font-weight:1000}
      #${BANNER_ID} .uxq-sra__body{display:grid;gap:3px;min-width:0}#${BANNER_ID} .uxq-sra__label{color:#8deeff;font-size:.72rem;font-weight:950;letter-spacing:.1em}#${BANNER_ID} .uxq-sra__name{color:#fff;font-weight:950;overflow-wrap:anywhere}
      #${BANNER_ID} .uxq-sra__meta{display:flex;gap:7px;flex-wrap:wrap;color:#bed0eb;font-size:.8rem}#${BANNER_ID} .uxq-sra__meta span{padding:3px 7px;border:1px solid rgba(181,205,255,.2);border-radius:999px;background:rgba(255,255,255,.035)}
      #${BANNER_ID} small{color:#ffd98e;font-size:.72rem;line-height:1.35}#${BANNER_ID} .uxq-sra__actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      #${BANNER_ID} button,#${BANNER_ID} a{display:grid;place-items:center;min-height:38px;padding:8px 11px;border-radius:10px;border:1px solid rgba(110,231,255,.34);background:rgba(255,255,255,.045);color:#edf5ff;text-decoration:none;font:inherit;font-size:.8rem;font-weight:900;cursor:pointer}
      body[data-uxq-identity-locked='1'] #uxqCanonicalNode{pointer-events:none;user-select:none;filter:saturate(.55)}body[data-uxq-identity-locked='1'] .uxq-profile-layer{pointer-events:auto;filter:none}
      #uxqCanonicalNode > #uxqProjectFigmaEvidenceV4,#uxqCanonicalNode > .uxq-project-figma-card{display:none!important}
      .artifact[data-student-studio-final='1'] > :not(.studio-head):not(#uxqStudentStudioFinalV2){display:none!important}
      #uxqThreePartCompletion{width:min(1280px,calc(100% - 24px));margin:18px auto!important}
      #uxqThreePartCompletion[data-sheet-state='unavailable'] .uxq-3part__count{background:rgba(251,191,36,.12);color:#ffe6a3}
      @media(max-width:720px){#${BANNER_ID}{position:static;grid-template-columns:auto minmax(0,1fr);width:calc(100% - 16px);margin:8px auto}#${BANNER_ID} .uxq-sra__actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}#${BANNER_ID} button,#${BANNER_ID} a{width:100%}#uxqThreePartCompletion{width:calc(100% - 16px)}}
    `;
    document.head.appendChild(s);
  }

  function projectId(){
    return String(ROOT.querySelector('[data-ssf2-project-id]')?.value || ROOT.querySelector('[data-studio-key="projectId"]')?.value || '').trim();
  }

  async function openIdentity(force){
    if (gateOpen || !window.UXQIdentity?.open) return;
    if (!force && complete(profile())) return;
    gateOpen = true;
    document.body.dataset.uxqIdentityLocked = '1';
    try {
      const result = await window.UXQIdentity.open({allowGuest:false,title:force?'เปลี่ยนผู้เรียนที่กำลังทำภารกิจ':'ระบุผู้เรียนก่อนเริ่มภารกิจ'});
      if (!complete(result || profile())) setTimeout(() => openIdentity(false),120);
    } finally {
      gateOpen = false;
      document.body.dataset.uxqIdentityLocked = complete(profile()) ? '0' : '1';
      queue();
    }
  }

  function mountBanner(){
    let b = document.getElementById(BANNER_ID);
    document.querySelectorAll('#uxqActiveLearnerBanner').forEach(x => x.remove());
    if (!b){ b=document.createElement('section'); b.id=BANNER_ID; b.setAttribute('aria-live','polite'); ROOT.parentNode?.insertBefore(b,ROOT); }
    const p=profile(), ready=complete(p), pid=projectId();
    const href='./csai2601-mission-control.html';
    b.innerHTML=`<div class="uxq-sra__avatar">${esc(initials(p))}</div><div class="uxq-sra__body"><span class="uxq-sra__label">ผู้เล่นปัจจุบัน • ${esc(NODE)}</span><strong class="uxq-sra__name">${ready?esc(p.studentName):'ยังไม่ได้ระบุผู้เรียน'}</strong><div class="uxq-sra__meta"><span>รหัส: ${ready?esc(p.studentId):'—'}</span><span>Section: ${ready?esc(p.section):'—'}</span>${pid?`<span>Project: ${esc(pid)}</span>`:''}</div><small>โปรไฟล์บนอุปกรณ์ปัจจุบัน • สถานะทางการยืนยันจาก Google Sheet ภายหลัง</small></div><div class="uxq-sra__actions"><button type="button" data-change>${ready?'เปลี่ยนผู้เรียน':'ระบุผู้เรียน'}</button><a href="${href}">Mission Control</a></div>`;
    b.querySelector('[data-change]')?.addEventListener('click',()=>openIdentity(true));
    if (!ready) openIdentity(false);
  }

  function normalizeMissionStatus(){
    const hero=ROOT.querySelector('.panel .hero'); if(!hero) return;
    const m=missionSummary();
    let line=hero.querySelector('.uxq-attempt-status');
    if(!m.attempted){ line?.remove(); return; }
    if(!line){line=document.createElement('p');line.className='lede uxq-attempt-status';hero.insertBefore(line,hero.querySelector('.actions')||null);}
    const count=officialCount();
    if(m.localPass){line.dataset.state='passed';line.textContent=`ผ่าน Mission ในเครื่อง: ${'★'.repeat(Math.max(0,Math.min(3,m.stars)))}${'☆'.repeat(3-Math.max(0,Math.min(3,m.stars)))} • คะแนนดีที่สุด ${m.score.toLocaleString('th-TH')} • ${count===3?'ระบบยืนยันครบ 3/3':'ทำ Studio Practice และ Weekly Reflection ต่อ'}`;}
    else{line.dataset.state='retry';line.textContent=`เล่นแล้วแต่ยังไม่ผ่าน: ${'★'.repeat(Math.max(0,Math.min(3,m.stars)))}${'☆'.repeat(3-Math.max(0,Math.min(3,m.stars)))} • คะแนนดีที่สุด ${m.score.toLocaleString('th-TH')} • ต้องได้อย่างน้อย 2/3 ดาว`;}
    const primary=hero.querySelector('.actions a:first-child,.actions button:first-child');
    if(primary){ primary.textContent = m.localPass ? (count===3?`ทบทวน ${NODE} →`:'ทำ Studio Practice ต่อ →') : `เล่น ${NODE} ใหม่ →`; }
  }

  function normalizeThreePart(){
    const box=document.getElementById('uxqThreePartCompletion');
    const hero=ROOT.querySelector('.panel .hero');
    if(!box||!hero?.parentNode) return;

    const heroPanel=hero.closest('.panel') || hero;
    const target=heroPanel.nextSibling;
    if(box.parentNode!==heroPanel.parentNode || box.previousElementSibling!==heroPanel){
      heroPanel.parentNode.insertBefore(box,target);
    }

    const text=String(box.textContent||'');
    const unavailable=/เชื่อม Receiver|หมดเวลารอ|ยังตรวจ .*Sheet ไม่ได้|ไม่สำเร็จ/i.test(text);
    box.dataset.sheetState=unavailable?'unavailable':'available';
    if(!unavailable) return;

    const badge=box.querySelector('.uxq-3part__count');
    if(badge) badge.textContent='ยังไม่ยืนยันจาก Sheet';
    const cards=box.querySelectorAll('.uxq-3part__item');
    const local=missionSummary();
    if(cards[0]){
      const status=cards[0].querySelector('span');
      const detail=cards[0].querySelector('small');
      if(local.attempted){
        if(status) status.textContent=local.localPass?'มีผลผ่านในเครื่อง • รอ Sheet':'มีผลในเครื่อง • ยังไม่ผ่าน';
        if(detail) detail.textContent=`ผลบนอุปกรณ์นี้ ${local.stars}/3 ดาว${local.score?` • ${local.score.toLocaleString('th-TH')} คะแนน`:''} ยังไม่ใช่สถานะทางการ`;
        cards[0].dataset.state=local.localPass?'pending':'retry';
      } else {
        if(status) status.textContent='ยังไม่มีผลที่ยืนยันได้';
        if(detail) detail.textContent='ไม่พบผลที่ผูกกับผู้เรียนปัจจุบันบนอุปกรณ์นี้ และยังอ่าน Google Sheet ไม่สำเร็จ';
        cards[0].dataset.state='pending';
      }
    }
    [cards[1],cards[2]].forEach((card,index)=>{
      if(!card) return;
      const status=card.querySelector('span');
      const detail=card.querySelector('small');
      if(status) status.textContent='ยังไม่ยืนยันจาก Sheet';
      if(detail) detail.textContent=index===0?'กรอก Studio ได้เมื่อ Mission ผ่านในเครื่อง แต่สถานะทางการรอ Sheet':'กรอก Reflection ได้เมื่อ Mission ผ่านในเครื่อง แต่สถานะทางการรอ Sheet';
      card.dataset.state='pending';
    });
    const foot=box.querySelector('.uxq-3part__foot');
    if(foot) foot.textContent='Google Sheet ยังไม่ตอบกลับ จึงยังสรุป 0/3 หรือ 3/3 ไม่ได้ ระบบจะแสดงผลในเครื่องแยกต่างหากโดยไม่เดาสถานะทางการ';
  }

  function normalizeLayout(){
    document.querySelectorAll('#uxqActiveLearnerBanner').forEach(x=>x.remove());
    const artifact=ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if(artifact){
      window.UXQStudentStudioFinalAuthorityV2?.build?.();
      artifact.dataset.studentStudioFinal='1';
    }
    document.querySelectorAll('nav,footer,div,section').forEach(el=>{
      const t=String(el.textContent||'').replace(/\s+/g,'');
      if(t.includes('👊')&&(t.includes('🌼')||t.includes('🌸'))){const cs=getComputedStyle(el);if(cs.position==='fixed'||cs.position==='sticky'||/dock|bottom|tabbar/i.test(el.className||''))el.remove();}
    });
  }

  function apply(){queued=false;installStyle();mountBanner();normalizeMissionStatus();normalizeLayout();normalizeThreePart();}
  function queue(){if(queued)return;queued=true;requestAnimationFrame(apply);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queue,{once:true});else queue();
  new MutationObserver(queue).observe(ROOT,{childList:true,subtree:true,characterData:true});
  ['uxq-profile-updated','uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored','uxq-studio-artifact-dispatched'].forEach(n=>window.addEventListener(n,queue));
  [150,500,1200,2500,4500].forEach(ms=>setTimeout(queue,ms));
  window.UXQStudentRuntimeAuthorityV1=Object.freeze({version:'20260729-UNIFIED-STUDENT-RUNTIME-V1.1',refresh:queue,openIdentity});
})();