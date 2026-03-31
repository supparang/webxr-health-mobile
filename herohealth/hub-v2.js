(function(){
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const qs = new URLSearchParams(location.search);
  const toastEl = $('#toast');

  const HUB_KEY = 'HHA_HUB_V2_BRAND';
  const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
  const GAME_KEYS = ['HHA_LAST_GAME','HH_LAST_GAME','herohealth_last_game'];

  const GAME_MAP = {
    goodjunk: { title:'GoodJunk Hero', zone:'nutrition', icon:'🍔', sub:'เลือกอาหารดี หลีกเลี่ยงอาหารขยะ', href:'./goodjunk-vr.html' },
    plate: { title:'Balanced Plate', zone:'nutrition', icon:'🍽️', sub:'จัดจานอาหารให้ครบ 5 หมู่', href:'./plate-vr.html' },
    groups: { title:'Food Groups Quest', zone:'nutrition', icon:'🥦', sub:'เรียนรู้หมวดอาหารหลัก 5 หมู่', href:'./groups-vr.html' },
    hydration: { title:'Hydration Quest', zone:'nutrition', icon:'💧', sub:'ดื่มน้ำให้เหมาะสมในแต่ละวัน', href:'./hydration-v2.html' },
    brush: { title:'Brush Hero', zone:'hygiene', icon:'🪥', sub:'แปรงฟันให้ถูกวิธีและทั่วถึง', href:'./brush-vr.html' },
    bath: { title:'Bath Time Hero', zone:'hygiene', icon:'🛁', sub:'อาบน้ำและเตรียมของใช้ให้ถูกต้อง', href:'./bath-vr.html' },
    germ: { title:'Germ Detective', zone:'hygiene', icon:'🦠', sub:'สังเกตเชื้อโรคและจัดการให้ปลอดภัย', href:'./germ-detective.html' },
    shadow: { title:'Shadow Breaker', zone:'fitness', icon:'🥊', sub:'ขยับหลบและตีเงาอย่างสนุก', href:'./fitness/shadow-breaker.html' },
    rhythm: { title:'Rhythm Boxer', zone:'fitness', icon:'🎵', sub:'ออกหมัดตามจังหวะเพลง', href:'./fitness/rhythm-boxer.html' },
    jumpduck: { title:'Jump Duck', zone:'fitness', icon:'🦆', sub:'กระโดดและย่อตัวให้ทันอุปสรรค', href:'./fitness/jump-duck.html' }
  };

  const ZONES = {
    hygiene: {
      title:'Hygiene Zone',
      icon:'🫧',
      featured:'Germ Detective',
      playBtn:'#btnPlayHygiene',
      preview:'#hygPreview',
      recentText:'#hygRecentText',
      recentPill:'#hygRecentPill',
      list:[GAME_MAP.brush, GAME_MAP.bath, GAME_MAP.germ]
    },
    nutrition: {
      title:'Nutrition Zone',
      icon:'🥗',
      featured:'GoodJunk Hero',
      playBtn:'#btnPlayNutrition',
      preview:'#nutriPreview',
      recentText:'#nutriRecentText',
      recentPill:'#nutriRecentPill',
      list:[GAME_MAP.goodjunk, GAME_MAP.plate, GAME_MAP.groups, GAME_MAP.hydration]
    },
    fitness: {
      title:'Fitness Zone',
      icon:'🏃',
      featured:'Jump Duck',
      playBtn:'#btnPlayFitness',
      preview:'#fitPreview',
      recentText:'#fitRecentText',
      recentPill:'#fitRecentPill',
      list:[GAME_MAP.jumpduck, GAME_MAP.shadow, GAME_MAP.rhythm]
    }
  };

  const DEFAULT_MISSIONS = [
    { icon:'🫧', title:'เล่นโซน Hygiene 1 เกม', done:false },
    { icon:'🥗', title:'เล่นโซน Nutrition 1 เกม', done:false },
    { icon:'🏃', title:'เล่นโซน Fitness 1 เกม', done:false },
    { icon:'⭐', title:'เก็บดาวรวม 3 ดวง', done:false }
  ];

  function safeJsonParse(s, fallback=null){
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function showToast(msg){
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function getLastSummary(){
    return safeJsonParse(localStorage.getItem(LAST_SUMMARY_KEY), null);
  }

  function getRecentGameId(){
    const fromQs = (qs.get('game') || '').trim().toLowerCase();
    if (fromQs && GAME_MAP[fromQs]) return fromQs;

    for (const key of GAME_KEYS){
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      if (GAME_MAP[String(raw).trim().toLowerCase()]) return String(raw).trim().toLowerCase();
      const obj = safeJsonParse(raw, null);
      const id = obj && (obj.game || obj.gameId || obj.id || '').toLowerCase();
      if (GAME_MAP[id]) return id;
    }

    const summary = getLastSummary();
    const id = (summary && (summary.game || summary.gameId || summary.id || '')).toLowerCase();
    return GAME_MAP[id] ? id : 'goodjunk';
  }

  function getState(){
    const saved = safeJsonParse(localStorage.getItem(HUB_KEY), {});
    const recentId = getRecentGameId();
    const recent = GAME_MAP[recentId] || GAME_MAP.goodjunk;
    return {
      playerName: qs.get('name') || qs.get('nick') || saved.playerName || 'Rocky',
      playerLevel: Number(saved.playerLevel || 5),
      playerCoins: Number(saved.playerCoins || 380),
      playerHearts: Number(saved.playerHearts || 8),
      badgeStars: Number(saved.badgeStars || 12),
      badgeWins: Number(saved.badgeWins || 4),
      badgeStreak: Number(saved.badgeStreak || 3),
      recent,
      recentId,
      todayPlayedCount: Number(saved.todayPlayedCount || 1),
      todayZoneCount: Number(saved.todayZoneCount || 1)
    };
  }

  function persistState(state){
    localStorage.setItem(HUB_KEY, JSON.stringify(state));
  }

  function routeWithPassthrough(baseHref){
    try {
      const u = new URL(baseHref, location.href);
      const passthroughKeys = ['pid','name','nick','run','diff','time','seed','studyId','view','hub'];
      passthroughKeys.forEach(k => {
        const v = qs.get(k);
        if (v && !u.searchParams.has(k)) u.searchParams.set(k, v);
      });
      if (!u.searchParams.has('hub')) u.searchParams.set('hub', new URL('./hub-v2.html', location.href).href);
      return u.toString();
    } catch {
      return baseHref;
    }
  }

  function renderZonePreviews(){
    Object.values(ZONES).forEach(zone => {
      const mount = $(zone.preview);
      if (!mount) return;
      mount.innerHTML = zone.list.slice(0,3).map(game => `
        <div class="game-tile">
          <div class="game-tile__icon">${game.icon}</div>
          <div class="game-tile__meta">
            <p class="game-tile__title">${game.title}</p>
            <p class="game-tile__sub">${game.sub}</p>
          </div>
        </div>
      `).join('');

      const playBtn = $(zone.playBtn);
      if (playBtn && zone.list[0]) playBtn.href = routeWithPassthrough(zone.list[0].href);
    });
  }

  function renderLibrary(){
    const box = $('#libraryBox');
    if (!box) return;
    const all = Object.values(GAME_MAP);
    box.innerHTML = all.map(game => `
      <a class="game-tile" href="${routeWithPassthrough(game.href)}" data-game="${game.title}">
        <div class="game-tile__icon">${game.icon}</div>
        <div class="game-tile__meta">
          <p class="game-tile__title">${game.title}</p>
          <p class="game-tile__sub">${game.sub}</p>
        </div>
      </a>
    `).join('');
  }

  function renderPicker(mode='all'){
    const list = $('#pickerList');
    const sub = $('#pickerSub');
    if (!list) return;

    const state = getState();
    let items = Object.values(GAME_MAP);
    if (mode === 'recommended') {
      items = [state.recent, ...Object.values(GAME_MAP).filter(g => g.title !== state.recent.title)].slice(0,6);
      if (sub) sub.textContent = 'เกมแนะนำจากระบบและเกมใกล้เคียง';
    } else if (mode === 'recent') {
      items = [state.recent];
      if (sub) sub.textContent = 'เกมล่าสุดที่คุณเพิ่งเล่น';
    } else {
      if (sub) sub.textContent = 'เลือกเกมที่อยากเล่นได้เลย';
    }

    list.innerHTML = items.map(game => `
      <a class="picker-card" href="${routeWithPassthrough(game.href)}">
        <div class="picker-card__icon">${game.icon}</div>
        <div class="picker-card__meta">
          <p class="picker-card__title">${game.title}</p>
          <p class="picker-card__sub">${game.sub}</p>
        </div>
      </a>
    `).join('');
  }

  function openPicker(mode){
    const modal = $('#gamePicker');
    if (!modal) return;
    renderPicker(mode);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closePicker(){
    const modal = $('#gamePicker');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function renderMissions(){
    const list = $('#missionList');
    if (!list) return;
    list.innerHTML = DEFAULT_MISSIONS.map(m => `
      <div class="mission-item">${m.icon} ${m.title}</div>
    `).join('');

    const chainH = $('#chainHygiene');
    const chainN = $('#chainNutrition');
    const chainF = $('#chainFitness');
    if (chainH) chainH.innerHTML = '<div class="mission-item">🪥 Brush Hero</div><div class="mission-item">🛁 Bath Time Hero</div><div class="mission-item">🦠 Germ Detective</div>';
    if (chainN) chainN.innerHTML = '<div class="mission-item">🍔 GoodJunk Hero</div><div class="mission-item">🍽️ Balanced Plate</div><div class="mission-item">💧 Hydration Quest</div>';
    if (chainF) chainF.innerHTML = '<div class="mission-item">🦆 Jump Duck</div><div class="mission-item">🥊 Shadow Breaker</div><div class="mission-item">🎵 Rhythm Boxer</div>';
  }

  function renderStickers(){
    const shelf = $('#stickerShelf');
    if (!shelf) return;
    shelf.innerHTML = ['⭐','🫧','🍎','⚡','🏆','🎯'].map(x => `<div class="sticker">${x}</div>`).join('');
  }

  function renderSummary(){
    const box = $('#summaryBox');
    if (!box) return;
    const summary = getLastSummary();
    const state = getState();
    if (summary) {
      box.innerHTML = `
        <div class="summary-item">
          <strong>ล่าสุด:</strong> ${summary.game || state.recent.title}<br>
          <strong>คะแนน:</strong> ${summary.score ?? '-'}<br>
          <strong>เวลา:</strong> ${summary.time ?? summary.timeSec ?? '-'}
        </div>
      `;
    } else {
      box.innerHTML = `<div class="summary-item"><strong>ล่าสุด:</strong> ${state.recent.title}<br><strong>สถานะ:</strong> พร้อมเริ่มเกมใหม่</div>`;
    }
  }

  function renderPlayer(){
    const state = getState();
    $('#playerName') && ($('#playerName').textContent = state.playerName);
    $('#playerLevel') && ($('#playerLevel').textContent = state.playerLevel);
    $('#playerCoins') && ($('#playerCoins').textContent = state.playerCoins);
    $('#playerHearts') && ($('#playerHearts').textContent = state.playerHearts);
    $('#badgeStars') && ($('#badgeStars').textContent = state.badgeStars);
    $('#badgeWins') && ($('#badgeWins').textContent = state.badgeWins);
    $('#badgeStreak') && ($('#badgeStreak').textContent = state.badgeStreak);

    $('#todayPlayedCount') && ($('#todayPlayedCount').textContent = state.todayPlayedCount);
    $('#todayZoneCount') && ($('#todayZoneCount').textContent = state.todayZoneCount);
    $('#todayLastGame') && ($('#todayLastGame').textContent = state.recent.title);
    $('#todayNextGame') && ($('#todayNextGame').textContent = state.recent.zone === 'nutrition' ? 'Brush Hero' : 'GoodJunk Hero');
    $('#playerMeta') && ($('#playerMeta').textContent = `ฮีโร่ประจำวัน • ล่าสุดเล่น ${state.recent.title}`);

    const zoneId = state.recent.zone;
    const zone = ZONES[zoneId];
    if (zone) {
      const recentText = $(zone.recentText);
      const recentPill = $(zone.recentPill);
      if (recentText) recentText.textContent = state.recent.title;
      if (recentPill) recentPill.hidden = false;
    }

    persistState(state);
  }

  function bindActions(){
    $('#btnQuickRecommended')?.addEventListener('click', () => openPicker('recommended'));
    $('#btnQuickRecent')?.addEventListener('click', () => openPicker('recent'));
    $('#btnQuickAllGames')?.addEventListener('click', () => openPicker('all'));
    $('#pickerShowRecommended')?.addEventListener('click', () => renderPicker('recommended'));
    $('#pickerShowAllModes')?.addEventListener('click', () => renderPicker('all'));
    $('#pickerShowRecent')?.addEventListener('click', () => renderPicker('recent'));

    $('[data-close-picker]')?.addEventListener('click', closePicker);
    $$('.modal-close,[data-close-picker]').forEach(el => el.addEventListener('click', closePicker));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });

    $('#btnResumeNow')?.addEventListener('click', () => {
      const state = getState();
      location.href = routeWithPassthrough(state.recent.href);
    });

    $('#btnNextInZone')?.addEventListener('click', () => {
      const state = getState();
      const zoneList = ZONES[state.recent.zone]?.list || [];
      const idx = zoneList.findIndex(g => g.title === state.recent.title);
      const next = zoneList[(idx + 1 + zoneList.length) % zoneList.length] || GAME_MAP.goodjunk;
      location.href = routeWithPassthrough(next.href);
    });

    $('#btnZoneHygiene')?.addEventListener('click', () => openPicker('all'));
    $('#btnZoneNutrition')?.addEventListener('click', () => openPicker('all'));
    $('#btnZoneFitness')?.addEventListener('click', () => openPicker('all'));

    $('#btnResetTodayMissions')?.addEventListener('click', () => showToast('รีเซ็ตภารกิจวันนี้แล้ว'));
    $('#btnSettings')?.addEventListener('click', () => showToast('หน้า Settings ยังเชื่อมต่อได้ภายหลัง'));
    $('#btnRewards')?.addEventListener('click', () => showToast('กำลังเปิดหน้า Rewards'));

    $('#btnDiagnostics')?.addEventListener('click', () => {
      const panel = $('#diagnosticsPanel');
      if (!panel) return;
      panel.hidden = !panel.hidden;
    });
    $('#btnCloseDiagnostics')?.addEventListener('click', () => {
      const panel = $('#diagnosticsPanel');
      if (panel) panel.hidden = true;
    });
    $('#btnCopyDebugSnapshot')?.addEventListener('click', async () => {
      const payload = buildSnapshot();
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        showToast('คัดลอก snapshot แล้ว');
      } catch {
        showToast('คัดลอกไม่สำเร็จ');
      }
    });
  }

  function buildSnapshot(){
    return {
      location: location.href,
      params: Object.fromEntries(qs.entries()),
      state: getState(),
      lastSummary: getLastSummary(),
      routes: Object.fromEntries(Object.entries(GAME_MAP).map(([k,v]) => [k, routeWithPassthrough(v.href)]))
    };
  }

  function renderDiagnostics(){
    const snap = buildSnapshot();
    $('#diagContext') && ($('#diagContext').textContent = JSON.stringify(snap.params, null, 2));
    $('#diagWarmup') && ($('#diagWarmup').textContent = JSON.stringify({ run: qs.get('run') || 'play', hub: qs.get('hub') || './hub-v2.html' }, null, 2));
    $('#diagLastSummary') && ($('#diagLastSummary').textContent = JSON.stringify(snap.lastSummary || {}, null, 2));
    $('#diagRecentByZone') && ($('#diagRecentByZone').textContent = JSON.stringify({ recent: snap.state.recent.title, zone: snap.state.recent.zone }, null, 2));
    $('#diagResolvedRoutes') && ($('#diagResolvedRoutes').textContent = JSON.stringify(snap.routes, null, 2));
    const quick = $('#diagQuickLinks');
    if (quick) {
      quick.innerHTML = Object.entries(snap.routes).slice(0,6).map(([k,href]) => `<a class="btn secondary small" href="${href}">${GAME_MAP[k].title}</a>`).join('');
    }
  }

  function init(){
    renderPlayer();
    renderZonePreviews();
    renderLibrary();
    renderMissions();
    renderStickers();
    renderSummary();
    renderDiagnostics();
    bindActions();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
