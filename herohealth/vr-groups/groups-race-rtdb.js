// === /herohealth/vr-groups/groups-race-rtdb.js ===
// Groups Race RTDB — 1v1 Race transport
// FULL v20260307a-GROUPS-RACE-RTDB
// ✅ create room / join room
// ✅ ready state
// ✅ countdown / playing / ended
// ✅ publish score snapshots
// ✅ publish finish summary
// ✅ decide winner by GroupsRaceScore
// ✅ onDisconnect connected=false
// ✅ subscribe room + players
// Requires:
// - window.firebase (compat SDK or equivalent exposing database())
// - window.GroupsRaceScore

'use strict';

(function(root){
  const WIN = root || window;

  function nowMs(){ return Date.now(); }
  function n(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }
  function s(v, d=''){ return (v===undefined || v===null) ? d : String(v); }
  function clamp(v,a,b){ v=n(v,a); return Math.max(a, Math.min(b,v)); }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  function randId(len=6){
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for(let i=0;i<len;i++) out += chars[(Math.random()*chars.length)|0];
    return out;
  }

  function requireDb(){
    const fb = WIN.firebase;
    if(!fb || typeof fb.database !== 'function'){
      throw new Error('[GroupsRaceRTDB] firebase.database() not found');
    }
    const db = fb.database();
    if(!db) throw new Error('[GroupsRaceRTDB] RTDB not available');
    return db;
  }

  function scoreUtil(){
    const U = WIN.GroupsRaceScore;
    if(!U || typeof U.pickRaceWinner !== 'function'){
      throw new Error('[GroupsRaceRTDB] GroupsRaceScore not loaded');
    }
    return U;
  }

  function roomPath(roomId){ return `herohealth/groups-race/rooms/${roomId}`; }
  function playerPath(roomId, playerKey){ return `${roomPath(roomId)}/players/${playerKey}`; }

  function normalizePlayerState(x = {}){
    return {
      playerKey: s(x.playerKey || ''),
      pid: s(x.pid || ''),
      name: s(x.name || ''),
      ready: !!x.ready,
      connected: ('connected' in x) ? !!x.connected : true,
      joinedAt: n(x.joinedAt, 0),

      score: n(x.score, 0),
      combo: n(x.combo, 0),
      miss: n(x.miss, n(x.misses, 0)),
      accuracyPct: n(x.accuracyPct, n(x.accPct, 0)),
      comboMax: n(x.comboMax, 0),
      timeLeft: n(x.timeLeft, 0),

      finished: !!x.finished,
      finishAt: n(x.finishAt, 0),
      summary: x.summary || null,
      at: n(x.at, 0)
    };
  }

  class GroupsRaceRTDB {
    constructor(opts = {}){
      this.db = requireDb();
      this.score = scoreUtil();

      this.roomId = s(opts.roomId || '');
      this.playerKey = s(opts.playerKey || '');
      this.role = s(opts.role || '');
      this.pid = s(opts.pid || '');
      this.name = s(opts.name || this.playerKey || 'Player');
      this.diff = s(opts.diff || 'normal').toLowerCase();
      this.timeSec = clamp(opts.timeSec || opts.time || 90, 15, 300);
      this.seed = s(opts.seed || '');
      this.view = s(opts.view || 'mobile').toLowerCase();

      this.roomRef = null;
      this.playersRef = null;
      this.meRef = null;

      this.unsubs = [];
      this.lastScoreSentAt = 0;
      this.scoreThrottleMs = clamp(opts.scoreThrottleMs || 300, 120, 1000);

      this.state = {
        room: null,
        players: {},
        me: null,
        opponent: null
      };
    }

    // ---------- helpers ----------
    _ensureRoomId(){
      if(!this.roomId) this.roomId = 'GRP' + randId(6);
      return this.roomId;
    }

    _ensureSeed(){
      if(!this.seed) this.seed = `grp-race-${this._ensureRoomId()}`;
      return this.seed;
    }

    _roomRef(){
      this._ensureRoomId();
      if(!this.roomRef) this.roomRef = this.db.ref(roomPath(this.roomId));
      return this.roomRef;
    }

    _playersRef(){
      if(!this.playersRef) this.playersRef = this.db.ref(`${roomPath(this.roomId)}/players`);
      return this.playersRef;
    }

    _meRef(){
      if(!this.playerKey) throw new Error('[GroupsRaceRTDB] playerKey required');
      if(!this.meRef) this.meRef = this.db.ref(playerPath(this.roomId, this.playerKey));
      return this.meRef;
    }

    _baseRoomState(extra = {}){
      return {
        roomId: this.roomId,
        game: 'groups',
        mode: 'race',
        status: 'lobby', // lobby | countdown | playing | ended
        createdAt: nowMs(),
        updatedAt: nowMs(),
        hostKey: this.role === 'host' ? this.playerKey : '',
        guestKey: this.role === 'guest' ? this.playerKey : '',
        seed: this._ensureSeed(),
        diff: this.diff,
        timeSec: this.timeSec,
        startAt: 0,
        endAt: 0,
        winnerKey: '',
        winner: null,
        loser: null,
        rule: '',
        tieReason: '',
        isDraw: false,
        ...extra
      };
    }

    _basePlayerState(extra = {}){
      return {
        playerKey: this.playerKey,
        pid: this.pid,
        name: this.name,
        role: this.role,
        ready: false,
        connected: true,
        joinedAt: nowMs(),

        score: 0,
        combo: 0,
        miss: 0,
        accuracyPct: 0,
        comboMax: 0,
        timeLeft: this.timeSec,

        finished: false,
        finishAt: 0,
        summary: null,
        at: nowMs(),
        ...extra
      };
    }

    _opponentOf(playersObj){
      const keys = Object.keys(playersObj || {}).filter(k => k !== this.playerKey);
      if(!keys.length) return null;
      return normalizePlayerState(playersObj[keys[0]]);
    }

    // ---------- room lifecycle ----------
    async createRoom(){
      this.role = this.role || 'host';
      this._ensureRoomId();
      this._ensureSeed();

      const roomRef = this._roomRef();
      const meRef = this._meRef();

      const roomData = this._baseRoomState({
        hostKey: this.playerKey
      });

      const updates = {};
      updates[roomPath(this.roomId)] = roomData;
      updates[playerPath(this.roomId, this.playerKey)] = this._basePlayerState();

      await this.db.ref().update(updates);

      try{
        meRef.onDisconnect().update({
          connected: false,
          at: nowMs()
        });
      }catch(_){}

      emit('groups:race_room_created', {
        roomId: this.roomId,
        playerKey: this.playerKey,
        role: this.role,
        seed: this.seed
      });

      return {
        roomId: this.roomId,
        playerKey: this.playerKey,
        role: this.role,
        seed: this.seed
      };
    }

    async joinRoom(roomId){
      this.roomId = s(roomId || this.roomId || '');
      this.role = this.role || 'guest';

      if(!this.roomId) throw new Error('[GroupsRaceRTDB] joinRoom requires roomId');

      const snap = await this._roomRef().get();
      if(!snap.exists()) throw new Error('[GroupsRaceRTDB] room not found');

      const room = snap.val() || {};
      const hostKey = s(room.hostKey || '');
      const guestKey = s(room.guestKey || '');

      if(!hostKey) throw new Error('[GroupsRaceRTDB] invalid room: missing host');

      if(guestKey && guestKey !== this.playerKey){
        throw new Error('[GroupsRaceRTDB] room already full');
      }

      this.seed = s(room.seed || this.seed || `grp-race-${this.roomId}`);
      this.diff = s(room.diff || this.diff || 'normal').toLowerCase();
      this.timeSec = clamp(room.timeSec || this.timeSec || 90, 15, 300);

      const updates = {};
      if(!guestKey){
        updates[`${roomPath(this.roomId)}/guestKey`] = this.playerKey;
      }
      updates[playerPath(this.roomId, this.playerKey)] = this._basePlayerState();

      await this.db.ref().update(updates);

      try{
        this._meRef().onDisconnect().update({
          connected: false,
          at: nowMs()
        });
      }catch(_){}

      emit('groups:race_room_joined', {
        roomId: this.roomId,
        playerKey: this.playerKey,
        role: this.role,
        seed: this.seed
      });

      return {
        roomId: this.roomId,
        playerKey: this.playerKey,
        role: this.role,
        seed: this.seed
      };
    }

    async setReady(ready = true){
      await this._meRef().update({
        ready: !!ready,
        connected: true,
        at: nowMs()
      });

      emit('groups:race_ready_changed', {
        roomId: this.roomId,
        playerKey: this.playerKey,
        ready: !!ready
      });

      return true;
    }

    async maybeStartCountdown(countdownMs = 3000){
      const snap = await this._roomRef().get();
      if(!snap.exists()) return false;

      const room = snap.val() || {};
      const players = room.players || {};
      const host = room.hostKey || '';
      const guest = room.guestKey || '';

      if(!host || !guest) return false;

      const a = normalizePlayerState(players[host] || {});
      const b = normalizePlayerState(players[guest] || {});

      if(!a.ready || !b.ready) return false;
      if(String(room.status || 'lobby') === 'countdown' || String(room.status || '') === 'playing') return false;

      const startAt = nowMs() + clamp(countdownMs, 1000, 10000);
      const endAt = startAt + (clamp(room.timeSec || this.timeSec || 90, 15, 300) * 1000);

      await this._roomRef().update({
        status: 'countdown',
        startAt,
        endAt,
        updatedAt: nowMs()
      });

      emit('groups:race_countdown_set', {
        roomId: this.roomId,
        startAt,
        endAt
      });

      return true;
    }

    async setPlayingIfCountdownReached(){
      const snap = await this._roomRef().get();
      if(!snap.exists()) return false;

      const room = snap.val() || {};
      const status = String(room.status || 'lobby');
      const startAt = n(room.startAt, 0);

      if(status !== 'countdown') return false;
      if(startAt <= 0) return false;
      if(nowMs() < startAt) return false;

      await this._roomRef().update({
        status: 'playing',
        updatedAt: nowMs()
      });

      emit('groups:race_started', {
        roomId: this.roomId,
        startAt,
        endAt: n(room.endAt, 0)
      });

      return true;
    }

    // ---------- score sync ----------
    async publishScore(payload = {}){
      const t = nowMs();
      if((t - this.lastScoreSentAt) < this.scoreThrottleMs) return false;
      this.lastScoreSentAt = t;

      const safe = normalizePlayerState({
        ...payload,
        playerKey: this.playerKey,
        pid: this.pid,
        name: this.name,
        connected: true,
        at: t
      });

      await this._meRef().update({
        score: safe.score,
        combo: safe.combo,
        miss: safe.miss,
        accuracyPct: safe.accuracyPct,
        comboMax: safe.comboMax,
        timeLeft: safe.timeLeft,
        connected: true,
        at: safe.at
      });

      emit('groups:race_local_score_published', {
        roomId: this.roomId,
        playerKey: this.playerKey,
        ...safe
      });

      return true;
    }

    async publishFinished(summary = {}){
      const t = nowMs();
      const normalized = normalizePlayerState({
        ...summary,
        playerKey: this.playerKey,
        pid: this.pid,
        name: this.name,
        connected: true,
        finished: true,
        finishAt: n(summary.finishAt, t),
        at: t
      });

      await this._meRef().update({
        score: normalized.score,
        combo: normalized.combo,
        miss: normalized.miss,
        accuracyPct: normalized.accuracyPct,
        comboMax: normalized.comboMax,
        timeLeft: normalized.timeLeft,
        connected: true,
        finished: true,
        finishAt: normalized.finishAt,
        summary: summary || null,
        at: t
      });

      emit('groups:race_local_finished_published', {
        roomId: this.roomId,
        playerKey: this.playerKey,
        summary
      });

      return true;
    }

    async maybeFinalizeRoom(){
      const snap = await this._roomRef().get();
      if(!snap.exists()) return false;

      const room = snap.val() || {};
      const status = String(room.status || '');
      const hostKey = s(room.hostKey || '');
      const guestKey = s(room.guestKey || '');

      if(!hostKey || !guestKey) return false;
      if(status === 'ended') return true;

      const players = room.players || {};
      const aRaw = players[hostKey] || null;
      const bRaw = players[guestKey] || null;
      if(!aRaw || !bRaw) return false;

      const a = normalizePlayerState(aRaw);
      const b = normalizePlayerState(bRaw);

      const endAt = n(room.endAt, 0);
      const timeExpired = (endAt > 0 && nowMs() >= endAt);
      const bothFinished = !!a.finished && !!b.finished;

      if(!timeExpired && !bothFinished) return false;

      const dec = this.score.pickRaceWinner(
        { playerKey: hostKey, ...a },
        { playerKey: guestKey, ...b }
      );

      const out = this.score.toSerializableDecision(dec);

      await this._roomRef().update({
        status: 'ended',
        winnerKey: out.winnerKey || '',
        winner: out.winner || null,
        loser: out.loser || null,
        rule: out.rule || '',
        tieReason: out.tieReason || '',
        isDraw: !!out.isDraw,
        updatedAt: nowMs()
      });

      emit('groups:race_end', {
        roomId: this.roomId,
        ...out
      });

      return true;
    }

    // ---------- subscriptions ----------
    subscribe(){
      const roomRef = this._roomRef();
      const playersRef = this._playersRef();

      const onRoom = snap => {
        const room = snap.val() || null;
        this.state.room = room;

        emit('groups:race_room', {
          roomId: this.roomId,
          room
        });

        // auto move countdown -> playing if time reached
        this.setPlayingIfCountdownReached().catch(()=>{});
      };

      const onPlayers = snap => {
        const players = snap.val() || {};
        this.state.players = players;
        this.state.me = normalizePlayerState(players[this.playerKey] || {});
        this.state.opponent = this._opponentOf(players);

        emit('groups:race_players', {
          roomId: this.roomId,
          players,
          me: this.state.me,
          opponent: this.state.opponent
        });

        if(this.state.opponent){
          emit('groups:race_remote_score', {
            roomId: this.roomId,
            playerKey: this.state.opponent.playerKey,
            ...this.state.opponent
          });
        }

        this.maybeFinalizeRoom().catch(()=>{});
      };

      roomRef.on('value', onRoom);
      playersRef.on('value', onPlayers);

      this.unsubs.push(() => roomRef.off('value', onRoom));
      this.unsubs.push(() => playersRef.off('value', onPlayers));

      return true;
    }

    unsubscribe(){
      while(this.unsubs.length){
        const fn = this.unsubs.pop();
        try{ fn && fn(); }catch(_){}
      }
      return true;
    }

    // ---------- helpers for UI ----------
    getState(){
      return {
        roomId: this.roomId,
        playerKey: this.playerKey,
        role: this.role,
        room: this.state.room,
        players: this.state.players,
        me: this.state.me,
        opponent: this.state.opponent
      };
    }

    getLeadStatus(){
      const me = this.state.me || null;
      const op = this.state.opponent || null;
      if(!me || !op) return 'WAIT';

      const diff = n(me.score,0) - n(op.score,0);
      if(diff > 12) return 'LEAD';
      if(diff < -12) return 'BEHIND';
      return 'CLOSE';
    }

    async leaveRoomSoft(){
      try{
        await this._meRef().update({
          connected: false,
          ready: false,
          at: nowMs()
        });
      }catch(_){}
      return true;
    }

    async rematchResetIfHost(){
      const snap = await this._roomRef().get();
      if(!snap.exists()) return false;

      const room = snap.val() || {};
      if(String(room.hostKey || '') !== String(this.playerKey || '')) return false;

      const seed = `grp-race-${this.roomId}-${nowMs()}`;
      const timeSec = clamp(room.timeSec || this.timeSec || 90, 15, 300);

      const updates = {
        status: 'lobby',
        seed,
        startAt: 0,
        endAt: 0,
        winnerKey: '',
        winner: null,
        loser: null,
        rule: '',
        tieReason: '',
        isDraw: false,
        updatedAt: nowMs()
      };

      const players = room.players || {};
      Object.keys(players).forEach(k => {
        updates[`players/${k}/ready`] = false;
        updates[`players/${k}/score`] = 0;
        updates[`players/${k}/combo`] = 0;
        updates[`players/${k}/miss`] = 0;
        updates[`players/${k}/accuracyPct`] = 0;
        updates[`players/${k}/comboMax`] = 0;
        updates[`players/${k}/timeLeft`] = timeSec;
        updates[`players/${k}/finished`] = false;
        updates[`players/${k}/finishAt`] = 0;
        updates[`players/${k}/summary`] = null;
        updates[`players/${k}/at`] = nowMs();
      });

      await this._roomRef().update(updates);
      return true;
    }
  }

  WIN.GroupsRaceRTDB = GroupsRaceRTDB;
})(typeof window !== 'undefined' ? window : globalThis);