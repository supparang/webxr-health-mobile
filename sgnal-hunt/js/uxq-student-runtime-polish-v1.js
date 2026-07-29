/* CSAI2601 UX Quest • Unified Student Runtime Polish v2
 * Final visual/interaction cleanup for W1-W15 and B1-B4.
 * One hero CTA only. Local mission evidence may guide UI, while Google Sheet
 * remains the official completion authority.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').toUpperCase();
  const STYLE_ID = 'uxq-student-runtime-polish-v2-style';
  let queued = false;
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function installStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #uxqStudentRuntimeBanner{margin-bottom:16px!important}
      #uxqThreePartCompletion{width:min(1120px,calc(100% - 24px))!important;margin:18px auto!important}
      #uxqThreePartCompletion .uxq-3part__item[data-state='done']{border-color:rgba(74,222,128,.78)!important;background:rgba(34,197,94,.13)!important}
      #uxqThreePartCompletion .uxq-3part__item[data-state='pending'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='ready']{border-color:rgba(250,204,21,.76)!important;background:rgba(250,204,21,.11)!important}
      #uxqThreePartCompletion .uxq-3part__item[data-state='missing'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='locked'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='retry']{border-color:rgba(248,113,113,.62)!important;background:rgba(239,68,68,.09)!important}
      .artifact[data-studio-practice-v1] .studio-head{display:none!important}
      #uxqStudentStudioFinalV2{width:min(920px,calc(100% - 24px))!important;margin:20px auto!important}
      #uxqStudentStudioFinalV2 .ssf2-hero,#uxqStudentStudioFinalV2 .ssf2-intro,#uxqStudentStudioFinalV2 .ssf2-title-duplicate{display:none!important}
      #uxqStudentStudioFinalV2 .ssf2-shell{border-radius:20px!important}
      [data-uxq-runtime-hidden='1']{display:none!important}
      #uxqRuntimeNextCard,.uxq-runtime-next-card,.uxq-final-primary-action{display:none!important}
      @media(max-width:760px){#uxqThreePartCompletion,#uxqStudentStudioFinalV2{width:calc(100% - 16px)!important}}
    `;
    document.head.appendChild(style);
  }

  function hero(){ return ROOT.querySelector('.panel .hero, .hero-card, .mission-card, article .hero'); }
  function tracker(){ return document.getElementById('uxqThreePartCompletion'); }
  function artifact(){ return ROOT.querySelector('.artifact[data-studio-practice-v1]'); }

  function missionRecord(){
    try { return window.UXQProgress?.get?.()?.missions?.[NODE.toLowerCase()] || {}; }
    catch (_) { return {}; }
  }
  function localMissionPassed(){
    const row = missionRecord();
    const history = Array.isArray(row.history) ? row.history : [];
    const results = [row.lastResult || {}, ...history];
    const stars = Math.max(number(row.bestStars), ...results.map(item => number(item.stars)));
    return Boolean(row.completed || results.some(item => item.passed === true) || stars >= 2);
  }

  function moveTrackerAfterHero(){
    const h = hero(), t = tracker();
    if (!h || !t) return;
    const heroContainer = h.closest('.panel,article,section') || h;
    const parent = heroContainer.parentNode;
    if (parent && t.previousElementSibling !== heroContainer) parent.insertBefore(t, heroContainer.nextSibling);
  }

  function status(){
    let mission = localMissionPassed() ? 'done' : 'unknown', studio = 'unknown', reflection = 'unknown';
    const cards = tracker()?.querySelectorAll('.uxq-3part__item') || [];
    cards.forEach((card,index) => {
      const state = card.getAttribute('data-state') || '';
      const done = state === 'done';
      if (index === 0 && mission !== 'done') mission = done ? 'done' : state;
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

  function normalizeSingleHeroAction(){
    const s = status();
    document.querySelectorAll('#uxqRuntimeNextCard,.uxq-runtime-next-card,.uxq-final-primary-action').forEach(el => el.remove());
    const h = hero();
    const actions = h?.querySelector('.actions');
    const primary = actions?.querySelector('a:first-child,button:first-child');
    if (!primary) return;
    Array.from(actions.querySelectorAll('a,button')).slice(2).forEach(el => el.dataset.uxqRuntimeHidden='1');
    if (s.mission !== 'done') {
      primary.textContent = `เริ่ม ${NODE} →`;
    } else if (s.studio !== 'done') {
      primary.textContent = 'ทำ Studio Practice ต่อ →';
      primary.onclick = event => { event.preventDefault(); artifact()?.scrollIntoView({behavior:'smooth',block:'start'}); window.UXQStudentStudioFinalAuthorityV2?.build?.(); };
    } else if (s.reflection !== 'done') {
      primary.textContent = 'เขียน Weekly Reflection →';
      primary.onclick = event => { event.preventDefault(); artifact()?.scrollIntoView({behavior:'smooth',block:'start'}); window.UXQStudentStudioFinalAuthorityV2?.build?.(); };
    } else {
      primary.textContent = `ทบทวน ${NODE} →`;
    }
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
    queued=false;
    installStyle();
    moveTrackerAfterHero();
    updateHeroProgress();
    normalizeSingleHeroAction();
    removeStudioDuplicateHeader();
  }
  function queue(){ if(queued)return; queued=true; requestAnimationFrame(apply); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',queue,{once:true}); else queue();
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true});
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored','uxq-studio-artifact-dispatched'].forEach(name=>window.addEventListener(name,queue));
  [200,700,1500,3000].forEach(ms=>setTimeout(queue,ms));
  window.UXQStudentRuntimePolishV1=Object.freeze({version:'20260729-STUDENT-RUNTIME-POLISH-V2',refresh:queue});
})();