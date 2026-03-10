// === /herohealth/vr-groups/groups-race-rtdb.js ===
// Groups Race RTDB Adapter
// FULL v20260310-GROUPS-RACE-RTDB-FINAL
(function(){
  'use strict';

  function n(v, d=0){
    v = Number(v);
    return Number.isFinite(v) ? v : d;
  }

  function emit(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(_){}
  }

  function now(){ return Date.now(); }

  function getFirebaseDB(){
    if(window.firebase && window.firebase.database){
      return window.firebase.database();
    }
    throw new Error('Firebase RTDB not available');
  }

  function clone(obj){
    try{ return JSON.parse(JSON.stringify(obj || null)); }
    catch(_){ return obj || null; }
  }

  class GroupsRaceRTDB {
    constructor(cfg){
      cfg = cfg || {};

      this.roomId = String(cfg.roomId || '').trim();
      this.playerKey = String(cfg.playerKey || '').trim();
      this.role = String(cfg.role || 'guest').toLowerCase();
      this.pid = String(cfg.pid || '').trim();
      this.name = String(cfg.name || this.playerKey || 'Player').trim();
      this.diff = String(cfg.diff || 'normal').toLowerCase();
      this.timeSec = n(cfg.timeSec, 90);
      this.seed = String(cfg.seed || Date.now());
      this.view = String(cfg.view || 'mobile').toLowerCase();

      if(!this.roomId) throw new Error('missing roomId');
      if(!this.playerKey) throw new Error('missing playerKey');

      this.db = getFirebaseDB();
      this.baseRef = this.db.ref('herohealth/groupsRaceRooms/' + this.roomId);
      this.roomRef = this.baseRef.child('room');
      this.playersRef = this.baseRef.child('players');
      this.meRef = this.playersRef.child(this.playerKey);

      this._room = null;
      this._players = {};
      this._me = null;
      this._opponent = null;

      this._roomCb = null;
      this._playersCb = null;
      this._presenceTimer = 0;
      this._settleLock = false;
      this._lastEndKey = '';
    }

    // -----------------------------
    // Public getters
    // -----------------------------
    getState(){
      return {
        room: clone(this._room),
        players: clone(this._players),
        me: clone(this._me),
        opponent: clone(this._opponent)
      };
    }

    getLeadStatus(){
      const me = this._me || null;
      const op = this._opponent || null;
      if(!me || !op) return 'WAIT';

      const myScore = n(me.score, 0);
      const opScore = n(op.score, 0);
      const diff = myScore - opScore;

      if(Math.abs(diff) <= 8) return 'CLOSE';
      return diff > 0 ? 'LEAD' : 'BEHIND';
    }

    // -----------------------------
    // Subscribe / Presence
    // -----------------------------
    async subscribe(){
      await this.ensureRoomSkeleton();
      await this.reconnectPresence();

      this._roomCb = snap => {
        this._room = snap.val() || {};
        emit('groups:race_room', { room: this._room });
        this._refreshDerived();
        this._maybeEmitEnd();
      };

      this._playersCb = snap => {
        this._players = snap.val() || {};
        this._refreshDerived();
        emit('groups:race_players', {
          room: this._room || {},
          me: this._me,
          opponent: this._opponent,
          players: this._players
        });
        this._maybeAutoSettle();
      };

      this.roomRef.on('value', this._roomCb);
      this.playersRef.on('value', this._playersCb);

      this._presenceTimer = setInterval(()=>{
        this.meRef.child('lastSeenAt').set(now()).catch(()=>{});
      }, 5000);
    }

    async reconnectPresence(){
      const connectedRef = this.db.ref('.info/connected');
      connectedRef.on('value', snap=>{
        if(snap.val() === true){
          try{
            this.meRef.onDisconnect().update({
              connected: false,
              ready: false,
              lastSeenAt: now()
            });
          }catch(_){}
          this.meRef.update({
            connected: true,
            lastSeenAt: now()
          }).catch(()=>{});
        }
      });

      await this.meRef.update({
        playerKey: this.playerKey,
        pid: this.pid,
        name: this.name,
        role: this.role,
        view: this.view,
        connected: true,
        ready: false,
        score: 0,
        combo: 0,
        comboMax: 0,
        miss: 0,
        accuracyPct: 0,
        timeLeft: this.timeSec,
        finished: false,
        finishAt: 0,
        summary: null,
        lastSeenAt: now()
      });
    }

    async leaveRoomSoft(){
      try{
        clearInterval(this._presenceTimer);
        this._presenceTimer = 0;
      }catch(_){}

      try{
        if(this._roomCb) this.roomRef.off('value', this._roomCb);
        if(this._playersCb) this.playersRef.off('value', this._playersCb);
      }catch(_){}

      try{
        await this.meRef.update({
          connected: false,
          ready: false,
          lastSeenAt: now()
        });
      }catch(_){}
    }

    // -----------------------------
    // Room setup
    // -----------------------------
    async ensureRoomSkeleton(){
      const roomSnap = await this.roomRef.once('value');
      const room = roomSnap.val();

      if(room) return;

      const baseRoom = {
        roomId: this.roomId,
        status: 'lobby',           // lobby | countdown | playing | ended
        hostKey: this.role === 'host' ? this.playerKey : '',
        guestKey: this.role === 'guest' ? this.playerKey : '',
        diff: this.diff,
        timeSec: this.timeSec,
        seed: this.seed,
        roundNo: 1,
        rematchNo: 0,
        hostWins: 0,
        guestWins: 0,
        startAt: 0,
        countdownMs: 3000,
        endedAt: 0,
        decision: null,
        seriesFinished: false,
        seriesWinnerKey: '',
        createdAt: now(),
        updatedAt: now()
      };

      await this.roomRef.set(baseRoom);
    }

    async _bindRoleKeysIfNeeded(){
      const snap = await this.roomRef.once('value');
      const room = snap.val() || {};

      const patch = {};
      if(this.role === 'host' && !room.hostKey) patch.hostKey = this.playerKey;
      if(this.role === 'guest' && !room.guestKey) patch.guestKey = this.playerKey;

      if(Object.keys(patch).length){
        patch.updatedAt = now();
        await this.roomRef.update(patch);
      }
    }

    // -----------------------------
    // Player actions
    // -----------------------------
    async setReady(on){
      await this._bindRoleKeysIfNeeded();
      await this.meRef.update({
        ready: !!on,
        connected: true,
        lastSeenAt: now()
      });
    }

    async resetMyRoundState(){
      await this.meRef.update({
        ready: false,
        connected: true,
        score: 0,
        combo: 0,
        comboMax: 0,
        miss: 0,
        accuracyPct: 0,
        timeLeft: this.timeSec,
        finished: false,
        finishAt: 0,
        summary: null,
        lastSeenAt: now()
      });
    }

    async publishScore(payload){
      payload = payload || {};
      await this.meRef.update({
        score: n(payload.score, 0),
        combo: n(payload.combo, 0),
        comboMax: n(payload.comboMax, 0),
        miss: n(payload.miss, 0),
        accuracyPct: n(payload.accuracyPct, 0),
        timeLeft: n(payload.timeLeft, 0),
        connected: true,
        lastSeenAt: now()
      });
    }

    async publishFinished(payload){
      payload = payload || {};
      await this.meRef.update({
        score: n(payload.score, 0),
        combo: n(payload.combo, 0),
        comboMax: n(payload.comboMax, 0),
        miss: n(payload.miss, 0),
        accuracyPct: n(payload.accuracyPct, 0),
        timeLeft: n(payload.timeLeft, 0),
        finished: true,
        finishAt: n(payload.finishAt, now()),
        summary: payload.summary || null,
        connected: true,
        lastSeenAt: now()
      });
      await this._maybeAutoSettle();
    }

    async maybeStartCountdown(countdownMs){
      countdownMs = n(countdownMs, 3000);
      await this._bindRoleKeysIfNeeded();

      if(this.role !== 'host') return false;

      const roomSnap = await this.roomRef.once('value');
      const room = roomSnap.val() || {};
      if(room.status !== 'lobby') return false;
      if(room.seriesFinished) return false;

      const playersSnap = await this.playersRef.once('value');
      const players = playersSnap.val() || {};
      const host = room.hostKey ? players[room.hostKey] : null;
      const guest = room.guestKey ? players[room.guestKey] : null;

      if(!host || !guest) return false;
      if(!host.ready || !guest.ready) return false;

      const startAt = now() + countdownMs;

      await this.roomRef.update({
        status: 'countdown',
        countdownMs,
        startAt,
        endedAt: 0,
        decision: null,
        updatedAt: now()
      });

      return true;
    }

    async setPlayingIfCountdownReached(){
      const roomSnap = await this.roomRef.once('value');
      const room = roomSnap.val() || {};
      if(room.status !== 'countdown') return false;
      if(n(room.startAt, 0) > now()) return false;

      if(this.role !== 'host') return false;

      const playersSnap = await this.playersRef.once('value');
      const players = playersSnap.val() || {};
      const updates = {};
      Object.keys(players).forEach(k=>{
        updates[k + '/ready'] = false;
        updates[k + '/score'] = 0;
        updates[k + '/combo'] = 0;
        updates[k + '/comboMax'] = 0;
        updates[k + '/miss'] = 0;
        updates[k + '/accuracyPct'] = 0;
        updates[k + '/timeLeft'] = n(room.timeSec, this.timeSec);
        updates[k + '/finished'] = false;
        updates[k + '/finishAt'] = 0;
        updates[k + '/summary'] = null;
        updates[k + '/connected'] = true;
        updates[k + '/lastSeenAt'] = now();
      });
      if(Object.keys(updates).length){
        await this.playersRef.update(updates);
      }

      await this.roomRef.update({
        status: 'playing',
        updatedAt: now()
      });

      return true;
    }

    async rematchResetIfHost(){
      if(this.role !== 'host') return false;

      const roomSnap = await this.roomRef.once('value');
      const room = roomSnap.val() || {};

      if(room.seriesFinished) return false;

      const nextRoundNo = n(room.roundNo, 1) + 1;
      const nextRematchNo = n(room.rematchNo, 0) + 1;

      const playersSnap = await this.playersRef.once('value');
      const players = playersSnap.val() || {};
      const updates = {};

      Object.keys(players).forEach(k=>{
        updates[k + '/ready'] = false;
        updates[k + '/score'] = 0;
        updates[k + '/combo'] = 0;
        updates[k + '/comboMax'] = 0;
        updates[k + '/miss'] = 0;
        updates[k + '/accuracyPct'] = 0;
        updates[k + '/timeLeft'] = n(room.timeSec, this.timeSec);
        updates[k + '/finished'] = false;
        updates[k + '/finishAt'] = 0;
        updates[k + '/summary'] = null;
        updates[k + '/connected'] = true;
        updates[k + '/lastSeenAt'] = now();
      });
      if(Object.keys(updates).length){
        await this.playersRef.update(updates);
      }

      await this.roomRef.update({
        status: 'lobby',
        roundNo: nextRoundNo,
        rematchNo: nextRematchNo,
        startAt: 0,
        endedAt: 0,
        decision: null,
        updatedAt: now()
      });

      return true;
    }

    // -----------------------------
    // Internal derived state
    // -----------------------------
    _refreshDerived(){
      const room = this._room || {};
      const players = this._players || {};

      this._me = players[this.playerKey] || null;

      const keys = Object.keys(players).filter(k => k !== this.playerKey);
      const opKey = keys[0] || '';
      this._opponent = opKey ? players[opKey] : null;

      if(room.hostKey && !players[room.hostKey]){}
      if(room.guestKey && !players[room.guestKey]){}
    }

    // -----------------------------
    // Decision / settle
    // -----------------------------
    async _maybeAutoSettle(){
      if(this._settleLock) return;
      if(this.role !== 'host') return;

      const room = this._room || {};
      if(room.status !== 'playing') return;

      const players = this._players || {};
      const host = room.hostKey ? players[room.hostKey] : null;
      const guest = room.guestKey ? players[room.guestKey] : null;

      if(!host || !guest) return;

      const hostFinished = !!host.finished;
      const guestFinished = !!guest.finished;
      const hostDisconnected = host.connected === false;
      const guestDisconnected = guest.connected === false;

      const shouldSettle =
        (hostFinished && guestFinished) ||
        (hostDisconnected && !guestDisconnected) ||
        (guestDisconnected && !hostDisconnected);

      if(!shouldSettle) return;

      this._settleLock = true;
      try{
        await this._settleRound();
      }finally{
        this._settleLock = false;
      }
    }

    async _settleRound(){
      const roomSnap = await this.roomRef.once('value');
      const room = roomSnap.val() || {};
      if(room.status === 'ended') return;

      const playersSnap = await this.playersRef.once('value');
      const players = playersSnap.val() || {};

      const host = room.hostKey ? (players[room.hostKey] || null) : null;
      const guest = room.guestKey ? (players[room.guestKey] || null) : null;
      if(!host || !guest) return;

      if(!window.GroupsRaceScore || !window.GroupsRaceScore.buildRoundDecision){
        throw new Error('GroupsRaceScore not loaded');
      }

      const decision = window.GroupsRaceScore.buildRoundDecision(room, host, guest);

      await this.roomRef.update({
        status: 'ended',
        decision,
        hostWins: n(decision.hostWins, 0),
        guestWins: n(decision.guestWins, 0),
        endedAt: now(),
        seriesFinished: !!decision.seriesFinished,
        seriesWinnerKey: String(decision.seriesWinnerKey || ''),
        updatedAt: now()
      });

      emit('groups:race_end', clone(decision));
    }

    _maybeEmitEnd(){
      const room = this._room || {};
      if(room.status !== 'ended') return;
      if(!room.decision) return;

      const key = [
        room.roundNo,
        room.rematchNo,
        room.endedAt,
        room.decision && room.decision.winnerKey
      ].join('|');

      if(key === this._lastEndKey) return;
      this._lastEndKey = key;

      emit('groups:race_end', clone(room.decision));
    }
  }

  window.GroupsRaceRTDB = GroupsRaceRTDB;
})();