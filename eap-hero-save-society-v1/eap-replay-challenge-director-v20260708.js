/* =========================================================
   EAP Hero Replay Challenge Director v20260708
   V2: lock Source/Scenario per route so it does not change every refresh.
   - Applies to S1-S15 + B1-B5.
   - Shows concise replay challenge; source detail is collapsed.
   - Scenario changes only when the learner/teacher taps "สุ่ม Scenario ใหม่".
   - Does not change scoring, pass/fail, evidence, Sheet transport, or core runtime.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-REPLAY-CHALLENGE-DIRECTOR-S15-B5-V2-SCENARIO-LOCK';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const BANK_NAME = 'EAP_GOLD_AUTHORED_BANK';
  const PANEL_ID = 'eap-replay-challenge-panel';
  const STYLE_ID = 'eap-replay-challenge-style';
  const SKILLS = ['reading','listening','writing','speaking'];

  const MODES = [
    { id:'evidence-hunt', label:'Evidence Hunt', th:'ล่าหลักฐาน', pressure:'จับ main point + evidence ให้ตรง source', bonus:'Evidence Combo เมื่ออ้างหลักฐานไม่เกินจริง' },
    { id:'trap-detector', label:'Trap Detector', th:'จับหลุมพราง', pressure:'แยก claim / evidence / limitation และหลีกเลี่ยงตัวลวง', bonus:'Trap Break เมื่อไม่เดาจากตัวเลือกที่ยาวหรือดูหรู' },
    { id:'speed-clarity', label:'Speed + Clarity', th:'เร็วแต่ชัด', pressure:'ตอบให้ทันเวลา แต่ต้องมีเหตุผลจาก source', bonus:'Clarity Streak เมื่อคำตอบสั้น ชัด และมีเหตุผล' },
    { id:'transfer-task', label:'Transfer Task', th:'ใช้กับโจทย์ใหม่', pressure:'นำ frame ไปใช้กับสถานการณ์ใหม่ ไม่จำคำตอบเดิม', bonus:'Transfer Star เมื่อใช้คำศัพท์/กรอบภาษาใหม่ได้ถูกบริบท' },
    { id:'boss-surge', label:'Boss Surge', th:'แรงกดดัน Boss', pressure:'รวมหลาย skill ในรอบเดียว: evidence + response + reflection', bonus:'Boss Shield เมื่อระบุ limitation หรือ next action ได้' }
  ];

  const SKILL_CHALLENGES = {
    reading: [
      'Find the main idea before looking at choices.',
      'Underline one evidence phrase and one limitation.',
      'Reject the option that is true but not the main point.',
      'Explain why the longest option is not automatically correct.'
    ],
    listening: [
      'Listen for signposts: first, however, therefore, in conclusion.',
      'Catch one number/name/action and connect it with the main point.',
      'Replay mentally before choosing; do not chase every word.',
      'Separate example from conclusion.'
    ],
    writing: [
      'Use point + evidence + limitation in 70-90 words.',
      'Paraphrase the source instead of copying long phrases.',
      'Add one connector: because, however, therefore, or in contrast.',
      'Revise one sentence to be more academic and cautious.'
    ],
    speaking: [
      'Use opening + one evidence point + closing within the target time.',
      'Select one useful frame, then change the content to fit the source.',
      'Avoid reading a full script; speak from keywords.',
      'End with one next academic action.'
    ]
  };

  const BOSS_RULES = {
    B1: 'Foundation Boss: S1-S3 · goal + vocabulary + main idea. Win by giving one clear academic action.',
    B2: 'Source Boss: S4-S6 · keyword scan + evidence check + short summary. Win by avoiding unsupported claims.',
    B3: 'Writing Control Boss: S7-S9 · tone + paragraph structure + evidence paragraph. Win by writing with clear organization.',
    B4: 'Communication Ethics Boss: S10-S12 · data + email + citation. Win by using cautious language and source credit.',
    B5: 'Final Integration Boss: S13-S15 · listening + presentation + final response. Win by integrating evidence, reflection, and next action.'
  };

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function pack(){
    const data = window[PACK_NAME];
    return data && Array.isArray(data.routes) ? data : null;
  }

  function bank(){
    const data = window[BANK_NAME];
    return data && data.sessions ? data.sessions : {};
  }

  function byRouteId(routeId){
    const data = pack();
    const key = clean(routeId).toUpperCase();
    if (!data || !key) return null;
    return data.routes.find(route => clean(route.routeId).toUpperCase() === key) || null;
  }

  function routeNumber(route){
    const m = clean(route && route.routeId).match(/^S(\d+)$/i);
    return m ? Number(m[1]) : 0;
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

  function routeIdFromDom(){
    const text = clean(document.body && document.body.textContent || '');
    const session = text.match(/Session\s*(1[0-5]|[1-9])/i);
    if (session) return 'S' + Number(session[1]);
    const boss = text.match(/\b(B[1-5])\b/i);
    if (boss) return boss[1].toUpperCase();
    const data = pack();
    if (!data) return '';
    const lower = text.toLowerCase();
    const found = data.routes.find(route => {
      const title = clean(route.title).toLowerCase();
      const rid = clean(route.routeId).toLowerCase();
      return (title && lower.includes(title)) || (rid && new RegExp('\\b' + rid + '\\b','i').test(lower));
    });
    return found ? found.routeId : '';
  }

  function currentRoute(){
    return byRouteId(routeIdFromUrl()) || byRouteId(routeIdFromDom()) || byRouteId(routeIdFromStorage()) || byRouteId('S1');
  }

  function routeSources(route){
    const n = routeNumber(route);
    const sources = n && bank()[String(n)] && bank()[String(n)].sources;
    return Array.isArray(sources) ? sources : [];
  }

  function seed(route){
    const day = Math.floor(Date.now() / 86400000);
    const base = clean(route && route.routeId).split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return day + base;
  }

  function pickMode(route){
    if (!route) return MODES[0];
    if (route.routeType === 'boss_gate') return MODES[4];
    return MODES[seed(route) % 4];
  }

  function historyKey(route){ return 'EAP_REPLAY_SOURCE_HISTORY_' + clean(route && route.routeId || 'S1'); }
  function activeSourceKey(route){ return 'EAP_REPLAY_ACTIVE_SOURCE_' + clean(route && route.routeId || 'S1'); }

  function getHistory(route){
    try {
      const parsed = JSON.parse(localStorage.getItem(historyKey(route)) || '[]');
      return Array.isArray(parsed) ? parsed.slice(-6) : [];
    } catch(error) { return []; }
  }

  function setHistory(route, list){
    try { localStorage.setItem(historyKey(route), JSON.stringify(list.slice(-6))); } catch(error) {}
  }

  function pickFreshSource(route){
    const sources = routeSources(route);
    if (!sources.length) return null;
    const history = getHistory(route);
    const available = sources.filter(source => history.indexOf(source.id) < 0);
    const pool = available.length ? available : sources;
    const item = pool[(seed(route) + history.length) % pool.length] || pool[0];
    if (item && item.id) setHistory(route, history.concat(item.id));
    return item || null;
  }

  function activeSource(route){
    const sources = routeSources(route);
    if (!sources.length) return null;
    try {
      const activeId = localStorage.getItem(activeSourceKey(route));
      const active = activeId && sources.find(source => source.id === activeId);
      if (active) return active;
    } catch(error) {}
    const picked = pickFreshSource(route) || sources[0];
    try { if (picked && picked.id) localStorage.setItem(activeSourceKey(route), picked.id); } catch(error) {}
    return picked;
  }

  function rotateSource(route){
    const picked = pickFreshSource(route);
    try { if (picked && picked.id) localStorage.setItem(activeSourceKey(route), picked.id); } catch(error) {}
    return picked;
  }

  function skillRole(route, skill){
    const contract = route && route.skillContract || {};
    return clean(contract[skill] || 'Exposure');
  }

  function requiredSkills(route){
    if (!route) return [];
    if (route.routeType === 'boss_gate') return SKILLS.slice();
    return SKILLS.filter(skill => ['Core','Support','Integrated'].indexOf(skillRole(route, skill)) >= 0);
  }

  function routeChallenge(route, options){
    options = options || {};
    const mode = pickMode(route);
    const source = options.rotate ? rotateSource(route) : activeSource(route);
    const required = requiredSkills(route);
    const sourceCount = routeSources(route).length;
    const isBoss = route && route.routeType === 'boss_gate';
    return {
      version: VERSION,
      routeId: route ? route.routeId : 'S1',
      title: route ? route.title : '',
      mode,
      source,
      sourceCount,
      requiredSkills: required,
      noRepeatWindow: isBoss ? 4 : Math.min(6, Math.max(4, sourceCount - 2)),
      intensity: isBoss ? 'Boss Pressure' : (routeNumber(route) >= 13 ? 'Final Stretch' : routeNumber(route) >= 7 ? 'B1 Challenge' : 'A2+ Build-up'),
      bossRule: isBoss ? BOSS_RULES[route.routeId] : '',
      antiGuess: [
        'Shuffle answer position every replay.',
        'Do not reward longest-option guessing.',
        'Rotate source, prompt, distractor trap, and skill order on replay.',
        'Require evidence + limitation when the learner replays for a higher score.'
      ],
      skillChallenges: required.reduce((acc, skill) => {
        acc[skill] = SKILL_CHALLENGES[skill] || [];
        return acc;
      }, {})
    };
  }

  function enrichPack(){
    const data = pack();
    if (!data || data.__replayChallengeDirector === VERSION) return;
    data.routes.forEach(route => {
      const challenge = routeChallenge(route);
      try {
        route.replayChallenge = challenge;
        route.replayRules = {
          sourceCount: challenge.sourceCount,
          noRepeatWindow: challenge.noRepeatWindow,
          rotates: ['source-on-replay','prompt','skill-order','distractor-trap','difficulty-band','feedback-target'],
          replayGoal: route.routeType === 'boss_gate'
            ? 'Replay to improve integration, evidence, and teacher-review readiness.'
            : 'Replay to improve mastery score, use a fresh source on the next replay, and avoid memorized answers.',
          antiLongestOptionBias: true,
          requireEvidenceOnReplay: true,
          preserveBestScore: true,
          scenarioLockedDuringCurrentView: true
        };
        (route.missions || []).forEach(mission => {
          const skill = clean(mission.skill).toLowerCase();
          mission.replayVariants = (SKILL_CHALLENGES[skill] || []).map((task, index) => ({
            variantId: route.routeId + '_' + skill.toUpperCase() + '_REPLAY_' + (index + 1),
            challenge: task,
            mode: challenge.mode.label,
            evidenceRule: index % 2 === 0 ? 'Use one source detail.' : 'Add one limitation or next action.',
            antiGuessRule: 'Answer must match the source, not option length or familiar wording.'
          }));
        });
      } catch(error) {}
    });
    try {
      data.replayChallengeDirector = {
        version: VERSION,
        appliesTo: 'S1-S15 + B1-B5',
        normalSessionReplay: 'locked scenario during current view + fresh source on replay + skill challenge + evidence replay goal',
        bossReplay: 'integrated four-skill surge + teacher-review readiness',
        antiMemorization: ['no-repeat source window','rotating challenge modes','anti-longest-option warning','evidence-required replay']
      };
      data.__replayChallengeDirector = VERSION;
    } catch(error) {}
  }

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:10px 0 0;padding:11px;border-radius:16px;background:linear-gradient(135deg,#fff8e7,#ffffff);border:1px solid #fde68a;color:#102033;box-shadow:0 8px 22px rgba(8,25,45,.10);font-family:Arial,'Noto Sans Thai',sans-serif}
      #${PANEL_ID} .rc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:7px}
      #${PANEL_ID} .rc-title{font-size:15px;font-weight:950;color:#7c4a00;line-height:1.25}
      #${PANEL_ID} .rc-mode{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:#ffedd5;color:#9a3412;font-size:12px;font-weight:950}
      #${PANEL_ID} .rc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
      #${PANEL_ID} .rc-box{border:1px solid #fde7b3;border-radius:13px;background:#fff;padding:9px;line-height:1.35;font-size:12px;color:#334155}
      #${PANEL_ID} .rc-box b{display:block;color:#17375e;font-size:13px;margin-bottom:4px}
      #${PANEL_ID} .rc-pill{display:inline-flex;margin:3px 4px 0 0;padding:4px 7px;border-radius:999px;background:#ecfeff;color:#155e75;font-size:11px;font-weight:900}
      #${PANEL_ID} .rc-warning{margin-top:8px;padding:8px 10px;border-radius:12px;background:#fef3c7;color:#78350f;font-size:12px;font-weight:850;line-height:1.35}
      #${PANEL_ID} .rc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      #${PANEL_ID} button{border:0;border-radius:12px;padding:8px 10px;background:#17375e;color:#fff;font-weight:950;font-size:12px;cursor:pointer}
      #${PANEL_ID} button.secondary{background:#edf2f7;color:#1f2937}
      #${PANEL_ID} details{margin-top:5px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;overflow:hidden}
      #${PANEL_ID} summary{padding:7px 9px;cursor:pointer;font-weight:900;color:#17375e}
      #${PANEL_ID} .rc-detail{padding:0 9px 8px;color:#475569;line-height:1.35}
      @media(max-width:760px){#${PANEL_ID}{padding:10px;border-radius:14px}#${PANEL_ID} .rc-title{font-size:14px}#${PANEL_ID} .rc-grid{grid-template-columns:1fr;gap:7px}#${PANEL_ID} .rc-box{font-size:12px;padding:8px}#${PANEL_ID} button{font-size:12px;min-height:36px}}
    `;
    document.head.appendChild(style);
  }

  function challengeForCurrent(options){
    const route = currentRoute();
    return { route, challenge: routeChallenge(route, options || {}) };
  }

  function render(route, challenge){
    if (!route || !challenge) return '';
    const src = challenge.source;
    const skills = challenge.requiredSkills.map(skill => '<span class="rc-pill">' + esc(skill) + ' · ' + esc(skillRole(route, skill)) + '</span>').join('');
    const sourceLine = src
      ? '<b>Scenario ล็อกไว้รอบนี้</b>' + esc(src.id + ' · ' + src.title) +
        '<details><summary>ดูรายละเอียด Source</summary><div class="rc-detail">' + esc(clean(src.passage)) + '</div></details>'
      : '<b>Boss Scenario</b>Integrated source set / teacher-review evidence';
    const boss = route.routeType === 'boss_gate'
      ? '<div class="rc-box"><b>Boss Rule</b>' + esc(challenge.bossRule) + '</div>'
      : '<div class="rc-box"><b>No-repeat pool</b>' + esc(challenge.sourceCount || 0) + ' cards · window ' + esc(challenge.noRepeatWindow) + '<br><span class="rc-pill">ไม่เปลี่ยนเองระหว่างอ่าน</span></div>';

    return `
      <div class="rc-head">
        <div class="rc-title">🔥 Replay Challenge · ${esc(route.routeId)} ${esc(route.title || '')}</div>
        <div class="rc-mode">${esc(challenge.mode.th)} · ${esc(challenge.intensity)}</div>
      </div>
      <div class="rc-grid">
        <div class="rc-box"><b>รอบนี้เล่นแบบ</b>${esc(challenge.mode.pressure)}<br><span class="rc-pill">${esc(challenge.mode.bonus)}</span></div>
        <div class="rc-box"><b>Skill ที่ต้องคุม</b>${skills || '<span class="rc-pill">Practice</span>'}</div>
        <div class="rc-box">${sourceLine}</div>
        ${boss}
      </div>
      <div class="rc-warning">กันเดา: ห้ามใช้สูตร “ข้อยาวสุดคือคำตอบ” — ให้ยึด evidence + limitation จากโจทย์เท่านั้น</div>
      <div class="rc-actions">
        <button type="button" data-eap-rc-action="rotate">🔄 สุ่ม Scenario ใหม่สำหรับ replay</button>
        <button type="button" class="secondary" data-eap-rc-action="brief">📘 กลับไป Mission Brief</button>
      </div>
    `;
  }

  function mount(options){
    enrichPack();
    const brief = document.getElementById('eap-session-content-brief');
    if (!brief) return;
    injectStyle();
    const state = challengeForCurrent(options || {});
    const route = state.route;
    const challenge = state.challenge;
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      const rail = document.getElementById('eap-classroom-action-rail');
      if (rail && rail.parentNode === brief) rail.insertAdjacentElement('afterend', panel);
      else {
        const compact = brief.querySelector('.eap-brief-compact');
        if (compact) compact.insertAdjacentElement('afterend', panel);
        else brief.appendChild(panel);
      }
    }
    const key = route.routeId + '|' + challenge.mode.id + '|' + (challenge.source && challenge.source.id || 'boss') + '|' + VERSION;
    if (panel.dataset.key !== key) {
      panel.dataset.key = key;
      panel.innerHTML = render(route, challenge);
    }
  }

  function onClick(event){
    const btn = event.target.closest('[data-eap-rc-action]');
    if (!btn) return;
    event.preventDefault();
    const action = btn.dataset.eapRcAction;
    if (action === 'rotate') {
      mount({ rotate:true });
      const panel = document.getElementById(PANEL_ID);
      if (panel) panel.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    if (action === 'brief') {
      const brief = document.getElementById('eap-session-content-brief');
      if (brief) brief.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  function start(){
    document.addEventListener('click', onClick, true);
    enrichPack();
    mount();
    window.setInterval(function(){ mount({ rotate:false }); }, 1800);
    window.EAPReplayChallengeDirector = {
      version: VERSION,
      currentRoute,
      routeChallenge: function(routeId){
        const route = byRouteId(routeId) || currentRoute();
        return routeChallenge(route, { rotate:false });
      },
      rotateScenario: function(routeId){
        const route = byRouteId(routeId) || currentRoute();
        const source = rotateSource(route);
        mount({ rotate:false });
        return source;
      },
      refresh: function(){ mount({ rotate:false }); }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();