(function GoodJunkLauncherRouteAuditPatch(){
  'use strict';

  const AUDIT_VERSION = 'v1.1.0-goodjunk-launcher-route-audit-safe-dedupe';

  const url = new URL(location.href);
  const params = url.searchParams;
  const path = location.pathname || '';

  if (!/goodjunk-launcher\.html$/i.test(path)) return;

  /*
   * เปิดเฉพาะตอน debug:
   * goodjunk-launcher.html?routeAudit=1
   */
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

  function cleanText(s){
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function directHref(el){
    if (!el) return '';

    if (el.tagName && el.tagName.toLowerCase() === 'a'){
      return el.getAttribute('href') || '';
    }

    return '';
  }

  function normalizePath(href){
    try{
      const u = new URL(href, location.href);
      return u.pathname;
    }catch(_){
      return String(href || '');
    }
  }

  function isHubOrZone(el){
    if (!el) return false;

    const text = cleanText(el.textContent).toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const href = String(directHref(el) || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();

    const all = [text, id, cls, href, data].join(' ');

    return /hub|หน้าหลัก|home|nutrition zone|nutrition-zone|โซนโภชนาการ|กลับโซน/i.test(all);
  }

  function inferMode(el){
    if (!el) return '';

    /*
     * สำคัญ: Audit ห้ามเอา Hub / Zone มาเป็น mode
     */
    if (isHubOrZone(el)) return '';

    const text = cleanText(el.textContent).toLowerCase();
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    const href = String(directHref(el) || '').toLowerCase();
    const data = JSON.stringify(el.dataset || {}).toLowerCase();

    const all = [text, id, cls, href, data].join(' ');

    const explicit =
      el.dataset.mode ||
      el.dataset.gjMode ||
      el.dataset.routeMode ||
      el.dataset.gameMode ||
      '';

    const raw = String(explicit || '').toLowerCase().trim();

    if (['solo', 'solo-boss', 'boss'].includes(raw)) return 'solo';
    if (raw === 'battle') return 'battle';
    if (raw === 'race') return 'race';
    if (raw === 'duet') return 'duet';
    if (raw === 'coop' || raw === 'co-op') return 'coop';

    if (/solo|solo-boss|boss|บอส|เดี่ยว|single/i.test(all)) return 'solo';
    if (/race|แข่ง|วิ่ง|speed/i.test(all)) return 'race';
    if (/duet|คู่|สองคน|pair/i.test(all)) return 'duet';
    if (/coop|co-op|cooperative|ร่วมมือ|ทีม/i.test(all)) return 'coop';
    if (/battle|ต่อสู้|ดวล|pvp/i.test(all)) return 'battle';

    return '';
  }

  function getBestHref(el){
    if (!el) return '';

    /*
     * route-final-patch จะใส่ data-gj-target ไว้ นี่คือแหล่งจริงที่สุด
     */
    if (el.dataset && el.dataset.gjTarget){
      return el.dataset.gjTarget;
    }

    const href = directHref(el);
    if (href) return href;

    /*
     * ใช้ child ที่มี data-gj-target เท่านั้น
     * ห้ามใช้ child href ทั่วไป เพราะมันอาจเป็น Hub / Nutrition Zone
     */
    const targetChild = el.querySelector && el.querySelector('[data-gj-target]');
    if (targetChild && targetChild.dataset && targetChild.dataset.gjTarget){
      return targetChild.dataset.gjTarget;
    }

    return '';
  }

  function isGoodModeCandidate(el){
    if (!el) return false;
    if (isHubOrZone(el)) return false;

    const href = getBestHref(el);
    const mode = inferMode(el);

    if (!mode) return false;

    /*
     * ถ้ามี href แล้วเป็น nutrition-zone/hub ให้ตัดออกทันที
     */
    const path = normalizePath(href).toLowerCase();

    if (/nutrition-zone\.html|hub\.html/i.test(path)){
      return false;
    }

    return true;
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

  function collectRoutes(){
    const found = {};

    /*
     * อ่านจาก element ที่ route-final patch bind แล้วก่อน
     */
    $all('[data-gj-target][data-gj-mode]').forEach(function(el){
      if (!isGoodModeCandidate(el)) return;

      const mode = String(el.dataset.gjMode || inferMode(el) || '').toLowerCase().trim();
      if (!MODE_ORDER.includes(mode)) return;

      const href = getBestHref(el);
      const actualPath = normalizePath(href);
      const expectedPath = EXPECTED[mode] || '';
      const ok = expectedPath ? actualPath.endsWith(expectedPath) || actualPath === expectedPath : false;

      /*
       * เก็บอันแรกที่ OK ก่อน ถ้าเจอ OK แล้วไม่ต้องแทนด้วย candidate แย่กว่า
       */
      if (!found[mode] || (!found[mode].ok && ok)){
        found[mode] = {
          mode,
          label: cleanText(el.textContent).slice(0, 80) || '(no text)',
          expected: expectedPath,
          actual: actualPath || '(no href/data target)',
          ok,
          href
        };
      }
    });

    /*
     * fallback สำหรับปุ่มที่ยังไม่มี data-gj-target
     */
    $all('a[href],button,[role="button"],.mode-card,.game-card,.card').forEach(function(el){
      if (!isGoodModeCandidate(el)) return;

      const mode = inferMode(el);
      if (!MODE_ORDER.includes(mode)) return;
      if (found[mode] && found[mode].ok) return;

      const href = getBestHref(el);
      const actualPath = normalizePath(href);
      const expectedPath = EXPECTED[mode] || '';
      const ok = expectedPath ? actualPath.endsWith(expectedPath) || actualPath === expectedPath : false;

      if (!found[mode] || (!found[mode].ok && ok)){
        found[mode] = {
          mode,
          label: cleanText(el.textContent).slice(0, 80) || '(no text)',
          expected: expectedPath,
          actual: actualPath || '(no href/data target)',
          ok,
          href
        };
      }
    });

    return MODE_ORDER.map(function(mode){
      return found[mode] || {
        mode,
        label: '(not found)',
        expected: EXPECTED[mode],
        actual: '(not found)',
        ok: false,
        href: ''
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
    const allOk = rows.length === 5 && rows.every(r => r.ok) && oldScripts.length === 0;

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
      console.table(rows);
      if (oldScripts.length) console.warn('Old scripts/routes found:', oldScripts);
      console.groupEnd();
    }catch(_){}

    window.GJ_LAUNCHER_ROUTE_AUDIT = {
      version: AUDIT_VERSION,
      ok: allOk,
      rows,
      oldScripts
    };
  }

  function boot(){
    render();

    const mo = new MutationObserver(function(){
      render();
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true
    });

    console.info('[GoodJunk Launcher Route Audit]', AUDIT_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();