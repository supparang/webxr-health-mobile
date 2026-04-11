/* =========================================================
   HeroHealth Hub v2 Lite
   single-file runtime for hub-v2.html
   PATCH v20260411d-hub-lite-singlejs
   ========================================================= */
(function (W, D) {
  'use strict';

  const KEYS = {
    LAST_ZONE: 'HHA_LAST_ZONE',
    NEXT_ZONE: 'HHA_NEXT_ZONE',
    RECOMMENDED_ZONE: 'HHA_RECOMMENDED_ZONE',
    GJ_SNAPSHOT: 'HHA_GJ_HUB_SNAPSHOT'
  };

  function byId(id) {
    return D.getElementById(id);
  }

  function qsGet(key, fallback = '') {
    try {
      const v = new URL(W.location.href).searchParams.get(key);
      return v == null || v === '' ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function safeSetStorage(key, value) {
    try {
      W.localStorage.setItem(key, String(value ?? ''));
    } catch (_) {}
  }

  function safeGetStorage(key, fallback = '') {
    try {
      const v = W.localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function readJSON(key, fallback = null) {
    try {
      const raw = W.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = String(value ?? '');
  }

  function setHref(id, href) {
    const el = byId(id);
    if (el && 'href' in el) el.href = href;
  }

  function show(id) {
    const el = byId(id);
    if (el) el.hidden = false;
  }

  function hide(id) {
    const el = byId(id);
    if (el) el.hidden = true;
  }

  function clearChildren(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function normalizeZone(zone, fallback = 'nutrition') {
    const z = String(zone || '').trim().toLowerCase();
    if (z === 'hygiene' || z === 'nutrition' || z === 'fitness') return z;
    return fallback;
  }

  function zoneLabel(zone) {
    const z = normalizeZone(zone, '');
    if (z === 'hygiene') return 'Hygiene Zone';
    if (z === 'nutrition') return 'Nutrition Zone';
    if (z === 'fitness') return 'Fitness Zone';
    return 'ยังไม่มี';
  }

  function zoneThaiLabel(zone) {
    const z = normalizeZone(zone, '');
    if (z === 'hygiene') return 'Hygiene';
    if (z === 'nutrition') return 'Nutrition';
    if (z === 'fitness') return 'Fitness';
    return 'ยังไม่มี';
  }

  function getPlayerName() {
    return qsGet('name', qsGet('nickName', 'Hero'));
  }

  function getCtx() {
    return {
      pid: qsGet('pid', 'anon'),
      name: getPlayerName(),
      nickName: qsGet('nickName', ''),
      run: qsGet('run', 'play'),
      diff: qsGet('diff', 'normal'),
      view: qsGet('view', 'mobile'),
      time: qsGet('time', '90'),
      studyId: qsGet('studyId', ''),
      seed: qsGet('seed', ''),
      debug: qsGet('debug', ''),
      api: qsGet('api', ''),
      log: qsGet('log', ''),
      schoolCode: qsGet('schoolCode', ''),
      classRoom: qsGet('classRoom', ''),
      studentNo: qsGet('studentNo', ''),
      sessionNo: qsGet('sessionNo', ''),
      weekNo: qsGet('weekNo', ''),
      teacher: qsGet('teacher', ''),
      grade: qsGet('grade', ''),
      studentKey: qsGet('studentKey', ''),
      phase: qsGet('phase', ''),
      conditionGroup: qsGet('conditionGroup', '')
    };
  }

  function setParamIfValue(url, key, value) {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  }

  function buildUrl(basePath, extraParams) {
    const ctx = getCtx();
    const url = new URL(basePath, W.location.href);

    url.searchParams.set('pid', ctx.pid);
    url.searchParams.set('name', ctx.name);
    url.searchParams.set('run', ctx.run);
    url.searchParams.set('diff', ctx.diff);
    url.searchParams.set('view', ctx.view);
    url.searchParams.set('time', ctx.time);
    url.searchParams.set('hub', W.location.href);

    setParamIfValue(url, 'nickName', ctx.nickName);
    setParamIfValue(url, 'studyId', ctx.studyId);
    setParamIfValue(url, 'seed', ctx.seed);
    setParamIfValue(url, 'debug', ctx.debug);
    setParamIfValue(url, 'api', ctx.api);
    setParamIfValue(url, 'log', ctx.log);
    setParamIfValue(url, 'schoolCode', ctx.schoolCode);
    setParamIfValue(url, 'classRoom', ctx.classRoom);
    setParamIfValue(url, 'studentNo', ctx.studentNo);
    setParamIfValue(url, 'sessionNo', ctx.sessionNo);
    setParamIfValue(url, 'weekNo', ctx.weekNo);
    setParamIfValue(url, 'teacher', ctx.teacher);
    setParamIfValue(url, 'grade', ctx.grade);
    setParamIfValue(url, 'studentKey', ctx.studentKey);
    setParamIfValue(url, 'phase', ctx.phase);
    setParamIfValue(url, 'conditionGroup', ctx.conditionGroup);

    if (extraParams && typeof extraParams === 'object') {
      Object.keys(extraParams).forEach((key) => {
        const value = extraParams[key];
        if (value == null || value === '') return;
        url.searchParams.set(key, String(value));
      });
    }

    return url.toString();
  }

  function buildZoneUrl(zone) {
    const safeZone = normalizeZone(zone);
    const map = {
      hygiene: './hygiene-zone.html',
      nutrition: './nutrition-zone.html',
      fitness: './fitness-zone.html'
    };
    return buildUrl(map[safeZone], { zone: safeZone });
  }

  function buildPlannerUrl(mode) {
    const m = String(mode || 'launcher').trim().toLowerCase();
    let base = './fitness-planner.html';
    if (m === 'quick' || m === 'class') base = './fitness-planner/index.html';
    if (m === 'weekly') base = './fitness-planner/weekly.html';

    const extra = {
      zone: 'fitness',
      cat: 'fitness',
      game: 'fitnessplanner',
      gameId: 'fitnessplanner',
      theme: 'fitnessplanner'
    };

    if (m === 'quick' || m === 'class' || m === 'weekly') {
      extra.mode = m;
      extra.seed = String(Date.now());
    }

    return buildUrl(base, extra);
  }

  function setLastZone(zone) {
    safeSetStorage(KEYS.LAST_ZONE, normalizeZone(zone));
  }

  function getLastZone() {
    return normalizeZone(safeGetStorage(KEYS.LAST_ZONE, ''), '');
  }

  function setNextZone(zone) {
    safeSetStorage(KEYS.NEXT_ZONE, normalizeZone(zone));
  }

  function getNextZone() {
    return normalizeZone(safeGetStorage(KEYS.NEXT_ZONE, ''), '');
  }

  function setRecommendedZone(zone) {
    safeSetStorage(KEYS.RECOMMENDED_ZONE, normalizeZone(zone));
  }

  function getRecommendedZone() {
    return normalizeZone(safeGetStorage(KEYS.RECOMMENDED_ZONE, ''), '');
  }

  function computeRecommendedZone(lastZone) {
    const z = normalizeZone(lastZone, '');
    if (z === 'hygiene') return 'nutrition';
    if (z === 'nutrition') return 'fitness';
    if (z === 'fitness') return 'hygiene';
    return 'nutrition';
  }

  function goZone(zone) {
    const safeZone = normalizeZone(zone);
    setLastZone(safeZone);
    W.location.href = buildZoneUrl(safeZone);
  }

  function stripUnusedBlocks() {
    ['hygPreview', 'nutriPreview', 'fitPreview'].forEach((id) => {
      const el = byId(id);
      if (!el) return;
      el.innerHTML = '';
      el.hidden = true;
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    });
  }

  function applyLinks() {
    setHref('btnPlayHygiene', buildZoneUrl('hygiene'));
    setHref('btnPlayNutrition', buildZoneUrl('nutrition'));
    setHref('btnPlayFitness', buildZoneUrl('fitness'));

    setHref('btnFitnessPlanner', buildPlannerUrl('launcher'));
    setHref('btnFPLauncher', buildPlannerUrl('launcher'));
    setHref('btnFPQuick', buildPlannerUrl('quick'));
    setHref('btnFPClass', buildPlannerUrl('class'));
    setHref('btnFPWeekly', buildPlannerUrl('weekly'));
  }

  function bindZoneButton(id, zone) {
    const el = byId(id);
    if (!el || el.__hhBound) return;
    el.__hhBound = true;
    el.addEventListener('click', function () {
      goZone(zone);
    });
  }

  function bindPlayAnchor(id, zone) {
    const el = byId(id);
    if (!el || el.__hhPlayBound) return;
    el.__hhPlayBound = true;
    el.addEventListener('click', function () {
      setLastZone(zone);
    });
  }

  function bindPlannerAnchor(id) {
    const el = byId(id);
    if (!el || el.__hhPlannerBound) return;
    el.__hhPlannerBound = true;
    el.addEventListener('click', function () {
      setLastZone('fitness');
    });
  }

  function bindButtons() {
    bindZoneButton('btnZoneHygiene', 'hygiene');
    bindZoneButton('btnZoneNutrition', 'nutrition');
    bindZoneButton('btnZoneFitness', 'fitness');

    bindPlayAnchor('btnPlayHygiene', 'hygiene');
    bindPlayAnchor('btnPlayNutrition', 'nutrition');
    bindPlayAnchor('btnPlayFitness', 'fitness');

    [
      'btnFitnessPlanner',
      'btnFPLauncher',
      'btnFPQuick',
      'btnFPClass',
      'btnFPWeekly'
    ].forEach(bindPlannerAnchor);

    const btnResume = byId('btnResumeNow');
    if (btnResume && !btnResume.__hhBound) {
      btnResume.__hhBound = true;
      btnResume.addEventListener('click', function () {
        goZone(getLastZone() || 'nutrition');
      });
    }

    const btnNext = byId('btnNextInZone');
    if (btnNext && !btnNext.__hhBound) {
      btnNext.__hhBound = true;
      btnNext.addEventListener('click', function () {
        goZone(getNextZone() || getRecommendedZone() || 'nutrition');
      });
    }

    const btnQuickRecommended = byId('btnQuickRecommended');
    if (btnQuickRecommended && !btnQuickRecommended.__hhBound) {
      btnQuickRecommended.__hhBound = true;
      btnQuickRecommended.addEventListener('click', function () {
        goZone(getRecommendedZone() || 'nutrition');
      });
    }

    const btnQuickRecent = byId('btnQuickRecent');
    if (btnQuickRecent && !btnQuickRecent.__hhBound) {
      btnQuickRecent.__hhBound = true;
      btnQuickRecent.addEventListener('click', function () {
        goZone(getLastZone() || 'nutrition');
      });
    }

    const btnQuickAllGames = byId('btnQuickAllGames');
    if (btnQuickAllGames && !btnQuickAllGames.__hhBound) {
      btnQuickAllGames.__hhBound = true;
      btnQuickAllGames.addEventListener('click', function () {
        goZone(getRecommendedZone() || 'nutrition');
      });
    }

    const btnReset = byId('btnResetTodayMissions');
    if (btnReset && !btnReset.__hhBound) {
      btnReset.__hhBound = true;
      btnReset.addEventListener('click', function () {
        safeSetStorage(KEYS.LAST_ZONE, '');
        safeSetStorage(KEYS.NEXT_ZONE, '');
        safeSetStorage(KEYS.RECOMMENDED_ZONE, 'nutrition');
        refreshView();
        showToast('รีเซ็ตภารกิจวันนี้แล้ว');
      });
    }
  }

  function renderMissionChips(id, labels) {
    const box = byId(id);
    if (!box) return;
    clearChildren(box);

    (labels || []).forEach((label) => {
      const chip = D.createElement('span');
      chip.className = 'reward-chip';
      chip.textContent = label;
      box.appendChild(chip);
    });
  }

  function renderMissions() {
    renderMissionChips('chainHygiene', ['ล้างมือ', 'แปรงฟัน']);
    renderMissionChips('chainNutrition', ['อาหารดี', 'ครบ 5 หมู่']);
    renderMissionChips('chainFitness', ['ขยับร่างกาย', 'เล่นต่อเนื่อง']);
  }

  function renderStickerShelf() {
    const box = byId('stickerShelf');
    if (!box) return;
    clearChildren(box);

    const items = ['🫧', '🥗', '🏃', '⭐'];
    items.forEach((emoji) => {
      const sticker = D.createElement('div');
      sticker.className = 'sticker';
      sticker.textContent = emoji;
      box.appendChild(sticker);
    });
  }

  function renderMissionList() {
    const box = byId('missionList');
    if (!box) return;
    clearChildren(box);

    const items = [
      { title: 'เริ่มจากโซนที่แนะนำ', sub: 'ระบบจะพาไปโซนที่เหมาะกับรอบนี้' },
      { title: 'เล่นให้ครบ 1 เกม', sub: 'เลือกโซนที่ชอบแล้วเริ่มได้เลย' },
      { title: 'เปิด Planner', sub: 'วางแผนกิจกรรมก่อนหรือหลังเล่นเกมก็ได้' }
    ];

    items.forEach((item) => {
      const div = D.createElement('div');
      div.className = 'mission-item';
      div.innerHTML = `<strong>${item.title}</strong><small>${item.sub}</small>`;
      box.appendChild(div);
    });
  }

  function renderSummaryBox() {
    const box = byId('summaryBox');
    if (!box) return;
    clearChildren(box);

    const lastZone = getLastZone();
    const gjSnap = readJSON(KEYS.GJ_SNAPSHOT, null);

    const items = [];
    if (lastZone) {
      items.push({
        title: `ล่าสุด: ${zoneLabel(lastZone)}`,
        sub: 'กดเล่นต่อได้จากปุ่มด้านบน'
      });
    }

    if (gjSnap?.target?.label) {
      items.push({
        title: `Nutrition target: ${gjSnap.target.label}`,
        sub: 'เปิด Nutrition Zone เพื่อเล่นต่อ'
      });
    }

    if (!items.length) {
      items.push({
        title: 'ยังไม่มีการผจญภัยล่าสุด',
        sub: 'เริ่มจากโซนที่อยากเล่นได้เลย'
      });
    }

    items.slice(0, 3).forEach((item) => {
      const div = D.createElement('div');
      div.className = 'summary-item';
      div.innerHTML = `<strong>${item.title}</strong><small>${item.sub}</small>`;
      box.appendChild(div);
    });
  }

  function renderRecentPills() {
    const lastZone = getLastZone();
    const gjSnap = readJSON(KEYS.GJ_SNAPSHOT, null);

    hide('hygRecentPill');
    hide('nutriRecentPill');
    hide('fitRecentPill');

    if (lastZone === 'hygiene') {
      show('hygRecentPill');
      setText('hygRecentText', 'เพิ่งเล่นล่าสุด');
    }

    if (lastZone === 'nutrition') {
      show('nutriRecentPill');
      setText('nutriRecentText', gjSnap?.archive?.recent?.[0]?.label || 'เพิ่งเล่นล่าสุด');
    }

    if (lastZone === 'fitness') {
      show('fitRecentPill');
      setText('fitRecentText', 'เพิ่งเล่นล่าสุด');
    }

    if (gjSnap?.target?.label) {
      setText('nutriFeatured', gjSnap.target.label);
    }
  }

  function refreshTodayHints() {
    const lastZone = getLastZone();
    const recommended = getRecommendedZone() || computeRecommendedZone(lastZone);
    const nextZone = getNextZone() || recommended;

    setRecommendedZone(recommended);
    setNextZone(nextZone);

    setText('todayPlayedCount', lastZone ? '1' : '0');
    setText('todayZoneCount', lastZone ? '1' : '0');
    setText('todayLastGame', lastZone ? zoneLabel(lastZone) : 'ยังไม่มี');
    setText('todayNextGame', nextZone ? `ไป ${zoneThaiLabel(nextZone)} Zone` : 'ระบบกำลังเลือกให้');
  }

  function refreshHeroQuickline() {
    const lastZone = getLastZone();
    const recommended = getRecommendedZone() || computeRecommendedZone(lastZone);

    let text = 'วันนี้ลองเล่นให้ครบ 3 โซนกันนะ';
    if (recommended) text = `วันนี้แนะนำให้เริ่มที่ ${zoneThaiLabel(recommended)} Zone`;
    if (lastZone) text = `ล่าสุดเล่น ${zoneThaiLabel(lastZone)} Zone แล้ว ลองไปต่ออีกโซนกัน`;

    setText('heroQuickline', text);
  }

  function refreshProfile() {
    const name = getPlayerName();
    setText('playerName', name);
    setText('playerMeta', `ฮีโร่ ${name} • พร้อมผจญภัย`);
  }

  function hideLegacyNoise() {
    const libraryBox = byId('libraryBox');
    if (libraryBox) {
      libraryBox.innerHTML = '';
      libraryBox.hidden = true;
      libraryBox.style.display = 'none';
      libraryBox.style.visibility = 'hidden';
      libraryBox.style.pointerEvents = 'none';
      libraryBox.style.height = '0';
      libraryBox.style.minHeight = '0';
      libraryBox.style.margin = '0';
      libraryBox.style.padding = '0';
      libraryBox.style.overflow = 'hidden';
    }
  }

  function buildDebugSnapshot() {
    const ctx = getCtx();
    return {
      href: W.location.href,
      ctx,
      zoneState: {
        lastZone: getLastZone(),
        nextZone: getNextZone(),
        recommendedZone: getRecommendedZone()
      },
      resolved: {
        hygieneZone: buildZoneUrl('hygiene'),
        nutritionZone: buildZoneUrl('nutrition'),
        fitnessZone: buildZoneUrl('fitness'),
        plannerLauncher: buildPlannerUrl('launcher'),
        plannerQuick: buildPlannerUrl('quick'),
        plannerClass: buildPlannerUrl('class'),
        plannerWeekly: buildPlannerUrl('weekly')
      }
    };
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  function renderQuickLinks(links) {
    const wrap = byId('diagQuickLinks');
    if (!wrap) return;
    clearChildren(wrap);

    Object.entries(links).forEach(([label, href]) => {
      if (!href) return;
      const a = D.createElement('a');
      a.className = 'diag-link';
      a.href = href;
      a.textContent = label;
      wrap.appendChild(a);
    });
  }

  function refreshDiagnostics() {
    const snap = buildDebugSnapshot();
    setText('diagContext', safeStringify(snap.ctx));
    setText('diagWarmup', safeStringify({
      lastZone: getLastZone(),
      nextZone: getNextZone(),
      recommendedZone: getRecommendedZone()
    }));
    setText('diagLastSummary', safeStringify(readJSON(KEYS.GJ_SNAPSHOT, null)));
    setText('diagRecentByZone', safeStringify({
      hygiene: byId('hygRecentText')?.textContent || '-',
      nutrition: byId('nutriRecentText')?.textContent || '-',
      fitness: byId('fitRecentText')?.textContent || '-'
    }));
    setText('diagResolvedRoutes', safeStringify(snap.resolved));

    renderQuickLinks({
      'Hygiene Zone': snap.resolved.hygieneZone,
      'Nutrition Zone': snap.resolved.nutritionZone,
      'Fitness Zone': snap.resolved.fitnessZone,
      'Planner Launcher': snap.resolved.plannerLauncher,
      'Planner Quick': snap.resolved.plannerQuick,
      'Planner Class': snap.resolved.plannerClass,
      'Planner Weekly': snap.resolved.plannerWeekly
    });
  }

  function copyText(text) {
    if (W.navigator?.clipboard?.writeText) {
      return W.navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      try {
        const ta = D.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        D.body.appendChild(ta);
        ta.select();
        D.execCommand('copy');
        D.body.removeChild(ta);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  function showToast(message) {
    const toast = byId('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (toast.__hideTimer) W.clearTimeout(toast.__hideTimer);
    toast.__hideTimer = W.setTimeout(function () {
      toast.classList.remove('show');
    }, 1800);
  }

  function bindDiagnostics() {
    const btnOpen = byId('btnDiagnostics');
    if (btnOpen && !btnOpen.__hhBound) {
      btnOpen.__hhBound = true;
      btnOpen.addEventListener('click', function () {
        refreshDiagnostics();
        show('diagnosticsPanel');
      });
    }

    const btnClose = byId('btnCloseDiagnostics');
    if (btnClose && !btnClose.__hhBound) {
      btnClose.__hhBound = true;
      btnClose.addEventListener('click', function () {
        hide('diagnosticsPanel');
      });
    }

    const btnCopy = byId('btnCopyDebugSnapshot');
    if (btnCopy && !btnCopy.__hhBound) {
      btnCopy.__hhBound = true;
      btnCopy.addEventListener('click', function () {
        copyText(safeStringify(buildDebugSnapshot()))
          .then(function () { showToast('คัดลอก snapshot แล้ว'); })
          .catch(function () { showToast('คัดลอก snapshot ไม่สำเร็จ'); });
      });
    }
  }

  function refreshView() {
    hideLegacyNoise();
    stripUnusedBlocks();
    applyLinks();
    refreshProfile();
    refreshTodayHints();
    refreshHeroQuickline();
    renderRecentPills();
    renderMissionList();
    renderSummaryBox();
    renderMissions();
    renderStickerShelf();
    refreshDiagnostics();
  }

  function boot() {
    bindButtons();
    bindDiagnostics();
    refreshView();
  }

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  W.addEventListener('focus', refreshView);
  W.addEventListener('pageshow', refreshView);
  D.addEventListener('visibilitychange', function () {
    if (!D.hidden) refreshView();
  });
})(window, document);