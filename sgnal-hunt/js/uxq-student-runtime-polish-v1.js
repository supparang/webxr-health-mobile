/* CSAI2601 UX Quest • Unified Student Runtime Polish v3
 * Production template for W1-W15 and B1-B4.
 * Owns hierarchy, visual progress and the single hero CTA.
 * Google Sheet remains the only official completion authority.
 */
(() => {
  'use strict';
  const q = new URLSearchParams(location.search || '');
  if (q.get('contentPreview') === '1' || /^content-preview/i.test(q.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE = String(q.get('node') || q.get('id') || 'W1').toUpperCase();
  const STYLE_ID = 'uxq-student-runtime-polish-v3-style';
  let queued = false;
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

  function installStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #uxqStudentRuntimeBanner{margin-bottom:16px!important}

      /* Compact hero: one course identity, one progress block and one CTA row. */
      .panel .hero,.hero-card,.mission-card{padding-top:clamp(24px,4vw,44px)!important;padding-bottom:clamp(24px,4vw,42px)!important}
      .panel .hero h1,.hero-card h1,.mission-card h1{font-size:clamp(2.35rem,5.5vw,4.7rem)!important;line-height:1.02!important;margin-bottom:14px!important}
      .panel .hero .cards,.hero-card .cards,.mission-card .cards{margin-top:18px!important;margin-bottom:14px!important}
      .uxq-local-pass-copy{display:none!important}

      .uxq-runtime-quest-progress{margin:16px 0!important;padding:15px 16px!important;border-radius:16px!important;background:rgba(5,20,45,.62)!important;border:1px solid rgba(110,231,255,.30)!important;color:#e5f2ff!important}
      .uxq-runtime-progress-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:10px}
      .uxq-runtime-progress-head strong{font-size:1rem}.uxq-runtime-progress-head span{font-weight:900;color:#9eeeff}
      .uxq-runtime-progress-track{height:10px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden}
      .uxq-runtime-progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#67e8f9,#6ee7a8);transition:width .25s ease}
      .uxq-runtime-progress-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:11px}
      .uxq-runtime-progress-step{padding:8px 9px;border-radius:11px;border:1px solid rgba(184,205,238,.18);background:rgba(2,12,30,.35);font-size:.82rem;color:#aebedb;text-align:center}
      .uxq-runtime-progress-step[data-state='done']{color:#c9fbd8;border-color:rgba(74,222,128,.55);background:rgba(34,197,94,.11)}
      .uxq-runtime-progress-step[data-state='next']{color:#d8f7ff;border-color:rgba(96,165,250,.62);background:rgba(59,130,246,.13)}
      .uxq-runtime-progress-step[data-state='locked']{opacity:.68}
      .uxq-runtime-progress-next{margin-top:10px;color:#bfd0e9;font-size:.9rem}

      /* Tracker follows the hero and reflects the learning state clearly. */
      #uxqThreePartCompletion{width:min(1120px,calc(100% - 24px))!important;margin:18px auto!important}
      #uxqThreePartCompletion .uxq-3part__item[data-runtime-state='done'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='done']{border-color:rgba(74,222,128,.78)!important;background:rgba(34,197,94,.13)!important}
      #uxqThreePartCompletion .uxq-3part__item[data-runtime-state='next']{border-color:rgba(96,165,250,.72)!important;background:rgba(59,130,246,.12)!important}
      #uxqThreePartCompletion .uxq-3part__item[data-runtime-state='locked']{border-color:rgba(148,163,184,.32)!important;background:rgba(71,85,105,.08)!important;opacity:.78}
      #uxqThreePartCompletion .uxq-3part__item[data-state='pending'],
      #uxqThreePartCompletion .uxq-3part__item[data-state='ready']{border-color:rgba(250,204,21,.68)!important;background:rgba(250,204,21,.10)!important}
      #uxqThreePartCompletion .uxq-3part__item[data-state='retry']{border-color:rgba(248,113,113,.58)!important;background:rgba(239,68,68,.08)!important}

      /* Studio is the next learning section, not a second hero. */
      .artifact[data-studio-practice-v1] .studio-head{display:none!important}
      #uxqStudentStudioFinalV2{width:min(920px,calc(100% - 24px))!important;margin:20px auto!important}
      #uxqStudentStudioFinalV2 .ssf2-hero,#uxqStudentStudioFinalV2 .ssf2-intro,#uxqStudentStudioFinalV2 .ssf2-title-duplicate{display:none!important}
      #uxqStudentStudioFinalV2 .ssf2-shell{border-radius:20px!important}

      [data-uxq-runtime-hidden='1'],#uxqRuntimeNextCard,.uxq-runtime-next-card,.uxq-final-primary-action{display:none!important}
      @media(max-width:760px){
        #uxqThreePartCompletion,#uxqStudentStudioFinalV2{width:calc(100% - 16px)!important}
        .uxq-runtime-progress-steps{grid-template-columns:1fr!important}
        .panel .hero h1,.hero-card h1,.mission-card h1{font-size:clamp(2.05rem,11vw,3.3rem)!important}
      }
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
      if (index === 0 && mission !== 'done') mission = state === 'done' ? 'done' : state;
      if (index === 1) studio = state === 'done' ? 'done' : state;
      if (index === 2) reflection = state === 'done' ? 'done' : state;
    });
    return {mission,studio,reflection};
  }

  function decorateTracker(){
    const s = status();
    const cards = tracker()?.querySelectorAll('.uxq-3part__item') || [];
    cards.forEach((card,index) => card.removeAttribute('data-runtime-state'));
    if (cards[0]) cards[0].dataset.runtimeState = s.mission === 'done' ? 'done' : 'next';
    if (cards[1]) cards[1].dataset.runtimeState = s.studio === 'done' ? 'done' : s.mission === 'done' ? 'next' : 'locked';
    if (cards[2]) cards[2].dataset.runtimeState = s.reflection === 'done' ? 'done' : s.studio === 'done' ? 'next' : 'locked';
  }

  function updateHeroProgress(){
    const h = hero(); if (!h) return;
    const s = status();
    let box = h.querySelector('.uxq-runtime-quest-progress');
    if (!box) {
      box = document.createElement('div');
      box.className = 'uxq-runtime-quest-progress';
      const actions = h.querySelector('.actions');
      h.insertBefore(box, actions || null);
    }
    const states = [s.mission,s.studio,s.reflection];
    const complete = states.filter(x => x === 'done').length;
    const percent = Math.round(complete / 3 * 100);
    const nextIndex = complete >= 3 ? -1 : complete;
    const labels = ['Mission','Studio Practice','Weekly Reflection'];
    const next = nextIndex < 0 ? 'ครบทั้ง 3 ส่วนแล้ว' : labels[nextIndex];
    box.innerHTML = `
      <div class="uxq-runtime-progress-head"><strong>Quest Progress</strong><span>${percent}%</span></div>
      <div class="uxq-runtime-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="uxq-runtime-progress-fill" style="width:${percent}%"></div></div>
      <div class="uxq-runtime-progress-steps">
        ${labels.map((label,index) => `<div class="uxq-runtime-progress-step" data-state="${index < complete ? 'done' : index === nextIndex ? 'next' : 'locked'}">${index < complete ? '✓ ' : index === nextIndex ? '→ ' : '○ '}${label}</div>`).join('')}
      </div>
      <div class="uxq-runtime-progress-next">ขั้นตอนถัดไป: <strong>${next}</strong></div>`;
  }

  function removeRedundantHeroCopy(){
    const h = hero(); if (!h) return;
    h.querySelectorAll('p,div,span').forEach(el => {
      if (el.children.length) return;
      const text = String(el.textContent || '').replace(/\s+/g,' ').trim();
      if (/^ผ่าน Mission ในเครื่อง|^มีผลผ่านในเครื่อง|ทำ Studio Practice และ Weekly Reflection ต่อ/i.test(text)) {
        el.classList.add('uxq-local-pass-copy');
      }
    });
  }

  function normalizeSingleHeroAction(){
    const s = status();
    document.querySelectorAll('#uxqRuntimeNextCard,.uxq-runtime-next-card,.uxq-final-primary-action').forEach(el => el.remove());
    const h = hero();
    const actions = h?.querySelector('.actions');
    const controls = Array.from(actions?.querySelectorAll('a,button') || []);
    const primary = controls[0];
    if (!primary) return;
    controls.slice(2).forEach(el => el.dataset.uxqRuntimeHidden='1');
    primary.onclick = null;
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
    const seen = new Set();
    studio.querySelectorAll('h1,h2,h3').forEach(el => {
      const text = String(el.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if (!text) return;
      if (seen.has(text)) el.dataset.uxqRuntimeHidden = '1'; else seen.add(text);
    });
  }

  function apply(){
    queued=false;
    installStyle();
    moveTrackerAfterHero();
    decorateTracker();
    updateHeroProgress();
    removeRedundantHeroCopy();
    normalizeSingleHeroAction();
    removeStudioDuplicateHeader();
  }
  function queue(){ if(queued)return; queued=true; requestAnimationFrame(apply); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',queue,{once:true}); else queue();
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true});
  ['uxq-progress-updated','uxq-mission-completed','uxq-sheet-progress-restored','uxq-studio-artifact-dispatched'].forEach(name=>window.addEventListener(name,queue));
  [200,700,1500,3000].forEach(ms=>setTimeout(queue,ms));
  window.UXQStudentRuntimePolishV1=Object.freeze({version:'20260729-STUDENT-RUNTIME-POLISH-V3',refresh:queue});
})();