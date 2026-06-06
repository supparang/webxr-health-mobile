/* =========================================================
   HeroHealth • Groups Race Inline Start Unlock
   File: /herohealth/vr-groups/groups-race-inline-start-unlock-v13.js
   PATCH: v20260606-GROUPS-RACE-INLINE-START-UNLOCK-V13

   Purpose:
   - แก้ Inline Stabilizer v09 ที่วน reset หน้า Waiting Room
   - เมื่อมี ?mock=1 / ?dev=1 / ?bot=1 ให้ Start ได้แม้ DOM ยังเห็นผู้เล่นไม่ครบ
   - ถ้าเริ่มแข่งแล้ว ให้หยุดการดึง countdown กลับเป็น "รอ"
   - ซ่อน Waiting Room เมื่อ v11 gameplay overlay เปิด
   ========================================================= */

(function () {
  'use strict';

  const PATCH = 'v20260606-GROUPS-RACE-INLINE-START-UNLOCK-V13';

  if (window.__HHA_GROUPS_RACE_INLINE_START_UNLOCK_V13__) return;
  window.__HHA_GROUPS_RACE_INLINE_START_UNLOCK_V13__ = true;

  const qs = new URLSearchParams(location.search || '');

  const DEV_MODE =
    qs.get('mock') === '1' ||
    qs.get('dev') === '1' ||
    qs.get('bot') === '1' ||
    qs.get('testBot') === '1' ||
    localStorage.getItem('HHA_GROUPS_RACE_DEV_BOT') === '1';

  function $(id) {
    return document.getElementById(id);
  }

  function log() {
    try {
      console.log('[GroupsRaceInlineUnlock]', ...arguments);
    } catch (_) {}
  }

  function isStarted() {
    if (document.getElementById('hhaRacePlayV11')) return true;

    const body = String(document.body && document.body.textContent || '').toLowerCase();

    return (
      window.__HHA_GROUPS_RACE_STARTED__ === true ||
      window.__HHA_GROUPS_RACE_PLAYING__ === true ||
      body.includes('groups race') && body.includes('แตะหมู่อาหาร') ||
      body.includes('race summary') ||
      body.includes('score') && body.includes('combo')
    );
  }

  function hasStartSignal() {
    const room =
      qs.get('room') ||
      qs.get('roomId') ||
      qs.get('code') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      localStorage.getItem('HHA_GROUPS_RACE_ROOM_CODE') ||
      localStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      '';

    if (!room) return false;

    return !!(
      localStorage.getItem('HHA_GROUPS_RACE_FORCE_START_' + room) ||
      localStorage.getItem('HHA_GROUPS_RACE_FORCE_START_SIGNAL_' + room) ||
      localStorage.getItem('HHA_GROUPS_RACE_LAST_START_SIGNAL')
    );
  }

  function markStarted(reason) {
    window.__HHA_GROUPS_RACE_STARTED__ = true;
    window.__HHA_GROUPS_RACE_PLAYING__ = true;

    try {
      sessionStorage.setItem('HHA_GROUPS_RACE_STARTED', '1');
      sessionStorage.setItem('HHA_GROUPS_RACE_STARTED_REASON', reason || PATCH);
    } catch (_) {}

    const countdown = $('countdown');
    const status = $('statusMsg');
    const page = $('page');

    if (countdown) {
      countdown.className = 'count go';
      countdown.textContent = 'GO';
    }

    if (status) {
      status.className = 'status-text ok';
      status.textContent = 'เริ่มแข่งแล้ว • กำลังเข้าเกม';
    }

    /*
      ถ้า gameplay v11 เปิดแล้ว ให้ลด Waiting Room ไปหลังฉาก
      ไม่ remove ทิ้ง เพื่อป้องกันปุ่ม back/รีโหลดบางเครื่องพัง
    */
    if (page && document.getElementById('hhaRacePlayV11')) {
      page.style.pointerEvents = 'none';
      page.style.opacity = '0';
      page.style.transform = 'scale(.98)';
      page.style.position = 'fixed';
      page.style.inset = '0';
      page.style.zIndex = '0';
    }

    log('marked started:', reason || PATCH);
  }

  function unlockStartButton() {
    const btn = $('btnStartRace');
    if (!btn) return;

    btn.disabled = false;
    btn.removeAttribute('disabled');
    btn.setAttribute('aria-disabled', 'false');

    if (DEV_MODE) {
      btn.classList.add('primary');
      btn.style.opacity = '1';
      btn.style.filter = 'none';
    }
  }

  function forceDomReadyForDevBot() {
    if (!DEV_MODE) return;

    const list = $('playersList');

    if (list && !String(list.textContent || '').includes('RaceBot')) {
      const bot = document.createElement('div');
      bot.className = 'player';
      bot.setAttribute('data-dev-bot-dom', '1');
      bot.innerHTML =
        '<div class="left">' +
          '<div class="avatar">🤖</div>' +
          '<div>' +
            '<div class="name">RaceBot</div>' +
            '<div class="tag">Dev Bot • mock player • normal</div>' +
          '</div>' +
        '</div>' +
        '<div class="right ok">พร้อม</div>';

      list.appendChild(bot);
    }

    const status = $('statusMsg');
    const state = $('roomState');

    if (status) {
      status.className = 'status-text ok';
      status.textContent = 'Dev Bot พร้อมแล้ว • ทดสอบ Race ด้วยเครื่องเดียวได้';
    }

    if (state) {
      state.textContent = 'ผู้เล่นครบแล้ว 2 คนแบบทดสอบ • กดเริ่มแข่งได้';
    }
  }

  function installStartCaptureBypass() {
    document.addEventListener('click', function (ev) {
      const btn = ev.target && ev.target.closest
        ? ev.target.closest('#btnStartRace,button,a,[role="button"],.btn')
        : null;

      if (!btn) return;

      const txt = String(btn.textContent || '').toLowerCase();

      const isStart =
        btn.id === 'btnStartRace' ||
        txt.includes('เริ่มแข่ง') ||
        txt.includes('race start') ||
        txt.includes('start') ||
        txt.includes('go');

      if (!isStart) return;

      /*
        จุดสำคัญ:
        ไม่ stop event แต่ mark flag ไว้ให้ patch อื่นรู้ว่าเราตั้งใจเริ่มแล้ว
        และถ้า DEV_MODE ให้ DOM ดูเหมือนครบ 2 คนก่อน listener ตัวเก่าจะนับ
      */
      if (DEV_MODE) {
        forceDomReadyForDevBot();
        unlockStartButton();
      }

      window.__HHA_GROUPS_RACE_START_CLICKED__ = true;

      setTimeout(function () {
        markStarted('start-click-capture');
      }, 700);
    }, true);
  }

  function watchGameplayOverlay() {
    const timer = setInterval(function () {
      unlockStartButton();

      if (DEV_MODE) {
        forceDomReadyForDevBot();
      }

      if (hasStartSignal()) {
        markStarted('local-start-signal');
      }

      if (isStarted()) {
        markStarted('gameplay-detected');

        /*
          ไม่ clear ทันที เพราะ overlay อาจสร้างช้าบางเครื่อง
          แต่หลัง gameplay แสดงแล้วไม่จำเป็นต้องทำงานถี่
        */
      }
    }, 400);

    setTimeout(function () {
      if (isStarted()) clearInterval(timer);
    }, 10000);
  }

  function boot() {
    log('boot', {
      patch: PATCH,
      devMode: DEV_MODE,
      href: location.href
    });

    unlockStartButton();

    if (DEV_MODE) {
      forceDomReadyForDevBot();
    }

    installStartCaptureBypass();
    watchGameplayOverlay();

    window.addEventListener('hha:groups-race-start-sync', function () {
      markStarted('event:hha:groups-race-start-sync');
    });

    document.addEventListener('hha:groups-race-start-sync', function () {
      markStarted('document-event:hha:groups-race-start-sync');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
