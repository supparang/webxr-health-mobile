*** PATCH FINAL: /herohealth/vr-goodjunk/goodjunk.safe.js
*** Add: Survive goal driven by missLimit + Boss-mini correctness + Miss danger pressure

@@
 function makeQuestDirector(opts = {}) {
@@
   function onJunkHit(){
     const m = Q.activeMini;
     if(m && !m.done && m.forbidJunk && !Q.allDone){
       failMini('hit-junk');
     }
   }

+  // ✅ NEW: allow engine to drive goal progress externally (e.g., survive/miss limit)
+  function setGoalExternal(cur, target, done=false){
+    const g = Q.activeGoal;
+    if(!g || Q.allDone) return;
+    g.target = Math.max(1, Number(target)||1);
+    g.cur = clamp(Number(cur)||0, 0, g.target);
+    if (done && !g.done){
+      g.done = true;
+      Q.goalsCleared++;
+      push('goal-complete-external');
+      checkAllDone();
+    } else {
+      push('goal-external');
+    }
+  }

   function getUIState(reason='state'){ return ui(reason); }

-  return { start, tick, addGoalProgress, addMiniProgress, nextGoal, nextMini, failMini, onJunkHit, getUIState };
+  return { start, tick, addGoalProgress, addMiniProgress, nextGoal, nextMini, failMini, onJunkHit, getUIState, setGoalExternal };
 }

@@
 export function boot(opts = {}) {
@@
   const S = {
@@
     __magCoachCdMs: 0
   };

+  // ✅ NEW: miss limit per diff (drives Survive goal)
+  S.missLimit = (diff === 'easy') ? 6 : (diff === 'hard' ? 3 : 4);

@@
   function computeStatsLive(){
@@
   }

@@
   const Q = makeQuestDirector({
@@
   });

   Q.start();

@@
   setTimeout(() => {
@@
   }, 0);

+  // ✅ NEW: drive Survive Goal (Goal 2) by misses/max during play, and finalize at endGame
+  function refreshSurviveGoal(finalize=false){
+    try{
+      const ui = Q.getUIState('peek');
+      if (!ui || !ui.goalTitle) return;
+      // goal 2 text includes "อยู่รอด" in default defs
+      if (ui.goalTitle.indexOf('อยู่รอด') < 0) return;
+      const cur = S.misses|0;
+      const max = S.missLimit|0;
+      const ok = (cur <= max);
+      Q.setGoalExternal(cur, max, finalize && ok);
+    }catch(_){}
+  }

@@
   function tryHitTarget(id, meta = {}) {
@@
     if (isBoss) {
@@
       emitScore();
-      Q.addMiniProgress(1);
       return;
     }

@@
     if (t.type === 'good') {
@@
-      const gDone = Q.addGoalProgress(1).done;
-      const mDone = Q.addMiniProgress(1).done;
+      const gDone = Q.addGoalProgress(1).done;
+
+      // ✅ NEW: do NOT advance mini if current mini is boss-related
+      let mDone = false;
+      try{
+        const ui = Q.getUIState('peek');
+        const miniIsBoss = !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
+        if (!miniIsBoss) mDone = Q.addMiniProgress(1).done;
+      }catch(_){
+        mDone = Q.addMiniProgress(1).done;
+      }

       if (gDone) { Particles.celebrate?.('GOAL'); coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'เป้าถัดไปมาแล้ว!'); Q.nextGoal(); }
       if (mDone) { Particles.celebrate?.('MINI'); coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!'); Q.nextMini(); }
       else { if (S.combo % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'รักษาจังหวะ!'); }

@@
       emitScore();
+      // ✅ keep survive goal updated
+      refreshSurviveGoal(false);
       return;
     }

@@
     if (t.type === 'junk' || t.type === 'trap') {
@@
       // ✅ miss: junk hit
       S.nHitJunk += 1;
       S.misses += 1;
       S.combo = 0;
       setFever(S.fever - 18);
       stun('junk');
       Particles.burstAt?.(t.xView, t.yView, 'JUNK');

@@
       Q.onJunkHit();
       emitScore();
+      // ✅ keep survive goal updated
+      refreshSurviveGoal(false);
       return;
     }
   }

@@
   function spawnBoss() {
@@
   }

   function bossTakeHit(n=1) {
@@
     if (S.bossHp <= 0) {
@@
-      Q.addMiniProgress(1);
     }
   }

+  // ✅ NEW: advance boss-related mini ONLY when mini is about boss
+  // Put this near bossTakeHit() end, right after hp change + before boss down block ends:
+  // (If you prefer, paste inside bossTakeHit() right after logEvent('hit', ...) block)
+
@@
 function bossTakeHit(n=1) {
@@
     logEvent('hit',
       { targetId: null, emoji:'😈', itemType:'boss', judgment:'HIT', isGood: 1 },
       { kind:'boss', hp: S.bossHp, hpMax: S.bossHpMax }
     );
+
+    // ✅ NEW: boss mini progress (only if current mini is boss-related)
+    try{
+      const ui = Q.getUIState('peek');
+      const miniIsBoss = !!(ui && ui.miniTitle && ui.miniTitle.indexOf('บอส') >= 0);
+      if (miniIsBoss){
+        const mDone = Q.addMiniProgress(1).done;
+        if (mDone) { Particles.celebrate?.('MINI'); coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!'); Q.nextMini(); }
+      }
+    }catch(_){}

@@
     if (S.bossHp <= 0) {
@@
       coach('บอสแตกแล้ว! เก่งมาก 🔥', 'happy', 'กลับไปเก็บของดีต่อเลย!');
       logEvent('event', { itemType:'boss', judgment:'DOWN' }, { kind:'boss_down' });
-
-      Q.addMiniProgress(1);
     }
   }

@@
   function endGame(reason = 'time') {
@@
     const stats = computeStatsFinal();
     S.grade = computeGrade(stats, true);
+
+    // ✅ finalize survive goal (pass only if misses <= limit)
+    refreshSurviveGoal(true);

@@
     saveLastSummary(payload);
     showEndSummary(payload);
@@
   }

@@
   function update(dtMs) {
@@
     if (S.timeLeftSec <= 8 && S.timeLeftSec > 0) document.body.classList.add('gj-panic');
     else document.body.classList.remove('gj-panic');

+    // ✅ NEW: extra pressure when close to miss limit (fair + readable)
+    const leftMiss = (S.missLimit|0) - (S.misses|0);
+    if (leftMiss <= 1 && leftMiss >= 0) document.body.classList.add('gj-panic');
@@
     const tNow = nowMs();
     for (const [id, t] of targets) {
@@
       if (tNow >= t.expireMs) {
         if (t.type === 'good') {
           // ✅ miss: good expired
           S.nExpireGood += 1;
           S.misses += 1;
           S.combo = 0;
           setFever(S.fever - 12);

@@
           emitScore();
+          // ✅ keep survive goal updated
+          refreshSurviveGoal(false);
         }
         removeTarget(id);
       }
     }
@@
     emitTime();
     emitScore();
@@
   }