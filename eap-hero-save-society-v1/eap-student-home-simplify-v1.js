/* =========================================================
   EAP Hero Student Home Simplifier v5 + 15-Week Roadmap
   Student-facing home: one primary path, no duplicate actions.
   Adds route-aware S1-S15 + B1-B5 overview from content pack.
========================================================= */
(() => {
  'use strict';

  const VERSION = 'v20260708-STUDENT-HOME-15WEEK-ROADMAP-V1';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const ROADMAP_ID = 'eap-student-15week-roadmap';
  const STYLE_ID = 'eap-student-15week-roadmap-style';

  const HIDE_BUTTON_TEXT = [
    /^map$/i,
    /^เริ่ม\s*\/\s*ตั้งค่า\s*player$/i,
    /^student\s*safe\s*start$/i,
    /^เข้า\s*campus\s*map$/i,
    /^reset\s*local\s*progress$/i
  ];

  const textOf = (el) => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const isExact = (rx, value) => rx.test(value);
  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');

  function pack(){
    const data = window[PACK_NAME];
    return data && Array.isArray(data.routes) ? data : null;
  }

  function byRouteId(routeId){
    const data = pack();
    const key = clean(routeId).toUpperCase();
    if (!data || !key) return null;
    return data.routes.find(route => clean(route.routeId).toUpperCase() === key) || null;
  }

  function routeOrder(){
    const data = pack();
    if (!data) return [];
    const order = Array.isArray(data.routeOrder) && data.routeOrder.length
      ? data.routeOrder
      : data.routes.map(route => route.routeId);
    return order.map(id => byRouteId(id)).filter(Boolean);
  }

  function routeIdFromUrl(){
    const params = new URLSearchParams(location.search);
    const raw = clean(params.get('session') || params.get('route') || params.get('stage') || '');
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
  }

  function routeIdFromStorage(){
    const keys = ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];
    for (const key of keys) {
      try {
        const raw = clean(localStorage.getItem(key));
        if (raw) return /^\d+$/.test(raw) ? 'S' + raw : raw.toUpperCase();
      } catch(error) {}
    }
    return '';
  }

  function currentRoute(){
    return byRouteId(routeIdFromUrl()) || byRouteId(routeIdFromStorage()) || byRouteId('S1');
  }

  function sessionNumber(route){
    const match = clean(route && route.routeId).match(/^S(\d+)$/i);
    return match ? Number(match[1]) : 0;
  }

  function skillContractLabel(route){
    if (!route || !route.skillContract) return '';
    const items = Object.keys(route.skillContract)
      .filter(skill => ['Core','Support','Integrated'].includes(route.skillContract[skill]))
      .map(skill => skill.charAt(0).toUpperCase() + skill.slice(1) + ' ' + route.skillContract[skill]);
    return items.join(' + ');
  }

  function hide(el) {
    if (!el || el.dataset.studentHomeHidden === '1') return;
    el.dataset.studentHomeHidden = '1';
    el.style.setProperty('display', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
  }

  function isHomeVisible() {
    const bodyText = document.body ? document.body.innerText : '';
    return /EAP Hero:\s*Save the Society/i.test(bodyText) && /Player Status/i.test(bodyText);
  }

  function simplifyButtons() {
    const controls = [...document.querySelectorAll('button, a.btn, [role="button"]')];
    controls.forEach((button) => {
      if (HIDE_BUTTON_TEXT.some((rx) => isExact(rx, textOf(button)))) hide(button);
    });
    const reports = controls.filter((button) =>
      /^my\s*learning\s*report$/i.test(textOf(button)) && button.dataset.studentHomeHidden !== '1'
    );
    reports.slice(1).forEach(hide);
  }

  function simplifyStatus() {
    const title = [...document.querySelectorAll('h1,h2,h3,strong,div')]
      .find((el) => textOf(el) === 'Player Status');
    if (!title) return;
    const panel = title.closest('section, aside, .panel, .card, div');
    if (!panel) return;
    [...panel.querySelectorAll('button')].forEach(hide);
    [...panel.querySelectorAll('*')].forEach((el) => {
      const text = textOf(el);
      if (!text || el.children.length) return;
      if (/^(Society Saver|Rank|Coins|Daily Streak|ยังไม่มี Badge)/i.test(text)) {
        const block = el.closest('.stat, .metric, .card, div');
        if (block && block !== panel) hide(block);
      }
    });
  }

  function roadmapStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROADMAP_ID}{
        margin:14px auto 18px;
        max-width:1040px;
        border-radius:22px;
        background:linear-gradient(135deg,#ffffff,#f1fbff);
        border:1px solid rgba(120,150,180,.35);
        box-shadow:0 12px 32px rgba(8,25,45,.13);
        color:#102033;
        font-family:Arial,'Noto Sans Thai',sans-serif;
        overflow:hidden;
      }
      #${ROADMAP_ID} *{box-sizing:border-box}
      #${ROADMAP_ID} .rm-head{padding:15px 16px;background:linear-gradient(135deg,#102033,#17375e);color:#fff}
      #${ROADMAP_ID} .rm-head h2{margin:0;font-size:20px;line-height:1.2;font-weight:950;color:#fff}
      #${ROADMAP_ID} .rm-head p{margin:6px 0 0;font-size:13px;line-height:1.4;opacity:.9}
      #${ROADMAP_ID} .rm-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;padding:12px 14px;background:#edf8ff;border-bottom:1px solid rgba(120,150,180,.25)}
      #${ROADMAP_ID} .rm-stat{border-radius:14px;background:#fff;padding:10px;border:1px solid #dbe7f2;font-weight:900;line-height:1.35}
      #${ROADMAP_ID} .rm-stat small{display:block;color:#64748b;font-weight:800;font-size:11px;margin-top:3px}
      #${ROADMAP_ID} .rm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;padding:12px 14px 14px}
      #${ROADMAP_ID} .rm-card{border:1px solid #dbe7f2;border-radius:16px;background:#fff;padding:11px;display:grid;gap:7px;min-height:132px}
      #${ROADMAP_ID} .rm-card.active{border-color:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.12)}
      #${ROADMAP_ID} .rm-card.boss{background:linear-gradient(135deg,#fff7e6,#ffffff);border-color:#fde68a}
      #${ROADMAP_ID} .rm-kicker{font-size:11px;font-weight:950;color:#64748b;text-transform:uppercase;letter-spacing:.02em}
      #${ROADMAP_ID} .rm-title{font-size:15px;font-weight:950;line-height:1.25;color:#17375e}
      #${ROADMAP_ID} .rm-focus{font-size:12px;line-height:1.35;color:#475569}
      #${ROADMAP_ID} .rm-contract{font-size:11px;line-height:1.35;color:#087f5b;font-weight:900}
      #${ROADMAP_ID} button{border:0;border-radius:12px;padding:9px 10px;font-weight:950;cursor:pointer;background:#e8fbf3;color:#087f5b;font-size:12px;line-height:1.15;min-height:38px}
      #${ROADMAP_ID} .boss button{background:#fff5d6;color:#8a5700}
      #${ROADMAP_ID} .rm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-self:end}
      #${ROADMAP_ID} .rm-foot{padding:0 14px 14px;color:#53677f;font-size:12px;line-height:1.4;font-weight:800}
      @media(max-width:760px){
        #${ROADMAP_ID}{margin:10px 8px 16px;border-radius:18px;max-width:calc(100vw - 16px)}
        #${ROADMAP_ID} .rm-head{padding:13px 13px}
        #${ROADMAP_ID} .rm-head h2{font-size:18px}
        #${ROADMAP_ID} .rm-head p{font-size:12px}
        #${ROADMAP_ID} .rm-summary{grid-template-columns:1fr 1fr;padding:10px;gap:7px}
        #${ROADMAP_ID} .rm-stat{font-size:13px;padding:9px;border-radius:13px}
        #${ROADMAP_ID} .rm-grid{grid-template-columns:1fr;padding:10px;gap:8px;max-height:none}
        #${ROADMAP_ID} .rm-card{min-height:0;border-radius:14px;padding:10px;gap:6px}
        #${ROADMAP_ID} .rm-title{font-size:14px}
        #${ROADMAP_ID} .rm-focus{font-size:12px}
        #${ROADMAP_ID} .rm-actions{grid-template-columns:1fr 1fr;gap:7px}
        #${ROADMAP_ID} button{font-size:12px;min-height:38px;padding:8px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  function anchorForRoadmap(){
    const app = document.getElementById('app') || document.body;
    const title = [...app.querySelectorAll('h1,h2')].find(el => /EAP Hero:\s*Save the Society/i.test(textOf(el)));
    const card = title && title.closest('section,div,main');
    return { app, anchor: card || title || app.firstElementChild };
  }

  function renderRoadmap(){
    const data = pack();
    const routes = routeOrder();
    if (!data || !routes.length) return '';
    const active = currentRoute();
    const normalCount = routes.filter(r => r.routeType !== 'boss_gate').length;
    const bossCount = routes.filter(r => r.routeType === 'boss_gate').length;
    const activeLabel = active && active.routeType === 'boss_gate'
      ? active.routeId + ' Boss Gate'
      : 'Week ' + sessionNumber(active) + ' / ' + (active ? active.routeId : 'S1');

    const cards = routes.map(route => {
      const isBoss = route.routeType === 'boss_gate';
      const n = sessionNumber(route);
      const kicker = isBoss ? route.routeId + ' · Boss Gate' : 'Week ' + n + ' · ' + route.routeId;
      const activeCls = active && active.routeId === route.routeId ? ' active' : '';
      const bossCls = isBoss ? ' boss' : '';
      const contract = isBoss ? 'Integrated: Reading + Listening + Writing + Speaking' : skillContractLabel(route);
      const btn1 = isBoss ? 'เปิด Boss Gate' : 'เข้า Week ' + n;
      return `
        <article class="rm-card${activeCls}${bossCls}" data-eap-roadmap-card="${esc(route.routeId)}">
          <div class="rm-kicker">${esc(kicker)}</div>
          <div class="rm-title">${esc(route.title || '')}</div>
          <div class="rm-focus">${esc(route.focus || route.subtitle || '')}</div>
          <div class="rm-contract">${esc(contract)}</div>
          <div class="rm-actions">
            <button type="button" data-eap-roadmap-route="${esc(route.routeId)}">▶ ${esc(btn1)}</button>
            <button type="button" data-eap-roadmap-brief="${esc(route.routeId)}">📘 Brief</button>
          </div>
        </article>`;
    }).join('');

    return `
      <div class="rm-head">
        <h2>🧭 EAP Hero 15-Week Learning Path</h2>
        <p>เนื้อหาครบทั้ง 15 Week พร้อม Boss Gate 5 จุด ไม่ใช่เฉพาะคาบแรก — ผู้เรียนเลือกดู Week/Session ได้ชัดเจน และครูใช้สอนต่อ Week 2 ได้ทันที</p>
      </div>
      <div class="rm-summary">
        <div class="rm-stat">${esc(normalCount)} Weeks / Sessions<small>S1-S15</small></div>
        <div class="rm-stat">${esc(bossCount)} Boss Gates<small>B1-B5 หลังกลุ่ม Session</small></div>
        <div class="rm-stat">A2-B1+<small>Year 2 university learners</small></div>
        <div class="rm-stat">ตอนนี้: ${esc(activeLabel)}<small>อิงจาก route/progress ล่าสุด</small></div>
      </div>
      <div class="rm-grid">${cards}</div>
      <div class="rm-foot">หมายเหตุ: Core + Support ใช้ตัดผ่าน Session ปกติ ส่วน Exposure เป็นหลักฐานฝึกเสริม; Boss Gate รวม 4 Skills และ Speaking ส่ง Teacher Review ตาม contract</div>
    `;
  }

  function insertRoadmap(){
    if (!isHomeVisible() || !pack()) return;
    roadmapStyle();
    const { app, anchor } = anchorForRoadmap();
    let panel = document.getElementById(ROADMAP_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = ROADMAP_ID;
      panel.setAttribute('aria-label','EAP Hero 15 Week Learning Path');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
      else app.insertBefore(panel, app.firstChild);
    }
    const key = VERSION + '|' + (currentRoute() ? currentRoute().routeId : '');
    if (panel.dataset.key !== key || !panel.innerHTML) {
      panel.dataset.key = key;
      panel.innerHTML = renderRoadmap();
    }
  }

  function rememberRoute(route){
    if (!route) return;
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', route.routeId);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', route.routeId);
      const n = sessionNumber(route);
      if (n) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(n));
    } catch(error) {}
  }

  function openRoute(routeId, briefOnly){
    const route = byRouteId(routeId);
    if (!route) return;
    rememberRoute(route);
    try {
      if (briefOnly) {
        if (window.EAPHeroContentBridge && typeof window.EAPHeroContentBridge.refresh === 'function') {
          window.EAPHeroContentBridge.refresh();
        }
        const panel = document.getElementById('eap-session-content-brief');
        if (panel) {
          panel.scrollIntoView({behavior:'smooth', block:'start'});
          return;
        }
      }

      const n = sessionNumber(route);
      if (route.routeType !== 'boss_gate' && window.EAPHero && typeof window.EAPHero.skillHub === 'function') {
        window.EAPHero.skillHub(n || 1);
        return;
      }
      if (route.routeType === 'boss_gate' && window.EAPHero && typeof window.EAPHero.startGateBoss === 'function') {
        window.EAPHero.startGateBoss(route.routeId);
        return;
      }
      if (window.EAPHero && typeof window.EAPHero.map === 'function') {
        window.EAPHero.map();
        return;
      }
    } catch(error) {
      console.warn('[EAP Home Roadmap] openRoute failed', error);
    }
  }

  function onRoadmapClick(event){
    const routeBtn = event.target.closest('[data-eap-roadmap-route]');
    if (routeBtn) {
      event.preventDefault();
      openRoute(routeBtn.dataset.eapRoadmapRoute, false);
      return;
    }
    const briefBtn = event.target.closest('[data-eap-roadmap-brief]');
    if (briefBtn) {
      event.preventDefault();
      openRoute(briefBtn.dataset.eapRoadmapBrief, true);
    }
  }

  function simplifyHome() {
    if (!isHomeVisible()) return;
    simplifyButtons();
    simplifyStatus();
    insertRoadmap();
  }

  function appendScript(id, src, onload) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    if (typeof onload === 'function') script.onload = onload;
    document.head.appendChild(script);
  }

  function loadPortfolioTimestampGuard() {
    appendScript(
      'eap-portfolio-timestamp-guard-loader',
      './eap-portfolio-timestamp-fix-v1.js?v=20260704-portfolio-time-v1'
    );
  }

  function loadA2B1TaskScaffold() {
    appendScript(
      'eap-a2b1-task-scaffold-v2-loader',
      './eap-a2b1-task-scaffold-v2.js?v=20260704-a2b1-scaffold-v2',
      () => appendScript(
        'eap-speaking-bank-v2-loader',
        './eap-speaking-bank-v2.js?v=20260704-speaking-bank-v2'
      )
    );
  }

  function loadBossGateV2() {
    /* Preserve the core Boss Clash callback when an old cache has loaded the
       earlier gate file before the current four-skill version arrives. */
    const coreStart = window.EAPHero &&
      (window.EAPHero.__bossFourSkillOriginalStart || window.EAPHero.startGateBoss);
    if (coreStart) window.__EAP_CORE_BOSS_START_V2 = coreStart;

    appendScript(
      'eap-boss-four-skill-v2-loader',
      './eap-boss-four-skill-gate-v1.js?v=20260704-boss4skill-v2',
      () => {
        if (window.EAPHero && window.__EAP_CORE_BOSS_START_V2) {
          window.EAPHero.__bossFourSkillOriginalStart = window.__EAP_CORE_BOSS_START_V2;
        }
      }
    );
    appendScript(
      'eap-boss-audio-v2-loader',
      './eap-boss-audio-compat-v2.js?v=20260704-boss-audio-v2'
    );
  }

  function start() {
    loadPortfolioTimestampGuard();
    loadA2B1TaskScaffold();
    document.addEventListener('click', onRoadmapClick, true);
    simplifyHome();
    const observer = new MutationObserver(() => simplifyHome());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('load', () => setTimeout(loadBossGateV2, 0), { once: true });
    window.EAPStudentHomeRoadmap = {
      version: VERSION,
      refresh: simplifyHome,
      currentRoute: currentRoute,
      openRoute: openRoute
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();