(function GoodJunkLauncherRouteAuditPatch(){
  'use strict';

  const AUDIT_VERSION = 'v1.2.0-goodjunk-launcher-route-audit-route-final-api';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  if (!/goodjunk-launcher\.html$/i.test(path)) return;
  if (params.get('routeAudit') !== '1' && params.get('qa') !== 'route') return;

  const EXPECTED = {
    solo: '/herohealth/vr-goodjunk/goodjunk-solo-boss.html',
    battle: '/herohealth/vr-goodjunk/goodjunk-battle-v2-lobby.html',
    race: '/herohealth/vr-goodjunk/goodjunk-race-lobby.html',
    duet: '/herohealth/vr-goodjunk/goodjunk-duet-lobby.html',
    coop: '/herohealth/vr-goodjunk/goodjunk-coop-lobby.html'
  };

  const MODE_ORDER = ['solo', 'battle', 'race', 'duet', 'coop'];

  const OLD_PATCHES = [
    'goodjunk-launcher-battle-v250-route-patch.js',
    'goodjunk-modes.html',
    'goodjunk-battle-v2-lobby-fresh-room-patch',
    'goodjunk-battle-v2-lobby-empty-guard-patch',
    'goodjunk-battle-v2-lobby-start-watchdog-patch'
  ];

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function normalizePath(href){
    try{
      return new URL(href, location.href).pathname;
    }catch(_){
      return String(href || '');
    }
  }

  function expectedOk(mode, actualPath){
    const expected = EXPECTED[mode] || '';
    return !!expected && (actualPath === expected || actualPath.endsWith(expected));
  }

  function hasOldPatch(){
    return $all('script[src]').filter(function(s){
      const src = s.getAttribute('src') || '';
      return OLD_PATCHES.some(function(name){
        return src.indexOf(name) !== -1;
      });
    }).map(function(s){
      return s.getAttribute('src') || '';
    });
  }

  function routeFromFinalApi(mode){
    const api = window.GJ_LAUNCHER_ROUTE_FINAL;

    if (!api || typeof api.buildModeUrl !== 'function'){
      return '';
    }

    try{
      return api.buildModeUrl(mode);
    }catch(_){
      return '';
    }
  }

  function collectRoutes(){
    return MODE_ORDER.map(function(mode){
      /*
       * ใช้ API ของ route-final เป็นแหล่งจริง
       * เพราะตัว route-final เป็นคน redirect ปุ่มจริง
       */
      const href = routeFromFinalApi(mode);
      const actual = normalizePath(href);
      const expected = EXPECTED[mode];

      return {
        mode,
        expected,
        actual: actual || '(route final API not ready)',
        ok: expectedOk(mode, actual),
        href: href || ''
      };
    });
  }

  function injectStyle(){
    if ($('#gjLauncherRouteAuditStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjLauncherRouteAuditStyle';
    style.textContent = `
      .gj-route-audit{
        position:fixed;
        left:10px;
        right:10px;
        bottom:calc(10px + env(safe-area-inset-bottom));
        z-index:100000;
        max-height:46dvh;
        overflow:auto;
        padding:12px;
        border-radius:22px;
        border:3px solid rgba(255,199,125,.88);
        background:rgba(255,254,248,.96);
        color:#753119;
        box-shadow:0 18px 44px rgba(80,40,10,.22);
        font:850 12px system-ui,sans-serif;
      }

      .gj-route-audit h3{
        margin:0 0 8px;
        font-size:16px;
        font-weight:1000;
      }

      .gj-route-audit table{
        width:100%;
        border-collapse:collapse;
      }

      .gj-route-audit th,
      .gj-route-audit td{
        padding:6px 5px;
        border-bottom:1px solid rgba(255,199,125,.45);
        text-align:left;
        vertical-align:top;
        word-break:break-word;
      }

      .gj-route-audit th{
        font-weight:1000;
        color:#8a5a2b;
      }

      .gj-route-audit .ok{
        color:#2d723b;
        font-weight:1000;
      }

      .gj-route-audit .bad{
        color:#8d2b1f;
        font-weight:1000;
      }

      .gj-route-audit .warn{
        margin:8px 0;
        padding:8px 10px;
        border-radius:14px;
        background:#fff0ed;
        color:#8d2b1f;
        font-weight:1000;
      }

      .gj-route-audit .note{
        margin:8px 0;
        padding:8px 10px;
        border-radius:14px;
        background:#eef9ff;
        color:#1e688d;
        font-weight:950;
      }

      .gj-route-audit .topline{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:center;
      }

      .gj-route-audit button{
        min-height:30px;
        padding:5px 9px;
        border-radius:999px;
        border:2px solid rgba(255,199,125,.75);
        background:#fff8da;
        color:#753119;
        font:1000 12px system-ui,sans-serif;
        cursor:pointer;
      }
    `;

    document.head.appendChild(style);
  }

  function render(){
    injectStyle();

    const rows = collectRoutes();
    const oldScripts = hasOldPatch();
    const routeFinalReady = !!(window.GJ_LAUNCHER_ROUTE_FINAL && typeof window.GJ_LAUNCHER_ROUTE_FINAL.buildModeUrl === 'function');
    const allOk = routeFinalReady && rows.every(r => r.ok) && oldScripts.length === 0;

    let panel = $('#gjLauncherRouteAudit');

    if (!panel){
      panel = document.createElement('div');
      panel.id = 'gjLauncherRouteAudit';
      panel.className = 'gj-route-audit';
      document.body.appendChild(panel);
    }

    panel.innerHTML = `
      <div class="topline">
        <h3>GoodJunk Launcher Route Audit ${allOk ? '✅' : '⚠️'}</h3>
        <button id="gjRouteAuditClose" type="button">ปิด</button>
      </div>

      ${!routeFinalReady ? `
        <div class="warn">
          Route Final API ยังไม่พร้อม หรือ goodjunk-launcher-route-final-patch.js ยังไม่โหลด
        </div>
      ` : `
        <div class="note">
          ตรวจจาก Route Final API โดยตรง ไม่จับ Hub/Nutrition Zone ผิดเป็นโหมดเกมแล้ว
        </div>
      `}

      ${oldScripts.length ? `
        <div class="warn">
          ยังมี script/route เก่าค้าง:<br>
          ${oldScripts.map(s => escapeHtml(s)).join('<br>')}
        </div>
      ` : ''}

      <table>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Expected</th>
            <th>Actual</th>
            <th>OK</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(function(r){
            return `
              <tr>
                <td>${escapeHtml(r.mode)}</td>
                <td>${escapeHtml(r.expected)}</td>
                <td>${escapeHtml(r.actual)}</td>
                <td class="${r.ok ? 'ok' : 'bad'}">${r.ok ? 'OK' : 'CHECK'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    const close = $('#gjRouteAuditClose', panel);
    if (close){
      close.addEventListener('click', function(){
        panel.remove();
      });
    }

    try{
      console.group('[GoodJunk Launcher Route Audit] ' + (allOk ? 'OK' : 'CHECK'));
      console.log('auditVersion:', AUDIT_VERSION);
      console.log('routeFinalReady:', routeFinalReady);
      console.table(rows);
      if (oldScripts.length) console.warn('Old scripts/routes found:', oldScripts);
      console.groupEnd();
    }catch(_){}

    window.GJ_LAUNCHER_ROUTE_AUDIT = {
      version: AUDIT_VERSION,
      ok: allOk,
      routeFinalReady,
      rows,
      oldScripts
    };
  }

  function boot(){
    render();

    /*
     * route-final อาจโหลด/ผูกปุ่มหลัง audit นิดหนึ่ง
     */
    setTimeout(render, 300);
    setTimeout(render, 900);
    setTimeout(render, 1600);

    console.info('[GoodJunk Launcher Route Audit]', AUDIT_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();