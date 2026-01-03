// === /herohealth/vr-groups/ai-hooks.js ===
// AI Hooks (Disabled by default) — PRODUCTION SAFE
// ✅ attach({runMode, seed, enabled})
// ✅ Emits hha:ai events as hook points (no gameplay mutation by default)
// ✅ Adds micro-tip coach (rate-limited) when enabled
(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  const AI = {
    enabled:false,
    runMode:'play',
    lastTipAt:0,
    tipGapMs: 5500,
    seed:''
  };

  function maybeTip(text, mood){
    if (!AI.enabled) return;
    const t = Date.now();
    if (t - AI.lastTipAt < AI.tipGapMs) return;
    AI.lastTipAt = t;
    emit('hha:coach', { text, mood: mood || 'neutral' });
  }

  function attach(cfg){
    cfg = cfg || {};
    AI.runMode = String(cfg.runMode||'play');
    AI.seed = String(cfg.seed||'');
    AI.enabled = !!cfg.enabled && AI.runMode !== 'research';

    emit('hha:ai', { kind:'attach', enabled: AI.enabled, seed: AI.seed, runMode: AI.runMode });

    if (!AI.enabled) return;

    // Difficulty Director (hook-only): just observe & suggest
    root.addEventListener('hha:rank', (ev)=>{
      const d = ev.detail||{};
      const acc = clamp(d.accuracy||0, 0, 100);
      emit('hha:ai', { kind:'observe_rank', acc });

      if (acc < 55) maybeTip('ลอง “แตะให้มั่น” ก่อนยิงเร็ว — เน้นถูกมากกว่ารัวนะ!', 'sad');
      else if (acc >= 85) maybeTip('ดีมาก! ตอนนี้ลองคุม “คอมโบ” ให้ยาวขึ้นอีกนิด 🔥', 'happy');
    }, { passive:true });

    // Coach micro-tips on mistakes
    root.addEventListener('hha:judge', (ev)=>{
      const d = ev.detail||{};
      const k = String(d.kind||'').toLowerCase();
      emit('hha:ai', { kind:'observe_judge', judge:k });

      if (k === 'bad') maybeTip('เจอของหลอก/อาหารขยะแล้ว! มอง “สี/ตำแหน่ง” ก่อนแตะ 0.2 วิ', 'neutral');
      if (k === 'miss') maybeTip('พลาดได้ แต่รีเซ็ตแล้วเริ่มคอมโบใหม่ทันที ✨', 'neutral');
    }, { passive:true });

    // Pattern Generator hook: observe storm/boss
    root.addEventListener('groups:progress', (ev)=>{
      const d = ev.detail||{};
      const kind = String(d.kind||'');
      emit('hha:ai', { kind:'observe_progress', event: kind });

      if (kind === 'storm_on') maybeTip('STORM มาแล้ว! โฟกัส “ถูกก่อนเร็ว” 🔥', 'fever');
      if (kind === 'boss_spawn') maybeTip('บอสโผล่! เล็งกลางเป้า แล้วแตะให้ชัวร์ 🎯', 'happy');
    }, { passive:true });
  }

  NS.AIHooks = { attach };

})(typeof window !== 'undefined' ? window : globalThis);