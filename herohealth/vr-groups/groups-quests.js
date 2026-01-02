/* === /herohealth/vr-groups/groups-quests.js ===
GroupsVR — Quest Counter + End Summary Patch (PACK 25)
✅ Tracks GOAL/MINI state from quest:update
✅ Counts miniTotal / miniCleared (real)
✅ Patches hha:end detail with {miniTotal, miniCleared, goalsTotal, goalsCleared} before UI/logger
✅ Safe in play/research
*/

(function (root) {
  'use strict';

  const NS = root.GroupsVR = root.GroupsVR || {};

  const ST = {
    // goal
    goalsTotal: 0,
    goalIndex: 0,
    goalNow: 0,
    goalTotal: 1,

    // mini
    miniActive: false,
    miniNow: 0,
    miniNeed: 0,
    miniLeft: 0,
    miniTitle: '—',

    // counts
    miniTotal: 0,
    miniCleared: 0,

    // de-dupe
    _lastMiniKey: '',
    _lastMiniSeenAt: 0,

    // judge latch (for mini result hint)
    _lastJudgeAt: 0,
    _lastJudgeKind: '',
    _lastJudgeText: ''
  };

  function nowMs() {
    return (root.performance && performance.now) ? performance.now() : Date.now();
  }

  function clamp(v, a, b) {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  }

  function str(x){ return String(x ?? ''); }

  // ---- Core: detect mini start/end from quest:update ----
  function onQuestUpdate(ev){
    const d = ev && ev.detail ? ev.detail : {};

    // goal
    ST.goalsTotal = Number(d.goalsTotal ?? ST.goalsTotal) || ST.goalsTotal;
    ST.goalIndex  = Number(d.goalIndex  ?? ST.goalIndex)  || ST.goalIndex;
    ST.goalNow    = Number(d.goalNow    ?? ST.goalNow)    || ST.goalNow;
    ST.goalTotal  = Math.max(1, Number(d.goalTotal ?? ST.goalTotal) || ST.goalTotal);

    // mini snapshot
    const title = str(d.miniTitle ?? '—').trim();
    const now = Number(d.miniNow ?? 0) || 0;
    const tot = Number(d.miniTotal ?? 0) || 0;
    const left = Number(d.miniTimeLeftSec ?? 0) || 0;

    const miniOn = (title !== '—' && tot > 0);

    // create a key to detect a "new mini"
    // (title + tot + approximate start window via leftSec bucket)
    const leftBucket = Math.min(99, Math.max(0, Math.round(left)));
    const key = `${title}|${tot}|${leftBucket}`;

    // If mini becomes active, count miniTotal once per mini instance
    if (miniOn && !ST.miniActive) {
      ST.miniActive = true;
      ST.miniTitle = title;
      ST.miniNow = now;
      ST.miniNeed = tot;
      ST.miniLeft = left;

      // count total (guard with key/time)
      const t = nowMs();
      if (key !== ST._lastMiniKey || (t - ST._lastMiniSeenAt) > 1200) {
        ST.miniTotal += 1;
        ST._lastMiniKey = key;
        ST._lastMiniSeenAt = t;
      }
      return;
    }

    // While active, update progress
    if (miniOn && ST.miniActive) {
      ST.miniTitle = title;
      ST.miniNow = now;
      ST.miniNeed = tot;
      ST.miniLeft = left;
      return;
    }

    // If mini is no longer on => it ended
    if (!miniOn && ST.miniActive) {
      // Decide cleared or not:
      // Best: look at last judge kind within a short window, otherwise fallback to progress.
      const t = nowMs();
      const judgeFresh = (t - ST._lastJudgeAt) <= 900;

      let cleared = false;
      if (judgeFresh) {
        const k = ST._lastJudgeKind;
        const txt = str(ST._lastJudgeText).toUpperCase();
        // your engine uses: judge kind 'good' with text 'MINI CLEAR +180' or 'MINI FAIL'
        if (k === 'good' && txt.includes('MINI')) cleared = true;
        if (txt.includes('MINI CLEAR')) cleared = true;
        if (txt.includes('MINI FAIL')) cleared = false;
      } else {
        // fallback: if progress met requirement at end moment
        cleared = (ST.miniNow >= ST.miniNeed);
      }

      if (cleared) ST.miniCleared += 1;

      // reset mini active
      ST.miniActive = false;
      ST.miniTitle = '—';
      ST.miniNow = 0;
      ST.miniNeed = 0;
      ST.miniLeft = 0;
      return;
    }
  }

  function onJudge(ev){
    const d = ev && ev.detail ? ev.detail : {};
    ST._lastJudgeAt = nowMs();
    ST._lastJudgeKind = str(d.kind || '').toLowerCase();
    ST._lastJudgeText = str(d.text || '');
  }

  // ---- Patch end summary before UI/logger consumes it ----
  // Important: capture phase so we can mutate ev.detail early.
  function onEndCapture(ev){
    if (!ev || !ev.detail) return;

    // infer goalsCleared robustly (engine already sets it; but keep safe)
    const gTotal = Number(ev.detail.goalsTotal ?? ST.goalsTotal) || ST.goalsTotal || 0;
    const gCleared = Number(ev.detail.goalsCleared ?? 0) || 0;

    // attach mini counts
    ev.detail.miniTotal = Number(ev.detail.miniTotal ?? ST.miniTotal) || ST.miniTotal || 0;
    ev.detail.miniCleared = Number(ev.detail.miniCleared ?? ST.miniCleared) || ST.miniCleared || 0;

    // also ensure goal totals exist (some builds want both)
    ev.detail.goalsTotal = gTotal || ev.detail.goalsTotal || 0;
    ev.detail.goalsCleared = gCleared || ev.detail.goalsCleared || 0;

    // Optional: add a compact quest snapshot for debugging
    ev.detail._quest = {
      goalNow: ST.goalNow,
      goalTotal: ST.goalTotal,
      goalsTotal: ST.goalsTotal,
      miniTotal: ST.miniTotal,
      miniCleared: ST.miniCleared
    };
  }

  // ---- Public helpers (optional) ----
  NS.getQuestStats = function(){
    return {
      goalsTotal: ST.goalsTotal,
      goalIndex: ST.goalIndex,
      goalNow: ST.goalNow,
      goalTotal: ST.goalTotal,
      miniTotal: ST.miniTotal,
      miniCleared: ST.miniCleared,
      miniActive: ST.miniActive
    };
  };

  NS.resetQuestStats = function(){
    ST.goalsTotal = 0;
    ST.goalIndex = 0;
    ST.goalNow = 0;
    ST.goalTotal = 1;
    ST.miniActive = false;
    ST.miniNow = 0;
    ST.miniNeed = 0;
    ST.miniLeft = 0;
    ST.miniTitle = '—';
    ST.miniTotal = 0;
    ST.miniCleared = 0;
    ST._lastMiniKey = '';
    ST._lastMiniSeenAt = 0;
    ST._lastJudgeAt = 0;
    ST._lastJudgeKind = '';
    ST._lastJudgeText = '';
  };

  // ---- Wire listeners ----
  root.addEventListener('quest:update', onQuestUpdate, { passive:true });

  // judge helps decide mini clear/fail reliably
  root.addEventListener('hha:judge', onJudge, { passive:true });

  // capture to patch detail before run html handler
  root.addEventListener('hha:end', onEndCapture, true);

})(typeof window !== 'undefined' ? window : globalThis);