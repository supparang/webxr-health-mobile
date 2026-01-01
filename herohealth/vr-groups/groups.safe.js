// === AI Engine Bridge (append at END of /vr-groups/groups.safe.js) ===
// Listens groups:ai:suggest and applies to GroupsVR.GameEngine runtime knobs safely.
(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const GroupsVR = root.GroupsVR = root.GroupsVR || {};

  // --- small helpers ---
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  // Only apply in play + ai=1 (hard rule: research OFF)
  function aiAllowedNow(){
    const run = String(qs('run','play')||'play').toLowerCase();
    if (run === 'research') return false;
    const on = String(qs('ai','0')||'0').toLowerCase();
    return (on === '1' || on === 'true');
  }

  // Global AI state (safe defaults)
  const AIState = GroupsVR.AIState = GroupsVR.AIState || {
    enabled:false,
    last:null,
    spawnRateMul:1,
    sizeMul:1,
    speedMul:1,
    safeZoneMul:1,
    patternKey:null,
    aimAssistLockPx:null,
    reason:''
  };

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

    // Optional: VRUI lockPx hook (best-effort)
    if (AIState.aimAssistLockPx != null) {
      root.HHA_VRUI_CONFIG = root.HHA_VRUI_CONFIG || {};
      root.HHA_VRUI_CONFIG.lockPx = AIState.aimAssistLockPx;
      try{
        root.dispatchEvent(new CustomEvent('hha:vrui:config', { detail: { lockPx: AIState.aimAssistLockPx } }));
      }catch(_){}
    }

    // Apply to engine live (if it exists)
    try{
      const E = GroupsVR.GameEngine;
      if (E && typeof E.applyAIHint === 'function'){
        E.applyAIHint({
          spawnRateMul: AIState.spawnRateMul,
          sizeMul: AIState.sizeMul,
          speedMul: AIState.speedMul,
          safeZoneMul: AIState.safeZoneMul,
          patternKey: AIState.patternKey,
          reason: AIState.reason
        });
      }
    }catch(_){}

    if (String(qs('debug','0')) === '1'){
      console.log('[Groups AIState]', JSON.stringify({
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

  // Patch engine methods when available
  function tryPatchEngine(){
    const E = GroupsVR.GameEngine;
    if (!E || E.__aiPatched) return;
    if (typeof E.start !== 'function') return;

    // --- attach runtime ai knobs + apply function ---
    E.__aiHint = E.__aiHint || {
      spawnRateMul:1, sizeMul:1, speedMul:1, safeZoneMul:1, patternKey:null, reason:'off'
    };

    // live apply (play only)
    E.applyAIHint = function(hint){
      // respect hard rule
      const rm = String(this.cfg?.runMode || qs('run','play') || 'play').toLowerCase();
      if (rm === 'research' || !aiAllowedNow()){
        this.__aiHint = { spawnRateMul:1, sizeMul:1, speedMul:1, safeZoneMul:1, patternKey:null, reason:'off' };
        return;
      }
      const h = hint || {};
      this.__aiHint = {
        spawnRateMul: clamp(h.spawnRateMul ?? 1, 0.60, 1.60),
        sizeMul:      clamp(h.sizeMul      ?? 1, 0.75, 1.35),
        speedMul:     clamp(h.speedMul     ?? 1, 0.75, 1.35),
        safeZoneMul:  clamp(h.safeZoneMul  ?? 1, 0.80, 1.30),
        patternKey:   (h.patternKey ?? null),
        reason:       String(h.reason||'')
      };
    };

    // Wrap start to seed aiHint into instance and reset when needed
    const originalStart = E.start.bind(E);
    E.start = function(diff, opts){
      opts = opts || {};
      const runMode = (String(opts.runMode || qs('run','play') || 'play').toLowerCase() === 'research') ? 'research' : 'play';

      // reset ai each start
      this.__aiHint = { spawnRateMul:1, sizeMul:1, speedMul:1, safeZoneMul:1, patternKey:null, reason:'off' };

      const ret = originalStart(diff, opts);

      // if ai is allowed and already has state, apply immediately
      try{
        if (runMode !== 'research' && AIState.enabled && aiAllowedNow()){
          this.applyAIHint({
            spawnRateMul: AIState.spawnRateMul,
            sizeMul: AIState.sizeMul,
            speedMul: AIState.speedMul,
            safeZoneMul: AIState.safeZoneMul,
            patternKey: AIState.patternKey,
            reason: AIState.reason
          });
        }
      }catch(_){}

      return ret;
    };

    E.__aiPatched = true;
  }

  const t = setInterval(()=>{
    tryPatchEngine();
    if (GroupsVR.GameEngine && GroupsVR.GameEngine.__aiPatched) clearInterval(t);
  }, 60);

})(window);