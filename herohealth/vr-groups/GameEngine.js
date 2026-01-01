// === AI Engine Bridge (append at END of /vr-groups/GameEngine.js) ===
// Listens groups:ai:suggest and applies to GameEngine.start options / runtime knobs
(function(root){
  'use strict';
  const DOC = root.document;
  const GroupsVR = root.GroupsVR = root.GroupsVR || {};
  if (!DOC) return;

  // Global AI state (safe)
  const AIState = GroupsVR.AIState = GroupsVR.AIState || {
    enabled:false,
    last:null,
    // multipliers
    spawnRateMul:1,
    sizeMul:1,
    speedMul:1,
    safeZoneMul:1,
    patternKey:null,
    aimAssistLockPx:null,
    reason:''
  };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  // Only apply in play + ai=1
  function aiAllowedNow(){
    const run = String(qs('run','play')||'play').toLowerCase();
    if (run === 'research') return false;  // ✅ hard rule
    const on = String(qs('ai','0')||'0');
    return (on === '1' || on === 'true');
  }

  // Receive suggestion
  root.addEventListener('groups:ai:suggest', (ev)=>{
    const s = (ev.detail||{});
    if (!aiAllowedNow()) {
      AIState.enabled = false;
      AIState.last = null;
      return;
    }
    AIState.enabled = true;
    AIState.last = s;

    AIState.spawnRateMul = clamp(s.spawnRateMul ?? 1, 0.60, 1.60);
    AIState.sizeMul      = clamp(s.sizeMul      ?? 1, 0.75, 1.35);
    AIState.speedMul     = clamp(s.speedMul     ?? 1, 0.75, 1.35);
    AIState.safeZoneMul  = clamp(s.safeZoneMul  ?? 1, 0.80, 1.30);
    AIState.patternKey   = (s.patternKey ?? null);
    AIState.aimAssistLockPx = (s.aimAssistLockPx ?? null);
    AIState.reason = String(s.reason||'');

    // Optional: update VRUI lockPx (best-effort)
    if (AIState.aimAssistLockPx != null) {
      root.HHA_VRUI_CONFIG = root.HHA_VRUI_CONFIG || {};
      root.HHA_VRUI_CONFIG.lockPx = AIState.aimAssistLockPx;
      // If vr-ui.js supports live update in future, this is the hook
      try{
        root.dispatchEvent(new CustomEvent('hha:vrui:config', { detail: { lockPx: AIState.aimAssistLockPx } }));
      }catch(_){}
    }

    // Debug ping
    if (String(qs('debug','0')) === '1'){
      console.log('[AIState]', JSON.stringify({
        spawnRateMul:AIState.spawnRateMul,
        sizeMul:AIState.sizeMul,
        speedMul:AIState.speedMul,
        safeZoneMul:AIState.safeZoneMul,
        patternKey:AIState.patternKey,
        lockPx:AIState.aimAssistLockPx,
        reason:AIState.reason
      }));
    }
  }, {passive:true});

  // Wrap GameEngine.start to inject aiHint / apply known knobs safely
  function tryPatchEngine(){
    const E = GroupsVR.GameEngine;
    if (!E || E.__aiPatched) return;
    if (typeof E.start !== 'function') return;

    const originalStart = E.start.bind(E);

    E.start = function(diff, opts){
      opts = opts || {};

      // Always preserve deterministic research behaviour
      const runMode = String(opts.runMode || qs('run','play') || 'play').toLowerCase();
      const isResearch = (runMode === 'research');

      // Attach aiHint (engine may consume, if implemented)
      const aiHint = (!isResearch && AIState.enabled && aiAllowedNow()) ? {
        spawnRateMul: AIState.spawnRateMul,
        sizeMul:      AIState.sizeMul,
        speedMul:     AIState.speedMul,
        safeZoneMul:  AIState.safeZoneMul,
        patternKey:   AIState.patternKey,
        reason:       AIState.reason
      } : {
        spawnRateMul:1, sizeMul:1, speedMul:1, safeZoneMul:1, patternKey:null, reason:'off'
      };

      // Minimal, non-breaking: stash on opts so engine can read if it wants
      opts.aiHint = aiHint;

      // Best-effort apply (ONLY if these keys exist in your engine options)
      // 1) spawnEveryMs (lower = faster spawns)
      if (!isResearch && typeof opts.spawnEveryMs === 'number'){
        opts.spawnEveryMs = Math.round(opts.spawnEveryMs / (aiHint.spawnRateMul || 1));
      }
      // 2) sizePx (DOM target size)
      if (!isResearch && typeof opts.sizePx === 'number'){
        opts.sizePx = Math.round(opts.sizePx * (aiHint.sizeMul || 1));
      }
      // 3) speed / speedMul
      if (!isResearch && typeof opts.speed === 'number'){
        opts.speed = opts.speed * (aiHint.speedMul || 1);
      }
      if (!isResearch && typeof opts.speedMul === 'number'){
        opts.speedMul = opts.speedMul * (aiHint.speedMul || 1);
      }

      // 4) safeZone multiplier (if your engine uses it)
      if (!isResearch && typeof opts.safeZoneMul === 'number'){
        opts.safeZoneMul = opts.safeZoneMul * (aiHint.safeZoneMul || 1);
      } else if (!isResearch) {
        // if not provided, at least supply it
        opts.safeZoneMul = aiHint.safeZoneMul || 1;
      }

      // 5) pattern key (if your engine supports strategy)
      if (!isResearch && aiHint.patternKey){
        opts.patternKey = aiHint.patternKey;
      }

      // Call original
      const ret = originalStart(diff, opts);

      // Debug event: AI applied
      try{
        root.dispatchEvent(new CustomEvent('groups:ai:applied', { detail: { runMode, aiHint } }));
      }catch(_){}
      return ret;
    };

    E.__aiPatched = true;
  }

  // Patch once engine exists (defer-safe)
  const t = setInterval(()=>{
    tryPatchEngine();
    if (GroupsVR.GameEngine && GroupsVR.GameEngine.__aiPatched) clearInterval(t);
  }, 60);

})(window);