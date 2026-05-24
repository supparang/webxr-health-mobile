(function GoodJunkLauncherRouteFinalPatch(){
  'use strict';

  const PATCH_VERSION = 'v1.3.0-goodjunk-launcher-route-final-click-priority';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  if (!/goodjunk-launcher\.html$/i.test(path)) return;

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
    'room','roomCode','code','lastRoom',
    'matchId','roundId','runId','activeMatchId',
    'phase','run','targetRun'
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

  function clean(v, fallback){
    v = String(v || '').trim();
    return v || fallback || '';
  }

  function textOf(el){
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
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
    out.searchParams.set('pid', clean(getPid(), 'anon'));
    out.searchParams.set('name', clean(getName(), 'Hero'));
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

    ['hub','studyId','conditionGroup','api','log'].forEach(function(k){
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

  function buildModeUrl(mode){
    const route = ROUTES[mode] || ROUTES.solo;
    const out = new URL(route, location.href);

    addCommonParams(out, mode === 'solo' ? 'solo-boss' : mode);
    stripRoomParams(out);

    if (mode === 'solo'){
      out.searchParams.set('entry', 'solo-boss');
      out.searchParams.set('variant', 'solo-boss-final');
    }

    if (mode === 'battle'){
      out.searchParams.set('entry', 'launcher');
      out.searchParams.set('variant', 'battle-v2.5');

      try{
        localStorage.removeItem('GJ_BATTLE_LAST_ROOM');
        sessionStorage.removeItem('GJ_BATTLE_LAST_ROOM');
      }catch(_){}
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

  function explicitHref(el){
    if (!el) return '';

    if (el.tagName && el.tagName.toLowerCase() === 'a'){
      return el.getAttribute('href') || '';
    }

    return '';
  }

  function inferMode(el){
    if (!el) return '';

    const explicit =
      el.dataset.mode ||
      el.dataset.gjMode ||
      el.dataset.routeMode ||
      el.dataset.gameMode ||
      '';

    const raw = String(explicit || '').toLowerCase().trim();

    if (['solo','solo-boss','boss'].includes(raw)) return 'solo';
    if (raw === 'battle') return 'battle';
    if (raw === 'race') return 'race';
    if (raw === 'duet') return 'duet';
    if (raw === 'coop' || raw === 'co-op') return 'coop';

    const all = [
      textOf(el),
      String(el.id || ''),
      String(el.className || ''),
      explicitHref(el),
      JSON.stringify(el.dataset || {})
    ].join(' ').toLowerCase();

    if (/solo|solo-boss|boss|บอส|เดี่ยว|single/i.test(all)) return 'solo';
    if (/race|แข่ง|วิ่ง|speed/i.test(all)) return 'race';
    if (/duet|คู่|สองคน|pair/i.test(all)) return 'duet';
    if (/coop|co-op|cooperative|ร่วมมือ|ทีม/i.test(all)) return 'coop';
    if (/battle|ต่อสู้|ดวล|pvp/i.test(all)) return 'battle';

    return '';
  }

  function getDirectNavTarget(el){
    if (!el) return '';

    const href = explicitHref(el).toLowerCase();
    const text = textOf(el).toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();
    const all = [href, text, id, cls, data].join(' ');

    if (/nutrition-zone\.html|nutrition zone|โซนโภชนาการ|กลับโซน/i.test(all)){
      return 'zone';
    }

    if (/hub\.html|hub|หน้าหลัก|home/i.test(all)){
      return 'hub';
    }

    return '';
  }

  function getModeClickElement(target){
    if (!target || !target.closest) return null;

    /*
     * จับจาก element เฉพาะก่อน แล้วค่อย card
     * ไม่ใช้ .card อย่างเดียวกว้าง ๆ ถ้าไม่มี keyword mode
     */
    const el = target.closest(
      '[data-mode],[data-gj-mode],[data-route-mode],[data-game-mode],' +
      'a[href],button,[role="button"],.mode-card,.game-card,.card'
    );

    if (!el) return null;

    const mode = inferMode(el);

    if (!mode) return null;

    return el;
  }

  function bindHrefTargets(){
    $all('[data-mode],[data-gj-mode],[data-route-mode],[data-game-mode],a[href],button,[role="button"],.mode-card,.game-card,.card')
      .forEach(function(el){
        const mode = inferMode(el);
        if (!mode) return;

        const target = buildModeUrl(mode);

        el.dataset.gjMode = mode;
        el.dataset.gjTarget = target;
        el.dataset.gjLauncherRouteFinalBound = '1';

        if (el.tagName && el.tagName.toLowerCase() === 'a'){
          el.setAttribute('href', target);
        }

        const a = el.querySelector && el.querySelector('a[href]');
        if (a && inferMode(a)){
          a.dataset.gjMode = mode;
          a.dataset.gjTarget = target;
          a.setAttribute('href', target);
        }
      });

    $all('a[href],button,[role="button"]').forEach(function(el){
      const nav = getDirectNavTarget(el);

      if (nav === 'zone'){
        el.dataset.gjNav = 'zone';
        if (el.tagName && el.tagName.toLowerCase() === 'a'){
          el.setAttribute('href', buildZoneUrl());
        }
      }

      if (nav === 'hub'){
        el.dataset.gjNav = 'hub';
        if (el.tagName && el.tagName.toLowerCase() === 'a'){
          el.setAttribute('href', buildHubUrl());
        }
      }
    });
  }

  function handleClick(ev){
    const target = ev.target;

    /*
     * 1) ถ้ากดปุ่ม Hub/Zone โดยตรง ให้ไป Hub/Zone
     * แต่ต้องเป็น direct button/link เท่านั้น
     */
    const directButton = target && target.closest
      ? target.closest('a[href],button,[role="button"]')
      : null;

    const nav = getDirectNavTarget(directButton);

    if (nav === 'zone'){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      location.href = buildZoneUrl();
      return;
    }

    if (nav === 'hub'){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      location.href = buildHubUrl();
      return;
    }

    /*
     * 2) ถ้าไม่ใช่ Hub/Zone โดยตรง ให้ mode มี priority สูงสุด
     * กัน script อื่นแย่งส่งไป Nutrition Zone
     */
    const modeEl = getModeClickElement(target);
    const mode = inferMode(modeEl);

    if (mode){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      location.href = buildModeUrl(mode);
      return;
    }
  }

  function injectBadge(){
    if ($('#gjLauncherRouteFinalBadge')) return;

    const badge = document.createElement('div');
    badge.id = 'gjLauncherRouteFinalBadge';
    badge.textContent = 'GoodJunk routes locked v1.3';

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
    bindHrefTargets();
    injectBadge();

    document.addEventListener('click', handleClick, true);

    const mo = new MutationObserver(function(){
      bindHrefTargets();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['href','class','data-mode','data-gj-mode','data-route-mode','data-game-mode']
    });

    setInterval(bindHrefTargets, 1200);

    window.GJ_LAUNCHER_ROUTE_FINAL = {
      version: PATCH_VERSION,
      routes: ROUTES,
      buildModeUrl,
      buildZoneUrl,
      buildHubUrl,
      inferMode,
      bindHrefTargets
    };

    console.info('[GoodJunk Launcher Route Final]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();