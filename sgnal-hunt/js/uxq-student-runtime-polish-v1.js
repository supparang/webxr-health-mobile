/* CSAI2601 UX Quest • Unified Student Runtime Polish v1
 * Final visual/interaction cleanup for W1-W15 and B1-B4.
 * Keeps Google Sheet as official authority and does not fabricate completion.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').toUpperCase();
  const STYLE_ID = 'uxq-student-runtime-polish-v1-style';
  let queued = false;

  function installStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Clear visual hierarchy: learner → mission → progress → studio. */
      #uxqStudentRuntimeBanner{margin-bottom:16px!important}
      #uxqThreePartCompletion{width:min(1120px,calc(100% - 24px))!important;margin:18px auto!important}
      #uxqThreePartCompletion .uxq-3part__item[data-state='done']{border-color:rgba(74,222,128,.78)!important;background:rgba(34,197,94,.13)!important}
      #uxqThreePartCompletion .uxq-3part__item[data-state='pending'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='ready']{border-color:rgba(250,204,21,.76)!important;background:rgba(250,204,21,.11)!important}
      #uxqThreePartCompletion .uxq-3part__item[data-state='missing'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='locked'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='retry']{border-color:rgba(248,113,113,.62)!important;background:rgba(239,68,68,.09)!important}

      /* Studio is a continuation, not a second hero/game. */
      .artifact[data-studio-practice-v1] .studio-head{display:none!important}
      #uxqStudentStudioFinalV2{width:min(920px,calc(100% - 24px))!important;margin:20px auto!important}
      #uxqStudentStudioFinalV2 .ssf2-hero,
      #uxqStudentStudioFinalV2 .ssf2-intro,
      #uxqStudentStudioFinalV2 .ssf2-title-duplicate{display:none!important}
      #uxqStudentStudioFinalV2 .ssf2-shell{border-radius:20px!important}

      /* One primary action set only. */
      [data-uxq-runtime-hidden='1']{display:none!important}
      .uxq-runtime-next-card{width:min(920px,calc(100% - 24px));margin:16px auto;padding:16px 18px;border:1px solid rgba(110,231,255,.34);border-radius:18px;background:linear-gradient(135deg,rgba(15,63,116,.7),rgba(56,40,126,.62));display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center}
      .uxq-runtime-next-card h3{margin:0 0 4px;font-size:1.15rem;color:#fff}.uxq-runtime-next-card p{margin:0;color:#c7d7ef;line-height:1.45}
      .uxq-runtime-next-card button{min-height:48px;padding:11px 18px;border:0;border-radius:13px;background:linear-gradient(135deg,#67e8f9,#6ee7a8);color:#071124;font:inherit;font-weight:950;cursor:pointer}

      @media(max-width:760px){
        .uxq-runtime-next-card{grid-template-columns:1fr}.uxq-runtime-next-card button{width:100%}
        #uxqThreePartCompletion,#uxqStudentStudioFinalV2{width:calc(100% - 16px)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function hero(){ return ROOT.querySelector('.panel .hero, .hero-card, .mission-card, article .hero'); }
  function tracker(){ return document.getElementById('uxqThreePartCompletion'); }
  function artifact(){ return ROOT.querySelector('.artifact[data-studio-practice-v1]'); }

  function moveTrackerAfterHero(){
    const h = hero();
    const t = tracker();
    if (!h || !t) return;
    const heroContainer = h.closest('.panel,article,section') || h;
    const parent = heroContainer.parentNode;
    if (parent && t.previousElementSibling !== heroContainer) parent.insertBefore(t, heroContainer.nextSibling);
  }

  function status(){
    let mission = 'unknown', studio = 'unknown', reflection = 'unknown';
    const cards = tracker()?.querySelectorAll('.uxq-3part__item') || [];
    cards.forEach((card,index) => {
      const state = card.getAttribute('data-state') || '';
      const done = state === 'done';
      if (index === 0) mission = done ? 'done' : state;
      if (index === 1) studio = done ? 'done' : state;
      if (index === 2) reflection = done ? 'done' : state;
    });
    return {mission,studio,reflection};
  }

  function updateHeroProgress(){
    const h = hero(); if (!h) return;
    const s = status();
    let box = h.querySelector('.uxq-runtime-quest-progress');
    if (!box) {
      box = document.createElement('div');
      box.className = 'uxq-runtime-quest-progress';
      box.style.cssText = 'margin:14px 0;padding:12px 14px;border-radius:14px;background:rgba(6,20,45,.5);border:1px solid rgba(110,231,255,.24);color:#dcecff;line-height:1.5';
      const actions = h.querySelector('.actions');
      h.insertBefore(box, actions || null);
    }
    const complete = [s.mission,s.studio,s.reflection].filter(x => x === 'done').length;
    const next = s.mission !== 'done' ? 'Mission' : s.studio !== 'done' ? 'Studio Practice' : s.reflection !== 'done' ? 'Weekly Reflection' : 'เสร็จครบแล้ว';
    const blocks = '■'.repeat(complete) + '□'.repeat(3-complete);
    box.innerHTML = `<strong>Quest Progress ${blocks} ${Math.round(complete/3*100)}%</strong><br><span>ขั้นตอนถัดไป: ${next}</span>`;
  }

  function hideDuplicateActions(){
    const s = status();
    const all = Array.from(document.querySelectorAll('a,button'));
    all.forEach(el => {
      const text = String(el.textContent || '').replace(/\s+/g,' ').trim();
      if (!text) return;
      const inHero = Boolean(el.closest('.panel .hero,.hero-card,.mission-card'));
      const inStudio = Boolean(el.closest('#uxqStudentStudioFinalV2'));
      if (inHero || inStudio || el.closest('#uxqStudentRuntimeBanner')) return;
      if (/^(เริ่มทำ|เล่นซ้ำด้วย case ใหม่|กำลังยืนยัน .*Sheet|ตรวจ Sheet อีกครั้ง)$/i.test(text)) el.dataset.uxqRuntimeHidden = '1';
    });

    const h = hero();
    const primary = h?.querySelector('.actions a:first-child,.actions button:first-child');
    if (primary) {
      if (s.mission !== 'done') primary.textContent = `เริ่ม ${NODE} →`;
      else if (s.studio !== 'done') primary.textContent = 'ไปทำ Studio Practice →';
      else if (s.reflection !== 'done') primary.textContent = 'ไปทำ Weekly Reflection →';
      else primary.textContent = `ทบทวน ${NODE} →`;
    }
  }

  function mountNextCard(){
    const t = tracker(); if (!t) return;
    let card = document.getElementById('uxqRuntimeNextCard');
    if (!card) {
      card = document.createElement('section'); card.id = 'uxqRuntimeNextCard'; card.className = 'uxq-runtime-next-card';
      t.insertAdjacentElement('afterend',card);
    }
    const s = status();
    let title,desc,label,target;
    if (s.mission !== 'done') { title='ทำ Mission ให้ผ่านก่อน'; desc='ต้องได้อย่างน้อย 2/3 ดาว จึงเปิด Studio Practice'; label=`เริ่ม ${NODE}`; target=hero(); }
    else if (s.studio !== 'done') { title='ขั้นตอนถัดไป: Studio Practice'; desc='ทำชิ้นงานตาม Step และตรวจ Self-check ให้ครบ'; label='ทำ Studio Practice'; target=artifact(); }
    else if (s.reflection !== 'done') { title='ขั้นตอนถัดไป: Weekly Reflection'; desc='สะท้อนหลักฐาน การตัดสินใจ และสิ่งที่จะปรับปรุง'; label='เขียน Reflection'; target=artifact(); }
    else { title='ครบทั้ง 3 ส่วนแล้ว'; desc='สามารถกลับ Mission Control เพื่อไปภารกิจถัดไป'; label='Mission Control'; target=null; }
    card.innerHTML = `<div><h3>${title}</h3><p>${desc}</p></div><button type="button">${label}</button>`;
    card.querySelector('button').onclick = () => {
      if (!target) { location.href='./csai2601-mission-control.html'; return; }
      target.scrollIntoView({behavior:'smooth',block:'start'});
      if (target === artifact()) window.UXQStudentStudioFinalAuthorityV2?.build?.();
    };
  }

  function removeStudioDuplicateHeader(){
    const studio = document.getElementById('uxqStudentStudioFinalV2'); if (!studio) return;
    const headings = Array.from(studio.querySelectorAll('h1,h2,h3'));
    const seen = new Set();
    headings.forEach(el => {
      const text = String(el.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if (!text) return;
      if (seen.has(text)) el.dataset.uxqRuntimeHidden = '1'; else seen.add(text);
    });
  }

  function apply(){
    queued=false; installStyle(); moveTrackerAfterHero(); updateHeroProgress(); hideDuplicateActions(); mountNextCard(); removeStudioDuplicateHeader();
  }
  function queue(){ if(queued)return; queued=true; requestAnimationFrame(apply); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',queue,{once:true}); else queue();
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true});
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored','uxq-studio-artifact-dispatched'].forEach(name=>window.addEventListener(name,queue));
  [200,700,1500,3000].forEach(ms=>setTimeout(queue,ms));
  window.UXQStudentRuntimePolishV1=Object.freeze({version:'20260729-STUDENT-RUNTIME-POLISH-V1',refresh:queue});
})();