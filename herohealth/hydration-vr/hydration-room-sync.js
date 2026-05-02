// === /herohealth/hydration-vr/hydration-room-sync.js ===
// PATCH v20260502-HYDRATION-ROOM-SYNC-V3-ROOM-CODE
//
// ✅ Duet/Battle require 2 active players
// ✅ Race supports 2–10 active players
// ✅ Coop supports 2–10 active players
// ✅ Room Code UI: HYD-482K style
// ✅ Live scoreboard during game
// ✅ Summary scoreboard for all players
// ✅ Uses Firebase Realtime Database compat if available
// ✅ Safe fallback when Firebase is unavailable

'use strict';

(function HydrationRoomSync(){
  const VERSION = '20260502-HYDRATION-ROOM-SYNC-V3-ROOM-CODE';

  const MULTI_MODES = new Set(['duet','race','battle','coop']);

  const MODE_REQUIRE = {
    duet:2,
    race:2,
    battle:2,
    coop:2
  };

  const MODE_MAX = {
    duet:2,
    race:10,
    battle:2,
    coop:10
  };

  const $ = (s, r = document) => r.querySelector(s);

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[m]));
  }

  function qs(name, fallback = ''){
    try{
      return new URL(location.href).searchParams.get(name) ?? fallback;
    }catch(e){
      return fallback;
    }
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = String(value);
  }

  function numText(id, fallback = 0){
    const el = document.getElementById(id);
    if(!el) return fallback;
    const raw = String(el.textContent || '').replace(/[,%]/g, '');
    const m = raw.match(/-?\d+(\.\d+)?/);
    if(!m) return fallback;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : fallback;
  }

  function text(id, fallback = ''){
    const el = document.getElementById(id);
    return el ? String(el.textContent || '').trim() : fallback;
  }

  function normalizeMode(raw){
    raw = String(raw || 'solo').toLowerCase();
    if(['duet','race','battle','coop'].includes(raw)) return raw;
    return 'solo';
  }

  function normalizeRoomCode(v){
    v = String(v || '').trim().toUpperCase();

    if(!v) return '';

    v = v.replace(/^HYDR-/, 'HYD-');

    if(v.startsWith('HYD-')){
      const tail = v.slice(4).replace(/[^A-Z0-9]/g, '').slice(0, 4);
      return tail ? `HYD-${tail}` : '';
    }

    if(v.startsWith('HYD')){
      const tail = v.slice(3).replace(/[^A-Z0-9]/g, '').slice(0, 4);
      return tail ? `HYD-${tail}` : '';
    }

    const raw = v.replace(/[^A-Z0-9]/g, '').slice(0, 4);
    return raw ? `HYD-${raw}` : '';
  }

  function displayRoomCode(){
    return normalizeRoomCode(qs('roomCode', '') || state.roomId || qs('room', '')) || String(state.roomId || '').toUpperCase();
  }

  function makeId(){
    return 'p_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
  }

  function getSessionPlayerId(){
    const key = 'HHA_HYDRATION_PLAYER_ID_V3';
    let id = sessionStorage.getItem(key);
    if(!id){
      id = makeId();
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  function getStats(){
    const modeState = window.HHA_HYDRATION_MODE_STATE || {};
    const st = modeState.stats || {};

    return {
      score:Number(st.score ?? numText('uiScore', 0)),
      water:Number(st.water ?? numText('uiWater', 0)),
      miss:Number(st.miss ?? numText('uiMiss', 0)),
      expire:Number(st.expire ?? numText('uiExpire', 0)),
      block:Number(st.block ?? numText('uiBlock', 0)),
      combo:Number(st.combo ?? numText('uiCombo', 0)),
      shield:Number(st.shield ?? numText('uiShield', 0)),
      grade:String(st.grade ?? text('uiGrade', 'D')),
      timeText:text('uiTime', '00:00')
    };
  }

  const state = {
    version:VERSION,
    mode:normalizeMode(qs('mode', qs('entry', 'solo'))),
    roomId:normalizeRoomCode(qs('roomCode', '') || qs('room', qs('roomId', ''))),
    playerId:qs('playerId', '') || getSessionPlayerId(),
    playerName:qs('name', qs('nick', 'Hero')) || 'Hero',
    role:'',
    slot:0,
    required:1,
    maxPlayers:1,
    dbReady:false,
    roomReady:false,
    startedAt:Date.now(),
    lastPlayers:[],
    ref:null,
    myRef:null,
    unsubscribed:false
  };

  state.required = MODE_REQUIRE[state.mode] || 1;
  state.maxPlayers = MODE_MAX[state.mode] || 1;

  if(!state.roomId){
    const seed = qs('seed', Date.now());
    state.roomId = normalizeRoomCode(String(seed).slice(-4)) || `HYD-${String(seed).slice(-4)}`;
  }

  function isMultiplayer(){
    return MULTI_MODES.has(state.mode);
  }

  function roleForSlot(mode, slotIndex){
    const i = Number(slotIndex || 0);

    if(mode === 'duet'){
      return ['collector','guardian'][i % 2];
    }

    if(mode === 'battle'){
      return ['storm_maker','shield_keeper'][i % 2];
    }

    if(mode === 'race'){
      return 'racer';
    }

    if(mode === 'coop'){
      return [
        'collector',
        'guardian',
        'cleaner',
        'booster',
        'medic',
        'collector',
        'guardian',
        'cleaner',
        'booster',
        'medic'
      ][i % 10];
    }

    return 'hero';
  }

  function roleLabel(role, slotIndex = 0){
    if(role === 'racer'){
      return `🏁 Racer #${Number(slotIndex || 0) + 1}`;
    }

    const map = {
      hero:'💧 ฮีโร่น้ำ',
      collector:'💧 คนเก็บน้ำ',
      guardian:'🛡️ ผู้พิทักษ์',
      cleaner:'🧼 ผู้เคลียร์',
      booster:'⚡ สายบูสต์',
      medic:'💚 ผู้ฟื้นฟูทีม',
      storm_maker:'🌩️ ผู้สร้างพายุ',
      shield_keeper:'🛡️ ผู้กันพายุ',
      spectator:'👀 ผู้ชม'
    };

    return map[role] || role || 'ผู้เล่น';
  }

  function inferRole(){
    const modeState = window.HHA_HYDRATION_MODE_STATE || {};
    if(modeState.role) return modeState.role;

    const roleFromUrl = qs('role', '');
    if(roleFromUrl) return roleFromUrl;

    const idx = Number(qs('playerIndex', qs('slot', 0))) || 0;
    return roleForSlot(state.mode, idx);
  }

  function getLiveRank(players, playerId){
    const sorted = [...players].sort((a,b) => {
      const bw = Number(b.water || 0);
      const aw = Number(a.water || 0);
      if(bw !== aw) return bw - aw;

      const bs = Number(b.score || 0);
      const as = Number(a.score || 0);
      if(bs !== as) return bs - as;

      return Number(a.miss || 0) - Number(b.miss || 0);
    });

    const idx = sorted.findIndex(p => p.id === playerId);
    return idx >= 0 ? idx + 1 : '-';
  }

  function injectStyle(){
    if(document.getElementById('hydrRoomSyncStyle')) return;

    const style = document.createElement('style');
    style.id = 'hydrRoomSyncStyle';
    style.textContent = `
      .hydr-room-board{
        display:grid;
        gap:10px;
        padding:12px;
        border-radius:22px;
        background:linear-gradient(180deg,rgba(7,18,38,.76),rgba(12,24,52,.72));
        border:1px solid rgba(103,232,249,.20);
        box-shadow:0 18px 44px rgba(0,0,0,.18);
      }

      .hydr-room-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        flex-wrap:wrap;
      }

      .hydr-room-title{
        font-weight:1100;
        font-size:15px;
      }

      .hydr-room-sub{
        color:#bfdbfe;
        font-size:12px;
        font-weight:900;
      }

      .hydr-room-players{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:10px;
        max-height:380px;
        overflow:auto;
        padding-right:2px;
      }

      .hydr-room-player{
        display:grid;
        gap:7px;
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.11);
      }

      .hydr-room-player.me{
        outline:2px solid rgba(34,211,238,.35);
        background:rgba(34,211,238,.10);
      }

      .hydr-room-player.peer{
        outline:2px solid rgba(52,211,153,.25);
      }

      .hydr-room-name{
        font-size:15px;
        font-weight:1100;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .hydr-room-role{
        color:#bfdbfe;
        font-size:12px;
        font-weight:900;
      }

      .hydr-room-score{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:6px;
      }

      .hydr-room-mini{
        padding:7px 8px;
        border-radius:13px;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.08);
        text-align:center;
      }

      .hydr-room-mini .k{
        color:#bfdbfe;
        font-size:10px;
        font-weight:1000;
      }

      .hydr-room-mini .v{
        margin-top:2px;
        font-size:16px;
        font-weight:1100;
      }

      .hydr-room-wait{
        position:fixed;
        inset:0;
        z-index:1900;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(2,6,23,.72);
        backdrop-filter:blur(12px);
      }

      .hydr-room-wait[hidden]{
        display:none !important;
      }

      .hydr-room-wait-card{
        width:min(92vw,640px);
        display:grid;
        gap:14px;
        padding:20px;
        border-radius:30px;
        background:linear-gradient(180deg,rgba(13,24,47,.96),rgba(9,17,36,.96));
        border:1px solid rgba(255,255,255,.16);
        box-shadow:0 24px 64px rgba(0,0,0,.36);
        color:#eff7ff;
      }

      .hydr-room-wait-title{
        font-size:28px;
        font-weight:1100;
        line-height:1.12;
      }

      .hydr-room-wait-sub{
        color:#bfdbfe;
        font-size:14px;
        line-height:1.45;
      }

      .hydr-room-codebox{
        display:grid;
        gap:8px;
        padding:16px;
        border-radius:22px;
        background:rgba(34,211,238,.12);
        border:1px solid rgba(34,211,238,.32);
        text-align:center;
      }

      .hydr-room-code-label{
        color:#bfdbfe;
        font-size:12px;
        font-weight:1000;
        letter-spacing:.08em;
      }

      .hydr-room-code{
        font-size:clamp(34px,7vw,58px);
        line-height:1;
        font-weight:1100;
        letter-spacing:.06em;
        color:#eff7ff;
      }

      .hydr-room-linkbox{
        display:grid;
        gap:8px;
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.10);
      }

      .hydr-room-linkbox input{
        width:100%;
        min-height:42px;
        border-radius:14px;
        border:1px solid rgba(103,232,249,.25);
        background:rgba(7,18,38,.55);
        color:#eff7ff;
        padding:10px 12px;
        font:inherit;
      }

      .hydr-room-actions{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }

      .hydr-room-btn{
        min-height:44px;
        padding:10px 14px;
        border-radius:15px;
        border:0;
        cursor:pointer;
        color:#fff;
        font-weight:1100;
        background:linear-gradient(180deg,#22d3ee,#2563eb);
      }

      .hydr-room-btn.secondary{
        background:rgba(255,255,255,.08);
        border:1px solid rgba(255,255,255,.12);
      }

      .hydr-room-summary{
        display:grid;
        gap:10px;
        padding:12px;
        border-radius:20px;
        background:rgba(255,255,255,.06);
        border:1px solid rgba(255,255,255,.10);
      }

      .hydr-room-summary-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:10px;
        max-height:420px;
        overflow:auto;
      }

      .hydr-room-summary-player{
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.10);
        text-align:center;
      }

      .hydr-room-summary-player .name{
        font-weight:1100;
      }

      .hydr-room-summary-player .score{
        margin-top:5px;
        font-size:30px;
        font-weight:1100;
      }

      .hydr-room-summary-player .meta{
        margin-top:4px;
        color:#bfdbfe;
        font-size:12px;
        line-height:1.35;
      }

      @media(max-width:700px){
        .hydr-room-players,
        .hydr-room-summary-grid{
          grid-template-columns:1fr;
        }

        .hydr-room-actions,
        .hydr-room-btn{
          width:100%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createBoard(){
    if(document.getElementById('hydrRoomBoard')) return;

    const board = document.createElement('section');
    board.id = 'hydrRoomBoard';
    board.className = 'panel pad hydr-room-board';
    board.innerHTML = `
      <div class="hydr-room-head">
        <div>
          <div class="hydr-room-title">👥 Multiplayer Scoreboard</div>
          <div class="hydr-room-sub" id="hydrRoomStatus">Room: ${esc(displayRoomCode())}</div>
        </div>
        <div class="hydr-room-sub" id="hydrRoomCount">0/${state.required}</div>
      </div>
      <div class="hydr-room-players" id="hydrRoomPlayers"></div>
    `;

    const sideCol = $('.side-col');
    if(sideCol){
      sideCol.insertBefore(board, sideCol.firstChild);
      return;
    }

    const page = $('.hydr-page') || document.body;
    page.insertBefore(board, page.firstChild);
  }

  function createWaitOverlay(){
    if(document.getElementById('hydrRoomWait')) return;

    const roomCode = displayRoomCode();

    const shareUrl = new URL(location.href);
    shareUrl.searchParams.set('mode', state.mode);
    shareUrl.searchParams.set('room', roomCode);
    shareUrl.searchParams.set('roomCode', roomCode);
    shareUrl.searchParams.set('multiplayer', '1');

    const overlay = document.createElement('div');
    overlay.id = 'hydrRoomWait';
    overlay.className = 'hydr-room-wait';
    overlay.innerHTML = `
      <div class="hydr-room-wait-card">
        <div>
          <div class="hydr-room-wait-title">กำลังรอเพื่อน${state.mode === 'race' || state.mode === 'coop' ? ' / ทีม' : ''}</div>
          <div class="hydr-room-wait-sub" id="hydrRoomWaitSub">
            ตอนนี้ 1/${state.required} คน • ต้องมีอย่างน้อย ${state.required} คน
          </div>
        </div>

        <div class="hydr-room-codebox">
          <div class="hydr-room-code-label">ROOM CODE</div>
          <div class="hydr-room-code" id="hydrRoomCodeText">${esc(roomCode)}</div>
          <div class="hydr-room-sub">ให้เพื่อนเข้า Hydration Arena แล้วใส่รหัสนี้</div>
        </div>

        <div class="hydr-room-linkbox">
          <strong>ลิงก์สำรอง</strong>
          <input id="hydrRoomShareLink" readonly value="${esc(shareUrl.toString())}">
          <div class="hydr-room-sub">ใช้เมื่อต้องส่งลิงก์ตรงให้เพื่อน</div>
        </div>

        <div class="hydr-room-actions">
          <button class="hydr-room-btn" id="hydrRoomCopyCode" type="button">Copy Code</button>
          <button class="hydr-room-btn" id="hydrRoomCopyLink" type="button">Copy Link</button>
          <button class="hydr-room-btn secondary" id="hydrRoomStartPractice" type="button">ซ้อมคนเดียวชั่วคราว</button>
        </div>

        <div class="hydr-room-board">
          <div class="hydr-room-head">
            <div class="hydr-room-title">ผู้เล่นในห้อง</div>
            <div class="hydr-room-sub" id="hydrRoomWaitCount">0/${state.required}</div>
          </div>
          <div class="hydr-room-players" id="hydrRoomWaitPlayers"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    $('#hydrRoomCopyCode')?.addEventListener('click', async () => {
      const code = displayRoomCode();
      try{
        await navigator.clipboard.writeText(code);
        $('#hydrRoomCopyCode').textContent = 'Copied!';
        setTimeout(() => $('#hydrRoomCopyCode').textContent = 'Copy Code', 1200);
      }catch(e){
        const temp = document.createElement('input');
        temp.value = code;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }
    });

    $('#hydrRoomCopyLink')?.addEventListener('click', async () => {
      const input = $('#hydrRoomShareLink');
      try{
        input.select();
        await navigator.clipboard.writeText(input.value);
        $('#hydrRoomCopyLink').textContent = 'Copied!';
        setTimeout(() => $('#hydrRoomCopyLink').textContent = 'Copy Link', 1200);
      }catch(e){
        input.select();
        document.execCommand('copy');
      }
    });

    $('#hydrRoomStartPractice')?.addEventListener('click', () => {
      state.roomReady = true;
      hideWaitOverlay();
      window.dispatchEvent(new CustomEvent('hha:hydration:room-practice', {
        detail:{ mode:state.mode, roomId:state.roomId, roomCode:displayRoomCode() }
      }));
    });
  }

  function showWaitOverlay(){
    const el = document.getElementById('hydrRoomWait');
    if(el) el.hidden = false;
  }

  function hideWaitOverlay(){
    const el = document.getElementById('hydrRoomWait');
    if(el) el.hidden = true;
  }

  function renderPlayers(players){
    const now = Date.now();

    const cleanAll = players
      .filter(p => now - Number(p.lastSeen || p.lastPingAt || 0) < 12000)
      .sort((a,b) => Number(a.joinedAt || 0) - Number(b.joinedAt || 0));

    const active = cleanAll.slice(0, state.maxPlayers).map((p, index) => {
      const slot = index;
      const role = roleForSlot(state.mode, slot);
      return {
        ...p,
        slot,
        role,
        active:true
      };
    });

    const overflow = cleanAll.slice(state.maxPlayers).map((p, index) => ({
      ...p,
      slot:state.maxPlayers + index,
      role:'spectator',
      active:false
    }));

    const clean = active;
    state.lastPlayers = clean;

    const meActive = clean.some(p => p.id === state.playerId || p.uid === state.uid);
    const meExists = cleanAll.some(p => p.id === state.playerId || p.uid === state.uid);

    if(state.myRef && meActive){
      const me = clean.find(p => p.id === state.playerId || p.uid === state.uid);
      if(me && (me.role !== state.role || Number(me.slot) !== Number(state.slot))){
        state.role = me.role;
        state.slot = me.slot;

        state.myRef.update({
          role:me.role,
          slot:me.slot,
          active:true,
          lastPingAt:Date.now()
        }).catch(() => {});
      }
    }

    if(state.myRef && !meActive && meExists){
      state.myRef.update({
        active:false,
        role:'spectator',
        slot:state.maxPlayers,
        lastPingAt:Date.now()
      }).catch(() => {});
    }

    const html = clean.map(p => {
      const me = p.id === state.playerId || p.uid === state.uid;
      const rank = getLiveRank(clean, p.id || p.uid);

      return `
        <div class="hydr-room-player ${me ? 'me' : 'peer'}">
          <div>
            <div class="hydr-room-name">
              ${state.mode === 'race' ? `#${rank} ` : ''}
              ${me ? 'ฉัน • ' : ''}${esc(p.name || p.displayName || 'Player')}
            </div>
            <div class="hydr-room-role">
              Slot ${Number(p.slot || 0) + 1} • ${esc(roleLabel(p.role, p.slot))}
            </div>
          </div>

          <div class="hydr-room-score">
            <div class="hydr-room-mini"><div class="k">SCORE</div><div class="v">${esc(p.score ?? 0)}</div></div>
            <div class="hydr-room-mini"><div class="k">WATER</div><div class="v">${esc(p.water ?? 0)}%</div></div>
            <div class="hydr-room-mini"><div class="k">MISS</div><div class="v">${esc(p.miss ?? 0)}</div></div>
          </div>
        </div>
      `;
    }).join('');

    const overflowHtml = overflow.length
      ? `<div class="hydr-room-sub">ห้องเต็มแล้ว: ${overflow.length} คนอยู่ในสถานะผู้ชม</div>`
      : '';

    const board = document.getElementById('hydrRoomPlayers');
    if(board){
      board.innerHTML = html || `<div class="hydr-room-sub">ยังไม่มีผู้เล่น</div>`;
    }

    const waitBoard = document.getElementById('hydrRoomWaitPlayers');
    if(waitBoard){
      waitBoard.innerHTML = (html + overflowHtml) || `<div class="hydr-room-sub">กำลังเข้าเกม...</div>`;
    }

    const countText = `${clean.length}/${state.maxPlayers}`;
    const readyText = clean.length >= state.required
      ? `พร้อมเล่น • ${clean.length}/${state.maxPlayers}`
      : `รอเพื่อน • ${clean.length}/${state.required}`;

    setText('hydrRoomCount', countText);
    setText('hydrRoomWaitCount', readyText);

    const ready = clean.length >= state.required && meActive;

    if(ready && !state.roomReady){
      state.roomReady = true;
      hideWaitOverlay();

      window.dispatchEvent(new CustomEvent('hha:hydration:room-ready', {
        detail:{
          mode:state.mode,
          roomId:state.roomId,
          roomCode:displayRoomCode(),
          players:clean,
          maxPlayers:state.maxPlayers
        }
      }));
    }

    if(!ready && isMultiplayer()){
      state.roomReady = false;
      showWaitOverlay();
    }

    const status = state.dbReady
      ? `Room Code: ${displayRoomCode()} • ${ready ? 'พร้อมเล่น' : 'รอเพื่อน'} • ${clean.length}/${state.maxPlayers}`
      : `Room Code: ${displayRoomCode()} • offline fallback`;

    setText('hydrRoomStatus', status);

    const waitSub = document.getElementById('hydrRoomWaitSub');
    if(waitSub){
      if(!meActive && meExists){
        waitSub.textContent = `ห้องเต็มแล้ว โหมด ${state.mode} รับสูงสุด ${state.maxPlayers} คน`;
      }else{
        waitSub.textContent = ready
          ? `พร้อมแล้ว มีผู้เล่น ${clean.length}/${state.maxPlayers} คน`
          : `ตอนนี้ ${clean.length}/${state.required} คน • ต้องมีอย่างน้อย ${state.required} คน`;
      }
    }

    updateExistingDuetOverlay(clean, ready);
  }

  function updateExistingDuetOverlay(players, ready){
    if(state.mode !== 'duet') return;

    const me = players.find(p => p.id === state.playerId || p.uid === state.uid);
    const peer = players.find(p => p.id !== state.playerId && p.uid !== state.uid);

    setText('duetGateMeName', me?.name || me?.displayName || state.playerName);
    setText('duetGateMeState', me ? `${roleLabel(me.role, me.slot)} • พร้อม` : 'กำลังเข้าเกม');

    setText('duetGatePeerName', peer?.name || peer?.displayName || 'กำลังรอเพื่อน');
    setText('duetGatePeerState', peer ? `${roleLabel(peer.role, peer.slot)} • พร้อม` : 'ยังไม่เข้าเกม');

    setText('duetGateCountdown', ready ? 'พร้อมแล้ว เริ่มภารกิจคู่หู!' : `รอเพื่อน ${players.length}/${state.required}`);
  }

  function renderSummary(){
    const end = document.getElementById('end');
    if(!end || end.getAttribute('aria-hidden') !== 'false') return;

    if(!isMultiplayer()) return;

    const card = $('#end .overlay-card') || end;
    if(!card || document.getElementById('hydrRoomSummary')) return;

    const players = state.lastPlayers.length ? state.lastPlayers : [
      {
        id:state.playerId,
        uid:state.uid,
        name:state.playerName,
        role:state.role,
        slot:state.slot || 0,
        ...getStats()
      }
    ];

    const sorted = [...players].sort((a,b) => {
      if(state.mode === 'race'){
        const bw = Number(b.water || 0);
        const aw = Number(a.water || 0);
        if(bw !== aw) return bw - aw;

        const bs = Number(b.score || 0);
        const as = Number(a.score || 0);
        if(bs !== as) return bs - as;

        return Number(a.miss || 0) - Number(b.miss || 0);
      }

      return Number(b.score || 0) - Number(a.score || 0);
    });

    const winner = sorted[0];

    const teamScore = players.reduce((sum,p) => sum + Number(p.score || 0), 0);
    const teamWaterAvg = Math.round(
      players.reduce((sum,p) => sum + Number(p.water || 0), 0) / Math.max(1, players.length)
    );
    const teamMiss = players.reduce((sum,p) => sum + Number(p.miss || 0), 0);

    const html = `
      <section id="hydrRoomSummary" class="hydr-room-summary">
        <div class="hydr-room-head">
          <div>
            <div class="hydr-room-title">👥 คะแนนผู้เล่นในห้อง</div>
            <div class="hydr-room-sub">
              ${state.mode === 'race' ? 'Race รองรับ 2–10 คน • จัดอันดับจาก Water, Score, Miss' : ''}
              ${state.mode === 'coop' ? 'Coop รองรับ 2–10 คน • ดูคะแนนทีมและ contribution' : ''}
              ${state.mode === 'duet' ? 'Duet ต้องดูคะแนนทั้งคู่ + Team Sync' : ''}
              ${state.mode === 'battle' ? 'Battle ดูคะแนน + การป้องกัน + พายุ' : ''}
            </div>
          </div>
          <div class="hydr-room-sub">Room Code: ${esc(displayRoomCode())} • ${players.length}/${state.maxPlayers}</div>
        </div>

        <div class="hydr-room-summary-grid">
          ${sorted.map((p, idx) => {
            const me = p.id === state.playerId || p.uid === state.uid;
            return `
              <div class="hydr-room-summary-player">
                <div class="name">
                  ${state.mode === 'race' ? `#${idx + 1} ` : ''}
                  ${me ? 'ฉัน • ' : ''}${esc(p.name || p.displayName || 'Player')}
                </div>
                <div class="score">${esc(p.score ?? 0)}</div>
                <div class="meta">
                  Slot ${Number(p.slot || 0) + 1} • ${esc(roleLabel(p.role, p.slot))}<br>
                  Water ${esc(p.water ?? 0)}% • Miss ${esc(p.miss ?? 0)} • Grade ${esc(p.grade ?? '-')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="hydr-room-sub">
          ${state.mode === 'coop'
            ? `🤝 Team Result • ผู้เล่น ${players.length} คน • คะแนนรวม ${teamScore} • Water เฉลี่ย ${teamWaterAvg}% • Miss รวม ${teamMiss}`
            : `🏆 อันดับ 1: ${esc(winner?.name || winner?.displayName || 'Player')} • ${esc(winner?.score ?? 0)} คะแนน`
          }
        </div>
      </section>
    `;

    const actions = card.querySelector('.overlay-actions');
    if(actions){
      actions.insertAdjacentHTML('beforebegin', html);
    }else{
      card.insertAdjacentHTML('beforeend', html);
    }

    if(state.mode === 'duet'){
      const me = players.find(p => p.id === state.playerId || p.uid === state.uid);
      const peer = players.find(p => p.id !== state.playerId && p.uid !== state.uid);

      const board = document.getElementById('duetEndBoard');
      if(board) board.classList.remove('hidden');

      setText('duetEndMeName', me?.name || me?.displayName || 'ฉัน');
      setText('duetEndMeScore', me?.score ?? 0);
      setText('duetEndMeMeta', `${roleLabel(me?.role, me?.slot)} • Water ${me?.water ?? 0}% • เกรด ${me?.grade ?? '-'}`);

      setText('duetEndPeerName', peer?.name || peer?.displayName || 'เพื่อน');
      setText('duetEndPeerScore', peer?.score ?? 0);
      setText('duetEndPeerMeta', peer
        ? `${roleLabel(peer.role, peer.slot)} • Water ${peer.water ?? 0}% • เกรด ${peer.grade ?? '-'}`
        : 'ยังไม่มีข้อมูลเพื่อน'
      );

      if(peer && me){
        const msg = Number(me.score || 0) === Number(peer.score || 0)
          ? '🤝 เสมอกันสุดมันส์'
          : Number(me.score || 0) > Number(peer.score || 0)
            ? '🏆 คุณทำคะแนนสูงกว่า'
            : '🌟 เพื่อนทำคะแนนสูงกว่า';
        setText('duetEndWinner', msg);
      }
    }
  }

  function getFirebaseDb(){
    try{
      if(typeof window.HHA_bootstrapFirebaseCompat === 'function'){
        window.HHA_bootstrapFirebaseCompat();
      }

      if(!window.firebase || !window.firebase.database) return null;

      return window.firebase.database();
    }catch(err){
      console.warn('[hydration-room-sync] firebase not ready:', err);
      return null;
    }
  }

  async function tryAnonAuth(){
    try{
      if(!window.firebase || !window.firebase.auth) return null;
      const auth = window.firebase.auth();
      if(!auth.currentUser){
        await auth.signInAnonymously();
      }
      return auth.currentUser;
    }catch(err){
      console.warn('[hydration-room-sync] anonymous auth skipped/failed:', err);
      return null;
    }
  }

  async function connectRoom(){
    if(!isMultiplayer()) return;

    injectStyle();
    createBoard();
    createWaitOverlay();
    showWaitOverlay();

    const user = await tryAnonAuth();
    if(user && user.uid){
      state.uid = user.uid;
      state.playerId = user.uid;
    }

    const db = getFirebaseDb();

    state.role = inferRole();

    if(!db || !state.uid){
      state.dbReady = false;

      renderPlayers([{
        id:state.playerId,
        uid:state.uid || state.playerId,
        name:state.playerName,
        role:state.role,
        slot:0,
        joinedAt:Date.now(),
        lastSeen:Date.now(),
        lastPingAt:Date.now(),
        ...getStats()
      }]);

      return;
    }

    state.dbReady = true;

    const roomPath = `rooms/hydration/${state.mode}/${state.roomId}`;
    state.ref = db.ref(roomPath);
    state.myRef = state.ref.child(`players/${state.uid}`);
    state.progressRef = state.ref.child(`progress/${state.uid}`);

    const firstPayload = {
      uid:state.uid,
      id:state.uid,
      pid:qs('pid', 'anon'),
      name:state.playerName,
      role:state.role,
      mode:state.mode,
      ready:true,
      active:true,
      joinedAt:Date.now(),
      lastPingAt:Date.now(),
      lastSeen:Date.now(),
      slot:0,
      score:0,
      water:40,
      miss:0
    };

    try{
      const metaRef = state.ref.child('meta');

      const metaPayload = {
        roomId:state.roomId,
        game:'hydration',
        zone:'nutrition',
        mode:state.mode,
        hostUid:state.uid,
        state:'lobby',
        diff:qs('diff', 'normal'),
        timeSec:Number(qs('time', 80)) || 80,
        seed:String(qs('seed', Date.now())),
        capacity:state.maxPlayers,
        teamMode:state.mode === 'coop',
        createdAt:Date.now(),
        updatedAt:Date.now()
      };

      const metaSnap = await metaRef.once('value');
      if(!metaSnap.exists()){
        await metaRef.set(metaPayload);
      }else{
        await metaRef.update({
          updatedAt:Date.now(),
          capacity:state.maxPlayers
        });
      }

      await state.myRef.set(firstPayload);
      state.myRef.onDisconnect().remove();

      await state.progressRef.set({
        updatedAt:Date.now(),
        score:0,
        water:40,
        miss:0,
        block:0,
        combo:0,
        shield:0,
        grade:'D',
        role:state.role,
        slot:0,
        active:true
      });
      state.progressRef.onDisconnect().remove();

    }catch(err){
      console.warn('[hydration-room-sync] write failed:', err);
      state.dbReady = false;
      renderPlayers([firstPayload]);
      return;
    }

    state.ref.child('players').on('value', async snap => {
      const val = snap.val() || {};
      const players = Object.keys(val).map(k => val[k]).filter(Boolean);

      try{
        const progressSnap = await state.ref.child('progress').once('value');
        const progressVal = progressSnap.val() || {};

        const merged = players.map(p => ({
          ...p,
          ...(progressVal[p.uid] || {})
        }));

        renderPlayers(merged);
      }catch(e){
        renderPlayers(players);
      }
    });

    state.ref.child('progress').on('value', snap => {
      const progressVal = snap.val() || {};
      const merged = state.lastPlayers.map(p => ({
        ...p,
        ...(progressVal[p.uid] || {})
      }));

      if(merged.length) renderPlayers(merged);
    });
  }

  async function publishStats(){
    if(!isMultiplayer()) return;

    const stats = getStats();

    const playerPayload = {
      uid:state.uid || state.playerId,
      id:state.uid || state.playerId,
      pid:qs('pid', 'anon'),
      name:state.playerName,
      role:state.role || inferRole(),
      slot:state.slot || 0,
      mode:state.mode,
      ready:true,
      active:true,
      joinedAt:state.startedAt,
      lastSeen:Date.now(),
      lastPingAt:Date.now(),
      score:stats.score,
      water:stats.water,
      miss:stats.miss
    };

    const progressPayload = {
      updatedAt:Date.now(),
      score:stats.score,
      water:stats.water,
      miss:stats.miss,
      expire:stats.expire,
      block:stats.block,
      combo:stats.combo,
      shield:stats.shield,
      grade:stats.grade,
      role:state.role || inferRole(),
      slot:state.slot || 0,
      active:true
    };

    if(!state.dbReady || !state.myRef || !state.progressRef){
      renderPlayers([playerPayload, ...state.lastPlayers.filter(p => p.id !== state.playerId && p.uid !== state.uid)]);
      return;
    }

    try{
      await state.myRef.update(playerPayload);
      await state.progressRef.update(progressPayload);
    }catch(err){
      console.warn('[hydration-room-sync] publish failed:', err);
    }
  }

  async function publishResultIfEnded(){
    const end = document.getElementById('end');
    if(!end || end.getAttribute('aria-hidden') !== 'false') return;
    if(state.resultPublished) return;
    if(!state.dbReady || !state.ref || !state.uid) return;

    state.resultPublished = true;

    const stats = getStats();

    try{
      await state.ref.child(`results/${state.uid}`).set({
        uid:state.uid,
        pid:qs('pid', 'anon'),
        score:stats.score,
        miss:stats.miss,
        bestStreak:stats.combo,
        finished:true,
        updatedAt:Date.now(),
        water:stats.water,
        block:stats.block,
        combo:stats.combo,
        shield:stats.shield,
        grade:stats.grade,
        role:state.role,
        slot:state.slot || 0
      });
    }catch(err){
      console.warn('[hydration-room-sync] publish result failed:', err);
    }
  }

  function tick(){
    publishStats();
    publishResultIfEnded();
    renderSummary();
  }

  function expose(){
    window.HHAHydrationRoomSync = {
      version:VERSION,
      state,
      getStats,
      renderPlayers,
      publishStats,
      roleForSlot,
      roleLabel,
      getLiveRank,
      displayRoomCode,
      normalizeRoomCode,
      isRoomReady:() => state.roomReady
    };
  }

  function init(){
    state.role = inferRole();

    if(!isMultiplayer()){
      expose();
      return;
    }

    injectStyle();
    createBoard();
    createWaitOverlay();

    connectRoom();
    expose();

    setInterval(tick, 900);

    window.addEventListener('beforeunload', () => {
      try{
        if(state.myRef) state.myRef.remove();
        if(state.progressRef) state.progressRef.remove();
      }catch(e){}
    });

    console.info('[hydration-room-sync] ready', {
      version:VERSION,
      mode:state.mode,
      roomId:state.roomId,
      roomCode:displayRoomCode(),
      playerId:state.playerId,
      required:state.required,
      maxPlayers:state.maxPlayers
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }
})();
