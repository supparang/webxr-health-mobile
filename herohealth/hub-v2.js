(function (W, D) {
  'use strict';

  const byId = (id) => D.getElementById(id);
  const toast = byId('toast');
  const qs = new URLSearchParams(W.location.search);

  const ZONES = {
    hygiene: './hygiene-zone.html',
    nutrition: './nutrition-zone.html',
    fitness: './fitness-zone.html'
  };

  function qget(key, fallback = '') {
    const v = qs.get(key);
    return v == null || v === '' ? fallback : v;
  }

  function first(...vals) {
    for (const v of vals) {
      if (String(v || '').trim()) return String(v).trim();
    }
    return '';
  }

  function safeAbsUrl(raw, fallback) {
    const value = String(raw || '').trim();
    try {
      if (value) return new URL(value, W.location.href).toString();
    } catch (_) {}
    return new URL(fallback, W.location.href).toString();
  }

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function ctx() {
    return {
      pid: first(qget('pid'), 'anon'),
      name: first(qget('name'), qget('nickName'), qget('nick'), 'Hero'),
      diff: first(qget('diff'), 'normal'),
      view: first(qget('view'), 'mobile'),
      time: first(qget('time'), '90'),
      run: first(qget('run'), 'play'),
      studyId: first(qget('studyId'), ''),
      seed: first(qget('seed'), String(Date.now())),
      hubRoot: new URL(W.location.href).toString(),
      zoneReturn: new URL(W.location.href).toString()
    };
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    W.clearTimeout(showToast._timer);
    showToast._timer = W.setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function setLastZone(zone) {
    try {
      localStorage.setItem('HHA_LAST_ZONE', String(zone || '').trim().toLowerCase());
    } catch (_) {}
  }

  function passCommon(url, zone) {
    const c = ctx();

    const passthroughKeys = [
      'pid', 'name', 'nick', 'nickName', 'studyId',
      'run', 'diff', 'view', 'time', 'seed',
      'debug', 'api', 'log',
      'studentKey', 'schoolCode', 'classRoom', 'studentNo',
      'conditionGroup', 'sessionNo', 'weekNo', 'teacher', 'grade'
    ];

    passthroughKeys.forEach((k) => {
      const v = qs.get(k);
      if (v != null && v !== '') url.searchParams.set(k, v);
    });

    if (!url.searchParams.get('pid')) url.searchParams.set('pid', c.pid);
    if (!url.searchParams.get('name')) url.searchParams.set('name', c.name);
    if (!url.searchParams.get('diff')) url.searchParams.set('diff', c.diff);
    if (!url.searchParams.get('view')) url.searchParams.set('view', c.view);
    if (!url.searchParams.get('time')) url.searchParams.set('time', c.time);
    if (!url.searchParams.get('seed')) url.searchParams.set('seed', c.seed);
    if (!url.searchParams.get('run')) url.searchParams.set('run', c.run);
    if (!url.searchParams.get('studyId') && c.studyId) url.searchParams.set('studyId', c.studyId);

    if (zone) {
      url.searchParams.set('zone', zone);
      url.searchParams.set('cat', zone);
    }

    url.searchParams.set('hubRoot', c.hubRoot);
    url.searchParams.set('hub', c.hubRoot);
    url.searchParams.set('zoneReturn', c.hubRoot);
    url.searchParams.set('next', c.hubRoot);

    return url;
  }

  function buildZoneUrl(path, zone) {
    const url = new URL(path, W.location.href);
    passCommon(url, zone);
    return url.toString();
  }

  function buildPlannerUrl() {
    const url = new URL('./fitness-planner.html', W.location.href);
    passCommon(url, 'fitness');
    url.searchParams.set('game', 'fitnessplanner');
    url.searchParams.set('gameId', 'fitnessplanner');
    url.searchParams.set('theme', 'fitnessplanner');
    return url.toString();
  }

  function readLastGameCompat() {
    try {
      return (
        localStorage.getItem('HH_FITNESS_LAST_GAME_V1') ||
        localStorage.getItem('HHA_LAST_ZONE') ||
        ''
      );
    } catch (_) {
      return '';
    }
  }

  function pickRecommendedZone() {
    const lastZone = String(readLastGameCompat() || '').toLowerCase();

    if (lastZone.includes('hygiene')) return 'hygiene';
    if (lastZone.includes('nutrition')) return 'nutrition';
    if (lastZone.includes('fitness')) return 'fitness';

    return 'fitness';
  }

  function bindAnchorZone(id, href, zone) {
    const node = byId(id);
    if (!node) return;

    node.href = href;

    if (!node.__zoneBound) {
      node.__zoneBound = true;
      node.addEventListener('click', () => setLastZone(zone));
    }
  }

  function applyZoneLinks() {
    bindAnchorZone('btnPlayHygiene', buildZoneUrl(ZONES.hygiene, 'hygiene'), 'hygiene');
    bindAnchorZone('btnPlayNutrition', buildZoneUrl(ZONES.nutrition, 'nutrition'), 'nutrition');
    bindAnchorZone('btnPlayFitness', buildZoneUrl(ZONES.fitness, 'fitness'), 'fitness');
    bindAnchorZone('btnFitnessPlanner', buildPlannerUrl(), 'fitness');
  }

  function bindLinks() {
    const recommendedZone = pickRecommendedZone();

    const recommended = byId('btnQuickRecommended');
    if (recommended) {
      recommended.href = buildZoneUrl(ZONES[recommendedZone], recommendedZone);

      if (!recommended.__zoneBound) {
        recommended.__zoneBound = true;
        recommended.addEventListener('click', () => setLastZone(recommendedZone));
      }
    }

    const allGames = byId('btnQuickAllGames');
    if (allGames) {
      allGames.href = buildZoneUrl(ZONES[recommendedZone], recommendedZone);

      if (!allGames.__zoneBound) {
        allGames.__zoneBound = true;
        allGames.addEventListener('click', () => setLastZone(recommendedZone));
      }
    }
  }

  function bindButtons() {
    const btnSettings = byId('btnSettings');
    const btnRewards = byId('btnRewards');

    if (btnSettings && !btnSettings.__bound) {
      btnSettings.__bound = true;
      btnSettings.addEventListener('click', () => {
        showToast('หน้า local app พร้อมใช้งานแล้ว');
      });
    }

    if (btnRewards && !btnRewards.__bound) {
      btnRewards.__bound = true;
      btnRewards.addEventListener('click', () => {
        showToast('รางวัลจะอิงจากผลการเล่นในแต่ละโซน');
      });
    }
  }

  function refreshFeaturedTexts() {
    const hygRecent = readJson('HHA_LAST_GAME_BY_ZONE_HYGIENE', null);
    const nutriRecent = readJson('HHA_NUTRITION_RECENT', null);
    const fitRecent =
      readJson('HHA_LAST_SUMMARY_JUMPDUCK', null) ||
      readJson('HHA_LAST_SUMMARY', null) ||
      readJson('HHA_LAST_SUMMARY_GLOBAL', null);

    const hygFeatured = byId('hygFeatured');
    const nutriFeatured = byId('nutriFeatured');
    const fitFeatured = byId('fitFeatured');

    if (hygFeatured && hygRecent?.title) hygFeatured.textContent = hygRecent.title;
    if (nutriFeatured && nutriRecent?.title) nutriFeatured.textContent = nutriRecent.title;

    if (fitFeatured) {
      const fitGame = String(fitRecent?.game || '').toLowerCase();
      if (fitGame.includes('jump')) fitFeatured.textContent = 'JumpDuck';
      else if (fitGame.includes('shadow')) fitFeatured.textContent = 'Shadow Breaker';
      else if (fitGame.includes('rhythm')) fitFeatured.textContent = 'Rhythm Boxer';
      else if (fitGame.includes('balance')) fitFeatured.textContent = 'Balance Hold';
      else if (fitGame.includes('planner')) fitFeatured.textContent = 'Fitness Planner';
    }
  }

  function refreshProfile() {
    const c = ctx();

    const quickline = byId('heroQuickline');
    const recommendedZone = pickRecommendedZone();

    if (quickline) {
      if (recommendedZone === 'hygiene') {
        quickline.textContent = 'กลับไปต่อที่ Hygiene Zone ได้เลย';
      } else if (recommendedZone === 'nutrition') {
        quickline.textContent = 'กลับไปต่อที่ Nutrition Zone ได้เลย';
      } else {
        quickline.textContent = 'วันนี้ลองเริ่มที่ Fitness Zone ก่อนก็สนุกมาก';
      }
    }

    const playerName = byId('playerName');
    const playerMeta = byId('playerMeta');

    if (playerName) playerName.textContent = c.name || 'Hero';
    if (playerMeta) {
      playerMeta.textContent =
        c.pid && c.pid !== 'anon'
          ? `รหัสผู้เล่น: ${c.pid} • พร้อมผจญภัย`
          : 'ฮีโร่ประจำวัน • พร้อมผจญภัย';
    }
  }

  function refreshAll() {
    applyZoneLinks();
    bindLinks();
    refreshProfile();
    refreshFeaturedTexts();
  }

  function boot() {
    applyZoneLinks();
    bindLinks();
    bindButtons();
    refreshProfile();
    refreshFeaturedTexts();

    W.addEventListener('focus', refreshAll);
    D.addEventListener('visibilitychange', () => {
      if (!D.hidden) refreshAll();
    });
  }

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(window, document);
