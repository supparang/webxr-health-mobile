// === /herohealth/vr-groups/groups-race-rtdb.js ===
// Groups Race RTDB Adapter
// FULL PATCH v20260313-GROUPS-RACE-RTDB-BO3-r1
// Requires:
// - ../firebase-config.js loaded first
// - Firebase compat SDK already available on window.firebase

(function(){
  'use strict';

  function n(v, d=0){
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  }

  function now(){ return Date.now(); }

  function dispatch(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }

  function clone(v){
    try{ return JSON.parse(JSON.stringify(v)); }catch(_){ return v; }
  }

  function hasFirebase(){
    return !!(window.firebase && typeof window.firebase.database === 'function');
  }

  function db(){
    if (!hasFirebase()) throw new Error('Firebase compat database not available');
    return window.firebase.database();
  }

  function roomPath(roomId){
    return `groupsRaceRooms/${roomId}`;
  }

  function playerDefaults(opts){
    return {
      playerKey: String(opts.playerKey || ''),
      role: String(opts.role || 'guest'),
      pid: String(opts.pid || ''),
      name: String(opts.name || ''),
      view: String(opts.view || 'mobile'),
      diff: String(opts.diff || 'normal'),
      timeSec: n(opts.timeSec, 80),
      seed: String(opts.seed || ''),
      connected: true,
      ready: false,
      finished: false,
      score: 0,
      combo: 0,
      comboMax: 0,
      miss: 0,
      accuracyPct: 0,
      timeLeft: n(opts.timeSec, 80),
      finishAt: 0,
      joinedAt: now(),
      lastSeenAt: now()
    };
  }

  class GroupsRaceRTDB {
    constructor(opts={}){
      this.roomId = String(opts.roomId || '').trim();
      this.playerKey = String(opts.playerKey || '').trim();
      this.role = String(opts.role || 'guest').trim().toLowerCase();
      this.pid = String(opts.pid || '').trim();
      this.name = String(opts.name || '').trim();
      this.diff = String(opts.diff || 'normal').trim().toLowerCase();
      this.timeSec = n(opts.timeSec, 80);
      this.seed = String(opts.seed || '').trim() || String(now());
      this.view = String(opts.view || 'mobile').trim().toLowerCase();

      if (!this.roomId) throw new Error('roomId required');
      if (!this.playerKey) throw new Error('playerKey required');
      if (!hasFirebase()) throw new Error('Firebase not initialized');

      this.db = db();
      this.roomRef = this.db.ref(roomPath(this.roomId));
      this.playersRef = this.roomRef.child('players');
      this.meRef = this.playersRef.child(this.playerKey);

      this._room = null;
      this._players = {};
      this._roomCb = null;
      this._playersCb = null;
      this._joined = false;
      this._disconnectArmed = false;
    }

    getState(){
      const room = clone(this._room || {});
      const players = clone(this._players || {});
      const me = players[this.playerKey] || null;
      const opponent = Object.values(players).find(p => String(p?.playerKey||'') !== this.playerKey) || null;
      return { room, players, me, opponent };
    }

    getLeadStatus(){
      const st = this.getState();
      const me = st.me;
      const op = st.opponent;
      if (!me || !op) return 'WAIT';

      const ds = n(me.score,0) - n(op.score,0);
      if (Math.abs(ds) <= 8) return 'CLOSE';
      return ds > 0 ? 'LEAD' : 'BEHIND';
    }

    async subscribe(){
      await this.ensureRoom();
      await this.joinRoom();
      this.attachListeners();
      return true;
    }

    async ensureRoom(){
      const snap = await this.roomRef.get();
      const room = snap.val();

      if (room) return room;

      if (this.role !== 'host'){
        return null;
      }

      const init = {
        roomId: this.roomId,
        status: 'lobby',
        diff: this.diff,
        timeSec: this.timeSec,
        seed: this.seed,
        createdAt: now(),
        updatedAt: now(),
        roundNo: 1,
        rematchNo: 0,
        hostWins: 0,
        guestWins: 0,
        hostKey: this.playerKey,
        guestKey: '',
        startAt: 0,
        seriesFinished: false,
        seriesWinnerKey: '',
        decision: null
      };

      await this.roomRef.set(init);
      return init;
    }

    async joinRoom(){
      const roomSnap = await this.roomRef.get();
      const room = roomSnap.val() || {};

      const updates = {};
      if (!room.hostKey){
        updates.hostKey = this.role === 'host' ? this.playerKey : '';
      }
      if (!room.guestKey && this.role !== 'host'){
        updates.guestKey = this.playerKey;
      }

      if (Object.keys(updates).length){
        updates.updatedAt = now();
        await this.roomRef.update(updates);
      }

      const me = playerDefaults(this);
      await this.meRef.update(me);

      if (!this._disconnectArmed){
        this._disconnectArmed = true;
        try{
          this.meRef.onDisconnect().update({
            connected: false,
            ready: false,
            lastSeenAt: now()
          });
        }catch(_){}
      }

      this._joined = true;
    }

    attachListeners(){
      if (this._roomCb || this._playersCb) return;

      this._roomCb = snap => {
        this._room = snap.val() || {};
        dispatch('groups:race_room', { room: clone(this._room) });
      };

      this._playersCb = snap => {
        this._players = snap.val() || {};
        dispatch('groups:race_players', {
          room: clone(this._room || {}),
          players: clone(this._players)
        });
      };

      this.roomRef.on('value', this._roomCb);
      this.playersRef.on('value', this._playersCb);
    }

    async reconnectPresence(){
      if (!this._joined) await this.joinRoom();
      await this.meRef.update({
        connected: true,
        lastSeenAt: now()
      });
      return true;
    }

    async leaveRoomSoft(){
      try{
        await this.meRef.update({
          connected: false,
          ready: false,
          lastSeenAt: now()
        });
      }catch(_){}
    }

    async setReady(flag){
      await this.meRef.update({
        ready: !!flag,
        connected: true,
        lastSeenAt: now()
      });
      return true;
    }

    async publishScore(partial={}){
      await this.meRef.update({
        connected: true,
        lastSeenAt: now(),
        score: n(partial.score, 0),
        combo: n(partial.combo, 0),
        comboMax: n(partial.comboMax, 0),
        miss: n(partial.miss, 0),
        accuracyPct: n(partial.accuracyPct, 0),
        timeLeft: n(partial.timeLeft, this.timeSec)
      });
      return true;
    }

    async publishFinished(payload={}){
      await this.meRef.update({
        connected: true,
        ready: false,
        finished: true,
        lastSeenAt: now(),
        score: n(payload.score, 0),
        combo: n(payload.combo, 0),
        comboMax: n(payload.comboMax, 0),
        miss: n(payload.miss, 0),
        accuracyPct: n(payload.accuracyPct, 0),
        timeLeft: n(payload.timeLeft, 0),
        finishAt: n(payload.finishAt, now()),
        summary: payload.summary || null
      });

      await this.maybeDecideWinner();
      return true;
    }

    async maybeStartCountdown(ms=3000){
      const roomSnap = await this.roomRef.get();
      const room = roomSnap.val() || {};
      const playersSnap = await this.playersRef.get();
      const players = playersSnap.val() || {};
      const me = players[this.playerKey] || null;
      const opponent = Object.values(players).find(p => String(p?.playerKey||'') !== this.playerKey) || null;

      if (this.role !== 'host') return false;
      if (String(room.status || 'lobby') !== 'lobby') return false;
      if (!me || !me.ready) return false;
      if (!opponent || !opponent.ready) return false;

      await this.roomRef.update({
        status: 'countdown',
        startAt: now() + Math.max(1000, n(ms, 3000)),
        updatedAt: now(),
        decision: null,
        seriesFinished: !!room.seriesFinished,
        seriesWinnerKey: room.seriesWinnerKey || ''
      });
      return true;
    }

    async setPlayingIfCountdownReached(){
      const roomSnap = await this.roomRef.get();
      const room = roomSnap.val() || {};
      if (String(room.status || '') !== 'countdown') return false;
      if (n(room.startAt, 0) > now()) return false;

      await this.roomRef.update({
        status: 'playing',
        updatedAt: now()
      });

      const playersSnap = await this.playersRef.get();
      const players = playersSnap.val() || {};
      const updates = {};
      Object.keys(players).forEach(k=>{
        updates[`${k}/ready`] = false;
        updates[`${k}/finished`] = false;
        updates[`${k}/score`] = 0;
        updates[`${k}/combo`] = 0;
        updates[`${k}/comboMax`] = 0;
        updates[`${k}/miss`] = 0;
        updates[`${k}/accuracyPct`] = 0;
        updates[`${k}/timeLeft`] = n(room.timeSec, this.timeSec);
        updates[`${k}/finishAt`] = 0;
        updates[`${k}/summary`] = null;
        updates[`${k}/connected`] = true;
        updates[`${k}/lastSeenAt`] = now();
      });
      if (Object.keys(updates).length){
        await this.playersRef.update(updates);
      }

      return true;
    }

    async maybeDecideWinner(){
      const roomSnap = await this.roomRef.get();
      const room = roomSnap.val() || {};
      if (String(room.status || '') === 'ended') return room.decision || null;
      if (String(room.status || '') !== 'playing') return null;

      const playersSnap = await this.playersRef.get();
      const players = playersSnap.val() || {};
      const arr = Object.values(players);

      if (arr.length < 2) return null;

      const finishedArr = arr.filter(p => !!p?.finished);
      const disconnectedArr = arr.filter(p => p?.connected === false);

      let decision = null;

      if (finishedArr.length >= 2){
        decision = window.GroupsRaceScore.buildDecision(room, arr[0], arr[1], 'score');
      } else if (disconnectedArr.length >= 1 && arr.length >= 2){
        const quitter = disconnectedArr[0];
        const other = arr.find(p => String(p?.playerKey||'') !== String(quitter?.playerKey||'')) || null;
        if (other) {
          decision = window.GroupsRaceScore.buildDisconnectDecision(room, quitter, other);
        }
      }

      if (!decision) return null;

      await this.roomRef.update({
        status: 'ended',
        updatedAt: now(),
        hostWins: n(decision.hostWins, 0),
        guestWins: n(decision.guestWins, 0),
        seriesFinished: !!decision.seriesFinished,
        seriesWinnerKey: String(decision.seriesWinnerKey || ''),
        decision
      });

      dispatch('groups:race_end', decision);
      return decision;
    }

    async rematchResetIfHost(){
      if (this.role !== 'host') return false;

      const roomSnap = await this.roomRef.get();
      const room = roomSnap.val() || {};

      if (room.seriesFinished) return false;

      const nextRound = n(room.roundNo, 1) + 1;
      const nextRematch = n(room.rematchNo, 0) + 1;

      await this.roomRef.update({
        status: 'lobby',
        updatedAt: now(),
        startAt: 0,
        roundNo: nextRound,
        rematchNo: nextRematch,
        decision: null
      });

      const playersSnap = await this.playersRef.get();
      const players = playersSnap.val() || {};
      const updates = {};
      Object.keys(players).forEach(k=>{
        updates[`${k}/ready`] = false;
        updates[`${k}/finished`] = false;
        updates[`${k}/score`] = 0;
        updates[`${k}/combo`] = 0;
        updates[`${k}/comboMax`] = 0;
        updates[`${k}/miss`] = 0;
        updates[`${k}/accuracyPct`] = 0;
        updates[`${k}/timeLeft`] = this.timeSec;
        updates[`${k}/finishAt`] = 0;
        updates[`${k}/summary`] = null;
        updates[`${k}/connected`] = true;
        updates[`${k}/lastSeenAt`] = now();
      });
      if (Object.keys(updates).length){
        await this.playersRef.update(updates);
      }

      return true;
    }

    async resetMyRoundState(){
      await this.meRef.update({
        ready: false,
        finished: false,
        score: 0,
        combo: 0,
        comboMax: 0,
        miss: 0,
        accuracyPct: 0,
        timeLeft: this.timeSec,
        finishAt: 0,
        summary: null,
        connected: true,
        lastSeenAt: now()
      });
      return true;
    }
  }

  window.GroupsRaceRTDB = GroupsRaceRTDB;
})();