/* =========================================================
   HeroHealth Food Groups Launcher
   PATCH: v20260522-groups-vr-direct-start-fix-01
   File: /herohealth/patches/groups/groups-vr-direct-start-fix.js

   Purpose:
   - Fix launcher start button
   - From groups-vr.html, clicking "เริ่มเล่น" must enter gameplay directly
   - Add skipIntro=1, autostart=1, nointro=1
   - Works for Solo Arena and Practice
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260522-groups-vr-direct-start-fix-01';

  if (window.__HHA_GROUPS_VR_DIRECT_START_FIX__) return;
  window.__HHA_GROUPS_VR_DIRECT_START_FIX__ = true;

  const qs = new URLSearchParams(location.search);

  function repoBase(){
    const path = location.pathname;
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);

    if (idx >= 0) {
      return location.origin + path.slice(0, idx);
    }

    return location.origin + '/webxr-health-mobile';
  }

  const BASE = repoBase();
  const HERO = BASE + '/herohealth';
  const SOLO_RUN = HERO + '/vr-groups/groups.html';
  const ZONE = HERO + '/nutrition-zone.html';

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function isMobileUA(){
    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  }

  function normalizeView(v){
    const raw = String(v || '').toLowerCase();

    if (['pc','desktop','notebook','laptop'].includes(raw)) return 'pc';
    if (['mobile','phone','touch','tablet'].includes(raw)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(raw)) return 'cvr';

    return isMobileUA() ? 'mobile' : 'pc';
  }

  function activeAttr(selector, attr, fallback){
    const active = document.querySelector(selector + '.active');
    const val = active && active.getAttribute(attr);
    return val || fallback;
  }

  function launcherState(){
    const s =
      window.HHA_GROUPS_LAUNCHER &&
      window.HHA_GROUPS_LAUNCHER.state ||
      {};

    return {
      mode: s.mode || activeAttr('[data-mode]', 'data-mode', 'solo'),
      view: normalizeView(s.view || activeAttr('[data-view]', 'data-view', qs.get('view') || '')),
      variant: s.variant || activeAttr('[data-variant]', 'data-variant', 'arena')
    };
  }

  function buildZoneUrl(){
    const out = new URL(ZONE);

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'diff',
      'time',
      'view',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'qa',
      'debug',
      'teacher'
    ].forEach(function(k){
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    const st = launcherState();

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));
    out.searchParams.set('diff', getParam('diff', 'normal'));
    out.searchParams.set('time', getParam('time', '90'));
    out.searchParams.set('view', st.view);
    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');

    return out.toString();
  }

  function buildSoloRunUrl(extra){
    const st = launcherState();
    const out = new URL(SOLO_RUN);
    const zoneUrl = buildZoneUrl();

    [
      'pid',
      'name',
      'studentId',
      'studentName',
      'classSection',
      'studyId',
      'conditionGroup',
      'api',
      'log',
      'qa',
      'debug',
      'teacher'
    ].forEach(function(k){
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('pid', getParam('pid', 'anon'));
    out.searchParams.set('name', getParam('name', 'Hero'));

    out.searchParams.set('mode', 'solo');
    out.searchParams.set('variant', st.variant);
    out.searchParams.set('view', st.view);
    out.searchParams.set('run', 'play');

    out.searchParams.set('zone', 'nutrition');
    out.searchParams.set('cat', 'nutrition');
    out.searchParams.set('game', 'groups');
    out.searchParams.set('gameId', 'groups');
    out.searchParams.set('entry', 'groups-vr-launcher-direct');
    out.searchParams.set('from', 'groups-vr');
    out.searchParams.set('theme', 'food-groups');

    // สำคัญ: ข้ามหน้า intro แล้วเข้า gameplay ทันที
    out.searchParams.set('skipIntro', '1');
    out.searchParams.set('nointro', '1');
    out.searchParams.set('autostart', '1');

    out.searchParams.set('hub', getParam('hub', zoneUrl));
    out.searchParams.set('back', getParam('back', zoneUrl));
    out.searchParams.set('return', getParam('return', zoneUrl));
    out.searchParams.set('returnTo', getParam('returnTo', zoneUrl));

    if (st.variant === 'practice') {
      out.searchParams.set('diff', 'easy');
      out.searchParams.set('time', getParam('time', '120'));
      out.searchParams.set('assist', '1');
      out.searchParams.set('practice', '1');
    } else {
      out.searchParams.set('diff', getParam('diff', 'normal'));
      out.searchParams.set('time', getParam('time', '90'));
    }

    out.searchParams.set('seed', String(Date.now()));

    Object.entries(extra || {}).forEach(function(pair){
      const k = pair[0];
      const v = pair[1];

      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function addStyle(){
    if (document.getElementById('hha-groups-direct-start-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-direct-start-style';
    style.textContent = `
      .hha-direct-start-toast{
        position:fixed;
        left:50%;
        bottom:calc(18px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%) translateY(14px);
        z-index:1000001;
        width:min(92vw,560px);
        padding:12px 16px;
        border-radius:20px;
        background:rgba(21,48,74,.94);
        color:white;
        text-align:center;
        font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 42px rgba(0,0,0,.24);
        opacity:0;
        pointer-events:none;
        transition:.18s ease;
      }

      .hha-direct-start-toast.show{
        opacity:1;
        transform:translateX(-50%) translateY(0);
      }
    `;

    document.head.appendChild(style);
  }

  let toastBox = null;
  let toastTimer = null;

  function toast(message){
    addStyle();

    if (!toastBox) {
      toastBox = document.createElement('div');
      toastBox.className = 'hha-direct-start-toast';
      document.body.appendChild(toastBox);
    }

    toastBox.textContent = String(message || '');
    toastBox.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      toastBox.classList.remove('show');
    }, 1200);
  }

  function handleStart(ev){
    const btn = ev.target && ev.target.closest && ev.target.closest('#startBtn');

    if (!btn) return;

    const st = launcherState();

    ev.preventDefault();
    ev.stopPropagation();

    if (typeof ev.stopImmediatePropagation === 'function') {
      ev.stopImmediatePropagation();
    }

    if (st.mode !== 'solo') {
      toast('Multiplayer เป็นโหมด TEST แยกไว้ ยังไม่ใช่เส้นทาง Solo');
      return false;
    }

    if (!['arena','practice'].includes(st.variant)) {
      toast('โหมดนี้เตรียมทำต่อหลัง Solo core จบ');
      return false;
    }

    const url = buildSoloRunUrl();

    console.info('[Groups Direct Start]', PATCH_ID, {
      state: st,
      url: url
    });

    toast('กำลังเข้าเกม...');

    setTimeout(function(){
      location.href = url;
    }, 80);

    return false;
  }

  function patchButtons(){
    const btn = document.getElementById('startBtn');
    const copyBtn = document.getElementById('copyBtn');

    if (btn) {
      btn.setAttribute('data-hha-direct-start-fixed', PATCH_ID);

      const st = launcherState();

      if (st.mode === 'solo' && ['arena','practice'].includes(st.variant)) {
        btn.disabled = false;
        btn.textContent = 'เริ่มเล่น';
      }
    }

    if (copyBtn && !copyBtn.__hhaDirectStartCopyBound) {
      copyBtn.__hhaDirectStartCopyBound = true;

      copyBtn.addEventListener('click', function(ev){
        const st = launcherState();

        if (st.mode !== 'solo') return;

        ev.preventDefault();
        ev.stopPropagation();

        if (typeof ev.stopImmediatePropagation === 'function') {
          ev.stopImmediatePropagation();
        }

        const url = buildSoloRunUrl();

        try {
          navigator.clipboard.writeText(url);
          toast('คัดลอกลิงก์เข้าเกมโดยตรงแล้ว');
        } catch(e) {
          toast(url);
        }

        return false;
      }, true);
    }
  }

  function bind(){
    if (document.__hhaGroupsDirectStartBound) return;
    document.__hhaGroupsDirectStartBound = true;

    document.addEventListener('click', handleStart, true);
  }

  function scan(){
    patchButtons();
  }

  function boot(){
    addStyle();
    bind();
    scan();

    setTimeout(scan, 250);
    setTimeout(scan, 900);
    setTimeout(scan, 1600);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_DIRECT_START_SCAN_TIMER__);
      window.__HHA_GROUPS_DIRECT_START_SCAN_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','disabled','href','style']
    });

    console.info('[HeroHealth Groups Launcher]', PATCH_ID, 'ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }

})();
