/* =========================================================
   HeroHealth Groups Race Player Band
   PATCH: v20260527-groups-race-player-band-v01
   File: /herohealth/vr-groups/groups-race-player-band-v01.js

   Purpose:
   - Split Race into Standard 2–4 and Party 5–10
   - Enable Standard 2–4 first
   - Lock Party 5–10 for later
   - Add visual selector in lobby
   - Add capacity guard in waiting room
   - Do not touch existing Firebase/gameplay logic
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260527-groups-race-player-band-v01';

  if (window.__HHA_GROUPS_RACE_PLAYER_BAND_V01__) return;
  window.__HHA_GROUPS_RACE_PLAYER_BAND_V01__ = true;

  var qs = new URLSearchParams(location.search);
  var path = location.pathname || '';

  var isLobby = /groups-race-lobby\.html$/i.test(path);
  var isRun = /groups-race-run\.html$/i.test(path);

  var BANDS = {
    standard: {
      key: 'standard',
      label: 'Race Standard',
      icon: '🏁',
      min: 2,
      max: 4,
      title: 'Race Standard 2–4 คน',
      desc: 'แข่งห้องเล็ก คุมง่าย เหมาะสำหรับทำให้จบก่อน',
      enabled: true
    },
    party: {
      key: 'party',
      label: 'Race Party',
      icon: '🎉',
      min: 5,
      max: 10,
      title: 'Race Party 5–10 คน',
      desc: 'แข่งกลุ่มใหญ่ ต้องมี leaderboard และ capacity เพิ่ม',
      enabled: false
    }
  };

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function $all(sel, root){
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function byId(id){
    return document.getElementById(id);
  }

  function textOf(el){
    return String(el && (el.innerText || el.textContent || '') || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[c];
    });
  }

  function getBandKey(){
    var raw =
      qs.get('raceBand') ||
      qs.get('band') ||
      qs.get('playersBand') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_BAND') ||
      'standard';

    raw = String(raw || 'standard').toLowerCase();

    if (raw === 'small' || raw === '2-4' || raw === '2_4') return 'standard';
    if (raw === 'big' || raw === 'party' || raw === '5-10' || raw === '5_10') return 'party';

    return BANDS[raw] ? raw : 'standard';
  }

  function getBand(){
    var b = BANDS[getBandKey()] || BANDS.standard;
    return b.enabled ? b : BANDS.standard;
  }

  function saveBand(key){
    var b = BANDS[key] || BANDS.standard;

    if (!b.enabled) {
      toast('Race Party 5–10 คน เตรียมทำต่อ หลังจาก Standard 2–4 เสถียรก่อน');
      b = BANDS.standard;
    }

    try {
      sessionStorage.setItem('HHA_GROUPS_RACE_BAND', b.key);
      sessionStorage.setItem('HHA_GROUPS_RACE_MIN_PLAYERS', String(b.min));
      sessionStorage.setItem('HHA_GROUPS_RACE_MAX_PLAYERS', String(b.max));
      sessionStorage.setItem('HHA_GROUPS_RACE_BAND_LABEL', b.title);
    } catch(e) {}

    window.__HHA_GROUPS_RACE_BAND__ = {
      patch: PATCH_ID,
      key: b.key,
      min: b.min,
      max: b.max,
      label: b.title
    };

    return b;
  }

  function addStyle(){
    if (byId('hha-groups-race-player-band-style')) return;

    var style = document.createElement('style');
    style.id = 'hha-groups-race-player-band-style';

    style.textContent = `
      .hha-race-band-panel{
        margin:14px 0 6px;
        padding:12px;
        border-radius:22px;
        background:rgba(255,255,255,.055);
        border:1px solid rgba(255,255,255,.08);
      }

      .hha-race-band-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:10px;
        color:#ffe29b;
        font-weight:1000;
        font-size:14px;
      }

      .hha-race-band-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }

      .hha-race-band-card{
        position:relative;
        min-height:104px;
        border-radius:20px;
        padding:13px 12px;
        cursor:pointer;
        color:#f8fbff;
        background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.035));
        border:1px solid rgba(255,255,255,.10);
        box-shadow:0 12px 26px rgba(0,0,0,.16);
        transition:.16s ease;
        overflow:hidden;
      }

      .hha-race-band-card::after{
        content:"";
        position:absolute;
        right:-22px;
        top:-28px;
        width:84px;
        height:84px;
        border-radius:999px;
        background:rgba(118,199,255,.10);
        pointer-events:none;
      }

      .hha-race-band-card.active{
        border-color:rgba(118,199,255,.72);
        box-shadow:
          0 0 0 4px rgba(75,176,255,.14),
          0 16px 32px rgba(0,0,0,.18);
      }

      .hha-race-band-card.locked{
        opacity:.48;
        cursor:not-allowed;
        filter:saturate(.7);
      }

      .hha-race-band-main{
        display:flex;
        align-items:center;
        gap:9px;
        font-weight:1000;
        font-size:17px;
        line-height:1.12;
      }

      .hha-race-band-icon{
        width:38px;
        height:38px;
        border-radius:14px;
        display:grid;
        place-items:center;
        background:rgba(255,255,255,.10);
        border:1px solid rgba(255,255,255,.10);
        font-size:22px;
        flex:0 0 auto;
      }

      .hha-race-band-desc{
        margin-top:8px;
        color:#c8d7ff;
        font-size:12px;
        line-height:1.32;
        font-weight:850;
      }

      .hha-race-band-tag{
        position:absolute;
        right:10px;
        top:10px;
        min-height:25px;
        padding:0 9px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        color:#251600;
        background:linear-gradient(180deg,#fff2b9,#f0c16d);
        font-size:11px;
        font-weight:1000;
        z-index:2;
      }

      .hha-race-band-card.active .hha-race-band-tag{
        color:#062414;
        background:linear-gradient(180deg,#bfffd8,#63d99b);
      }

      .hha-race-band-card.locked .hha-race-band-tag{
        color:#6a4a00;
        background:linear-gradient(180deg,#fff6d7,#e4c071);
      }

      .hha-race-capacity-pill{
        display:inline-flex;
        align-items:center;
        gap:7px;
        min-height:34px;
        padding:0 12px;
        border-radius:999px;
        background:rgba(99,217,155,.12);
        border:1px solid rgba(99,217,155,.24);
        color:#bfffd8;
        font-size:12px;
        font-weight:1000;
        white-space:nowrap;
      }

      .hha-race-capacity-banner{
        position:fixed;
        left:50%;
        bottom:calc(14px + env(safe-area-inset-bottom,0px));
        transform:translateX(-50%);
        z-index:999999;
        width:min(680px,92vw);
        padding:12px 16px;
        border-radius:20px;
        background:rgba(15,37,98,.96);
        border:1px solid rgba(118,199,255,.34);
        color:#eaf6ff;
        font:900 14px/1.35 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        box-shadow:0 18px 42px rgba(0,0,0,.32);
        text-align:center;
        pointer-events:none;
      }

      .hha-race-capacity-banner b{
        color:#ffe29b;
      }

      .hha-race-capacity-banner.ok{
        border-color:rgba(99,217,155,.35);
      }

      .hha-race-capacity-banner.warn{
        border-color:rgba(240,193,109,.35);
      }

      .hha-race-capacity-banner.err{
        border-color:rgba(255,138,138,.42);
      }

      @media (max-width:620px){
        .hha-race-band-grid{
          grid-template-columns:1fr;
        }

        .hha-race-band-card{
          min-height:92px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function toast(msg, type){
    var box = $('.hha-race-capacity-banner');

    if (!box) {
      box = document.createElement('div');
      box.className = 'hha-race-capacity-banner';
      document.body.appendChild(box);
    }

    box.className = 'hha-race-capacity-banner ' + (type || 'warn');
    box.innerHTML = msg;

    clearTimeout(window.__HHA_RACE_BAND_TOAST_TIMER__);
    window.__HHA_RACE_BAND_TOAST_TIMER__ = setTimeout(function(){
      if (box && box.parentNode) box.parentNode.removeChild(box);
    }, 2400);
  }

  function injectLobbyBand(){
    if (!isLobby) return;
    if ($('.hha-race-band-panel')) return;

    var anchor =
      $('.modePill') ||
      $('h2') ||
      $('.card');

    if (!anchor || !anchor.parentNode) return;

    var active = getBand();

    var panel = document.createElement('div');
    panel.className = 'hha-race-band-panel';
    panel.innerHTML = `
      <div class="hha-race-band-title">
        <span>เลือกขนาดห้อง Race</span>
        <span class="hha-race-capacity-pill">เปิดก่อน: 2–4 คน</span>
      </div>

      <div class="hha-race-band-grid">
        <div class="hha-race-band-card ${active.key === 'standard' ? 'active' : ''}" data-race-band="standard">
          <div class="hha-race-band-tag">พร้อมใช้</div>
          <div class="hha-race-band-main">
            <div class="hha-race-band-icon">🏁</div>
            <div>
              Race Standard<br>
              <span style="font-size:13px;color:#c8d7ff">2–4 Players</span>
            </div>
          </div>
          <div class="hha-race-band-desc">
            แข่งห้องเล็ก sync ง่าย เหมาะสำหรับปิดระบบ multiplayer ตัวแรก
          </div>
        </div>

        <div class="hha-race-band-card locked" data-race-band="party">
          <div class="hha-race-band-tag">เตรียมทำต่อ</div>
          <div class="hha-race-band-main">
            <div class="hha-race-band-icon">🎉</div>
            <div>
              Race Party<br>
              <span style="font-size:13px;color:#c8d7ff">5–10 Players</span>
            </div>
          </div>
          <div class="hha-race-band-desc">
            สำหรับห้องใหญ่ ต้องเพิ่ม leaderboard / capacity / reconnect ให้แน่นก่อน
          </div>
        </div>
      </div>
    `;

    if (anchor.classList && anchor.classList.contains('modePill')) {
      anchor.insertAdjacentElement('afterend', panel);
    } else {
      anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    }

    panel.addEventListener('click', function(ev){
      var card = ev.target.closest('[data-race-band]');
      if (!card) return;

      var key = card.getAttribute('data-race-band');
      var band = BANDS[key] || BANDS.standard;

      if (!band.enabled) {
        ev.preventDefault();
        toast('🔒 <b>Race Party 5–10</b> เตรียมทำต่อ หลังจาก Race Standard 2–4 เสถียรก่อน', 'warn');
        saveBand('standard');
        markLobbyBand('standard');
        return;
      }

      saveBand(key);
      markLobbyBand(key);
      toast('✅ เลือก <b>' + esc(band.title) + '</b> แล้ว', 'ok');
    }, true);

    saveBand(active.key);
  }

  function markLobbyBand(key){
    $all('[data-race-band]').forEach(function(card){
      card.classList.toggle('active', card.getAttribute('data-race-band') === key);
    });
  }

  function patchLobbyButtons(){
    if (!isLobby) return;

    ['btnCreate','btnJoin','btnLocal'].forEach(function(id){
      var btn = byId(id);
      if (!btn || btn.__hhaRaceBandBound) return;

      btn.__hhaRaceBandBound = true;

      btn.addEventListener('click', function(ev){
        var chosen = getBand();
        saveBand(chosen.key);

        if (chosen.key !== 'standard') {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

          saveBand('standard');
          markLobbyBand('standard');
          toast('ตอนนี้เปิดจริงเฉพาะ <b>Race Standard 2–4</b> ก่อน', 'warn');
          return false;
        }

        try {
          sessionStorage.setItem('HHA_GROUPS_RACE_MIN_PLAYERS', '2');
          sessionStorage.setItem('HHA_GROUPS_RACE_MAX_PLAYERS', '4');
          sessionStorage.setItem('HHA_GROUPS_RACE_BAND', 'standard');
        } catch(e) {}
      }, true);
    });
  }

  function injectRunPill(){
    if (!isRun) return;
    if ($('.hha-race-capacity-pill[data-run-pill="1"]')) return;

    var band = getBand();
    var pill = document.createElement('div');
    pill.className = 'hha-race-capacity-pill';
    pill.setAttribute('data-run-pill', '1');
    pill.textContent = band.icon + ' ' + band.title;

    var title = $('.cardTitle') || $('.topActions') || $('.brandText');

    if (title) {
      title.appendChild(pill);
    }
  }

  function getPlayerCountFromDom(){
    var list = byId('playersList') || $('.playersWrap');
    if (!list) return 0;

    var cards = $all('.player', list).filter(function(card){
      var t = textOf(card);

      if (!t) return false;
      if (t.indexOf('กำลังโหลดข้อมูลผู้เล่น') >= 0) return false;
      if (t.indexOf('รอข้อมูลจาก Firebase') >= 0) return false;

      return true;
    });

    if (cards.length) return cards.length;

    var raw = textOf(list);
    if (raw.indexOf('รอเพื่อน') >= 0) return 1;

    return 0;
  }

  function updateRunStatus(){
    if (!isRun) return;

    var band = getBand();
    var count = getPlayerCountFromDom();

    var roomState = byId('roomState');
    var status = byId('statusMsg');

    if (count <= 0) {
      if (roomState) roomState.textContent = 'กำลังซิงก์ผู้เล่น • โหมดนี้ต้องมี ' + band.min + '–' + band.max + ' คน';
      return;
    }

    if (count < band.min) {
      if (roomState) roomState.textContent = 'มีผู้เล่น ' + count + ' คน • Race Standard ต้องมีอย่างน้อย ' + band.min + ' คน';
      if (status) {
        status.className = 'status-text warn';
        status.textContent = 'รอเพื่อนเข้าห้องเดียวกัน • ยังเริ่มแข่งไม่ได้';
      }
      return;
    }

    if (count > band.max) {
      if (roomState) roomState.textContent = 'ห้องเกินจำนวนแล้ว (' + count + '/' + band.max + ') • ใช้ Race Standard ได้สูงสุด ' + band.max + ' คน';
      if (status) {
        status.className = 'status-text err';
        status.textContent = 'ห้องนี้เกิน 4 คน • Race Party 5–10 ยังไม่เปิด';
      }
      return;
    }

    if (roomState) roomState.textContent = 'พร้อมแข่งแล้ว • ผู้เล่น ' + count + '/' + band.max + ' คน';
    if (status) {
      status.className = 'status-text ok';
      status.textContent = 'Race Standard พร้อมแล้ว • Host กดเริ่มแข่งได้';
    }
  }

  function patchRunStartButton(){
    if (!isRun) return;

    var btn = byId('btnStartRace');
    if (!btn || btn.__hhaRaceBandStartBound) return;

    btn.__hhaRaceBandStartBound = true;

    btn.addEventListener('click', function(ev){
      var band = getBand();
      var count = getPlayerCountFromDom();

      if (count < band.min) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        toast('⚠️ <b>ยังเริ่มไม่ได้</b> • Race Standard ต้องมีอย่างน้อย ' + band.min + ' คน ตอนนี้มี ' + Math.max(count,1) + ' คน', 'warn');
        updateRunStatus();
        return false;
      }

      if (count > band.max) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();

        toast('⛔ <b>ห้องเกิน 4 คน</b> • Race Party 5–10 ยังไม่เปิด', 'err');
        updateRunStatus();
        return false;
      }

      toast('🚀 เริ่มแข่ง Race Standard ' + count + '/' + band.max + ' คน', 'ok');
      return true;
    }, true);
  }

  function boot(){
    addStyle();
    saveBand(getBandKey());

    injectLobbyBand();
    patchLobbyButtons();

    injectRunPill();
    patchRunStartButton();
    updateRunStatus();

    [120, 360, 800, 1500, 2600].forEach(function(ms){
      setTimeout(function(){
        injectLobbyBand();
        patchLobbyButtons();
        injectRunPill();
        patchRunStartButton();
        updateRunStatus();
      }, ms);
    });

    var mo = new MutationObserver(function(){
      clearTimeout(window.__HHA_RACE_BAND_SCAN__);
      window.__HHA_RACE_BAND_SCAN__ = setTimeout(function(){
        injectLobbyBand();
        patchLobbyButtons();
        injectRunPill();
        patchRunStartButton();
        updateRunStatus();
      }, 80);
    });

    if (document.body) {
      mo.observe(document.body, {
        childList:true,
        subtree:true,
        characterData:true,
        attributes:true,
        attributeFilter:['class','style']
      });
    }

    setInterval(updateRunStatus, 900);

    console.info('[Groups Race Player Band]', PATCH_ID, {
      isLobby: isLobby,
      isRun: isRun,
      band: getBand()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
