(function GoodJunkLauncherBattleV250RoutePatch(){
  'use strict';

  const PATCH_VERSION = 'v1.0.0-launcher-battle-v250-route';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  /*
   * ใช้เฉพาะหน้า goodjunk-launcher.html
   */
  if (!/goodjunk-launcher\.html/i.test(path)){
    return;
  }

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

  function buildBattleLobbyUrl(){
    const out = new URL('./vr-goodjunk/goodjunk-battle-v2-lobby.html', location.href);

    [
      'diff',
      'time',
      'view',
      'device',
      'hub',
      'studyId',
      'conditionGroup',
      'api',
      'log'
    ].forEach(function(k){
      let v = params.get(k);

      if (k === 'view' || k === 'device'){
        v = normalizeView(params.get('view') || params.get('device') || '');
      }

      if (v !== null && v !== ''){
        out.searchParams.set(k, v);
      }
    });

    out.searchParams.set('pid', getPid());
    out.searchParams.set('name', getName());
    out.searchParams.set('view', normalizeView(params.get('view') || params.get('device') || ''));
    out.searchParams.set('device', normalizeView(params.get('view') || params.get('device') || ''));
    out.searchParams.set('diff', params.get('diff') || 'normal');
    out.searchParams.set('time', params.get('time') || '90');

    out.searchParams.set('mode', 'battle');
    out.searchParams.set('game', 'goodjunk');
    out.searchParams.set('gameId', 'goodjunk');
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('entry', 'launcher');
    out.searchParams.set('variant', 'battle-v2.5');
    out.searchParams.set('from', 'goodjunk-launcher');
    out.searchParams.set('t', String(now()));

    /*
     * สำคัญ: เข้า Battle จาก launcher ต้องเริ่ม lobby ว่าง
     * ห้ามติด room/matchId เก่ามาด้วย
     */
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

    return out.toString();
  }

  function looksLikeBattleButton(el){
    if (!el) return false;

    const text = String(el.textContent || '').toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const href = String(el.getAttribute && el.getAttribute('href') || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();

    const all = [text, id, cls, href, data].join(' ');

    /*
     * จับเฉพาะ Battle ของ GoodJunk
     */
    return (
      /battle|ต่อสู้|ดวล|แข่ง/i.test(all) &&
      !/solo|boss|race|duet|coop/i.test(all)
    ) || /goodjunk-battle-v2-lobby|battle-v2/i.test(all);
  }

  function bindBattleButtons(){
    const target = buildBattleLobbyUrl();

    $all('a,button,[role="button"],.card,.mode-card,.game-card').forEach(function(el){
      if (!looksLikeBattleButton(el)) return;
      if (el.dataset.gjBattleV250Bound === '1') return;

      el.dataset.gjBattleV250Bound = '1';
      el.dataset.gjBattleTarget = target;

      if (el.tagName && el.tagName.toLowerCase() === 'a'){
        el.setAttribute('href', target);
      }

      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();

        try{
          localStorage.removeItem('GJ_BATTLE_LAST_ROOM');
          sessionStorage.removeItem('GJ_BATTLE_LAST_ROOM');
        }catch(_){}

        location.href = buildBattleLobbyUrl();
      }, true);
    });
  }

  function injectBadge(){
    if ($('#gjBattleV250LauncherBadge')) return;

    const badge = document.createElement('div');
    badge.id = 'gjBattleV250LauncherBadge';
    badge.textContent = 'Battle v2.5 route ready';

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
    bindBattleButtons();
    injectBadge();

    const mo = new MutationObserver(function(){
      bindBattleButtons();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    setInterval(bindBattleButtons, 1200);

    window.GJ_LAUNCHER_BATTLE_V250_ROUTE = {
      version: PATCH_VERSION,
      buildBattleLobbyUrl,
      bindBattleButtons
    };

    console.info('[GoodJunk Launcher Battle v2.5 Route]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();