(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const $ = (s, root = DOC) => root.querySelector(s);
  const nowMs = () => (WIN.performance && performance.now) ? performance.now() : Date.now();

  const SB_DEFAULT_HUB = 'https://supparang.github.io/webxr-health-mobile/herohealth/fitness-planner.html';
  const SB_DEFAULT_LAUNCHER = 'https://supparang.github.io/webxr-health-mobile/fitness/shadow-breaker.html';

  function qs(k, d = ''){
    try{
      const v = (new URL(location.href)).searchParams.get(k);
      return v == null ? d : v;
    }catch(_){
      return d;
    }
  }

  function sbSafeAbsUrl(raw, fallback = ''){
    const value = String(raw || '').trim();
    try{
      if (value) return new URL(value, location.href).toString();
    }catch(_){}
    return fallback || '';
  }

  function sbNormalizeHubUrl(raw){
    const href = sbSafeAbsUrl(raw, SB_DEFAULT_HUB);
    if (!href) return SB_DEFAULT_HUB;

    const s = String(href).toLowerCase();

    if (
      s.endsWith('/webxr-health-mobile/fitness') ||
      s.endsWith('/webxr-health-mobile/fitness/') ||
      s === 'https://supparang.github.io/webxr-health-mobile/fitness/' ||
      s === 'https://supparang.github.io/webxr-health-mobile/fitness'
    ) {
      return SB_DEFAULT_HUB;
    }

    return href;
  }

  function sbNormalizeLauncherUrl(raw){
    const href = sbSafeAbsUrl(raw, SB_DEFAULT_LAUNCHER);
    return href || SB_DEFAULT_LAUNCHER;
  }

  function sbIsPlannerStrictFlow(){
    const hubUrl = String(qs('hub', '')).toLowerCase();
    return (
      qs('plannerFlow', '') === '1' ||
      qs('fpStrict', '') === '1' ||
      String(qs('cooldown', '')).toLowerCase() === '0' ||
      String(qs('returnPhase', '')).toLowerCase() === 'planner' ||
      hubUrl.includes('fitness-planner') ||
      hubUrl.includes('fpresume=1') ||
      hubUrl.includes('plan=')
    );
  }

  function sbPlannerReturnBase(overrides = {}){
    return sbNormalizeHubUrl(overrides.hub ?? qs('hub', SB_DEFAULT_HUB) ?? SB_DEFAULT_HUB);
  }

  function sbBuildPlannerReturnUrl(summary = {}, overrides = {}){
    const base = sbPlannerReturnBase(overrides);
    try{
      const u = new URL(base, location.href);

      u.searchParams.set('plannerReturn', '1');
      u.searchParams.set('completedGame', 'shadowbreaker');
      u.searchParams.set('game', 'shadowbreaker');
      u.searchParams.set('gameId', 'shadowbreaker');
      u.searchParams.set('zone', 'fitness');
      u.searchParams.set('cat', 'fitness');

      if (summary?.pid) u.searchParams.set('pid', String(summary.pid));
      if (summary?.scoreFinal != null) u.searchParams.set('score', String(summary.scoreFinal));
      if (summary?.grade) u.searchParams.set('grade', String(summary.grade));
      if (summary?.accPct != null) u.searchParams.set('acc', String(summary.accPct));
      if (summary?.comboMax != null) u.searchParams.set('combo', String(summary.comboMax));
      if (summary?.bossesCleared != null) u.searchParams.set('bosses', String(summary.bossesCleared));
      if (summary?.end_reason) u.searchParams.set('result', String(summary.end_reason));

      return u.toString();
    }catch(_){
      return base;
    }
  }