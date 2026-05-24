(function GoodJunkLauncherRouteFinalPatch(){
  'use strict';

  const PATCH_VERSION = 'v1.2.0-goodjunk-launcher-route-final-safe-cards';

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
    return params.get('pid') || localStorage.getItem('GJ_BATTLE_PID') || localStorage.getItem('HHA_GJ_PID') || 'anon';
  }

  function getName(){
    return params.get('name') || localStorage.getItem('GJ_BATTLE_NAME') || localStorage.getItem('HHA_GJ_NAME') || 'Hero';
  }

  function getView(){
    return normalizeView(params.get('view') || params.get('device') || '');
  }

  function stripRoomParams(out){
    ROOM_PARAMS.forEach(k => out.searchParams.delete(k));
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

    if (mode) out.searchParams.set('mode', mode);

    ['hub','studyId','conditionGroup','api','log'].forEach(function(k){
      const v = params.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('from', 'goodjunk-launcher');
    out.searchParams.set('router', PATCH_VERSION);
    out.searchParams.set('t', String(now()));

    return out;
  }

  function elementText(el){
    return String(el && el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function directHref(el){
    if (!el) return '';

    if (el.tagName && el.tagName.toLowerCase() === 'a'){
      return el.getAttribute('href') || '';
    }

    return '';
  }

  function hasHubOrZoneMeaning(el){
    const text = elementText(el).toLowerCase();
    const href = directHref(el).toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();
    const all = [text, href, id, cls, data].join(' ');

    return /hub|หน้าหลัก|home|nutrition zone|nutrition-zone|โซนโภชนาการ|กลับโซน/i.test(all);
  }

  function inferModeFromDirectElement(el){
    if (!el) return '';

    const text = elementText(el).toLowerCase();
    const href = directHref(el).toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();
    const all = [text, href, id, cls, data].join(' ');

    if (hasHubOrZoneMeaning(el)) return '';

    if (/solo|solo-boss|boss|บอส|เดี่ยว|single/i.test(all)) return 'solo';
    if (/race|แข่ง|วิ่ง|speed/i.test(all)) return 'race';
    if (/duet|คู่|สองคน|pair/i.test(all)) return 'duet';
    if (/coop|co-op|cooperative|ร่วมมือ|ทีม/i.test(all)) return 'coop';
    if (/battle|ต่อสู้|ดวล|pvp/i.test(all)) return 'battle';

    return '';
  }

  function inferModeFromCard(el){
    if (!el) return '';

    /*
     * สำคัญ:
     * ห้ามใช้ href ของปุ่มลูก เช่น Hub/Zone มาเป็น route ของ card
     * อ่านเฉพาะ text/card dataset เท่านั้น
     */
    const text = elementText(el).toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();
    const all = [text, id, cls, data].join(' ');

    if (/solo|solo-boss|boss|บอส|เดี่ยว|single/i.test(all)) return 'solo';
    if (/race|แข่ง|วิ่ง|speed/i.test(all)) return 'race';
    if (/duet|คู่|สองคน|pair/i.test(all)) return 'duet';
    if (/coop|co-op|cooperative|ร่วมมือ|ทีม/i.test(all)) return 'coop';
    if (/battle|ต่อสู้|ดวล|pvp/i.test(all)) return 'battle';

    return '';
  }

  function buildModeUrl(mode){
    const route = ROUTES[mode];
    const out = new URL(route, location.href);

    addCommonParams(out, mode === 'solo' ? 'solo-boss' : mode);
    stripRoomParams(out);

    if (mode === 'battle'){
      out.searchParams.set('variant', 'battle-v2.5');
      out.searchParams.set('entry', 'launcher');

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

  function bindModeElement(el, mode){
    if (!el || !mode) return;
    if (el.dataset.gjLauncherRouteFinalBound === '1') return;

    const target = buildModeUrl(mode);

    el.dataset.gjLauncherRouteFinalBound = '1';
    el.dataset.gjMode = mode;
    el.dataset.gjTarget = target;

    if (el.tagName && el.tagName.toLowerCase() === 'a'){
      el.setAttribute('href', target);
    }

    el.addEventListener('click', function(ev){
      /*
       * ถ้าคลิกปุ่ม Hub/Zone ที่อยู่ใน card เดียวกัน อย่าให้ card mode แย่งคลิก
       */
      const nav = ev.target && ev.target.closest
        ? ev.target.closest('[data-gj-nav="hub"],[data-gj-nav="zone"],.hub,.zone,[href*="hub.html"],[href*="nutrition-zone.html"]')
        : null;

      if (nav) return;

      ev.preventDefault();
      ev.stopPropagation();

      location.href = buildModeUrl(mode);
    }, true);
  }

  function bindModeRoutes(){
    /*
     * 1) bind ปุ่ม/ลิงก์ที่เป็น mode โดยตรงก่อน
     */
    $all('a[href],button,[role="button"]').forEach(function(el){
      const mode = inferModeFromDirectElement(el);
      if (!mode) return;
      bindModeElement(el, mode);
    });

    /*
     * 2) bind card เฉพาะเมื่อ card ยังไม่มีปุ่ม mode ลูก
     * และต้องไม่จับ card ที่เป็น navigation/card hub
     */
    $all('[data-mode],[data-gj-mode],[data-route-mode],[data-game-mode],.mode-card,.game-card,.card').forEach(function(el){
      if (el.dataset.gjLauncherRouteFinalBound === '1') return;

      const explicit =
        el.dataset.mode ||
        el.dataset.gjMode ||
        el.dataset.routeMode ||
        el.dataset.gameMode ||
        '';

      let mode = '';

      if (explicit){
        const raw = String(explicit).toLowerCase().trim();

        if (['solo','solo-boss','boss'].includes(raw)) mode = 'solo';
        else if (raw === 'battle') mode = 'battle';
        else if (raw === 'race') mode = 'race';
        else if (raw === 'duet') mode = 'duet';
        else if (raw === 'coop' || raw === 'co-op') mode = 'coop';
      }else{
        mode = inferModeFromCard(el);
      }

      if (!mode) return;

      const hasDirectModeChild = el.querySelector('[data-gj-launcher-route-final-bound="1"]');
      if (hasDirectModeChild) return;

      bindModeElement(el, mode);
    });
  }

  function bindZoneHubButtons(){
    $all('a[href],button,[role="button"]').forEach(function(el){
      if (el.dataset.gjLauncherZoneHubBound === '1') return;

      const text = elementText(el).toLowerCase();
      const href = directHref(el).toLowerCase();
      const id = String(el.id || '').toLowerCase();
      const cls = String(el.className || '').toLowerCase();
      const data = JSON.stringify(el.dataset || {}).toLowerCase();
      const all = [text, href, id, cls, data].join(' ');

      let target = '';

      if (/nutrition zone|nutrition-zone|โซนโภชนาการ|กลับโซน/i.test(all)){
        target = buildZoneUrl();
        el.dataset.gjNav = 'zone';
      }else if (/hub|หน้าหลัก|home/i.test(all)){
        target = buildHubUrl();
        el.dataset.gjNav = 'hub';
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

  function injectBadge(){
    if ($('#gjLauncherRouteFinalBadge')) return;

    const badge = document.createElement('div');
    badge.id = 'gjLauncherRouteFinalBadge';
    badge.textContent = 'GoodJunk routes locked v1.2';

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
    bindZoneHubButtons();
    bindModeRoutes();
    injectBadge();

    const mo = new MutationObserver(function(){
      bindZoneHubButtons();
      bindModeRoutes();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(function(){
      bindZoneHubButtons();
      bindModeRoutes();
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