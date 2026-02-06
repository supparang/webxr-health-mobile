// === /fitness/js/jump-duck.ai-hooks.js ===
// Jump-Duck AI Hooks — v1 (OFF by default for research)
// Purpose: attach ML/DL model later without breaking gameplay.
'use strict';

export function createJDAIHooks(cfg = {}){
  const enabled = !!cfg.enabled;          // training true, research false
  const deterministic = !!cfg.deterministic;

  const mem = {
    rtMean: 220,
    missStreak: 0,
    hitStreak: 0,
    missJump: 0,
    missDuck: 0,
    phase: 1,
    bossSub: 0,
  };

  // Optional external model (later)
  let model = null;
  async function loadModelIfAny(){
    if (!cfg.modelUrl) return null;
    // placeholder: you can later load TFJS/ONNX here
    model = { url: cfg.modelUrl, loaded:true };
    return model;
  }

  function onFrame(frame){
    // frame: {t, phase, bossSub, progress, view, device}
    mem.phase = frame.phase || mem.phase;
    mem.bossSub = frame.bossSub || mem.bossSub;
  }

  function onHit(evt){
    // evt: {need, rt, phase, bossSub}
    mem.missStreak = 0;
    mem.hitStreak++;
    if (Number.isFinite(evt.rt)) mem.rtMean = 0.88*mem.rtMean + 0.12*evt.rt;
  }

  function onMiss(evt){
    mem.hitStreak = 0;
    mem.missStreak++;
    if (evt.need === 'jump') mem.missJump++;
    if (evt.need === 'duck') mem.missDuck++;
  }

  // ---- outputs (safe defaults) ----
  function getKnobs(){
    // Return multipliers. If disabled => neutral.
    if (!enabled) return { spawnMul:1.0, speedMul:1.0, hitWinMul:1.0, bias:0 };

    // Simple heuristic baseline (can be replaced by model inference later)
    let spawnMul = 1.0;
    let speedMul = 1.0;
    let hitWinMul = 1.0;

    if (mem.phase === 3) { speedMul *= 1.08; spawnMul *= 0.95; }
    if (mem.missStreak >= 2) { spawnMul *= 1.12; speedMul *= 0.95; hitWinMul *= 1.08; }
    if (mem.rtMean > 280) { hitWinMul *= 1.10; spawnMul *= 1.06; }
    if (mem.rtMean < 190 && mem.hitStreak >= 6) { spawnMul *= 0.94; speedMul *= 1.04; hitWinMul *= 0.96; }

    // clamp
    spawnMul = Math.max(0.78, Math.min(1.25, spawnMul));
    speedMul = Math.max(0.88, Math.min(1.22, speedMul));
    hitWinMul= Math.max(0.85, Math.min(1.20, hitWinMul));

    // bias for obstacle type mixing (duck/jump)
    const total = mem.missJump + mem.missDuck + 1;
    const bias = Math.max(-0.35, Math.min(0.35, ((mem.missDuck/total)-(mem.missJump/total))*0.35));

    return { spawnMul, speedMul, hitWinMul, bias };
  }

  function getTip(){
    if (!enabled) return '';
    if (mem.missStreak >= 2) return 'ทิป: กด “ก่อนถึงเส้น” นิดเดียว แล้วจะนิ่งขึ้น ✨';
    if (mem.rtMean > 260)    return 'ทิป: ลองกดให้ไวขึ้นอีกนิด จะได้ COMBO ง่ายขึ้น 🔥';
    return '';
  }

  return {
    enabled,
    deterministic,
    loadModelIfAny,
    onFrame,
    onHit,
    onMiss,
    getKnobs,
    getTip
  };
}