// /herohealth/vr-rhythm-boxer-bloom/js/index.js
'use strict';

(function (W, D, B) {
  const qs = new URLSearchParams(W.location.search);
  const $ = (id) => D.getElementById(id);

  const params = B.createParams(qs, {
    back: '../rhythm-boxer-vr.html',
    next: '../vr-rhythm-boxer-main/boxer.html'
  });

  const PATHS = {
    index: './index.html',
    badge: './beat-badge-match.html',
    hit: './hit-line-coach.html',
    pattern: './pattern-detective.html',
    combo: './combo-composer.html',
    main: '../vr-rhythm-boxer-main/boxer.html',
    gate: '../warmup-gate.html',
    launcher: '../rhythm-boxer-vr.html'
  };

  const els = {
    pid: $('pid'),
    name: $('name'),
    studyId: $('studyId'),

    btnBack: $('btnBack'),
    btnHubTop: $('btnHubTop'),

    btnLearnPath: $('btnLearnPath'),
    btnLearnSingle: $('btnLearnSingle'),
    btnAnalyzePath: $('btnAnalyzePath'),
    btnAnalyzeSingle: $('btnAnalyzeSingle'),
    btnCreateLab: $('btnCreateLab'),
    btnCreateSingle: $('btnCreateSingle'),
    btnMainDirect: $('btnMainDirect'),
    btnBackLauncher: $('btnBackLauncher'),

    previewUrl: $('previewUrl'),

    recentSub: $('recentSub'),
    recentGame: $('recentGame'),
    recentRank: $('recentRank'),
    recentScore: $('recentScore'),
    recentAcc: $('recentAcc')
  };

  function readRadio(name, fallback) {
    const el = D.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : fallback;
  }

  function setRadio(name, value) {
    const el = D.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function currentCtx() {
    return {
      pid: els.pid?.value || params.pid,
      name: els.name?.value || params.name,
      studyId: els.studyId?.value || params.studyId,
      diff: readRadio('diff', params.diff),
      time: readRadio('time', String(params.time || 60)),
      view: readRadio('view', params.view),
      run: params.run,
      zone: params.zone,
      cat: params.cat,
      hub: params.hub,
      cooldown: params.cooldown,
      gate: qs.get('gate') || '1',
      seed: qs.get('seed') || String(Date.now()),
      planDay: params.planDay,
      planSlot: params.planSlot,
      theme: 'rhythmboxer'
    };
  }

  function buildUrl(base, extra = {}) {
    const ctx = currentCtx();
    const merged = Object.assign({}, ctx, extra);
    return B.passthroughUrl(base, qs, merged);
  }

  function buildMainGameUrl(extra = {}) {
    return buildUrl(PATHS.main, Object.assign({
      back: PATHS.index,
      next: '',
      game: 'rhythmboxer',
      gameId: 'rhythmboxer',
      theme: 'rhythmboxer'
    }, extra));
  }

  function buildLearnChain() {
    const main = buildMainGameUrl({ entry: 'learn' });

    const hit = buildUrl(PATHS.hit, {
      back: PATHS.index,
      next: main,
      entry: 'learn',
      game: 'hit-line-coach',
      gameId: 'hit-line-coach'
    });

    const badge = buildUrl(PATHS.badge, {
      back: PATHS.index,
      next: hit,
      entry: 'learn',
      game: 'beat-badge-match',
      gameId: 'beat-badge-match'
    });

    return badge;
  }

  function buildAnalyzeChain() {
    const main = buildMainGameUrl({ entry: 'analyze' });

    return buildUrl(PATHS.pattern, {
      back: PATHS.index,
      next: main,
      entry: 'analyze',
      game: 'pattern-detective',
      gameId: 'pattern-detective'
    });
  }

  function buildCreateChain() {
    const main = buildMainGameUrl({ entry: 'create' });

    return buildUrl(PATHS.combo, {
      back: PATHS.index,
      next: main,
      entry: 'create',
      game: 'combo-composer',
      gameId: 'combo-composer'
    });
  }

  function buildMainDirect() {
    return buildMainGameUrl({ entry: 'main' });
  }

  function wrapWarmup(nextUrl, entryName) {
    const gateEnabled = String(currentCtx().gate || '1') !== '0';
    if (!gateEnabled) return nextUrl;

    const gateUrl = buildUrl(PATHS.gate, {
      phase: 'warmup',
      gatePhase: 'warmup',
      next: nextUrl,
      back: PATHS.index,
      entry: entryName || '',
      dur: qs.get('dur') || '20',
      cdur: qs.get('cdur') || '20',
      game: 'rhythm-boxer',
      gameId: 'rhythm-boxer',
      theme: 'rhythmboxer'
    });

    return gateUrl;
  }

  function gameLabel(game) {
    const g = String(game || '').toLowerCase();
    if (g === 'beat-badge-match') return 'Beat Badge Match';
    if (g === 'hit-line-coach') return 'Hit Line Coach';
    if (g === 'pattern-detective') return 'Pattern Detective';
    if (g === 'combo-composer') return 'Combo Composer';
    if (g === 'rhythmboxer' || g === 'rhythm-boxer') return 'Main Game';
    return '-';
  }

  function readRecentSummary() {
    const pid = els.pid?.value || params.pid;
    const keys = [
      'HHA_LAST_SUMMARY',
      `HHA_LAST_SUMMARY:combo-composer:${pid}`,
      `HHA_LAST_SUMMARY:pattern-detective:${pid}`,
      `HHA_LAST_SUMMARY:hit-line-coach:${pid}`,
      `HHA_LAST_SUMMARY:beat-badge-match:${pid}`,
      `HHA_LAST_SUMMARY:rhythmboxer:${pid}`
    ];

    for (const key of keys) {
      try {
        const raw = W.localStorage.getItem(key);
        if (!raw) continue;
        const obj = JSON.parse(raw);
        if (obj && obj.game) return obj;
      } catch (_) {}
    }
    return null;
  }

  function renderRecent() {
    const last = readRecentSummary();

    if (!last) {
      if (els.recentSub) els.recentSub.textContent = 'ยังไม่มีผลล่าสุดของ Bloom Pack';
      if (els.recentGame) els.recentGame.textContent = '-';
      if (els.recentRank) els.recentRank.textContent = '-';
      if (els.recentScore) els.recentScore.textContent = '-';
      if (els.recentAcc) els.recentAcc.textContent = '-';
      return;
    }

    const score =
      last.scoreFinal ??
      last.score ??
      last.replaySuccess ??
      0;

    const acc =
      last.accPct != null ? `${Number(last.accPct)}%`
      : (last.replayTotal != null ? `${Number(last.replaySuccess || 0)}/${Number(last.replayTotal || 0)}` : '-');

    if (els.recentSub) els.recentSub.textContent = `ผลล่าสุดจาก ${gameLabel(last.game)} พร้อมใช้เลือกเส้นทางถัดไป`;
    if (els.recentGame) els.recentGame.textContent = gameLabel(last.game);
    if (els.recentRank) els.recentRank.textContent = String(last.rank || '-');
    if (els.recentScore) els.recentScore.textContent = String(score);
    if (els.recentAcc) els.recentAcc.textContent = String(acc);
  }

  function renderPreview() {
    if (!els.previewUrl) return;

    const learn = wrapWarmup(buildLearnChain(), 'learn');
    const analyze = wrapWarmup(buildAnalyzeChain(), 'analyze');
    const create = wrapWarmup(buildCreateChain(), 'create');
    const main = wrapWarmup(buildMainDirect(), 'main');

    els.previewUrl.textContent = [
      'Learn Path',
      learn,
      '',
      'Analyze Path',
      analyze,
      '',
      'Create Lab',
      create,
      '',
      'Main Direct',
      main
    ].join('\n');
  }

  function bindLinks() {
    const learnWarm = wrapWarmup(buildLearnChain(), 'learn');
    const analyzeWarm = wrapWarmup(buildAnalyzeChain(), 'analyze');
    const createWarm = wrapWarmup(buildCreateChain(), 'create');
    const mainWarm = wrapWarmup(buildMainDirect(), 'main');

    if (els.btnBack) els.btnBack.href = buildUrl(PATHS.launcher, { back: '' });
    if (els.btnBackLauncher) els.btnBackLauncher.href = buildUrl(PATHS.launcher, { back: '' });
    if (els.btnHubTop) els.btnHubTop.href = buildUrl(params.hub, {});

    if (els.btnLearnPath) els.btnLearnPath.href = learnWarm;
    if (els.btnLearnSingle) els.btnLearnSingle.href = buildLearnChain();

    if (els.btnAnalyzePath) els.btnAnalyzePath.href = analyzeWarm;
    if (els.btnAnalyzeSingle) els.btnAnalyzeSingle.href = buildAnalyzeChain();

    if (els.btnCreateLab) els.btnCreateLab.href = createWarm;
    if (els.btnCreateSingle) els.btnCreateSingle.href = buildCreateChain();

    if (els.btnMainDirect) els.btnMainDirect.href = mainWarm;
  }

  function autoStartIfRequested() {
    const autostart = qs.get('autostart');
    const entry = qs.get('entry');

    if (autostart !== '1') return;

    if (entry === 'learn') {
      W.location.href = wrapWarmup(buildLearnChain(), 'learn');
    } else if (entry === 'analyze') {
      W.location.href = wrapWarmup(buildAnalyzeChain(), 'analyze');
    } else if (entry === 'create') {
      W.location.href = wrapWarmup(buildCreateChain(), 'create');
    } else if (entry === 'main') {
      W.location.href = wrapWarmup(buildMainDirect(), 'main');
    }
  }

  function boot() {
    if (els.pid) els.pid.value = params.pid;
    if (els.name) els.name.value = params.name;
    if (els.studyId) els.studyId.value = params.studyId;

    setRadio('diff', params.diff);
    setRadio('time', String(params.time || 60));
    setRadio('view', params.view);

    [
      els.pid, els.name, els.studyId,
      ...D.querySelectorAll('input[type="radio"]')
    ].forEach((el) => {
      if (!el) return;
      el.addEventListener('input', () => {
        bindLinks();
        renderPreview();
        renderRecent();
      });
      el.addEventListener('change', () => {
        bindLinks();
        renderPreview();
        renderRecent();
      });
    });

    bindLinks();
    renderPreview();
    renderRecent();
    autoStartIfRequested();
  }

  boot();
})(window, document, window.RBBloom);