// === /fitness/js/shadow-breaker.js ===
// Shadow Breaker
// PATCH v20260414b-SB-STRICT-PLANNER-FLOW-FULL

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const $ = (s, root = DOC) => root.querySelector(s);
  const nowMs = () => (WIN.performance && performance.now) ? performance.now() : Date.now();

  function qs(k, d = ''){
    try{
      const v = (new URL(location.href)).searchParams.get(k);
      return v == null ? d : v;
    }catch(_){
      return d;
    }
  }

  function clamp(v, a, b){
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  const __SB_REQUIRED_IDS = ['sb-wrap','sb-view-menu','sb-view-play','sb-view-result'];

  function __sbShowFatal(message, extra=''){
    try{
      document.body.innerHTML = `
        <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(180deg,#dff4ff,#fff7da);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans Thai',sans-serif;">
          <div style="width:min(92vw,720px);background:#fffdf6;border:1px solid #bfe3f2;border-radius:24px;box-shadow:0 18px 40px rgba(0,0,0,.12);padding:20px;color:#4d4a42;">
            <div style="font-size:1.4rem;font-weight:1000;margin-bottom:10px;">Shadow Breaker เปิดไม่สำเร็จ</div>
            <div style="font-size:1rem;line-height:1.6;margin-bottom:10px;">${message}</div>
            <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;overflow:auto;">${String(extra || '')}</pre>
          </div>
        </div>
      `;
    }catch(_){}
  }

  const SB_PLANNER_STRICT = (() => {
    const hubLower = String(qs('hub', '') || '').toLowerCase();
    return (
      ['1','true','yes','on'].includes(String(qs('plannerFlow', '0')).toLowerCase()) ||
      ['1','true','yes','on'].includes(String(qs('fpStrict', '0')).toLowerCase()) ||
      String(qs('cooldown', '1')).toLowerCase() === '0' ||
      String(qs('returnPhase', '')).toLowerCase() === 'planner' ||
      hubLower.includes('fitness-planner') ||
      hubLower.includes('fpresume=1')
    );
  })();

  function buildPlannerReturnHref(){
    const hubUrl = String(qs('hub', '') || '../herohealth/hub.html');
    try { return new URL(hubUrl, location.href).toString(); }
    catch(_) { return hubUrl; }
  }

  function loadJson(key, fallback = null){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){
      return fallback;
    }
  }

  function saveJson(key, val){
    try{
      localStorage.setItem(key, JSON.stringify(val));
    }catch(_){}
  }

  function escCsv(v){
    return String(v ?? '').replace(/"/g, '""');
  }

  function rowsToCsv(rows){
    rows = Array.isArray(rows) ? rows : [];
    if (!rows.length) return '';

    const keySet = new Set();
    rows.forEach(r => Object.keys(r || {}).forEach(k => keySet.add(k)));
    const keys = Array.from(keySet);

    const header = keys.map(k => `"${escCsv(k)}"`).join(',');
    const body = rows.map(r => keys.map(k => `"${escCsv(r?.[k])}"`).join(','));
    return [header, ...body].join('\n');
  }

  function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8'){
    const blob = new Blob([text], { type: mime });
    const a = DOC.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function hhDayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function xmur3(str){
    str = String(str || '');
    let h = 1779033703 ^ str.length;
    for(let i = 0; i < str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createSeededRandom(seedStr){
    const seedFn = xmur3(seedStr);
    return mulberry32(seedFn());
  }

  function choice(rng, arr){
    if (!arr || !arr.length) return null;
    return arr[Math.floor(rng() * arr.length)];
  }

  function shortIsoNow(){
    return new Date().toISOString();
  }

  function getViewMode(){
    const root = DOC.getElementById('sb-wrap');
    const dv = String(root?.dataset?.viewMode || '').toLowerCase();
    if (dv === 'pc' || dv === 'mobile' || dv === 'cvr') return dv;

    const qv = String(qs('view', '')).toLowerCase();
    if (qv === 'pc' || qv === 'mobile' || qv === 'cvr') return qv;

    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? 'mobile' : 'pc';
  }

  function setWrapViewMode(){
    if (DOM.wrap) {
      DOM.wrap.dataset.viewMode = getViewMode();
      DOM.wrap.classList.add('sb-theme-kidsoft');
      DOM.wrap.classList.add('sb-wrap');
    }
  }

  function buildCooldownGateUrl(summary){
    const hubUrl = String(summary?.hub || qs('hub', '') || '../herohealth/hub.html');
    const summaryUrl =
      `../herohealth/shadow-breaker-summary.html` +
      `?pid=${encodeURIComponent(summary?.pid || 'anon')}` +
      `&hub=${encodeURIComponent(hubUrl)}` +
      `&diff=${encodeURIComponent(summary?.diff || 'normal')}` +
      `&mode=${encodeURIComponent(summary?.mode || 'normal')}`;

    const u = new URL('/webxr-health-mobile/herohealth/warmup-gate.html', location.origin);

    [
      'run','mode','diff','time','seed','studyId','phase','conditionGroup','log',
      'view','pid','api','ai','debug','planSeq','planDay','planSlot','planMode',
      'planSlots','planIndex','autoNext','plannedGame','finalGame','zone','cdnext','grade','game'
    ].forEach(k => {
      const v = qs(k, '');
      if (v !== '') u.searchParams.set(k, v);
    });

    u.searchParams.set('phase', 'cooldown');
    u.searchParams.set('gatePhase', 'cooldown');
    u.searchParams.set('game', 'shadowbreaker');
    u.searchParams.set('gameId', 'shadowbreaker');
    u.searchParams.set('cat', 'fitness');
    u.searchParams.set('theme', 'shadowbreaker');
    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('pid', String(summary?.pid || qs('pid', 'anon') || 'anon'));
    u.searchParams.set('hub', hubUrl);
    u.searchParams.set('finalGame', '/webxr-health-mobile/fitness/shadow-breaker.html');
    u.searchParams.set('plannedGame', '/webxr-health-mobile/fitness/shadow-breaker.html');
    u.searchParams.set('cdnext', summaryUrl);
    u.searchParams.set('forcegate', '1');

    return u.toString();
  }

  function buildReplayLauncherHref(){
    const url = new URL(location.pathname, location.href);

    url.searchParams.set('pid', String(STATE.pid || 'anon'));
    url.searchParams.set('diff', String(STATE.diff || 'normal'));
    url.searchParams.set('time', String(Math.round((STATE.totalMs || 70000) / 1000)));
    url.searchParams.set('mode', String(STATE.mode || 'normal'));
    url.searchParams.set('run', String(qs('run', 'play') || 'play'));
    url.searchParams.set('view', String(getViewMode() || 'mobile'));
    url.searchParams.set('hub', String(qs('hub', '') || '../herohealth/hub.html'));
    url.searchParams.set('seed', String(Date.now()));

    if (SB_PLANNER_STRICT) {
      url.searchParams.set('plannerFlow', '1');
      url.searchParams.set('fpStrict', '1');
      url.searchParams.set('cooldown', '0');
      url.searchParams.set('returnPhase', 'planner');
      if (qs('planDay', '')) url.searchParams.set('planDay', qs('planDay', ''));
      if (qs('planSlot', '')) url.searchParams.set('planSlot', qs('planSlot', ''));
    }

    return url.toString();
  }

  function goBackHubNow(){
    const hubUrl = buildPlannerReturnHref();
    try{
      location.href = hubUrl;
    }catch(_){
      location.assign(hubUrl);
    }
  }

  const BOSSES = [
    {
      key: 'bubble',
      name: 'Bubble Glove',
      emoji: '🫧',
      speech: 'แตะฟองให้ทันนะ!',
      clearTitle: 'ผ่านบอสแล้ว!',
      clearSub: 'เก่งมาก เตรียมลุยด่านต่อไป',
      desc: 'เป้ากลมใหญ่ ตีง่าย เหมาะเริ่มต้น',
      theme: { theme1: 'rgba(56,189,248,.22)', theme2: 'rgba(59,130,246,.14)', border: 'rgba(56,189,248,.26)' }
    },
    {
      key: 'meteor',
      name: 'Meteor Punch',
      emoji: '☄️',
      speech: 'มาเร็วขึ้นอีกนิด!',
      clearTitle: 'ผ่านอีกบอสแล้ว!',
      clearSub: 'ยอดเยี่ยม ไปต่อกันเลย',
      desc: 'เป้าเร็วขึ้น เริ่มมีบอมบ์มากขึ้น',
      theme: { theme1: 'rgba(245,158,11,.22)', theme2: 'rgba(239,68,68,.12)', border: 'rgba(245,158,11,.26)' }
    },
    {
      key: 'hydra',
      name: 'Neon Hydra',
      emoji: '🐉',
      speech: 'แตะให้ทันนะ ระวังหลายเป้า!',
      clearTitle: 'ใกล้สำเร็จแล้ว!',
      clearSub: 'เหลืออีกนิดเดียวจะถึงบอสสุดท้าย',
      desc: 'หลายเป้าพร้อมกัน ต้องตั้งสมาธิ',
      theme: { theme1: 'rgba(167,139,250,.24)', theme2: 'rgba(99,102,241,.16)', border: 'rgba(167,139,250,.26)' }
    },
    {
      key: 'final',
      name: 'Final Boss',
      emoji: '👑',
      speech: 'ถึงด่านสุดท้ายแล้ว ลุยเลย!',
      clearTitle: 'ชนะแล้ว!',
      clearSub: 'หนูเป็นฮีโร่ของวันนี้ 🎉',
      desc: 'ด่านสุดท้าย เป้าบอสเด่นที่สุด',
      theme: { theme1: 'rgba(250,204,21,.24)', theme2: 'rgba(244,114,182,.16)', border: 'rgba(250,204,21,.30)' }
    }
  ];

  function bossIndexToName(i){
    return BOSSES[clamp(i, 0, BOSSES.length - 1)]?.name || 'Boss';
  }

  function gradeFromScore(score, acc, bossesCleared){
    score = Number(score || 0);
    acc = Number(acc || 0);
    bossesCleared = Number(bossesCleared || 0);

    if (bossesCleared >= 4 || (score >= 1800 && acc >= 85)) return 'S';
    if (bossesCleared >= 3 || (score >= 1300 && acc >= 75)) return 'A';
    if (bossesCleared >= 2 || (score >= 800 && acc >= 62)) return 'B';
    return 'C';
  }

  function badgeFromSummary(sum){
    const bosses = Number(sum.bossesCleared || 0);
    const score = Number(sum.scoreFinal || sum.score || 0);
    const acc = Number(sum.accPct || 0);
    const miss = Number(sum.missTotal || sum.miss || 0);
    const bestBoss = String(sum.bestReachedBoss || '');

    if (bosses >= 4) return { icon: '👑', title: 'Final Hero', desc: 'ผ่านบอสสุดท้ายได้แล้ว เก่งที่สุดเลย' };
    if (bestBoss.toLowerCase().includes('hydra')) return { icon: '🐉', title: 'Hydra Hero', desc: 'ไปไกลถึง Neon Hydra แล้ว' };
    if (bestBoss.toLowerCase().includes('meteor')) return { icon: '☄️', title: 'Meteor Hero', desc: 'ผ่าน Meteor Punch ได้ยอดเยี่ยม' };
    if (acc >= 88 && score >= 1000) return { icon: '🎯', title: 'Aim Star', desc: 'ตีแม่นมาก น่าภูมิใจสุด ๆ' };
    if (miss <= 3 && score >= 700) return { icon: '🛡️', title: 'Careful Hero', desc: 'พลาดน้อยมาก เล่นได้นิ่งเลย' };
    return { icon: '🥊', title: 'Shadow Starter', desc: 'เริ่มต้นได้ดี ลองอีกครั้งเพื่อไปให้ไกลกว่าเดิม' };
  }

  const DOM = {
    wrap: $('#sb-wrap'),

    viewMenu: $('#sb-view-menu'),
    viewPlay: $('#sb-view-play'),
    viewResult: $('#sb-view-result'),

    inputDiff: $('#sb-input-diff'),
    inputTime: $('#sb-input-time'),
    inputPid: $('#sb-input-pid'),
    inputGroup: $('#sb-input-group'),
    inputNote: $('#sb-input-note'),

    btnPlay: $('#sb-btn-play'),
    btnResearch: $('#sb-btn-research'),
    btnHowto: $('#sb-btn-howto'),
    howto: $('#sb-howto'),

    btnResultRetry: $('#sb-btn-result-retry'),
    btnResultMenu: $('#sb-btn-result-menu'),
    btnDownloadEvents: $('#sb-btn-download-events'),
    btnDownloadSession: $('#sb-btn-download-session'),
    btnBackMenu: $('#sb-btn-back-menu'),
    btnPause: $('#sb-btn-pause'),
    btnFever: $('#sb-btn-fever'),
    btnFeverBottom: $('#sb-btn-fever-bottom'),

    targetLayer: $('#sb-target-layer'),
    cvrCrosshair: $('#sb-cvr-crosshair'),
    msgMain: $('#sb-msg-main'),

    textTime: $('#sb-text-time'),
    textScore: $('#sb-text-score'),
    textCombo: $('#sb-text-combo'),
    textPhase: $('#sb-text-phase'),
    textMiss: $('#sb-text-miss'),

    currentBossName: $('#sb-current-boss-name'),
    bossPhaseLabel: $('#sb-boss-phase-label'),
    bossShieldLabel: $('#sb-boss-shield-label'),

    bossBanner: $('#sb-boss-banner'),
    bossBannerTitle: $('#sb-boss-banner-title'),
    bossBannerSub: $('#sb-boss-banner-sub'),

    bossSpeech: $('#sb-boss-speech'),
    bossSpeechEmoji: $('#sb-boss-speech-emoji'),
    bossSpeechName: $('#sb-boss-speech-name'),
    bossSpeechText: $('#sb-boss-speech-text'),

    stageBossFace: $('#sb-stage-boss-face'),
    stageBossName: $('#sb-stage-boss-name'),
    metaEmoji: $('#sb-meta-emoji'),
    metaName: $('#sb-meta-name'),
    metaDesc: $('#sb-meta-desc'),

    hpYouTop: $('#sb-hp-you-top'),
    hpBossTop: $('#sb-hp-boss-top'),
    hpYouBottom: $('#sb-hp-you-bottom'),
    hpBossBottom: $('#sb-hp-boss-bottom'),

    feverBar: $('#sb-fever-bar'),
    labelFever: $('#sb-label-fever'),
    feverHint: $('#sb-fever-hint'),

    resTime: $('#sb-res-time'),
    resScore: $('#sb-res-score'),
    resMaxCombo: $('#sb-res-max-combo'),
    resMiss: $('#sb-res-miss'),
    resPhase: $('#sb-res-phase'),
    resBossCleared: $('#sb-res-boss-cleared'),
    resAcc: $('#sb-res-acc'),
    resGrade: $('#sb-res-grade'),
    resMessage: $('#sb-res-message'),
    resBadgeIcon: $('#sb-res-badge-icon'),
    resBadgeTitle: $('#sb-res-badge-title'),
    resBadgeDesc: $('#sb-res-badge-desc'),

    linkHub: $('#sb-link-hub'),

    tabNormal: $('#sb-tab-normal'),
    tabResearch: $('#sb-tab-research'),
    researchFields: $('#sb-research-fields'),
    modeDesc: $('#sb-mode-desc')
  };

  const __SB_MISSING_DOM = __SB_REQUIRED_IDS.filter(id => !DOC.getElementById(id));
  if (__SB_MISSING_DOM.length) {
    console.error('[SB] missing required DOM ids', __SB_MISSING_DOM);
    __sbShowFatal('ไฟล์ HTML กับ JS ยังไม่ตรงกัน', 'Missing IDs: ' + __SB_MISSING_DOM.join(', '));
    return;
  }

  const STATE = {
    mode: 'normal',
    isPlaying: false,
    isPaused: false,
    isEnding: false,
    sessionId: '',
    startTs: 0,
    lastFrame: 0,
    elapsedMs: 0,
    totalMs: 70000,
    pid: 'anon',
    diff: 'normal',
    seed: '',
    rng: null,

    phaseIndex: 0,
    bossesCleared: 0,
    bestReachedBoss: 'Bubble Glove',

    score: 0,
    combo: 0,
    comboMax: 0,
    missTotal: 0,
    hitCount: 0,
    tapCount: 0,
    accPct: 0,

    hpYou: 100,
    hpBoss: 100,
    shield: 0,
    fever: 0,
    feverOn: false,
    feverRemainMs: 0,

    spawnClock: 0,
    speechClock: 0,
    bossBannerClock: 0,
    stageMessageClock: 0,

    entities: [],
    events: [],
    sessionSummary: null,

    latestBossBadge: null,
    cvrFocusId: null,
    cvrLastShotMs: 0
  };

  function setView(name){
    DOM.viewMenu?.classList.remove('is-active');
    DOM.viewPlay?.classList.remove('is-active');
    DOM.viewResult?.classList.remove('is-active');

    if (name === 'menu') DOM.viewMenu?.classList.add('is-active');
    else if (name === 'play') DOM.viewPlay?.classList.add('is-active');
    else if (name === 'result') DOM.viewResult?.classList.add('is-active');
  }

  function setUiMode(mode){
    STATE.mode = mode === 'research' ? 'research' : 'normal';
    setWrapViewMode();

    DOM.tabNormal?.classList.toggle('is-active', STATE.mode !== 'research');
    DOM.tabResearch?.classList.toggle('is-active', STATE.mode === 'research');

    if (DOM.researchFields) {
      DOM.researchFields.style.display = STATE.mode === 'research' ? '' : 'none';
    }

    if (DOM.modeDesc) {
      DOM.modeDesc.textContent = STATE.mode === 'research'
        ? 'โหมดวิจัย: ใช้เก็บข้อมูลการทดลอง'
        : 'เล่นสนุกได้เลย ไม่ต้องกรอกข้อมูลเพิ่ม';
    }
  }

  function applyBossTheme(boss){
    if (!boss || !DOM.wrap) return;

    DOM.wrap.style.setProperty('--sb-theme1', boss.theme?.theme1 || 'rgba(59,130,246,.22)');
    DOM.wrap.style.setProperty('--sb-theme2', boss.theme?.theme2 || 'rgba(167,139,250,.14)');
    DOM.wrap.style.setProperty('--sb-themeBorder', boss.theme?.border || 'rgba(148,163,184,.18)');

    if (DOM.stageBossFace) DOM.stageBossFace.textContent = boss.emoji || '🥊';
    if (DOM.stageBossName) DOM.stageBossName.textContent = boss.name || 'Boss';
    if (DOM.metaEmoji) DOM.metaEmoji.textContent = boss.emoji || '🥊';
    if (DOM.metaName) DOM.metaName.textContent = boss.name || 'Boss';
    if (DOM.metaDesc) DOM.metaDesc.textContent = boss.desc || '';
    if (DOM.currentBossName) DOM.currentBossName.textContent = boss.name || 'Boss';
    if (DOM.bossPhaseLabel) DOM.bossPhaseLabel.textContent = String(STATE.phaseIndex + 1);
  }

  function currentBoss(){
    return BOSSES[clamp(STATE.phaseIndex, 0, BOSSES.length - 1)];
  }

  function getCrosshairPoint(){
    const stageRect = DOM.targetLayer?.getBoundingClientRect?.();
    if (!stageRect) return { x: 0, y: 0 };
    return { x: stageRect.width / 2, y: stageRect.height / 2 };
  }

  function entityCenter(ent){
    return {
      x: Number(ent.x || 0) + Number(ent.size || 0) / 2,
      y: Number(ent.y || 0) + Number(ent.size || 0) / 2
    };
  }

  function dist2(ax, ay, bx, by){
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function getCvrFocusEntity(){
    if (getViewMode() !== 'cvr') return null;

    const pt = getCrosshairPoint();
    const alive = STATE.entities.filter(e => e && e.alive);
    if (!alive.length) return null;

    let best = null;
    let bestD2 = Infinity;

    for (const ent of alive){
      const c = entityCenter(ent);
      const d2 = dist2(pt.x, pt.y, c.x, c.y);
      const focusRadius =
        ent.type === 'bossface' ? 196 :
        ent.type === 'normal' ? 180 :
        ent.type === 'heal' || ent.type === 'shield' ? 166 : 156;

      if (d2 <= focusRadius * focusRadius && d2 < bestD2){
        best = ent;
        bestD2 = d2;
      }
    }

    return best;
  }

  function updateCvrFocusVisual(){
    if (getViewMode() !== 'cvr'){
      STATE.cvrFocusId = null;
      STATE.entities.forEach(e => e?.el?.classList?.remove('is-cvr-focus'));
      return;
    }

    const focused = getCvrFocusEntity();
    STATE.cvrFocusId = focused?.id || null;

    for (const ent of STATE.entities){
      ent?.el?.classList?.toggle('is-cvr-focus', !!focused && ent.id === focused.id);
    }
  }

  function showBossSpeech(text, durMs = 1800){
    const boss = currentBoss();
    if (!DOM.bossSpeech) return;

    if (getViewMode() === 'mobile'){
      hideBossSpeech();
      if (text) setCenterMsg(text, Math.min(1200, durMs));
      return;
    }

    if (DOM.bossSpeechEmoji) DOM.bossSpeechEmoji.textContent = boss.emoji || '🥊';
    if (DOM.bossSpeechName) DOM.bossSpeechName.textContent = boss.name || 'Boss';
    if (DOM.bossSpeechText) DOM.bossSpeechText.textContent = text || boss.speech || '';

    DOM.bossSpeech.classList.add('is-show');
    STATE.speechClock = durMs;
  }

  function hideBossSpeech(){
    DOM.bossSpeech?.classList.remove('is-show');
    STATE.speechClock = 0;
  }

  function showBossBanner(title, sub, durMs = 1800){
    if (DOM.bossBannerTitle) DOM.bossBannerTitle.textContent = title || 'ผ่านบอสแล้ว!';
    if (DOM.bossBannerSub) DOM.bossBannerSub.textContent = sub || '';

    DOM.bossBanner?.classList.add('is-show');
    STATE.bossBannerClock = durMs;
  }

  function hideBossBanner(){
    DOM.bossBanner?.classList.remove('is-show');
    STATE.bossBannerClock = 0;
  }

  function setCenterMsg(text, durMs = 1100){
    if (DOM.msgMain) DOM.msgMain.textContent = text || '';
    STATE.stageMessageClock = getViewMode() === 'mobile' ? Math.min(durMs, 800) : durMs;
  }

  function updateHud(){
    const remainSec = Math.max(0, (STATE.totalMs - STATE.elapsedMs) / 1000);

    if (DOM.textTime) DOM.textTime.textContent = `${remainSec.toFixed(1)} s`;
    if (DOM.textScore) DOM.textScore.textContent = String(Math.round(STATE.score));
    if (DOM.textCombo) DOM.textCombo.textContent = String(STATE.combo);
    if (DOM.textPhase) DOM.textPhase.textContent = String(STATE.phaseIndex + 1);
    if (DOM.textMiss) DOM.textMiss.textContent = String(STATE.missTotal);

    const youW = `${clamp(STATE.hpYou, 0, 100)}%`;
    const bossW = `${clamp(STATE.hpBoss, 0, 100)}%`;

    if (DOM.hpYouTop) DOM.hpYouTop.style.width = youW;
    if (DOM.hpYouBottom) DOM.hpYouBottom.style.width = youW;
    if (DOM.hpBossTop) DOM.hpBossTop.style.width = bossW;
    if (DOM.hpBossBottom) DOM.hpBossBottom.style.width = bossW;

    const feverPct = clamp(STATE.fever, 0, 100);
    if (DOM.feverBar) DOM.feverBar.style.width = `${feverPct}%`;
    if (DOM.labelFever) DOM.labelFever.textContent = `${Math.round(feverPct)}%`;

    if (DOM.feverHint){
      if (STATE.feverOn) DOM.feverHint.textContent = 'พลังพิเศษเปิดอยู่! แตะเร็วเลย';
      else if (feverPct >= 100) DOM.feverHint.textContent = 'พร้อมแล้ว! กดพลังพิเศษได้เลย';
      else DOM.feverHint.textContent = 'ตีแม่น ๆ เพื่อเปิดพลังพิเศษ';
    }

    if (DOM.bossShieldLabel) DOM.bossShieldLabel.textContent = String(Math.round(STATE.shield || 0));
  }

  function resetTargetLayer(){
    STATE.entities.forEach(e => {
      try{ e.el?.remove(); }catch(_){}
    });
    STATE.entities = [];
    if (DOM.targetLayer) DOM.targetLayer.innerHTML = '';
  }

  function makeEntity(type, opts = {}){
    const el = DOC.createElement('button');
    el.type = 'button';
    el.className = `sb-target sb-target--${type}`;
    el.setAttribute('aria-label', type);

    const stageRect = DOM.targetLayer.getBoundingClientRect();
    const viewMode = getViewMode();

    const sizeBase =
      viewMode === 'mobile'
        ? (STATE.diff === 'easy' ? 92 : STATE.diff === 'hard' ? 76 : 82)
        : viewMode === 'cvr'
          ? (STATE.diff === 'easy' ? 116 : STATE.diff === 'hard' ? 92 : 100)
          : (STATE.diff === 'easy' ? 88 : STATE.diff === 'hard' ? 68 : 78);

    const size =
      type === 'bossface' ? sizeBase + 8 :
      type === 'bomb' ? sizeBase - 8 :
      type === 'heal' || type === 'shield' ? sizeBase - 4 : sizeBase;

    const w = Math.max(160, stageRect.width);
    const h = Math.max(320, stageRect.height);

    let spawnLeft = 12;
    let spawnRight = w - size - 12;
    let spawnTop = 84;
    let spawnBottom = h - size - 24;

    if (viewMode === 'mobile') {
      spawnLeft = 14;
      spawnRight = w - size - 14;
      spawnTop = Math.max(146, h * 0.27);
      spawnBottom = h - size - 44;
    }

    if (viewMode === 'pc') {
      spawnLeft = 16;
      spawnRight = w - size - 170;
      spawnTop = Math.max(76, h * 0.17);
      spawnBottom = h - size - 20;
    }

    if (viewMode === 'cvr') {
      spawnLeft = 28;
      spawnRight = w - size - 28;
      spawnTop = Math.max(104, h * 0.20);
      spawnBottom = h - size - 60;
    }

    const x = opts.x != null ? opts.x : spawnLeft + STATE.rng() * Math.max(10, spawnRight - spawnLeft);
    const y = opts.y != null ? opts.y : spawnTop + STATE.rng() * Math.max(10, spawnBottom - spawnTop);

    let emoji = '🎯';
    if (type === 'normal') emoji = choice(STATE.rng, ['⭐', '🎯', '✨']);
    if (type === 'decoy') emoji = '👀';
    if (type === 'bomb') emoji = '💣';
    if (type === 'heal') emoji = '🩹';
    if (type === 'shield') emoji = '🛡️';
    if (type === 'bossface') emoji = currentBoss().emoji || '👑';
    el.textContent = emoji;

    const ttl =
      opts.ttl != null ? opts.ttl :
      type === 'heal' || type === 'shield' ? 1700 :
      type === 'bomb' ? (STATE.diff === 'hard' ? 1180 : 1380) :
      type === 'bossface' ? 1750 :
      (STATE.diff === 'easy' ? 1720 : STATE.diff === 'hard' ? 1180 : 1420);

    const ent = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      el,
      x, y, size,
      born: nowMs(),
      ttl,
      alive: true,
      hit: false
    };

    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    el.addEventListener('click', () => onTapEntity(ent));

    DOM.targetLayer.appendChild(el);
    STATE.entities.push(ent);

    logEvent('spawn', {
      ent_id: ent.id,
      ent_type: ent.type,
      x: Math.round(x),
      y: Math.round(y),
      size,
      ttl
    });

    return ent;
  }

  function removeEntity(ent, reason = 'remove'){
    if (!ent || !ent.alive) return;

    ent.alive = false;
    try{
      ent.el?.classList.add('is-expiring');
      setTimeout(() => { try{ ent.el?.remove(); }catch(_){ } }, 110);
    }catch(_){}

    logEvent('despawn', { ent_id: ent.id, ent_type: ent.type, reason });
  }

  function onTapEntity(ent){
    if (!STATE.isPlaying || STATE.isPaused || !ent || !ent.alive) return;

    if (getViewMode() === 'cvr') {
      const focused = getCvrFocusEntity();
      if (!focused || focused.id !== ent.id) return;
    }

    STATE.tapCount += 1;
    ent.hit = true;

    if (ent.type === 'normal'){
      const gain = STATE.feverOn ? 35 : 20;
      STATE.score += gain + Math.min(STATE.combo, 12) * 2;
      STATE.combo += 1;
      STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
      STATE.hitCount += 1;
      STATE.fever = clamp(STATE.fever + 10, 0, 100);
      STATE.hpBoss = clamp(STATE.hpBoss - (STATE.feverOn ? 18 : 10), 0, 100);
      setCenterMsg(choice(STATE.rng, ['เยี่ยม!', 'เก่งมาก!', 'โดนแล้ว!', 'สุดยอด!']), 380);
      logEvent('hit_good', { ent_id: ent.id, ent_type: ent.type, score: STATE.score });
    } else if (ent.type === 'bossface'){
      const gain = STATE.feverOn ? 60 : 35;
      STATE.score += gain;
      STATE.combo += 1;
      STATE.comboMax = Math.max(STATE.comboMax, STATE.combo);
      STATE.hitCount += 1;
      STATE.fever = clamp(STATE.fever + 12, 0, 100);
      STATE.hpBoss = clamp(STATE.hpBoss - (STATE.feverOn ? 28 : 18), 0, 100);
      setCenterMsg(choice(STATE.rng, ['โดนบอสแล้ว!', 'อีกนิดเดียว!', 'เก่งมาก!', 'ลุยเลย!']), 450);
      logEvent('hit_boss', { ent_id: ent.id, ent_type: ent.type, score: STATE.score });
    } else if (ent.type === 'heal'){
      STATE.hpYou = clamp(STATE.hpYou + 18, 0, 100);
      STATE.score += 6;
      setCenterMsg('พลังมาแล้ว!', 500);
      logEvent('pickup_heal', { ent_id: ent.id });
    } else if (ent.type === 'shield'){
      STATE.shield = clamp(STATE.shield + 18, 0, 100);
      STATE.score += 8;
      setCenterMsg('ได้โล่แล้ว!', 500);
      logEvent('pickup_shield', { ent_id: ent.id });
    } else if (ent.type === 'bomb' || ent.type === 'decoy'){
      const blocked = STATE.shield > 0;
      if (blocked){
        STATE.shield = clamp(STATE.shield - 15, 0, 100);
        setCenterMsg('โล่ช่วยไว้!', 420);
        logEvent('blocked_bad', { ent_id: ent.id, ent_type: ent.type });
      } else {
        STATE.hpYou = clamp(STATE.hpYou - (ent.type === 'bomb' ? 18 : 10), 0, 100);
        STATE.combo = 0;
        STATE.missTotal += 1;
        setCenterMsg(ent.type === 'bomb' ? 'โอ๊ะ ระวังบอมบ์!' : 'อ๊ะ เป้าหลอก!', 550);
        logEvent('hit_bad', { ent_id: ent.id, ent_type: ent.type, hp_you: STATE.hpYou });
      }
    }

    removeEntity(ent, 'tap');
    updateHud();

    if (STATE.hpBoss <= 0) onBossClear();
    else if (STATE.hpYou <= 0) endGame('hp_zero');
  }

  function cvrShoot(){
    if (!STATE.isPlaying || STATE.isPaused || getViewMode() !== 'cvr') return;

    const now = nowMs();
    if (now - STATE.cvrLastShotMs < 160) return;
    STATE.cvrLastShotMs = now;

    const target = getCvrFocusEntity();
    if (target){
      logEvent('cvr_shoot_hit', { ent_id: target.id, ent_type: target.type });
      onTapEntity(target);
    } else {
      STATE.tapCount += 1;
      STATE.combo = 0;
      logEvent('cvr_shoot_blank', {});
      setCenterMsg('ลองเล็งใหม่อีกนิด', 260);
      updateHud();
    }
  }

  function spawnPack(dtMs){
    STATE.spawnClock -= dtMs;
    if (STATE.spawnClock > 0) return;

    const baseGap = STATE.diff === 'easy' ? 880 : STATE.diff === 'hard' ? 580 : 720;
    const phaseMul = [1.00, 0.92, 0.84, 0.78][clamp(STATE.phaseIndex, 0, 3)] || 1;
    STATE.spawnClock = baseGap * phaseMul;

    let goodCount = 1;
    let badChance = 0.22;
    let decoyChance = 0.16;
    let utilityChance = 0.09;
    let bossFaceChance = 0.13;

    if (STATE.phaseIndex === 1){
      badChance = 0.27;
      decoyChance = 0.18;
      bossFaceChance = 0.17;
    } else if (STATE.phaseIndex === 2){
      goodCount = 2;
      badChance = 0.29;
      decoyChance = 0.23;
      bossFaceChance = 0.21;
    } else if (STATE.phaseIndex === 3){
      goodCount = 2;
      badChance = 0.33;
      decoyChance = 0.24;
      bossFaceChance = 0.26;
    }

    if (STATE.feverOn){
      goodCount += 1;
      bossFaceChance += 0.07;
      badChance *= 0.78;
    }

    for (let i = 0; i < goodCount; i++) makeEntity('normal');
    if (STATE.rng() < badChance) makeEntity('bomb');
    if (STATE.rng() < decoyChance) makeEntity('decoy');
    if (STATE.rng() < utilityChance) makeEntity(STATE.rng() < 0.5 ? 'heal' : 'shield');

    if (STATE.rng() < bossFaceChance){
      const stageRect = DOM.targetLayer.getBoundingClientRect();
      const viewMode = getViewMode();

      let bx = null;
      let by = null;

      if (viewMode === 'mobile') {
        bx = stageRect.width * (0.18 + STATE.rng() * 0.40);
        by = stageRect.height * (0.40 + STATE.rng() * 0.22);
      } else if (viewMode === 'pc') {
        bx = stageRect.width * (0.14 + STATE.rng() * 0.46);
        by = stageRect.height * (0.24 + STATE.rng() * 0.48);
      } else if (viewMode === 'cvr') {
        bx = stageRect.width * (0.16 + STATE.rng() * 0.58);
        by = stageRect.height * (0.26 + STATE.rng() * 0.46);
      }

      makeEntity('bossface', { x: bx, y: by });
    }
  }

  function updateEntities(tsNow){
    for (const ent of STATE.entities){
      if (!ent.alive) continue;

      const age = tsNow - ent.born;
      if (age >= ent.ttl){
        if (ent.type === 'normal' || ent.type === 'bossface'){
          STATE.combo = 0;
          STATE.missTotal += 1;
          STATE.hpYou = clamp(STATE.hpYou - (ent.type === 'bossface' ? 7 : 4), 0, 100);
          logEvent('expire_penalty', { ent_id: ent.id, ent_type: ent.type, hp_you: STATE.hpYou });
        } else {
          logEvent('expire_neutral', { ent_id: ent.id, ent_type: ent.type });
        }
        removeEntity(ent, 'ttl');
      }
    }

    STATE.entities = STATE.entities.filter(e => e.alive);
  }

  function activateFever(){
    if (!STATE.isPlaying || STATE.isPaused || STATE.fever < 100 || STATE.feverOn) return;

    STATE.feverOn = true;
    STATE.feverRemainMs = 5500;
    STATE.fever = 100;
    setCenterMsg('สปีดอัป!', 800);
    logEvent('fever_on', {});
    updateHud();
  }

  function updateFever(dtMs){
    if (!STATE.feverOn) return;

    STATE.feverRemainMs -= dtMs;
    if (STATE.feverRemainMs <= 0){
      STATE.feverOn = false;
      STATE.fever = 0;
      setCenterMsg('พลังพิเศษหมดแล้ว', 600);
      logEvent('fever_off', {});
    }
  }

  function onBossClear(){
    const boss = currentBoss();

    STATE.bossesCleared = Math.max(STATE.bossesCleared, STATE.phaseIndex + 1);
    STATE.bestReachedBoss = boss.name;
    STATE.latestBossBadge = { icon: boss.emoji, title: boss.name };

    logEvent('boss_clear', {
      phase: STATE.phaseIndex + 1,
      boss_key: boss.key,
      boss_name: boss.name,
      bosses_cleared: STATE.bossesCleared
    });

    removeAllLiveTargets();
    showBossBanner(boss.clearTitle, boss.clearSub, 1800);

    if (STATE.phaseIndex >= BOSSES.length - 1){
      setTimeout(() => endGame('final_clear'), 1200);
      return;
    }

    STATE.phaseIndex += 1;
    STATE.hpBoss = 100;
    applyBossTheme(currentBoss());

    setTimeout(() => {
      showBossSpeech(currentBoss().speech, 1800);
      setCenterMsg(`ด่าน ${STATE.phaseIndex + 1}`, 800);
      updateHud();
    }, 900);
  }

  function removeAllLiveTargets(){
    STATE.entities.forEach(e => removeEntity(e, 'phase_shift'));
    STATE.entities = [];
    if (DOM.targetLayer) DOM.targetLayer.innerHTML = '';
  }

  function computeSummary(endReason){
    const totalTimeSec = Math.max(0, STATE.elapsedMs / 1000);
    const acc = STATE.tapCount > 0 ? (STATE.hitCount / STATE.tapCount) * 100 : 0;
    STATE.accPct = acc;

    const grade = gradeFromScore(STATE.score, acc, STATE.bossesCleared);
    const badge = badgeFromSummary({
      scoreFinal: Math.round(STATE.score),
      accPct: acc,
      bossesCleared: STATE.bossesCleared,
      bestReachedBoss: STATE.bestReachedBoss,
      missTotal: STATE.missTotal
    });

    const hubUrl = String(qs('hub', '') || '../herohealth/hub.html');
    const teacherUrl = `../herohealth/teacher-panel.html?game=shadowbreaker&pid=${encodeURIComponent(STATE.pid)}`;
    const summaryUrl =
      `../herohealth/shadow-breaker-summary.html` +
      `?pid=${encodeURIComponent(STATE.pid)}` +
      `&hub=${encodeURIComponent(hubUrl)}` +
      `&diff=${encodeURIComponent(STATE.diff)}` +
      `&mode=${encodeURIComponent(STATE.mode)}`;

    const runUrl =
      `../herohealth/shadow-breaker-vr.html` +
      `?pid=${encodeURIComponent(STATE.pid)}` +
      `&diff=${encodeURIComponent(STATE.diff)}` +
      `&time=${encodeURIComponent(Math.round(STATE.totalMs / 1000))}` +
      `&view=${encodeURIComponent(getViewMode())}` +
      `&zone=fitness` +
      `&hub=${encodeURIComponent(hubUrl)}`;

    const summaryBase = {
      game: 'shadowbreaker',
      projectTag: 'shadowbreaker',
      pid: STATE.pid,
      mode: STATE.mode,
      runMode: STATE.mode,
      diff: STATE.diff,
      timeSec: Math.round(STATE.totalMs / 1000),
      elapsedSec: Number(totalTimeSec.toFixed(2)),
      scoreFinal: Math.round(STATE.score),
      accPct: Number(acc.toFixed(2)),
      comboMax: STATE.comboMax,
      missTotal: STATE.missTotal,
      bossesCleared: STATE.bossesCleared,
      bestReachedBoss: STATE.bestReachedBoss,
      phaseFinal: STATE.phaseIndex + 1,
      grade,
      badge,
      hpYouEnd: Math.round(STATE.hpYou),
      hpBossEnd: Math.round(STATE.hpBoss),
      sessionId: STATE.sessionId,
      studyId: String(qs('studyId', '')).trim(),
      group: String(qs('group', '') || DOM.inputGroup?.value || '').trim(),
      conditionGroup: String(qs('conditionGroup', '') || '').trim(),
      note: String(DOM.inputNote?.value || '').trim(),
      end_reason: endReason || 'ended',
      timestampIso: shortIsoNow(),
      hub: hubUrl,
      view: getViewMode()
    };

    const cooldownUrl = buildCooldownGateUrl(summaryBase);

    return {
      ...summaryBase,
      __extraJson: JSON.stringify({
        summaryUrl,
        teacherUrl,
        runUrl,
        hubUrl,
        cooldownUrl
      })
    };
  }

  function persistSummary(summary){
    if (!summary) return;

    STATE.sessionSummary = summary;

    const pid = summary.pid || 'anon';
    const bestScoreKey = `SB_BEST_SCORE:${pid}`;
    const oldBest = Number(localStorage.getItem(bestScoreKey) || '0') || 0;

    if ((summary.scoreFinal || 0) >= oldBest){
      localStorage.setItem(bestScoreKey, String(summary.scoreFinal || 0));
    }

    localStorage.setItem(`SB_BEST_REACHED_BOSS:${pid}`, String(summary.bestReachedBoss || ''));
    saveJson(`SB_BEST_BADGE:${pid}`, summary.badge || null);
    saveJson(`SB_LAST_SUMMARY:${pid}`, summary);
    saveJson(`HHA_LAST_SUMMARY:shadowbreaker:${pid}`, summary);
    saveJson('HHA_LAST_SUMMARY', summary);

    const histKey = `SB_SUMMARY_HISTORY:${pid}`;
    const hist = loadJson(histKey, []);
    saveJson(histKey, [summary, ...(Array.isArray(hist) ? hist : [])].slice(0, 200));

    const allKey = `SB_SUMMARY_HISTORY:ALL`;
    const allHist = loadJson(allKey, []);
    saveJson(allKey, [summary, ...(Array.isArray(allHist) ? allHist : [])].slice(0, 500));

    try{
      localStorage.setItem(`SB_DONE_TODAY:${pid}:${hhDayKey()}`, '1');
      localStorage.setItem(`HHA_GAME_DONE::shadowbreaker::${pid}::${hhDayKey()}`, '1');
    }catch(_){}

    console.log('[SB] persistSummary', {
      pid: summary?.pid,
      grade: summary?.grade,
      score: summary?.scoreFinal,
      bestBoss: summary?.bestReachedBoss
    });
  }

  function renderResult(summary){
    if (!summary) return;

    if (DOM.resTime) DOM.resTime.textContent = `${Number(summary.elapsedSec || 0).toFixed(1)} วินาที`;
    if (DOM.resScore) DOM.resScore.textContent = String(summary.scoreFinal || 0);
    if (DOM.resMaxCombo) DOM.resMaxCombo.textContent = String(summary.comboMax || 0);
    if (DOM.resMiss) DOM.resMiss.textContent = String(summary.missTotal || 0);
    if (DOM.resPhase) DOM.resPhase.textContent = String(summary.phaseFinal || 1);
    if (DOM.resBossCleared) DOM.resBossCleared.textContent = String(summary.bossesCleared || 0);
    if (DOM.resAcc) DOM.resAcc.textContent = `${Number(summary.accPct || 0).toFixed(1)}%`;
    if (DOM.resGrade) DOM.resGrade.textContent = String(summary.grade || 'C');

    if (DOM.resBadgeIcon) DOM.resBadgeIcon.textContent = summary.badge?.icon || '🏅';
    if (DOM.resBadgeTitle) DOM.resBadgeTitle.textContent = summary.badge?.title || 'Shadow Starter';
    if (DOM.resBadgeDesc) DOM.resBadgeDesc.textContent = summary.badge?.desc || 'เริ่มต้นได้ดีแล้ว ลองอีกครั้งเพื่อไปให้ไกลกว่าเดิม';

    if (DOM.resMessage){
      if (summary.end_reason === 'final_clear') DOM.resMessage.textContent = 'หนูผ่านบอสสุดท้ายได้แล้ว สุดยอดมาก 🎉';
      else if ((summary.bossesCleared || 0) >= 3) DOM.resMessage.textContent = 'เก่งมาก ไปได้ไกลมากแล้ว อีกนิดเดียวก็ถึงบอสสุดท้าย';
      else if ((summary.bossesCleared || 0) >= 1) DOM.resMessage.textContent = 'ยอดเยี่ยม ผ่านบอสได้แล้ว ลองอีกครั้งเพื่อไปต่อ';
      else DOM.resMessage.textContent = 'เริ่มต้นได้ดีแล้ว ลองอีกครั้งเพื่อฝึกความแม่นนะ';
    }
  }

  function showInlineEndOverlay(summary){
    let box = DOC.getElementById('sb-inline-end-overlay');

    if (!box) {
      box = DOC.createElement('div');
      box.id = 'sb-inline-end-overlay';
      box.style.position = 'fixed';
      box.style.inset = '0';
      box.style.zIndex = '9999';
      box.style.display = 'grid';
      box.style.placeItems = 'center';
      box.style.background = 'rgba(20,30,40,.34)';
      box.innerHTML = `
        <div style="width:min(92vw,520px);border-radius:24px;background:linear-gradient(180deg,#fffdf6,#f8fff3);border:1px solid #bfe3f2;box-shadow:0 18px 40px rgba(0,0,0,.18);padding:18px;text-align:center;color:#4d4a42;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans Thai',sans-serif;">
          <div id="sb-inline-end-icon" style="font-size:2.2rem;">🏅</div>
          <div style="margin-top:8px;font-size:1.2rem;font-weight:1000;">สรุปรอบนี้</div>
          <div id="sb-inline-end-msg" style="margin-top:8px;line-height:1.5;font-weight:900;color:#6b6a62;">เก่งมาก</div>
          <div style="margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
            <div style="padding:10px;border-radius:16px;background:#fff;border:1px solid #d8eef5;"><div style="font-size:.8rem;color:#7b7a72;font-weight:1000;">คะแนน</div><div id="sb-inline-end-score" style="margin-top:4px;font-size:1.2rem;font-weight:1000;">0</div></div>
            <div style="padding:10px;border-radius:16px;background:#fff;border:1px solid #d8eef5;"><div style="font-size:.8rem;color:#7b7a72;font-weight:1000;">เกรด</div><div id="sb-inline-end-grade" style="margin-top:4px;font-size:1.2rem;font-weight:1000;">C</div></div>
            <div style="padding:10px;border-radius:16px;background:#fff;border:1px solid #d8eef5;"><div style="font-size:.8rem;color:#7b7a72;font-weight:1000;">บอสที่ผ่าน</div><div id="sb-inline-end-boss" style="margin-top:4px;font-size:1.2rem;font-weight:1000;">0</div></div>
            <div style="padding:10px;border-radius:16px;background:#fff;border:1px solid #d8eef5;"><div style="font-size:.8rem;color:#7b7a72;font-weight:1000;">ความแม่นยำ</div><div id="sb-inline-end-acc" style="margin-top:4px;font-size:1.2rem;font-weight:1000;">0%</div></div>
          </div>
        </div>
      `;
      DOC.body.appendChild(box);
    }

    const msg =
      summary.end_reason === 'final_clear'
        ? 'สุดยอดมาก! ผ่านบอสสุดท้ายแล้ว'
        : (Number(summary.bossesCleared || 0) >= 1
            ? 'ผ่านบอสได้แล้ว เก่งมาก!'
            : 'เริ่มต้นได้ดี ลองอีกครั้งได้นะ');

    const q = (id) => DOC.getElementById(id);
    q('sb-inline-end-icon').textContent = summary.badge?.icon || '🏅';
    q('sb-inline-end-msg').textContent = msg;
    q('sb-inline-end-score').textContent = String(summary.scoreFinal || 0);
    q('sb-inline-end-grade').textContent = String(summary.grade || 'C');
    q('sb-inline-end-boss').textContent = String(summary.bossesCleared || 0);
    q('sb-inline-end-acc').textContent = `${Number(summary.accPct || 0).toFixed(1)}%`;

    return box;
  }

  function goToCooldown(summary){
    const target = buildCooldownGateUrl(summary);
    console.log('[SB] goToCooldown', {
      pid: summary?.pid,
      score: summary?.scoreFinal,
      bossesCleared: summary?.bossesCleared,
      target
    });

    try{
      location.href = target;
    }catch(_){
      location.assign(target);
    }
  }

  function finishFlow(summary){
    if (SB_PLANNER_STRICT) {
      const target = buildPlannerReturnHref();
      console.log('[SB] planner return', target);
      try{ location.href = target; }
      catch(_){ location.assign(target); }
      return;
    }
    goToCooldown(summary);
  }

  function endGame(reason = 'ended'){
    if (STATE.isEnding) return;

    STATE.isEnding = true;
    STATE.isPlaying = false;

    removeAllLiveTargets();
    hideBossBanner();
    hideBossSpeech();

    const summary = computeSummary(reason);
    persistSummary(summary);
    renderResult(summary);

    try{
      showInlineEndOverlay(summary);
      setTimeout(() => finishFlow(summary), 900);
      return;
    }catch(_){}

    finishFlow(summary);
  }

  function resetRuntimeOnly(){
    STATE.isPlaying = false;
    STATE.isPaused = false;
    STATE.isEnding = false;
    STATE.elapsedMs = 0;
    STATE.lastFrame = 0;
    STATE.phaseIndex = 0;
    STATE.bossesCleared = 0;
    STATE.bestReachedBoss = bossIndexToName(0);

    STATE.score = 0;
    STATE.combo = 0;
    STATE.comboMax = 0;
    STATE.missTotal = 0;
    STATE.hitCount = 0;
    STATE.tapCount = 0;
    STATE.accPct = 0;

    STATE.hpYou = 100;
    STATE.hpBoss = 100;
    STATE.shield = 0;
    STATE.fever = 0;
    STATE.feverOn = false;
    STATE.feverRemainMs = 0;

    STATE.spawnClock = 0;
    STATE.speechClock = 0;
    STATE.bossBannerClock = 0;
    STATE.stageMessageClock = 0;

    STATE.entities = [];
    STATE.events = [];
    STATE.sessionSummary = null;
    STATE.latestBossBadge = null;
    STATE.cvrFocusId = null;
    STATE.cvrLastShotMs = 0;

    if (DOM.btnPause) DOM.btnPause.checked = false;
    resetTargetLayer();
    updateCvrFocusVisual();
    updateHud();
  }

  function buildSessionId(){
    return `sb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function logEvent(type, data){
    STATE.events.push({
      ts_ms: Math.round(STATE.elapsedMs),
      ts_iso: shortIsoNow(),
      sessionId: STATE.sessionId,
      pid: STATE.pid,
      type,
      ...data
    });
  }

  function startGame(mode = 'normal'){
    if (STATE.isPlaying && !STATE.isEnding) return;

    const oldOverlay = DOC.getElementById('sb-inline-end-overlay');
    if (oldOverlay) oldOverlay.remove();

    setUiMode(mode);
    resetRuntimeOnly();

    STATE.mode = mode === 'research' ? 'research' : 'normal';
    STATE.pid = String(qs('pid', '') || DOM.inputPid?.value || 'anon').trim() || 'anon';
    STATE.diff = String(qs('diff', '') || DOM.inputDiff?.value || 'normal').trim() || 'normal';

    const qTime = Number(qs('time', ''));
    const uiTime = Number(DOM.inputTime?.value || '70');
    const chosenSec = Number.isFinite(qTime) && qTime > 0 ? qTime : uiTime;
    STATE.totalMs = clamp(chosenSec, 40, 180) * 1000;

    STATE.seed = String(qs('seed', '') || `${STATE.pid}_${STATE.mode}_${STATE.diff}_${STATE.totalMs}_${Date.now()}`);
    STATE.rng = createSeededRandom(STATE.seed);
    STATE.sessionId = buildSessionId();
    STATE.startTs = Date.now();
    STATE.bestReachedBoss = currentBoss().name;

    setWrapViewMode();
    applyBossTheme(currentBoss());

    showBossSpeech(currentBoss().speech, 1800);
    if (getViewMode() === 'cvr') setCenterMsg('แตะจอเพื่อยิงจากกลางจอ', 1200);
    else setCenterMsg('พร้อมแล้ว!', 900);

    STATE.isPlaying = true;
    STATE.isPaused = false;
    STATE.isEnding = false;

    setView('play');
    updateHud();

    logEvent('session_start', {
      mode: STATE.mode,
      diff: STATE.diff,
      time_sec: Math.round(STATE.totalMs / 1000),
      seed: STATE.seed,
      view: getViewMode()
    });

    requestAnimationFrame(loop);
  }

  function gotoMenu(){
    STATE.isPlaying = false;
    STATE.isPaused = false;
    STATE.isEnding = false;
    resetRuntimeOnly();
    setView('menu');
  }

  function openHowTo(){
    if (!DOM.howto) return;
    DOM.howto.style.display = DOM.howto.style.display === 'block' ? 'none' : 'block';
  }

  function loop(ts){
    if (!STATE.isPlaying) return;

    if (!STATE.lastFrame) STATE.lastFrame = ts;
    const dt = Math.min(50, Math.max(0, ts - STATE.lastFrame));
    STATE.lastFrame = ts;

    if (!STATE.isPaused){
      STATE.elapsedMs += dt;
      updateEntities(nowMs());
      spawnPack(dt);
      updateFever(dt);

      if (STATE.speechClock > 0){
        STATE.speechClock -= dt;
        if (STATE.speechClock <= 0) hideBossSpeech();
      }

      if (STATE.bossBannerClock > 0){
        STATE.bossBannerClock -= dt;
        if (STATE.bossBannerClock <= 0) hideBossBanner();
      }

      if (STATE.stageMessageClock > 0){
        STATE.stageMessageClock -= dt;
        if (STATE.stageMessageClock <= 0 && DOM.msgMain) DOM.msgMain.textContent = '';
      }

      if (STATE.elapsedMs >= STATE.totalMs){
        endGame('time_up');
        return;
      }

      if (STATE.hpYou <= 0){
        endGame('hp_zero');
        return;
      }

      updateCvrFocusVisual();
      updateHud();
    }

    requestAnimationFrame(loop);
  }

  function exportEventsCsv(){
    if (!STATE.events.length) return;
    downloadTextFile(`shadowbreaker_events_${STATE.pid || 'anon'}.csv`, rowsToCsv(STATE.events), 'text/csv;charset=utf-8');
  }

  function exportSessionCsv(){
    const sum = STATE.sessionSummary || computeSummary('manual_export');
    downloadTextFile(`shadowbreaker_session_${STATE.pid || 'anon'}.csv`, rowsToCsv([sum]), 'text/csv;charset=utf-8');
  }

  function bindDom(){
    DOM.btnPlay?.addEventListener('click', () => startGame('normal'));
    DOM.btnResearch?.addEventListener('click', () => startGame('research'));
    DOM.btnHowto?.addEventListener('click', openHowTo);
    DOM.btnBackMenu?.addEventListener('click', gotoMenu);

    DOM.btnResultRetry?.addEventListener('click', () => {
      try{
        location.href = buildReplayLauncherHref();
      }catch(_){
        location.assign(buildReplayLauncherHref());
      }
    });

    DOM.btnResultMenu?.addEventListener('click', () => {
      goBackHubNow();
    });

    DOM.btnDownloadEvents?.addEventListener('click', exportEventsCsv);
    DOM.btnDownloadSession?.addEventListener('click', exportSessionCsv);

    DOM.btnPause?.addEventListener('change', () => {
      STATE.isPaused = !!DOM.btnPause.checked;
      logEvent(STATE.isPaused ? 'pause_on' : 'pause_off', {});
    });

    DOM.btnFever?.addEventListener('click', activateFever);
    DOM.btnFeverBottom?.addEventListener('click', activateFever);

    DOM.tabNormal?.addEventListener('click', () => setUiMode('normal'));
    DOM.tabResearch?.addEventListener('click', () => setUiMode('research'));

    DOM.targetLayer?.addEventListener('pointerdown', () => {
      if (getViewMode() === 'cvr') cvrShoot();
    });

    DOC.addEventListener('keydown', (ev) => {
      if (getViewMode() !== 'cvr') return;
      if (ev.code === 'Space' || ev.code === 'Enter'){
        ev.preventDefault();
        cvrShoot();
      }
    });

    WIN.addEventListener('hha:shoot', () => {
      if (getViewMode() === 'cvr') cvrShoot();
    });

    WIN.addEventListener('resize', () => {
      setWrapViewMode();
    });
  }

  function initFromQuery(){
    const hub = String(qs('hub', '')).trim();
    if (hub && DOM.linkHub) DOM.linkHub.href = buildPlannerReturnHref();

    const finalMode = String(qs('mode', qs('run', 'normal'))).toLowerCase() === 'research' ? 'research' : 'normal';

    setWrapViewMode();
    setUiMode(finalMode);

    if (DOM.inputDiff){
      const qDiff = String(qs('diff', 'normal')).toLowerCase();
      if (['easy', 'normal', 'hard'].includes(qDiff)) DOM.inputDiff.value = qDiff;
    }

    if (DOM.inputTime){
      const qTime = String(qs('time', '70'));
      if (qTime) DOM.inputTime.value = qTime;
    }

    if (DOM.inputPid) DOM.inputPid.value = String(qs('pid', 'anon')).trim() || 'anon';
    if (DOM.inputGroup) DOM.inputGroup.value = String(qs('group', '')).trim();

    const gameId = String(qs('game', '')).toLowerCase();
    const gatePhase = String(qs('phase', '')).toLowerCase();
    const gatePhase2 = String(qs('gatePhase', '')).toLowerCase();
    const gateSkip = String(qs('wgskip', '0')).toLowerCase();
    const warmupDone = String(qs('warmupDone', '0')).toLowerCase();
    const auto = String(qs('auto', '0')).toLowerCase();

    const fromWarmupGate =
      gameId === 'shadowbreaker' && (
        gateSkip === '1' ||
        warmupDone === '1' ||
        gatePhase === 'play' ||
        gatePhase === 'game' ||
        gatePhase2 === 'warmup'
      );

    const autostart = ['1', 'true', 'yes', 'on'].includes(auto) || fromWarmupGate;

    if (!DOM.viewMenu?.classList.contains('is-active') &&
        !DOM.viewPlay?.classList.contains('is-active') &&
        !DOM.viewResult?.classList.contains('is-active')) {
      setView('menu');
    }

    if (SB_PLANNER_STRICT) {
      setTimeout(() => startGame(finalMode), 0);
      return;
    }

    if (autostart) setTimeout(() => startGame(finalMode), 0);
  }

  bindDom();
  initFromQuery();
  updateHud();
})();