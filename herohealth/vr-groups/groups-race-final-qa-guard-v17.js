/* =========================================================
   HeroHealth • Groups Race Final QA Guard v17
   File: /herohealth/vr-groups/groups-race-final-qa-guard-v17.js
   Purpose:
   - Final polish ก่อนทดสอบ 2 เครื่องจริง
   - Fix replay / back lobby / back mode
   - Save latest summary
   - Ensure Dev Bot never blocks gameplay
   - Add ranking fallback if needed
   ========================================================= */

(function(){
  'use strict';

  const PATCH = 'v20260609-GROUPS-RACE-FINAL-QA-GUARD-V17';

  if (window.__HHA_GROUPS_RACE_FINAL_QA_GUARD_V17__) return;
  window.__HHA_GROUPS_RACE_FINAL_QA_GUARD_V17__ = true;

  const qs = new URLSearchParams(location.search || '');

  const DEV_MODE =
    qs.get('mock') === '1' ||
    qs.get('dev') === '1' ||
    qs.get('bot') === '1' ||
    qs.get('testBot') === '1' ||
    localStorage.getItem('HHA_GROUPS_RACE_DEV_BOT') === '1';

  const QA_MODE =
    qs.get('qa') === '1' ||
    qs.get('debug') === '1';

  function $(id){
    return document.getElementById(id);
  }

  function text(v){
    return String(v == null ? '' : v).trim();
  }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){
      return ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      })[c];
    });
  }

  function numFromEl(id){
    const el = $(id);
    if (!el) return 0;
    const n = Number(String(el.textContent || '').replace(/[^\d.]/g,''));
    return Number.isFinite(n) ? n : 0;
  }

  function getRoom(){
    return text(
      qs.get('room') ||
      qs.get('roomId') ||
      qs.get('code') ||
      window.__HHA_GROUPS_RACE_ROOM_CODE__ ||
      sessionStorage.getItem('HHA_GROUPS_RACE_ROOM') ||
      localStorage.getItem('HHA_GROUPS_RACE_ROOM_CODE') ||
      ''
    ).toUpperCase();
  }

  function getName(){
    return text(
      qs.get('name') ||
      qs.get('playerName') ||
      sessionStorage.getItem('HHA_GROUPS_RACE_NAME') ||
      localStorage.getItem('HHA_GROUPS_RACE_PLAYER_NAME') ||
      localStorage.getItem('HHA_PLAYER_NAME') ||
      'Hero'
    ) || 'Hero';
  }

  function getView(){
    return text(qs.get('view') || 'mobile') || 'mobile';
  }

  function getDiff(){
    return text(qs.get('diff') || 'normal') || 'normal';
  }

  function getTime(){
    return text(qs.get('time') || qs.get('timeSec') || '45') || '45';
  }

  function repoBase(){
    const path = location.pathname || '';
    const marker = '/herohealth/';
    const idx = path.indexOf(marker);
    if (idx >= 0) return location.origin + path.slice(0, idx);
    return location.origin + '/webxr-health-mobile';
  }

  function heroUrl(path, extra){
    const out = new URL(repoBase() + '/herohealth/' + path.replace(/^\/+/, ''));

    const room = getRoom();

    if (room) {
      out.searchParams.set('room', room);
      out.searchParams.set('roomId', room);
      out.searchParams.set('code', room);
    }

    out.searchParams.set('name', getName());
    out.searchParams.set('view', getView());
    out.searchParams.set('diff', getDiff());
    out.searchParams.set('time', getTime());
    out.searchParams.set('timeSec', getTime());

    Object.keys(extra || {}).forEach(function(k){
      if (extra[k] === null) out.searchParams.delete(k);
      else out.searchParams.set(k, String(extra[k]));
    });

    return out.toString();
  }

  function currentRunUrl(extra){
    const out = new URL(location.href);

    const room = getRoom();
    if (room) {
      out.searchParams.set('room', room);
      out.searchParams.set('roomId', room);
      out.searchParams.set('code', room);
    }

    out.searchParams.set('name', getName());
    out.searchParams.set('view', getView());
    out.searchParams.set('diff', getDiff());
    out.searchParams.set('time', getTime());
    out.searchParams.set('timeSec', getTime());

    Object.keys(extra || {}).forEach(function(k){
      if (extra[k] === null) out.searchParams.delete(k);
      else out.searchParams.set(k, String(extra[k]));
    });

    out.searchParams.set('replay', String(Date.now()));

    return out.toString();
  }

  function saveLatestSummary(){
    const summary = $('hhaRaceSummary');
    if (!summary) return;

    const visible = getComputedStyle(summary).display !== 'none';
    if (!visible) return;

    const summaryText = text(($('hhaRaceSummaryText') || {}).textContent || '');
    const accMatch = summaryText.match(/(\d+)\s*%/);

    const result = {
      game:'groups-race',
      mode:'race',
      room:getRoom(),
      name:getName(),
      view:getView(),
      diff:getDiff(),
      time:getTime(),
      score:numFromEl('hhaRaceScore'),
      correct:numFromEl('hhaRaceCorrect'),
      combo:numFromEl('hhaRaceCombo'),
      accuracy:accMatch ? Number(accMatch[1]) || 0 : 0,
      summaryText:summaryText,
      savedAt:Date.now(),
      patch:PATCH
    };

    try {
      localStorage.setItem('HHA_GROUPS_RACE_LAST_SUMMARY', JSON.stringify(result));
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(result));
    } catch(_) {}
  }

  function ensureRankingFallback(){
    const summary = $('hhaRaceSummary');
    const rank = $('hhaRaceRankList');
    if (!summary || !rank) return;

    const visible = getComputedStyle(summary).display !== 'none';
    if (!visible) return;

    const raw = text(rank.textContent || '');
    if (raw && !raw.includes('กำลังรอ') && !raw.includes('รอผล')) return;

    const score = numFromEl('hhaRaceScore');
    const correct = numFromEl('hhaRaceCorrect');
    const combo = numFromEl('hhaRaceCombo');

    const summaryText = text(($('hhaRaceSummaryText') || {}).textContent || '');
    const accMatch = summaryText.match(/(\d+)\s*%/);
    const acc = accMatch ? Number(accMatch[1]) || 0 : 0;

    const botScore = DEV_MODE ? Math.max(450, Math.round(score * 0.72)) : 0;
    const botAcc = DEV_MODE ? Math.max(60, Math.min(92, acc - 4 || 78)) : 0;

    let html =
      '<div class="hha-race-rank-row">' +
        '<span>🥇 1. ' + esc(getName()) + '</span>' +
        '<span>' + score + ' pts · ' + acc + '%</span>' +
      '</div>';

    if (DEV_MODE) {
      html +=
        '<div class="hha-race-rank-row">' +
          '<span>🥈 2. RaceBot</span>' +
          '<span>' + botScore + ' pts · ' + botAcc + '%</span>' +
        '</div>';
    }

    html +=
      '<div class="hha-race-rank-row">' +
        '<span>✅ สรุปผล</span>' +
        '<span>ถูก ' + correct + ' · Combo ' + combo + '</span>' +
      '</div>';

    rank.innerHTML = html;
  }

  function hideDevBotDuringPlay(){
    const play = $('hhaRacePlayV15');
    const panel = $('hhaDevBotPanel');

    if (!play || !panel) return;

    document.body.classList.add('hha-race-playing');
    panel.style.display = 'none';
    panel.style.pointerEvents = 'none';
  }

  function bindSummaryButtons(){
    const again = $('hhaRaceAgain');
    const lobby = $('hhaRaceBackLobby');
    const mode = $('hhaRaceBackMode');

    if (again && !again.__v17Bound) {
      again.__v17Bound = true;
      again.onclick = function(ev){
        ev.preventDefault();

        const ok = confirm('เล่น Race ห้องเดิมอีกครั้งหรือไม่?');
        if (!ok) return;

        try {
          sessionStorage.removeItem('HHA_GROUPS_RACE_STARTED');
          sessionStorage.removeItem('HHA_GROUPS_RACE_FINISHED');
        } catch(_) {}

        location.href = currentRunUrl({
          mock: DEV_MODE ? '1' : null,
          qa: QA_MODE ? '1' : null,
          from:'summary-replay-v17'
        });
      };
    }

    if (lobby && !lobby.__v17Bound) {
      lobby.__v17Bound = true;
      lobby.onclick = function(ev){
        ev.preventDefault();

        location.href = heroUrl('vr-groups/groups-race-lobby.html', {
          from:'race-run-v17-summary'
        });
      };
    }

    if (mode && !mode.__v17Bound) {
      mode.__v17Bound = true;
      mode.onclick = function(ev){
        ev.preventDefault();

        location.href = heroUrl('groups-vr.html', {
          from:'race-run-v17-summary'
        });
      };
    }
  }

  function injectStyle(){
    if ($('hhaRaceFinalQaGuardV17Style')) return;

    const style = document.createElement('style');
    style.id = 'hhaRaceFinalQaGuardV17Style';
    style.textContent = `
      body.hha-race-playing #hhaDevBotPanel{
        display:none !important;
        pointer-events:none !important;
      }

      .hha-qa-v17{
        position:fixed;
        left:10px;
        bottom:calc(10px + env(safe-area-inset-bottom,0px));
        z-index:1000000;
        max-width:min(460px,calc(100vw - 20px));
        padding:8px 10px;
        border-radius:14px;
        color:#dbeafe;
        background:rgba(2,6,23,.78);
        border:1px solid rgba(255,255,255,.16);
        font:800 11px/1.35 ui-monospace,Menlo,Consolas,monospace;
        white-space:pre-wrap;
        display:none;
      }

      body.hha-race-qa-v17 .hha-qa-v17{
        display:block;
      }

      @media (max-width:768px){
        .hha-qa-v17{
          font-size:10px;
          max-height:90px;
          overflow:auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function qa(msg){
    if (!QA_MODE) return;

    document.body.classList.add('hha-race-qa-v17');

    let el = $('hhaQaV17');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hhaQaV17';
      el.className = 'hha-qa-v17';
      document.body.appendChild(el);
    }

    const line = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    el.textContent = (el.textContent + '\n' + line).trim().slice(-1800);
  }

  function watch(){
    setInterval(function(){
      const play = $('hhaRacePlayV15');
      if (play) {
        hideDevBotDuringPlay();
      }

      const summary = $('hhaRaceSummary');
      if (summary && getComputedStyle(summary).display !== 'none') {
        saveLatestSummary();
        ensureRankingFallback();
        bindSummaryButtons();
        qa('summary ready • saved latest summary');
      }
    }, 500);
  }

  function boot(){
    injectStyle();
    bindSummaryButtons();
    watch();

    console.info('[GroupsRaceFinalQAGuardV17]', {
      patch:PATCH,
      room:getRoom(),
      name:getName(),
      devMode:DEV_MODE,
      qaMode:QA_MODE
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  } else {
    boot();
  }
})();
