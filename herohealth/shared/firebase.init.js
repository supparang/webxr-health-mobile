// /herohealth/shared/firebase.init.js
// HeroHealth Firebase bootstrap
// PATCH v20260406-firebase-init-a

(function (W) {
  'use strict';

  const HHA = W.HHA = W.HHA || {};

  function qs(key, fallback = '') {
    try {
      const v = new URLSearchParams(location.search).get(key);
      return v == null || v === '' ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function intQ(key, fallback = 0) {
    const n = Number(qs(key, fallback));
    return Number.isFinite(n) ? n : fallback;
  }

  function boolQ(key, fallback = false) {
    const v = String(qs(key, fallback ? '1' : '0')).toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  function buildCtx(patch = {}) {
    const ctx = {
      pid: qs('pid', 'anon'),
      uid: '',
      name: qs('name', qs('nickName', '')),
      display_name: qs('name', qs('nickName', '')),
      study_id: qs('studyId', ''),
      school_code: qs('schoolCode', ''),
      class_room: qs('classRoom', ''),
      student_code: qs('studentNo', ''),
      game: qs('game', qs('gameId', '')),
      zone: qs('zone', ''),
      cat: qs('cat', qs('zone', '')),
      mode: qs('mode', 'solo'),
      run: qs('run', 'play'),
      diff: qs('diff', 'normal'),
      time_sec: intQ('time', 90),
      seed: qs('seed', String(Date.now())),
      room_id: qs('roomId', ''),
      match_id: qs('matchId', ''),
      role: qs('role', ''),
      team_id: qs('teamId', ''),
      view: qs('view', 'mobile'),
      device_type: /android|iphone|ipad|mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      app_version: W.HHA_APP_VERSION || '',
      api: qs('api', ''),
      hub: qs('hub', '../hub.html'),
      gate: boolQ('gate', false),
      cooldown: boolQ('cooldown', false),
      returnPhase: qs('returnPhase', ''),
      debug: boolQ('debug', false),
      log: boolQ('log', true)
    };
    return Object.assign(ctx, patch || {});
  }

  async function initFirebase(config) {
    if (!W.firebase) throw new Error('Firebase SDK not loaded');

    const fbConfig = config || W.HHA_FIREBASE_CONFIG || W.FIREBASE_CONFIG;
    if (!fbConfig) throw new Error('Missing Firebase config');

    let app;
    if (!firebase.apps.length) {
      app = firebase.initializeApp(fbConfig);
    } else {
      app = firebase.app();
    }

    const auth = firebase.auth();
    const db = firebase.database();

    if (!auth.currentUser) {
      await auth.signInAnonymously();
    }

    return {
      app,
      auth,
      db,
      user: auth.currentUser,
      uid: auth.currentUser ? auth.currentUser.uid : ''
    };
  }

  HHA.qs = qs;
  HHA.intQ = intQ;
  HHA.boolQ = boolQ;
  HHA.buildCtx = buildCtx;
  HHA.initFirebase = initFirebase;

})(window);
