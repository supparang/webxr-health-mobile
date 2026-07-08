/* =========================================================
   EAP Hero Replay Challenge Director v20260708
   V3 METADATA-ONLY STUDENT MODE
   - Keeps anti-memorization / replay metadata inside the content pack.
   - Does NOT inject the visible Replay Challenge panel into the student page.
   - Scenario/source rotation data remains available for Sheet metadata and teacher analysis.
   - Does not change scoring, pass/fail, evidence, Sheet transport, or core runtime.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-REPLAY-CHALLENGE-DIRECTOR-V3-METADATA-ONLY';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const BANK_NAME = 'EAP_GOLD_AUTHORED_BANK';
  const PANEL_ID = 'eap-replay-challenge-panel';
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

  function currentRoute(){
    return byRouteId(routeIdFromUrl()) || byRouteId(routeIdFromStorage()) || byRouteId('S1');
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
          scenarioLockedDuringCurrentView: true,
          studentPanelVisible: false
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
        normalSessionReplay: 'metadata-only: fresh source/replay variants kept for anti-memorization without student panel',
        bossReplay: 'metadata-only integrated four-skill surge + teacher-review readiness',
        antiMemorization: ['no-repeat source window','rotating challenge modes','anti-longest-option warning','evidence-required replay'],
        studentPanelVisible: false
      };
      data.__replayChallengeDirector = VERSION;
    } catch(error) {}
  }

  function cleanupPanel(){ document.getElementById(PANEL_ID)?.remove(); }

  function start(){
    enrichPack();
    cleanupPanel();
    window.EAPReplayChallengeDirector = {
      version: VERSION,
      metadataOnly: true,
      currentRoute,
      routeChallenge: function(routeId){
        const route = byRouteId(routeId) || currentRoute();
        return routeChallenge(route, { rotate:false });
      },
      rotateScenario: function(routeId){
        const route = byRouteId(routeId) || currentRoute();
        const source = rotateSource(route);
        enrichPack();
        return source;
      },
      refresh: function(){ enrichPack(); cleanupPanel(); }
    };
    window.setInterval(function(){ enrichPack(); cleanupPanel(); }, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();