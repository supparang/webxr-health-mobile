(function GoodJunkBattleV250PreflightCheck(){
  'use strict';

  const CHECK_VERSION = 'v1.0.0-battle-v250-preflight-check';

  const path = location.pathname || '';
  const params = new URL(location.href).searchParams;

  const isBattlePage =
    /goodjunk-battle-v2-(lobby|run|run-pc|run-mobile|run-cardboard)\.html/i.test(path) ||
    /goodjunk-battle-v2/i.test(path);

  if (!isBattlePage) return;

  const OLD_PATCH_NAMES = [
    'lobby-fresh-room-patch',
    'lobby-empty-guard-patch',
    'lobby-host-repair-patch',
    'lobby-status-stabilizer-patch',
    'lobby-visual-lock-patch',
    'lobby-status-hard-lock-patch',
    'lobby-start-watchdog-patch',
    'lobby-force-run-all-clients-patch',
    'runtime-unstuck-patch',
    'runtime-hit-hard-capture-patch',
    'touch-qa-patch',
    'nav-safety-patch'
  ];

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.from((root || document).querySelectorAll(sel));
  }

  function normalizeRoomCode(raw){
    const out = String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);

    if (!out || /^-+$/.test(out) || /^_+$/.test(out)){
      return '';
    }

    return out;
  }

  function getPageType(){
    if (/goodjunk-battle-v2-lobby\.html/i.test(path)) return 'lobby';
    if (/goodjunk-battle-v2-run\.html/i.test(path)) return 'router';
    if (/goodjunk-battle-v2-run-pc\.html/i.test(path)) return 'run-pc';
    if (/goodjunk-battle-v2-run-mobile\.html/i.test(path)) return 'run-mobile';
    if (/goodjunk-battle-v2-run-cardboard\.html/i.test(path)) return 'run-cardboard';
    return 'battle-page';
  }

  function getScripts(){
    return $all('script[src]').map(function(s){
      return s.getAttribute('src') || '';
    });
  }

  function hasScript(pattern){
    return getScripts().some(function(src){
      return pattern.test(src);
    });
  }

  function findOldPatchScripts(){
    const scripts = getScripts();

    return scripts.filter(function(src){
      return OLD_PATCH_NAMES.some(function(name){
        return src.indexOf(name) !== -1;
      });
    });
  }

  function check(){
    const pageType = getPageType();
    const scripts = getScripts();
    const oldPatches = findOldPatchScripts();

    const isLobby = pageType === 'lobby';
    const isRouter = pageType === 'router';
    const isRun = /^run-/.test(pageType);

    const room =
      normalizeRoomCode(params.get('room')) ||
      normalizeRoomCode(params.get('roomCode')) ||
      normalizeRoomCode(params.get('code'));

    const matchId =
      params.get('matchId') ||
      params.get('roundId') ||
      params.get('runId') ||
      '';

    const checks = [];

    checks.push({
      key:'page-type',
      ok:true,
      text:'Page: ' + pageType
    });

    checks.push({
      key:'old-patches',
      ok:oldPatches.length === 0,
      text:oldPatches.length === 0
        ? 'ไม่มี patch เก่าค้าง'
        : 'ยังมี patch เก่าค้าง: ' + oldPatches.join(', ')
    });

    if (isLobby){
      checks.push({
        key:'lobby-no-core-needed',
        ok:true,
        text:'Lobby v2.5 ใช้ logic ในไฟล์หลัก'
      });

      checks.push({
        key:'no-room-required',
        ok:true,
        text:'Lobby ไม่จำเป็นต้องมี room ตอนเปิดหน้าใหม่'
      });
    }

    if (isRouter){
      checks.push({
        key:'router-room',
        ok:!!room,
        text:room ? 'Router มี room=' + room : 'Router ยังไม่มี room'
      });

      checks.push({
        key:'router-match',
        ok:!!matchId,
        text:matchId ? 'Router มี matchId=' + matchId : 'Router ยังไม่มี matchId'
      });
    }

    if (isRun){
      checks.push({
        key:'bridge-script',
        ok:hasScript(/goodjunk-battle-v2-firebase-bridge\.js/i),
        text:hasScript(/goodjunk-battle-v2-firebase-bridge\.js/i)
          ? 'มี firebase bridge v2.5'
          : 'ขาด firebase bridge'
      });

      checks.push({
        key:'core-script',
        ok:hasScript(/goodjunk-battle-v2-core\.js/i),
        text:hasScript(/goodjunk-battle-v2-core\.js/i)
          ? 'มี core runtime v2.5'
          : 'ขาด core runtime'
      });

      checks.push({
        key:'run-room',
        ok:!!room,
        text:room ? 'Run มี room=' + room : 'Run ยังไม่มี room'
      });

      checks.push({
        key:'run-match',
        ok:!!matchId,
        text:matchId ? 'Run มี matchId=' + matchId : 'Run ยังไม่มี matchId'
      });
    }

    const ok = checks.every(function(c){ return c.ok; });

    return {
      version: CHECK_VERSION,
      pageType,
      ok,
      checks,
      scripts,
      oldPatches,
      room,
      matchId
    };
  }

  function injectStyle(){
    if ($('#gjBattleV250PreflightStyle')) return;

    const style = document.createElement('style');
    style.id = 'gjBattleV250PreflightStyle';
    style.textContent = `
      .gj-v250-preflight-badge{
        position:fixed;
        right:10px;
        bottom:calc(10px + env(safe-area-inset-bottom));
        z-index:100000;
        max-width:min(92vw,360px);
        padding:8px 11px;
        border-radius:999px;
        border:2px solid rgba(255,199,125,.75);
        background:rgba(255,254,248,.92);
        color:#753119;
        font:1000 12px system-ui,sans-serif;
        box-shadow:0 10px 24px rgba(80,40,10,.14);
        pointer-events:none;
      }

      .gj-v250-preflight-badge.ok{
        border-color:rgba(85,217,120,.78);
        background:rgba(238,255,235,.92);
        color:#2d723b;
      }

      .gj-v250-preflight-badge.warn{
        border-color:rgba(255,123,105,.78);
        background:rgba(255,239,236,.92);
        color:#8d2b1f;
      }
    `;

    document.head.appendChild(style);
  }

  function renderBadge(result){
    injectStyle();

    let badge = $('#gjBattleV250PreflightBadge');

    if (!badge){
      badge = document.createElement('div');
      badge.id = 'gjBattleV250PreflightBadge';
      badge.className = 'gj-v250-preflight-badge';
      document.body.appendChild(badge);
    }

    badge.className = 'gj-v250-preflight-badge ' + (result.ok ? 'ok' : 'warn');
    badge.textContent = result.ok
      ? 'Battle v2.5 Preflight OK'
      : 'Battle v2.5 Preflight WARN';
  }

  function logResult(result){
    try{
      console.group('[GoodJunk Battle v2.5 Preflight] ' + (result.ok ? 'OK' : 'WARN'));
      console.log('version:', result.version);
      console.log('pageType:', result.pageType);
      console.log('room:', result.room || '-');
      console.log('matchId:', result.matchId || '-');
      console.table(result.checks);
      if (result.oldPatches.length){
        console.warn('Old patch scripts found:', result.oldPatches);
      }
      console.groupEnd();
    }catch(_){}
  }

  function boot(){
    const result = check();

    window.GJ_BATTLE_V250_PREFLIGHT = result;

    renderBadge(result);
    logResult(result);

    console.info('[GoodJunk Battle v2.5 Preflight]', CHECK_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();