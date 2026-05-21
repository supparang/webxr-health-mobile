/* =========================================================
   HeroHealth Groups Solo
   PATCH: v20260520-groups-solo-cooldown-flow-final-04
   File: /herohealth/patches/groups/04-groups-solo-cooldown-flow-final.js

   Purpose:
   - Add safe Cooldown button on Summary
   - Send cooldown to /herohealth/warmup-gate.html?phase=cooldown
   - After cooldown, return to /herohealth/nutrition-zone.html
   - Prevent wrong return to Hub / old launcher
   - Keep pid/diff/time/view/seed/studyId/log/api context
========================================================= */
(function(){
  'use strict';

  const PATCH_ID = 'v20260520-groups-solo-cooldown-flow-final-04';
  if (window.__HHA_GROUPS_SOLO_COOLDOWN_FLOW_FINAL__) return;
  window.__HHA_GROUPS_SOLO_COOLDOWN_FLOW_FINAL__ = true;

  const qs = new URLSearchParams(location.search);

  const BASE = 'https://supparang.github.io/webxr-health-mobile';
  const HERO = BASE + '/herohealth';

  const GAME_ID = 'groups';
  const ZONE = 'nutrition';

  const RUN_FILE = HERO + '/vr-groups/groups.html';
  const GATE_FILE = HERO + '/warmup-gate.html';
  const ZONE_FILE = HERO + '/nutrition-zone.html';
  const LAUNCHER_FILE = HERO + '/groups-vr.html';

  function todayKey(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + m + day;
  }

  function getParam(name, fallback){
    const v = qs.get(name);
    return v === null || v === '' ? fallback : v;
  }

  function playerId(){
    return getParam('pid', 'anon');
  }

  function viewMode(){
    const v = String(getParam('view', '')).toLowerCase();

    if (['pc','desktop'].includes(v)) return 'pc';
    if (['mobile','phone','touch'].includes(v)) return 'mobile';
    if (['cvr','cardboard','cardboard-vr','vr','webxr'].includes(v)) return 'cvr';

    return /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '')
      ? 'mobile'
      : 'pc';
  }

  function safeName(){
    return getParam('name', 'Hero');
  }

  function dailyCooldownKey(){
    return [
      'HHA_GATE_COOLDOWN',
      playerId(),
      GAME_ID,
      'solo',
      viewMode(),
      todayKey()
    ].join('_');
  }

  function cooldownIntentKey(){
    return [
      'HHA_COOLDOWN_INTENT',
      playerId(),
      GAME_ID,
      'solo',
      todayKey()
    ].join('_');
  }

  function storageGet(key){
    try {
      return localStorage.getItem(key) || sessionStorage.getItem(key);
    } catch(e) {
      return null;
    }
  }

  function storageSet(key, value){
    try { localStorage.setItem(key, value); } catch(e) {}
    try { sessionStorage.setItem(key, value); } catch(e) {}
  }

  function hasCooldownDoneToday(){
    const key = dailyCooldownKey();
    const v = storageGet(key);

    if (!v) return false;

    return String(v).includes(todayKey()) ||
           String(v) === '1' ||
           String(v).toLowerCase() === 'done' ||
           String(v).toLowerCase() === 'true';
  }

  function buildUrl(base, extra){
    const out = new URL(base, location.href);

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
      'log'
    ].forEach(k => {
      const v = qs.get(k);
      if (v !== null && v !== '') out.searchParams.set(k, v);
    });

    Object.entries(extra || {}).forEach(([k,v]) => {
      if (v === null || v === undefined) out.searchParams.delete(k);
      else out.searchParams.set(k, String(v));
    });

    return out.toString();
  }

  function nutritionZoneUrl(){
    return buildUrl(ZONE_FILE, {
      zone:ZONE,
      cat:ZONE,
      game:GAME_ID,
      gameId:GAME_ID,
      mode:'solo',
      phase:null,
      run:null
    });
  }

  function launcherUrl(){
    return buildUrl(LAUNCHER_FILE, {
      zone:ZONE,
      cat:ZONE,
      game:GAME_ID,
      gameId:GAME_ID,
      mode:null,
      phase:null,
      run:null
    });
  }

  function replayUrl(){
    return buildUrl(RUN_FILE, {
      zone:ZONE,
      cat:ZONE,
      game:GAME_ID,
      gameId:GAME_ID,
      mode:'solo',
      run:'play',
      phase:null,
      seed:Date.now()
    });
  }

  function cooldownGateUrl(){
    const next = nutritionZoneUrl();

    return buildUrl(GATE_FILE, {
      phase:'cooldown',
      gate:'cooldown',
      gatePhase:'cooldown',

      zone:ZONE,
      cat:ZONE,
      game:GAME_ID,
      gameId:GAME_ID,
      mode:'solo',
      variant:'food-groups',
      entry:'groups-solo',

      run:null,
      seed:getParam('seed', Date.now()),
      view:viewMode(),

      next:next,
      back:next,
      backZone:next,
      hub:next,

      returnTo:next,
      after:next,
      done:next,

      title:'Groups Cooldown',
      label:'ผ่อนคลายหลังเล่น Groups'
    });
  }

  function addStyle(){
    if (document.getElementById('hha-groups-cooldown-flow-style')) return;

    const style = document.createElement('style');
    style.id = 'hha-groups-cooldown-flow-style';
    style.textContent = `
      body.hha-groups-summary-mode .hha-groups-flow-box{
        width:min(88vw, 460px);
        margin:18px auto 8px;
        padding:14px 14px 16px;
        border-radius:28px;
        background:linear-gradient(180deg, rgba(255,255,255,.96), rgba(240,255,240,.92));
        border:3px solid rgba(195,239,198,.95);
        box-shadow:0 14px 34px rgba(91,150,97,.16);
        box-sizing:border-box;
        text-align:center;
      }

      body.hha-groups-summary-mode .hha-groups-flow-title{
        font:900 clamp(20px, 5.5vw, 30px)/1.15 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        color:#214f64;
        margin:0 0 8px;
      }

      body.hha-groups-summary-mode .hha-groups-flow-sub{
        font:800 clamp(13px, 3.7vw, 17px)/1.3 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        color:#7190a0;
        margin:0 0 14px;
      }

      body.hha-groups-summary-mode .hha-groups-flow-actions{
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:12px;
      }

      body.hha-groups-summary-mode .hha-groups-flow-btn{
        display:flex;
        align-items:center;
        justify-content:center;
        width:min(80vw, 340px);
        min-height:56px;
        padding:10px 18px;
        border-radius:999px;
        border:0;
        text-decoration:none;
        cursor:pointer;
        box-sizing:border-box;
        font:900 clamp(20px, 5.6vw, 30px)/1.08 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 12px 28px rgba(0,0,0,.12);
        touch-action:manipulation;
      }

      body.hha-groups-summary-mode .hha-groups-flow-btn.cooldown{
        background:linear-gradient(135deg, #9df8c8, #d9ffb7);
        color:#174f3b;
      }

      body.hha-groups-summary-mode .hha-groups-flow-btn.zone{
        background:linear-gradient(135deg, #eefce8, #ffffff);
        color:#214f64;
        border:2px solid rgba(195,239,198,.95);
      }

      body.hha-groups-summary-mode .hha-groups-flow-btn.launcher{
        background:linear-gradient(135deg, #e9f8ff, #ffffff);
        color:#214f64;
        border:2px solid rgba(202,234,245,.95);
      }

      body.hha-groups-summary-mode .hha-groups-flow-note{
        margin-top:10px;
        color:#7a95a5;
        font:800 clamp(11px, 3.2vw, 14px)/1.25 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      body.hha-groups-summary-mode .hha-groups-existing-actions-fixed{
        margin-top:14px !important;
      }
    `;

    document.head.appendChild(style);
  }

  function pageText(){
    return String(document.body && document.body.innerText || '');
  }

  function isSummaryVisible(){
    const t = pageText();

    return (
      t.includes('สรุปผลการเล่น') ||
      t.includes('เล่นอีกครั้ง') ||
      t.includes('กลับ Nutrition Zone') ||
      (t.includes('Food Hero') && t.includes('Best Score')) ||
      (t.includes('Mobile Final Polish') && t.includes('Avg Response'))
    );
  }

  function findSummaryRoot(){
    const candidates = Array.from(document.querySelectorAll('main,section,article,div'))
      .filter(el => {
        const t = String(el.innerText || '');
        if (t.length < 40) return false;

        return (
          t.includes('สรุปผลการเล่น') ||
          t.includes('เล่นอีกครั้ง') ||
          t.includes('กลับ Nutrition Zone') ||
          (t.includes('Food Hero') && t.includes('Best Score'))
        );
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          el,
          area: Math.max(1, r.width * r.height)
        };
      })
      .filter(x => x.area > 12000)
      .sort((a,b) => b.area - a.area);

    return candidates.length ? candidates[0].el : null;
  }

  function go(url){
    try {
      location.assign(url);
    } catch(e) {
      location.href = url;
    }
  }

  function patchExistingButtons(root){
    if (!root) return;

    const zone = nutritionZoneUrl();
    const replay = replayUrl();
    const launcher = launcherUrl();

    Array.from(root.querySelectorAll('a,button,[role="button"],div,span')).forEach(el => {
      const text = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length > 80) return;

      const isReplay =
        text.includes('เล่นอีกครั้ง') ||
        text.includes('Replay') ||
        text.includes('Play Again');

      const isZone =
        text.includes('กลับ Nutrition Zone') ||
        text.includes('Nutrition Zone');

      const isLauncher =
        text.includes('กลับหน้าเลือก') ||
        text.includes('เลือกโหมด') ||
        text.includes('Groups Launcher') ||
        text.includes('Launcher');

      let target = null;
      if (isReplay) target = replay;
      if (isZone) target = zone;
      if (isLauncher) target = launcher;

      if (!target) return;

      el.classList.add('hha-groups-existing-actions-fixed');

      if (el.tagName === 'A') {
        el.href = target;
      }

      el.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        go(target);
      }, true);
    });
  }

  function createButton(label, className, target, beforeGo){
    const a = document.createElement('a');
    a.className = 'hha-groups-flow-btn ' + className;
    a.href = target;
    a.textContent = label;

    a.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();

      if (beforeGo) beforeGo();

      go(target);
    }, true);

    return a;
  }

  function ensureCooldownBox(root){
    if (!root) return;
    if (root.querySelector('.hha-groups-flow-box')) return;

    const box = document.createElement('div');
    box.className = 'hha-groups-flow-box';

    const title = document.createElement('div');
    title.className = 'hha-groups-flow-title';

    const sub = document.createElement('div');
    sub.className = 'hha-groups-flow-sub';

    const actions = document.createElement('div');
    actions.className = 'hha-groups-flow-actions';

    const done = hasCooldownDoneToday();

    if (done) {
      title.textContent = '✅ วันนี้ทำ Cooldown แล้ว';
      sub.textContent = 'กลับ Nutrition Zone ได้เลย หรือเล่นอีกรอบเพื่อฝึกให้แม่นขึ้น';

      actions.appendChild(
        createButton('กลับ Nutrition Zone', 'zone', nutritionZoneUrl())
      );

      actions.appendChild(
        createButton('เล่นอีกครั้ง', 'launcher', replayUrl())
      );
    } else {
      title.textContent = '🌿 Cooldown หลังเล่น';
      sub.textContent = 'แนะนำให้ผ่อนคลายก่อนกลับโซน เพื่อปิดรอบการเล่นให้ครบ';

      actions.appendChild(
        createButton('ทำ Cooldown', 'cooldown', cooldownGateUrl(), function(){
          storageSet(cooldownIntentKey(), JSON.stringify({
            game:GAME_ID,
            mode:'solo',
            view:viewMode(),
            pid:playerId(),
            name:safeName(),
            at:new Date().toISOString(),
            next:nutritionZoneUrl(),
            patch:PATCH_ID
          }));
        })
      );

      actions.appendChild(
        createButton('กลับ Nutrition Zone', 'zone', nutritionZoneUrl())
      );
    }

    const note = document.createElement('div');
    note.className = 'hha-groups-flow-note';
    note.textContent = done
      ? 'ระบบจะไม่บังคับ Cooldown ซ้ำในวันเดียวกัน'
      : 'ถ้ายังไม่พร้อมทำ Cooldown สามารถกลับโซนได้ แต่รอบสมบูรณ์ควรทำ Cooldown';

    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(actions);
    box.appendChild(note);

    const existingAction = Array.from(root.querySelectorAll('a,button,[role="button"],div,span'))
      .find(el => {
        const t = String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        return t.includes('เล่นอีกครั้ง') || t.includes('กลับ Nutrition Zone');
      });

    if (existingAction && existingAction.parentElement && existingAction.parentElement !== root) {
      existingAction.parentElement.insertAdjacentElement('beforebegin', box);
    } else {
      root.appendChild(box);
    }
  }

  function forceNutritionReturnParams(){
    const zone = nutritionZoneUrl();

    try {
      sessionStorage.setItem('HHA_LAST_ZONE_URL', zone);
      sessionStorage.setItem('HHA_GROUPS_LAST_ZONE_URL', zone);
      sessionStorage.setItem('HHA_GROUPS_SOLO_RETURN_URL', zone);
    } catch(e) {}

    try {
      localStorage.setItem('HHA_LAST_ZONE_URL', zone);
      localStorage.setItem('HHA_GROUPS_LAST_ZONE_URL', zone);
      localStorage.setItem('HHA_GROUPS_SOLO_RETURN_URL', zone);
    } catch(e) {}
  }

  function patchAllPageLinks(){
    const zone = nutritionZoneUrl();
    const launcher = launcherUrl();

    Array.from(document.querySelectorAll('a,button,[role="button"]')).forEach(el => {
      const text = String(el.innerText || el.textContent || el.getAttribute('aria-label') || '')
        .replace(/\s+/g, ' ')
        .trim();

      const href = String(el.getAttribute && el.getAttribute('href') || '');

      const looksWrongHub =
        href.includes('/hub.html') &&
        (
          text.includes('Nutrition') ||
          text.includes('Zone') ||
          text.includes('กลับ') ||
          text.includes('Hub')
        );

      const looksZone =
        text.includes('Nutrition Zone') ||
        text.includes('กลับโซน') ||
        text.includes('กลับ Zone') ||
        href.includes('/nutrition-zone.html');

      const looksLauncher =
        text.includes('เลือกโหมด') ||
        text.includes('Groups Launcher') ||
        href.includes('/groups-vr.html');

      if (looksZone || looksWrongHub) {
        if (el.tagName === 'A') {
          el.href = zone;
        } else {
          el.addEventListener('click', function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            go(zone);
          }, true);
        }
      }

      if (looksLauncher) {
        if (el.tagName === 'A') {
          el.href = launcher;
        } else {
          el.addEventListener('click', function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            go(launcher);
          }, true);
        }
      }
    });
  }

  function scan(){
    forceNutritionReturnParams();
    patchAllPageLinks();

    if (!isSummaryVisible()) return;

    document.body.classList.add('hha-groups-summary-mode');

    const root = findSummaryRoot();
    if (!root) return;

    root.classList.add('hha-summary-root');

    patchExistingButtons(root);
    ensureCooldownBox(root);
  }

  function boot(){
    addStyle();

    scan();
    setTimeout(scan, 250);
    setTimeout(scan, 800);
    setTimeout(scan, 1600);
    setTimeout(scan, 2800);

    const mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_GROUPS_COOLDOWN_FLOW_SCAN_TIMER__);
      window.__HHA_GROUPS_COOLDOWN_FLOW_SCAN_TIMER__ = setTimeout(scan, 120);
    });

    mo.observe(document.body, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['href','class','style']
    });

    console.info('[HeroHealth Groups Solo]', PATCH_ID, 'ready', {
      view:viewMode(),
      cooldownDoneToday:hasCooldownDoneToday(),
      cooldownGate:cooldownGateUrl(),
      nutritionZone:nutritionZoneUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }

})();
