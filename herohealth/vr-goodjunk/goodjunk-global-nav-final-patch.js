(function GoodJunkGlobalNavFinalPatch(){
  'use strict';

  const PATCH_VERSION = 'v1.0.0-goodjunk-global-nav-final';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  const isGoodJunkPage =
    /goodjunk/i.test(path) ||
    params.get('game') === 'goodjunk' ||
    params.get('gameId') === 'goodjunk';

  if (!isGoodJunkPage) return;

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function now(){
    return Date.now();
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

  function getPid(){
    return (
      params.get('pid') ||
      localStorage.getItem('GJ_BATTLE_PID') ||
      localStorage.getItem('HHA_GJ_PID') ||
      'anon'
    );
  }

  function getName(){
    return (
      params.get('name') ||
      localStorage.getItem('GJ_BATTLE_NAME') ||
      localStorage.getItem('HHA_GJ_NAME') ||
      'Hero'
    );
  }

  function getView(){
    return normalizeView(
      params.get('view') ||
      params.get('device') ||
      ''
    );
  }

  function copyCommonParams(out){
    const common = [
      'pid',
      'name',
      'diff',
      'time',
      'view',
      'device',
      'hub',
      'studyId',
      'conditionGroup',
      'api',
      'log'
    ];

    common.forEach(function(k){
      if (out.searchParams.get(k)) return;

      let v = params.get(k);

      if (k === 'pid') v = getPid();
      if (k === 'name') v = getName();
      if (k === 'view' || k === 'device') v = getView();

      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');

    return out;
  }

  function stripRoomParams(out){
    [
      'room',
      'roomCode',
      'code',
      'lastRoom',
      'matchId',
      'roundId',
      'runId',
      'activeMatchId',
      'phase',
      'run'
    ].forEach(function(k){
      out.searchParams.delete(k);
    });

    return out;
  }

  function buildLauncherUrl(){
    const out = new URL('../goodjunk-launcher.html', location.href);
    copyCommonParams(out);
    stripRoomParams(out);
    out.searchParams.set('from', 'goodjunk-global-nav');
    out.searchParams.set('t', String(now()));
    return out.toString();
  }

  function buildModesUrl(){
    /*
     * ใช้ goodjunk-launcher.html เป็น canonical modes page
     * ไม่กลับไป goodjunk-modes.html แล้ว
     */
    return buildLauncherUrl();
  }

  function buildNutritionZoneUrl(){
    const out = new URL('../nutrition-zone.html', location.href);
    copyCommonParams(out);
    stripRoomParams(out);
    out.searchParams.set('from', 'goodjunk-global-nav');
    out.searchParams.set('t', String(now()));
    return out.toString();
  }

  function buildHubUrl(){
    const hub = params.get('hub');

    if (hub){
      try{
        const out = new URL(hub, location.href);
        if (!out.searchParams.get('pid')) out.searchParams.set('pid', getPid());
        if (!out.searchParams.get('name')) out.searchParams.set('name', getName());
        if (!out.searchParams.get('view')) out.searchParams.set('view', getView());
        return out.toString();
      }catch(_){}
    }

    const out = new URL('../hub.html', location.href);
    copyCommonParams(out);
    stripRoomParams(out);
    return out.toString();
  }

  function buildSoloBossUrl(){
    /*
     * ใช้ current path ถ้าอยู่ solo อยู่แล้ว
     * ไม่บังคับเดาชื่อไฟล์ใหม่ เพื่อกัน path หลุด
     */
    const out = new URL(location.href);

    copyCommonParams(out);
    stripRoomParams(out);

    out.searchParams.set('mode', 'solo-boss');
    out.searchParams.set('run', 'play');
    out.searchParams.set('phase', 'play');
    out.searchParams.set('seed', String(now()));
    out.searchParams.set('t', String(now()));

    return out.toString();
  }

  function go(target){
    location.href = target;
  }

  function buttonText(el){
    return String(el && el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function bindOnce(el, key, handler){
    if (!el || el.dataset[key] === '1') return;

    el.dataset[key] = '1';
    el.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      handler(ev, el);
    }, true);
  }

  function bindKnownButtons(){
    const buttons = $all('button,a');

    buttons.forEach(function(btn){
      const text = buttonText(btn);
      const id = String(btn.id || '');
      const cls = String(btn.className || '');
      const data = JSON.stringify(btn.dataset || {});
      const all = [text, id, cls, data].join(' ');

      /*
       * โหมดทั้งหมด / กลับเลือกโหมด / launcher
       */
      if (
        /โหมดทั้งหมด|เลือกโหมด|กลับเลือกโหมด|Mode|Modes|Launcher/i.test(all) ||
        /btnAllModes|btnModes|btnGameModes|backMode|backLobby|launcher/i.test(all)
      ){
        bindOnce(btn, 'gjGlobalNavModesBound', function(){
          go(buildModesUrl());
        });
        return;
      }

      /*
       * Nutrition Zone
       */
      if (
        /Nutrition Zone|โซนโภชนาการ|กลับ Zone|กลับโซน|Nutrition/i.test(all) ||
        /nutrition|backZone|btnZone|btnNutritionZone/i.test(all)
      ){
        bindOnce(btn, 'gjGlobalNavZoneBound', function(){
          go(buildNutritionZoneUrl());
        });
        return;
      }

      /*
       * Hub
       */
      if (
        /^Hub$|HUB|หน้าหลัก|🏠/i.test(text) ||
        /btnHub|backHub|data-back-hub/i.test(all)
      ){
        bindOnce(btn, 'gjGlobalNavHubBound', function(){
          go(buildHubUrl());
        });
        return;
      }
    });
  }

  function exposeApi(){
    window.GJ_GLOBAL_NAV_FINAL = {
      version: PATCH_VERSION,
      buildLauncherUrl,
      buildModesUrl,
      buildNutritionZoneUrl,
      buildHubUrl,
      buildSoloBossUrl,
      bindKnownButtons
    };
  }

  function boot(){
    exposeApi();
    bindKnownButtons();

    const mo = new MutationObserver(function(){
      bindKnownButtons();
    });

    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    setInterval(bindKnownButtons, 1000);

    console.info('[GoodJunk Global Nav Final Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();