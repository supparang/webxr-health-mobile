(function GoodJunkBattleV2LobbyHostRepairPatch(){
  'use strict';

  const PATCH_VERSION = 'v2.4.35-lobby-host-repair-stale-clean';

  const url = new URL(location.href);
  const params = url.searchParams;

  const ROOM_PATH =
    window.GJ_BATTLE_ROOM_PATH ||
    'herohealth/goodjunk/battleV2Rooms';

  const MAX_PLAYERS = Number(params.get('maxPlayers') || params.get('capacity') || 2);
  const STALE_MS = Number(params.get('staleMs') || 16000);
  const HARD_STALE_MS = Number(params.get('hardStaleMs') || 45000);

  const ME_PID =
    params.get('pid') ||
    localStorage.getItem('GJ_BATTLE_PID') ||
    localStorage.getItem('HHA_GJ_PID') ||
    '';

  const ME_NAME =
    params.get('name') ||
    localStorage.getItem('GJ_BATTLE_NAME') ||
    localStorage.getItem('HHA_GJ_NAME') ||
    'Hero';

  const state = {
    version: PATCH_VERSION,
    roomCode: '',
    roomRef: null,
    attached: false,
    repairing: false,
    lastRepairAt: 0,
    lastRoomKey: '',
    lastError: ''
  };

  function now(){
    return Date.now();
  }

  function $(sel, root){
    return (root || document).querySelector(sel);
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, {
        detail: Object.assign({
          version: PATCH_VERSION,
          at: now()
        }, detail || {})
      }));
    }catch(_){}
  }

  function toast(msg){
    let el = $('#toast');

    if (!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:calc(18px + env(safe-area-inset-bottom))',
        'transform:translateX(-50%) translateY(16px)',
        'z-index:999999',
        'max-width:92vw',
        'padding:12px 16px',
        'border-radius:999px',
        'background:rgba(60,34,16,.92)',
        'color:#fff',
        'font:950 14px system-ui,sans-serif',
        'text-align:center',
        'opacity:0',
        'pointer-events:none',
        'transition:opacity .18s ease, transform .18s ease'
      ].join(';');
      document.body.appendChild(el);
    }

    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';

    clearTimeout(toast._t);
    toast._t = setTimeout(function(){
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(16px)';
    }, 1400);
  }

  function setError(err, source){
    const msg = err && err.message ? err.message : String(err || 'unknown-error');
    state.lastError = msg;
    console.warn('[GJ Lobby Host Repair]', source || 'error', err);
    emit('gj:battle-lobby-host-repair-error', {
      source: source || 'repair',
      error: msg
    });
  }

  function normalizeRoomCode(raw){
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
  }

  function getRoomCode(){
    const input = $('#roomCodeInput');
    const text = $('#roomCodeText');

    return normalizeRoomCode(
      params.get('room') ||
      params.get('roomCode') ||
      params.get('code') ||
      params.get('lastRoom') ||
      (window.GJ_BATTLE_LOBBY && window.GJ_BATTLE_LOBBY.state && window.GJ_BATTLE_LOBBY.state.roomCode) ||
      (input && input.value) ||
      (text && text.textContent) ||
      localStorage.getItem('GJ_BATTLE_LAST_ROOM') ||
      ''
    );
  }

  function getMyPid(){
    const input = $('#playerId');

    return String(
      (input && input.value) ||
      ME_PID ||
      localStorage.getItem('GJ_BATTLE_PID') ||
      localStorage.getItem('HHA_GJ_PID') ||
      'anon'
    ).trim() || 'anon';
  }

  function getMyName(){
    const input = $('#playerName');

    return String(
      (input && input.value) ||
      ME_NAME ||
      localStorage.getItem('GJ_BATTLE_NAME') ||
      localStorage.getItem('HHA_GJ_NAME') ||
      'Hero'
    ).trim() || 'Hero';
  }

  function getView(){
    const select = $('#viewSelect');
    return String((select && select.value) || params.get('view') || 'pc').toLowerCase();
  }

  function getDiff(){
    const select = $('#diffSelect');
    return String((select && select.value) || params.get('diff') || 'normal');
  }

  function getTime(){
    const select = $('#timeSelect');
    return Number((select && select.value) || params.get('time') || 90);
  }

  function getBridge(){
    return window.GJ_BATTLE_FIREBASE_BRIDGE || null;
  }

  async function waitForDbReady(timeoutMs){
    timeoutMs = Number(timeoutMs || 5500);
    const start = now();

    return await new Promise(resolve => {
      const tick = async () => {
        const bridge = getBridge();

        if (bridge){
          try{
            if (typeof bridge.refresh === 'function'){
              await bridge.refresh();
            }else if (typeof bridge.init === 'function'){
              await bridge.init();
            }
          }catch(_){}

          if (typeof bridge.isReady === 'function' && bridge.isReady()){
            resolve(true);
            return;
          }
        }

        if (
          window.GJ_BATTLE_DB_READY &&
          window.GJ_BATTLE_AUTH_READY &&
          window.GJ_DB &&
          typeof window.GJ_DB.ref === 'function'
        ){
          resolve(true);
          return;
        }

        if (now() - start >= timeoutMs){
          resolve(false);
          return;
        }

        setTimeout(tick, 180);
      };

      tick();
    });
  }

  function getRoomRef(roomCode){
    const code = normalizeRoomCode(roomCode || getRoomCode());

    if (!code) return null;

    const bridge = getBridge();

    if (bridge && typeof bridge.getRoomRef === 'function'){
      const ref = bridge.getRoomRef(code);
      if (ref) return ref;
    }

    const db = window.GJ_DB || window.GJ_BATTLE_DB || null;

    if (!db || typeof db.ref !== 'function') return null;

    return db.ref(ROOM_PATH + '/' + code);
  }

  function safeObj(v){
    return v && typeof v === 'object' ? v : {};
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number(fallback || 0);
  }

  function normalizePlayer(id, raw, room){
    raw = safeObj(raw);
    room = safeObj(room);

    const status = String(raw.status || '').toLowerCase();
    const left = !!(
      raw.left === true ||
      raw.quit === true ||
      raw.disconnected === true ||
      status === 'left' ||
      status === 'offline'
    );

    const lastSeen = safeNum(raw.lastSeen || raw.heartbeatAt || raw.updatedAt || raw.joinedAt, 0);
    const age = lastSeen ? now() - lastSeen : 0;
    const hardStale = !!(lastSeen && age > HARD_STALE_MS);
    const stale = !!(lastSeen && age > STALE_MS);

    const pid = String(raw.pid || id || '').trim();
    const name = String(raw.name || raw.playerName || raw.displayName || id || 'Hero').trim();

    return {
      id: String(id || pid || ''),
      pid,
      name,
      view: raw.view || raw.device || '',
      role: raw.role || '',
      host: !!raw.host,
      status: raw.status || '',
      score: safeNum(raw.score || raw.points, 0),
      lastSeen,
      age,
      left,
      stale,
      hardStale,
      online: !left && !hardStale && (!lastSeen || age <= STALE_MS),
      rematchReady: !!(raw.rematchReady || raw.readyRematch || raw.nextReady),
      raw
    };
  }

  function normalizeRoom(room){
    room = safeObj(room);
    const playersMap = safeObj(room.players);

    const players = Object.entries(playersMap).map(function(pair){
      return normalizePlayer(pair[0], pair[1], room);
    });

    const online = players.filter(function(p){
      return p.online;
    });

    const active = players.filter(function(p){
      return !p.left && !p.hardStale;
    });

    const hostPid = String(room.hostPid || '').trim();

    const host = players.find(function(p){
      return p.pid === hostPid || p.id === hostPid || p.host || p.role === 'host';
    }) || null;

    const liveHost = online.find(function(p){
      return p.pid === hostPid || p.id === hostPid || p.host || p.role === 'host';
    }) || null;

    return {
      raw: room,
      code: normalizeRoomCode(room.code || room.room || room.roomCode || getRoomCode()),
      phase: String(room.phase || room.status || room.state || 'lobby').toLowerCase(),
      hostPid,
      host,
      liveHost,
      players,
      online,
      active,
      playersMap
    };
  }

  function sortHostCandidates(players){
    return players.slice().sort(function(a, b){
      /*
       * เลือก host แบบ deterministic:
       * 1) คนที่ online
       * 2) คนที่ role/host เดิม
       * 3) คนที่ updated ล่าสุด
       * 4) id น้อยกว่าเพื่อไม่แกว่ง
       */
      if (a.online !== b.online) return a.online ? -1 : 1;
      if ((a.host || a.role === 'host') !== (b.host || b.role === 'host')){
        return (a.host || a.role === 'host') ? -1 : 1;
      }

      const au = safeNum(a.raw.updatedAt || a.raw.joinedAt || a.lastSeen, 0);
      const bu = safeNum(b.raw.updatedAt || b.raw.joinedAt || b.lastSeen, 0);

      if (au !== bu) return bu - au;

      return String(a.id).localeCompare(String(b.id));
    });
  }

  function chooseNewHost(nr){
    const candidates = sortHostCandidates(nr.online);

    if (candidates.length){
      return candidates[0];
    }

    const active = sortHostCandidates(nr.active);

    if (active.length){
      return active[0];
    }

    return null;
  }

  function getDuplicateNameIds(players){
    const groups = new Map();

    players.forEach(function(p){
      const key = String(p.name || '').trim().toLowerCase();
      if (!key) return;

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });

    const staleIds = [];

    groups.forEach(function(list){
      if (list.length <= 1) return;

      const sorted = list.slice().sort(function(a, b){
        if (a.online !== b.online) return a.online ? -1 : 1;
        const au = safeNum(a.raw.updatedAt || a.raw.joinedAt || a.lastSeen, 0);
        const bu = safeNum(b.raw.updatedAt || b.raw.joinedAt || b.lastSeen, 0);
        return bu - au;
      });

      sorted.slice(1).forEach(function(p){
        if (p.left || p.stale || p.hardStale){
          staleIds.push(p.id);
        }
      });
    });

    return staleIds;
  }

  function buildMyPlayerPatch(extra){
    return Object.assign({
      pid: getMyPid(),
      name: getMyName(),
      playerName: getMyName(),
      displayName: getMyName(),
      view: getView(),
      device: getView(),
      diff: getDiff(),
      time: getTime(),
      status: 'online',
      left: false,
      quit: false,
      disconnected: false,
      lastSeen: now(),
      heartbeatAt: now(),
      updatedAt: now(),
      lobbyHostRepairVersion: PATCH_VERSION,
      authUid: window.GJ_BATTLE_AUTH_UID || ''
    }, extra || {});
  }

  async function repairRoom(room, source){
    if (state.repairing) return false;
    if (now() - state.lastRepairAt < 650) return false;

    const nr = normalizeRoom(room);

    if (!nr.code) return false;

    const ref = state.roomRef || getRoomRef(nr.code);
    if (!ref || typeof ref.update !== 'function') return false;

    state.repairing = true;
    state.lastRepairAt = now();

    try{
      const mePid = getMyPid();
      const patch = {};
      const playerPatches = {};
      const removePatches = {};

      /*
       * 1) ถ้าฉันอยู่ในห้อง ให้ refresh สถานะ online ไว้ก่อน
       */
      if (mePid){
        playerPatches['players/' + mePid] = buildMyPlayerPatch();
      }

      /*
       * 2) clean hard stale / left เก่าเกิน / duplicate stale
       * ไม่ลบทันทีเพื่อไม่เสี่ยง security rules; ใช้ mark archived แทน
       */
      const duplicateStaleIds = getDuplicateNameIds(nr.players);

      nr.players.forEach(function(p){
        const shouldArchive =
          p.hardStale ||
          (p.left && p.age > 8000) ||
          duplicateStaleIds.includes(p.id);

        if (!shouldArchive) return;

        /*
         * ถ้าเป็นตัวเอง ไม่ archive
         */
        if (String(p.id) === String(mePid) || String(p.pid) === String(mePid)) return;

        removePatches['players/' + p.id + '/status'] = 'left';
        removePatches['players/' + p.id + '/left'] = true;
        removePatches['players/' + p.id + '/quit'] = true;
        removePatches['players/' + p.id + '/disconnected'] = true;
        removePatches['players/' + p.id + '/archivedByRepair'] = true;
        removePatches['players/' + p.id + '/archivedAt'] = now();
        removePatches['players/' + p.id + '/updatedAt'] = now();
      });

      /*
       * 3) host repair: ถ้า host เดิม left/offline/hard stale ให้ย้าย host
       */
      const hostBroken =
        !nr.hostPid ||
        !nr.liveHost ||
        (nr.host && (nr.host.left || nr.host.hardStale));

      if (hostBroken){
        const freshNr = normalizeRoom(Object.assign({}, nr.raw, {
          players: Object.assign({}, nr.playersMap)
        }));

        const newHost = chooseNewHost(freshNr);

        if (newHost){
          patch.hostPid = newHost.pid || newHost.id;
          patch.hostName = newHost.name;
          patch.hostRepairAt = now();
          patch.hostRepairVersion = PATCH_VERSION;

          nr.players.forEach(function(p){
            const isNewHost =
              String(p.id) === String(newHost.id) ||
              String(p.pid) === String(newHost.pid);

            playerPatches['players/' + p.id + '/host'] = isNewHost;
            playerPatches['players/' + p.id + '/role'] = isNewHost ? 'host' : 'player';
            playerPatches['players/' + p.id + '/updatedAt'] = now();
          });

          /*
           * ถ้าฉันคือ host ใหม่ ให้ override patch ของตัวเองชัด ๆ
           */
          if (String(newHost.id) === String(mePid) || String(newHost.pid) === String(mePid)){
            playerPatches['players/' + mePid] = buildMyPlayerPatch({
              host: true,
              role: 'host'
            });
          }
        }
      }

      /*
       * 4) ถ้าผู้เล่น online เกิน maxPlayers ให้ไม่เอาคนที่ left/stale มาเป็น ready
       * ห้องยังเก็บ record ได้ แต่ UI/Start ควรนับ online จริงเท่านั้น
       */
      patch.updatedAt = now();
      patch.lobbyHostRepairVersion = PATCH_VERSION;

      const updates = Object.assign({}, patch, playerPatches, removePatches);

      if (!Object.keys(updates).length){
        return false;
      }

      await ref.update(updates);

      emit('gj:battle-lobby-host-repaired', {
        source: source || 'repair-room',
        room: nr.code,
        hostBroken,
        updates: Object.keys(updates).length
      });

      /*
       * กระตุ้น lobby เดิมให้ refresh ปุ่ม
       */
      if (
        window.GJ_BATTLE_LOBBY &&
        typeof window.GJ_BATTLE_LOBBY.waitForDbReady === 'function'
      ){
        try{
          if (typeof window.GJ_BATTLE_LOBBY.state === 'object'){
            window.GJ_BATTLE_LOBBY.state.roomCode = nr.code;
          }
        }catch(_){}
      }

      return true;
    }catch(err){
      setError(err, 'repair-room-failed');
      return false;
    }finally{
      state.repairing = false;
    }
  }

  function renderCleanLobby(room){
    const nr = normalizeRoom(room);
    state.lastRoom = room;
    const list = $('#playersList');

    if (!list) return;

    const visible = nr.players.filter(function(p){
      if (p.hardStale) return false;
      if (p.left && p.age > 8000) return false;
      return true;
    });

    if (!visible.length) return;

    list.innerHTML = visible.map(function(p){
      const online = p.online;
      const isHost =
        p.host ||
        p.role === 'host' ||
        String(p.pid) === String(nr.hostPid) ||
        String(p.id) === String(nr.hostPid);

      const avatar = isHost ? '🦸' : '⚔️';
      const pill = online ? 'READY' : 'LEFT';
      const cls = online ? '' : 'off';

      const meta = [
        p.view || '-',
        isHost ? 'host' : 'player',
        online ? 'online' : 'left',
        'score ' + p.score
      ].join(' • ');

      return [
        '<div class="player">',
          '<div class="avatar">' + avatar + '</div>',
          '<div>',
            '<div class="p-name">' + escapeHtml(p.name) + '</div>',
            '<div class="p-meta">' + escapeHtml(meta) + '</div>',
          '</div>',
          '<span class="pill ' + cls + '">' + pill + '</span>',
        '</div>'
      ].join('');
    }).join('');

    updateStartButtonOverride(nr);
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function updateStartButtonOverride(nr){
    const btn = $('#btnStartBattle');
    const status = $('#lobbyStatus');
    if (!btn) return;

    const mePid = getMyPid();
    const online = nr.online.slice(0, MAX_PLAYERS + 2);

    const me = online.find(function(p){
      return String(p.id) === String(mePid) || String(p.pid) === String(mePid);
    });

    const meIsHost =
      !!me &&
      (
        me.host ||
        me.role === 'host' ||
        String(me.id) === String(nr.hostPid) ||
        String(me.pid) === String(nr.hostPid)
      );

    const canStart = meIsHost && online.length >= 2;

    btn.disabled = !canStart;
    btn.classList.toggle('is-ready', canStart);
    btn.classList.toggle('is-disabled', !canStart);

    if (canStart){
      btn.textContent = '⚔️ Host เริ่ม Battle';
      if (status){
        status.className = 'status good';
        status.textContent = 'พร้อมแล้ว • มีผู้เล่นออนไลน์ ' + online.length + ' คน • คุณเป็น Host เริ่ม Battle ได้';
      }
    }else if (!meIsHost && online.length >= 2){
      btn.textContent = '⏳ รอ Host เริ่ม Battle';
      if (status){
        status.className = 'status warn';
        status.textContent = 'พร้อมแล้ว • มีผู้เล่นออนไลน์ ' + online.length + ' คน • รอ Host เริ่ม Battle';
      }
    }else if (online.length === 1){
      btn.textContent = '⏳ รอผู้เล่นอีก 1 คน';
      if (status){
        status.className = 'status warn';
        status.textContent = 'อยู่ในห้องแล้ว • รอคู่แข่งอีก 1 คน';
      }
    }else{
      btn.textContent = '⏳ ยังไม่พร้อมเริ่ม';
    }
  }

  function attachRoomListener(roomCode){
    const code = normalizeRoomCode(roomCode || getRoomCode());
    if (!code) return false;

    if (state.attached && state.roomCode === code) return true;

    const ref = getRoomRef(code);
    if (!ref || typeof ref.on !== 'function') return false;

    state.roomCode = code;
    state.roomRef = ref;
    state.attached = true;

    ref.on('value', function(snapshot){
      const room = snapshot && typeof snapshot.val === 'function'
        ? snapshot.val() || {}
        : {};

      const nr = normalizeRoom(room);
      const key = [
        nr.code,
        nr.hostPid,
        nr.players.map(p => [p.id,p.status,p.left,p.lastSeen,p.host,p.role].join(':')).join('|')
      ].join('::');

      renderCleanLobby(room);

      if (key !== state.lastRoomKey){
        state.lastRoomKey = key;
        repairRoom(room, 'listener');
      }
    }, function(err){
      setError(err, 'listener-error');
    });

    return true;
  }

  async function repairCurrentRoom(source){
    const code = normalizeRoomCode(getRoomCode());

    if (!code){
      return false;
    }

    const ok = await waitForDbReady(5000);

    if (!ok){
      setError('DB not ready', 'repair-current-room-db-not-ready');
      return false;
    }

    const ref = getRoomRef(code);

    if (!ref || typeof ref.once !== 'function'){
      setError('Room ref not ready', 'repair-current-room-ref-not-ready');
      return false;
    }

    state.roomCode = code;
    state.roomRef = ref;

    try{
      const snap = await ref.once('value');
      const room = snap && typeof snap.val === 'function' ? snap.val() || {} : {};

      if (!room || !Object.keys(room).length){
        attachRoomListener(code);
        return false;
      }

      renderCleanLobby(room);
      await repairRoom(room, source || 'manual');

      attachRoomListener(code);
      return true;
    }catch(err){
      setError(err, 'repair-current-room-failed');
      return false;
    }
  }

  function patchCreateJoinButtons(){
    const createBtn = $('#btnCreateRoom');
    const joinBtn = $('#btnJoinRoom');
    const leaveBtn = $('#btnLeaveRoom');

    if (createBtn && createBtn.dataset.gjHostRepairBound !== '1'){
      createBtn.dataset.gjHostRepairBound = '1';
      createBtn.addEventListener('click', function(){
        setTimeout(function(){
          repairCurrentRoom('after-create-click');
        }, 900);
      });
    }

    if (joinBtn && joinBtn.dataset.gjHostRepairBound !== '1'){
      joinBtn.dataset.gjHostRepairBound = '1';
      joinBtn.addEventListener('click', function(){
        setTimeout(function(){
          repairCurrentRoom('after-join-click');
        }, 900);
      });
    }

    if (leaveBtn && leaveBtn.dataset.gjHostRepairBound !== '1'){
      leaveBtn.dataset.gjHostRepairBound = '1';
      leaveBtn.addEventListener('click', function(){
        setTimeout(function(){
          repairCurrentRoom('after-leave-click');
        }, 900);
      });
    }
  }

  function patchStartButton(){
    const btn = $('#btnStartBattle');
    if (!btn || btn.dataset.gjHostRepairStartBound === '1') return;

    btn.dataset.gjHostRepairStartBound = '1';

    btn.addEventListener('click', async function(){
      /*
       * ก่อน start ให้ repair อีกรอบ เพื่อกัน hostPid ค้าง
       */
      await repairCurrentRoom('before-start-click');
    }, true);
  }

  function injectDebugApi(){
    window.GJ_BATTLE_LOBBY_HOST_REPAIR = {
      version: PATCH_VERSION,
      state,
      repairCurrentRoom,
      repairRoom,
      normalizeRoom,
      attachRoomListener,
      getRoomCode,
      getRoomRef
    };
  }

  async function boot(){
    injectDebugApi();
    patchCreateJoinButtons();
    patchStartButton();

    await repairCurrentRoom('boot');

    setInterval(function(){
      const code = getRoomCode();

      if (code && code !== state.roomCode){
        state.attached = false;
        state.roomCode = code;
        repairCurrentRoom('interval-room-code-change');
      }else if (code){
        repairCurrentRoom('interval-repair');
      }
    }, 5000);

    window.addEventListener('gj:battle-db-ready', function(){
      setTimeout(function(){
        repairCurrentRoom('db-ready-event');
      }, 250);
    });

    window.addEventListener('gj:battle-firebase-ready', function(){
      setTimeout(function(){
        repairCurrentRoom('firebase-ready-event');
      }, 250);
    });

    toast('Lobby repair พร้อมแล้ว');

    console.info('[GoodJunk Battle Lobby Host Repair Patch]', PATCH_VERSION, 'loaded');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }
})();
