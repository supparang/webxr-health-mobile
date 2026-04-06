'use strict';

/* =========================================================
 * /herohealth/vr-goodjunk/goodjunk-race.js
 * GoodJunk Race Controller / Compatibility Layer
 * FULL PATCH v20260406-race-controller-runtime-full-p2
 * - stronger controller-final upgrade
 * - better visible summary replacement
 * - safer me/opponent normalization
 * ========================================================= */
(function(){
  const W = window;
  const D = document;

  if (W.__GJ_RACE_CONTROLLER_LOADED__) return;
  W.__GJ_RACE_CONTROLLER_LOADED__ = true;

  const qs = (k, d='') => {
    try { return new URL(location.href).searchParams.get(k) ?? d; }
    catch { return d; }
  };

  const num = (v, d=0) => {
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, num(v, a)));
  const now = () => Date.now();

  function clean(v, max=120){
    return String(v == null ? '' : v).trim().slice(0, max);
  }

  function cleanPid(v){
    return String(v == null ? '' : v).replace(/[.#$[\]/]/g, '-').trim().slice(0, 80);
  }

  function cleanRoom(v){
    return String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  }

  function escapeHtml(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function emit(name, detail){
    try { W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }
    catch {}
  }

  const CTX = {
    game: 'goodjunk',
    zone: 'nutrition',
    mode: 'race',
    roomId: cleanRoom(qs('roomId', qs('room', ''))),
    roomKind: clean(qs('roomKind', ''), 40),
    pid: cleanPid(qs('pid', 'anon')),
    uid: cleanPid(qs('uid', '')),
    name: clean(qs('name', qs('nick', 'Player')), 80),
    role: clean(qs('role', 'player'), 24),
    diff: clean(qs('diff', 'normal'), 24).toLowerCase(),
    time: clamp(qs('time', '90'), 30, 300),
    seed: clean(qs('seed', String(now())), 80),
    roundId: clean(qs('roundId', ''), 80),
    hub: clean(qs('hub', '../hub.html'), 500),
    view: clean(qs('view', 'mobile'), 24),
    host: clean(qs('host', '0'), 8)
  };

  const STORE_LAST = 'HHA_LAST_SUMMARY';
  const STORE_LAST_RACE = 'HHA_LAST_SUMMARY_RACE';
  const STORE_LAST_RACE_ROOM = CTX.roomId ? `HHA_LAST_SUMMARY_RACE_${CTX.roomId}` : '';
  const STORE_LIVE = 'HHA_RACE_LIVE_SNAPSHOT';
  const STORE_LIVE_ROOM = CTX.roomId ? `HHA_RACE_LIVE_SNAPSHOT_${CTX.roomId}` : '';

  const S = {
    runtime: null,
    core: null,
    lastLive: null,
    lastSummary: null,
    lastControllerSummary: null,
    controllerSummarySent: false,
    controllerSummaryVersion: 0,
    resultWatchBound: false,
    roomPollTimer: 0,
    liveWatchTimer: 0,
    visiblePatchTimer: 0,
    readyAt: now(),
    lastVisibleSummaryHash: '',
    mountSeenVisible: false
  };

  function runtimeCtx(){
    return {
      roomId: CTX.roomId || '',
      roomKind: CTX.roomKind || '',
      pid: CTX.pid || '',
      uid: CTX.uid || '',
      name: CTX.name || '',
      role: CTX.role || '',
      diff: CTX.diff || '',
      time: Number(CTX.time || 0),
      seed: String(CTX.seed || ''),
      view: CTX.view || '',
      host: String(CTX.host || '0')
    };
  }

  function saveJson(key, value){
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function loadJson(key, fallback=null){
    if (!key) return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getCore(){
    if (W.__GJ_RACE_CORE__ && typeof W.__GJ_RACE_CORE__ === 'object') {
      return W.__GJ_RACE_CORE__;
    }
    return null;
  }

  function currentResultMount(){
    return D.getElementById('raceResultMount');
  }

  function normalizeStandingRow(r, i){
    return {
      pid: cleanPid(r && (r.pid || r.playerId) || ''),
      nick: clean(r && (r.nick || r.name || r.pid) || `player-${i+1}`, 80),
      rank: num(r && r.rank, i + 1),
      score: num(r && r.score, 0),
      contribution: num(r && (r.contribution != null ? r.contribution : r.score), 0),
      miss: num(r && r.miss, 0),
      goodHit: num(r && r.goodHit, 0),
      junkHit: num(r && r.junkHit, 0),
      bestStreak: num(r && r.bestStreak, 0),
      duration: num(r && r.duration, CTX.time)
    };
  }

  function scoreSort(a, b){
    if (num(b.score, 0) !== num(a.score, 0)) return num(b.score, 0) - num(a.score, 0);
    if (num(a.miss, 0) !== num(b.miss, 0)) return num(a.miss, 0) - num(b.miss, 0);
    if (num(b.bestStreak, 0) !== num(a.bestStreak, 0)) return num(b.bestStreak, 0) - num(a.bestStreak, 0);
    return String(a.pid || '').localeCompare(String(b.pid || ''));
  }

  function normalizeStandings(list){
    const rows = Array.isArray(list) ? list.map((r, i) => normalizeStandingRow(r, i)) : [];
    rows.sort(scoreSort);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  function findMe(standings){
    return standings.find((r) => String(r.pid || '') === String(CTX.pid || '')) || null;
  }

  function findOpponent(standings){
    return standings.find((r) => String(r.pid || '') !== String(CTX.pid || '')) || null;
  }

  function buildSummaryHash(summary){
    const s = summary || {};
    const me = (s.compare && s.compare.me) || null;
    const opp = (s.compare && s.compare.opponent) || null;
    return [
      String(s.roomId || ''),
      String(s.controllerFinal ? '1' : '0'),
      String(s.rank || ''),
      String(s.score || ''),
      String(me && me.score || ''),
      String(opp && opp.score || ''),
      String((s.standings && s.standings.length) || 0),
      String(s.reason || '')
    ].join('|');
  }

  function normalizeSummary(detail){
    const src = (detail && typeof detail === 'object' && detail.summary && typeof detail.summary === 'object')
      ? detail.summary
      : (detail || {});

    const standings = normalizeStandings(src.standings || []);
    const me = findMe(standings);
    const opponent = findOpponent(standings);

    const score = num(src.score != null ? src.score : (me ? me.score : 0), 0);
    const contribution = num(src.contribution != null ? src.contribution : (me ? me.contribution : score), 0);
    const delta = num(
      (src.compare && src.compare.delta) != null
        ? src.compare.delta
        : (me && opponent ? (num(me.score,0) - num(opponent.score,0)) : 0),
      0
    );

    return {
      controllerFinal: !!src.controllerFinal,
      game: src.game || 'goodjunk',
      zone: src.zone || 'nutrition',
      mode: src.mode || 'race',
      roomId: cleanRoom(src.roomId || CTX.roomId || ''),
      roomKind: clean(src.roomKind || CTX.roomKind || '', 40),
      pid: cleanPid(src.pid || CTX.pid || ''),
      uid: cleanPid(src.uid || CTX.uid || ''),
      name: clean(src.name || CTX.name || 'Player', 80),
      role: clean(src.role || CTX.role || 'player', 24),
      rank: num(src.rank || (me && me.rank) || 0, 0),
      score,
      contribution,
      players: Math.max(1, num(src.players || standings.length || 1, 1)),
      miss: num(src.miss || (me && me.miss) || 0, 0),
      goodHit: num(src.goodHit || (me && me.goodHit) || 0, 0),
      junkHit: num(src.junkHit || (me && me.junkHit) || 0, 0),
      bestStreak: num(src.bestStreak || (me && me.bestStreak) || 0, 0),
      duration: num(src.duration || (me && me.duration) || CTX.time, CTX.time),
      result: clean(src.result || '', 80) || (delta > 0 ? 'win' : delta < 0 ? 'lose' : 'draw'),
      reason: clean(src.reason || '', 80) || 'finished',
      standings,
      compare: {
        me,
        opponent,
        delta
      },
      raw: src.raw && typeof src.raw === 'object' ? src.raw : {}
    };
  }

  function persistSummary(summary){
    const normalized = normalizeSummary(summary);
    S.lastSummary = normalized;
    saveJson(STORE_LAST, normalized);
    saveJson(STORE_LAST_RACE, normalized);
    if (STORE_LAST_RACE_ROOM) saveJson(STORE_LAST_RACE_ROOM, normalized);
    W.__GJ_RACE_LAST_SUMMARY__ = normalized;
    return normalized;
  }

  function maybeCreateRuntime(){
    if (S.runtime) return S.runtime;
    if (!(W.HHARuntimeContract && typeof W.HHARuntimeContract.create === 'function')) return null;

    S.runtime = W.HHARuntimeContract.create({
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'race',
      getCtx: runtimeCtx
    });

    return S.runtime;
  }

  async function flushRuntime(){
    const rt = maybeCreateRuntime();
    if (!rt) return;
    try { await rt.flush(); } catch (_) {}
  }

  function shouldUpgradeToControllerFinal(candidate){
    const normalized = normalizeSummary(candidate);
    const neededCount = Math.max(2, readCoreParticipants().length || normalized.players || 1);
    const standingsCount = (normalized.standings && normalized.standings.length) || 0;
    return standingsCount >= neededCount;
  }

  async function maybeSendControllerSummary(summary){
    const normalized = persistSummary(summary);

    if (normalized.controllerFinal) {
      S.lastControllerSummary = normalized;
      return normalized;
    }

    if (S.controllerSummarySent) {
      return S.lastControllerSummary || normalized;
    }

    S.controllerSummarySent = true;
    S.controllerSummaryVersion += 1;
    S.lastControllerSummary = Object.assign({}, normalized, { controllerFinal: true });

    emit('gj:controller-summary', S.lastControllerSummary);
    emit('hha:controller-summary', S.lastControllerSummary);
    emit('gj:summary', S.lastControllerSummary);
    emit('hha:summary', S.lastControllerSummary);
    emit('hha:session-summary', S.lastControllerSummary);

    const rt = maybeCreateRuntime();
    if (rt && typeof rt.summary === 'function') {
      try { await rt.summary(S.lastControllerSummary); } catch (_) {}
    }

    forceVisibleSummaryRefresh(S.lastControllerSummary);

    return S.lastControllerSummary;
  }

  function readCoreRoomResults(){
    const core = getCore();
    if (!core || !core.state || !core.state.room || !core.state.room.results) return {};
    return core.state.room.results || {};
  }

  function readCoreParticipants(){
    const core = getCore();
    if (!core || !core.state || !core.state.room) return [];
    const room = core.state.room || {};
    const ids =
      Array.isArray(room.state && room.state.participantIds) ? room.state.participantIds :
      Array.isArray(room.match && room.match.participantIds) ? room.match.participantIds :
      [];
    return ids.filter(Boolean);
  }

  function computeControllerSummaryFromResults(){
    const resultsObj = readCoreRoomResults();
    const rows = Object.keys(resultsObj || {}).map((pid, i) => normalizeStandingRow(
      Object.assign({}, resultsObj[pid] || {}, { pid }),
      i
    ));

    const standings = normalizeStandings(rows);
    if (!standings.length) return null;

    const me = findMe(standings) || standings[0];
    const opponent = findOpponent(standings) || null;
    const participantIds = readCoreParticipants();
    const playerCount = Math.max(standings.length, participantIds.length || 0, 1);

    return normalizeSummary({
      controllerFinal: true,
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'race',
      roomId: CTX.roomId,
      roomKind: CTX.roomKind,
      pid: CTX.pid,
      uid: CTX.uid,
      name: CTX.name,
      role: CTX.role,
      rank: me ? me.rank : 0,
      score: me ? me.score : 0,
      contribution: me ? me.contribution : 0,
      players: playerCount,
      miss: me ? me.miss : 0,
      goodHit: me ? me.goodHit : 0,
      junkHit: me ? me.junkHit : 0,
      bestStreak: me ? me.bestStreak : 0,
      duration: me ? me.duration : CTX.time,
      result: me && me.rank === 1 ? 'win' : (me && me.rank === 2 ? 'lose' : 'draw'),
      reason: 'controller-compare',
      standings,
      compare: {
        me,
        opponent,
        delta: me && opponent ? (num(me.score,0) - num(opponent.score,0)) : 0
      }
    });
  }

  async function maybeUpgradeStoredSummary(){
    const candidate =
      computeControllerSummaryFromResults() ||
      loadJson(STORE_LAST_RACE_ROOM, null) ||
      loadJson(STORE_LAST_RACE, null) ||
      loadJson(STORE_LAST, null);

    if (!candidate) return;

    const normalized = normalizeSummary(candidate);
    if (!normalized || !normalized.roomId) return;
    if (normalized.roomId && CTX.roomId && String(normalized.roomId) !== String(CTX.roomId)) return;

    if (shouldUpgradeToControllerFinal(normalized)) {
      await maybeSendControllerSummary(normalized);
    } else {
      persistSummary(normalized);
      maybePatchVisibleSummary(normalized);
    }
  }

  function patchResultMountDebug(summary){
    const mount = currentResultMount();
    if (!mount || mount.hidden) return;

    const shell = mount.firstElementChild;
    if (!shell) return;

    const existing = shell.querySelector('[data-race-controller-debug="1"]');
    const text =
      `controllerFinal=${summary && summary.controllerFinal ? 'true' : 'false'}
roomId=${escapeHtml(CTX.roomId || '-')}
roomKind=${escapeHtml(CTX.roomKind || '-')}
reason=${escapeHtml(summary && summary.reason ? summary.reason : '-')}`;

    if (existing) {
      existing.textContent = text;
      return;
    }

    const debug = D.createElement('div');
    debug.setAttribute('data-race-controller-debug', '1');
    debug.style.borderRadius = '16px';
    debug.style.background = '#fff';
    debug.style.border = '1px dashed #bfe3f2';
    debug.style.padding = '12px';
    debug.style.color = '#6b7280';
    debug.style.fontSize = '12px';
    debug.style.lineHeight = '1.6';
    debug.style.whiteSpace = 'pre-wrap';
    debug.style.wordBreak = 'break-word';
    debug.textContent = text;

    const actions = shell.querySelector('.btn') ? shell.lastElementChild : null;
    if (actions && actions.parentNode === shell) {
      shell.insertBefore(debug, actions);
    } else {
      shell.appendChild(debug);
    }
  }

  function maybePatchRematchLink(summary){
    const mount = currentResultMount();
    if (!mount || mount.hidden) return;

    const shell = mount.firstElementChild;
    if (!shell) return;

    let btn = D.getElementById('raceControllerRematchBtn');
    if (!btn) {
      const actions = Array.from(shell.querySelectorAll('a,button')).find((el) => {
        const t = String(el.textContent || '').toLowerCase();
        return t.includes('hub') || t.includes('lobby') || t.includes('อีกครั้ง');
      });

      const actionWrap = actions ? actions.parentElement : null;
      if (!actionWrap) return;

      btn = D.createElement('button');
      btn.id = 'raceControllerRematchBtn';
      btn.type = 'button';
      btn.className = 'btn good';
      btn.textContent = '🔁 รีแมตช์ (controller)';
      actionWrap.appendChild(btn);
    }

    btn.onclick = () => {
      const url = new URL('./goodjunk-race-lobby.html', location.href);
      const src = new URL(location.href);

      src.searchParams.forEach((value, key) => {
        if (key === 'autostart') return;
        url.searchParams.set(key, value);
      });

      if (CTX.roomId) {
        url.searchParams.set('roomId', CTX.roomId);
        url.searchParams.set('room', CTX.roomId);
      }
      if ((summary && summary.roomKind) || CTX.roomKind) {
        url.searchParams.set('roomKind', (summary && summary.roomKind) || CTX.roomKind);
      }
      url.searchParams.set('autojoin', '1');
      url.searchParams.set('rematch', '1');

      location.href = url.toString();
    };
  }

  function patchVisibleSummaryText(summary){
    const mount = currentResultMount();
    if (!mount || mount.hidden) return;

    const shell = mount.firstElementChild;
    if (!shell) return;

    const titleEl =
      shell.querySelector('div[style*="font-size:28px"]') ||
      shell.querySelector('h1,h2,h3');

    const subEl =
      titleEl && titleEl.nextElementSibling ? titleEl.nextElementSibling : null;

    const me = summary && summary.compare ? summary.compare.me : null;
    const opp = summary && summary.compare ? summary.compare.opponent : null;
    const delta = summary && summary.compare ? num(summary.compare.delta, 0) : 0;

    const title =
      summary && summary.rank === 1 ? 'เข้าเส้นชัยก่อน! คุณชนะรอบนี้' :
      summary && summary.rank === 2 ? 'จบรอบแล้ว ได้อันดับ 2' :
      (summary && summary.result ? summary.result : 'จบรอบแล้ว');

    const sub =
      me && opp
        ? `เรา ${num(me.score,0)} คะแนน • คู่แข่ง ${num(opp.score,0)} คะแนน`
        : 'ระบบสรุปผลรอบนี้เรียบร้อยแล้ว';

    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;

    const rankBlock = Array.from(shell.querySelectorAll('div')).find((el) => String(el.textContent || '').trim() === 'Rank');
    if (rankBlock && rankBlock.parentElement) {
      const valueEl = rankBlock.parentElement.querySelector('div:last-child');
      if (valueEl) valueEl.textContent = summary && summary.rank ? String(summary.rank) : '-';
    }

    const playersBlock = Array.from(shell.querySelectorAll('div')).find((el) => String(el.textContent || '').trim() === 'Players');
    if (playersBlock && playersBlock.parentElement) {
      const valueEl = playersBlock.parentElement.querySelector('div:last-child');
      if (valueEl) valueEl.textContent = String((summary && summary.players) || 1);
    }

    const missBlock = Array.from(shell.querySelectorAll('div')).find((el) => String(el.textContent || '').trim() === 'Miss');
    if (missBlock && missBlock.parentElement) {
      const valueEl = missBlock.parentElement.querySelector('div:last-child');
      if (valueEl) valueEl.textContent = String((summary && summary.miss) || 0);
    }

    const streakBlock = Array.from(shell.querySelectorAll('div')).find((el) => {
      const t = String(el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return t === 'best streak' || t === 'beststreak';
    });
    if (streakBlock && streakBlock.parentElement) {
      const valueEl = streakBlock.parentElement.querySelector('div:last-child');
      if (valueEl) valueEl.textContent = String((summary && summary.bestStreak) || 0);
    }

    const rowBlocks = Array.from(shell.querySelectorAll('div')).filter((el) => {
      const t = String(el.textContent || '');
      return /^#\d+\s/.test(t.trim());
    });

    if (rowBlocks.length && summary && Array.isArray(summary.standings) && summary.standings.length) {
      rowBlocks.forEach((row, i) => {
        const item = summary.standings[i];
        if (!item) return;
        const side = String(item.pid || '') === String(CTX.pid || '') ? 'YOU' : 'OPPONENT';
        row.innerHTML = `
          <div style="font-weight:1000;color:#4d4a42;">#${i + 1} ${escapeHtml(item.nick || item.pid || 'player')}</div>
          <div style="font-size:12px;color:#79aeca;font-weight:1000;">Score ${num(item.score,0)} • Miss ${num(item.miss,0)} • Streak ${num(item.bestStreak,0)}</div>
          <div style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:12px;color:#79aeca;font-weight:1000;">${side}</div>
        `;
        row.style.position = 'relative';
      });
    }

    const allCards = Array.from(shell.querySelectorAll('div'));
    const meCard = allCards.find((el) => {
      const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      return t === 'เรา' || t === 'me';
    });
    const gapCard = allCards.find((el) => {
      const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      return t.includes('ส่วนต่างคะแนน');
    });
    const oppCard = allCards.find((el) => {
      const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      return t === 'คู่แข่ง' || t === 'opponent';
    });

    if (meCard && meCard.parentElement && summary.compare && summary.compare.me) {
      const values = meCard.parentElement.querySelectorAll('div');
      if (values[1]) values[1].textContent = String(summary.compare.me.nick || 'เรา');
      if (values[2]) values[2].textContent = String(num(summary.compare.me.score, 0));
    }

    if (gapCard && gapCard.parentElement) {
      const values = gapCard.parentElement.querySelectorAll('div');
      if (values[1]) values[1].textContent = !summary.compare || !summary.compare.opponent
        ? 'รอผลอีกฝั่ง'
        : delta > 0 ? 'เรานำอยู่'
        : delta < 0 ? 'คู่แข่งนำอยู่'
        : 'คะแนนเท่ากัน';
      if (values[2]) values[2].textContent = !summary.compare || !summary.compare.opponent
        ? '-'
        : String(Math.abs(delta));
    }

    if (oppCard && oppCard.parentElement && summary.compare && summary.compare.opponent) {
      const values = oppCard.parentElement.querySelectorAll('div');
      if (values[1]) values[1].textContent = String(summary.compare.opponent.nick || 'คู่แข่ง');
      if (values[2]) values[2].textContent = String(num(summary.compare.opponent.score, 0));
    }
  }

  function maybePatchVisibleSummary(summary){
    if (!summary) return;
    const mount = currentResultMount();
    if (!mount || mount.hidden) return;

    const hash = buildSummaryHash(summary);
    if (hash === S.lastVisibleSummaryHash) return;

    S.lastVisibleSummaryHash = hash;
    patchVisibleSummaryText(summary);
    patchResultMountDebug(summary);
    maybePatchRematchLink(summary);
  }

  function forceVisibleSummaryRefresh(summary){
    S.lastVisibleSummaryHash = '';
    maybePatchVisibleSummary(summary);
  }

  function bindSummaryEvents(){
    ['gj:summary','hha:summary','hha:session-summary'].forEach((eventName) => {
      W.addEventListener(eventName, async (evt) => {
        const detail = evt && evt.detail ? evt.detail : null;
        if (!detail || typeof detail !== 'object') return;

        const normalized = persistSummary(detail);
        maybePatchVisibleSummary(normalized);

        if (shouldUpgradeToControllerFinal(normalized) && !normalized.controllerFinal) {
          await maybeSendControllerSummary(normalized);
        } else {
          patchResultMountDebug(normalized);
          maybePatchRematchLink(normalized);
        }
      });
    });

    W.addEventListener('race:update', (evt) => {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail || typeof detail !== 'object') return;
      S.lastLive = detail;
      persistLiveSnapshot(detail);
    });

    W.addEventListener('hha:score', (evt) => {
      const detail = evt && evt.detail ? evt.detail : null;
      if (!detail || typeof detail !== 'object') return;
      persistLiveSnapshot(detail);
    });
  }

  function persistLiveSnapshot(detail){
    const snapshot = {
      game: 'goodjunk',
      zone: 'nutrition',
      mode: 'race',
      roomId: CTX.roomId,
      roomKind: CTX.roomKind,
      pid: CTX.pid,
      uid: CTX.uid,
      name: CTX.name,
      role: CTX.role,
      score: num(detail.score, 0),
      contribution: num(detail.contribution != null ? detail.contribution : detail.score, 0),
      miss: num(detail.miss, 0),
      bestStreak: num(detail.bestStreak, 0),
      rank: num(detail.rank, 0),
      gap: num(detail.gap, 0),
      updatedAt: now()
    };

    saveJson(STORE_LIVE, snapshot);
    if (STORE_LIVE_ROOM) saveJson(STORE_LIVE_ROOM, snapshot);
  }

  function bindResultMountObserver(){
    if (S.resultWatchBound) return;
    S.resultWatchBound = true;

    const mount = currentResultMount();
    if (!mount) return;

    const mo = new MutationObserver(async () => {
      if (mount.hidden) return;

      S.mountSeenVisible = true;

      const summary =
        S.lastControllerSummary ||
        S.lastSummary ||
        computeControllerSummaryFromResults() ||
        loadJson(STORE_LAST_RACE_ROOM, null) ||
        loadJson(STORE_LAST_RACE, null) ||
        loadJson(STORE_LAST, null);

      if (summary) {
        const normalized = normalizeSummary(summary);
        maybePatchVisibleSummary(normalized);
        await maybeUpgradeStoredSummary();
      }
    });

    mo.observe(mount, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden']
    });
  }

  function startControllerPolling(){
    clearInterval(S.roomPollTimer);
    S.roomPollTimer = setInterval(async () => {
      const core = getCore();
      if (!core || !core.state) return;

      S.core = core;

      try {
        const room = core.state.room || {};
        const results = room.results || {};
        const resultCount = Object.keys(results).length;
        const participantCount = Math.max(2,
          (Array.isArray(room.state && room.state.participantIds) ? room.state.participantIds.length : 0) ||
          (Array.isArray(room.match && room.match.participantIds) ? room.match.participantIds.length : 0) ||
          0
        );

        if (resultCount >= participantCount) {
          await maybeUpgradeStoredSummary();
        }

        const status = String((room.state && room.state.status) || '');
        if ((status === 'ended' || status === 'finished') && !S.controllerSummarySent) {
          await maybeUpgradeStoredSummary();
        }
      } catch (_) {}
    }, 650);

    clearInterval(S.liveWatchTimer);
    S.liveWatchTimer = setInterval(() => {
      const snap = loadJson(STORE_LIVE_ROOM, null) || loadJson(STORE_LIVE, null);
      if (!snap) return;
      if (snap.roomId && CTX.roomId && String(snap.roomId) !== String(CTX.roomId)) return;
      if (!S.lastLive) S.lastLive = snap;
    }, 1200);

    clearInterval(S.visiblePatchTimer);
    S.visiblePatchTimer = setInterval(() => {
      const mount = currentResultMount();
      if (!mount || mount.hidden) return;

      const summary =
        S.lastControllerSummary ||
        S.lastSummary ||
        loadJson(STORE_LAST_RACE_ROOM, null) ||
        loadJson(STORE_LAST_RACE, null) ||
        loadJson(STORE_LAST, null);

      if (summary) {
        maybePatchVisibleSummary(normalizeSummary(summary));
      }
    }, 700);
  }

  function installLegacyBridge(){
    const legacy = {
      getCtx: () => Object.assign({}, runtimeCtx()),
      getCore: () => getCore(),
      getLastSummary: () =>
        S.lastControllerSummary ||
        S.lastSummary ||
        loadJson(STORE_LAST_RACE_ROOM, null) ||
        loadJson(STORE_LAST_RACE, null) ||
        null,
      forceControllerSummary: async () => {
        const summary = computeControllerSummaryFromResults();
        if (!summary) return null;
        await maybeSendControllerSummary(summary);
        return S.lastControllerSummary || summary;
      },
      persistSummary: (summary) => persistSummary(summary),
      normalizeSummary: (summary) => normalizeSummary(summary),
      patchVisibleSummary: (summary) => maybePatchVisibleSummary(normalizeSummary(summary))
    };

    W.__GJ_RACE_CONTROLLER__ = legacy;
    W.GJ_RACE_CONTROLLER = legacy;
  }

  async function init(){
    await flushRuntime();
    maybeCreateRuntime();
    bindSummaryEvents();
    bindResultMountObserver();
    startControllerPolling();
    installLegacyBridge();

    const cached =
      loadJson(STORE_LAST_RACE_ROOM, null) ||
      loadJson(STORE_LAST_RACE, null) ||
      loadJson(STORE_LAST, null);

    if (cached) {
      S.lastSummary = normalizeSummary(cached);
    }

    await maybeUpgradeStoredSummary();
  }

  init().catch((err) => {
    console.warn('[goodjunk-race-controller] init failed', err);
  });

  W.addEventListener('beforeunload', () => {
    clearInterval(S.roomPollTimer);
    clearInterval(S.liveWatchTimer);
    clearInterval(S.visiblePatchTimer);
  });
})();