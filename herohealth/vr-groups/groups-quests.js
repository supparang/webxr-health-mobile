/* === /herohealth/vr-groups/groups-quests.js ===
Food Groups VR — Quest System (PRODUCTION / classic script)
✅ No import (classic <script>)
✅ Goals = sequential (หลาย goal ต่อเกม)
✅ Minis = chain ต่อเนื่อง (mini แบบสปีด/ห้ามพลาด/คอมโบ/สลับหมู่)
✅ Hooks:
   - listens: groups:progress, groups:group_change, hha:time, hha:end
   - emits : quest:update { goalTitle, goalNow, goalTotal, miniTitle, miniNow, miniTotal, miniSecLeft, ... }
   - emits : hha:coach { mood, text } (ถ้ามี binder โค้ช)
*/

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  function emit(name, detail){
    root.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // ---- Global namespace ----
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const Q  = (NS.Quests = NS.Quests || {});

  // ---- State ----
  const S = {
    started:false,
    ended:false,

    // goal pipeline
    goalIndex: 0,
    goal: null,
    goalsCleared: 0,

    // mini chain
    miniCount: 0,
    mini: null,
    miniCleared: 0,

    // session signals
    currentGroupId: 1,
    timeLeft: 0,

    // counters in a rolling window
    streakGood: 0,
    streakAll: 0,
    lastHitWasBad: false,
    lastAnyAtMs: 0,

    // mini timer
    miniStartLeft: 0,     // timeLeft at start
    miniDeadlineLeft: 0,  // timeLeft threshold for fail (timeLeft < miniDeadlineLeft)
    miniSecLeft: null,

    // “no mistake” guard
    noBadSinceMiniStart: true,
    noDecoySinceMiniStart: true,
    noJunkSinceMiniStart: true,

    // for swap/power
    swapsDuringMini: 0,
    bossKillsDuringMini: 0,

    // totals for reporting (optional)
    totals: {
      good_hit: 0,
      good_expire: 0,
      junk_hit: 0,
      decoy_hit: 0,
      boss_kill: 0,
      group_swap: 0
    }
  };

  // ---- Helpers ----
  function coach(text, mood){
    emit('hha:coach', { text: String(text||''), mood: mood || 'neutral' });
  }

  function pushHUD(){
    const g = S.goal || { title:'—', now:0, total:0 };
    const m = S.mini || { title:'—', now:0, total:0 };

    emit('quest:update', {
      // goal
      goalTitle: g.title || '—',
      goalNow: (g.now|0),
      goalTotal: (g.total|0),

      // mini
      miniTitle: m.title || '—',
      miniNow: (m.now|0),
      miniTotal: (m.total|0),

      // optional: mini timer
      miniSecLeft: (S.miniSecLeft == null) ? null : (S.miniSecLeft|0),

      // meta
      goalsCleared: S.goalsCleared|0,
      miniCleared: S.miniCleared|0,
      goalIndex: S.goalIndex|0,
      miniCount: S.miniCount|0
    });
  }

  function resetRun(){
    S.started = true;
    S.ended = false;

    S.goalIndex = 0;
    S.goal = null;
    S.goalsCleared = 0;

    S.miniCount = 0;
    S.mini = null;
    S.miniCleared = 0;

    S.streakGood = 0;
    S.streakAll = 0;
    S.lastHitWasBad = false;

    S.miniStartLeft = 0;
    S.miniDeadlineLeft = 0;
    S.miniSecLeft = null;

    S.noBadSinceMiniStart = true;
    S.noDecoySinceMiniStart = true;
    S.noJunkSinceMiniStart = true;

    S.swapsDuringMini = 0;
    S.bossKillsDuringMini = 0;

    S.totals = { good_hit:0, good_expire:0, junk_hit:0, decoy_hit:0, boss_kill:0, group_swap:0 };

    nextGoal(true);
    nextMini(true);
    pushHUD();
  }

  // ---------------- GOALS (Sequential) ----------------
  function makeGoal(idx){
    // “Groups concept”: เป้าหมายหลักเน้นความเข้าใจ 5 หมู่ + การสลับหมู่ด้วยพลัง + boss เป็นบททดสอบ
    const defs = [
      {
        key: 'g1',
        title: 'ยิงให้ถูกหมู่ปัจจุบัน 10 ครั้ง ✅',
        total: 10,
        now: 0,
        onEvent(kind){
          if (kind === 'good_hit'){ this.now++; }
          return this.now >= this.total;
        }
      },
      {
        key: 'g2',
        title: 'สลับหมู่ด้วย POWER ให้ได้ 2 ครั้ง ⚡',
        total: 2,
        now: 0,
        onEvent(kind){
          if (kind === 'group_swap'){ this.now++; }
          return this.now >= this.total;
        }
      },
      {
        key: 'g3',
        title: 'กำจัด BOSS ให้ได้ 1 ตัว 👹',
        total: 1,
        now: 0,
        onEvent(kind){
          if (kind === 'boss_kill'){ this.now++; }
          return this.now >= this.total;
        }
      }
    ];
    return defs[Math.min(idx, defs.length-1)];
  }

  function nextGoal(first){
    S.goal = makeGoal(S.goalIndex);
    if (!S.goal) return;

    coach(first ? 'เริ่มเลย! ยิงให้ถูก “หมู่ปัจจุบัน” นะ 🎯' : 'Goal ใหม่มาแล้ว! ไปต่อ! 🚀', 'happy');
    pushHUD();
  }

  function clearGoal(){
    S.goalsCleared++;
    coach('เคลียร์ GOAL! ✨', 'happy');

    S.goalIndex++;
    const next = makeGoal(S.goalIndex);
    if (next){
      S.goal = next;
      pushHUD();
      // ให้ขึ้น goal ใหม่ทันที
      coach('Goal ถัดไปมาแล้ว! 🔥', 'neutral');
    } else {
      // ไม่มี goal ต่อ — ก็ยังเล่นได้จนหมดเวลา
      S.goal = { title:'GOAL ครบแล้ว! เล่นเก็บคะแนนต่อ 🏁', now:1, total:1, onEvent(){ return false; } };
      pushHUD();
      coach('สุดยอด! Goal ครบทุกด่านแล้ว 💯', 'happy');
    }
  }

  // ---------------- MINIS (Chain / fast & spicy) ----------------
  function miniStartTimer(sec){
    sec = Math.max(1, sec|0);
    S.miniStartLeft = S.timeLeft|0;
    S.miniDeadlineLeft = Math.max(0, (S.timeLeft|0) - sec);
    S.miniSecLeft = sec|0;
  }

  function miniResetGuards(){
    S.noBadSinceMiniStart = true;
    S.noDecoySinceMiniStart = true;
    S.noJunkSinceMiniStart = true;
    S.swapsDuringMini = 0;
    S.bossKillsDuringMini = 0;
  }

  function makeMini(n){
    // minis เน้น “ความเร็ว + วินัย + สลับหมู่”
    const defs = [
      {
        key:'m1',
        title:'สปีด 5 hit ใน 7 วิ ⚡',
        total: 5, now: 0,
        timeSec: 7,
        allowNoBad: false,
        onStart(){ miniStartTimer(this.timeSec); },
        onEvent(kind){
          if (kind === 'good_hit') this.now++;
          return this.now >= this.total;
        }
      },
      {
        key:'m2',
        title:'ห้ามพลาด! เก็บ 6 hit โดยไม่โดน JUNK 🚫',
        total: 6, now: 0,
        timeSec: 0,
        allowNoBad: true,
        onStart(){ /* no timer */ },
        onEvent(kind){
          if (kind === 'junk_hit'){ S.noJunkSinceMiniStart = false; return 'fail'; }
          if (kind === 'good_hit') this.now++;
          return this.now >= this.total;
        }
      },
      {
        key:'m3',
        title:'คอมโบ 8 ติดต่อกัน 🔥',
        total: 8, now: 0,
        timeSec: 0,
        allowNoBad: false,
        onStart(){ /* track via streakGood */ },
        onEvent(kind){
          // ใช้ streakGood ที่อัปเดตข้างล่าง
          this.now = S.streakGood|0;
          return this.now >= this.total;
        }
      },
      {
        key:'m4',
        title:'สลับหมู่ 1 ครั้งใน 10 วิ ⚡',
        total: 1, now: 0,
        timeSec: 10,
        allowNoBad: false,
        onStart(){ miniStartTimer(this.timeSec); },
        onEvent(kind){
          if (kind === 'group_swap') this.now++;
          return this.now >= this.total;
        }
      },
      {
        key:'m5',
        title:'อย่าหลงกล! ห้ามโดน DECOY จนกว่าจะเก็บ 6 hit 🎭',
        total: 6, now: 0,
        timeSec: 0,
        allowNoBad: true,
        onStart(){},
        onEvent(kind){
          if (kind === 'decoy_hit'){ S.noDecoySinceMiniStart = false; return 'fail'; }
          if (kind === 'good_hit') this.now++;
          return this.now >= this.total;
        }
      }
    ];
    return defs[(n-1) % defs.length];
  }

  function nextMini(first){
    S.miniCount++;
    S.mini = makeMini(S.miniCount);
    miniResetGuards();

    if (S.mini && typeof S.mini.onStart === 'function') S.mini.onStart();

    coach(first ? 'Mini Quest เริ่ม! ทำให้ทันนะ ⏱️' : 'Mini Quest ใหม่มาแล้ว! 🔥', 'neutral');
    pushHUD();
  }

  function clearMini(){
    S.miniCleared++;
    coach('ผ่าน MINI! 🎉', 'happy');

    // ต่อ mini ใหม่ทันที
    nextMini(false);
    pushHUD();
  }

  function failMini(reason){
    // ไม่ “จบเกม” แค่รีเซ็ต mini ให้รู้สึกโหด แต่ยุติธรรม
    const r = reason || 'พลาดเงื่อนไข';
    coach('MINI ไม่ผ่าน… ' + r + ' 😵‍💫 ลองใหม่!', 'sad');

    // restart mini fresh
    nextMini(false);
    pushHUD();
  }

  // ---------------- Event Wiring ----------------
  function onTime(ev){
    const d = ev.detail || {};
    const left = d.left|0;
    S.timeLeft = left;

    // mini timer countdown
    if (S.mini && S.mini.timeSec && S.mini.timeSec > 0){
      const secLeft = clamp(left - (S.miniDeadlineLeft|0), 0, 999);
      S.miniSecLeft = secLeft;

      // timeout fail
      if (left < (S.miniDeadlineLeft|0) && (S.mini.now|0) < (S.mini.total|0)){
        failMini('หมดเวลา ⏱️');
      }
    } else {
      S.miniSecLeft = null;
    }

    pushHUD();
  }

  function onGroupChange(ev){
    const d = ev.detail || {};
    S.currentGroupId = d.groupId|0 || S.currentGroupId;
    // ไม่มีรีเซ็ต quest ตอนสลับหมู่ (quest ควรต่อเนื่อง)
  }

  function onProgress(ev){
    if (!S.started || S.ended) return;
    const d = ev.detail || {};
    const kind = String(d.kind || '').toLowerCase();
    if (!kind) return;

    // totals
    if (S.totals[kind] != null) S.totals[kind]++;

    // streak tracking
    if (kind === 'good_hit'){
      S.streakGood++;
      S.streakAll++;
      S.lastHitWasBad = false;
    } else if (kind === 'junk_hit' || kind === 'decoy_hit'){
      S.streakGood = 0;
      S.streakAll = 0;
      S.lastHitWasBad = true;
      S.noBadSinceMiniStart = false;
      if (kind === 'junk_hit') S.noJunkSinceMiniStart = false;
      if (kind === 'decoy_hit') S.noDecoySinceMiniStart = false;
    } else if (kind === 'group_swap'){
      S.swapsDuringMini++;
    } else if (kind === 'boss_kill'){
      S.bossKillsDuringMini++;
    }

    // --- GOAL update ---
    if (S.goal && typeof S.goal.onEvent === 'function'){
      const done = S.goal.onEvent(kind);
      if (done === true){
        clearGoal();
      }
    }

    // --- MINI update ---
    if (S.mini && typeof S.mini.onEvent === 'function'){
      const res = S.mini.onEvent(kind);

      // fail (explicit)
      if (res === 'fail'){
        failMini('โดนเงื่อนไข 🚫');
        return;
      }

      // allowNoBad minis: if any bad happened -> fail immediately
      if (S.mini.allowNoBad){
        if (!S.noJunkSinceMiniStart && S.mini.key === 'm2'){
          failMini('โดน JUNK 🚫');
          return;
        }
        if (!S.noDecoySinceMiniStart && S.mini.key === 'm5'){
          failMini('โดน DECOY 🎭');
          return;
        }
      }

      // timer-based: if time already hit 0 -> handled by onTime, here just check success
      if (res === true){
        clearMini();
        return;
      }
    }

    pushHUD();
  }

  function onEnd(){
    S.ended = true;
  }

  // Auto init:
  // - ถ้าเกมเริ่มแล้ว engine จะ emit hha:time ทันที + groups:group_change
  // - เราจะเริ่ม quest เมื่อเห็น hha:time ครั้งแรก (left>0)
  let armed = false;

  root.addEventListener('hha:time', (ev)=>{
    const left = ((ev.detail||{}).left|0);
    if (!armed && left > 0){
      armed = true;
      resetRun();
    }
    onTime(ev);
  }, { passive:true });

  root.addEventListener('groups:group_change', onGroupChange, { passive:true });
  root.addEventListener('groups:progress', onProgress, { passive:true });
  root.addEventListener('hha:end', onEnd, { passive:true });

  // expose small api
  Q.reset = resetRun;
  Q.pushHUD = pushHUD;

})(window);