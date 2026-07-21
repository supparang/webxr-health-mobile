/* =========================================================
   EAP Hero • Skill Mission Hub v136 Production
   UI-only production redesign.
   - Rebuilds S1-S15 navigation as readable mission cards.
   - Restyles the v135 four-skill dashboard without changing
     score, unlock, evidence, Sheet, or click authority.
   - Preserves all original buttons and their event handlers.
   ========================================================= */
(() => {
  'use strict';

  const VERSION = '20260721-EAP-SKILL-MISSION-HUB-V136-PRODUCTION';
  const STYLE_ID = 'eap-skill-mission-hub-v136-style';
  const NAV_ID = 'eap-skill-session-navigator-v136';
  const BODY_CLASS = 'eap-v136-skill-hub-ready';

  const SESSION_META = {
    1:  { icon:'🚀', title:'Academic Hero Awakening', week:1 },
    2:  { icon:'🦊', title:'Campus Explorer', week:1 },
    3:  { icon:'🔎', title:'Information Hunter', week:1 },
    4:  { icon:'🚩', title:'Keyword & Signal Words', week:2 },
    5:  { icon:'👻', title:'Main Idea Detective', week:2 },
    6:  { icon:'🧪', title:'Detail Collector', week:2 },
    7:  { icon:'🛡️', title:'Note Master', week:3 },
    8:  { icon:'🐍', title:'Paraphrase Protector', week:3 },
    9:  { icon:'🦇', title:'Reference Ranger', week:3 },
    10: { icon:'🐉', title:'Summary Builder', week:4 },
    11: { icon:'👹', title:'Table & Chart Reader', week:4 },
    12: { icon:'👾', title:'Graph Guardian', week:4 },
    13: { icon:'🌪️', title:'Skim & Scan Speedster', week:5 },
    14: { icon:'💀', title:'Argument Analyzer', week:5 },
    15: { icon:'👑', title:'Final Hero Challenge', week:5 }
  };

  const SKILL_DESC = {
    Reading: 'อ่านและจับประเด็นสำคัญจากข้อความอย่างเป็นระบบ',
    Listening: 'ฟังคำสำคัญ รายละเอียด และสัญญาณเชื่อมโยง',
    Writing: 'เขียนคำตอบให้ชัดเจน ตรงภารกิจ และมีเหตุผล',
    Speaking: 'สื่อสารใจความสำคัญอย่างชัดเจนและต่อเนื่อง'
  };

  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const visible = node => !!(node && node.isConnected && node.offsetParent !== null);

  function injectStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      :root{
        --eap136-bg:#071a2d;
        --eap136-panel:#0d2741;
        --eap136-panel2:#102e4c;
        --eap136-line:rgba(132,183,224,.22);
        --eap136-text:#f5fbff;
        --eap136-muted:#a9bfd2;
        --eap136-cyan:#25d8e9;
        --eap136-mint:#69efc5;
        --eap136-blue:#1678ef;
        --eap136-warn:#ffb547;
      }
      body.${BODY_CLASS}{background:radial-gradient(circle at 18% 0%,#10365b 0,#081d32 38%,#061523 100%)!important}
      body.${BODY_CLASS} #app{max-width:none!important;padding:20px clamp(16px,2.4vw,34px) 34px!important}

      #${NAV_ID}{margin:0 0 18px;color:var(--eap136-text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      #${NAV_ID} *{box-sizing:border-box}
      .eap136-nav-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:14px}
      .eap136-nav-kicker{font-size:12px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:var(--eap136-mint)}
      .eap136-nav-title{margin:3px 0 4px;font-size:clamp(24px,3vw,38px);line-height:1.06;font-weight:950;color:#fff}
      .eap136-nav-sub{font-size:13px;line-height:1.55;font-weight:700;color:var(--eap136-muted)}
      .eap136-current-pill{flex:0 0 auto;padding:10px 14px;border:1px solid rgba(105,239,197,.42);border-radius:14px;background:rgba(39,196,165,.10);font-size:12px;font-weight:900;color:#d9fff5}

      .eap136-session-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
      .eap136-session-card{position:relative;display:grid;grid-template-columns:auto 1fr;grid-template-areas:"num title" "num meta";column-gap:11px;align-items:center;min-width:0;min-height:88px;padding:13px 14px!important;border:1px solid var(--eap136-line)!important;border-radius:15px!important;background:linear-gradient(145deg,rgba(18,51,82,.96),rgba(10,35,58,.96))!important;color:#fff!important;text-align:left!important;box-shadow:none!important;overflow:hidden;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease!important}
      .eap136-session-card:hover{transform:translateY(-2px);border-color:rgba(73,213,231,.62)!important;box-shadow:0 12px 24px rgba(0,0,0,.22)!important}
      .eap136-session-card.is-current{border:2px solid var(--eap136-mint)!important;background:linear-gradient(135deg,rgba(18,129,191,.95),rgba(20,75,139,.95))!important;box-shadow:0 0 0 3px rgba(105,239,197,.08),0 14px 28px rgba(0,0,0,.24)!important}
      .eap136-session-num{grid-area:num;align-self:start;font-size:25px;line-height:1;font-weight:950;letter-spacing:-.03em;color:#fff}
      .eap136-session-title{grid-area:title;min-width:0;font-size:13px;line-height:1.28;font-weight:900;color:#f4f9fd}
      .eap136-session-meta{grid-area:meta;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px;min-width:0}
      .eap136-session-week{font-size:10px;font-weight:900;color:#8fb2cc;text-transform:uppercase;letter-spacing:.07em}
      .eap136-session-icon{font-size:18px;filter:drop-shadow(0 4px 6px rgba(0,0,0,.26))}
      .eap136-session-card.is-current .eap136-session-week{color:#caffef}
      .eap136-session-card[disabled],.eap136-session-card[aria-disabled="true"]{opacity:.58;filter:saturate(.62)}

      body.${BODY_CLASS} #eap-skill-dashboard-v135{margin:0!important;padding:20px!important;border:1px solid rgba(91,196,231,.34)!important;border-radius:22px!important;background:linear-gradient(145deg,#0d2945,#0a2138 60%,#081a2d)!important;box-shadow:0 22px 48px rgba(0,0,0,.28)!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-head{grid-template-columns:minmax(0,1fr) 250px!important;margin-bottom:18px!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-kicker{font-size:12px!important;color:var(--eap136-mint)!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-title{font-size:clamp(25px,2.8vw,38px)!important;letter-spacing:-.025em!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-sub{max-width:760px!important;font-size:13px!important;line-height:1.6!important;color:#b7cad9!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-progress{padding:15px!important;border-color:rgba(91,196,231,.3)!important;background:rgba(255,255,255,.055)!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-card{display:flex!important;flex-direction:column!important;align-items:stretch!important;min-height:242px!important;padding:15px!important;border-radius:17px!important;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035))!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-card.required{border-color:rgba(73,213,231,.66)!important;background:linear-gradient(180deg,rgba(42,157,198,.18),rgba(255,255,255,.035))!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-icon{width:48px!important;height:48px!important;flex:0 0 48px!important;border-radius:14px!important;font-size:23px!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-body{display:block!important;flex:1!important;margin-top:12px!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-name-row{min-height:29px!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-name{font-size:19px!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-status{min-height:58px!important;margin-top:7px!important;font-size:12px!important;line-height:1.5!important;color:#b4c7d7!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-score-row{margin-top:10px!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-action{width:100%!important;margin-top:12px!important;align-self:auto!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-start{width:100%!important;min-width:0!important;max-width:none!important;height:42px!important;border-radius:11px!important;background:linear-gradient(135deg,#137ce9,#1559d5)!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-card:not(.required) .eap135-start{background:linear-gradient(135deg,#12aa74,#07955f)!important}
      body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-footer{margin-top:14px!important;padding:12px 14px!important;border:1px solid rgba(132,183,224,.16)!important;background:rgba(255,255,255,.04)!important}
      .eap136-desc{margin:8px 0 0;font-size:11px;line-height:1.46;font-weight:700;color:#8fa9bd}

      @media(max-width:1180px){
        .eap136-session-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      @media(max-width:760px){
        body.${BODY_CLASS} #app{padding:12px 10px 26px!important}
        .eap136-nav-head{align-items:flex-start;flex-direction:column}
        .eap136-current-pill{width:100%}
        .eap136-session-grid{display:flex;overflow-x:auto;gap:9px;padding:2px 1px 10px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch}
        .eap136-session-card{flex:0 0 242px;scroll-snap-align:start;min-height:82px}
        body.${BODY_CLASS} #eap-skill-dashboard-v135{padding:15px!important;border-radius:18px!important}
        body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-head{grid-template-columns:1fr!important}
        body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-grid{grid-template-columns:1fr!important}
        body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-card{min-height:218px!important}
      }
      @media(max-width:430px){
        .eap136-nav-title{font-size:27px}
        .eap136-session-card{flex-basis:218px}
        body.${BODY_CLASS} #eap-skill-dashboard-v135 .eap135-title{font-size:25px!important}
      }
    `;
  }

  function currentSession() {
    const active = [...document.querySelectorAll('#app [aria-selected="true"],#app [aria-current="page"],#app .active')].filter(visible);
    for (const node of active) {
      const match = clean(node.textContent).match(/^S(1[0-5]|[1-9])\b/i);
      if (match) return Number(match[1]);
    }
    const dashboard = document.getElementById('eap-skill-dashboard-v135');
    const fromData = Number(dashboard?.dataset?.session || 0);
    if (fromData >= 1 && fromData <= 15) return fromData;
    const headings = [...document.querySelectorAll('#app h1,#app h2,#app h3,#app h4')].filter(visible);
    for (const heading of headings) {
      const match = clean(heading.textContent).match(/Session\s*:?\s*(1[0-5]|[1-9])\b/i);
      if (match) return Number(match[1]);
    }
    return 0;
  }

  function sessionButtons() {
    const candidates = [...document.querySelectorAll('#app button,#app a[href],[role="button"]')]
      .filter(node => visible(node) && !node.closest(`#${NAV_ID}`) && !node.closest('#eap-skill-dashboard-v135'));
    const map = new Map();
    for (const node of candidates) {
      const match = clean(node.textContent).match(/^S(1[0-5]|[1-9])(?:\s|$)/i);
      if (!match) continue;
      const sid = Number(match[1]);
      if (!map.has(sid)) map.set(sid, node);
    }
    return [...map.entries()].sort((a,b) => a[0] - b[0]);
  }

  function commonHost(nodes) {
    if (!nodes.length) return null;
    let host = nodes[0].parentElement;
    while (host && host.id !== 'app') {
      if (nodes.every(node => host.contains(node))) return host;
      host = host.parentElement;
    }
    return null;
  }

  function buildNavigator() {
    const entries = sessionButtons();
    if (entries.length < 10) return false;
    const nodes = entries.map(([,node]) => node);
    const host = commonHost(nodes);
    if (!host) return false;

    const sid = currentSession() || 1;
    document.getElementById(NAV_ID)?.remove();

    const section = document.createElement('section');
    section.id = NAV_ID;
    section.innerHTML = `
      <div class="eap136-nav-head">
        <div>
          <div class="eap136-nav-kicker">EAP Hero • Session Path</div>
          <h1 class="eap136-nav-title">EAP Skill Mission Hub</h1>
          <div class="eap136-nav-sub">เลือก Session เพื่อฝึก Reading, Listening, Writing และ Speaking โดยใช้ Skill บังคับเป็นหลักฐานสำหรับการปลดล็อกเส้นทางถัดไป</div>
        </div>
        <div class="eap136-current-pill">กำลังดู Session ${sid}: ${SESSION_META[sid]?.title || ''}</div>
      </div>
      <div class="eap136-session-grid"></div>`;

    const grid = section.querySelector('.eap136-session-grid');
    entries.forEach(([num,node]) => {
      const meta = SESSION_META[num];
      node.classList.add('eap136-session-card');
      node.classList.toggle('is-current', num === sid);
      if (num === sid) node.setAttribute('aria-current','page');
      node.innerHTML = `
        <span class="eap136-session-num">S${num}</span>
        <span class="eap136-session-title">${meta.icon} ${meta.title}</span>
        <span class="eap136-session-meta"><span class="eap136-session-week">Week ${meta.week}</span><span class="eap136-session-icon">${num === sid ? 'CURRENT' : '★'}</span></span>`;
      grid.appendChild(node);
    });

    host.parentElement?.insertBefore(section, host);
    host.style.display = 'none';
    host.dataset.eap136Hidden = 'true';
    return true;
  }

  function enhanceSkillCards() {
    const dashboard = document.getElementById('eap-skill-dashboard-v135');
    if (!dashboard) return false;
    dashboard.querySelectorAll('.eap135-card').forEach(card => {
      const skill = clean(card.dataset.skill || card.querySelector('.eap135-name')?.textContent);
      const body = card.querySelector('.eap135-body');
      if (!body || body.querySelector('.eap136-desc')) return;
      const desc = document.createElement('p');
      desc.className = 'eap136-desc';
      desc.textContent = SKILL_DESC[skill] || 'ฝึกทักษะภาษาอังกฤษตามภารกิจของ Session';
      const status = body.querySelector('.eap135-status');
      body.insertBefore(desc, status || null);
    });
    return true;
  }

  function render() {
    injectStyle();
    const navReady = buildNavigator();
    const dashboardReady = enhanceSkillCards();
    if (navReady || dashboardReady) {
      document.body.classList.add(BODY_CLASS);
      document.documentElement.dataset.eapSkillHubVersion = VERSION;
    }
  }

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('load', () => { render(); setTimeout(render, 500); setTimeout(render, 1400); });
  document.addEventListener('click', event => {
    if (event.target.closest('.eap136-session-card,#eap-skill-dashboard-v135 button,#eap-skill-dashboard-v135 a')) {
      setTimeout(render, 120);
      setTimeout(render, 650);
    }
  }, true);

  render();
  window.EAPSkillMissionHubV136 = { version: VERSION, render };
})();
