(function GoodJunkBattleV2NavSafetyPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.44-nav-safety-goodjunk-battle';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  const isGoodJunkBattle =
    /goodjunk-battle-v2/i.test(path) ||
    !!window.GJ_BATTLE_RUNTIME ||
    !!window.GJ_BATTLE_CORE ||
    !!window.GJ_BATTLE_LOBBY;

  if (!isGoodJunkBattle) return;

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $all(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function normalizeRoomCode(raw){
    const out = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
    if (!out || /^-+$/.test(out) || /^_+$/.test(out)) return '';
    return out;
  }

  function normalizeView(v){
    v = String(v || '').toLowerCase().trim();
    if (v === 'cvr' || v === 'vr' || v === 'cardboard-vr') return 'cardboard';
    if (v === 'cardboard') return 'cardboard';
    if (v === 'mobile' || v === 'phone' || v === 'touch') return 'mobile';
    if (v === 'pc' || v === 'desktop') return 'pc';

    const mobile =
      (window.matchMedia && window.matchMedia('(max-width:760px)').matches) ||
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

    return mobile ? 'mobile' : 'pc';
  }

  function getValue(key, fallback){
    const fromParams = params.get(key);
    if (fromParams !== null && fromParams !== '') return fromParams;

    if (key === 'pid'){
      return window.GJ_PLAYER_ID || window.MY_PLAYER_ID ||
        localStorage.getItem('GJ_BATTLE_PID') ||
        localStorage.getItem('HHA_GJ_PID') ||
        fallback || 'anon';
    }

    if (key === 'name'){
      return window.GJ_PLAYER_NAME || window.MY_PLAYER_NAME ||
        localStorage.getItem('GJ_BATTLE_NAME') ||
        localStorage.getItem('HHA_GJ_NAME') ||
        fallback || 'Hero';
    }

    if (key === 'room' || key === 'roomCode'){
      return normalizeRoomCode(
        params.get('room') ||
        params.get('roomCode') ||
        params.get('code') ||
        params.get('lastRoom') ||
        window.GJ_ROOM_CODE ||
        window.ROOM_CODE ||
        fallback ||
        ''
      );
    }

    if (key === 'view'){
      return normalizeView(params.get('view') || params.get('device') || window.GJ_VIEW || fallback || '');
    }

    return fallback || '';
  }

  function nutritionZoneUrl(){ return new URL('../nutrition-zone.html', location.href); }
  function hubUrl(){
    const hub = params.get('hub');
    if (hub){
      try{ return new URL(hub, location.href); }catch(_){}
    }
    return new URL('../hub.html', location.href);
  }
  function goodjunkLauncherUrl(){ return new URL('../goodjunk-launcher.html', location.href); }
  function lobbyUrl(){ return new URL('./goodjunk-battle-v2-lobby.html', location.href); }

  function runUrlByView(view){
    view = normalizeView(view);
    if (view === 'mobile') return new URL('./goodjunk-battle-v2-run-mobile.html', location.href);
    if (view === 'cardboard') return new URL('./goodjunk-battle-v2-run-cardboard.html', location.href);
    return new URL('./goodjunk-battle-v2-run-pc.html', location.href);
  }

  function addCommonParams(out, options){
    options = options || {};
    const pid = getValue('pid', 'anon');
    const name = getValue('name', 'Hero');
    const view = normalizeView(options.view || getValue('view', ''));
    const room = getValue('room', '');

    out.searchParams.set('pid', pid);
    out.searchParams.set('name', name);
    out.searchParams.set('view', view);
    out.searchParams.set('diff', params.get('diff') || 'normal');
    out.searchParams.set('time', params.get('time') || '90');
    out.searchParams.set('zone', params.get('zone') || 'nutrition');
    out.searchParams.set('cat', params.get('cat') || 'nutrition');
    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('mode', 'battle');
    out.searchParams.set('entry', 'battle');
    out.searchParams.set('variant', 'battle-v2');
    out.searchParams.set('theme', params.get('theme') || 'goodjunk');

    if (room){
      out.searchParams.set('room', room);
      out.searchParams.set('roomCode', room);
    }

    ['studyId','conditionGroup','api','log','seed','matchId','roundId','runId'].forEach(function(k){
      const v = params.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    if (params.get('hub')) out.searchParams.set('hub', params.get('hub'));
    else out.searchParams.set('hub', hubUrl().toString());

    return out;
  }

  function buildUrl(kind, options){
    let out;
    if (kind === 'nutrition-zone' || kind === 'zone'){
      out = nutritionZoneUrl();
      addCommonParams(out, options);
      ['room','roomCode','matchId','roundId','runId','run','phase'].forEach(k => out.searchParams.delete(k));
      return out.toString();
    }

    if (kind === 'hub'){
      out = hubUrl();
      if (!out.searchParams.get('pid')) out.searchParams.set('pid', getValue('pid', 'anon'));
      if (!out.searchParams.get('name')) out.searchParams.set('name', getValue('name', 'Hero'));
      if (!out.searchParams.get('view')) out.searchParams.set('view', normalizeView(getValue('view', '')));
      return out.toString();
    }

    if (kind === 'all-modes' || kind === 'modes' || kind === 'launcher'){
      out = goodjunkLauncherUrl();
      addCommonParams(out, options);
      ['room','roomCode','matchId','roundId','runId','run','phase'].forEach(k => out.searchParams.delete(k));
      return out.toString();
    }

    if (kind === 'lobby'){
      out = lobbyUrl();
      addCommonParams(out, options);
      ['run','phase'].forEach(k => out.searchParams.delete(k));
      return out.toString();
    }

    if (kind === 'run'){
      out = runUrlByView(options && options.view || getValue('view', ''));
      addCommonParams(out, options);
      out.searchParams.set('run', 'play');
      out.searchParams.set('phase', 'play');
      return out.toString();
    }

    out = goodjunkLauncherUrl();
    addCommonParams(out, options);
    return out.toString();
  }

  function go(kind, options){ location.href = buildUrl(kind, options); }

  function bind(selector, kind){
    $all(selector).forEach(function(el){
      if (!el || el.dataset.gjNavSafetyBound === '1') return;
      el.dataset.gjNavSafetyBound = '1';
      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(kind);
      }, true);
    });
  }

  function bindKnownButtons(){
    bind('[data-back-lobby], #btnBackLobby, #btnResultLobby', 'lobby');
    bind('[data-all-modes], #btnAllModes, #btnAllModesTop, #btnModes, #btnGameModes', 'all-modes');
    bind('[data-nutrition-zone], #btnNutritionZone, #btnBackZone, #btnZone', 'nutrition-zone');
    bind('[data-back-hub], #btnHub, #btnResultHub, #btnBackHub', 'hub');
  }

  window.GJ_BATTLE_NAV_SAFETY = {
    version: PATCH_VERSION,
    buildUrl,
    go,
    lobbyUrl:function(){ return buildUrl('lobby'); },
    allModesUrl:function(){ return buildUrl('all-modes'); },
    nutritionZoneUrl:function(){ return buildUrl('nutrition-zone'); },
    hubUrl:function(){ return buildUrl('hub'); },
    runUrl:function(view){ return buildUrl('run', {view:view}); }
  };

  window.GJ_BATTLE_BUILD_SAFE_URL = function(kindOrPath, options){
    const known = ['lobby','all-modes','modes','launcher','nutrition-zone','zone','hub','run'];
    if (known.includes(String(kindOrPath || ''))) return buildUrl(kindOrPath, options || {});
    const out = new URL(kindOrPath, location.href);
    addCommonParams(out, options || {});
    return out.toString();
  };

  function boot(){
    document.documentElement.dataset.gjBattleNavPatch = PATCH_VERSION;
    bindKnownButtons();
    setInterval(bindKnownButtons, 900);
    console.info('[GoodJunk Battle Nav Safety Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
