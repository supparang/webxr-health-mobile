// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — PRODUCTION (prediction hooks ONLY; no adaptive by default)
// FULL v20260303-GROUPS-AIHOOKS
//
// Usage (groups.safe.js calls if exists):
//   window.GroupsAIHooks.onSpawn(ctx, targetInfo)
//   window.GroupsAIHooks.onHit(ctx, hitInfo)
//   window.GroupsAIHooks.onExpire(ctx, expireInfo)
//   window.GroupsAIHooks.onTick(ctx, tickInfo)
//   window.GroupsAIHooks.onEnd(ctx, summary)
//
// Optional UI outputs:
//   dispatchEvent('groups:director', {text:"..."})
//   dispatchEvent('hha:coach', {text:"...", mood:"neutral|happy|sad|fever"})
//
(function(){
  'use strict';

  const WIN = window;

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail||{} })); }catch(_){}
  }

  // simple stable risk predictor (heuristic; deterministic from ctx.seed if you want later)
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  const State = {
    enabled: false,          // default off (aiEnabled false)
    hazardRisk: 0.0,         // 0..1
    watchout: '',
    lastDirectorAt: 0
  };

  function setEnabled(v){
    State.enabled = !!v;
  }

  function directorTick(nowMs){
    if(!State.enabled) return;
    if(nowMs - State.lastDirectorAt < 1200) return;
    State.lastDirectorAt = nowMs;

    const pct = Math.round(State.hazardRisk * 100);
    const text = (State.watchout)
      ? `RISK ${pct}% · ระวัง: ${State.watchout}`
      : `RISK ${pct}% · โฟกัสยิงให้ถูกหมู่`;

    emit('groups:director', { text });
  }

  // public API
  WIN.GroupsAIHooks = {
    version: 'v20260303-GROUPS-AIHOOKS',

    setEnabled,

    onSpawn(ctx, t){
      if(!State.enabled) return;
      // small bump risk if spawns crowding
      if(t && t.nearHud) State.hazardRisk = clamp(State.hazardRisk + 0.06, 0, 1);
      directorTick(performance.now());
    },

    onHit(ctx, hit){
      if(!State.enabled) return;
      // reduce risk when player hits correctly
      if(hit && hit.correct) State.hazardRisk = clamp(State.hazardRisk - 0.08, 0, 1);
      else State.hazardRisk = clamp(State.hazardRisk + 0.10, 0, 1);

      if(hit && !hit.correct){
        State.watchout = 'ดู “หมู่” ก่อนยิง';
        emit('hha:coach', { text: 'ดู “หมู่” ให้ชัวร์ก่อนยิงนะ!', mood:'neutral' });
      }
      directorTick(performance.now());
    },

    onExpire(ctx, ex){
      if(!State.enabled) return;
      // if misses rising => increase risk
      if(ex && ex.countedMiss) State.hazardRisk = clamp(State.hazardRisk + 0.05, 0, 1);
      if(ex && ex.overHud){
        State.watchout = 'HUD บังเป้า';
      }
      directorTick(performance.now());
    },

    onTick(ctx, tick){
      if(!State.enabled) return;
      // slight decay
      State.hazardRisk = clamp(State.hazardRisk * 0.985, 0, 1);
      directorTick(performance.now());
    },

    onEnd(ctx, summary){
      if(!State.enabled) return;
      const acc = Number(summary && summary.accuracyPct) || 0;
      if(acc >= 90) emit('hha:coach', { text:'โคตรนิ่ง! แม่นมาก ✅', mood:'happy' });
      else if(acc >= 75) emit('hha:coach', { text:'ดีแล้ว! ลองช้าลงนิดเพื่อคอมโบ 🔥', mood:'neutral' });
      else emit('hha:coach', { text:'ค่อย ๆ ดูหมู่ก่อนยิง จะดีขึ้นเร็วมาก!', mood:'sad' });
    }
  };
})();