/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups VR — Quest Director (PRODUCTION)
- Emits: quest:update { goalTitle/Now/Need, goalsCleared/Total, miniTitle/Now/Need, miniLeftSec, miniUrgent, miniCleared/Total }
- GOALS (sequential):
  1) ครบ 5 หมู่: ยิงถูกหมู่ปัจจุบันให้ครบทุกหมู่ (easy/normal/hard = 4/5/6 ต่อหมู่)
  2) สลับหมู่ด้วย POWER 4 ครั้ง
  3) ปราบบอส 2 ตัว
- MINIS (chained 6):
  1) STREAK 4
  2) POWER RUSH: สลับหมู่จาก power ภายใน 10s
  3) STORM RUSH: ตอน STORM ยิงถูก 4 ครั้ง (bad ระหว่างทำรีเซ็ต)
  4) CLEAN 8s: ห้ามพลาด 8 วิ (bad/miss รีเซ็ต)
  5) CALL&RESPONSE: หมู่ปัจจุบัน ยิงถูก 3 ครั้งใน 9s (bad/miss รีเซ็ต)
  6) BOSS BREAK: HIT บอส 3 ครั้งใน 12s หรือโค่นบอส 1 ตัว
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail) => { try { root.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch {} };

  // --------- helpers ----------
  function nowMs() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function qs(name, def){
    try { return (new URL(root.location.href)).searchParams.get(name) ?? def; }
    catch { return def; }
  }
  function diffNeedPerGroup(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy') return 4;
    if (diff === 'hard') return 6;
    return 5; // normal
  }
  function safeText(s){ return String(s ?? '').trim(); }

  function getQuestText(){
    return (NS.QuestText || {});
  }
  function getCall(groupId){
    const QT = getQuestText();
    if (QT && typeof QT.getCall === 'function') return QT.getCall(groupId);
    if (QT && QT.GROUP_CALL_RESPONSE && QT.GROUP_CALL_RESPONSE[groupId]) return QT.GROUP_CALL_RESPONSE[groupId];
    return { q:'', a:'' };
  }

  // --------- state ----------
  const state = {
    inited:false,

    // runtime
    diff: String(qs('diff','normal')).toLowerCase(),
    needPerGroup: 5,

    // current group
    currentGroupId: 1,
    currentGroupLabel: 'หมู่ 1',

    // GOAL progression
    goalIndex: 0,
    goalsCleared: 0,
    goalsTotal: 3,

    // GOAL1: per-group hits
    groupHits: { 1:0, 2:0, 3:0, 4:0, 5:0 },

    // GOAL2: swaps
    swapCount: 0,

    // GOAL3: boss kills
    bossKills: 0,

    // Storm
    stormOn:false,
    stormEndsAtMs: 0,

    // Score feed
    lastMisses: 0,

    // MINI chain
    miniIndex: 0,
    miniCleared: 0,
    miniTotal: 6,

    // mini working vars
    streak: 0,
    miniStartedAtMs: 0,
    miniDeadlineAtMs: 0,
    miniNow: 0,
    miniNeed: 0,
    miniLeftSec: null,
    miniUrgent: false,

    // POWER RUSH
    powerRushBaseSwaps: 0,

    // STORM RUSH
    stormRushHits: 0,
    stormRushArmed: false, // waiting storm

    // CLEAN 8s
    cleanStartMs: 0,

    // CALL&RESPONSE
    callGroupId: 0,
    callNeedHits: 3,
    callHits: 0,

    // BOSS BREAK
    bossHitNeed: 3,
    bossHits: 0,

    // end guard
    ended:false,
  };

  // --------- quest update ----------
  function goal1NeedTotal(){ return state.needPerGroup * 5; }
  function goal1NowTotal(){
    // clamp each group to needPerGroup
    let sum = 0;
    for (let g=1; g<=5; g++){
      sum += Math.min(state.needPerGroup, (state.groupHits[g]||0));
    }
    return sum|0;
  }
  function goalTitle(){
    if (state.goalIndex === 0){
      return `GOAL 1/3: ครบ 5 หมู่ (${state.needPerGroup}/หมู่)`;
    }
    if (state.goalIndex === 1){
      return `GOAL 2/3: สลับหมู่ด้วย POWER`;
    }
    if (state.goalIndex === 2){
      return `GOAL 3/3: ปราบบอส`;
    }
    return `GOAL: ALL COMPLETE!`;
  }
  function goalNowNeed(){
    if (state.goalIndex === 0){
      return { now: goal1NowTotal(), need: goal1NeedTotal() };
    }
    if (state.goalIndex === 1){
      return { now: state.swapCount|0, need: 4 };
    }
    if (state.goalIndex === 2){
      return { now: state.bossKills|0, need: 2 };
    }
    return { now: state.goalsTotal|0, need: state.goalsTotal|0 };
  }

  function miniTitle(){
    const i = state.miniIndex|0;
    if (i === 0) return `MINI 1/6: STREAK x4`;
    if (i === 1) return `MINI 2/6: POWER RUSH`;
    if (i === 2) return `MINI 3/6: STORM RUSH`;
    if (i === 3) return `MINI 4/6: CLEAN 8s`;
    if (i === 4) return `MINI 5/6: CALL & RESPONSE`;
    if (i === 5) return `MINI 6/6: BOSS BREAK`;
    return `MINI: ALL COMPLETE!`;
  }

  function pushUpdate(){
    const gn = goalNowNeed();
    const detail = {
      // GOAL UI
      goalTitle: goalTitle(),
      goalNow: gn.now|0,
      goalNeed: gn.need|0,
      goalsCleared: state.goalsCleared|0,
      goalsTotal: state.goalsTotal|0,

      // MINI UI
      miniTitle: (state.miniIndex >= state.miniTotal) ? '—' : miniTitle(),
      miniNow: (state.miniIndex >= state.miniTotal) ? 0 : (state.miniNow|0),
      miniNeed: (state.miniIndex >= state.miniTotal) ? 0 : (state.miniNeed|0),
      miniLeftSec: (typeof state.miniLeftSec === 'number') ? (state.miniLeftSec|0) : undefined,
      miniUrgent: !!state.miniUrgent,
      miniCleared: state.miniCleared|0,
      miniTotal: state.miniTotal|0,
    };
    emit('quest:update', detail);
  }

  function celebrate(kind, title){
    // particles.js (ถ้ามี) มักฟัง hha:celebrate
    try{ emit('hha:celebrate', { kind: kind||'mini', title: title||'' }); }catch{}
  }

  // --------- reset / init ----------
  function resetAll(){
    state.ended = false;

    state.diff = String(qs('diff','normal')).toLowerCase();
    state.needPerGroup = diffNeedPerGroup(state.diff);

    state.goalIndex = 0;
    state.goalsCleared = 0;

    state.groupHits = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    state.swapCount = 0;
    state.bossKills = 0;

    state.stormOn = false;
    state.stormEndsAtMs = 0;

    state.lastMisses = 0;

    state.miniIndex = 0;
    state.miniCleared = 0;

    state.streak = 0;
    state.miniStartedAtMs = 0;
    state.miniDeadlineAtMs = 0;
    state.miniNow = 0;
    state.miniNeed = 0;
    state.miniLeftSec = null;
    state.miniUrgent = false;

    state.powerRushBaseSwaps = 0;

    state.stormRushHits = 0;
    state.stormRushArmed = false;

    state.cleanStartMs = 0;

    state.callGroupId = 0;
    state.callHits = 0;

    state.bossHits = 0;

    startMini(0, true);
    pushUpdate();
  }

  // --------- GOAL logic ----------
  function checkGoalAdvance(){
    if (state.goalIndex === 0){
      // each group >= needPerGroup
      let ok = true;
      for (let g=1; g<=5; g++){
        if ((state.groupHits[g]||0) < state.needPerGroup) { ok = false; break; }
      }
      if (ok){
        state.goalsCleared++;
        state.goalIndex++;
        celebrate('goal', 'GOAL 1 CLEARED!');
      }
    }
    if (state.goalIndex === 1){
      if ((state.swapCount|0) >= 4){
        state.goalsCleared++;
        state.goalIndex++;
        celebrate('goal', 'GOAL 2 CLEARED!');
      }
    }
    if (state.goalIndex === 2){
      if ((state.bossKills|0) >= 2){
        state.goalsCleared++;
        state.goalIndex++;
        celebrate('goal', 'GOAL 3 CLEARED!');
        celebrate('all', 'ALL GOALS COMPLETE!');
      }
    }
    pushUpdate();
  }

  // --------- MINI chain ----------
  function startMini(idx, fresh){
    state.miniIndex = clamp(idx|0, 0, state.miniTotal);
    state.miniStartedAtMs = nowMs();
    state.miniUrgent = false;
    state.miniLeftSec = null;

    // reset shared
    if (fresh){
      state.streak = 0;
    }

    if (state.miniIndex === 0){
      // STREAK x4
      state.miniNeed = 4;
      state.miniNow = state.streak|0;
      state.miniDeadlineAtMs = 0;
    }
    else if (state.miniIndex === 1){
      // POWER RUSH: swap within 10s
      state.powerRushBaseSwaps = state.swapCount|0;
      state.miniNeed = 1;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 10000;
    }
    else if (state.miniIndex === 2){
      // STORM RUSH: hit good 4 times during STORM
      state.stormRushHits = 0;
      state.stormRushArmed = true; // waiting storm to begin
      state.miniNeed = 4;
      state.miniNow = 0;
      state.miniDeadlineAtMs = 0; // tied to storm window
    }
    else if (state.miniIndex === 3){
      // CLEAN 8s
      state.cleanStartMs = nowMs();
      state.miniNeed = 8;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 8000;
    }
    else if (state.miniIndex === 4){
      // CALL&RESPONSE: current group good x3 within 9s (bad/miss reset)
      state.callGroupId = state.currentGroupId|0;
      state.callHits = 0;
      state.miniNeed = 3;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 9000;
    }
    else if (state.miniIndex === 5){
      // BOSS BREAK: boss hit x3 within 12s OR boss kill
      state.bossHits = 0;
      state.miniNeed = 3;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 12000;
    }
    else {
      state.miniNeed = 0;
      state.miniNow = 0;
      state.miniDeadlineAtMs = 0;
    }

    pushUpdate();
  }

  function clearMini(){
    state.miniCleared = Math.min(state.miniTotal, (state.miniCleared|0) + 1);
    celebrate('mini', `MINI ${state.miniIndex+1} CLEARED!`);
    startMini(state.miniIndex + 1, true);
  }

  function resetMiniAttemptSoft(){
    // “ไม่ข้าม mini” แต่รีเซ็ตความพยายาม
    startMini(state.miniIndex, false);
  }

  function badResetsCurrentMini(){
    const i = state.miniIndex|0;
    // minis ที่ “bad แล้วรีเซ็ตความพยายาม”:
    // 0 streak, 2 stormRush, 3 clean, 4 call, 5 boss
    if (i === 0){
      state.streak = 0;
      state.miniNow = 0;
      pushUpdate();
      return;
    }
    if (i === 2){
      // storm rush: รีเซ็ตตัวนับ (ไม่ข้าม)
      state.stormRushHits = 0;
      state.miniNow = 0;
      pushUpdate();
      return;
    }
    if (i === 3){
      // clean: รีเซ็ตนับเวลาใหม่
      state.cleanStartMs = nowMs();
      state.miniDeadlineAtMs = nowMs() + 8000;
      state.miniNow = 0;
      pushUpdate();
      return;
    }
    if (i === 4){
      // call: รีเซ็ต
      state.callHits = 0;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 9000;
      pushUpdate();
      return;
    }
    if (i === 5){
      // boss break: รีเซ็ต
      state.bossHits = 0;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 12000;
      pushUpdate();
      return;
    }
  }

  function missResetsMiniIfNeeded(){
    const i = state.miniIndex|0;
    // minis ที่ miss แล้วควรรีเซ็ต: 0,3,4,5
    if (i === 0){
      state.streak = 0;
      state.miniNow = 0;
      pushUpdate();
      return;
    }
    if (i === 3){
      state.cleanStartMs = nowMs();
      state.miniDeadlineAtMs = nowMs() + 8000;
      state.miniNow = 0;
      pushUpdate();
      return;
    }
    if (i === 4){
      state.callHits = 0;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 9000;
      pushUpdate();
      return;
    }
    if (i === 5){
      state.bossHits = 0;
      state.miniNow = 0;
      state.miniDeadlineAtMs = nowMs() + 12000;
      pushUpdate();
      return;
    }
  }

  // --------- timer tick (mini urgency / leftSec) ----------
  let tickInt = null;
  function startTick(){
    if (tickInt) return;
    tickInt = setInterval(()=>{
      if (state.ended) return;

      const i = state.miniIndex|0;
      state.miniUrgent = false;
      state.miniLeftSec = null;

      const t = nowMs();

      // POWER RUSH / CALL / BOSS / CLEAN have deadlines
      if (i === 1 || i === 3 || i === 4 || i === 5){
        const leftMs = (state.miniDeadlineAtMs|0) - t;
        const left = Math.max(0, Math.ceil(leftMs / 1000));
        state.miniLeftSec = left;
        if (left <= 3) state.miniUrgent = true;

        // timeout => reset attempt (but keep same mini)
        if (leftMs <= 0){
          resetMiniAttemptSoft();
          return;
        }

        // CLEAN: update progress seconds survived
        if (i === 3){
          const surv = Math.floor((t - (state.cleanStartMs||t)) / 1000);
          state.miniNow = clamp(surv, 0, 8);
          if (surv >= 8){
            clearMini();
            return;
          }
        }
      }

      // STORM RUSH: show “left” tied to storm window (if active)
      if (i === 2){
        if (state.stormOn && state.stormEndsAtMs){
          const leftMs = state.stormEndsAtMs - Date.now();
          const left = Math.max(0, Math.ceil(leftMs / 1000));
          state.miniLeftSec = left;
          if (left <= 2) state.miniUrgent = true;
        } else {
          state.miniLeftSec = undefined;
        }
      }

      pushUpdate();
    }, 140);
  }

  function stopTick(){
    if (tickInt){ clearInterval(tickInt); tickInt = null; }
  }

  // --------- event handlers ----------
  function onGroupChange(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const gid = Number(d.groupId) || 1;
    const from = Number(d.from) || 0;

    state.currentGroupId = gid;
    state.currentGroupLabel = safeText(d.label || `หมู่ ${gid}`);

    // ถือว่าเริ่มเกมรอบใหม่เมื่อ from==0 (engine start)
    // รีเซ็ต quest เพื่อให้ goals/minis ตรงรอบเสมอ
    if (from === 0){
      resetAll();
    } else {
      // ถ้าอยู่ mini CALL&RESPONSE จะให้คำถาม “หมู่ปัจจุบัน” ณ ตอนเริ่ม mini เท่านั้น
      pushUpdate();
    }
  }

  function onProgress(ev){
    const d = ev && ev.detail ? ev.detail : {};
    if (d.kind === 'group_swap'){
      state.swapCount = (state.swapCount|0) + 1;

      // MINI POWER RUSH success?
      if (state.miniIndex === 1){
        if ((state.swapCount|0) > (state.powerRushBaseSwaps|0)){
          state.miniNow = 1;
          clearMini();
          return;
        }
      }
      checkGoalAdvance();
    }
  }

  function onStorm(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const on = !!d.on;
    state.stormOn = on;

    if (on){
      const durSec = Number(d.durSec)||5;
      state.stormEndsAtMs = Date.now() + durSec*1000;

      // If STORM RUSH active, arm/reset for this storm window
      if (state.miniIndex === 2){
        state.stormRushArmed = false; // now active
        state.stormRushHits = 0;
        state.miniNow = 0;
        state.miniNeed = 4;
      }
    } else {
      state.stormEndsAtMs = 0;
      // If STORM RUSH not completed, keep same mini and wait next storm
      if (state.miniIndex === 2){
        state.stormRushArmed = true; // wait next storm
        state.stormRushHits = 0;
        state.miniNow = 0;
      }
    }
    pushUpdate();
  }

  function onScore(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const misses = (d.misses|0);

    // detect miss increments (good expire counts as miss in engine)
    if (misses > (state.lastMisses|0)){
      state.lastMisses = misses;

      // streak reset on miss
      state.streak = 0;

      // minis that reset on miss
      missResetsMiniIfNeeded();
    } else {
      state.lastMisses = misses;
    }
  }

  function onJudge(ev){
    const d = ev && ev.detail ? ev.detail : {};
    const kind = String(d.kind || '').toLowerCase();
    const text = safeText(d.text || '');

    // classify
    const isBad = (kind === 'bad' || kind === 'warn');
    const isGood = (kind === 'good');
    const isBoss = (kind === 'boss');

    if (isBad){
      // bad resets streak + mini attempt (some)
      state.streak = 0;
      badResetsCurrentMini();
      return;
    }

    // boss hit/kill
    if (isBoss){
      if (text.toUpperCase().includes('BOSS DOWN')){
        state.bossKills = (state.bossKills|0) + 1;

        // MINI BOSS BREAK success on kill
        if (state.miniIndex === 5){
          state.miniNow = state.miniNeed;
          clearMini();
          return;
        }

        checkGoalAdvance();
        return;
      }
      if (text.toUpperCase() === 'HIT!' || text.toUpperCase().includes('HIT')){
        // boss hit counts toward MINI 6
        if (state.miniIndex === 5){
          state.bossHits = (state.bossHits|0) + 1;
          state.miniNow = clamp(state.bossHits, 0, state.bossHitNeed);
          state.miniNeed = state.bossHitNeed;

          if ((state.bossHits|0) >= state.bossHitNeed){
            clearMini();
            return;
          }
          pushUpdate();
        } else {
          // optional: allow boss hit to help streak mini (feel good)
          state.streak = (state.streak|0) + 1;
          if (state.miniIndex === 0){
            state.miniNow = clamp(state.streak, 0, 4);
            state.miniNeed = 4;
            if (state.streak >= 4){
              clearMini();
              return;
            }
            pushUpdate();
          }
        }
        return;
      }
    }

    // good hit
    if (isGood){
      // GOAL1: per-group hit progress
      const gid = state.currentGroupId|0;
      if (gid >= 1 && gid <= 5){
        state.groupHits[gid] = (state.groupHits[gid]||0) + 1;
      }

      // MINI 1: STREAK
      state.streak = (state.streak|0) + 1;
      if (state.miniIndex === 0){
        state.miniNeed = 4;
        state.miniNow = clamp(state.streak, 0, 4);
        if (state.streak >= 4){
          clearMini();
          return;
        }
      }

      // MINI 3: STORM RUSH (only count during storm)
      if (state.miniIndex === 2){
        if (state.stormOn){
          state.stormRushHits = (state.stormRushHits|0) + 1;
          state.miniNeed = 4;
          state.miniNow = clamp(state.stormRushHits, 0, 4);
          if (state.stormRushHits >= 4){
            clearMini();
            return;
          }
        } else {
          // waiting storm: keep prompt
          state.miniNeed = 4;
          state.miniNow = 0;
        }
      }

      // MINI 5: CALL&RESPONSE (current group at mini start)
      if (state.miniIndex === 4){
        if ((state.currentGroupId|0) === (state.callGroupId|0)){
          state.callHits = (state.callHits|0) + 1;
          state.miniNeed = 3;
          state.miniNow = clamp(state.callHits, 0, 3);
          if (state.callHits >= 3){
            clearMini();
            return;
          }
        }
      }

      checkGoalAdvance();
      pushUpdate();
    }
  }

  function onEnd(){
    state.ended = true;
    stopTick();
  }

  // --------- mini subtitle enrichment (optional) ----------
  // We'll piggyback by tweaking miniTitle via pushUpdate only,
  // but keep it simple and consistent with HUD binder.

  // --------- public API ----------
  NS.QuestDirector = {
    reset: resetAll,
    getState: () => JSON.parse(JSON.stringify(state))
  };

  // --------- bind listeners ----------
  function initOnce(){
    if (state.inited) return;
    state.inited = true;

    root.addEventListener('groups:group_change', onGroupChange, { passive:true });
    root.addEventListener('groups:progress', onProgress, { passive:true });
    root.addEventListener('groups:storm', onStorm, { passive:true });

    root.addEventListener('hha:score', onScore, { passive:true });
    root.addEventListener('hha:judge', onJudge, { passive:true });
    root.addEventListener('hha:end', onEnd, { passive:true });

    startTick();
    // initial blank
    resetAll();
  }

  initOnce();
})(typeof window !== 'undefined' ? window : globalThis);