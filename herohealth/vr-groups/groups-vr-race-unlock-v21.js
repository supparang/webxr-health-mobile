/* =========================================================
   HeroHealth • GroupsVR Race Unlock v21
   File: /herohealth/vr-groups/groups-vr-race-unlock-v21.js
   PATCH: v20260609-GROUPS-VR-RACE-UNLOCK-V21

   Purpose:
   - เปิด Race card ใน /herohealth/groups-vr.html
   - ไม่ไปชน hard-start เดิมของ Solo
   - เพิ่มปุ่มเข้า Groups Race Lobby
   ========================================================= */

(function(){
  'use strict';

  const PATCH = 'v20260609-GROUPS-VR-RACE-UNLOCK-V21';

  if (window.__HHA_GROUPS_VR_RACE_UNLOCK_V21__) return;
  window.__HHA_GROUPS_VR_RACE_UNLOCK_V21__ = true;

  const qs = new URLSearchParams(location.search || '');

  let selectedMode = 'solo';

  function $(id){
    return document.getElementById(id);
  }

  function norm(v){
    return String(v == null ? '' : v).trim();
  }

  function repoBase(){
    const path = location.pathname || '';
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  function raceLobbyUrl(){
    const out = new URL(repoBase() + '/herohealth/vr-groups/groups-race-lobby.html');

    out.searchParams.set('name', norm(qs.get('name') || localStorage.getItem('HHA_PLAYER_NAME') || 'Hero'));
    out.searchParams.set('view', norm(qs.get('view') || 'mobile'));
    out.searchParams.set('diff', norm(qs.get('diff') || 'normal'));
    out.searchParams.set('time', norm(qs.get('time') || '45'));
    out.searchParams.set('from', 'groups-vr-race-unlock-v21');

    if (qs.get('qa') === '1') out.searchParams.set('qa', '1');
    if (qs.get('debug') === '1') out.searchParams.set('debug', '1');

    return out.toString();
  }

  function toast(msg){
    let box = $('toast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast';
      box.className = 'toast';
      document.body.appendChild(box);
    }

    box.textContent = msg;
    box.classList.add('show');

    clearTimeout(toast._t);
    toast._t = setTimeout(function(){
      box.classList.remove('show');
    }, 1600);
  }

  function setActiveMode(mode){
    selectedMode = mode;

    document.querySelectorAll('[data-mode]').forEach(function(el){
      const m = el.getAttribute('data-mode');
      el.classList.toggle('active', m === mode);
    });

    const modePill = $('modePill');
    const statusPill = $('statusPill');
    const summaryTitle = $('summaryTitle');
    const summaryText = $('summaryText');
    const infoMode = $('infoMode');
    const infoVariant = $('infoVariant');
    const startBtn = $('startBtn');
    const raceBtn = ensureRaceStartButton();

    if (mode === 'race') {
      if (modePill) modePill.textContent = '🏁 Race';
      if (statusPill) statusPill.textContent = '🏁 Race Ready';
      if (infoMode) infoMode.textContent = 'Race';
      if (infoVariant) infoVariant.textContent = 'Room Code';
      if (summaryTitle) summaryTitle.textContent = 'พร้อมเริ่ม: Groups Race';
      if (summaryText) summaryText.textContent = 'ระบบจะเปิด Race Lobby เพื่อสร้างห้อง / เข้าห้อง แล้วเข้า groups-race-run-v15.html';

      if (startBtn) startBtn.style.display = 'none';
      if (raceBtn) raceBtn.style.display = 'inline-flex';
    } else {
      if (raceBtn) raceBtn.style.display = 'none';
      if (startBtn) startBtn.style.display = '';
    }
  }

  function ensureRaceStartButton(){
    let btn = $('raceStartLobbyBtnV21');
    if (btn) return btn;

    const startBtn = $('startBtn');
    if (!startBtn || !startBtn.parentNode) return null;

    btn = document.createElement('button');
    btn.id = 'raceStartLobbyBtnV21';
    btn.type = 'button';
    btn.className = startBtn.className || 'btn primary';
    btn.textContent = '🏁 เข้า Race Lobby';
    btn.style.display = 'none';

    startBtn.parentNode.insertBefore(btn, startBtn.nextSibling);

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      location.href = raceLobbyUrl();

      return false;
    }, true);

    return btn;
  }

  function unlockRaceCard(){
    const race = document.querySelector('[data-mode="race"]');
    if (!race) return;

    race.classList.remove('disabled');
    race.removeAttribute('data-disabled');
    race.setAttribute('data-enabled', '1');
    race.setAttribute('aria-disabled', 'false');

    const badge = race.querySelector('.badge');
    if (badge) {
      badge.textContent = 'พร้อมทดสอบ';
      badge.className = 'badge ready';
    }

    const p = race.querySelector('p');
    if (p) {
      p.textContent = 'สร้างห้องด้วย Room Code แล้วแข่งความเร็วด้วย groups-race-run-v15';
    }
  }

  function interceptRaceCard(){
    document.addEventListener('click', function(ev){
      const card = ev.target && ev.target.closest
        ? ev.target.closest('[data-mode="race"]')
        : null;

      if (!card) return;

      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

      setActiveMode('race');
      toast('เลือกโหมด Race แล้ว กดเข้า Race Lobby');

      return false;
    }, true);
  }

  function boot(){
    unlockRaceCard();
    ensureRaceStartButton();
    interceptRaceCard();

    setInterval(unlockRaceCard, 1200);

    console.info('[GroupsVRRaceUnlockV21]', {
      patch: PATCH,
      target: raceLobbyUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
