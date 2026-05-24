(function GoodJunkLauncherRouteFinalPatch(){
  'use strict';

  const PATCH_VERSION = 'v1.1.0-goodjunk-launcher-route-final-all-modes';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  /*
   * ใช้เฉพาะ goodjunk-launcher.html เท่านั้น
   */
  if (!/\/herohealth\/goodjunk-launcher\.html$/i.test(path) && !/goodjunk-launcher\.html$/i.test(path)){
    return;
  }

  /*
   * Canonical routes ตามที่ตกลงกัน
   * ถ้า Solo Boss production file ชื่อไม่ใช่ goodjunk-solo-boss.html
   * patch จะพยายาม preserve href เดิมของปุ่ม solo ก่อน
   */
  const ROUTES = {
    solo: './vr-goodjunk/goodjunk-solo-boss.html',
    battle: './vr-goodjunk/goodjunk-battle-v2-lobby.html',
    race: './vr-goodjunk/goodjunk-race-lobby.html',
    duet: './vr-goodjunk/goodjunk-duet-lobby.html',
    coop: './vr-goodjunk/goodjunk-coop-lobby.html',
    zone: './nutrition-zone.html',
    hub: './hub.html'
  };

  const ROOM_PARAMS = [
    'room',
    'roomCode',
    'code',
    'lastRoom',
    'matchId',
    'roundId',
    'runId',
    'activeMatchId',
    'phase',
    'run',
    'targetRun'
  ];

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function now(){
    return Date.now();
  }

  function safeText(v, fallback){
    v = String(v || '').trim();
    return v || fallback || '';
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
    return normalizeView(params.get('view') || params.get('device') || '');
  }

  function stripRoomParams(out){
    ROOM_PARAMS.forEach(function(k){
      out.searchParams.delete(k);
    });

    return out;
  }

  function addCommonParams(out, mode){
    out.searchParams.set('pid', safeText(getPid(), 'anon'));
    out.searchParams.set('name', safeText(getName(), 'Hero'));
    out.searchParams.set('view', getView());
    out.searchParams.set('device', getView());
    out.searchParams.set('diff', params.get('diff') || 'normal');
    out.searchParams.set('time', params.get('time') || '90');

    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');

    if (mode){
      out.searchParams.set('mode', mode);
    }

    [
      'hub',
      'studyId',
      'conditionGroup',
      'api',
      'log'
    ].forEach(function(k){
      const v = params.get(k);
      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    out.searchParams.set('from', 'goodjunk-launcher');
    out.searchParams.set('router', PATCH_VERSION);
    out.searchParams.set('t', String(now()));

    return out;
  }

  function getOriginalHref(el){
    if (!el) return '';

    if (el.tagName && el.tagName.toLowerCase() === 'a'){
      return el.getAttribute('href') || '';
    }

    const link = el.querySelector && el.querySelector('a[href]');
    return link ? (link.getAttribute('href') || '') : '';
  }

  function inferModeFromElement(el){
    const text = String(el.textContent || '').toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const href = String(getOriginalHref(el) || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();

    const all = [text, id, cls, href, data].join(' ');

    /*
     * ลำดับสำคัญ: ต้องตรวจโหมดเฉพาะก่อน battle
     */
    if (/solo|boss|บอส|เดี่ยว|single/i.test(all)) return 'solo';
    if (/race|แข่ง|วิ่ง|speed/i.test(all)) return 'race';
    if (/duet|คู่|สองคน|pair/i.test(all)) return 'duet';
    if (/coop|co-op|cooperative|ร่วมมือ|ทีม/i.test(all)) return 'coop';
    if (/battle|ต่อสู้|ดวล|pvp/i.test(all)) return 'battle';

    return '';
  }

  function buildModeUrl(mode, el){
    let route = ROUTES[mode] || ROUTES.battle;

    /*
     * Solo Boss: ถ้าปุ่มเดิมชี้ไปไฟล์ solo production ที่ผ่าน QA แล้ว
     * ให้ preserve path เดิมไว้ แทนการเดาชื่อไฟล์
     */
    if (mode === 'solo'){
      const href = getOriginalHref(el);

      if (
        href &&
        /goodjunk/i.test(href) &&
        /solo|boss/i.test(href) &&
        !/battle|race|duet|coop|launcher|modes/i.test(href)
      ){
        route = href;
      }
    }

    const out = new URL(route, location.href);

    addCommonParams(out, mode === 'solo' ? 'solo-boss' : mode);
    stripRoomParams(out);

    if (mode === 'battle'){
      out.searchParams.set('variant', 'battle-v2.5');
      out.searchParams.set('entry', 'launcher');

      /*
       * Battle จาก launcher ต้องเข้าล็อบบี้ว่างเสมอ
       */
      stripRoomParams(out);

      try{
        localStorage.removeItem('GJ_BATTLE_LAST_ROOM');
        sessionStorage.removeItem('GJ_BATTLE_LAST_ROOM');
      }catch(_){}
    }

    if (mode === 'solo'){
      out.searchParams.set('entry', 'solo-boss');
      out.searchParams.set('variant', 'solo-boss-final');
    }

    if (mode === 'race'){
      out.searchParams.set('entry', 'race');
      out.searchParams.set('variant', 'race');
    }

    if (mode === 'duet'){
      out.searchParams.set('entry', 'duet');
      out.searchParams.set('variant', 'duet');
    }

    if (mode === 'coop'){
      out.searchParams.set('entry', 'coop');
      out.searchParams.set('variant', 'coop');
    }

    return out.toString();
  }

  function buildZoneUrl(){
    const out = new URL(ROUTES.zone, location.href);
    addCommonParams(out, '');
    stripRoomParams(out);
    out.searchParams.set('from', 'goodjunk-launcher');
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

    const out = new URL(ROUTES.hub, location.href);
    addCommonParams(out, '');
    stripRoomParams(out);
    out.searchParams.set('from', 'goodjunk-launcher');
    return out.toString();
  }

  function bindElement(el, mode){
    if (!el || !mode) return;
    if (el.dataset.gjLauncherRouteFinalBound === '1') return;

    const target = buildModeUrl(mode, el);

    el.dataset.gjLauncherRouteFinalBound = '1';
    el.dataset.gjMode = mode;
    el.dataset.gjTarget = target;

    if (el.tagName && el.tagName.toLowerCase() === 'a'){
      el.setAttribute('href', target);
    }

    const link = el.querySelector && el.querySelector('a[href]');
    if (link){
      link.setAttribute('href', target);
      link.dataset.gjLauncherRouteFinalBound = '1';
      link.dataset.gjMode = mode;
      link.dataset.gjTarget = target;
    }

    el.addEventListener('click', function(ev){
      const clickable = ev.target && ev.target.closest
        ? ev.target.closest('button,a,[role="button"],.card,.mode-card,.game-card')
        : null;

      if (clickable && clickable !== el && el.contains(clickable)){
        /*
         * ให้ child ที่ถูก bind เองจัดการ ไม่ซ้อน event
         */
        if (clickable.dataset && clickable.dataset.gjLauncherRouteFinalBound === '1'){
          return;
        }
      }

      ev.preventDefault();
      ev.stopPropagation();

      location.href = buildModeUrl(mode, el);
    }, true);
  }

  function bindModeRoutes(){
    /*
     * 1) จับ element ที่ระบุ mode ชัดเจนก่อน
     */
    $all('[data-mode],[data-gj-mode],[data-route-mode],[data-game-mode]').forEach(function(el){
      const raw =
        el.dataset.mode ||
        el.dataset.gjMode ||
        el.dataset.routeMode ||
        el.dataset.gameMode ||
        '';

      const mode = String(raw).toLowerCase().trim();

      if (['solo','solo-boss','boss'].includes(mode)){
        bindElement(el, 'solo');
      }else if (mode === 'battle'){
        bindElement(el, 'battle');
      }else if (mode === 'race'){
        bindElement(el, 'race');
      }else if (mode === 'duet'){
        bindElement(el, 'duet');
      }else if (mode === 'coop' || mode === 'co-op'){
        bindElement(el, 'coop');
      }
    });

    /*
     * 2) จับ anchor/button ที่มี href หรือ text ชัดเจน
     * ไม่จับ .card กว้าง ๆ แบบ patch เดิมแล้ว
     */
    $all('a[href],button,[role="button"]').forEach(function(el){
      const mode = inferModeFromElement(el);
      if (!mode) return;

      bindElement(el, mode);
    });

    /*
     * 3) เฉพาะ card ที่มี keyword ชัดเจนจริง ๆ และยังไม่มี child button/a ถูก bind
     */
    $all('.mode-card,.game-card,.card').forEach(function(el){
      if (el.dataset.gjLauncherRouteFinalBound === '1') return;

      const hasBoundChild = el.querySelector('[data-gj-launcher-route-final-bound="1"]');
      if (hasBoundChild) return;

      const mode = inferModeFromElement(el);
      if (!mode) return;

      bindElement(el, mode);
    });
  }

  function bindZoneHubButtons(){
    $all('a[href],button,[role="button"]').forEach(function(el){
      if (el.dataset.gjLauncherZoneHubBound === '1') return;

      const text = String(el.textContent || '').toLowerCase();
      const id = String(el.id || '').toLowerCase();
      const cls = String(el.className || '').toLowerCase();
      const href = String(getOriginalHref(el) || '').toLowerCase();
      const data = JSON.stringify(el.dataset || {}).toLowerCase();
      const all = [text, id, cls, href, data].join(' ');

      let target = '';

      if (/nutrition zone|โซนโภชนาการ|กลับโซน|nutrition-zone/i.test(all)){
        target = buildZoneUrl();
      }else if (/hub|หน้าหลัก|home/i.test(all)){
        target = buildHubUrl();
      }

      if (!target) return;

      el.dataset.gjLauncherZoneHubBound = '1';

      if (el.tagName && el.tagName.toLowerCase() === 'a'){
        el.setAttribute('href', target);
      }

      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        location.href = target;
      }, true);
    });
  }

  function injectDebugBadge(){
    if ($('#gjLauncherRouteFinalBadge')) return;

    const badge = document.createElement('div');
    badge.id = 'gjLauncherRouteFinalBadge';
    badge.textContent = 'GoodJunk routes locked';

    badge.style.cssText = [
      'position:fixed',
      'right:10px',
      'bottom:calc(10px + env(safe-area-inset-bottom))',
      'z-index:9999',
      'padding:6px 10px',
      'border-radius:999px',
      'border:2px solid rgba(255,199,125,.72)',
      'background:rgba(255,254,248,.88)',
      'color:#753119',
      'font:1000 12px system-ui,sans-serif',
      'pointer-events:none'
    ].join(';');

    document.body.appendChild(badge);
  }

  function boot(){
    bindModeRoutes();
    bindZoneHubButtons();
    injectDebugBadge();

    const mo = new MutationObserver(function(){
      bindModeRoutes();
      bindZoneHubButtons();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(function(){
      bindModeRoutes();
      bindZoneHubButtons();
    }, 1200);

    window.GJ_LAUNCHER_ROUTE_FINAL = {
      version: PATCH_VERSION,
      routes: ROUTES,
      buildModeUrl,
      buildZoneUrl,
      buildHubUrl,
      bindModeRoutes,
      bindZoneHubButtons
    };

    console.info('[GoodJunk Launcher Route Final]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();